-- =====================================================================
-- Trove — meal planning
-- Run this in the Supabase SQL Editor after 0001-0008.
-- Schedule a recipe for a date so you can shop for it ahead of time.
-- =====================================================================

create table if not exists meal_plans (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  recipe_id     uuid not null references recipes on delete cascade,
  plan_date     date not null,
  note          text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_meal_plans_household on meal_plans(household_id, plan_date);

alter table meal_plans enable row level security;

drop policy if exists meal_plans_member_all on meal_plans;
create policy meal_plans_member_all on meal_plans
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
