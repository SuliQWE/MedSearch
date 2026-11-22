import { redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { ProposeQty, StockRow } from "@/components/PharmacyControls";
import { StatusBadge } from "@/components/StatusBadge";
import { pharmacyConfirm, pharmacyIssue, pharmacyMarkReady, pharmacyReject, sweepExpired } from "@/lib/actions";
import { currentUser } from "@/lib/auth";
import { getMedicines } from "@/lib/catalog";
import { BRANCHES, PHARMACIES } from "@/lib/seed";
import { db } from "@/lib/store";
import { formatDateTime, formatKgs } from "@/lib/status";

export const metadata = { title: "Кабинет аптеки — MediFinder" };

export default async function PharmacyPage() {
  const MEDICINES = await getMedicines();
  const u = currentUser();
  if (!u || u.role !== "pharmacy" || !u.pharmacyId) redirect("/login");
  await sweepExpired();
  const pharmacy = PHARMACIES.find((p) => p.id === u.pharmacyId)!;
  const branches = BRANCHES.filter((b) => b.pharmacyId === u.pharmacyId);
  const ids = new Set(branches.map((b) => b.id));
  // Аптека видит только заказы своих филиалов.
  const orders = db().orders.filter((o) => ids.has(o.branchId));
  const active = orders.filter((o) => ["pending", "confirmed", "qty_proposed", "ready"].includes(o.status));
  const history = orders.filter((o) => !active.includes(o));
  const stock = db().stock.filter((s) => ids.has(s.branchId));
  const notes = db().notifications.filter((n) => n.userId === u.id).slice(0, 10);

  const popular = new Map<string, number>();
  for (const o of orders) for (const i of o.items) popular.set(i.medicineId, (popular.get(i.medicineId) ?? 0) + i.qty);
  const top = [...popular.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="container-page space-y-8 py-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">{pharmacy.name}</h1><p className="text-sm text-ink-500">Кабинет аптеки (демо). Филиалов: {branches.length}</p></div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-sm text-ink-500">Новые и активные заказы</p><p className="text-2xl font-bold">{active.length}</p></div>
        <div className="card"><p className="text-sm text-ink-500">Всего заказов</p><p className="text-2xl font-bold">{orders.length}</p></div>
        <div className="card"><p className="text-sm text-ink-500">Популярное</p><p className="text-sm font-medium">{top.length ? top.map(([id, n]) => `${MEDICINES.find((m) => m.id === id)?.name} (${n})`).join(", ") : "пока нет данных"}</p></div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Заказы в работе</h2>
        {active.length === 0 ? <div className="card text-ink-600">Нет активных заказов.</div> : (
          <ul className="space-y-3">
            {active.map((o) => {
              const b = BRANCHES.find((x) => x.id === o.branchId)!;
              return (
                <li key={o.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Заказ {o.number}</p><p className="text-sm text-ink-500">{b.name} · создан {formatDateTime(o.createdAt)}</p></div><StatusBadge status={o.status} /></div>
                  <ul className="text-sm">
                    {o.items.map((i) => {
                      const m = MEDICINES.find((x) => x.id === i.medicineId)!;
                      const s = db().stock.find((x) => x.branchId === o.branchId && x.medicineId === i.medicineId);
                      return (
                        <li key={i.medicineId} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 py-2">
                          <span>{m.name} {m.dosage} × {i.qty} · {formatKgs(i.price * i.qty)}{m.prescription && <b className="ml-2 text-sky-700">проверьте рецепт</b>}</span>
                          <span className="flex items-center gap-2 text-ink-500">остаток: {s?.qty ?? 0}{o.status === "pending" && <ProposeQty orderId={o.id} medicineId={i.medicineId} max={Math.min(i.qty, s?.qty ?? 0)} />}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "pending" && <><ActionButton variant="primary" action={pharmacyConfirm.bind(null, o.id)}>Подтвердить и зарезервировать</ActionButton><ActionButton variant="danger" confirm="Отклонить заказ?" action={pharmacyReject.bind(null, o.id)}>Отклонить</ActionButton></>}
                    {o.status === "confirmed" && <ActionButton variant="secondary" action={pharmacyMarkReady.bind(null, o.id)}>Готов к получению</ActionButton>}
                    {(o.status === "confirmed" || o.status === "ready") && <ActionButton variant="primary" confirm="Отметить заказ выданным? Оплата принята в аптеке." action={pharmacyIssue.bind(null, o.id)}>Выдать покупателю</ActionButton>}
                    {o.status === "qty_proposed" && <p className="text-sm text-sky-800">Ожидаем ответа покупателя.</p>}
                  </div>
                  {o.reserveUntil && <p className="text-xs text-ink-500">Резерв до {formatDateTime(o.reserveUntil)}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Остатки и цены</h2>
        <div className="card">
          {branches.map((b) => (
            <div key={b.id} className="mb-4 last:mb-0">
              <h3 className="font-semibold">{b.name} · {b.city}</h3><p className="text-xs text-ink-500">{b.address} · {b.hours}</p>
              {MEDICINES.map((m) => {
                const s = stock.find((x) => x.branchId === b.id && x.medicineId === m.id);
                return <StockRow key={`${b.id}-${m.id}-${s?.qty}-${s?.price}`} branchId={b.id} medicineId={m.id} label={`${m.name} ${m.dosage}, ${m.form}`} price={s?.price ?? 0} qty={s?.qty ?? 0} />;
              })}
            </div>
          ))}
        </div>
      </section>

      <section><h2 className="mb-3 text-xl font-bold">История</h2>
        {history.length === 0 ? <div className="card text-ink-600">Завершённых заказов нет.</div> : (
          <ul className="space-y-2">{history.map((o) => <li key={o.id} className="card flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{o.number} · {formatDateTime(o.createdAt)}</span><StatusBadge status={o.status} /></li>)}</ul>
        )}
      </section>
      <NotificationsPanel notes={notes} />
    </div>
  );
}
