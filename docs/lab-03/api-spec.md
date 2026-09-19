# REST API Specification: Sprint 3 (Tok TickIT)

This document details all REST endpoints required for Sprint 3, covering authentication, role-based access, IT staff workflows, ticket communication, and user management.

## 1. Authentication & Security General Rules

### Authentication Mechanism
*   **Session State:** Secured using a server-managed session ID stored in a secure, `HttpOnly`, `SameSite=Lax` cookie.
*   **Session Expiration:** Sessions expire after a period of inactivity (e.g., 2 hours) or an absolute timeout (e.g., 24 hours).
*   **Logout Invalidation:** When a user logs out, the server explicitly invalidates the session in the backend store and instructs the client to clear the cookie.
*   **CSRF Mitigation:** As `SameSite=Lax` is used with cookie-based auth, cross-site requests are mitigated. Mutation endpoints may require an anti-CSRF token if deployed across subdomains.
*   **Credentials:** Passwords are securely hashed using `bcrypt` (with an appropriate salt round, e.g., 10 or 12). Passwords are only transmitted over the wire during login and user creation.
*   **Authorization:** All endpoints enforce authorization via the backend session.

### Safe Error Handling & No Data Leaks
To avoid leaking information to unauthorized users:
*   **401 Unauthorized:** Returned when a user is not logged in or the session has expired.
*   **403 Forbidden:** Returned when an authenticated user lacks the required role to access an endpoint (e.g., a Requester hitting an Admin endpoint).
*   **404 Not Found:** Returned for resources that do not exist OR for resources the user does not own. (For example, if a Requester requests `/api/tickets/100` and they are not the owner, the server returns 404 instead of 403 to prevent attackers from confirming the ticket exists.)
*   **409 Conflict:** Returned for duplicate states, such as registering a user with an already existing email.

**Common Error Payload Schema:**
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable, safe message that does not expose internal system state or sensitive data."
  }
}
```

---

## 2. Authentication Endpoints

### POST /api/auth/login
*   **Description:** Authenticates a user and establishes a session.
*   **Auth Required:** No
*   **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "plainTextPassword"
    }
    ```
*   **Response Payload (200 OK):** Sets `HttpOnly` session cookie.
    ```json
    {
      "user": {
        "id": "uuid",
        "fullName": "Jane Doe",
        "email": "user@example.com",
        "role": "REQUESTER",
        "mustChangePassword": false
      }
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Successful login.
    *   `400 Bad Request`: Missing email or password fields.
    *   `401 Unauthorized`: Invalid credentials or inactive account (no distinction is made in message to prevent account enumeration).

### POST /api/auth/logout
*   **Description:** Invalidates the current session and clears the cookie.
*   **Auth Required:** Yes (Any role)
*   **Response Payload (200 OK):** Clears `HttpOnly` session cookie.
    ```json
    { "message": "Logged out successfully" }
    ```
*   **Status Codes:** `200 OK`

### GET /api/auth/me
*   **Description:** Retrieves the current authenticated user's profile.
*   **Auth Required:** Yes (Any role)
*   **Response Payload (200 OK):**
    ```json
    {
      "user": {
        "id": "uuid",
        "fullName": "Jane Doe",
        "email": "user@example.com",
        "role": "REQUESTER",
        "mustChangePassword": false
      }
    }
    ```
*   **Status Codes:** `200 OK`, `401 Unauthorized`

### POST /api/auth/change-password
*   **Description:** Changes the password for the currently logged-in user. Mandatory if `mustChangePassword` is true.
*   **Auth Required:** Yes (Any role)
*   **Request Body:**
    ```json
    {
      "currentPassword": "currentPassword123!",
      "newPassword": "newSecurePassword123!",
      "confirmPassword": "newSecurePassword123!"
    }
    ```
*   **Response Payload (200 OK):**
    ```json
    { "message": "Password updated successfully" }
    ```
*   **Status Codes:**
    *   `200 OK`: Success.
    *   `400 Bad Request`: Passwords do not match, invalid current password, or fail complexity rules.
    *   `401 Unauthorized`: Not logged in.

---

## 3. Requester Tickets
*Driven by authenticated session identity, replacing the Lab 2 selector.*

### GET /api/tickets
*   **Description:** Retrieves all tickets owned by the authenticated Requester. Scoped strictly to `req.user.id`.
*   **Auth Required:** Yes (Authenticated User)
*   **Query Parameters:**
    *   `search` (string): Searches ticketNumber and summary.
    *   `categoryId` (number): Filter by category ID.
    *   `status` (string): Filter by ticket status.
    *   `requestedPriority` (string): Filter by requested priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
    *   `itPriority` (string): Filter by IT priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
    *   `sortBy` (string): Field to sort by (`ticketNumber`, `createdAt`, `updatedAt`, `summary`). Default: `createdAt`.
    *   `sortOrder` (string): `asc` or `desc`. Default: `desc`.
    *   `page` (number): Page number (1-indexed). Default: `1`.
    *   `pageSize` (number): Items per page. Default: `8`.
*   **Response Payload (200 OK):**
    ```json
    {
      "data": [
        {
          "id": 1,
          "ticketNumber": "TKT-1001",
          "summary": "Cannot access email",
          "category": { "id": 1, "name": "Email" },
          "relatedSystem": { "id": 1, "name": "Office 365" },
          "requestedPriority": "HIGH",
          "itPriority": "HIGH",
          "status": "OPEN",
          "createdAt": "2026-09-19T10:00:00.000Z",
          "updatedAt": "2026-09-19T10:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "pageSize": 8,
        "totalItems": 1,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPreviousPage": false
      }
    }
    ```

### POST /api/tickets
*   **Description:** Submits a new ticket. The creator is implicitly the authenticated user.
*   **Auth Required:** Yes (Requester, IT Staff, Admin)
*   **Request Body:**
    ```json
    {
      "summary": "Printer jammed",
      "description": "Paper jam in the 3rd floor printer.",
      "categoryId": 1,
      "relatedSystemId": 1,
      "requestedPriority": "HIGH"
    }
    ```
*   **Response Payload (201 Created):** `id` and ticket summary.

### GET /api/tickets/:id
*   **Description:** Retrieves details of a specific ticket.
*   **Auth Required:** Yes. If Requester, must be the owner. IT Staff and Admin can view any ticket.
*   **Response Payload (200 OK):** Complete ticket fields, including requester details and public comments.
*   **Status Codes:**
    *   `200 OK`
    *   `401 Unauthorized`
    *   `403 Forbidden`: Requester is not the owner (or returns 404 to prevent enumeration on non-owned tickets).
    *   `404 Not Found`: Ticket doesn't exist.

---

## 4. Staff Queue

### GET /api/staff/tickets
*   **Description:** Retrieves tickets for the IT Staff queue. Supports rich search, filtering, sorting, and pagination.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Query Parameters:**
    *   `search` (string): Searches ticketNumber and summary.
    *   `categoryId` (number): Filter by category ID.
    *   `status` (string): Filter by status (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, `REJECTED`).
    *   `itPriority` (string): Filter by IT priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
    *   `requestedPriority` (string): Filter by requested priority.
    *   `ownerId` (string): Filter by assigned IT staff ID, or `"unassigned"` for unassigned tickets.
    *   `sortBy` (string): Field to sort by (`ticketNumber`, `createdAt`, `updatedAt`, `summary`, `itPriority`, `status`). Default: `createdAt`.
    *   `sortOrder` (string): `asc` or `desc`. Default: `desc`.
    *   `page` (number): Page number (1-indexed). Default: `1`.
    *   `limit` (number): Items per page. Default: `10`.
*   **Response Payload (200 OK):**
    ```json
    {
      "data": [
        {
          "id": 1,
          "ticketNumber": "TKT-1001",
          "summary": "Cannot access email",
          "category": { "id": 1, "name": "Email" },
          "requestedPriority": "HIGH",
          "itPriority": "HIGH",
          "status": "OPEN",
          "requester": { "id": "uuid", "name": "Jane Doe" },
          "owner": { "id": "uuid", "name": "Staff Member" },
          "createdAt": "2026-09-19T10:00:00.000Z",
          "updatedAt": "2026-09-19T10:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "totalItems": 150,
        "totalPages": 15,
        "hasNextPage": true,
        "hasPreviousPage": false
      }
    }
    ```
*   **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden` (Requesters)

---

## 5. Staff Detail & Workflow

### GET /api/staff/assignees
*   **Description:** Retrieves a list of active IT Staff and Administrator users eligible for ticket assignment.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Response Payload (200 OK):**
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "fullName": "Staff Member",
          "email": "staff@example.com",
          "role": "IT_STAFF"
        }
      ]
    }
    ```
*   **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

### GET /api/staff/tickets/:id
*   **Description:** Retrieves comprehensive ticket details for IT staff, including internal workflow states, public comments, and internal notes.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### PATCH /api/staff/tickets/:id/claim
*   **Description:** Sets the currently authenticated IT Staff member as the ticket assignee.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Response Payload (200 OK):** Updated ticket record.
*   **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

### PATCH /api/staff/tickets/:id/assign
*   **Description:** Assigns the ticket to a specific active IT Staff or Admin member.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Request Body:**
    ```json
    { "assigneeId": "uuid" }
    ```
*   **Status Codes:** `200 OK`, `400 Bad Request` (invalid user), `403 Forbidden`, `404 Not Found`

### PATCH /api/staff/tickets/:id/priority
*   **Description:** Updates the IT Priority of the ticket.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Request Body:**
    ```json
    { "itPriority": "CRITICAL" }
    ```
*   **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`

### PATCH /api/staff/tickets/:id/status
*   **Description:** Updates the status of the ticket according to permitted workflow transitions.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Request Body:**
    ```json
    { 
      "status": "REJECTED",
      "rejectionReason": "Not a valid IT issue"
    }
    ```
*   **Status Codes:** `200 OK`, `400 Bad Request` (invalid transition or missing rejection reason), `403 Forbidden`, `404 Not Found`

### Ticket Status Transition Matrix
The following matrix defines the permitted status changes. Requesters cannot transition statuses via the API directly except by calling `POST /api/tickets/:id/indicate-resolved` to indicate a problem appears resolved (which posts a public comment but does not change the formal status).

| Current Status | Allowed Next Statuses | Permitted Roles | Notes |
| :--- | :--- | :--- | :--- |
| **New** | Open, Rejected, Cancelled | IT Staff, Admin | Transitions to `Open` automatically when claimed or assigned. |
| **Open** | In Progress, Waiting for Requester, Resolved, Cancelled | IT Staff, Admin | |
| **In Progress** | Waiting for Requester, Resolved, Open, Cancelled | IT Staff, Admin | |
| **Waiting for Requester** | In Progress, Resolved, Cancelled | IT Staff, Admin | |
| **Resolved** | Closed, Reopened | IT Staff, Admin | Requester can call `/indicate-resolved`, but only IT/Admin sets formal status to `Resolved` or `Closed`. |
| **Reopened** | In Progress, Waiting for Requester, Resolved, Cancelled | IT Staff, Admin | |
| **Closed** | None | IT Staff, Admin | Terminal state. |
| **Cancelled** | None | IT Staff, Admin | Terminal state. |
| **Rejected** | None | IT Staff, Admin | Terminal state. Requires a mandatory `rejectionReason` logged in an internal note. |

---

## 6. Notes & Comments

### GET /api/tickets/:id/comments
*   **Description:** Retrieves public comments for a ticket.
*   **Auth Required:** Yes (Requester must own ticket; IT/Admin can view any).
*   **Response Payload (200 OK):** List of comments with author details.

### POST /api/tickets/:id/comments
*   **Description:** Appends a new public comment to the ticket.
*   **Auth Required:** Yes (Requester must own ticket; IT/Admin can post to any).
*   **Request Body:**
    ```json
    { "content": "I have restarted my computer, but the issue persists." }
    ```
*   **Status Codes:** `201 Created`, `400 Bad Request` (empty content), `403 Forbidden`, `404 Not Found`.

### GET /api/tickets/:id/internal-notes
*   **Description:** Retrieves internal notes for a ticket.
*   **Auth Required:** Yes (IT Staff, Admin).
*   **Status Codes:**
    *   `200 OK`: List of internal notes.
    *   `403 Forbidden`: Returned if a Requester attempts to access this endpoint (preventing data leaks).
    *   `404 Not Found`: Ticket does not exist.

### POST /api/tickets/:id/internal-notes
*   **Description:** Appends a new internal note to the ticket.
*   **Auth Required:** Yes (IT Staff, Admin).
*   **Request Body:**
    ```json
    { "content": "Contacted vendor support, ticket #99912. Waiting for reply." }
    ```
*   **Status Codes:** `201 Created`, `403 Forbidden`, `404 Not Found`.

### POST /api/tickets/:id/indicate-resolved
*   **Description:** Allows the ticket requester to indicate that their problem appears resolved. Automatically appends a public comment without altering the formal ticket status.
*   **Auth Required:** Yes (Requester only; must own the ticket)
*   **Response Payload (200 OK):**
    ```json
    {
      "message": "Indicated that the problem is resolved.",
      "data": {
        "id": 1,
        "ticketId": 10,
        "authorId": "uuid",
        "content": "The requester has indicated that the problem appears resolved.",
        "createdAt": "2026-09-19T10:00:00.000Z"
      }
    }
    ```
*   **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (non-Requester), `404 Not Found` (ticket not found or not owned).

---

## 7. Administrator User Management

### GET /api/admin/users
*   **Description:** Retrieves a list of users for administration.
*   **Auth Required:** Yes (Admin only)
*   **Query Parameters:**
    *   `search` (string): Name or Email search.
    *   `role` (string): Filter by role.
*   **Response Payload (200 OK):** List of users (passwords omitted).
*   **Status Codes:** `200 OK`, `403 Forbidden` (If IT Staff or Requester).

### POST /api/admin/users
*   **Description:** Creates a new user account with an initial password.
*   **Auth Required:** Yes (Admin only)
*   **Request Body:**
    ```json
    {
      "name": "New Employee",
      "email": "employee@example.com",
      "role": "REQUESTER",
      "password": "initialPassword123"
    }
    ```
*   **Response Payload (201 Created):**
    ```json
    {
      "id": "uuid",
      "name": "New Employee",
      "email": "employee@example.com",
      "role": "REQUESTER",
      "isActive": true,
      "requiresPasswordChange": true
    }
    ```
*   **Status Codes:** `201 Created`, `400 Bad Request`, `409 Conflict` (Email already exists), `403 Forbidden`.

### PUT & PATCH /api/admin/users/:id
*   **Description:** Updates basic user details (name, email, role, activation state). Both `PUT` and `PATCH` methods are supported.
*   **Auth Required:** Yes (Admin only)
*   **Request Body:** (Fields are optional)
    ```json
    {
      "name": "Updated Name",
      "email": "updated@example.com",
      "role": "IT_STAFF",
      "isActive": false
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Success.
    *   `400 Bad Request`: Cannot deactivate self; Cannot modify last active admin.
    *   `403 Forbidden`
    *   `404 Not Found`
    *   `409 Conflict`: New email already in use, or concurrent update conflict.

### POST /api/admin/users/:id/reset-password
*   **Description:** Generates or assigns a new initial password for a user. Flags account for mandatory password change on next login (`mustChangePassword: true`).
*   **Auth Required:** Yes (Admin only)
*   **Request Body:**
    ```json
    { "newPassword": "resetPassword123" }
    ```
*   **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`.
