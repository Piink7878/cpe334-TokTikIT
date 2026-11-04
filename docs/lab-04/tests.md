  # TokTikIT — Sprint 4 Test Plan & Specification (Lab 4)

  ## 1. Test Strategy

  ### 1.1 Testing Scope and Objectives
  The objective of this test plan is to provide a comprehensive, rigorous, and verifiable testing architecture for the Sprint 4 (Lab 4) increment of the TokTikIT IT Service Desk platform. This plan validates the correct implementation of:
  1. **Actions Taken (Service Actions) Subsystem:** Complete CRUD (without deletion), technician session attribution, validation rules, collaborative editing, and strict role authorization.
  2. **Ticket Status Transition & Resolution Engine:** Server-side state machine enforcement across standard handout statuses (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`), preservation of Lab 3 `REJECTED` compatibility, automated internal note audit logging, and terminal state immutability.
  3. **Role-Tailored Dashboards & Drill-Downs:** Pre-calculated backend aggregation metrics (`GET /api/dashboard/requester`, `GET /api/dashboard/staff`), isolated counts, distinct ticket counting for follow-up metrics, and interactive drill-down navigation with multi-value query parameters.
  4. **Database Migration, Integrity & Seed Expansion:** Non-destructive Prisma migration (`ActionTaken`), referential integrity (`onDelete: Restrict`), and idempotent seeding.
  5. **Concurrency & Safe Failure:** Optimistic locking/serializable conflict detection (HTTP 409 Conflict) and security non-enumeration (HTTP 404 Not Found).
  6. **Zero Regression:** 100% test pass rate across all existing Lab 1, Lab 2, and Lab 3 automated test suites.

  ### 1.2 Test Levels & Methodologies
  Testing is structured across all ten authoritative test categories mandated by the Lab 4 handout (§10):

  ```
  +-------------------------------------------------------------------+
  |                  End-to-End (E2E) Tests (Playwright)              |
  |        Full user journeys across Requester and IT Staff flows      |
  +-------------------------------------------------------------------+
  |               Frontend Component & UI Style Tests (Vitest + RTL)  |
  |       Page rendering, KPI cards, modals, tabs, tokens, and focus  |
  +-------------------------------------------------------------------+
  |               API / Integration & Authorization Tests             |
  |     HTTP routes, session cookies, RBAC, state machine, DB queries |
  +-------------------------------------------------------------------+
  |            Database Migration, Regression & Performance Smoke     |
  |      Prisma schema, rollback recovery, baseline latency checks    |
  +-------------------------------------------------------------------+
  ```

  The test plan explicitly covers all ten required categories:
  1. **Unit Testing:** Schema validation rules, field boundaries (length, timestamps), and utility functions tested in isolation (`TC-ACT-05`, `TC-ACT-06`, `TC-ACT-09`, `TC-ACT-16`, `TC-ACT-17`).
  2. **API / Integration Testing:** Express route handlers, session authentication cookies, database queries via Prisma, and error handling (`TC-ACT-01`–`TC-ACT-13`, `TC-DASH-*`).
  3. **UI Component Testing:** React components (`RequesterDashboard`, `StaffDashboard`, `RequesterTicketDetail`, `StaffTicketDetail`, `AppLayout`) in simulated browser DOM (`TC-UI-01`–`TC-UI-06`).
  4. **UI Style Testing:** Zen Green design token fidelity (`var(--color-primary)`, `--color-pale-green`), visual hover/focus ring states (`2px solid var(--color-primary)`), typography, and accessible visual presentation (`TC-STY-01`–`TC-STY-03`).
  5. **Responsive Testing:** Multi-device viewport adaptation across Desktop (1280px), Tablet (820px), and Mobile (390px) layouts (`TC-UI-02`, `TC-UI-03`, `TC-UI-07`).
  6. **Authorization Testing:** Role-Based Access Control (RBAC), session authentication, unauthenticated rejection (401), unauthorized role blocking (403), resource non-enumeration (404), and performer identity spoof prevention (`TC-RBAC-01`–`TC-RBAC-08`, `TC-ACT-03`).
  7. **Workflow Testing:** Ticket lifecycle state machine, Backend Resolution Gate enforcement, and automated internal note generation (`TC-TRN-01`–`TC-TRN-18`).
  8. **Migration / Regression Testing:** Prisma schema non-destructive migration, referential integrity (`onDelete: Restrict`), disaster rollback/recovery procedure verification (`TC-DB-01`–`TC-DB-08`), and zero regression across Lab 1–3 suites (`TC-REG-01`–`TC-REG-08`).
  9. **Performance-Smoke Testing:** Measured query and endpoint response latency baselines under smoke test execution ($\le 300\text{ms}$ for dashboards, $\le 200\text{ms}$ for action endpoints) (`TC-PRF-01`–`TC-PRF-03`).
  10. **End-to-End (E2E) Testing:** Complete browser user journeys simulating authentic Requester and IT Staff workflows across Desktop Chrome, Tablet iPad, and Mobile Safari (`TC-REG-08`, E2E test specs).

  ### 1.3 Test Tooling & Conventions
  The test suite utilizes the exact tools and conventions already established in the repository:
  * **Server Runner:** Vitest (`vitest run`) with `supertest` for Express route integration and `bcryptjs` for session credential generation.
  * **Database Access:** Direct Prisma Client (`getPrisma()`) against PostgreSQL for fixture setup and state assertion.
  * **Client Runner:** Vitest (`vitest run`) with `@testing-library/react`, `@testing-library/user-event`, and `jsdom`.
  * **E2E Runner:** `@playwright/test` running with 3 device profiles (`Desktop Chrome` 1280x720, `Tablet iPad` 820x1180, `Mobile Safari` 390x844).
  * **Naming Conventions:**
    * Server API tests: `server/tests/lab-04/<feature>.api.test.ts`
    * Client component tests: `client/tests/lab-04/<Component>.test.tsx`
    * E2E specifications: `e2e/lab-04/<workflow>.spec.ts`

  ### 1.4 Test Environment and Prerequisites
  * **Runtime:** Node.js (v18+ or v20+), PostgreSQL database running and reachable via `DATABASE_URL` in `server/.env`.
  * **Prerequisites:**
    1. Prisma migrations applied: `npm --prefix server run prisma:migrate`
    2. Database seeded: `npm --prefix server run prisma:seed`
    3. Client and server dependencies installed: `npm install` (root, `server/`, `client/`).
  * **Test Isolation:** Integration tests clean up dynamically generated test users and tickets in `beforeAll` / `afterAll` hooks while preserving core seeded tickets (`TKT-1001` through `TKT-1004`).

  ### 1.5 Recorded Pre-Implementation Test Baseline
  Prior to implementing Sprint 4 code changes, the existing test baseline across Labs 1–3 was executed and documented to establish a verified regression standard:
  * **Server Automated Test Suite (`npm --prefix server test`):**
    - **13 test files passed** (100%)
    - **148 individual tests passed** (100%)
    - **0 failures, 0 errors**
  * **Client Automated Component Suite (`npm --prefix client test`):**
    - **11 test files passed** (100%)
    - **50 individual tests passed** (100%)
    - **0 failures, 0 errors**
  * **Playwright End-to-End Suite (`npx playwright test e2e/lab-03`):**
    - **24 tests passed** across Desktop, Tablet, and Mobile profiles (100%)
    - **0 failures, 0 errors**
  * **Known Pre-Existing E2E Failure (`npx playwright test e2e/lab-02`):**
    - **3 tests failed** in `e2e/lab-02/requester-ticket-flow.spec.ts`
    - *Root Cause:* The legacy Lab 2 test expects an obsolete development requester selection dropdown (`h2: Select Development Requester`), which was intentionally replaced in Lab 3 by the authenticated session login flow (`/login`).
    - *Integrity Rule:* This pre-existing failure is documented separately and must not be conflated with Sprint 4 regressions.
  * **Baseline Integrity Standard:** Release verification compares final test results against this verified baseline (148 server, 50 client, 24 Lab 3 E2E passed). The team shall not claim "100% full Labs 1–4 E2E regression success" while pre-existing Lab 2 legacy failures remain unresolved. Any failure on Lab 3 or new Lab 4 suites represents a regression that must be resolved.

  ---

  ## 2. Test Scope

  ### 2.1 In-Scope Features (Sprint 4)
  1. **Actions Taken Subsystem & Append-only Audit History (`ActionTakenRevision`):**
    * Creation of Action Taken records by IT Staff and Admin (`POST /api/tickets/:id/actions-taken`).
    * Modification of Action Taken records by IT Staff and Admin (`PATCH /api/actions-taken/:actionId`).
    * **Append-only Audit History (`ActionTakenRevision`):** Every successful edit atomically updates the current `ActionTaken` record and appends an immutable revision row containing: `actionTakenId`, `originalData` (JSON snapshot of prior state), `updatedData` (JSON snapshot of edited fields), `editedById` (authenticated editor), `editedAt` (timestamp), and sequential `revisionNumber` (1, 2, ...).
    * **Permanent Attribution Immutability:** `performedById` is permanently immutable and reflects the original creator across all revisions.
    * **Prohibition of Deletion & Audit Mutation:** Actions Taken records cannot be deleted (`onDelete: Restrict`; no `DELETE` endpoint). `ActionTakenRevision` records are strictly append-only and can never be modified or deleted through application APIs.
    * Read-only retrieval of Actions Taken by Ticket Owner Requester (`GET /api/tickets/:id/actions-taken`).
    * Full retrieval of Actions Taken with revision history by IT Staff and Admin on all tickets.
    * Server session derivation of `performedById` (`req.user.id`).
    * Validation of `description`, `result`, `followUpRequired`, `followUpNote` (mandatory when `followUpRequired = true`), `attachmentNotes`, and `actionDateTime`.
    * Collaborative action recording by technicians who are not the designated Ticket Owner.
    * Actions Taken Lifecycle Decoupling: Action Taken records do not have an independent status lifecycle; status transitions, completion (`RESOLVED`/`CLOSED`), and cancellation (`CANCELLED`) operate strictly on the parent Ticket (see item 2).
  2. **Ticket Status Transition & Resolution Engine (Team-Approved Business Rule):**
    * **Resolution Gate (`BR-10`):** Transition to `RESOLVED` authoritatively requires at least one persisted `ActionTaken` record (`COUNT >= 1`). If zero exist, backend rejects with HTTP `400 Bad Request` and `{ "error": { "code": "ACTION_TAKEN_REQUIRED", "message": "At least one Action Taken is required." } }`.
    * Open follow-up obligations (`followUpRequired = true`) do **not** block resolution.
    * Authoritative backend enforcement with supplementary frontend validation warnings.
    * Backend state machine enforcing transitions between `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.
    * Backward compatibility for `REJECTED` status with mandatory rejection reason.
    * Immutability of terminal statuses (`CLOSED`, `CANCELLED`, `REJECTED`).
    * Automated audit log note generation (`InternalNote`) on status change.
    * Concurrency conflict handling (HTTP 409 Conflict).
  3. **Dashboards & Drill-Downs:**
    * Requester Dashboard endpoint (`GET /api/dashboard/requester`) computing `totalTickets`, `activeTickets`, `waitingForRequesterTickets`, and `resolvedOrClosedTickets`.
    * IT Staff Dashboard endpoint (`GET /api/dashboard/staff`) computing `unassignedTickets`, `myActiveTickets`, `ticketsRequiringFollowUp`, `criticalOrHighPriorityTickets`, and `statusBreakdown` (including `REJECTED`).
    * UI Dashboard screens with clickable Zen Green KPI cards.
    * Drill-down URL routing to `/my-tickets` and `/staff-queue` with query parameter filters.
  4. **Database Migration & Seeding:**
    * Non-destructive migration creating `ActionTaken` model and indexes.
    * Idempotent seed script populating representative Actions Taken on `TKT-1001` and `TKT-1004`.

  ### 2.2 Out-of-Scope Features
  * Automated email, SMS, or push notifications.
  * WebSocket or Server-Sent Events (SSE) streaming.
  * Automated SLA escalation engines or business calendar calculations.
  * Deletion of Actions Taken records through the UI or API.
  * Direct Requester manipulation of ticket status to `RESOLVED` or `CLOSED`.
  * Third-party charting libraries (Chart.js, Recharts) or Excel/CSV exports.
  * Multi-tenant organization segregation or external OAuth/SSO.

  ### 2.3 Preserved Lab 1–3 Functionality & Backward Compatibility
  The following existing features must retain complete functional and regression compatibility:
  * Lab 1: Categories listing (`GET /api/categories`), System Health check (`GET /api/health`).
  * Lab 2: Related Systems listing (`GET /api/related-systems`), Ticket Creation with auto-generated ticket numbers, Requester ticket list (`GET /api/tickets`), Attachments upload (max 5, 5MB), download, and soft-delete (`isRemoved = true`).
  * Lab 3: Session authentication (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`), mandatory password change enforcement, Public Comments (append-only), Internal Notes (IT Staff/Admin only), Staff Queue (`GET /api/staff/tickets`), Claim and Assign operations, IT Priority updates, Ticket Rejection with mandatory reason, User Administration (`/api/admin/users/*`).

  ---

  ## 3. Test Scenarios and Test Cases

  ### 3.1 Actions Taken (Service Actions)

  #### TC-ACT-01: Create Action Taken by Authenticated IT Staff
  * **Related Requirements:** FR-01, FR-02, FR-03, BR-02, BR-04, AC-01
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`, UI Staff Ticket Detail "Add Action Taken"
  * **Test Objective:** Verify that an authenticated IT Staff member can successfully record an Action Taken on a ticket, capturing all standard fields.
  * **Preconditions / Test Data:** Seeded ticket `TKT-1001` exists; authenticated user is `staff1@toktikit.local` (`IT_STAFF`).
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` with payload:
      ```json
      {
        "actionDateTime": "2026-10-30T10:00:00.000Z",
        "description": "Inspected patch panel wiring in Server Room B.",
        "result": "Identified crimping defect on port 12.",
        "followUpRequired": true,
        "followUpNote": "Replace RJ45 plug and test attenuation.",
        "attachmentNotes": "Cable test unit FLUKE-802"
      }
      ```
    2. Inspect response status and body.
    3. Query database table `ActionTaken` for the newly created ID.
  * **Expected Result:** HTTP 201 Created; response payload contains new `ActionTaken` entity with `id`, matching fields, and `performedById` matching the authenticated staff user ID. Database record confirms persistence.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-02: Create Action Taken by Administrator
  * **Related Requirements:** FR-01, FR-02, FR-03, AC-01, BR-01
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that an Administrator has full authority to record an Action Taken record.
  * **Preconditions / Test Data:** Valid ticket exists; authenticated user is `admin1@toktikit.local` (`ADMIN`).
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` with valid fields (`followUpRequired: false`).
  * **Expected Result:** HTTP 201 Created; record is saved with `performedById` equal to admin user ID.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-03: Server Ignores Client-Supplied `performedById` (Spoof Prevention)
  * **Related Requirements:** FR-02, BR-02, AC-03
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that the server overrides/ignores any technician identifier sent in the request body and enforces the authenticated session user's ID.
  * **Preconditions / Test Data:** Authenticated user is `staff1` (UUID-1); spoof target is `staff2` (UUID-2).
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` with payload containing `"performedById": "UUID-2"`.
    2. Inspect returned object and database record.
  * **Expected Result:** HTTP 201 Created; `performedById` is strictly UUID-1 (session user), NOT UUID-2.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-ACT-04: Collaborative Action Recording by Non-Owner Staff
  * **Related Requirements:** FR-05, BR-01, AC-06
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that any active IT technician can log an Action Taken on a ticket owned by another technician.
  * **Preconditions / Test Data:** Ticket owned by `staff2`; authenticated user logging action is `staff1`.
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` as `staff1`.
  * **Expected Result:** HTTP 201 Created; record saved with `performedById = staff1.id`. Ticket `ownerId` remains `staff2.id`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-05: Create Action Taken Validation — Missing Required Fields
  * **Related Requirements:** FR-03, BR-04
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify rejection when mandatory fields (`description`, `result`) are omitted or empty.
  * **Preconditions / Test Data:** Authenticated IT Staff.
  * **Steps:**
    1. Send request with missing `description`.
    2. Send request with empty string `result: "   "`.
  * **Expected Result:** HTTP 400 Bad Request with descriptive validation error; no record created in database.
  * **Test Level:** API / Unit
  * **Priority:** High

  #### TC-ACT-06: Create Action Taken Validation — Mandatory Follow-Up Note
  * **Related Requirements:** FR-03, BR-04, AC-01
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that `followUpNote` is strictly mandatory whenever `followUpRequired = true`.
  * **Preconditions / Test Data:** Authenticated IT Staff.
  * **Steps:**
    1. Send request with `followUpRequired: true` and `followUpNote: null`.
    2. Send request with `followUpRequired: true` and `followUpNote: ""`.
    3. Send request with `followUpRequired: false` and `followUpNote: null`.
  * **Expected Result:** Steps 1 and 2 return HTTP 400 Bad Request. Step 3 succeeds with HTTP 201 Created.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-07: Create Action Taken with Attachment Notes
  * **Related Requirements:** FR-03, BR-04, api-spec §2.1
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that optional free-text `attachmentNotes` is accepted and stored correctly without strict attachment foreign key constraints.
  * **Preconditions / Test Data:** Authenticated IT Staff.
  * **Steps:**
    1. Send request with `"attachmentNotes": "Diagnostics log saved at /logs/eth0_diag.txt"`.
  * **Expected Result:** HTTP 201 Created; `attachmentNotes` persisted and returned.
  * **Test Level:** API / Integration
  * **Priority:** Medium

  #### TC-ACT-08: Update Action Taken — Description and Follow-up Status
  * **Related Requirements:** FR-04, BR-04, AC-04
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that an existing Action Taken record can be updated by IT Staff or Admin, atomically updating the current record while appending an immutable revision.
  * **Preconditions / Test Data:** Existing Action Taken with `followUpRequired: true`.
  * **Steps:**
    1. Issue `PATCH /api/actions-taken/:actionId` with:
      ```json
      {
        "description": "Updated intervention notes.",
        "result": "Problem resolved completely.",
        "followUpRequired": false,
        "followUpNote": null
      }
      ```
  * **Expected Result:** HTTP 200 OK; current `ActionTaken` record updated in database; `updatedAt` timestamp refreshed; an `ActionTakenRevision` record is atomically created.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-08B: Atomically Append ActionTakenRevision on Edit
  * **Related Requirements:** FR-04, BR-05, AC-04, spec §9.1, api-spec §2.2
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that every successful edit atomically appends an immutable `ActionTakenRevision` audit record capturing complete before/after snapshots, editor attribution, timestamp, and sequential revision number.
  * **Preconditions / Test Data:** Existing Action Taken record with known baseline fields; authenticated editor is `staff2` (`IT_STAFF`).
  * **Steps:**
    1. Query database for baseline `ActionTaken` (Revision 0 / initial state).
    2. Authenticated as `staff2`, issue `PATCH /api/actions-taken/:actionId` updating `description`, `result`, and `assignedToId`.
    3. Query database table `ActionTakenRevision` where `actionTakenId = actionId`.
    4. Authenticated as `admin1`, issue a second `PATCH /api/actions-taken/:actionId` updating `result`.
    5. Query `ActionTakenRevision` again.
  * **Expected Result:**
    - Step 2 creates exactly one `ActionTakenRevision` with `revisionNumber = 1`, `editedById = staff2.id`, `editedAt` matching transaction time, `originalData` containing exact JSON snapshot of pre-edit fields, and `updatedData` containing exact JSON snapshot of post-edit fields.
    - Step 4 creates a second revision with `revisionNumber = 2`, `editedById = admin1.id`, `originalData` matching the state from Step 2, and `updatedData` matching Step 4.
    - `ActionTaken` current record matches the latest fields from Step 4.
  * **Test Level:** API / Database / Integration
  * **Priority:** High

  #### TC-ACT-08C: ActionTakenRevision Immutability and Non-Deletability
  * **Related Requirements:** BR-05, spec §7.1, spec §9.1
  * **Related API/UI:** Application APIs / Express Routing
  * **Test Objective:** Verify that `ActionTakenRevision` audit history records can never be altered, mutated, or deleted through any application API.
  * **Preconditions / Test Data:** Existing `ActionTakenRevision` record with `id: rev-1`.
  * **Steps:**
    1. Attempt `PATCH /api/action-taken-revisions/rev-1` (or any revision endpoint).
    2. Attempt `DELETE /api/action-taken-revisions/rev-1`.
    3. Attempt `PUT /api/action-taken-revisions/rev-1`.
  * **Expected Result:** All attempts return HTTP 404 Not Found or HTTP 405 Method Not Allowed; revision records remain permanently unmodified and undeletable in the database.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-ACT-08D: Transactional Rollback on Revision Insert Failure
  * **Related Requirements:** FR-04, BR-05, BR-14, spec §9.1
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that the current `ActionTaken` update and `ActionTakenRevision` creation occur in a single atomic database transaction (`$transaction`). If revision insertion fails, the current record update is completely rolled back.
  * **Preconditions / Test Data:** Existing Action Taken with `updatedAt: T1`. Mock/simulate database failure on revision insertion.
  * **Steps:**
    1. Dispatch `PATCH /api/actions-taken/:actionId` with modified description while simulating a failure on revision table insertion.
    2. Inspect response status and database state.
  * **Expected Result:** HTTP 500 Internal Server Error; the `ActionTaken` record remains in its pre-request state with `updatedAt: T1`; no partial update occurs.
  * **Test Level:** API / Database / Reliability
  * **Priority:** High

  #### TC-ACT-09: Update Action Taken — Enabling Follow-up Requires Note
  * **Related Requirements:** FR-04, BR-04, AC-04
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that switching `followUpRequired` to `true` during update enforces a non-empty `followUpNote`.
  * **Preconditions / Test Data:** Existing Action Taken with `followUpRequired: false`.
  * **Steps:**
    1. Send `PATCH /api/actions-taken/:actionId` with `followUpRequired: true` and missing `followUpNote`.
  * **Expected Result:** HTTP 400 Bad Request; database record remains unmodified.
  * **Test Level:** API / Unit
  * **Priority:** High

  #### TC-ACT-10: Update Action Taken — Immutable Fields Preserved
  * **Related Requirements:** FR-04, BR-02, BR-04
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that attempts to modify immutable fields (`id`, `ticketId`, `performedById`, `createdAt`) are ignored or rejected, preserving audit integrity.
  * **Preconditions / Test Data:** Existing Action Taken created by `staff1` on ticket 1001.
  * **Steps:**
    1. Issue `PATCH` attempting to pass `"performedById": "other-uuid"`, `"ticketId": 9999`.
    2. Inspect database record.
  * **Expected Result:** HTTP 200 OK; however, `performedById` remains `staff1.id`, `ticketId` remains 1001, and `createdAt` is unchanged.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-ACT-11: Read Actions Taken by Ticket Owner Requester
  * **Related Requirements:** FR-06, BR-03, AC-05
  * **Related API/UI:** `GET /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that a Requester can view all Actions Taken recorded for their own ticket.
  * **Preconditions / Test Data:** Ticket requested by `req1`; has 2 Action Taken records; authenticated as `req1`.
  * **Steps:**
    1. Issue `GET /api/tickets/:id/actions-taken` as `req1`.
  * **Expected Result:** HTTP 200 OK; array of 2 actions returned with technician `fullName` and `role`, action description, result, and follow-up flags.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-12: Read Actions Taken by IT Staff & Admin across Any Ticket
  * **Related Requirements:** FR-06, BR-01
  * **Related API/UI:** `GET /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that IT Staff and Admin can view Actions Taken for any ticket in the system.
  * **Preconditions / Test Data:** Ticket requested by `req1`; authenticated as `staff2` (not owner) and `admin1`.
  * **Steps:**
    1. Request `GET /api/tickets/:id/actions-taken` as `staff2`.
    2. Request `GET /api/tickets/:id/actions-taken` as `admin1`.
  * **Expected Result:** HTTP 200 OK for both roles; full list of actions returned.
  * **Test Level:** API / Integration
  * **Priority:** Medium

  #### TC-ACT-13: Sorting Actions Taken
  * **Related Requirements:** api-spec §2.3
  * **Related API/UI:** `GET /api/tickets/:id/actions-taken?sortBy=actionDateTime&sortOrder=desc`
  * **Test Objective:** Verify query parameters for sorting Actions Taken by date ascending and descending.
  * **Preconditions / Test Data:** Ticket with 3 actions with distinct timestamps.
  * **Steps:**
    1. Fetch with `sortBy=actionDateTime&sortOrder=asc`.
    2. Fetch with `sortBy=actionDateTime&sortOrder=desc`.
  * **Expected Result:** HTTP 200 OK; array ordering reflects specified sort direction.
  * **Test Level:** API / Integration
  * **Priority:** Low

  #### TC-ACT-14: Duplicate Action Submission Prevention (UI State)
  * **Related Requirements:** FR-01, FR-25, BR-14, AC-19, ui-spec §3.2.4
  * **Related API/UI:** UI Staff Ticket Detail "Add Action Taken" modal
  * **Test Objective:** Verify that the UI prevents duplicate action submissions on rapid double-clicking by disabling the submit button while a request is pending.
  * **Preconditions / Test Data:** Modal open in Staff Ticket Detail.
  * **Steps:**
    1. Fill valid Action Taken fields.
    2. Click "Record Action" submit button twice in rapid succession (< 100ms apart).
  * **Expected Result:** UI disables submit button immediately upon the first click (entering loading state with a spinner/indicator), preventing redundant submissions while the request is in flight. Only a single API request is dispatched.
  * **Test Level:** Component / E2E
  * **Priority:** Medium

  #### TC-ACT-15: Assign Action Taken to Active IT Staff Assignee
  * **Related Requirements:** FR-21, BR-01, AC-01, AC-17
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`, UI Staff Ticket Detail "Add Action Taken" modal
  * **Test Objective:** Verify that an authenticated IT Staff member or Administrator can assign an Action Taken to an eligible, active IT Staff member (`assignedToId`), persisting both performer and assignee.
  * **Preconditions / Test Data:** Ticket `TKT-1001` exists; authenticated user is `staff1` (`IT_STAFF`); target assignee is `staff2` (`isActive: true`, role: `IT_STAFF`).
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` with valid payload containing `"assignedToId": "<staff2-uuid>"`.
    2. Inspect response status code and body.
    3. Query database table `ActionTaken` for the newly created ID.
  * **Expected Result:** HTTP 201 Created; response entity contains `assignedToId: "<staff2-uuid>"`, `assignedTo: { id, fullName, role: "IT_STAFF" }`, and `performedById` matching `staff1.id`. Database record confirms both relations.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-16: Rejection of Inactive Assignee on Action Taken Creation
  * **Related Requirements:** FR-21, BR-01, AC-17
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that assigning an Action Taken to an inactive user account is strictly rejected by the backend validation.
  * **Preconditions / Test Data:** Authenticated IT Staff; database contains user `inactive_tech` with `isActive: false` and role `IT_STAFF`.
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` with `"assignedToId": "<inactive_tech-uuid>"`.
    2. Inspect response status code and error body.
  * **Expected Result:** HTTP 400 Bad Request; response body contains `{ "error": { "code": "INACTIVE_ASSIGNEE", "message": "Assigned user is inactive." } }`. Zero database records created.
  * **Test Level:** API / Unit
  * **Priority:** High

  #### TC-ACT-17: Rejection of Assignee with Unauthorized Role
  * **Related Requirements:** FR-21, BR-01, AC-17
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that assigning an Action Taken to a user with role `REQUESTER` is strictly rejected.
  * **Preconditions / Test Data:** Authenticated IT Staff; user `req1` has role `REQUESTER`.
  * **Steps:**
    1. Issue `POST /api/tickets/:id/actions-taken` with `"assignedToId": "<req1-uuid>"`.
    2. Inspect response status code and error body.
  * **Expected Result:** HTTP 400 Bad Request; response body contains `{ "error": { "code": "INVALID_ASSIGNEE_ROLE", "message": "Assignee must have role IT_STAFF or ADMIN." } }`. Zero database records created.
  * **Test Level:** API / Unit
  * **Priority:** High

  #### TC-ACT-18: Performer Attribution Preserved Independently of Assignee
  * **Related Requirements:** FR-02, FR-21, BR-01, BR-02, AC-03, AC-17
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`, `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that creator attribution (`performedById`) is immutable and decoupled from task assignment (`assignedToId`). On update, assignee may be changed without mutating original performer.
  * **Preconditions / Test Data:** Existing Action Taken created by `staff1` with `assignedToId: staff2.id`.
  * **Steps:**
    1. Authenticated as `staff3`, issue `PATCH /api/actions-taken/:actionId` with:
      ```json
      {
        "assignedToId": "<staff3-uuid>",
        "performedById": "<staff3-uuid>"
      }
      ```
    2. Inspect response body and database record.
  * **Expected Result:** HTTP 200 OK; `assignedToId` is updated to `staff3.id`, but `performedById` strictly remains `staff1.id`. Creator attribution is preserved.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-ACT-19: Form State Retention on Recoverable API / Network Failure
  * **Related Requirements:** FR-24, BR-14, AC-19, ui-spec §3.2.4
  * **Related API/UI:** UI Staff Ticket Detail "Add Action Taken" modal
  * **Test Objective:** Verify that when form submission fails due to a recoverable client error (HTTP 400), concurrency conflict (HTTP 409), or server/network glitch (HTTP 500), all user-entered form data is retained in React state so the user does not need to re-enter details.
  * **Preconditions / Test Data:** Add Action modal open in test environment.
  * **Steps:**
    1. Fill form with Description ("Complex diagnostic finding"), Result ("Part replaced"), toggle Follow-Up checked with note ("Order replacement screw kit"), Attachment Notes ("diag.log"), and select an assignee.
    2. Mock API to respond with HTTP 400 Bad Request (`INACTIVE_ASSIGNEE`).
    3. Click "Record Action".
    4. Assert error alert is visible in modal.
    5. Inspect all form input fields.
  * **Expected Result:** Modal remains open; error alert informs user of failure; all entered text, checkboxes, notes, and assignee selections are intact in component state. User can correct the assignee and re-submit without loss of data.
  * **Test Level:** Component / RTL
  * **Priority:** High

  #### TC-ACT-20: Network Retry Safety via Idempotency Key
  * **Related Requirements:** FR-25, BR-14, AC-19, api-spec §2.1 Idempotency Contract
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that when a client sends a POST request that the server successfully commits, but the client loses the HTTP response before receiving it (simulated network interruption), retrying the same request with the same `Idempotency-Key` header returns the original `201 Created` response without creating a duplicate `ActionTaken` record.
  * **Preconditions / Test Data:** Valid ticket exists; authenticated as `staff1`.
  * **Steps:**
    1. Generate a unique client UUID (`idempotencyKey`) for this logical form submission; retain it with the unchanged payload until the request outcome is definitive.
    2. Issue `POST /api/tickets/:id/actions-taken` with `Idempotency-Key: <idempotencyKey>` header and a valid payload. Allow the server to commit the record.
    3. **Simulate network interruption:** Drop or discard the HTTP response before the client receives it (using a mock/interceptor that allows the server to process but returns no response to the client).
    3a. Restart the API process (or otherwise clear process-local state) before retrying, to verify the idempotency record is durably persisted rather than held only in memory.
    4. The client "retries" by issuing the identical `POST /api/tickets/:id/actions-taken` request with the same `Idempotency-Key: <idempotencyKey>` header and the same payload.
    5. Inspect the response status and body.
    6. Query the database for `ActionTaken` records on the ticket.
    7. Submit a different payload using the same `Idempotency-Key`.
    8. Inspect the conflict response and confirm the original database record is unchanged.
  * **Expected Result:** The retry returns HTTP `201 Created` with the **original** `ActionTaken` entity (same `id`, same `createdAt`). The database contains **exactly one** `ActionTaken` record for that payload — no duplicate. Reusing the same key with a different payload returns HTTP `409 Conflict` (`IDEMPOTENCY_KEY_CONFLICT`) and does not alter the original record. The idempotency record is scoped by authenticated user ID + ticket ID + key and retained for 24 hours.
  * **Test Level:** API / Integration / Concurrency
  * **Priority:** High

  #### TC-ACT-20B: Rapid Double-Click Duplicate Prevention (UI State)
  * **Related Requirements:** FR-25, BR-14, AC-19, ui-spec §3.2.4
  * **Related API/UI:** UI Staff Ticket Detail "Add Action Taken" modal
  * **Test Objective:** Verify that the UI prevents duplicate action submissions on rapid double-clicking by disabling the submit button while a request is pending (this is the UI-layer protection, separate from the API-level idempotency contract).
  * **Preconditions / Test Data:** Modal open in Staff Ticket Detail.
  * **Steps:**
    1. Fill valid Action Taken fields.
    2. Click "Record Action" submit button twice in rapid succession (< 100ms apart).
  * **Expected Result:** UI disables submit button immediately upon the first click (entering loading state with a spinner/indicator). Only a single API request is dispatched. Only one ActionTaken entity is created in the database.
  * **Test Level:** Component / E2E
  * **Priority:** Medium

  #### TC-ACT-21: Concurrent / Stale ActionTaken Update Conflict (HTTP 409)
  * **Related Requirements:** FR-04, BR-14, AC-19, api-spec §2.2 Optimistic Concurrency Contract
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that when two clients attempt to update the same ActionTaken record concurrently, and the second client's `expectedUpdatedAt` is stale (because the first client already modified the record), the server rejects the second update with HTTP 409 Conflict rather than silently overwriting the first client's changes.
  * **Preconditions / Test Data:** Existing ActionTaken record with `id: X` and `updatedAt: T1`; two separate authenticated IT Staff sessions (`staff1`, `staff2`).
  * **Steps:**
    1. Both `staff1` and `staff2` fetch the ActionTaken record; both observe `updatedAt: T1`.
    2. `staff1` issues `PATCH /api/actions-taken/X` with `{ "expectedUpdatedAt": "T1", "description": "Staff 1 update" }`. Server accepts; record's `updatedAt` is now `T2 > T1`.
    3. `staff2` issues `PATCH /api/actions-taken/X` with `{ "expectedUpdatedAt": "T1", "description": "Staff 2 update" }` (stale `expectedUpdatedAt`).
  * **Expected Result:** Step 2 returns HTTP `200 OK`. Step 3 returns HTTP `409 Conflict` with `{ "error": { "code": "STALE_UPDATE", "message": "The record was modified by another user. Please reload and retry." } }`. Database record reflects only `staff1`'s update.
  * **Test Level:** API / Integration / Concurrency
  * **Priority:** High

  ---

  ### 3.2 Role-Based Access Control (RBAC) & Authorization

  #### TC-RBAC-01: Requester Blocked from Creating Action Taken
  * **Related Requirements:** FR-07, BR-03, AC-02
  * **Related API/UI:** `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that a Requester attempting to record an Action Taken receives HTTP 403 Forbidden.
  * **Preconditions / Test Data:** Ticket requested by `req1`; authenticated as `req1`.
  * **Steps:**
    1. Send `POST /api/tickets/:id/actions-taken` with valid action payload using `req1` session cookie.
  * **Expected Result:** HTTP 403 Forbidden; error code `FORBIDDEN`; 0 records created.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-02: Requester Blocked from Updating Action Taken
  * **Related Requirements:** FR-07, BR-03
  * **Related API/UI:** `PATCH /api/actions-taken/:actionId`
  * **Test Objective:** Verify that a Requester attempting to update an Action Taken receives HTTP 403 Forbidden.
  * **Preconditions / Test Data:** Valid Action Taken exists; authenticated as `req1`.
  * **Steps:**
    1. Send `PATCH /api/actions-taken/:actionId` using `req1` session cookie.
  * **Expected Result:** HTTP 403 Forbidden; record remains unmodified.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-03: Action Taken Deletion Prohibited Across All Roles (Explicit 405)
  * **Related Requirements:** BR-05, Decision 13.1.1, api-spec §2.4
  * **Related API/UI:** `DELETE /api/actions-taken/:actionId` (explicit route handler)
  * **Test Objective:** Verify that the backend explicitly registers route handlers for DELETE attempts on Actions Taken, returning HTTP 405 Method Not Allowed with standard error payload rather than relying on Express's default 404 handler for undefined routes.
  * **Preconditions / Test Data:** Existing Action Taken; test with `REQUESTER`, `IT_STAFF`, and `ADMIN`.
  * **Steps:**
    1. Issue `DELETE /api/actions-taken/:actionId` as `REQUESTER`, `IT_STAFF`, and `ADMIN`.
    2. Issue `DELETE /api/tickets/:id/actions-taken/:actionId` as `REQUESTER`, `IT_STAFF`, and `ADMIN`.
    3. Query database table `ActionTaken` and `ActionTakenRevision` for the target record.
  * **Expected Result:** All requests return HTTP 405 Method Not Allowed with JSON body `{ "error": { "code": "METHOD_NOT_ALLOWED", "message": "Actions taken audit records cannot be deleted" } }`; target record and associated revisions remain completely intact.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-04: Non-Owner Requester Access Returns 404 (Non-Enumeration)
  * **Related Requirements:** BR-15, api-spec §1.2
  * **Related API/UI:** `GET /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that a Requester attempting to read Actions Taken for a ticket they do not own receives HTTP 404 (not 403), preventing ticket ID enumeration.
  * **Preconditions / Test Data:** Ticket owned by `req2`; authenticated as `req1`.
  * **Steps:**
    1. Request `GET /api/tickets/:req2_ticket_id/actions-taken` as `req1`.
  * **Expected Result:** HTTP 404 Not Found (`TICKET_NOT_FOUND`).
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-05: Unauthenticated Access to Actions Taken Endpoints
  * **Related Requirements:** api-spec §1.1
  * **Related API/UI:** `/api/tickets/:id/actions-taken`, `/api/actions-taken/:actionId`
  * **Test Objective:** Verify that unauthenticated requests to Actions Taken endpoints receive HTTP 401 Unauthorized.
  * **Preconditions / Test Data:** No session cookie provided.
  * **Steps:**
    1. Send GET, POST, and PATCH requests without session header.
  * **Expected Result:** HTTP 401 Unauthorized (`UNAUTHORIZED`).
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-06: IT Staff & Admin Blocked from Requester Dashboard
  * **Related Requirements:** FR-13, api-spec §3.1
  * **Related API/UI:** `GET /api/dashboard/requester`
  * **Test Objective:** Verify that IT Staff and Admin accounts are blocked from accessing the Requester Dashboard endpoint.
  * **Preconditions / Test Data:** Authenticated as `staff1` and `admin1`.
  * **Steps:**
    1. Request `GET /api/dashboard/requester` with staff cookie.
    2. Request `GET /api/dashboard/requester` with admin cookie.
  * **Expected Result:** HTTP 403 Forbidden for both calls.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-07: Requester Blocked from IT Staff Dashboard
  * **Related Requirements:** FR-14, api-spec §3.2
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify that Requesters are blocked from accessing the IT Staff Dashboard endpoint.
  * **Preconditions / Test Data:** Authenticated as `req1`.
  * **Steps:**
    1. Request `GET /api/dashboard/staff` with requester cookie.
  * **Expected Result:** HTTP 403 Forbidden.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-RBAC-08: Mandatory Password Change Enforcement
  * **Related Requirements:** api-spec §1.1, Lab 3 regression
  * **Related API/UI:** All new Sprint 4 endpoints
  * **Test Objective:** Verify that users with `mustChangePassword === true` are blocked from new endpoints until password is changed.
  * **Preconditions / Test Data:** User account seeded with `mustChangePassword: true`.
  * **Steps:**
    1. Attempt `GET /api/dashboard/requester` or `POST /api/tickets/:id/actions-taken`.
  * **Expected Result:** HTTP 403 Forbidden (`code: "PASSWORD_CHANGE_REQUIRED"`).
  * **Test Level:** API / Security
  * **Priority:** Medium

  ---

  ### 3.3 Ticket Status Transitions and Resolution Governance

  #### TC-TRN-01: Valid Status Transition IN_PROGRESS -> RESOLVED
  * **Related Requirements:** FR-08, FR-09, BR-10, AC-07
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that an IT technician can transition an `IN_PROGRESS` ticket to `RESOLVED` when at least one Action Taken exists, and that an audit note is recorded.
  * **Preconditions / Test Data:** Test ticket in `IN_PROGRESS` with at least one Action Taken (per Team-approved Business Rule `BR-10`, followUpRequired may be true or false); authenticated as IT Staff.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with `{"status": "RESOLVED"}`.
    2. Check response payload and ticket `currentStatus` in DB.
    3. Query `InternalNote` table for the target ticket.
  * **Expected Result:** HTTP 200 OK; `currentStatus` is `RESOLVED`; internal note created stating `"Status changed from IN_PROGRESS to RESOLVED"`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-02: Valid Status Transition RESOLVED -> CLOSED (Terminal)
  * **Related Requirements:** FR-08, FR-10, BR-08
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify transition from `RESOLVED` to `CLOSED`.
  * **Preconditions / Test Data:** Ticket in `RESOLVED` status.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with `{"status": "CLOSED"}`.
  * **Expected Result:** HTTP 200 OK; `currentStatus` is `CLOSED`; audit note logged.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-03: Valid Status Transition RESOLVED -> REOPENED (Reactivation)
  * **Related Requirements:** FR-08, FR-10, BR-09
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify transition from `RESOLVED` to `REOPENED`.
  * **Preconditions / Test Data:** Ticket in `RESOLVED` status.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with `{"status": "REOPENED"}`.
  * **Expected Result:** HTTP 200 OK; `currentStatus` is `REOPENED`; audit note logged.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-04: Transitions from REOPENED Status
  * **Related Requirements:** FR-08, BR-09, spec §6.1
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify permitted transitions from `REOPENED` back to `IN_PROGRESS` or `RESOLVED`.
  * **Preconditions / Test Data:** Ticket in `REOPENED` status with at least one Action Taken (satisfying Resolution Gate `BR-10`).
  * **Steps:**
    1. Transition to `IN_PROGRESS` -> succeeds (200 OK).
    2. Transition to `RESOLVED` -> succeeds (200 OK).
  * **Expected Result:** HTTP 200 OK for each permitted transition.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-05: Claim and Assign Transitions (NEW -> OPEN)
  * **Related Requirements:** FR-08, Lab 3 regression
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/claim`, `PATCH /api/staff/tickets/:id/assign`
  * **Test Objective:** Verify that claiming or assigning a `NEW` ticket transitions its status to `OPEN`.
  * **Preconditions / Test Data:** Ticket in `NEW` status with `ownerId: null`.
  * **Steps:**
    1. Call `PATCH /api/staff/tickets/:id/claim` as IT Staff.
  * **Expected Result:** HTTP 200 OK; `ownerId` set to technician; `currentStatus` transitions to `OPEN`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-06: Invalid Status Transition Rejected (NEW -> RESOLVED)
  * **Related Requirements:** FR-08, AC-08
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that an illegal direct transition from `NEW` to `RESOLVED` is rejected.
  * **Preconditions / Test Data:** Ticket in `NEW` status.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with `{"status": "RESOLVED"}`.
  * **Expected Result:** HTTP 400 Bad Request; error code `VALIDATION_ERROR`; status remains `NEW`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-07: Terminal State Immutability — CLOSED
  * **Related Requirements:** FR-11, BR-08, AC-09
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`, `claim`, `assign`, `priority`
  * **Test Objective:** Verify that a `CLOSED` ticket rejects any status transition, claim, assign, or priority modification.
  * **Preconditions / Test Data:** Ticket in `CLOSED` status.
  * **Steps:**
    1. Attempt status transition to `OPEN` or `RESOLVED`.
    2. Attempt claim or assignment.
    3. Attempt priority update.
  * **Expected Result:** All attempts return HTTP 400 Bad Request; ticket remains immutable.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-08: Terminal State Immutability — CANCELLED
  * **Related Requirements:** FR-11, BR-08, AC-09
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that a `CANCELLED` ticket is terminal and immutable.
  * **Preconditions / Test Data:** Ticket in `CANCELLED` status.
  * **Steps:**
    1. Attempt status transition to `OPEN`.
  * **Expected Result:** HTTP 400 Bad Request; ticket remains `CANCELLED`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-09: Terminal State Immutability — REJECTED
  * **Related Requirements:** FR-11, BR-07, BR-08, AC-09
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that a legacy `REJECTED` ticket is terminal and immutable.
  * **Preconditions / Test Data:** Ticket in `REJECTED` status.
  * **Steps:**
    1. Attempt status transition to `NEW` or `OPEN`.
  * **Expected Result:** HTTP 400 Bad Request; ticket remains `REJECTED`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-10: Preserved Lab 3 Rejection with Mandatory Reason
  * **Related Requirements:** BR-07, spec §6.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify transitioning `NEW` -> `REJECTED` succeeds when `rejectionReason` is provided and logs audit note.
  * **Preconditions / Test Data:** Ticket in `NEW` status.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with:
      ```json
      {"status": "REJECTED", "rejectionReason": "Out of scope request."}
      ```
  * **Expected Result:** HTTP 200 OK; `currentStatus` is `REJECTED`; internal note created containing `"Status changed from NEW to REJECTED. Reason: Out of scope request."`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-11: Rejection Without Reason Rejected
  * **Related Requirements:** BR-07, spec §6.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify transitioning to `REJECTED` without `rejectionReason` fails.
  * **Preconditions / Test Data:** Ticket in `NEW` status.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with `{"status": "REJECTED"}` and no reason.
  * **Expected Result:** HTTP 400 Bad Request (`VALIDATION_ERROR`); status remains `NEW`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-12: Automatic Audit Note Generated on Status Transitions
  * **Related Requirements:** FR-12, spec §6.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that every legal status transition creates an `InternalNote` documenting the change.
  * **Preconditions / Test Data:** Ticket in `OPEN` status.
  * **Steps:**
    1. Transition status from `OPEN` to `IN_PROGRESS`.
    2. Fetch internal notes for the ticket.
  * **Expected Result:** Most recent internal note has content `"Status changed from OPEN to IN_PROGRESS"` with author matching the authenticated technician.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-TRN-13: Requester Blocked from Directly Modifying Status
  * **Related Requirements:** BR-03, BR-10, spec §6.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that a Requester attempting to update status directly receives HTTP 403 Forbidden.
  * **Preconditions / Test Data:** Authenticated as Requester.
  * **Steps:**
    1. Send `PATCH /api/staff/tickets/:id/status` with `{"status": "RESOLVED"}` using requester session.
  * **Expected Result:** HTTP 403 Forbidden; status remains unchanged.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-TRN-14: Requester Problem Resolution Indication
  * **Related Requirements:** BR-11, spec §6.2, Lab 3 regression
  * **Related API/UI:** `POST /api/tickets/:id/indicate-resolved`
  * **Test Objective:** Verify that calling indicate-resolved appends a public comment but does NOT alter `currentStatus`.
  * **Preconditions / Test Data:** Ticket owned by `req1` in status `IN_PROGRESS`.
  * **Steps:**
    1. Issue `POST /api/tickets/:id/indicate-resolved` as `req1`.
    2. Inspect response and query ticket `currentStatus`.
  * **Expected Result:** HTTP 200/201 OK; public comment added indicating user believes issue is resolved; ticket `currentStatus` remains `IN_PROGRESS`.
  * **Test Level:** API / Integration
  * **Priority:** Medium

  #### TC-TRN-15: Concurrency Conflict on Ticket Status (HTTP 409)
  * **Related Requirements:** BR-14, AC-15
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that competing simultaneous status updates on the same ticket result in exactly one success and one HTTP 409 Conflict rejection using two permitted transitions from the approved matrix.
  * **Preconditions / Test Data:** Ticket in `IN_PROGRESS` status with at least 1 Action Taken.
  * **Steps:**
    1. Dispatch two concurrent requests using confirmed transition paths:
      * Request A: transition `IN_PROGRESS` -> `RESOLVED` (Confirmed Handout Requirement)
      * Request B: transition `IN_PROGRESS` -> `WAITING_FOR_REQUESTER` (Confirmed Handout Requirement)
    2. Await both responses.
  * **Expected Result:** Exactly one transaction succeeds (HTTP 200 OK); the competing transaction is safely rejected with HTTP 409 Conflict per BR-14 and AC-15. Database reflects a single consistent status (`RESOLVED` or `WAITING_FOR_REQUESTER`).
  * **Test Level:** Integration / Concurrency
  * **Priority:** High

  #### TC-TRN-16: Backend Resolution Gate Rejection — No Action Taken Recorded (Team-approved Business Rule)
  * **Related Requirements:** FR-08, FR-22, BR-10, AC-18, spec §6.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify the Team-approved Business Rule (`BR-10`): the backend authoritatively rejects any request attempting to transition a ticket to `RESOLVED` when zero persisted Actions Taken records exist (`COUNT == 0`). Frontend validation is supplementary; backend is the authoritative enforcement point.
  * **Preconditions / Test Data:** Ticket `TKT-TEST-RES` in `IN_PROGRESS` status with 0 Actions Taken records; authenticated user is `staff1` (`IT_STAFF`).
  * **Steps:**
    1. Issue direct HTTP request `PATCH /api/staff/tickets/:id/status` with payload `{ "status": "RESOLVED" }`.
    2. Inspect response status code and response body.
    3. Query ticket status in database.
  * **Expected Result:** HTTP 400 Bad Request with `{ "error": { "code": "ACTION_TAKEN_REQUIRED", "message": "At least one Action Taken is required." } }`; database confirms ticket remains in `IN_PROGRESS`.
  * **Test Level:** API / Security / Workflow
  * **Priority:** High

  #### TC-TRN-17: Backend Resolution Gate Permitted — Transition to RESOLVED with Action Taken
  * **Related Requirements:** FR-08, FR-09, FR-22, BR-10, AC-07, AC-18, spec §6.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that transitioning an active ticket to `RESOLVED` succeeds when at least one Action Taken record exists, even if that record still has a follow-up obligation.
  * **Preconditions / Test Data:** Ticket in `IN_PROGRESS` status with 1 existing Action Taken record whose `followUpRequired = true` and a non-empty `followUpNote`; authenticated user is `staff1` (`IT_STAFF`).
  * **Steps:**
    1. Issue `PATCH /api/staff/tickets/:id/status` with `{ "status": "RESOLVED" }`.
    2. Inspect response status and database state.
  * **Expected Result:** HTTP 200 OK; ticket `currentStatus` updates to `RESOLVED`; automated `InternalNote` audit note is recorded.
  * **Test Level:** API / Workflow
  * **Priority:** High


  #### TC-TRN-18: Complete Ticket Status Transition Matrix
  * **Related Requirements:** FR-08, FR-09, BR-06, BR-08, BR-10, AC-07, AC-08, AC-09
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`; `StaffTicketDetail` status dropdown
  * **Test Objective:** Verify every transition listed in `specification.md §6.1` succeeds when its additional conditions are met, every unlisted transition is rejected, and the UI exposes exactly the same permitted options.
  * **Preconditions / Test Data:** Create one Ticket fixture per source status. For each transition to `RESOLVED`, provide at least one persisted Action Taken; for the negative Resolution Gate case use zero. For `NEW -> REJECTED`, provide a non-empty rejection reason.
  * **Steps:**
    1. Iterate through every permitted source/destination pair in the canonical matrix and submit the status update as `IT_STAFF`.
    2. Attempt representative unlisted transitions, including `NEW -> IN_PROGRESS`, `CLOSED -> REOPENED`, `CANCELLED -> OPEN`, and `REJECTED -> OPEN`.
    3. Inspect the status dropdown for each source status and compare its options with the matrix.
  * **Expected Result:** Every listed transition succeeds with HTTP 200 and an audit `InternalNote`, subject to the Resolution Gate and rejection-reason rules. Every unlisted transition returns HTTP 400 (`VALIDATION_ERROR`) and leaves the status unchanged. The UI options exactly match the permitted destination set. Terminal statuses expose no transition controls.
  * **Test Level:** API / Integration / UI Component
  * **Priority:** Critical

  ---

  ### 3.4 Requester Dashboard & Drill-Down

  #### TC-DASH-REQ-01: Requester Metric Accuracy on Populated Dataset
  * **Related Requirements:** FR-13, FR-17, BR-12, BR-13, AC-10
  * **Related API/UI:** `GET /api/dashboard/requester`
  * **Test Objective:** Verify that requester dashboard metrics exactly match expected counts for the authenticated user across active, waiting, and resolved/closed scopes.
  * **Preconditions / Test Data:** Fixture tickets for `req1`:
    * 1 `NEW`, 1 `OPEN`, 1 `IN_PROGRESS` (Active = 3)
    * 2 `WAITING_FOR_REQUESTER` (Waiting = 2)
    * 2 `RESOLVED`, 1 `CLOSED` (Resolved/Closed = 3)
    * 1 `CANCELLED`, 1 `REJECTED` (Other = 2)
    * Total = 10
  * **Steps:**
    1. Issue `GET /api/dashboard/requester` as `req1`.
  * **Expected Result:**
    ```json
    {
      "data": {
        "totalTickets": 10,
        "activeTickets": 3,
        "waitingForRequesterTickets": 2,
        "resolvedOrClosedTickets": 3
      }
    }
    ```
    Note: `CANCELLED` and `REJECTED` are counted in `totalTickets` but excluded from `activeTickets` and `resolvedOrClosedTickets`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-DASH-REQ-02: Requester Metric on Empty Dataset
  * **Related Requirements:** FR-13, AC-10
  * **Related API/UI:** `GET /api/dashboard/requester`
  * **Test Objective:** Verify that a new requester with zero tickets receives all 0 counts without errors.
  * **Preconditions / Test Data:** New requester with 0 tickets in database.
  * **Steps:**
    1. Issue `GET /api/dashboard/requester`.
  * **Expected Result:** HTTP 200 OK with `totalTickets: 0`, `activeTickets: 0`, `waitingForRequesterTickets: 0`, `resolvedOrClosedTickets: 0`.
  * **Test Level:** API / Integration
  * **Priority:** Medium

  #### TC-DASH-REQ-03: Requester Metric Data Isolation
  * **Related Requirements:** BR-13, AC-10
  * **Related API/UI:** `GET /api/dashboard/requester`
  * **Test Objective:** Verify that tickets requested by user B are completely excluded from user A's dashboard metrics.
  * **Preconditions / Test Data:** `req1` has 2 tickets; `req2` has 10 tickets.
  * **Steps:**
    1. Fetch dashboard metrics as `req1`.
  * **Expected Result:** `totalTickets: 2`; none of `req2`'s tickets are counted.
  * **Test Level:** API / Security
  * **Priority:** High

  #### TC-DASH-REQ-04: Drill-Down: Total Tickets
  * **Related Requirements:** FR-15, AC-11, ui-spec §2.1.2
  * **Related API/UI:** UI Requester Dashboard
  * **Test Objective:** Verify clicking "Total Tickets" navigates to `/my-tickets` without filters.
  * **Preconditions / Test Data:** Render `RequesterDashboard` component.
  * **Steps:**
    1. Click the "Total Tickets" card.
  * **Expected Result:** Router location is `/my-tickets` with no query parameters; full ticket list is displayed.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-REQ-05: Drill-Down: Active Tickets (Multi-Status Filter)
  * **Related Requirements:** FR-15, AC-11, ui-spec §2.1.2, UI-Q7
  * **Related API/UI:** UI Requester Dashboard, `MyTickets`
  * **Test Objective:** Verify clicking "Active Tickets" navigates to `/my-tickets` with multi-status filter for `NEW,OPEN,IN_PROGRESS`.
  * **Preconditions / Test Data:** Render `RequesterDashboard`.
  * **Steps:**
    1. Click "Active Tickets" card.
  * **Expected Result:** Router navigates to `/my-tickets?status=NEW,OPEN,IN_PROGRESS` (or configured multi-status parameter); `MyTickets` filters display only tickets matching `NEW`, `OPEN`, or `IN_PROGRESS`.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-REQ-06: Drill-Down: Waiting for Me
  * **Related Requirements:** FR-15, AC-11, ui-spec §2.1.2
  * **Related API/UI:** UI Requester Dashboard
  * **Test Objective:** Verify clicking "Waiting for Me" navigates to `/my-tickets?status=WAITING_FOR_REQUESTER`.
  * **Preconditions / Test Data:** Render `RequesterDashboard`.
  * **Steps:**
    1. Click "Waiting for Me" card.
  * **Expected Result:** Navigates to `/my-tickets?status=WAITING_FOR_REQUESTER`; tickets shown have status `WAITING_FOR_REQUESTER`.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-REQ-07: Drill-Down: Resolved / Closed (Multi-Status Filter)
  * **Related Requirements:** FR-15, AC-11, ui-spec §2.1.2, UI-Q7
  * **Related API/UI:** UI Requester Dashboard
  * **Test Objective:** Verify clicking "Resolved / Closed" navigates to `/my-tickets` with multi-status filter for `RESOLVED,CLOSED`.
  * **Preconditions / Test Data:** Render `RequesterDashboard`.
  * **Steps:**
    1. Click "Resolved / Closed" card.
  * **Expected Result:** Navigates to `/my-tickets?status=RESOLVED,CLOSED`; only tickets with status `RESOLVED` or `CLOSED` appear.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-REQ-08: Requester Dashboard Recent Tickets Array
  * **Related Requirements:** FR-15, BR-12, AC-20, spec §8.1, api-spec §3.1
  * **Related API/UI:** `GET /api/dashboard/requester`, UI Requester Dashboard
  * **Test Objective:** Verify that `GET /api/dashboard/requester` returns the `recentTickets` array containing up to 5 recently updated tickets belonging to the authenticated requester sorted by `updatedAt DESC`, and the UI renders them in the recent items section with attention callouts for `WAITING_FOR_REQUESTER` and `RESOLVED` items.
  * **Preconditions / Test Data:** Requester `req1` has 7 tickets with varying `updatedAt` and statuses (including at least 1 `WAITING_FOR_REQUESTER` and 1 `RESOLVED`).
  * **Steps:**
    1. Issue `GET /api/dashboard/requester` as `req1`.
    2. Inspect `recentTickets` array in JSON payload.
    3. Render `RequesterDashboard` and inspect rendered ticket rows.
  * **Expected Result:** HTTP 200 OK; `recentTickets` contains at most 5 items sorted by `updatedAt DESC`. Each item contains `id`, `ticketNumber`, `title`, `currentStatus`, `itPriority`, `updatedAt`. **Note:** The field `resolvedAt` is NOT included in the API response shape (per api-spec §3.1); tests must NOT assert its presence. UI renders items with valid links to `/tickets/:id`; tickets with `WAITING_FOR_REQUESTER` status display an amber attention badge.
  * **Test Level:** API / Component
  * **Priority:** High

  #### TC-DASH-REQ-09: Requester Dashboard Zero Metrics & Empty Lists on Clean Account
  * **Related Requirements:** FR-13, FR-15, BR-12, AC-20, spec §8.1, spec §9.3
  * **Related API/UI:** `GET /api/dashboard/requester`, UI Requester Dashboard
  * **Test Objective:** Verify that a newly registered or clean requester account with 0 tickets receives numeric counts of 0 and an empty `recentTickets` array (`[]`), with the UI rendering the zero-metric empty state without errors.
  * **Preconditions / Test Data:** Clean seed account `req_empty` with 0 created tickets.
  * **Steps:**
    1. Authenticate as `req_empty`.
    2. Request `GET /api/dashboard/requester`.
    3. Render `RequesterDashboard` component.
  * **Expected Result:** HTTP 200 OK; `totalTickets: 0`, `activeTickets: 0`, `waitingForRequesterTickets: 0`, `resolvedOrClosedTickets: 0`, `recentTickets: []`. UI displays four `0` metric cards and empty list placeholder "No tickets submitted yet. Click Create Ticket to get started." Zero React render crashes or NaN values.
  * **Test Level:** API / Component
  * **Priority:** High

  ---

  ### 3.5 IT Staff Dashboard & Drill-Down

  #### TC-DASH-STF-01: IT Staff Dashboard Metric Accuracy on Global Queue
  * **Related Requirements:** FR-14, FR-17, BR-12, AC-12
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify that IT staff dashboard returns accurate counts for unassigned, personal active, follow-up, priority, and status breakdown.
  * **Preconditions / Test Data:** Global queue fixture:
    * Unassigned tickets: 2 `NEW`, 1 `OPEN` with `ownerId: null` -> `unassignedTickets = 3`.
    * `staff1` assigned active: 1 `OPEN`, 1 `IN_PROGRESS`, 1 `WAITING_FOR_REQUESTER` -> `myActiveTickets = 3`.
    * Critical/High unresolved: 2 `CRITICAL` in `IN_PROGRESS`, 1 `HIGH` in `OPEN` -> `criticalOrHighPriorityTickets = 3`.
  * **Steps:**
    1. Request `GET /api/dashboard/staff` as `staff1`.
  * **Expected Result:** HTTP 200 OK; returned metric fields match expected counts exactly.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-DASH-STF-02: IT Staff Dashboard on Empty Queue
  * **Related Requirements:** FR-14, AC-12
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify dashboard handles empty database queue gracefully with 0 counts.
  * **Preconditions / Test Data:** Database with 0 tickets.
  * **Steps:**
    1. Request `GET /api/dashboard/staff`.
  * **Expected Result:** HTTP 200 OK; all KPI values are 0; `statusBreakdown` maps each status key to 0.
  * **Test Level:** API / Integration
  * **Priority:** Medium

  #### TC-DASH-STF-03: Distinct Ticket Count for Follow-Up Metric
  * **Related Requirements:** FR-14, BR-12, AC-13, spec §8.2
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify that an unresolved ticket containing multiple Action Taken records marked `followUpRequired = true` increments `ticketsRequiringFollowUp` by exactly ONE.
  * **Preconditions / Test Data:**
    * Ticket `TKT-1001` (`IN_PROGRESS`) has 3 Action Taken records with `followUpRequired = true`.
    * Ticket `TKT-1002` (`OPEN`) has 1 Action Taken with `followUpRequired = true`.
    * Ticket `TKT-1003` (`RESOLVED`) has 1 Action Taken with `followUpRequired = true` (excluded because status is terminal/resolved).
  * **Steps:**
    1. Fetch `GET /api/dashboard/staff`.
  * **Expected Result:** `ticketsRequiringFollowUp === 2` (counts distinct active tickets `TKT-1001` and `TKT-1002`).
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-DASH-STF-04: Critical / High Priority Unresolved Scope
  * **Related Requirements:** BR-12, api-spec §3.2
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify that `criticalOrHighPriorityTickets` strictly counts only active unresolved tickets (`NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')`).
  * **Preconditions / Test Data:**
    * Ticket A: `CRITICAL`, `IN_PROGRESS` (Counted)
    * Ticket B: `HIGH`, `OPEN` (Counted)
    * Ticket C: `CRITICAL`, `RESOLVED` (Excluded)
    * Ticket D: `HIGH`, `CLOSED` (Excluded)
  * **Steps:**
    1. Request `GET /api/dashboard/staff`.
  * **Expected Result:** `criticalOrHighPriorityTickets === 2`.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-DASH-STF-05: Status Breakdown Includes All Standard Statuses + REJECTED
  * **Related Requirements:** BR-07, BR-12, spec §8.2
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify that `statusBreakdown` object contains keys for all 8 standard statuses plus `REJECTED`, and their sum matches total tickets in the queue.
  * **Preconditions / Test Data:** Tickets distributed across various statuses.
  * **Steps:**
    1. Fetch `GET /api/dashboard/staff`.
    2. Inspect keys of `data.statusBreakdown`.
  * **Expected Result:** Keys present: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, and `REJECTED`. Sum of all values equals total tickets in database.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-DASH-STF-06: Drill-Down: Unassigned Tickets
  * **Related Requirements:** FR-16, spec §8.2, ui-spec §2.2.2
  * **Related API/UI:** UI Staff Dashboard
  * **Test Objective:** Verify clicking "Unassigned Tickets" navigates to `/staff-queue` filtered by unassigned tickets.
  * **Preconditions / Test Data:** Render `StaffDashboard`.
  * **Steps:**
    1. Click "Unassigned Tickets" card.
  * **Expected Result:** Navigates to `/staff-queue?ownerId=unassigned&status=NEW,OPEN`; queue displays only unassigned tickets in `NEW` or `OPEN` status.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-STF-07: Drill-Down: My Active Tickets
  * **Related Requirements:** FR-16, spec §8.2, ui-spec §2.2.2, UI-Q8
  * **Related API/UI:** UI Staff Dashboard
  * **Test Objective:** Verify clicking "My Active Tickets" navigates to `/staff-queue?ownerId=me` with the active-status filter.
  * **Preconditions / Test Data:** Render `StaffDashboard` as `staff1`.
  * **Steps:**
    1. Click "My Active Tickets" card.
  * **Expected Result:** Navigates to `/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`; queue resolves `ownerId=me` to `staff1.id` and filters to exactly those active statuses.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-STF-08: Drill-Down: Follow-Up Required
  * **Related Requirements:** FR-16, spec §8.2, ui-spec §2.2.2, UI-Q8
  * **Related API/UI:** UI Staff Dashboard
  * **Test Objective:** Verify clicking "Follow-Up Required" navigates to the follow-up filter combined with the unresolved-status filter.
  * **Preconditions / Test Data:** Render `StaffDashboard`.
  * **Steps:**
    1. Click "Tickets Requiring Follow-Up" card.
  * **Expected Result:** Navigates to `/staff-queue?followUpRequired=true&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`; queue displays distinct unresolved tickets with at least one follow-up action.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-STF-09: Drill-Down: Critical / High Priority
  * **Related Requirements:** FR-16, spec §8.2, ui-spec §2.2.2, UI-Q8
  * **Related API/UI:** UI Staff Dashboard
  * **Test Objective:** Verify clicking "Critical / High Priority" navigates to the multi-value `itPriority` filter combined with the unresolved-status filter.
  * **Preconditions / Test Data:** Render `StaffDashboard`.
  * **Steps:**
    1. Click "Critical / High Priority" card.
  * **Expected Result:** Navigates to `/staff-queue?itPriority=CRITICAL,HIGH&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`; queue filters to unresolved high/critical tickets only.
  * **Test Level:** Component / E2E
  * **Priority:** High

  #### TC-DASH-STF-10: Drill-Down: Status Breakdown Badge
  * **Related Requirements:** FR-16, spec §8.2, ui-spec §2.2.2
  * **Related API/UI:** UI Staff Dashboard
  * **Test Objective:** Verify clicking a status badge navigates to `/staff-queue?status=<STATUS>`.
  * **Preconditions / Test Data:** Render `StaffDashboard`.
  * **Steps:**
    1. Click the "IN_PROGRESS" badge in the Status Breakdown grid.
  * **Expected Result:** Navigates to `/staff-queue?status=IN_PROGRESS`.
  * **Test Level:** Component / E2E
  * **Priority:** Medium

  #### TC-DASH-STF-11: Admin Access to Staff Dashboard
  * **Related Requirements:** FR-14, FR-16, BR-16, spec §5, spec §8.3
  * **Related API/UI:** `GET /api/dashboard/staff`
  * **Test Objective:** Verify that Administrators have full access to view the IT Staff Dashboard, inheriting all technician metrics with an Administrator governance note.
  * **Preconditions / Test Data:** Authenticated as `admin1`.
  * **Steps:**
    1. Request `GET /api/dashboard/staff`.
  * **Expected Result:** HTTP 200 OK; metrics, recent queue tickets, and user actions returned successfully.
  * **Test Level:** API / Integration
  * **Priority:** High

  #### TC-DASH-STF-12: Staff Dashboard Recent Queue Tickets & User Actions
  * **Related Requirements:** FR-16, BR-12, AC-20, spec §8.2, api-spec §3.2
  * **Related API/UI:** `GET /api/dashboard/staff`, UI Staff Dashboard
  * **Test Objective:** Verify that `GET /api/dashboard/staff` returns `recentTickets` (capped at 5 tickets sorted by `updatedAt DESC`) and `currentUserActions` (capped at 5 recent actions performed by or assigned to current technician sorted by `actionDateTime DESC`), and UI displays both tables.
  * **Preconditions / Test Data:** Global queue has multiple urgent tickets and `staff1` has logged actions across tickets.
  * **Steps:**
    1. Authenticate as `staff1`.
    2. Issue `GET /api/dashboard/staff`.
    3. Inspect response fields `recentTickets` and `currentUserActions`.
    4. Render `StaffDashboard` and verify rendered sections.
  * **Expected Result:** HTTP 200 OK; `recentTickets` contains ≤ 5 items sorted by `updatedAt DESC` (recency only — **not** priority urgency; see spec §8.2 and api-spec §3.2 which both specify `updatedAt DESC` sorting); `currentUserActions` contains ≤ 5 items where `performedById == staff1.id` or `assignedToId == staff1.id`, sorted by `actionDateTime DESC`. UI displays both tables below the status breakdown grid with functional links.
  * **Test Level:** API / Component
  * **Priority:** High

  #### TC-DASH-STF-13: Staff Dashboard Zero Metrics & Empty Lists on Clean Staff Account
  * **Related Requirements:** FR-14, FR-16, BR-12, AC-12, AC-20, spec §8.2, spec §9.3
  * **Related API/UI:** `GET /api/dashboard/staff`, UI Staff Dashboard
  * **Test Objective:** Verify that an unassigned staff member or clean database queue returns valid zero metrics (`0`), all status breakdown keys as `0`, and empty arrays for `recentTickets` and `currentUserActions`, with UI displaying clean empty states.
  * **Preconditions / Test Data:** Authenticated as clean seed staff member `tech_empty` with 0 assigned tickets and 0 recorded actions.
  * **Steps:**
    1. Issue `GET /api/dashboard/staff` as `tech_empty`.
    2. Render `StaffDashboard` component.
  * **Expected Result:** HTTP 200 OK; `myActiveTickets: 0`, all KPI cards show `0`, `currentUserActions: []`. UI displays empty state message "No actions recorded yet. Open a ticket to record your first service action." Zero render errors.
  * **Test Level:** API / Component
  * **Priority:** High

  ---

  ### 3.6 Database, Migration, Seed, and Data Preservation Tests

  #### TC-DB-01: Ticket to ActionTaken 1-to-Many Relationship
  * **Related Requirements:** spec §7.1, spec §9.1
  * **Related API/UI:** Prisma Client
  * **Test Objective:** Verify that Prisma can query a Ticket with its related `actionsTaken` (and nested `revisions`) and vice versa.
  * **Preconditions / Test Data:** Test ticket with 2 ActionTaken records, one of which has an edit revision.
  * **Steps:**
    1. Query `prisma.ticket.findUnique({ where: { id }, include: { actionsTaken: { include: { revisions: true } } } })`.
    2. Query `prisma.actionTaken.findUnique({ where: { id: actionId }, include: { ticket: true, performedBy: true, revisions: true } })`.
  * **Expected Result:** Queries succeed; Ticket contains array of 2 actions; nested revisions query cleanly; Action contains parent Ticket and User relations.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-01B: ActionTakenRevision Table Schema & Unique Constraint Integrity
  * **Related Requirements:** FR-04, BR-05, spec §9.1, plan §5.2
  * **Related API/UI:** Prisma Client / PostgreSQL Schema
  * **Test Objective:** Verify that table `ActionTakenRevision` exists, enforces referential integrity to `ActionTaken` (`actionTakenId`), enforces foreign key to `User` (`editedById`), stores `originalData` and `updatedData` as JSON, tracks `revisionNumber` as an integer, and enforces the unique constraint `@@unique([actionTakenId, revisionNumber])` preventing duplicate revisions on concurrent edits.
  * **Preconditions / Test Data:** ActionTaken with at least one edit.
  * **Steps:**
    1. Query `prisma.actionTakenRevision.findFirst({ where: { actionTakenId } })`.
    2. Assert schema types: `actionTakenId` (Int), `revisionNumber` (Int), `editedById` (String), `editedAt` (DateTime), `originalData` (JSON object), `updatedData` (JSON object).
    3. Verify foreign key relation to editor: `include: { editor: true }`.
    4. Attempt to insert a second `ActionTakenRevision` record bearing the duplicate `(actionTakenId, revisionNumber)` tuple.
  * **Expected Result:** Schema correctly reflects all fields; relations resolve cleanly; foreign keys enforce referential integrity; Step 4 fails with a unique constraint violation (Prisma error `P2002`), proving that duplicate revision numbers are strictly prevented at the database layer.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-02: Tickets with Zero, One, and Multiple Actions Taken & Dashboard Metric States
  * **Related Requirements:** spec §7.1, spec §9.3, FR-23, AC-20
  * **Related API/UI:** Prisma Client / Seed Verification
  * **Test Objective:** Verify database schema supports tickets with 0, 1, and many Actions Taken without constraint violations, and verifies seed fixtures provide both zero and nonzero dashboard metric scenarios.
  * **Preconditions / Test Data:** Seeded `TKT-1002` and `TKT-1003` have 0 Actions Taken, `TKT-1004` has 1 Action Taken, and `TKT-1001` has multiple Actions Taken (per specification.md §9.3). Accounts `req_empty` and `tech_empty` provide zero-metric scenarios.
  * **Steps:**
    1. Query `TKT-1002` and `TKT-1003` with `include: { actionsTaken: true }` -> assert `actionsTaken` is empty array `[]`.
    2. Query `TKT-1004` -> assert `actionsTaken.length === 1`.
    3. Query `TKT-1001` -> assert `actionsTaken.length >= 2`.
    4. Query dashboard metrics for `req_empty` and `tech_empty` -> assert all counts return `0` and recent lists are empty `[]`.
    5. Query dashboard metrics for standard users -> assert nonzero metrics matching fixture distribution.
  * **Expected Result:** The seeded database explicitly demonstrates zero, one, and multiple Actions Taken per Ticket; all relations query successfully; both zero and nonzero dashboard metric scenarios are verified.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-03: Deletion Integrity Policy — Ticket Deletion Blocked (`onDelete: Restrict`)
  * **Related Requirements:** BR-05, spec §7.1, spec §9.1, AC-14
  * **Related API/UI:** Prisma Client / PostgreSQL Foreign Key
  * **Test Objective:** Verify that deleting a Ticket with associated Actions Taken is blocked by the database (`onDelete: Restrict`), preventing silent audit erasure.
  * **Preconditions / Test Data:** Ticket with at least 1 Action Taken.
  * **Steps:**
    1. Attempt to execute `prisma.ticket.delete({ where: { id: ticketIdWithActions } })`.
  * **Expected Result:** Operation throws Prisma foreign key restriction error (`P2003` / foreign key constraint violation); ticket and action records remain untouched.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-04: Deletion Integrity Policy — User Deletion Blocked (`onDelete: Restrict`)
  * **Related Requirements:** BR-05, spec §7.1, spec §9.1
  * **Related API/UI:** Prisma Client / PostgreSQL Foreign Key
  * **Test Objective:** Verify that deleting a User who has performed Actions Taken is blocked by the database (`onDelete: Restrict`), preserving technician attribution.
  * **Preconditions / Test Data:** User who has at least 1 recorded Action Taken.
  * **Steps:**
    1. Attempt `prisma.user.delete({ where: { id: userIdWithActions } })`.
  * **Expected Result:** Operation throws Prisma foreign key restriction error; user and action records remain intact.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-05: Non-Destructive Migration Verification (Seeded Tickets Intact)
  * **Related Requirements:** FR-18, AC-14, spec §9.2
  * **Related API/UI:** Database verification script
  * **Test Objective:** Verify that applying the Lab 4 migration preserves all pre-existing Lab 1–3 seeded tickets (`TKT-1001` through `TKT-1004`), requesters, categories, and related systems.
  * **Preconditions / Test Data:** A fresh isolated clone of a populated, **not-yet-migrated** Lab 1–3 database and a recorded pre-migration baseline (row counts plus stable key-field snapshots) for `User`, `Ticket`, `Category`, `RelatedSystem`, `Attachment`, `PublicComment`, and `InternalNote`. Do not reuse a database already migrated by another test case.
  * **Steps:**
    1. Record pre-migration row counts and representative key fields for every listed legacy entity, including attachment `id`, `ticketId`, `originalName`, `storedName`, `mimeType`, and `isRemoved`.
    2. Apply the additive Lab 4 migration.
    3. Re-query the same entities and compare counts, IDs, foreign keys, and captured key fields with the pre-migration baseline.
    4. Query `TKT-1001` through `TKT-1004` with their requester, category, and related-system relations.
  * **Expected Result:** All legacy rows and captured relationships/metadata remain intact; all four seeded tickets and their required relations remain queryable. No legacy row is silently dropped or altered.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-06: Attachment Preservation Verification with Pre-Seeded Attachment Records
  * **Related Requirements:** FR-18, AC-14, spec §9.2
  * **Related API/UI:** Database verification script
  * **Test Objective:** Verify that real pre-migration Attachment records and their referenced binary files remain intact after the Lab 4 migration. A schema-only join check that passes when no Attachment rows exist, or metadata-only verification that ignores the stored file, does NOT satisfy this test.
  * **Preconditions / Test Data:** A fresh isolated clone of a populated, **not-yet-migrated** Lab 1–3 database. A fixture must create at least one active (`isRemoved = false`) `Attachment` linked to `TKT-1001` **before** the migration is applied, with its actual binary file stored through the application's configured attachment storage. Record `id`, `originalName`, `storedName`, `mimeType`, `ticketId`, `isRemoved`, and the file's SHA-256 checksum as the pre-migration baseline.
  * **Steps:**
    1. Apply the Lab 4 migration to the database containing the pre-existing Attachment fixture. Do **not** create or seed a replacement Attachment after migration if the baseline record is missing; missing baseline data is a test failure.
    2. Query `prisma.attachment.findMany({ where: { ticketId: tkt1001Id } })`.
    3. Assert that `id`, `originalName`, `storedName`, `mimeType`, `ticketId`, and `isRemoved` match the pre-migration baseline values.
    4. Resolve the stored file using the application's configured attachment-storage mechanism; assert the file exists and its SHA-256 checksum matches the pre-migration baseline.
    5. Download the attachment through the existing `GET /api/attachments/:id/download` route and assert the returned bytes match the original checksum.
    6. Query `prisma.ticket.findUnique({ where: { ticketNumber: 'TKT-1001' }, include: { attachments: true } })` and assert `attachments` array is non-empty and contains the expected record.
  * **Expected Result:** The original Attachment row and physical file remain present; all metadata and the binary SHA-256 checksum match the pre-migration baseline, and the existing download route returns the original bytes.
  * **Test Level:** Integration / Database
  * **Priority:** High

  #### TC-DB-07: Idempotent Seed Execution
  * **Related Requirements:** FR-18, spec §9.3
  * **Related API/UI:** `server/prisma/seed.ts`
  * **Test Objective:** Verify that running the seed command multiple times executes safely without creating duplicate users, categories, or actions taken.
  * **Preconditions / Test Data:** Clean or already-seeded database.
  * **Steps:**
    1. Execute `npm --prefix server run prisma:seed`.
    2. Record counts of `User`, `Ticket`, `Category`, `RelatedSystem`, `ActionTaken`.
    3. Execute `npm --prefix server run prisma:seed` a second time.
    4. Compare counts.
  * **Expected Result:** Seed exits with code 0; record counts before and after the second run are identical.
  * **Test Level:** Integration / Scripts
  * **Priority:** High

  #### TC-DB-08: Migration Failure & Backup Snapshot Recovery Verification
  * **Related Requirements:** FR-18, spec §9.2, Handout §7
  * **Related API/UI:** Database backup & restore scripts
  * **Test Objective:** Verify both (a) a failed migration leaves no unintended partial schema/data changes in a disposable clone and (b) a pre-migration snapshot can restore Lab 1–3 data into an **isolated, disposable recovery database**. A deliberately failing migration and any `pg_restore --clean` operation must run only against disposable test databases, never the active development database.
  * **Preconditions / Test Data:** Pre-migration database populated with standard Lab 1–3 seeded users, tickets, comments, internal notes, and at least one active Attachment with its physical file (per TC-DB-06 baseline). Record row counts, key fields, and attachment SHA-256 checksums before taking backups.
  * **Steps:**
    1. Create a pre-migration database snapshot dump using the binary-safe `-f` flag (NOT shell redirection `>` which is unreliable in PowerShell for binary formats):
       ```powershell
       pg_dump -U postgres -d toktikit_dev -F c -b -v -f backup_pre_lab4.dump
       ```
    1a. Separately archive the configured attachment-storage directory (`uploads/lab-02`, as defined in `server/src/middlewares/upload.ts`):
       ```powershell
       $AttachmentStorageParent = "."
       $AttachmentStorageDirectory = "uploads/lab-02"
       tar -czf backup_pre_lab4_attachments.tar.gz -C $AttachmentStorageParent $AttachmentStorageDirectory
       ```
    2. Create a disposable migration-failure database and restore the snapshot into it:
       ```powershell
       createdb -U postgres toktikit_migration_failure_test
       pg_restore -U postgres -d toktikit_migration_failure_test --clean --if-exists -v backup_pre_lab4.dump
       ```
    3. In that disposable database only, execute a controlled test-only Prisma migration through the same migration runner used for Lab 4. The test migration must explicitly wrap its DDL in a transaction, create a temporary object, and then deliberately violate a constraint. Do not edit or run a deliberately failing version of the real Lab 4 migration.
    4. Verify the failed migration rolled back atomically: the temporary object is absent, the original schema and baseline rows are unchanged, and the database remains usable.
    5. Create a separate isolated recovery database and restore the original snapshot:
       ```powershell
       createdb -U postgres toktikit_recovery_test
       pg_restore -U postgres -d toktikit_recovery_test --clean --if-exists -v backup_pre_lab4.dump
       ```
    6. Restore the attachment archive into a separate isolated recovery storage location configured for the recovery test; do not overwrite the active application's storage.
    7. Verify recovery database state: run queries asserting all seeded tickets (`TKT-1001`–`TKT-1004`), users, categories, related systems, comments, internal notes, and attachments match the pre-migration baseline row counts and key field values. Verify the restored attachment file SHA-256 checksums match the pre-migration baseline.
    8. Drop both disposable databases after verification:
       ```powershell
       dropdb -U postgres toktikit_migration_failure_test
       dropdb -U postgres toktikit_recovery_test
       ```

  * **Expected Result:** The controlled migration failure leaves no partial schema/data changes in the disposable failure database; restoration completes cleanly in the isolated recovery database; all Lab 1–3 schema tables and data rows are intact against the pre-migration baseline; the active `toktikit_dev` development database is unaffected.
  * **Test Level:** Integration / Database / Recovery
  * **Priority:** High
  * **Test Execution Status:** **Test Designed — Execution Pending Evidence** *(This test case is fully designed and documented. It must NOT be marked as passed until actual execution logs and database integrity assertions have been recorded and reviewed.)*

  ---

  ### 3.7 UI Behavior, Responsive Layout, & Accessibility Tests

  #### TC-UI-01: Navigation Shell Links by Role (`AppLayout.tsx`)
  * **Related Requirements:** ui-spec §1.2
  * **Related API/UI:** `client/src/components/AppLayout.tsx`
  * **Test Objective:** Verify navigation links render conditionally based on the authenticated user's role.
  * **Preconditions / Test Data:** Render `AppLayout` wrapped in `AuthProvider`.
  * **Steps:**
    1. Mount with `REQUESTER` role: assert visible links are "Dashboard" (`/requester-dashboard`), "My Tickets" (`/my-tickets`), "Create Ticket" (`/create-ticket`). Assert "Ticket Queue" and "User Management" are NOT rendered.
    2. Mount with `IT_STAFF` role: assert visible links are "Dashboard" (`/staff-dashboard`), "Ticket Queue" (`/staff-queue`). Assert "My Tickets" and "User Management" are NOT rendered.
    3. Mount with `ADMIN` role: assert visible links are "Staff Dashboard", "Ticket Queue", "User Management".
  * **Expected Result:** Navigation items strictly reflect role permissions defined in `ui-spec §1.2`.
  * **Test Level:** Component
  * **Priority:** High

  #### TC-UI-02: Requester Dashboard Responsive Layout & Token Rendering
  * **Related Requirements:** ui-spec §2.1, ui-spec §7
  * **Related API/UI:** `client/src/pages/RequesterDashboard.tsx`
  * **Test Objective:** Verify Requester Dashboard renders 4 KPI cards using Zen Green tokens and adapts to responsive viewports.
  * **Preconditions / Test Data:** Mock API response with sample counts.
  * **Steps:**
    1. Test Desktop viewport (1280px): assert cards render in a 4-column row (`col-md-3`).
    2. Test Mobile viewport (390px): assert cards stack vertically.
    3. Verify color tokens: background `#EAF6EF`, count color `#006B3C` (Zen Green).
  * **Expected Result:** Cards render accurately across all viewports; CSS tokens match specification.
  * **Test Level:** Component / E2E
  * **Priority:** Medium

  #### TC-UI-03: IT Staff Dashboard Responsive Layout & Status Breakdown Grid
  * **Related Requirements:** ui-spec §2.2, ui-spec §7
  * **Related API/UI:** `client/src/pages/StaffDashboard.tsx`
  * **Test Objective:** Verify Staff Dashboard renders 4 primary KPI cards and 9 status breakdown badges in responsive grid.
  * **Preconditions / Test Data:** Mock API response with 9 status counts.
  * **Steps:**
    1. Render component; assert 4 operational cards present.
    2. Assert status breakdown grid renders all 8 standard status badges plus `REJECTED`.
  * **Expected Result:** All metric cards and status badges render with correct numeric labels.
  * **Test Level:** Component
  * **Priority:** High

  #### TC-UI-04: Requester Ticket Detail "Service Actions" Read-Only Tab
  * **Related Requirements:** FR-06, BR-03, AC-05, ui-spec §3.1
  * **Related API/UI:** `client/src/pages/RequesterTicketDetail.tsx`
  * **Test Objective:** Verify that Requesters can see Actions Taken in the "Service Actions" tab but have no buttons or controls to add, edit, or delete actions.
  * **Preconditions / Test Data:** Ticket has 2 Actions Taken; authenticated as Requester owner.
  * **Steps:**
    1. Render `RequesterTicketDetail` with mock ticket and actions.
    2. Switch to "Service Actions" tab.
    3. Query DOM for "Add Action Taken", "Edit", or "Delete" buttons.
  * **Expected Result:** Actions Taken list is visible; zero creation or modification controls exist in the DOM.
  * **Test Level:** Component
  * **Priority:** High

  #### TC-UI-05: Staff Ticket Detail Actions Taken Panel & Add Modal
  * **Related Requirements:** FR-01, FR-03, FR-21, FR-25, BR-01, BR-02, BR-04, BR-14, AC-01, AC-17, AC-19, ui-spec §3.2.4
  * **Related API/UI:** `client/src/pages/StaffTicketDetail.tsx`
  * **Test Objective:** Verify that IT Staff can open the "Add Action Taken" modal, select an eligible active assignee, enter fields, observe performer attribution, and submit with in-flight button disablement and state retention on failure.
  * **Preconditions / Test Data:** Staff ticket detail rendered as IT Staff; active staff users available in mock.
  * **Steps:**
    1. Click `[+ Add Action Taken]` button.
    2. Assert modal opens with fields: Description, Result, Follow-Up Required checkbox, Follow-Up Note (disabled until checked), Attachment Notes, and Assigned To dropdown (`assignedToId`). Assert "Performed By" shows current user as a read-only note.
    3. Verify Assigned To dropdown is populated with active IT Staff and Admin users.
    4. Check "Follow-Up Required": assert Follow-Up Note becomes enabled and marked required.
    5. Select an active technician from Assigned To dropdown.
    6. Click "Record Action": assert submit button is disabled with loading spinner while in-flight.
    7. Mock API error (HTTP 400 `INACTIVE_ASSIGNEE`): assert modal stays open, error alert displays, and all entered form data is preserved in React state.
  * **Expected Result:** Modal functions reactively; validation prevents submission without follow-up note when checked; selects active assignee; preserves form state on failure; submits clean payload.
  * **Test Level:** Component
  * **Priority:** High

  #### TC-UI-06: Staff Ticket Detail Edit Action Taken Form
  * **Related Requirements:** FR-04, FR-21, FR-25, BR-01, BR-02, BR-04, AC-04, AC-17, AC-19, ui-spec §3.2.5
  * **Related API/UI:** `client/src/pages/StaffTicketDetail.tsx`
  * **Test Objective:** Verify editing of an existing Action Taken record by IT Staff, including reassigning to another active technician, immutable performer display, and form resilience.
  * **Preconditions / Test Data:** Staff ticket detail with 1 existing Action Taken.
  * **Steps:**
    1. Click "Edit" button on the action card.
    2. Assert modal pre-populates with existing data, original `performedBy` displayed as read-only.
    3. Modify Description, reassign Assigned To to a different active technician, and clear Follow-Up flag.
    4. Save changes.
  * **Expected Result:** Calls `PATCH /api/actions-taken/:actionId` with updated fields; preserves form data if error occurs; updates action card display with new assignee and description on success.
  * **Test Level:** Component
  * **Priority:** High

  #### TC-UI-07: Touch Targets & Accessibility Check
  * **Related Requirements:** ui-spec §6.2, ui-spec §6.3
  * **Related API/UI:** All Lab 4 screens
  * **Test Objective:** Verify that interactive elements (buttons, KPI cards, form inputs) meet minimum touch target size ($\ge 44 \times 44\text{px}$) and have accessible labels.
  * **Preconditions / Test Data:** Playwright E2E browser session on Mobile Safari.
  * **Steps:**
    1. Measure bounding boxes of dashboard cards, tab links, and action buttons.
    2. Check `<label>` association with form inputs in the Action Taken modal.
  * **Expected Result:** Interactive touch targets $\ge 44\text{px}$; inputs have associated `aria-label` or `<label htmlFor="...">`.
  * **Test Level:** Component / E2E
  * **Priority:** Medium

  #### TC-UI-08: Client Error Handling & Loading States
  * **Related Requirements:** ui-spec §2.1.4, ui-spec §2.2.4
  * **Related API/UI:** `RequesterDashboard`, `StaffDashboard`
  * **Test Objective:** Verify that network latency displays a Zen Green loading skeleton/spinner, and server 500 error displays a graceful error alert card.
  * **Preconditions / Test Data:** API mock configured to reject with network error.
  * **Steps:**
    1. Mount dashboard while request is pending -> assert loading indicator is visible.
    2. Settle request with 500 Internal Server Error -> assert error card with retry button appears.
  * **Expected Result:** No blank screens or unhandled promise rejections; graceful UX feedback.
  * **Test Level:** Component
  * **Priority:** Medium

  ---

  ### 3.8 Lab 1–3 Regression Test Scenarios

  #### TC-REG-01: Health & Categories API (Lab 1)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `GET /api/health`, `GET /api/categories`
  * **Test Objective:** Verify Lab 1 health and category endpoints remain operational.
  * **Steps:** Run `server/tests/lab-01/health.test.ts` and `categories.test.ts`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-02: Ticket Creation & Related Systems (Lab 2)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `POST /api/tickets`, `GET /api/related-systems`
  * **Test Objective:** Verify ticket creation and auto-generated ticket numbers continue functioning.
  * **Steps:** Run `server/tests/lab-02/create-ticket.api.test.ts`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-03: Attachments Upload, Download, & Soft-Remove (Lab 2)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `/api/tickets/:id/attachments`, `/api/attachments/:id/*`
  * **Test Objective:** Verify attachment upload, download, and soft-delete remain functional and unregressed.
  * **Steps:** Run `server/tests/lab-02/attachments.api.test.ts` and `client/tests/lab-02/AttachmentSection.test.tsx`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-04: Authentication, Sessions, & Password Change (Lab 3)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `/api/auth/*`
  * **Test Objective:** Verify login, session cookie issuance, logout, profile fetch, and password change enforcement.
  * **Steps:** Run `server/tests/lab-03/auth.api.test.ts` and `client/tests/lab-03/Login.test.tsx`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-05: Staff Queue Operations (Lab 3)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `/api/staff/tickets`, `/claim`, `/assign`, `/priority`
  * **Test Objective:** Verify queue listing, filtering, ownership claim, assignment, and priority update.
  * **Steps:** Run `server/tests/lab-03/staff-queue.api.test.ts` and `staff-ticket-detail.api.test.ts`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-06: Comments & Internal Notes (Lab 3)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `/api/tickets/:id/comments`, `/api/tickets/:id/internal-notes`
  * **Test Objective:** Verify public comments visible to requester, internal notes restricted to IT Staff/Admin.
  * **Steps:** Run `server/tests/lab-03/comments-notes.api.test.ts`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-07: User Administration (Lab 3)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** `/api/admin/users/*`
  * **Test Objective:** Verify Admin CRUD on users, password reset, and last-admin protection.
  * **Steps:** Run `server/tests/lab-03/users-admin.api.test.ts` and `client/tests/lab-03/UserManagement.test.tsx`.
  * **Expected Result:** 100% passing tests.
  * **Test Level:** API / Regression
  * **Priority:** High

  #### TC-REG-08: Full E2E Workflow Regression (Lab 2 & Lab 3)
  * **Related Requirements:** FR-19, AC-16
  * **Related API/UI:** Playwright E2E suites
  * **Test Objective:** Verify full end-to-end requester and staff workflows in actual browser sessions.
  * **Steps:** Run `npx playwright test e2e/lab-02` and `npx playwright test e2e/lab-03`.
  * **Expected Result:** All specs pass without timing out or breaking assertions.
  * **Test Level:** E2E / Regression
  * **Priority:** High

  #### TC-REG-09: Explicit Legacy vs New API Error Contract Regression Assertions
  * **Related Requirements:** FR-19, BR-17, AC-16, api-spec §1.2
  * **Related API/UI:** Preserved Lab 1–3 endpoints vs New Sprint 4 endpoints
  * **Test Objective:** Verify that legacy endpoints from Labs 1–3 strictly maintain their original response bodies (both success and error formats) and HTTP status codes without globally replacing legacy error payloads, while new Sprint 4 endpoints strictly implement the nested `{ "error": { "code", "message" } }` contract.
  * **Preconditions / Test Data:** Populated database; test sessions for Requester and IT Staff.
  * **Steps:**
    1. **Legacy Endpoint Success Check:** Issue `GET /api/categories` -> assert 200 OK with legacy JSON array shape. Issue `PATCH /api/staff/tickets/:id/claim` -> assert 200 OK with legacy ticket response envelope.
    2. **Legacy Endpoint Error Check:** Issue `POST /api/auth/login` with invalid credentials -> assert HTTP 401 and legacy flat body `{ "error": "Invalid email or password" }` (verifying legacy endpoints were NOT refactored to nested code format). Issue `POST /api/tickets` with empty title -> assert HTTP 400 with legacy validation error shape.
    3. **New Sprint 4 Endpoint Error Check:** Issue `POST /api/tickets/:id/actions-taken` with invalid assignee -> assert HTTP 400 and nested `{ "error": { "code": "INACTIVE_ASSIGNEE", "message": "Assigned user is inactive." } }`.
    4. **New Resolution Gate Error Check:** Issue `PATCH /api/staff/tickets/:id/status` to `RESOLVED` on a ticket with 0 actions -> assert HTTP 400 and nested `{ "error": { "code": "ACTION_TAKEN_REQUIRED", "message": "At least one Action Taken is required." } }`.
  * **Expected Result:** Legacy API success and error contracts are 100% preserved; no global error middleware overrides existing endpoints; new endpoints strictly adhere to the nested error schema.
  * **Test Level:** API / Regression / Architecture
  * **Priority:** Critical

  ---

  ### 3.9 UI Style & Design System Tests

  #### TC-STY-01: Zen Green Design System Tokens & Typography Check
  * **Related Requirements:** ui-spec §7.1, ui-spec §7.2, ui-spec §7.3
  * **Related API/UI:** `client/src/index.css`, Dashboard & Ticket Components
  * **Test Objective:** Verify that new Sprint 4 UI components (metric cards, status breakdown pills, action cards, modal forms) strictly consume the Zen Green design system tokens and approved typography hierarchy.
  * **Preconditions / Test Data:** Render `StaffDashboard` and `StaffTicketDetail` in browser DOM.
  * **Steps:**
    1. Inspect computed CSS styles of `.metric-card`: verify background color evaluates to `var(--color-pale-green)` (`#EAF6EF`), border matches `#BCE3CE`, count text matches `var(--color-primary)` (`#006B3C`), and font size is `48px` bold.
    2. Inspect Action Taken card: verify `border-left` matches `4px solid var(--color-secondary)` (`#2D6A4F`) and background matches `var(--color-surface)`.
    3. Inspect Follow-Up badge: verify amber styling (`background: #FEF3C7; color: #B45309`) when required, green styling (`background: #EAF6EF; color: #006B3C`) when no follow-up required.
  * **Expected Result:** All Lab 4 UI components strictly adhere to the Zen Green design system palette without arbitrary or ad-hoc color overrides.
  * **Test Level:** UI Style / Component
  * **Priority:** Medium

  #### TC-STY-02: Visual Interactive States & Accessible Focus Rings
  * **Related Requirements:** ui-spec §5.5, ui-spec §7.2
  * **Related API/UI:** All interactive Dashboard and Action Taken controls
  * **Test Objective:** Verify that interactive KPI cards, status breakdown badges, and action buttons present clear visual hover elevation and visible keyboard focus rings conforming to accessibility standards.
  * **Preconditions / Test Data:** Render `StaffDashboard` and `StaffTicketDetail` in browser.
  * **Steps:**
    1. Trigger hover state on `.metric-card`: verify `box-shadow` elevates to `0 4px 16px rgba(0, 107, 60, 0.12)`.
    2. Focus interactive KPI cards via keyboard `Tab` navigation: verify prominent outline indicator (`outline: 2px solid var(--color-primary); outline-offset: 2px`).
    3. Trigger hover and focus on status breakdown badges and modal action buttons.
  * **Expected Result:** Every interactive element has distinct, visually clear hover and keyboard focus indicators for accessibility compliance.
  * **Test Level:** UI Style / Accessibility
  * **Priority:** Medium

  #### TC-STY-03: Color Contrast & Accessible Visual Presentation
  * **Related Requirements:** ui-spec §5.7
  * **Related API/UI:** Dashboard KPI labels, status badges, form alerts
  * **Test Objective:** Verify that all text presentations and status badges meet WCAG AA contrast ratio requirements ($\ge 4.5:1$ for regular text, $\ge 3:1$ for large text) across normal, hover, and error states.
  * **Preconditions / Test Data:** Rendered screens in Playwright / axe-core test fixture.
  * **Steps:**
    1. Run automated contrast evaluation on:
       * Primary KPI card count (`#006B3C` on `#EAF6EF` -> contrast ratio $> 4.5:1$).
       * Follow-up warning pill (`#B45309` on `#FEF3C7` -> contrast ratio $> 4.5:1$).
       * Form error banner and inline error text (`#D32F2F` on `#FDF2F2` -> contrast ratio $> 4.5:1$).
       * Card captions and performer attribution (`#6B7280` on `#FFFFFF` -> contrast ratio $> 4.5:1$).
  * **Expected Result:** 0 color-contrast accessibility violations reported.
  * **Test Level:** UI Style / Accessibility
  * **Priority:** Medium

  ---

  ### 3.10 Performance-Smoke Tests

  #### TC-PRF-01: Dashboard Endpoints Latency Smoke Benchmark
  * **Related Requirements:** FR-13, FR-14, FR-17, BR-12, spec §10.2
  * **Related API/UI:** `GET /api/dashboard/requester`, `GET /api/dashboard/staff`
  * **Test Objective:** Verify that backend dashboard aggregation queries execute efficiently and respond within proposed reasonable smoke baselines ($\le 300\text{ms}$) under standard local database conditions.
  * **Preconditions / Test Data:** Database populated with seeded tickets and actions.
  * **Steps:**
    1. Send 10 consecutive requests to `GET /api/dashboard/requester` with valid requester session.
    2. Send 10 consecutive requests to `GET /api/dashboard/staff` with valid staff session.
    3. Record response times (excluding initial cold-start connection setup).
  * **Expected Result:** Mean and 95th percentile response times are $\le 300\text{ms}$. Zero slow-query bottlenecks or N+1 subqueries detected.
  * **Test Level:** Performance-Smoke / API
  * **Priority:** Medium

  #### TC-PRF-02: Actions Taken Subsystem Query Latency Smoke Benchmark
  * **Related Requirements:** FR-01, FR-04, FR-06, spec §10.2
  * **Related API/UI:** `GET /api/tickets/:id/actions-taken`, `POST /api/tickets/:id/actions-taken`
  * **Test Objective:** Verify that retrieving and recording Actions Taken execute within proposed reasonable smoke baselines ($\le 200\text{ms}$).
  * **Preconditions / Test Data:** Seeded ticket `TKT-1001` with multiple Actions Taken.
  * **Steps:**
    1. Issue `GET /api/tickets/:id/actions-taken`.
    2. Issue `POST /api/tickets/:id/actions-taken` with standard payload.
    3. Measure elapsed round-trip time.
  * **Expected Result:** Response latency $\le 200\text{ms}$. Database foreign-key lookups utilize indexes on `ticketId` and `actionDateTime`.
  * **Test Level:** Performance-Smoke / API
  * **Priority:** Medium

  #### TC-PRF-03: Status Transition and Concurrency Execution Latency Smoke
  * **Related Requirements:** FR-08, BR-14, AC-15, spec §10.2
  * **Related API/UI:** `PATCH /api/staff/tickets/:id/status`
  * **Test Objective:** Verify that status transitions, including the Resolution Gate check and automated `InternalNote` generation, execute within the documented performance-smoke baseline ($\le 250\text{ms}$).
  * **Preconditions / Test Data:** Active ticket with 1 Action Taken.
  * **Steps:**
    1. Issue `PATCH /api/staff/tickets/:id/status` to `RESOLVED`.
    2. Measure duration of transaction (status update + note creation).
  * **Expected Result:** Execution latency $\le 250\text{ms}$. Transaction commits cleanly without lock contention.
  * **Test Level:** Performance-Smoke / API
  * **Priority:** Medium

  ---

  ## 4. Role and Authorization Test Matrix

  The following matrix defines the expected HTTP response code across all user roles for each new and impacted endpoint. Backend authorization is enforced independently of UI visibility.

  | Endpoint | HTTP Method | Unauthenticated | Requester (Ticket Owner) | Requester (Non-Owner) | IT Staff | Administrator | Traceability |
  |---|---|:---:|:---:|:---:|:---:|:---:|---|
  | `/api/dashboard/requester` | `GET` | 401 | **200 (Own data)** | N/A (Session scoped) | 403 | 403 | FR-13, BR-13, AC-10 |
  | `/api/dashboard/staff` | `GET` | 401 | 403 | 403 | **200** | **200** | FR-14, BR-12, AC-12 |
  | `/api/tickets/:id/actions-taken` | `GET` | 401 | **200** | **404 (Non-enumeration)** | **200** | **200** | FR-06, BR-03, BR-15, AC-05 |
  | `/api/tickets/:id/actions-taken` | `POST` | 401 | 403 | 403 | **201** | **201** | FR-01, FR-02, FR-21, BR-01, BR-02, AC-01, AC-02, AC-17 |
  | `/api/actions-taken/:actionId` | `PATCH` | 401 | 403 | 403 | **200** | **200** | FR-04, FR-21, BR-01, AC-04, AC-17 |
  | `/api/actions-taken/:actionId` | `DELETE` (route absent) | 404 / 405 | 404 / 405 | 404 / 405 | 404 / 405 | 404 / 405 | BR-05, Decision 13.1.1 |
  | `/api/staff/tickets/:id/status` | `PATCH` | 401 | 403 | 403 | **200** | **200** | FR-08, FR-09, FR-10, BR-10, AC-07, AC-08, AC-18 |
  | `/api/tickets/:id/indicate-resolved`| `POST` | 401 | **200/201** | 404 (Non-enumeration) | 403 | 403 | BR-11 |

  ### Key Authorization Verification Rules
  1. **Requester Non-Enumeration:** When a Requester requests `/api/tickets/:id/actions-taken` for a ticket ID that exists but belongs to a different user, the server must return **HTTP 404 Not Found** (not 403), preventing malicious enumeration of other users' tickets (`BR-15`).
  2. **Technician Identity Derivation:** On `POST /api/tickets/:id/actions-taken`, the server extracts `performedById` strictly from `req.user.id`. Any value sent by the client is stripped or overwritten (`BR-02`, `AC-03`).
  3. **Assignee Role & Active Status Validation:** On `POST` and `PATCH`, if `assignedToId` is provided, the server verifies that the referenced user is active (`isActive: true`) and possesses role `IT_STAFF` or `ADMIN`. Inactive assignees return `400 INACTIVE_ASSIGNEE`; unauthorized roles return `400 INVALID_ASSIGNEE_ROLE` (`FR-21`, `BR-01`, `AC-17`).
  4. **Backend Resolution Gate Enforcement:** The backend must enforce the approved resolution rule even when called directly. The approved project rule rejects `RESOLVED` with `400 ACTION_TAKEN_REQUIRED` when the ticket has 0 Actions Taken (`FR-22`, `BR-10`, `AC-18`).
  5. **Collaborative IT Staff Capability:** IT Staff members can create and update Actions Taken on any ticket regardless of who is designated as `ticket.ownerId` (`BR-01`, `AC-06`).
  6. **Admin Equivalence & Dashboard Scope:** Administrators inherit all operational capabilities of IT Staff, including recording/updating actions and executing status transitions. Administrators access `/api/dashboard/staff` with full visibility and an Admin governance banner (`BR-16`, `FR-14`, `FR-16`).

  ---

  ## 5. Dashboard Test Matrix

  ### 5.1 Metric Definitions & Backend Calculation Verification

  | Dashboard | Metric Field | Backend Query Definition | Status & Filter Scope | Edge Cases to Test |
  |---|---|---|---|---|
  | **Requester** | `totalTickets` | `COUNT(*)` where `requesterId = user.id` | All statuses (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, `REJECTED`) | Empty dataset (0); user with only cancelled/rejected tickets. Clean account `req_empty` returns 0. |
  | **Requester** | `activeTickets` | `COUNT(*)` where `requesterId = user.id AND currentStatus IN ('NEW', 'OPEN', 'IN_PROGRESS')` | `NEW, OPEN, IN_PROGRESS` | Excludes `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `CANCELLED`, `REJECTED`. |
  | **Requester** | `waitingForRequesterTickets` | `COUNT(*)` where `requesterId = user.id AND currentStatus = 'WAITING_FOR_REQUESTER'` | `WAITING_FOR_REQUESTER` | Exactly 1 status matched. |
  | **Requester** | `resolvedOrClosedTickets` | `COUNT(*)` where `requesterId = user.id AND currentStatus IN ('RESOLVED', 'CLOSED')` | `RESOLVED, CLOSED` | Excludes `CANCELLED` and `REJECTED`. |
  | **Requester** | `recentTickets` | `SELECT` top 5 tickets where `requesterId = user.id` order by `updatedAt DESC` | All tickets belonging to requester | Capped at 5 items (`AC-20`). Returns `[]` on clean account `req_empty` (`TC-DASH-REQ-09`). |
  | **IT Staff** | `unassignedTickets` | `COUNT(*)` where `ownerId IS NULL AND currentStatus IN ('NEW', 'OPEN')` | `ownerId IS NULL`, `NEW, OPEN` | Tickets in `IN_PROGRESS` without owner (invalid state) excluded; assigned tickets excluded. |
  | **IT Staff** | `myActiveTickets` | `COUNT(*)` where `ownerId = user.id AND currentStatus IN ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED')` | `ownerId = user.id`, active statuses | Excludes `RESOLVED`, `CLOSED`, `CANCELLED`, `REJECTED`. Clean technician `tech_empty` returns 0. |
  | **IT Staff** | `ticketsRequiringFollowUp` | `COUNT(DISTINCT t.id)` from `Ticket t JOIN ActionTaken a ON t.id = a.ticketId` where `a.followUpRequired = true AND t.currentStatus NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')` | Distinct active tickets with unresolved follow-ups | Single ticket with 3 follow-up actions counted **exactly ONCE**; follow-up on resolved ticket **NOT counted**. |
  | **IT Staff** | `criticalOrHighPriorityTickets`| `COUNT(*)` where `itPriority IN ('CRITICAL', 'HIGH') AND currentStatus NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')` | Active unresolved, `CRITICAL, HIGH` | Excludes closed/resolved critical tickets. |
  | **IT Staff** | `statusBreakdown` | `COUNT(*)` grouped by `currentStatus` | All 8 standard statuses + `REJECTED` | Sum of all breakdown values must equal total tickets in system. |
  | **IT Staff** | `recentTickets` | `SELECT` top 5 queue tickets order by `updatedAt DESC` | Global queue active tickets | Capped at 5 items (`AC-20`). **Sorting is recency-only (`updatedAt DESC`); NOT priority urgency.** Per spec §8.2 and api-spec §3.2, both specify `updatedAt DESC`. Clean database returns `[]`. |
  | **IT Staff** | `currentUserActions` | `SELECT` top 5 actions where `performedById = user.id OR assignedToId = user.id` order by `actionDateTime DESC` | Current technician service actions | Capped at 5 items (`AC-20`). Clean technician `tech_empty` returns `[]` (`TC-DASH-STF-13`). |

  ### 5.2 Drill-Down Routing & Filter Requirements Matrix

  | Dashboard | Clicked Card | Target Route | Intended Query Filters | Required Extension / Known Implementation Gap |
  |---|---|---|---|---|
  | **Requester** | Total Tickets | `/my-tickets` | None (all filters reset) | Standard behavior |
  | **Requester** | Active Tickets | `/my-tickets` | `?status=NEW,OPEN,IN_PROGRESS` | **New requirement:** `TicketFilters.status` in `MyTickets.tsx` and `GET /api/tickets` must support comma-separated multi-value status strings (`UI-Q7`). |
  | **Requester** | Waiting for Me | `/my-tickets` | `?status=WAITING_FOR_REQUESTER` | Existing single-status filter compatible. |
  | **Requester** | Resolved / Closed | `/my-tickets` | `?status=RESOLVED,CLOSED` | **New requirement:** Multi-value status string support required (`UI-Q7`). |
  | **IT Staff** | Unassigned Tickets | `/staff-queue` | `?ownerId=unassigned&status=NEW,OPEN` | **New requirement:** `ownerId=unassigned` parameter and multi-status support in staff queue (`UI-Q8`). |
  | **IT Staff** | My Active Tickets | `/staff-queue` | `?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` | **New requirement:** Backend `GET /api/staff/tickets` must resolve `ownerId=me` to session user ID and apply the active-status filter (`UI-Q8`). |
  | **IT Staff** | Follow-Up Required | `/staff-queue` | `?followUpRequired=true&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` | **New requirement:** Filter by unresolved tickets having at least one follow-up action (`UI-Q8`). |
  | **IT Staff** | Critical / High Priority | `/staff-queue` | `?itPriority=CRITICAL,HIGH&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` | **New requirement:** Multi-value IT priority and status filter support (`UI-Q8`). |
  | **IT Staff** | Status Breakdown Badge | `/staff-queue` | `?status=<STATUS>` | Existing single-status filter compatible (including `REJECTED`). |

  ---

  ## 6. Database, Migration, and Seed Tests

  ### 6.1 Database Verification Strategy
  Database tests must be verifiable against live schema constraints and query handlers. Data preservation claims must be backed by concrete assertions.

  | Test Item | Verification Method | Asserted Invariants |
  |---|---|---|
  | **Additive Migration** | Inspect Prisma migration SQL (`migrations/*_add_actions_taken/migration.sql`) | Strictly `CREATE TABLE "ActionTaken"` and `CREATE INDEX`. No `DROP TABLE`, `ALTER TABLE ... DROP COLUMN`, or destructive alterations on legacy tables. |
  | **Foreign Key Constraints** | Insert invalid `ticketId`, `performedById`, or `assignedToId` | Database raises foreign key constraint error. |
  | **Deletion Integrity (`Ticket`)** | Execute `prisma.ticket.delete` on ticket with actions | Database rejects deletion (`onDelete: Restrict`). ActionTaken records cannot be orphaned. |
  | **Deletion Integrity (`User`)** | Execute `prisma.user.delete` on technician with actions | Database rejects deletion (`onDelete: Restrict`). Audit author cannot be purged. |
  | **Legacy Seed Preservation** | Query `TKT-1001` through `TKT-1004` post-migration | All 4 tickets exist; requester, category, related system relations intact. |
  | **Attachment Join & Metadata Preservation** | Query `TKT-1001` with pre-migration attachment fixture | `prisma.ticket.findUnique({ include: { attachments: true } })` returns the original attachment array matching baseline `id`, `originalName`, `storedName`, `mimeType`, `ticketId`, and `isRemoved` per `TC-DB-06`. |
  | **Seed Idempotency** | Execute `seed.ts` twice successively | Command exits cleanly; database counts for all entities remain identical after second run. |
  | **Disaster Recovery Restoration** | Execute `pg_restore` from pre-migration backup dump (`TC-DB-08`) | Schema and records restored to exact pre-migration state; 0 data loss. |

  ### 6.2 Rollback and Recovery Considerations
  * **Database Backup Procedure:** Prior to applying new migrations in any environment, an immutable database snapshot must be created using `pg_dump`:
    ```powershell
    pg_dump -U postgres -d toktikit_dev -F c -b -v -f backup_pre_lab4.dump
    ```
  * **Disaster Recovery & Restoration Procedure:** If a migration aborts, fails, or produces unintended schema corruption, restore the database into an **isolated recovery database** (`toktikit_recovery_test`) using binary-safe file input, and restore the separately backed-up attachment storage into an isolated storage location:
    ```powershell
    pg_restore -U postgres -d toktikit_recovery_test --clean --if-exists -v backup_pre_lab4.dump
    ```
    This completely cleans and restores all pre-existing Lab 1–3 tables (`User`, `Ticket`, `Category`, `RelatedSystem`, `PublicComment`, `InternalNote`, `Attachment`) and preserves all historic data.
  * **Transactional DDL Safeguard:** PostgreSQL supports transactional DDL, but do not assume Prisma automatically wraps every multi-statement migration in one transaction. Use explicit `BEGIN` / `COMMIT` boundaries where supported and verify rollback with the controlled failure test in `TC-DB-08`. If a migration operation cannot be made transactional, recover from the pre-migration snapshot in an isolated restore workflow.
  * **Attachment Storage Recovery:** The database dump alone does not contain external attachment binaries. Back up the configured attachment-storage directory (or object-storage snapshot) separately and verify file checksums in `TC-DB-06` and `TC-DB-08`.
  * **Recovery Verification:** Recovery testing is verified in `TC-DB-08` by executing the database and attachment-storage restoration and verifying database integrity.
  * **Non-Destructive Backfill:** Seeding Actions Taken utilizes checks (`findFirst` or upsert) on existing action descriptions to avoid redundant record creation upon re-seeding.

  ---

  ## 7. Security and Negative Tests Summary

  This section summarizes the security controls and negative input validations enforced across the Sprint 4 increment, mapped directly to their primary test cases in Section 3.

  ### 7.1 Security & Threat Vector Matrix

  | Vulnerability / Threat Vector | Test Scenario & Attack Payload | Primary Test Case ID | Expected Server Response |
  |---|---|---|---|
  | **Unauthorized Access** | Unauthenticated requests to protected endpoints (`/api/dashboard/*`, `/api/tickets/:id/actions-taken`). | `TC-RBAC-05`, `TC-RBAC-06` | `401 Unauthorized` |
  | **Role Privilege Escalation** | Requester attempting technician mutations (`POST actions-taken`, `PATCH status`). | `TC-RBAC-01`, `TC-TRN-13` | `403 Forbidden` |
  | **Cross-User Resource Enumeration** | Requester querying Actions Taken for another user's ticket ID. | `TC-RBAC-04` | `404 Not Found` (Non-enumeration: hides existence) |
  | **Technician Identity Spoofing** | Technician payload attempting to override `performedById`. | `TC-ACT-03` | `201 Created` with `performedById = req.user.id` |
  | **Inactive Assignee Injection** | Payload specifying inactive user in `assignedToId`. | `TC-ACT-16` | `400 Bad Request` (`INACTIVE_ASSIGNEE`) |
  | **Unauthorized Role Assignee** | Payload specifying Requester user in `assignedToId`. | `TC-ACT-17` | `400 Bad Request` (`INVALID_ASSIGNEE_ROLE`) |
  | **Resolution Gate Direct Bypass** | Direct API call attempting `PATCH status` to `RESOLVED` with zero Action Taken records. | `TC-TRN-16` | `400 Bad Request` (`ACTION_TAKEN_REQUIRED`) |
  | **Direct Resolution Bypass** | Requester attempting to force ticket status directly to `RESOLVED`. | `TC-TRN-13`, `TC-TRN-14` | `403 Forbidden` / Status remains unchanged |
  | **Audit Record Destruction** | Any user calling `DELETE /api/actions-taken/:actionId`. | `TC-RBAC-03` | `404 Not Found` / `405 Method Not Allowed` |
  | **Information Leakage in Errors** | Malformed payloads, invalid IDs, or database connection errors. | `TC-ACT-05`, `TC-TRN-06` | Standard JSON `{ "error": { "code", "message" } }` without stack traces |
  | **Password Change Bypass** | User with `mustChangePassword: true` accessing non-auth routes. | `TC-RBAC-08` | `403 Forbidden` (`PASSWORD_CHANGE_REQUIRED`) |

  ### 7.2 Boundary and Negative Input Validation Matrix

  | Field / Parameter | Negative Input Condition | Primary Test Case ID | Expected Result | Constraint Classification |
  |---|---|---|---|---|
  | `description` | Empty string `""` or whitespace-only `"   "`. | `TC-ACT-05` | `400 Bad Request` | Confirmed Handout Requirement |
  | `description` | Excessively long string (> 3,000 characters). | `TC-ACT-05` | `400 Bad Request` | *Proposed Technical Constraint (spec §13.3.4)* |
  | `result` | Empty string `""` or whitespace-only. | `TC-ACT-05` | `400 Bad Request` | Confirmed Handout Requirement |
  | `result` | Excessively long string (> 1,000 characters). | `TC-ACT-05` | `400 Bad Request` | *Proposed Technical Constraint (spec §13.3.4)* |
  | `followUpRequired` | String `"yes"` or non-boolean value. | `TC-ACT-06` | `400 Bad Request` | Confirmed Handout Requirement |
  | `followUpNote` | `followUpRequired = true` with missing or empty `followUpNote`. | `TC-ACT-06`, `TC-ACT-09` | `400 Bad Request` (`FOLLOW_UP_NOTE_REQUIRED`) | Confirmed Handout Requirement |
  | `actionDateTime` | Future timestamp exceeding server clock by > 5 minutes. | `TC-ACT-01` | `400 Bad Request` (`FUTURE_TIMESTAMP_NOT_ALLOWED`) | *Proposed Technical Constraint (spec §13.3.4)* |
  | `assignedToId` | Referencing user with `isActive: false`. | `TC-ACT-16` | `400 Bad Request` (`INACTIVE_ASSIGNEE`) | Confirmed Handout Requirement |
  | `assignedToId` | Referencing user with role `REQUESTER`. | `TC-ACT-17` | `400 Bad Request` (`INVALID_ASSIGNEE_ROLE`) | Confirmed Handout Requirement |
  | `status` | Unlisted transition (e.g., `NEW -> IN_PROGRESS`, `CLOSED -> OPEN`). | `TC-TRN-06`, `TC-TRN-07` | `400 Bad Request` (`VALIDATION_ERROR`) | Confirmed Handout Requirement |
  | `status` (Resolution Gate) | Transitioning to `RESOLVED` when ticket has 0 Action Taken records. | `TC-TRN-16` | `400 Bad Request` (`ACTION_TAKEN_REQUIRED`) | Approved project rule (spec §BR-10) |
  | `rejectionReason` | `status = REJECTED` with empty or missing reason. | `TC-TRN-11` | `400 Bad Request` (`VALIDATION_ERROR`) | Lab 3 Legacy Compatibility |

  ---

  ## 8. Lab 1–3 Regression Matrix

  The following test suites from Labs 1–3 must execute with **zero failures** during Sprint 4 test verification:

  | Test Suite / File | Scope / Feature Area | Key Covered Behaviors | Regression Risk & Safeguard |
  |---|---|---|---|
  | `server/tests/lab-01/health.test.ts` | Health Check | System availability and database connection. | None; verify endpoint untouched. |
  | `server/tests/lab-01/categories.test.ts` | Categories | Active category listing and lookup. | Schema migration must not alter Category table. |
  | `server/tests/lab-02/create-ticket.api.test.ts` | Ticket Creation | Auto ticket numbering (`TKT-XXXX`), validation, initial status `NEW`. | Initial status and required fields must remain backward-compatible. |
  | `server/tests/lab-02/my-tickets.api.test.ts` | Requester Tickets | Requester ticket listing, filtering, pagination. | Extending `status` filter for multi-value must not break single-value queries. |
  | `server/tests/lab-02/ticket-detail.api.test.ts` | Ticket Detail | Requester viewing own ticket; 404 for other tickets. | Non-enumeration behavior must remain intact. |
  | `server/tests/lab-02/attachments.api.test.ts` | Attachments | Upload (max 5, 5MB), download, soft-delete (`isRemoved`). | Attachment table and foreign keys must remain unchanged. |
  | `server/tests/lab-03/auth.api.test.ts` | Authentication | Login, logout, session cookie, password change enforcement. | Session handling and `req.user` must continue serving attribution. |
  | `server/tests/lab-03/authorization.api.test.ts` | RBAC Permissions | Role enforcement across requester, staff, admin. | Middleware must cleanly incorporate new endpoints. |
  | `server/tests/lab-03/staff-queue.api.test.ts` | Staff Queue | Queue filtering, claim (`NEW -> OPEN`), assign, priority. | Extending queue filters must preserve existing filter behavior. |
  | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Staff Detail | Ticket detail, claim, assign, priority update, reject. | Rejection reason requirement must continue passing. |
  | `server/tests/lab-03/comments-notes.api.test.ts` | Comments & Notes | Public comments vs internal notes authorization. | Status audit logging adds internal notes without breaking counts. |
  | `server/tests/lab-03/users-admin.api.test.ts` | User Administration | Admin CRUD, reset password, last-admin protection. | User management routes must remain unchanged. |
  | `server/tests/lab-03/migration-regression.api.test.ts` | Migration Regression | Seeded tickets `TKT-1001` to `TKT-1004` and requester joins. | New migration must preserve existing seed records. |
  | `client/tests/lab-02/*` | Client Components | Create ticket, my tickets, attachment section. | Frontend changes must not break existing form controls. |
  | `client/tests/lab-03/*` | Client Components | Login, password change, staff queue, user management. | Login redirect to `/my-tickets` and `/staff-queue` preserved. |
  | `e2e/lab-02/requester-ticket-flow.spec.ts` | Playwright E2E | End-to-end requester ticket creation and attachment. | Full browser user flow must succeed. |
  | `e2e/lab-03/staff-ticket-flow.spec.ts` | Playwright E2E | Staff login, claim, assign, status update, notes. | Preserved login redirects ensure E2E assertions pass. |
  | `e2e/lab-03/user-administration.spec.ts` | Playwright E2E | Admin user management workflow. | Admin UI and API must remain fully functional. |
  | `server/tests/lab-04/hardening.api.test.ts` | Hardening / Security | Security headers, CORS allow-list, session regeneration at login, JSON 400/404/413 failures, and a sweep that sends wrongly-typed, NUL-containing and out-of-range input to every write endpoint and expects a 4xx. | api-spec §1.3. |
  | `server/tests/lab-04/performance-smoke.api.test.ts` | Performance-Smoke (`TC-PRF-01`–`TC-PRF-03`) | Dashboards ≤ 300 ms (mean and p95 over 10 calls), Actions Taken list/create ≤ 200 ms, status transition ≤ 250 ms. | Local database, warm connection. |
  | `client/tests/lab-04/Hardening.test.tsx` | Client Hardening | Mobile menu toggle, logout when the session is gone, plain-language network failures, double-click protection on staff actions, dialog error display and inert background. | Draft/typed data preserved after failures. |
  | `e2e/lab-04/hardening.spec.ts` | Playwright E2E (Desktop, Tablet, Mobile) | Per role and screen: no console errors, no failed API calls, no unknown links, no placeholder text, no horizontal overflow, touch targets ≥ 44 px on narrow screens, axe WCAG A/AA scan (including the user-management dialogs), reachable navigation. | `@axe-core/playwright` (dev dependency). |
  | `server/tests/lab-04/contract-regression.api.test.ts` | API Contract Regression (`TC-REG-09`) | Verifies legacy Lab 1–3 endpoints preserve exact original success/error schemas, while new Lab 4 endpoints strictly use nested `{ "error": { "code", "message" } }`. | Global error format replacement strictly prohibited. |

  ---

  ## 9. Requirements Traceability Matrix (RTM)

  This matrix maps every Functional Requirement (FR), Business Rule (BR), and Acceptance Criterion (AC) from `docs/lab-04/specification.md` to corresponding test case specifications.

  > **Note on Coverage Status:** All requirements are classified as `Test Designed (Pending Implementation)`. This indicates that detailed, actionable test cases and verification procedures have been designed and mapped to authoritative requirements. It does **not** signify that test code has already been written, executed, or passed. Test suite implementation and execution take place in subsequent Sprint 4 implementation issues.

  | Requirement ID | Description | Covered By Test Case IDs | API / UI Reference | Coverage Status | Notes & Dependencies |
  |---|---|---|---|:---:|---|
  | **FR-01** | Record Action Taken by IT Staff / Admin | TC-ACT-01, TC-ACT-02, TC-UI-05 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Full create coverage |
  | **FR-02** | Automatic Performed By session attribution | TC-ACT-01, TC-ACT-03, TC-ACT-18 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Server derives `req.user.id` |
  | **FR-03** | Capture Action Taken fields | TC-ACT-01, TC-ACT-05, TC-ACT-06, TC-ACT-07 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Standard fields validated |
  | **FR-04** | Update Action Taken & Append-only Revision History | TC-ACT-08, TC-ACT-08B, TC-ACT-08C, TC-ACT-08D, TC-ACT-09, TC-ACT-10, TC-ACT-18, TC-DB-01B, TC-UI-06 | `PATCH /api/actions-taken/:actionId` | Test Designed (Pending Implementation) | Full update coverage & ActionTakenRevision append-only history |
  | **FR-05** | Collaborative action recording by any IT Staff | TC-ACT-04 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Non-owner staff permitted |
  | **FR-06** | Requester view Actions Taken on own tickets | TC-ACT-11, TC-UI-04 | `GET /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Read-only Service Actions tab |
  | **FR-07** | Requester blocked from create/update | TC-RBAC-01, TC-RBAC-02 | `POST` and `PATCH` Actions Taken endpoints | Test Designed (Pending Implementation) | HTTP 403 for Requester create/update; deletion is globally unavailable under BR-05 and tested separately by TC-RBAC-03 (404/405, no record deletion) |
  | **FR-08** | Enforce status transition matrix & Resolution Gate on backend | TC-TRN-01, TC-TRN-05, TC-TRN-06, TC-TRN-16, TC-TRN-17, TC-TRN-18 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | State machine & Resolution Gate |
  | **FR-09** | Transition ticket to RESOLVED | TC-TRN-01, TC-TRN-17, TC-TRN-18 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | From permitted predecessors |
  | **FR-10** | Transition RESOLVED to CLOSED or REOPENED | TC-TRN-02, TC-TRN-03, TC-TRN-04 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | Reopened & terminal rules |
  | **FR-11** | Terminal states immutability | TC-TRN-07, TC-TRN-08, TC-TRN-09 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | CLOSED, CANCELLED, REJECTED |
  | **FR-12** | Automatic audit log note on status transition | TC-TRN-01, TC-TRN-10, TC-TRN-12, TC-TRN-17 | `InternalNote` generation | Test Designed (Pending Implementation) | InternalNote created |
  | **FR-13** | Dedicated Requester Dashboard endpoint | TC-DASH-REQ-01, TC-DASH-REQ-02, TC-DASH-REQ-09, TC-RBAC-06 | `GET /api/dashboard/requester` | Test Designed (Pending Implementation) | Backend aggregate `COUNT` & empty state |
  | **FR-14** | Dedicated IT Staff Dashboard endpoint | TC-DASH-STF-01, TC-DASH-STF-02, TC-DASH-STF-11, TC-DASH-STF-13, TC-RBAC-07 | `GET /api/dashboard/staff` | Test Designed (Pending Implementation) | Backend aggregate `COUNT` & empty state |
  | **FR-15** | Requester Dashboard view, drill-down & recent items | TC-DASH-REQ-04, TC-DASH-REQ-05, TC-DASH-REQ-06, TC-DASH-REQ-07, TC-DASH-REQ-08, TC-DASH-REQ-09, TC-UI-02 | `/requester-dashboard` -> `/my-tickets` | Test Designed (Pending Implementation) | Requires multi-status filter support; `recentTickets` via `updatedAt DESC` |
  | **FR-16** | IT Staff Dashboard view & drill-down | TC-DASH-STF-06, TC-DASH-STF-07, TC-DASH-STF-08, TC-DASH-STF-09, TC-DASH-STF-10, TC-UI-03 | `/staff-dashboard` -> `/staff-queue` | Test Designed (Pending Implementation) | Requires `ownerId=me`, followUp, priority filter support |
  | **FR-17** | Server-side database metric calculation | TC-DASH-REQ-01, TC-DASH-STF-01, TC-PRF-01 | Dashboard endpoints | Test Designed (Pending Implementation) | No bulk ticket payloads |
  | **FR-18** | Preserve pre-existing Lab 1–3 data & recovery | TC-DB-05, TC-DB-06, TC-DB-07, TC-DB-08 | Prisma migration, backup & restore | Test Designed (Pending Implementation) | Non-destructive schema & attachment preservation verified |
  | **FR-19** | Maintain Lab 1–3 APIs without regression | TC-REG-01 through TC-REG-09 | All preserved endpoints | Test Designed (Pending Implementation) | Zero regression suite & error contract assertions |
  | **FR-20** | IT Staff Permission to Assign ActionTaken to Technician | TC-ACT-15, TC-ACT-16, TC-ACT-17 | Actions Taken endpoints | Test Designed (Pending Implementation) | Assignee selection via `GET /api/staff/assignees` |
  | **FR-21** | Actions Taken Assignee Validation (active, correct role) | TC-ACT-15, TC-ACT-16, TC-ACT-17, TC-ACT-18, TC-UI-05, TC-UI-06 | Actions Taken endpoints & modals | Test Designed (Pending Implementation) | Active IT Staff assignee validation |
  | **FR-22** | Backend Resolution Gate Enforcement | TC-TRN-16, TC-TRN-17, TC-TRN-18 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | Team-approved Business Rule; HTTP 400 ACTION_TAKEN_REQUIRED |
  | **FR-23** | Dashboard Empty State Support | TC-DASH-REQ-09, TC-DASH-STF-13 | Dashboard endpoints & UI | Test Designed (Pending Implementation) | Zero metrics & empty arrays |
  | **FR-24** | Form Data Retention on Failure | TC-ACT-14, TC-ACT-19, TC-UI-05, TC-UI-06 | Action modals & client state | Test Designed (Pending Implementation) | Form inputs preserved across recoverable errors (HTTP 400, 409, 500) |
  | **FR-25** | Duplicate Submission Prevention & Safe Retry | TC-ACT-19, TC-ACT-20, TC-ACT-20B, TC-UI-05, TC-UI-06 | Action modals & `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Disabled button in-flight & Idempotency-Key retry handling |
  | **BR-01** | Actions Taken Collaboration & Assignee Rules | TC-ACT-04, TC-ACT-12, TC-ACT-15, TC-ACT-16, TC-ACT-17, TC-ACT-18 | Actions Taken API | Test Designed (Pending Implementation) | Eligible active IT Staff / Admin |
  | **BR-02** | Authenticated Attribution | TC-ACT-01, TC-ACT-03, TC-ACT-10, TC-ACT-18 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Server session identity; performedById permanently immutable |
  | **BR-03** | Requester Action Prohibition | TC-RBAC-01, TC-RBAC-02, TC-UI-04 | Actions Taken API | Test Designed (Pending Implementation) | Read-only; 403 on create/update |
  | **BR-04** | Action Taken Field Validation | TC-ACT-05, TC-ACT-06, TC-ACT-09 | Actions Taken API | Test Designed (Pending Implementation) | Mandatory note if follow-up |
  | **BR-05** | Non-Deletability & Append-only Audit History | TC-RBAC-03, TC-ACT-08B, TC-ACT-08C, TC-ACT-08D, TC-DB-01B, TC-DB-03, TC-DB-04 | DB constraints & API routes | Test Designed (Pending Implementation) | Restrict constraint active; ActionTakenRevision immutable and undeletable |
  | **BR-06** | Standard Lifecycle Statuses (8 statuses) | TC-TRN-01 to TC-TRN-04, TC-DASH-STF-05 | State machine & Dashboards | Test Designed (Pending Implementation) | Standard handout statuses |
  | **BR-07** | Existing REJECTED Compatibility | TC-TRN-09, TC-TRN-10, TC-TRN-11, TC-DASH-STF-05 | Rejection transition & statusBreakdown | Test Designed (Pending Implementation) | Preserves Lab 3 behavior |
  | **BR-08** | Terminal States Immutability | TC-TRN-07, TC-TRN-08, TC-TRN-09 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | CLOSED, CANCELLED, REJECTED |
  | **BR-09** | Reopened Ticket Workflow | TC-TRN-03, TC-TRN-04 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | Reactivates in queue |
  | **BR-10** | Backend Resolution Gate Enforcement | TC-TRN-16, TC-TRN-17, TC-TRN-18 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | Team-approved Business Rule: COUNT >= 1 required; followUpRequired does not block resolution |
  | **BR-11** | Requester Problem Resolution Indication | TC-TRN-14 | `POST /api/tickets/:id/indicate-resolved` | Test Designed (Pending Implementation) | Appends comment, keeps status |
  | **BR-12** | Backend Metric Aggregation | TC-DASH-REQ-01, TC-DASH-STF-01, TC-DASH-STF-03, TC-DASH-STF-04, TC-DASH-REQ-08, TC-DASH-STF-12 | Dashboard queries | Test Designed (Pending Implementation) | SQL COUNT queries & recent lists |
  | **BR-13** | Requester Metric Isolation | TC-DASH-REQ-01, TC-DASH-REQ-03 | `GET /api/dashboard/requester` | Test Designed (Pending Implementation) | Scoped to `requesterId` |
  | **BR-14** | Concurrency Safeguards & Form Resilience | TC-TRN-15, TC-ACT-14, TC-ACT-19, TC-ACT-20, TC-ACT-20B, TC-ACT-21 | Status API & Action Modals | Test Designed (Pending Implementation) | HTTP 409 Conflict & safe retry |
  | **BR-15** | Non-Enumeration on Resource Access | TC-RBAC-04 | Ticket details & actions taken | Test Designed (Pending Implementation) | HTTP 404 Not Found |
  | **BR-16** | Administrator Governance & Dashboard Scope | TC-DASH-STF-11 | `GET /api/dashboard/staff` | Test Designed (Pending Implementation) | Reuses staff dashboard with Admin governance banner |
  | **BR-17** | API Error Contract & Compatibility | TC-REG-09 | All API endpoints | Test Designed (Pending Implementation) | Preserves Lab 1–3 error shapes; new Lab 4 APIs use nested `{ "error": { "code", "message" } }` |
  | **AC-01** | Record Action Taken (201 Created) | TC-ACT-01, TC-ACT-06, TC-ACT-15 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Tested with valid/invalid data & assignee |
  | **AC-02** | Requester Blocked from Recording Action | TC-RBAC-01 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | HTTP 403 Forbidden |
  | **AC-03** | Technician Identity Spoof Prevention | TC-ACT-03, TC-ACT-18 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Client payload ignored; performedById immutable |
  | **AC-04** | Update Action Taken & Append Revision | TC-ACT-08, TC-ACT-08B, TC-ACT-08C, TC-ACT-08D, TC-ACT-09, TC-ACT-10, TC-UI-06 | `PATCH /api/actions-taken/:actionId` | Test Designed (Pending Implementation) | Editable fields updated; ActionTakenRevision appended; performedById immutable |
  | **AC-05** | Requester Read-Only Service Actions | TC-ACT-11, TC-UI-04 | UI & `GET /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Read-only tab rendered |
  | **AC-06** | Collaborative Action Recording | TC-ACT-04 | `POST /api/tickets/:id/actions-taken` | Test Designed (Pending Implementation) | Non-owner staff succeeds |
  | **AC-07** | Valid Status Transition to RESOLVED | TC-TRN-01, TC-TRN-17 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | Status & audit note verified |
  | **AC-08** | Invalid Status Transition Rejected | TC-TRN-06 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | HTTP 400 Bad Request |
  | **AC-09** | Terminal Status Immutability | TC-TRN-07, TC-TRN-08, TC-TRN-09 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | HTTP 400 on terminal mutation |
  | **AC-10** | Requester Dashboard Metric Accuracy | TC-DASH-REQ-01, TC-DASH-REQ-02, TC-DASH-REQ-03, TC-DASH-REQ-09 | `GET /api/dashboard/requester` | Test Designed (Pending Implementation) | Exact scopes & clean account tested |
  | **AC-11** | Requester Dashboard Drill-Down | TC-DASH-REQ-04, TC-DASH-REQ-05, TC-DASH-REQ-06, TC-DASH-REQ-07 | UI Requester Dashboard | Test Designed (Pending Implementation) | Filter routing tested |
  | **AC-12** | IT Staff Dashboard Metric Accuracy | TC-DASH-STF-01, TC-DASH-STF-02, TC-DASH-STF-04, TC-DASH-STF-05, TC-DASH-STF-13 | `GET /api/dashboard/staff` | Test Designed (Pending Implementation) | Queue metrics & clean account verified |
  | **AC-13** | IT Staff Follow-Up Distinct Ticket Count | TC-DASH-STF-03 | `GET /api/dashboard/staff` | Test Designed (Pending Implementation) | Distinct ticket counting verified |
  | **AC-14** | Non-Destructive Migration Verification | TC-DB-05, TC-DB-06 | Database verification | Test Designed (Pending Implementation) | Seeded tickets preserved |
  | **AC-15** | Concurrency Protection on Ticket Status | TC-TRN-15 | Status transition API | Test Designed (Pending Implementation) | Race condition returns 409 |
  | **AC-16** | Lab 1–3 Regression Suite Integrity | TC-REG-01 through TC-REG-09 | All existing test files | Test Designed (Pending Implementation) | 0 failures across all suites & error contract verified |
  | **AC-17** | Inactive and Unauthorized Assignee Rejection | TC-ACT-15, TC-ACT-16, TC-ACT-17 | `POST` and `PATCH` Actions Taken endpoints | Test Designed (Pending Implementation) | Inactive assignee and invalid role rejection |
  | **AC-18** | Backend Resolution Gate Enforcement | TC-TRN-16, TC-TRN-17, TC-TRN-18 | `PATCH /api/staff/tickets/:id/status` | Test Designed (Pending Implementation) | Team-approved Business Rule: HTTP 400 `ACTION_TAKEN_REQUIRED` when 0 actions; HTTP 200 when >= 1 action exists, even with open followUp |
  | **AC-19** | Form Resilience & Duplicate Submission Prevention | TC-ACT-14, TC-ACT-19, TC-ACT-20, TC-ACT-20B, TC-UI-05, TC-UI-06 | Action modals | Test Designed (Pending Implementation) | Input preserved on failure, button disabled in-flight |
  | **AC-20** | Dashboard Recent Information & Zero Metrics | TC-DASH-REQ-08, TC-DASH-REQ-09, TC-DASH-STF-12, TC-DASH-STF-13 | Dashboard endpoints & UI | Test Designed (Pending Implementation) | Populated lists (sorted `updatedAt DESC`) & zero state for both dashboards |

  ---

  ## 10. Test Execution and Completion Criteria

  ### 10.1 Test Execution Commands
  All commands are derived from actual `package.json` scripts and repository configuration.

  #### 1. Server Integration & API Tests
  Run all server tests:
  ```powershell
  npm --prefix server test
  ```
  Run specifically Lab 4 server tests:
  ```powershell
  npx --prefix server vitest run tests/lab-04
  ```
  Run regression tests from prior labs:
  ```powershell
  npx --prefix server vitest run tests/lab-01 tests/lab-02 tests/lab-03
  ```

  #### 2. Client Component Tests
  Run all client tests:
  ```powershell
  npm --prefix client test
  ```
  Run specifically Lab 4 client tests:
  ```powershell
  npx --prefix client vitest run tests/lab-04
  ```
  Run client regression tests:
  ```powershell
  npx --prefix client vitest run tests/lab-01 tests/lab-02 tests/lab-03
  ```

  #### 3. End-to-End (E2E) Browser Tests
  Ensure client and server dev servers are running, or let Playwright auto-launch them via `playwright.config.ts`:
  Run all E2E test suites:
  ```powershell
  npx playwright test
  ```
  Run specifically Lab 4 E2E flows:
  ```powershell
  npx playwright test e2e/lab-04
  ```
  Run E2E regression suites:
  ```powershell
  npx playwright test e2e/lab-02 e2e/lab-03
  ```

  #### 4. Database Migration & Seed Verification
  Apply migrations to local database:
  ```powershell
  npm --prefix server run prisma:migrate
  ```
  Run seed script:
  ```powershell
  npm --prefix server run prisma:seed
  ```

  ### 10.2 Pass/Fail Criteria
  * **Unit & Integration:** 100% of test cases must pass (0 failed, 0 errors).
  * **Component Tests:** 100% of component tests must pass without unhandled React errors or warnings.
  * **E2E Tests:** All Playwright specs must pass across Desktop Chrome, Tablet iPad, and Mobile Safari profiles without timeouts or retries exceeding configured CI limits (`retries: 2`).
  * **Regression:** 0 regressions across Lab 1, Lab 2, and Lab 3 suites.

  ### 10.3 Evidence Required for Issue 1 Completion
  1. Specification documents complete and peer-reviewed:
    * `docs/lab-04/specification.md`
    * `docs/lab-04/api-spec.md`
    * `docs/lab-04/ui-spec.md`
    * `docs/lab-04/tests.md`
  2. Full traceability between FR, BR, AC, API endpoints, UI components, and test case IDs confirmed in Section 9.
  3. All known implementation gaps (multi-value status filtering, `ownerId=me`, `followUpRequired=true`, multi-value priority) explicitly documented and scheduled for implementation.

  ---

  ## 11. Assumptions and Unresolved Test Decisions

  The following items reflect architectural baselines and pending decisions documented in `specification.md §13`, `api-spec.md §7`, and `ui-spec.md §8`. They are tracked here to ensure test expectations remain aligned with course instruction.

  | Decision / Issue | Reference | Test Baseline Assumption | Impact if Decision Changes |
  |---|---|---|---|
  | **Backend Resolution Gate Condition** | spec §BR-10, Handout §4.5 | **Team-approved Business Rule:** Requires at least one persisted Action Taken record (`COUNT(actionsTaken) >= 1`) before `RESOLVED` (`TC-TRN-16`, `TC-TRN-17`, `TC-TRN-18`). If zero exist, backend rejects with HTTP `400 Bad Request` and `ACTION_TAKEN_REQUIRED`. Outstanding follow-ups do not block resolution. Backend is authoritative enforcement point. | Enforced authoritatively on server for every permitted predecessor transition; supplementary UI validation warnings. |
  | **Follow-Up Clearance Prerequisite for RESOLVED** | spec §13.3.2, Q-13.3.2 | **Team-approved Business Rule:** Decoupled: A ticket CAN transition to `RESOLVED` even if some Actions Taken have `followUpRequired = true`. Follow-ups remain visible as follow-up obligations without blocking resolution. | Finalized decision; follow-up required does not block resolution. |
  | **Ticket Status Transition Matrix** | spec §6.1 | All transitions listed in the finalized matrix are enabled and tested. Any transition not listed is rejected with `400 VALIDATION_ERROR`. | Backend, UI, and test fixtures must use the exact same matrix. |
  | **Validation Length Limits** | spec §13.3.4, BR-04 | **Enforced as proposed constraints:** Description: 5–3,000 chars; Result: 2–1,000 chars; Notes: max 1,000 chars; future timestamp tolerance: 5 mins. | Field boundary tests in `TC-ACT-05`, `TC-ACT-06`, and Section 7.2 validate these constraints. |
  | **Attachment Notes Data Type** | spec §13.3.5 | **Free-text string (`String?`):** Field accepts technician text notes, equipment IDs, or file paths without foreign key constraint to `Attachment`. | Tested in `TC-ACT-07`. |
  | **Dashboard Drill-Down Multi-Status Format** | ui-spec §2.1.2, UI-Q7 | **Implementation Requirement:** Query format `?status=NEW,OPEN,IN_PROGRESS` and `?status=RESOLVED,CLOSED` requires extending `TicketFilters.status` in `MyTickets.tsx` and backend `GET /api/tickets`. | Test cases `TC-DASH-REQ-05` and `TC-DASH-REQ-07` test this extended multi-status filter behavior. |
  | **Staff Queue Drill-Down Filters Gap** | ui-spec §2.2.2, UI-Q8 | **Implementation Requirement:** `ownerId=me`, `followUpRequired=true`, and multi-value `itPriority=CRITICAL,HIGH` are new requirements spanning frontend filters and `GET /api/staff/tickets`. | Test cases `TC-DASH-STF-07`, `TC-DASH-STF-08`, and `TC-DASH-STF-09` test these filter extensions. |
  | **Administrator Dashboard Scope** | spec §8.3, spec §BR-16 | **Approved Decision:** Reuses the IT Staff Dashboard with full queue visibility and an Administrator governance header note (`TC-DASH-STF-11`). Concise user account counts are omitted to keep scope focused. | Handout permits either reuse or adding account counts. Confirmed to reuse staff dashboard. |
  | **Primary Post-Login Landing Route** | spec §13.3.6, UI-Q1 | **Preserve Lab 3 redirects:** Login redirects remain `/my-tickets` (Requester), `/staff-queue` (IT Staff), `/user-management` (Admin). Dashboards are accessed via navigation bar. | Safeguards Lab 3 Playwright E2E tests (`TC-REG-08`). |
  | **Actions Taken Lifecycle Decoupling** | spec §13.1.9, api-spec §8, UI-Q11 | **Confirmed Architectural Decision:** Action Taken records do **NOT** have an independent status lifecycle (no `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` statuses). Complete, cancel, and status transitions operate strictly on the parent Ticket per Part 7 workflow (`TC-TRN-01`–`TC-TRN-18`). Action Taken test cases (`TC-ACT-01`–`TC-ACT-21`) verify Action Taken CRUD, attribution, assignee validation, optimistic concurrency, and safe retries independently from Ticket workflow transitions. | Handout Section 8.3 fields are strictly preserved; no `ActionTaken.status` field exists. |

---

## 12. Final Release Verification & Regression Results

Executed at the conclusion of Lab 4 implementation:

### 12.1 Automated Test Execution Summary

| Test Suite | Scope | Baseline (Labs 1–3) | Final Lab 4 Result | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Server Vitest** | Full Server Suite | 13 files, 148 tests passed | **19 files passed, 221 tests passed (0 failed)** | **PASS** | 100% pass across all 19 test files. |
| **Client Vitest** | Full Client Suite | 11 files, 50 tests passed | **15 files passed, 70 tests passed (0 failed)** | **PASS** | 100% pass across all 15 test files. |
| **Playwright E2E (Lab 4)** | Sprint 4 Flows | N/A (New in Lab 4) | **15 passed (0 failed)** | **PASS** | Full coverage across Desktop Chrome, Tablet iPad, Mobile Safari. |
| **Playwright E2E (Lab 3)** | Regression Suite | 24 tests passed | **24 passed (0 failed)** | **PASS** | **Zero new regressions** against verified baseline. |
| **Playwright E2E (Lab 2)** | Legacy Flow | 3 failed (Pre-existing) | 3 failed (Pre-existing) | **KNOWN** | Unchanged pre-existing failure: expects obsolete Lab 2 dropdown removed in Lab 3. |
| **TypeScript / Build (Server)** | Type Check & Build | Clean compile | **0 errors (`tsc` exited 0)** | **PASS** | Production build verified. |
| **TypeScript / Build (Client)** | Type Check & Build | Clean compile | **0 errors (`tsc && vite build` exited 0)** | **PASS** | Production bundle generated with 0 errors. |

### 12.2 Verification Against Approved Lab 4 Decisions
- **Resolution Gate:** Verified authoritatively on backend (`COUNT(actionsTaken) >= 1` required for `RESOLVED`, returning HTTP 400 `ACTION_TAKEN_REQUIRED`). Outstanding follow-ups do not block resolution.
- **Ticket Status Transition Matrix:** All 9 statuses and state transitions verified across unit, API, UI, and E2E suites.
- **Append-Only History:** Both `ActionTakenRevision` (Action Taken edits) and `InternalNote` (workflow status changes with rejection reasons) verified immutable, append-only, and deterministically ordered.
- **Optimistic Concurrency & Safe Failure:** `expectedUpdatedAt` atomic conditional updates verified returning HTTP 409 `STALE_UPDATE` / `CONCURRENCY_CONFLICT` with zero partial records.
- **Durable Idempotency:** Database-backed `IdempotencyRecord` table with 24-hour expiration verified surviving application restarts and returning identical replayed payloads.
- **Attachment Storage Integrity:** Physical attachments under configured `uploads/lab-02/` verified 100% untouched and preserved in read-only mode.

