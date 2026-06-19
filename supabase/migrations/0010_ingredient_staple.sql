-- =====================================================================
-- Trove — pantry-staple ingredients
-- Run this in the Supabase SQL Editor after 0001-0009.
-- Marks a recipe ingredient as a long-lived pantry staple (oil, masala, salt,
-- rice). Staples are NOT auto-deducted from stock when you tap "Cooked it" —
-- you mark them finished yourself when they actually run out. Everything else
-- (a chicken breast, a block of paneer) is consumed on cook as before.
-- =====================================================================

alter table recipe_ingredients
  add column if not exists staple boolean not null default false;
