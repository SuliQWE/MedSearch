"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, requireRole } from "./auth";
import { BRANCHES, DEMO_USERS } from "./seed";
import { db, nextNumber, notify, persist } from "./store";
import type { ActionResult, GlobalRequest, GlobalStatus } from "./types";

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const commit = () => { persist(); revalidatePath("/", "layout"); };
const err = (e: unknown) => fail(e instanceof Error ? e.message : "Ошибка");

function push(r: GlobalRequest, status: GlobalStatus, by: string) {
  r.status = status;
  r.history.push({ status, at: new Date().toISOString(), by });
}
function notifyRole(role: "supplier" | "importer", text: string) {
  for (const u of DEMO_USERS.filter((x) => x.role === role)) notify(u.id, text);
}

const createSchema = z.object({
  medicineName: z.string().trim().min(2, "Укажите название или действующее вещество").max(120),
  dosage: z.string().trim().min(1, "Укажите дозировку").max(40),
  form: z.string().trim().min(1, "Укажите форму выпуска").max(40),
  qty: z.number({ invalid_type_error: "Укажите количество" }).int().min(1, "Минимум 1 упаковка").max(999),
  comment: z.string().trim().max(500).default(""),
  storage: z.enum(["room", "cool", "frozen"], { errorMap: () => ({ message: "Выберите условия хранения" }) }),
  prescription: z.boolean().default(false),
  branchId: z.string().refine((id) => BRANCHES.some((b) => b.id === id), "Выберите точку выдачи"),
  prescriptionAck: z.literal(true, { errorMap: () => ({ message: "Подтвердите, что понимаете требования к рецептурным препаратам" }) }),
});

/** Покупатель создаёт индивидуальную заявку, достаточно одной упаковки. */
export async function createGlobalRequest(raw: unknown): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const p = createSchema.safeParse(raw);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Некорректные данные");
    const r: GlobalRequest = {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      number: nextNumber("GL"),
      buyerId: u.id,
      ...p.data,
      status: "new",
      offers: [],
      createdAt: new Date().toISOString(),
      history: [{ status: "new", at: new Date().toISOString(), by: u.id }],
    };
    db().globals.unshift(r);
    notify(u.id, `Заявка ${r.number} создана. Это запрос на подбор: ввоз не гарантируется до проверки импортёром.`);
    notifyRole("supplier", `Новая заявка ${r.number}: ${r.medicineName} ${r.dosage}, ${r.qty} уп.`);
    commit();
    return ok(`Заявка ${r.number} создана.`);
  } catch (e) { return err(e); }
}

const offerSchema = z.object({
  pricePerPack: z.number().min(1, "Укажите цену за упаковку").max(1e7),
  leadTimeDays: z.number().int().min(1, "Срок не менее 1 дня").max(365),
  note: z.string().trim().max(300).default(""),
});

export async function supplierOffer(requestId: string, raw: unknown): Promise<ActionResult> {
  try {
    const u = requireRole("supplier");
    const r = db().globals.find((x) => x.id === requestId);
    if (!r) return fail("Заявка не найдена.");
    if (!["new", "offered", "importer_approved"].includes(r.status)) return fail("По этой заявке предложения больше не принимаются.");
    if (r.offers.some((o) => o.supplierId === u.id && o.importerDecision !== "rejected")) return fail("Вы уже отправили предложение по этой заявке.");
    const p = offerSchema.safeParse(raw);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Некорректные данные");
    r.offers.push({ id: `of-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, supplierId: u.id, ...p.data });
    if (r.status === "new") push(r, "offered", u.id);
    notifyRole("importer", `Предложение по заявке ${r.number} ждёт вашей проверки.`);
    commit();
    return ok("Предложение отправлено импортёру на проверку.");
  } catch (e) { return err(e); }
}

export async function importerDecide(requestId: string, offerId: string, decision: "approved" | "rejected", note: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const r = db().globals.find((x) => x.id === requestId);
    const o = r?.offers.find((x) => x.id === offerId);
    if (!r || !o) return fail("Предложение не найдено.");
    if (o.importerDecision) return fail("Решение уже принято.");
    if (r.status !== "offered" && r.status !== "importer_approved") return fail("Заявка не в статусе проверки.");
    const n = z.string().trim().max(300).safeParse(note);
    if (!n.success) return fail("Заметка слишком длинная.");
    if (decision === "rejected" && n.data.length < 3) return fail("Укажите причину отказа.");
    o.importerDecision = decision;
    o.importerNote = n.data;
    if (decision === "approved") {
      if (r.status !== "importer_approved") push(r, "importer_approved", u.id);
      const n2 = r.offers.filter((x) => x.importerDecision === "approved").length;
      notify(r.buyerId, `По заявке ${r.number} проверенных предложений: ${n2}. Выберите подходящее или откажитесь.`);
    } else if (r.offers.every((x) => x.importerDecision === "rejected")) {
      push(r, "importer_rejected", u.id);
      notify(r.buyerId, `По заявке ${r.number} импортёр не смог подтвердить ввоз. ${n.data}`);
    }
    commit();
    return ok(decision === "approved" ? "Предложение одобрено." : "Предложение отклонено.");
  } catch (e) { return err(e); }
}

export async function buyerGlobalDecide(requestId: string, decision: "confirm" | "decline", offerId?: string): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const r = db().globals.find((x) => x.id === requestId);
    if (!r || r.buyerId !== u.id) return fail("Нет доступа.");
    if (r.status !== "importer_approved") return fail("Сейчас нечего подтверждать.");
    if (decision === "confirm") {
      const o = r.offers.find((x) => x.id === offerId && x.importerDecision === "approved");
      if (!o) return fail("Выберите одно из проверенных предложений.");
      r.chosenOfferId = o.id;
      notify(o.supplierId, `Покупатель выбрал ваше предложение по заявке ${r.number}.`);
      for (const x of r.offers.filter((y) => y.importerDecision === "approved" && y.id !== o.id)) notify(x.supplierId, `По заявке ${r.number} покупатель выбрал другое предложение.`);
    }
    push(r, decision === "confirm" ? "buyer_confirmed" : "buyer_declined", u.id);
    notifyRole("importer", `Покупатель ${decision === "confirm" ? "подтвердил" : "отклонил"} условия по заявке ${r.number}.`);
    commit();
    return ok(decision === "confirm" ? "Условия подтверждены. Дальнейшие шаги сообщит импортёр." : "Вы отказались от предложения.");
  } catch (e) { return err(e); }
}

export async function buyerGlobalCancel(requestId: string): Promise<ActionResult> {
  const u = currentUser();
  const r = db().globals.find((x) => x.id === requestId);
  if (!u || !r || r.buyerId !== u.id) return fail("Нет доступа.");
  if (!["new", "offered", "importer_approved"].includes(r.status)) return fail("Эту заявку нельзя отменить.");
  push(r, "cancelled", u.id);
  commit();
  return ok("Заявка отменена.");
}

/* ---------- После выбора предложения: отправка, прибытие, распределение, выдача ---------- */
const branchName = (id?: string) => { const b = BRANCHES.find((x) => x.id === id); return b ? `${b.city}, ${b.name}` : "—"; };
const pickupPoint = (r: GlobalRequest) => (r.altStatus === "accepted" && r.altBranchId ? r.altBranchId : r.branchId ?? "b1");

/** Импортёр включает подтверждённые заявки в отправку. Одна отправка = один класс хранения. */
export async function addGlobalsToShipment(requestIds: string[]): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const ids = z.array(z.string()).min(1, "Выберите хотя бы одну заявку").safeParse(requestIds);
    if (!ids.success) return fail(ids.error.issues[0]?.message ?? "Выберите заявки");
    const found = ids.data.map((id) => db().globals.find((x) => x.id === id));
    if (found.some((r) => !r)) return fail("Одна из заявок не найдена.");
    const rs = found as GlobalRequest[];
    if (rs.some((r) => r.status !== "buyer_confirmed")) return fail("В отправку можно включить только заявки, подтверждённые покупателем.");
    const classes = new Set(rs.map((r) => r.storage ?? "room"));
    if (classes.size > 1) return fail("Нельзя объединять препараты с разными условиями хранения. Выберите заявки одного класса.");
    const storage = rs[0].storage ?? "room";
    let sh = db().shipments.find((s) => s.status === "forming" && s.storage === storage && s.kind === "global");
    if (!sh) {
      const now = new Date().toISOString();
      sh = { id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, number: nextNumber("SH"), storage, kind: "global", status: "forming", createdAt: now, history: [{ status: "forming", at: now, by: u.id }] };
      db().shipments.unshift(sh);
    }
    for (const r of rs) { r.shipmentId = sh.id; push(r, "in_shipment", u.id); notify(r.buyerId, `Заявка ${r.number} включена в отправку ${sh.number}.`); }
    commit();
    return ok(`Включено заявок: ${rs.length}. Отправка ${sh.number}.`);
  } catch (e) { return err(e); }
}

/** Продвигает отправку: forming → in_transit → arrived. Статусы заявок меняются вместе с ней. */
export async function advanceGlobalShipment(shipmentId: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const sh = db().shipments.find((x) => x.id === shipmentId && x.kind === "global");
    if (!sh) return fail("Отправка не найдена.");
    const rs = db().globals.filter((r) => r.shipmentId === sh.id);
    const step = ({ forming: { to: "in_transit", text: "отправлена в путь" }, in_transit: { to: "arrived", text: "прибыла" } } as const)[sh.status as "forming" | "in_transit"];
    if (!step) return fail("Эту отправку нельзя продвинуть дальше. Для распределения используйте кнопку распределения.");
    if (rs.length === 0) return fail("В отправке нет заявок.");
    if (rs.some((r) => r.altStatus === "proposed")) return fail("Есть заявки с несогласованной альтернативной точкой выдачи. Дождитесь решения покупателя.");
    sh.status = step.to;
    sh.history.push({ status: step.to, at: new Date().toISOString(), by: u.id });
    for (const r of rs) { push(r, step.to, u.id); notify(r.buyerId, `Отправка ${sh.number} ${step.text} (заявка ${r.number}).`); }
    commit();
    return ok(`Отправка ${sh.number}: ${step.text}.`);
  } catch (e) { return err(e); }
}

/** Импортёр предлагает альтернативную точку; применяется только после согласия покупателя. */
export async function proposeGlobalAlt(requestId: string, branchId: string): Promise<ActionResult> {
  try {
    requireRole("importer");
    const r = db().globals.find((x) => x.id === requestId);
    if (!r) return fail("Заявка не найдена.");
    if (!BRANCHES.some((b) => b.id === branchId)) return fail("Выберите точку.");
    if (branchId === (r.branchId ?? "b1")) return fail("Это уже выбранная покупателем точка.");
    if (!["in_shipment", "in_transit", "arrived"].includes(r.status)) return fail("Альтернативу можно предложить после включения в отправку и до распределения.");
    r.altBranchId = branchId; r.altStatus = "proposed";
    notify(r.buyerId, `По заявке ${r.number} предложена другая точка выдачи: ${branchName(branchId)}. Без вашего согласия выдача останется в выбранной вами точке.`);
    commit();
    return ok("Альтернатива отправлена покупателю на согласование.");
  } catch (e) { return err(e); }
}

export async function buyerGlobalAltDecide(requestId: string, decision: "accept" | "decline"): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const r = db().globals.find((x) => x.id === requestId);
    if (!r || r.buyerId !== u.id) return fail("Нет доступа.");
    if (r.altStatus !== "proposed") return fail("Нет предложения для согласования.");
    r.altStatus = decision === "accept" ? "accepted" : "declined";
    notifyRole("importer", `Покупатель ${decision === "accept" ? "согласился на альтернативную точку" : "отказался от альтернативной точки"} по заявке ${r.number}.`);
    commit();
    return ok(decision === "accept" ? "Вы согласились на альтернативную точку." : "Выдача останется в выбранной вами точке.");
  } catch (e) { return err(e); }
}

/** Распределение прибывшей отправки по точкам выдачи; покупатель получает адрес и номер заявки. */
export async function distributeGlobalShipment(shipmentId: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const sh = db().shipments.find((x) => x.id === shipmentId && x.kind === "global");
    if (!sh || sh.status !== "arrived") return fail("Распределить можно только прибывшую отправку.");
    const rs = db().globals.filter((r) => r.shipmentId === sh.id && r.status === "arrived");
    if (rs.some((r) => r.altStatus === "proposed")) return fail("Есть заявки с несогласованной альтернативной точкой. Дождитесь решения покупателя.");
    for (const r of rs) {
      const b = BRANCHES.find((x) => x.id === pickupPoint(r));
      push(r, "ready_for_pickup", u.id);
      notify(r.buyerId, `Заявка ${r.number} готова к получению: ${b ? `${b.city}, ${b.name}, ${b.address}, часы работы ${b.hours}` : "точка уточняется"}. При получении назовите номер заявки ${r.number}.`);
    }
    sh.status = "closed";
    sh.history.push({ status: "closed", at: new Date().toISOString(), by: u.id });
    commit();
    return ok(`Распределено заявок: ${rs.length}.`);
  } catch (e) { return err(e); }
}

export async function markGlobalIssued(requestId: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const r = db().globals.find((x) => x.id === requestId);
    if (!r || r.status !== "ready_for_pickup") return fail("Заявка не готова к выдаче.");
    push(r, "issued", u.id);
    notify(r.buyerId, `Заявка ${r.number} выдана.`);
    commit();
    return ok("Отмечено как выдано.");
  } catch (e) { return err(e); }
}
