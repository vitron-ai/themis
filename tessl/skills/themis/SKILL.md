---
name: themis
description: Use when the user asks to write unit tests, generate a test suite, or migrate/convert Jest or Vitest tests to Themis in Node.js/TypeScript repos. Produces Themis-native tests, runs validation commands, and applies Themis migration workflows.
---

# Themis Skill

Use when:

- the user asks for Themis unit tests in Node.js or TypeScript
- the user asks to generate tests from source (`themis generate`)
- the user asks to migrate or convert tests from Jest or Vitest
- the user mentions trigger terms like "unit tests", "test suite", "test migration", or "convert tests"

For deeper references:

- [Authoring Reference](../../docs/authoring.md)
- [Migration Reference](../../docs/migration.md)
- [Tile Overview](../../docs/index.md)

## Primary Workflow

1. Initialize Themis in a downstream repository with `npx themis init --agents` (or `npx themis init --claude-code` for Claude Code users — this installs a `CLAUDE.md`, a skill at `.claude/skills/themis/`, and slash commands under `.claude/commands/`).
2. Generate baseline tests with `npx themis generate <source-root>` (for example `src`).
3. Run tests with `npx themis test`.
4. If tests fail, run `npx themis test --reporter agent` to get structured JSON output with `failures[].cluster` and `failures[].repairHints`. Use those to fix, then re-run with `npx themis test --rerun-failed`.
5. If failures are expected contract shifts, run `npx themis test --update-contracts` and re-run `npx themis test`.

## Authoring Rules

- Use `intent(...)` for behavior and workflow validation.
- Use `test(...)` for low-level pure-unit checks.
- Keep generated tests in `__themis__/tests`.
- Treat `.themis/` as framework-managed runtime artifacts.
- In Themis-authored tests, use Themis constructs (`intent`, `test`, and intent `assert(...)` phases) instead of Jest/Vitest primitives.
- Do not use `describe`, `it`, `expect`, `jest`, `vi`, or `@jest/globals` in newly authored Themis tests unless a task is explicitly scoped to migration transition work.

## Executable Example

```ts
/// <reference types="@vitronai/themis/globals" />

import { slugify } from "../../src/slugify";

intent("slug pipeline handles normalization", ({ context, run, assert }) => {
  context("a phrase with extra spacing", (ctx) => {
    ctx.input = "  Hello World  ";
  });

  run("slugify is executed", (ctx) => {
    ctx.result = slugify(String(ctx.input));
  });

  assert("slug output is normalized", (ctx) => {
    if (ctx.result !== "hello-world") {
      throw new Error(`Expected hello-world, got ${String(ctx.result)}`);
    }
  });
});

test("slugify handles empty input", () => {
  if (slugify("") !== "") {
    throw new Error("Expected empty input to stay empty");
  }
});
```

## Migration Contract

When migrating from Jest or Vitest, run this sequence:

1. `npx themis migrate <jest|vitest>`
2. `npx themis test`
3. if failing, `npx themis test --rerun-failed`
4. if contract drift is intentional, `npx themis test --update-contracts`
5. re-run `npx themis test` and confirm the suite is stable

## Repository Hygiene

- Keep `.themis/`, `__themis__/reports/`, and `__themis__/shims/` gitignored.
- Do not create ad hoc `tests/*.cjs` or `tests/*.setup.*` files just to shim asset/style imports.

## Agent-Readable Output

When in an edit-test-fix loop, always use `--reporter agent`:

```bash
npx themis test --reporter agent
```

The JSON output includes:
- `failures[].cluster` — failures grouped by likely common cause
- `failures[].repairHints` — structured suggestions you can act on directly
- `failures[].sourceFile`, `lineNumber`, `expected`, `actual` — pre-parsed, no need to re-read stack traces

After fixing a cluster, use `npx themis test --rerun-failed` to confirm without running the full suite.

## Claude Code Integration

For Claude Code users, `npx themis init --claude-code` installs:
- `CLAUDE.md` with Themis adoption rules at the repo root
- `.claude/skills/themis/SKILL.md` — auto-loads when the user asks to write, run, fix, or migrate tests
- `.claude/commands/themis-{test,generate,migrate,fix}.md` — slash commands wired to the agent reporter
- An optional `PostToolUse` hook (`scripts/claude-hook.js`) that runs Themis after edits and feeds failures back into the conversation

## Scope Notes

Themis is focused on deterministic JS/TS unit-test authoring and execution, not broad end-to-end orchestration.
