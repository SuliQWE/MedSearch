-- Каталог препаратов для админки (редактируется из интерфейса) и бакет для картинок.
-- Выполните в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Доступ только с сервера по service role key; для anon-ключа таблица закрыта (RLS без политик).

create table if not exists catalog_medicine (
  id text primary key,
  name text not null,
  inn text not null,
  dosage text not null,
  form text not null,
  manufacturer text not null default '—',
  country text not null default '—',
  description text not null default '',
  categories text[] not null default '{}',
  synonyms text[] not null default '{}',
  prescription boolean not null default false,
  image_url text,
  created_at timestamptz not null default now()
);

alter table catalog_medicine enable row level security;

-- Публичный бакет для картинок упаковок (чтение по ссылке; запись только с сервера через service role).
insert into storage.buckets (id, name, public)
values ('medicine-images', 'medicine-images', true)
on conflict (id) do nothing;
