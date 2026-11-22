"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, LogIn, LogOut, Menu, Pill, ShoppingBag, X } from "lucide-react";
import { useApp } from "./Providers";
import { logout } from "@/lib/actions";
import type { DemoUser } from "@/lib/types";

const ROLE_HOME: Record<string, string> = { buyer: "/account", pharmacy: "/pharmacy", supplier: "/supplier", importer: "/importer", admin: "/admin" };

export function Header({ user, unread }: { user: DemoUser | null; unread: number }) {
  const { cart } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const nav = [
    { href: "/catalog", label: "Каталог" },
    { href: "/global", label: "Международный заказ" },
  ];

  async function doLogout() {
    await logout();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-800" aria-label="MediFinder, на главную">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><Pill size={20} strokeWidth={2} /></span>
          <span className="text-lg">MediFinder</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-ink-100 ${path === n.href ? "text-brand-700" : "text-ink-600"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/cart" className="relative grid h-11 w-11 place-items-center rounded-xl text-ink-700 hover:bg-ink-100" aria-label={`Корзина, товаров: ${count}`}>
            <ShoppingBag size={20} />
            <AnimatePresence>
              {count > 0 && (
                <motion.span key={count} initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          {user && (
            <Link href={user.role === "buyer" ? "/account#notifications" : ROLE_HOME[user.role] ?? "/coming-soon"} className="relative grid h-11 w-11 place-items-center rounded-xl text-ink-700 hover:bg-ink-100" aria-label={`Уведомления, непрочитанных: ${unread}`}>
              <Bell size={20} />
              {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
            </Link>
          )}
          {user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link href={ROLE_HOME[user.role] ?? "/coming-soon"} className="btn btn-secondary">{user.name}</Link>
              <button onClick={doLogout} className="grid h-11 w-11 place-items-center rounded-xl text-ink-600 hover:bg-ink-100" aria-label="Выйти"><LogOut size={18} /></button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary hidden md:inline-flex"><LogIn size={16} />Войти</Link>
          )}
          <button onClick={() => setOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-xl text-ink-700 hover:bg-ink-100 md:hidden" aria-expanded={open} aria-label={open ? "Закрыть меню" : "Открыть меню"}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-ink-100 bg-white md:hidden">
            <div className="container-page flex flex-col gap-1 py-3">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex min-h-[48px] items-center rounded-xl px-3 font-medium text-ink-800 hover:bg-ink-50">{n.label}</Link>
              ))}
              {user ? (
                <>
                  <Link href={ROLE_HOME[user.role] ?? "/coming-soon"} onClick={() => setOpen(false)} className="flex min-h-[48px] items-center rounded-xl px-3 font-medium hover:bg-ink-50">Кабинет: {user.name}</Link>
                  <button onClick={doLogout} className="flex min-h-[48px] items-center rounded-xl px-3 text-left font-medium text-ink-600 hover:bg-ink-50">Выйти</button>
                </>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-primary mt-1">Войти в демо</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
