import Link from "next/link";
import { BuyerGlobalActions, GlobalRequestForm } from "@/components/GlobalForms";
import { ActionButton } from "@/components/ActionButton";
import { buyerGlobalDecide } from "@/lib/global-actions";
import { BRANCHES } from "@/lib/seed";
import { GlobalBadge } from "@/components/GlobalBadge";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { STORAGE_LABEL, formatDateTime, formatKgs } from "@/lib/status";

export const metadata = { title: "Международный заказ — MediFinder" };

export default function GlobalPage() {
  const u = currentUser();
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
                      {g.status === "buyer_confirmed" && chosen && <div className="rounded-xl bg-brand-50 p-3 text-sm"><p>Вы выбрали: <b>{formatKgs(chosen.pricePerPack)}</b> за упаковку · срок {chosen.leadTimeDays} дн.</p></div>}
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
