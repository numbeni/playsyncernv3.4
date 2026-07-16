/**
 * cleanGameTitle — canonical server-side display-title cleaning for Games.
 *
 * Rules:
 * - trim surrounding whitespace
 * - collapse repeated internal whitespace to one space
 * - preserve display casing
 *
 * Examples:
 *   "FC 26"      → "FC 26"
 *   " fc 26 "    → "fc 26"
 *   "FC   26"    → "FC 26"
 *   "FC 26 Ultimate Edition" → "FC 26 Ultimate Edition"
 */
export function cleanGameTitle(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * normalizeGameTitle — canonical server-side title normalization for Games.
 *
 * Rules:
 * - trim surrounding whitespace
 * - collapse repeated internal whitespace to one space
 * - lowercase for case-insensitive duplicate detection
 *
 * Examples:
 *   "FC 26"      → "fc 26"
 *   " fc 26 "    → "fc 26"
 *   "FC   26"    → "fc 26"
 *   "FC 26 Ultimate Edition" → "fc 26 ultimate edition"
 */
export function normalizeGameTitle(input: string): string {
  return cleanGameTitle(input).toLowerCase();
}

export class GameTitleError extends Error {}

/**
 * prepareGameTitle — validates, cleans, and normalizes a Game title in one pass.
 *
 * Returns the cleaned display title and its lowercase normalized form.
 * Throws GameTitleError for whitespace-only or over-length titles.
 */
export function prepareGameTitle(input: string): {
  title: string;
  titleNormalized: string;
} {
  const title = cleanGameTitle(input);
  const titleNormalized = normalizeGameTitle(input);

  if (titleNormalized.length === 0) {
    throw new GameTitleError("Title cannot be blank or whitespace-only");
  }
  if (title.length > 120) {
    throw new GameTitleError("Title must be at most 120 characters");
  }

  return { title, titleNormalized };
}
