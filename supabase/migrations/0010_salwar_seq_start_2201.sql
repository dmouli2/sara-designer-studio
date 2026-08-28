-- Corrects 0009: the salwar book's B.No series starts at 2201, not 2301.
-- Still no salwar order has been placed (salwar_order_seq had never been
-- advanced past the restart in 0009), so this cannot collide with an
-- existing id — the first salwar order gets S2201.
--
-- blouse_order_seq is untouched, as in 0009.
alter sequence salwar_order_seq restart with 2201;
