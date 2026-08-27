-- The Salwar order-id series must line up with the B.No printed in the
-- physical salwar order book, which starts at 2301 — not the 2131 guessed
-- when 0003_order_id_sequences.sql was written. No salwar order has been
-- placed yet (salwar_order_seq has never been advanced), so restarting the
-- sequence is safe and cannot collide with an existing id: the first salwar
-- order gets S2301.
--
-- blouse_order_seq is deliberately left alone — it is already in step with
-- the blouse book (B2501, B2502 placed; next is B2503).
alter sequence salwar_order_seq restart with 2301;
