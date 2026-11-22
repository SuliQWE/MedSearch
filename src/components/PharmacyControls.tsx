"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pharmacyProposeQty, pharmacyUpdateStock } from "@/lib/actions";

export function ProposeQty({ orderId, medicineId, max }: { orderId: string; medicineId: string; max: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(String(Math.max(1, max - 1)));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (max < 2) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <input className="input w-20" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} aria-label="Предложить количество" />
      <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => {
        const r = await pharmacyProposeQty(orderId, medicineId, Number(qty));
        setErr(r.ok ? null : r.message);
        router.refresh();
      })}>Предложить</button>
      {err && <span role="alert" className="text-xs text-red-700">{err}</span>}
    </span>
  );
}

export function StockRow({ branchId, medicineId, label, price, qty }: { branchId: string; medicineId: string; label: string; price: number; qty: number }) {
  const router = useRouter();
  const [p, setP] = useState(String(price));
  const [q, setQ] = useState(String(qty));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 py-2 text-sm">
      <span className="min-w-[160px] flex-1">{label}</span>
      <input className="input w-24" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Цена, сом" />
      <input className="input w-20" inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ""))} aria-label="Остаток" />
      <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => {
        const r = await pharmacyUpdateStock(branchId, medicineId, Number(p), Number(q));
        setMsg({ ok: r.ok, text: r.message });
        router.refresh();
      })}>Сохранить</button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-brand-700" : "text-red-700"}`}>{msg.text}</span>}
    </div>
  );
}
