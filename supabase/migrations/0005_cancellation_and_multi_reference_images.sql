-- Order cancellation: a dedicated charge amount, separate from the order's
-- original amount so the UI can strike through the original total and show
-- only the cancellation charge as what's actually due.
alter table orders add column cancellation_charge numeric;

-- Reference photos move from a single image to a gallery (max 8, enforced
-- app-side — see storeReferenceImages in src/app/actions/orders.ts). A
-- native Postgres array keeps this atomic with the order row, consistent
-- with how measurements/line_items already use jsonb for structured data.
-- No data migration needed: orders are being cleared as part of this change.
alter table orders add column reference_image_urls text[] not null default '{}';
alter table orders drop column reference_image_url;
