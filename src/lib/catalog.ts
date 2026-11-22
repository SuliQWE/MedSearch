import { MEDICINES } from "./seed";
import { rest, supabaseConfigured } from "./supabase-rest";
import type { Medicine } from "./types";

interface Row {
  id: string; name: string; inn: string; dosage: string; form: string; manufacturer: string; country: string;
  description: string; categories: string[]; synonyms: string[]; prescription: boolean; image_url: string | null;
}

const fromRow = (r: Row): Medicine => ({
  id: r.id, name: r.name, inn: r.inn, dosage: r.dosage, form: r.form, manufacturer: r.manufacturer, country: r.country,
  description: r.description, categories: r.categories ?? [], synonyms: r.synonyms ?? [], prescription: r.prescription,
  imageUrl: r.image_url ?? undefined,
});

export const toRow = (m: Medicine) => ({
  id: m.id, name: m.name, inn: m.inn, dosage: m.dosage, form: m.form, manufacturer: m.manufacturer, country: m.country,
  description: m.description, categories: m.categories, synonyms: m.synonyms, prescription: m.prescription, image_url: m.imageUrl ?? null,
});

export async function upsertMedicines(list: Medicine[]): Promise<void> {
  await rest("catalog_medicine?on_conflict=id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: list.map(toRow) });
}

export interface CatalogResult { medicines: Medicine[]; source: "supabase" | "seed"; error?: string }

/** Каталог из Supabase; если он не подключён или недоступен, используется тестовый набор из seed.ts. */
export async function getCatalog(): Promise<CatalogResult> {
  if (!supabaseConfigured()) return { medicines: MEDICINES, source: "seed" };
  try {
    const rows: Row[] = await (await rest("catalog_medicine?select=*&order=created_at.asc,id.asc")).json();
    if (rows.length === 0) {
      await upsertMedicines(MEDICINES); // первый запуск: заливаем тестовые препараты
      return { medicines: MEDICINES, source: "supabase" };
    }
    return { medicines: rows.map(fromRow), source: "supabase" };
  } catch (e) {
    return { medicines: MEDICINES, source: "seed", error: e instanceof Error ? e.message : "Ошибка Supabase" };
  }
}

export async function getMedicines(): Promise<Medicine[]> {
  return (await getCatalog()).medicines;
}
