"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { groupImporterDecide, groupSupplierOffer, importerGroupManage, joinOrCreateGroup, leaveGroup, memberDecide } from "@/lib/group-actions";
import { ActionButton } from "./ActionButton";
import { Msg } from "./Msg";
import type { ActionResult } from "@/lib/types";

const EMPTY = { medicineName: "", dosage: "", form: "", qty: "1", ack: false };

export function GroupJoinForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  function submit() {
    if (pending) return;
    start(async () => {
      const r = await joinOrCreateGroup({ medicineName: f.medicineName, dosage: f.dosage, form: f.form, qty: f.qty ? Number(f.qty) : undefined, prescriptionAck: f.ack ? true : false });
      setRes(r);
      if (r.ok) { setF(EMPTY); router.refresh(); }
    });
  }
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">Вступить в группу или создать новую</h2>
      <p className="text-sm text-ink-600">Если открытая группа с таким же препаратом, дозировкой и формой уже есть, вы в неё вступите. Иначе будет создана новая.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Название или действующее вещество<input className="input mt-1" value={f.medicineName} onChange={(e) => set("medicineName", e.target.value)} maxLength={120} /></label>
        <label className="text-sm font-medium">Дозировка<input className="input mt-1" placeholder="например, 10 мг" value={f.dosage} onChange={(e) => set("dosage", e.target.value)} maxLength={40} /></label>
        <label className="text-sm font-medium">Форма выпуска<input className="input mt-1" placeholder="таблетки, раствор…" value={f.form} onChange={(e) => set("form", e.target.value)} maxLength={40} /></label>
        <label className="text-sm font-medium">Сколько упаковок вам нужно<input className="input mt-1" inputMode="numeric" value={f.qty} onChange={(e) => set("qty", e.target.value.replace(/\D/g, ""))} /></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.ack} onChange={(e) => set("ack", e.target.checked)} /><span>Я понимаю: MediFinder не продаёт и не ввозит лекарства, ввоз возможен только после проверки импортёром, требования к рецептурным препаратам не обходятся.</span></label>
      <Msg r={res} />
      <button className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? "Отправка…" : "Продолжить"}</button>
    </div>
  );
}

export function GroupMemberActions({ id, canDecide, canLeave }: { id: string; canDecide: boolean; canLeave: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide && <ActionButton variant="primary" action={memberDecide.bind(null, id, "confirm")}>Подтвердить моё участие</ActionButton>}
      {canDecide && <ActionButton variant="danger" confirm="Отказаться от участия?" action={memberDecide.bind(null, id, "decline")}>Отказаться</ActionButton>}
      {canLeave && <ActionButton variant="secondary" confirm="Выйти из группы?" action={leaveGroup.bind(null, id)}>Выйти из группы</ActionButton>}
    </div>
  );
}

export function GroupOfferForm({ groupId, maxVolume }: { groupId: string; maxVolume: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [vol, setVol] = useState(""); const [price, setPrice] = useState(""); const [days, setDays] = useState(""); const [note, setNote] = useState("");
  return (
    <div className="space-y-2 border-t border-ink-100 pt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm font-medium">Объём, упаковок (до {maxVolume})<input className="input mt-1" inputMode="numeric" value={vol} onChange={(e) => setVol(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="text-sm font-medium">Цена за упаковку, сом (ориентир)<input className="input mt-1" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
        <label className="text-sm font-medium">Срок, дней<input className="input mt-1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} /></label>
      </div>
      <label className="block text-sm font-medium">Условия (необязательно)<input className="input mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
      <Msg r={res} />
      <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await groupSupplierOffer(groupId, { minVolume: Number(vol), pricePerPack: Number(price), leadTimeDays: Number(days), note }); setRes(r); router.refresh(); })}>{pending ? "Отправка…" : "Отправить предложение"}</button>
    </div>
  );
}

export function GroupImporterDecision({ groupId, offerId }: { groupId: string; offerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [note, setNote] = useState("");
  const run = (d: "approved" | "rejected") => start(async () => { const r = await groupImporterDecide(groupId, offerId, d, note); setRes(r); router.refresh(); });
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

export function GroupManage({ groupId }: { groupId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton action={importerGroupManage.bind(null, groupId, "extend")}>Продлить набор на 7 дней</ActionButton>
      <ActionButton variant="danger" confirm="Закрыть группу?" action={importerGroupManage.bind(null, groupId, "close")}>Закрыть группу</ActionButton>
    </div>
  );
}
