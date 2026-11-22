"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, MapPin, Search, X } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { LocationBar } from "./LocationBar";
import { useApp } from "./Providers";
import { offersFor, searchMedicines } from "@/lib/search";
import { formatKgs } from "@/lib/status";
import type { Category, Medicine, Stock } from "@/lib/types";

interface Props {
  medicines: Medicine[];
  categories: Category[];
  stock: Stock[];
  pharmacyNames: Record<string, string>;
  initialQuery: string;
  initialCategory: string;
}

type Sort = "relevance" | "price" | "distance";

export function CatalogClient({ medicines, categories, stock, pharmacyNames, initialQuery, initialCategory }: Props) {
  const { location } = useApp();
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState(initialCategory);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const rows = useMemo(() => {
    const found = searchMedicines(q, medicines).filter((m) => !cat || m.categories.includes(cat));
    const max = Number(maxPrice) || Infinity;
    const list = found.map((m) => {
      const offers = offersFor(m.id, stock, pharmacyNames, location, location?.city).filter((o) => o.available);
      const best = offers[0];
      const cheapest = offers.reduce<number | null>((p, o) => (p === null || o.stock.price < p ? o.stock.price : p), null);
      return { m, offers, best, cheapest };
    });
    const filtered = list.filter((r) => (!onlyAvailable || r.offers.length > 0) && (r.cheapest === null || r.cheapest <= max));
    if (sort === "price") filtered.sort((a, b) => (a.cheapest ?? Infinity) - (b.cheapest ?? Infinity));
    if (sort === "distance") filtered.sort((a, b) => (a.best?.distanceKm ?? Infinity) - (b.best?.distanceKm ?? Infinity));
    return filtered;
  }, [q, cat, onlyAvailable, maxPrice, sort, medicines, stock, pharmacyNames, location]);

  const suggestions = useMemo(() => (q.length >= 2 ? searchMedicines(q, medicines).slice(0, 4) : []), [q, medicines]);

  const filters = (
    <div className="space-y-5">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Категории</h2>
        <div className="flex flex-col gap-1">
          <button onClick={() => setCat("")} className={`flex min-h-[40px] items-center rounded-lg px-2 text-left text-sm ${!cat ? "bg-brand-50 font-semibold text-brand-800" : "hover:bg-ink-50"}`}>Все</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-left text-sm transition ${cat === c.id ? "bg-brand-50 font-semibold text-brand-800" : "hover:bg-ink-50"}`}>
              <CategoryIcon name={c.icon} size={16} />{c.name}
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="h-5 w-5 accent-brand-600" />
        Только в наличии
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-ink-700">Цена до, сом</span>
        <input className="input" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} placeholder="Любая" />
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <LocationBar />
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, действующее вещество, дозировка" aria-label="Поиск лекарств" />
        {q && <button onClick={() => setQ("")} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-ink-400" aria-label="Очистить"><X size={16} /></button>}
        {suggestions.length > 0 && q !== suggestions[0]?.name && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-ink-100">
            {suggestions.map((s) => (
              <li key={s.id}><Link href={`/medicine/${s.id}`} className="flex min-h-[44px] items-center justify-between px-3 text-sm hover:bg-ink-50"><span>{s.name} {s.dosage}</span><span className="text-ink-400">{s.form}</span></Link></li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <button className="btn btn-secondary" onClick={() => setFiltersOpen(true)}><Filter size={16} />Фильтры</button>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
          <option value="relevance">По релевантности</option><option value="price">Сначала дешевле</option><option value="distance">Сначала ближе</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card hidden h-fit lg:block">{filters}</aside>
        <div>
          <div className="mb-3 hidden items-center justify-between lg:flex">
            <p className="text-sm text-ink-500">Найдено: {rows.length}</p>
            <select className="input max-w-[220px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
              <option value="relevance">По релевантности</option><option value="price">Сначала дешевле</option><option value="distance">Сначала ближе</option>
            </select>
          </div>
          {rows.length === 0 ? (
            <div className="card text-center text-ink-600">
              <p className="font-semibold">Ничего не найдено</p>
              <p className="mt-1 text-sm">Проверьте написание или сбросьте фильтры. Международные заявки (Global) появятся на следующем этапе.</p>
            </div>
          ) : (
            <motion.ul layout className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {rows.map(({ m, offers, best }) => (
                  <motion.li key={m.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileHover={{ y: -2 }}>
                    <Link href={`/medicine/${m.id}`} className="card block h-full transition hover:shadow-lift">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{m.name} <span className="font-normal text-ink-500">{m.dosage}</span></h3>
                          <p className="text-sm text-ink-500">{m.inn} · {m.form}</p>
                        </div>
                        {m.prescription && <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">Рецептурный</span>}
                      </div>
                      <div className="mt-3 border-t border-ink-100 pt-3 text-sm">
                        {best ? (
                          <>
                            <p className="font-semibold text-brand-700">от {formatKgs(Math.min(...offers.map((o) => o.stock.price)))}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-ink-500"><MapPin size={14} />{best.pharmacyName}, {best.branch.district}{best.distanceKm !== null && ` · ${best.distanceKm.toFixed(1)} км`}</p>
                            <p className="text-xs text-ink-400">Аптек с наличием: {offers.length}</p>
                          </>
                        ) : <p className="text-ink-500">Нет в наличии{location ? ` в г. ${location.city}` : ""}</p>}
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-ink-900/40" onClick={() => setFiltersOpen(false)} aria-label="Закрыть фильтры" />
            <motion.div className="absolute bottom-0 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.25 }}>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Фильтры</h2><button onClick={() => setFiltersOpen(false)} className="grid h-11 w-11 place-items-center" aria-label="Закрыть"><X /></button></div>
              {filters}
              <button className="btn btn-primary mt-5 w-full" onClick={() => setFiltersOpen(false)}>Показать: {rows.length}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
