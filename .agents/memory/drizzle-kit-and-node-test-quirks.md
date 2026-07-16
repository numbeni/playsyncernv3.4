---
name: drizzle-kit config and node --test quirks
description: Two environment gotchas hit while adding versioned Drizzle migrations and native node:test unit tests in this pnpm/TS monorepo.
---

- `drizzle-kit check` fails with an ENOENT on a mangled path (`.//abs/path/...`) if `out` in
  `drizzle.config.ts` is an absolute path (e.g. via `path.join(__dirname, ...)`). `generate`
  and `migrate` tolerate the absolute path fine; only `check` breaks. Fix: set `out` to a
  plain relative string (e.g. `"./migrations"`) instead of an absolute path.
  **Why:** discovered when verifying the PS-01 migration workflow on a disposable local
  Postgres — `db:check` errored until `out` was made relative.

- Node's built-in `--test` runner (used to avoid adding vitest/jest as a dependency) requires
  relative imports to include the literal `.ts` extension (e.g. `from "./crypto.ts"`), because
  Node's ESM resolver does no extension inference even with type-stripping enabled. But `tsc`
  rejects `.ts`-suffixed imports unless the tsconfig has `allowImportingTsExtensions: true`,
  which itself requires `noEmit: true` in that same tsconfig (a CLI `--noEmit` flag is not
  enough). **How to apply:** when adding native `node --test` unit tests to a TS package in
  this repo, import test subjects with the `.ts` extension and set both `noEmit` and
  `allowImportingTsExtensions` in that package's own tsconfig.json.

- Backgrounding a local Postgres via `pg_ctl ... start` inside one ShellExec call does not
  survive into the next ShellExec call — the sandbox appears to kill the process group when
  the shell exits, so the server "disappears" between calls even though `pg_ctl` detaches
  normally. **How to apply:** when spinning up a disposable local Postgres for migration
  verification, do the initdb + start + test-queries + stop all inside a single shell command.

- The `api-server` TypeScript source uses directory/no-extension imports (e.g. `from "./routes"`,
  `from "../middlewares/error-handler"`). Native `node --test` cannot import the app directly
  from source because Node's ESM resolver does not resolve directory imports or infer `.ts`
  extensions. **How to apply:** for API integration tests, either build the server first and
  run it as a subprocess, or import the bundled `dist/index.mjs`/`dist/app.mjs` (if exported).
  Keep test helpers in the same package so they can share the build output.

- Starting multiple disposable Postgres instances in parallel requires dynamic port allocation.
  Hard-coding a port causes collisions when tests run concurrently. **How to apply:** use a
  helper that opens a temporary TCP server on port 0 to obtain a free port before launching `pg_ctl`.

- Drizzle can wrap Postgres errors in a `_DrizzleQueryError` whose original code lives on the
  `cause` property or in the message. **How to apply:** when detecting specific Postgres
  errors (e.g. duplicate-key `23505`), check `err.code`, `err.cause?.code`, and the message text.

- For nullable timestamp columns (e.g. `deletedAt`), use `isNull(column)` in Drizzle queries,
  not `eq(column, null)`. The latter fails both typechecking and runtime semantics because
  `column = NULL` evaluates to NULL in SQL, filtering out all rows.
  **How to apply:** prefer `import { isNull } from "drizzle-orm"` when filtering on soft-delete columns.

- To verify a migration against a pre-populated database, start the disposable Postgres without
  running migrations first. Then apply the older migration, insert legacy data, and apply the
  target migration. **How to apply:** add a `skipMigrations` option to the test-pg helper and use
  it in migration-upgrade verification scripts.

- When executing multi-line or quote-heavy SQL from Node via `psql`, use a temporary `.sql` file
  and `psql -f` rather than `psql -c "..."`. The shell mangles nested double quotes inside the
  `-c` argument, causing silent parse failures. **How to apply:** write SQL to a temp file and
  run it with `ON_ERROR_STOP=1` so errors surface.
