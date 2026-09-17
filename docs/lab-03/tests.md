# Test Plan & Traceability Matrix: Sprint 3 (Tok TickIT)

This document provides a comprehensive test plan for the Lab 3 increment, mapping business rules and Acceptance Criteria (AC) from the specification to specific automated tests before implementation begins.

## Traceability Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API-01** | API | AC-01 | Valid login with active credentials | Authenticated response; returns permitted identity and role | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-02** | API | AC-02 | Login with initial password | Login succeeds but restricts access until password changed | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-03** | API | AC-03 | Requester tries to act as another user | Backend ignores supplied `requesterId` and uses session | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-04** | API | AC-04, AC-15 | Requester requests internal notes | 403 Forbidden; no note content leaked | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-05** | API | AC-05 | IT Staff requests ticket details | Returns both Public Comments and Internal Notes | `server/tests/lab-03/staff-operations.api.test.ts` | Planned |
| **API-06** | API | AC-06 | IT Staff updates ticket status | Status is updated successfully | `server/tests/lab-03/staff-operations.api.test.ts` | Planned |
| **API-07** | API | AC-07, AC-15 | Requester attempts to update `it_priority` | 403 Forbidden; priority unchanged | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-08** | API | AC-08 | Admin attempts to deactivate own account | 400 Bad Request; prevents deactivation | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-09** | API | AC-09 | Admin deactivates/changes role of last admin | 400 Bad Request; action prevented | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-10** | API | AC-10 | Admin creates a new user | User created; password is hashed in DB | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-11** | API | AC-11 | IT Staff views global queue | Returns tickets across all Requesters | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| **API-12** | API | AC-12 | Requester views ticket queue | Only returns their own tickets | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-13** | API | AC-13 | Unauthenticated access to protected API | 401 Unauthorized returned | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-14** | API | AC-14 | IT Staff creates internal note | Note saved with `is_internal_note = true` | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| **API-15** | API | AC-15 | Requester attempting Admin operations | 403 Forbidden when requesting `/api/admin/users` | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-16** | API | AC-05, AC-14 | Fetch Public Comments | Returns correctly filtered comment list | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| **UI-01** | Component | AC-01, AC-13 | Login screen rendering and submission | Renders form; calls auth API; handles errors | `client/tests/lab-03/Login.test.tsx` | Planned |
| **UI-02** | Component | AC-02 | Change Password interstitial | Forces user to enter new password | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| **UI-03** | Component | AC-11 | Staff Ticket Queue grid | Renders grid, filters, and pagination | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| **UI-04** | Component | AC-05, AC-14 | Staff Ticket Detail timeline | Renders comments and internal notes distinctively | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| **UI-05** | Component | AC-10 | Admin User Management modal | Renders user list and create/edit modal | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| **E2E-01** | E2E | AC-01, AC-13 | End-to-end login flow | Unauth redirected to login; success enters app | `e2e/lab-03/authentication.spec.ts` | Planned |
| **E2E-02** | E2E | AC-06, AC-11 | Staff ticket lifecycle | Staff finds ticket in queue, updates status | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| **E2E-03** | E2E | AC-08, AC-10 | Admin user management flow | Admin creates user, attempts self-deactivation | `e2e/lab-03/user-administration.spec.ts` | Planned |
| **MIG-01** | API | Migration | Data Migration & Regression | Verifies Lab 2 tickets/attachments persist and are owned by migrated users | `server/tests/lab-03/migration.test.ts` | Planned |
| **UI-06** | Component | Responsive | Ticket Queue responsiveness | Renders as data table on desktop, cards on mobile | `client/tests/lab-03/Responsive.test.tsx` | Planned |
