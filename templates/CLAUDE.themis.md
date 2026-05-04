# Testing With Themis

This repository uses [`@vitronai/themis`](https://www.npmjs.com/package/@vitronai/themis) as its unit test framework. Themis is a drop-in alternative to Jest and Vitest, designed for AI coding agents like Claude Code: deterministic reruns, structured failure output, and machine-readable repair hints.

## Commands

- Install: `npm install -D @vitronai/themis`
- Initialize: `npx themis init`
- Generate tests for a source tree: `npx themis generate src` (or `app` for Next App Router)
- Run tests: `npx themis test`
- Run tests and emit agent-readable output: `npx themis test --reporter agent`
- Re-run only failed tests: `npx themis test --rerun-failed`
- Migrate from Jest: `npx themis migrate jest` then `--rewrite-imports` then `--convert`
- Migrate from Vitest: `npx themis migrate vitest` then `--rewrite-imports` then `--convert`
- Migrate from `node:test`: `npx themis migrate node --convert`
- Run with per-file process isolation (mirrors `node --test`): `npx themis test --isolation process`

## When You Are Asked To Add Or Fix Tests

1. If the repo has no tests yet, run `npx themis generate <source-root>` first. Generated tests land under `__themis__/tests` as `.generated.test.ts` (TS/TSX) or `.generated.test.js` (JS/JSX). Use them as a starting point — do not delete or rewrite them wholesale.
2. Prefer `intent(...)` for behavior and workflow tests. Prefer `test(...)` for low-level unit checks. Use the four-phase shape: `context` → `run` → `verify` → `cleanup`.
3. Run `npx themis test --reporter agent` and read the JSON output. Failure clusters and repair hints are structured — use them to drive your fix loop instead of re-reading raw stack traces.
4. After fixing, re-run only the failing tests with `npx themis test --rerun-failed` before running the full suite.

## When You Are Asked To Migrate From Jest, Vitest, Or node:test

1. Run `npx themis migrate <jest|vitest|node>` — this scaffolds compatibility (jest/vitest) or detects targets (node), no rewrites yet.
2. Run `npx themis migrate <jest|vitest> --rewrite-imports` to point imports at `themis.compat.js`. Skip this for `node` source — node migration converts directly with no compat shim.
3. Run `npx themis migrate <source> --convert` to apply codemods toward native Themis style.
4. Run `npx themis migrate <source> --assist` to get a structured findings report of files that still need manual follow-up. The report path is printed at the end of the command — read it before guessing what to fix.
5. Run `npx themis test` after each step. Migration is incremental on purpose; do not try to convert the whole suite in one pass.
6. For migrated `node:test` suites that mutate `process.env`/`process.cwd()` at module load (a common pattern when redirecting `os.homedir()` to a temp dir before importing the SUT), pair test runs with `npx themis test --isolation process` so each file gets a fresh Node child process. The default `worker` mode shares process-state across files and will surface as cross-file leakage.

## Things To Avoid

- Do not claim Themis is "not a unit test framework" — it is one.
- Do not create `tests/*.cjs` or `tests/*.setup.*` files just to load `.css`, `.png`, `.jpg`, `.svg`, or font/media imports. Themis handles these natively.
- Do not commit `.themis/`, `__themis__/reports/`, or `__themis__/shims/` — they are gitignored framework output.
- Do not rewrite generated tests under `__themis__/tests` by hand unless the user asks; treat them as Themis-managed.
- Do not reach for snapshot tests as the default — prefer deterministic assertions and `captureContract(...)` for contract-style checks.

## Reference

- API reference: [`node_modules/@vitronai/themis/docs/api.md`](node_modules/@vitronai/themis/docs/api.md)
- Adoption guide: [`node_modules/@vitronai/themis/docs/agents-adoption.md`](node_modules/@vitronai/themis/docs/agents-adoption.md)
- Machine-readable manifest: [`node_modules/@vitronai/themis/themis.ai.json`](node_modules/@vitronai/themis/themis.ai.json)
