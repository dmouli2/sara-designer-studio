-- An advance paid partly in cash and partly by UPI.
--
-- The shop takes money two ways and a customer often uses both in one
-- payment. Money collected after placement already had somewhere to record
-- that — the `payments` ledger, where a split collection simply writes one
-- entry per method — but the advance is not in the ledger: it has its own
-- `advance` / `advance_method` pair, which can only describe one method.
--
-- Additive and nullable, nothing backfilled. Null means "not split": read
-- advance_method, exactly as before. That covers every existing row.
alter table orders add column advance_split jsonb;

comment on column orders.advance_split is
  'How a split advance arrived: {"cash":600,"upi":400}. NULL when the advance '
  'came by a single method (or predates this column) — advance_method says '
  'which. advance_method is NULL when this is set, since no one method applies.';
