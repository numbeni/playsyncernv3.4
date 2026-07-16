# Database Migrations (PS-01)

As of PS-01, schema changes go through **versioned Drizzle migrations**.
Automatic `drizzle-kit push` has been removed from `scripts/post-merge.sh`.
Nothing runs migrations against the shared/live database automatically.

## Workflow

Run these from the repo root, or `cd lib/db` and drop the `--filter` prefix.

1. **Generate** a migration from the current schema (writes SQL files under `lib/db/migrations/`):
   ```bash
   pnpm --filter @workspace/db run db:generate
   ```
2. **Apply** pending migrations to the database pointed at by `DATABASE_URL`:
   ```bash
   pnpm --filter @workspace/db run db:migrate
   ```
3. **Check** that the migration files are internally consistent (journal matches SQL files, no gaps or duplicates — does **not** inspect a live database or track which migrations have been applied):
   ```bash
   pnpm --filter @workspace/db run db:check
   ```

## Verification policy

- New/changed migrations must be verified against a **clean, disposable** PostgreSQL
  database first — never applied straight to the shared/live database.
- Only apply `db:migrate` to the shared/live database as an explicit, deliberate step
  once the migration has been reviewed and verified on a disposable database.
- `push` / `push-force` (schema-diff-and-apply, no migration files) still exist as
  manual, local-only developer scripts. Per `AGENTS.md`, `push --force` must never be
  run by an agent, and neither script should be wired into any automated flow
  (post-merge, startup, CI).

## Rollback

Drizzle does not auto-generate "down" migrations. To roll back a migration that has
already been applied to a database:

1. Identify the last-known-good migration in `lib/db/migrations/meta/_journal.json`.
2. Write a new, explicit down migration (SQL) that reverses the specific change
   (e.g. `DROP COLUMN`, restore a previous constraint) — do not hand-edit already
   -applied migration files.
3. Apply the down migration the same way as any other migration (`db:migrate`) after
   verifying it on a disposable database.
4. If the change was applied via the legacy `push` workflow (no migration file exists),
   the rollback must be a manual, reviewed SQL statement — there is no generated
   migration to reverse.
