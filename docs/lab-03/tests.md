# Test Plan & Traceability Matrix: Sprint 3 (Tok TickIT)

This document provides a comprehensive test plan for the Lab 3 increment, mapping business rules and Acceptance Criteria (AC) from the specification to specific automated tests before implementation begins.

## Traceability Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API-01** | API | AC-01 | Valid login with active credentials | Authenticated response; returns permitted identity and role | `server/tests/lab-03/auth.api.test.ts` | Pass |
| **API-02** | API | AC-02 | Login with initial password | Login succeeds but restricts access until password changed | `server/tests/lab-03/auth.api.test.ts` | Pass |
| **API-03** | API | AC-03 | Requester tries to act as another user | Backend ignores supplied `requesterId` and uses session | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-04** | API | AC-04, AC-15 | Requester requests internal notes | 403 Forbidden; no note content leaked | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-05** | API | AC-05 | IT Staff requests ticket details | Returns both Public Comments and Internal Notes | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| **API-06** | API | AC-06 | IT Staff updates ticket status | Status is updated successfully and transition is logged with an internal note | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| **API-07** | API | AC-07, AC-15 | Requester attempts to update `it_priority` | 403 Forbidden; priority unchanged | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-08** | API | AC-08 | Admin attempts to deactivate own account | 400 Bad Request; prevents deactivation | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| **API-09** | API | AC-09 | Admin deactivates/changes role of last admin | 400 Bad Request; action prevented | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| **API-10** | API | AC-10 | Admin creates a new user | User created; password is hashed in DB | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| **API-11** | API | AC-11 | IT Staff views global queue | Returns tickets across all Requesters | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| **API-12** | API | AC-12 | Requester views ticket queue | Only returns their own tickets | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-13** | API | AC-13 | Unauthenticated access to protected API | 401 Unauthorized returned | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-14** | API | AC-14 | IT Staff creates internal note | Note saved with `is_internal_note = true` | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| **API-15** | API | AC-15 | Requester attempting Admin operations | 403 Forbidden when requesting `/api/admin/users` | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| **API-16** | API | AC-05, AC-14 | Fetch Public Comments | Returns correctly filtered comment list | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| **UI-01** | Component | AC-01, AC-13 | Login screen rendering and submission | Renders form; calls auth API; handles errors | `client/tests/lab-03/Login.test.tsx` | Pass |
| **UI-02** | Component | AC-02 | Change Password interstitial | Forces user to enter new password | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| **UI-03** | Component | AC-11 | Staff Ticket Queue grid | Renders grid, filters, and pagination | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| **UI-04** | Component | AC-05, AC-14 | Staff Ticket Detail timeline | Renders comments and internal notes distinctively | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| **UI-05** | Component | AC-10 | Admin User Management modal | Renders user list and create/edit modal | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| **E2E-01** | E2E | AC-01, AC-13 | End-to-end login flow | Unauth redirected to login; success enters app | `e2e/lab-03/authentication.spec.ts` | Pass |
| **E2E-02** | E2E | AC-06, AC-11 | Staff ticket lifecycle | Staff finds a ticket in Staff Queue, opens Ticket Detail, claims the ticket, verifies ownership, updates IT Priority and Status, adds Public Comment and Internal Note, verifies persistence after reload, then logs in as Requester to verify Public Comment visibility and Internal Note invisibility. | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| **E2E-03** | E2E | AC-08, AC-10, AC-02 | Admin user management flow and mandatory password change | Admin logs in, searches/filters the user list, creates a new user, edits the user's name and role (to IT_STAFF), resets the user's password, verifies self-deactivation protection (UI warning shown and server returns 400 when Admin tries to deactivate own account), then logs out; the reset user logs in, is redirected to /change-password, is blocked from navigating away before completing the change, fills and submits the change-password form, lands on /my-tickets, and logs out; Admin logs back in to confirm continued access to /user-management. | `e2e/lab-03/user-administration.spec.ts` | Pass |
| **MIG-01** | API | Migration | Legacy data regression check against current DB state (seeded tickets TKT-1001–TKT-1004 and Ticket→Attachment FK schema compatibility) | Legacy tickets TKT-1001–TKT-1004 remain present, their requester relationships remain intact (`requesterId` is NOT NULL and resolves to seeded User email), and Ticket-to-Attachment relation/FK compatibility can be queried on TKT-1001. | `server/tests/lab-03/migration-regression.api.test.ts` | Pass with coverage gap |
| **UI-06** | Component | Responsive | Ticket Queue responsiveness | Renders as data table on desktop, cards on mobile | `client/tests/lab-03/Responsive.test.tsx` | Pass |

## Notes & Limitations

### 1. MIG-01 Migration Verification Scope & Limitations
- **Explicit Limitation**: This is a regression check against the current database state, not a fresh migration execution or before/after preservation test. No seeded legacy Attachment record exists in the repository, so Attachment data preservation cannot be directly asserted.
- **Verification Method**: MIG-01 confirms that legacy seeded records (`TKT-1001`–`TKT-1004`) and their requester relationships remain intact, and that Ticket→Attachment foreign key relation/compatibility can be queried on `TKT-1001`.
- **Execution Limitation**: The test does **not** execute a fresh migration or compare before-and-after migration state.
- **Attachment Coverage Gap**: `seed.ts` and all migration SQL files contain no seeded legacy `Attachment` records, so no legacy attachment row exists in the database to assert against. The test verifies schema and foreign-key join compatibility on `TKT-1001`, but does not claim evidence of legacy attachment data preservation.

### 2. Authorization Coverage Boundary
- Server-side authorization is verified across domain-specific test files:
  - `server/tests/lab-03/users-admin.api.test.ts`: Admin user management endpoints (`/api/admin/users`), safety rules, self-deactivation prevention, and last-admin safeguards.
  - `server/tests/lab-03/authorization.api.test.ts`: General protected resources, unauthenticated access rejection (401), requester isolation, and ownership boundaries (403).
- Not all endpoints have dedicated negative authorization assertions within a single file; coverage is partitioned across the relevant test suites.

### 3. E2E Test Data & Seed Dependency
- Staff E2E (`e2e/lab-03/staff-ticket-flow.spec.ts`) dynamically creates a fresh ticket per run to test lifecycle mutations.
- However, the flow relies on stable seeded user accounts (`req2@toktikit.local`, `staff2@toktikit.local`) and seeded reference entities (`categories[0]`, `relatedSystems[0]`) existing in the environment.

### 4. Legacy Lab 2 E2E Suite Outside Lab 3 Scope
- The legacy Lab 2 E2E tests (`e2e/lab-02/`) are outside the Lab 3 verification scope.
- They still depend on the pre-Lab-3 Requester selector UI, which was intentionally removed in Lab 3 per the specification (FR-01, Section 8.2).
