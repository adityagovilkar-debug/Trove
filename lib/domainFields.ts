// Domain-specific attribute schemas. These describe the extra fields each
// kind of thing carries beyond the common ones (name, price, location…).
// Values are stored in items.attributes (JSONB), so adding a new domain or
// field here needs NO database migration — this is the extensibility layer.

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "classification"; // structured Book classification (Genre/Dewey/custom)

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // for type: "select"
  placeholder?: string;
  // Show this attribute inline on the stock card (keep it to 1–2 per domain).
  prominent?: boolean;
  // Fields sharing a group render together inside a collapsible section,
  // so optional detail (e.g. nutrition) stays out of the way until needed.
  group?: string;
}

export const NUTRITION = "Nutrition facts (per serving)";

// Keyed by domain.key (see the `domains` table seed).
export const DOMAIN_FIELDS: Record<string, FieldDef[]> = {
  // Groceries: nutrition is optional and only relevant for packaged foods,
  // beverages and snacks — so it lives in a collapsible group.
  grocery: [
    { key: "serving_size", label: "Serving size", type: "text", placeholder: "e.g. 330 ml, 30 g", group: NUTRITION },
    { key: "servings_per_pack", label: "Servings / pack", type: "number", group: NUTRITION },
    { key: "calories", label: "Calories (kcal)", type: "number", group: NUTRITION },
    { key: "protein_g", label: "Protein (g)", type: "number", group: NUTRITION },
    { key: "carbs_g", label: "Carbs (g)", type: "number", group: NUTRITION },
    { key: "sugar_g", label: "of which sugar (g)", type: "number", group: NUTRITION },
    { key: "fat_g", label: "Fat (g)", type: "number", group: NUTRITION },
    { key: "sat_fat_g", label: "of which saturated (g)", type: "number", group: NUTRITION },
    { key: "fiber_g", label: "Fibre (g)", type: "number", group: NUTRITION },
    { key: "sodium_mg", label: "Sodium (mg)", type: "number", group: NUTRITION },
  ],
  electronics: [
    { key: "model", label: "Model", type: "text", placeholder: "e.g. WH-1000XM5", prominent: true },
    { key: "serial", label: "Serial number", type: "text" },
    { key: "warranty_until", label: "Warranty until", type: "date", prominent: true },
    {
      key: "condition",
      label: "Condition",
      type: "select",
      options: ["New", "Good", "Used", "For repair"],
    },
  ],
  book: [
    { key: "author", label: "Author", type: "text", placeholder: "e.g. Ursula K. Le Guin", prominent: true },
    { key: "isbn", label: "ISBN", type: "text", placeholder: "scan or type" },
    {
      key: "format",
      label: "Format",
      type: "select",
      options: ["Paperback", "Hardcover", "eBook", "Audiobook"],
    },
    {
      key: "classification",
      label: "Shelf / Classification",
      type: "classification",
      prominent: true,
    },
    {
      key: "read_status",
      label: "Reading status",
      type: "select",
      options: ["Unread", "Reading", "Read", "Lent out"],
    },
    {
      key: "rating",
      label: "Rating",
      type: "select",
      options: ["—", "★", "★★", "★★★", "★★★★", "★★★★★"],
    },
  ],
};

export function fieldsForDomainKey(key: string | null | undefined): FieldDef[] {
  return (key && DOMAIN_FIELDS[key]) || [];
}

// Pull the 1–2 attributes worth showing on a card, as label/value pairs.
export function prominentAttributes(
  domainKey: string | null | undefined,
  attributes: Record<string, unknown> | null | undefined,
): { label: string; value: string }[] {
  if (!attributes) return [];
  return fieldsForDomainKey(domainKey)
    .filter((f) => f.prominent)
    .map((f) => ({ label: f.label, value: String(attributes[f.key] ?? "").trim() }))
    .filter((p) => p.value && p.value !== "—");
}
