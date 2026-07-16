import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { backupCodeStatusEnum } from "./enums";
import { accountsTable } from "./accounts";

export const accountBackupCodesTable = pgTable(
  "account_backup_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id),

    // Legacy encrypted column — deprecated, will be removed in Stage C.
    // NOTE: actual encryption at rest is NOT implemented in this schema phase.
    codeEncrypted: text("code_encrypted").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),

    // PS-03C1 additive fields.
    // Encrypted/ciphertext value and separate keyed lookup hash.
    codeEncryptedV2: text("code_encrypted_v2"),
    codeLookupHashV2: text("code_lookup_hash_v2"),
    // Lifecycle status: AVAILABLE, USED, REVOKED.
    status: backupCodeStatusEnum("status").notNull().default("AVAILABLE"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("account_backup_codes_account_id_idx").on(t.accountId),
    index("account_backup_codes_status_idx").on(t.status),
    index("account_backup_codes_code_lookup_hash_v2_idx").on(t.codeLookupHashV2),
  ],
);

export type AccountBackupCode = typeof accountBackupCodesTable.$inferSelect;
export type InsertAccountBackupCode =
  typeof accountBackupCodesTable.$inferInsert;
