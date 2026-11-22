"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, List, Map as MapIcon, Minus, Plus, ShoppingBag } from "lucide-react";
import { useApp } from "./Providers";
import { LocationBar } from "./LocationBar";
import { offersFor, type Offer } from "@/lib/search";
import { formatDateTime, formatKgs } from "@/lib/status";
import type { Medicine, Stock } from "@/lib/types";

function SchematicMap({ offers, user }: { offers: Offer[]; user: { lat: number; lng: number } | null }) {
  const pts = [...offers.map((o) => ({ lat: o.branch.lat, lng: o.branch.lng, label: o.branch.district, ok: o.available })), ...(user ? [{ ...user, label: "Вы", ok: true, me: true }] : [])];
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const sx = (v: number) => 30 + ((v - minLng) / (maxLng - minLng || 1)) * 340;
  const sy = (v: number) => 170 - ((v - minLat) / (maxLat - minLat || 1)) * 140;
  return (
    <div className="card">
      <svg viewBox="0 0 400 200" className="w-full" role="img" aria-label="Схема расположения аптек">
        <rect width="400" height="200" rx="16" className="fill-ink-50" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.lng)} cy={sy(p.lat)} r={"me" in p ? 7 : 6} className={"me" in p ? "fill-sky-500" : p.ok ? "fill-brand-600" : "fill-ink-300"} />
            <text x={sx(p.lng)} y={sy(p.lat) - 11} textAnchor="middle" className="fill-ink-700 text-[10px]">{p.label}</text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-ink-400">Схематичное расположение по координатам, не карта. Интерактивная карта будет подключена позже.</p>
    </div>
  );
}

export function OffersList({ medicine, stock, pharmacyNames }: { medicine: Medicine; stock: Stock[]; pharmacyNames: Record<string, string> }) {
  const { location, addToCart } = useApp();
  const [view, setView] = useState<"list" | "map">("list");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<string | null>(null);
  const [showAllCities, setShowAllCities] = useState(false);

  const offers = useMemo(() => offersFor(medicine.id, stock, pharmacyNames, location, showAllCities ? null : location?.city), [medicine.id, stock, pharmacyNames, location, showAllCities]);
  const nearest = offers.find((o) => o.available);

  function add(o: Offer) {
    const qty = qtys[o.branch.id] ?? 1;
    addToCart({ medicineId: medicine.id, branchId: o.branch.id, qty });
    setAdded(o.branch.id);
    setTimeout(() => setAdded(null), 1500);
  }

  return (
    <div className="space-y-3">
      <LocationBar />
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-ink-100 p-1" role="tablist">
          {(["list", "map"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${view === v ? "bg-white shadow-card" : "text-ink-600"}`}>
              {v === "list" ? <List size={15} /> : <MapIcon size={15} />}{v === "list" ? "Список" : "Схема"}
            </button>
          ))}
        </div>
        {location && <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={showAllCities} onChange={(e) => setShowAllCities(e.target.checked)} />Все города</label>}
      </div>

      {nearest && location && nearest.distanceKm !== null && (
        <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">Ближайшая аптека, где товар есть в наличии: <b>{nearest.pharmacyName}, {nearest.branch.district}</b> — {nearest.distanceKm.toFixed(1)} км (по прямой).</p>
      )}

      {view === "map" && <SchematicMap offers={offers} user={location} />}

      {offers.length === 0 ? (
        <div className="card text-ink-600">В выбранном городе нет предложений. Включите «Все города» или выберите другой город.</div>
      ) : (
        <ul className="space-y-3">
          {offers.map((o) => {
            const q = qtys[o.branch.id] ?? 1;
            return (
              <motion.li key={o.branch.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`card ${o.available ? "" : "opacity-60"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="font-semibold">{o.pharmacyName} · {o.branch.name}</p>
                    <p className="text-ink-600">{o.branch.city}, {o.branch.address}</p>
                    <p className="text-ink-500">Часы: {o.branch.hours}{o.distanceKm !== null && ` · ${o.distanceKm.toFixed(1)} км`}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-400"><Clock size={12} />Наличие обновлено {formatDateTime(o.stock.updatedAt)} · Самовывоз, оплата в аптеке</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <div className="text-right"><p className="text-lg font-bold">{formatKgs(o.stock.price)}</p><p className="text-xs text-ink-500">{o.available ? `В наличии: ${o.stock.qty} шт.` : "Нет в наличии"}</p></div>
                    {o.available && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-xl ring-1 ring-ink-200">
                          <button className="grid h-11 w-11 place-items-center" onClick={() => setQtys({ ...qtys, [o.branch.id]: Math.max(1, q - 1) })} aria-label="Меньше"><Minus size={16} /></button>
                          <motion.span key={q} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="w-6 text-center text-sm font-semibold">{q}</motion.span>
                          <button className="grid h-11 w-11 place-items-center" onClick={() => setQtys({ ...qtys, [o.branch.id]: Math.min(o.stock.qty, q + 1) })} aria-label="Больше"><Plus size={16} /></button>
                        </div>
                        <button className="btn btn-primary" onClick={() => add(o)}>
                          <AnimatePresence mode="wait" initial={false}>
                            {added === o.branch.id ? <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1"><Check size={16} />Добавлено</motion.span> : <motion.span key="add" className="flex items-center gap-1"><ShoppingBag size={16} />В корзину</motion.span>}
                          </AnimatePresence>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-400">Резерв появляется только после подтверждения аптеки. <Link href="/cart" className="underline">Перейти в корзину</Link></p>
    </div>
  );
}
