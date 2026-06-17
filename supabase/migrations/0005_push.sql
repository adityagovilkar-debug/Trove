-- =====================================================================
-- Trove — web push subscriptions
-- Run this in the Supabase SQL Editor after 0001-0004.
-- Stores each device's push endpoint so the daily job can notify members
-- about expiries and upcoming payments.
-- =====================================================================

create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references households on delete cascade,
  user_id       uuid not null references profiles on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_push_household on push_subscriptions(household_id);

alter table push_subscriptions enable row level security;

-- Users manage only their own device subscriptions. The send job uses the
-- service-role key and bypasses RLS.
drop policy if exists push_self on push_subscriptions;
create policy push_self on push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
