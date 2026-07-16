import type { Account } from "@workspace/db";

/**
 * Non-secret subset of an Account returned by generic API responses.
 *
 * Excludes all legacy credential columns, all encrypted/lookup-hash columns,
 * all email and family-management secrets, all password fields, all Backup
 * Codes, and the legacy active/disabled status columns.
 */
export interface SafeAccount {
  id: string;
  gameId: string;
  accountCode: string;
  accountNumberPrefix: string;
  accountNumberSeq: number;
  displayNumber: string;
  onlineId: string | null;
  birthDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authoritative storage-only Backup Code contract.
 *
 * PlaySyncer will not validate, consume, search, lifecycle-track, hash, or
 * reveal Backup Codes in this stage. The DB column currently storing the value
 * is `code_encrypted`; migration 0003 will rename it to `code_ciphertext` in
 * PS-03C2B.
 */
export interface BackupCodeStorage {
  id: string;
  accountId: string;
  codeCiphertext: string;
  createdAt: Date;
}

/**
 * Strip all secret and legacy fields before returning an Account to any caller.
 */
export function toSafeAccount(a: Account): SafeAccount {
  return {
    id: a.id,
    gameId: a.gameId,
    accountCode: a.accountCode,
    accountNumberPrefix: a.accountNumberPrefix,
    accountNumberSeq: a.accountNumberSeq,
    displayNumber: a.displayNumber,
    onlineId: a.onlineId ?? null,
    birthDate: a.birthDate ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
