"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "./auth";
import { toRow, upsertMedicines } from "./catalog";
import { MEDICINES, CATEGORIES } from "./seed";
import { db, persist } from "./store";
import { rest, supabaseConfigured, uploadImage } from "./supabase-rest";
import type { ActionResult, Medicine } from "./types";

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const MAX_IMAGE = 3 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const schema = z.object({
  name: z.string().trim().min(2, "Укажите название").max(120),
  inn: z.string().trim().min(2, "Укажите действующее вещество").max(120),
  dosage: z.string().trim().min(1, "Укажите дозировку").max(40),
  form: z.string().trim().min(1, "Укажите форму выпуска").max(40),
  manufacturer: z.string().trim().max(120),
  country: z.string().trim().max(60),
  description: z.string().trim().max(1500),
  synonyms: z.string().max(400),
});

/** Добавление или изменение препарата (только администратор). Картинка необязательна. */
export async function saveMedicine(fd: FormData): Promise<ActionResult> {
  try {
    requireRole("admin");
    if (!supabaseConfigured()) return fail("Supabase не подключён: задайте переменные окружения (см. README).");
    const p = schema.safeParse({
      name: fd.get("name"), inn: fd.get("inn"), dosage: fd.get("dosage"), form: fd.get("form"),
      manufacturer: fd.get("manufacturer") ?? "", country: fd.get("country") ?? "", description: fd.get("description") ?? "", synonyms: fd.get("synonyms") ?? "",
    });
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Некорректные данные");
    const validCats = new Set(CATEGORIES.map((c) => c.id));
    const categories = fd.getAll("categories").map(String).filter((c) => validCats.has(c));
    const synonyms = p.data.synonyms.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
    const existingId = String(fd.get("id") ?? "");
    const isNew = existingId === "";
    const id = isNew ? `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}` : existingId;

    let imageUrl: string | null | undefined; // undefined = не менять
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) {
      const ext = TYPES[file.type];
      if (!ext) return fail("Картинка должна быть JPG, PNG или WebP.");
      if (file.size > MAX_IMAGE) return fail("Картинка больше 3 МБ. Уменьшите её и загрузите снова.");
      imageUrl = await uploadImage(`${id}/${Date.now()}.${ext}`, await file.arrayBuffer(), file.type);
    } else if (fd.get("removeImage") === "on") {
      imageUrl = null;
    }

    const fields = {
      name: p.data.name, inn: p.data.inn, dosage: p.data.dosage, form: p.data.form,
      manufacturer: p.data.manufacturer || "—", country: p.data.country || "—", description: p.data.description,
      categories, synonyms, prescription: fd.get("prescription") === "on",
    };
    if (isNew) {
      const m: Medicine = { id, ...fields, imageUrl: imageUrl ?? undefined };
      await rest("catalog_medicine", { method: "POST", prefer: "return=minimal", body: toRow(m) });
    } else {
      await rest(`catalog_medicine?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=minimal", body: { ...fields, ...(imageUrl !== undefined ? { image_url: imageUrl } : {}) } });
    }
    revalidatePath("/", "layout");
    return ok(isNew ? "Препарат добавлен. Цену и остаток задаёт аптека в своём кабинете." : "Изменения сохранены.");
  } catch (e) { return fail(e instanceof Error ? e.message : "Ошибка"); }
}

/** Удаление препарата. Запрещено, если по нему есть заказы (чтобы не ломать историю). */
export async function deleteMedicine(id: string): Promise<ActionResult> {
  try {
    requireRole("admin");
    if (!supabaseConfigured()) return fail("Supabase не подключён.");
    if (db().orders.some((o) => o.items.some((i) => i.medicineId === id))) return fail("По этому препарату есть заказы, удалять нельзя.");
    await rest(`catalog_medicine?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
    const before = db().stock.length;
    db().stock = db().stock.filter((s) => s.medicineId !== id);
    if (db().stock.length !== before) persist();
    revalidatePath("/", "layout");
    return ok("Препарат удалён.");
  } catch (e) { return fail(e instanceof Error ? e.message : "Ошибка"); }
}

/** Загружает (или восстанавливает) тестовые препараты из seed.ts. Существующие с теми же id перезаписываются. */
export async function seedCatalog(): Promise<ActionResult> {
  try {
    requireRole("admin");
    if (!supabaseConfigured()) return fail("Supabase не подключён.");
    await upsertMedicines(MEDICINES);
    revalidatePath("/", "layout");
    return ok(`Загружено тестовых препаратов: ${MEDICINES.length}.`);
  } catch (e) { return fail(e instanceof Error ? e.message : "Ошибка"); }
}

