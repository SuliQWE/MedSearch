-- MediFinder: схема PostgreSQL (Supabase). Не применялась и не проверялась на живой БД.
-- Текущее демо-приложение этой схемой НЕ пользуется (оно работает на in-memory хранилище).

create extension if not exists pg_trgm;

-- ===== Пользователи и доступ =====
create type user_role as enum ('buyer','pharmacy','supplier','importer','admin');

create table user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'buyer',
  full_name text not null,
  phone text,
  organization_id uuid,
  created_at timestamptz not null default now()
);
create table user_address (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profile(id) on delete cascade,
  city text not null, district text, address text,
  lat double precision, lng double precision
);
create table notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profile(id) on delete cascade,
  text text not null, read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notification (user_id, read, created_at desc);

-- ===== Каталог =====
create table medicine_manufacturer (id uuid primary key default gen_random_uuid(), name text not null, country text);
create table medicine (
  id uuid primary key default gen_random_uuid(),
  name text not null, inn text not null, dosage text not null, form text not null,
  manufacturer_id uuid references medicine_manufacturer(id),
  description text, source_url text, image_url text,
  prescription boolean not null default false,
  unique (name, dosage, form, manufacturer_id)  -- разные дозировки/формы = разные позиции
);
create index medicine_name_trgm on medicine using gin (name gin_trgm_ops);
create index medicine_inn_trgm on medicine using gin (inn gin_trgm_ops);
create table medicine_synonym (medicine_id uuid references medicine(id) on delete cascade, synonym text not null, primary key (medicine_id, synonym));
create table medicine_category (id text primary key, name text not null);
create table medicine_category_relation (medicine_id uuid references medicine(id) on delete cascade, category_id text references medicine_category(id), primary key (medicine_id, category_id));

-- ===== Аптеки =====
create table pharmacy (id uuid primary key default gen_random_uuid(), name text not null, license_verified boolean not null default false);
create table pharmacy_branch (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references pharmacy(id) on delete cascade,
  name text not null, city text not null, district text, address text not null,
  lat double precision not null, lng double precision not null, hours text, active boolean not null default true
);
create index on pharmacy_branch (city);
create table pharmacy_medicine (
  branch_id uuid references pharmacy_branch(id) on delete cascade,
  medicine_id uuid references medicine(id),
  price numeric(12,2) not null check (price >= 0),
  qty integer not null check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (branch_id, medicine_id)
);
create table pickup_point (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references pharmacy_branch(id), name text not null, city text not null, address text not null,
  lat double precision, lng double precision, capacity integer, cold_storage boolean not null default false
);

-- ===== Local =====
create type retail_status as enum ('pending','confirmed','rejected','qty_proposed','ready','issued','cancelled','expired');
create table retail_order (
  id uuid primary key default gen_random_uuid(), number text unique not null,
  buyer_id uuid not null references user_profile(id),
  branch_id uuid not null references pharmacy_branch(id),
  status retail_status not null default 'pending',
  reserved boolean not null default false, reserve_until timestamptz,
  created_at timestamptz not null default now()
);
create index on retail_order (buyer_id); create index on retail_order (branch_id, status);
create table retail_order_item (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references retail_order(id) on delete cascade,
  medicine_id uuid not null references medicine(id),
  qty integer not null check (qty > 0), proposed_qty integer check (proposed_qty > 0),
  price numeric(12,2) not null
);
create table order_status_history (
  id bigserial primary key, order_id uuid not null references retail_order(id) on delete cascade,
  status retail_status not null, changed_by text, at timestamptz not null default now()
);

-- ===== Global =====
create table international_request (
  id uuid primary key default gen_random_uuid(), number text unique not null,
  buyer_id uuid not null references user_profile(id), medicine_id uuid references medicine(id),
  free_text_name text, inn text, dosage text, form text, qty integer not null check (qty > 0),
  preferred_country text, city text not null, pickup_point_id uuid references pickup_point(id),
  notes text, status text not null default 'open', created_at timestamptz not null default now()
);
create table supplier_offer (
  id uuid primary key default gen_random_uuid(), request_id uuid references international_request(id),
  group_order_id uuid, supplier_id uuid not null references user_profile(id),
  manufacturer text, origin_country text, qty integer not null, unit_price numeric(12,2) not null,
  eta_days integer, terms text, status text not null default 'submitted'
);
create table import_verification (
  id uuid primary key default gen_random_uuid(), offer_id uuid references supplier_offer(id),
  importer_id uuid references user_profile(id), lawful boolean, documents_ok boolean, notes text, checked_at timestamptz
);
create table buyer_confirmation (
  id uuid primary key default gen_random_uuid(), offer_id uuid references supplier_offer(id),
  buyer_id uuid references user_profile(id), confirmed boolean not null, at timestamptz not null default now()
);

-- ===== Group orders =====
create table group_order (
  id uuid primary key default gen_random_uuid(), medicine_id uuid not null references medicine(id),
  status text not null default 'collecting', min_total_qty integer, closes_at timestamptz
);
create table group_order_member (
  group_id uuid references group_order(id) on delete cascade, buyer_id uuid references user_profile(id),
  qty integer not null check (qty > 0), withdrawn_at timestamptz, primary key (group_id, buyer_id)
);
alter table supplier_offer add constraint supplier_offer_group_fk foreign key (group_order_id) references group_order(id);
create table group_order_status_history (id bigserial primary key, group_id uuid references group_order(id) on delete cascade, status text not null, at timestamptz not null default now());

-- ===== Cargo =====
create table logistics_partner (id uuid primary key default gen_random_uuid(), name text not null, kind text not null);
create table delivery_method (id uuid primary key default gen_random_uuid(), partner_id uuid references logistics_partner(id), name text not null, temperature_range text);
create table cargo_shipment (
  id uuid primary key default gen_random_uuid(), supplier_id uuid references user_profile(id),
  origin_country text not null, planned_departure date, status text not null default 'collecting', terms text
);
create table cargo_shipment_item (
  id uuid primary key default gen_random_uuid(), shipment_id uuid references cargo_shipment(id) on delete cascade,
  medicine_id uuid references medicine(id), available_qty integer not null, unit_price numeric(12,2) not null,
  storage_class text not null default 'room'  -- для разделения несовместимых логистических групп
);
create table cargo_order (
  id uuid primary key default gen_random_uuid(), shipment_id uuid references cargo_shipment(id),
  buyer_id uuid not null references user_profile(id), pickup_point_id uuid references pickup_point(id), status text not null default 'review'
);
create table cargo_order_item (
  id uuid primary key default gen_random_uuid(), cargo_order_id uuid references cargo_order(id) on delete cascade,
  shipment_item_id uuid references cargo_shipment_item(id), qty integer not null check (qty > 0), unit_price numeric(12,2) not null
);
create table cargo_import_check (id uuid primary key default gen_random_uuid(), cargo_order_item_id uuid references cargo_order_item(id), importer_id uuid references user_profile(id), lawful boolean, compatible boolean, notes text, at timestamptz);
create table cargo_route (id uuid primary key default gen_random_uuid(), shipment_id uuid references cargo_shipment(id), partner_id uuid references logistics_partner(id), leg text not null, status text);
create table cargo_distribution (id uuid primary key default gen_random_uuid(), shipment_id uuid references cargo_shipment(id), city text not null, pickup_point_id uuid references pickup_point(id), status text not null default 'planned');
create table cargo_distribution_item (distribution_id uuid references cargo_distribution(id) on delete cascade, cargo_order_item_id uuid references cargo_order_item(id), primary key (distribution_id, cargo_order_item_id));
create table cargo_tracking_event (id bigserial primary key, shipment_id uuid references cargo_shipment(id), cargo_order_id uuid references cargo_order(id), stage text not null, at timestamptz not null default now(), note text);
create table shipment (id uuid primary key default gen_random_uuid(), partner_id uuid references logistics_partner(id), reference text);
create table shipment_status_history (id bigserial primary key, shipment_id uuid references shipment(id) on delete cascade, status text not null, at timestamptz not null default now());

-- ===== Дополнительные =====
create table document (id uuid primary key default gen_random_uuid(), owner_id uuid references user_profile(id), kind text not null, storage_path text not null, verified boolean not null default false, created_at timestamptz not null default now());
create table audit_log (id bigserial primary key, actor_id uuid, action text not null, entity text not null, entity_id text, at timestamptz not null default now(), details jsonb);
create table search_analytics (id bigserial primary key, query text not null, city text, results_count integer, at timestamptz not null default now()); -- без user_id: обезличено
create table demand_analytics (id bigserial primary key, medicine_id uuid references medicine(id), region text, packs integer not null, at date not null default current_date);

-- RLS: включить на всех таблицах и написать политики по ролям перед использованием в production.
