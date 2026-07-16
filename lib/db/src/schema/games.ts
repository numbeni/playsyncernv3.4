import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { gamePlatformEnum, gameStatusEnum } from "./enums";

export const gamesTable = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    titleNormalized: text("title_normalized").notNull(),
    coverUrl: text("cover_url"),
    platform: gamePlatformEnum("platform").notNull(),
    status: gameStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("games_status_idx").on(t.status),
    index("games_deleted_at_idx").on(t.deletedAt),
    uniqueIndex("games_title_normalized_uniq").on(t.titleNormalized),
    check("games_title_not_blank", sql`length(trim(${t.title})) > 0`),
    check("games_title_max_length", sql`length(${t.title}) <= 120`),
    check(
      "games_title_normalized_not_blank",
      sql`length(trim(${t.titleNormalized})) > 0`,
    ),
    check(
      "games_title_normalized_max_length",
      sql`length(${t.titleNormalized}) <= 120`,
    ),
  ],
);

export type Game = typeof gamesTable.$inferSelect;
export type InsertGame = typeof gamesTable.$inferInsert;
