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
        "name": "Jane Doe",
        "email": "user@example.com",
        "role": "REQUESTER",
        "requiresPasswordChange": false
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
        "name": "Jane Doe",
        "email": "user@example.com",
        "role": "REQUESTER",
        "requiresPasswordChange": false
      }
    }
    ```
*   **Status Codes:** `200 OK`, `401 Unauthorized`

### POST /api/auth/change-password
*   **Description:** Changes the password for the currently logged-in user. Mandatory if `requiresPasswordChange` is true.
*   **Auth Required:** Yes (Any role)
*   **Request Body:**
    ```json
    {
      "newPassword": "newSecurePassword",
      "confirmPassword": "newSecurePassword"
    }
    ```
*   **Response Payload (200 OK):**
    ```json
    { "message": "Password updated successfully" }
    ```
*   **Status Codes:**
    *   `200 OK`: Success.
    *   `400 Bad Request`: Passwords do not match or fail complexity rules.
    *   `401 Unauthorized`: Not logged in.

---

## 3. Requester Tickets
*Driven by authenticated session identity, replacing the Lab 2 selector.*

### GET /api/tickets
*   **Description:** Retrieves all tickets owned by the authenticated Requester.
*   **Auth Required:** Yes (Requester, IT Staff, Admin)
*   **Response Payload (200 OK):**
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "title": "Cannot access email",
          "status": "OPEN",
          "createdAt": "2023-10-27T10:00:00Z"
        }
      ]
    }
    ```

### POST /api/tickets
*   **Description:** Submits a new ticket. The creator is implicitly the authenticated user.
*   **Auth Required:** Yes (Requester, IT Staff, Admin)
*   **Request Body:**
    ```json
    {
      "title": "Printer jammed",
      "description": "Paper jam in the 3rd floor printer.",
      "categoryId": "uuid",
      "requestedPriority": "HIGH"
    }
    ```
*   **Response Payload (201 Created):** `id` and ticket summary.

### GET /api/tickets/:id
*   **Description:** Retrieves details of a specific ticket.
*   **Auth Required:** Yes. If Requester, must be the owner. IT Staff and Admin can view any ticket.
*   **Response Payload (200 OK):** Complete ticket fields, including requester details.
*   **Status Codes:**
    *   `200 OK`
    *   `401 Unauthorized`
    *   `404 Not Found`: Ticket doesn't exist, OR requester is not the owner (prevents data leak).

---

## 4. Staff Queue

### GET /api/staff/tickets
*   **Description:** Retrieves tickets for the IT Staff queue. Supports rich query parameters.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Query Parameters:**
    *   `search` (string): Searches title and description.
    *   `category` (string): Filter by category ID.
    *   `status` (string): Filter by status (e.g., OPEN, IN_PROGRESS).
    *   `priority` (string): Filter by IT priority.
    *   `owner` (string): Filter by assigned IT staff ID (or `unassigned`).
    *   `sort` (string): Field to sort by (e.g., `createdAt:desc`, `itPriority:asc`).
    *   `page` (number), `limit` (number): For pagination.
*   **Response Payload (200 OK):**
    ```json
    {
      "data": [...],
      "meta": {
        "totalCount": 150,
        "page": 1,
        "totalPages": 15
      }
    }
    ```
*   **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden` (Requesters)

---

## 5. Staff Detail & Workflow

### GET /api/staff/tickets/:id
*   **Description:** Retrieves comprehensive ticket details for IT staff, including internal workflow states.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### PATCH /api/staff/tickets/:id/claim
*   **Description:** Sets the currently authenticated IT Staff member as the ticket assignee.
*   **Auth Required:** Yes (IT Staff, Admin)
*   **Response Payload (200 OK):** Updated ticket record.
*   **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`

### PATCH /api/staff/tickets/:id/assign
*   **Description:** Assigns the ticket to a specific IT Staff member.
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
    { "status": "IN_PROGRESS" }
    ```
*   **Status Codes:** `200 OK`, `400 Bad Request` (invalid transition), `403 Forbidden`, `404 Not Found`

### Ticket Status Transition Matrix
The following matrix defines the permitted status changes. Requesters cannot transition statuses via the API directly except by calling a specific endpoint to indicate a problem appears resolved (which notifies IT Staff but does not change the formal status to `Resolved`).

| Current Status | Allowed Next Statuses | Permitted Roles | Notes |
| :--- | :--- | :--- | :--- |
| **New** | Open, Cancelled | IT Staff, Admin | |
| **Open** | In Progress, Waiting for Requester, Resolved, Cancelled | IT Staff, Admin | |
| **In Progress** | Waiting for Requester, Resolved, Open, Cancelled | IT Staff, Admin | |
| **Waiting for Requester** | In Progress, Resolved, Cancelled | IT Staff, Admin | |
| **Resolved** | Closed, Reopened | IT Staff, Admin | Requester can call an endpoint to 'indicate resolved', but only IT/Admin sets it to `Resolved` or `Closed`. |
| **Closed** | Reopened | IT Staff, Admin | |
| **Reopened** | In Progress, Waiting for Requester, Resolved, Cancelled | IT Staff, Admin | |
| **Cancelled** | Reopened | IT Staff, Admin | |

---

## 6. Notes & Comments

### GET /api/tickets/:id/comments
*   **Description:** Retrieves public comments for a ticket.
*   **Auth Required:** Yes (Requester must own ticket; IT/Admin can view any).
*   **Response Payload (200 OK):** List of comments.

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

### PATCH /api/admin/users/:id
*   **Description:** Updates basic user details (name, email, role, activation state).
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
    *   `409 Conflict`: New email already in use.

### POST /api/admin/users/:id/reset-password
*   **Description:** Generates or assigns a new initial password for a user. Flags account for mandatory password change on next login.
*   **Auth Required:** Yes (Admin only)
*   **Request Body:**
    ```json
    { "newPassword": "resetPassword123" }
    ```
*   **Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`.
