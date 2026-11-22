import { STATUS_LABEL, STATUS_TONE } from "@/lib/status";
import type { OrderStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
