import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const accountBackupCodesTable = pgTable(
  "account_backup_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id),
    // NOTE: actual encryption at rest is NOT implemented in this schema phase.
    codeEncrypted: text("code_encrypted").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("account_backup_codes_account_id_idx").on(t.accountId),
  ],
);

export type AccountBackupCode = typeof accountBackupCodesTable.$inferSelect;
export type InsertAccountBackupCode =
  typeof accountBackupCodesTable.$inferInsert;
