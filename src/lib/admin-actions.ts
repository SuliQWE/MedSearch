"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "./auth";
import { resetDemoData } from "./store";
import type { ActionResult } from "./types";

/** Сброс всех демо-данных к начальным. Только администратор. */
export async function resetDemo(): Promise<ActionResult> {
  try {
    requireRole("admin");
    resetDemoData();
    revalidatePath("/", "layout");
    return { ok: true, message: "Демо-данные сброшены к начальным." };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Ошибка" }; }
}

/** Заполняет локальные и международные заказы тестовыми данными. Только администратор. */
export async function fillDemoOrdersAction(): Promise<ActionResult> {
  try {
    requireRole("admin");
    const { fillDemoOrders } = await import("./demo-orders");
    const r = fillDemoOrders();
    revalidatePath("/", "layout");
    return r;
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Ошибка" }; }
}
