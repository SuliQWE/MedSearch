"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buyerGlobalCancel, buyerGlobalDecide, createGlobalRequest, importerDecide, supplierOffer } from "@/lib/global-actions";
import { ActionButton } from "./ActionButton";
import { BRANCHES } from "@/lib/seed";
import { STORAGE_LABEL } from "@/lib/status";
import type { StorageClass } from "@/lib/types";
import type { ActionResult } from "@/lib/types";

function Msg({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <p role={r.ok ? "status" : "alert"} className={`text-sm ${r.ok ? "text-brand-700" : "text-red-700"}`}>{r.message}</p>;
}

export function GlobalRequestForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const empty = { medicineName: "", dosage: "", form: "", qty: "1", comment: "", storage: "room", prescription: false, branchId: BRANCHES[0].id, ack: false };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (pending) return;
    start(async () => {
      const r = await createGlobalRequest({ medicineName: f.medicineName, dosage: f.dosage, form: f.form, qty: f.qty ? Number(f.qty) : undefined, comment: f.comment, storage: f.storage, prescription: f.prescription, branchId: f.branchId, prescriptionAck: f.ack ? true : false });
      setRes(r);
      if (r.ok) { setF(empty); router.refresh(); }
    });
  }
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">Новая заявка</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Название или действующее вещество<input className="input mt-1" value={f.medicineName} onChange={(e) => set("medicineName", e.target.value)} maxLength={120} /></label>
        <label className="text-sm font-medium">Дозировка<input className="input mt-1" placeholder="например, 10 мг" value={f.dosage} onChange={(e) => set("dosage", e.target.value)} maxLength={40} /></label>
        <label className="text-sm font-medium">Форма выпуска<input className="input mt-1" placeholder="таблетки, раствор…" value={f.form} onChange={(e) => set("form", e.target.value)} maxLength={40} /></label>
        <label className="text-sm font-medium">Количество упаковок (можно 1)<input className="input mt-1" inputMode="numeric" value={f.qty} onChange={(e) => set("qty", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="text-sm font-medium">Условия хранения<select className="input mt-1" value={f.storage} onChange={(e) => set("storage", e.target.value)}>{(Object.keys(STORAGE_LABEL) as StorageClass[]).map((k) => <option key={k} value={k}>{STORAGE_LABEL[k]}</option>)}</select></label>
        <label className="text-sm font-medium">Точка выдачи<select className="input mt-1" value={f.branchId} onChange={(e) => set("branchId", e.target.value)}>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.city}, {b.name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={f.prescription} onChange={(e) => set("prescription", e.target.checked)} />Это рецептурный препарат</label>
        <label className="text-sm font-medium sm:col-span-2">Комментарий (необязательно, без личных данных)<textarea className="input mt-1 min-h-[80px] py-2" value={f.comment} onChange={(e) => set("comment", e.target.value)} maxLength={500} /></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.ack} onChange={(e) => set("ack", e.target.checked)} /><span>Я понимаю: MediFinder не продаёт и не ввозит лекарства, ввоз возможен только после проверки импортёром, а требования к рецептурным препаратам не обходятся.</span></label>
      <Msg r={res} />
      <button className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? "Отправка…" : "Отправить заявку"}</button>
    </div>
  );
}

export function OfferForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [price, setPrice] = useState(""); const [days, setDays] = useState(""); const [note, setNote] = useState("");
  return (
    <div className="space-y-2 border-t border-ink-100 pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm font-medium">Цена за упаковку, сом (ориентир)<input className="input mt-1" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
        <label className="text-sm font-medium">Срок поставки, дней<input className="input mt-1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} /></label>
      </div>
      <label className="block text-sm font-medium">Условия (необязательно)<input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
      <Msg r={res} />
      <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await supplierOffer(requestId, { pricePerPack: Number(price), leadTimeDays: Number(days), note }); setRes(r); router.refresh(); })}>{pending ? "Отправка…" : "Отправить предложение"}</button>
    </div>
  );
}

export function ImporterDecision({ requestId, offerId }: { requestId: string; offerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [note, setNote] = useState("");
  const run = (d: "approved" | "rejected") => start(async () => { const r = await importerDecide(requestId, offerId, d, note); setRes(r); router.refresh(); });
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Заметка (при отказе обязательна)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Заметка импортёра" />
      <Msg r={res} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending} onClick={() => run("approved")}>Одобрить</button>
        <button className="btn btn-danger" disabled={pending} onClick={() => run("rejected")}>Отклонить</button>
      </div>
    </div>
  );
}

export function BuyerGlobalActions({ id, canDecide, canCancel }: { id: string; canDecide: boolean; canCancel: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide && <ActionButton variant="danger" confirm="Отказаться от всех предложений?" action={buyerGlobalDecide.bind(null, id, "decline")}>Отказаться от всех</ActionButton>}
      {canCancel && <ActionButton variant="secondary" confirm="Отменить заявку?" action={buyerGlobalCancel.bind(null, id)}>Отменить заявку</ActionButton>}
    </div>
  );
}
