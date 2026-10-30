# Existing Evidence Inventory - artifacts/lab-03/

Audited on: 2026-09-19
main HEAD SHA: b3e46a220ff604b78dbbc3c0b683a94fed26f4b6
Auditor: Antigravity (automated + visual inspection)

## 1. File Inventory

| Folder | Filename | Bytes | Viewport | Added in PR |
|--------|----------|-------|----------|-------------|
| screenshots/authentication | desktop.png | 12,792 | Desktop | PR #62 |
| screenshots/authentication | tablet.png | 37,423 | Tablet | PR #62 |
| screenshots/authentication | mobile.png | 40,798 | Mobile | PR #62 |
| screenshots/staff-queue | desktop.png | 67,298 | Desktop | PR #62 |
| screenshots/staff-queue | tablet.png | 244,592 | Tablet | PR #62 |
| screenshots/staff-queue | mobile.png | 129,137 | Mobile | PR #62 |
| screenshots/staff-ticket-detail | desktop.png | 71,314 | Desktop | PR #62 |
| screenshots/staff-ticket-detail | tablet.png | 195,339 | Tablet | PR #62 |
| screenshots/staff-ticket-detail | mobile.png | 147,688 | Mobile | PR #62 |
| screenshots/user-management | desktop.png | 67,361 | Desktop | PR #62 |
| screenshots/user-management | tablet.png | 167,140 | Tablet | PR #62 |
| screenshots/user-management | mobile.png | 122,461 | Mobile | PR #62 |

Total existing screenshots: 12 files across 4 folders.

## 2. Coverage by Report Part

PARTS 1-4 and 9: Zero existing screenshots. All evidence must be newly captured.

PART 5 (Login/Password Change):
- authentication/desktop.png - PARTIAL: Only 12KB, likely shows login empty state only. Need validation errors, inactive account, Change Password screen, app shell, logout.
- authentication/tablet.png and mobile.png - PARTIAL: Same limitations.
- MISSING: Invalid credentials, inactive account, Change Password screen, all validation states, app shell, session/cookie evidence, password hash evidence.

PART 6 (Staff Queue):
- staff-queue/desktop.png, tablet.png, mobile.png - PARTIAL: Happy path only. No search/filter/sort/pagination/error states.
- MISSING: Search results, filter active, sort active, pagination, loading/empty/no-results, forbidden (Requester), API 403 evidence.

PART 7 (Staff Ticket Detail):
- staff-ticket-detail/desktop.png, tablet.png, mobile.png - PARTIAL: Happy path only.
- MISSING: Claim/assign, IT Priority change, status transitions, Public Comments, Internal Notes, Requester note visibility, Problem Appears Resolved, requester regression, direct API 401/403 evidence.

PART 8 (Admin User Management):
- user-management/desktop.png, tablet.png, mobile.png - PARTIAL: Happy path only.
- MISSING: Create user, edit user, duplicate email, deactivate/reactivate, reset password sequence, last admin safety rules, forbidden non-admin.

## 3. Quality Issues

- authentication/desktop.png is only 12,792 bytes - unusually small for a 1440x900 desktop screenshot. Flagged for visual inspection.
- All existing screenshots use flat filenames (desktop.png) not the new P{part}-F{nn}_{desc}_{viewport}.png convention. Existing files preserved; new captures use new convention.
- No existing screenshot shows any error, loading, empty, or edge-case state.

## 4. Count Summary

| Category | Count |
|----------|-------|
| Existing files | 12 |
| Parts with partial coverage | 4 (Parts 5-8) |
| Parts with zero coverage | 5 (Parts 1-4, 9) |
| New screenshots needed (estimate) | 40+ |
