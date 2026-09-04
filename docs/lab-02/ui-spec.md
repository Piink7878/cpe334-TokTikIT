# Lab 2 UI & Responsive Specification: Zen Green Theme

## 1. Visual Design System & Design Tokens

The TokTickIT interface adheres strictly to the **Zen Green Theme**, conveying an intentional, calm, corporate, and highly accessible engineering aesthetic.

### 1.1 Color Tokens
| Token Name | Hex Value | Semantic Usage |
| :--- | :--- | :--- |
| `color-primary` | `#006B3C` | App header, primary CTA buttons, main branding, active key accents. |
| `color-primary-hover` | `#00542F` | Hover state for primary action buttons. |
| `color-secondary` | `#0B7A46` | Active tabs, focus rings, link text, secondary interactive accents. |
| `color-secondary-hover` | `#085F36` | Hover state for secondary links and focus elements. |
| `color-pale-green` | `#EAF6EF` | Selected item highlights, light container fills, success callouts. |
| `color-bg-page` | `#F5F7F6` | Default body/page background (soft near-white). |
| `color-surface` | `#FFFFFF` | Card surfaces, modal panels, active input backgrounds. |
| `color-surface-muted` | `#F0F4F2` | Read-only fields, table header fills, disabled surface fills. |
| `color-border-subtle` | `#E0E5E2` | Card dividers, section borders, table row horizontal borders. |
| `color-border-input` | `#CBD5E1` | Standard editable input borders. |
| `color-border-focus` | `#0B7A46` | Accessible keyboard focus outline. |
| `color-text-main` | `#1A2E22` | Dark charcoal-green for headings and body typography (high contrast). |
| `color-text-muted` | `#5B6B64` | Subtitles, meta-labels, table header titles, helper text. |
| `color-text-disabled` | `#8C9B94` | Disabled buttons, inactive tab labels, placeholder text. |
| `color-danger` | `#D32F2F` | Field validation text, destructive buttons, error callouts. |
| `color-danger-bg` | `#FDF2F2` | Light red surface for error alerts and invalid inputs. |
| `color-warning` | `#B45309` | Medium priority & Pending status badges, warning callouts. |
| `color-warning-bg` | `#FEF3C7` | Soft amber container for warnings. |
| `color-info` | `#1D4ED8` | Info banners and informational badges. |
| `color-info-bg` | `#EFF6FF` | Soft blue container for contextual hints. |

### 1.2 Typography & Sizing
- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Font Scale**:
  - App Title / H1: `24px` (`1.5rem`), Bold (`700`), line-height: `1.25`
  - Section Heading / H2: `18px` (`1.125rem`), Semi-bold (`600`), line-height: `1.35`
  - Subheading / H3: `15px` (`0.9375rem`), Semi-bold (`600`), line-height: `1.4`
  - Body Text: `14px` (`0.875rem`), Regular (`400`), line-height: `1.5`
  - Helper & Badge Text: `12px` (`0.75rem`), Medium (`500`), line-height: `1.4`
- **Line Spacing**: Set globally to `1.2`–`1.25` for screen density without overcrowding.

### 1.3 Spacing & Elevations
- **Spacing Scale**: `4px` (xs), `8px` (sm), `12px` (md), `16px` (lg), `24px` (xl), `32px` (2xl)
- **Border Radius**:
  - Inputs / Buttons: `6px` (`rounded-md`)
  - Badges / Pills: `9999px` (`rounded-full`)
  - Cards / Modals: `8px` (`rounded-lg`)
- **Shadows**:
  - Card Shadow: `0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)`
  - Dropdown / Modal Shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)`

---

## 2. Component Rules & Form Controls

### 2.1 Labels, Asterisks, and Helpers
- **Label Placement**: Placed strictly **above** the form control with `margin-bottom: 6px`.
- **Required Marker**: A red asterisk (`*`) in color `#D32F2F` follows immediately after the label text (e.g., `Ticket Summary *`). The asterisk indicates mandatory entry but never substitutes for validation error messaging.
- **Helper Text**: Shown in `#5B6B64` below the input to explain format constraints or bounds.

### 2.2 Input Control States
| State | Visual Style |
| :--- | :--- |
| **Normal (Editable)** | Background `#FFFFFF`, Border `1px solid #CBD5E1`, Text `#1A2E22`, Height `38px`, Padding `8px 12px`. |
| **Hover** | Border color transitions to `#94A3B8`. |
| **Focused** | Border `1px solid #0B7A46`, Box-shadow `0 0 0 3px rgba(11, 122, 70, 0.2)` (Accessible focus ring). |
| **Read-Only / Disabled** | Background `#F0F4F2`, Border `1px solid #E0E5E2`, Text `#5B6B64`, Cursor `not-allowed`. |
| **Invalid (Error)** | Background `#FDF2F2`, Border `1px solid #D32F2F`, Focus ring `rgba(211, 47, 47, 0.2)`. |

### 2.3 Error Message Placement
- **Position**: Inline validation errors appear **immediately beneath** the respective input field with `margin-top: 4px`.
- **Appearance**: Text `#D32F2F`, Font size `12px`, with an alert circle icon (`8px` gap).
- **Rule**: Errors must never be rendered solely as a generic modal or a single detached alert box at the top of the screen.

### 2.4 Button Hierarchy & States
1. **Primary Button** (`.btn-primary`):
   - Background `#006B3C`, Text `#FFFFFF`, Hover `#00542F`.
   - Used for main actions (e.g., "Submit Ticket", "+ Create Ticket", "Continue").
2. **Secondary Button** (`.btn-secondary`):
   - Background `#FFFFFF`, Border `1px solid #0B7A46`, Text `#0B7A46`, Hover `#EAF6EF`.
   - Used for non-primary actions (e.g., "Back to My Tickets", "Clear Filters").
3. **Destructive Button** (`.btn-danger`):
   - Background `#D32F2F`, Text `#FFFFFF`, Hover `#B71C1C`.
   - Used for soft-removing attachments in confirmation modals.
4. **Disabled State** (`[disabled]`):
   - Background `#E2E8F0`, Text `#8C9B94`, Border `none`, Cursor `not-allowed`.
5. **Busy / Submitting State** (`.btn-busy`):
   - Remains visually primary, opacity `0.8`, cursor `wait`.
   - Displays a dual-ring inline CSS spinner (`16px x 16px`) replacing or adjacent to the button text:
     ```css
     .spinner {
       border: 2px solid rgba(255, 255, 255, 0.3);
       border-top: 2px solid #FFFFFF;
       border-radius: 50%;
       width: 14px;
       height: 14px;
       animation: spin 0.8s linear infinite;
     }
     ```
   - Disables pointer events to prevent duplicate click submissions.

### 2.5 Badges & Status Indicators
| Status / Priority | Text Color | Background Color | Border / Accent |
| :--- | :--- | :--- | :--- |
| **New** | `#006B3C` | `#EAF6EF` | `1px solid #BCE3CE` |
| **In Progress / Open** | `#1D4ED8` | `#EFF6FF` | `1px solid #BFDBFE` |
| **Pending / Medium** | `#B45309` | `#FEF3C7` | `1px solid #FDE68A` |
| **High / Critical** | `#B91C1C` | `#FEE2E2` | `1px solid #FECACA` |
| **Low** | `#4B5563` | `#F3F4F6` | `1px solid #E5E7EB` |
| **Resolved / Closed** | `#065F46` | `#D1FAE5` | `1px solid #A7F3D0` |

---

## 3. Responsive Breakpoints & Layout Rules

### 3.1 Breakpoint Definitions
- **Desktop**: Viewport width $\ge 992	ext{ px}$
- **Tablet**: Viewport width between $768	ext{ px}$ and $991	ext{ px}$
- **Mobile**: Viewport width $< 768	ext{ px}$

### 3.2 Layout Adaptation by Viewport
| Feature / Screen | Desktop ($\ge 992	ext{ px}$) | Tablet ($768 - 991	ext{ px}$) | Mobile ($< 768	ext{ px}$) |
| :--- | :--- | :--- | :--- |
| **Global Shell** | Horizontal header: Logo on left, nav links center, Requester switcher on right. | Header compact; Requester info remains visible. | Collapsible burger menu or stacked navigation bar. Min touch target: `44px x 44px`. |
| **Create Ticket** | Two-column grid for metadata; full-width Summary, Description, and Attachment dropzone. | Two-column grid with reduced margins. | All fields stacked in a single vertical column. Buttons expand to full width (`100%`). |
| **My Tickets List** | Full horizontal data table (Ticket No, Date, Summary, Category, Priorities, Status, Last Updated). | Condensed table with horizontal scroll container or hidden non-essential columns (e.g. IT Priority). | **Mobile Ticket Card View**: Table transforms into structured vertical cards with badges. |
| **Filters & Search** | Inline horizontal toolbar: Search input on left, dropdown filters, "Clear Filters", "+ Create Ticket" CTA on right. | Search wraps above filter dropdowns in a 2-row layout. | All filters stack vertically into an accordion/collapsible filter drawer with full-width search input. |
| **Ticket Detail** | 2-row read-only metadata grid; side-by-side tabs; attachment grid (2 per row). | Condensed 2-column layout; attachments list vertically. | Single-column stack; tabs turn into a clean segmented control; attachment cards stack. |
| **Overflow & Scroll** | Max width centered: `1200px`. No horizontal page scrollbars. | Content padding: `16px`. Safe boundary checks. | Padding: `12px`. Zero horizontal document scrolling (`overflow-x: hidden` on body). |

---

## 4. Screen Specifications & States

### 4.1 Development Requester Selector Screen (`/`)
- **Container**: Centered card (`max-width: 520px`), margin top `60px`.
- **Contents**:
  - Avatar / User icon in `#EAF6EF` circle.
  - Heading: "Select Development Requester" (22px, `#1A2E22`).
  - Subtitle: "Choose a development requester to simulate the current requester context for Lab 2. This is for testing only and is not a login screen."
  - Dropdown: `<select>` listing active requesters (`name (department)`).
  - Blue Info Callout: "Authentication coming in Lab 3: In Lab 3, this selection will be replaced with secure authentication so you can access the system with your own account."
  - Footer Action: "Continue" (`.btn-primary`) aligned right.
- **States**:
  - *Loading*: Disabled dropdown with placeholder "Loading active requesters...".
  - *Empty*: If no active requesters exist, displays amber banner "No active development requesters found in database."
  - *Error*: Red alert box with retry button if backend API fails.

### 4.2 Create Ticket Screen (`/create-ticket`)
- **Layout**:
  - Breadcrumb: `My Tickets > Create Ticket`
  - Page Title: "Create Support Ticket"
  - Form Fields:
    1. System Row: Ticket Date (Read-only, now), Requester Name (Read-only from active context).
    2. Category (Dropdown, required) & Related System (Dropdown, required).
    3. Requested Priority (Dropdown: Low, Medium, High, Critical; default Medium, required).
    4. Ticket Summary (Text input, min 5, max 150 chars, required).
    5. Description (Textarea, min 10, max 3000 chars, 5 rows default, required).
    6. Attachments Dropzone (File selector supporting JPG, PNG, WEBP, PDF up to 5MB, max 5 files).
    7. Form Actions: "Cancel" (Secondary) and "Submit Ticket" (Primary).
- **Feedback States**:
  - *Submitting*: Submit button enters `.btn-busy`, input fields become read-only.
  - *Success*: Success banner with checkmark, displaying generated Ticket Number (`TKT-YYYY-XXXXXX`) with link "View Ticket" or "Back to My Tickets".
  - *API Failure*: Red banner at form top explaining failure, while keeping all user typed inputs and attached files intact.

### 4.3 My Tickets Screen (`/my-tickets`)
- **Header Toolbar**:
  - Title: "My Tickets" + Subtitle: "View and track all of your support requests."
  - Actions: "Clear Filters" button and "+ Create Ticket" button.
- **Filter Bar**:
  - Search Input: "Search by ticket number or summary..." with search icon.
  - Dropdowns: "Category" (All / list), "Requested Priority" (All / list), "IT Priority" (All / list), "Current Status" (All / list).
- **Desktop Table Representation**:
  - Columns: Ticket No (clickable link), Created Date, Summary (truncated at 50 chars), Category, Requested Priority (Badge), IT Priority (Badge), Current Status (Badge), Last Updated.
- **Mobile Card Representation**:
  - Renders as a list of rounded border cards (`#FFFFFF`, border `#E0E5E2`):
    - Top row: Ticket Number (`#006B3C`, bold) and Current Status badge.
    - Middle: Summary text (`#1A2E22`, bold, 14px).
    - Metadata row: Category pill, Priority badge, Created Date (`12px`, `#5B6B64`).
- **Empty State vs. No-Results State (Strict Separation)**:
  1. **Empty State** (Requester has never created any tickets):
     - Illustration / Icon: Empty folder or inbox icon in `#CBD5E1`.
     - Heading: "No tickets found".
     - Subtext: "You haven't submitted any support tickets yet. Click below to get started."
     - Action CTA: Prominent green button "+ Create Your First Ticket".
  2. **No-Results State** (Search or filters matched 0 tickets):
     - Illustration / Icon: Search magnifying glass with an 'X' icon.
     - Heading: "No matching tickets".
     - Subtext: "No tickets matched your current search and filter criteria. Try adjusting or clearing your filters."
     - Action CTA: Secondary button "Clear All Filters".
- **Pagination Controls**:
  - Displays "Showing X to Y of Z tickets".
  - Buttons: `< Previous`, Page numbers (`[1]`, `2`, `3`), `Next >`.
  - Active page highlighted in `#006B3C` with white text.

### 4.4 Requester Ticket Detail Screen (`/tickets/:id`)
- **Layout**:
  - Header: Breadcrumb `My Tickets > Ticket Details` and "Back to My Tickets" button.
  - Primary Info Card:
    - Row 1: Ticket No (Read-only badge/code), Ticket Date, Category, Related System.
    - Row 2: Requester Name, Requested Priority badge, IT Priority badge, Current Status badge.
    - Row 3: Summary (Full text, `#1A2E22`).
    - Row 4: Description (Structured text area, preserved whitespace).
  - Navigation Tabs (Sub-sections) - *Note: These are UI placeholders only for Lab 2 and have no backend functionality*:
    - `Public Comments (0)`: Disabled tab, labeled "(Available in future sprint)".
    - `Attachments (N)`: **Active tab**.
    - `Service Actions (0)`: Disabled tab.
    - `Event Log (0)`: Disabled tab.
- **Attachment Section Components**:
  - Add Attachment button / miniature dropzone (disabled when 5 active files reached).
  - Active Attachment Card:
    - File icon (PDF / Image preview thumbnail).
    - Original file name, formatted size (e.g., `1.4 MB`), upload timestamp.
    - Actions: "Download" icon/link and "Remove" (soft-removal trash icon).
  - Soft-Removed Attachment Card:
    - Subtle gray styling (`opacity: 0.6`).
    - Badge: `Removed`.
    - Removed reason text displayed: *"Removed by requester: [Reason] on [Date]"*.
    - Download action disabled and replaced with "File unavailable".
- **Soft-Removal Confirmation Modal**:
  - Title: "Remove Attachment".
  - Message: "Are you sure you want to remove this attachment? The file will no longer be downloadable."
  - Form Input: Textarea "Reason for removal *" (required).
  - Buttons: "Cancel" (Secondary) and "Confirm Removal" (Destructive `.btn-danger`).

---

## 5. Visual Inspection & Responsive Checklist

This checklist must be verified using browser devtools and automated Playwright visual screenshot tests:

| Check ID | Target Viewport | Screen / Component | Verification Criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **VIS-01** | Desktop ($\ge 992	ext{ px}$) | Header & Nav | App title and navigation items vertically aligned; active requester name displayed clearly on top right. | Planned / Not Verified |
| **VIS-02** | Desktop ($\ge 992	ext{ px}$) | Create Ticket | 2-column layout renders cleanly; Summary & Description have full width; no horizontal scrollbar. | Planned / Not Verified |
| **VIS-03** | Desktop ($\ge 992	ext{ px}$) | My Tickets | 8-column table with aligned headers; status badges cleanly centered; pagination aligned at bottom right. | Planned / Not Verified |
| **VIS-04** | Desktop ($\ge 992	ext{ px}$) | Ticket Detail | Read-only input fields have distinct `#F0F4F2` background; active attachments display download & delete buttons. | Planned / Not Verified |
| **VIS-05** | Tablet ($768 - 991	ext{ px}$) | Create Ticket | Form controls adjust width responsively; labels remain above controls; no text truncation on headers. | Planned / Not Verified |
| **VIS-06** | Tablet ($768 - 991	ext{ px}$) | My Tickets | Filter toolbar wraps cleanly to 2 rows; table columns retain readable padding without breaking page width. | Planned / Not Verified |
| **VIS-07** | Tablet ($768 - 991	ext{ px}$) | Modals | Soft-removal modal stays centered with comfortable backdrop padding (`min 24px` margin). | Planned / Not Verified |
| **VIS-08** | Mobile ($< 768	ext{ px}$) | Global | Document body has `overflow-x: hidden`; zero unintended horizontal page scroll across all routes. | Planned / Not Verified |
| **VIS-09** | Mobile ($< 768	ext{ px}$) | Navigation | Header collapses gracefully; user identity remains accessible; buttons have at least `44px` touch height. | Planned / Not Verified |
| **VIS-10** | Mobile ($< 768	ext{ px}$) | Create Ticket | Single-column vertical stack for all fields; submit button stretches full width (`100%`). | Planned / Not Verified |
| **VIS-11** | Mobile ($< 768	ext{ px}$) | My Tickets | Data table automatically transforms into responsive card list; badges remain legible without clipping. | Planned / Not Verified |
| **VIS-12** | Mobile ($< 768	ext{ px}$) | Empty / No-Results | Empty and No-Results cards center cleanly with legible text and easily clickable action buttons. | Planned / Not Verified |
| **VIS-13** | All Sizes | Validation States | Required asterisks (`*`) appear in red; error text appears directly below inputs; no popup-only errors. | Planned / Not Verified |
| **VIS-14** | All Sizes | Buttons & Spinners | Primary buttons show loading spinner when busy; double-click is prevented during active requests. | Planned / Not Verified |
