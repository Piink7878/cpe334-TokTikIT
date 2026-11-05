# TokTickIT — CPE334 Lab 4

IT Service Desk ticketing platform supporting authentication, role-based access control (Requester, IT Staff, Administrator), ticket lifecycle management with a Resolution Gate, Actions Taken (with append-only revision history), role-based dashboards, public comments, role-restricted internal notes, and administrative user management. Lab 4 adds Actions Taken, the full ticket status workflow, the Requester and IT Staff dashboards, and final security / accessibility hardening.

Full-stack: React + Express + PostgreSQL + Prisma.

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Bootstrap (Zen Green design language) |
| Backend | Node.js + Express + TypeScript + express-session + bcryptjs |
| Database | PostgreSQL + Prisma ORM |
| File Storage | Local disk (`server/uploads/`) |
| Testing | Vitest + Supertest (API), Vitest + React Testing Library (Client), Playwright (E2E across Desktop, Tablet, Mobile) |

---

## Prerequisites

- Node.js v18+
- PostgreSQL (running locally or remote)
- Git

---

## Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Piink7878/cpe334-TokTikIT.git
cd cpe334-TokTikIT

npm install                 # repository root: Playwright + axe-core for the end-to-end tests
npm --prefix server install
npm --prefix client install
npx playwright install      # one-time download of the Chromium / WebKit browsers used by the E2E tests
```

### 2. Configure Environment Variables

**Server** — copy and fill in your DB connection:

```bash
# Windows (PowerShell)
Copy-Item server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit?schema=public"
PORT=3000
SESSION_SECRET="your-secure-session-secret"
# Comma-separated browser origins allowed to call the API with credentials (default: http://localhost:5173)
CORS_ORIGIN="http://localhost:5173"
```

`SESSION_SECRET` is required when `NODE_ENV=production`. If you open the client on another origin (for example `http://127.0.0.1:5173`), add it to `CORS_ORIGIN`.

**Client** — copy (default value works for local dev):

```bash
Copy-Item client/.env.example client/.env
```

`client/.env` contains:

```env
VITE_API_URL="http://localhost:3000"
```

### 3. Database Migration & Seed

Run from the `server/` directory:

```bash
cd server

# Apply schema migrations
npx prisma migrate dev

# Seed initial data (categories, related systems, users across 3 roles, tickets, comments)
npm run prisma:seed
```

#### Seed Accounts (Default password for all accounts: `Password123!`):

| Role | Email | Status | Must change password at first login |
|---|---|---|---|
| **Administrator** | `admin@toktikit.local` | Active | No |
| **IT Staff** | `staff1@toktikit.local` | Active | Yes |
| **IT Staff** | `staff2@toktikit.local` | Active | No |
| **IT Staff** | `staff3@toktikit.local` | Active | No |
| **IT Staff** | `tech_empty@toktikit.local` | Active | No (no tickets / actions: zero-metric dashboard account) |
| **IT Staff** | `staff4_inactive@toktikit.local` | Inactive | No |
| **Requester** | `req1@toktikit.local` | Active | Yes |
| **Requester** | `req2@toktikit.local` | Active | No |
| **Requester** | `req3@toktikit.local` | Active | No |
| **Requester** | `req4@toktikit.local` | Active | Yes |
| **Requester** | `req_empty@toktikit.local` | Active | No (no tickets: zero-metric dashboard account) |
| **Requester** | `req5_inactive@toktikit.local` | Inactive | No |

The seed is safe to run repeatedly: it never duplicates rows. Re-running it restores the seeded accounts' role / active flags and the owner, status and IT priority of the four seeded tickets (`TKT-1001`..`TKT-1004`) to their seed values; it does not touch other data and never resets passwords.

---

## Running Locally

Open **two terminals**:

**Terminal 1 — Backend API** (port 3000):

```bash
cd server
npm run dev
```

**Terminal 2 — Frontend** (port 5173):

```bash
cd client
npm run dev
```

Then open: **http://localhost:5173**

---

## Running Tests

The server tests use the database in `server/.env`; they create and clean up their own data.

**Backend API & Integration tests (Vitest + Supertest):**

```bash
# Lab 4 only
npx --prefix server vitest run tests/lab-04

# Full server suite, including the Lab 1-3 regressions (22 files, 353 tests)
npm --prefix server test
```

**Frontend component & page tests (Vitest + React Testing Library):**

```bash
# Full client suite (18 files, 173 tests)
npm --prefix client test
```

**E2E tests (Playwright across Desktop Chrome, Tablet iPad, Mobile Safari):**

```bash
# Starts (or reuses) the API on :3000 and the client on :5173
npx playwright test e2e/lab-04      # Lab 4 flows + hardening sweep (15 tests x 3 projects = 45)
npx playwright test e2e/lab-02 e2e/lab-03   # Lab 2-3 regression (9 tests x 3 projects = 27)

# Everything at once (72 tests across Desktop Chrome, Tablet iPad and Mobile Safari)
npx playwright test e2e/lab-02 e2e/lab-03 e2e/lab-04
```

The E2E specs create tickets in the database named by `server/.env` and do not delete them, so the Staff Queue grows with every run; use a disposable database when that matters. Running them also rewrites the tracked Lab 2 screenshots under `artifacts/lab-02/` (run `git checkout -- artifacts/lab-02` before committing).

Latest full run (5 Nov 2026, branch `feat/lab4-7-release-verification`): server 22 files / 353 tests, client 18 files / 173 tests, E2E 72 tests, all passing.

Test files and traceability: [`docs/lab-04/tests.md`](docs/lab-04/tests.md).

---

## Lab 4 Demonstration Guide

After the migration and seed above, start the API and the client and sign in with the seeded accounts (password `Password123!`):

| Step | Account | Where | What to see |
|---|---|---|---|
| 1 | `staff2@toktikit.local` (IT Staff) | **Dashboard** (`/staff-dashboard`) | Unassigned / My Active / Follow-Up Required / Critical-High cards, status breakdown, recent queue tickets, my recent Actions Taken. Every card opens the Ticket Queue with the same filter. |
| 2 | `staff2@toktikit.local` | **Ticket Queue** -> `TKT-1001` | **Service Actions** area: list, `+ Add Action Taken`, Edit (revision history), validation (Description and Result required, Follow-Up Note required when Follow-Up is ticked), assignee list (active IT Staff and Administrators only). |
| 3 | `staff2@toktikit.local` | Ticket Detail -> Operations Panel | Status Transition offers only permitted next statuses; `RESOLVED` is refused (and warned about) until the ticket has at least one Action Taken (Resolution Gate). |
| 4 | `req2@toktikit.local` (Requester) | **Dashboard** (`/requester-dashboard`) and Ticket Detail -> **Service Actions** tab | Only this requester's counts and recent tickets; Actions are read-only. |
| 5 | `tech_empty@toktikit.local`, `req_empty@toktikit.local` | Dashboards | Zero-metric empty states. |
| 6 | `req2@toktikit.local` | `/staff-dashboard` | `403 Forbidden` screen (the API also returns 403). |
| 7 | `admin@toktikit.local` | **User Management**, **Dashboard** | Administrator reuses the IT Staff dashboard and manages accounts. |

Health check: `GET http://localhost:3000/api/health` returns `{"status":"ok","service":"TokTickIT API"}`.

Lab 4 screenshots (desktop, tablet and mobile widths, plus loading / empty / forbidden / failure / validation / conflict states) are kept in [`artifacts/lab-04/screenshots/`](artifacts/lab-04/screenshots/) in the folders `staff-dashboard/`, `requester-dashboard/` and `actions-taken/`. Loading and failure states are produced with Playwright route fixtures (the file names say `-fixture`).

---

## Key API Endpoints

### Authentication & Profile
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user & establish session | Public |
| `POST` | `/api/auth/logout` | Invalidate session & clear cookie | Authenticated |
| `GET` | `/api/auth/me` | Retrieve current authenticated user | Authenticated |
| `POST` | `/api/auth/change-password` | Mandatory or voluntary password change | Authenticated |

### Requester Operations
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/tickets` | List own tickets (search, filter, sort, paginate) | Authenticated Requester |
| `POST` | `/api/tickets` | Create ticket (session-derived identity) | Authenticated Requester |
| `GET` | `/api/tickets/:id` | Get ticket details and public comments | Ticket Owner, IT Staff, Admin |
| `POST` | `/api/tickets/:id/attachments` | Upload attachment | Ticket Owner |
| `GET` | `/api/attachments/:id/download` | Download attachment | Ticket Owner, IT Staff, Admin |
| `DELETE` | `/api/attachments/:id` | Soft-remove attachment with reason | Ticket Owner |
| `POST` | `/api/tickets/:id/indicate-resolved` | Indicate problem appears resolved | Ticket Owner (Requester) |

### IT Staff Operations
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/staff/tickets` | IT Staff Ticket Queue (search, filter, sort, paginate) | IT Staff, Admin |
| `GET` | `/api/staff/tickets/:id` | IT Staff Ticket Detail (with public & internal feeds) | IT Staff, Admin |
| `GET` | `/api/staff/assignees` | List active assignees for ticket ownership | IT Staff, Admin |
| `PATCH` | `/api/staff/tickets/:id/claim` | Claim ticket ownership | IT Staff, Admin |
| `PATCH` | `/api/staff/tickets/:id/assign` | Assign/reassign ticket ownership | IT Staff, Admin |
| `PATCH` | `/api/staff/tickets/:id/priority` | Update IT Priority | IT Staff, Admin |
| `PATCH` | `/api/staff/tickets/:id/status` | Update status per permitted state transitions | IT Staff, Admin |

### Communication
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/tickets/:id/comments` | Retrieve public comments | Ticket Owner, IT Staff, Admin |
| `POST` | `/api/tickets/:id/comments` | Post append-only public comment | Ticket Owner, IT Staff, Admin |
| `GET` | `/api/tickets/:id/internal-notes` | Retrieve role-restricted internal notes | IT Staff, Admin (403 for Requester) |
| `POST` | `/api/tickets/:id/internal-notes` | Post append-only internal note | IT Staff, Admin (403 for Requester) |

### Lab 4: Actions Taken, Workflow and Dashboards
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `POST` | `/api/tickets/:id/actions-taken` | Record an Action Taken (supports `Idempotency-Key`) | IT Staff, Admin |
| `PATCH` | `/api/actions-taken/:actionId` | Edit an Action Taken; every edit appends a revision | IT Staff, Admin |
| `GET` | `/api/tickets/:id/actions-taken` | List Actions Taken (revisions only for staff) | Ticket Owner (read-only), IT Staff, Admin |
| `GET` | `/api/dashboard/requester` | Requester metrics and recent tickets | Requester |
| `GET` | `/api/dashboard/staff` | Queue metrics, status breakdown, my recent actions | IT Staff, Admin |

`PATCH /api/staff/tickets/:id/status` enforces the full status matrix and the Resolution Gate (`RESOLVED` needs at least one Action Taken, otherwise `400 ACTION_TAKEN_REQUIRED`). `POST /api/tickets`, `/comments` and `/internal-notes` accept an optional `Idempotency-Key` header so a retry never creates a duplicate.

### Administrator User Management
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/admin/users` | List users with search and role filter | Admin only |
| `POST` | `/api/admin/users` | Create user with initial password | Admin only |
| `PUT`, `PATCH` | `/api/admin/users/:id` | Update user info/role/active state with safety guards | Admin only |
| `POST` | `/api/admin/users/:id/reset-password` | Set new initial password (`mustChangePassword: true`) | Admin only |

Full specifications: [`docs/lab-04/specification.md`](docs/lab-04/specification.md), [`docs/lab-04/api-spec.md`](docs/lab-04/api-spec.md), [`docs/lab-04/ui-spec.md`](docs/lab-04/ui-spec.md) and [`docs/lab-04/tests.md`](docs/lab-04/tests.md)

---

## Project Structure

```
cpe334-TokTikIT/
├── client/          # React + Vite frontend (Zen Green design system)
│   ├── src/         # App.tsx, api.ts, pages/, components/, contexts/
│   └── tests/       # Vitest client tests (lab-01 .. lab-04)
├── server/          # Express + Prisma backend
│   ├── prisma/      # schema.prisma, migrations/, seed.ts
│   ├── src/         # app.ts, index.ts, middlewares/ (auth, upload), types/
│   ├── tests/       # Vitest server tests (lab-01 .. lab-04)
│   └── uploads/     # Attachment file storage (gitignored)
├── docs/
│   ├── lab-01/
│   ├── lab-02/
│   ├── lab-03/
│   └── lab-04/      # specification, api-spec, ui-spec, tests, ai-use, reviewer
├── artifacts/
│   ├── lab-03/      # screenshots (authentication, staff-queue, staff-ticket-detail, user-management)
│   └── lab-04/
│       └── screenshots/   # staff-dashboard/, requester-dashboard/, actions-taken/ (desktop, tablet, mobile + state captures)
└── e2e/             # Playwright E2E suites (lab-02, lab-03, lab-04)
```

---

## Git Workflow

- `main` — production release branch
- `lab4-staging` — Lab 4 integration branch (every issue is merged here by reviewed PR, then `lab4-staging` into `main`)
- `feat/<issue-number>-<topic>` — per-issue feature branches

> ⚠️ Never commit `.env` files. Only `.env.example` belongs in version control.
