import { redirect } from "next/navigation";
import { AdminReset } from "@/components/AdminReset";
import { DeleteMedicineButton, MedicineForm, SeedButton } from "@/components/MedicineAdmin";
import { MedicineImage } from "@/components/MedicineImage";
import { getCatalog } from "@/lib/catalog";
import { currentUser } from "@/lib/auth";
import { BRANCHES, CATEGORIES, DEMO_USERS, PHARMACIES } from "@/lib/seed";
import { db } from "@/lib/store";
import { CARGO_LABEL, GLOBAL_LABEL, GROUP_LABEL, STATUS_LABEL } from "@/lib/status";

export const metadata = { title: "Кабинет администратора — MediFinder" };
const ROLE_NAME: Record<string, string> = { buyer: "Покупатель", pharmacy: "Аптека", supplier: "Поставщик", importer: "Импортёр", admin: "Администратор" };

function count<T extends string>(items: T[], labels: Record<T, string>) {
  const m = new Map<T, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return (Object.keys(labels) as T[]).map((k) => ({ label: labels[k], n: m.get(k) ?? 0 }));
}

// Аналитика только агрегатная: без имён, комментариев и иных персональных данных покупателей.
export default async function AdminPage() {
  const u = currentUser();
  if (!u || u.role !== "admin") redirect("/login");
  const d = db();
  const { medicines: MEDICINES, source, error } = await getCatalog();
  const blocks = [
    { title: "Заказы Local", rows: count(d.orders.map((o) => o.status), STATUS_LABEL) },
    { title: "Заявки Global", rows: count(d.globals.map((g) => g.status), GLOBAL_LABEL) },
    { title: "Группы Group Orders", rows: count(d.groups.map((g) => g.status), GROUP_LABEL) },
    { title: "Заказы Cargo", rows: count(d.cargoLines.map((l) => l.status), CARGO_LABEL) },
  ];
  const lowStock = d.stock.filter((s) => s.qty === 0).length;
  return (
    <div className="container-page space-y-8 py-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Кабинет администратора</h1><p className="text-sm text-ink-500">Демо. Аналитика агрегатная, без персональных данных покупателей. Все данные тестовые.</p></div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Препаратов в каталоге", MEDICINES.length], ["Аптек", PHARMACIES.length], ["Филиалов", BRANCHES.length], ["Позиций без остатка", lowStock]].map(([k, v]) => <div key={k as string} className="card py-3"><p className="text-2xl font-bold text-brand-700">{v}</p><p className="text-sm text-ink-600">{k}</p></div>)}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {blocks.map((b) => (
          <div key={b.title} className="card">
            <h2 className="mb-2 font-bold">{b.title}</h2>
            <ul className="space-y-1 text-sm">{b.rows.map((r) => <li key={r.label} className="flex justify-between gap-3"><span className="text-ink-600">{r.label}</span><b>{r.n}</b></li>)}</ul>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Аптеки и филиалы</h2>
        <ul className="space-y-2">{PHARMACIES.map((p) => <li key={p.id} className="card py-3 text-sm"><b>{p.name}</b><span className="ml-2 text-ink-500">{BRANCHES.filter((b) => b.pharmacyId === p.id).map((b) => `${b.city}, ${b.name}`).join("; ")}</span></li>)}</ul>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Каталог препаратов</h2>
        {source === "seed" ? (
          <div className="card space-y-1 border-l-4 border-amber-400 text-sm text-ink-700">
            <p className="font-semibold">Supabase не подключён: каталог берётся из тестового набора в коде и не редактируется.</p>
            {error && <p className="text-red-700">Ошибка подключения: {error}</p>}
            <p>Чтобы включить редактирование и загрузку картинок, выполните миграцию <code>supabase/migrations/0003_catalog.sql</code> и задайте переменные окружения (см. README).</p>
          </div>
        ) : (
          <>
            <div className="card space-y-3"><h3 className="font-bold">Добавить препарат</h3><MedicineForm categories={CATEGORIES} /></div>
            <ul className="space-y-2">
              {MEDICINES.map((m) => (
                <li key={m.id} className="card py-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                      <MedicineImage src={m.imageUrl} alt={`${m.name} ${m.dosage}`} size={44} />
                      <span><b>{m.name} {m.dosage}</b>, {m.form}{m.prescription && <span className="ml-2 text-xs text-amber-800">рецептурный</span>}</span>
                      <span className="ml-auto text-xs text-brand-700">Изменить</span>
                    </summary>
                    <div className="mt-4 space-y-3 border-t border-ink-100 pt-4"><MedicineForm categories={CATEGORIES} medicine={m} /><DeleteMedicineButton id={m.id} /></div>
                  </details>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3"><SeedButton /><p className="text-xs text-ink-500">Цену и остаток по препарату задаёт аптека в своём кабинете (раздел «Остатки и цены»).</p></div>
          </>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Демо-пользователи</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{DEMO_USERS.map((x) => <li key={x.id} className="card py-3 text-sm"><b>{ROLE_NAME[x.role]}</b><span className="ml-2 text-ink-500">{x.name}</span></li>)}</ul>
      </section>
      <section className="card space-y-2">
        <h2 className="font-bold">Управление демо-данными</h2>
        <p className="text-sm text-ink-600">Возвращает заказы, заявки, группы, отправки и уведомления к начальному состоянию.</p>
        <AdminReset />
      </section>
    </div>
  );
}
