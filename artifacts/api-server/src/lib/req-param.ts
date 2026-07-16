/**
 * Express v5 types params as `string | string[]`.
 * In practice a route param is always a single string at runtime.
 * This helper casts safely.
 */
export const p = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
