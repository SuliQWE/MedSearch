import Link from "next/link";
import { Boxes, Globe2, MapPin, Search, ShieldCheck, Users } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CATEGORIES, MEDICINES } from "@/lib/seed";

const STEPS = [
  { t: "Найдите", d: "Введите название или действующее вещество. Поиск простит опечатки." },
  { t: "Выберите аптеку", d: "Сравните цены и наличие, выберите ближайший филиал." },
  { t: "Отправьте заказ", d: "Аптека проверит наличие и подтвердит резерв." },
  { t: "Заберите", d: "Назовите номер заказа и оплатите прямо в аптеке." },
];

const SOON = [
  { icon: Users, t: "Group Orders", d: "Объединение спроса на одинаковый препарат (только при совпадении дозировки и формы)." },
  { icon: Boxes, t: "Cargo", d: "Разные препараты одного поставщика в одной отправке, с проверкой импортёром и выдачей в вашем городе." },
];

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-ink-50">
        <div className="container-page py-10 sm:py-16">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">Найдите лекарство рядом с вами</h1>
          <p className="mt-3 max-w-xl text-ink-600">Сравните цены и наличие в аптеках Кыргызстана и зарезервируйте с самовывозом.</p>
          <form action="/catalog" className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input name="q" className="input min-h-[52px] pl-10 text-base" placeholder="Например: парацетамол" aria-label="Поиск лекарств" />
            </div>
            <button className="btn btn-primary min-h-[52px] px-6">Найти</button>
          </form>
        </div>
      </section>

      <div className="container-page space-y-14 pt-8">
        <section>
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">Категории</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <li key={c.id}><Link href={`/catalog?cat=${c.id}`} className="card flex min-h-[56px] items-center gap-3 p-3 text-sm font-medium transition hover:shadow-lift sm:p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><CategoryIcon name={c.icon} /></span>{c.name}
              </Link></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-400">Категории нужны для навигации и не являются медицинской рекомендацией.</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">Часто ищут</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MEDICINES.slice(0, 4).map((m) => (
              <li key={m.id}><Link href={`/medicine/${m.id}`} className="card block transition hover:shadow-lift"><p className="font-semibold">{m.name}</p><p className="text-sm text-ink-500">{m.dosage} · {m.form}</p></Link></li>
            ))}
          </ul>
        </section>

        <section className="card flex flex-col gap-3 bg-brand-700 text-white ring-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><MapPin className="mt-1 shrink-0" /><div><h2 className="text-lg font-bold">Ближайшая аптека, где товар действительно есть</h2><p className="text-sm text-brand-100">Мы показываем не просто ближайшую точку, а ближайшую с наличием. Геолокация включается только по вашему согласию.</p></div></div>
          <Link href="/catalog" className="btn bg-white text-brand-800 hover:bg-brand-50">Открыть каталог</Link>
        </section>

        <section id="global">
          <h2 className="mb-1 text-xl font-bold sm:text-2xl">Международные заказы</h2>
          <p className="mb-4 text-sm text-ink-500">Global доступен в демо. Остальные направления пока не реализованы.</p>
          <ul className="grid gap-3 md:grid-cols-3">
            <li className="card"><Globe2 className="text-brand-600" /><h3 className="mt-2 font-semibold">Global: международные заявки</h3><p className="mt-1 text-sm text-ink-600">Заявка на препарат, которого нет в Кыргызстане, даже на одну упаковку. Ввоз возможен только после проверки импортёром.</p><Link href="/global" className="btn btn-primary mt-3">Подать заявку</Link></li>
            {SOON.map((s) => <li key={s.t} className="card opacity-90"><s.icon className="text-brand-600" /><h3 className="mt-2 font-semibold">{s.t}</h3><p className="mt-1 text-sm text-ink-600">{s.d}</p><span className="mt-3 inline-block rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-600">В разработке</span></li>)}
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">Как это работает</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => <li key={s.t} className="card"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span><h3 className="mt-2 font-semibold">{s.t}</h3><p className="mt-1 text-sm text-ink-600">{s.d}</p></li>)}
          </ol>
        </section>

        <section className="card flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-brand-600" /><p className="text-sm text-ink-600">MediFinder — посредник между покупателями и аптеками. Лекарства продаёт и выдаёт аптека. Для рецептурных препаратов действуют требования аптеки; платформа не обходит их. Попробуйте демо: <Link href="/login" className="font-semibold text-brand-700 underline">войти</Link>.</p></section>
      </div>
    </>
  );
}
