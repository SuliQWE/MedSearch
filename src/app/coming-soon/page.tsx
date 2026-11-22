import Link from "next/link";

export default function ComingSoon({ searchParams }: { searchParams: { role?: string } }) {
  const names: Record<string, string> = { supplier: "Поставщика", importer: "Импортёра", admin: "Администратора" };
  return (
    <div className="container-page max-w-xl py-16 text-center">
      <h1 className="text-2xl font-bold">Кабинет {names[searchParams.role ?? ""] ?? "этой роли"} в разработке</h1>
      <p className="mt-3 text-ink-600">Этот раздел ещё не реализован.</p>
      <Link href="/catalog" className="btn btn-primary mt-6">В каталог</Link>
    </div>
  );
}
