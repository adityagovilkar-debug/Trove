// Heuristic parser: extract nutrition facts from raw OCR text of a label.
// Nutrition panels are semi-structured (keyword followed by a number + unit),
// so regex extraction works well and runs instantly offline with no model.
// This is the always-available fallback; Gemma 4 (lib/gemma.ts) upgrades
// accuracy on messy / non-standard labels.

export type NutritionKey =
  | "serving_size"
  | "servings_per_pack"
  | "calories"
  | "protein_g"
  | "carbs_g"
  | "sugar_g"
  | "fat_g"
  | "sat_fat_g"
  | "fiber_g"
  | "sodium_mg";

export type NutritionResult = Partial<Record<NutritionKey, string>>;

// Grab the first number that appears shortly after a keyword match.
function num(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  if (!m) return undefined;
  // The capturing group holds the number.
  const v = m[1];
  if (v == null) return undefined;
  return v.replace(",", ".");
}

export function parseNutritionText(raw: string): NutritionResult {
  // Normalise: lowercase, unify whitespace, drop stray characters.
  const t = raw
    .toLowerCase()
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const out: NutritionResult = {};

  // Serving size — capture the value + unit phrase after "serving size".
  const serv = t.match(/serving size[^a-z0-9]*([\d.]+\s*(?:g|ml|l|oz|kg))/);
  if (serv) out.serving_size = serv[1].replace(/\s+/g, " ").trim();

  const perPack = num(t, /servings?\s*per\s*(?:pack|container|bottle)\D{0,6}([\d.]+)/);
  if (perPack) out.servings_per_pack = perPack;

  // Calories / energy. Prefer an explicit kcal value (labels often show kJ too).
  out.calories =
    num(t, /(?:calories|energy)\D{0,12}([\d.]+)\s*kcal/) ??
    num(t, /([\d.]+)\s*kcal/) ??
    num(t, /calories\D{0,8}([\d.]+)/);

  // Macros — keyword then a number then "g". Allow a little noise between.
  out.protein_g = num(t, /protein\D{0,8}([\d.]+)\s*g/);
  out.carbs_g = num(t, /(?:total\s*)?carbohydrate(?:s)?\D{0,8}([\d.]+)\s*g/);
  out.sugar_g = num(t, /(?:of which\s*)?sugars?\D{0,8}([\d.]+)\s*g/);
  out.fat_g = num(t, /(?:total\s*)?fat\D{0,8}([\d.]+)\s*g/);
  out.sat_fat_g = num(t, /(?:of which\s*)?saturate(?:d|s)?\D{0,8}([\d.]+)\s*g/);
  out.fiber_g = num(t, /(?:dietary\s*)?fib(?:re|er)\D{0,8}([\d.]+)\s*g/);

  // Sodium in mg; if only salt (g) is present, convert (salt g × 400 ≈ mg Na).
  const sodiumMg = num(t, /sodium\D{0,8}([\d.]+)\s*mg/);
  if (sodiumMg) out.sodium_mg = sodiumMg;
  else {
    const sodiumG = num(t, /sodium\D{0,8}([\d.]+)\s*g/);
    if (sodiumG) out.sodium_mg = String(Math.round(parseFloat(sodiumG) * 1000));
    else {
      const saltG = num(t, /salt\D{0,8}([\d.]+)\s*g/);
      if (saltG) out.sodium_mg = String(Math.round(parseFloat(saltG) * 400));
    }
  }

  // Drop any keys we couldn't fill.
  (Object.keys(out) as NutritionKey[]).forEach((k) => {
    if (out[k] == null) delete out[k];
  });
  return out;
}

export function countFilled(r: NutritionResult): number {
  return Object.values(r).filter((v) => v != null && v !== "").length;
}
