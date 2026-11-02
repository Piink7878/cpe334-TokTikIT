# REST API Specification: Sprint 4 (TokTikIT)

This document details the REST API specification for Sprint 4 (Lab 4). It defines endpoints for **Actions Taken (Service Actions)**, **Requester and IT Staff Dashboards**, updated **Ticket Status Transitions and Resolution**, and documents the preserved API contracts from Labs 1–3 to ensure zero regression.

---

## 1. Authentication, Authorization & Security Architecture

### 1.1 Authentication & Session Management
* **Session Transport:** Managed via server-issued session ID stored in a secure, `HttpOnly`, `SameSite=Lax` cookie.
* **Session Lifetime:** 24-hour absolute expiration from `req.session.establishedAt`. Expired sessions are destroyed, returning `401 Unauthorized`.
* **Mandatory Password Change:** Users with `mustChangePassword === true` are blocked from all non-auth endpoints by `requirePasswordChangeEnforcement` middleware, returning `403 Forbidden` (`code: "PASSWORD_CHANGE_REQUIRED"`).
* **Technician Identity Guarantee:** For all creation and mutation operations (e.g., recording Actions Taken), the technician's identity (`performedById`) is derived exclusively from `req.user.id` on the server session. Any client-supplied author ID in request bodies is strictly ignored.

### 1.2 Error Handling & Security Policies
* **400 Bad Request:** Validation errors (e.g., invalid status transition, missing required fields, or missing `followUpNote` when `followUpRequired = true`).
* **401 Unauthorized:** Missing, invalid, or expired session.
* **403 Forbidden:** Authenticated user lacks role permissions (e.g., Requester attempting to record Actions Taken or access Staff Queue / Staff Dashboard).
* **404 Not Found (Non-Enumeration):** Resource does not exist OR the resource is not owned by the requesting user. (If a Requester requests `/api/tickets/99/actions-taken` and they do not own ticket 99, the API returns 404 to prevent resource existence enumeration).
* **409 Conflict:** Concurrency collisions (e.g., competing simultaneous status changes or transaction serialization conflicts), stale Action Taken updates, or reuse of an `Idempotency-Key` with a different payload.

**Standard Error Response Schema (New Lab 4 APIs):**
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Safe human-readable error description"
  }
}
```

> **API Compatibility & Error Contract Policy:**
> - **Existing Lab 1–3 APIs:** Must preserve all original success response bodies, error response bodies, and HTTP status codes (e.g. `{ "error": "..." }`, `{ "error": { "message": "..." } }`, or `{ "message": "...", "ticket": { ... } }`). Existing endpoints (such as `PATCH /api/staff/tickets/:id/status`) are **not** globally converted or wrapped into the new Lab 4 `{ "data": ... }` envelope, ensuring complete client and test compatibility. The `ACTION_TAKEN_REQUIRED` error on this existing endpoint preserves its established error envelope (`{ "error": { "code": "ACTION_TAKEN_REQUIRED", "message": "..." } }`).
> - **New Lab 4 APIs:** All new Lab 4 endpoints — including Actions Taken (`POST /api/tickets/:id/actions-taken`, `PATCH /api/actions-taken/:actionId`), and Dashboards (`GET /api/dashboard/*`) — MUST use the new Lab 4 response structure with `{ "data": ... }` on success and nested `{ "error": { "code", "message" } }` contract on failure.
> - Explicit regression test suites verify that legacy endpoints retain their original success and error response shapes.

---

## 2. Actions Taken (Service Actions) Endpoints

### 2.1 POST /api/tickets/:id/actions-taken
* **Description:** Records a new Action Taken intervention for an existing ticket, with optional assignment to an approved technician.
* **Auth Required:** Yes
* **Permitted Roles:** `IT_STAFF`, `ADMIN` (Requesters return `403 Forbidden`).
* **Collaboration Policy:** Any active IT Staff member or Admin can record an Action Taken on any ticket regardless of who is designated as the Ticket Owner.
* **Attribution Rule:** The `performedById` field is automatically set to `req.user.id` (session identity).
* **Path Parameters:**
  * `id` (`integer`): Target Ticket ID.
* **Idempotency / Safe Retry Contract:**
  * The client MAY include an `Idempotency-Key` request header containing a client-generated UUID (e.g., `Idempotency-Key: 7e3f9b2c-4a1d-4c7e-81b0-123456789abc`). The Lab 4 UI MUST include this header for every create submission.
  * If the server has already successfully processed a request bearing the same `Idempotency-Key` for the same ticket, it returns the **original** `201 Created` response body instead of creating a duplicate record.
  * If the same key is submitted with a **different payload**, the server returns `409 Conflict` (`code: "IDEMPOTENCY_KEY_CONFLICT"`).
  * Idempotency records MUST be stored durably on the server (a process-local in-memory cache alone is non-conformant), retained for **24 hours**, and scoped by authenticated user ID, target ticket ID, and key (not by transient session ID), so a retry after re-authentication or server restart can still resolve to the original request.
  * Requests without an `Idempotency-Key` may be processed once but receive no network-retry deduplication guarantee. The Lab 4 UI MUST always send a key and retain the same key and identical payload when retrying an uncertain request; it MUST disable the submit button while a request is in flight.
* **Request Body:**
  ```json
  {
    "actionDateTime": "2026-10-30T10:15:00.000Z",
    "description": "Replaced damaged CAT6 cable and verified Gigabit link negotiation on port 14.",
    "result": "Link stable; ping latency to gateway < 1ms.",
    "followUpRequired": true,
    "followUpNote": "Check switch port error counters again after 24 hours.",
    "attachmentNotes": "Referenced test run report: sw-lab3-port14.log",
    "assignedToId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
* **Validation Rules:**
  * `description` (`string`, required): Non-empty string. *[Proposed constraint: 5–3,000 chars]*.
  * `result` (`string`, required): Non-empty string. *[Proposed constraint: 2–1,000 chars]*.
  * `followUpRequired` (`boolean`, optional on create, default `false`): When supplied, must be a boolean value (see `specification.md` BR-04).
  * `followUpNote` (`string`, conditional): **Mandatory non-empty string when `followUpRequired === true`**; optional / `null` when `false`. *[Proposed constraint: max 1,000 chars]*.
  * `attachmentNotes` (`string`, optional): Free-text notes documenting external evidence, equipment IDs, or log references. *[Proposed constraint: max 1,000 chars]*.
  * `actionDateTime` (`string`, optional ISO 8601 in the request): The persisted field is non-null; if omitted, the server sets it to the current server time. *[Proposed constraint: cannot exceed server time by > 5 minutes]*.
  * `assignedToId` (`string`, optional UUID/CUID): Approved technician assigned to the action. If provided, must reference an existing user with `isActive: true` and role `IT_STAFF` or `ADMIN`.
    * If assignee is inactive: returns HTTP 400 Bad Request (`code: "INACTIVE_ASSIGNEE"`).
    * If assignee is not staff or admin: returns HTTP 400 Bad Request (`code: "INVALID_ASSIGNEE_ROLE"`).
* **Response Payload (201 Created):**
  ```json
  {
    "message": "Action taken recorded successfully",
    "data": {
      "id": 1,
      "ticketId": 1001,
      "performedById": "550e8400-e29b-41d4-a716-446655440000",
      "performedBy": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": "Staff Technician One",
        "role": "IT_STAFF"
      },
      "assignedToId": "550e8400-e29b-41d4-a716-446655440000",
      "assignedTo": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": "Staff Technician One",
        "role": "IT_STAFF"
      },
      "actionDateTime": "2026-10-30T10:15:00.000Z",
      "description": "Replaced damaged CAT6 cable and verified Gigabit link negotiation on port 14.",
      "result": "Link stable; ping latency to gateway < 1ms.",
      "followUpRequired": true,
      "followUpNote": "Check switch port error counters again after 24 hours.",
      "attachmentNotes": "Referenced test run report: sw-lab3-port14.log",
      "createdAt": "2026-10-30T10:15:30.000Z",
      "updatedAt": "2026-10-30T10:15:30.000Z"
    }
  }
  ```
* **Status Codes:**
  * `201 Created`: Action Taken created successfully.
  * `400 Bad Request`: Validation failure (missing required fields, missing `followUpNote` when `followUpRequired = true`, `INACTIVE_ASSIGNEE`, or `INVALID_ASSIGNEE_ROLE`).
  * `401 Unauthorized`: Unauthenticated request.
  * `403 Forbidden`: Authenticated user is a `REQUESTER`.
  * `404 Not Found`: Ticket not found.
  * `409 Conflict`: Same `Idempotency-Key` reused with a different payload (`IDEMPOTENCY_KEY_CONFLICT`).
* **Traceability:** `FR-01`, `FR-02`, `FR-03`, `FR-21`, `FR-25`, `BR-01`, `BR-02`, `BR-04`, `BR-14`, `AC-01`, `AC-02`, `AC-03`, `AC-06`, `AC-17`, `AC-19`.

---

### 2.2 PATCH /api/actions-taken/:actionId
* **Description:** Updates an existing Action Taken record. Every successful update atomically appends an immutable revision audit log record into `ActionTakenRevision`.
* **Auth Required:** Yes
* **Permitted Roles:** `IT_STAFF`, `ADMIN` (Requesters return `403 Forbidden`).
* **Path Parameters:**
  * `actionId` (`integer`): ID of the Action Taken record.
* **Optimistic Concurrency Contract:**
  * The client MUST include the `updatedAt` timestamp of the record it last fetched in the request body as `"expectedUpdatedAt": "<ISO 8601 timestamp>"`.
  * The server compares `expectedUpdatedAt` against the current `updatedAt` value in the database.
  * If they match, the update proceeds and the server refreshes `updatedAt` to `now()`.
  * If they do **not** match (another client already updated the record), the server returns `409 Conflict` (`code: "STALE_UPDATE"`, message: `"The record was modified by another user. Please reload and retry."`). The response body also includes the current server-side record so the client can present the latest state.
  * Clients that omit `expectedUpdatedAt` receive `400 Bad Request` (`code: "MISSING_EXPECTED_UPDATED_AT"`).
* **Append-Only Revision History Audit & Concurrency Safety:**
  * The original data is never overwritten without an audit trail.
  * Within a single atomic interactive database transaction (`$transaction`), the server:
    1. Reads the current record state as `originalData`.
    2. Compares `expectedUpdatedAt` with the database `updatedAt`; if mismatched, throws a stale update conflict returning `409 Conflict` (`STALE_UPDATE`).
    3. Updates the `ActionTaken` record with the new values.
    4. Appends a new `ActionTakenRevision` row with:
       - `actionTakenId`: ID of the target action.
       - `originalData`: JSON snapshot of prior state.
       - `updatedData`: JSON snapshot of modified fields.
       - `editedById`: Identity of the editor (`req.user.id`).
       - `editedAt`: Timestamp of the edit (`now()`).
       - `revisionNumber`: Monotonically increasing revision sequence (1, 2, 3...) per action.
  * **Database-Level Concurrency Guarantee:** The Prisma schema defines a unique constraint `@@unique([actionTakenId, revisionNumber])` on `ActionTakenRevision`. Concurrent update attempts cannot generate duplicate revision numbers. If any step within the transaction fails (including revision insert), the entire transaction rolls back atomically, ensuring no partial or corrupted updates occur.
* **Performer Immutability:**
  * The `performedById` field is immutable and permanently records the original technician who created the action. Even if edited by another staff or admin, `performedById` **never changes**.
* **Request Body (Partial update supported):**
  ```json
  {
    "expectedUpdatedAt": "2026-10-30T10:15:30.000Z",
    "description": "Replaced damaged CAT6 cable and configured port QoS policy.",
    "result": "Link stable; zero dropped frames.",
    "followUpRequired": false,
    "followUpNote": null,
    "attachmentNotes": "Final switch audit log attached.",
    "assignedToId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
* **Validation Rules:**
  * Editable fields: `description`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `actionDateTime`, `assignedToId`.
  * Non-editable fields: `id`, `ticketId`, `performedById`, `createdAt`. If a client includes any of these fields in the update payload, the server ignores the supplied values and preserves the stored values.
  * If `followUpRequired` is updated to `true`, `followUpNote` must be provided as a non-empty string.
  * If `assignedToId` is updated, must reference an active `IT_STAFF` or `ADMIN` user (`INACTIVE_ASSIGNEE` / `INVALID_ASSIGNEE_ROLE`).
* **Response Payload (200 OK):**
  ```json
  {
    "message": "Action taken updated successfully",
    "data": {
      "id": 1,
      "ticketId": 1001,
      "performedById": "550e8400-e29b-41d4-a716-446655440000",
      "performedBy": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": "Staff Technician One",
        "role": "IT_STAFF"
      },
      "assignedToId": "550e8400-e29b-41d4-a716-446655440000",
      "assignedTo": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": "Staff Technician One",
        "role": "IT_STAFF"
      },
      "actionDateTime": "2026-10-30T10:15:00.000Z",
      "description": "Replaced damaged CAT6 cable and configured port QoS policy.",
      "result": "Link stable; zero dropped frames.",
      "followUpRequired": false,
      "followUpNote": null,
      "attachmentNotes": "Final switch audit log attached.",
      "createdAt": "2026-10-30T10:15:30.000Z",
      "updatedAt": "2026-10-30T10:30:00.000Z",
      "latestRevision": {
        "revisionNumber": 1,
        "editedById": "550e8400-e29b-41d4-a716-446655440000",
        "editedAt": "2026-10-30T10:30:00.000Z"
      }
    }
  }
  ```
* **Status Codes:**
  * `200 OK`: Action Taken updated and revision appended successfully.
  * `400 Bad Request`: Validation failure (missing `followUpNote` when `followUpRequired = true`, `INACTIVE_ASSIGNEE`, `INVALID_ASSIGNEE_ROLE`, or `MISSING_EXPECTED_UPDATED_AT`).
  * `401 Unauthorized`: Unauthenticated request.
  * `403 Forbidden`: Authenticated user is a `REQUESTER`.
  * `404 Not Found`: Action Taken record not found.
  * `409 Conflict`: Stale update detected (`STALE_UPDATE`).
* **Traceability:** `FR-04`, `FR-21`, `FR-25`, `BR-01`, `BR-04`, `BR-05`, `BR-14`, `AC-04`, `AC-17`, `AC-19`.

---

### 2.3 GET /api/tickets/:id/actions-taken
* **Description:** Retrieves all Actions Taken records recorded for a specific ticket, including their revision audit history.
* **Auth Required:** Yes
* **Permitted Roles:**
  * `IT_STAFF`, `ADMIN`: Allowed for all tickets.
  * `REQUESTER`: Allowed **only** for tickets where `ticket.requesterId === req.user.id`.
* **Path Parameters:**
  * `id` (`integer`): Target Ticket ID.
* **Query Parameters:**
  * `sortBy` (`string`, optional): Field to sort by (`actionDateTime` or `createdAt`). Default: `actionDateTime`.
  * `sortOrder` (`string`, optional): `asc` or `desc`. Default: `asc`.
* **Response Payload (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "ticketId": 1001,
        "performedById": "550e8400-e29b-41d4-a716-446655440000",
        "performedBy": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "fullName": "Staff Technician One",
          "role": "IT_STAFF"
        },
        "assignedToId": "550e8400-e29b-41d4-a716-446655440000",
        "assignedTo": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "fullName": "Staff Technician One",
          "role": "IT_STAFF"
        },
        "actionDateTime": "2026-10-30T10:15:00.000Z",
        "description": "Replaced damaged CAT6 cable and verified link.",
        "result": "Link operational at 1 Gbps.",
        "followUpRequired": false,
        "followUpNote": null,
        "attachmentNotes": null,
        "createdAt": "2026-10-30T10:15:30.000Z",
        "updatedAt": "2026-10-30T10:30:00.000Z",
        "revisions": [
          {
            "id": 1,
            "revisionNumber": 1,
            "editedById": "550e8400-e29b-41d4-a716-446655440000",
            "editor": {
              "id": "550e8400-e29b-41d4-a716-446655440000",
              "fullName": "Staff Technician One",
              "role": "IT_STAFF"
            },
            "editedAt": "2026-10-30T10:30:00.000Z",
            "originalData": {
              "description": "Initial cable check",
              "result": "Intermittent packet loss"
            },
            "updatedData": {
              "description": "Replaced damaged CAT6 cable and verified link.",
              "result": "Link operational at 1 Gbps."
            }
          }
        ]
      }
    ]
  }
  ```
* **Status Codes:**
  * `200 OK`: Actions and revisions retrieved successfully.
  * `401 Unauthorized`: Unauthenticated request.
  * `404 Not Found`: Ticket not found OR ticket belongs to another requester (non-enumeration).
* **Traceability:** `FR-06`, `BR-02`, `BR-03`, `BR-05`, `BR-15`, `AC-05`, `AC-06`.

---

### 2.4 DELETE /api/actions-taken/:actionId (Explicit Deletion Prohibition)
* **Description:** Deletion of Actions Taken records or revision history is strictly prohibited under legal and compliance audit trail requirements. The application registers an explicit route handler returning HTTP 405 Method Not Allowed rather than falling back to Express's default 404 handler.
* **Auth Required:** Yes
* **Registered Endpoints:** `DELETE /api/actions-taken/:actionId` and `DELETE /api/tickets/:id/actions-taken/:actionId`
* **Status Codes:**
  * `405 Method Not Allowed`: Explicitly returned when any client attempts a DELETE operation on an Action Taken.
  * **Error Payload:**
    ```json
    {
      "error": {
        "code": "METHOD_NOT_ALLOWED",
        "message": "Action Taken records represent legal compliance audit history and cannot be deleted."
      }
    }
    ```
* **Traceability:** `BR-05`, `TC-RBAC-03`.

---

## 3. Dashboard Metrics Endpoints

### 3.1 GET /api/dashboard/requester
* **Description:** Retrieves pre-calculated aggregate metrics and recent ticket information for the authenticated Requester.
* **Auth Required:** Yes
* **Permitted Roles:** `REQUESTER` only. (`IT_STAFF` and `ADMIN` calling this endpoint receive `403 Forbidden`).
* **Calculation Method:** Executed via backend SQL `COUNT` queries directly in PostgreSQL; no unaggregated full ticket collections are returned.
* **Query Scoping:** Strictly isolated to tickets where `requesterId === req.user.id`.
* **Response Payload (200 OK):**
  ```json
  {
    "data": {
      "totalTickets": 12,
      "activeTickets": 4,
      "waitingForRequesterTickets": 2,
      "resolvedOrClosedTickets": 6,
      "recentTickets": [
        {
          "id": 1001,
          "ticketNumber": "TKT-1001",
          "title": "Cannot connect to campus VPN",
          "currentStatus": "WAITING_FOR_REQUESTER",
          "itPriority": "HIGH",
          "updatedAt": "2026-10-30T10:45:00.000Z"
        }
      ]
    }
  }
  ```
* **Metric Definitions & Status Criteria:**
  * `totalTickets`: All tickets requested by the authenticated user across all statuses (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, `REJECTED`).
  * `activeTickets`: `currentStatus IN ('NEW', 'OPEN', 'IN_PROGRESS')`.
  * `waitingForRequesterTickets`: `currentStatus = 'WAITING_FOR_REQUESTER'`.
  * `resolvedOrClosedTickets`: `currentStatus IN ('RESOLVED', 'CLOSED')`. (`CANCELLED` and `REJECTED` are excluded from resolved/closed metrics).
  * `recentTickets`: Up to 5 most recently updated tickets requested by the authenticated user, sorted by `updatedAt DESC`. Contains key attributes for quick triage.
  * **Empty Behavior:** When the user has zero tickets, all count metrics return `0` and `recentTickets` returns an empty array `[]`.
* **Frontend Drill-Down Query Parameters:**
  * Total Tickets $\rightarrow$ `/my-tickets`
  * Active Tickets $\rightarrow$ `/my-tickets?status=NEW,OPEN,IN_PROGRESS`
  * Waiting for Requester $\rightarrow$ `/my-tickets?status=WAITING_FOR_REQUESTER`
  * Resolved / Closed $\rightarrow$ `/my-tickets?status=RESOLVED,CLOSED`
  * Recent Ticket Item $\rightarrow$ `/tickets/:id`
* **Status Codes:**
  * `200 OK`: Metrics and recent tickets returned.
  * `401 Unauthorized`: Unauthenticated.
  * `403 Forbidden`: Non-requester account.
* **Traceability:** `FR-13`, `FR-15`, `FR-17`, `BR-12`, `BR-13`, `AC-10`, `AC-11`, `AC-20`.

---

### 3.2 GET /api/dashboard/staff
* **Description:** Retrieves pre-calculated operational metrics, the most recently updated unresolved queue tickets (with priority context), and current-user actions across the global queue for IT Staff and Administrators.
* **Auth Required:** Yes
* **Permitted Roles:** `IT_STAFF`, `ADMIN`. (`REQUESTER` receives `403 Forbidden`).
* **Calculation Method:** Executed via backend database aggregations (`COUNT` and `COUNT(DISTINCT)`).
* **Response Payload (200 OK):**
  ```json
  {
    "data": {
      "unassignedTickets": 5,
      "myActiveTickets": 3,
      "ticketsRequiringFollowUp": 2,
      "criticalOrHighPriorityTickets": 4,
      "statusBreakdown": {
        "NEW": 3,
        "OPEN": 2,
        "IN_PROGRESS": 5,
        "WAITING_FOR_REQUESTER": 2,
        "RESOLVED": 8,
        "CLOSED": 14,
        "REOPENED": 1,
        "CANCELLED": 2,
        "REJECTED": 1
      },
      "recentTickets": [
        {
          "id": 1003,
          "ticketNumber": "TKT-1003",
          "title": "Core router flap in Lab 2",
          "currentStatus": "IN_PROGRESS",
          "itPriority": "CRITICAL",
          "ownerId": "550e8400-e29b-41d4-a716-446655440000",
          "updatedAt": "2026-10-30T11:00:00.000Z"
        }
      ],
      "currentUserActions": [
        {
          "id": 12,
          "ticketId": 1001,
          "ticketNumber": "TKT-1001",
          "description": "Replaced CAT6 patch cable",
          "result": "Gigabit link negotiated",
          "actionDateTime": "2026-10-30T10:15:00.000Z",
          "followUpRequired": false
        }
      ]
    }
  }
  ```
* **Metric Definitions & Status Criteria:**
  * `unassignedTickets`: `ownerId IS NULL AND currentStatus IN ('NEW', 'OPEN')`.
  * `myActiveTickets`: `ownerId = req.user.id AND currentStatus IN ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED')`.
  * `ticketsRequiringFollowUp`: **Distinct ticket count** (`COUNT(DISTINCT t.id)`) where ticket has $\ge 1$ ActionTaken with `followUpRequired = true` and `currentStatus IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED')` (strictly `NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')`). Multiple actions requiring follow-up on the same ticket increment this metric by exactly 1.
  * `criticalOrHighPriorityTickets`: `itPriority IN ('CRITICAL', 'HIGH') AND currentStatus IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED')` (strictly `NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED')`).
  * `statusBreakdown`: Mapping of each status to its count across all tickets. Includes all eight standard statuses plus `REJECTED` (for Lab 3 backward compatibility).
  * `recentTickets`: Up to 5 unresolved tickets from the global queue, selected by most recent `updatedAt` and sorted by `updatedAt DESC`. `itPriority` is included for urgency context; the list is recency-sorted, not priority-ranked.
  * `currentUserActions`: Up to 5 recent Actions Taken where `performedById = req.user.id` OR `assignedToId = req.user.id`, sorted by `actionDateTime DESC`.
  * **Empty Behavior:** When a technician has zero assigned tickets and zero actions, `myActiveTickets = 0`, `currentUserActions = []`, and appropriate empty states are rendered.
* **Frontend Drill-Down Query Parameters:**
  * Unassigned Tickets $\rightarrow$ `/staff-queue?ownerId=unassigned&status=NEW,OPEN`
  * My Active Tickets $\rightarrow$ `/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`
  * Follow-Up Required $\rightarrow$ `/staff-queue?followUpRequired=true&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`
  * Critical / High Priority $\rightarrow$ `/staff-queue?itPriority=CRITICAL,HIGH&status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`
  * Status Breakdown $\rightarrow$ `/staff-queue?status=<STATUS>`
  * Recent Ticket Item $\rightarrow$ `/staff/tickets/:id`
  * Recent Action Item $\rightarrow$ `/staff/tickets/:ticketId`
* **Status Codes:**
  * `200 OK`: Metrics and recent information returned.
  * `401 Unauthorized`: Unauthenticated.
  * `403 Forbidden`: Requester account.
* **Administrator Dashboard Decision:** Per handout §4.6, Administrator sessions share this endpoint and dashboard view without separate user-account metrics in this baseline.
* **Traceability:** `FR-14`, `FR-16`, `FR-17`, `FR-23`, `BR-12`, `BR-16`, `AC-12`, `AC-13`, `AC-20`.

---

## 4. Ticket Status Transition and Resolution Engine

### 4.1 PATCH /api/staff/tickets/:id/status
* **Description:** Updates ticket lifecycle status based on backend state machine rules and records an internal audit log note.
* **Auth Required:** Yes
* **Permitted Roles:** `IT_STAFF`, `ADMIN` (Requesters return `403 Forbidden`).
* **Path Parameters:**
  * `id` (`integer`): Target Ticket ID.
* **Request Body:**
  ```json
  {
    "status": "RESOLVED",
    "rejectionReason": "...",
    "expectedUpdatedAt": "2026-10-30T10:30:00.000Z"
  }
  ```
  *(Note: `rejectionReason` is required only if `status === 'REJECTED'` per Lab 3 legacy rules. `expectedUpdatedAt` is optional: the `updatedAt` of the Ticket as last seen by the caller. If the Ticket has changed since, the request is rejected with `409 CONCURRENCY_CONFLICT` before the transition is evaluated. The Staff Ticket Detail screen always sends it.)*
* **Status Transition Rules Matrix:**

| Current Status | Permitted Next Statuses | Condition / Audit Log Trigger |
|---|---|---|
| **NEW** | `OPEN`, `CANCELLED`, `REJECTED` | Open/claim/assign; cancel before work; `REJECTED` requires a non-empty `rejectionReason`. |
| **OPEN** | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Start work; request information; quick resolution; or cancel. `RESOLVED` requires the Team-approved Resolution Gate. |
| **IN_PROGRESS** | `WAITING_FOR_REQUESTER`, `RESOLVED`, `OPEN`, `CANCELLED` | Await requester; resolve; return paused work to queue; or cancel. `RESOLVED` requires the Team-approved Resolution Gate. |
| **WAITING_FOR_REQUESTER** | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | Resume; resolve after response; or cancel. `RESOLVED` requires the Team-approved Resolution Gate. |
| **RESOLVED** | `CLOSED`, `REOPENED` | Close verified work or reopen recurring/persistent issue. |
| **REOPENED** | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Resume; request clarification; resolve subject to Team-approved Resolution Gate; or cancel. |
| **CLOSED** | *None* | Terminal; immutable. |
| **CANCELLED** | *None* | Terminal; immutable. |
| **REJECTED** | *None* | Lab 3 legacy terminal; immutable. |

Every transition listed above is enabled. Any transition not listed is rejected with HTTP 400 (`INVALID_STATUS_TRANSITION`). The backend is authoritative; the UI must expose the same permitted set.

* **Backend Resolution Gate Enforcement (Team-Approved Business Rule):**
  * Handout §4.5 strictly requires that the backend enforces the resolution rule even when a client bypasses the normal screen.
  * Direct calls to set `status = "RESOLVED"` are blocked for Requesters (HTTP 403 Forbidden).
  * Direct calls from IT Staff/Admin are validated against predecessor statuses permitted by the approved matrix. `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED` may transition to `RESOLVED` when the Resolution Gate passes (see `specification.md §6.1`).
  * **Team-Approved Resolution Gate Rule:** Transitioning to `RESOLVED` requires **at least one persisted Action Taken record** on the ticket (`COUNT(actionsTaken) >= 1`). If the ticket has zero Actions Taken, the backend rejects the request with HTTP 400 Bad Request and error code `ACTION_TAKEN_REQUIRED`:
    ```json
    {
      "error": {
        "code": "ACTION_TAKEN_REQUIRED",
        "message": "At least one Action Taken is required."
      }
    }
    ```
  * **Follow-Up Permitted:** Outstanding follow-ups (`followUpRequired = true`) do **not** block resolution.
  * **Authoritative Enforcement Point:** The backend is the authoritative enforcement point. Frontend validation is supplementary only.
* **Audit Log Generation:** Every successful status transition automatically creates a new `InternalNote` record (`ticketId`, `authorId: req.user.id`, `content: "Status changed from <OLD_STATUS> to <NEW_STATUS>"`). For rejection, the reason is appended to the note.
* **Concurrency Protection:** The update executes within a transaction verifying current ticket state. Competing simultaneous status updates, and updates whose `expectedUpdatedAt` is outdated, receive `409 Conflict` with `code: "CONCURRENCY_CONFLICT"`.
* **Terminal Tickets:** Besides status changes (`INVALID_STATUS_TRANSITION`), `PATCH /api/staff/tickets/:id/claim`, `/assign` and `/priority` on a `CLOSED`, `CANCELLED` or `REJECTED` Ticket return `400 Bad Request` with `code: "TICKET_TERMINAL"` (`BR-08`, `AC-09`).
* **Response Payload (200 OK):**
  ```json
  {
    "message": "Status updated successfully",
    "ticket": {
      "id": 1001,
      "ticketNumber": "TKT-1001",
      "currentStatus": "RESOLVED",
      "updatedAt": "2026-10-30T10:45:00.000Z"
    }
  }
  ```
  *(Note: As an established Lab 3 endpoint, `PATCH /api/staff/tickets/:id/status` strictly preserves its existing response envelope: `{ "message": "...", "ticket": { ... } }` on success, and `{ "error": { "code": "...", "message": "..." } }` on failure. It must NEVER be wrapped in `{ "data": ... }`).*
* **Status Codes:**
  * `200 OK`: Status updated successfully.
  * `400 Bad Request`: Invalid transition, invalid status value, missing `rejectionReason` on REJECTED, or failure of the Team-approved Resolution Gate (`ACTION_TAKEN_REQUIRED` when zero Action Taken records exist).
  * `401 Unauthorized`: Unauthenticated.
  * `403 Forbidden`: Requester account.
  * `404 Not Found`: Ticket not found.
  * `409 Conflict`: Concurrent update collision.
* **Traceability:** `FR-08`, `FR-09`, `FR-10`, `FR-11`, `FR-12`, `BR-06`, `BR-07`, `BR-08`, `BR-09`, `BR-10`, `BR-14`, `AC-07`, `AC-08`, `AC-09`, `AC-15`, `AC-18`.

---

## 5. Preserved Lab 1–3 Endpoints (Zero-Regression Guarantee)

The following endpoints from Labs 1, 2, and 3 remain active and backward-compatible. Existing authentication, authorization, response shapes, and behavior when optional filters are omitted must be preserved. The two ticket-list endpoints receive only the additive query-filter extensions specified in §5.1:

| Group | Method | Endpoint | Allowed Roles | Description | Reference |
|---|---|---|---|---|---|
| **Health & Metadata** | `GET` | `/api/health` | Public | System status and categories check | Lab 1 |
| | `GET` | `/api/categories` | Public / Auth | List active categories | Lab 1 |
| | `GET` | `/api/related-systems` | Public / Auth | List active related systems | Lab 2 |
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticate user & issue session cookie | Lab 3 |
| | `POST` | `/api/auth/logout` | Authenticated | Destroy session & clear cookie | Lab 3 |
| | `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile | Lab 3 |
| | `POST` | `/api/auth/change-password` | Authenticated | Mandatory or voluntary password update | Lab 3 |
| **Requester Tickets** | `GET` | `/api/tickets` | `REQUESTER` | List own tickets (search, filter, sort, paginate) | Lab 2 & 3 |
| | `POST` | `/api/tickets` | `REQUESTER` | Create ticket with auto-generated ticket number | Lab 2 & 3 |
| | `GET` | `/api/tickets/:id` | Owner, Staff, Admin | Get ticket details (404 for non-owner requester) | Lab 2 & 3 |
| | `POST` | `/api/tickets/:id/indicate-resolved` | `REQUESTER` | Appends public comment indicating problem resolved | Lab 3 |
| **Attachments** | `POST` | `/api/tickets/:id/attachments` | Ticket Owner | Upload attachment (max 5, 5MB limit, allowed types) | Lab 2 & 3 |
| | `GET` | `/api/attachments/:id/download` | Owner, Staff, Admin | Download attachment (410 if soft-removed) | Lab 2 & 3 |
| | `DELETE` | `/api/attachments/:id` | Ticket Owner | Soft-remove attachment with removal reason | Lab 2 & 3 |
| **Staff Queue & Ops** | `GET` | `/api/staff/tickets` | `IT_STAFF`, `ADMIN` | Global queue (search, filter, sort, paginate) | Lab 3 |
| | `GET` | `/api/staff/tickets/:id` | `IT_STAFF`, `ADMIN` | Ticket detail with comments and internal notes | Lab 3 |
| | `GET` | `/api/staff/assignees` | `IT_STAFF`, `ADMIN` | List active IT Staff and Admin users eligible for ticket ownership assignment | Lab 3 / Lab 4 extended |
| | `PATCH` | `/api/staff/tickets/:id/claim` | `IT_STAFF`, `ADMIN` | Claim ticket ownership (transitions NEW -> OPEN) | Lab 3 |
| | `PATCH` | `/api/staff/tickets/:id/assign` | `IT_STAFF`, `ADMIN` | Assign ticket owner (transitions NEW -> OPEN) | Lab 3 |
| | `PATCH` | `/api/staff/tickets/:id/priority` | `IT_STAFF`, `ADMIN` | Update IT Priority | Lab 3 |
| **Communication** | `GET` | `/api/tickets/:id/comments` | Owner, Staff, Admin | List public comments | Lab 3 |
| | `POST` | `/api/tickets/:id/comments` | Owner, Staff, Admin | Post append-only public comment | Lab 3 |
| | `GET` | `/api/tickets/:id/internal-notes` | `IT_STAFF`, `ADMIN` | List internal notes (403 for Requester) | Lab 3 |
| | `POST` | `/api/tickets/:id/internal-notes` | `IT_STAFF`, `ADMIN` | Post internal note (403 for Requester) | Lab 3 |
| **User Admin** | `GET` | `/api/admin/users` | `ADMIN` | List users with search and role filter | Lab 3 |
| | `POST` | `/api/admin/users` | `ADMIN` | Create user with initial password | Lab 3 |
| | `PUT/PATCH`| `/api/admin/users/:id` | `ADMIN` | Update user with last-admin safety rules | Lab 3 |
| | `POST` | `/api/admin/users/:id/reset-password` | `ADMIN` | Reset password (`mustChangePassword: true`) | Lab 3 |

---

## 5.1 Additive Ticket-List Filter Extensions for Dashboard Drill-Down

The dashboard cards navigate to the existing ticket-list pages. The existing list endpoints must accept the following **additive, backward-compatible** filters so each drill-down returns the same population used by its dashboard metric. When these parameters are omitted, the Lab 2–3 list behavior remains unchanged.

| Endpoint | Query Parameter | Contract |
|---|---|---|
| `GET /api/tickets` | `status` | Accept one status or a comma-separated list (e.g. `NEW,OPEN,IN_PROGRESS`, `RESOLVED,CLOSED`). Return only the authenticated Requester's own tickets matching any listed status. |
| `GET /api/staff/tickets` | `status` | Accept one status or a comma-separated list (e.g. `NEW,OPEN`, `OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`). Return tickets matching any listed status. |
| `GET /api/staff/tickets` | `ownerId=unassigned` | Filter to tickets where `ownerId IS NULL`; combine with `status=NEW,OPEN` for the Unassigned Tickets dashboard card. |
| `GET /api/staff/tickets` | `ownerId=me` | Resolve the alias to the authenticated staff/admin user's ID (`req.user.id`); combine with `status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` for My Active Tickets. |
| `GET /api/staff/tickets` | `followUpRequired=true` | Filter to tickets with at least one `ActionTaken.followUpRequired = true`; combine with the unresolved status set `NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED` for the dashboard metric. |
| `GET /api/staff/tickets` | `itPriority` | Accept one priority or a comma-separated list (e.g. `CRITICAL,HIGH`); combine with the unresolved status set for the Critical / High Priority dashboard card. |

- Comma-separated filters use OR semantics within the same parameter (e.g. `status=NEW,OPEN` means NEW **or** OPEN); different filter parameters are combined with AND semantics.
- The canonical priority parameter is `itPriority`; do not use `priority` as an alternative alias.
- `ownerId=me` is resolved server-side from the authenticated session; clients must not send another user's ID as a substitute for this alias.
- Invalid status or priority values return HTTP `400 Bad Request` using the canonical nested error schema.
- These extensions must not weaken role checks, Requester ticket isolation, existing search/sort/pagination behavior, or the current response contracts.

---

## 6. Traceability Matrix (API Requirements to Acceptance Criteria)

| Endpoint | Method | Key Business Rules & Requirements | Testable AC Reference |
|---|---|---|---|
| `/api/tickets/:id/actions-taken` | `POST` | Role: `IT_STAFF`, `ADMIN`; session attribution; required `followUpNote` when `followUpRequired = true` | `AC-01`, `AC-02`, `AC-03`, `AC-06` |
| `/api/actions-taken/:actionId` | `PATCH` | Role: `IT_STAFF`, `ADMIN`; immutable ID/ticket/author; required `followUpNote` if follow-up activated | `AC-04` |
| `/api/tickets/:id/actions-taken` | `GET` | Read-only for Requester on own ticket; 404 on non-owned tickets; full read for Staff | `AC-05`, `AC-06` |
| `/api/dashboard/requester` | `GET` | Requester-only; backend aggregate `COUNT`; isolated to `requesterId = user.id` | `AC-10`, `AC-11` |
| `/api/dashboard/staff` | `GET` | IT Staff/Admin only; backend aggregate `COUNT`; distinct tickets with unresolved follow-up | `AC-12`, `AC-13` |
| `/api/staff/tickets/:id/status` | `PATCH` | State machine enforcement; audit logging; concurrency conflict handling (409) | `AC-07`, `AC-08`, `AC-09`, `AC-15` |
| All Preserved Endpoints | All | Zero regressions across existing API test suites | `AC-14`, `AC-16` |

---

## 6.1 Assignee Endpoint for Action Taken Assignment

### GET /api/staff/assignees (Reused for Action Taken Assignee Selection)

> **Decision:** The existing `GET /api/staff/assignees` endpoint (Lab 3, ticket ownership assignment) is **reused** for Action Taken `assignedToId` selection in the Add/Edit Action Taken modals. A separate `GET /api/users?roles=IT_STAFF,ADMIN&isActive=true` endpoint is **not** defined. The UI reference to this undeclared endpoint must be corrected to use `/api/staff/assignees`.

* **Description:** Returns the list of active users eligible to be assigned as a ticket owner or Action Taken assignee. Filtered to `isActive: true` and roles `IT_STAFF` or `ADMIN`.
* **Auth Required:** Yes
* **Permitted Roles:** `IT_STAFF`, `ADMIN`.
* **Query Parameters:** None required. Existing implementation already filters to active staff/admin users.
* **Response Payload (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fullName": "Staff Technician One",
        "email": "staff1@toktikit.local",
        "role": "IT_STAFF"
      }
    ]
  }
  ```
* **Empty State:** Returns `{ "data": [] }` when no active staff/admin users exist.
* **Error Handling:** Returns `401 Unauthorized` if unauthenticated; `403 Forbidden` if called by a `REQUESTER`.
* **`assignedToId` Default:** When creating an Action Taken without specifying `assignedToId`, the field **defaults to `null` (unassigned)**. The UI may pre-select the authenticated performer as a convenience, but the server does NOT automatically assign `performedById` as the default assignee. These are two separate fields with independent semantics.
* **Traceability:** `FR-20`, `FR-21`, `BR-01`, `BR-02`, `AC-01`, `AC-17`.

---

## 7. Assumptions and Technical Decisions

1. **Resolution Gate:** Finalized project rule — at least one persisted Action Taken is required before `RESOLVED`; outstanding follow-ups do not block resolution.
2. **Status Transitions:** All transitions in the matrix above are enabled; every unlisted transition is rejected.
3. **Attachment Notes Type (§13.3.5):** `attachmentNotes` is defined as free-text (`string?`), enabling technicians to record file paths, physical equipment tags, or output logs without strict foreign-key dependencies.
4. **Mandatory Follow-up Note:** In strict compliance with the Lab 4 handout, if `followUpRequired === true`, `followUpNote` is mandatory on create and update.
5. **Non-Enumeration Security:** Endpoints enforcing ticket ownership (`GET /api/tickets/:id/actions-taken`) return `404 Not Found` rather than `403 Forbidden` when requested by a Requester who does not own the ticket.
6. **Canonical Error Schema:** All error responses use the nested `{ "error": { "code": "...", "message": "..." } }` structure. Flat error objects are non-conformant. Test expectations must reflect this schema.
7. **Assignee Endpoint Reuse:** The UI's `Add/Edit Action Taken` modal MUST call `GET /api/staff/assignees` to populate the Assigned To dropdown. The previously documented reference to `GET /api/users?roles=IT_STAFF,ADMIN&isActive=true` is incorrect and must not be used.
8. **Actions Taken Lifecycle Decoupling:** Confirmed architectural decision: an Action Taken is an activity and intervention record associated with a parent Ticket; it does NOT possess an independent lifecycle status or its own status-transition workflow. The Part 6 rubric operations ("status transition, complete, cancel") operate on the parent Ticket via `PATCH /api/staff/tickets/:id/status` (Section 4). The `ActionTaken` model has no status field (no `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`).
9. **Idempotency Key Retention Scope:** Idempotency records are scoped by authenticated user ID, ticket ID, and key, and retained for 24 hours. The Lab 4 UI creates one key per logical form submission and reuses it only for retries of the same unchanged payload; a new logical submission uses a new key.

## 8. Actions Taken Scope and Ticket Lifecycle Integration

> **Confirmed Architectural Decision:**
> - An Action Taken is an activity record associated with a Ticket; it does **NOT** have its own Lifecycle Status or independent status-transition workflow.
> - The `status transition`, `complete`, and `cancel` operations mentioned in Part 6 of the handout refer strictly to the main **Ticket's status and workflow**, which are executed via `PATCH /api/staff/tickets/:id/status` (Section 4) per the Ticket Workflow requirements in Part 7.
> - No additional Action Taken statuses (such as `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`) are introduced.
> - The Action Taken fields remain strictly aligned with Section 8.3 of the handout: `actionDateTime`, `description`, `result`, `performedById` (auto), `followUpRequired`, `followUpNote`, `attachmentNotes`, and optional `assignedToId`.
> - Actions Taken are non-deletable activity/audit records that can be created (`POST /api/tickets/:id/actions-taken`) and edited (`PATCH /api/actions-taken/:actionId`), while ticket completion (`RESOLVED`, `CLOSED`) and cancellation (`CANCELLED`) operate exclusively on the parent Ticket.

