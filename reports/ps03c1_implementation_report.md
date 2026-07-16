# PS-03C1 — Additive Account Schema Migration — Implementation Report

**Status:** PS-03C1 — IMPLEMENTED, AWAITING COMMAND CENTER REVIEW

**Date:** 2026-07-16

---

## 1. Summary

PS-03C1 adds the foundational additive schema for the Account Core without modifying any runtime code. The stage is limited to:

- One new Drizzle-generated migration: `lib/db/migrations/0002_warm_swarm.sql`.
- New migration tests: `lib/db/src/migrations/ps03c1.test.ts`.
- A manual correction to the display-number comment in `lib/db/src/schema/accounts.ts` (approved format `GOW-001`, no leading `#`).
- A rollback plan: `reports/ps03c1_rollback.sql`.

No backend CRUD, OpenAPI, generated clients, frontend integration, Secret Reveal, Customer Assignment, or later stage work was performed. No files under `artifacts/api-server`, `artifacts/playsyncer`, `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`, or `capacity_customers` schema were modified.

---

## 2. Changed Files

Files tracked by Git that were changed during PS-03C1:

| File | Change |
|---|---|
| `lib/db/src/migrations/ps03c1.test.ts` | New comprehensive migration tests (placeholders, concurrency, safety, rollback). |
| `lib/db/src/schema/accounts.ts` | Updated display-number comment to approved per-game format `GOW-001`. |

Untracked deliverables created during PS-03C1:

| File | Purpose |
|---|---|
| `reports/ps03c1_rollback.sql` | Explicit rollback SQL for 0002 objects. |
| `reports/ps03c1_complete.diff` | Complete Git diff of tracked changes. |
| `reports/ps03c1_implementation_report.md` | This report. |

The uploaded user asset `attached_assets/Pasted-Continue-only-PS-03C1-Additive-Account-Schema-Migration_1784210035968.txt` is not a code change; it was the correction prompt.

---

## 3. Migration Hashes

SHA-256 of the migration files on disk:

```
a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca  lib/db/migrations/0000_zippy_leech.sql
c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2  lib/db/migrations/0001_glossy_onslaught.sql
99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a  lib/db/migrations/0002_warm_swarm.sql
```

Expected live hashes:

- 0000: `a43ab14c...` (unchanged from preflight and post-migration)
- 0001: `c09f28b3...` (unchanged from preflight and post-migration)
- 0002: `99f124e4...` (matches the expected repository hash specified in the correction prompt)

`0000_zippy_leech.sql` and `0001_glossy_onslaught.sql` were not edited during PS-03C1.

---

## 4. Required Checks

### 4.1 Monorepo typecheck

**Command:** `pnpm run typecheck`

**Result:** PASS

```
> workspace@0.0.0 typecheck /home/runner/workspace
> pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck

> workspace@0.0.0 typecheck:libs /home/runner/workspace
> tsc --build

Scope: 4 of 9 workspace projects
artifacts/api-server typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 2.3s
artifacts/mockup-sandbox typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 4.8s
artifacts/playsyncer typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 3.2s
scripts typecheck$ tsc -p tsconfig.json --noEmit
└─ Done in 913ms
```

### 4.2 Database package check

**Command:** `pnpm --filter @workspace/db run db:check`

**Result:** PASS

```
> @workspace/db@0.0.0 db:check /home/runner/workspace/lib/db
> drizzle-kit check --config ./drizzle.config.ts

Reading config file '/home/runner/workspace/lib/db/drizzle.config.ts'
Everything's fine 🐶🔥
```

### 4.3 Database package tests (helpers)

**Command:** `pnpm --filter @workspace/db run test`

**Result:** PASS

```
> @workspace/db@0.0.0 test /home/runner/workspace/lib/db
> node --test src/helpers/*.test.ts

▶ cleanGameTitle
  ✔ trims surrounding whitespace (0.929648ms)
  ✔ collapses repeated internal whitespace to one space (0.160615ms)
  ✔ preserves display casing (0.149543ms)
  ✔ collapses tabs and newlines (0.213047ms)
✔ cleanGameTitle (2.40193ms)
▶ normalizeGameTitle
  ✔ trims surrounding whitespace (0.389596ms)
  ✔ lowercases for case-insensitive duplicate detection (0.16998ms)
  ✔ makes equivalent titles collide (2.807694ms)
  ✔ keeps distinct editions distinct (0.236794ms)
✔ normalizeGameTitle (4.297611ms)
▶ prepareGameTitle
  ✔ returns cleaned display and normalized title (0.227212ms)
  ✔ throws GameTitleError for whitespace-only input (0.408801ms)
  ✔ throws GameTitleError for title over 120 characters (0.385516ms)
  ✔ accepts a 120-character cleaned title (0.12573ms)
✔ prepareGameTitle (1.275212ms)
ℹ tests 13
ℹ suites 3
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 182.449869
```

### 4.4 Migration tests

**Command:** `pnpm --filter @workspace/db run test:migrations`

**Result:** PASS

```
> @workspace/db@0.0.0 test:migrations /home/runner/workspace/lib/db
> node --test --test-concurrency=1 src/migrations/*.test.ts

▶ PS-03C1 additive schema
  ✔ disposable database is not the active workspace database (13.986503ms)
  ✔ global account_code sequence produces increasing non-reused values (5.023577ms)
  ✔ rolled-back transaction does not reuse a global sequence value (2.570423ms)
  ✔ per-game counter allocation increments atomically (15.194263ms)
  ✔ concurrent per-game counter allocations produce distinct sequential values (31.932953ms)
  ✔ different Games have independent per-game counters (9.467379ms)
  ✔ deleting an Account does not reset or reuse its per-game sequence number (18.174624ms)
  ✔ unique (game_id, account_number_seq) is enforced (8.323248ms)
  ✔ unique (game_id, display_number) is enforced (8.595438ms)
  ✔ duplicate PSN Email lookup hashes remain allowed (9.560606ms)
  ✔ duplicate Family Management Email lookup hashes remain allowed (12.18594ms)
  ✔ duplicate Online ID values remain allowed (10.589356ms)
  ✔ identifier update trigger blocks actual identifier changes (7.575186ms)
  ✔ identifier update trigger permits unrelated Account updates (9.716317ms)
  ✔ identifier update trigger permits identical-value updates (11.331787ms)
  ✔ Capacity FINISHED consistency accepts valid states (13.049493ms)
  ✔ Capacity FINISHED consistency rejects contradictory states (7.793331ms)
  ✔ Backup Code lifecycle enum accepts only approved values (14.747864ms)
  ✔ manual Account override accepts only SOLD, INACTIVE or NULL (12.336723ms)
  ✔ new shared Z3 representation accepts Z3_SHARED_PS5_PS4 (8.938882ms)
  ✔ legacy columns and enum values remain present (5.463821ms)
  ✔ rollback restores schema to post-0001 state (1162.240407ms)
✔ PS-03C1 additive schema (3084.161435ms)
ℹ tests 22
ℹ suites 1
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3396.670194
```

---

## 5. Disposable Database Evidence

### 5.1 Safety approach

The migration test file uses one of the two safe approaches permitted by the correction prompt:

- If `PS03C1_TEST_DATABASE_URL` is set, it is validated and used.
- Otherwise, a unique disposable database name is generated with the pattern `ps03c1_test_<32-hex-chars>`.

Safety checks enforced before any CREATE/DROP:

1. The test database name must match `^ps03c1_test_[a-f0-9]{32}$` (or the explicit URL's name must match).
2. The test database name must not equal the active workspace database name.
3. Only databases matching the PS03C1 test naming pattern are dropped during cleanup.
4. Cleanup runs in the `after` hook regardless of test success/failure.

The rollback test uses a separate disposable database matching `^ps03c1_rollback_test_[a-f0-9]{32}$` with the same safety checks.

No synthetic data was inserted into the active workspace database.

### 5.2 Migration 0000 → 0001 → 0002 on disposable database

The main test suite's `before` hook creates the disposable database and runs `pnpm run db:migrate` against it, which applies 0000, 0001, and 0002 in order through the repository migration runner. The migration table after this step is not shown directly, but the fact that all 22 PS-03C1 tests pass confirms the clean 0000 → 0001 → 0002 baseline is functional.

The rollback test separately applies 0000 and 0001 directly, captures the post-0001 schema, applies 0002, executes `reports/ps03c1_rollback.sql`, and verifies the post-rollback schema matches the captured post-0001 schema. That test passed (see section 4.4).

---

## 6. Rollback Evidence

Rollback plan file: `reports/ps03c1_rollback.sql`

The rollback test (see section 4.4) performed the following validation sequence:

1. Applied 0000 to a fresh disposable database.
2. Applied 0001 to the same database.
3. Captured the post-0001 schema using catalog queries (tables, columns, constraints, indexes, triggers, functions, sequences, enums).
4. Applied 0002.
5. Executed `reports/ps03c1_rollback.sql`.
6. Captured the post-rollback schema.
7. Compared the two snapshots with `assert.deepEqual`.
8. The test passed, confirming the rollback restores the database to the post-0001 state and does not modify any legacy object introduced by 0000 or 0001.

The rollback SQL was not executed on the active Replit database.

---

## 7. Live Migration State

### 7.1 Preflight (before applying 0002)

Read-only transaction against the active workspace database:

```
BEGIN
 migrations_table_exists 
-------------------------
 t
(1 row)

 id |                               hash                               |  created_at   
----+------------------------------------------------------------------+---------------
  1 | a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca | 1784046823691
  2 | c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2 | 1784109971200
(2 rows)

 games 
-------
     0

 accounts 
----------
        0

 account_backup_codes 
----------------------
                    0

 account_capacities 
--------------------
                  0

 capacity_customers 
--------------------
                  0

 orders 
--------
      0

 game_account_sequences_table_exists 
-------------------------------------
 f

COMMIT
```

Result: 0002 was not applied. 0000 and 0001 were present with their original hashes. All relevant tables were empty. `game_account_sequences` did not exist.

### 7.2 Live migration application

**Command:** `cd lib/db && pnpm run db:migrate`

**Result:**

```
> @workspace/db@0.0.0 db:migrate /home/runner/workspace/lib/db
> drizzle-kit migrate --config ./drizzle.config.ts

Reading config file '/home/runner/workspace/lib/db/drizzle.config.ts'
Using 'pg' driver for database querying
[✓] migrations applied successfully!
```

`drizzle-kit push` was not used. The migration was applied only through the repository migration runner.

---

## 8. Live Post-Migration Verification

Performed inside `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;`.

```
BEGIN
 transaction_read_only 
-----------------------
 on

 id |                               hash                               |  created_at   
----+------------------------------------------------------------------+---------------
  1 | a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca | 1784046823691
  2 | c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2 | 1784109971200
  3 | 99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a | 1784208866372

 games | 0
 accounts | 0
 account_backup_codes | 0
 account_capacities | 0
 capacity_customers | 0
 orders | 0
 game_account_sequences | 0

 enum_account_status_override | t
 enum_backup_code_status | t
 enum_capacity_kind_v2 | t
 seq_account_code_seq | t
 table_game_account_sequences | t
 trigger_accounts_protect_identifiers | t
 function_accounts_protect_identifiers | t

 new_accounts_columns | 9
 new_backup_columns | 3
 new_capacity_columns | 3

ROLLBACK
```

Confirmation checklist:

- [x] `transaction_read_only` was `on`.
- [x] Migration 0002 exists exactly once.
- [x] 0002 applied hash matches repository file: `99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a`.
- [x] 0000 and 0001 retain their original hashes.
- [x] All new PS-03C1 schema objects exist (enums, sequence, table, trigger, function, new columns).
- [x] `accounts`, `account_backup_codes`, `account_capacities` remain empty.
- [x] `game_account_sequences` remains empty.
- [x] `capacity_customers` remains unchanged (row count 0, no schema changes).
- [x] No runtime table contains synthetic data.

---

## 9. Unrelated Pre-existing Dirty Files

`git status --short` after all PS-03C1 work:

```
 M lib/db/src/migrations/ps03c1.test.ts
 M lib/db/src/schema/accounts.ts
?? attached_assets/Pasted-Continue-only-PS-03C1-Additive-Account-Schema-Migration_1784210035968.txt
?? reports/ps03c1_rollback.sql
```

`git diff --stat`:

```
 lib/db/src/migrations/ps03c1.test.ts | 315 ++++++++++++++++++++++++++++++-----
 lib/db/src/schema/accounts.ts        |   3 +-
 2 files changed, 279 insertions(+), 39 deletions(-)
```

`git diff -- .replit` returned **no output**. The `.replit` file was not modified during PS-03C1. No port-mapping changes were introduced by this stage.

The uploaded asset under `attached_assets/` is the user's correction prompt, not a code change introduced by the agent.

---

## 10. No Runtime Source Changes

The following areas were **not** modified during PS-03C1:

- `artifacts/api-server`
- `artifacts/playsyncer`
- `lib/api-spec`
- `lib/api-client-react`
- `lib/api-zod`
- `capacity_customers` schema
- Any existing runtime account-number helper
- Any documentation file (`replit.md`, `docs/`, etc.)

`lib/db/package.json` was not modified according to Git; the `test:migrations` script was already present and was used to run the required tests.

---

## 11. Stage B Runtime Cutover Blocker

The existing runtime account-number helper (`lib/db/src/helpers/account-number.ts`) and any current code that formats display numbers as `#PREFIX-NNN` must be updated during the Stage B Runtime Cutover to use the approved per-game format `PREFIX-NNN` (e.g., `GOW-001`). PS-03C1 deliberately left the existing helper unchanged, per the correction prompt's scope restriction.

---

## 12. Final Status

**PS-03C1 — IMPLEMENTED, AWAITING COMMAND CENTER REVIEW**

All required checks, disposable database tests, rollback tests, and live migration verification have been completed successfully. The final evidence artifacts are:

- `reports/ps03c1_implementation_report.md` (this report)
- `reports/ps03c1_rollback.sql`
- `reports/ps03c1_complete.diff`

No further action is required by the agent until the Command Center review is complete.
