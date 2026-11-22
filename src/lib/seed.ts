import type { AppNotification, Branch, Category, DemoUser, Medicine, Order, Pharmacy, Stock } from "./types";

// ВСЕ ДАННЫЕ НИЖЕ — ТЕСТОВЫЕ. Аптеки, адреса, цены и остатки вымышлены.

export const DEMO_USERS: DemoUser[] = [
  { id: "u-buyer", name: "Тестовый покупатель", role: "buyer" },
  { id: "u-pharm1", name: "Сотрудник тестовой аптеки А", role: "pharmacy", pharmacyId: "ph-a" },
  { id: "u-pharm2", name: "Сотрудник тестовой аптеки Б", role: "pharmacy", pharmacyId: "ph-b" },
  { id: "u-supplier", name: "Тестовый поставщик", role: "supplier" },
  { id: "u-importer", name: "Тестовый импортёр", role: "importer" },
  { id: "u-admin", name: "Тестовый администратор", role: "admin" },
];

export const CATEGORIES: Category[] = [
  { id: "heart", name: "Сердце и сосуды", icon: "heart-pulse" },
  { id: "kidney", name: "Почки и мочевыделение", icon: "droplets" },
  { id: "cold", name: "Простуда и грипп", icon: "thermometer-snowflake" },
  { id: "fever", name: "Температура", icon: "thermometer" },
  { id: "stomach", name: "Желудок и пищеварение", icon: "utensils" },
  { id: "allergy", name: "Аллергия", icon: "flower-2" },
  { id: "pain", name: "Боль", icon: "zap" },
  { id: "vitamins", name: "Витамины", icon: "sparkles" },
  { id: "nerves", name: "Нервная система", icon: "brain" },
  { id: "breath", name: "Дыхательная система", icon: "wind" },
  { id: "joints", name: "Суставы и кости", icon: "bone" },
  { id: "skin", name: "Кожа", icon: "hand" },
  { id: "eyes", name: "Глаза", icon: "eye" },
  { id: "liver", name: "Печень", icon: "activity" },
  { id: "immune", name: "Иммунная система", icon: "shield" },
  { id: "antiseptic", name: "Антисептики и перевязка", icon: "bandage" },
  { id: "kids", name: "Детские препараты", icon: "baby" },
];

export const MEDICINES: Medicine[] = [
  { id: "m1", name: "Парацетамол", inn: "Парацетамол", dosage: "500 мг", form: "Таблетки", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание. Подтверждённый текст из проверенного источника будет добавлен при подключении реального каталога.", categories: ["fever", "pain", "cold"], synonyms: ["paracetamol", "парацетомол", "панадол"], prescription: false },
  { id: "m2", name: "Ибупрофен", inn: "Ибупрофен", dosage: "400 мг", form: "Таблетки", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание.", categories: ["pain", "fever", "joints"], synonyms: ["ibuprofen", "ибупрофин", "нурофен"], prescription: false },
  { id: "m3", name: "Ибупрофен", inn: "Ибупрофен", dosage: "200 мг", form: "Таблетки", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание. Другая дозировка — отдельная позиция.", categories: ["pain", "fever"], synonyms: ["ibuprofen"], prescription: false },
  { id: "m4", name: "Цетиризин", inn: "Цетиризин", dosage: "10 мг", form: "Таблетки", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание.", categories: ["allergy"], synonyms: ["cetirizine", "цетиризин", "цетрин"], prescription: false },
  { id: "m5", name: "Омепразол", inn: "Омепразол", dosage: "20 мг", form: "Капсулы", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание.", categories: ["stomach"], synonyms: ["omeprazole", "омепрозол"], prescription: false },
  { id: "m6", name: "Аскорбиновая кислота", inn: "Аскорбиновая кислота", dosage: "500 мг", form: "Таблетки", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание.", categories: ["vitamins", "immune", "cold"], synonyms: ["витамин с", "vitamin c"], prescription: false },
  { id: "m7", name: "Амоксициллин", inn: "Амоксициллин", dosage: "500 мг", form: "Капсулы", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание. Рецептурный препарат: выдаётся только при соблюдении требований аптеки.", categories: ["cold", "breath"], synonyms: ["amoxicillin", "амоксиклав"], prescription: true },
  { id: "m8", name: "Хлоргексидин", inn: "Хлоргексидин", dosage: "0,05%", form: "Раствор", manufacturer: "Тестовый производитель", country: "—", description: "Тестовое описание.", categories: ["antiseptic", "skin"], synonyms: ["chlorhexidine", "хлоргексидин биглюконат"], prescription: false },
];

export const PHARMACIES: Pharmacy[] = [
  { id: "ph-a", name: "Тестовая аптека А" },
  { id: "ph-b", name: "Тестовая аптека Б" },
];

export const BRANCHES: Branch[] = [
  { id: "b1", pharmacyId: "ph-a", name: "Филиал 1 (тест)", city: "Бишкек", district: "Центр", address: "Тестовый адрес, центр Бишкека", lat: 42.8746, lng: 74.5698, hours: "08:00–22:00" },
  { id: "b2", pharmacyId: "ph-a", name: "Филиал 2 (тест)", city: "Бишкек", district: "Юг", address: "Тестовый адрес, юг Бишкека", lat: 42.838, lng: 74.585, hours: "09:00–21:00" },
  { id: "b3", pharmacyId: "ph-b", name: "Филиал 1 (тест)", city: "Бишкек", district: "Запад", address: "Тестовый адрес, запад Бишкека", lat: 42.87, lng: 74.52, hours: "круглосуточно" },
  { id: "b4", pharmacyId: "ph-b", name: "Филиал Ош (тест)", city: "Ош", district: "Центр", address: "Тестовый адрес, центр Оша", lat: 40.5283, lng: 72.7985, hours: "08:00–20:00" },
];

const T = "2026-11-22T06:00:00.000Z";
export const STOCK: Stock[] = [
  { branchId: "b1", medicineId: "m1", price: 45, qty: 40, updatedAt: T },
  { branchId: "b2", medicineId: "m1", price: 42, qty: 0, updatedAt: T },
  { branchId: "b3", medicineId: "m1", price: 48, qty: 12, updatedAt: T },
  { branchId: "b1", medicineId: "m2", price: 120, qty: 8, updatedAt: T },
  { branchId: "b3", medicineId: "m2", price: 115, qty: 20, updatedAt: T },
  { branchId: "b4", medicineId: "m2", price: 118, qty: 5, updatedAt: T },
  { branchId: "b2", medicineId: "m3", price: 80, qty: 15, updatedAt: T },
  { branchId: "b1", medicineId: "m4", price: 95, qty: 10, updatedAt: T },
  { branchId: "b4", medicineId: "m4", price: 90, qty: 7, updatedAt: T },
  { branchId: "b2", medicineId: "m5", price: 160, qty: 9, updatedAt: T },
  { branchId: "b3", medicineId: "m5", price: 150, qty: 14, updatedAt: T },
  { branchId: "b1", medicineId: "m6", price: 30, qty: 50, updatedAt: T },
  { branchId: "b4", medicineId: "m6", price: 28, qty: 25, updatedAt: T },
  { branchId: "b1", medicineId: "m7", price: 210, qty: 6, updatedAt: T },
  { branchId: "b1", medicineId: "m8", price: 55, qty: 18, updatedAt: T },
  { branchId: "b3", medicineId: "m8", price: 52, qty: 0, updatedAt: T },
];

export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
