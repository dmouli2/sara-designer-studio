-- SECURITY DEFINER functions grant EXECUTE to PUBLIC by default, which the
-- Supabase advisor flagged: anon/authenticated could call
-- /rest/v1/rpc/next_order_id directly and burn through the order-id
-- sequence without ever creating an order. Only the service-role key
-- (server-side app code) should ever be able to advance the series.
revoke execute on function next_order_id(text) from public;
revoke execute on function next_order_id(text) from anon;
revoke execute on function next_order_id(text) from authenticated;
