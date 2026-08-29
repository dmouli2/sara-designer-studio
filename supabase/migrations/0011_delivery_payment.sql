-- Collecting the balance at delivery.
--
-- Until now `advance` was the only record of money received, and delivering an
-- order didn't touch it — so `amount - advance` stayed positive forever. Every
-- delivered order kept showing a balance on its card, and the Reports page
-- counted all of them in pendingBalance/balanceDue, overstating what the shop
-- was actually owed.
--
-- Money received is now two entries: the advance taken at placement and the
-- final payment collected at delivery, each with the method it came in by.
-- Balance is amount - advance - final_payment (see orderBalance in
-- src/lib/utils.ts — never recompute it inline).
alter table orders
  add column advance_method text
    check (advance_method in ('cash', 'upi')),
  add column final_payment numeric not null default 0
    check (final_payment >= 0),
  add column final_payment_method text
    check (final_payment_method in ('cash', 'upi'));

comment on column orders.advance_method is
  'How the advance was paid. Null for orders taken before this was captured, and for a zero advance.';
comment on column orders.final_payment is
  'Balance collected at delivery. Zero until the order is delivered.';
comment on column orders.final_payment_method is
  'How the final payment came in. Null where it was never recorded (orders delivered before this migration).';

-- Orders already delivered were, in reality, paid for at the counter — the app
-- simply had nowhere to record it. Settle them so their balance reads zero and
-- the Reports figures stop counting them as outstanding. The method stays null:
-- it is genuinely unknown, and inventing "cash" would be a false record.
update orders
   set final_payment = amount - advance
 where status = 'delivered'
   and amount - advance > 0;
