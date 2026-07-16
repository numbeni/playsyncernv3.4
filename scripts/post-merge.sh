#!/bin/bash
set -e
pnpm install --frozen-lockfile

# NOTE (PS-01): automatic `drizzle-kit push` was removed from post-merge.
# Schema changes must now go through versioned migrations instead:
#   pnpm --filter @workspace/db run db:generate   # write a new migration
#   pnpm --filter @workspace/db run db:migrate    # apply pending migrations
#   pnpm --filter @workspace/db run db:check      # verify migration history is consistent
# See docs/MIGRATIONS.md for the full workflow and rollback notes.
# Post-merge intentionally does NOT run migrations automatically against the
# shared database — apply them manually/deliberately after review.
