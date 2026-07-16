import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for migration tests");
}

const TEST_DB_NAME = "heliumdb_ps03c1_test";
const TEST_DATABASE_URL = DATABASE_URL.replace(/\/[^/]*$/, `/${TEST_DB_NAME}`);
const DB_DIR = path.resolve(fileURLToPath(import.meta.url), "../../..");

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
  const prefix = (overrides.account_number_prefix as string) || "TST";
  const displayNumber =
    (overrides.display_number as string) ||
    `#${prefix}-${String(seq).padStart(3, "0")}`;
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
  const columns = Object.keys(merged);
  const values = Object.values(merged);
  const result = await client.query(
    `INSERT INTO accounts (${columns.join(", ")})
     VALUES (${values.map((_, i) => `${i + 1}`).join(", ")})
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
    (overrides.display_label as string) ||
    (instanceNo === 0 ? "Z2 PS4" : `Z2 PS5 #${instanceNo}`);
  const defaults: Record<string, unknown> = {
    account_id: accountId,
    capacity_kind: "Z2_PS5",
    instance_no: instanceNo,
    display_label: displayLabel,
    is_finished: false,
    finished_at: null,
  };
  const merged = { ...defaults, ...overrides };
  const columns = Object.keys(merged);
  const values = Object.values(merged);
  const result = await client.query(
    `INSERT INTO account_capacities (${columns.join(", ")})
     VALUES (${values.map((_, i) => `${i + 1}`).join(", ")})
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
  const columns = Object.keys(merged);
  const values = Object.values(merged);
  const result = await client.query(
    `INSERT INTO account_backup_codes (${columns.join(", ")})
     VALUES (${values.map((_, i) => `${i + 1}`).join(", ")})
     RETURNING id`,
    values,
  );
  return result.rows[0].id as string;
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
  await managementPool?.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);
  await managementPool?.end();
});

describe("PS-03C1 additive schema", { concurrency: false }, () => {
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

  test("per-game counter allocation increments atomically", async () => {
    const client = await testPool!.connect();
    try {
      const gameId = await nextGame(client);
      await client.query("BEGIN");
      const res1 = await client.query(
        `INSERT INTO game_account_sequences (game_id, last_value)
         VALUES ($1, 1)
         ON CONFLICT (game_id) DO UPDATE SET last_value = game_account_sequences.last_value + 1
         RETURNING last_value`,
        [gameId],
      );
      await client.query("COMMIT");
      const first = Number(res1.rows[0].last_value);

      await client.query("BEGIN");
      const res2 = await client.query(
        `UPDATE game_account_sequences SET last_value = last_value + 1 WHERE game_id = $1 RETURNING last_value`,
        [gameId],
      );
      await client.query("COMMIT");
      const second = Number(res2.rows[0].last_value);

      assert.equal(first, 1);
      assert.equal(second, 2);
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
        display_number: `#${prefix}-${String(seq).padStart(3, "0")}`,
      });
      await assert.rejects(
        insertAccount(client, gameId, {
          account_number_prefix: prefix,
          account_number_seq: seq + 1,
          display_number: `#${prefix}-${String(seq).padStart(3, "0")}`,
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

      const backupEnums = await client.query(
        `SELECT e.enumlabel FROM pg_type t
         JOIN pg_enum e ON t.oid = e.enumtypid
         WHERE t.typname = 'capacity_kind'`,
      );
      const backupValues = backupEnums.rows.map((r) => r.enumlabel);
      assert.ok(backupValues.includes("Z3_PS5"));
    } finally {
      client.release();
    }
  });
});
