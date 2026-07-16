# PS-02A Games Contract and Backend — Delivery Summary

## What was implemented

1. **Database schema**
   - Added `title_normalized` to `games` with a global unique index covering all rows, including soft-deleted games.
   - Reused `normalizeGameTitle()` in `lib/db` for trim/collapse/lowercase normalization.
   - Updated `game_status` enum to uppercase `ACTIVE`/`INACTIVE` to match the PS-02A contract.
   - Generated a single clean migration `0001_glossy_onslaught.sql`; the initial migration `0000_zippy_leech` was left untouched.

2. **Games API (`artifacts/api-server/src/routes/games.ts`)**
   - `POST /api/games` normalizes the title and returns `409` on duplicate normalized titles (no raw DB error codes leaked).
   - `PATCH /api/games/:id` blocks changes to `platform` when accounts already exist for that game, including soft-deleted accounts.
   - `DELETE /api/games/:id` performs a hard delete only when no accounts reference the game; otherwise returns `409`.
   - `GET` endpoints and `PATCH status` support the new uppercase `ACTIVE`/`INACTIVE` contract.
   - All game route errors are routed through the centralized error handler.

3. **Account creation transaction/locking fix (`artifacts/api-server/src/routes/accounts.ts`)**
   - `POST /api/games/:gameId/accounts` now opens a database transaction before reading the Game.
   - It locks the related Game row with `FOR UPDATE` inside the same transaction.
   - It confirms the Game still exists and is not soft-deleted.
   - It creates the Account and persistent Capacity records using the platform from the locked Game row.
   - This serializes with the platform-change guard in `PATCH /games/:id`, preventing any Account from being created with Capacity definitions from a stale platform.

4. **Contract / clients**
   - Updated `lib/api-spec/openapi.yaml` with Games paths, schemas, and tags.
   - Regenerated `lib/api-zod` and `lib/api-client-react` outputs.

5. **Tests**
   - `lib/db/src/helpers/title-normalizer.test.ts` — 13 tests for title cleaning/normalization.
   - `artifacts/api-server/src/routes/games.test.ts` — 18 tests covering create, duplicate detection, UUID validation, platform guard, status change, hard-delete guard, listing, and a concurrent HTTP test proving no stale-platform Account is created.
   - `artifacts/api-server/src/routes/accounts.concurrency.test.ts` — 2 controlled DB-level transaction/locking tests using two PostgreSQL connections and explicit synchronization points.
   - Disposable PostgreSQL helper `artifacts/api-server/src/lib/test-pg.ts` and migration verification scripts `artifacts/api-server/scripts/verify-games-migration.ts` and `verify-games-migration-populated.ts`.

## Verification run

- `pnpm run typecheck` — passed
- `pnpm --filter @workspace/db run test` — 13/13 passed
- `pnpm --filter @workspace/api-server run test` — 28/28 passed (crypto + games + concurrency)
- `pnpm --filter @workspace/db run db:check` — passed
- `pnpm --filter @workspace/api-server run build` — succeeded
- `pnpm --filter @workspace/api-spec run codegen` — succeeded, generated outputs synchronized
- `node --experimental-strip-types artifacts/api-server/scripts/verify-games-migration.ts` — games schema confirmed (`title_normalized`, unique index, status, platform)
- `node --experimental-strip-types artifacts/api-server/scripts/verify-games-migration-populated.ts` — populated upgrade, duplicate-title failure, and over-length-title failure all passed
- Clean disposable PostgreSQL migration-chain verification — passed (via the disposable PG helper used in tests and scripts)
- Concurrency/locking tests — passed

## Checklist watch-outs

- No `drizzle-kit push` was added to build, deploy, or post-merge automation. The existing `push`/`push-force` manual scripts in `lib/db/package.json` remain unchanged and are for manual use only.
- The initial migration `0000_zippy_leech` was not modified.
- The frontend (`artifacts/playsyncer`) was not touched for this phase.
- Account and Capacity changes were limited to the transaction/locking correction required for the Games invariant; no Account or Capacity redesign was performed.
- No new sensitive logging (passwords, encrypted values) was added to the routes or helpers.
- The shared Replit database was not modified; all migration verification used disposable PostgreSQL databases.

## Intentionally deferred

Order-history deletion protection is **not** implemented because the current schema has no direct or reliable indirect relation from orders to games. A future schema change should add that link before enforcing order-history guards.
