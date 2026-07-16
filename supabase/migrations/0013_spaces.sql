-- =====================================================================
-- Trove — Kitchen / Home spaces (Phase 1 of the two-space split)
-- Run this in the Supabase SQL Editor after 0001-0012.
--
-- The app splits into two "spaces": Kitchen (food pantry — the churny,
-- expiry-driven half) and Home (durables, utilities — the calm half that one
-- person can keep accurate). A domain belongs to exactly one space. Per the
-- owner's call, only Grocery is Kitchen; Household consumables (cleaning,
-- toiletries) are low-churn and live in Home.
-- =====================================================================

-- 1) Domains gain a space.
alter table domains
  add column if not exists space text not null default 'home';

update domains set space = 'kitchen' where key = 'grocery';

-- 2) New Home-space domains for every EXISTING household (new signups get
--    them from the updated handle_new_user below). Idempotent via the
--    (household_id, key) unique constraint.
insert into domains (household_id, key, name, icon, has_expiry, sort_order, space)
select h.id, d.key, d.name, d.icon, d.has_expiry, d.sort_order, 'home'
from households h
cross join (
  values
    ('luggage', 'Luggage & Travel', 'briefcase', false, 4),
    ('plant',   'Plants',           'sprout',    false, 5),
    ('tools',   'Tools & Hardware', 'wrench',    false, 6)
) as d(key, name, icon, has_expiry, sort_order)
on conflict (household_id, key) do nothing;

-- 3) Expose the space on the read model. CREATE OR REPLACE VIEW can only
--    append columns, so domain_space goes at the very end.
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
  inv.pack_size_unit,
  d.space        as domain_space
from inventory inv
join items     it on it.id = inv.item_id
left join domains    d on d.id = it.domain_id
left join categories c on c.id = it.category_id
left join locations  l on l.id = inv.location_id
left join stores     s on s.id = inv.store_id;

-- 4) New-user bootstrap now seeds spaces + the new Home domains.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public as $$
declare
  hh_id uuid;
  grocery_id uuid;
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  -- create a personal household + owner membership
  insert into households (name) values ('My Home') returning id into hh_id;
  insert into household_members (household_id, user_id, role)
  values (hh_id, new.id, 'owner');

  -- seed domains (space-aware)
  insert into domains (household_id, key, name, icon, has_expiry, sort_order, space) values
    (hh_id, 'grocery',     'Grocery',          'shopping-basket', true,  0, 'kitchen'),
    (hh_id, 'household',   'Household',        'spray-can',       true,  1, 'home'),
    (hh_id, 'electronics', 'Electronics',      'cpu',             false, 2, 'home'),
    (hh_id, 'book',        'Book',             'book',            false, 3, 'home'),
    (hh_id, 'luggage',     'Luggage & Travel', 'briefcase',       false, 4, 'home'),
    (hh_id, 'plant',       'Plants',           'sprout',          false, 5, 'home'),
    (hh_id, 'tools',       'Tools & Hardware', 'wrench',          false, 6, 'home'),
    (hh_id, 'other',       'Other',            'package',         false, 9, 'home');
  -- (RETURNING INTO can't be used on a multi-row insert; fetch separately)
  select id into grocery_id from domains
    where household_id = hh_id and key = 'grocery';

  -- seed locations
  insert into locations (household_id, name) values
    (hh_id, 'Pantry'), (hh_id, 'Refrigerator'), (hh_id, 'Freezer'),
    (hh_id, 'Kitchen Cabinet'), (hh_id, 'Bathroom'), (hh_id, 'Store Room');

  -- seed a few grocery categories
  insert into categories (household_id, domain_id, name) values
    (hh_id, grocery_id, 'Grains & Rice'),
    (hh_id, grocery_id, 'Pulses & Lentils'),
    (hh_id, grocery_id, 'Spices & Masala'),
    (hh_id, grocery_id, 'Dairy & Eggs'),
    (hh_id, grocery_id, 'Vegetables & Fruit'),
    (hh_id, grocery_id, 'Snacks'),
    (hh_id, grocery_id, 'Beverages'),
    (hh_id, grocery_id, 'Oils & Condiments'),
    (hh_id, grocery_id, 'Toiletries');

  return new;
end; $$;
