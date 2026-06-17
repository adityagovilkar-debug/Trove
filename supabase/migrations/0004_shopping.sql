-- =====================================================================
-- Trove — shopping list
-- Run this in the Supabase SQL Editor after 0001-0003.
-- A simple household-shared shopping list. Items can be added manually, from
-- restock predictions, or from finished stock. `item_id` optionally links back
-- to the catalog so a bought item can pre-fill the Add form later.
-- =====================================================================

create table if not exists shopping_list_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  name          text not null,
  note          text,
  quantity      numeric,
  unit          text,
  item_id       uuid references items on delete set null,
  source        text not null default 'manual',   -- manual | restock | finished
  is_bought     boolean not null default false,
  bought_at     timestamptz,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_shopping_household
  on shopping_list_items(household_id, is_bought);

alter table shopping_list_items enable row level security;

drop policy if exists shopping_member_all on shopping_list_items;
create policy shopping_member_all on shopping_list_items
  for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));
