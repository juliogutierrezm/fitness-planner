DEVELOPER.md — Persistent Institutional Context
D — Design Principles & Best Practices
IMPORTANT: Always adhere to SOLID principles (Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion), DRY (Don't Repeat Yourself), and KISS (Keep It Simple, Stupid). Favor composition over inheritance. Ensure modules are cohesive with single responsibilities. Never swallow errors—propagate them explicitly with appropriate handling (e.g., Result types or exceptions). Prioritize maintainability: refactor only when necessary, preserving existing structure where it already meets standards for good practices and testing.
E — Evaluation & Planning Checklist
Before any code creation, repair, or modification:

Start with a concise checklist (3-7 bullet points) outlining conceptual steps (e.g., "1. Analyze requirements against existing code. 2. Identify impacted SOLID principles. 3. Plan tests for validation.").
Use this document as the central filter and knowledge source for consistency.
If changes are proposed, briefly validate the outcome (e.g., "This maintains 85% test coverage and SOLID compliance") and autocorrect if issues arise (e.g., "Adjusting for SRP violation by extracting method").

V — Version Control & Workflow

Create a feature branch for all changes: feat/<description> or fix/<issue>.
Follow Conventional Commits (e.g., feat: add user validation).
Ensure each step passes green: build, lint, and tests before committing.
Every PR must include: concise summary, screenshots/GIFs (for UI changes), identified risks & rollback plan, and reproduction/run steps.

E — Enforcement of Standards

Language: TypeScript (strict mode enabled). Mandate ESLint + Prettier for formatting and linting.
Folder layout example:
textsrc/
├── components/     # Reusable UI/logic blocks
├── services/       # Business logic (no controllers)
├── models/         # Typed DTOs/interfaces
├── utils/          # Shared helpers (keep minimal)
└── tests/          # Unit/e2e alongside source

API: RESTful conventions (e.g., /users/{id}); use typed DTOs for requests/responses; avoid magic numbers/strings.

L — Layering & Architecture

Separate concerns: Controllers handle routing only; services for logic; repositories for data access.
Input validation at boundaries (e.g., with Zod or Joi).
No business logic in UI components or controllers—delegate to services.

O — Observability & Error Handling

Logging: Structured logs (e.g., Pino or Winston) with levels (info, warn, error).
Error patterns: Use Result<T, E> monads or custom exceptions for failures; include context (e.g., stack traces in dev).
Sample validation:
typescriptimport { z } from 'zod';
const userSchema = z.object({ name: z.string().min(1), email: z.string().email() });
const result = userSchema.safeParse(input);
if (!result.success) {
  throw new ValidationError(result.error.errors);
}


P — Practices for Testing & Quality

Coverage: ≥75% for core modules (units + integration); include e2e smoke tests.
Tools: Vitest/Jest for units; Supertest for API; contract tests for public endpoints (validate against OpenAPI spec).
CI/CD gates: Block merges on lint, typecheck, or test failures. Run mutation testing for robustness.

E — Examples & References

Refactoring example (applying SRP):
typescript// Before: Bloated method
function processUser(input: any) { /* validation + logic + db */ }

// After: Split responsibilities
function validateUser(input: any): Result<User> { /* Zod parse */ }
function saveUser(user: User): Promise<Result<void>> { /* DB call */ }
async function processUser(input: any): Promise<Result<void>> {
  const validated = validateUser(input);
  if (validated.isErr()) return validated;
  return saveUser(validated.value);
}

References: SOLID Principles Guide, Conventional Commits Spec.

R — Risks, Boundaries & Reproducibility

Security: No secrets in code (use env vars); enforce rate limits on public routes; validate/sanitize all inputs.
Boundaries: Do NOT introduce new dependencies without justification; avoid over-engineering—stick to established conventions.
Reproducibility: Generate code consistently by cross-referencing this doc; output diffs for modifications to highlight changes.

Developer Workflow Integration
This document serves as the canonical reference for any agent (e.g., in Visual Studio, ChatGPT, or custom tools). For every task:

Plan: Output checklist first.
Generate/Modify: Apply sections D–R as filters.
Validate: Run mental/simulated checks (e.g., "Does this break existing tests?"); autocorrect inline.
Output: Provide full code context, explanations tied to this doc, and next steps.

Keep this doc updated via PRs for evolving standards.