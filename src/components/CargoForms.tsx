"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addLinesToShipment, advanceShipment, buyerAltDecide, cancelCargoLine, createCargoLine, distributeShipment, importerVerifyLine, markLineIssued, proposeAltBranch } from "@/lib/cargo-actions";
import { BRANCHES } from "@/lib/seed";
import { CARGO_RATE_PER_PACK, STORAGE_LABEL } from "@/lib/status";
import { ActionButton } from "./ActionButton";
import { Msg } from "./Msg";
import type { ActionResult, StorageClass } from "@/lib/types";

const EMPTY = { medicineName: "", dosage: "", form: "", qty: "1", storage: "room" as StorageClass, prescription: false, branchId: "b1", ack: false };
const branchLabel = (b: (typeof BRANCHES)[number]) => `${b.city}, ${b.name} (${b.district})`;

export function CargoLineForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (pending) return;
    start(async () => {
      const r = await createCargoLine({ medicineName: f.medicineName, dosage: f.dosage, form: f.form, qty: f.qty ? Number(f.qty) : undefined, storage: f.storage, prescription: f.prescription, branchId: f.branchId, prescriptionAck: f.ack ? true : false });
      setRes(r);
      if (r.ok) { setF(EMPTY); router.refresh(); }
    });
  }
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">Новый заказ в сборную отправку</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Название или действующее вещество<input className="input mt-1" value={f.medicineName} onChange={(e) => set("medicineName", e.target.value)} maxLength={120} /></label>
        <label className="text-sm font-medium">Дозировка<input className="input mt-1" value={f.dosage} onChange={(e) => set("dosage", e.target.value)} maxLength={40} /></label>
        <label className="text-sm font-medium">Форма выпуска<input className="input mt-1" value={f.form} onChange={(e) => set("form", e.target.value)} maxLength={40} /></label>
        <label className="text-sm font-medium">Количество упаковок (можно 1)<input className="input mt-1" inputMode="numeric" value={f.qty} onChange={(e) => set("qty", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="text-sm font-medium">Условия хранения<select className="input mt-1" value={f.storage} onChange={(e) => set("storage", e.target.value)}>{(Object.keys(STORAGE_LABEL) as StorageClass[]).map((k) => <option key={k} value={k}>{STORAGE_LABEL[k]}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">Точка выдачи<select className="input mt-1" value={f.branchId} onChange={(e) => set("branchId", e.target.value)}>{BRANCHES.map((b) => <option key={b.id} value={b.id}>{branchLabel(b)}</option>)}</select></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.prescription} onChange={(e) => set("prescription", e.target.checked)} />Препарат рецептурный</label>
      <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-700">Ориентир стоимости доставки (демо-тариф, не реальные расценки): {CARGO_RATE_PER_PACK[f.storage]} сом за упаковку плюс общий сбор на отправку, который делится между заказами отправки. Итог уточняется после проверки.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.ack} onChange={(e) => set("ack", e.target.checked)} /><span>Я понимаю: MediFinder не продаёт и не ввозит лекарства, ввоз возможен только после проверки импортёром, требования к рецептурным препаратам не обходятся.</span></label>
      <Msg r={res} />
      <button className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? "Отправка…" : "Оформить заказ"}</button>
    </div>
  );
}

export function CargoBuyerActions({ id, canCancel, altProposed, altName }: { id: string; canCancel: boolean; altProposed: boolean; altName?: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {altProposed && <p className="w-full text-sm">Предложена другая точка выдачи: <b>{altName}</b>. Без вашего согласия выдача останется в выбранной вами точке.</p>}
      {altProposed && <ActionButton variant="primary" action={buyerAltDecide.bind(null, id, "accept")}>Согласиться на эту точку</ActionButton>}
      {altProposed && <ActionButton variant="danger" action={buyerAltDecide.bind(null, id, "decline")}>Оставить мою точку</ActionButton>}
      {canCancel && <ActionButton confirm="Отменить заказ?" action={cancelCargoLine.bind(null, id)}>Отменить заказ</ActionButton>}
    </div>
  );
}

export function LineVerify({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [note, setNote] = useState("");
  const run = (d: "verified" | "declined") => start(async () => { const r = await importerVerifyLine(id, d, note); setRes(r); router.refresh(); });
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Заметка (при отказе обязательна)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Заметка импортёра" />
      <Msg r={res} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending} onClick={() => run("verified")}>Ввоз возможен</button>
        <button className="btn btn-danger" disabled={pending} onClick={() => run("declined")}>Отказать</button>
      </div>
    </div>
  );
}

export interface VerifiedLineView { id: string; label: string; storage: StorageClass }

/** Выбор проверенных заказов одного класса хранения для включения в отправку. */
export function ShipmentBuilder({ lines }: { lines: VerifiedLineView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.id}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} /><span>{l.label}<span className="ml-2 text-xs text-ink-500">{STORAGE_LABEL[l.storage]}</span></span></label></li>
        ))}
      </ul>
      <Msg r={res} />
      <button className="btn btn-primary" disabled={pending || sel.length === 0} onClick={() => start(async () => { const r = await addLinesToShipment(sel); setRes(r); if (r.ok) setSel([]); router.refresh(); })}>{pending ? "Подождите…" : "Включить в отправку"}</button>
    </div>
  );
}

export function ShipmentActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "forming" && <ActionButton variant="primary" confirm="Отправить в путь?" action={advanceShipment.bind(null, id)}>Отправить в путь</ActionButton>}
      {status === "in_transit" && <ActionButton variant="primary" action={advanceShipment.bind(null, id)}>Отметить прибытие</ActionButton>}
      {status === "arrived" && <ActionButton variant="primary" action={distributeShipment.bind(null, id)}>Распределить по точкам выдачи</ActionButton>}
    </div>
  );
}

export function AltBranchForm({ lineId, currentBranchId }: { lineId: string; currentBranchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [b, setB] = useState(BRANCHES.find((x) => x.id !== currentBranchId)?.id ?? "");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <select className="input max-w-xs" value={b} onChange={(e) => setB(e.target.value)} aria-label="Альтернативная точка">{BRANCHES.filter((x) => x.id !== currentBranchId).map((x) => <option key={x.id} value={x.id}>{branchLabel(x)}</option>)}</select>
        <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { const r = await proposeAltBranch(lineId, b); setRes(r); router.refresh(); })}>Предложить покупателю</button>
      </div>
      <Msg r={res} />
    </div>
  );
}

export const IssuedButton = ({ id }: { id: string }) => <ActionButton action={markLineIssued.bind(null, id)}>Отметить выдачу</ActionButton>;
