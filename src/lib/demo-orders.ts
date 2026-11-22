import { DEMO_USERS } from "./seed";
import { db, nextNumber, notify, persist } from "./store";
import type { GlobalOffer, GlobalRequest, GlobalStatus, Order, OrderStatus, Shipment } from "./types";

// ВСЕ ДАННЫЕ ТЕСТОВЫЕ. Препараты в каталоге не создаются: локальные заказы берут уже существующие позиции склада.
const MARK = "[демо]";
const HOUR = 3_600_000;
const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

export interface FillResult { ok: boolean; message: string }

/** Заполняет локальные заказы и международные заказы тестовыми данными. Повторный запуск ничего не дублирует. */
export function fillDemoOrders(): FillResult {
  const d = db();
  if (d.globals.some((g) => g.comment.startsWith(MARK))) return { ok: false, message: "Демо-заказы уже добавлены. Сначала сбросьте демо-данные." };
  const buyer = DEMO_USERS.find((u) => u.role === "buyer")!;
  const sup = DEMO_USERS.find((u) => u.role === "supplier")!;
  const imp = DEMO_USERS.find((u) => u.role === "importer")!;

  /* ---------- Local: заказы в аптеки по существующим остаткам ---------- */
  const stock = d.stock.filter((s) => s.qty > 0);
  const statuses: OrderStatus[] = ["pending", "pending", "confirmed", "ready", "issued", "rejected", "qty_proposed", "cancelled", "expired", "ready"];
  let localCount = 0;
  statuses.forEach((status, i) => {
    const s = stock[i % Math.max(stock.length, 1)];
    if (!s) return;
    const qty = Math.min(s.qty, 1 + (i % 3));
    const created = ago(2 + i * 7);
    const history = [{ status: "pending" as OrderStatus, at: created, by: buyer.id }];
    if (status !== "pending") history.push({ status, at: ago(1 + i * 6), by: "u-pharm1" });
    const o: Order = {
      id: `o-demo-${i}-${Date.now()}`, number: nextNumber("MF"), buyerId: buyer.id, branchId: s.branchId,
      items: [{ medicineId: s.medicineId, qty, price: s.price }],
      proposedQty: status === "qty_proposed" ? { [s.medicineId]: Math.max(1, qty - 1) } : undefined,
      status, reserved: status === "confirmed" || status === "ready",
      reserveUntil: status === "confirmed" || status === "ready" ? new Date(Date.now() + 20 * HOUR).toISOString() : undefined,
      createdAt: created, history,
    };
    d.orders.push(o);
    localCount++;
  });

  /* ---------- Международные заказы: единый поток, статусы по всем этапам ---------- */
  // Первые три — один и тот же препарат от разных покупателей, поставщик увидит их одной карточкой.
  type Spec = { storage?: "room" | "cool" | "frozen"; rx?: boolean; branch?: string; chosen?: number; buyer: string; name: string; dosage: string; form: string; qty: number; status: GlobalStatus; offers?: Partial<GlobalOffer>[]; h: number; ship?: string; alt?: { branch: string; status: "proposed" | "accepted" | "declined" } };
  const specs: Spec[] = [
    { buyer: buyer.id, storage: "cool", rx: true, name: "Семаглутид", dosage: "1 мг", form: "Раствор для инъекций", qty: 2, status: "new", h: 5 },
    { buyer: "u-demo-b2", storage: "cool", rx: true, name: "Семаглутид", dosage: "1 мг", form: "Раствор для инъекций", qty: 1, status: "new", h: 9 },
    { buyer: "u-demo-b3", storage: "cool", rx: true, name: "семаглутид", dosage: "1мг", form: "раствор для инъекций", qty: 3, status: "new", h: 14 },
    { buyer: "u-demo-b2", name: "Эмпаглифлозин", dosage: "10 мг", form: "Таблетки", qty: 2, status: "new", h: 20 },
    { buyer: buyer.id, rx: true, branch: "b3", name: "Ривароксабан", dosage: "20 мг", form: "Таблетки", qty: 1, status: "offered", h: 30, offers: [{ supplierId: sup.id, pricePerPack: 3900, leadTimeDays: 14, note: "Доставка из ЕС (демо)" }] },
    { buyer: "u-demo-b3", storage: "cool", rx: true, name: "Адалимумаб", dosage: "40 мг", form: "Раствор для инъекций", qty: 1, status: "offered", h: 36, offers: [{ supplierId: "u-demo-s2", pricePerPack: 42000, leadTimeDays: 21, note: "Нужна холодовая цепь (демо)" }, { supplierId: sup.id, pricePerPack: 39500, leadTimeDays: 25, note: "" }] },
    { buyer: buyer.id, name: "Левотироксин", dosage: "100 мкг", form: "Таблетки", qty: 3, status: "importer_approved", h: 52, offers: [{ supplierId: sup.id, pricePerPack: 850, leadTimeDays: 10, note: "Без предоплаты (демо)", importerDecision: "approved", importerNote: "Ввоз возможен, рецепт потребуется при выдаче" }, { supplierId: "u-demo-s2", pricePerPack: 790, leadTimeDays: 16, note: "Оплата при получении (демо)", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: "u-demo-b2", storage: "cool", rx: true, name: "Дупилумаб", dosage: "300 мг", form: "Раствор для инъекций", qty: 1, status: "importer_rejected", h: 70, offers: [{ supplierId: sup.id, pricePerPack: 120000, leadTimeDays: 30, note: "", importerDecision: "rejected", importerNote: "Нет документов на ввоз" }] },
    { buyer: buyer.id, storage: "cool", rx: true, name: "Дулаглутид", dosage: "1,5 мг", form: "Раствор для инъекций", qty: 1, status: "buyer_confirmed", chosen: 0, h: 90, offers: [{ supplierId: sup.id, pricePerPack: 9800, leadTimeDays: 18, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: "u-demo-b3", rx: true, branch: "b4", name: "Тикагрелор", dosage: "90 мг", form: "Таблетки", qty: 2, status: "buyer_declined", h: 100, offers: [{ supplierId: sup.id, pricePerPack: 2700, leadTimeDays: 12, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    // После выбора предложения: отправка SH-A (холод) с двумя заявками одного класса, SH-B (комнатная) с альтернативной точкой на согласовании.
    { buyer: "u-demo-b2", storage: "cool", rx: true, name: "Лираглутид", dosage: "18 мг/3 мл", form: "Раствор для инъекций", qty: 1, status: "in_transit", chosen: 0, ship: "A", h: 80, offers: [{ supplierId: sup.id, pricePerPack: 11200, leadTimeDays: 20, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: "u-demo-b3", storage: "cool", rx: true, name: "Инсулин гларгин", dosage: "100 ЕД/мл", form: "Раствор для инъекций", qty: 2, status: "in_transit", chosen: 0, ship: "A", h: 78, offers: [{ supplierId: "u-demo-s2", pricePerPack: 4300, leadTimeDays: 20, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: buyer.id, name: "Дапаглифлозин", dosage: "10 мг", form: "Таблетки", qty: 1, status: "in_shipment", chosen: 0, ship: "B", alt: { branch: "b3", status: "proposed" }, h: 60, offers: [{ supplierId: sup.id, pricePerPack: 1900, leadTimeDays: 14, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: "u-demo-b2", name: "Лозартан", dosage: "50 мг", form: "Таблетки", qty: 3, status: "ready_for_pickup", chosen: 0, ship: "C", branch: "b2", h: 140, offers: [{ supplierId: "u-demo-s2", pricePerPack: 640, leadTimeDays: 12, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: buyer.id, name: "Метформин пролонгированный", dosage: "750 мг", form: "Таблетки", qty: 2, status: "issued", chosen: 0, ship: "C", branch: "b1", h: 200, offers: [{ supplierId: sup.id, pricePerPack: 520, leadTimeDays: 10, note: "", importerDecision: "approved", importerNote: "Проверено" }] },
    { buyer: buyer.id, name: "Апиксабан", dosage: "5 мг", form: "Таблетки", qty: 1, status: "cancelled", h: 120 },
  ];
  const mkShip = (storage: Shipment["storage"], status: Shipment["status"]): Shipment => ({ id: `sh-demo-${storage}-${Date.now()}`, number: nextNumber("SH"), storage, kind: "global", status, createdAt: ago(70), history: [{ status: "forming", at: ago(70), by: imp.id }, ...(status === "forming" ? [] : [{ status, at: ago(40), by: imp.id }])] });
  const ships: Record<string, Shipment> = { A: mkShip("cool", "in_transit"), B: mkShip("room", "forming"), C: mkShip("room", "closed") };
  d.shipments.unshift(...Object.values(ships));
  specs.forEach((sp, i) => {
    const created = ago(sp.h);
    const offers: GlobalOffer[] = (sp.offers ?? []).map((o, j) => ({ id: `of-demo-${i}-${j}`, supplierId: o.supplierId!, pricePerPack: o.pricePerPack!, leadTimeDays: o.leadTimeDays!, note: o.note ?? "", importerDecision: o.importerDecision, importerNote: o.importerNote }));
    const hist: GlobalRequest["history"] = [{ status: "new", at: created, by: sp.buyer }];
    if (sp.status !== "new") hist.push({ status: sp.status, at: ago(Math.max(1, sp.h - 6)), by: sp.status.startsWith("buyer") || sp.status === "cancelled" ? sp.buyer : imp.id });
    const r: GlobalRequest = {
      id: `g-demo-${i}-${Date.now()}`, number: nextNumber("GL"), buyerId: sp.buyer,
      medicineName: sp.name, dosage: sp.dosage, form: sp.form, qty: sp.qty,
      comment: `${MARK} тестовая заявка`, prescriptionAck: true, storage: sp.storage ?? "room", prescription: sp.rx ?? false, branchId: sp.branch ?? "b1", chosenOfferId: sp.chosen != null ? offers[sp.chosen]?.id : undefined, shipmentId: sp.ship ? ships[sp.ship].id : undefined, altBranchId: sp.alt?.branch, altStatus: sp.alt?.status, status: sp.status, offers, createdAt: created, history: hist,
    };
    d.globals.push(r);
  });
  d.globals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  d.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  notify(buyer.id, "Добавлены демо-заказы: локальные и международные в разных статусах.");
  notify(sup.id, "Добавлены демо-заявки: часть похожих заказов объединена в одну карточку.");
  notify(imp.id, "Добавлены демо-предложения, ждущие проверки.");
  persist();
  return { ok: true, message: `Добавлено: локальных заказов ${localCount}, международных ${specs.length}.` };
}
