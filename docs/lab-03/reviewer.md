# Lab 3 — Peer Review Record

**Author:** เบญญาภา — 67070501030 — GitHub: @Piink7878

**Peer reviewer:** กมนนัทธ์ — 67070501001 — GitHub: @Kamonnatt23

## Pull Requests I authored (reviewed by my partner)
| PR | Reviewer | Decision | Review Comment | My Response | Evidence Link |
|----|----------|----------|----------------|-------------|---------------|
| feat: e2e test suite, auth/security verification, and spec sync (Issue 9) #61 | Kamonnatt23 | Review comments received and addressed (Pending final peer approval) | 1. **Mandatory Password Change**: Keep current behavior navigating to `/my-tickets` after password change and normal IT Staff login navigating to `/staff-queue`, but update Lab 3 spec/test docs to explicitly distinguish the two flows.<br>2. **Test Evidence**: Run latest HEAD test suites, record actual output, state results are local because no GitHub Actions CI exists, do not claim CI passed or commit generated artifacts, and ensure counts match actual runs.<br>3. **E2E-03 Independence**: Make the Mandatory Password Change test in `e2e/lab-03/user-administration.spec.ts` independent from previous tests without relying on users created by other tests, while using safe password hashing and cleanup. | 1. Updated `specification.md`, `ui-spec.md`, and `tests.md` to explicitly distinguish role-based normal login redirection (`REQUESTER` -> `/my-tickets`, `IT_STAFF` -> `/staff-queue`, `ADMIN` -> `/user-management`) from post-mandatory-password-change entry (`/my-tickets`), without changing runtime application logic.<br>2. Executed all test suites locally against latest HEAD and documented verified terminal counts in `tests.md`. Clarified that results are from local runs as no GitHub Actions CI is configured, and ensured no generated reports/caches (`playwright-report/`, `.last-run.json`) are tracked.<br>3. Refactored `user-administration.spec.ts` so the Mandatory Password Change test sets up its own dedicated test user using the repository's established static precomputed bcrypt hash string (avoiding fragile cross-package imports) and cleans up using a schema-aware FK-safe teardown function. Verified E2E-03 passes completely in isolation. | https://github.com/Piink7878/cpe334-TokTikIT/pull/61 |

## Pull Requests I reviewed for my partner

| Partner PR | Decision | My Comment | Partner Response | Evidence |
|------------|----------|------------|------------------|----------|
| - | - | - | - | - |
