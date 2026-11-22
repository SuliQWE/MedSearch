import { CARGO_LABEL, CARGO_TONE, GROUP_LABEL, GROUP_TONE, SHIPMENT_LABEL } from "@/lib/status";
import type { CargoLineStatus, GroupStatus, ShipmentStatus } from "@/lib/types";

const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1";
export const GroupBadge = ({ status }: { status: GroupStatus }) => <span className={`${base} ${GROUP_TONE[status]}`}>{GROUP_LABEL[status]}</span>;
export const CargoBadge = ({ status }: { status: CargoLineStatus }) => <span className={`${base} ${CARGO_TONE[status]}`}>{CARGO_LABEL[status]}</span>;
export const ShipmentBadge = ({ status }: { status: ShipmentStatus }) => <span className={`${base} bg-ink-100 text-ink-700 ring-ink-200`}>{SHIPMENT_LABEL[status]}</span>;
