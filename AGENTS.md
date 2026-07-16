# PlaySyncer Agent Rules

1. Read `docs/PRODUCT_RULES.md` and `docs/CURRENT_PHASE.md` before changing code.
2. Work only inside the active phase scope.
3. Do not refactor unrelated files.
4. Do not change the stack or add dependencies without approval.
5. Never run `drizzle-kit push --force`.
6. Never modify a shared/live database unless the prompt explicitly authorizes it.
7. Database changes require versioned migrations and rollback notes.
8. Sensitive values must never be printed, logged, or committed.
9. Keep changes small, testable, and easy to revert.
10. Before finishing, run available typecheck, build, tests, and relevant runtime checks.
11. Final report must list:
   - files changed
   - runtime changes
   - documentation-only changes
   - tests and results
   - database impact
   - known risks
   - rollback steps
12. Do not claim production readiness without evidence.
