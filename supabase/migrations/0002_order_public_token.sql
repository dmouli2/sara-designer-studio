-- Public, unguessable identifier for the customer-facing order-tracking link.
-- orders.id (e.g. "SDS-042") is only a random 3-digit suffix and must never
-- be used in a public URL; this column is what /track/[token] looks up by.
alter table orders
  add column public_token uuid not null default gen_random_uuid();

create unique index orders_public_token_key on orders (public_token);
