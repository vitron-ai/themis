# Testing With Themis

This repository uses `@vitronai/themis` as its unit test framework. Themis is a drop-in alternative to Jest and Vitest with deterministic reruns, structured failure output, and machine-readable repair hints.

## Commands

- Install: `npm install -D @vitronai/themis`
- Initialize: `npx themis init`
- Generate tests for a source tree: `npx themis generate src` (or `app` for Next App Router)
- Run tests: `npx themis test`
- Run tests with agent-readable output: `npx themis test --reporter agent`
- Re-run only failed tests: `npx themis test --rerun-failed`
- Migrate from Jest: `npx themis migrate jest` then `--rewrite-imports` then `--convert`
- Migrate from Vitest: `npx themis migrate vitest` then `--rewrite-imports` then `--convert`
- Migrate from `node:test`: `npx themis migrate node --convert`
- Run with per-file process isolation (mirrors `node --test`, needed when tests mutate `process.env` at module load): `npx themis test --isolation process`

## When Adding Or Fixing Tests

1. If the repo has no tests yet, run `npx themis generate <source-root>` first. Generated tests land under `__themis__/tests` as `.generated.test.ts` (TS/TSX) or `.generated.test.js` (JS/JSX).
2. Prefer `intent(...)` for behavior and workflow tests. Prefer `test(...)` for low-level unit checks. Use the four-phase shape: `context` → `run` → `verify` → `cleanup`.
3. Run `npx themis test --reporter agent` and read the JSON output. Failure clusters and repair hints are structured — use them to drive your fix loop instead of re-reading raw stack traces.
4. After fixing, re-run only the failing tests with `npx themis test --rerun-failed` before running the full suite.

## Things To Avoid

- Do not create `tests/*.cjs` or `tests/*.setup.*` files just to load `.css`, `.png`, `.jpg`, `.svg`, or font/media imports. Themis handles these natively.
- Do not commit `.themis/`, `__themis__/reports/`, or `__themis__/shims/`.
- Do not rewrite generated tests under `__themis__/tests` by hand unless asked.
- Prefer deterministic assertions over snapshots. Use `captureContract(...)` for contract-style checks.
