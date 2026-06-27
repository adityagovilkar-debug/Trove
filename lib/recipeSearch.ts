// Search recipes online via TheMealDB — a free, open, no-key recipe database
// (CORS-enabled). Used to import a dish and auto-fill its ingredients,
// quantities, and method into the recipe editor.

export interface OnlineIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface OnlineRecipe {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  thumb: string | null;
  instructions: string;
  ingredients: OnlineIngredient[];
}

const FRACTIONS: Record<string, number> = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

// TheMealDB measures are free text ("1 cup", "200g", "1/2 tsp", "to taste").
// Split a leading number (incl. fractions / mixed numbers) into quantity, and
// keep the rest as the unit. No leading number → quantity null, whole string
// kept as the unit (e.g. "to taste"), so nothing is lost.
export function parseMeasure(raw: string): { quantity: number | null; unit: string | null } {
  let s = (raw || "").trim();
  if (!s) return { quantity: null, unit: null };
  for (const [glyph, val] of Object.entries(FRACTIONS)) {
    s = s.replace(glyph, ` ${val} `);
  }
  s = s.replace(/\s+/g, " ").trim();

  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*(.*)$/);
  if (!m) return { quantity: null, unit: s };

  const num = m[1];
  let qty: number;
  if (num.includes(" ")) {
    const [whole, frac] = num.split(" ");
    const [a, b] = frac.split("/");
    qty = Number(whole) + Number(a) / Number(b);
  } else if (num.includes("/")) {
    const [a, b] = num.split("/");
    qty = Number(a) / Number(b);
  } else {
    qty = Number(num);
  }
  qty = Math.round(qty * 100) / 100;
  return {
    quantity: Number.isFinite(qty) ? qty : null,
    unit: (m[2] || "").trim() || null,
  };
}

export async function searchOnlineRecipes(query: string): Promise<OnlineRecipe[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    const meals: Record<string, string>[] = data.meals ?? [];
    return meals.map((m) => {
      const ingredients: OnlineIngredient[] = [];
      for (let i = 1; i <= 20; i++) {
        const name = (m[`strIngredient${i}`] ?? "").trim();
        if (!name) continue;
        const { quantity, unit } = parseMeasure(m[`strMeasure${i}`] ?? "");
        ingredients.push({ name, quantity, unit });
      }
      return {
        id: m.idMeal,
        name: m.strMeal,
        category: m.strCategory || null,
        area: m.strArea || null,
        thumb: m.strMealThumb || null,
        instructions: (m.strInstructions ?? "").trim(),
        ingredients,
      };
    });
  } catch {
    return [];
  }
}
