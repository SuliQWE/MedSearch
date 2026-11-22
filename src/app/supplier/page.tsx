import { redirect } from "next/navigation";
import { OfferForm } from "@/components/GlobalForms";
import { GlobalBadge } from "@/components/GlobalBadge";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { GroupBadge } from "@/components/Badges";
import { GroupOfferForm } from "@/components/GroupForms";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { formatKgs } from "@/lib/status";

export const metadata = { title: "Кабинет поставщика — MediFinder" };

// Поставщик видит только обезличенный спрос: без покупателей и без комментариев.
export default function SupplierPage() {
  const u = currentUser();
  if (!u || u.role !== "supplier") redirect("/login");
  const open = db().globals.filter((g) => g.status === "new" || g.status === "offered");
  const mineOffers = db().globals.flatMap((g) => g.offers.filter((o) => o.supplierId === u.id).map((o) => ({ g, o })));
  const notes = db().notifications.filter((n) => n.userId === u.id).slice(0, 10);
  const demand = new Map<string, number>();
  for (const g of open) { const k = `${g.medicineName} ${g.dosage}, ${g.form}`; demand.set(k, (demand.get(k) ?? 0) + g.qty); }
  const groups = db().groups.filter((g) => g.status === "open" || g.status === "offered");
  return (
    <div className="container-page space-y-8 py-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Кабинет поставщика</h1><p className="text-sm text-ink-500">Демо. Персональные данные покупателей вам не передаются.</p></div>
      <section>
        <h2 className="mb-3 text-xl font-bold">Спрос (агрегат)</h2>
        {demand.size === 0 ? <div className="card text-ink-600">Открытого спроса нет.</div> : <ul className="grid gap-2 sm:grid-cols-2">{[...demand].map(([k, n]) => <li key={k} className="card py-3 text-sm"><b>{k}</b><span className="ml-2 text-ink-500">всего {n} уп.</span></li>)}</ul>}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Заявки, ожидающие предложений</h2>
        {open.length === 0 ? <div className="card text-ink-600">Нет заявок.</div> : (
          <ul className="space-y-3">
            {open.map((g) => {
              const sent = g.offers.some((o) => o.supplierId === u.id && !o.importerDecision);
              return (
                <li key={g.id} className="card space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{g.number} · {g.medicineName} {g.dosage}, {g.form} × {g.qty}</p><GlobalBadge status={g.status} /></div>
                  {sent ? <p className="text-sm text-ink-600">Ваше предложение отправлено и ждёт проверки импортёром.</p> : <OfferForm requestId={g.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Мои предложения</h2>
        {mineOffers.length === 0 ? <div className="card text-ink-600">Вы ещё не отправляли предложений.</div> : (
          <ul className="space-y-2">{mineOffers.map(({ g, o }) => <li key={o.id} className="card py-3 text-sm">{g.number} · {formatKgs(o.pricePerPack)} · {o.leadTimeDays} дн. · {o.importerDecision === "approved" ? "одобрено импортёром" : o.importerDecision === "rejected" ? "отклонено импортёром" : "на проверке"}</li>)}</ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Group Orders: общий спрос</h2>
        {groups.length === 0 ? <div className="card text-ink-600">Открытых групп нет.</div> : (
          <ul className="space-y-3">
            {groups.map((g) => {
              const vol = g.members.reduce((s, m) => s + m.qty, 0);
              const sent = g.offers.some((o) => o.supplierId === u.id && !o.importerDecision);
              return (
                <li key={g.id} className="card space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{g.number} · {g.medicineName} {g.dosage}, {g.form} · общий объём {vol} уп.</p><GroupBadge status={g.status} /></div>
                  {sent ? <p className="text-sm text-ink-600">Ваше предложение отправлено и ждёт проверки импортёром.</p> : <GroupOfferForm groupId={g.id} maxVolume={vol} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <NotificationsPanel notes={notes} />
    </div>
  );
}
