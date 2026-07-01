<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Testing policy

Unit tests are mandatory for all code changes. This project uses Vitest + React Testing Library (`vitest.config.mts`, `vitest.setup.ts`).

- Any new file under `src/` (component, hook, page, lib function) must ship with a co-located `*.test.ts(x)` file covering its logic, including branches (conditionals, empty/error states) — not just the happy path.
- Any change to existing code must update or extend its existing tests to cover the new behavior.
- Before considering a change done, run `npm test` (or `npm run test:coverage`) and ensure all tests pass.
- Coverage must stay at or above 90% for statements, branches, functions, and lines (enforced by thresholds in `vitest.config.mts`); prefer closing gaps all the way to 100% where the code path is realistically testable (skip only genuine SSR guards / unreachable defensive checks).
- Mock Next.js APIs (`next/navigation`, `next/font/google`, `next/image`) the same way `vitest.setup.ts` already does — reuse `mockRouter` from that file rather than re-mocking ad hoc.
