-- MediFinder: RLS-политики и атомарные функции. НЕ ПРИМЕНЯЛОСЬ к живой БД Supabase.
-- Проверен только синтаксис парсером PostgreSQL (pglast). Политики и функции нужно прогнать на тестовом проекте.
-- Принцип: запись в заказы идёт ТОЛЬКО через функции ниже (security definer), прямых INSERT/UPDATE политик для заказов нет.

-- ===== Вспомогательные функции (security definer, чтобы политики не зацикливались на user_profile) =====
create or replace function app_role() returns user_role language sql stable security definer set search_path = public as
$$ select role from user_profile where id = auth.uid() $$;

create or replace function app_org() returns uuid language sql stable security definer set search_path = public as
$$ select organization_id from user_profile where id = auth.uid() $$;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(app_role() = 'admin', false) $$;

create or replace function my_branch_ids() returns setof uuid language sql stable security definer set search_path = public as
$$ select id from pharmacy_branch where app_role() = 'pharmacy' and pharmacy_id = app_org() $$;

-- ===== Включить RLS =====
alter table user_profile enable row level security;
alter table user_address enable row level security;
alter table notification enable row level security;
alter table medicine enable row level security;
alter table medicine_manufacturer enable row level security;
alter table medicine_synonym enable row level security;
alter table medicine_category enable row level security;
alter table medicine_category_relation enable row level security;
alter table pharmacy enable row level security;
alter table pharmacy_branch enable row level security;
alter table pharmacy_medicine enable row level security;
alter table retail_order enable row level security;
alter table retail_order_item enable row level security;
alter table order_status_history enable row level security;
alter table international_request enable row level security;
alter table supplier_offer enable row level security;
alter table import_verification enable row level security;
alter table buyer_confirmation enable row level security;
alter table audit_log enable row level security;
alter table search_analytics enable row level security;
alter table demand_analytics enable row level security;

-- ===== Профили =====
create policy profile_self_read on user_profile for select using (id = auth.uid() or is_admin());
create policy profile_self_update on user_profile for update using (id = auth.uid())
  with check (id = auth.uid() and role = app_role() and organization_id is not distinct from app_org()); -- роль менять нельзя
create policy profile_admin_all on user_profile for all using (is_admin()) with check (is_admin());
create policy address_own on user_address for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_own_read on notification for select using (user_id = auth.uid());
create policy notification_own_update on notification for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== Каталог: читают все, пишет администратор =====
create policy catalog_read on medicine for select using (true);
create policy catalog_read on medicine_manufacturer for select using (true);
create policy catalog_read on medicine_synonym for select using (true);
create policy catalog_read on medicine_category for select using (true);
create policy catalog_read on medicine_category_relation for select using (true);
create policy catalog_admin on medicine for all using (is_admin()) with check (is_admin());
create policy catalog_admin on medicine_manufacturer for all using (is_admin()) with check (is_admin());
create policy catalog_admin on medicine_synonym for all using (is_admin()) with check (is_admin());
create policy catalog_admin on medicine_category for all using (is_admin()) with check (is_admin());
create policy catalog_admin on medicine_category_relation for all using (is_admin()) with check (is_admin());

-- ===== Аптеки: наличие и цены публичны, правит только своя аптека =====
create policy pharmacy_read on pharmacy for select using (true);
create policy pharmacy_admin on pharmacy for all using (is_admin()) with check (is_admin());
create policy branch_read on pharmacy_branch for select using (active or id in (select my_branch_ids()) or is_admin());
create policy branch_own_update on pharmacy_branch for update using (id in (select my_branch_ids())) with check (id in (select my_branch_ids()));
create policy branch_admin on pharmacy_branch for all using (is_admin()) with check (is_admin());
create policy stock_read on pharmacy_medicine for select using (true);
create policy stock_own_write on pharmacy_medicine for all using (branch_id in (select my_branch_ids())) with check (branch_id in (select my_branch_ids()));
create policy stock_admin on pharmacy_medicine for all using (is_admin()) with check (is_admin());

-- ===== Заказы Local: чтение по ролям, запись только через функции =====
create policy order_buyer_read on retail_order for select using (buyer_id = auth.uid());
create policy order_pharmacy_read on retail_order for select using (branch_id in (select my_branch_ids()));
create policy order_admin_read on retail_order for select using (is_admin());
create policy item_read on retail_order_item for select using (exists (select 1 from retail_order o where o.id = order_id)); -- наследует RLS заказа
create policy history_read on order_status_history for select using (exists (select 1 from retail_order o where o.id = order_id));

-- ===== Global =====
create policy req_buyer_read on international_request for select using (buyer_id = auth.uid());
create policy req_buyer_insert on international_request for insert with check (buyer_id = auth.uid() and app_role() = 'buyer');
create policy req_importer_read on international_request for select using (app_role() = 'importer' or is_admin());
-- Поставщик НЕ читает international_request напрямую: он видит только обезличенное представление supplier_demand.
create policy offer_supplier_own on supplier_offer for all using (supplier_id = auth.uid() and app_role() = 'supplier') with check (supplier_id = auth.uid() and app_role() = 'supplier');
create policy offer_importer_read on supplier_offer for select using (app_role() = 'importer' or is_admin());
create policy offer_buyer_read on supplier_offer for select using (
  exists (select 1 from international_request r where r.id = request_id and r.buyer_id = auth.uid())
  and exists (select 1 from import_verification v where v.offer_id = supplier_offer.id and v.lawful is true));
create policy verif_importer on import_verification for all using (app_role() = 'importer' or is_admin()) with check (app_role() = 'importer' or is_admin());
create policy verif_buyer_read on import_verification for select using (
  exists (select 1 from supplier_offer o join international_request r on r.id = o.request_id where o.id = offer_id and r.buyer_id = auth.uid()));
create policy confirm_buyer on buyer_confirmation for all using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

-- ===== Аналитика и аудит =====
create policy audit_admin_read on audit_log for select using (is_admin());
create policy search_admin_read on search_analytics for select using (is_admin());
create policy demand_read on demand_analytics for select using (app_role() in ('supplier','importer','admin'));

-- Обезличенный спрос для поставщика (без покупателей, городов точнее региона и комментариев).
create or replace view supplier_demand as
  select coalesce(m.name, r.free_text_name) as medicine_name, coalesce(m.dosage, r.dosage) as dosage, coalesce(m.form, r.form) as form,
         sum(r.qty)::int as total_qty, count(*)::int as requests
  from international_request r left join medicine m on m.id = r.medicine_id
  where r.status = 'open' and app_role() in ('supplier','admin')
  group by 1, 2, 3;
grant select on supplier_demand to authenticated;

-- ===== Запись в аудит и историю статусов =====
create or replace function write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default null)
returns void language sql security definer set search_path = public as
$$ insert into audit_log (actor_id, action, entity, entity_id, details) values (auth.uid(), p_action, p_entity, p_entity_id, p_details) $$;

-- ===== Атомарные операции Local =====
-- Цена берётся только из pharmacy_medicine, клиентской цене не доверяем.
create or replace function place_retail_order(p_branch uuid, p_items jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_num text; r record;
begin
  if app_role() is distinct from 'buyer' then raise exception 'Только покупатель может оформлять заказ'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Корзина пуста'; end if;
  v_num := 'MF-' || nextval('retail_order_seq');
  insert into retail_order (id, number, buyer_id, branch_id) values (v_id, v_num, auth.uid(), p_branch);
  for r in select (e->>'medicine_id')::uuid as mid, (e->>'qty')::int as qty from jsonb_array_elements(p_items) e loop
    if r.qty < 1 or r.qty > 99 then raise exception 'Некорректное количество'; end if;
    insert into retail_order_item (order_id, medicine_id, qty, price)
      select v_id, r.mid, r.qty, pm.price from pharmacy_medicine pm where pm.branch_id = p_branch and pm.medicine_id = r.mid;
    if not found then raise exception 'Позиция не продаётся в выбранном филиале'; end if;
  end loop;
  insert into order_status_history (order_id, status, changed_by) values (v_id, 'pending', auth.uid()::text);
  insert into notification (user_id, text) values (auth.uid(), 'Заказ ' || v_num || ' отправлен в аптеку. Резерв появится после подтверждения.');
  perform write_audit('order.create', 'retail_order', v_id::text, null);
  return v_id;
end $$;
create sequence if not exists retail_order_seq start 1001;

create or replace function confirm_retail_order(p_order uuid, p_hours int default 24) returns void
language plpgsql security definer set search_path = public as $$
declare o retail_order; it record; v_have int;
begin
  select * into o from retail_order where id = p_order for update;
  if not found then raise exception 'Заказ не найден'; end if;
  if o.branch_id not in (select my_branch_ids()) then raise exception 'Нет доступа к чужому заказу'; end if;
  if o.status <> 'pending' then raise exception 'Заказ уже обработан'; end if;
  -- блокируем строки остатков в стабильном порядке, чтобы не словить взаимную блокировку
  for it in select i.medicine_id, i.qty from retail_order_item i where i.order_id = p_order order by i.medicine_id loop
    select qty into v_have from pharmacy_medicine where branch_id = o.branch_id and medicine_id = it.medicine_id for update;
    if v_have is null or v_have < it.qty then raise exception 'Недостаточно остатка'; end if;
    update pharmacy_medicine set qty = qty - it.qty, updated_at = now() where branch_id = o.branch_id and medicine_id = it.medicine_id;
  end loop;
  update retail_order set status = 'confirmed', reserved = true, reserve_until = now() + make_interval(hours => p_hours) where id = p_order;
  insert into order_status_history (order_id, status, changed_by) values (p_order, 'confirmed', auth.uid()::text);
  insert into notification (user_id, text) values (o.buyer_id, 'Аптека подтвердила заказ ' || o.number || '. Резерв на ' || p_hours || ' ч.');
  perform write_audit('order.confirm', 'retail_order', p_order::text, null);
end $$;

-- Возврат резерва при отмене или истечении
create or replace function release_retail_order(p_order uuid, p_new_status retail_status) returns void
language plpgsql security definer set search_path = public as $$
declare o retail_order;
begin
  if p_new_status not in ('cancelled','expired') then raise exception 'Недопустимый статус'; end if;
  select * into o from retail_order where id = p_order for update;
  if not found then raise exception 'Заказ не найден'; end if;
  if not (o.buyer_id = auth.uid() or o.branch_id in (select my_branch_ids()) or is_admin() or auth.uid() is null) then raise exception 'Нет доступа'; end if;
  if o.reserved then
    update pharmacy_medicine pm set qty = pm.qty + i.qty from retail_order_item i
      where i.order_id = p_order and pm.branch_id = o.branch_id and pm.medicine_id = i.medicine_id;
  end if;
  update retail_order set status = p_new_status, reserved = false where id = p_order;
  insert into order_status_history (order_id, status, changed_by) values (p_order, p_new_status, coalesce(auth.uid()::text, 'system'));
  perform write_audit('order.' || p_new_status, 'retail_order', p_order::text, null);
end $$;

-- Для cron (pg_cron или Vercel Cron через service role): истечение резервов
create or replace function expire_reservations() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from retail_order where status in ('confirmed','ready') and reserve_until < now() loop
    perform release_retail_order(r.id, 'expired'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function expire_reservations() from public, anon, authenticated;

-- Прямое изменение ролей и чужих заказов запрещено: функции доступны только вошедшим пользователям
revoke all on function place_retail_order(uuid, jsonb), confirm_retail_order(uuid, int), release_retail_order(uuid, retail_status) from public, anon;
