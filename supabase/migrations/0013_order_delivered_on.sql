-- The day an order was actually handed over.
--
-- Until now nothing recorded it. `due` is what the customer was promised and
-- `created_at` is when the order was taken; the hand-over itself left no date
-- behind at all, so "when did Kavya collect this?" was unanswerable.
--
-- It matters more now that the admin chooses the date rather than the app
-- stamping it: on a multi-piece order the day lands on each piece's
-- deliveredAt, but a single-garment order — which is most of them — had
-- nowhere to put it.
--
-- Additive and nullable, nothing backfilled: every existing row reads null,
-- meaning "delivered before this was recorded, or not delivered at all".
-- Deliberately NOT inferred from created_at or due for old rows — a guessed
-- date that looks like a record is worse than an honest blank.
alter table orders add column delivered_on date;

comment on column orders.delivered_on is
  'The day the order was handed over, as chosen by the admin (defaults to '
  'today, may be backdated, never postdated). Null for orders not yet '
  'delivered and for those delivered before this column existed.';
