-- =====================================================================
-- Trove — recipe cuisine
-- Run this in the Supabase SQL Editor after 0001-0011.
-- Splits "cuisine" (Indian, Italian, Thai…) out as its own field, alongside
-- the existing free-text category (Dinner, Dessert, Snack…). Optional.
-- =====================================================================

alter table recipes
  add column if not exists cuisine text;
