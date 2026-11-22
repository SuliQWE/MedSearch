import { CartClient } from "@/components/CartClient";
import { currentUser } from "@/lib/auth";
import { BRANCHES, MEDICINES, PHARMACIES } from "@/lib/seed";
import { sweepExpired } from "@/lib/actions";
import { db } from "@/lib/store";

export const metadata = { title: "Корзина — MediFinder" };

export default async function CartPage() {
  await sweepExpired();
  const u = currentUser();
  return (
    <div className="container-page py-6">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">Корзина</h1>
      <CartClient
        medicines={MEDICINES}
        branches={BRANCHES}
        stock={db().stock}
        pharmacyNames={Object.fromEntries(PHARMACIES.map((p) => [p.id, p.name]))}
        pharmacyOf={Object.fromEntries(BRANCHES.map((b) => [b.id, b.pharmacyId]))}
        isBuyer={u?.role === "buyer"}
      />
    </div>
  );
}
