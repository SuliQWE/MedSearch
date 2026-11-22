import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileWarning } from "lucide-react";
import { OffersList } from "@/components/OffersList";
import { sweepExpired } from "@/lib/actions";
import { MedicineImage } from "@/components/MedicineImage";
import { getMedicines } from "@/lib/catalog";
import { CATEGORIES, PHARMACIES } from "@/lib/seed";
import { searchMedicines } from "@/lib/search";
import { db } from "@/lib/store";

export default async function MedicinePage({ params }: { params: { id: string } }) {
  const MEDICINES = await getMedicines();
  const m = MEDICINES.find((x) => x.id === params.id);
  if (!m) notFound();
  await sweepExpired();
  const names = Object.fromEntries(PHARMACIES.map((p) => [p.id, p.name]));
  const stock = db().stock.filter((s) => s.medicineId === m.id);
  // Аналоги: то же действующее вещество, но другая позиция. Не считаются идентичными.
  const analogs = searchMedicines(m.inn, MEDICINES).filter((x) => x.id !== m.id && x.inn === m.inn);

  return (
    <div className="container-page space-y-6 py-6">
      <Link href="/catalog" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-ink-600 hover:text-brand-700"><ChevronLeft size={16} />Каталог</Link>
      <section className="card">
        <div className="flex items-start gap-4">{m.imageUrl && <MedicineImage src={m.imageUrl} alt={`${m.name} ${m.dosage}`} size={112} />}<h1 className="text-2xl font-bold">{m.name} <span className="font-normal text-ink-500">{m.dosage}</span></h1></div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-500">Действующее вещество</dt><dd className="font-medium">{m.inn}</dd></div>
          <div><dt className="text-ink-500">Форма выпуска</dt><dd className="font-medium">{m.form}</dd></div>
          <div><dt className="text-ink-500">Производитель</dt><dd className="font-medium">{m.manufacturer}</dd></div>
          <div><dt className="text-ink-500">Страна</dt><dd className="font-medium">{m.country}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-ink-600">{m.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.categories.map((c) => <Link key={c} href={`/catalog?cat=${c}`} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-brand-50">{CATEGORIES.find((x) => x.id === c)?.name}</Link>)}
        </div>
        {m.prescription && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900"><FileWarning size={18} className="mt-0.5 shrink-0" />Рецептурный препарат. Аптека проверит рецепт при выдаче; платформа не обходит рецептурные требования.</p>
        )}
        {!m.imageUrl && <p className="mt-3 text-xs text-ink-400">Упаковка: фото отсутствует.</p>}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Где купить</h2>
        <OffersList medicine={m} stock={stock} pharmacyNames={names} />
      </section>
      {analogs.length > 0 && (
        <section>
          <h2 className="mb-1 text-xl font-bold">Другие позиции с тем же веществом</h2>
          <p className="mb-3 text-sm text-ink-500">Это отдельные позиции (другая дозировка или форма), не полные аналоги. Уточняйте у врача или фармацевта.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {analogs.map((a) => <li key={a.id}><Link href={`/medicine/${a.id}`} className="card block hover:shadow-lift">{a.name} {a.dosage} · {a.form}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
