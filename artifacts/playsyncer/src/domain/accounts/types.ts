import type { AccountSlot } from "@/domain/slots/types";

export type AccountStatus = "active" | "disabled";

export interface Account {
  id: string;
  /** Global unique identifier across all games. Format: ACC-000001. Auto-generated; never edited by admin. */
  accountCode: string;
  /**
   * The clean, normalized prefix used to generate `number`.
   * Stored so that edits can re-build the number (preserving the sequence) when the prefix changes.
   * Never contains technical IDs like "game-1783602440103" — always a human-readable uppercase slug.
   */
  numberPrefix: string;
  /** Per-game display number. Format: #PREFIX-001. Unique within a game only. */
  number: string;
  email: string;
  password: string;
  emailPassword: string;
  onlineId: string;
  birthDate: string;
  familyManagementEmail: string;
  backupCodes: string[];
  status: AccountStatus;
  slots: AccountSlot[];
}

/**
 * Fields required to create or edit an account.
 * id, accountCode, number, numberPrefix, and slots are auto-managed — never fully supplied by the form.
 * numberPrefix is accepted as an OPTIONAL input: when omitted or blank, the parent game title is used.
 */
export type AccountInput = Omit<Account, "id" | "accountCode" | "number" | "slots" | "numberPrefix"> & {
  /**
   * Optional display prefix for the account number.
   * – If provided and non-blank: normalized and used as the prefix (e.g. "GTA6" → #GTA6-001).
   * – If omitted or blank: parent game title is normalized and used instead (e.g. "GTA VI" → #GTA-VI-001).
   */
  numberPrefix?: string;
};
