import type { accountsTable } from "@workspace/db";

/**
 * Strip sensitive encrypted columns before returning an account to any caller.
 *
 * NOTE: actual encryption is not yet wired — these columns currently hold
 * plaintext during development. They must NEVER be returned in API responses
 * until a proper authz layer is in place.
 *
 * The three omitted fields can be surfaced on a dedicated, auth-gated
 * "reveal credentials" endpoint in a future phase.
 */
export function toSafeAccount(
  a: typeof accountsTable.$inferSelect,
): Omit<
  typeof accountsTable.$inferSelect,
  | "playstationPasswordEncrypted"
  | "emailPasswordEncrypted"
  | "familyManagementEmailEncrypted"
> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    playstationPasswordEncrypted,
    emailPasswordEncrypted,
    familyManagementEmailEncrypted,
    ...safe
  } = a;
  return safe;
}
