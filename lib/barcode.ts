// Look up scanned barcodes / search products against the Open *Facts databases
// to auto-fill item details. Free, no API key. Returns null on miss/error.
export interface BarcodeProduct {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  quantity: string | null; // e.g. "1kg" — free text from the DB
  categories: string | null;
  barcode?: string | null;
}

// Open Facts family: food, then non-food fallbacks (products/beauty) so a
// scanned shampoo or gadget can still resolve, not just groceries.
const OFF_HOSTS = [
  "https://world.openfoodfacts.org",
  "https://world.openproductsfacts.org",
  "https://world.openbeautyfacts.org",
];

const OFF_HEADERS = { "User-Agent": "Trove/1.0 (home inventory app)" };

function mapProduct(p: Record<string, unknown>, code?: string): BarcodeProduct | null {
  const name = String((p.product_name as string) ?? "").trim();
  if (!name) return null;
  const brands = (p.brands as string) ?? "";
  return {
    name,
    brand: brands.split(",")[0]?.trim() || null,
    imageUrl: (p.image_front_small_url as string) || null,
    quantity: (p.quantity as string) || null,
    categories: (p.categories as string) || null,
    barcode: code ?? (p.code as string) ?? null,
  };
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const fields =
    "product_name,brands,image_front_small_url,quantity,categories,code";
  for (const host of OFF_HOSTS) {
    try {
      const res = await fetch(
        `${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
        { headers: OFF_HEADERS },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== 1 || !data.product) continue;
      const mapped = mapProduct(data.product, code);
      if (mapped) return mapped;
    } catch {
      // try the next database
    }
  }
  return null;
}

// Free-text product search → a picklist for auto-filling the add form, for when
// a barcode won't scan or isn't in the DB. Searches Open Food Facts (the richest
// of the three) by name. Returns up to `limit` matches.
export async function searchProducts(
  query: string,
  limit = 12,
): Promise<BarcodeProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url =
      "https://world.openfoodfacts.org/cgi/search.pl" +
      `?search_terms=${encodeURIComponent(q)}` +
      "&search_simple=1&action=process&json=1&page_size=" +
      limit +
      "&fields=code,product_name,brands,image_front_small_url,quantity,categories";
    const res = await fetch(url, { headers: OFF_HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const products: Record<string, unknown>[] = data.products ?? [];
    const out: BarcodeProduct[] = [];
    const seen = new Set<string>();
    for (const p of products) {
      const mapped = mapProduct(p);
      if (!mapped) continue;
      const key = `${mapped.name.toLowerCase()}|${mapped.brand ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(mapped);
    }
    return out;
  } catch {
    return [];
  }
}

export interface BookInfo {
  title: string;
  author: string | null;
}

// Look up a book by ISBN via Open Library (free, no key) for the Book domain.
export async function lookupBook(isbn: string): Promise<BookInfo | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(
        isbn,
      )}&format=json&jscmd=data`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const b = data[`ISBN:${isbn}`];
    if (!b?.title) return null;
    return { title: b.title, author: b.authors?.[0]?.name ?? null };
  } catch {
    return null;
  }
}
