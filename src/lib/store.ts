import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BRANCHES, INITIAL_NOTIFICATIONS, INITIAL_ORDERS, STOCK } from "./seed";
import type { AppNotification, CargoLine, GlobalRequest, GroupOrder, Order, Shipment, Stock } from "./types";

// Хранилище на встроенном SQLite (node:sqlite, Node >= 22.13), без внешних пакетов.
// Рабочий набор держится в памяти, а persist() записывает его в файл в одной транзакции.
// ВАЖНО: на Vercel файловая система временная (пишется только в /tmp, на один инстанс),
// поэтому для production нужен Postgres (supabase/migrations/0001_schema.sql).

interface DemoDB {
  stock: Stock[];
  orders: Order[];
  notifications: AppNotification[];
  globals: GlobalRequest[];
  groups: GroupOrder[];
  cargoLines: CargoLine[];
  shipments: Shipment[];
  seq: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sqlite = { exec(sql: string): void; prepare(sql: string): { all(...a: any[]): any[]; run(...a: any[]): any } };

const g = globalThis as unknown as { __medifinder?: DemoDB; __medifinderSql?: Sqlite };

function dbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  return process.env.VERCEL ? "/tmp/medifinder.db" : "./data/medifinder.db";
}

function sql(): Sqlite {
  if (!g.__medifinderSql) {
    const path = dbPath();
    mkdirSync(dirname(path), { recursive: true });
    const req = eval("require") as NodeRequire; // не даём бандлеру трогать node:sqlite
    const { DatabaseSync } = req("node:sqlite");
    const d: Sqlite = new DatabaseSync(path);
    d.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS stock (branch_id TEXT, medicine_id TEXT, price REAL NOT NULL, qty INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (branch_id, medicine_id));
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, buyer_id TEXT NOT NULL, branch_id TEXT NOT NULL, status TEXT NOT NULL, reserved INTEGER NOT NULL, reserve_until TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS order_items (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, medicine_id TEXT NOT NULL, qty INTEGER NOT NULL, price REAL NOT NULL, proposed_qty INTEGER);
      CREATE TABLE IF NOT EXISTS order_history (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, status TEXT NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL, read INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
      CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
    `);
    g.__medifinderSql = d;
  }
  return g.__medifinderSql;
}

function load(): DemoDB {
  const d = sql();
  let stock = d.prepare("SELECT * FROM stock").all().map((r): Stock => ({ branchId: r.branch_id, medicineId: r.medicine_id, price: r.price, qty: r.qty, updatedAt: r.updated_at }));
  const fresh = stock.length === 0;
  if (fresh) stock = STOCK.map((s) => ({ ...s }));

  const items = d.prepare("SELECT * FROM order_items").all();
  const hist = d.prepare("SELECT * FROM order_history ORDER BY rowid").all();
  const orders = d.prepare("SELECT * FROM orders ORDER BY created_at DESC, rowid DESC").all().map((r): Order => {
    const its = items.filter((i) => i.order_id === r.id);
    const proposed: Record<string, number> = {};
    for (const i of its) if (i.proposed_qty != null) proposed[i.medicine_id] = i.proposed_qty;
    return {
      id: r.id, number: r.number, buyerId: r.buyer_id, branchId: r.branch_id,
      items: its.map((i) => ({ medicineId: i.medicine_id, qty: i.qty, price: i.price })),
      proposedQty: Object.keys(proposed).length ? proposed : undefined,
      status: r.status, reserved: !!r.reserved, reserveUntil: r.reserve_until ?? undefined, createdAt: r.created_at,
      history: hist.filter((h) => h.order_id === r.id).map((h) => ({ status: h.status, at: h.at, by: h.by })),
    };
  });
  const notifications = d.prepare("SELECT * FROM notifications ORDER BY at DESC, rowid DESC").all().map((r): AppNotification => ({ id: r.id, userId: r.user_id, text: r.text, at: r.at, read: !!r.read }));
  const maxSeq = orders.reduce((m, o) => Math.max(m, Number(o.number.replace(/\D/g, "")) || 0), 1000);
  const kv = d.prepare("SELECT json FROM kv WHERE key = ?").all("globals")[0];
  const globals: GlobalRequest[] = kv ? JSON.parse(kv.json) : [];
  const readKv = <T,>(key: string): T[] => { const r = d.prepare("SELECT json FROM kv WHERE key = ?").all(key)[0]; return r ? JSON.parse(r.json) : []; };
  const groups = readKv<GroupOrder>("groups");
  const cargoLines = readKv<CargoLine>("cargoLines");
  const shipments = readKv<Shipment>("shipments");
  const seqKv = d.prepare("SELECT json FROM kv WHERE key = ?").all("seq")[0];
  const state: DemoDB = { stock, orders: fresh ? [...INITIAL_ORDERS] : orders, notifications: fresh ? [...INITIAL_NOTIFICATIONS] : notifications, globals, groups, cargoLines, shipments, seq: Math.max(maxSeq, seqKv ? Number(JSON.parse(seqKv.json)) : 0) };
  g.__medifinder = state;
  if (fresh) persist();
  return state;
}

export function db(): DemoDB {
  const state = g.__medifinder ?? load();
  // защита от устаревшего кэша после горячей перезагрузки
  if (!state.globals) state.globals = [];
  if (!state.groups) state.groups = [];
  if (!state.cargoLines) state.cargoLines = [];
  if (!state.shipments) state.shipments = [];
  return state;
}

/** Записывает текущее состояние в SQLite атомарно. Вызывается после каждой мутации. */
export function persist(): void {
  const state = db();
  const d = sql();
  d.exec("BEGIN");
  try {
    d.exec("DELETE FROM order_history; DELETE FROM order_items; DELETE FROM orders; DELETE FROM notifications; DELETE FROM stock;");
    const st = d.prepare("INSERT INTO stock VALUES (?,?,?,?,?)");
    for (const s of state.stock) st.run(s.branchId, s.medicineId, s.price, s.qty, s.updatedAt);
    const po = d.prepare("INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)");
    const pi = d.prepare("INSERT INTO order_items VALUES (?,?,?,?,?)");
    const ph = d.prepare("INSERT INTO order_history VALUES (?,?,?,?)");
    // Вставляем от старых к новым, чтобы rowid отражал порядок создания.
    for (const o of [...state.orders].reverse()) {
      po.run(o.id, o.number, o.buyerId, o.branchId, o.status, o.reserved ? 1 : 0, o.reserveUntil ?? null, o.createdAt);
      for (const i of o.items) pi.run(o.id, i.medicineId, i.qty, i.price, o.proposedQty?.[i.medicineId] ?? null);
      for (const h of o.history) ph.run(o.id, h.status, h.at, h.by);
    }
    const pn = d.prepare("INSERT INTO notifications VALUES (?,?,?,?,?)");
    for (const n of [...state.notifications].reverse()) pn.run(n.id, n.userId, n.text, n.at, n.read ? 1 : 0);
    const kvw = d.prepare("INSERT OR REPLACE INTO kv VALUES (?, ?)");
    kvw.run("globals", JSON.stringify(state.globals));
    kvw.run("groups", JSON.stringify(state.groups));
    kvw.run("cargoLines", JSON.stringify(state.cargoLines));
    kvw.run("shipments", JSON.stringify(state.shipments));
    kvw.run("seq", JSON.stringify(state.seq));
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function nextNumber(prefix = "MF"): string {
  const d = db();
  d.seq += 1;
  return `${prefix}-${d.seq}`;
}

export function pharmacyOfBranch(branchId: string): string | undefined {
  return BRANCHES.find((b) => b.id === branchId)?.pharmacyId;
}

export function notify(userId: string, text: string) {
  const d = db();
  d.notifications.unshift({
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    text,
    at: new Date().toISOString(),
    read: false,
  });
}

/** Сброс демо-данных к начальным (только для администратора, вызывается из admin-actions). */
export function resetDemoData(): void {
  const d = sql();
  d.exec("DELETE FROM order_history; DELETE FROM order_items; DELETE FROM orders; DELETE FROM notifications; DELETE FROM stock; DELETE FROM kv;");
  g.__medifinder = undefined;
  db(); // перезагрузка с сид-данными
}
