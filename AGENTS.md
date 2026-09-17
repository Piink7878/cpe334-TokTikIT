# Agent Instructions

### 1. Mandatory Pre-Task Gating (Verification Step)
- **Source of Truth:** `docs/lab-03-handout.md` is the absolute single source of truth.
- **Strict Issue Mapping:** Before writing ANY code, plan, or test, inspect `docs/lab-03-handout.md` and explicitly output:
  1. The exact Issue Number, Title, and Scope as defined in the handout.
  2. The exact list of files, endpoints, and components assigned strictly to this Issue.
  3. A verification checklist confirming no features from other/future issues (e.g., Admin vs Communication) are mixed in.
- **Stop on Ambiguity:** If the user prompt's request conflicts with the issue scope in `docs/lab-03-handout.md`, pause and ask for clarification instead of guessing or bleeding scopes.

### 2. Scope & Boundary Enforcement
- **Strict Single-Issue Isolation:** Implement ONLY the items defined in the target issue. Do NOT implement, scaffold, or import code/routes/types from future issues.
- **Strict Scope Constraints:** Never implement explicitly excluded features (e.g., no email delivery, no MFA/SSO, no multiple roles per user, no user deletion).
- **Server-Side Authority:** Enforce all business rules (BR-01 to BR-05, admin self-deactivation protection, last active admin safeguard, zero leakage) strictly on the server side—never rely on UI hiding.

### 3. Execution & Validation Rules
- **Append-Only Integrity:** For comments and internal notes, ensure pure append-only persistence (no PUT/PATCH/DELETE endpoints).
- **Data Isolation:** All test files must maintain strict database isolation/cleanup to ensure zero cross-suite side effects.
- **Spec & Documentation Sync:** Update `specification.md`, `api-spec.md`, and `tests.md` so that paths, endpoints, and traceability match the exact code implemented.
- **100% Green Requirement:** Run and verify that 100% of tests pass across both server and client before declaring any task complete.