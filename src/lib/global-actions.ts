"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, requireRole } from "./auth";
import { DEMO_USERS } from "./seed";
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
    if (r.status !== "new" && r.status !== "offered") return fail("По этой заявке предложения больше не принимаются.");
    if (r.offers.some((o) => o.supplierId === u.id && !o.importerDecision)) return fail("Вы уже отправили предложение, ждите проверки импортёра.");
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
    if (r.status !== "offered") return fail("Заявка не в статусе проверки.");
    const n = z.string().trim().max(300).safeParse(note);
    if (!n.success) return fail("Заметка слишком длинная.");
    if (decision === "rejected" && n.data.length < 3) return fail("Укажите причину отказа.");
    o.importerDecision = decision;
    o.importerNote = n.data;
    if (decision === "approved") {
      push(r, "importer_approved", u.id);
      notify(r.buyerId, `По заявке ${r.number} есть проверенное предложение. Проверьте условия и подтвердите или откажитесь.`);
    } else if (r.offers.every((x) => x.importerDecision === "rejected")) {
      push(r, "importer_rejected", u.id);
      notify(r.buyerId, `По заявке ${r.number} импортёр не смог подтвердить ввоз. ${n.data}`);
    }
    commit();
    return ok(decision === "approved" ? "Предложение одобрено." : "Предложение отклонено.");
  } catch (e) { return err(e); }
}

export async function buyerGlobalDecide(requestId: string, decision: "confirm" | "decline"): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const r = db().globals.find((x) => x.id === requestId);
    if (!r || r.buyerId !== u.id) return fail("Нет доступа.");
    if (r.status !== "importer_approved") return fail("Сейчас нечего подтверждать.");
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
