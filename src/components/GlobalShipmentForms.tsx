"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addGlobalsToShipment, advanceGlobalShipment, buyerGlobalAltDecide, distributeGlobalShipment, markGlobalIssued, proposeGlobalAlt } from "@/lib/global-actions";
import { BRANCHES } from "@/lib/seed";
import { STORAGE_LABEL } from "@/lib/status";
import { ActionButton } from "./ActionButton";
import { Msg } from "./Msg";
import type { ActionResult, StorageClass } from "@/lib/types";

const branchLabel = (b: (typeof BRANCHES)[number]) => `${b.city}, ${b.name} (${b.district})`;

export interface ConfirmedView { id: string; label: string; storage: StorageClass }

/** Подтверждённые покупателями заявки одного класса хранения: выбор и включение в отправку. */
export function GlobalShipmentBuilder({ items }: { items: ConfirmedView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {items.map((l) => (
          <li key={l.id}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} /><span>{l.label}</span></label></li>
        ))}
      </ul>
      <Msg r={res} />
      <button className="btn btn-primary" disabled={pending || sel.length === 0} onClick={() => start(async () => { const r = await addGlobalsToShipment(sel); setRes(r); if (r.ok) setSel([]); router.refresh(); })}>{pending ? "Подождите…" : "Включить в отправку"}</button>
    </div>
  );
}

/** Одна форма для двух классов: выбор из всех подтверждённых (нужна, чтобы проверять отказ при смешивании классов). */
export function GlobalMixedBuilder({ items }: { items: ConfirmedView[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-500">Если отметить заявки с разными условиями хранения, система откажет: в одну отправку можно только один класс.</p>
      <GlobalShipmentBuilder items={items.map((i) => ({ ...i, label: `${i.label} · ${STORAGE_LABEL[i.storage]}` }))} />
    </div>
  );
}

export function GlobalShipmentActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "forming" && <ActionButton variant="primary" confirm="Отправить в путь?" action={advanceGlobalShipment.bind(null, id)}>Отправить в путь</ActionButton>}
      {status === "in_transit" && <ActionButton variant="primary" action={advanceGlobalShipment.bind(null, id)}>Отметить прибытие</ActionButton>}
      {status === "arrived" && <ActionButton variant="primary" action={distributeGlobalShipment.bind(null, id)}>Распределить по точкам выдачи</ActionButton>}
    </div>
  );
}

export function GlobalAltForm({ requestId, currentBranchId }: { requestId: string; currentBranchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const [b, setB] = useState(BRANCHES.find((x) => x.id !== currentBranchId)?.id ?? "");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <select className="input max-w-xs" value={b} onChange={(e) => setB(e.target.value)} aria-label="Альтернативная точка">{BRANCHES.filter((x) => x.id !== currentBranchId).map((x) => <option key={x.id} value={x.id}>{branchLabel(x)}</option>)}</select>
        <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { const r = await proposeGlobalAlt(requestId, b); setRes(r); router.refresh(); })}>Предложить другую точку</button>
      </div>
      <Msg r={res} />
    </div>
  );
}

export const GlobalIssuedButton = ({ id }: { id: string }) => <ActionButton variant="primary" confirm="Отметить, что покупатель получил товар?" action={markGlobalIssued.bind(null, id)}>Выдан</ActionButton>;

/** Блок согласования альтернативной точки на странице покупателя. */
export function GlobalAltDecide({ id, altName }: { id: string; altName: string }) {
  return (
    <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm">
      <p>Импортёр предлагает другую точку выдачи: <b>{altName}</b>. Без вашего согласия выдача останется в выбранной вами точке, а отправка не продвинется, пока вы не ответите.</p>
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="primary" action={buyerGlobalAltDecide.bind(null, id, "accept")}>Согласиться</ActionButton>
        <ActionButton variant="danger" action={buyerGlobalAltDecide.bind(null, id, "decline")}>Отказаться</ActionButton>
      </div>
    </div>
  );
}
