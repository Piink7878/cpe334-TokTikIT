# UI Specification: Sprint 3 (Tok TickIT)

This document details the UI design and structural specifications for the Lab 3 increment, building upon the established Zen Green design language. 

## 1. Zen Green Design System Extensions

The application continues to use the Zen Green theme. The following elements are extended for Lab 3:
*   **Role Badges:** Small pill-shaped badges displaying the user role. Colors map to roles (e.g., Green for Requester, Blue for IT Staff, Purple for Admin).
*   **Status Badges:** Consistent color-coded badges for ticket status (e.g., `New` is blue, `In Progress` is orange, `Resolved` is green, `Closed` is gray).
*   **Priority Badges:** Indicators for Requested and IT Priority (e.g., `Low` is gray, `Critical` is red).
*   **Timeline Components:** Vertical threaded list for comments/notes. Public Comments use a standard white/light-gray background. Internal Notes use a distinct subtle yellow or striped background to visually warn IT Staff that it is private.

---

## 2. Common UI States and Feedback

All screens must handle the following states gracefully without breaking the layout:
*   **Loading:** Skeleton loaders for data grids and ticket details; spinner on buttons during form submission.
*   **Empty:** "No data found" illustrations or centered text with a subtle call-to-action (e.g., "Create your first ticket").
*   **No-results:** Distinct from empty state; appears when a search or filter yields no matches (e.g., "No tickets match your search criteria").
*   **Validation Error:** Inline red text below the offending input field. Form borders turn red. Global toast notification for generic submission failures.
*   **Forbidden (403) / Not Found (404):** A full-page or component-level Zen Green error card explaining the user does not have access, avoiding technical jargon and providing a "Return to Dashboard" action.

---

## 3. Screen Specifications

### 3.1 Authentication Flow
**Login Screen:**
*   **Structure:** Centered card on a subtle Zen Green gradient background.
*   **Components:** Email input, Password input, 'Login' primary button.
*   **States:** Displays inline validation for empty fields. On failure (401), displays a generic "Invalid credentials or inactive account" alert at the top of the card.
*   **Responsive:** Fixed width card on desktop/tablet (e.g., 400px). 100% width with padding on mobile.

**Mandatory First-Login Password Change Screen:**
*   **Structure:** Interstitial centered card appearing immediately after a successful login with an initial password.
*   **Components:** Read-only explanatory text ("You must change your initial password..."), 'New Password' input, 'Confirm Password' input, 'Update & Continue' button.
*   **States:** Form validation ensures passwords match. User cannot click away or navigate; the only exit is completing the form or logging out.

### 3.2 Authenticated App Shell
*   **Structure:** Top navigation bar (or side drawer on mobile).
*   **Components:** 
    *   App Logo/Title.
    *   Dynamic Navigation Links based on role (e.g., 'My Tickets' for Requesters, 'Ticket Queue' for IT Staff, 'User Management' for Admins).
    *   User Profile Dropdown: Displays User Name and Role Badge. Includes a "Logout" action.
*   **Responsive:** On mobile, navigation links collapse into a hamburger menu. The Profile section remains accessible.

### 3.3 Requester Ticket Detail (Extensions)
*   **Structure:** Reuses Lab 2 ticket detail structure (Title, Status, Details on left; Attachments on right).
*   **New Components:**
    *   **Timeline / Activity Feed:** Below the main description, a chronologically ordered list of Public Comments.
    *   **Comment Box:** A text area at the bottom of the feed with a "Post Comment" button.
    *   **'Problem Appears Resolved' Action:** A secondary button available if the ticket is not already closed/resolved.
*   **States:** Loading skeleton while fetching comments. Disable the comment box if the ticket is `Closed`.

### 3.4 IT Staff Ticket Queue
*   **Structure:** Full-width page with a control bar at the top and a data grid below.
*   **Components:**
    *   **Control Bar:** Search input (text), Filter dropdowns (Category, Status, Priority, Assignee), and Sort dropdown.
    *   **Data Grid:** Table view (Desktop/Tablet) displaying ID, Title, Requester, Status Badge, IT Priority Badge, Assignee, and Last Updated.
    *   **Pagination:** Standard pagination controls (Prev, Page numbers, Next) at the bottom.
*   **States:** Loading skeleton rows. No-results state when filters are too restrictive.
*   **Responsive:**
    *   **Desktop/Tablet:** Data table format.
    *   **Mobile:** Transforms into a vertical list of cards. Each card displays key info (ID, Title, Status, Priority, Assignee) to fit the narrow viewport. Filters move into a collapsible bottom sheet or modal.

### 3.5 IT Staff Ticket Detail
*   **Structure:** Two-column layout (Desktop) or stacked layout (Mobile). Left column for core ticket info and timeline; right column for operational metadata.
*   **Components (Operational Sidebar):**
    *   **Assignee Dropdown:** Shows current owner. IT Staff can select 'Claim' (self) or choose another IT Staff member from a list.
    *   **Priority Dropdown:** Allows changing the IT Priority.
    *   **Status Dropdown:** Allows transitioning the ticket status based on business rules.
*   **Components (Timeline):**
    *   **Unified Feed:** Displays both Public Comments and Internal Notes.
    *   **Visual Distinction:** Internal Notes must have a distinct background (e.g., light yellow) and an "Internal Only" icon/label to prevent accidental public disclosure.
    *   **Input Area:** Tabbed input box allowing IT Staff to toggle between drafting a "Public Comment" (default) or an "Internal Note". The submit button dynamically changes label/color based on the active tab.

### 3.6 Administrator User Management
*   **Structure:** Minimalist layout similar to the IT Staff Queue but for users.
*   **Components:**
    *   **Control Bar:** 'Add User' primary button, Search input (Name/Email), Role filter dropdown.
    *   **Data Grid:** Table showing Name, Email, Role Badge, Status (Active/Inactive), and an 'Edit' action button.
    *   **Create/Edit Modal (or Side-Panel):** Form containing: Name, Email, Role (Dropdown), Status (Toggle).
    *   **Initial Password Field:** When creating a user, displays an auto-generated initial password or allows typing one.
    *   **Password Reset Action:** On the Edit screen, a button to "Generate New Initial Password".
*   **States:** Form validation for duplicate emails. Toast notification upon successful creation or modification. Clear warning if attempting to deactivate self or the last admin.

---

## 4. Responsive Layout Rules

*   **Desktop ( > 1024px):** Side-by-side layouts (e.g., Ticket Details and Sidebar), full data tables with all columns visible. Persistent top navigation.
*   **Tablet (768px - 1024px):** Fluid widths. Some minor table columns may hide gracefully or truncate. Sidebars may become narrower but remain visible.
*   **Mobile ( < 768px):** 
    *   Tables convert to stacked list cards.
    *   Sidebars stack vertically below the main content.
    *   Navigation collapses behind a hamburger menu.
    *   Modals take up full screen height/width to maximize usability for form inputs.
    *   Buttons ensure a minimum 44x44px touch target area.
