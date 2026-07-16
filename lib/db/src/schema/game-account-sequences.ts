import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { gamesTable } from "./games";

/**
 * Per-game Account sequence counter.
 *
 * Allocation pattern (runtime, not implemented in PS-03C1):
 *   UPDATE game_account_sequences
 *   SET last_value = last_value + 1
 *   WHERE game_id = ?
 *   RETURNING last_value;
 *
 * Requirements:
 *   - keyed by game_id
 *   - FK to games with ON DELETE NO ACTION / ON UPDATE NO ACTION
 *   - no MAX + 1
 *   - no counter reuse after Account deletion
 *   - no rows are inserted during the migration
 */
export const gameAccountSequencesTable = pgTable(
  "game_account_sequences",
  {
    gameId: uuid("game_id")
      .primaryKey()
      .references(() => gamesTable.id, {
        onDelete: "no action",
        onUpdate: "no action",
      }),
    lastValue: integer("last_value").notNull().default(0),
  },
);

export type GameAccountSequence =
  typeof gameAccountSequencesTable.$inferSelect;
export type InsertGameAccountSequence =
  typeof gameAccountSequencesTable.$inferInsert;
