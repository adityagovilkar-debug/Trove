-- =====================================================================
-- Trove — recipes
-- Run this in the Supabase SQL Editor after 0001-0007.
-- Home-cooked dishes with their ingredients. Ingredients can optionally link
-- to the items catalog; otherwise they match your stock by name. This powers
-- "what can I cook now" and "add missing ingredients to my shopping list".
-- =====================================================================

create table if not exists recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  name          text not null,
  description   text,
  instructions  text,
  servings      int,
  prep_minutes  int,
  cook_minutes  int,
  category      text,                 -- cuisine / meal type, free text
  image_url     text,
  source        text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_recipes_household on recipes(household_id);

create table if not exists recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes on delete cascade,
  household_id  uuid not null references households on delete cascade,
  name          text not null,
  quantity      numeric,
  unit          text,
  item_id       uuid references items on delete set null,
  optional      boolean not null default false,
  sort_order    int not null default 0
);

create index if not exists idx_recipe_ing_recipe on recipe_ingredients(recipe_id);

-- keep updated_at fresh on recipes
drop trigger if exists trg_recipes_updated on recipes;
create trigger trg_recipes_updated before update on recipes
  for each row execute function set_updated_at();

-- Row Level Security — household membership, same as everything else.
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;

drop policy if exists recipes_member_all on recipes;
create policy recipes_member_all on recipes
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

drop policy if exists recipe_ing_member_all on recipe_ingredients;
create policy recipe_ing_member_all on recipe_ingredients
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
