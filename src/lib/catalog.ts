import { bulkCounts, bulkEnabled, genMedicines } from "./bulk-seed";
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

let seedCache: Medicine[] | undefined;
let bulkSynced = false;
/** Тестовый каталог из кода: 8 базовых препаратов, а при BULK_SEED=1 ещё и сгенерированные. */
const seedList = (): Medicine[] => (seedCache ??= bulkEnabled() ? [...MEDICINES, ...genMedicines(bulkCounts().medicines, MEDICINES)] : MEDICINES);

export interface CatalogResult { medicines: Medicine[]; source: "supabase" | "seed"; error?: string }

/** Каталог из Supabase; если он не подключён или недоступен, используется тестовый набор из seed.ts. */
export async function getCatalog(): Promise<CatalogResult> {
  const base = seedList();
  if (!supabaseConfigured()) return { medicines: base, source: "seed" };
  try {
    const rows: Row[] = await (await rest("catalog_medicine?select=*&order=created_at.asc,id.asc")).json();
    if (rows.length === 0) {
      await upsertMedicines(base); // первый запуск: заливаем тестовые препараты
      bulkSynced = true;
      return { medicines: base, source: "supabase" };
    }
    let medicines = rows.map(fromRow);
    if (bulkEnabled() && !bulkSynced) {
      // BULK_SEED=1: один раз на инстанс досыпаем в Supabase недостающие сгенерированные препараты
      const have = new Set(rows.map((r) => r.id));
      const missing = base.filter((m) => !have.has(m.id));
      if (missing.length) { await upsertMedicines(missing); medicines = [...medicines, ...missing]; }
      bulkSynced = true;
    }
    return { medicines, source: "supabase" };
  } catch (e) {
    return { medicines: base, source: "seed", error: e instanceof Error ? e.message : "Ошибка Supabase" };
  }
}

export async function getMedicines(): Promise<Medicine[]> {
  return (await getCatalog()).medicines;
}
