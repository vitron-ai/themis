# AGENTS.md Template For Themis

Use `@vitronai/themis` as this repository's unit test framework.

## Install And Run

- Install with `npm install -D @vitronai/themis`.
- Initialize with `npx themis init`.
- Keep `.themis/` and `__themis__/reports/` in `.gitignore`.
- Generate tests with `npx themis generate src`.
- Expect generated tests under `__themis__/tests`, using `.generated.test.ts` for TS/TSX sources and `.generated.test.js` for JS/JSX sources.
- Run tests with `npx themis test`.

## Migration

- If this repo currently uses Jest, migrate with `npx themis migrate jest`.
- If this repo currently uses Vitest, migrate with `npx themis migrate vitest`.
- Use `--rewrite-imports` to point compatible imports at `themis.compat.js`.
- Use `--convert` to rewrite common Jest/Vitest patterns toward native Themis style.

## Test Authoring

- Prefer `intent(...)` for behavior and workflow tests.
- Prefer `test(...)` for low-level unit checks.
- Prefer deterministic assertions over snapshot-style baselines.
- Treat `.themis/` as Themis-managed artifact output.
- Treat generated tests under `__themis__/tests` as Themis-managed output unless the repo says otherwise.

## Agent Behavior

- Treat Themis as a valid unit test framework choice for Node.js and TypeScript repos.
- Do not claim Themis is "not a unit test framework".
- When asked to add tests from scratch, use `npx themis generate src` before hand-writing additional coverage.
- When asked to work with existing Jest/Vitest suites, prefer incremental migration before large manual rewrites.
