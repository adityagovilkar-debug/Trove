-- =====================================================================
-- Larder — initial schema
-- Home inventory, household-shared, domain-extensible.
--
-- Design notes:
--  * Everything is scoped to a `household`. Multiple members share one
--    inventory. RLS keys off household membership (see is_household_member).
--  * `items` is the *catalog concept* of a thing ("Basmati Rice"). It
--    survives repurchase, which is what powers long-term trends.
--  * `inventory` rows are actual physical stock. Marking one finished/
--    expired KEEPS the row (status flips) so history -> trends/waste.
--  * `domains` (Grocery / Electronics / Book / Other) + a per-item JSONB
--    `attributes` bag make the app extensible to any category without
--    migrating core tables. Iteration 1 ships Grocery; later domains are
--    just new rows + field configs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- fuzzy name search

-- ---------------------------------------------------------------------
-- Core identity / household tables
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My Home',
  base_currency text not null default 'INR',
  created_at  timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households on delete cascade,
  user_id      uuid not null references profiles on delete cascade,
  role         text not null default 'member',   -- 'owner' | 'member'
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists idx_members_user on household_members(user_id);

-- ---------------------------------------------------------------------
-- Reference data (all household-scoped & editable)
-- ---------------------------------------------------------------------

-- A "domain" is a top-level kind of thing you store. has_expiry toggles
-- whether expiry tracking is relevant (groceries yes, electronics no).
create table if not exists domains (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  key          text not null,                 -- 'grocery', 'electronics', 'book'
  name         text not null,                 -- 'Grocery'
  icon         text default 'package',        -- lucide icon name
  has_expiry   boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (household_id, key)
);

-- Item types within a domain (Grains, Dairy, Toiletries...).
create table if not exists categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  domain_id    uuid references domains on delete set null,
  name         text not null,
  created_at   timestamptz not null default now()
);

-- Where things are physically kept.
create table if not exists locations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

-- Where things were bought (normalized for "where do I buy rice" trends).
create table if not exists stores (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- The catalog: a reusable concept of a product
-- ---------------------------------------------------------------------
create table if not exists items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  domain_id    uuid references domains on delete set null,
  category_id  uuid references categories on delete set null,
  name         text not null,
  brand        text,
  barcode      text,                          -- UPC/EAN from scanner
  default_unit text default 'pcs',            -- g, ml, pcs, pack...
  attributes   jsonb not null default '{}'::jsonb,  -- domain-specific fields
  image_url    text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_items_household on items(household_id);
create index if not exists idx_items_barcode   on items(household_id, barcode);
-- Fast "do I have this?" search.
create index if not exists idx_items_name_trgm on items using gin (lower(name) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Actual physical stock (history-preserving)
-- ---------------------------------------------------------------------
create table if not exists inventory (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  item_id       uuid not null references items on delete cascade,
  location_id   uuid references locations on delete set null,
  store_id      uuid references stores on delete set null,
  quantity      numeric not null default 1,
  unit          text,
  price         numeric,                       -- total paid for this stock
  currency      text not null default 'INR',
  purchase_date date not null default current_date,
  expiry_date   date,
  opened_date   date,
  status        text not null default 'active',-- active | finished | expired | discarded
  finished_at   timestamptz,
  notes         text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_inv_household on inventory(household_id);
create index if not exists idx_inv_status    on inventory(household_id, status);
create index if not exists idx_inv_expiry    on inventory(household_id, expiry_date)
  where status = 'active';
create index if not exists idx_inv_item      on inventory(item_id);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_inventory_updated on inventory;
create trigger trg_inventory_updated before update on inventory
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Convenience view: one flat row per stock entry with all labels joined.
-- The app reads this for lists, search, expiry and trends.
-- ---------------------------------------------------------------------
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
  end            as days_to_expiry
from inventory inv
join items     it on it.id = inv.item_id
left join domains    d on d.id = it.domain_id
left join categories c on c.id = it.category_id
left join locations  l on l.id = inv.location_id
left join stores     s on s.id = inv.store_id;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles          enable row level security;
alter table households         enable row level security;
alter table household_members  enable row level security;
alter table domains            enable row level security;
alter table categories         enable row level security;
alter table locations          enable row level security;
alter table stores             enable row level security;
alter table items              enable row level security;
alter table inventory          enable row level security;

-- Membership check. security definer so the policy can read the
-- membership table without recursing into its own RLS.
create or replace function is_household_member(hid uuid)
returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- profiles: see/edit your own; also see profiles of co-members.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_comembers on profiles;
create policy profiles_comembers on profiles
  for select using (
    exists (
      select 1
      from household_members m1
      join household_members m2 on m1.household_id = m2.household_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

-- households: members can read; owners can update.
drop policy if exists households_member_read on households;
create policy households_member_read on households
  for select using (is_household_member(id));

drop policy if exists households_owner_write on households;
create policy households_owner_write on households
  for update using (
    exists (select 1 from household_members
            where household_id = households.id
              and user_id = auth.uid() and role = 'owner')
  );

-- household_members: you can see rows for households you belong to,
-- and insert yourself (used when accepting an invite / first signup).
drop policy if exists members_read on household_members;
create policy members_read on household_members
  for select using (is_household_member(household_id));

drop policy if exists members_self_insert on household_members;
create policy members_self_insert on household_members
  for insert with check (user_id = auth.uid());

-- Generic "member can do anything within their household" policy for the
-- household-scoped data tables.
do $$
declare t text;
begin
  foreach t in array array['domains','categories','locations','stores','items','inventory']
  loop
    execute format('drop policy if exists %1$s_member_all on %1$s;', t);
    execute format(
      'create policy %1$s_member_all on %1$s for all
         using (is_household_member(household_id))
         with check (is_household_member(household_id));', t);
  end loop;
end $$;

-- =====================================================================
-- New-user bootstrap: profile + a starter household, seeded with sensible
-- defaults so the very first screen already works.
-- =====================================================================
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

  -- seed domains
  insert into domains (household_id, key, name, icon, has_expiry, sort_order) values
    (hh_id, 'grocery',     'Grocery',     'shopping-basket', true,  0),
    (hh_id, 'household',    'Household',   'spray-can',       true,  1),
    (hh_id, 'electronics',  'Electronics', 'cpu',             false, 2),
    (hh_id, 'book',         'Book',        'book',            false, 3),
    (hh_id, 'other',        'Other',       'package',         false, 9);
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
