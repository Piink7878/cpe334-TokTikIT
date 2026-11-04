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

npm --prefix server install
npm --prefix client install
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

---|---|---|---|
| **Administrator** | `admin@toktikit.local` | Active | `false` |
| **IT Staff** | `staff1@toktikit.local` | Active | `false` |
| **IT Staff** | `staff2@toktikit.local` | Active | `false` |
| **IT Staff** | `staff3@toktikit.local` | Active | `false` |
| **IT Staff** | `staff.inactive@toktikit.local` | Inactive | `false` |
| **Requester** | `req1@toktikit.local` | Active | `false` |
| **Requester** | `req2@toktikit.local` | Active | `false` |
| **Requester** | `req3@toktikit.local` | Active | `false` |
| **Requester** | `req4@toktikit.local` | Active | `false` |
| **Requester** | `req.inactive@toktikit.local` | Inactive | `false` |
| **First-Login User** | `firstlogin@toktikit.local` | Active | `mustChangePassword: true` |

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
npx playwright test e2e/lab-04      # Lab 4 flows + hardening sweep
npx playwright test e2e/lab-02 e2e/lab-03   # Lab 2-3 regression
```

Test files and traceability: [`docs/lab-04/tests.md`](docs/lab-04/tests.md).

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
│   └── lab-04/      # screenshots (staff-dashboard, requester-dashboard, actions-taken)
└── e2e/             # Playwright E2E suites (lab-02, lab-03, lab-04)
```

---

## Git Workflow

- `main` — production release branch
- `lab4-staging` — Lab 4 integration branch (every issue is merged here by reviewed PR, then `lab4-staging` into `main`)
- `feat/<issue-number>-<topic>` — per-issue feature branches

> ⚠️ Never commit `.env` files. Only `.env.example` belongs in version control.
