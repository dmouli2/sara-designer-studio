-- Fabrics move out of the hard-coded list in src/lib/mock.ts and into the
-- database so the admin can add/edit/remove them (with per-metre prices)
-- from the new-order wizard. Orders keep storing the fabric as a plain
-- `material` text snapshot, so editing or deleting a fabric never touches
-- existing orders.

create table fabrics (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  price      numeric not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same posture as staff/orders: no policies — anon-key access is deny-all,
-- and the app's service-role key bypasses RLS.
alter table fabrics enable row level security;

-- Seed with the previously hard-coded list so the wizard looks unchanged.
insert into fabrics (name, price) values
  ('Cotton',          120),
  ('Silk',            350),
  ('Georgette',       280),
  ('Crepe',           220),
  ('Net / Lace',      180),
  ('Chiffon',         200),
  ('Kanjivaram Silk', 650),
  ('Velvet',          400);
