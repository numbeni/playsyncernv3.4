/**
 * Account number / display number helpers.
 */

// Characters that are not alphanumeric or hyphens are stripped.
// Consecutive hyphens are collapsed. Leading/trailing hyphens are trimmed.
const UNSAFE_RE = /[^A-Z0-9\-]/g;
const MULTI_HYPHEN_RE = /-{2,}/g;

/**
 * normalizeAccountNumberPrefix
 *
 * Rules (Commander decision 7 / helper requirement 2):
 *  1. Trim whitespace.
 *  2. Uppercase.
 *  3. Replace spaces with hyphens.
 *  4. Remove unsafe characters (keep A-Z, 0-9, -).
 *  5. Collapse consecutive hyphens.
 *  6. Strip leading/trailing hyphens.
 *  7. If empty after sanitization → use `fallback` (same rules applied).
 *  8. If still empty → use "ACC".
 *
 * IMPORTANT: callers must never pass the raw technical gameId as the input;
 * pass the human-readable game title or an explicit admin-supplied prefix.
 */
export function normalizeAccountNumberPrefix(
  input: string,
  fallback: string,
): string {
  const sanitize = (raw: string): string =>
    raw
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(UNSAFE_RE, "")
      .replace(MULTI_HYPHEN_RE, "-")
      .replace(/^-+|-+$/g, "");

  const result = sanitize(input);
  if (result.length > 0) return result;

  const fallbackResult = sanitize(fallback);
  if (fallbackResult.length > 0) return fallbackResult;

  return "ACC";
}

/**
 * buildDisplayNumber
 *
 * Formats the human-readable account number shown in the UI and stored in
 * `accounts.display_number`.
 *
 * Example: prefix="GTA6", seq=1 → "#GTA6-001"
 *
 * Sequence is zero-padded to 3 digits; numbers above 999 are not truncated.
 */
export function buildDisplayNumber(prefix: string, seq: number): string {
  return `#${prefix}-${String(seq).padStart(3, "0")}`;
}
