import { BRANCHES, MEDICINES } from "./seed";
import type { Branch, Medicine, Stock } from "./types";

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Бишкек: { lat: 42.8746, lng: 74.5698 },
  Ош: { lat: 40.5283, lng: 72.7985 },
};

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9% ]/g, " ").replace(/\s+/g, " ").trim();
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** Поиск: частичное совпадение по названию, веществу, дозировке, форме, производителю, синонимам + допуск на опечатки. */
export function searchMedicines(query: string, list: Medicine[] = MEDICINES): Medicine[] {
  const q = norm(query);
  if (!q) return list;
  const tokens = q.split(" ");
  const scored = list
    .map((m) => {
      const fields = [m.name, m.inn, m.dosage, m.form, m.manufacturer, ...m.synonyms].map(norm);
      let score = 0;
      for (const t of tokens) {
        let best = 0;
        for (const f of fields) {
          if (f.includes(t)) best = Math.max(best, f.startsWith(t) ? 3 : 2);
          else if (t.length >= 4) {
            for (const w of f.split(" ")) if (w.length >= 4 && lev(t, w) <= (t.length > 6 ? 2 : 1)) best = Math.max(best, 1);
          }
        }
        if (best === 0) return { m, score: 0 };
        score += best;
      }
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.m);
}

export interface Offer {
  branch: Branch;
  pharmacyName: string;
  stock: Stock;
  distanceKm: number | null;
  available: boolean;
}

/** Предложения аптек: сначала доступные (qty > 0) по близости, затем недоступные. */
export function offersFor(
  medicineId: string,
  stockList: Stock[],
  pharmacyNames: Record<string, string>,
  from?: { lat: number; lng: number } | null,
  city?: string | null,
): Offer[] {
  const offers = stockList
    .filter((s) => s.medicineId === medicineId)
    .map((s) => {
      const branch = BRANCHES.find((b) => b.id === s.branchId)!;
      return {
        branch,
        pharmacyName: pharmacyNames[branch.pharmacyId] ?? "",
        stock: s,
        distanceKm: from ? haversineKm(from.lat, from.lng, branch.lat, branch.lng) : null,
        available: s.qty > 0,
      };
    })
    .filter((o) => !city || o.branch.city === city);
  return offers.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    return a.stock.price - b.stock.price;
  });
}
