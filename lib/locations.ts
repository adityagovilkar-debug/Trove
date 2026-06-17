import type { Location } from "./types";

export const PATH_SEP = " › ";

// Build a map of location id → full path ("Living Room › TV Unit › Left Drawer")
// so you can see exactly where a thing lives, not just the leaf name.
export function buildPathMap(locations: Location[]): Map<string, string> {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const cache = new Map<string, string>();
  const visiting = new Set<string>();

  function path(id: string): string {
    const cached = cache.get(id);
    if (cached) return cached;
    const l = byId.get(id);
    if (!l) return "";
    if (visiting.has(id)) return l.name; // guard against accidental cycles
    visiting.add(id);
    const full = l.parent_id ? `${path(l.parent_id)}${PATH_SEP}${l.name}` : l.name;
    visiting.delete(id);
    cache.set(id, full);
    return full;
  }

  for (const l of locations) path(l.id);
  return cache;
}

export interface LocOption {
  id: string;
  label: string; // full path
  depth: number;
}

// Locations as pick-list options, labelled with their full path and sorted so
// the tree reads top-down.
export function locationOptions(locations: Location[]): LocOption[] {
  const paths = buildPathMap(locations);
  return locations
    .map((l) => {
      const label = paths.get(l.id) ?? l.name;
      return { id: l.id, label, depth: label.split(PATH_SEP).length - 1 };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
