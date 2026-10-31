# TokTikIT — Sprint 4 Engineering Specification (Lab 4)

## 1. Sprint Goal and Stakeholder Request

### 1.1 Sprint Goal
Extend the TokTikIT IT Service Desk platform by delivering structured **Actions Taken (Service Actions)** tracking for IT Staff, formalizing an end-to-end **Ticket Status Transition and Resolution Workflow**, implementing role-tailored **Dashboards with backend-calculated metrics and drill-down navigation** for Requesters and IT Staff, ensuring robust **concurrency and non-destructive data migration**, and maintaining 100% regression compatibility across all Lab 1–3 functionality.

### 1.2 Stakeholder Request
> *"Our IT Service Desk is handling tickets, but technicians currently have no structured way to record individual interventions, maintenance steps, and technical outcomes before resolving a ticket. We need 'Actions Taken' so IT staff can record what work was performed, when, by whom, what resulted, and whether follow-up is needed. The assigned Ticket Owner coordinates the ticket, but any IT technician must be able to log actions taken. Requesters need visibility into these actions on their tickets without being able to modify them. Furthermore, both Requesters and IT Staff need dedicated Dashboards with real-time, backend-calculated metrics and drill-down capabilities so they can prioritize their work and track resolution velocity. All status transitions must follow strict lifecycle rules, all existing data must be safely preserved, and simultaneous updates must not corrupt our database."*

---

## 2. Scope

### 2.1 Included in Scope
1. **Actions Taken (Service Actions) Subsystem:**
   * One-to-many relationship (`Ticket` $\rightarrow$ `ActionTaken`).
   * Attributes: Action Date/Time, Description, Result, Performed by (auto-attributed from session), Approved Assignee (`assignedToId`, optional/nullable, validated against active IT Staff/Admin), Follow-Up Required, Follow-up Note (mandatory when follow-up is required), Attachment Notes.
   * Full Create and Update operations for IT Staff and Administrator.
   * Assignee validation: Inactive users or non-staff users are rejected on assignment (`INACTIVE_ASSIGNEE`, `INVALID_ASSIGNEE_ROLE`).
   * Deletion integrity: Deleting a Ticket must not silently erase its ActionTaken audit history (`onDelete: Restrict`).
   * Collaborative action recording: any active IT Staff member can record an Action Taken, while the Ticket Owner coordinates.
   * Requester read-only visibility into Actions Taken for tickets they own; strict server-side blocking of Requester create/update mutations.
2. **Ticket Status Transition & Resolution Engine:**
   * Server-side enforcement of the status transition matrix across standard handout statuses: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED` (with preserved backward compatibility for existing Lab 3 `REJECTED`).
   * Backend-enforced **Resolution Gate** for transitioning tickets to `RESOLVED` (cannot be bypassed by direct API calls) and terminal state governance (`CLOSED`, `CANCELLED`, `REJECTED`).
   * Audit logging of all status changes via system internal notes.
3. **Role-Tailored Dashboards with Backend-Calculated Metrics, Recent Information & Drill-Down:**
   * **Requester Dashboard:** Total My Tickets, Active Tickets (`NEW`, `OPEN`, `IN_PROGRESS`), Waiting for Requester (`WAITING_FOR_REQUESTER`), and Resolved/Closed Tickets (`RESOLVED`, `CLOSED`). Clickable KPI cards navigate to `/my-tickets` pre-filtered by corresponding criteria. Includes **Recently Updated and Resolved Tickets** list (`recentTickets`).
   * **IT Staff Dashboard:** Unassigned Tickets, My Active Assigned Tickets, Tickets Requiring Follow-Up (distinct tickets with unresolved follow-ups), Critical/High Priority Unresolved Tickets, and Status Breakdown (including `REJECTED` compatibility count). Clickable KPI cards navigate to `/staff-queue` pre-filtered. Includes up to five **most recently updated unresolved queue tickets** (`recentTickets`) with priority shown for urgency context, plus **Current-User Actions Taken** (`currentUserActions`).
   * Dedicated backend metric endpoints (`/api/dashboard/requester`, `/api/dashboard/staff`) performing aggregate SQL queries (`COUNT`) and capped recent item queries without transferring unaggregated ticket collections to the client.
   * **Administrator Dashboard Decision:** Reuses the IT Staff Dashboard layout and endpoint with full operational visibility; user management remains under the existing UI route `/user-management` and API routes `/api/admin/users/*`.
4. **Data Model Migration, Preservation & Testable Recovery:**
   * Prisma schema migration introducing `ActionTaken` with foreign keys to `Ticket` and `User` (`performedBy`, `assignedTo`) without altering or losing existing records.
   * Documented and testable migration failure and database backup/recovery procedure.
   * Idempotent seed data expansion to provide representative Actions Taken and explicit scenarios demonstrating both **non-zero** and **zero** dashboard metrics.
5. **Concurrency, Duplicate Prevention & Form Resilience:**
   * Database-level concurrency controls guarding against race conditions on concurrent status updates (HTTP 409 Conflict).
   * Safe handling and prevention of duplicate Action Taken submissions resulting from rapid repeated clicking (UI button debounce) or network retry.
   * Form resilience protecting user-entered form data across recoverable API failures (HTTP 400, 409, 500) so technicians do not re-enter data after transient errors.
   * Strict role-based authorization (403 Forbidden for role violations, 404 Not Found for requester resource isolation non-enumeration).

### 2.2 Explicitly Excluded from Scope
* Automated email, SMS, or external messaging notifications.
* WebSocket or Server-Sent Events (SSE) push notifications (standard REST on-demand fetch and page load refresh).
* Automated SLA timer escalation engines or business-hour calendar calculations.
* Deletion of Actions Taken records (audit trail integrity is preserved; actions are append-only or updatable, not deletable).
* Requester direct manipulation of ticket status to `RESOLVED` or `CLOSED`.
* Third-party charting libraries (e.g., Chart.js, Recharts) or export to CSV/Excel.
* Multi-tenant organization segregation or SSO/OAuth integration.

---

## 3. Functional Requirements (FR)

### Actions Taken (Service Actions)
* **FR-01:** The system shall allow authenticated IT Staff and Administrators to record (create) a new Action Taken record for any valid ticket.
* **FR-02:** The system shall automatically record the "Performed by" technician identity from the authenticated session user (`req.user.id`), ignoring any client-provided author identifier.
* **FR-03:** The system shall capture for each Action Taken: Action Date/Time, Description, Result, Follow-Up Required flag, Follow-up Note (mandatory if Follow-Up Required is true), Attachment Notes, and optional Approved Assignee (`assignedToId`).
* **FR-04:** The system shall allow authenticated IT Staff and Administrators to update existing Action Taken records, including description, result, follow-up fields, attachment notes, and assigned technician.
* **FR-05:** The system shall allow any active IT Staff member or Administrator to record or update an Action Taken on a ticket regardless of who is designated as the Ticket Owner.
* **FR-06:** The system shall allow authenticated Requesters to view all Actions Taken records associated with their own tickets in a dedicated "Service Actions" view.
* **FR-07:** The system shall reject any attempt by a Requester to create or update an Action Taken record with HTTP 403 Forbidden. Action Taken deletion is unavailable to all roles because no DELETE endpoint is provided (see BR-05); deletion attempts are covered separately and do not imply a 403 contract.
* **FR-20:** The system shall permit IT Staff and Administrators to assign an Action Taken to an approved technician (`assignedToId`).
* **FR-21:** The system shall validate that any specified assignee is an active user with role `IT_STAFF` or `ADMIN`, rejecting inactive users (`INACTIVE_ASSIGNEE`) or unauthorized roles (`INVALID_ASSIGNEE_ROLE`) with HTTP 400 Bad Request.

### Status Transitions & Resolution
* **FR-08:** The system shall enforce permitted status transitions exclusively on the backend according to the Status Transition Matrix.
* **FR-09:** The system shall permit IT Staff and Administrators to transition a ticket to `RESOLVED` from `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`, subject to backend Resolution Gate validation.
* **FR-10:** The system shall permit IT Staff and Administrators to transition a `RESOLVED` ticket to `CLOSED` (terminal) or `REOPENED` (reactivated).
* **FR-11:** The system shall prevent any further status transitions from terminal states (`CLOSED`, `CANCELLED`, `REJECTED`).
* **FR-12:** The system shall automatically record an audit log entry (as an `InternalNote`) whenever a ticket status transition occurs.
* **FR-22:** The system shall enforce a backend **Resolution Gate** on transitions to `RESOLVED` that cannot be bypassed by direct API calls, requiring an authorized IT Staff/Administrator actor and at least one persisted Action Taken record on the Ticket.

### Dashboards & Backend Metrics
* **FR-13:** The system shall provide a dedicated backend endpoint (`GET /api/dashboard/requester`) returning pre-calculated aggregate metrics and recent tickets for the authenticated Requester's tickets.
* **FR-14:** The system shall provide a dedicated backend endpoint (`GET /api/dashboard/staff`) returning pre-calculated aggregate metrics, the most recently updated unresolved queue tickets (with priority context), and current-user actions across the ticket queue for IT Staff and Administrators.
* **FR-15:** The system shall provide a Requester Dashboard view displaying summary metric cards with drill-down links that route to `/my-tickets` with corresponding status filters applied, alongside a list of recently updated and resolved tickets.
* **FR-16:** The system shall provide an IT Staff Dashboard view displaying summary metric cards with drill-down links that route to `/staff-queue` with corresponding assignee, priority, status, or follow-up filters applied, alongside a list of the most recently updated unresolved queue tickets (with priority context) and current-user Actions Taken.
* **FR-17:** The system shall calculate all dashboard metrics via server-side database aggregations without sending full ticket collections to the client.
* **FR-23:** The system shall support displaying empty-state feedback with all metrics displaying zero when a user has no matching tickets or actions.

### Resilience, Data Preservation & Hardening
* **FR-18:** The system shall preserve all pre-existing Lab 1–3 data (categories, systems, users, tickets, attachments, comments, notes) across database migration.
* **FR-19:** The system shall maintain all existing Lab 1–3 APIs, authentication rules, and permission checks without regression.
* **FR-24:** The system shall protect user-entered form data in the user interface after recoverable API or network failures, allowing correction and re-submission without retyping.
* **FR-25:** The system shall prevent or safely handle duplicate Action Taken creation caused by rapid repeated clicking or network retry.

---

## 4. Business Rules (BR)

* **BR-01 (Actions Taken Collaboration & Assignee Accountability):** The Ticket Owner coordinates ticket resolution, but any active user with `IT_STAFF` or `ADMIN` role is authorized to record or update Actions Taken on any accessible ticket. An Action Taken may designate an approved assignee (`assignedToId`) responsible for the action, while `performedById` records the authenticated technician who executed the entry.
* **BR-02 (Authenticated Attribution & Assignee Validation):**
  * `performedById`: Immutable attribute derived strictly from the authenticated session user (`req.user.id`). Client payloads attempting to specify or override `performedBy` shall be ignored.
  * `assignedToId`: Optional upon creation (defaults to `null`, i.e., unassigned; `performedById` is never used as an implicit assignee fallback). When supplied, `assignedToId` must correspond to an active (`isActive = true`) user holding either `IT_STAFF` or `ADMIN` role. Specifying an inactive user shall be rejected with HTTP 400 Bad Request (`INACTIVE_ASSIGNEE`); specifying a user with role `REQUESTER` shall be rejected with HTTP 400 Bad Request (`INVALID_ASSIGNEE_ROLE`).
* **BR-03 (Requester Action Prohibition):** Requesters have read-only visibility into Actions Taken on their own tickets and are strictly prohibited from creating or updating Action Taken records (HTTP 403). No DELETE endpoint is exposed for any role; global non-deletability is defined separately in BR-05.
* **BR-04 (Action Taken Field Validation):**
  * `actionDateTime`: Required and non-null in the persisted record. The client may omit this field; when omitted, the server supplies the current timestamp (`now()`). *[Proposed Technical Constraint]* A client-supplied timestamp cannot exceed current server time by more than 5 minutes (future-dating tolerance).
  * `description`: Required non-empty string. *[Confirmed Handout Requirement]*. *[Proposed Technical Constraint]* Trimmed length between 5 and 3,000 characters.
  * `result`: Required non-empty string. *[Confirmed Handout Requirement]*. *[Proposed Technical Constraint]* Trimmed length between 2 and 1,000 characters.
  * `followUpRequired`: Required boolean flag (defaults to `false`). *[Confirmed Handout Requirement]*.
  * `followUpNote`: String (text). *[Confirmed Handout Requirement]* **Mandatory when `followUpRequired = true`**; optional / null when `followUpRequired = false`. *[Proposed Technical Constraint]* Maximum length of 1,000 characters.
  * `attachmentNotes`: Optional string (text). *[Confirmed Handout Requirement]*. *[Proposed Technical Constraint]* Maximum length of 1,000 characters.
  * `assignedToId`: Optional String (foreign key to `User.id`). Validated per BR-02.
* **BR-05 (Action Taken Non-Deletability & Ticket Deletion Integrity):** Action Taken records may be created and updated by authorized IT Staff/Admin users but cannot be deleted via the application API (no DELETE endpoint is exposed). Deleting a Ticket or User must not silently cascade or erase associated ActionTaken audit history; referential integrity requires `onDelete: Restrict`.
* **BR-06 (Standard Lifecycle Statuses):** The system recognizes eight standard lifecycle statuses from the handout: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
* **BR-07 (Existing REJECTED Status Compatibility):** The `REJECTED` status introduced in Lab 3 is retained in schema and read views for backward compatibility as a terminal state. Rejection requires a mandatory rejection reason recorded in an `InternalNote`. Standard ticket resolution workflows adhere to the eight standard lifecycle statuses.
* **BR-08 (Terminal States):** `CLOSED`, `CANCELLED`, and `REJECTED` are terminal statuses. Once a ticket enters a terminal status, no further status transitions, claims, assignments, or priority modifications are permitted.
* **BR-09 (Reopened Ticket Workflow):** Transitioning a `RESOLVED` ticket to `REOPENED` reactivates the ticket in the operational queue. From `REOPENED`, IT Staff and Administrators may transition to `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, or `CANCELLED`, as defined in §6.1.
* **BR-10 (Backend Resolution Gate):**
  * Only `IT_STAFF` and `ADMIN` may transition a Ticket to `RESOLVED`.
  * The predecessor status must be one of `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`, as defined in §6.1.
  * **Engineering decision:** The Ticket must have **at least one persisted Action Taken record** (`COUNT(actionsTaken) >= 1`). Otherwise, the backend rejects the request with HTTP 400 and `ACTION_TAKEN_REQUIRED`; the Ticket status remains unchanged.
  * Outstanding `followUpRequired = true` items do **not** block resolution. Follow-up remains a tracked operational obligation and does not represent an incomplete Ticket resolution.
  * The check must be performed server-side in the same transaction/consistency boundary as the status update so direct API calls cannot bypass it.

* **BR-11 (Requester Problem Resolution Indication):** Calling `POST /api/tickets/:id/indicate-resolved` appends a public comment indicating the requester believes the issue is resolved, but does not alter `currentStatus`. Only IT Staff or Admin may formally transition the status to `RESOLVED`.
* **BR-12 (Backend Metric Aggregation & Recent Data Capping):** All dashboard metrics must be computed exclusively by the backend using aggregate SQL queries (`COUNT`). In addition, recent ticket and action summaries returned by dashboard endpoints must be strictly capped (limit of 5 items) and sorted chronologically descending to maintain fast response times without streaming unbounded collections.
* **BR-13 (Requester Metric & Item Isolation):** Metrics and recent items returned by `GET /api/dashboard/requester` must strictly aggregate only tickets where `requesterId === req.user.id`.
* **BR-14 (Concurrency, Duplicate Prevention & Form Resilience):**
  * Concurrent mutations on ticket status or Action Taken records must be verified against current state. If a collision or race condition occurs, the server rejects the request with HTTP 409 Conflict.
  * Client interfaces must prevent duplicate submissions on rapid clicking by immediately disabling submit buttons while an operation is in flight.
  * Network retries or repeated requests must be safely handled without corrupting data or creating uncoordinated duplicates. The server-side idempotency state must be durable for the documented 24-hour retention period; a process-local in-memory cache alone is insufficient.
  * Recoverable errors (HTTP 400, 409, 500) must preserve user-entered form data in client state so the user can correct validation issues or retry without losing their input.
* **BR-15 (Non-Enumeration on Resource Access):** If a Requester attempts to access ticket details or Actions Taken for a ticket they do not own, the system must return HTTP 404 Not Found (not 403) to prevent ticket enumeration.
* **BR-16 (Administrator Dashboard Role Behavior):** The Administrator dashboard reuses the IT Staff Dashboard layout and API endpoint (`/staff-dashboard` / `GET /api/dashboard/staff`), retaining full administrative privileges across all ticket queues. User management functions remain located on the existing UI route `/user-management` (backed by `/api/admin/users/*`) without introducing separate user-account metrics in this sprint baseline.

---

## 5. Role Permission Matrix

| Capability / Resource | Requester | IT Staff | Administrator |
|---|:---:|:---:|:---:|
| **Authentication & Profile** (`/api/auth/*`) | Yes | Yes | Yes |
| **View Requester Dashboard** (`GET /api/dashboard/requester`) | Yes (Own Data) | No (403) | No (403) |
| **View IT Staff Dashboard** (`GET /api/dashboard/staff`) | No (403) | Yes | Yes |
| **Create Ticket** (`POST /api/tickets`) | Yes | No (403) | No (403) |
| **View My Tickets** (`GET /api/tickets`) | Yes (Own Data) | No (403) | No (403) |
| **View Staff Ticket Queue** (`GET /api/staff/tickets`) | No (403) | Yes | Yes |
| **View Ticket Details** (`GET /api/tickets/:id` or `/api/staff/tickets/:id`) | Yes (Own Data; 404 if not owner) | Yes (All) | Yes (All) |
| **Upload / Soft-Remove Attachment** | Yes (Own Ticket) | Yes (Assigned/Unassigned) | Read-only Download |
| **View Public Comments** | Yes (Own Ticket) | Yes | Yes |
| **Post Public Comment** | Yes (Own Ticket) | Yes | Yes |
| **View / Post Internal Notes** | No (403) | Yes | Yes |
| **View Actions Taken** (`GET /api/tickets/:id/actions-taken`) | Yes (Own Ticket; 404 if not owner) | Yes (All) | Yes (All) |
| **Record Action Taken** (`POST /api/tickets/:id/actions-taken`) | No (403) | Yes (All Tickets) | Yes (All Tickets) |
| **Update Action Taken** (`PATCH /api/actions-taken/:actionId`) | No (403) | Yes | Yes |
| **Delete Action Taken** | No (Prohibited) | No (Prohibited) | No (Prohibited) |
| **Claim / Assign Ticket Owner** | No (403) | Yes | Yes |
| **Update IT Priority** | No (403) | Yes | Yes |
| **Update Ticket Status** | No (403) | Yes | Yes |
| **Indicate Problem Resolved** (`POST .../indicate-resolved`) | Yes (Own Ticket) | No (403) | No (403) |
| **User Administration** (`/api/admin/users/*`) | No (403) | No (403) | Yes |

---

## 6. Complete Ticket Status-Transition Matrix and Resolution Rules

### 6.1 Status Transition Matrix

The following matrix is the **single approved Lab 4 workflow contract**. Every listed transition is supported by both the backend and UI. The backend is authoritative; the UI only presents the permitted options. The matrix is an engineering decision made to complete the handout's requirement to define Ticket transition rules.

| Current Status | Permitted Next Statuses | Permitted Roles | Condition / Action Trigger |
|---|---|---|---|
| **NEW** | `OPEN`, `CANCELLED`, `REJECTED` | `IT_STAFF`, `ADMIN` | Open/claim/assign the ticket; cancel before work begins; `REJECTED` requires a non-empty rejection reason (Lab 3 compatibility). |
| **OPEN** | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | `IT_STAFF`, `ADMIN` | Start work; request information; resolve a quick fix; or cancel the request. `RESOLVED` is subject to the Resolution Gate. |
| **IN_PROGRESS** | `WAITING_FOR_REQUESTER`, `RESOLVED`, `OPEN`, `CANCELLED` | `IT_STAFF`, `ADMIN` | Await requester input; resolve work; return paused work to the open queue; or cancel the request. `RESOLVED` is subject to the Resolution Gate. |
| **WAITING_FOR_REQUESTER** | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | `IT_STAFF`, `ADMIN` | Resume after requester response; resolve after the response; or cancel the request. `RESOLVED` is subject to the Resolution Gate. |
| **RESOLVED** | `CLOSED`, `REOPENED` | `IT_STAFF`, `ADMIN` | Close verified work or reopen if the issue persists/recurs. |
| **REOPENED** | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | `IT_STAFF`, `ADMIN` | Resume investigation; request clarification; resolve again subject to the Resolution Gate; or cancel an invalid/obsolete request. |
| **CLOSED** | *None* | N/A | Terminal state; immutable. |
| **CANCELLED** | *None* | N/A | Terminal state; immutable. |
| **REJECTED** | *None* | N/A | Lab 3 legacy terminal state; immutable. |

All transitions listed above are enabled. No transition is conditional on future instructor approval. A transition not listed in this matrix is invalid and must be rejected by the backend with HTTP 400 (`INVALID_STATUS_TRANSITION`). Terminal-state mutation restrictions remain governed by BR-08.

### 6.2 Resolution and Rejection Rules
1. **Authorized Roles:** Only authenticated users with `IT_STAFF` or `ADMIN` roles may transition a ticket to `RESOLVED` or `REJECTED`.
2. **Permitted Predecessor States for RESOLVED:** A ticket may transition to `RESOLVED` from `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`. Direct jumps from `NEW`, `CLOSED`, `CANCELLED`, or `REJECTED` to `RESOLVED` are rejected with HTTP 400 Bad Request.
3. **Preserved Lab 3 Rejection Behavior:** Rejecting a ticket (transition from `NEW` to `REJECTED`) strictly requires a non-empty `rejectionReason` string in the request payload. The backend creates an `InternalNote` documenting the actor and reason (`"Status changed from NEW to REJECTED. Reason: <rejectionReason>"`).
4. **Audit Trail Logging:** Every successful status transition automatically generates a timestamped `InternalNote` recording the actor and prior status (e.g., `"Status changed from IN_PROGRESS to RESOLVED"`).
5. **Requester Behavior:** Requesters may invoke `POST /api/tickets/:id/indicate-resolved` to post a public notification comment, but this does not alter `currentStatus`. Requesters attempting to directly call the status update endpoint receive HTTP 403 Forbidden.

---

## 7. Actions Taken Requirements, Fields, Relationships, and Permissions

### 7.1 Entity Relationship
* `Ticket` (1) $\longleftrightarrow$ (N) `ActionTaken`: One ticket can have zero, one, or many Actions Taken records.
* `User` (1) $\longleftrightarrow$ (N) `ActionTaken`: One user (technician) can perform many Actions Taken.
* Foreign Keys & Deletion Integrity Policy:
  * `ticketId`: Integer foreign key referencing `Ticket.id` with `onDelete: Restrict`. Deleting a Ticket must never silently erase its ActionTaken audit history. To preserve audit and compliance records, tickets with associated actions cannot be silently cascaded or deleted.
  * `performedById`: String (UUID) foreign key referencing `User.id` with `onDelete: Restrict` to preserve historical technician attribution.

### 7.2 Field Specifications

| Field Name | Prisma / DB Type | Required | Default | Validation & Constraints |
|---|---|:---:|:---:|---|
| `id` | `Int` (Autoincrement PK) | Yes | Auto | Unique primary key. |
| `ticketId` | `Int` (FK) | Yes | — | References valid existing `Ticket.id`. |
| `performedById` | `String` (UUID FK) | Yes | — | References valid active `User.id`. Auto-populated from session. |
| `actionDateTime` | `DateTime` | Yes | `now()` | Defaults to current time. *[Proposed Technical Constraint]* Cannot exceed current server time by > 5 minutes. |
| `description` | `String` (Text) | Yes | — | Non-empty string. *[Proposed Technical Constraint]* Trimmed length: 5 to 3,000 characters. |
| `result` | `String` (Text) | Yes | — | Non-empty string. *[Proposed Technical Constraint]* Trimmed length: 2 to 1,000 characters. |
| `followUpRequired`| `Boolean` | Yes | `false` | Boolean indicator. |
| `followUpNote` | `String?` (Text) | Conditional | `null` | **Mandatory when `followUpRequired = true`**; optional / null when `false`. *[Proposed Technical Constraint]* Max 1,000 characters. |
| `attachmentNotes` | `String?` (Text) | No | `null` | Optional text notes. *[Proposed Technical Constraint]* Max 1,000 characters. |
| `assignedToId` | `String?` (UUID FK) | No | `null` | Optional assigned technician. Must reference active IT Staff or Admin (`FR-20`, `FR-21`). |
| `createdAt` | `DateTime` | Yes | `now()` | Audit record creation timestamp. |
| `updatedAt` | `DateTime` | Yes | `now()` | Automatically updated on record edit. |

> **Lifecycle Status Clarification:** An Action Taken record does **NOT** have its own lifecycle status field (e.g., `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) or an independent status transition workflow. Actions Taken are historical activity entries documenting work performed on a Ticket. The operations `status transition`, `complete`, and `cancel` referenced in the Part 6 rubric operate exclusively on the parent **Ticket's status and workflow** (see Section 6 and Section 13.1.9).

### 7.3 Permissions and Operations
* **Create (`POST /api/tickets/:id/actions-taken`):**
  * Allowed: `IT_STAFF`, `ADMIN`.
  * Prohibited: `REQUESTER` (HTTP 403 Forbidden).
  * Performed by attribution: `performedById` is populated strictly from `req.user.id`.
  * Assignee assignment: optional `assignedToId`. If provided, must reference an active (`isActive = true`) user with role `IT_STAFF` or `ADMIN`. Inactive assignees return HTTP 400 `INACTIVE_ASSIGNEE`; invalid roles return HTTP 400 `INVALID_ASSIGNEE_ROLE`.
* **Update (`PATCH /api/actions-taken/:actionId`):**
  * Allowed: `IT_STAFF`, `ADMIN`.
  * Editable fields: `description`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `actionDateTime`, `assignedToId`.
  * Non-editable fields: `id`, `ticketId`, `performedById`, `createdAt`.
  * Assignee validation: Any new `assignedToId` is subject to active IT Staff/Admin validation.
  * Prohibited: `REQUESTER` (HTTP 403 Forbidden).
* **Read (`GET /api/tickets/:id/actions-taken`):**
  * Allowed: `IT_STAFF`, `ADMIN` (all tickets); `REQUESTER` (only tickets where `ticket.requesterId === req.user.id`).
  * Non-owner requester access returns HTTP 404 Not Found (non-enumeration).
* **Delete:** Prohibited across all roles.

---

## 8. Requester and IT Staff Dashboard Metrics and Calculation Rules

### 8.1 Requester Dashboard (`GET /api/dashboard/requester`)

#### Calculation Rules (Scope: `ticket.requesterId === req.user.id`):
1. **`totalTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{requesterId} = \text{user.id}$$
   *Includes all tickets created by the user across all statuses (active and terminal).*
2. **`activeTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{requesterId} = \text{user.id} \text{ AND } \text{currentStatus} \in (\text{'NEW'}, \text{'OPEN'}, \text{'IN\_PROGRESS'})$$
   *Includes unresolved tickets currently undergoing triage or work.*
3. **`waitingForRequesterTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{requesterId} = \text{user.id} \text{ AND } \text{currentStatus} = \text{'WAITING\_FOR\_REQUESTER'}$$
   *Includes tickets requiring user input or verification.*
4. **`resolvedOrClosedTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{requesterId} = \text{user.id} \text{ AND } \text{currentStatus} \in (\text{'RESOLVED'}, \text{'CLOSED'})$$
   *Includes successfully resolved and formally closed tickets (`CANCELLED` and `REJECTED` are excluded).*
5. **`recentTickets` (Recent & Attention-Required Ticket Information):**
   * List of up to 5 tickets owned by the requester, ordered by `updatedAt DESC`. *[Proposed Technical Constraint — Limit 5]*.
   * Fields per item: `id`, `ticketNumber`, `title`, `currentStatus`, `itPriority`, `updatedAt`.
   * Highlights attention-required items (e.g. `WAITING_FOR_REQUESTER` or recently resolved work).
   * **Empty Behavior:** When the user has 0 tickets, all count metrics equal 0 and `recentTickets` is an empty array `[]`.

#### Drill-Down Navigation (Requester):
* Clicking **Total Tickets** $\rightarrow$ `/my-tickets` (all filters reset).
* Clicking **Active Tickets** $\rightarrow$ `/my-tickets?status=NEW,OPEN,IN_PROGRESS`.
* Clicking **Waiting for Requester** $\rightarrow$ `/my-tickets?status=WAITING_FOR_REQUESTER`.
* Clicking **Resolved / Closed** $\rightarrow$ `/my-tickets?status=RESOLVED,CLOSED`.
* Clicking any item in **Recent Tickets** $\rightarrow$ `/tickets/:id` (direct ticket detail view).

---

### 8.2 IT Staff Dashboard (`GET /api/dashboard/staff`)

#### Calculation Rules (Scope: Global Queue):
1. **`unassignedTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{ownerId IS NULL} \text{ AND } \text{currentStatus} \in (\text{'NEW'}, \text{'OPEN'})$$
   *Unassigned tickets requiring initial owner pickup or assignment.*
2. **`myActiveTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{ownerId} = \text{user.id} \text{ AND } \text{currentStatus} \in (\text{'OPEN'}, \text{'IN\_PROGRESS'}, \text{'WAITING\_FOR\_REQUESTER'}, \text{'REOPENED'})$$
   *Active tickets owned by the authenticated technician. Excludes `RESOLVED`, `CLOSED`, `CANCELLED`, and `REJECTED`.*
3. **`ticketsRequiringFollowUp`:**
   $$\text{COUNT}(\text{DISTINCT } t.\text{id}) \quad \text{from Ticket } t \text{ JOIN ActionTaken } a \text{ ON } t.\text{id} = a.\text{ticketId}$$
   $$\text{where } a.\text{followUpRequired} = \text{true} \text{ AND } t.\text{currentStatus} \in (\text{'NEW'}, \text{'OPEN'}, \text{'IN\_PROGRESS'}, \text{'WAITING\_FOR\_REQUESTER'}, \text{'REOPENED'})$$
   *(Strictly: `currentStatus NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')`).*
   **Distinct Tickets Clarification:** Counts **distinct tickets**. If a single ticket contains multiple ActionTaken records marked `followUpRequired = true`, it is counted exactly **once** in this metric.
4. **`criticalOrHighPriorityTickets`:**
   $$\text{COUNT}(*) \quad \text{where } \text{itPriority} \in (\text{'CRITICAL'}, \text{'HIGH'})$$
   $$\text{AND } \text{currentStatus} \in (\text{'NEW'}, \text{'OPEN'}, \text{'IN\_PROGRESS'}, \text{'WAITING\_FOR\_REQUESTER'}, \text{'REOPENED'})$$
   *(Strictly: `currentStatus NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')`).*
5. **`statusBreakdown`:**
   An object mapping each status name to its count across all tickets in the system. Includes all eight standard statuses plus `REJECTED` (for Lab 3 backward compatibility).
6. **`recentTickets` (Recent Queue Ticket Information):**
   * List of up to 5 unresolved tickets from the global queue, selected by most recent `updatedAt` and sorted by `updatedAt DESC`. Priority is included so staff can recognize urgency; the list is recency-sorted, not priority-ranked. *[Proposed Technical Constraint — Limit 5]*.
   * Fields per item: `id`, `ticketNumber`, `title`, `currentStatus`, `itPriority`, `ownerId`, `updatedAt`.
7. **`currentUserActions` (Current-User Actions Taken):**
   * List of up to 5 recent Actions Taken where the authenticated technician is either the performer (`performedById = req.user.id`) or assignee (`assignedToId = req.user.id`), ordered by `actionDateTime DESC`. *[Proposed Technical Constraint — Limit 5]*.
   * Fields per item: `id`, `ticketId`, `ticketNumber`, `description`, `result`, `actionDateTime`, `followUpRequired`.
   * **Empty Behavior:** When a technician has no assigned tickets or actions, `myActiveTickets = 0`, `currentUserActions = []`, and appropriate empty-state messaging is rendered.

#### Drill-Down Navigation (IT Staff):
* Clicking **Unassigned Tickets** $\rightarrow$ `/staff-queue?ownerId=unassigned&status=NEW,OPEN`.
* Clicking **My Active Tickets** $\rightarrow$ `/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`.
* Clicking **Follow-Up Required** $\rightarrow$ `/staff-queue?followUpRequired=true&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`.
* Clicking **Critical / High Priority** $\rightarrow$ `/staff-queue?itPriority=CRITICAL,HIGH&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`.
* Clicking any **Status Breakdown badge** $\rightarrow$ `/staff-queue?status=<STATUS_NAME>`.
* Clicking any item in **Recent Tickets** $\rightarrow$ `/staff/tickets/:id`.
* Clicking any item in **Current-User Actions** $\rightarrow$ `/staff/tickets/:ticketId`.

---

### 8.3 Administrator Dashboard Governance
Per handout §4.6, the Administrator dashboard may reuse the IT Staff dashboard. The project explicitly adopts the decision that **Administrator sessions share the IT Staff operational dashboard** (`GET /api/dashboard/staff` / `/staff-dashboard`), retaining global access across all tickets and queues. Administrative user management remains located on the existing `/user-management` UI route (backed by `/api/admin/users/*`) without adding separate user-account counts to the dashboard in this sprint.

---

## 9. Data Model, Migration, Backfill, Seed, and Preservation Decisions

### 9.1 Prisma Schema Additions

**Idempotency Persistence Requirement (FR-25 / BR-14):** The POST Actions Taken idempotency contract in `api-spec.md §2.1` requires durable server-side storage scoped by authenticated user ID, ticket ID, and idempotency key, with a 24-hour retention period. Implementation belongs to Issue 2; process-local memory alone is not sufficient. The exact persistence model may be selected during backend implementation, but it must support payload-conflict detection and replay of the original create response.

```prisma
model ActionTaken {
  id               Int       @id @default(autoincrement())
  ticketId         Int
  ticket           Ticket    @relation(fields: [ticketId], references: [id], onDelete: Restrict)
  performedById    String
  performedBy      User      @relation("ActionTakenAuthor", fields: [performedById], references: [id], onDelete: Restrict)
  assignedToId     String?
  assignedTo       User?     @relation("ActionTakenAssignee", fields: [assignedToId], references: [id], onDelete: Restrict)
  actionDateTime   DateTime  @default(now())
  description      String
  result           String
  followUpRequired Boolean   @default(false)
  followUpNote     String?
  attachmentNotes  String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([ticketId])
  @@index([performedById])
  @@index([assignedToId])
}
```
* In `model Ticket`, add relation: `actionsTaken ActionTaken[]`.
* In `model User`, add relations:
  * `actionsPerformed ActionTaken[] @relation("ActionTakenAuthor")`
  * `actionsAssigned ActionTaken[] @relation("ActionTakenAssignee")`

**Two Database-Design Justifications (Handout §5.1 Requirement):**
1. **Referential Deletion Protection (`onDelete: Restrict`):** Deleting a `Ticket` or `User` must not cascade to delete associated `ActionTaken` records. Actions Taken represent legal and technical compliance audit history; orphan prevention via `Restrict` ensures that neither ticket deletion nor technician account purge can erase historical intervention logs.
2. **Explicit Performer vs Assignee Separation:** `performedById` is mandatory and immutably bound to the creator's session, while `assignedToId` is nullable and references an approved active technician. This satisfies the requirement that a ticket's actions can be delegated or assigned to an approved technician while permanently preserving non-repudiable audit attribution of the user who entered the work.

### 9.2 Migration and Rollback/Recovery Strategy
* **Forward Migration:** Standard Prisma migration (`npx prisma migrate dev --name add_actions_taken`). Strictly additive (`CREATE TABLE "ActionTaken"`, foreign key constraints, indexes). Existing tables remain unmodified.
* **Tested Recovery & Rollback Procedure (Handout §5.2 Requirement):**
  1. *Migration Atomicity:* PostgreSQL supports transactional DDL, but a multi-statement Prisma migration must not be assumed to be wrapped automatically in one transaction. The Lab 4 migration must use explicit transaction boundaries (`BEGIN; ... COMMIT;`) where the migration statements support them. A controlled failure test must verify that the migration runner leaves no partial schema changes. If any migration operation cannot run transactionally, the pre-migration backup and isolated restore procedure below is the recovery path.
  2. *Pre-Migration Database Backup:* Prior to executing migration in staging/production, take a database snapshot via `pg_dump`:
     ```bash
     pg_dump -U postgres -d toktikit_dev -F c -b -v -f backup_pre_lab4.dump
     ```
  3. *Attachment Binary Backup:* Because `pg_dump` backs up database rows but does not back up files stored outside PostgreSQL, separately archive the application's configured attachment-storage directory (or take the corresponding object-storage snapshot). Use the actual storage location configured by the existing application; do not assume a path:
     ```bash
     ATTACHMENT_STORAGE_PARENT="/replace/with/configured/storage-parent"
     ATTACHMENT_STORAGE_DIRECTORY="replace-with-configured-attachment-directory"
     tar -czf backup_pre_lab4_attachments.tar.gz -C "$ATTACHMENT_STORAGE_PARENT" "$ATTACHMENT_STORAGE_DIRECTORY"
     ```
  4. *Recovery Procedure:* In the event of an unrecoverable migration failure, restore the database snapshot into a **separate, disposable recovery database** and restore attachment files into a separate isolated recovery storage location. Never run `pg_restore --clean` against the active development database or overwrite active attachment storage as part of this test:
     ```powershell
     createdb -U postgres toktikit_recovery_test
     pg_restore -U postgres -d toktikit_recovery_test --clean --if-exists -v backup_pre_lab4.dump
     ```
     Restore `backup_pre_lab4_attachments.tar.gz` to the isolated storage location configured for the recovery test.
  5. *Recovery Verification Test:* Documented in `tests.md §6.2` (`TC-DB-08`), asserting that all pre-existing database rows and attachment binaries are completely intact post-recovery.

### 9.3 Idempotent Seed Plan (`server/prisma/seed.ts`)
* Add sample Actions Taken records linked to seeded tickets:
  * `TKT-1002` (retain its existing status): Add **zero** Action Taken records.
  * `TKT-1001` (`IN_PROGRESS`): Add **one** Action Taken performed by `staff1`, assigned to `staff1` (`"Inspected email daemon logs; found memory leak; scheduled process restart"` with `followUpRequired: true`, `followUpNote: "Verify heap allocation after restart"`).
  * `TKT-1004` (`RESOLVED`): Add **at least two** Action Taken records performed by `staff1` (one describing the core-switch reboot and faulty patch-cord replacement, with `result: "Router online; latency normal"`, `followUpRequired: false`; and a second distinct intervention with its own description/result and `followUpRequired: false`). This provides explicit zero-, one-, and multiple-action seed scenarios.
* **Zero Dashboard Metrics Seed Accounts (Handout §5.3 Requirement):**
  * Seed a dedicated test requester `req_empty@toktik.it` with **zero tickets** to verify 0 metrics and empty recent list.
  * Seed a dedicated test staff member `tech_empty@toktik.it` with **zero assigned tickets and zero actions** to verify 0 active metrics and empty lists.
* Seeder utilizes check-before-insert (`count` check or upsert) to remain safe for repeated runs.

---

## 10. API and UI Specification Summaries

### 10.1 Key API Endpoints (Detail in `api-spec.md`)
* `GET /api/dashboard/requester`: Requester metrics summary and recent tickets (Requester only).
* `GET /api/dashboard/staff`: IT Staff queue metrics summary, recent queue tickets, and current-user actions (IT Staff & Admin only).
* `GET /api/tickets/:id/actions-taken`: Retrieve Actions Taken list for a ticket (Owner, IT Staff, Admin).
* `POST /api/tickets/:id/actions-taken`: Create an Action Taken record with assignee validation (IT Staff & Admin only).
* `PATCH /api/actions-taken/:actionId`: Update an Action Taken record (IT Staff & Admin only).
* `PATCH /api/staff/tickets/:id/status`: Update ticket status enforcing transition rules and backend **Resolution Gate** (IT Staff & Admin only).

### 10.2 Key UI Screens & Components (Detail in `ui-spec.md`)
* **Requester Dashboard (`/requester/dashboard` or tabbed `/my-tickets`):**
  * Metric summary cards styled in Zen Green (`#006B3C`, `#EAF6EF`).
  * Direct drill-down link buttons into `/my-tickets`.
  * Recent and attention-required tickets list table.
* **IT Staff Dashboard (`/staff-dashboard` or embedded in `/staff-queue`):**
  * Interactive operational KPI cards (Unassigned, My Active, Follow-up, Critical).
  * Direct drill-down linking to `/staff-queue` with reactive query filters.
  * Recent urgent queue tickets table and Current-User Actions Taken list.
* **Requester Ticket Detail Extension:**
  * Active "Service Actions" tab displaying read-only chronological card list of Actions Taken.
* **Staff Ticket Detail Extension:**
  * Actions Taken panel with an "Add Action Taken" button triggering a modal form with Assignee selector and draft resilience.
  * Inline "Edit Action Taken" button on existing records.
* **Navigation Shell (`AppLayout.tsx`):**
  * Dynamic role-aware navigation links for Dashboard, Queue, and User Management.

---

## 11. Numbered, Testable Acceptance Criteria (AC)

* **AC-01 (Record Action Taken with Assignee):** Given an authenticated IT Staff member and valid data (including optional approved active assignee `assignedToId`), when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator (`performedById`) and approved assignee (`assignedToId`), returning HTTP 201 Created.
* **AC-02 (Requester Blocked from Recording Action):** Given an authenticated Requester, when they attempt to call `POST /api/tickets/:id/actions-taken`, then the backend rejects the request with HTTP 403 Forbidden and creates no record.
* **AC-03 (Technician Identity Spoof Prevention):** Given an authenticated IT Staff member, when they supply a different `performedById` in the request body, then the server ignores the payload value and attributes the action to the authenticated session user.
* **AC-04 (Update Action Taken):** Given an authenticated IT Staff member, when they update an existing Action Taken's description, assignee, and follow-up status via `PATCH /api/actions-taken/:actionId` (providing `followUpNote` if `followUpRequired` is set to true), then the record is updated in the database and returned with HTTP 200 OK.
* **AC-05 (Requester Read-Only Service Actions):** Given an authenticated Requester viewing their own ticket, when they inspect the "Service Actions" tab, then all Actions Taken recorded for that ticket are visible, but no create or edit controls are accessible.
* **AC-06 (Collaborative Action Recording):** Given an active IT Staff member who is not the Ticket Owner, when they record an Action Taken on the ticket, then the record is successfully created and attributed to that technician.
* **AC-07 (Valid Status Transition to RESOLVED):** Given a ticket in `IN_PROGRESS` status meeting Resolution Gate conditions, when an IT Staff member transitions the status to `RESOLVED`, then `currentStatus` updates to `RESOLVED` and an audit internal note is automatically logged.
* **AC-08 (Invalid Status Transition Rejected):** Given a ticket in `NEW` status, when an IT Staff member attempts to transition the status directly to `RESOLVED`, then the server rejects the request with HTTP 400 Bad Request and status remains `NEW`.
* **AC-09 (Terminal Status Immutability):** Given a ticket in `CLOSED`, `CANCELLED`, or `REJECTED` status, when any mutation is attempted on status, assignment, or priority, then the server returns HTTP 400 Bad Request.
* **AC-10 (Requester Dashboard Metric Accuracy):** Given an authenticated Requester, when they request `GET /api/dashboard/requester`, then the returned metrics accurately reflect the count of tickets created by that user matching the active, waiting, and resolved definitions.
* **AC-11 (Requester Dashboard Drill-Down):** Given a Requester clicking the "Waiting for Requester" metric card, then the UI navigates to `/my-tickets?status=WAITING_FOR_REQUESTER` with the ticket list appropriately filtered.
* **AC-12 (IT Staff Dashboard Metric Accuracy):** Given an authenticated IT Staff member, when they request `GET /api/dashboard/staff`, then the returned metrics accurately reflect the global unassigned, personal active, follow-up required, and priority counts.
* **AC-13 (IT Staff Dashboard Follow-Up Metric Distinct Count):** Given an unresolved ticket with multiple Action Taken records marked `followUpRequired = true`, when the IT Staff dashboard metrics are fetched, then `ticketsRequiringFollowUp` increments by exactly one for that ticket.
* **AC-14 (Non-Destructive Migration Verification):** Given an existing database containing Lab 1–3 seeded tickets (`TKT-1001`–`TKT-1004`) and attachments, when the Lab 4 migration is applied, then all legacy tickets, relationships, and attachments remain intact and queryable.
* **AC-15 (Concurrency Protection on Ticket Status):** Given two concurrent requests attempting conflicting status transitions on the same ticket, then exactly one transaction succeeds and the competing transaction is safely rejected with HTTP 409 Conflict.
* **AC-16 (Lab 1–3 Regression Suite Integrity):** All applicable Lab 1–3 server Vitest API tests, client Vitest component tests, and Playwright E2E test suites must continue to pass with zero unexpected failures and zero regressions.
* **AC-17 (Inactive and Unauthorized Assignee Rejection):** Given an authenticated IT Staff member attempting to create or update an Action Taken with an `assignedToId` belonging to an inactive user or a user with role `REQUESTER`, the server rejects the operation with HTTP 400 Bad Request (`INACTIVE_ASSIGNEE` or `INVALID_ASSIGNEE_ROLE`).
* **AC-18 (Backend Resolution Gate Enforcement):** Given a ticket in any permitted predecessor status with zero recorded Actions Taken, when an IT Staff member or Administrator attempts to transition it to `RESOLVED`, the server rejects the transition with HTTP 400 Bad Request (`ACTION_TAKEN_REQUIRED`) and preserves the current status. With at least one persisted Action Taken, the transition may proceed.
* **AC-19 (Form Resilience & Duplicate Submission Prevention):** Given a technician submitting an Action Taken form, the UI immediately disables the submit button during in-flight submission. If a recoverable server error occurs, the modal remains open and all user-entered inputs are preserved in state for correction and retry.
* **AC-20 (Dashboard Recent Information & Zero Metrics):** Given an authenticated user with zero tickets/actions, dashboard endpoints return 0 for all metrics and empty arrays `[]` for recent lists; given a user with active tickets, recent tickets and current-user actions return properly populated, ordered arrays.

---

## 12. Product Definition of Done (DoD)

1. **Engineering Contract Fulfillment:** All approved Functional Requirements (FR-01 to FR-25), Business Rules (BR-01 to BR-16), and Acceptance Criteria (AC-01 to AC-20) are satisfied. Any remaining technical assumptions are documented explicitly; the finalized Ticket transition matrix and Resolution Gate are release requirements.
2. **Database Integrity & Non-Destructive Relations:** Prisma migration executes cleanly forward and preserves all existing seed data; `ActionTaken` uses non-cascading deletion (`onDelete: Restrict`); seeder is idempotent and provides non-zero and zero metric test scenarios.
3. **Server Authorization & Backend Enforcement:** All new endpoints enforce strict RBAC via session middleware; the approved project Resolution Gate rule is enforced at the backend/API level (`ACTION_TAKEN_REQUIRED` when no Action Taken exists); Requester non-enumeration 404 is preserved.
4. **Automated Test Coverage (All 10 Categories):**
   * Covers: Unit, API/Integration, UI Component, UI Style, Responsive, Authorization, Workflow, Migration/Regression, Performance-Smoke, and End-to-End.
   * Full test suite runs clean: 0 failed tests, 0 regressions across all suites.
5. **UI & Design Standard:** Zen Green design tokens, responsive breakpoints (Desktop, Tablet, Mobile), accessible form labels, touch targets $\ge 44\text{px}$, draft form resilience, and loading/error states are fully implemented.
6. **Peer Review:** Code and documentation reviewed and accepted per team Git workflow.

---

## 13. Assumptions, Constraints, and Unresolved Decisions

### 13.1 Confirmed Architectural Decisions
* **Decision 13.1.1 (Action Taken Non-Deletability):** Actions Taken are non-deletable audit records; authorized IT Staff/Admin may update permitted fields, but no DELETE endpoint is provided. `performedById` remains immutable.
* **Decision 13.1.2 (Action Taken Deletion Integrity):** Deleting a Ticket must not silently cascade or delete associated ActionTaken records (`onDelete: Restrict`).
* **Decision 13.1.3 (Automatic Technician Attribution):** `performedBy` is populated exclusively from the session `req.user.id`.
* **Decision 13.1.4 (Approved Assignee Model):** `assignedToId` is optional and validated against active IT Staff/Admin members.
* **Decision 13.1.5 (Backend Aggregations & Recent Capping):** Dashboards fetch lightweight aggregate counts and capped recent items (limit 5) calculated in the database, avoiding bulk payload overhead.
* **Decision 13.1.6 (Collaborative Interventions):** Ticket ownership coordinates accountability, but any IT Staff member can record an Action Taken to reflect real-world team support.
* **Decision 13.1.7 (Mandatory Follow-Up Note):** When `followUpRequired = true`, `followUpNote` is strictly required.
* **Decision 13.1.8 (Administrator Dashboard Reuse):** Administrator sessions share the IT Staff operational dashboard; user accounts are managed via the `/user-management` UI route backed by `/api/admin/users/*`.
* **Decision 13.1.9 (Actions Taken Scope & Ticket Lifecycle Decoupling):**
  * An Action Taken is an activity and intervention record associated with a parent Ticket; it does **NOT** possess an independent lifecycle status or its own status-transition workflow.
  * The Part 6 rubric demonstration items ("status transition, complete, cancel" from handout page 11) refer strictly to the main **Ticket's status and workflow**, which are demonstrated and operated from the `StaffTicketDetail` screen alongside Actions Taken. Ticket status transitions must strictly follow the Ticket Workflow requirements in Part 7.
  * No additional status fields (such as `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`) are introduced on the `ActionTaken` model.
  * The `ActionTaken` fields remain strictly aligned with Section 8.3 of the handout: `actionDateTime`, `description`, `result`, `performedById` (auto), `followUpRequired`, `followUpNote`, `attachmentNotes`, and optional `assignedToId`.

### 13.2 Status Compatibility Conflict (Documented for Review)
* **Conflict 13.2.1:** The Lab 4 handout specifies eight standard statuses (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`). However, the existing implementation from Lab 3 includes a ninth status: `REJECTED` (with mandatory rejection reason).
* **Compatibility Assumption:** To prevent breaking existing database records, migrations, and Lab 3 regression tests, `REJECTED` is retained as a valid terminal status in the database enum and query handlers. Normal ticket resolution workflows will operate on the eight standard statuses.

### 13.3 Engineering Decisions and Remaining Technical Constraints
* **Decision 13.3.1 (Resolution Gate):** Finalized. A Ticket requires at least one persisted Action Taken before it can transition to `RESOLVED`. Outstanding follow-ups do not block resolution.
* **Decision 13.3.2 (Ticket Status Transitions):** Finalized. All transitions listed in §6.1 are approved project workflow behavior and must be implemented consistently in the backend, UI, and tests. Unlisted transitions are rejected.
* **Question 13.3.4 (Proposed Field Validation Constraints):** Are the length limits (Description: 5–3,000 chars; Result: 2–1,000 chars; Notes: max 1,000 chars) and the 5-minute future timestamp tolerance acceptable as production constraints?
  * *Current Specification Baseline:* Maintained as *Proposed Technical Constraints* to prevent database overflow and invalid timestamps.
* **Question 13.3.5 (Attachment Notes Type):** Is `attachmentNotes` purely textual descriptive notes, or must it reference uploaded `Attachment.id` records?
  * *Current Specification Baseline:* Textual notes field (`String?`), allowing technicians to note physical hardware, test outputs, or file references freely without strict foreign key constraints.
* **Question 13.3.6 (Primary Landing Route):** Should normal login redirection for Requesters and IT Staff change to the new Dashboards, or remain `/my-tickets` and `/staff-queue` with Dashboard accessible via top navigation?
  * *Current Specification Baseline:* Preserve existing login redirects (`/my-tickets` and `/staff-queue`) to safeguard Lab 3 E2E test assertions, while providing prominent navigation links to Dashboards in `AppLayout.tsx`.

