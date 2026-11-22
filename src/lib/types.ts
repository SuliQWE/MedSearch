export type Role = "buyer" | "pharmacy" | "supplier" | "importer" | "admin";

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  pharmacyId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Medicine {
  id: string;
  name: string;
  inn: string; // действующее вещество
  dosage: string;
  form: string;
  manufacturer: string;
  country: string;
  description: string;
  categories: string[];
  synonyms: string[];
  prescription: boolean;
  imageUrl?: string; // ссылка на картинку упаковки (Supabase Storage)
}

export interface Pharmacy {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  pharmacyId: string;
  name: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  hours: string;
}

export interface Stock {
  branchId: string;
  medicineId: string;
  price: number;
  qty: number;
  updatedAt: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "qty_proposed"
  | "ready"
  | "issued"
  | "cancelled"
  | "expired";

export interface OrderItem {
  medicineId: string;
  qty: number;
  price: number;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  by: string;
}

export interface Order {
  id: string;
  number: string;
  buyerId: string;
  branchId: string;
  items: OrderItem[];
  proposedQty?: Record<string, number>;
  status: OrderStatus;
  reserved: boolean;
  reserveUntil?: string;
  createdAt: string;
  history: StatusEvent[];
}

export interface CartItem {
  medicineId: string;
  branchId: string;
  qty: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  text: string;
  at: string;
  read: boolean;
}

export interface Location {
  lat: number;
  lng: number;
  city: string;
  label: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

/* ---------- Global: индивидуальные заявки на препарат, которого нет в Кыргызстане ---------- */
export type GlobalStatus =
  | "new" // заявка создана, ждёт предложений поставщиков
  | "offered" // есть предложение поставщика, ждёт проверки импортёром
  | "importer_approved" // импортёр проверил: ввоз возможен, ждёт решения покупателя
  | "importer_rejected" // импортёр отказал (причина в заметке)
  | "buyer_confirmed" // покупатель подтвердил условия
  | "buyer_declined"
  | "cancelled";

export interface GlobalOffer {
  id: string;
  supplierId: string;
  pricePerPack: number; // сом, ориентировочная цена (демо-значение)
  leadTimeDays: number;
  note: string;
  importerDecision?: "approved" | "rejected";
  importerNote?: string;
}

export interface GlobalRequest {
  id: string;
  number: string;
  buyerId: string;
  medicineName: string;
  dosage: string;
  form: string;
  qty: number; // можно 1 упаковку
  comment: string;
  prescriptionAck: boolean; // покупатель понимает: рецептурные требования не обходятся
  storage?: StorageClass; // условия хранения (из бывшего Cargo)
  prescription?: boolean; // рецептурный препарат
  branchId?: string; // желаемая точка выдачи
  chosenOfferId?: string; // предложение, которое выбрал покупатель
  status: GlobalStatus;
  offers: GlobalOffer[];
  createdAt: string;
  history: { status: GlobalStatus; at: string; by: string }[];
}

/* ---------- Group Orders: общий спрос на один и тот же препарат ---------- */
// Группа объединяет покупателей только при совпадении препарата, дозировки и формы выпуска.
export type GroupStatus = "open" | "offered" | "approved" | "completed" | "closed" | "cancelled";

export interface GroupMember {
  buyerId: string;
  qty: number;
  joinedAt: string;
  confirmation: "pending" | "confirmed" | "declined"; // отдельное подтверждение каждого покупателя
}

export interface GroupOffer {
  id: string;
  supplierId: string;
  minVolume: number; // предложение действует, если общий объём группы не меньше этого значения
  pricePerPack: number; // сом, ориентир (демо-значение)
  leadTimeDays: number;
  note: string;
  importerDecision?: "approved" | "rejected";
  importerNote?: string;
}

export interface GroupOrder {
  id: string;
  number: string;
  key: string; // нормализованные препарат|дозировка|форма
  medicineName: string;
  dosage: string;
  form: string;
  status: GroupStatus;
  deadline: string; // до какой даты набираются участники
  members: GroupMember[];
  offers: GroupOffer[];
  createdAt: string;
  history: { status: GroupStatus; at: string; by: string; note?: string }[];
}

/* ---------- Cargo: сборные отправки с разными препаратами ---------- */
export type StorageClass = "room" | "cool" | "frozen";

export type CargoLineStatus =
  | "requested" // заказ создан, ждёт проверки импортёром
  | "verified" // импортёр проверил возможность ввоза
  | "declined" // импортёр отказал (причина в заметке)
  | "in_shipment" // включён в отправку
  | "in_transit"
  | "arrived" // отправка прибыла
  | "ready_for_pickup" // распределено по точке выдачи
  | "issued"
  | "cancelled";

export interface CargoLine {
  id: string;
  number: string;
  buyerId: string; // у каждого покупателя своя запись внутри общей отправки
  medicineName: string;
  dosage: string;
  form: string;
  qty: number; // можно 1 упаковку
  storage: StorageClass;
  prescription: boolean;
  prescriptionAck: boolean;
  branchId: string; // желаемая точка выдачи
  altBranchId?: string; // альтернативная точка, только с согласия покупателя
  altStatus?: "proposed" | "accepted" | "declined";
  shipmentId?: string;
  status: CargoLineStatus;
  importerNote?: string;
  createdAt: string;
  history: { status: CargoLineStatus; at: string; by: string }[];
}

export type ShipmentStatus = "forming" | "in_transit" | "arrived" | "closed";

export interface Shipment {
  id: string;
  number: string;
  storage: StorageClass; // одна логистическая группа на отправку
  status: ShipmentStatus;
  createdAt: string;
  history: { status: ShipmentStatus; at: string; by: string }[];
}
