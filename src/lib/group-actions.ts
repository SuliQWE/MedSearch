"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "./auth";
import { DEMO_USERS } from "./seed";
import { db, nextNumber, notify, persist } from "./store";
import type { ActionResult, GroupOrder, GroupStatus } from "./types";

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const commit = () => { persist(); revalidatePath("/", "layout"); };
const err = (e: unknown) => fail(e instanceof Error ? e.message : "Ошибка");
const DAY = 86_400_000;

function push(g: GroupOrder, status: GroupStatus, by: string, note?: string) {
  g.status = status;
  g.history.push({ status, at: new Date().toISOString(), by, note });
}
function notifyRole(role: "supplier" | "importer", text: string) {
  for (const u of DEMO_USERS.filter((x) => x.role === role)) notify(u.id, text);
}
const total = (g: GroupOrder) => g.members.reduce((s, m) => s + m.qty, 0);

/** Нормализация: объединяем только при совпадении препарата, дозировки и формы. */
function groupKey(name: string, dosage: string, form: string): string {
  const n = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  const d = (s: string) => n(s).replace(/,/g, ".").replace(/\s/g, "");
  return `${n(name)}|${d(dosage)}|${n(form)}`;
}

const joinSchema = z.object({
  medicineName: z.string().trim().min(2, "Укажите название или действующее вещество").max(120),
  dosage: z.string().trim().min(1, "Укажите дозировку").max(40),
  form: z.string().trim().min(1, "Укажите форму выпуска").max(40),
  qty: z.number({ invalid_type_error: "Укажите количество" }).int().min(1, "Минимум 1 упаковка").max(999),
  prescriptionAck: z.literal(true, { errorMap: () => ({ message: "Подтвердите, что понимаете требования к рецептурным препаратам" }) }),
});

/** Покупатель вступает в открытую группу с тем же препаратом, дозировкой и формой или создаёт новую. */
export async function joinOrCreateGroup(raw: unknown): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const p = joinSchema.safeParse(raw);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Некорректные данные");
    const key = groupKey(p.data.medicineName, p.data.dosage, p.data.form);
    let g = db().groups.find((x) => x.key === key && x.status === "open" && new Date(x.deadline).getTime() > Date.now());
    const created = !g;
    if (!g) {
      g = {
        id: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, number: nextNumber("GR"), key,
        medicineName: p.data.medicineName, dosage: p.data.dosage, form: p.data.form,
        status: "open", deadline: new Date(Date.now() + 14 * DAY).toISOString(), members: [], offers: [],
        createdAt: new Date().toISOString(), history: [{ status: "open", at: new Date().toISOString(), by: u.id }],
      };
      db().groups.unshift(g);
    }
    if (g.members.some((m) => m.buyerId === u.id)) return fail("Вы уже участвуете в этой группе.");
    g.members.push({ buyerId: u.id, qty: p.data.qty, joinedAt: new Date().toISOString(), confirmation: "pending" });
    notify(u.id, `${created ? "Создана группа" : "Вы вступили в группу"} ${g.number}. Это набор общего спроса: ввоз не гарантируется до проверки импортёром.`);
    notifyRole("supplier", `Группа ${g.number}: ${g.medicineName} ${g.dosage}, ${g.form}. Общий спрос: ${total(g)} уп.`);
    commit();
    return ok(created ? `Группа ${g.number} создана, вы первый участник.` : `Вы вступили в группу ${g.number}.`);
  } catch (e) { return err(e); }
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const g = db().groups.find((x) => x.id === groupId);
    const m = g?.members.find((x) => x.buyerId === u.id);
    if (!g || !m) return fail("Нет доступа.");
    if (g.status !== "open" && g.status !== "offered") return fail("Выйти можно только до одобрения предложения. Сейчас можно отказаться в подтверждении.");
    g.members = g.members.filter((x) => x.buyerId !== u.id);
    if (g.members.length === 0) push(g, "cancelled", u.id, "Участников не осталось");
    commit();
    return ok("Вы вышли из группы.");
  } catch (e) { return err(e); }
}

const offerSchema = z.object({
  minVolume: z.number({ invalid_type_error: "Укажите объём" }).int().min(1, "Объём не менее 1 упаковки").max(100000),
  pricePerPack: z.number({ invalid_type_error: "Укажите цену" }).min(1, "Укажите цену за упаковку").max(1e7),
  leadTimeDays: z.number({ invalid_type_error: "Укажите срок" }).int().min(1, "Срок не менее 1 дня").max(365),
  note: z.string().trim().max(300).default(""),
});

export async function groupSupplierOffer(groupId: string, raw: unknown): Promise<ActionResult> {
  try {
    const u = requireRole("supplier");
    const g = db().groups.find((x) => x.id === groupId);
    if (!g) return fail("Группа не найдена.");
    if (g.status !== "open" && g.status !== "offered") return fail("По этой группе предложения больше не принимаются.");
    if (g.offers.some((o) => o.supplierId === u.id && !o.importerDecision)) return fail("Ваше предложение уже ждёт проверки импортёра.");
    const p = offerSchema.safeParse(raw);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Некорректные данные");
    if (p.data.minVolume > total(g)) return fail(`Объём предложения больше текущего спроса группы (${total(g)} уп.).`);
    g.offers.push({ id: `go-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, supplierId: u.id, ...p.data });
    if (g.status === "open") push(g, "offered", u.id);
    notifyRole("importer", `Предложение по группе ${g.number} ждёт вашей проверки.`);
    commit();
    return ok("Предложение отправлено импортёру на проверку.");
  } catch (e) { return err(e); }
}

export async function groupImporterDecide(groupId: string, offerId: string, decision: "approved" | "rejected", note: string): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const g = db().groups.find((x) => x.id === groupId);
    const o = g?.offers.find((x) => x.id === offerId);
    if (!g || !o) return fail("Предложение не найдено.");
    if (o.importerDecision) return fail("Решение уже принято.");
    if (g.status !== "offered") return fail("Группа не в статусе проверки.");
    const n = z.string().trim().max(300).safeParse(note);
    if (!n.success) return fail("Заметка слишком длинная.");
    if (decision === "rejected" && n.data.length < 3) return fail("Укажите причину отказа.");
    if (decision === "approved" && o.minVolume > total(g)) return fail("Объём группы стал меньше объёма предложения. Дождитесь набора или отклоните.");
    o.importerDecision = decision;
    o.importerNote = n.data;
    if (decision === "approved") {
      push(g, "approved", u.id);
      for (const m of g.members) notify(m.buyerId, `По группе ${g.number} есть проверенное предложение. Подтвердите или откажитесь отдельно за себя.`);
    } else if (g.offers.every((x) => x.importerDecision === "rejected")) {
      push(g, "open", u.id, "Все предложения отклонены, набор продолжается");
    }
    commit();
    return ok(decision === "approved" ? "Предложение одобрено, участники уведомлены." : "Предложение отклонено.");
  } catch (e) { return err(e); }
}

/** Каждый участник подтверждает или отказывается отдельно. */
export async function memberDecide(groupId: string, decision: "confirm" | "decline"): Promise<ActionResult> {
  try {
    const u = requireRole("buyer");
    const g = db().groups.find((x) => x.id === groupId);
    const m = g?.members.find((x) => x.buyerId === u.id);
    if (!g || !m) return fail("Нет доступа.");
    if (g.status !== "approved") return fail("Сейчас нечего подтверждать.");
    if (m.confirmation !== "pending") return fail("Вы уже приняли решение.");
    m.confirmation = decision === "confirm" ? "confirmed" : "declined";
    if (g.members.every((x) => x.confirmation !== "pending")) {
      const offer = g.offers.find((o) => o.importerDecision === "approved");
      const confirmedQty = g.members.filter((x) => x.confirmation === "confirmed").reduce((s, x) => s + x.qty, 0);
      if (offer && confirmedQty >= offer.minVolume) {
        push(g, "completed", u.id, `Подтверждено ${confirmedQty} уп.`);
        notifyRole("importer", `Группа ${g.number}: все решили, подтверждено ${confirmedQty} уп.`);
      } else {
        push(g, "closed", u.id, "Подтверждённый объём меньше объёма предложения");
        for (const x of g.members) notify(x.buyerId, `Группа ${g.number} закрыта: подтверждённого объёма недостаточно для условий предложения.`);
      }
    }
    commit();
    return ok(decision === "confirm" ? "Вы подтвердили участие. Подтверждение не является обязательством по ввозу." : "Вы отказались от участия.");
  } catch (e) { return err(e); }
}

/** Импортёр продлевает набор на 7 дней или закрывает группу. */
export async function importerGroupManage(groupId: string, action: "extend" | "close"): Promise<ActionResult> {
  try {
    const u = requireRole("importer");
    const g = db().groups.find((x) => x.id === groupId);
    if (!g) return fail("Группа не найдена.");
    if (g.status !== "open" && g.status !== "offered") return fail("Эту группу уже нельзя изменить.");
    if (action === "extend") {
      g.deadline = new Date(Math.max(Date.now(), new Date(g.deadline).getTime()) + 7 * DAY).toISOString();
      g.history.push({ status: g.status, at: new Date().toISOString(), by: u.id, note: "Срок набора продлён на 7 дней" });
      for (const m of g.members) notify(m.buyerId, `Набор в группу ${g.number} продлён на 7 дней.`);
    } else {
      push(g, "closed", u.id, "Закрыта импортёром");
      for (const m of g.members) notify(m.buyerId, `Группа ${g.number} закрыта.`);
    }
    commit();
    return ok(action === "extend" ? "Срок продлён на 7 дней." : "Группа закрыта.");
  } catch (e) { return err(e); }
}
