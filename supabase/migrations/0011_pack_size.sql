-- =====================================================================
-- Trove — pack / multi-unit quantity
-- Run this in the Supabase SQL Editor after 0001-0010.
-- Lets a stock entry describe what one unit *contains*, separately from how
-- many units you hold. e.g. "4 packets of chips, 50 g each" = quantity 4,
-- unit 'packet', pack_size 50, pack_size_unit 'g' → 200 g total content.
-- Both new columns are optional; when pack_size is null the entry behaves
-- exactly as before (a flat quantity + unit). "Use 1" still finishes one unit.
-- =====================================================================

alter table inventory
  add column if not exists pack_size      numeric,
  add column if not exists pack_size_unit text;

-- Surface the new columns through the read model. CREATE OR REPLACE VIEW can
-- only append columns (not reorder), so they go at the end of the select.
create or replace view inventory_detail
with (security_invoker = true) as
select
  inv.id,
  inv.household_id,
  inv.quantity,
  inv.unit,
  inv.price,
  inv.currency,
  inv.purchase_date,
  inv.expiry_date,
  inv.opened_date,
  inv.status,
  inv.finished_at,
  inv.notes,
  inv.created_at,
  inv.updated_at,
  it.id          as item_id,
  it.name        as item_name,
  it.brand       as item_brand,
  it.barcode     as item_barcode,
  it.image_url   as item_image_url,
  it.attributes  as item_attributes,
  d.id           as domain_id,
  d.key          as domain_key,
  d.name         as domain_name,
  d.has_expiry   as domain_has_expiry,
  c.id           as category_id,
  c.name         as category_name,
  l.id           as location_id,
  l.name         as location_name,
  s.id           as store_id,
  s.name         as store_name,
  case
    when inv.expiry_date is null then null
    else (inv.expiry_date - current_date)
  end            as days_to_expiry,
  inv.pack_size,
  inv.pack_size_unit
from inventory inv
join items     it on it.id = inv.item_id
left join domains    d on d.id = it.domain_id
left join categories c on c.id = it.category_id
left join locations  l on l.id = inv.location_id
left join stores     s on s.id = inv.store_id;
