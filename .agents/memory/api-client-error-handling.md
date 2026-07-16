---
name: API client error handling in PlaySyncer
description: How to safely extract HTTP error information from @workspace/api-client-react mutations without depending on internal class exports.
---

When handling errors from `@workspace/api-client-react` mutations (e.g. `useCreateGame`, `useUpdateGame`), do **not** import `ApiError` from the package. The package's `src/index.ts` does not re-export it, so relying on the class is fragile and may fail typecheck or runtime resolution.

**Preferred approach:** use a structural guard that checks for `status` and `data` on the thrown value.

**Why:** The generated `custom-fetch` throws an `ApiError` instance that carries `status` and `data`, but the package's public export surface only exposes the mutation hooks, schemas, and a few helpers. Importing the class directly couples the frontend to an internal implementation detail.

**How to apply:** keep `formatApiError` in `artifacts/playsyncer/src/lib/apiErrors.ts` using a structural `ApiErrorLike` guard. Map status codes to Persian user-facing messages; do not expose raw server messages or stack traces.
