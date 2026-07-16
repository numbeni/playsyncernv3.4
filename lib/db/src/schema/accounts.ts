import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accountStatusEnum } from "./enums";
import { gamesTable } from "./games";

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

    // Auth / credentials — sensitive fields use encrypted naming convention.
    // NOTE: actual encryption at rest is NOT implemented in this schema phase.
    // These columns hold the ciphertext once encryption middleware is wired up.
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    playstationPasswordEncrypted: text("playstation_password_encrypted").notNull(),
    emailPasswordEncrypted: text("email_password_encrypted").notNull(),
    familyManagementEmailEncrypted: text("family_management_email_encrypted"),

    onlineId: text("online_id"),
    birthDate: text("birth_date"),

    status: accountStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Partial unique: emailNormalized must be unique among non-deleted accounts.
    // Uses a PostgreSQL partial unique index (WHERE deleted_at IS NULL).
    // This correctly allows the same email to be reused after soft-delete.
    uniqueIndex("accounts_email_normalized_active_uniq")
      .on(t.emailNormalized)
      .where(sql`${t.deletedAt} IS NULL`),

    index("accounts_game_id_idx").on(t.gameId),
    index("accounts_status_idx").on(t.status),
    index("accounts_deleted_at_idx").on(t.deletedAt),
    index("accounts_account_code_idx").on(t.accountCode),
  ],
);

export type Account = typeof accountsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
