-- =====================================================================
-- Trove — Fix-it tasks + Plans (Phase 2 of the two-space split)
-- Run this in the Supabase SQL Editor after 0001-0013.
--
-- home_tasks: the house's fridge-note — "fix the hinge on the balcony door".
-- Deliberately ownerless (anyone can add or check off) and simpler than a
-- project tracker. Optionally pinned to a location.
--
-- plans: the ideas board for renovations and major purchases — cupboards,
-- balcony rework — with a status lane and a rough budget.
-- =====================================================================

create table if not exists home_tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  title         text not null,
  notes         text,
  location_id   uuid references locations on delete set null,
  priority      text not null default 'normal',   -- 'low' | 'normal' | 'high'
  is_done       boolean not null default false,
  done_at       timestamptz,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_home_tasks_household on home_tasks(household_id, is_done);

drop trigger if exists trg_home_tasks_updated on home_tasks;
create trigger trg_home_tasks_updated before update on home_tasks
  for each row execute function set_updated_at();

create table if not exists plans (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  title         text not null,
  notes         text,
  category      text,                              -- Renovation / Major purchase / …
  status        text not null default 'idea',      -- 'idea'|'planned'|'in_progress'|'done'
  budget        numeric,                           -- rough estimate, household currency
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_plans_household on plans(household_id, status);

drop trigger if exists trg_plans_updated on plans;
create trigger trg_plans_updated before update on plans
  for each row execute function set_updated_at();

-- Row Level Security — household membership, same as everything else.
alter table home_tasks enable row level security;
alter table plans enable row level security;

drop policy if exists home_tasks_member_all on home_tasks;
create policy home_tasks_member_all on home_tasks
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

drop policy if exists plans_member_all on plans;
create policy plans_member_all on plans
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
