// Запуск: npx tsx scripts/seed-orders.ts
// Останавливать dev-сервер не обязательно, но после запуска перезапустите его, чтобы он перечитал базу.
import { fillDemoOrders } from "../src/lib/demo-orders";

const r = fillDemoOrders();
console.log(r.message);
process.exit(r.ok ? 0 : 1);
