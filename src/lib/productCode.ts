// Builds professional product codes like "BULB-009" from the product's
// category + its number. The prefix is the first word of the category name
// (letters/digits only, uppercased); plain numbers are padded to 3 digits.
export function codePrefix(categoryName?: string | null): string {
  return (
    (categoryName || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim()
      .split(" ")[0] || ""
  );
}

export function makeProductCode(
  categoryName: string | null | undefined,
  num: string
): string {
  const n = num.trim();
  if (!n) return "";
  const padded = /^\d+$/.test(n) ? n.padStart(3, "0") : n.toUpperCase();
  const p = codePrefix(categoryName);
  return p ? `${p}-${padded}` : padded;
}

// The plain product number inside a code — "BULB-009" → "9". Lets people
// search by the number they wrote on the shelf label without the prefix
// or the zero-padding.
export function productNumberOf(sku?: string | null): string {
  const m = (sku || "").match(/(\d+)\s*$/);
  return m ? String(Number(m[1])) : "";
}

export type ProductSearchable = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
};

// Ranks how well a product matches a search query — smaller is better,
// -1 means no match. Understands names, product codes (SKU), barcodes and
// bare product numbers: "9", "009", "#9" and "bulb-009" all find BULB-009.
export function productMatchRank(query: string, p: ProductSearchable): number {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return 3;
  const name = p.name.toLowerCase();
  const sku = (p.sku || "").toLowerCase();
  const barcode = (p.barcode || "").toLowerCase();
  const num = productNumberOf(p.sku);
  // Exact code / barcode / product-number match jumps to the top.
  if (
    (sku && sku === q) ||
    (barcode && barcode === q) ||
    (num && /^\d+$/.test(q) && Number(q) === Number(num))
  ) {
    return 0;
  }
  if (name.startsWith(q) || (sku && sku.startsWith(q))) return 1;
  const hay = `${name} ${sku} ${barcode} ${num}`;
  // Every word of the query must appear somewhere (name, code, number…).
  if (q.split(/\s+/).every((t) => hay.includes(t))) return 2;
  return -1;
}

// Filter + sort a product list by how well each entry matches the query.
export function searchProducts<T extends ProductSearchable>(
  items: T[],
  query: string
): T[] {
  if (!query.trim()) return items;
  return items
    .map((it) => ({ it, rank: productMatchRank(query, it) }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.it.name.localeCompare(b.it.name))
    .map((x) => x.it);
}
