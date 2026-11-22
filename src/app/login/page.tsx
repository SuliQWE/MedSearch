"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, ShieldCheck, ShoppingBag, Store, Truck, UserCog } from "lucide-react";
import { loginAs } from "@/lib/actions";
import { DEMO_USERS } from "@/lib/seed";

const ICON = { buyer: ShoppingBag, pharmacy: Store, supplier: Truck, importer: ShieldCheck, admin: UserCog } as const;
const ROLE_NAME = { buyer: "Покупатель", pharmacy: "Аптека", supplier: "Поставщик", importer: "Импортёр", admin: "Администратор" } as const;
const READY = new Set(["buyer", "pharmacy", "supplier", "importer", "admin"]);

export default function LoginPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function go(id: string) {
    if (pending) return;
    setErr(null);
    start(async () => {
      try {
        const to = await loginAs(id);
        router.push(to);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не удалось войти");
      }
    });
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Вход в демо</h1>
      <p className="mt-2 text-ink-600">Демо-аккаунты без пароля. Выберите роль, чтобы пройти сценарий. Для реальной эксплуатации потребуется настоящая авторизация (см. README).</p>
      {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {DEMO_USERS.map((u) => {
          const I = ICON[u.role] ?? Building2;
          const ready = READY.has(u.role);
          return (
            <li key={u.id}>
              <button onClick={() => go(u.id)} disabled={pending} className="card flex w-full items-center gap-3 text-left transition hover:shadow-lift disabled:opacity-60">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><I size={20} /></span>
                <span><span className="block font-semibold">{ROLE_NAME[u.role]}</span><span className="block text-sm text-ink-500">{u.name}{!ready && " · кабинет в разработке"}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
