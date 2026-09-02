# Lab 2 Sprint Engineering Specification: TokTickIT Requester Ticketing MVP

## 1. Sprint Goal
Deliver a stable, responsive Requester-facing Ticketing MVP (TokTickIT) using the Zen Green theme, allowing end users to simulate login via a Development Requester selector, create tickets with attachments, view and filter their own tickets, and inspect ticket details with soft-removal of attachments.

## 2. Stakeholder Request Interpretation
The IT department requires a professional self-service ticketing system for corporate requesters. Since real authentication is deferred to Lab 3, Lab 2 implements a simulated requester selection context to enforce multi-user data ownership while establishing reusable Zen Green UI foundations. The system must support creating tickets, attaching supporting files safely, viewing personal tickets via "My Tickets" with robust searching, filtering, sorting, and pagination, and viewing read-only ticket details with attachment soft-removal capabilities. Cross-requester data access must be strictly forbidden.

## 3. Scope
### Included (In-scope)
- **Development Requester Context**: Context selection and switching mechanism for testing multi-user isolation prior to real authentication in Lab 3.
- **Ticket Creation**: Create Ticket form with client and server validations, automatic official Ticket Number generation, category/system selection, and initial attachment handling.
- **My Tickets**: Requester-owned ticket listing featuring full-text search, multi-facet filtering (Category, Requested Priority, IT Priority, Status), sorting, and pagination.
- **Requester Ticket Detail (View Mode)**: Read-only display of ticket headers and descriptions; ability to add new attachments post-creation.
- **Attachment Lifecycle**: Support upload, preview/download of active attachments, and soft removal requiring a mandatory removal reason.
- **Data Isolation & Ownership**: Enforcement preventing any requester from listing, viewing, downloading attachments from, or modifying tickets owned by other requesters.
- **Zen Green Design System**: Consistent reusable design tokens, typography, form controls, badges, responsive layouts, and feedback states.

### Excluded (Out-of-scope)
- **Real Authentication & Security**: Real login/logout, password hashing, session tokens, JWTs, and secure RBAC (scheduled for Lab 3).
- **IT Staff Workflow**: IT staff queue, ticket claiming, reassigning, technician resolution workflows, and IT priority reassignment.
- **Ticket Lifecycle Transitions**: Ticket status progression beyond the initial 'New' status (e.g., In Progress, Pending, Resolved, Closed, Reopened, Cancelled).
- **Collaboration & Work Tracking**: Public Comments, Internal Notes, Service Actions, and Event Logs (UI placeholders/stubs only, no functionality).
- **Administrative Functions**: System administration for creating/updating users, departments, categories, and related systems.

---

## 4. Functional Requirements
- **FR-01 (Requester Context Selection)**: The system shall provide a Development Requester selector screen listing all active requesters, persisting the selected requester context across navigation.
- **FR-02 (Requester Context Switching)**: The system shall allow the user to switch the active Development Requester at any time, immediately updating the active context and clearing or reloading requester-specific data.
- **FR-03 (Unique Ticket Number Generation)**: The system shall automatically generate a unique, non-editable official Ticket Number (format `TKT-YYYY-XXXXXX`) upon ticket creation on the backend.
- **FR-04 (Ticket Creation Form)**: The system shall provide a Create Ticket interface capturing Ticket Date (auto), Requester (auto-filled from context), Category, Related System, Ticket Summary, Description, Requested Priority, and optional initial Attachments.
- **FR-05 (Attachment Upload & Validation)**: The system shall allow requesters to upload up to 5 supporting attachments per ticket, restricting file formats to JPG/JPEG, PNG, WEBP, and PDF with a maximum size of 5 MB per file.
- **FR-06 (Requester Ticket Isolation)**: The system shall strictly isolate ticket data such that "My Tickets" displays only tickets belonging to the currently selected Development Requester.
- **FR-07 (Search, Filter, Sort & Pagination)**: The system shall provide search by ticket number and summary, filtering by Category, Requested Priority, IT Priority, and Current Status, multi-column sorting, and configurable pagination in the My Tickets view.
- **FR-08 (Requester Ticket Detail View)**: The system shall provide a read-only Ticket Detail view for the owner displaying all ticket header fields, timestamps, summary, and description.
- **FR-09 (Post-Creation Attachment Addition)**: The system shall allow the ticket owner to upload additional permitted attachments from the Ticket Detail view, subject to the 5-active-attachments limit.
- **FR-10 (Attachment Soft Removal)**: The system shall allow the ticket owner to soft-remove an active attachment from the ticket, requiring a non-empty removal reason while permanently retaining file metadata and audit history.

---

## 5. Business Rules
- **BR-01 (Backend Ticket Number Generation)**: The official Ticket Number must be generated exclusively by the backend database/service using the format `TKT-YYYY-XXXXXX` (e.g., `TKT-2026-001001`), ensuring global uniqueness and sequential or collision-free integrity.
- **BR-02 (Initial Ticket Status)**: Every newly created ticket must be initialized with `Current Status = 'New'`. Requesters cannot set or alter ticket status.
- **BR-03 (Development Context Non-Security)**: The Development Requester selector is an ephemeral testing harness for Lab 2. It does not provide real security, cryptographic sessions, or access tokens.
- **BR-04 (Attachment Constraints)**: Permitted file types are strictly limited to `image/jpeg` (.jpg, .jpeg), `image/png` (.png), `image/webp` (.webp), and `application/pdf` (.pdf). The maximum file size is exactly 5,242,880 bytes (5 MB) per file.
- **BR-05 (Attachment Capacity Limit)**: A ticket may have at most five (5) active (non-removed) attachments at any given time. Uploads that would exceed this threshold must be rejected.
- **BR-06 (Attachment Soft Removal)**: Attachment deletion must be implemented as a soft removal. The file's physical access/download is revoked, but metadata (`originalFilename`, `fileSize`, `contentType`, `removedAt`, `removedReason`, `removedByRequesterId`) must remain visible in the audit history.
- **BR-07 (Download Restriction on Removed Files)**: Any attempt to preview or download a soft-removed attachment must be blocked by the server, returning HTTP 410 Gone or 404 Not Found.
- **BR-08 (Data Ownership & Access Control)**: Direct read or write access (listing, detail inspection, attachment upload, attachment download, attachment removal) to a ticket belonging to another requester must be rejected with HTTP 403 Forbidden or 404 Not Found.
- **BR-09 (Validation Rules & Bounds)**:
  - `Summary`: Required string, minimum 5 characters, maximum 150 characters, trimmed of leading/trailing whitespace.
  - `Description`: Required string, minimum 10 characters, maximum 3000 characters, trimmed of leading/trailing whitespace.
  - `Category`: Required; must match an active Category in the database.
  - `Related System`: Required; must match an active Related System in the database.
  - `Requested Priority`: Required; valid enum values are `Low`, `Medium`, `High`, `Critical`. Default is `Medium`.
  - `IT Priority`: Initialized identically to `Requested Priority` upon creation; read-only for requesters.
- **BR-10 (Active Requester Selection)**: Only active requesters (`isActive = true`) can be selected in the Development Requester selector. Inactive requesters must be omitted from selection.
- **BR-11 (Preservation of Form State on Failure)**: In the event of a network or server validation failure during ticket submission, all user-entered form data (summary, description, selections) and valid queued attachments must be retained.
- **BR-12 (Atomic Ticket Submission)**: If ticket creation succeeds but an associated batch attachment upload fails, the ticket record is retained, and the user is alerted to re-attach the failed files in the detail view.

---

## 6. UI Specification Summary
- **Visual Design (Zen Green Theme)**:
  - Primary Green: `#006B3C` (app header, primary CTA buttons, major emphasis).
  - Secondary Green: `#0B7A46` (active navigation, focus rings, link hover states).
  - Pale Green: `#EAF6EF` (selected items, subtle container backgrounds, success banners).
  - Page Background: `#F5F7F6` (light neutral background).
  - Surface Cards: `#FFFFFF` with 1px border (`#E0E5E2`) and subtle box shadow.
  - Text: Dark charcoal-green (`#1A2E26`) for body text, muted gray (`#5B6B64`) for helper text.
- **Controls & Form States**:
  - Editable Inputs: White background, 1px neutral border (`#CBD5E1`), 38px standard height, rounded-md (4px-6px).
  - Read-Only / Disabled Inputs: Shaded soft gray-green background (`#F0F4F2`), muted text, non-interactive.
  - Validation: Red asterisk (`*`) on required labels; inline dark red error messages (`#D32F2F`) directly beneath invalid inputs; red input border on error.
  - Buttons: Primary green submit button with loading spinner / busy state disabling multiple clicks.
- **Key Screens**:
  1. *Development Requester Selector*: Centered card modal/page for selecting the simulated user with warning banner stating real authentication arrives in Lab 3.
  2. *Create Ticket*: Form organized logically (auto-filled headers on top, category/system group, summary/description full width, dropzone for attachments, action footer).
  3. *My Tickets*: Data table with search box, category/priority/status filters, clear filter button, pagination controls, status badges, and mobile responsive card view.
  4. *Requester Ticket Detail*: Read-only ticket overview, metadata badges, attachment list (with download action and soft-remove modal button), and disabled/placeholder tabs for Public Comments, Service Actions, and Event Logs.
- **Responsive Breakpoints**:
  - Desktop (>= 992px): Multi-column grid layout, centered max-width 1200px.
  - Tablet (768px - 991px): Two-column form layout, table scroll or condensed view.
  - Mobile (< 768px): Single-column stacked fields, full-width touch targets (minimum 44px height), responsive ticket cards instead of wide tables, zero horizontal scroll.

---

## 7. Data Changes
### Database Schema Design (Prisma / PostgreSQL)
1. **RequesterUser**:
   - `id`: Int (PK, autoincrement)
   - `name`: String
   - `email`: String (Unique)
   - `department`: String
   - `isActive`: Boolean (Default: true, index)
   - `createdAt`, `updatedAt`: DateTime
2. **Category**:
   - `id`: Int (PK, autoincrement)
   - `name`: String (Unique) - Account and Access, Hardware, Software, Network
   - `isActive`: Boolean (Default: true)
3. **RelatedSystem**:
   - `id`: Int (PK, autoincrement)
   - `name`: String (Unique) - Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Corporate Laptop, Printer
   - `isActive`: Boolean (Default: true)
4. **Ticket**:
   - `id`: Int (PK, autoincrement)
   - `ticketNumber`: String (Unique, Indexed) - `TKT-YYYY-XXXXXX`
   - `requesterId`: Int (FK -> RequesterUser.id, Indexed)
   - `categoryId`: Int (FK -> Category.id)
   - `relatedSystemId`: Int (FK -> RelatedSystem.id)
   - `summary`: String (VarChar 150)
   - `description`: Text
   - `requestedPriority`: Enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
   - `itPriority`: Enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
   - `status`: Enum (`NEW`, `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`) (Default: `NEW`, Indexed)
   - `createdAt`: DateTime (Default: now(), Indexed)
   - `updatedAt`: DateTime (Updated on change)
5. **Attachment**:
   - `id`: Int (PK, autoincrement)
   - `ticketId`: Int (FK -> Ticket.id, Indexed)
   - `originalFilename`: String
   - `storedFilename`: String
   - `filePath`: String
   - `fileSize`: Int (bytes)
   - `contentType`: String (MIME)
   - `isRemoved`: Boolean (Default: false, Indexed)
   - `removedAt`: DateTime? (Nullable)
   - `removedReason`: String? (Nullable)
   - `removedByRequesterId`: Int? (FK -> RequesterUser.id, Nullable)
   - `createdAt`: DateTime (Default: now())

### Indexes & Constraints Justification
- `ticketNumber` is marked `UNIQUE` and indexed for O(1) direct lookup.
- Composite index on `Ticket (requesterId, createdAt DESC)` optimizes the "My Tickets" query filtering by owner and sorting chronologically.
- `Attachment (ticketId, isRemoved)` enables fast retrieval of active attachments without scanning removed records.

### Seed Data
- 4 Active Requesters (e.g., Jennifer Anderson, David Lee, Sarah Johnson, Michael Brown) and 1 Inactive Requester (e.g., Jane Inactive).
- 4 Categories (`Account and Access`, `Hardware`, `Software`, `Network`).
- 7 Related Systems (`Email`, `Campus Wi-Fi`, `VPN`, `LEB2 App`, `Grade Submission App`, `Printer`, `Corporate Laptop`).

---

## 8. API Contract Summary
- `GET /api/requesters` -> List active development requesters (HTTP 200).
- `GET /api/categories` -> List active categories (HTTP 200).
- `GET /api/related-systems` -> List active related systems (HTTP 200).
- `POST /api/tickets` -> Create new ticket for current requester (Headers: `X-Requester-Id` or body `requesterId`) (HTTP 201, 400, 422).
- `GET /api/tickets?search=&categoryId=&priority=&status=&page=1&limit=10&sortBy=createdAt&sortOrder=desc` -> Paginated list of owned tickets (HTTP 200, 400).
- `GET /api/tickets/:id` -> Retrieve owned ticket details (HTTP 200, 403, 404).
- `POST /api/tickets/:id/attachments` -> Upload attachment (multipart/form-data) (HTTP 201, 400, 403, 413, 422).
- `GET /api/attachments/:id/download` -> Download active attachment file (HTTP 200, 403, 404, 410).
- `DELETE /api/attachments/:id` -> Soft-remove attachment with body `{ reason: string }` (HTTP 200, 400, 403, 404).

---

## 9. Acceptance Criteria
- **AC-01 (Successful Ticket Creation)**: Given a selected Development Requester and valid ticket details, when the user submits the Create Ticket form, then a ticket is persisted with Current Status 'New', a unique Ticket Number (`TKT-YYYY-XXXXXX`) is returned, and the user is notified with a success view.
- **AC-02 (Client-Side Validation on Submit)**: Given missing mandatory fields (Summary < 5 chars, Description < 10 chars, unselected Category/System), when the user clicks Submit, then field-level inline error messages appear and no API call is triggered.
- **AC-03 (Unauthenticated Navigation Redirect)**: Given no Development Requester is selected, when the user navigates to `/create-ticket`, `/my-tickets`, or `/tickets/:id`, then the application immediately redirects the user to the Development Requester selection screen.
- **AC-04 (Requester Data Isolation in List)**: Given Requester A is selected and has tickets in the database, when Requester B is selected via the selector, then My Tickets displays only tickets owned by Requester B, and Requester A's tickets are completely hidden.
- **AC-05 (Attachment File Validation - Size & Type)**: Given an attachment exceeding 5 MB or with an unsupported extension (e.g., .exe, .zip), when selected for upload, then the system immediately rejects the file with an explicit error message and blocks submission.
- **AC-06 (Attachment File Validation - Quantity Limit)**: Given a ticket with 5 active attachments, when the requester attempts to upload a 6th attachment, then the upload is rejected with a message stating that the maximum of 5 active attachments has been reached.
- **AC-07 (Soft Removal Requiring Reason)**: Given an owned ticket with an active attachment, when the requester initiates attachment removal and provides a valid removal reason, then the attachment status transitions to soft-removed (`isRemoved = true`), retaining metadata while disabling download actions.
- **AC-08 (Soft Removal Reason Validation)**: Given an attachment removal modal, when the requester attempts to confirm removal without entering a reason (or with whitespace only), then the confirmation is blocked with an inline error requiring a reason.
- **AC-09 (Blocked Download of Soft-Removed File)**: Given an attachment that has been soft-removed, when any user or script attempts to access the download endpoint `GET /api/attachments/:id/download`, then the server returns HTTP 410 Gone (or 404) and no file data is transmitted.
- **AC-10 (Unauthorized Direct Ticket Access)**: Given a ticket owned by Requester A, when Requester B attempts to open `/tickets/:id` or call `GET /api/tickets/:id`, then the server returns HTTP 403 Forbidden or 404 Not Found, and an unauthorized message is presented.
- **AC-11 (Search, Filter, and Clear Functionality)**: Given a list of tickets in My Tickets, when the requester enters a matching ticket number or summary keyword and filters by status/category, then the table updates dynamically to show only matching tickets; clicking "Clear Filters" restores the complete owned list.
- **AC-12 (Server Failure Form State Retention)**: Given an offline or erroring backend API (HTTP 500), when the user submits a valid ticket, then an alert banner displays the network error while retaining all user-typed inputs and queued attachments in the form.

---

## 10. Definition of Done (DoD)

### Part 1: Product Definition of Done
- [ ] All functional requirements (FR-01 to FR-10) and business rules (BR-01 to BR-12) are fully implemented.
- [ ] All acceptance criteria (AC-01 to AC-12) are validated by passing automated unit, API, UI, or E2E tests with 100% pass rate.
- [ ] No planned automated tests are skipped, commented out, or flaky.
- [ ] Backend endpoints enforce data isolation and ownership checks, returning proper HTTP status codes (200, 201, 400, 403, 404, 410, 422).
- [ ] Attachment constraints (types, 5 MB limit, 5 file max, soft-removal with reason, download blocking) are strictly verified both client-side and server-side.
- [ ] Frontend strictly adheres to the Zen Green visual specifications with zero layout clipping, zero horizontal overflow at desktop (>=992px), tablet (768-991px), and mobile (<768px).
- [ ] Error, loading, empty, and no-results states are implemented and visually verified across all views.

### Part 2: Course Delivery Definition of Done
- [ ] All work is organized and tracked using GitHub Issues across Backlog, Specified, Started, PR Review, Fixing, and Done.
- [ ] Branch workflow followed strictly: feature branches merged into `lab2-staging` via peer-reviewed Pull Requests, then released to `main`.
- [ ] `reviewer.md` is populated with reviewer identity, PR links, comments given and received, responses, and approvals.
- [ ] Documentation files (`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `ai-use.md`) are complete and committed in `docs/lab-02/`.
- [ ] Evidence PDF prepared matching "Answer Part 1" through "Answer Part 9" with legible screenshots and operational links.

---

## 11. Assumptions and Decisions
- **D-01 (Session Storage for Requester Context)**: The selected Development Requester ID is stored in the browser's `localStorage` or `sessionStorage` under key `toktickit_dev_requester_id` and transmitted to the backend via custom request header `X-Requester-Id`.
- **D-02 (Local File Storage)**: Uploaded attachments are safely renamed with a UUID prefix and stored in an isolated server directory (`uploads/lab-02/`), with original names and MIME types recorded in PostgreSQL.
- **D-03 (Ticket Number Format)**: Formatted as `TKT-{YYYY}-{6-digit sequential number}` (e.g., `TKT-2026-000001`), derived using database sequence or atomic counter.
- **D-04 (Stubbed Detail Tabs)**: Public Comments, Service Actions, and Event Logs display disabled tab indicators with badge counts or a message indicating availability in future labs.
