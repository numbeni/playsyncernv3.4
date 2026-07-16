import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for migration tests");
}

const ACTIVE_DB_NAME = new URL(DATABASE_URL).pathname.slice(1);
const TEST_DB_NAME = process.env.PS03C1_TEST_DATABASE_URL
  ? new URL(process.env.PS03C1_TEST_DATABASE_URL).pathname.slice(1)
  : `ps03c1_test_${crypto.randomUUID().replace(/-/g, "")}`;
const TEST_DATABASE_URL =
  process.env.PS03C1_TEST_DATABASE_URL ??
  DATABASE_URL.replace(/\/[^/]*$/, `/${TEST_DB_NAME}`);

const TEST_DB_PATTERN = /^ps03c1_test_[a-f0-9]{32}$/;
const ROLLBACK_DB_PATTERN = /^ps03c1_rollback_test_[a-f0-9]{32}$/;
if (!TEST_DB_PATTERN.test(TEST_DB_NAME)) {
  throw new Error(
    `Generated test DB name "${TEST_DB_NAME}" does not match PS03C1 test naming pattern`,
  );
}
if (TEST_DB_NAME === ACTIVE_DB_NAME) {
  throw new Error(
    `Refusing to run tests against the active workspace database "${ACTIVE_DB_NAME}"`,
  );
}

const DB_DIR = path.resolve(fileURLToPath(import.meta.url), "../../..");
const ROLLBACK_SQL = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../reports/ps03c1_rollback.sql",
);
const MIGRATION_0000 = path.join(DB_DIR, "migrations", "0000_zippy_leech.sql");
const MIGRATION_0001 = path.join(DB_DIR, "migrations", "0001_glossy_onslaught.sql");
const MIGRATION_0002 = path.join(DB_DIR, "migrations", "0002_warm_swarm.sql");

let managementPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testGameCounter = 0;

async function nextGame(client: pg.PoolClient) {
  testGameCounter += 1;
  const title = `Test Game ${testGameCounter} ${Date.now()}`;
  const titleNormalized = `test-game-${testGameCounter}-${Date.now()}`;
  const result = await client.query(
    `INSERT INTO games (title, title_normalized, platform)
     VALUES ($1, $2, 'PS5_ONLY')
     RETURNING id`,
    [title, titleNormalized],
  );
  return result.rows[0].id as string;
}

async function insertAccount(
  client: pg.PoolClient,
  gameId: string,
  overrides: Record<string, unknown> = {},
) {
  testGameCounter += 1;
  const seq = testGameCounter;
  const prefix = (overrides.account_number_prefix as string) ?? "TST";
  const displayNumber =
    (overrides.display_number as string) ??
    `${prefix}-${String(seq).padStart(3, "0")}`;
  const defaults: Record<string, unknown> = {
    game_id: gameId,
    account_code: `ACC-${String(seq).padStart(6, "0")}`,
    account_number_prefix: prefix,
    account_number_seq: seq,
    display_number: displayNumber,
    email: `email-${seq}@example.com`,
    email_normalized: `email-${seq}@example.com`,
    playstation_password_encrypted: `pwd-${seq}`,
    email_password_encrypted: `email-pwd-${seq}`,
  };
  const merged = { ...defaults, ...overrides };
  const entries = Object.entries(merged);
  const columns = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  const result = await client.query(
    `INSERT INTO accounts (${columns.join(", ")})
     VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id`,
    values,
  );
  return {
    id: result.rows[0].id as string,
    accountCode: merged.account_code as string,
    seq: merged.account_number_seq as number,
    displayNumber: merged.display_number as string,
  };
}

async function insertCapacity(
  client: pg.PoolClient,
  accountId: string,
  overrides: Record<string, unknown> = {},
) {
  const instanceNo = (overrides.instance_no as number) ?? 1;
  const displayLabel =
    (overrides.display_label as string) ?? `Z2 PS5 #${instanceNo}`;
  const defaults: Record<string, unknown> = {
    account_id: accountId,
    capacity_kind: "Z2_PS5",
    instance_no: instanceNo,
    display_label: displayLabel,
    is_finished: false,
    finished_at: null,
  };
  const merged = { ...defaults, ...overrides };
  const entries = Object.entries(merged);
  const columns = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  const result = await client.query(
    `INSERT INTO account_capacities (${columns.join(", ")})
     VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id`,
    values,
  );
  return result.rows[0].id as string;
}

async function insertBackupCode(
  client: pg.PoolClient,
  accountId: string,
  overrides: Record<string, unknown> = {},
) {
  const defaults: Record<string, unknown> = {
    account_id: accountId,
    code_encrypted: `legacy-code-${testGameCounter}`,
    status: "AVAILABLE",
  };
  const merged = { ...defaults, ...overrides };
  const entries = Object.entries(merged);
  const columns = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  const result = await client.query(
    `INSERT INTO account_backup_codes (${columns.join(", ")})
     VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id`,
    values,
  );
  return result.rows[0].id as string;
}

async function incrementGameCounter(
  client: pg.PoolClient,
  gameId: string,
): Promise<number> {
  const res = await client.query(
    `UPDATE game_account_sequences
     SET last_value = last_value + 1
     WHERE game_id = $1
     RETURNING last_value`,
    [gameId],
  );
  return Number(res.rows[0].last_value);
}

async function captureSchema(client: pg.PoolClient) {
  const tables = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`,
  );
  const constraints = await client.query(
    `SELECT conname, conrelid::regclass::text AS table_name, contype, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace
     ORDER BY conname`,
  );
  const indexes = await client.query(
    `SELECT indexname, tablename, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
     ORDER BY indexname`,
  );
  const triggers = await client.query(
    `SELECT tgname, tgrelid::regclass::text AS table_name
     FROM pg_trigger
     WHERE NOT tgisinternal
     ORDER BY tgname`,
  );
  const functions = await client.query(
    `SELECT proname, pg_get_function_arguments(oid) AS args
     FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
     ORDER BY proname`,
  );
  const sequences = await client.query(
    `SELECT sequencename
     FROM pg_sequences
     WHERE schemaname = 'public'
     ORDER BY sequencename`,
  );
  const enums = await client.query(
    `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typnamespace = 'public'::regnamespace
     GROUP BY t.typname
     ORDER BY t.typname`,
  );
  return { tables, constraints, indexes, triggers, functions, sequences, enums };
}

async function applySqlFile(client: pg.PoolClient, filePath: string) {
  const sql = readFileSync(filePath, "utf-8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

async function applySqlText(client: pg.PoolClient, sql: string) {
  const statements = sql
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"))
    .map((s) => (s.endsWith(";") ? s : `${s};`));
  for (const stmt of statements) {
    await client.query(stmt);
  }
}

before(async () => {
  managementPool = new Pool({ connectionString: DATABASE_URL });
  await managementPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
  await managementPool.query(`CREATE DATABASE ${TEST_DB_NAME};`);

  execSync("pnpm run db:migrate", {
    cwd: DB_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  testPool = new Pool({ connectionString: TEST_DATABASE_URL });
});

after(async () => {
  await testPool?.end();
  if (TEST_DB_PATTERN.test(TEST_DB_NAME)) {
    await managementPool?.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
  }
  await managementPool?.end();
});

describe("PS-03C1 additive schema", { concurrency: false }, () => {
  test("disposable database is not the active workspace database", async () => {
    const client = await testPool!.connect();
    try {
      const res = await client.query("SELECT current_database()");
      assert.notEqual(res.rows[0].current_database, ACTIVE_DB_NAME);
      assert.equal(res.rows[0].current_database, TEST_DB_NAME);
    } finally {
      client.release();
    }
  });

  test("global account_code sequence produces increasing non-reused values", async () => {
    const client = await testPool!.connect();
    try {
      const res1 = await client.query("SELECT nextval('account_code_seq') AS v");
      const res2 = await client.query("SELECT nextval('account_code_seq') AS v");
      const res3 = await client.query("SELECT nextval('account_code_seq') AS v");
      const v1 = Number(res1.rows[0].v);
      const v2 = Number(res2.rows[0].v);
      const v3 = Number(res3.rows[0].v);
      assert.equal(v2, v1 + 1);
      assert.equal(v3, v2 + 1);
    } finally {
      client.release();
    }
  });

  test("rolled-back transaction does not reuse a global sequence value", async () => {
    const client = await testPool!.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query("SELECT nextval('account_code_seq') AS v");
      const rolledBack = Number(res.rows[0].v);
      await client.query("ROLLBACK");

      const res2 = await client.query("SELECT nextval('account_code_seq') AS v");
      const nextVal = Number(res2.rows[0].v);
      assert.ok(nextVal > rolledBack);
    } finally {
      client.release();
    }
  });

  test("per-game counter allocation increments atomically", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      await client.query(
        `INSERT INTO game_account_sequences (game_id, last_value) VALUES ($1, 0)`,
        [gameId],
      );
      const first = await incrementGameCounter(client, gameId);
      const second = await incrementGameCounter(client, gameId);
      assert.equal(first, 1);
      assert.equal(second, 2);
    } finally {
      client.release();
    }
  });

  test("concurrent per-game counter allocations produce distinct sequential values", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      await client.query(
        `INSERT INTO game_account_sequences (game_id, last_value) VALUES ($1, 0)`,
        [gameId],
      );
      const cA = await testPool!.connect();
      const cB = await testPool!.connect();
      try {
        async function allocate(client: pg.PoolClient, id: string): Promise<number> {
          await client.query("BEGIN");
          const v = await incrementGameCounter(client, id);
          await client.query("COMMIT");
          return v;
        }
        const [vA, vB] = await Promise.all([
          allocate(cA, gameId),
          allocate(cB, gameId),
        ]);
        assert.notEqual(vA, vB);
        const set = new Set([vA, vB]);
        assert.equal(set.size, 2);
        const final = await client.query(
          `SELECT last_value FROM game_account_sequences WHERE game_id = $1`,
          [gameId],
        );
        assert.equal(Number(final.rows[0].last_value), 2);
      } finally {
        cA.release();
        cB.release();
      }
    } finally {
      client.release();
    }
  });

  test("different Games have independent per-game counters", async () => {
    const client = await testPool!.connect();
    try {
      const gameA = await nextGame(client);
      const gameB = await nextGame(client);
      await client.query(
        `INSERT INTO game_account_sequences (game_id, last_value) VALUES ($1, 5)`,
        [gameA],
      );
      const resA = await client.query(
        `SELECT last_value FROM game_account_sequences WHERE game_id = $1`,
        [gameA],
      );
      const resB = await client.query(
        `SELECT last_value FROM game_account_sequences WHERE game_id = $1`,
        [gameB],
      );
      assert.equal(Number(resA.rows[0].last_value), 5);
      assert.equal(resB.rows[0], undefined);
    } finally {
      client.release();
    }
  });

  test("deleting an Account does not reset or reuse its per-game sequence number", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      await client.query(
        `INSERT INTO game_account_sequences (game_id, last_value) VALUES ($1, 0)`,
        [gameId],
      );
      const first = await incrementGameCounter(client, gameId);
      const account = await insertAccount(client, gameId);
      await client.query(`DELETE FROM accounts WHERE id = $1`, [account.id]);
      const second = await incrementGameCounter(client, gameId);
      assert.equal(first, 1);
      assert.equal(second, 2);
    } finally {
      client.release();
    }
  });

  test("unique (game_id, account_number_seq) is enforced", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      await insertAccount(client, gameId, { account_number_seq: 42 });
      await assert.rejects(
        insertAccount(client, gameId, { account_number_seq: 42 }),
        /unique constraint/,
      );
    } finally {
      client.release();
    }
  });

  test("unique (game_id, display_number) is enforced", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const prefix = "SHR";
      const seq = 99;
      await insertAccount(client, gameId, {
        account_number_prefix: prefix,
        account_number_seq: seq,
        display_number: `${prefix}-${String(seq).padStart(3, "0")}`,
      });
      await assert.rejects(
        insertAccount(client, gameId, {
          account_number_prefix: prefix,
          account_number_seq: seq + 1,
          display_number: `${prefix}-${String(seq).padStart(3, "0")}`,
        }),
        /unique constraint/,
      );
    } finally {
      client.release();
    }
  });

  test("duplicate PSN Email lookup hashes remain allowed", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const hash = "psn-email-hash-dup";
      await insertAccount(client, gameId, { psn_email_lookup_hash: hash });
      await insertAccount(client, gameId, { psn_email_lookup_hash: hash });
      const res = await client.query(
        `SELECT count(*) FROM accounts WHERE psn_email_lookup_hash = $1`,
        [hash],
      );
      assert.equal(Number(res.rows[0].count), 2);
    } finally {
      client.release();
    }
  });

  test("duplicate Family Management Email lookup hashes remain allowed", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const hash = "family-email-hash-dup";
      await insertAccount(client, gameId, {
        family_management_email_lookup_hash: hash,
      });
      await insertAccount(client, gameId, {
        family_management_email_lookup_hash: hash,
      });
      const res = await client.query(
        `SELECT count(*) FROM accounts WHERE family_management_email_lookup_hash = $1`,
        [hash],
      );
      assert.equal(Number(res.rows[0].count), 2);
    } finally {
      client.release();
    }
  });

  test("duplicate Online ID values remain allowed", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const onlineId = "online-id-dup";
      await insertAccount(client, gameId, { online_id: onlineId });
      await insertAccount(client, gameId, { online_id: onlineId });
      const res = await client.query(
        `SELECT count(*) FROM accounts WHERE online_id = $1`,
        [onlineId],
      );
      assert.equal(Number(res.rows[0].count), 2);
    } finally {
      client.release();
    }
  });

  test("identifier update trigger blocks actual identifier changes", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id } = await insertAccount(client, gameId);
      await assert.rejects(
        client.query(
          `UPDATE accounts SET account_code = 'ACC-999999' WHERE id = $1`,
          [id],
        ),
        /Account identifiers are immutable/,
      );
    } finally {
      client.release();
    }
  });

  test("identifier update trigger permits unrelated Account updates", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id } = await insertAccount(client, gameId);
      await client.query(
        `UPDATE accounts SET status = 'disabled' WHERE id = $1`,
        [id],
      );
      const res = await client.query(
        `SELECT status FROM accounts WHERE id = $1`,
        [id],
      );
      assert.equal(res.rows[0].status, "disabled");
    } finally {
      client.release();
    }
  });

  test("identifier update trigger permits identical-value updates", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id, accountCode } = await insertAccount(client, gameId);
      await client.query(
        `UPDATE accounts SET account_code = $1 WHERE id = $2`,
        [accountCode, id],
      );
      const res = await client.query(
        `SELECT account_code FROM accounts WHERE id = $1`,
        [id],
      );
      assert.equal(res.rows[0].account_code, accountCode);
    } finally {
      client.release();
    }
  });

  test("Capacity FINISHED consistency accepts valid states", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id: accountId } = await insertAccount(client, gameId);
      const id1 = await insertCapacity(client, accountId, {
        is_finished: false,
        finished_at: null,
      });
      const id2 = await insertCapacity(client, accountId, {
        instance_no: 2,
        display_label: "Z2 PS5 #2",
        is_finished: true,
        finished_at: new Date().toISOString(),
      });
      assert.ok(id1);
      assert.ok(id2);
    } finally {
      client.release();
    }
  });

  test("Capacity FINISHED consistency rejects contradictory states", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id: accountId } = await insertAccount(client, gameId);
      await assert.rejects(
        insertCapacity(client, accountId, {
          is_finished: true,
          finished_at: null,
        }),
        /check constraint/,
      );
      await assert.rejects(
        insertCapacity(client, accountId, {
          instance_no: 2,
          display_label: "Z2 PS5 #2",
          is_finished: false,
          finished_at: new Date().toISOString(),
        }),
        /check constraint/,
      );
    } finally {
      client.release();
    }
  });

  test("Backup Code lifecycle enum accepts only approved values", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id: accountId } = await insertAccount(client, gameId);
      await insertBackupCode(client, accountId, { status: "AVAILABLE" });
      await insertBackupCode(client, accountId, { status: "USED" });
      await insertBackupCode(client, accountId, { status: "REVOKED" });
      await assert.rejects(
        insertBackupCode(client, accountId, { status: "INVALID" }),
        /invalid input value/,
      );
    } finally {
      client.release();
    }
  });

  test("manual Account override accepts only SOLD, INACTIVE or NULL", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id: idSold } = await insertAccount(client, gameId, {
        status_override: "SOLD",
      });
      const { id: idInactive } = await insertAccount(client, gameId, {
        status_override: "INACTIVE",
      });
      const { id: idNull } = await insertAccount(client, gameId);
      await assert.rejects(
        insertAccount(client, gameId, { status_override: "AVAILABLE" }),
        /invalid input value/,
      );
      const sold = await client.query(
        `SELECT status_override FROM accounts WHERE id = $1`,
        [idSold],
      );
      const inactive = await client.query(
        `SELECT status_override FROM accounts WHERE id = $1`,
        [idInactive],
      );
      const nullOverride = await client.query(
        `SELECT status_override FROM accounts WHERE id = $1`,
        [idNull],
      );
      assert.equal(sold.rows[0].status_override, "SOLD");
      assert.equal(inactive.rows[0].status_override, "INACTIVE");
      assert.equal(nullOverride.rows[0].status_override, null);
    } finally {
      client.release();
    }
  });

  test("new shared Z3 representation accepts Z3_SHARED_PS5_PS4", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      const { id: accountId } = await insertAccount(client, gameId);
      const id = await insertCapacity(client, accountId, {
        capacity_kind_v2: "Z3_SHARED_PS5_PS4",
      });
      assert.ok(id);
    } finally {
      client.release();
    }
  });

  test("legacy columns and enum values remain present", async () => {
    const client = await testPool!.connect();
    try {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'accounts'
         ORDER BY column_name`,
      );
      const names = cols.rows.map((r) => r.column_name);
      assert.ok(names.includes("email"));
      assert.ok(names.includes("email_normalized"));
      assert.ok(names.includes("status"));
      assert.ok(names.includes("family_management_email_encrypted"));

      const enums = await client.query(
        `SELECT e.enumlabel FROM pg_type t
         JOIN pg_enum e ON t.oid = e.enumtypid
         WHERE t.typname = 'account_status'`,
      );
      const values = enums.rows.map((r) => r.enumlabel);
      assert.ok(values.includes("active"));
      assert.ok(values.includes("disabled"));

      const capacityEnums = await client.query(
        `SELECT e.enumlabel FROM pg_type t
         JOIN pg_enum e ON t.oid = e.enumtypid
         WHERE t.typname = 'capacity_kind'`,
      );
      const capacityValues = capacityEnums.rows.map((r) => r.enumlabel);
      assert.ok(capacityValues.includes("Z3_PS5"));
    } finally {
      client.release();
    }
  });

  test("rollback restores schema to post-0001 state", async () => {
    const rollbackDbName = `ps03c1_rollback_test_${crypto
      .randomUUID()
      .replace(/-/g, "")}`;
    if (rollbackDbName === ACTIVE_DB_NAME) {
      throw new Error("Rollback DB name collides with active DB");
    }
    if (!ROLLBACK_DB_PATTERN.test(rollbackDbName)) {
      throw new Error(
        "Rollback DB name does not match PS03C1 rollback test pattern",
      );
    }
    const rollbackDbUrl = DATABASE_URL.replace(
      /\/[^/]*$/,
      `/${rollbackDbName}`,
    );

    await managementPool!.query(`DROP DATABASE IF EXISTS ${rollbackDbName};`);
    await managementPool!.query(`CREATE DATABASE ${rollbackDbName};`);

    const rollbackPool = new Pool({ connectionString: rollbackDbUrl });
    const rollbackClient = await rollbackPool.connect();
    let post0001: Awaited<ReturnType<typeof captureSchema>>;
    let postRollback: Awaited<ReturnType<typeof captureSchema>>;
    try {
      // 1. Apply 0000 and 0001 directly to reach a post-0001 baseline.
      await applySqlFile(rollbackClient, MIGRATION_0000);
      await applySqlFile(rollbackClient, MIGRATION_0001);
      post0001 = await captureSchema(rollbackClient);

      // 2. Apply 0002.
      await applySqlFile(rollbackClient, MIGRATION_0002);

      // 3. Execute the rollback plan.
      const rollbackSql = readFileSync(ROLLBACK_SQL, "utf-8");
      await applySqlText(rollbackClient, rollbackSql);

      postRollback = await captureSchema(rollbackClient);
    } finally {
      rollbackClient.release();
      await rollbackPool.end();
      await managementPool!.query(
        `DROP DATABASE IF EXISTS ${rollbackDbName};`,
      );
    }

    const diff = JSON.stringify(post0001) === JSON.stringify(postRollback);
    if (!diff) {
      assert.deepEqual(postRollback, post0001);
    }
  });
});
