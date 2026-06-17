-- =====================================================================
-- Trove — auto-add finished groceries to the shopping list
-- Run this in the Supabase SQL Editor after 0001-0006.
-- When ON, finishing a consumable adds it to the shopping list (deduped).
-- =====================================================================

alter table households
  add column if not exists auto_shopping boolean not null default true;
