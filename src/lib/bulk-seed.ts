import type {
  AppNotification, Branch, CargoLine, CargoLineStatus, GlobalOffer, GlobalRequest, GlobalStatus, GroupMember,
  GroupOrder, GroupStatus, Medicine, Order, OrderItem, OrderStatus, Shipment, ShipmentStatus, StatusEvent, Stock, StorageClass,
} from "./types";

// ВСЕ ДАННЫЕ, КОТОРЫЕ СОЗДАЁТ ЭТОТ ФАЙЛ, ТЕСТОВЫЕ. Производители, цены, остатки, заказы и покупатели вымышлены.
// Генератор детерминированный: при одинаковых настройках любой инстанс (в том числе холодный старт на Vercel) получает один и тот же набор.
// Включается переменной окружения BULK_SEED=1. Без неё код ничего не делает.

const num = (key: string, def: number, max: number): number => {
  const v = process.env[key];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : def;
};

export const bulkEnabled = (): boolean => process.env.BULK_SEED === "1";

export const bulkCounts = () => ({
  medicines: num("BULK_MEDICINES", 200, 2000),
  orders: num("BULK_ORDERS", 300, 3000),
  globals: num("BULK_GLOBALS", 30, 500),
  groups: num("BULK_GROUPS", 25, 300),
  cargo: num("BULK_CARGO", 60, 500),
});

/* ---------- утилиты ---------- */

type Rnd = () => number;
function rng(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: Rnd, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const chance = (r: Rnd, p: number) => r() < p;
const pick = <T,>(r: Rnd, a: T[]): T => a[Math.floor(r() * a.length)];
function shuffle<T>(r: Rnd, a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
function weighted<T>(r: Rnd, list: [T, number][]): T {
  const sum = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * sum;
  for (const [v, w] of list) { x -= w; if (x < 0) return v; }
  return list[list.length - 1][0];
}
const iso = (ms: number) => new Date(ms).toISOString();
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

/* ---------- препараты ---------- */

// [название, дозировки через "|", форма, категории, рецептурный (1/0), синонимы, ориентир цены в сомах (демо)]
type BaseRow = [string, string, string, string, 0 | 1, string, number];
const BASE: BaseRow[] = [
  ["Парацетамол", "200 мг", "Таблетки", "fever,pain,cold", 0, "paracetamol,панадол", 30],
  ["Парацетамол", "120 мг/5 мл", "Суспензия", "kids,fever", 0, "paracetamol,детский парацетамол", 95],
  ["Ибупрофен", "100 мг/5 мл", "Суспензия", "kids,fever,pain", 0, "ibuprofen,нурофен детский", 140],
  ["Диклофенак", "50 мг", "Таблетки", "pain,joints", 1, "diclofenac,вольтарен", 70],
  ["Диклофенак", "1%", "Гель", "joints,pain,skin", 0, "diclofenac gel,вольтарен гель", 210],
  ["Кеторолак", "10 мг", "Таблетки", "pain", 1, "ketorolac,кеторол", 65],
  ["Дротаверин", "40 мг", "Таблетки", "pain,stomach", 0, "drotaverine,но-шпа,но шпа", 55],
  ["Мелоксикам", "7,5 мг|15 мг", "Таблетки", "joints,pain", 1, "meloxicam,мовалис", 110],
  ["Глюкозамин + хондроитин", "500 мг + 500 мг", "Капсулы", "joints", 0, "glucosamine,хондроитин", 850],
  ["Лоратадин", "10 мг", "Таблетки", "allergy", 0, "loratadine,кларитин", 60],
  ["Хлоропирамин", "25 мг", "Таблетки", "allergy", 0, "chloropyramine,супрастин", 150],
  ["Дезлоратадин", "5 мг", "Таблетки", "allergy", 0, "desloratadine,эриус", 330],
  ["Цетиризин", "10 мг/мл", "Капли", "kids,allergy", 0, "cetirizine drops,цетрин капли", 190],
  ["Эзомепразол", "20 мг|40 мг", "Таблетки", "stomach", 0, "esomeprazole,нексиум", 380],
  ["Пантопразол", "20 мг|40 мг", "Таблетки", "stomach", 0, "pantoprazole,контролок", 290],
  ["Активированный уголь", "250 мг", "Таблетки", "stomach", 0, "activated charcoal,уголь", 25],
  ["Смектит диоктаэдрический", "3 г", "Порошок", "stomach,kids", 0, "smectite,смекта", 40],
  ["Лоперамид", "2 мг", "Капсулы", "stomach", 0, "loperamide,имодиум", 75],
  ["Метоклопрамид", "10 мг", "Таблетки", "stomach", 1, "metoclopramide,церукал", 50],
  ["Панкреатин", "10000 ЕД|25000 ЕД", "Капсулы", "stomach", 0, "pancreatin,мезим,креон", 260],
  ["Симетикон", "40 мг/мл", "Эмульсия", "kids,stomach", 0, "simethicone,эспумизан", 260],
  ["Лактулоза", "667 мг/мл", "Сироп", "stomach,kids", 0, "lactulose,дюфалак", 330],
  ["Азитромицин", "250 мг|500 мг", "Таблетки", "breath,cold", 1, "azithromycin,сумамед", 280],
  ["Амоксициллин + клавулановая кислота", "625 мг|1000 мг", "Таблетки", "breath,cold", 1, "amoxicillin clavulanate,амоксиклав,аугментин", 420],
  ["Цефиксим", "400 мг", "Капсулы", "breath", 1, "cefixime,супракс", 540],
  ["Ципрофлоксацин", "500 мг", "Таблетки", "kidney", 1, "ciprofloxacin,ципролет", 90],
  ["Метронидазол", "250 мг", "Таблетки", "stomach", 1, "metronidazole,трихопол", 45],
  ["Доксициклин", "100 мг", "Капсулы", "breath,skin", 1, "doxycycline,юнидокс", 110],
  ["Нитрофурантоин", "50 мг", "Таблетки", "kidney", 1, "nitrofurantoin,фурадонин", 95],
  ["Умифеновир", "100 мг", "Капсулы", "cold,immune", 0, "umifenovir,арбидол", 330],
  ["Ацикловир", "200 мг", "Таблетки", "skin,immune", 1, "acyclovir,зовиракс", 120],
  ["Ацикловир", "5%", "Мазь", "skin", 0, "acyclovir ointment,зовиракс мазь", 85],
  ["Флуконазол", "150 мг", "Капсулы", "skin,immune", 0, "fluconazole,дифлюкан", 140],
  ["Клотримазол", "1%", "Крем", "skin", 0, "clotrimazole,канестен", 160],
  ["Амброксол", "30 мг", "Таблетки", "breath,cold", 0, "ambroxol,лазолван", 80],
  ["Амброксол", "15 мг/5 мл", "Сироп", "breath,kids,cold", 0, "ambroxol syrup,лазолван сироп", 150],
  ["Ацетилцистеин", "600 мг", "Таблетки шипучие", "breath,cold", 0, "acetylcysteine,ацц", 280],
  ["Бромгексин", "8 мг", "Таблетки", "breath", 0, "bromhexine", 40],
  ["Ксилометазолин", "0,1%", "Спрей назальный", "cold,breath", 0, "xylometazoline,галазолин,отривин", 90],
  ["Оксиметазолин", "0,05%", "Спрей назальный", "cold,breath", 0, "oxymetazoline,назол", 110],
  ["Амлодипин", "5 мг|10 мг", "Таблетки", "heart", 1, "amlodipine,нормодипин", 60],
  ["Лизиноприл", "5 мг|10 мг|20 мг", "Таблетки", "heart", 1, "lisinopril,диротон", 70],
  ["Эналаприл", "5 мг|10 мг|20 мг", "Таблетки", "heart", 1, "enalapril,энап", 55],
  ["Периндоприл", "4 мг|8 мг", "Таблетки", "heart", 1, "perindopril,престариум", 260],
  ["Бисопролол", "5 мг|10 мг", "Таблетки", "heart", 1, "bisoprolol,конкор", 120],
  ["Метопролол", "50 мг|100 мг", "Таблетки", "heart", 1, "metoprolol,эгилок", 80],
  ["Лозартан", "50 мг|100 мг", "Таблетки", "heart", 1, "losartan,лозап", 130],
  ["Валсартан", "80 мг|160 мг", "Таблетки", "heart", 1, "valsartan,диован", 280],
  ["Аторвастатин", "10 мг|20 мг|40 мг", "Таблетки", "heart", 1, "atorvastatin,аторис", 220],
  ["Розувастатин", "10 мг|20 мг", "Таблетки", "heart", 1, "rosuvastatin,крестор", 320],
  ["Ацетилсалициловая кислота", "100 мг", "Таблетки", "heart", 0, "aspirin cardio,аспирин кардио", 75],
  ["Клопидогрел", "75 мг", "Таблетки", "heart", 1, "clopidogrel,плавикс", 290],
  ["Варфарин", "2,5 мг", "Таблетки", "heart", 1, "warfarin", 60],
  ["Фуросемид", "40 мг", "Таблетки", "heart,kidney", 1, "furosemide,лазикс", 30],
  ["Торасемид", "5 мг|10 мг", "Таблетки", "heart,kidney", 1, "torasemide,диувер", 180],
  ["Индапамид", "1,5 мг|2,5 мг", "Таблетки", "heart,kidney", 1, "indapamide,арифон", 120],
  ["Спиронолактон", "25 мг|50 мг", "Таблетки", "heart,kidney", 1, "spironolactone,верошпирон", 140],
  ["Нитроглицерин", "0,5 мг", "Таблетки сублингвальные", "heart", 1, "nitroglycerin", 85],
  ["Колекальциферол (витамин D3)", "1000 МЕ|2000 МЕ", "Капсулы", "vitamins,immune", 0, "vitamin d3,витамин д3,холекальциферол", 350],
  ["Магния лактат + пиридоксин", "470 мг + 5 мг", "Таблетки", "vitamins,nerves", 0, "magnesium b6,магний б6,магне б6", 240],
  ["Фолиевая кислота", "1 мг", "Таблетки", "vitamins", 0, "folic acid", 35],
  ["Кальция карбонат + колекальциферол", "500 мг + 200 МЕ", "Таблетки жевательные", "vitamins,joints", 0, "calcium d3,кальций д3", 380],
  ["Железа (III) гидроксид полимальтозат", "100 мг", "Таблетки жевательные", "vitamins", 0, "мальтофер,феррум лек", 420],
  ["Глицин", "100 мг", "Таблетки подъязычные", "nerves", 0, "glycine", 50],
  ["Валериана", "30 мг", "Таблетки", "nerves", 0, "valerian,валерьянка", 30],
  ["Перекись водорода", "3%", "Раствор", "antiseptic,skin", 0, "hydrogen peroxide,перекись", 20],
  ["Бриллиантовый зелёный", "1%", "Раствор", "antiseptic,skin", 0, "зелёнка,зеленка,brilliant green", 25],
  ["Йод", "5%", "Раствор спиртовой", "antiseptic", 0, "iodine", 25],
  ["Повидон-йод", "10%", "Раствор", "antiseptic,skin", 0, "povidone iodine,бетадин", 230],
  ["Мирамистин", "0,01%", "Раствор", "antiseptic,cold", 0, "miramistin", 330],
  ["Декспантенол", "5%", "Крем", "skin", 0, "dexpanthenol,пантенол,бепантен", 290],
  ["Цинка оксид", "10%", "Мазь", "skin", 0, "zinc ointment,цинковая мазь", 45],
  ["Тобрамицин", "0,3%", "Капли глазные", "eyes", 1, "tobramycin,тобрекс", 290],
  ["Тетризолин", "0,05%", "Капли глазные", "eyes", 0, "tetryzoline,визин", 130],
  ["Гиалуронат натрия", "0,1%|0,15%", "Капли глазные", "eyes", 0, "hyaluronate,искусственная слеза", 420],
  ["Урсодезоксихолевая кислота", "250 мг", "Капсулы", "liver", 1, "ursodeoxycholic acid,урсосан", 650],
  ["Эссенциальные фосфолипиды", "300 мг", "Капсулы", "liver", 0, "essential phospholipids,эссенциале", 620],
];

const mKey = (name: string, dosage: string, form: string) => `${name}|${dosage}|${form}`.toLowerCase();

interface Combo { name: string; dosage: string; form: string; cats: string[]; rx: boolean; syn: string[]; price: number; doseIdx: number }

function combos(existing: Medicine[]): Combo[] {
  const taken = new Set(existing.map((m) => mKey(m.name, m.dosage, m.form)));
  const out: Combo[] = [];
  for (const [name, doses, form, cats, rx, syn, price] of BASE)
    doses.split("|").forEach((dosage, doseIdx) => {
      if (taken.has(mKey(name, dosage, form))) return;
      out.push({ name, dosage, form, cats: cats.split(","), rx: rx === 1, syn: syn.split(","), price, doseIdx });
    });
  return out;
}

/** Тестовые препараты с id s-0001, s-0002, ... Позиции из `existing` (seed.ts) пропускаются. Повторы идут как «другой тестовый производитель». */
export function genMedicines(count: number, existing: Medicine[] = []): Medicine[] {
  const list = shuffle(rng(1001), combos(existing));
  const out: Medicine[] = [];
  for (let i = 0; i < count && list.length > 0; i++) {
    const c = list[i % list.length];
    const round = Math.floor(i / list.length);
    out.push({
      id: `s-${pad(i + 1, 4)}`, name: c.name, inn: c.name, dosage: c.dosage, form: c.form,
      manufacturer: round === 0 ? "Тестовый производитель" : `Тестовый производитель №${round + 1}`,
      country: "—",
      description: "Тестовое описание (демо-данные). Не является медицинской информацией.",
      categories: c.cats, synonyms: c.syn, prescription: c.rx,
    });
  }
  return out;
}

const priceOf = (m: Medicine): number => {
  const c = combos([]).find((x) => x.name === m.name && x.dosage === m.dosage && x.form === m.form);
  return c ? c.price * (1 + 0.2 * c.doseIdx) : 100;
};

/* ---------- остатки ---------- */

function genStock(r: Rnd, meds: Medicine[], branches: Branch[], now: number): Stock[] {
  const out: Stock[] = [];
  for (const m of meds) {
    const base = priceOf(m);
    for (const b of branches) {
      if (!chance(r, 0.55)) continue;
      out.push({
        branchId: b.id, medicineId: m.id,
        price: Math.max(5, Math.round(base * (0.94 + r() * 0.14))),
        qty: chance(r, 0.12) ? 0 : int(r, 1, 90),
        updatedAt: iso(now - int(r, 0, 72) * HOUR),
      });
    }
  }
  return out;
}

/* ---------- сборка всего набора ---------- */

export interface BulkInput {
  medicines: Medicine[]; // результат genMedicines
  baseStock: Stock[]; // исходные остатки из seed.ts
  branches: Branch[];
  users: { id: string; role: string; pharmacyId?: string }[];
  now?: number;
  counts?: Partial<ReturnType<typeof bulkCounts>>;
}

export interface BulkResult {
  stock: Stock[]; orders: Order[]; notifications: AppNotification[]; globals: GlobalRequest[];
  groups: GroupOrder[]; cargoLines: CargoLine[]; shipments: Shipment[]; seq: number;
}

const groupKey = (name: string, dosage: string, form: string): string => {
  const n = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  const d = (s: string) => n(s).replace(/,/g, ".").replace(/\s/g, "");
  return `${n(name)}|${d(dosage)}|${n(form)}`;
};

export function buildBulk(input: BulkInput): BulkResult {
  const now = input.now ?? Date.now();
  const c = { ...bulkCounts(), ...input.counts };
  const r = rng(2002);
  const { branches, users } = input;

  const realBuyers = users.filter((u) => u.role === "buyer").map((u) => u.id);
  const demoBuyers = Array.from({ length: 24 }, (_, i) => `u-demo-${pad(i + 1, 2)}`);
  const anyBuyer = (pReal: number) => (realBuyers.length && chance(r, pReal) ? pick(r, realBuyers) : pick(r, demoBuyers));
  const supplierId = users.find((u) => u.role === "supplier")?.id ?? "system";
  const importerId = users.find((u) => u.role === "importer")?.id ?? "system";
  const pharmUsers = (branchId: string) => {
    const ph = branches.find((b) => b.id === branchId)?.pharmacyId;
    return users.filter((u) => u.role === "pharmacy" && u.pharmacyId === ph);
  };
  const byRole = (role: string) => users.filter((u) => u.role === role);

  let counter = 1000;
  const nextNo = (prefix: string) => `${prefix}-${++counter}`;
  const notes: AppNotification[] = [];
  const note = (userId: string, text: string, at: number) =>
    notes.push({ id: `n-seed-${notes.length + 1}`, userId, text, at: iso(at), read: at < now - DAY || chance(r, 0.4) });

  /* остатки */
  const stock: Stock[] = [...input.baseStock.map((s) => ({ ...s })), ...genStock(r, input.medicines, branches, now)];
  const idx = new Map<string, Stock>(stock.map((s) => [`${s.branchId}|${s.medicineId}`, s]));
  const byBranch = new Map<string, Stock[]>();
  for (const s of stock) byBranch.set(s.branchId, [...(byBranch.get(s.branchId) ?? []), s]);

  /* заказы в аптеки */
  const orders: Order[] = [];
  const ORDER_STATUS: [OrderStatus, number][] = [
    ["pending", 15], ["confirmed", 10], ["ready", 8], ["qty_proposed", 5], ["issued", 35], ["rejected", 8], ["cancelled", 12], ["expired", 7],
  ];
  for (let i = 0; i < c.orders; i++) {
    const branch = pick(r, branches);
    const avail = (byBranch.get(branch.id) ?? []).filter((s) => s.qty > 0);
    if (avail.length === 0) continue;
    let status = weighted(r, ORDER_STATUS);
    const chosen = shuffle(r, avail).slice(0, int(r, 1, Math.min(4, avail.length)));
    const reserving = status === "confirmed" || status === "ready" || status === "issued";
    const items: OrderItem[] = chosen.map((s) => ({ medicineId: s.medicineId, qty: reserving ? Math.min(int(r, 1, 3), s.qty) : int(r, 1, 3), price: s.price }));
    let proposedQty: Record<string, number> | undefined;
    if (status === "qty_proposed") {
      const it = items.find((x) => x.qty >= 2);
      const s = it && idx.get(`${branch.id}|${it.medicineId}`);
      if (it && s && s.qty >= 1) proposedQty = { [it.medicineId]: int(r, 1, Math.min(it.qty - 1, s.qty)) };
      else status = "pending";
    }
    const buyerId = anyBuyer(0.35);
    const ph = pharmUsers(branch.id)[0]?.id ?? "system";

    // время создания зависит от статуса: активные заказы свежие, закрытые старше
    const ageMin =
      status === "confirmed" || status === "ready" ? int(r, 60, 17 * 60)
      : status === "pending" || status === "qty_proposed" ? int(r, 5, 30 * 60)
      : int(r, 2 * 24 * 60, 40 * 24 * 60);
    const createdAt = now - ageMin * MIN;
    const history: StatusEvent[] = [];
    let t = createdAt;
    const ev = (s: OrderStatus, by: string, at?: number) => {
      t = Math.min(at ?? t + int(r, 8, 120) * MIN, now - MIN);
      history.push({ status: s, at: iso(t), by });
    };
    history.push({ status: "pending", at: iso(createdAt), by: buyerId });
    let reserved = false;
    let reserveUntil: string | undefined;
    const confirmAt = () => {
      ev("confirmed", ph);
      reserveUntil = iso(t + DAY);
    };
    switch (status) {
      case "qty_proposed": ev("qty_proposed", ph); break;
      case "rejected": ev("rejected", ph); break;
      case "confirmed": confirmAt(); reserved = true; break;
      case "ready": confirmAt(); ev("ready", ph); reserved = true; break;
      case "issued": confirmAt(); if (chance(r, 0.5)) ev("ready", ph); ev("issued", ph); reserveUntil = undefined; break;
      case "cancelled": if (chance(r, 0.4)) { confirmAt(); reserveUntil = undefined; } ev("cancelled", buyerId); break;
      case "expired": { confirmAt(); const until = Date.parse(reserveUntil!); ev("expired", "system", until + MIN); reserveUntil = undefined; break; }
      default: break;
    }
    if (reserving) for (const it of items) idx.get(`${branch.id}|${it.medicineId}`)!.qty -= it.qty; // резерв/выдача списывают остаток

    orders.push({
      id: `o-seed-${pad(i + 1, 4)}`, number: "", buyerId, branchId: branch.id, items, proposedQty, status, reserved, reserveUntil,
      createdAt: iso(createdAt), history,
    });
  }
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  orders.forEach((o) => { o.number = nextNo("MF"); });
  orders.reverse(); // в store заказы лежат от новых к старым

  const buyerText: Partial<Record<OrderStatus, (n: string) => string>> = {
    pending: (n) => `Заказ ${n} отправлен в аптеку. Резерв появится после подтверждения.`,
    confirmed: (n) => `Аптека подтвердила заказ ${n}. Резерв на 24 ч.`,
    ready: (n) => `Заказ ${n} готов к получению. Назовите номер в аптеке.`,
    issued: (n) => `Заказ ${n} выдан. Спасибо!`,
    rejected: (n) => `Аптека отклонила заказ ${n}.`,
    expired: (n) => `Срок резерва по заказу ${n} истёк.`,
    qty_proposed: (n) => `Аптека предлагает изменить количество в заказе ${n}. Подтвердите или отмените.`,
  };
  for (const o of orders) {
    const last = Date.parse(o.history[o.history.length - 1].at);
    const text = buyerText[o.status];
    if (text && realBuyers.includes(o.buyerId)) note(o.buyerId, text(o.number), last);
    if (o.status === "pending") for (const u of pharmUsers(o.branchId)) note(u.id, `Новый заказ ${o.number}: проверьте наличие.`, Date.parse(o.createdAt));
  }

  /* пул препаратов для заявок, групп и Cargo */
  const pool = shuffle(r, input.medicines);
  const poolAt = (i: number) => pool[i % Math.max(pool.length, 1)];
  const uniquePool = [...new Map(pool.map((m) => [mKey(m.name, m.dosage, m.form), m])).values()]; // без повторов по препарату, дозировке и форме

  /* Global: индивидуальные заявки */
  const globals: GlobalRequest[] = [];
  const GL_STATUS: [GlobalStatus, number][] = [
    ["new", 25], ["offered", 20], ["importer_approved", 15], ["importer_rejected", 10], ["buyer_confirmed", 15], ["buyer_declined", 5], ["cancelled", 10],
  ];
  for (let i = 0; i < c.globals && pool.length; i++) {
    const m = poolAt(i);
    const status = weighted(r, GL_STATUS);
    const buyerId = anyBuyer(0.4);
    const createdAt = now - int(r, 1, 25) * DAY - int(r, 0, 20) * HOUR;
    const path: GlobalStatus[] =
      status === "new" ? ["new"]
      : status === "cancelled" ? ["new", "cancelled"]
      : status === "offered" ? ["new", "offered"]
      : status === "importer_approved" || status === "importer_rejected" ? ["new", "offered", status]
      : ["new", "offered", "importer_approved", status];
    const who = (s: GlobalStatus) => (s === "offered" ? supplierId : s === "importer_approved" || s === "importer_rejected" ? importerId : buyerId);
    let t = createdAt;
    const history = path.map((s, k) => { if (k) t = Math.min(t + int(r, 1, 30) * HOUR, now - MIN); return { status: s, at: iso(t), by: who(s) }; });
    const offers: GlobalOffer[] = [];
    if (path.includes("offered")) {
      const n = int(r, 1, 2);
      for (let k = 0; k < n; k++) {
        const o: GlobalOffer = { id: `go-seed-${i + 1}-${k + 1}`, supplierId, pricePerPack: int(r, 3, 90) * 100, leadTimeDays: int(r, 7, 45), note: "Демо-предложение (тестовые данные)" };
        if (status === "importer_rejected") { o.importerDecision = "rejected"; o.importerNote = "Демо: ввоз не подтверждён"; }
        else if (path.includes("importer_approved")) { if (k === 0) o.importerDecision = "approved"; else { o.importerDecision = "rejected"; o.importerNote = "Демо: выбрано другое предложение"; } }
        offers.push(o);
      }
    }
    const g: GlobalRequest = {
      id: `g-seed-${pad(i + 1, 3)}`, number: "", buyerId, medicineName: m.name, dosage: m.dosage, form: m.form, qty: int(r, 1, 3),
      comment: "Тестовая заявка (демо-данные)", prescriptionAck: true, status, offers, createdAt: iso(createdAt), history,
    };
    globals.push(g);
  }
  globals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  globals.forEach((g) => { g.number = nextNo("GL"); });
  globals.reverse();
  for (const g of globals) {
    if (g.status === "new") for (const u of byRole("supplier")) note(u.id, `Новая заявка ${g.number}: ${g.medicineName} ${g.dosage}, ${g.qty} уп.`, Date.parse(g.createdAt));
    if (g.status === "offered") for (const u of byRole("importer")) note(u.id, `Предложение по заявке ${g.number} ждёт вашей проверки.`, Date.parse(g.history[g.history.length - 1].at));
  }

  /* Group Orders: общий спрос (у открытых групп ключи не повторяются) */
  const groups: GroupOrder[] = [];
  const CONFIRM: GroupMember["confirmation"][] = ["pending", "confirmed", "declined"];
  const GR_STATUS: [GroupStatus, number][] = [["open", 40], ["offered", 20], ["approved", 15], ["completed", 10], ["closed", 10], ["cancelled", 5]];
  for (let i = 0; i < c.groups && i < uniquePool.length; i++) {
    const m = uniquePool[uniquePool.length - 1 - i]; // с другого конца, чтобы реже совпадать с заявками
    const status = weighted(r, GR_STATUS);
    const createdAt = now - int(r, 1, 20) * DAY;
    const nMembers = status === "cancelled" ? 0 : status === "open" ? int(r, 1, 6) : int(r, 3, 8);
    const ids = shuffle(r, demoBuyers).slice(0, nMembers);
    if (realBuyers.length && nMembers > 0 && chance(r, 0.35)) ids[0] = realBuyers[0];
    const members: GroupMember[] = ids.map((buyerId) => ({ buyerId, qty: int(r, 1, 8), joinedAt: iso(createdAt + int(r, 1, 48) * HOUR), confirmation: "pending" }));
    const total = members.reduce((s, x) => s + x.qty, 0);
    const hasOffer = status !== "open" && status !== "cancelled";
    let minVolume = total > 0 ? Math.max(1, int(r, Math.ceil(total * 0.5), total)) : 1;
    if (status === "approved") {
      members.forEach((x) => { x.confirmation = pick(r, CONFIRM); });
      members[0].confirmation = "pending";
    }
    if (status === "completed") {
      members.forEach((x) => { x.confirmation = chance(r, 0.8) ? "confirmed" : "declined"; });
      members[0].confirmation = "confirmed";
      minVolume = Math.min(minVolume, members.filter((x) => x.confirmation === "confirmed").reduce((s, x) => s + x.qty, 0));
    }
    if (status === "closed") {
      members.forEach((x) => { x.confirmation = chance(r, 0.5) ? "confirmed" : "declined"; });
      members[0].confirmation = "declined";
      minVolume = Math.min(total, members.filter((x) => x.confirmation === "confirmed").reduce((s, x) => s + x.qty, 0) + 1);
    }
    const confirmedQty = members.filter((x) => x.confirmation === "confirmed").reduce((s, x) => s + x.qty, 0);
    const offers = hasOffer
      ? [{
          id: `gof-seed-${i + 1}`, supplierId, minVolume, pricePerPack: int(r, 2, 50) * 100, leadTimeDays: int(r, 10, 40),
          note: "Демо-предложение (тестовые данные)",
          ...(status === "offered" ? {} : { importerDecision: "approved" as const, importerNote: "Демо: проверено" }),
        }]
      : [];
    const first = ids[0] ?? pick(r, demoBuyers);
    const last = ids[ids.length - 1] ?? first;
    const path: [GroupStatus, string, string?][] =
      status === "open" ? [["open", first]]
      : status === "offered" ? [["open", first], ["offered", supplierId]]
      : status === "approved" ? [["open", first], ["offered", supplierId], ["approved", importerId]]
      : status === "completed" ? [["open", first], ["offered", supplierId], ["approved", importerId], ["completed", last, `Подтверждено ${confirmedQty} уп.`]]
      : status === "closed" ? [["open", first], ["offered", supplierId], ["approved", importerId], ["closed", last, "Подтверждённый объём меньше объёма предложения"]]
      : [["open", first], ["cancelled", first, "Участников не осталось"]];
    let t = createdAt;
    const history = path.map(([s, by, n], k) => { if (k) t = Math.min(t + int(r, 2, 40) * HOUR, now - MIN); return { status: s, at: iso(t), by, ...(n ? { note: n } : {}) }; });
    const deadline = status === "open" || status === "offered" ? now + int(r, 2, 14) * DAY : status === "approved" ? now + int(r, 1, 7) * DAY : now - int(r, 1, 5) * DAY;
    groups.push({
      id: `gr-seed-${pad(i + 1, 3)}`, number: "", key: groupKey(m.name, m.dosage, m.form), medicineName: m.name, dosage: m.dosage, form: m.form,
      status, deadline: iso(deadline), members, offers, createdAt: iso(createdAt), history,
    });
  }
  groups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  groups.forEach((g) => { g.number = nextNo("GR"); });
  groups.reverse();
  for (const g of groups) if (g.status === "open") for (const u of byRole("supplier")) note(u.id, `Группа ${g.number}: ${g.medicineName} ${g.dosage}, ${g.form}. Общий спрос: ${g.members.reduce((s, x) => s + x.qty, 0)} уп.`, Date.parse(g.createdAt));

  /* Cargo: заказы в сборные отправки. Одна отправка = один класс хранения */
  const LINE_STATUS: [CargoLineStatus, number][] = [
    ["requested", 18], ["verified", 14], ["declined", 7], ["in_shipment", 12], ["in_transit", 12], ["arrived", 7], ["ready_for_pickup", 10], ["issued", 14], ["cancelled", 6],
  ];
  const PHASE: Partial<Record<CargoLineStatus, ShipmentStatus>> = {
    in_shipment: "forming", in_transit: "in_transit", arrived: "arrived", ready_for_pickup: "closed", issued: "closed",
  };
  const shipments: Shipment[] = [];
  const open = new Map<string, { sh: Shipment; n: number }>(); // отправка в процессе наполнения по (класс, фаза)
  const shipmentFor = (storage: StorageClass, phase: ShipmentStatus): Shipment => {
    const k = `${storage}|${phase}`;
    const cur = open.get(k);
    if (cur && (phase === "forming" || cur.n < 8)) { cur.n++; return cur.sh; }
    const ageDays = phase === "forming" ? int(r, 1, 4) : phase === "in_transit" ? int(r, 3, 9) : phase === "arrived" ? int(r, 8, 14) : int(r, 10, 30);
    let t = now - ageDays * DAY;
    const hist: { status: ShipmentStatus; at: string; by: string }[] = [{ status: "forming", at: iso(t), by: importerId }];
    const steps: [ShipmentStatus, number, number][] = [["in_transit", 1, 2], ["arrived", 3, 6], ["closed", 0, 1]];
    const order: ShipmentStatus[] = ["forming", "in_transit", "arrived", "closed"];
    for (const [s, lo, hi] of steps) {
      if (order.indexOf(s) > order.indexOf(phase)) break;
      t = Math.min(t + int(r, lo, hi) * DAY + int(r, 1, 20) * HOUR, now - MIN);
      hist.push({ status: s, at: iso(t), by: importerId });
    }
    const sh: Shipment = { id: `sh-seed-${pad(shipments.length + 1, 3)}`, number: "", storage, status: phase, createdAt: hist[0].at, history: hist };
    shipments.push(sh);
    open.set(k, { sh, n: 1 });
    return sh;
  };

  const ALT_ANY: NonNullable<CargoLine["altStatus"]>[] = ["proposed", "accepted", "declined"];
  const ALT_DONE: NonNullable<CargoLine["altStatus"]>[] = ["accepted", "declined"];
  const cargoLines: CargoLine[] = [];
  for (let i = 0; i < c.cargo && pool.length; i++) {
    const m = poolAt(i + 7);
    const status = weighted(r, LINE_STATUS);
    const storage = weighted<StorageClass>(r, [["room", 70], ["cool", 25], ["frozen", 5]]);
    const buyerId = anyBuyer(0.4);
    const branchId = pick(r, branches).id;
    const phase = PHASE[status];
    const sh = phase ? shipmentFor(storage, phase) : undefined;
    const histOf = (s: ShipmentStatus) => sh?.history.find((h) => h.status === s)?.at;
    const createdAt = sh ? Date.parse(sh.createdAt) - int(r, 2, 6) * DAY : now - int(r, 1, 10) * DAY;
    const events: { status: CargoLineStatus; at: number; by: string }[] = [{ status: "requested", at: createdAt, by: buyerId }];
    const add = (s: CargoLineStatus, by: string, at?: number | string) => {
      const prev = events[events.length - 1].at;
      const raw = typeof at === "string" ? Date.parse(at) : at ?? prev + int(r, 1, 20) * HOUR;
      events.push({ status: s, at: Math.min(Math.max(raw, prev), now - MIN), by });
    };
    if (status !== "requested") {
      if (status === "declined") add("declined", importerId);
      else if (status === "cancelled") { if (chance(r, 0.5)) add("verified", importerId); add("cancelled", buyerId); }
      else add("verified", importerId);
    }
    if (sh) {
      add("in_shipment", importerId, histOf("forming"));
      if (histOf("in_transit")) add("in_transit", importerId, histOf("in_transit"));
      if (histOf("arrived")) add("arrived", importerId, histOf("arrived"));
      if (histOf("closed")) add("ready_for_pickup", importerId, histOf("closed"));
      if (status === "issued") add("issued", importerId);
    }
    let altBranchId: string | undefined;
    let altStatus: CargoLine["altStatus"];
    if ((sh && sh.status !== "closed") || status === "ready_for_pickup" || status === "issued") {
      if (chance(r, 0.15)) {
        altBranchId = pick(r, branches.filter((b) => b.id !== branchId)).id;
        altStatus = sh?.status === "forming" ? pick(r, ALT_ANY) : pick(r, ALT_DONE);
      }
    }
    cargoLines.push({
      id: `cl-seed-${pad(i + 1, 3)}`, number: "", buyerId, medicineName: m.name, dosage: m.dosage, form: m.form, qty: int(r, 1, 3), storage,
      prescription: m.prescription, prescriptionAck: true, branchId, altBranchId, altStatus, shipmentId: sh?.id, status,
      importerNote: status === "declined" ? "Демо: ввоз не подтверждён" : status === "verified" ? "Демо: проверено" : undefined,
      createdAt: iso(createdAt), history: events.map((e) => ({ status: e.status, at: iso(e.at), by: e.by })),
    });
  }
  cargoLines.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  cargoLines.forEach((l) => { l.number = nextNo("CG"); });
  cargoLines.reverse();
  shipments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  shipments.forEach((s) => { s.number = nextNo("SH"); });
  shipments.reverse();
  for (const l of cargoLines) if (l.status === "requested") for (const u of byRole("importer")) note(u.id, `Новый заказ в Cargo ${l.number}: ${l.medicineName} ${l.dosage} × ${l.qty}.`, Date.parse(l.createdAt));

  notes.sort((a, b) => b.at.localeCompare(a.at));
  return { stock, orders, notifications: notes.slice(0, 400), globals, groups, cargoLines, shipments, seq: counter };
}
