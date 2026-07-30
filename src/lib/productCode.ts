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
