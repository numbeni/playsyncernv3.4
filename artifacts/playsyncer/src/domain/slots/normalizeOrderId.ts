/**
 * Order ID normalisation helpers.
 *
 * Accepted input formats (all map to  ORD-<number>):
 *   200        → ORD-200   (raw number)
 *   #200       → ORD-200   (hash-prefixed number)
 *   ORD-200    → ORD-200   (already correct)
 *   ord-200    → ORD-200   (lowercase)
 *   ORD200     → ORD-200   (compact, no dash)
 *   ord 200    → ORD-200   (space separator)
 */

const ORDER_RE = /^(?:ord[-\s]?)?#?(\d+)$/i;

/**
 * Normalise a raw order ID input to the canonical `ORD-<number>` format.
 * If the input doesn't match any recognised pattern the trimmed uppercase
 * input is returned as-is (so that `isValidOrderId` can report the error).
 */
export function normalizeOrderId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(ORDER_RE);
  if (match) return `ORD-${match[1]}`;
  // Unrecognised — return trimmed uppercase so validation can reject it clearly
  return trimmed.toUpperCase();
}

/**
 * A normalised order ID is valid when it is exactly `ORD-` followed by one
 * or more digits (no extra characters).
 */
export function isValidOrderId(normalized: string): boolean {
  return /^ORD-\d+$/.test(normalized);
}
