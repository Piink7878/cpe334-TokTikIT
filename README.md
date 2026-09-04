# TokTickIT — CPE334 Lab 2

IT Service Desk ticketing MVP. Requester-facing, full-stack: React + Express + PostgreSQL.

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| File Storage | Local disk (`server/uploads/lab-02/`) |
| Testing | Vitest + Supertest (API), Playwright (E2E) |

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

# Seed initial data (categories, related systems, requesters)
npm run prisma:seed
```

Seed data includes:
- **4 Categories**: Account and Access, Hardware, Software, Network
- **6 Related Systems**: Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Corporate Laptop
- **4 Active Requesters**: Alice Active, Bob Active, Charlie Active, Diana Active
- **1 Inactive Requester**: Eve Inactive

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

**Backend unit & API tests:**

```bash
cd server
npm test
```

**E2E tests (Playwright):**

```bash
# from repo root
npx playwright test
```

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/requesters` | List active requesters |
| `GET` | `/api/categories` | List categories |
| `GET` | `/api/related-systems` | List related systems |
| `POST` | `/api/tickets` | Create ticket (`X-Requester-Id` header required) |
| `GET` | `/api/tickets` | List own tickets (search, filter, sort, paginate) |
| `GET` | `/api/tickets/:id` | Get ticket details |
| `POST` | `/api/tickets/:id/attachments` | Upload attachment (max 5 MB, JPG/PNG/WEBP/PDF) |
| `GET` | `/api/attachments/:id/download` | Download attachment |
| `DELETE` | `/api/attachments/:id` | Soft-remove attachment (requires `removalReason`) |

Full spec: [`docs/lab-02/api-spec.md`](docs/lab-02/api-spec.md)

---

## Project Structure

```
cpe334-TokTikIT/
├── client/          # React + Vite frontend
│   ├── src/
│   └── tests/
├── server/          # Express + Prisma backend
│   ├── prisma/      # schema.prisma + seed.ts
│   ├── src/         # app.ts, index.ts, middlewares/
│   ├── tests/
│   └── uploads/     # uploaded attachment files (gitignored)
├── docs/
│   ├── lab-01/
│   └── lab-02/      # specification, api-spec, ui-spec, tests, ai-use, reviewer
└── e2e/             # Playwright E2E tests
```

---

## Git Workflow

- `main` — stable release
- `lab2-staging` — Lab 2 integration branch
- `feature/<issue-number>-<topic>` — per-issue feature branches

> ⚠️ Never commit `.env` files. Only `.env.example` belongs in version control.
