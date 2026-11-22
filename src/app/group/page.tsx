import Link from "next/link";
import { GroupBadge } from "@/components/Badges";
import { GroupJoinForm, GroupMemberActions } from "@/components/GroupForms";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { formatDateTime, formatKgs } from "@/lib/status";

export const metadata = { title: "Group Orders — совместный спрос — MediFinder" };

export default function GroupPage() {
  const u = currentUser();
  const all = db().groups;
  const mine = u?.role === "buyer" ? all.filter((g) => g.members.some((m) => m.buyerId === u.id)) : [];
  const openGroups = all.filter((g) => g.status === "open" && new Date(g.deadline).getTime() > Date.now());
  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Group Orders: общий спрос на один препарат</h1>
        <p className="mt-2 max-w-3xl text-ink-600">Покупатели с одинаковой потребностью объединяются в группу. Группа формируется только при совпадении препарата, дозировки и формы выпуска. Поставщик видит лишь общий объём, а каждый участник подтверждает условия отдельно. MediFinder — посредник и ничего не продаёт и не ввозит.</p>
      </div>
      {!u && <div className="card"><p>Чтобы участвовать, войдите как покупатель.</p><Link href="/login" className="btn btn-primary mt-3">Войти в демо</Link></div>}
      {u && u.role !== "buyer" && <div className="card text-ink-600">Участвовать может только покупатель. Ваш кабинет доступен через шапку сайта.</div>}
      <section>
        <h2 className="mb-3 text-xl font-bold">Открытые группы (обезличено)</h2>
        {openGroups.length === 0 ? <div className="card text-ink-600">Открытых групп пока нет.</div> : (
          <ul className="grid gap-2 sm:grid-cols-2">{openGroups.map((g) => <li key={g.id} className="card py-3 text-sm"><b>{g.medicineName} {g.dosage}, {g.form}</b><span className="ml-2 text-ink-500">участников {g.members.length}, всего {g.members.reduce((s, m) => s + m.qty, 0)} уп., набор до {formatDateTime(g.deadline)}</span></li>)}</ul>
        )}
      </section>
      {u?.role === "buyer" && (
        <>
          <GroupJoinForm />
          <section>
            <h2 className="mb-3 text-xl font-bold">Мои группы</h2>
            {mine.length === 0 ? <div className="card text-ink-600">Вы пока не участвуете ни в одной группе.</div> : (
              <ul className="space-y-3">
                {mine.map((g) => {
                  const me = g.members.find((m) => m.buyerId === u.id)!;
                  const approved = g.offers.find((o) => o.importerDecision === "approved");
                  return (
                    <li key={g.id} className="card space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{g.number} · {g.medicineName} {g.dosage}, {g.form}</p><p className="text-xs text-ink-500">Мои упаковки: {me.qty} · всего в группе {g.members.reduce((s, m) => s + m.qty, 0)} · участников {g.members.length} · набор до {formatDateTime(g.deadline)}</p></div><GroupBadge status={g.status} /></div>
                      {approved && ["approved", "completed"].includes(g.status) && (
                        <div className="rounded-xl bg-brand-50 p-3 text-sm"><p><b>{formatKgs(approved.pricePerPack)}</b> за упаковку (ориентир, демо-значение) · от {approved.minVolume} уп. · срок {approved.leadTimeDays} дн.</p>{approved.note && <p>Условия: {approved.note}</p>}{approved.importerNote && <p>Заметка импортёра: {approved.importerNote}</p>}<p className="mt-1 text-xs text-ink-500">Ваше решение: {me.confirmation === "pending" ? "ещё не принято" : me.confirmation === "confirmed" ? "подтверждено" : "отказ"}. Подтверждение не является обязательством по ввозу.</p></div>
                      )}
                      {g.history.filter((h) => h.note).slice(-2).map((h, i) => <p key={i} className="text-xs text-ink-500">{formatDateTime(h.at)}: {h.note}</p>)}
                      <GroupMemberActions id={g.id} canDecide={g.status === "approved" && me.confirmation === "pending"} canLeave={g.status === "open" || g.status === "offered"} />
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
