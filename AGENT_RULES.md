🔒 Canonical Reference

This agent must always load and apply the contents of DEVELOPER.md before generating, modifying, or refactoring any code.
That file is the single source of truth for architecture, style, and workflow.

🧱 1. Hierarchy of Authority

DEVELOPER.md — governs design, structure, and practices.

User Instructions — define task scope and functional intent.

Language/Framework Docs — secondary for syntax and implementation specifics.

If conflicts arise, DEVELOPER.md takes precedence, unless the user explicitly overrides it in writing.

🧩 2. Pre-Execution Protocol

Before producing code, the agent must:

Read the user request.

Generate a short Planning Checklist (3–7 steps) referencing applicable sections from DEVELOPER.md.

Validate that the plan adheres to:

SOLID, DRY, and KISS principles (Section D)

Layered architecture (Section L)

Logging and explicit error handling (Section O)

Testability and linting standards (Section P)

⚙️ 3. Code Generation Rules

No inline HTML or CSS in TypeScript files.

Each visual element resides in its .html and .scss files.

Separate concerns: components → UI, services → logic, repositories → data.

All new code must include:

Purpose comment

Input/output types

Error-handling approach

Quick “Standards Check” summary (e.g., SRP OK | DRY OK | Tests Pending).

Follow Conventional Commits for naming and version control.

🧠 4. Validation Phase

After producing output, the agent must self-audit:

Confirm compliance with each relevant section of DEVELOPER.md.

Identify missing tests or documentation.

If violations are found, automatically rewrite or suggest corrections.

🧰 5. CI/CD Alignment

All generated code must build, lint, and test cleanly before commit.

Include placeholders for tests when new modules are introduced.

Respect the folder structure defined in DEVELOPER.md (components, services, models, utils, tests).

🔁 6. Continuous Context

This policy and DEVELOPER.md form the persistent institutional context for the agent.
Every future task inherits these rules automatically; no response should ignore or bypass them.

🧠 7. Async UI Implementation Pattern (Directive)

Always implement async UI with: loading flag + RxJS finalize() + snackbar feedback.

- Loading flag (boolean state) indicates async operation in progress
- Use RxJS finalize() to reset loading state (prevents stuck spinners)
- Disable action buttons during loading=true (prevents double-submits)
- MatSnackBar for all user feedback (custom centralized messages/themes)
- Deterministic upload progress when available; otherwise indeterminate
- Aria-busy, aria-live on containers with role="status" on spinners
- OnPush ChangeDetectionStrategy with markForCheck() updates
- Centralized error mapping (400, 413, 500, etc.) with friendly messages
- Structured dev logging with operation context, elapsedMs, and error details

Never use alert(). All async transitions produce user feedback.
