"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "./auth";
import { BRANCHES, DEMO_USERS } from "./seed";
import { db, nextNumber, notify, persist } from "./store";
import type { ActionResult, CargoLine, CargoLineStatus, ShipmentStatus } from "./types";

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const commit = () => { persist(); revalidatePath("/", "layout"); };
const err = (e: unknown) => fail(e instanceof Error ? e.message : "Ошибка");

function pushLine(l: CargoLine, status: CargoLineStatus, by: string) {
  l.status = status;
  l.history.push({ status, at: new Date().toISOString(), by });
}
const importers = () => DEMO_USERS.filter((u) => u.role === "importer");
const branchName = (id: string) => { const b = BRANCHES.find((x) => x.id === id); return b ? `${b.city}, ${b.name}` : id; };

const lineSchema = z.object({
  medicineName: z.string().trim().min(2, "Укажите название или действующее вещество").max(120),
  dosage: z.string().trim().min(1, "Укажите дозировку").max(40),
  form: z.string().trim().min(1, "Укажите форму выпуска").max(40),
  qty: z.number({ invalid_type_error: "Укажите количество" }).int().min(1, "Минимум 1 упаковка").max(999),
  storage: z.enum(["room", "cool", "frozen"], { errorMap: () => ({ message: "Выберите условия хранения" }) }),
  prescription: z.boolean(),
  branchId: z.string().refine((id) => BRANCHES.some((b) => b.id === id), "Выберите точку выдачи"),
  prescriptionAck: z.literal(true, { errorMap: () => ({ message: "Подтвердите, что понимаете требования к рецептурным препаратам" }) }),
});

/** Покупатель оформляет заказ в сборную отправку, достаточно одной упаковки. */
export async function createCargoLine(raw: unknown): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const p = lineSchema.safeParse(raw);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Некорректные данные");
    const l: CargoLine = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, number: nextNumber("CG"), buyerId: u.id,
      ...p.data, status: "requested", createdAt: new Date().toISOString(),
      history: [{ status: "requested", at: new Date().toISOString(), by: u.id }],
    };
    db().cargoLines.unshift(l);
    notify(u.id, `Заказ ${l.number} создан. Это запрос в сборную отправку: ввоз не гарантируется до проверки импортёром.`);
    for (const i of importers()) notify(i.id, `Новый заказ в Cargo ${l.number}: ${l.medicineName} ${l.dosage} × ${l.qty}.`);
    commit();
    return ok(`Заказ ${l.number} создан.`);
  } catch (e) { return err(e); }
}

export async function cancelCargoLine(lineId: string): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const l = db().cargoLines.find((x) => x.id === lineId);
    if (!l || l.buyerId !== u.id) return fail("Нет доступа.");
    if (!["requested", "verified", "declined"].includes(l.status)) return fail("Заказ уже в отправке, отменить нельзя.");
    pushLine(l, "cancelled", u.id);
    commit();
    return ok("Заказ отменён.");
  } catch (e) { return err(e); }
}

/** Импортёр проверяет возможность ввоза и рецептурные требования. Отказ только с причиной. */
export async function importerVerifyLine(lineId: string, decision: "verified" | "declined", note: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const l = db().cargoLines.find((x) => x.id === lineId);
    if (!l) return fail("Заказ не найден.");
    if (l.status !== "requested") return fail("Заказ уже проверен.");
    const n = z.string().trim().max(300).safeParse(note);
    if (!n.success) return fail("Заметка слишком длинная.");
    if (decision === "declined" && n.data.length < 3) return fail("Укажите причину отказа.");
    l.importerNote = n.data || undefined;
    pushLine(l, decision, u.id);
    notify(l.buyerId, decision === "verified" ? `Заказ ${l.number} проверен импортёром и ждёт включения в отправку.` : `По заказу ${l.number} импортёр не подтвердил ввоз. ${n.data}`);
    commit();
    return ok(decision === "verified" ? "Заказ проверен." : "Заказ отклонён.");
  } catch (e) { return err(e); }
}

/** Добавляет проверенные заказы в отправку. Совместимость: одна отправка = один класс хранения. */
export async function addLinesToShipment(lineIds: string[]): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const ids = z.array(z.string()).min(1, "Выберите хотя бы один заказ").safeParse(lineIds);
    if (!ids.success) return fail(ids.error.issues[0]?.message ?? "Выберите заказы");
    const lines = ids.data.map((id) => db().cargoLines.find((x) => x.id === id));
    if (lines.some((l) => !l)) return fail("Один из заказов не найден.");
    const ls = lines as CargoLine[];
    if (ls.some((l) => l.status !== "verified")) return fail("В отправку можно включить только проверенные заказы.");
    const classes = new Set(ls.map((l) => l.storage));
    if (classes.size > 1) return fail("Нельзя объединять препараты с разными условиями хранения. Выберите заказы одного класса.");
    const storage = ls[0].storage;
    let sh = db().shipments.find((s) => s.status === "forming" && s.storage === storage);
    if (!sh) {
      sh = { id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, number: nextNumber("SH"), storage, status: "forming", createdAt: new Date().toISOString(), history: [{ status: "forming", at: new Date().toISOString(), by: u.id }] };
      db().shipments.unshift(sh);
    }
    for (const l of ls) { l.shipmentId = sh.id; pushLine(l, "in_shipment", u.id); notify(l.buyerId, `Заказ ${l.number} включён в отправку ${sh.number}.`); }
    commit();
    return ok(`Включено заказов: ${ls.length}. Отправка ${sh.number}.`);
  } catch (e) { return err(e); }
}

/** Продвигает отправку: forming → in_transit → arrived. Статусы заказов меняются вместе с ней. */
export async function advanceShipment(shipmentId: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const sh = db().shipments.find((x) => x.id === shipmentId);
    if (!sh) return fail("Отправка не найдена.");
    const lines = db().cargoLines.filter((l) => l.shipmentId === sh.id);
    const next: Record<string, { to: ShipmentStatus; line: CargoLineStatus; text: string } | undefined> = {
      forming: { to: "in_transit", line: "in_transit", text: "отправлена в путь" },
      in_transit: { to: "arrived", line: "arrived", text: "прибыла" },
    };
    const step = next[sh.status];
    if (!step) return fail("Эту отправку нельзя продвинуть дальше. Для распределения используйте кнопки у заказов.");
    if (sh.status === "forming" && lines.length === 0) return fail("В отправке нет заказов.");
    if (lines.some((l) => l.altStatus === "proposed")) return fail("Есть заказы с несогласованной альтернативной точкой выдачи.");
    sh.status = step.to;
    sh.history.push({ status: step.to, at: new Date().toISOString(), by: u.id });
    for (const l of lines) { pushLine(l, step.line, u.id); notify(l.buyerId, `Отправка ${sh.number} ${step.text} (заказ ${l.number}).`); }
    commit();
    return ok(`Отправка ${sh.number}: ${step.text}.`);
  } catch (e) { return err(e); }
}

/** Импортёр предлагает альтернативную точку, применяется только после согласия покупателя. */
export async function proposeAltBranch(lineId: string, branchId: string): Promise<ActionResult> {
  try {
    requireRole("importer");
    const l = db().cargoLines.find((x) => x.id === lineId);
    if (!l) return fail("Заказ не найден.");
    if (!BRANCHES.some((b) => b.id === branchId)) return fail("Выберите точку.");
    if (branchId === l.branchId) return fail("Это уже выбранная покупателем точка.");
    if (!["in_shipment", "in_transit", "arrived"].includes(l.status)) return fail("Альтернативу можно предложить после включения в отправку.");
    l.altBranchId = branchId; l.altStatus = "proposed";
    notify(l.buyerId, `По заказу ${l.number} предложена другая точка выдачи: ${branchName(branchId)}. Без вашего согласия выдача останется в выбранной вами точке.`);
    commit();
    return ok("Альтернатива отправлена покупателю на согласование.");
  } catch (e) { return err(e); }
}

export async function buyerAltDecide(lineId: string, decision: "accept" | "decline"): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const l = db().cargoLines.find((x) => x.id === lineId);
    if (!l || l.buyerId !== u.id) return fail("Нет доступа.");
    if (l.altStatus !== "proposed") return fail("Нет предложения для согласования.");
    l.altStatus = decision === "accept" ? "accepted" : "declined";
    for (const i of importers()) notify(i.id, `Покупатель ${decision === "accept" ? "согласился на альтернативную точку" : "отказался от альтернативной точки"} по заказу ${l.number}.`);
    commit();
    return ok(decision === "accept" ? "Вы согласились на альтернативную точку." : "Выдача останется в выбранной вами точке.");
  } catch (e) { return err(e); }
}

/** Распределение прибывших заказов по точкам выдачи: альтернатива только если покупатель согласился. */
export async function distributeShipment(shipmentId: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const sh = db().shipments.find((x) => x.id === shipmentId);
    if (!sh || sh.status !== "arrived") return fail("Распределить можно только прибывшую отправку.");
    const lines = db().cargoLines.filter((l) => l.shipmentId === sh.id && l.status === "arrived");
    if (lines.some((l) => l.altStatus === "proposed")) return fail("Есть заказы с несогласованной альтернативной точкой.");
    for (const l of lines) {
      const point = l.altStatus === "accepted" && l.altBranchId ? l.altBranchId : l.branchId;
      pushLine(l, "ready_for_pickup", u.id);
      notify(l.buyerId, `Заказ ${l.number} готов к получению: ${branchName(point)}.`);
    }
    sh.status = "closed";
    sh.history.push({ status: "closed", at: new Date().toISOString(), by: u.id });
    commit();
    return ok(`Распределено заказов: ${lines.length}.`);
  } catch (e) { return err(e); }
}

export async function markLineIssued(lineId: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const l = db().cargoLines.find((x) => x.id === lineId);
    if (!l || l.status !== "ready_for_pickup") return fail("Заказ не готов к выдаче.");
    pushLine(l, "issued", u.id);
    notify(l.buyerId, `Заказ ${l.number} выдан.`);
    commit();
    return ok("Отмечено как выдано.");
  } catch (e) { return err(e); }
}
