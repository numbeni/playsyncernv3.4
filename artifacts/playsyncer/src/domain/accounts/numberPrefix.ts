/**
 * Normalize a raw string into a clean, URL/display-safe account number prefix.
 *
 * Rules (applied in order):
 *  1. Trim surrounding whitespace.
 *  2. Replace any run of whitespace with a single hyphen.
 *  3. Remove every character that is not an ASCII letter, digit, or hyphen.
 *  4. Collapse consecutive hyphens into one.
 *  5. Strip leading / trailing hyphens.
 *  6. Uppercase.
 *  7. If the result is empty after all of the above, return the fallback "ACC".
 *
 * Examples:
 *   "clair obscur"      → "CLAIR-OBSCUR"
 *   "GTA VI"            → "GTA-VI"
 *   "FC 25"             → "FC-25"
 *   "gta6"              → "GTA6"
 *   "game-1783602440103"→ "GAME-1783602440103"   (technical ID, still ugly → use prefix field)
 *   "   "               → "ACC"                  (blank → fallback)
 *   "نام فارسی"         → "ACC"                  (only Persian → fallback)
 */
export function normalizeAccountPrefix(raw: string): string {
  const result = raw
    .trim()
    .replace(/\s+/g, "-")           // whitespace → hyphen
    .replace(/[^A-Za-z0-9-]/g, "")  // remove non-ASCII-alphanumeric / non-hyphen
    .replace(/-{2,}/g, "-")         // collapse repeated hyphens
    .replace(/^-+|-+$/g, "")        // strip leading/trailing hyphens
    .toUpperCase();

  return result || "ACC";
}
