import { redirect } from "next/navigation";
import { OfferForm } from "@/components/GlobalForms";
import { GlobalBadge } from "@/components/GlobalBadge";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { STORAGE_LABEL, formatDateTime, formatKgs } from "@/lib/status";
import type { GlobalRequest } from "@/lib/types";

export const metadata = { title: "Кабинет поставщика — MediFinder" };

// Одинаковые препараты (название + дозировка + форма) сворачиваются в одну карточку.
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const keyOf = (g: GlobalRequest) => `${norm(g.medicineName)}|${norm(g.dosage).replace(/,/g, ".").replace(/\s/g, "")}|${norm(g.form)}`;

// Поставщик видит все международные заказы в одном списке и принимает любые, какие может поставить.
// Покупатели обезличены: ни имён, ни комментариев.
export default function SupplierPage() {
  const u = currentUser();
  if (!u || u.role !== "supplier") redirect("/login");
  const all = db().globals;
  const open = all.filter((g) => ["new", "offered", "importer_approved"].includes(g.status));
  const mineOffers = all.flatMap((g) => g.offers.filter((o) => o.supplierId === u.id).map((o) => ({ g, o })));
  const handed = all.filter((g) => g.chosenOfferId && g.offers.some((o) => o.id === g.chosenOfferId && o.supplierId === u.id));
  const notes = db().notifications.filter((n) => n.userId === u.id).slice(0, 10);

  const bucket = new Map<string, GlobalRequest[]>();
  for (const g of open) bucket.set(keyOf(g), [...(bucket.get(keyOf(g)) ?? []), g]);
  const cards = [...bucket.values()].map((list) => ({ head: list[0], list, total: list.reduce((s, g) => s + g.qty, 0) }));

  return (
    <div className="container-page space-y-8 py-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Кабинет поставщика</h1><p className="text-sm text-ink-500">Демо. Персональные данные покупателей вам не передаются.</p></div>
      <section>
        <h2 className="mb-1 text-xl font-bold">Международные заказы ({open.length})</h2>
        <p className="mb-3 text-sm text-ink-600">Все заказы в одном списке. Выберите те, которые можете поставить, и отправьте предложение. Одинаковые препараты объединены в одну карточку.</p>
        {cards.length === 0 ? <div className="card text-ink-600">Открытых заказов нет.</div> : (
          <ul className="space-y-3">
            {cards.map(({ head, list, total }) => (
              <li key={keyOf(head)} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{head.medicineName} {head.dosage}, {head.form}</p>
                  <span className="text-sm text-ink-600">всего {total} уп. · заказов {list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.map((g) => {
                    const mine = g.offers.find((o) => o.supplierId === u.id && o.importerDecision !== "rejected");
                    return (
                      <li key={g.id} className="rounded-xl bg-ink-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{g.number} · {g.qty} уп. · {formatDateTime(g.createdAt)}{g.storage && ` · ${STORAGE_LABEL[g.storage]}`}{g.prescription && " · рецептурный"}</span>
                          <GlobalBadge status={g.status} />
                        </div>
                        {mine ? <p className="mt-2 text-ink-600">{mine.importerDecision === "approved" ? "Ваше предложение одобрено импортёром, ждём выбора покупателя." : "Ваше предложение отправлено и ждёт проверки импортёром."}</p> : (
                          <details className="mt-2">
                            <summary className="cursor-pointer font-medium text-brand-700">Могу поставить</summary>
                            <div className="mt-2"><OfferForm requestId={g.id} /></div>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-1 text-xl font-bold">Заказы, переданные вам ({handed.length})</h2>
        <p className="mb-3 text-sm text-ink-600">Покупатель выбрал ваше предложение. Дальше заказ ведёт импортёр, статус обновляется автоматически.</p>
        {handed.length === 0 ? <div className="card text-ink-600">Пока нет выбранных вам предложений.</div> : (
          <ul className="space-y-2">{handed.map((g) => <li key={g.id} className="card flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{g.number} · {g.medicineName} {g.dosage} × {g.qty}</span><GlobalBadge status={g.status} /></li>)}</ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Мои предложения</h2>
        {mineOffers.length === 0 ? <div className="card text-ink-600">Вы ещё не отправляли предложений.</div> : (
          <ul className="space-y-2">{mineOffers.map(({ g, o }) => <li key={o.id} className="card py-3 text-sm">{g.number} · {g.medicineName} {g.dosage} · {formatKgs(o.pricePerPack)} · {o.leadTimeDays} дн. · {g.chosenOfferId === o.id ? "выбрано покупателем" : g.chosenOfferId && o.importerDecision === "approved" ? "покупатель выбрал другое предложение" : o.importerDecision === "approved" ? "одобрено импортёром" : o.importerDecision === "rejected" ? "отклонено импортёром" : "на проверке"}</li>)}</ul>
        )}
      </section>
      <NotificationsPanel notes={notes} />
    </div>
  );
}
