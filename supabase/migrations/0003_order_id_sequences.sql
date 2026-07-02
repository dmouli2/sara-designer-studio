-- Order ids move from a client-random "SDS-xxx" suffix to a strictly
-- sequential, per-category series generated atomically in Postgres:
--   Salwar orders: S2131, S2132, ...
--   Blouse orders: B2401, B2402, ...
-- A real sequence (not "select max(id)+1 from orders") stays correct under
-- concurrent order creation and is only ever advanced by next_order_id()
-- below — the app's automated test suite never touches this database, so
-- it can't disturb the series. Only genuine order creation through the
-- live app calls this function.
create sequence salwar_order_seq start 2131 increment 1;
create sequence blouse_order_seq start 2401 increment 1;

create function next_order_id(dress_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_val bigint;
begin
  if dress_type = 'Salwar' then
    seq_val := nextval('salwar_order_seq');
    return 'S' || seq_val;
  else
    seq_val := nextval('blouse_order_seq');
    return 'B' || seq_val;
  end if;
end;
$$;

grant execute on function next_order_id(text) to service_role;
