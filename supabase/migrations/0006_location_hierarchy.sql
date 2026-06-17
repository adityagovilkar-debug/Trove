-- =====================================================================
-- Trove — nested locations
-- Run this in the Supabase SQL Editor after 0001-0005.
-- Lets locations form a tree (Living Room › TV Unit › Left Drawer) so you
-- know exactly where to look. Deleting a parent promotes its children to the
-- top level rather than deleting them.
-- =====================================================================

alter table locations
  add column if not exists parent_id uuid references locations(id) on delete set null;

create index if not exists idx_locations_parent on locations(parent_id);
