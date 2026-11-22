"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useApp } from "./Providers";
import { placeOrders } from "@/lib/actions";
import { formatKgs } from "@/lib/status";
import type { Branch, Medicine, Stock } from "@/lib/types";

interface Props {
  medicines: Medicine[];
  branches: Branch[];
  stock: Stock[];
  pharmacyNames: Record<string, string>;
  pharmacyOf: Record<string, string>;
  isBuyer: boolean;
}

export function CartClient({ medicines, branches, stock, pharmacyNames, pharmacyOf, isBuyer }: Props) {
  const { cart, ready, setQty, removeFromCart, clearCart } = useApp();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!ready) return <div className="space-y-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div>;

  if (cart.length === 0)
    return (
      <div className="card text-center">
        {result?.ok ? <p className="font-semibold text-brand-700">{result.message}</p> : <p className="font-semibold">Корзина пуста</p>}
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/catalog" className="btn btn-primary">В каталог</Link>
          {result?.ok && <Link href="/account" className="btn btn-secondary">Мои заказы</Link>}
        </div>
      </div>
    );

  const lines = cart.map((c) => {
    const m = medicines.find((x) => x.id === c.medicineId)!;
    const b = branches.find((x) => x.id === c.branchId)!;
    const s = stock.find((x) => x.branchId === c.branchId && x.medicineId === c.medicineId);
    return { c, m, b, s };
  });
  const groups = new Map<string, typeof lines>();
  for (const l of lines) groups.set(l.c.branchId, [...(groups.get(l.c.branchId) ?? []), l]);
  const total = lines.reduce((sum, l) => sum + (l.s?.price ?? 0) * l.c.qty, 0);
  const problem = lines.some((l) => !l.s || l.s.qty < l.c.qty);

  function submit() {
    if (pending) return;
    start(async () => {
      const r = await placeOrders(cart.map((c) => ({ medicineId: c.medicineId, branchId: c.branchId, qty: c.qty })));
      setResult(r);
      if (r.ok) clearCart();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {[...groups.entries()].map(([branchId, items]) => {
          const b = items[0].b;
          return (
            <section key={branchId} className="card">
              <h2 className="font-semibold">{pharmacyNames[pharmacyOf[branchId]]} · {b.name}</h2>
              <p className="mb-2 text-sm text-ink-500">{b.city}, {b.address}</p>
              <AnimatePresence initial={false}>
                {items.map(({ c, m, s }) => (
                  <motion.div key={c.medicineId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 py-3">
                    <div className="text-sm"><p className="font-medium">{m.name} {m.dosage}</p><p className="text-ink-500">{s ? formatKgs(s.price) : "нет в филиале"}{s && s.qty < c.qty && <span className="ml-2 text-red-700">в наличии только {s.qty}</span>}</p></div>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center rounded-xl ring-1 ring-ink-200">
                        <button className="grid h-11 w-11 place-items-center" onClick={() => setQty(c.medicineId, c.branchId, c.qty - 1)} aria-label="Меньше"><Minus size={16} /></button>
                        <motion.span key={c.qty} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="w-7 text-center text-sm font-semibold">{c.qty}</motion.span>
                        <button className="grid h-11 w-11 place-items-center" onClick={() => setQty(c.medicineId, c.branchId, c.qty + 1)} aria-label="Больше"><Plus size={16} /></button>
                      </div>
                      <button className="grid h-11 w-11 place-items-center text-ink-500 hover:text-red-700" onClick={() => removeFromCart(c.medicineId, c.branchId)} aria-label="Удалить"><Trash2 size={18} /></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
      <aside className="card h-fit space-y-3 lg:sticky lg:top-24">
        <div className="flex justify-between"><span className="text-ink-600">Итого</span><b className="text-lg">{formatKgs(total)}</b></div>
        <p className="text-xs text-ink-500">Оплата в аптеке при получении. Заказов будет {groups.size}: каждая аптека подтверждает свой отдельно. Резерва нет до подтверждения аптеки.</p>
        {problem && <p className="text-sm text-red-700">Часть позиций недоступна в указанном количестве. Измените количество.</p>}
        {!isBuyer && <p className="text-sm text-amber-800">Чтобы оформить заказ, <Link href="/login" className="underline">войдите как покупатель</Link>.</p>}
        {result && !result.ok && <p role="alert" className="text-sm text-red-700">{result.message}</p>}
        <button className="btn btn-primary w-full" disabled={pending || problem || !isBuyer} onClick={submit}>{pending ? "Отправляем…" : "Отправить в аптеки"}</button>
      </aside>
    </div>
  );
}
