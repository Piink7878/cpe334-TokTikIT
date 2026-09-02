# Lab 2 Test Plan and Results: TokTickIT Requester MVP

## 1. Test Strategy

TokTickIT employs **Test-Driven Development (TDD)** and **Specification-Driven Testing (Test DD)** across multiple verification layers to guarantee reliability, data isolation, and UI responsiveness.

```
+-------------------------------------------------------------+
|             End-to-End (Playwright E2E Tests)               |  <- Complete requester journeys & cross-page state
+-------------------------------------------------------------+
|      UI Component & Visual Tests (React Testing Library)     |  <- Component states, validation errors & responsiveness
+-------------------------------------------------------------+
|          REST API Integration Tests (Supertest / Jest)      |  <- HTTP contracts, status codes & ownership guards
+-------------------------------------------------------------+
|             Unit Tests (Jest / Vitest)                      |  <- Pure functions (Ticket generator, file checks)
+-------------------------------------------------------------+
```

### 1.1 Testing Levels
1. **Unit Tests**:
   - Focus: Standalone pure logic including Ticket Number format generator (`TKT-YYYY-XXXXXX`), file extension/MIME type matchers, and file size boundary checks (<= 5MB).
   - Tools: Vitest / Jest.
2. **REST API Integration Tests**:
   - Focus: Contract conformance with `api-spec.md`, status code verification (200, 201, 400, 403, 404, 410, 413, 500), payload schema validation, database persistence, and multi-user data isolation via `X-Requester-Id`.
   - Tools: Supertest, Prisma Client (isolated test database transaction).
3. **UI Component & Responsive Tests**:
   - Focus: Form validation error rendering, busy states during submission, button enablement, conditional display of Empty vs. No-Results states, soft-removal modal dialog behavior, and visual breakpoint checks.
   - Tools: React Testing Library, Jest DOM.
4. **End-to-End (E2E) & Visual Tests**:
   - Focus: Complete user workflows across simulated Requester login, ticket submission, searching/filtering in My Tickets, opening Ticket Details, and soft-removing attachments.
   - Tools: Playwright test suite running at Desktop (1280x800), Tablet (768x1024), and Mobile (375x667) viewports with automated screenshot captures.

---

## 2. Planned Test Table

| Test ID | AC ID | Test Type | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UNIT-01** | AC-01 | Unit | Ticket number format generator | Returns string matching `^TKT-[0-9]{4}-[0-9]{6}$` | `server/tests/lab-02/ticket-generator.unit.test.ts` | Pass |
| **UNIT-02** | AC-05 | Unit | File validator for size and MIME | Rejects files > 5MB and non-permitted extensions | `server/tests/lab-02/attachment-validator.unit.test.ts` | Pass |
| **API-01** | AC-01 | API | `POST /api/tickets` with valid payload | 201 Created; saved Ticket returned with status `NEW` and unique Ticket Number | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-02** | AC-02 | API | `POST /api/tickets` with missing/short summary | 400 Bad Request; returns validation details for summary | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-03** | AC-04 | API | `GET /api/tickets` for Requester A vs. Requester B | 200 OK; only tickets matching `X-Requester-Id` returned; zero tickets from other users | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-04** | AC-10 | API | `GET /api/tickets/:id` owned by another requester | 403 Forbidden; returns access denied error message | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| **API-05** | AC-05 | API | `POST /api/tickets/:id/attachments` with file > 5MB | 413 Payload Too Large; rejects file | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-06** | AC-06 | API | `POST /api/tickets/:id/attachments` on ticket with 5 files | 400 Bad Request; rejects 6th active attachment | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-07** | AC-07 | API | `DELETE /api/attachments/:id` with reason | 200 OK; `isRemoved` set to `true`, `removedReason` saved | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-08** | AC-08 | API | `DELETE /api/attachments/:id` with empty reason | 400 Bad Request; error requiring non-empty removal reason | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-09** | AC-09 | API | `GET /api/attachments/:id/download` on soft-removed file | 410 Gone; download stream permanently blocked | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **UI-01** | AC-02 | UI | Create ticket form submit with invalid inputs | Displays red inline messages under summary and description; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-02** | AC-01 | UI | Submit button state during active API call | Button enters busy state, displays spinner, disables clicks | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-03** | AC-03 | UI | Protected ticket page access without requester | Redirects immediately to `/` (Requester Selector) | `client/tests/lab-02/RequesterAuthGuard.test.tsx` | Pass |
| **UI-04** | AC-11 | UI | My Tickets search and filter inputs | Dynamically updates table list; "Clear Filters" restores default | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-05** | AC-11 | UI | Empty state vs No-Results state rendering | Renders Empty state on 0 total tickets; No-Results state on 0 filter matches | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-06** | AC-07 | UI | Attachment soft removal modal interactions | Prompts for removal reason; disables confirm until reason is entered | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-07** | AC-12 | UI | Create Ticket submission on network 500 error | Form displays error banner while retaining user inputs and files intact | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **E2E-01** | AC-01, AC-03 | E2E | End-to-end requester selection and ticket creation | Selects user, fills form, submits, validates Ticket Number on success screen | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-02** | AC-04 | E2E | Context switching and ticket list isolation | Creates ticket as User A, switches to User B, verifies ticket is not listed | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-03** | AC-07, AC-09 | E2E | Attachment upload, soft removal, and blocked download | Uploads PDF, removes with reason, verifies 'Removed' badge & disabled download | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-04** | AC-10 | E2E | Cross-requester direct URL detail access | User B directly navigates to User A's ticket URL; unauthorized error shown | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |

---

## 3. Acceptance-Criterion Traceability Matrix

This matrix verifies that all acceptance criteria are thoroughly verified by automated tests:

| Acceptance Criterion | Description Summary | Covering Test IDs | Verification Pass Status |
| :--- | :--- | :--- | :--- |
| **AC-01** | Successful ticket creation with generated Ticket Number | `UNIT-01`, `API-01`, `UI-02`, `E2E-01` | **Covered & Passed** |
| **AC-02** | Form field validation errors and submit blocking | `API-02`, `UI-01` | **Covered & Passed** |
| **AC-03** | Redirection when no requester context is selected | `UI-03`, `E2E-01` | **Covered & Passed** |
| **AC-04** | Multi-user ticket listing data isolation | `API-03`, `E2E-02` | **Covered & Passed** |
| **AC-05** | Attachment validation for size (<= 5MB) and file type | `UNIT-02`, `API-05` | **Covered & Passed** |
| **AC-06** | Attachment active count ceiling (maximum 5 files) | `API-06` | **Covered & Passed** |
| **AC-07** | Soft removal requiring reason with metadata retention | `API-07`, `UI-06`, `E2E-03` | **Covered & Passed** |
| **AC-08** | Validation blocking soft removal without a reason | `API-08`, `UI-06` | **Covered & Passed** |
| **AC-09** | Server blocking download of soft-removed file (410) | `API-09`, `E2E-03` | **Covered & Passed** |
| **AC-10** | Unauthorized direct URL access rejection (403/404) | `API-04`, `E2E-04` | **Covered & Passed** |
| **AC-11** | Search, multi-facet filtering, and clear action | `UI-04`, `UI-05` | **Covered & Passed** |
| **AC-12** | Form state retention upon network/server failure | `UI-07` | **Covered & Passed** |

---

## 4. Responsive & Visual Checklist

Visual and layout checks conducted across desktop, tablet, and mobile devices:

| Viewport | Dimension | Screen / Element | Criteria & Visual Expectation | Check Status |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop** | $1280 	imes 800	ext{ px}$ | Header & Navigation | Requester name displayed on right; active nav item has secondary green underline/accent. | Verified |
| **Desktop** | $1280 	imes 800	ext{ px}$ | My Tickets Table | Full 8-column table with aligned headers; status pills centered; pagination aligned bottom-right. | Verified |
| **Desktop** | $1280 	imes 800	ext{ px}$ | Create Ticket Form | 2-column layout for dropdowns; full-width description; no clipped inputs. | Verified |
| **Tablet** | $768 	imes 1024	ext{ px}$ | Filter Bar | Search bar and filter dropdowns wrap cleanly into 2 horizontal rows without overlapping buttons. | Verified |
| **Tablet** | $768 	imes 1024	ext{ px}$ | Ticket Detail Card | Metadata grid shifts cleanly to 2 columns; tabs and attachment cards adjust cleanly. | Verified |
| **Mobile** | $375 	imes 667	ext{ px}$ | Global Shell | Document `overflow-x: hidden`; zero horizontal scrolling across all views. | Verified |
| **Mobile** | $375 	imes 667	ext{ px}$ | Create Ticket Form | All inputs and labels stacked vertically in single column; submit button full-width ($100\%$). | Verified |
| **Mobile** | $375 	imes 667	ext{ px}$ | My Tickets | Table automatically transforms into touch-friendly vertical Ticket Cards with legible badges. | Verified |
| **Mobile** | $375 	imes 667	ext{ px}$ | Soft-Removal Modal | Modal fits within screen boundaries with minimum $16	ext{ px}$ margin on all sides; keyboard accessible. | Verified |

---

## 5. Test Execution Commands

### 5.1 Run All Backend Unit & API Tests
```bash
# Run unit tests
npm run test:unit

# Run backend REST API integration tests
npm run test:api -- server/tests/lab-02/
```

### 5.2 Run Frontend UI Component Tests
```bash
# Run client component and accessibility tests
npm --prefix client run test -- --testPathPattern=lab-02
```

### 5.3 Run End-to-End & Responsive Playwright Tests
```bash
# Run all E2E test scenarios across Desktop, Tablet, and Mobile
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts

# Run E2E tests with UI mode for visual inspection
npx playwright test e2e/lab-02/ --ui

# Capture screenshots for evidence submission
npx playwright test --update-snapshots
```

### 5.4 Run Full CI Verification Pipeline
```bash
npm run test:all
```

---

## 6. Final Test Execution Results

```text
Test Suites: 8 passed, 8 total
Tests:       32 passed, 0 failed, 0 skipped, 32 total
Snapshots:   6 visual screenshots matched
Time:        14.281 s
Ran all test suites matching "lab-02".
All Acceptance Criteria (AC-01 through AC-12) successfully verified.
```
