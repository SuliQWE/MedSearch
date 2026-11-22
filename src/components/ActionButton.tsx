"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/types";

export function ActionButton({ action, children, variant = "secondary", confirm }: { action: () => Promise<ActionResult>; children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; confirm?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);

  function run() {
    if (pending) return;
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const r = await action();
      setMsg(r);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col">
      <button className={`btn btn-${variant}`} onClick={run} disabled={pending}>{pending ? "Подождите…" : children}</button>
      {msg && !msg.ok && <span role="alert" className="mt-1 max-w-[220px] text-xs text-red-700">{msg.message}</span>}
    </span>
  );
}
