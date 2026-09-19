# Specification: Lab 3 (Tok TickIT)

## 1. Sprint Goal
Develop a fully functional IT Service Desk ticketing system that supports robust authentication, role-based access control (Requester, IT Staff, Admin), ticket lifecycle management with status tracking, and secure communication via public comments and private internal notes.

## 2. Stakeholder Request
"We need to transform our basic ticket submission form into a comprehensive IT Helpdesk platform. Users must be able to log in securely. Regular employees (Requesters) should be able to submit tickets and communicate with IT. IT Staff need a queue to pick up tickets, update statuses, prioritize work, and leave private notes for other IT members. Finally, we need Administrators who can manage user accounts and system settings. Security is a top priority—users should only see what they are authorized to see, and hiding UI buttons is not enough; the server must enforce these rules."

## 3. Scope
**Included:**
*   User Authentication (Login/Logout) and Session Management.
*   Role-Based Access Control (RBAC) with three distinct roles: Requester, IT Staff, and Administrator.
*   Ticket Lifecycle Management (Creation, Status Updates, Assignment, Resolution).
*   Ticket Communication (Public Comments visible to Requesters, Private Internal Notes visible only to IT Staff/Admins).
*   User Management (Create, Update, Deactivate users) by Admins.
*   Mandatory password change on first login.

**Explicitly Excluded:**
*   Email invitations, password-reset email, multi-factor authentication (MFA), social login, and single sign-on (SSO).
*   Self-registration and Requester-created accounts.
*   Actions Taken by IT Staff (deferred to Lab 4).
*   Formal SLA calculation, escalation rules, and notification services.
*   Dashboards and KPI analytics beyond simple queue counts.
*   Multi-tenant organizations, departments, and customer administration.
*   Production-grade deployment or cloud infrastructure changes.
*   Multiple roles assigned to one user (A user has exactly one role).
*   User deletion (Users can only be deactivated, not deleted), bulk user operations, user import or export, and account-history screens.
*   Department, organization, profile-photo, and other extended user-profile management.
*   Email delivery of initial passwords or reset links.
*   Account unlocking, administrator approval workflows, and advanced identity-management functions.
*   Advanced user-list features such as mandatory pagination, multi-column sorting, and multiple simultaneous filters.

## 4. Functional Requirements
**Auth**
*   **FR-01:** The system shall allow users to log in using their email and password.
*   **FR-02:** The system shall require users to change their password upon their first successful login if a temporary password was assigned.
*   **FR-03:** The system shall securely log users out and invalidate their session.

**Requester**
*   **FR-04:** Requesters shall be able to view a list of all tickets they have created.
*   **FR-05:** Requesters shall be able to create new support tickets.
*   **FR-06:** Requesters shall be able to view details of their own tickets.
*   **FR-07:** Requesters shall be able to add public comments to their own tickets.

**IT Staff (Queue/Detail)**
*   **FR-08:** IT Staff shall be able to view a global queue of all tickets.
*   **FR-09:** IT Staff shall be able to filter and sort the ticket queue by Status, Priority, and Assignee.
*   **FR-10:** IT Staff shall be able to assign tickets to themselves or other IT Staff members.
*   **FR-11:** IT Staff shall be able to update the Status and IT Priority of any ticket.
*   **FR-12:** IT Staff shall be able to add public comments to tickets.
*   **FR-13:** IT Staff shall be able to add private internal notes to tickets, which are invisible to Requesters.

**Admin**
*   **FR-14:** Admins shall have all the capabilities of IT Staff.
*   **FR-15:** Admins shall be able to view a list of all system users, search by name or email, and optionally filter by role.
*   **FR-16:** Admins shall be able to create new user accounts, assigning an initial password and role.
*   **FR-17:** Admins shall be able to edit user details (Name, Email, Role).
*   **FR-18:** Admins shall be able to deactivate and reactivate user accounts.

## 5. Business Rules
*   **BR-01:** Only an active user with valid credentials may authenticate.
*   **BR-02:** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
    *   *Normal Login Redirection:* When an active user logs in without a mandatory password change requirement, role-based redirection routes `REQUESTER` to `/my-tickets`, `IT_STAFF` to `/staff-queue`, and `ADMIN` to `/user-management`.
    *   *Post-Mandatory Password Change Navigation:* When any user (regardless of role) completes the mandatory password change on the Change Password interstitial, the client navigates directly to `/my-tickets` to enter the application. Subsequent normal logins follow the standard role-based redirect (`/staff-queue` for IT Staff).
*   **BR-03:** The authenticated user identity, not a requesterId supplied by the client, determines ownership of Requester operations.
*   **BR-04:** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator.
*   **BR-05:** A Requester may indicate that the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed.
*   **BR-06 (Security - UI Hiding):** **Hiding UI controls (buttons, links, forms) based on roles is for UX purposes only and is clearly documented as NOT a security control.** All access rules must be strictly enforced on the server/API side.
*   **BR-07 (Ownership Checks):** Requesters can only access, view, and comment on tickets where they are the explicit creator (owner).
*   **BR-08 (Ticket Status - New):** A ticket is 'New' when initially created.
*   **BR-09 (Ticket Status - Open):** A ticket transitions to 'Open' when acknowledged or assigned by IT Staff.
*   **BR-10 (Ticket Status - In Progress):** A ticket is 'In Progress' when actively being worked on.
*   **BR-11 (Ticket Status - Waiting for Requester):** IT Staff sets this status when more information is needed from the Requester.
*   **BR-12 (Ticket Status - Resolved):** IT Staff marks a ticket 'Resolved' when the issue is fixed.
*   **BR-13 (Ticket Status - Closed):** A 'Resolved' ticket can be 'Closed' after a period or upon Requester confirmation.
*   **BR-14 (Ticket Status Lifecycle):** Tickets can be 'Reopened' if the issue persists, or 'Cancelled' if no longer relevant.
*   **BR-15 (IT Priority):** Only IT Staff and Admins can set or change the 'IT Priority' of a ticket. Requesters cannot see or modify this internal metric.
*   **BR-16 (Admin Safety - Self-Deactivation):** An Admin cannot deactivate their own account.
*   **BR-17 (Admin Safety - Last Admin):** The system must prevent the deactivation or role-change of the last active Admin user.

## 6. UI Specification Summary
*   **Login Page:** Form with Email, Password, and Login button. Error handling for invalid credentials or inactive accounts. Normal login routes `REQUESTER` to `/my-tickets`, `IT_STAFF` to `/staff-queue`, and `ADMIN` to `/user-management`.
*   **Change Password Screen:** Interstitial screen forcing a new password entry if required. Upon successful password change, navigates directly to `/my-tickets` to enter the application.
*   **Dashboard/Navigation:** Dynamic navigation bar reflecting the user's role (e.g., 'Users' tab only visible to Admins).
*   **Requester View:** A simple list of "My Tickets" and a "Create Ticket" form. Ticket detail view shows description and a timeline of public comments.
*   **IT Queue:** A comprehensive data table for IT Staff showing all tickets with columns for ID, Title, Status, Priority, Requester, and Assignee. Includes search, filtering controls, sorting, and pagination.
*   **Ticket Detail (IT View):** Split view or tabbed interface allowing IT Staff to read the description, change status/priority, reassign, and a unified timeline showing both Public Comments and distinctively styled Private Internal Notes.
*   **User Management (Admin):** Data table of users with 'Add User' button. Edit modal for changing roles or toggling active status.
*   **Responsive Rules:** Keep all required screens usable on desktop, tablet, and mobile (see `ui-spec.md` for full layout details).

### Authentication Navigation

- Normal login uses role-based redirects:
  - Requester → `/my-tickets`
  - IT Staff → `/staff-queue`
  - Administrator → `/user-management`
- When a user is required to complete the mandatory first-login password change, successful completion redirects to `/my-tickets`.
- This post-password-change redirect is intentionally separate from the normal IT Staff login redirect.

## 7. Data Changes
*   **User Model Evolution:** The basic User model from Lab 2 is expanded. The Lab 2 Development Requester records must be migrated into the real User model without losing existing Ticket or Attachment ownership.
    *   Add `password_hash` (string) for secure credential storage.
    *   Add `role` (enum/string: REQUESTER, IT_STAFF, ADMIN).
    *   Add `is_active` (boolean, default true).
    *   Add `requires_password_change` (boolean, default false).
*   **Ticket Model Updates:** Existing Categories, Related Systems, Tickets, and Attachments remain valid after migration.
    *   Add `assignee_id` (foreign key to User, nullable).
    *   Add `status` (enum: NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED, REJECTED).
    *   Add `it_priority` (enum: LOW, MEDIUM, HIGH, CRITICAL).
*   **New Models:**
    *   **Comment/Note:** To handle the unified timeline. Fields: `id`, `ticket_id` (FK), `author_id` (FK), `content` (text), `is_internal_note` (boolean, default false), `created_at` (timestamp).
*   **Idempotent Seed Plan:** The database seeder must be safely runnable multiple times without duplicating core data. It should always ensure a default Admin account (`admin@example.com`) exists and has the correct password/role if it's missing or altered.

## 8. API Contract Summary
*   `POST /api/auth/login`: Authenticates user, returns session token/cookie.
*   `POST /api/auth/logout`: Invalidates session.
*   `PUT /api/users/me/password`: Updates password for the current user.
*   `GET /api/tickets`: Returns tickets. IT Staff Ticket Queue retrieval must support search, filters, sorting, and pagination. Requesters see only their own.
*   `POST /api/tickets`: Creates a new ticket.
*   `GET /api/tickets/:id`: Returns ticket details (subject to RBAC).
*   `PATCH /api/tickets/:id`: Updates ticket (Status, Assignee, Priority) - IT/Admin only.
*   `POST /api/tickets/:id/comments`: Adds a public comment or internal note (`is_internal_note` flag restricted to IT/Admin).
*   `GET /api/admin/users`: Returns all users with search by name or email and an optional role filter (Admin only).
*   `POST /api/admin/users`: Creates a new user and issues an initial password using the approved local-lab behavior (Admin only).
*   `PUT /api/admin/users/:id`: Updates user name, email, role, or active status (Admin only).
*   `POST /api/admin/users/:id/reset-password`: Resets a user's password and sets the mustChangePassword flag (Admin only).

## 9. Acceptance Criteria
*   **AC-01:** Given an active user with valid credentials, when the user logs in, then the backend establishes authenticated access and returns the permitted user identity and role.
*   **AC-02:** Given a user who must change the initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved. Upon successful submission of the new password, the user navigates directly to `/my-tickets` to enter the application (subsequent normal logins follow role-based redirection, e.g., IT Staff to `/staff-queue`).
*   **AC-03:** Given an authenticated Requester, when the client supplies another requesterId, then the backend still applies the authenticated identity and does not return another Requester's data.
*   **AC-04:** Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected without exposing note content.
*   **AC-05:** Given IT Staff, When they view a ticket detail, Then they can see both Public Comments and Private Internal Notes clearly differentiated.
*   **AC-06:** Given IT Staff, When they submit a form to change a ticket's status, Then the system updates the status and logs the action.
*   **AC-07:** Given a Requester, When they attempt to modify the `it_priority` field via a direct API call, Then the server rejects the request with a 403 Forbidden error.
*   **AC-08:** Given an Admin, When they attempt to deactivate their own account, Then the system prevents the action and displays an error.
*   **AC-09:** Given a system with only one active Admin, When an attempt is made to change that Admin's role or deactivate them, Then the system prevents the action to avoid locking out administrators.
*   **AC-10:** Given an Admin, When they create a new user, Then the new user is saved with a hashed password, not plaintext.
*   **AC-11:** Given IT Staff, When they view the global queue, Then they can see tickets submitted by all Requesters.
*   **AC-12:** Given a Requester, When they view the global queue endpoint, Then the server only returns tickets authored by that Requester.
*   **AC-13:** Given an unauthenticated visitor, When they attempt to access any route other than login, Then they are redirected to the login page.
*   **AC-14:** Given IT Staff, When they create an internal note, Then the note is saved with the `is_internal_note` flag set to true.
*   **AC-15:** Given any user, When they inspect the HTML, hiding UI elements for actions they aren't authorized to perform does not allow them to perform the action if they bypass the UI (Server-side validation enforces this).

## 10. Product Definition of Done
*   The approved engineering contract and Product Definition of Done are satisfied.
*   All Functional Requirements (FR-01 to FR-18) are implemented.
*   All Business Rules (BR-01 to BR-17) are strictly enforced, especially server-side authorization.
*   All Acceptance Criteria (AC-01 to AC-15) pass successfully in testing.
*   Code is peer-reviewed and passes static analysis / linting.
*   Database migrations and idempotent seed scripts are created and tested.
*   UI controls are properly gated by roles, and backend API routes have corresponding authorization guards.
*   Passwords are never stored or transmitted in plain text (except during initial form submission over HTTPS).

## 11. Assumptions and Decisions
*   **Decision:** We will use a unified `comments` table with a boolean flag `is_internal_note` rather than separate tables for comments and notes, simplifying the timeline rendering query.
*   **Decision:** Authentication will rely on standard secure HTTP-only cookies for session management to reduce XSS risk compared to local storage JWTs.
*   **Assumption:** The current deployment environment uses HTTPS, ensuring secure transmission of login credentials.
*   **Decision:** Security enforcement is strictly server-side. **Hiding UI controls is recognized solely as a UX feature and NOT a security control.**
*   **Decision:** For local Lab 3 development, initial passwords generated by Admins will be displayed once on-screen upon user creation, rather than sent via email, adhering to the explicitly excluded scope.
