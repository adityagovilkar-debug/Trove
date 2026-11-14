// Read-only export of the data behind features retired by REWORK-PLAN.md
// (subscriptions, recipes + ingredients, meal plans, plans, books) so nothing
// is lost when their screens go. Writes to exports/ (gitignored).
//
//   node scripts/export-retired.mjs
//
// Uses SUPABASE_SERVICE_ROLE_KEY from .env.local. Only SELECTs — never writes.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function all(table, order = "created_at") {
  const { data, error } = await sb.from(table).select("*").order(order);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const [subscriptions, recipes, ingredients, mealPlans, plans, books] = await Promise.all([
  all("subscriptions"),
  all("recipes"),
  all("recipe_ingredients", "sort_order"),
  all("meal_plans", "plan_date"),
  all("plans"),
  sb
    .from("inventory_detail")
    .select("*")
    .eq("domain_key", "book")
    .then(({ data, error }) => {
      if (error) throw new Error(`books: ${error.message}`);
      return data;
    }),
]);

const out = {
  exported_at: new Date().toISOString(),
  note: "Data from features retired in Trove's 2026-11 rework. The database tables are untouched; this is a safety copy.",
  subscriptions,
  recipes: recipes.map((r) => ({ ...r, ingredients: ingredients.filter((i) => i.recipe_id === r.id) })),
  meal_plans: mealPlans,
  plans,
  books,
};

const day = new Date().toISOString().slice(0, 10);
mkdirSync(new URL("../exports/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../exports/retired-${day}.json`, import.meta.url), JSON.stringify(out, null, 2));

// A readable sheet of subscriptions, to tick off against Kosha.
const money = (n, c) => `${c ?? ""} ${Number(n).toLocaleString("en-IN")}`.trim();
const md = [
  `# Trove subscriptions — check these exist in Kosha`,
  ``,
  `Exported ${day}. Tick each one once you have confirmed it in Kosha.`,
  ``,
  `| ✓ | Name | Price | Cycle | Next payment in Trove | Status | Category |`,
  `|---|---|---|---|---|---|---|`,
  ...subscriptions.map(
    (s) =>
      `| ☐ | ${s.name} | ${money(s.price, s.currency)} | ${s.billing_cycle === "custom" ? `every ${s.cycle_days}d` : s.billing_cycle} | ${s.next_payment ?? "—"} | ${s.status} | ${s.category ?? "—"} |`,
  ),
  ``,
  `## Recipes`,
  ``,
  ...recipes.map((r) => `- ${r.name}${r.cuisine ? ` (${r.cuisine})` : ""} — ${ingredients.filter((i) => i.recipe_id === r.id).length} ingredients`),
  ``,
].join("\n");
writeFileSync(new URL(`../exports/retired-${day}.md`, import.meta.url), md);

console.log(
  `subscriptions ${subscriptions.length}, recipes ${recipes.length}, ingredients ${ingredients.length}, ` +
    `meal plans ${mealPlans.length}, plans ${plans.length}, books ${books.length}`,
);
console.log(`→ exports/retired-${day}.json and .md`);
