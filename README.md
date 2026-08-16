# TokTickIT (ตอกติกกิต)

TokTickIT is an IT service desk application full-stack starter built for CPE334 (Introduction to Software Engineering in the Age of AI Agents).

This repository provides a Lab 1 foundation with a React frontend, Express backend, PostgreSQL database integration via Prisma ORM, and automated tests for API and UI behavior.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database and ORM: PostgreSQL + Prisma ORM
- Testing: Vitest and Supertest

## Prerequisites

Before running the project locally, make sure you have:

- Node.js (v18 or higher recommended)
- PostgreSQL database instance
- Git
- GitHub CLI (gh)

## Project Architecture

TokTickIT is organized as a two-app monorepo:

- client: React + Vite frontend
- server: Express + Prisma backend API
- docs: Lab-related documentation and evidence

Repository structure:

```text
cpe334-TokTikIT/
├─ README.md
├─ client/
│  ├─ .env.example
│  ├─ index.html
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ vite.config.ts
│  ├─ src/
│  │  ├─ api.ts
│  │  ├─ App.tsx
│  │  ├─ main.tsx
│  │  └─ vite-env.d.ts
│  └─ tests/
│     ├─ setup.ts
│     └─ lab-01/
│        └─ App.test.tsx
├─ docs/
│  └─ lab-01/
│     ├─ ai_use.md
│     ├─ reviewer.md
│     └─ tests.md
└─ server/
	├─ .env.example
	├─ package.json
	├─ tsconfig.json
	├─ vitest.config.ts
	├─ prisma/
	│  ├─ schema.prisma
	│  └─ seed.ts
	├─ src/
	│  ├─ app.ts
	│  ├─ index.ts
	│  └─ prisma.ts
	└─ tests/
		└─ lab-01/
			├─ categories.test.ts
			└─ health.test.ts
```

## Environment Setup and Configuration

Create local environment files for both apps from their examples.

### Server

From the server directory:

```bash
cp .env.example .env
```

PowerShell alternative:

```powershell
Copy-Item .env.example .env
```

Required values in server/.env:

- DATABASE_URL: PostgreSQL connection string used by Prisma
- PORT: backend API port (default in example: 3000)

### Client

From the client directory:

```bash
cp .env.example .env
```

PowerShell alternative:

```powershell
Copy-Item .env.example .env
```

Required value in client/.env:

- VITE_API_URL: base URL of the backend API (example: http://localhost:3000)

### Security Notice

Never commit .env files, credentials, or any secrets to Git.

- Keep only .env.example in version control
- Ensure .env is ignored by .gitignore
- Rotate any credential immediately if leaked

## Local Setup and Execution Guide

### Step 1: Install Dependencies

Install dependencies for both applications:

```bash
cd server
npm install

cd ../client
npm install
```

Optional (from repository root):

```bash
npm --prefix server install
npm --prefix client install
```

### Step 2: Database Migration and Seed

From the server directory:

1. Run Prisma migration:

```bash
npx prisma migrate dev
```

2. Seed initial categories:

```bash
npx prisma db seed
```

Lab 1 seed data must include these four categories:

- Account and Access
- Hardware
- Software
- Network

### Step 3: Run the Application

Start backend API server (from server directory):

```bash
npm run dev
```

Start frontend dev server (from client directory):

```bash
npm run dev
```

Default local URLs:

- Backend API: http://localhost:3000
- Frontend App: http://localhost:5173

## API Endpoints (Lab 1 Scope)

### GET /api/health

- Expected status: 200
- Expected JSON response:

```json
{ "status": "ok", "service": "TokTickIT API" }
```

### GET /api/categories

- Expected status: 200
- Data source: PostgreSQL via Prisma ORM
- Expected behavior: returns list of the four seeded categories
- Typical response shape:

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

## Running Automated Tests

Run backend tests (Supertest + Vitest):

```bash
cd server
npm test
```

Run frontend tests (Vitest):

```bash
cd client
npm test
```

Alternative explicit Vitest commands:

```bash
cd server
npx vitest run

cd ../client
npx vitest run
```

## Git Workflow and Branching Policy

Use the following branch model for Lab 1:

- main: protected stable release branch
- lab1-staging: integration branch for Lab 1
- feature/\*: short-lived feature branches per issue

Examples of feature branches:

- feature/1-project-foundation
- feature/2-health-check
- feature/3-category-seed
- feature/4-category-list

Recommended flow:

1. Branch from lab1-staging using feature/<issue-number>-<topic>
2. Commit small, focused changes with clear messages
3. Push branch and open a pull request into lab1-staging
4. After review and checks pass, merge to lab1-staging
5. Promote to main only when lab deliverable is stable

## Notes for Lab Submission

- Keep implementation and tests aligned with docs in docs/lab-01/
- Include evidence of passing tests in docs/lab-01/tests.md
- Record AI usage and review outcomes in the provided documentation files
