-- Scan-to-draft-order: a photographed order-book spread is read by a vision
-- model and parked here until the admin verifies it. Drafts use their own
-- uuid ids and NEVER touch next_order_id()/the order sequences — a draft
-- only becomes a real order when the admin confirms it through the normal
-- createOrder path, which is when (and only when) an S…/B… id is reserved.

create table draft_orders (
  id                 uuid primary key default gen_random_uuid(),
  -- "Blouse" / "Salwar" as auto-detected from the slip's printed header,
  -- or '' when the model couldn't tell (admin picks during review).
  dress              text not null default '',
  scan_image_path    text not null,
  -- The raw SlipExtraction JSON (see src/types) — kept verbatim so the
  -- review screen can always show exactly what the model read.
  extraction         jsonb not null,
  warnings           jsonb not null default '[]',
  status             text not null default 'draft'
                     check (status in ('draft', 'confirmed', 'discarded')),
  confirmed_order_id text,
  created_at         timestamptz not null default now()
);

-- Same posture as staff/orders/fabrics: no policies — anon-key access is
-- deny-all, and the app's service-role key bypasses RLS.
alter table draft_orders enable row level security;
