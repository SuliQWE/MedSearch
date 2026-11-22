import type { ActionResult } from "@/lib/types";

export function Msg({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <p role={r.ok ? "status" : "alert"} className={`text-sm ${r.ok ? "text-brand-700" : "text-red-700"}`}>{r.message}</p>;
}
