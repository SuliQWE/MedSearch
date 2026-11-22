import { redirect } from "next/navigation";
import { ImporterDecision } from "@/components/GlobalForms";
import { GlobalBadge } from "@/components/GlobalBadge";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { GroupBadge, CargoBadge, ShipmentBadge } from "@/components/Badges";
import { GroupImporterDecision, GroupManage } from "@/components/GroupForms";
import { AltBranchForm, IssuedButton, LineVerify, ShipmentActions, ShipmentBuilder } from "@/components/CargoForms";
import { GlobalAltForm, GlobalIssuedButton, GlobalMixedBuilder, GlobalShipmentActions, GlobalShipmentBuilder } from "@/components/GlobalShipmentForms";
import { BRANCHES } from "@/lib/seed";
import { STORAGE_LABEL } from "@/lib/status";
import type { StorageClass } from "@/lib/types";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { formatDateTime, formatKgs } from "@/lib/status";

export const metadata = { title: "Кабинет импортёра — MediFinder" };

export default function ImporterPage() {
  const u = currentUser();
  if (!u || u.role !== "importer") redirect("/login");
  const all = db().globals;
  const hasPending = (g: (typeof all)[number]) => ["offered", "importer_approved"].includes(g.status) && g.offers.some((o) => !o.importerDecision);
  const queue = all.filter(hasPending);
  const rest = all.filter((g) => !hasPending(g));
  const confirmed = all.filter((g) => g.status === "buyer_confirmed");
  const confClasses = [...new Set(confirmed.map((g) => g.storage ?? "room"))] as StorageClass[];
  const notes = db().notifications.filter((n) => n.userId === u.id).slice(0, 10);
  const groups = db().groups;
  const lines = db().cargoLines;
  const shipments = db().shipments.filter((x) => x.kind !== "global");
  const gShipments = db().shipments.filter((x) => x.kind === "global");
  const verified = lines.filter((l) => l.status === "verified");
  const classes = [...new Set(verified.map((l) => l.storage))] as StorageClass[];
  const bn = (id?: string) => { const b = BRANCHES.find((x) => x.id === id); return b ? `${b.city}, ${b.name}` : "—"; };
  return (
    <div className="container-page space-y-8 py-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Кабинет импортёра</h1><p className="text-sm text-ink-500">Демо. Проверьте возможность ввоза и рецептурные требования до одобрения. Покупатели обезличены.</p></div>
      <section>
        <h2 className="mb-3 text-xl font-bold">На проверке ({queue.length})</h2>
        {queue.length === 0 ? <div className="card text-ink-600">Нет предложений на проверку.</div> : (
          <ul className="space-y-3">
            {queue.map((g) => (
              <li key={g.id} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{g.number} · {g.medicineName} {g.dosage}, {g.form} × {g.qty}</p><GlobalBadge status={g.status} /></div>
                <p className="text-sm text-ink-600">{g.storage ? STORAGE_LABEL[g.storage] : "условия хранения не указаны"} · {g.prescription ? "рецептурный: проверьте требования до одобрения" : "безрецептурный"} · точка выдачи: {bn(g.branchId)}</p>
                {g.comment && <p className="text-sm text-ink-600">Комментарий покупателя: {g.comment}</p>}
                {g.offers.filter((o) => !o.importerDecision).map((o) => (
                  <div key={o.id} className="space-y-2 rounded-xl bg-ink-50 p-3 text-sm">
                    <p>Поставщик предлагает {formatKgs(o.pricePerPack)} за упаковку, срок {o.leadTimeDays} дн.{o.note && ` · ${o.note}`}</p>
                    <ImporterDecision requestId={g.id} offerId={o.id} />
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Остальные заявки</h2>
        {rest.length === 0 ? <div className="card text-ink-600">Пока пусто.</div> : <ul className="space-y-2">{rest.map((g) => <li key={g.id} className="card flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{g.number} · {g.medicineName} {g.dosage} × {g.qty} · {formatDateTime(g.createdAt)}</span><GlobalBadge status={g.status} /></li>)}</ul>}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Подтверждённые покупателями ({confirmed.length})</h2>
        <p className="mb-3 text-sm text-ink-600">Препараты с разными условиями хранения в одну отправку не объединяйте: они сгруппированы по классу. Включить в отправку можно только заявки одного класса.</p>
        {confirmed.length === 0 ? <div className="card text-ink-600">Пока нет подтверждённых заказов.</div> : (
          <div className="space-y-3">
            {confClasses.map((c) => <div key={c} className="card"><p className="mb-2 text-sm font-semibold">{STORAGE_LABEL[c]}</p><GlobalShipmentBuilder items={confirmed.filter((g) => (g.storage ?? "room") === c).map((g) => ({ id: g.id, storage: c, label: `${g.number} · ${g.medicineName} ${g.dosage} × ${g.qty} → ${bn(g.branchId)}` }))} /></div>)}
            {confClasses.length > 1 && <div className="card"><p className="mb-2 text-sm font-semibold">Выбор из нескольких классов</p><GlobalMixedBuilder items={confirmed.map((g) => ({ id: g.id, storage: (g.storage ?? "room") as StorageClass, label: `${g.number} · ${g.medicineName} ${g.dosage} × ${g.qty}` }))} /></div>}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Международные заказы: отправки ({gShipments.length})</h2>
        {gShipments.length === 0 ? <div className="card text-ink-600">Отправок пока нет.</div> : (
          <ul className="space-y-3">
            {gShipments.map((sh) => {
              const rs = all.filter((g) => g.shipmentId === sh.id);
              return (
                <li key={sh.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{sh.number} · {STORAGE_LABEL[sh.storage]} · заявок {rs.length}</p><ShipmentBadge status={sh.status} /></div>
                  <ul className="space-y-2">
                    {rs.map((g) => (
                      <li key={g.id} className="space-y-1 rounded-xl bg-ink-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span>{g.number} · {g.medicineName} {g.dosage} × {g.qty} → {bn(g.altStatus === "accepted" ? g.altBranchId : g.branchId)}</span><GlobalBadge status={g.status} /></div>
                        {g.altStatus === "proposed" && <p className="text-xs text-amber-800">Альтернативная точка ({bn(g.altBranchId)}) ждёт согласия покупателя. Пока ответа нет, отправку продвигать нельзя.</p>}
                        {g.altStatus === "declined" && <p className="text-xs text-ink-500">Покупатель отказался от альтернативной точки.</p>}
                        {g.altStatus === "accepted" && <p className="text-xs text-ink-500">Покупатель согласился на точку: {bn(g.altBranchId)}.</p>}
                        {["in_shipment", "in_transit", "arrived"].includes(g.status) && g.altStatus !== "proposed" && <GlobalAltForm requestId={g.id} currentBranchId={g.branchId ?? "b1"} />}
                        {g.status === "ready_for_pickup" && <GlobalIssuedButton id={g.id} />}
                      </li>
                    ))}
                  </ul>
                  <GlobalShipmentActions id={sh.id} status={sh.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {groups.length > 0 && <section>
        <h2 className="mb-3 text-xl font-bold">Group Orders ({groups.filter((g) => g.status === "open" || g.status === "offered").length} активных)</h2>
        {groups.length === 0 ? <div className="card text-ink-600">Групп пока нет.</div> : (
          <ul className="space-y-3">
            {groups.map((g) => {
              const vol = g.members.reduce((s, m) => s + m.qty, 0);
              const active = g.status === "open" || g.status === "offered";
              return (
                <li key={g.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{g.number} · {g.medicineName} {g.dosage}, {g.form}</p><p className="text-xs text-ink-500">Участников {g.members.length}, объём {vol} уп., набор до {formatDateTime(g.deadline)}{g.status === "approved" && ` · подтвердили ${g.members.filter((m) => m.confirmation === "confirmed").length}, отказались ${g.members.filter((m) => m.confirmation === "declined").length}`}</p></div><GroupBadge status={g.status} /></div>
                  {g.offers.filter((o) => !o.importerDecision).map((o) => (
                    <div key={o.id} className="space-y-2 rounded-xl bg-ink-50 p-3 text-sm">
                      <p>Поставщик: от {o.minVolume} уп. по {formatKgs(o.pricePerPack)}, срок {o.leadTimeDays} дн.{o.note && ` · ${o.note}`}</p>
                      <GroupImporterDecision groupId={g.id} offerId={o.id} />
                    </div>
                  ))}
                  {active && <GroupManage groupId={g.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>}
      {lines.length > 0 && <><section>
        <h2 className="mb-3 text-xl font-bold">Cargo: заказы на проверке</h2>
        {lines.filter((l) => l.status === "requested").length === 0 ? <div className="card text-ink-600">Нет заказов на проверку.</div> : (
          <ul className="space-y-3">
            {lines.filter((l) => l.status === "requested").map((l) => (
              <li key={l.id} className="card space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{l.number} · {l.medicineName} {l.dosage}, {l.form} × {l.qty}</p><CargoBadge status={l.status} /></div>
                <p className="text-sm text-ink-600">{STORAGE_LABEL[l.storage]} · {l.prescription ? "рецептурный: проверьте требования до одобрения" : "безрецептурный"} · точка выдачи: {bn(l.branchId)}</p>
                <LineVerify id={l.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Cargo: формирование отправок</h2>
        {classes.length === 0 ? <div className="card text-ink-600">Нет проверенных заказов для включения в отправку.</div> : (
          <div className="space-y-3">{classes.map((c) => <div key={c} className="card"><p className="mb-2 text-sm font-semibold">{STORAGE_LABEL[c]}</p><ShipmentBuilder lines={verified.filter((l) => l.storage === c).map((l) => ({ id: l.id, storage: l.storage, label: `${l.number} · ${l.medicineName} ${l.dosage} × ${l.qty} → ${bn(l.branchId)}` }))} /></div>)}</div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Cargo: отправки</h2>
        {shipments.length === 0 ? <div className="card text-ink-600">Отправок пока нет.</div> : (
          <ul className="space-y-3">
            {shipments.map((sh) => {
              const ls = lines.filter((l) => l.shipmentId === sh.id);
              return (
                <li key={sh.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{sh.number} · {STORAGE_LABEL[sh.storage]} · заказов {ls.length}</p><ShipmentBadge status={sh.status} /></div>
                  <ul className="space-y-2">
                    {ls.map((l) => (
                      <li key={l.id} className="space-y-1 rounded-xl bg-ink-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span>{l.number} · {l.medicineName} {l.dosage} × {l.qty} → {bn(l.altStatus === "accepted" ? l.altBranchId : l.branchId)}</span><CargoBadge status={l.status} /></div>
                        {l.altStatus === "proposed" && <p className="text-xs text-amber-800">Альтернативная точка ({bn(l.altBranchId)}) ждёт согласия покупателя.</p>}
                        {l.altStatus === "declined" && <p className="text-xs text-ink-500">Покупатель отказался от альтернативной точки.</p>}
                        {["in_shipment", "in_transit", "arrived"].includes(l.status) && l.altStatus !== "proposed" && <AltBranchForm lineId={l.id} currentBranchId={l.branchId} />}
                        {l.status === "ready_for_pickup" && <IssuedButton id={l.id} />}
                      </li>
                    ))}
                  </ul>
                  <ShipmentActions id={sh.id} status={sh.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section></>}
      <NotificationsPanel notes={notes} />
    </div>
  );
}
