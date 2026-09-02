-- The customer brought a garment of their own to cut to — the shop's
-- "alavu blouse" (அளவு blouse) — instead of standing for measurements.
--
-- On those orders no measurement is taken at all: the sample garment IS the
-- measurement, and it sits with the order until the finished work goes home.
-- Until now the app had no way to say that, so such an order arrived at the
-- master and tailor as an order with seventeen blank measurement boxes,
-- indistinguishable from one where somebody had simply forgotten to fill
-- them in.
--
-- Boolean, not null, default false — false is exactly what every existing
-- row means, so nothing is backfilled and no existing order changes in any
-- way. `measurements` is untouched by this flag in both directions: an order
-- switched to a sample garment keeps whatever was recorded before (hidden,
-- not deleted), so switching back brings it straight back.
alter table orders add column sample_garment boolean not null default false;

comment on column orders.sample_garment is
  'True when the customer left a garment of their own to cut to (the shop''s '
  '"measurement blouse"/"alavu blouse") instead of being measured. The '
  'measurement form is not shown for these orders, and the garment is held '
  'by the shop until delivery. False on every order measured the normal '
  'way, which is every order taken before this column existed.';
