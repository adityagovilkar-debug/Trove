// Look up a scanned barcode against the Open Food Facts database to auto-fill
// item details. Free, no API key. Returns null on miss/error.
export interface BarcodeProduct {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  quantity: string | null; // e.g. "1kg" — free text from the DB
  categories: string | null;
}

export async function lookupBarcode(
  code: string,
): Promise<BarcodeProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        code,
      )}.json?fields=product_name,brands,image_front_small_url,quantity,categories`,
      { headers: { "User-Agent": "Larder/1.0 (home inventory app)" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name: string = p.product_name?.trim() || "";
    if (!name) return null;
    return {
      name,
      brand: p.brands?.split(",")[0]?.trim() || null,
      imageUrl: p.image_front_small_url || null,
      quantity: p.quantity || null,
      categories: p.categories || null,
    };
  } catch {
    return null;
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
