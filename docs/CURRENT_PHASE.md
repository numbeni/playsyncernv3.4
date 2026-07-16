# Current Phase

## Active Phase

PS-03 — Accounts Backend and Frontend Integration

## Previous Completed Stage

PS-03B — Account Contract Decision Gate

## Previous Stage Status

APPROVED_AND_CLOSED

## Current Stage

PS-03C0 — Live Database Evidence and Migration Readiness

## Current Status

READY_FOR_READ_ONLY_DB_EVIDENCE

## Input Baseline

Previous completed phase:

PS-02B — Games Frontend API Integration and Mock Authority Removal

Canonical package:

- File: `playsyncer-ps02b-final.zip`
- SHA-256: `d6a61547e1a61a7660278f2ed699cabe20eb57c21364c75543a3649773b80135`

## Approved Account Contract

The PS-03B decisions D1 through D13 are approved and authoritative for Account Core.

These decisions define:

- Account statuses
- immutable Account identifiers
- duplicate-field confirmation
- encryption and lookup hashes
- safe DTO boundaries
- Backup Code lifecycle
- Capacity templates
- Capacity FINISHED state
- Customer Assignment boundary
- Account deletion and retention
- OpenAPI authority
- frontend integration order
- exact-search limitations

## Current Objective

Collect read-only evidence from the active Replit PostgreSQL database before designing or executing any Account migration.

The evidence must determine:

- active database identity and environment
- applied migration history
- live Account-related schema
- current table and row counts
- existing enums, indexes, constraints and foreign keys
- whether Account-related records exist
- null and duplicate readiness
- possible legacy plaintext-sensitive data risk
- blockers for an additive Account migration

## Restrictions

During PS-03C0:

- do not modify runtime source
- do not create or edit migrations
- do not run migrations
- do not use `drizzle-kit push`
- do not insert, update or delete database records
- do not expose actual emails, passwords, Backup Codes or phone numbers
- do not implement Account CRUD
- do not change OpenAPI
- do not regenerate API clients
- do not activate Secret Reveal
- do not implement Customer Assignment
- do not start the next stage

Only read-only database metadata, counts, constraints and boolean risk checks are authorized.

## Next Gate

Review and approval of the PS-03C0 live database evidence report.

No Account migration or implementation may begin until this gate is approved.