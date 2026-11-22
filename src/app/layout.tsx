import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/store";

export const metadata: Metadata = {
  title: "MediFinder — поиск лекарств в Кыргызстане",
  description: "Найдите лекарство в аптеках рядом, сравните цены и зарезервируйте. Демо-версия: все данные тестовые.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const user = currentUser();
  const unread = user ? db().notifications.filter((n) => n.userId === user.id && !n.read).length : 0;
  return (
    <html lang="ru">
      <body>
        <Providers>
          <Header user={user} unread={unread} />
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            Демо-версия: аптеки, цены и остатки — тестовые и не отражают реальные данные.
          </div>
          <main>{children}</main>
          <footer className="mt-16 border-t border-ink-100 bg-white py-8 text-sm text-ink-500">
            <div className="container-page flex flex-col gap-2 sm:flex-row sm:justify-between">
              <p>MediFinder — цифровая платформа-посредник. Не является аптекой, продавцом или импортёром.</p>
              <p>Информация не заменяет консультацию врача или фармацевта.</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
