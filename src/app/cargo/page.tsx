import Link from "next/link";
import { CargoBadge } from "@/components/Badges";
import { CargoBuyerActions, CargoLineForm } from "@/components/CargoForms";
import { currentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/seed";
import { db } from "@/lib/store";
import { CARGO_RATE_PER_PACK, CARGO_SHARED_FEE, STORAGE_LABEL, formatDateTime, formatKgs } from "@/lib/status";

export const metadata = { title: "Cargo — сборные отправки — MediFinder" };
const bn = (id?: string) => { const b = BRANCHES.find((x) => x.id === id); return b ? `${b.city}, ${b.name}` : "—"; };

export default function CargoPage() {
  const u = currentUser();
  const mine = u?.role === "buyer" ? db().cargoLines.filter((l) => l.buyerId === u.id) : [];
  const shipments = db().shipments;
  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Cargo: сборные отправки</h1>
        <p className="mt-2 max-w-3xl text-ink-600">Заказы разных препаратов и разных покупателей собираются в общую отправку, заказать можно даже одну упаковку. Препараты с разными условиями хранения в одну отправку не попадают. У каждого покупателя своя запись. Ввоз возможен только после проверки импортёром, а альтернативная точка выдачи применяется только с вашего согласия. MediFinder — посредник.</p>
      </div>
      {!u && <div className="card"><p>Чтобы оформить заказ, войдите как покупатель.</p><Link href="/login" className="btn btn-primary mt-3">Войти в демо</Link></div>}
      {u && u.role !== "buyer" && <div className="card text-ink-600">Оформлять заказы может только покупатель. Ваш кабинет доступен через шапку сайта.</div>}
      {u?.role === "buyer" && (
        <>
          <CargoLineForm />
          <section>
            <h2 className="mb-3 text-xl font-bold">Мои заказы</h2>
            {mine.length === 0 ? <div className="card text-ink-600">Заказов пока нет.</div> : (
              <ul className="space-y-3">
                {mine.map((l) => {
                  const sh = shipments.find((s) => s.id === l.shipmentId);
                  const count = sh ? db().cargoLines.filter((x) => x.shipmentId === sh.id).length : 0;
                  const cost = sh ? l.qty * CARGO_RATE_PER_PACK[l.storage] + Math.round(CARGO_SHARED_FEE / count) : null;
                  const point = l.altStatus === "accepted" ? l.altBranchId : l.branchId;
                  return (
                    <li key={l.id} className="card space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{l.number} · {l.medicineName} {l.dosage}, {l.form} × {l.qty}</p><p className="text-xs text-ink-500">{STORAGE_LABEL[l.storage]}{l.prescription && " · рецептурный"} · создан {formatDateTime(l.createdAt)}</p></div><CargoBadge status={l.status} /></div>
                      <p className="text-sm text-ink-700">Точка выдачи: {bn(point)}{sh && ` · отправка ${sh.number}`}</p>
                      {cost !== null && <p className="text-sm text-ink-700">Расчёт доставки (демо-тариф): {l.qty} × {CARGO_RATE_PER_PACK[l.storage]} + {formatKgs(Math.round(CARGO_SHARED_FEE / count))} доля общего сбора ({count} зак. в отправке) = <b>{formatKgs(cost)}</b>. Ориентир, итог может измениться.</p>}
                      {l.importerNote && <p className="text-sm text-ink-700">Заметка импортёра: {l.importerNote}</p>}
                      <CargoBuyerActions id={l.id} canCancel={["requested", "verified", "declined"].includes(l.status)} altProposed={l.altStatus === "proposed"} altName={bn(l.altBranchId)} />
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
