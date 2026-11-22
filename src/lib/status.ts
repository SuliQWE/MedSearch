import type { OrderStatus } from "./types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждён аптекой",
  rejected: "Отклонён",
  qty_proposed: "Предложено изменение количества",
  ready: "Готов к получению",
  issued: "Выдан покупателю",
  cancelled: "Отменён",
  expired: "Истёк срок резерва",
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-brand-50 text-brand-800 ring-brand-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
  qty_proposed: "bg-sky-50 text-sky-800 ring-sky-200",
  ready: "bg-brand-100 text-brand-900 ring-brand-300",
  issued: "bg-ink-100 text-ink-700 ring-ink-200",
  cancelled: "bg-ink-100 text-ink-600 ring-ink-200",
  expired: "bg-ink-100 text-ink-600 ring-ink-200",
};

export const formatKgs = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} сом`;

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bishkek" }).format(new Date(iso));
}

import type { GlobalStatus } from "./types";
export const GLOBAL_LABEL: Record<GlobalStatus, string> = {
  new: "Ждёт предложений",
  offered: "Предложение на проверке у импортёра",
  importer_approved: "Проверено импортёром, ждёт вашего решения",
  importer_rejected: "Импортёр не подтвердил ввоз",
  buyer_confirmed: "Условия подтверждены, ждёт включения в отправку",
  in_shipment: "Включена в отправку",
  in_transit: "В пути",
  arrived: "Отправка прибыла",
  ready_for_pickup: "Готова к получению в точке выдачи",
  issued: "Выдана",
  buyer_declined: "Вы отказались",
  cancelled: "Отменена",
};
export const GLOBAL_TONE: Record<GlobalStatus, string> = {
  new: "bg-amber-50 text-amber-800 ring-amber-200",
  offered: "bg-sky-50 text-sky-800 ring-sky-200",
  importer_approved: "bg-brand-50 text-brand-800 ring-brand-200",
  importer_rejected: "bg-red-50 text-red-800 ring-red-200",
  buyer_confirmed: "bg-brand-100 text-brand-900 ring-brand-300",
  in_shipment: "bg-sky-50 text-sky-800 ring-sky-200",
  in_transit: "bg-sky-50 text-sky-800 ring-sky-200",
  arrived: "bg-brand-50 text-brand-800 ring-brand-200",
  ready_for_pickup: "bg-brand-100 text-brand-900 ring-brand-300",
  issued: "bg-ink-100 text-ink-700 ring-ink-200",
  buyer_declined: "bg-ink-100 text-ink-600 ring-ink-200",
  cancelled: "bg-ink-100 text-ink-600 ring-ink-200",
};

import type { CargoLineStatus, GroupStatus, ShipmentStatus, StorageClass } from "./types";

export const GROUP_LABEL: Record<GroupStatus, string> = {
  open: "Идёт набор участников",
  offered: "Предложение на проверке у импортёра",
  approved: "Проверено, ждёт подтверждения участников",
  completed: "Завершена",
  closed: "Закрыта",
  cancelled: "Отменена",
};
export const GROUP_TONE: Record<GroupStatus, string> = {
  open: "bg-amber-50 text-amber-800 ring-amber-200",
  offered: "bg-sky-50 text-sky-800 ring-sky-200",
  approved: "bg-brand-50 text-brand-800 ring-brand-200",
  completed: "bg-brand-100 text-brand-900 ring-brand-300",
  closed: "bg-ink-100 text-ink-600 ring-ink-200",
  cancelled: "bg-ink-100 text-ink-600 ring-ink-200",
};

export const CARGO_LABEL: Record<CargoLineStatus, string> = {
  requested: "Ждёт проверки импортёром",
  verified: "Проверено, ждёт включения в отправку",
  declined: "Импортёр не подтвердил ввоз",
  in_shipment: "Включено в отправку",
  in_transit: "В пути",
  arrived: "Отправка прибыла",
  ready_for_pickup: "Готово к получению в точке выдачи",
  issued: "Выдано",
  cancelled: "Отменено",
};
export const CARGO_TONE: Record<CargoLineStatus, string> = {
  requested: "bg-amber-50 text-amber-800 ring-amber-200",
  verified: "bg-sky-50 text-sky-800 ring-sky-200",
  declined: "bg-red-50 text-red-800 ring-red-200",
  in_shipment: "bg-sky-50 text-sky-800 ring-sky-200",
  in_transit: "bg-sky-50 text-sky-800 ring-sky-200",
  arrived: "bg-brand-50 text-brand-800 ring-brand-200",
  ready_for_pickup: "bg-brand-100 text-brand-900 ring-brand-300",
  issued: "bg-ink-100 text-ink-700 ring-ink-200",
  cancelled: "bg-ink-100 text-ink-600 ring-ink-200",
};
export const SHIPMENT_LABEL: Record<ShipmentStatus, string> = { forming: "Формируется", in_transit: "В пути", arrived: "Прибыла", closed: "Закрыта" };

// Логистические группы: препараты с разными условиями хранения в одну отправку не объединяются.
export const STORAGE_LABEL: Record<StorageClass, string> = { room: "Комнатная температура (15–25 °C)", cool: "Холод (2–8 °C)", frozen: "Заморозка (ниже −15 °C)" };

// ДЕМО-ТАРИФЫ (не реальные расценки): ставка за упаковку по классу хранения и общий сбор на отправку.
export const CARGO_RATE_PER_PACK: Record<StorageClass, number> = { room: 30, cool: 90, frozen: 150 };
export const CARGO_SHARED_FEE = 300;
