# UI Specification: Sprint 4 (TokTikIT — Lab 4)

This document defines the UI design and structural specifications for the Sprint 4 (Lab 4) increment. It builds upon the Zen Green design language established in Labs 1–3 and covers all new screens and component extensions required for **Actions Taken (Service Actions)**, **Role-Tailored Dashboards**, **Ticket Workflow Status Transitions**, and **Responsive Accessibility** requirements.

> **Source of truth:** `docs/lab-04/specification.md` (engineering spec) and `docs/lab-04/api-spec.md` (API contracts). Approved engineering decisions are recorded in `specification.md`; this UI spec implements those decisions consistently.

---

## 1. UI Overview & Navigation

### 1.1 Screen Inventory

| Screen | Route | New in Lab 4? | Notes |
|---|---|:---:|---|
| Login | `/login` | No | Unchanged from Lab 3 |
| Mandatory Password Change | `/change-password` | No | Unchanged from Lab 3 |
| Requester Dashboard | `/requester-dashboard` | **Yes** | New screen |
| My Tickets (Requester) | `/my-tickets` | No | Extended: accepts new query params |
| Create Ticket | `/create-ticket` | No | Unchanged |
| Requester Ticket Detail | `/tickets/:id` | No | Extended: Service Actions tab activated |
| IT Staff Dashboard | `/staff-dashboard` | **Yes** | New screen |
| Staff Ticket Queue | `/staff-queue` | No | Extended: accepts new query params |
| Staff Ticket Detail | `/staff/tickets/:id` | No | Extended: Actions Taken panel + status workflow |
| User Management | `/user-management` | No | Unchanged; Admin only |

### 1.2 Navigation Shell Changes (`AppLayout.tsx`)

The navigation bar must become **role-aware** in Lab 4, conditionally rendering links based on `user.role`.

#### Requester Navigation

| Link Label | Route | Condition |
|---|---|---|
| Dashboard | `/requester-dashboard` | Always visible for `REQUESTER` |
| My Tickets | `/my-tickets` | Always visible for `REQUESTER` |
| Create Ticket | `/create-ticket` | Always visible for `REQUESTER` |

#### IT Staff Navigation

| Link Label | Route | Condition |
|---|---|---|
| Dashboard | `/staff-dashboard` | Always visible for `IT_STAFF` |
| Ticket Queue | `/staff-queue` | Always visible for `IT_STAFF` |

#### Admin Navigation

| Link Label | Route | Condition |
|---|---|---|
| Staff Dashboard | `/staff-dashboard` | Always visible for `ADMIN` |
| Ticket Queue | `/staff-queue` | Always visible for `ADMIN` |
| User Management | `/user-management` | Always visible for `ADMIN` |

> **Note:** The existing `Health` link in `AppLayout.tsx` is a Lab 1 development artifact. Its visibility in production navigation is not defined by the Sprint 4 specification; no change is required.

### 1.3 Login Redirects (Preserved from Lab 3)

Per `specification.md §13.3.6`, **existing login redirects are preserved** to safeguard Lab 3 E2E test assertions. Dashboard links are accessible via the navigation bar, not via login redirect.

| Role | Post-Login Redirect | Post-Password-Change Redirect |
|---|---|---|
| `REQUESTER` | `/my-tickets` | `/my-tickets` |
| `IT_STAFF` | `/staff-queue` | `/my-tickets` |
| `ADMIN` | `/user-management` | `/my-tickets` |

The Dashboard route is **not** the default post-login landing page. It is reachable via the top navigation link.

### 1.4 Root Redirect (`RootRedirect`)

The existing `RootRedirect` component behavior in `App.tsx` is preserved:
- `REQUESTER` → `/my-tickets`
- `IT_STAFF` → `/staff-queue`
- `ADMIN` → `/user-management`

No change to `RootRedirect` is required by the Sprint 4 specification.

---

## 2. Dashboard UI

### 2.1 Requester Dashboard (`/requester-dashboard`)

**Accessible to:** `REQUESTER` only. Attempting to access while authenticated as `IT_STAFF` or `ADMIN` must display a Zen Green error card (403 Forbidden).

**Data Source:** `GET /api/dashboard/requester` — returns `{ data: { totalTickets, activeTickets, waitingForRequesterTickets, resolvedOrClosedTickets, recentTickets } }`.

#### 2.1.1 Layout

```
+---------------------------------------------------------------+
| Dashboard                               [My Tickets ->]       |
|                                                               |
| +-----------+ +-----------+ +-----------+ +-----------+       |
| | Total     | | Active    | | Waiting   | | Resolved/ |       |
| | Tickets   | | Tickets   | | for Me    | | Closed    |       |
| |    12     | |     4     | |     2     | |     6     |       |
| +-----------+ +-----------+ +-----------+ +-----------+       |
|                                                               |
| Recent & Attention-Required Tickets                           |
| +-----------------------------------------------------------+ |
| | TKT-1001 | VPN disconnects | WAITING_FOR_REQ | High | ... | |
| | TKT-1004 | Switch port fix | RESOLVED        | Med  | ... | |
| +-----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

- Desktop: 4 metric cards in a single responsive row (`col-md-3` each), followed by the full-width Recent & Attention-Required Tickets panel.
- Tablet: 2 x 2 grid for KPI cards; responsive table below.
- Mobile: Stacked cards vertically; table transitions to responsive card rows.

#### 2.1.2 Metric Cards

Each KPI card uses the Zen Green design token palette (`--color-primary: #006B3C`, `--color-pale-green: #EAF6EF`) and is rendered as a **clickable** card (full card is a link, not just a button inside it).

| Card Title | Metric Field | Intended Drill-Down Filter | Metric Status Scope |
|---|---|---|---|
| Total Tickets | `totalTickets` | `/my-tickets` (no filter) | All statuses |
| Active Tickets | `activeTickets` | `/my-tickets?status=NEW,OPEN,IN_PROGRESS` *[requires multi-value support — see note]* | `NEW, OPEN, IN_PROGRESS` |
| Waiting for Me | `waitingForRequesterTickets` | `/my-tickets?status=WAITING_FOR_REQUESTER` | `WAITING_FOR_REQUESTER` |
| Resolved / Closed | `resolvedOrClosedTickets` | `/my-tickets?status=RESOLVED,CLOSED` *[requires multi-value support — see note]* | `RESOLVED, CLOSED` |

> **Metric Definitions (from `api-spec.md §3.1`):**
> - `totalTickets`: All statuses (including `CANCELLED`, `REJECTED`).
> - `activeTickets`: `currentStatus IN ('NEW', 'OPEN', 'IN_PROGRESS')`.
> - `waitingForRequesterTickets`: `currentStatus = 'WAITING_FOR_REQUESTER'`.
> - `resolvedOrClosedTickets`: `currentStatus IN ('RESOLVED', 'CLOSED')` — `CANCELLED` and `REJECTED` excluded.

> **[Implementation Requirement — Drill-Down Multi-Status Filter Gap]** The existing `MyTickets.tsx` status filter (`TicketFilters.status`) accepts a **single** status string. The drill-down targets for **Active Tickets** and **Resolved / Closed** each require filtering on multiple statuses simultaneously. The current implementation does not support this. Lab 4 must extend the `status` parameter to accept a comma-separated multi-value list (e.g., `?status=NEW,OPEN,IN_PROGRESS`) consistently across: the `TicketFilters` interface in `api.ts`, the `MyTickets.tsx` filter handler, and the backend `GET /api/tickets` handler. See **UI-Q7** in §8. The intended URLs in the table above reflect `api-spec.md §3.1` intent; the exact format is an implementation decision.

#### 2.1.3 Recent & Attention-Required Tickets Section
Rendered immediately beneath the KPI cards:
- Displays up to 5 recently updated tickets (`recentTickets`).
- Columns: `Ticket #`, `Title`, `Status` (with badge), `Priority`, `Last Updated`, `Action`.
- Clicking a ticket row or "View Ticket" button navigates directly to `/tickets/:id`.
- Attention callout: Tickets with status `WAITING_FOR_REQUESTER` display an amber badge with tooltip "Requires your input".
- **Empty State:** If the requester has no tickets, renders: *"No recent ticket activity. Submit a new ticket using the Create Ticket button."*

#### 2.1.4 Card Visual Design

```
+--------------------------------------+
|  Total Tickets                       |
|                                      |
|              12                      |   <- Large numeric (font-size: 48px)
|                                      |
|  All your submitted tickets ->       |   <- Subtle caption
+--------------------------------------+
  Background: #EAF6EF  Border: 1px solid #BCE3CE
  Hover: slight shadow lift + border: var(--color-primary)
```

- Card border-radius: 12px.
- Count: `font-size: 48px; font-weight: 700; color: var(--color-primary)`.
- Caption: `font-size: 13px; color: var(--color-text-muted)`.
- Full card is wrapped in `<Link to="...">` to make the entire card navigable.
- Hover: `box-shadow: 0 4px 16px rgba(0,107,60,0.12); border-color: var(--color-primary)`.
- Focus: keyboard focus ring using `outline: 2px solid var(--color-primary); outline-offset: 2px`.

#### 2.1.5 Page States

| State | UI Behavior |
|---|---|
| **Loading** | Skeleton placeholder cards (4 gray shimmer blocks + table skeleton) |
| **Success** | Metric cards rendered with values; recent tickets list populated |
| **Error** | Zen Green error alert with retry button; message: "Unable to load dashboard metrics. Please try again." |
| **All Zeros / Empty State** | Cards render with `0` counts and recent list renders empty-state message |

**Traceability:** `FR-13`, `FR-15`, `FR-23`, `AC-10`, `AC-11`, `AC-20`, `BR-12`, `BR-13`.

---

### 2.2 IT Staff Dashboard (`/staff-dashboard`)

**Accessible to:** `IT_STAFF` and `ADMIN`. `REQUESTER` receives a 403 Forbidden error card.
**Administrator Governance:** Per handout §4.6 and `specification.md §8.3`, Administrator sessions reuse this view with full operational access; user administration is accessed via the existing `/user-management` UI route (backed by `/api/admin/users/*`).

**Data Source:** `GET /api/dashboard/staff` — returns `{ data: { unassignedTickets, myActiveTickets, ticketsRequiringFollowUp, criticalOrHighPriorityTickets, statusBreakdown, recentTickets, currentUserActions } }`.

#### 2.2.1 Layout

```
+-----------------------------------------------------------------------+
|  Staff Dashboard                              [Ticket Queue ->]        |
|                                                                        |
| +----------+ +----------+ +----------+ +------------------------+      |
| |Unassigned| |My Active | |Follow-Up | |Critical / High         |      |
| |   5      | |   3      | |Required  | |Priority    4           |      |
| |          | |          | |   2      | |                        |      |
| +----------+ +----------+ +----------+ +------------------------+      |
|                                                                        |
|  Status Breakdown                                                      |
|  [NEW: 3] [OPEN: 2] [IN_PROGRESS: 5] [WAITING_FOR_REQUESTER: 2]      |
|  [RESOLVED: 8] [CLOSED: 14] [REOPENED: 1] [CANCELLED: 2]             |
|  [REJECTED: 1]                                                         |
|                                                                        |
|  Recent Queue Tickets                  My Recent Actions Taken         |
|  +----------------------------------+  +-----------------------------+ |
|  | TKT-1003 | Core router flap | ...|  | TKT-1001: Replaced cable ...| |
|  +----------------------------------+  +-----------------------------+ |
+-----------------------------------------------------------------------+
```

- Desktop: 4 KPI cards in top row; Status Breakdown badge row; two-column layout below for Recent Queue Tickets and Current-User Actions.
- Tablet: 2 x 2 KPI grid; Status Breakdown wraps; recent tables stack.
- Mobile: Stacked vertically in logical priority order.

#### 2.2.2 Metric Cards

| Card Title | Metric Field | Intended Drill-Down Filter | Metric Scope |
|---|---|---|---|
| Unassigned Tickets | `unassignedTickets` | `/staff-queue?ownerId=unassigned&status=NEW,OPEN` *[requires multi-value status — see note]* | `ownerId IS NULL AND status IN ('NEW','OPEN')` |
| My Active Tickets | `myActiveTickets` | `/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` *[requires `me` alias — see note]* | Owner = current user; active statuses |
| Follow-Up Required | `ticketsRequiringFollowUp` | `/staff-queue?followUpRequired=true&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` *[new filter required — see note]* | Distinct unresolved tickets with ≥1 follow-up action |
| Critical / High Priority | `criticalOrHighPriorityTickets` | `/staff-queue?itPriority=CRITICAL,HIGH&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` *[requires multi-value support — see note]* | `itPriority IN ('CRITICAL','HIGH')` AND unresolved |

> **[Implementation Requirements — Staff Drill-Down Filter Gaps]** The intended drill-down URLs above are based on `api-spec.md §3.2`. None of them are fully supported by the current `StaffTicketFilters` interface in `api.ts` or the `StaffTicketQueue.tsx` component. Each gap is a **new Lab 4 implementation requirement**:
> - **Unassigned Tickets** (`ownerId=unassigned`): `StaffTicketFilters.ownerId` already accepts `'unassigned'` in `api.ts`. However, the companion `status=NEW,OPEN` requires multi-value status support, which does not exist in the current filter. Both `StaffTicketQueue.tsx` (to read URL params on mount) and `GET /api/staff/tickets` (to accept multi-value status) must be extended.
> - **My Active Tickets** (`ownerId=me`): The literal string `'me'` is **not** in `StaffTicketFilters` (only `'unassigned'` or a UUID). The dashboard component must either resolve `me` to `user.id` before navigating, or `StaffTicketQueue.tsx` must map `ownerId=me` to the authenticated user's ID. The drill-down must also apply the active-status set `OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`; otherwise it would include the user's resolved and terminal tickets and would not match the metric.
> - **Follow-Up Required** (`followUpRequired=true`): This parameter does **not** exist in `StaffTicketFilters` or in `GET /api/staff/tickets`. Adding this drill-down requires extending both the frontend filter type and the backend staff queue endpoint. It must be combined with the unresolved-status filter so the result set matches the dashboard metric.
> - **Critical / High Priority** (`itPriority=CRITICAL,HIGH`): `StaffTicketFilters.itPriority` currently maps to a single value. The metric covers two values; a single-value drill-down would be incomplete and misleading. Multi-value `itPriority` support must be added consistently in `api.ts`, `StaffTicketQueue.tsx`, and `GET /api/staff/tickets`; the drill-down must also include the unresolved-status set so resolved/terminal high-priority tickets are excluded. See **UI-Q8** in §8.

> **Distinct Count Note (from `api-spec.md §3.2`):** `ticketsRequiringFollowUp` is `COUNT(DISTINCT t.id)`. A ticket with multiple `followUpRequired=true` Action Taken records counts as **1** in this metric (`AC-13`).

#### 2.2.3 Status Breakdown Section

Rendered below the KPI cards as a row of clickable status badges.

- Each badge: `<button>` or `<Link>` styled as a pill badge.
- Label: `{STATUS_NAME}: {count}` (e.g., `IN_PROGRESS: 5`).
- Clicking navigates to `/staff-queue?status={STATUS_NAME}`.
- Includes all nine statuses: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, and `REJECTED` (Lab 3 backward compatibility — `api-spec.md §3.2`).
- Badge colors reuse the same status badge palette as the ticket queue.

#### 2.2.4 Recent Queue Tickets & Current-User Actions Section

Rendered below Status Breakdown in a two-column responsive grid:
1. **Recent Queue Tickets (`recentTickets`):**
   - Displays up to 5 recently updated tickets in the queue, sorted by `updatedAt DESC` (recency-only sorting per `api-spec.md §3.2` and `specification.md §8.2`).
   - Shows Ticket Number, Priority badge, Status badge, Assignee, and direct link to `/staff/tickets/:id`.
   - Empty state: *"No recent tickets in queue."*
2. **My Recent Actions Taken (`currentUserActions`):**
   - Displays up to 5 recent service actions performed by or assigned to the logged-in technician.
   - Shows Ticket Number, Action Date/Time, Description snippet, Result, and Follow-up badge.
   - Clicking an action card routes directly to the ticket's Actions Taken section.
   - Empty state: *"No actions recorded yet. Open a ticket to record your first service action."*

#### 2.2.5 Page States

| State | UI Behavior |
|---|---|
| **Loading** | Skeleton placeholder cards and table shimmers |
| **Success** | Metrics rendered; recent tickets and actions lists populated |
| **Error** | Zen Green error alert with retry button |
| **Zero Count / Empty State** | Valid data, displayed as `0`; empty lists show informative guidance |

**Traceability:** `FR-14`, `FR-16`, `FR-23`, `AC-12`, `AC-13`, `AC-20`, `BR-12`, `BR-16`.

---

## 3. Actions Taken (Service Actions) UI

### 3.1 Requester View — Service Actions Tab

**Location:** Within `RequesterTicketDetail` (`/tickets/:id`), the existing disabled "Service Actions (0)" tab (currently present in the UI but disabled) must be **activated** for Lab 4.

**Accessible to:** `REQUESTER` (own tickets only). For tickets not owned by the requester, the API returns 404; the UI shows the standard error state.

**Data Source:** `GET /api/tickets/:id/actions-taken` (sorted by `actionDateTime ASC` by default).

#### 3.1.1 Tab Header

```
[Public Comments (n)] [Attachments (n)] [Service Actions (n)] [Event Log (0)]
```

- Tab label: `Service Actions (n)` where `n` is the count of loaded records.
- The "Event Log" tab remains disabled (no backend endpoint exists in Lab 4).
- Default active tab on page load: no change to existing Lab 3 behavior (currently defaults to "attachments"); preserving existing behavior to safeguard regression tests (see UI-Q2 in §8).

#### 3.1.2 Service Actions List (Read-Only)

Each Action Taken record is displayed as a **read-only card** in chronological order (`actionDateTime ASC`).

```
+------------------------------------------------------------+
|  Action Taken                          Oct 30, 2026 10:15  |
|  Performed by: Staff Technician One  [IT_STAFF]            |
|  Assigned to:  Staff Technician Two  [IT_STAFF]            |
|                                                            |
|  Description                                               |
|  ----------------------------------------------------------
|  Replaced damaged CAT6 cable and verified link.            |
|                                                            |
|  Result                                                    |
|  ----------------------------------------------------------
|  Link stable; ping latency < 1ms.                          |
|                                                            |
|  [ No follow-up required ]                                 |
|                                                            |
|  Attachment Notes: Referenced test report: port14.log      |
+------------------------------------------------------------+
```

**Card fields displayed:**

| Field | Display Label | Notes |
|---|---|---|
| `actionDateTime` | Timestamp in card header | Formatted as locale date-time string |
| `performedBy.fullName` | `Performed by:` | Server-provided; creator attribution (display only) |
| `performedBy.role` | Creator role badge | Rendered as small role badge beside creator name |
| `assignedTo.fullName` | `Assigned to:` | Approved assignee; display only ("Unassigned" if null) |
| `assignedTo.role` | Assignee role badge | Rendered as small role badge beside assignee name |
| `description` | `Description` | Pre-wrapped text block |
| `result` | `Result` | Pre-wrapped text block |
| `followUpRequired` | Follow-Up indicator | Green pill "No follow-up required" / Amber pill "Follow-up required" |
| `followUpNote` | `Follow-Up Note` | Shown only when `followUpRequired === true` and `followUpNote` is non-null |
| `attachmentNotes` | `Attachment Notes` | Shown only when non-null / non-empty |

> **Distinct Roles for `performedBy` and `assignedTo`:** `performedBy` captures the authenticated user who recorded the action. `assignedTo` captures the approved technician assigned responsibility for the action (`AC-01`, `FR-21`, `BR-01`). Both are displayed clearly on the card. `performedBy` is immutable and never user-editable (`BR-02`).

**No create or edit controls** are rendered for `REQUESTER`. The tab is strictly read-only (`AC-05`, `BR-03`, `FR-06`, `FR-07`).

#### 3.1.3 Empty State (No Actions Taken)

When the ticket has zero Actions Taken records:

```
+--------------------------------------------------+
|                                                  |
|      No service actions recorded yet.            |
|  IT Staff will log actions as work progresses.   |
|                                                  |
+--------------------------------------------------+
```

- Centered placeholder text within the tab panel.
- No call-to-action button (Requesters cannot create actions).

#### 3.1.4 Loading & Error States

| State | Behavior |
|---|---|
| **Loading** | Spinner centered within the tab panel |
| **Error** | Inline alert: "Unable to load service actions. Please try again." with a retry link |
| **Empty** | Empty-state message as described in §3.1.3 |

**Traceability:** `FR-06`, `FR-07`, `FR-21`, `AC-05`, `AC-17`, `BR-01`, `BR-03`, `BR-15`.

---

### 3.2 IT Staff / Admin View — Actions Taken Panel

**Location:** Within `StaffTicketDetail` (`/staff/tickets/:id`).

**Accessible to:** `IT_STAFF` and `ADMIN` — full read + create + edit.

**Data Source (Read):** `GET /api/tickets/:id/actions-taken`

**Data Source (Create):** `POST /api/tickets/:id/actions-taken`

**Data Source (Update):** `PATCH /api/actions-taken/:actionId`

#### 3.2.1 Panel Location in Staff Ticket Detail

The Actions Taken panel is added as a dedicated section below the Activity & Communication feed within `StaffTicketDetail`. On desktop (two-column layout), it occupies the full width of the left column (below the activity feed). (See UI-Q4 in §8).

> **Lifecycle Status Clarification (Part 6 Demonstrations):** Action Taken records do **NOT** have their own lifecycle status field or status transition controls (no `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`). Actions Taken are historical activity records. The Part 6 rubric operations ("status transition, complete, cancel") operate on the **Ticket as a whole** via the Operations panel status dropdown (§4.2). The Actions Taken panel provides List, Create, Assign, Edit, and validation controls for technical interventions, while Ticket completion (`RESOLVED`, `CLOSED`) and cancellation (`CANCELLED`) are managed via the Ticket Workflow in Section 4.

#### 3.2.2 Panel Header

```
+---------------------------------------------------------------+
|  Service Actions (n)                 [+ Add Action Taken]     |
+---------------------------------------------------------------+
```

- Count `(n)` updates after each create or edit operation.
- `[+ Add Action Taken]` button is visible to `IT_STAFF` and `ADMIN` only.
- Button is **disabled** when the ticket is in a terminal status (`CLOSED`, `CANCELLED`, `REJECTED`), consistent with `BR-08` and terminal state immutability (see UI-Q3 in §8).

#### 3.2.3 Actions Taken List (Staff View)

Each record is displayed as a card, identical to the Requester view (§3.1.2), but with an additional **Edit** button in the card header and an expandable **Revision History** section.

```
+------------------------------------------------------------+
|  Action Taken #1   Oct 30, 2026 10:15               [Edit] |
|  Performed by: Staff Technician One  [IT_STAFF]            |
|  Assigned to:  Staff Technician Two  [IT_STAFF]            |
|  Description:  Replaced damaged CAT6 cable                 |
|  Result:       Gigabit link negotiated                     |
|  [v View Revision History (2)]                             |
|  +-------------------------------------------------------+ |
|  | Revision 2: Oct 30, 10:30 by Staff Technician Two     | |
|  | - Result: 'Link negotiated' -> 'Gigabit link neg...'  | |
|  | Revision 1: Oct 30, 10:15 by Staff Technician One     | |
|  | - Initial record creation                             | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

- `[Edit]` button is rendered as `btn-outline-secondary` (small).
- Clicking `[Edit]` opens the **Edit Action Taken Modal** (§3.2.5) pre-populated with the record's current data.
- **Revision History Expansion:** If `revisions.length > 0`, an expandable toggle button displays the number of revisions. Clicking expands an immutable timeline of prior edits, showing revision number, editor name, timestamp, and modified values.
- `performedBy` permanently displays the original author (`performedById`) and cannot be altered.

#### 3.2.4 Add Action Taken — Modal Form

Triggered by clicking `[+ Add Action Taken]`.

**Modal title:** "Record Action Taken"

**Form fields:**

| Field | Input Type | Required | Validation |
|---|---|:---:|---|
| Action Date/Time | `datetime-local` | No (defaults to now) | Cannot exceed server time by > 5 minutes |
| Assigned To | `<select>` dropdown | No (Optional) | List of active `IT_STAFF` and `ADMIN` users from `GET /api/staff/assignees`. Server validates active status and role (`BR-01`, `AC-17`). Defaults to **unassigned (null)** when not selected. |
| Description | `<textarea rows={4}>` | **Yes** | Non-empty. 5–3,000 chars |
| Result | `<textarea rows={3}>` | **Yes** | Non-empty. 2–1,000 chars |
| Follow-Up Required | `<input type="checkbox">` | **Yes** (defaults unchecked) | Boolean |
| Follow-Up Note | `<textarea rows={2}>` | **Conditional** | **Mandatory and non-empty when Follow-Up Required is checked**. Max 1,000 chars |
| Attachment Notes | `<textarea rows={2}>` | No | Max 1,000 chars |
| Performed By | Read-only display | — | Server-derived from session (`performedById`); shows authenticated user's name + role. Not an input field. (`BR-02`, `FR-02`, `AC-03`) |

> **Distinct Roles for `performedBy` and `assignedTo`:** `performedBy` is always derived on the server from the authenticated session (`BR-02`, `AC-03`). `assignedTo` is selected from active IT Staff / Admin members (`BR-01`, `AC-17`).

**Conditional Field Behavior:**
- When `followUpRequired` checkbox is **unchecked**: Follow-Up Note field is disabled (greyed out) and its value is cleared.
- When `followUpRequired` checkbox is **checked**: Follow-Up Note field becomes enabled with a red asterisk (*) and is required.

**Validation Error Display:**
- Inline red text below each offending field (`color: var(--color-danger)`).
- Border of the offending input turns red (`border-color: var(--color-danger)`).
- `aria-describedby` linking each input to its error message element (accessibility).

**Form Submission & Form Resilience:**
- Submit button label: "Record Action"
- **Submit Button In-Flight State:** While request is in-flight (`isSubmitting === true`), the submit button is disabled and displays a loading spinner to prevent repeated clicks and duplicate submissions (`FR-25`, `BR-14`, `AC-19`).
- **Form State Retention on Failure:** If submission fails due to client validation error (HTTP 400), inactive assignee rejection (HTTP 400 `INACTIVE_ASSIGNEE`), concurrency conflict (HTTP 409), or network/server error (HTTP 500), the form modal remains open and all user-entered data (`description`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `assignedToId`) is **preserved in React component state**. The technician does NOT lose entered data and can correct input or retry immediately without re-entering any field (`FR-24`, `AC-19`).
- **Network Retry Resilience:** The client creates one `Idempotency-Key` UUID for each logical create submission and retains that same key together with the unchanged payload if the request outcome is uncertain (timeout or dropped response).
- On **success** (HTTP 201): Modal closes, form state resets, panel list refreshes, green success toast displayed: "Action Taken recorded successfully."
- On **error** (HTTP 400): Validation errors shown inline. If server returns a specific code (`INACTIVE_ASSIGNEE`, `INVALID_ASSIGNEE_ROLE`), display an alert above the form: "Selected assignee is inactive or unauthorized. Please select an active IT Staff member."
- On **error** (HTTP 500/network): Modal-level error alert: "Failed to record action due to network error. Form data has been preserved. Please retry."

**Modal accessibility:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to modal title.
- Focus trapped within modal while open.
- `Escape` key closes modal (resets form without saving).

#### 3.2.5 Edit Action Taken — Modal Form

Triggered by clicking `[Edit]` on an existing record.

**Modal title:** "Edit Action Taken"

- Pre-populated with existing record values, including `assignedToId`.
- Assigned To dropdown allows reassigning the action to another active IT Staff or Admin technician (`FR-21`, `AC-17`).
- **Optimistic Concurrency:** The `PATCH /api/actions-taken/:actionId` request MUST include `expectedUpdatedAt` copied from the record's `updatedAt` value when it was fetched. If the server returns `409 STALE_UPDATE`, preserve the draft and prompt the user to reload/reconcile before retrying.
- **Append-only Revision Warning:** The modal displays an informational notice: *"Edits to this action will be recorded in the append-only revision history. The original author and previous revisions are permanently preserved."*
- `Performed By` displayed as read-only (original author from server, not the editing user's name; `performedById` is immutable).
- Form resilience applies identically: entered edits are preserved in component state upon failure (`FR-24`, `AC-19`).
- Submit button label: "Save Changes"
- On **success** (HTTP 200): Modal closes, panel list refreshes, success toast: "Action Taken updated successfully."
- On **error** (HTTP 400): Validation errors shown inline.
- On **error** (HTTP 409 `STALE_UPDATE`): Modal-level alert: "This action was updated by another user. Please reload the page to see the latest version before editing." Form data is preserved so the user does not lose their draft.
- Error states for 500/network: same as create modal.

> **Absolute Deletion Prohibition:** **No Delete button** is rendered anywhere in the UI. Actions Taken records can be **edited** by `IT_STAFF` and `ADMIN` (via the Edit modal above), but they **cannot be deleted** through the API or the UI. Each edit updates the current record and appends an immutable entry to its **Revision History** (`ActionTakenRevision`). The Revision History is strictly append-only: previous revisions are always retained and can never be modified or deleted. (`BR-05` in `specification.md`; `api-spec.md §2.2`)

#### 3.2.6 Empty State (No Actions Taken — Staff View)

```
+--------------------------------------------------+
|                                                  |
|  No service actions recorded for this ticket.   |
|  [+ Add the first Action Taken]                  |
|                                                  |
+--------------------------------------------------+
```

The call-to-action link/button opens the Add Action Taken modal.

**Traceability:** `FR-01`, `FR-02`, `FR-03`, `FR-04`, `FR-05`, `FR-20`, `FR-21`, `FR-24`, `FR-25`, `AC-01`, `AC-03`, `AC-04`, `AC-06`, `AC-17`, `AC-19`, `BR-01`, `BR-02`, `BR-04`, `BR-05`, `BR-14`.

---

## 4. Ticket Workflow UI

### 4.1 Current Status Display

The ticket's `currentStatus` is displayed prominently in both Requester and Staff detail views using color-coded status badges. The existing `STATUS_BADGE_COLORS` mapping in `StaffTicketDetail.tsx` covers all required statuses:

| Status | Badge Color |
|---|---|
| `NEW` | Info / teal |
| `OPEN` | Primary / blue |
| `IN_PROGRESS` | Warning / orange |
| `WAITING_FOR_REQUESTER` | Secondary / gray |
| `RESOLVED` | Success / green |
| `CLOSED` | Dark / black |
| `REOPENED` | Danger / red-orange |
| `CANCELLED` | Secondary / muted gray |
| `REJECTED` | Danger / red (Lab 3 legacy) |

### 4.2 Status Transition Controls (IT Staff / Admin Only)

**Location:** Operations Panel (right sidebar) in `StaffTicketDetail`.

**Existing implementation in Lab 3:** A `<select>` dropdown showing permitted next statuses, with a "Change" button. This mechanism is preserved in Lab 4.

**Data Source:** `PATCH /api/staff/tickets/:id/status` with body `{ status, rejectionReason? }`.

#### 4.2.1 Permitted Transitions (Frontend Dropdown Population)

The frontend displays **all and only** the permitted next statuses for the Ticket's current status, using the approved workflow matrix in `specification.md §6.1`. The backend independently validates every transition; hiding an option in the UI is not an authorization or validation boundary.

| Current Status | Permitted Transitions |
|---|---|
| `NEW` | `OPEN`, `CANCELLED`, `REJECTED` |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `OPEN`, `CANCELLED` |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` |
| `RESOLVED` | `CLOSED`, `REOPENED` |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` |
| `CLOSED` | *(none — Terminal)* |
| `CANCELLED` | *(none — Terminal)* |
| `REJECTED` | *(none — Terminal; Lab 3 legacy)* |

**Resolution Gate UI Behavior (Team-approved Business Rule — `BR-10`):**
- **Approved Business Rule:** A Ticket can transition to `RESOLVED` only if it has at least one persisted `ActionTaken` record (`COUNT(actionsTaken) >= 1`).
- **Authoritative Backend Enforcement:** If no `ActionTaken` record exists for the ticket, the backend authoritatively rejects the transition with HTTP `400 Bad Request` and error code `ACTION_TAKEN_REQUIRED`.
- **Supplementary Frontend Validation:** `RESOLVED` is listed in the status dropdown for permitted predecessor statuses. If the ticket has zero recorded actions taken, the UI displays a supplementary validation warning prompting the technician that at least one Action Taken must be recorded first. However, the backend is the authoritative enforcement point.
- **Follow-Up Non-Blocking:** The presence of `followUpRequired = true` on any Action Taken does **not** prevent a Ticket from transitioning to `RESOLVED`. Outstanding follow-ups remain visible as follow-up obligations without blocking ticket resolution.
- **Terminal States:** When the current status is terminal (`CLOSED`, `CANCELLED`, `REJECTED`), no status dropdown or Change button is shown. Assignment and IT Priority controls are also disabled/hidden per `BR-08`.
- **Rejection Compatibility:** `REJECTED` is available only from `NEW` and invokes the existing rejection-reason modal required by Lab 3 compatibility.

## 5. Responsive Design & Accessibility

### 5.1 Breakpoints (Inherited from Lab 3 `ui-spec.md §4`)

| Breakpoint | Width | Layout Rules |
|---|---|---|
| **Desktop** | > 1024px | Side-by-side layouts, full data tables, persistent top nav |
| **Tablet** | 768px – 1024px | Fluid widths, minor column hiding, narrower sidebars remain visible |
| **Mobile** | < 768px | Stacked layouts, table to cards, hamburger nav, full-screen modals |

### 5.2 Dashboard Responsive Rules

- **Desktop:** 4-column KPI card grid (25% each).
- **Tablet:** 2 x 2 grid (`col-sm-6`).
- **Mobile:** 1 card per row (`col-12`), stacked.
- Status Breakdown badges: wrap naturally on all breakpoints. Each badge maintains a min-width to prevent label truncation.

### 5.3 Actions Taken Responsive Rules

- **Desktop / Tablet:** Action cards displayed at full width within the panel.
- **Mobile:** Cards stack vertically. Modal forms take up full screen height.
- **Add/Edit Modal on Mobile:** Full-screen modal (`modal-fullscreen-sm-down`). Textareas expand to fill available height.

### 5.4 Touch Targets

All interactive elements (buttons, clickable cards, tab buttons, modal close buttons) must maintain a minimum touch target size of **44 x 44px** (`specification.md §12 DoD point 5`).

### 5.5 Keyboard Navigation

- All interactive elements reachable via `Tab` key in logical DOM order.
- Modals trap focus: `Tab` cycles through modal-internal focusable elements; `Shift+Tab` reverses.
- `Escape` closes open modals and resets form state without saving.
- Dashboard KPI cards focusable as links with visible focus ring.
- Status Breakdown badges focusable as buttons/links.

### 5.6 Form Labels & Accessible Error Feedback

- Every form input has an associated `<label>` with `htmlFor` matching the input's `id`.
- Required fields marked with `aria-required="true"`.
- Error messages use `role="alert"` or `aria-live="polite"` so screen readers announce them on appearance.
- Each input with an error has `aria-invalid="true"` and `aria-describedby` pointing to the error message element's `id`.
- Follow-Up Note conditional visibility: when the field transitions from disabled to required, focus is moved to it programmatically.

### 5.7 Color & Contrast

- All text and UI elements use the existing Zen Green design token palette from `index.css`.
- Error states use `var(--color-danger)` (`#D32F2F`) on a light background (`var(--color-danger-bg): #FDF2F2`).
- Warning states use `var(--color-warning)` (`#B45309`) on `var(--color-warning-bg): #FEF3C7`.
- Do not rely on color alone to communicate state (use icons or labels alongside color).

### 5.8 ARIA Roles for Key Components

| Component | ARIA Role / Attribute |
|---|---|
| Dashboard page | Content inside the `<main>` landmark that `AppLayout` already provides (no second `<main>`); sections use `aria-labelledby` headings |
| KPI card (clickable link) | `<a>` with `aria-label` describing the metric and destination |
| Add/Edit Action Taken Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title-id"` |
| Status Breakdown badge buttons | `role="button"` or `<a>` with descriptive `aria-label` |
| Inline form errors | `role="alert"` |
| Tab panel navigation | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls` |

---

## 6. UI Traceability Matrix

Maps UI behaviors to Functional Requirements (FR), Business Rules (BR), and Acceptance Criteria (AC) from `specification.md`.

| Screen / Component | UI Behavior | FR | BR | AC |
|---|---|---|---|---|
| Requester Dashboard (`/requester-dashboard`) | Displays 4 metric KPI cards from backend | FR-13, FR-15 | BR-12, BR-13 | AC-10 |
| Requester Dashboard — KPI Card Click | Navigates to `/my-tickets` with status filter | FR-15 | BR-12 | AC-11 |
| Requester Dashboard — Recent & Resolved Lists | Shows recently updated tickets (single `recentTickets` list sorted by `updatedAt DESC`; attention callout for `WAITING_FOR_REQUESTER` and `RESOLVED` items) | FR-15 | BR-12 | AC-20 |
| IT Staff Dashboard (`/staff-dashboard`) | Displays 4 metric KPI cards from backend, plus the status-breakdown badges | FR-14, FR-16 | BR-12 | AC-12 |
| IT Staff Dashboard — `ticketsRequiringFollowUp` | Distinct ticket count; 1 ticket with N follow-up actions = 1 | FR-16 | BR-12 | AC-13 |
| IT Staff Dashboard — Status Breakdown | Clickable badges for all 9 statuses incl. REJECTED | FR-16 | BR-12 | — |
| IT Staff Dashboard — Recent Urgent & Actions Lists | Shows recent queue tickets (sorted by `updatedAt DESC`) and current-user actions | FR-16 | BR-12 | AC-20 |
| Administrator Dashboard — IT Staff Reuse | Reuses staff dashboard with Admin governance banner | FR-16 | BR-16 | — |
| Navigation — Dashboard Link (Requester) | Visible for REQUESTER only in nav bar | FR-15 | — | — |
| Navigation — Dashboard Link (Staff/Admin) | Visible for IT_STAFF and ADMIN in nav bar | FR-16 | — | — |
| Navigation — Login Redirects | Preserved from Lab 3 | FR-19 | — | AC-16 |
| RequesterTicketDetail — Service Actions Tab | Activated (no longer disabled); shows read-only list | FR-06 | BR-03 | AC-05 |
| RequesterTicketDetail — Service Actions List | `performedBy` and `assignedTo` displayed; no edit controls | FR-06, FR-07, FR-21 | BR-01, BR-02, BR-03 | AC-05, AC-17 |
| RequesterTicketDetail — Empty Actions State | Placeholder text; no create button | FR-07 | BR-03 | AC-05 |
| StaffTicketDetail — Actions Taken Panel | Displays list + [+ Add Action Taken] button | FR-01, FR-04 | BR-01 | AC-01, AC-06 |
| Add Action Taken Modal — Assignee Selection | Select active IT Staff/Admin assignee from dropdown | FR-21 | BR-01 | AC-01, AC-17 |
| Add Action Taken Modal — Inactive Assignee Rejection | UI error alert on inactive/invalid role submission | FR-21 | BR-01 | AC-17 |
| Add Action Taken Modal — `performedBy` | Read-only display from session; not a form field | FR-02 | BR-02 | AC-03 |
| Add Action Taken Modal — `followUpNote` | Required when `followUpRequired=true` | FR-03 | BR-04 | AC-01 |
| Add Action Taken Modal — Requester blocked | No UI for create (403 at API level; no button rendered) | FR-07 | BR-03 | AC-02 |
| Edit Action Taken Modal | Pre-populated; editable assignee; immutable `performedBy` | FR-04, FR-21 | BR-01, BR-02, BR-04 | AC-04, AC-17 |
| Add/Edit Action Modal — Form State Resilience & Button Disabling | Form state preserved on failure; button disabled in-flight | FR-24, FR-25 | BR-14 | AC-19 |
| No Delete Action Taken | No delete button on any role's view; records are editable but never deletable | — | BR-05 | — |
| StaffTicketDetail — Status Dropdown | All transitions in the approved matrix shown; unlisted transitions hidden | FR-08, FR-09, FR-10, FR-11 | BR-06, BR-08 | AC-07, AC-08, AC-09 |
| StaffTicketDetail — Backend Resolution Gate Alert | Displays clear error banner when no Action Taken exists and resolution is attempted | FR-08, FR-22 | BR-10 | AC-18 |
| StaffTicketDetail — REJECTED Modal | Preserved rejection-reason modal behavior (Lab 3 legacy) | FR-08 | BR-07 | — |
| StaffTicketDetail — Terminal State | Hides/disables status, assignment, and priority controls per BR-08 | FR-11 | BR-08 | AC-09 |
| StaffTicketDetail — 409 Conflict Alert | Concurrency error message with refresh instruction | — | BR-14 | AC-15 |
| RequesterTicketDetail — "Problem Appears Resolved" | Preserved from Lab 3; does not change status | — | BR-11 | — |
| All screens — Loading states | Skeleton / spinner | FR-19 | — | AC-16 |
| All screens — Error states | Zen Green error card with retry | FR-19 | — | AC-16 |
| All forms — Accessible labels and error feedback | `htmlFor`, `aria-invalid`, `aria-describedby`, `role="alert"` | — | — | — |

---

## 7. Design System Additions (Zen Green — Lab 4)

The following additions extend the existing Zen Green design tokens (`index.css`) for Lab 4 components. These are additive and do not modify any existing Lab 1–3 CSS tokens.

### 7.1 New Badge States

| Badge Purpose | Background | Text Color | Border |
|---|---|---|---|
| Follow-Up Required (amber) | `#FEF3C7` | `#B45309` | `#FDE68A` |
| No Follow-Up (green) | `#EAF6EF` | `#006B3C` | `#BCE3CE` |
| `REOPENED` status | `#FEE2E2` | `#B91C1C` | `#FECACA` |
| `WAITING_FOR_REQUESTER` | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` |

### 7.2 KPI Metric Card Tokens

```css
.metric-card {
  background-color: var(--color-pale-green); /* #EAF6EF */
  border: 1px solid #BCE3CE;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  text-decoration: none;
  display: block;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.metric-card:hover,
.metric-card:focus {
  box-shadow: 0 4px 16px rgba(0, 107, 60, 0.12);
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.metric-card__count {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.metric-card__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-main);
}

.metric-card__caption {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}
```

### 7.3 Action Taken Card Tokens

Action Taken cards within both the Requester and Staff views use a clean surface card with a Zen Green left accent border:

```css
.action-taken-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  border-left: 4px solid var(--color-secondary);
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.action-taken-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.action-taken-card__performer {
  font-size: 13px;
  color: var(--color-text-muted);
}
```

---

## 8. Remaining UI Design Decisions

The following presentation choices remain implementation-level decisions; they do not affect the approved Ticket workflow matrix or Resolution Gate:

| # | Decision | Current Baseline | Reference |
|---|---|---|---|
| **UI-Q1** | Should the Requester Dashboard become the default post-login landing page for Requesters, replacing `/my-tickets`? | **Preserve `/my-tickets` redirect** to safeguard Lab 3 E2E assertions. Dashboard accessible via nav. | `specification.md §13.3.6` |
| **UI-Q2** | Should the "Service Actions" tab become the default active tab in `RequesterTicketDetail`? | Current default is "attachments". | `ui-spec.md §3.1.1` |
| **UI-Q3** | Should the `[+ Add Action Taken]` button be disabled for terminal-status tickets at the UI layer? | **Proposed:** Disable button when ticket is `CLOSED`, `CANCELLED`, or `REJECTED`, consistent with `BR-08`. | `specification.md §BR-08` |
| **UI-Q4** | Should Actions Taken panel be a dedicated section below the activity feed, or a new tab within the existing tab structure? | **Proposed:** Dedicated section below the activity feed. | `ui-spec.md §3.2.1` |
| **UI-Q6** | Are the proposed field validation length limits acceptable? | **Enforced as proposed constraints** to prevent obviously invalid payloads and database overflow. | `specification.md §13.3.4`, `BR-04` |
| **UI-Q7** | How should the `MyTickets` page accept multi-status filter values from dashboard drill-downs (Active Tickets: `NEW,OPEN,IN_PROGRESS`; Resolved/Closed: `RESOLVED,CLOSED`)? | Multi-value status filter is **not** in the current `TicketFilters` type. Implementation must add support. See §2.1.2 Implementation Requirement note. | `api-spec.md §3.1`, `specification.md §FR-15` |
| **UI-Q8** | How should `StaffTicketQueue` handle the three unsupported drill-down filters: `ownerId=me`, `followUpRequired=true`, and multi-value `itPriority`? | None of these are in the current `StaffTicketFilters` type or `GET /api/staff/tickets` handler. All three are **new Lab 4 implementation requirements**: (1) `ownerId=me` must resolve to `user.id`; (2) `followUpRequired` must be added to the filter type and backend; (3) `itPriority` must support comma-separated multi-value (e.g., `CRITICAL,HIGH`). See §2.2.2. | `api-spec.md §3.2`, `specification.md §FR-16` |
| **UI-Q10** | Administrator Dashboard Scope: should Admin view include concise user account counts or strictly reuse IT Staff dashboard? | **Approved Decision:** Reuses IT Staff dashboard with an Admin governance header note and full queue visibility (`BR-16`, `FR-16`). | `specification.md §8.3` |
| **UI-Q11** | Does the Part 6 rubric "status transition, complete, cancel" for Actions Taken require an individual `ActionTaken.status` lifecycle field? | **Confirmed Architectural Decision:** Action Taken does **NOT** have an independent status lifecycle. Complete, cancel, and status transitions operate on the parent Ticket via the Operations panel status dropdown (§4.2). Action Taken fields remain strictly aligned with Handout §8.3. | Handout page 11, `specification.md §13.1.9`, `api-spec.md §8` |
