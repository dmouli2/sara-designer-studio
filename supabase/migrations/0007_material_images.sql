-- Material (fabric) photos, captured with the camera during the new-order
-- wizard right after choosing the material source. Same shape as
-- reference_image_urls (max 8, enforced app-side — see storeMaterialImages
-- in src/app/actions/orders.ts): a native Postgres array keeps this atomic
-- with the order row, no separate images table needed since there's no
-- per-image metadata to track.
alter table orders add column material_image_urls text[] not null default '{}';
