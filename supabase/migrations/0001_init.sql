-- Phase 2: staff accounts + orders, run once via the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table staff (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  name          text not null,
  role          text not null check (role in ('admin', 'master', 'tailor')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table orders (
  id                   text primary key,
  customer             text not null,
  phone                text not null,
  dress                text not null,
  material             text not null,
  status               text not null,
  amount               numeric not null,
  advance              numeric not null,
  due                  date not null,
  master_id            uuid references staff(id),
  tailor_id            uuid references staff(id),
  measurements         jsonb not null,
  line_items           jsonb not null,
  notes                text not null default '',
  sketch_data_url      text,
  reference_image_url  text,
  created_at           timestamptz not null default now()
);

create index orders_status_idx on orders (status);
create index orders_master_id_idx on orders (master_id);
create index orders_tailor_id_idx on orders (tailor_id);

-- All app access goes through the server-side service-role key (which
-- bypasses RLS), never the anon/authenticated Data API roles. Enabling RLS
-- with no policies means those roles get zero access by default, so a
-- table holding password hashes can never be read through the public API.
alter table staff enable row level security;
alter table orders enable row level security;
