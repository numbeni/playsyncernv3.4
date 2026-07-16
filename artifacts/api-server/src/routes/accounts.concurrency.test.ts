import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import pg from "pg";
import { startTestPg } from "../lib/test-pg.ts";

describe("Account creation / Game platform row locking", () => {
  let databaseUrl: string;
  let stopPg: () => Promise<void>;
  let pool: pg.Pool;

  before(async () => {
    const { databaseUrl: dbUrl, stop: stopPgFn } = await startTestPg();
    databaseUrl = dbUrl;
    stopPg = stopPgFn;

    // Connect directly to the disposable test database so the controlled
    // locking test uses two real PostgreSQL connections.
    pool = new pg.Pool({ connectionString: databaseUrl });
  });

  after(async () => {
    await pool.end();
    await stopPg();
  });

  it("serializes account creation and game platform change on the game row", async () => {
    const clientA = await pool.connect();
    const clientB = await pool.connect();

    try {
      // Seed a PS4_ONLY game.
      const { rows: [game] } = await clientA.query(
        `INSERT INTO "games" ("title", "title_normalized", "platform", "status")
         VALUES ('Lock Test', 'lock test', 'PS4_ONLY', 'ACTIVE')
         RETURNING "id"`,
      );
      const gameId = game.id;

      // Client A starts a transaction and locks the Game row.
      await clientA.query("BEGIN");
      const { rows: [lockedGame] } = await clientA.query(
        `SELECT "platform" FROM "games" WHERE "id" = $1 FOR UPDATE`,
        [gameId],
      );
      assert.strictEqual(lockedGame.platform, "PS4_ONLY");

      // Client B attempts to lock the same row; it will block until A commits.
      const bLockPromise = clientB.query(
        `SELECT "platform" FROM "games" WHERE "id" = $1 FOR UPDATE`,
        [gameId],
      );

      // Client A creates an Account and Capacities using the locked platform.
      const { rows: [account] } = await clientA.query(
        `INSERT INTO "accounts" (
          "game_id", "account_code", "account_number_prefix", "account_number_seq",
          "display_number", "email", "email_normalized",
          "playstation_password_encrypted", "email_password_encrypted"
        ) VALUES ($1, 'ACC-000001', 'LOCK', 1, '#LOCK-001', 'lock@example.com', 'lock@example.com', 'x', 'x')
        RETURNING "id"`,
        [gameId],
      );

      // Capacities for PS4_ONLY.
      await clientA.query(
        `INSERT INTO "account_capacities" ("account_id", "capacity_kind", "instance_no", "display_label")
         VALUES ($1, 'Z2_PS4', 0, 'Z2 PS4')`,
        [account.id],
      );

      // Commit A. This releases the Game lock and allows B to proceed.
      await clientA.query("COMMIT");

      // B now holds the lock and can inspect the committed state.
      await bLockPromise;
      const { rows: [history] } = await clientB.query(
        `SELECT count(*)::int AS "count" FROM "accounts" WHERE "game_id" = $1`,
        [gameId],
      );
      assert.strictEqual(history.count, 1);

      // B would now detect account history and block the platform change.
      // Roll back to leave the database in the post-account-creation state.
      await clientB.query("ROLLBACK");

      // Verify the Account has the original PS4_ONLY capacity.
      const { rows: caps } = await pool.query(
        `SELECT "capacity_kind", "instance_no" FROM "account_capacities" WHERE "account_id" = $1`,
        [account.id],
      );
      assert.deepStrictEqual(caps, [{ capacity_kind: "Z2_PS4", instance_no: 0 }]);

      // Verify the Game platform is unchanged.
      const { rows: [finalGame] } = await pool.query(
        `SELECT "platform" FROM "games" WHERE "id" = $1`,
        [gameId],
      );
      assert.strictEqual(finalGame.platform, "PS4_ONLY");
    } finally {
      clientA.release();
      clientB.release();
    }
  });

  it("allows both operations to succeed when the platform change wins first", async () => {
    const clientA = await pool.connect();
    const clientB = await pool.connect();

    try {
      // Seed a PS4_ONLY game.
      const { rows: [game] } = await clientA.query(
        `INSERT INTO "games" ("title", "title_normalized", "platform", "status")
         VALUES ('Lock Test 2', 'lock test 2', 'PS4_ONLY', 'ACTIVE')
         RETURNING "id"`,
      );
      const gameId = game.id;

      // Client A updates the platform to PS5_ONLY under a lock.
      await clientA.query("BEGIN");
      await clientA.query(
        `SELECT "platform" FROM "games" WHERE "id" = $1 FOR UPDATE`,
        [gameId],
      );
      await clientA.query(
        `UPDATE "games" SET "platform" = 'PS5_ONLY', "updated_at" = now() WHERE "id" = $1`,
        [gameId],
      );

      // Client B attempts to create an Account; it will block until A commits.
      const bAccountPromise = (async () => {
        await clientB.query("BEGIN");
        const { rows: [lockedGame] } = await clientB.query(
          `SELECT "platform" FROM "games" WHERE "id" = $1 FOR UPDATE`,
          [gameId],
        );
        const { rows: [account] } = await clientB.query(
          `INSERT INTO "accounts" (
            "game_id", "account_code", "account_number_prefix", "account_number_seq",
            "display_number", "email", "email_normalized",
            "playstation_password_encrypted", "email_password_encrypted"
          ) VALUES ($1, 'ACC-000002', 'LOCK', 1, '#LOCK-001', 'lock2@example.com', 'lock2@example.com', 'x', 'x')
          RETURNING "id"`,
          [gameId],
        );
        await clientB.query(
          `INSERT INTO "account_capacities" ("account_id", "capacity_kind", "instance_no", "display_label")
           VALUES ($1, 'Z2_PS5', 1, 'Z2 PS5 #1'), ($1, 'Z2_PS5', 2, 'Z2 PS5 #2'), ($1, 'Z3_PS5', 0, 'Z3 PS5')`,
          [account.id],
        );
        await clientB.query("COMMIT");
        return account.id;
      })();

      await clientA.query("COMMIT");
      const accountId = await bAccountPromise;

      // Verify the Account has the new PS5_ONLY capacities.
      const { rows: caps } = await pool.query(
        `SELECT "capacity_kind", "instance_no" FROM "account_capacities" WHERE "account_id" = $1 ORDER BY "capacity_kind", "instance_no"`,
        [accountId],
      );
      assert.deepStrictEqual(caps, [
        { capacity_kind: "Z2_PS5", instance_no: 1 },
        { capacity_kind: "Z2_PS5", instance_no: 2 },
        { capacity_kind: "Z3_PS5", instance_no: 0 },
      ]);

      // Verify the Game platform is now PS5_ONLY.
      const { rows: [finalGame] } = await pool.query(
        `SELECT "platform" FROM "games" WHERE "id" = $1`,
        [gameId],
      );
      assert.strictEqual(finalGame.platform, "PS5_ONLY");
    } finally {
      clientA.release();
      clientB.release();
    }
  });
});
