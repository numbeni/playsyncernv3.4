# Current Phase

## Active Phase

PS-03 — Accounts Backend and Frontend Integration

## Current Stage

PS-03A — Accounts Contract and Current Source Audit

## Status

READY_FOR_READ_ONLY_AUDIT

## Input Baseline

Canonical previous-phase package:

- File: `playsyncer-ps02b-final.zip`
- SHA-256: `d6a61547e1a61a7660278f2ed699cabe20eb57c21364c75543a3649773b80135`

PS-02B is completed and must not be reopened or modified without a separate Command Center decision.

## Previous Completed Phase

PS-02B — Games Frontend API Integration and Mock Authority Removal

Confirmed previous-phase state:

- Games are loaded from the real Backend API.
- Create, Edit, Status Change and Delete persist through PostgreSQL.
- Games mock data is no longer Runtime Authority.
- Game Detail displays real Game metadata.
- Account Workspace remains intentionally pending.
- SmartSearch currently searches only Games.
- Legacy Account, Capacity and Customer mock data is preserved only as a non-runtime fixture.

## Current Objective

Inspect the complete current Account implementation and determine the exact gap between:

- the approved PlaySyncer Source of Truth
- the current PostgreSQL schema
- the existing Account backend routes and services
- the OpenAPI contract
- generated API clients
- the current frontend Account Workspace
- the preserved legacy fixture
- the approved security requirements

PS-03A is strictly read-only.

Its purpose is to establish the correct Account Data Contract and produce a controlled execution plan for the remaining PS-03 stages.

## Required Audit Scope

Inspect at minimum:

- Account database table
- Account Backup Codes table
- Account Capacity table
- Capacity Customer Assignment records
- Account number generation
- Account status and lifecycle
- Account-to-Game relationship
- Game Platform and Account Capacity-template relationship
- foreign keys and delete behavior
- indexes and unique constraints
- soft-delete and historical-data behavior
- sensitive fields and current encryption state
- email and PlayStation credentials
- Family Management information
- Online ID
- birth date
- Backup Codes
- OpenAPI Account schemas
- generated API client
- Account backend routes and services
- existing Account tests
- Account Workspace frontend page
- Account cards and dialogs
- legacy fixture at `fixtures/legacy/playSyncerMockData.ts`
- current SmartSearch Account dependencies
- package scripts
- migration history
- database readiness assumptions

## Sensitive Data Rule

Do not expose, copy, log or use real Account credentials.

Do not include real:

- emails
- passwords
- Backup Codes
- customer phone numbers
- order identifiers
- tokens
- connection strings

Use only synthetic or redacted examples.

Any field name containing `Encrypted` must not be assumed to be encrypted without direct implementation evidence.

## Stage A Restrictions

During PS-03A:

- do not modify source files
- do not create a patch
- do not run migrations
- do not use `drizzle-kit push`
- do not modify the database
- do not generate or insert test Accounts
- do not change OpenAPI
- do not regenerate clients
- do not restore the legacy fixture into Runtime
- do not implement Account CRUD
- do not implement Capacity operations
- do not refactor Account Workspace
- do not add dependencies

## Required Stage A Report

Return:

1. Facts
2. Assumptions
3. Risks
4. Conflicts
5. Current Account data model
6. Current Account database contract
7. Current Account API contract
8. Current frontend Account data flow
9. Legacy fixture dependency map
10. Sensitive-data and encryption review
11. Account-number generation review
12. Backup-Code model review
13. Capacity-template and Platform-rule review
14. Customer-assignment model review
15. Delete and history-retention review
16. Migration and database readiness review
17. Existing test coverage
18. Missing test coverage
19. Source-of-Truth conflicts
20. Minimal recommended PS-03 stage breakdown
21. File-level implementation plan
22. Validation plan
23. Rollback plan
24. Blockers and missing evidence

## Out of Scope

- implementation during Stage A
- WordPress Connector
- WooCommerce Orders
- Game JSON Import
- SmartSearch backend implementation
- Authentication
- OTP
- Staff Management
- RBAC
- Issue Tracking
- Payments and Payroll
- Dashboard redesign
- broad architecture refactor
- new dependencies

## Completion Rule

PS-03A completes only when the current Account implementation has been directly inspected and a controlled PS-03 execution plan has been reviewed by the Accounts Command Center.

Do not mark PS-03 or Account Integration completed.

The next PS-03 stage requires explicit approval.