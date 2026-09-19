# gaps.md — Lab 3 Evidence Audit & Gap Report

**Report Date:** 2026-09-19  
**Repository:** https://github.com/Piink7878/cpe334-TokTikIT  
**main HEAD SHA:** `b3e46a220ff604b78dbbc3c0b683a94fed26f4b6`  
**Auditor:** Antigravity (automated test execution, API audits, Playwright evidence generation)  

**Legend:**
- `RESOLVED`: Gap identified earlier, fully addressed and verified in the current evidence pack.
- `AFFECTS POINTS`: Unresolved item or discrepancy that graders may inspect against rubric criteria.
- `COSMETIC / INFORMATIONAL`: Expected design trade-off, environmental disclosure, or non-penalized observation.

---

## Part 1: Git Use with Engineering Workflow

### GAP-01: GitHub Projects / Kanban Board Session Access
- **Severity:** Affects points (Part 1 Kanban requirement)
- **Status:** Documented / Partial
- **Finding:** The GitHub Projects board URL requires an authenticated user session to display the project board view.
- **Remediation:** Verified programmatically via GitHub API that all 10 Sprint 3 Issues (#42–#51) are closed (`state: closed`). Captured screenshot of closed issue list (`artifacts/lab-03/screenshots/git-workflow/P01-F03_closed-issues-list_desktop.png`) confirming 100% completion of sprint issues. If grader requires the visual board view, student can capture the board directly from their authenticated browser.

### GAP-02: PR #62 and #63 Merge Review Formal Approvals
- **Severity:** Cosmetic / Informational
- **Status:** Documented
- **Finding:** PRs #52 through #61 received formal "Request changes" reviews with subsequent resolutions from reviewer `@Kamonnatt23`. PR #62 (release prep) and PR #63 (staging to main) were merged directly by repository owner/reviewer without a formal GitHub "Approve" review event recorded in the API.
- **Remediation:** Documented in PR table and `lab3-evidence.md`. Reviewer records in `reviewer.md` cover all core functional features (PRs #52–#61).

### GAP-03: PR #58 Closed Unmerged (Superseded by PRs #59 and #60)
- **Severity:** Cosmetic / Informational
- **Status:** Documented
- **Finding:** PR #58 ("Feature/7 Admin") appears in commit history as closed without merge (`merged_at: null`).
- **Remediation:** PR #58 was split into PR #59 (comments & notes) and PR #60 (admin user management), both of which were successfully peer-reviewed and merged into `lab3-staging`.

### GAP-04: Sprint 3 Issues #42 through #51 State Verification
- **Severity:** Affects points (Part 1 Issue closure requirement)
- **Status:** RESOLVED
- **Finding:** Verified via GitHub API and visual screenshot that all 10 Sprint 3 issues (#42–#51) are in `closed` status. Closed timestamps range from 2026-09-19T13:49:15Z to 2026-09-19T13:50:54Z.

### GAP-05: Local Test Artifacts Excluded by .gitignore
- **Severity:** Cosmetic / Informational
- **Status:** RESOLVED
- **Finding:** `playwright-report/` and `test-results/` are properly ignored by `.gitignore`.
- **Remediation:** Full raw stdout logs for server (148 tests), client (50 tests), and Playwright E2E (24 tests) have been committed to `artifacts/lab-03/evidence-logs/`.

---

## Part 2: Spec DD

### GAP-06: Status Lifecycle REJECTED State in Specification
- **Severity:** Cosmetic / Informational
- **Status:** RESOLVED
- **Finding:** Section 7 of `docs/lab-03/specification.md` includes `REJECTED` in the `currentStatus` enum following migration `20260916123700_add_rejected_status`.
- **Remediation:** Verified that `REJECTED` is fully documented in the specification and supported in the backend transition state machine.

### GAP-07: Business Rules Range in Specification (BR-01 to BR-17)
- **Severity:** Cosmetic / Informational
- **Status:** Documented
- **Finding:** Handout rubric focuses on BR-01 to BR-05 and Administrator safety rules. The project specification defines extended rules BR-06 through BR-17.
- **Remediation:** All core rules BR-01 to BR-05 and admin safety rules (BR-16 self-deactivation, BR-17 last-admin safety) are fully specified and tested.

---

## Part 3: Test DD and Traceability

### GAP-08: Programmatic Traceability and Test Result Reconciliation
- **Severity:** Affects points (Part 3 Traceability)
- **Status:** RESOLVED
- **Finding:** All Acceptance Criteria (AC-01 through AC-15) map to automated tests. Verified test results on `main` HEAD:
  - Server Vitest: 148 passed across 13 files.
  - Client Vitest: 50 passed across 11 files.
  - Playwright E2E: 24 passed across 3 viewport configurations.
  - Total: 222 automated tests passing.
- **Remediation:** `artifacts/lab-03/evidence-logs/traceability-check.txt` generated and verified.

### GAP-09: MIG-01 Migration Verification Limitation
- **Severity:** Cosmetic / Informational
- **Status:** Documented
- **Finding:** As disclosed in `docs/lab-03/tests.md`, MIG-01 tests backward-compatibility and schema integrity against the seeded database rather than a teardown migration replay. No legacy attachment records were seeded, so attachment preservation is tested via FK schema query compatibility on `TKT-1001`.
- **Remediation:** Accurately documented in `lab3-evidence.md`.

### GAP-10: Missing File Discrepancy — Responsive.test.tsx
- **Severity:** Affects points (Part 3 Test File Existence)
- **Status:** AFFECTS POINTS / DISCLOSED
- **Finding:** `docs/lab-03/tests.md` line 34 references `client/tests/lab-03/Responsive.test.tsx` for Test ID `UI-06`. However, this file does not exist in the repository.
- **Remediation:** Responsiveness is fully validated via the Playwright E2E suite (`e2e/lab-03/`) across Desktop Chrome, Tablet iPad, and Mobile Safari (24 tests), and UI component responsiveness is tested in `StaffTicketQueue.test.tsx`. Recorded in `traceability-check.txt` and disclosed in report.

---

## Part 4: AI Use with Reflection

### GAP-11: Language of ai-use.md Document
- **Severity:** Cosmetic / Informational (dependent on instructor requirements)
- **Status:** Documented
- **Finding:** `docs/lab-03/ai-use.md` is written entirely in Thai (student native language).
- **Remediation:** `lab3-evidence.md` provides an English-language synthesis and outline of the reflection on specification-agent and coding-agent iterations.

### GAP-12: LLM Model Notation in ai-use.md
- **Severity:** Cosmetic
- **Status:** Documented
- **Finding:** `ai-use.md` references "Google Cloud Platform's Antigravity (Gemini 3.8 Flash - High)".
- **Remediation:** Documented as an IDE agent configuration label; actual model family is Google DeepMind Gemini.

---

## Parts 5–9: UI and Responsive Evidence

### GAP-13 to GAP-17: Missing UI State Screenshots
- **Status:** ALL RESOLVED
- **Resolution:** Full high-resolution screenshots captured across all viewports for:
  - Login empty, invalid credentials, inactive account, app shell for all 3 roles, logout redirect, mandatory change password interstitial.
  - Staff Ticket Queue default, search query, empty search results, status filter, IT priority sort.
  - Staff Ticket Detail full page, public comments section, internal notes section (distinct yellow theme), operations panel (assignment, IT priority, status).
  - Admin User Management list, search by staff, create user modal open, create user modal filled, edit user modal.
  - Requester My Tickets, Requester Ticket Detail with "Problem Appears Resolved" button, Create Ticket form (desktop, tablet, mobile).

### GAP-18: Responsive 3-Up Composites and Overflow Verification
- **Status:** RESOLVED
- **Resolution:** 5 composite screenshots generated in `artifacts/lab-03/screenshots/zen-green-responsive/`:
  - `P09-F02_login-composite.png`
  - `P09-F03_staff-queue-composite.png`
  - `P09-F04_staff-detail-composite.png`
  - `P09-F05_user-management-composite.png`
  - `P09-F06_create-ticket-composite.png`
  - `overflow-check.json`: 18/18 checks verified PASS across all 6 core views on Desktop (1440px), Tablet (820px), and Mobile (390px).

### GAP-19: Rendered Specification and UI Spec Slices
- **Status:** RESOLVED
- **Resolution:** Captured high-resolution rendered slices directly from GitHub main HEAD for `specification.md`, `tests.md`, `ai-use.md`, and `ui-spec.md`.
