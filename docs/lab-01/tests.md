# Lab 1 Test Specifications

| Test ID | Test File | Tool | Test Description | Result |
|---------|-----------|------|------------------|--------|
| API-01 | `server/tests/lab-01/health.test.ts` | Supertest | Health endpoint returns 200 and expected JSON | Pass |
| API-02 | `server/tests/lab-01/categories.test.ts` | Supertest | Categories endpoint returns the four seeded categories | Pass |
| UI-01 | `client/tests/lab-01/App.test.tsx` | Vitest | TokTickIT heading renders | Pass |
| UI-02 | `client/tests/lab-01/App.test.tsx` | Vitest | Loading state changes to category list | Pass |
| UI-03 | `client/tests/lab-01/App.test.tsx` | Vitest | API failure displays a useful error message | Pass |
