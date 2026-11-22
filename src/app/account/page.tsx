import { redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { buyerAcceptProposal, buyerCancel, sweepExpired } from "@/lib/actions";
import { currentUser } from "@/lib/auth";
import { BRANCHES, MEDICINES, PHARMACIES } from "@/lib/seed";
import { db } from "@/lib/store";
import { formatDateTime, formatKgs } from "@/lib/status";

export const metadata = { title: "Мои заказы — MediFinder" };

export default async function AccountPage() {
  const u = currentUser();
  if (!u) redirect("/login");
  if (u.role !== "buyer") redirect("/login");
  await sweepExpired();
  const orders = db().orders.filter((o) => o.buyerId === u.id);
  const notes = db().notifications.filter((n) => n.userId === u.id).slice(0, 20);

  return (
    <div className="container-page space-y-8 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Личный кабинет</h1>
      <section>
        <h2 className="mb-3 text-xl font-bold">Мои заказы</h2>
        {orders.length === 0 ? (
          <div className="card text-ink-600">Заказов пока нет. Найдите лекарство в каталоге и отправьте заказ в аптеку.</div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const b = BRANCHES.find((x) => x.id === o.branchId)!;
              const ph = PHARMACIES.find((p) => p.id === b.pharmacyId)!;
              const total = o.items.reduce((s, i) => s + i.qty * i.price, 0);
              return (
                <li key={o.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="font-semibold">Заказ {o.number}</p><p className="text-sm text-ink-500">{ph.name} · {b.name} · {b.city}, {b.address}</p></div>
                    <StatusBadge status={o.status} />
                  </div>
                  <ul className="text-sm">
                    {o.items.map((i) => {
                      const m = MEDICINES.find((x) => x.id === i.medicineId)!;
                      const proposed = o.proposedQty?.[i.medicineId];
                      return <li key={i.medicineId} className="flex justify-between border-t border-ink-100 py-1.5"><span>{m.name} {m.dosage} × {i.qty}{proposed && <b className="ml-2 text-sky-700">аптека предлагает: {proposed}</b>}</span><span>{formatKgs(i.price * i.qty)}</span></li>;
                    })}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">Итого: {formatKgs(total)} · оплата в аптеке</span>
                    {o.reserveUntil && (o.status === "confirmed" || o.status === "ready") && <span className="text-brand-800">Резерв до {formatDateTime(o.reserveUntil)}. Назовите номер {o.number} в аптеке.</span>}
                    {o.status === "pending" && <span className="text-amber-800">Резерва пока нет: ждём подтверждения аптеки.</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "qty_proposed" && <ActionButton variant="primary" action={buyerAcceptProposal.bind(null, o.id)}>Принять новое количество</ActionButton>}
                    {["pending", "qty_proposed", "confirmed", "ready"].includes(o.status) && <ActionButton variant="danger" confirm="Отменить заказ?" action={buyerCancel.bind(null, o.id)}>Отменить</ActionButton>}
                  </div>
                  <details className="text-xs text-ink-500"><summary className="cursor-pointer">История статусов</summary>
                    <ol className="mt-2 space-y-1">{o.history.map((h, idx) => <li key={idx}>{formatDateTime(h.at)} — {h.status}</li>)}</ol>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section id="notifications"><NotificationsPanel notes={notes} /></section>
    </div>
  );
}
