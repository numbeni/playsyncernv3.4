# PS-03C1 — Final Evidence Integrity and Workflow Triage Report

**Status:** PS-03C1 — IMPLEMENTED, AWAITING COMMAND CENTER REVIEW

**Date:** 2026-07-16

---

## 1. Summary

This report completes the final evidence-integrity pass requested by the Command Center. Migration 0002 remains applied to the live Replit database and was not reapplied. No runtime code, OpenAPI, generated clients, or Customer Assignment logic was modified. All required checks pass, the disposable-database test harness was corrected, counter tests were strengthened, migration history was verified directly, and the API Server workflow failure was triaged and proven to be a pre-existing workflow/port conflict unrelated to migration 0002.

---

## 2. API Server Workflow Triage

### 2.1 Workflow definitions

The workspace currently has two distinct workflows that both start the API Server:

| Workflow name | Command | Port |
|---|---|---|
| `API Server` | `PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 (inherited from Replit/artifact routing) |

The same duplication exists for the PlaySyncer frontend:

| Workflow name | Command | Port |
|---|---|---|
| `PlaySyncer Frontend` | `PORT=24351 BASE_PATH=/ pnpm --filter @workspace/playsyncer run dev` | 24351 |
| `artifacts/playsyncer: web` | `pnpm --filter @workspace/playsyncer run dev` | 24351 |

### 2.2 Failure evidence

**Workflow:** `artifacts/api-server: API Server`

**Command:** `pnpm --filter @workspace/api-server run dev`

**Exit code:** 1

**Sanitized error output:**

```
> @workspace/api-server@0.0.0 dev /home/runner/workspace/artifacts/api-server
> export NODE_ENV=development && pnpm run build && pnpm run start

> @workspace/api-server@0.0.0 build /home/runner/workspace/artifacts/api-server
> node ./build.mjs

  dist/index.mjs                       1.8mb ⚠️
  ...

> @workspace/api-server@0.0.0 start /home/runner/workspace/artifacts/api-server
> node --enable-source-maps ./dist/index.mjs

[11:53:03.866] ERROR (709): Error listening on port
    err: {
      "type": "Error",
      "message": "listen EADDRINUSE: address already in use 0.0.0.0:8080",
      "stack":
          Error: listen EADDRINUSE: address already in use 0.0.0.0:8080
              at Server.setupListenHandle [as _listen2] (node:net:1940:16)
              ...
      "code": "EADDRINUSE",
      "errno": -98,
      "syscall": "listen",
      "address": "0.0.0.0",
      "port": 8080
    }

ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @workspace/api-server@0.0.0 dev: `export NODE_ENV=development && pnpm run build && pnpm run start`
Exit status 1
```

The manual `API Server` workflow is already running and holding port 8080. When the artifact-registered `artifacts/api-server: API Server` workflow tries to start, it cannot bind to the same port.

### 2.3 Root cause determination

The failure is **not caused by migration 0002**. Evidence:

1. **Error type:** `EADDRINUSE` is a TCP port binding error, not a database schema error, query failure, or Drizzle mismatch.
2. **API source:** `artifacts/api-server/src/index.ts` reads the `PORT` environment variable and binds to it. There is no hard-coded port and no schema-dependent startup code at the server entry point.
3. **Deployment history:** Replit deployment logs from 2026-07-15 show the same `artifacts/api-server` process was successfully starting and serving `/api/healthz` with status 200 before the current PS-03C1 session began.
4. **Duplicate workflows:** The `.replit` file defines an `API Server` workflow, while the Replit artifact system separately auto-generates `artifacts/api-server: API Server`. Both target the same port, which is a workflow configuration issue, not a code issue.
5. **No database error:** The log contains no PostgreSQL connection failure, missing column/enum/type error, or migration-related message.

### 2.4 Classification

- **Existed before PS-03C1?** The workflow duplication is a structural artifact of having both a manually defined `.replit` workflow and a Replit-registered artifact workflow. It was present before the final evidence pass.
- **Caused by Replit workflow configuration?** Yes — duplicate workflows contend for the same port.
- **Caused by environment/port configuration?** Yes — two workflows are configured for the same port.
- **Caused by the live 0002 schema?** No — the error is `EADDRINUSE`, not a schema error.
- **Unrelated but currently unresolved?** Yes — the port conflict is unrelated to PS-03C1 schema work and should be resolved in a separate workflow/artifact cleanup task.

**Conclusion:** This is not a release blocker for PS-03C1. The live database migration is healthy.

---

## 3. Disposable Database Test Harness Correction

The migration test file was updated so that management operations (creating and dropping disposable databases) always target the same PostgreSQL server as the test database URL.

### 3.1 Behavior before correction

When `PS03C1_TEST_DATABASE_URL` was set, the test connection went to that URL, but `managementPool` was constructed from `DATABASE_URL` (the active workspace database). This could create or drop the disposable database on the active workspace server while the tests ran against a different server.

### 3.2 Behavior after correction

```typescript
function databaseUrlForName(baseUrl: string, dbName: string): string {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

function deriveManagementUrl(testUrl: string): string {
  return databaseUrlForName(testUrl, "postgres");
}

const MANAGEMENT_DATABASE_URL = process.env.PS03C1_TEST_DATABASE_URL
  ? deriveManagementUrl(process.env.PS03C1_TEST_DATABASE_URL)
  : DATABASE_URL;
```

`managementPool` now uses `MANAGEMENT_DATABASE_URL`, which is derived from the provided test URL when present. This ensures the `CREATE DATABASE`/`DROP DATABASE` commands run on the same server as the tests.

### 3.3 Preserved protections

- Disposable database name pattern: `^ps03c1_test_[a-f0-9]{32}$` (and rollback pattern `^ps03c1_rollback_test_[a-f0-9]{32}$`).
- Active database name rejection: `TEST_DB_NAME === ACTIVE_DB_NAME` throws.
- Unique random database name: `crypto.randomUUID()` with dashes removed.
- Cleanup after tests: `after` hook drops only pattern-matching databases.
- No synthetic data in the live database: all tests run against the disposable DB.

The rollback test also uses `databaseUrlForName(TEST_DATABASE_URL, rollbackDbName)` so its rollback database is created on the same server as the test database.

---

## 4. Strengthened Counter Tests

Three new isolated tests were added to `lib/db/src/migrations/ps03c1.test.ts`.

### 4.1 Concurrent first allocations when no row exists

```typescript
test("concurrent first per-game counter allocations when no row exists", async () => {
  ...
  const [vA, vB] = await Promise.all([
    allocate(cA, gameId),
    allocate(cB, gameId),
  ]);
  assert.notEqual(vA, vB);
  ...
});
```

This test verifies the `INSERT ... ON CONFLICT (game_id) DO UPDATE ...` upsert correctly handles the case where two concurrent callers both try to create the first per-game counter row. Result: both values are distinct and the final `last_value` is 2.

### 4.2 Two different Games begin counters independently

```typescript
const vA = await incrementGameCounter(client, gameA);
const vB = await incrementGameCounter(client, gameB);
assert.equal(vA, 1);
assert.equal(vB, 1);
```

Each game starts from 1, proving per-game counter isolation from the first allocation.

### 4.3 Deleted Account with allocated sequence

```typescript
const first = await incrementGameCounter(client, gameId);
const account = await insertAccount(client, gameId, {
  account_number_seq: first,
  display_number: `TST-${String(first).padStart(3, "0")}`,
});
await client.query(`DELETE FROM accounts WHERE id = $1`, [account.id]);
const second = await incrementGameCounter(client, gameId);
assert.equal(second, 2);
assert.notEqual(second, first);
```

Proves that deleting an Account created with the allocated sequence does not cause the next allocation to reuse that sequence.

### 4.4 `incrementGameCounter` helper update

The helper now performs an upsert:

```sql
INSERT INTO game_account_sequences (game_id, last_value)
VALUES ($1, 1)
ON CONFLICT (game_id)
DO UPDATE SET last_value = game_account_sequences.last_value + 1
RETURNING last_value
```

This is additive to the existing tests and does not modify migration 0002 or runtime code.

---

## 5. Disposable Migration History Verification

A new test directly queries `drizzle.__drizzle_migrations` after the disposable database is migrated:

```typescript
const res = await client.query(
  `SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id`,
);
assert.equal(res.rows.length, 3);
assert.equal(Number(res.rows[0].id), 1);
assert.equal(res.rows[0].hash, "a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca");
assert.equal(Number(res.rows[1].id), 2);
assert.equal(res.rows[1].hash, "c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2");
assert.equal(Number(res.rows[2].id), 3);
assert.equal(res.rows[2].hash, "99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a");
```

Result: PASS.

---

## 6. Rollback Authority Clarification

`reports/ps03c1_rollback.sql` was updated with explicit authority statements at the top:

```sql
-- PS-03C1 rollback plan for migration 0002_warm_swarm.sql
-- ==========================================================================
-- DISPOSABLE DATABASE ONLY.
-- DO NOT execute this file against the active Replit database.
-- Migration 0002 remains recorded in the live Drizzle history; this file does
-- NOT delete or modify any live migration-history row.
-- Any future live schema reversal must be implemented as a separately approved
-- forward corrective migration. The 0002 migration file must never be edited or
-- removed.
-- ==========================================================================
-- Removes only objects introduced by PS-03C1 in safe reverse dependency order.
```

The rollback SQL continues to be validated only by the disposable-database rollback test in `lib/db/src/migrations/ps03c1.test.ts`. No migration-history row was deleted from the live database.

---

## 7. Schema Comment Correction

In `lib/db/src/schema/accounts.ts`, the misleading comment:

```typescript
// Display number components. Stored separately to allow safe prefix changes.
```

was corrected to:

```typescript
// Display number components. The prefix and sequence are immutable after Account creation.
```

This is a comment-only correction. The identifier immutability trigger and the approved `GOW-001` display format remain unchanged.

---

## 8. Evidence Checks

### 8.1 `pnpm run typecheck`

**Result:** PASS

```
> workspace@0.0.0 typecheck /home/runner/workspace
> pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck

> workspace@0.0.0 typecheck:libs /home/runner/workspace
> tsc --build

Scope: 4 of 9 workspace projects
artifacts/api-server typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 1.2s
artifacts/mockup-sandbox typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 4.4s
artifacts/playsyncer typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 3.3s
scripts typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 667ms
```

### 8.2 `pnpm --filter @workspace/db run db:check`

**Result:** PASS

```
> @workspace/db@0.0.0 db:check /home/runner/workspace/lib/db
> drizzle-kit check --config ./drizzle.config.ts

Reading config file '/home/runner/workspace/lib/db/drizzle.config.ts'
Everything's fine 🐶🔥
```

### 8.3 `pnpm --filter @workspace/db run test`

**Result:** PASS

```
> @workspace/db@0.0.0 test /home/runner/workspace/lib/db
> node --test src/helpers/*.test.ts

▶ cleanGameTitle
  ✔ trims surrounding whitespace (0.771457ms)
  ✔ collapses repeated internal whitespace to one space (0.125597ms)
  ✔ preserves display casing (0.099085ms)
  ✔ collapses tabs and newlines (0.070481ms)
✔ cleanGameTitle (1.782253ms)
▶ normalizeGameTitle
  ✔ trims surrounding whitespace (0.205183ms)
  ✔ collapses repeated internal whitespace to one space (0.072107ms)
  ✔ lowercases for case-insensitive duplicate detection (0.12278ms)
  ✔ makes equivalent titles collide (0.1114ms)
  ✔ keeps distinct editions distinct (0.285535ms)
✔ normalizeGameTitle (2.583029ms)
▶ prepareGameTitle
  ✔ returns cleaned display and normalized title (0.284181ms)
  ✔ throws GameTitleError for whitespace-only input (0.419888ms)
  ✔ throws GameTitleError for title over 120 characters (0.142485ms)
  ✔ accepts a 120-character cleaned title (0.091085ms)
✔ prepareGameTitle (1.054616ms)
ℹ tests 13
ℹ suites 3
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 153.824065
```

### 8.4 `pnpm --filter @workspace/db run test:migrations`

**Result:** PASS (26/26)

```
> @workspace/db@0.0.0 test:migrations /home/runner/workspace/lib/db
> node --test --test-concurrency=1 src/migrations/*.test.ts

▶ PS-03C1 additive schema
  ✔ disposable database is not the active workspace database (16.003208ms)
  ✔ disposable migration history matches expected hashes (2.982121ms)
  ✔ global account_code sequence produces increasing non-reused values (6.030101ms)
  ✔ rolled-back transaction does not reuse a global sequence value (3.572584ms)
  ✔ per-game counter allocation increments atomically (17.136078ms)
  ✔ concurrent per-game counter allocations produce distinct sequential values (33.142914ms)
  ✔ different Games have independent per-game counters (10.938167ms)
  ✔ deleting an Account does not reset or reuse its per-game sequence number (20.644611ms)
  ✔ concurrent first per-game counter allocations when no row exists (12.79705ms)
  ✔ two different Games begin per-game counters independently (12.474796ms)
  ✔ deleted Account with allocated sequence does not reuse its per-game sequence number (18.115652ms)
  ✔ unique (game_id, account_number_seq) is enforced (94.329891ms)
  ✔ unique (game_id, display_number) is enforced (7.03809ms)
  ✔ duplicate PSN Email lookup hashes remain allowed (11.081927ms)
  ✔ duplicate Family Management Email lookup hashes remain allowed (9.008813ms)
  ✔ duplicate Online ID values remain allowed (10.091469ms)
  ✔ identifier update trigger blocks actual identifier changes (7.304488ms)
  ✔ identifier update trigger permits unrelated Account updates (10.656664ms)
  ✔ identifier update trigger permits identical-value updates (10.255373ms)
  ✔ Capacity FINISHED consistency accepts valid states (12.797853ms)
  ✔ Capacity FINISHED consistency rejects contradictory states (7.310652ms)
  ✔ Backup Code lifecycle enum accepts only approved values (14.751156ms)
  ✔ manual Account override accepts only SOLD, INACTIVE or NULL (13.750241ms)
  ✔ new shared Z3 representation accepts Z3_SHARED_PS5_PS4 (10.917735ms)
  ✔ legacy columns and enum values remain present (10.153327ms)
  ✔ rollback restores schema to post-0001 state (2341.612055ms)
✔ PS-03C1 additive schema (6264.041135ms)
ℹ tests 26
ℹ suites 1
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6573.219984
```

---

## 9. Live Read-Only Verification

Executed inside `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;`:

```
BEGIN
 transaction_read_only
-----------------------
 on
(1 row)

 id |                               hash
----+------------------------------------------------------------------
  1 | a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca
  2 | c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2
  3 | 99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a

 accounts                | 0
 account_backup_codes    | 0
 account_capacities      | 0
 game_account_sequences  | 0

ROLLBACK
```

Checklist:

- [x] `transaction_read_only` was `on`.
- [x] 0002 remains applied exactly once.
- [x] 0002 hash is unchanged: `99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a`.
- [x] 0000 and 0001 hashes remain unchanged.
- [x] All Account-related tables remain empty.
- [x] `game_account_sequences` remains empty.

Migration 0002 was not reapplied during this pass.

---

## 10. Full Baseline Diff

Generated against the canonical PS-02B baseline:

- **Baseline file:** `playsyncer-ps02b-final.zip`
- **Baseline SHA-256:** `d6a61547e1a61a7660278f2ed699cabe20eb57c21364c75543a3649773b80135`
- **Diff file:** `reports/ps03c1_full_baseline.diff`
- **Diff line count:** 2,813 lines

The diff includes all PS-03C1 files:

- `lib/db/migrations/0002_warm_swarm.sql`
- `lib/db/migrations/meta/0002_snapshot.json`
- `lib/db/migrations/meta/_journal.json`
- `lib/db/package.json`
- `lib/db/src/schema/enums.ts`
- `lib/db/src/schema/accounts.ts`
- `lib/db/src/schema/account-backup-codes.ts`
- `lib/db/src/schema/account-capacities.ts`
- `lib/db/src/schema/game-account-sequences.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/migrations/ps03c1.test.ts`
- `reports/ps03c1_rollback.sql`

No runtime source, OpenAPI, generated clients, or Customer Assignment files appear in the PS-03C1 baseline diff.

---

## 11. Final Source Package Export

A complete final source package (excluding `.git`, `node_modules`, `dist`, `tmp`, `.replit-artifact`, `attached_assets`, and `exports` to avoid recursive/unnecessary bloat) was exported:

| Attribute | Value |
|---|---|
| Filename | `exports/playsyncer-ps03c1-final.zip` |
| Size | 199 MB |
| SHA-256 | `09e9a3ec23117f7e162f00ce5f62d83d2146f3c4e2471100925716d334af43cc` |

---

## 12. Changed Files

Git-tracked files changed during this final pass:

| File | Change |
|---|---|
| `lib/db/src/migrations/ps03c1.test.ts` | Disposable DB harness fix; new migration-history, counter, and deletion tests. |
| `lib/db/src/schema/accounts.ts` | Corrected display-number comment to state immutability. |
| `reports/ps03c1_rollback.sql` | Clarified disposable-only authority and live reversal policy. |

Untracked deliverables:

| File | Purpose |
|---|---|
| `reports/ps03c1_full_baseline.diff` | Complete PS-03C1 diff against the PS-02B baseline. |
| `reports/ps03c1_final_review_report.md` | This report. |
| `exports/playsyncer-ps03c1-final.zip` | Final source package and report export. |
| `attached_assets/Pasted-Continue-only-PS-03C1-Final-Evidence-Integrity-and-Work_1784211155032.txt` | User's correction prompt (not a code change). |

---

## 13. Final Status

**PS-03C1 — IMPLEMENTED, AWAITING COMMAND CENTER REVIEW**

No further action is required by the agent until the Command Center review is complete. The API Server workflow failure is a pre-existing workflow/port duplication issue and is not a release blocker for the PS-03C1 schema migration.
