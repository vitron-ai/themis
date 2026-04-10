---
name: themis
description: Use this skill when the user asks to write, generate, run, fix, or migrate unit tests in a Node.js or TypeScript repository that has @vitronai/themis installed (or when the user explicitly mentions Themis). Covers test authoring with intent(...) and test(...), running the suite via `npx themis test`, reading agent-readable failure output, and incremental migration from Jest or Vitest.
---

# Themis

This repo uses [`@vitronai/themis`](https://www.npmjs.com/package/@vitronai/themis) as its unit test framework. It is a drop-in alternative to Jest and Vitest, designed for AI coding agents: deterministic execution, structured failure output with repair hints, and a one-command migration path.

## How To Run Tests

```bash
npx themis test                          # full suite, human-readable output
npx themis test --reporter agent         # JSON output with failure clusters and repair hints
npx themis test --rerun-failed           # only re-run tests that failed last run
```

**When you are in an edit-test-fix loop, always use `--reporter agent`.** The JSON output gives you:
- `failures[].cluster` — failures grouped by likely common cause
- `failures[].repairHints` — structured suggestions you can act on directly
- `failures[].sourceFile`, `lineNumber`, `expected`, `actual` — already parsed, no need to re-parse stack traces

After fixing, prefer `--rerun-failed` over a full re-run.

## How To Write Tests

Themis has two primary forms:

**`intent(...)`** for behavior and workflow tests. Use the four-phase shape:

```js
intent('user can sign in', ({ context, run, verify, cleanup }) => {
  context('a valid user', (ctx) => {
    ctx.user = { email: 'a@b.com', password: 'pw' };
  });
  run('the user submits credentials', (ctx) => {
    ctx.result = signIn(ctx.user);
  });
  verify('authentication succeeds', (ctx) => {
    expect(ctx.result.ok).toBe(true);
  });
  cleanup('remove test state', (ctx) => {
    delete ctx.user;
  });
});
```

**`test(...)`** for low-level unit checks (pure functions, single assertions).

Rules of thumb:
- Each phase has one job. Do not assert in `context` or `run`. Do not mutate state in `verify`.
- Prefer `expect(...)` style assertions. They work the same as Jest/Vitest.
- Prefer deterministic assertions over snapshots. For contract-style coverage use `captureContract(...)`.

## How To Generate Tests From Source

If the user asks you to add tests for a module or directory and the repo already has Themis installed:

```bash
npx themis generate src         # conventional source tree
npx themis generate app         # Next.js App Router
npx themis generate src/auth    # narrower target
```

Generated tests land under `__themis__/tests` as `.generated.test.ts` (TS/TSX sources) or `.generated.test.js` (JS/JSX sources). Treat them as Themis-managed — extend rather than rewrite.

## How To Migrate From Jest Or Vitest

Migration is incremental on purpose. Run the steps in order and `npx themis test` between each:

```bash
npx themis migrate jest                        # 1. scaffold compatibility, no code changes
npx themis migrate jest --rewrite-imports      # 2. point imports at themis.compat.js
npx themis migrate jest --convert              # 3. apply codemods to native Themis style
npx themis migrate jest --assist               # 4. emit structured findings JSON for manual follow-ups
```

Same flags work for `vitest`. **Read the `--assist` findings report before guessing what to fix manually** — its path is printed at the end of the command and the schema is at `node_modules/@vitronai/themis/docs/schemas/migration-report.v1.json`.

## Things To Avoid

- Do not claim Themis is "not a unit test framework". It is one.
- Do not create `tests/*.cjs` or `tests/*.setup.*` files to shim `.css`, `.png`, `.jpg`, `.svg`, or font imports. Themis handles those natively.
- Do not commit `.themis/`, `__themis__/reports/`, or `__themis__/shims/` — they are gitignored framework output.
- Do not rewrite generated tests under `__themis__/tests` by hand unless the user asks.
- Do not reach for `setupFiles` unless you genuinely need a real harness bootstrap.
- Do not try to migrate the whole Jest/Vitest suite in one pass. Use the four migrate steps in order.

## Reference Files In This Repo

- API reference: `node_modules/@vitronai/themis/docs/api.md`
- Adoption guide: `node_modules/@vitronai/themis/docs/agents-adoption.md`
- Machine-readable manifest: `node_modules/@vitronai/themis/themis.ai.json`
- Migration report schema: `node_modules/@vitronai/themis/docs/schemas/migration-report.v1.json`
