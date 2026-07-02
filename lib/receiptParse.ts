// Heuristic parser: pull line items out of raw OCR text of a grocery receipt.
// Receipts vary wildly, so this is best-effort — every result is shown in an
// editable review step before anything is added. Gemma (lib/gemma.ts) does a
// better structured extraction when available; this is the always-on fallback.

export interface ReceiptItem {
  name: string;
  quantity: number | null;
  price: number | null;
}

// Lines that are clearly not products.
const SKIP =
  /\b(total|subtotal|sub-total|tax|gst|vat|cgst|sgst|hst|pst|change|cash|card|credit|debit|balance|tender|round(ing)?|discount|savings?|loyalty|points?|amount|invoice|receipt|thank|visit|www|http|tel|phone|gstin|tin|bill\s*no|cashier|counter|store|branch|qty\s+rate|net\s+amount|grand\s+total|payable|paid)\b/i;

function titleize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .trim();
}

export function parseReceiptText(text: string): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 3) continue;
    if (SKIP.test(line)) continue;

    // A price is a number with two decimals near the end of the line.
    const priceMatch = line.match(/(\d{1,6}[.,]\d{2})(?!\d)\s*[A-Z]?\s*$/);
    if (!priceMatch) continue;
    const price = Number(priceMatch[1].replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) continue;

    let name = line.slice(0, priceMatch.index).trim();

    // Quantity: leading "2 x" / "2x", or trailing "x4" / "x 4".
    let quantity: number | null = null;
    const qm = name.match(/^(\d{1,3})\s*[xX*]\s*/);
    if (qm) {
      quantity = Number(qm[1]);
      name = name.slice(qm[0].length).trim();
    } else {
      const tm = name.match(/[xX*]\s*(\d{1,3})\s*$/);
      if (tm) quantity = Number(tm[1]);
    }

    // Strip currency symbols, standalone price/qty columns, and stray codes.
    name = name
      .replace(/[₹$€£]/g, " ")
      .replace(/\b\d{1,6}[.,]\d{2}\b/g, " ") // extra price columns (unit price)
      .replace(/\bx\s*\d+\b/gi, " ") // trailing "x2"
      .replace(/[*#|]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Keep letters/numbers/basic punctuation; must contain a letter and have
    // some substance.
    name = name.replace(/[^\p{L}\p{N} .&'/-]/gu, "").trim();
    if (name.length < 2 || !/\p{L}/u.test(name)) continue;
    // Drop lines that are basically just a number.
    if (/^[\d .]+$/.test(name)) continue;

    items.push({ name: titleize(name), quantity, price });
  }
  return items;
}
