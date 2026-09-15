# Agent Instructions

- **Mandatory Pre-Task Action:** Always inspect and strictly adhere to `docs/lab-03-handout.md` as the single source of truth before planning, generating specs, or writing any code and tests.
- **Strict Scope Constraints:** Never implement explicitly excluded features (e.g., no email delivery, no MFA/SSO, no multiple roles per user, no user deletion).
- **Core Rules:** Enforce all business rules (BR-01 to BR-05, admin self-deactivation protection, last admin safeguard) strictly on the server side—never rely on UI hiding.
- **Spec & Test First:** Ensure specs (`docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`) and test plans (`tests.md`) are aligned with the handout before delivering code.