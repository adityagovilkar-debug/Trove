-- =====================================================================
-- Trove — subscriptions (recurring payments)
-- Run this in the Supabase SQL Editor after 0001/0002.
-- Tracks recurring payments: name, price, billing cycle, next payment, etc.
-- =====================================================================

create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  name          text not null,
  category      text,                              -- Streaming, Software, Utilities…
  price         numeric not null default 0,
  currency      text not null default 'INR',
  -- Billing cadence. cycle_days is used when billing_cycle = 'custom',
  -- and also cached for other cycles to make "monthly equivalent" math easy.
  billing_cycle text not null default 'monthly',   -- weekly|monthly|quarterly|yearly|custom
  cycle_days    int,                               -- for custom cycles
  next_payment  date,
  start_date    date default current_date,
  payment_method text,                             -- "HDFC card", "UPI", …
  status        text not null default 'active',    -- active|paused|cancelled
  notes         text,
  created_by    uuid references profiles on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_subs_household on subscriptions(household_id);
create index if not exists idx_subs_next on subscriptions(household_id, next_payment)
  where status = 'active';

drop trigger if exists trg_subscriptions_updated on subscriptions;
create trigger trg_subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- Row Level Security — same household-membership rule as everything else.
alter table subscriptions enable row level security;

drop policy if exists subscriptions_member_all on subscriptions;
create policy subscriptions_member_all on subscriptions
  for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));
