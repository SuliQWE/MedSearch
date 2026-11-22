import Link from "next/link";
import { BuyerGlobalActions, GlobalRequestForm } from "@/components/GlobalForms";
import { ActionButton } from "@/components/ActionButton";
import { buyerGlobalDecide } from "@/lib/global-actions";
import { BRANCHES } from "@/lib/seed";
import { GlobalBadge } from "@/components/GlobalBadge";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { CARGO_RATE_PER_PACK, CARGO_SHARED_FEE, STORAGE_LABEL, formatDateTime, formatKgs } from "@/lib/status";
import { GlobalAltDecide } from "@/components/GlobalShipmentForms";
import { Check, Circle, MapPin } from "lucide-react";
import type { GlobalStatus } from "@/lib/types";

// Шаги пути заказа после выбора предложения.
const STEPS: { status: GlobalStatus; label: string }[] = [
  { status: "buyer_confirmed", label: "Предложение выбрано" },
  { status: "in_shipment", label: "В отправке" },
  { status: "in_transit", label: "В пути" },
  { status: "arrived", label: "Прибыло" },
  { status: "ready_for_pickup", label: "Готово к получению" },
  { status: "issued", label: "Выдано" },
];
const stepIndex = (s: GlobalStatus) => STEPS.findIndex((x) => x.status === s);

function Timeline({ status }: { status: GlobalStatus }) {
  const cur = stepIndex(status);
  return (
    <ol className="grid gap-2 sm:grid-cols-6" aria-label="Этапы заказа">
      {STEPS.map((st, i) => {
        const done = i < cur || (status === "issued" && i === cur);
        const active = i === cur && status !== "issued";
        return (
          <li key={st.status} aria-current={active ? "step" : undefined} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:flex-col sm:items-start ${active ? "bg-brand-100 font-semibold text-brand-900 ring-1 ring-brand-300" : done ? "bg-brand-50 text-brand-800" : "bg-ink-50 text-ink-500"}`}>
            {done ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <Circle className="h-4 w-4 shrink-0" aria-hidden />}
            <span>{st.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export const metadata = { title: "Международный заказ — MediFinder" };

export default function GlobalPage() {
  const u = currentUser();
  const bn = (id?: string) => { const b = BRANCHES.find((x) => x.id === id); return b ? `${b.city}, ${b.name}` : "—"; };
  const mine = u?.role === "buyer" ? db().globals.filter((g) => g.buyerId === u.id) : [];
  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Международный заказ: препарат, которого нет в аптеках</h1>
        <p className="mt-2 max-w-3xl text-ink-600">MediFinder — посредник. Мы не продаём, не храним и не ввозим лекарства. Заказ видят все поставщики, и каждый принимает то, что может поставить. Похожие заказы объединяются, поэтому набор общего объёма идёт автоматически. Поставщики присылают предложения, импортёр проверяет возможность ввоза, и только после этого вы решаете, подтверждать ли условия. Заявка возможна даже на одну упаковку.</p>
      </div>
      {!u && <div className="card"><p>Чтобы подать заявку, войдите как покупатель.</p><Link href="/login" className="btn btn-primary mt-3">Войти в демо</Link></div>}
      {u && u.role !== "buyer" && <div className="card text-ink-600">Подавать заявки может только покупатель. Ваш кабинет доступен через шапку сайта.</div>}
      {u?.role === "buyer" && (
        <>
          <GlobalRequestForm />
          <section>
            <h2 className="mb-3 text-xl font-bold">Мои заявки</h2>
            {mine.length === 0 ? <div className="card text-ink-600">Заявок пока нет.</div> : (
              <ul className="space-y-3">
                {mine.map((g) => {
                  const approved = g.offers.filter((o) => o.importerDecision === "approved");
                  const chosen = g.offers.find((o) => o.id === g.chosenOfferId);
                  const br = BRANCHES.find((b) => b.id === g.branchId);
                  return (
                    <li key={g.id} className="card space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{g.number} · {g.medicineName} {g.dosage}, {g.form} × {g.qty}</p><p className="text-xs text-ink-500">Создана {formatDateTime(g.createdAt)}{g.storage && ` · ${STORAGE_LABEL[g.storage]}`}{g.prescription && " · рецептурный"}{br && ` · выдача: ${br.city}, ${br.name}`}</p></div><GlobalBadge status={g.status} /></div>
                      {g.status === "importer_approved" && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Проверенных предложений: {approved.length}. Выберите одно:</p>
                          {approved.map((o, n) => (
                            <div key={o.id} className="space-y-2 rounded-xl bg-brand-50 p-3 text-sm">
                              <p><b>Предложение {n + 1}: {formatKgs(o.pricePerPack)}</b> за упаковку (ориентир, демо-значение) · срок {o.leadTimeDays} дн.</p>
                              {o.note && <p className="text-ink-700">Условия: {o.note}</p>}
                              {o.importerNote && <p className="text-ink-700">Заметка импортёра: {o.importerNote}</p>}
                              <ActionButton variant="primary" action={buyerGlobalDecide.bind(null, g.id, "confirm", o.id)}>Выбрать это предложение</ActionButton>
                            </div>
                          ))}
                          <p className="text-xs text-ink-500">Итоговая стоимость может измениться, подтверждение не является обязательством по ввозу.</p>
                        </div>
                      )}
                      {stepIndex(g.status) >= 0 && (
                        <div className="space-y-3">
                          <Timeline status={g.status} />
                          {chosen && <div className="rounded-xl bg-brand-50 p-3 text-sm space-y-1">
                            <p>Вы выбрали: <b>{formatKgs(chosen.pricePerPack)}</b> за упаковку · срок {chosen.leadTimeDays} дн.</p>
                            <p className="text-ink-700">Ориентир стоимости доставки (демо-тариф, не реальные расценки): {formatKgs(CARGO_RATE_PER_PACK[g.storage ?? "room"] * g.qty)} ({CARGO_RATE_PER_PACK[g.storage ?? "room"]} сом за упаковку) плюс общий сбор на отправку {formatKgs(CARGO_SHARED_FEE)}, он делится между заказами отправки. Итог уточняется после проверки.</p>
                          </div>}
                          {g.altStatus === "proposed" && g.altBranchId && <GlobalAltDecide id={g.id} altName={bn(g.altBranchId)} />}
                          {g.altStatus === "accepted" && g.status !== "ready_for_pickup" && g.status !== "issued" && <p className="text-sm text-ink-600">Вы согласились на другую точку выдачи: {bn(g.altBranchId)}.</p>}
                          {g.altStatus === "declined" && <p className="text-sm text-ink-600">Вы оставили выбранную точку выдачи.</p>}
                          {g.status === "ready_for_pickup" && (() => { const pb = BRANCHES.find((b) => b.id === (g.altStatus === "accepted" && g.altBranchId ? g.altBranchId : g.branchId ?? "b1")); return pb ? (
                            <div className="space-y-1 rounded-xl bg-brand-50 p-3 text-sm">
                              <p className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" aria-hidden />Точка выдачи: {pb.city}, {pb.name}</p>
                              <p>{pb.address} · часы работы: {pb.hours}</p>
                              <p className="font-semibold">Назовите номер заявки {g.number}</p>
                              {g.prescription && <p className="text-ink-700">Препарат рецептурный: при получении могут потребовать рецепт.</p>}
                            </div>) : null; })()}
                          {g.status === "issued" && <p className="text-sm text-ink-600">Заказ выдан.</p>}
                        </div>
                      )}
                      {g.status === "importer_rejected" && <p className="text-sm text-red-700">{g.offers.map((o) => o.importerNote).filter(Boolean).join("; ") || "Причина не указана."}</p>}
                      <BuyerGlobalActions id={g.id} canDecide={g.status === "importer_approved"} canCancel={["new", "offered", "importer_approved"].includes(g.status)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
