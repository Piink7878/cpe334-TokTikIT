# TokTickIT — CPE334 Lab 3

IT Service Desk ticketing platform supporting authentication, role-based access control (Requester, IT Staff, Administrator), ticket lifecycle management, public comments, role-restricted internal notes, and administrative user management.

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
```

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

| Role | Email | Status | Initial Password Flag |
|---|---|---|---|
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

**Backend API & Integration tests:**

```bash
# Lab 3 specific API test suite (7 files, 108 tests)
npm --prefix server run test:lab-03

# Full server test suite including Lab 1 & 2 regressions (13 files, 148 tests)
npm --prefix server test
```

**Frontend component & page tests:**

```bash
# Client Vitest suite (11 files, 50 tests)
npm --prefix client test
```

**E2E tests (Playwright across Desktop Chrome, Tablet iPad, Mobile Safari):**

```bash
# Run Lab 3 E2E test suite (24 tests)
npx playwright test e2e/lab-03
```

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

### Administrator User Management
| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/admin/users` | List users with search and role filter | Admin only |
| `POST` | `/api/admin/users` | Create user with initial password | Admin only |
| `PUT`, `PATCH` | `/api/admin/users/:id` | Update user info/role/active state with safety guards | Admin only |
| `POST` | `/api/admin/users/:id/reset-password` | Set new initial password (`mustChangePassword: true`) | Admin only |

Full specifications: [`docs/lab-03/specification.md`](docs/lab-03/specification.md), [`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md), and [`docs/lab-03/ui-spec.md`](docs/lab-03/ui-spec.md)

---

## Project Structure

```
cpe334-TokTikIT/
├── client/          # React + Vite frontend (Zen Green design system)
│   ├── src/         # App.tsx, api.ts, pages/, components/, contexts/
│   └── tests/       # Vitest client tests (lab-01, lab-02, lab-03)
├── server/          # Express + Prisma backend
│   ├── prisma/      # schema.prisma, migrations/, seed.ts
│   ├── src/         # app.ts, index.ts, middlewares/ (auth, upload), types/
│   ├── tests/       # Vitest server tests (lab-01, lab-02, lab-03)
│   └── uploads/     # Attachment file storage (gitignored)
├── docs/
│   ├── lab-01/
│   ├── lab-02/
│   └── lab-03/      # specification, api-spec, ui-spec, tests, ai-use, reviewer
├── artifacts/
│   └── lab-03/      # screenshots (authentication, staff-queue, staff-ticket-detail, user-management)
└── e2e/             # Playwright E2E suites (lab-02, lab-03)
```

---

## Git Workflow

- `main` — production release branch
- `lab3-staging` — Lab 3 integration branch
- `feat/<issue-number>-<topic>` — per-issue feature branches

> ⚠️ Never commit `.env` files. Only `.env.example` belongs in version control.
