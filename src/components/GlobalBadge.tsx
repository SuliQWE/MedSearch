import { GLOBAL_LABEL, GLOBAL_TONE } from "@/lib/status";
import type { GlobalStatus } from "@/lib/types";
export function GlobalBadge({ status }: { status: GlobalStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${GLOBAL_TONE[status]}`}>{GLOBAL_LABEL[status]}</span>;
}
