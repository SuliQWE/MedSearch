import { CatalogClient } from "@/components/CatalogClient";
import { sweepExpired } from "@/lib/actions";
import { getMedicines } from "@/lib/catalog";
import { CATEGORIES, PHARMACIES } from "@/lib/seed";
import { db } from "@/lib/store";

export const metadata = { title: "Каталог — MediFinder" };

export default async function CatalogPage({ searchParams }: { searchParams: { q?: string; cat?: string } }) {
  await sweepExpired();
  const medicines = await getMedicines();
  const names = Object.fromEntries(PHARMACIES.map((p) => [p.id, p.name]));
  return (
    <div className="container-page py-6">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">Каталог лекарств</h1>
      <CatalogClient medicines={medicines} categories={CATEGORIES} stock={db().stock} pharmacyNames={names} initialQuery={searchParams.q ?? ""} initialCategory={searchParams.cat ?? ""} />
    </div>
  );
}
