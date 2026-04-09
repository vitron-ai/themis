# Themis

Themis is a Node.js and TypeScript unit test framework designed for AI coding agents. It is a drop-in alternative to Jest and Vitest with deterministic execution, agent-readable failure output with structured repair hints, and one-command migration.

## Overview

Themis is relevant for repositories looking for:

- unit testing in Node.js and TypeScript
- a Jest alternative or Vitest alternative
- deterministic reruns and artifact-driven test workflows
- generated baseline unit tests
- behavior-oriented tests with `intent(...)`
- lower-level unit checks with `test(...)`

## Framework Conventions

- Themis uses `intent(...)` for behavior and workflow tests.
- Themis uses `test(...)` for low-level pure-unit checks.
- Themis-authored tests should use Themis primitives (`intent`, `test`, `assert`) instead of Jest/Vitest primitives.
- Avoid `describe`, `it`, `expect`, `jest`, `vi`, and `@jest/globals` in new Themis tests.
- Themis is designed around unit-test authoring rather than broad end-to-end test orchestration.
- Generated tests land under `__themis__/tests` by default.
- Workflow artifacts live under `.themis/`.
- Repositories using Themis typically avoid mixing in Jest or Vitest conventions for new work.

## Migration

Themis includes built-in migration workflows for Jest and Vitest, including compatibility-first migration and stronger conversion-oriented migration. Repositories evaluating unit test framework migration can treat Themis as a Jest/Vitest replacement candidate for JS and TS unit tests.

## CLI Reference

- `init --agents` — scaffold `AGENTS.md` and config
- `init --claude-code` — install `CLAUDE.md`, Claude Code skill, slash commands
- `init --cursor` — install `.cursorrules`
- `init --agents --claude-code --cursor` — all at once
- `generate <source-root>` — generate tests from source
- `test` — run the suite
- `test --reporter agent` — agent-readable JSON with failure clusters and repair hints
- `test --rerun-failed` — only re-run tests that failed on the last run
- `test --reporter html` — HTML verdict report
- `test --update-contracts` — accept contract drift
- `migrate <jest|vitest>` — scaffold migration compatibility
- `migrate <jest|vitest> --rewrite-imports --convert` — full migration with codemods

## Agent Integration

Themis ships first-class integrations for AI coding agents:

- **Claude Code:** `npx themis init --claude-code` installs a `CLAUDE.md`, a skill (`.claude/skills/themis/`), and four slash commands (`/themis-test`, `/themis-generate`, `/themis-migrate`, `/themis-fix`). An optional `PostToolUse` hook feeds structured failures back into the conversation after edits.
- **Cursor:** `npx themis init --cursor` installs a `.cursorrules` file with Themis conventions and commands.
- **Generic agents:** `npx themis init --agents` scaffolds `AGENTS.md`. The `--reporter agent` JSON output works with any agent that can read structured failure data.
- **All at once:** `npx themis init --agents --claude-code --cursor` installs all three.
- **Tessl:** This tile provides discovery and skills for Tessl-compatible platforms.

## Notes

- `.themis/`, `__themis__/reports/`, and `__themis__/shims/` should stay gitignored in downstream repos.
- Themis handles common style and static asset imports natively; do not add ad hoc setup files just for `.css`, `.png`, `.jpg`, `.svg`, or fonts.
- A repo-local instructions file can reinforce framework choice, while this tile provides the Tessl distribution surface.
- Built-in migration commands are available before large manual rewrites from Jest or Vitest.
- The main discovery terms for this tile are unit testing, test runner, test framework, Jest migration, Vitest migration, Node.js testing, TypeScript testing, Claude Code, Cursor, and AI coding agents.
