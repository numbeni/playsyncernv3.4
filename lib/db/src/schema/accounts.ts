import {
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  accountStatusEnum,
  accountStatusOverrideEnum,
} from "./enums";
import { gamesTable } from "./games";

export const accountCodeSeq = pgSequence("account_code_seq", {
  startWith: 1,
  increment: 1,
  minValue: 1,
  maxValue: 2147483647,
  cycle: false,
});

export const accountsTable = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => gamesTable.id),

    // Global account code — ACC-000001, globally unique across all games.
    accountCode: text("account_code").notNull().unique(),

    // Display number components. Stored separately to allow safe prefix changes.
    // displayNumber = "#" + accountNumberPrefix + "-" + padded(accountNumberSeq)
    accountNumberPrefix: text("account_number_prefix").notNull(),
    accountNumberSeq: integer("account_number_seq").notNull(),
    displayNumber: text("display_number").notNull(),

    // Legacy credentials — these columns are deprecated and will be removed in a later cleanup stage.
    // NOTE: actual encryption at rest is NOT implemented in this schema phase.
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    playstationPasswordEncrypted: text("playstation_password_encrypted").notNull(),
    emailPasswordEncrypted: text("email_password_encrypted").notNull(),
    familyManagementEmailEncrypted: text("family_management_email_encrypted"),

    // PS-03C1 additive encrypted-value and keyed lookup-hash columns.
    // These remain nullable until the runtime cutover stage enforces them.
    psnEmailEncrypted: text("psn_email_encrypted"),
    psnEmailLookupHash: text("psn_email_lookup_hash"),
    psnPasswordEncrypted: text("psn_password_encrypted"),
    psnPasswordLookupHash: text("psn_password_lookup_hash"),
    emailPasswordEncryptedV2: text("email_password_encrypted_v2"),
    emailPasswordLookupHash: text("email_password_lookup_hash"),
    familyManagementEmailEncryptedV2: text("family_management_email_encrypted_v2"),
    familyManagementEmailLookupHash: text("family_management_email_lookup_hash"),

    onlineId: text("online_id"),
    birthDate: text("birth_date"),

    status: accountStatusEnum("status").notNull().default("active"),
    statusOverride: accountStatusOverrideEnum("status_override"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Legacy partial unique index — scheduled for removal in Stage C.
    uniqueIndex("accounts_email_normalized_active_uniq")
      .on(t.emailNormalized)
      .where(sql`${t.deletedAt} IS NULL`),

    // Per-game identifier uniqueness.
    unique("accounts_game_seq_unique").on(t.gameId, t.accountNumberSeq),
    unique("accounts_game_display_unique").on(t.gameId, t.displayNumber),

    // Non-unique lookup indexes for duplicate-permitted fields.
    index("accounts_psn_email_lookup_hash_idx").on(t.psnEmailLookupHash),
    index("accounts_psn_password_lookup_hash_idx").on(t.psnPasswordLookupHash),
    index("accounts_email_password_lookup_hash_idx").on(t.emailPasswordLookupHash),
    index("accounts_family_email_lookup_hash_idx").on(t.familyManagementEmailLookupHash),
    index("accounts_online_id_idx").on(t.onlineId),

    index("accounts_game_id_idx").on(t.gameId),
    index("accounts_status_idx").on(t.status),
    index("accounts_deleted_at_idx").on(t.deletedAt),
    index("accounts_account_code_idx").on(t.accountCode),
  ],
);

export type Account = typeof accountsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
