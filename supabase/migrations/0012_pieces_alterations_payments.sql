-- Multi-piece orders, post-delivery alterations, and a payment ledger.
--
-- All three columns are additive and defaulted, and NOTHING is backfilled:
-- every row already in the table keeps reading exactly as it does today.
--
--   pieces      null  -> the order is a single garment (the only kind that
--                        existed before this migration). Null is meaningful:
--                        it is not "no pieces", it is "not split", and the
--                        whole delivery flow stays on its current path.
--   alterations '[]'  -> never came back for an alteration.
--   payments    '[]'  -> no money collected after placement.
--
-- orders.status gains a 'partly_delivered' value in the application types.
-- The column is a bare `text` with no CHECK constraint (see 0001_init.sql),
-- so that needs no schema change here — noted so the next reader doesn't go
-- looking for a missing constraint update.
alter table orders
  add column pieces      jsonb,
  add column alterations jsonb not null default '[]'::jsonb,
  add column payments    jsonb not null default '[]'::jsonb;

comment on column orders.pieces is
  'Garments in a multi-piece order, each with its own due date and delivery state: '
  '[{id,label,due,status,deliveredAt}]. NULL means the order is a single garment '
  '(every order placed before this migration, and every un-split order since).';

comment on column orders.alterations is
  'Post-delivery alteration episodes, oldest first: '
  '[{id,reason,pieceLabel,receivedAt,promisedAt,completedAt,redeliveredAt}]. '
  'An alteration never changes orders.status — a delivered order stays delivered '
  'so revenue and the delivered count are unaffected. The open record is the one '
  'with redeliveredAt null.';

comment on column orders.payments is
  'Money collected AFTER placement, one entry per hand-over: '
  '[{id,amount,method,at,pieceId}]. An audit trail over the existing two-entry '
  'model, not a replacement: final_payment stays the sum of these and '
  'final_payment_method the latest method, so balance arithmetic is unchanged. '
  'The advance is not in here — it has its own columns.';

-- No index on the new columns on purpose: alterations and pieces are read
-- from rows already being fetched by id or by the existing status/staff
-- indexes, never searched on their own.
