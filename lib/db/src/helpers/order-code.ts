/**
 * normalizeOrderCode — canonical backend helper for order code normalization.
 *
 * Accepted input formats → canonical output (ORD-<number>, no leading zeros):
 *   "200"        → "ORD-200"
 *   "#200"       → "ORD-200"
 *   "ORD200"     → "ORD-200"
 *   "ORD-200"    → "ORD-200"
 *   "ord-200"    → "ORD-200"
 *   "ORD 200"    → "ORD-200"
 *   "ORD-000200" → "ORD-200"   (leading zeros stripped)
 *   "000200"     → "ORD-200"   (leading zeros stripped)
 *
 * Returns null when the input contains no valid numeric part.
 */

// Pattern accepts: optional "ORD" prefix, optional separator (- or space),
// optional leading "#", then one or more digits.
const ORDER_CODE_RE = /^(?:ord[-\s]?)?#?0*(\d+)$/i;

export function normalizeOrderCode(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(ORDER_CODE_RE);
  if (!match || !match[1]) return null;
  // Reject zero — order numbers must be positive integers.
  if (match[1] === "0") return null;
  return `ORD-${match[1]}`;
}

/**
 * Returns true when a value is a valid canonical order code (ORD-<digits>).
 * Leading zeros are not allowed in the canonical form.
 */
export function isValidOrderCode(value: string): boolean {
  return /^ORD-[1-9]\d*$/.test(value);
}
