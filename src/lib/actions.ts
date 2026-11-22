"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUTH_COOKIE, currentUser, requireRole, ROLE_HOME } from "./auth";
import { DEMO_USERS } from "./seed";
import { db, nextNumber, notify, persist, pharmacyOfBranch } from "./store";
import type { ActionResult, Order, OrderStatus } from "./types";

const RESERVE_HOURS = 24;

function commit() {
  persist();
  revalidatePath("/", "layout");
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}
function ok(message: string): ActionResult {
  return { ok: true, message };
}

function push(order: Order, status: OrderStatus, by: string) {
  order.status = status;
  order.history.push({ status, at: new Date().toISOString(), by });
}

function releaseStock(order: Order) {
  if (!order.reserved) return;
  for (const it of order.items) {
    const s = db().stock.find((x) => x.branchId === order.branchId && x.medicineId === it.medicineId);
    if (s) s.qty += it.qty;
  }
  order.reserved = false;
}

/** Ленивое истечение резервов при каждом чтении. */
export async function sweepExpired() {
  const now = Date.now();
  let changed = false;
  for (const o of db().orders) {
    if ((o.status === "confirmed" || o.status === "ready") && o.reserveUntil && new Date(o.reserveUntil).getTime() < now) {
      releaseStock(o);
      push(o, "expired", "system");
      notify(o.buyerId, `Срок резерва по заказу ${o.number} истёк.`);
      changed = true;
    }
  }
  if (changed) persist();
}

export async function loginAs(userId: string): Promise<string> {
  const u = DEMO_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("Неизвестный демо-аккаунт");
  cookies().set(AUTH_COOKIE, u.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  return ROLE_HOME[u.role];
}

export async function logout() {
  cookies().delete(AUTH_COOKIE);
}

const cartSchema = z
  .array(
    z.object({
      medicineId: z.string().min(1),
      branchId: z.string().min(1),
      qty: z.number().int().min(1).max(99),
    }),
  )
  .min(1, "Корзина пуста");

/** Корзина приходит с клиента, но цены и наличие берутся только из серверных данных. */
export async function placeOrders(raw: unknown): Promise<ActionResult> {
  let user;
  try {
    user = requireRole("buyer");
  } catch {
    return fail("Войдите как покупатель, чтобы оформить заказ.");
  }
  const parsed = cartSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Некорректные данные");

  await sweepExpired();
  const byBranch = new Map<string, typeof parsed.data>();
  for (const it of parsed.data) byBranch.set(it.branchId, [...(byBranch.get(it.branchId) ?? []), it]);

  const created: string[] = [];
  for (const [branchId, items] of byBranch) {
    const orderItems = [];
    for (const it of items) {
      const s = db().stock.find((x) => x.branchId === branchId && x.medicineId === it.medicineId);
      if (!s) return fail("Позиция больше не продаётся в выбранном филиале.");
      orderItems.push({ medicineId: it.medicineId, qty: it.qty, price: s.price });
    }
    const order: Order = {
      id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      number: nextNumber(),
      buyerId: user.id,
      branchId,
      items: orderItems,
      status: "pending",
      reserved: false, // до подтверждения аптеки резерва нет
      createdAt: new Date().toISOString(),
      history: [{ status: "pending", at: new Date().toISOString(), by: user.id }],
    };
    db().orders.unshift(order);
    created.push(order.number);
    notify(user.id, `Заказ ${order.number} отправлен в аптеку. Резерв появится после подтверждения.`);
    const ph = pharmacyOfBranch(branchId);
    for (const u of DEMO_USERS.filter((x) => x.role === "pharmacy" && x.pharmacyId === ph))
      notify(u.id, `Новый заказ ${order.number}: проверьте наличие.`);
  }
  commit();
  return ok(`Создано заказов: ${created.length} (${created.join(", ")})`);
}

function pharmacyOrder(orderId: string) {
  const u = requireRole("pharmacy");
  const order = db().orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Заказ не найден");
  if (pharmacyOfBranch(order.branchId) !== u.pharmacyId) throw new Error("Нет доступа к чужому заказу");
  return { u, order };
}

export async function pharmacyConfirm(orderId: string): Promise<ActionResult> {
  try {
    const { u, order } = pharmacyOrder(orderId);
    await sweepExpired();
    if (order.status !== "pending") return fail("Заказ уже обработан.");
    for (const it of order.items) {
      const s = db().stock.find((x) => x.branchId === order.branchId && x.medicineId === it.medicineId);
      if (!s || s.qty < it.qty) return fail("Недостаточно остатка. Предложите изменить количество или отклоните заказ.");
    }
    for (const it of order.items) {
      db().stock.find((x) => x.branchId === order.branchId && x.medicineId === it.medicineId)!.qty -= it.qty;
    }
    order.reserved = true;
    order.reserveUntil = new Date(Date.now() + RESERVE_HOURS * 3600e3).toISOString();
    push(order, "confirmed", u.id);
    notify(order.buyerId, `Аптека подтвердила заказ ${order.number}. Резерв на ${RESERVE_HOURS} ч.`);
    commit();
    return ok("Заказ подтверждён, товар зарезервирован.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Ошибка");
  }
}

export async function pharmacyReject(orderId: string): Promise<ActionResult> {
  try {
    const { u, order } = pharmacyOrder(orderId);
    if (order.status !== "pending") return fail("Заказ уже обработан.");
    push(order, "rejected", u.id);
    notify(order.buyerId, `Аптека отклонила заказ ${order.number}.`);
    commit();
    return ok("Заказ отклонён.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Ошибка");
  }
}

export async function pharmacyProposeQty(orderId: string, medicineId: string, qty: number): Promise<ActionResult> {
  try {
    const { u, order } = pharmacyOrder(orderId);
    if (order.status !== "pending") return fail("Заказ уже обработан.");
    const item = order.items.find((i) => i.medicineId === medicineId);
    if (!item) return fail("Позиция не найдена.");
    const n = z.number().int().min(1).safeParse(qty);
    if (!n.success || n.data >= item.qty) return fail("Предложите количество меньше заказанного (не менее 1).");
    const s = db().stock.find((x) => x.branchId === order.branchId && x.medicineId === medicineId);
    if (!s || s.qty < n.data) return fail("В наличии меньше, чем вы предлагаете.");
    order.proposedQty = { ...(order.proposedQty ?? {}), [medicineId]: n.data };
    push(order, "qty_proposed", u.id);
    notify(order.buyerId, `Аптека предлагает изменить количество в заказе ${order.number}. Подтвердите или отмените.`);
    commit();
    return ok("Предложение отправлено покупателю.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Ошибка");
  }
}

export async function pharmacyMarkReady(orderId: string): Promise<ActionResult> {
  try {
    const { u, order } = pharmacyOrder(orderId);
    if (order.status !== "confirmed") return fail("Готовым можно отметить только подтверждённый заказ.");
    push(order, "ready", u.id);
    notify(order.buyerId, `Заказ ${order.number} готов к получению. Назовите номер в аптеке.`);
    commit();
    return ok("Заказ отмечен готовым.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Ошибка");
  }
}

export async function pharmacyIssue(orderId: string): Promise<ActionResult> {
  try {
    const { u, order } = pharmacyOrder(orderId);
    await sweepExpired();
    if (order.status !== "confirmed" && order.status !== "ready") return fail("Выдать можно подтверждённый заказ с действующим резервом.");
    order.reserved = false; // товар выдан, остаток уже списан
    push(order, "issued", u.id);
    notify(order.buyerId, `Заказ ${order.number} выдан. Спасибо!`);
    commit();
    return ok("Заказ выдан покупателю.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Ошибка");
  }
}

export async function pharmacyUpdateStock(branchId: string, medicineId: string, price: number, qty: number): Promise<ActionResult> {
  try {
    const u = requireRole("pharmacy");
    if (pharmacyOfBranch(branchId) !== u.pharmacyId) return fail("Нет доступа к чужому филиалу.");
    const v = z.object({ price: z.number().min(0).max(1e6), qty: z.number().int().min(0).max(1e5) }).safeParse({ price, qty });
    if (!v.success) return fail("Проверьте цену и количество.");
    const s = db().stock.find((x) => x.branchId === branchId && x.medicineId === medicineId);
    if (s) {
      s.price = v.data.price;
      s.qty = v.data.qty;
      s.updatedAt = new Date().toISOString();
    } else {
      db().stock.push({ branchId, medicineId, price: v.data.price, qty: v.data.qty, updatedAt: new Date().toISOString() });
    }
    commit();
    return ok("Остаток и цена обновлены.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Ошибка");
  }
}

export async function buyerAcceptProposal(orderId: string): Promise<ActionResult> {
  const u = currentUser();
  const order = db().orders.find((o) => o.id === orderId);
  if (!u || !order || order.buyerId !== u.id) return fail("Нет доступа.");
  if (order.status !== "qty_proposed" || !order.proposedQty) return fail("Нет активного предложения.");
  await sweepExpired();
  for (const it of order.items) {
    const q = order.proposedQty[it.medicineId];
    if (q) it.qty = q;
  }
  order.proposedQty = undefined;
  for (const it of order.items) {
    const s = db().stock.find((x) => x.branchId === order.branchId && x.medicineId === it.medicineId);
    if (!s || s.qty < it.qty) {
      push(order, "pending", u.id);
      persist();
      return fail("Остаток изменился. Заказ снова ждёт подтверждения аптеки.");
    }
  }
  for (const it of order.items) db().stock.find((x) => x.branchId === order.branchId && x.medicineId === it.medicineId)!.qty -= it.qty;
  order.reserved = true;
  order.reserveUntil = new Date(Date.now() + RESERVE_HOURS * 3600e3).toISOString();
  push(order, "confirmed", u.id);
  notify(u.id, `Заказ ${order.number} подтверждён с новым количеством. Резерв на ${RESERVE_HOURS} ч.`);
  commit();
  return ok("Новое количество принято, заказ зарезервирован.");
}

export async function buyerCancel(orderId: string): Promise<ActionResult> {
  const u = currentUser();
  const order = db().orders.find((o) => o.id === orderId);
  if (!u || !order || order.buyerId !== u.id) return fail("Нет доступа.");
  if (!["pending", "confirmed", "ready", "qty_proposed"].includes(order.status)) return fail("Этот заказ нельзя отменить.");
  releaseStock(order);
  push(order, "cancelled", u.id);
  commit();
  return ok("Заказ отменён.");
}

export async function markNotificationsRead(): Promise<void> {
  const u = currentUser();
  if (!u) return;
  for (const n of db().notifications) if (n.userId === u.id) n.read = true;
  commit();
}
