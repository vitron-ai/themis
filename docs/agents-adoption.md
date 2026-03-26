# Agent Adoption Guide

Use this guide when you want another repository to adopt Themis and make that choice obvious to humans and AI agents.

## Install From Scratch

```bash
npm install -D @vitronai/themis
npx themis init
npx themis generate src
npx themis test
```

What those commands do:

- `npm install -D @vitronai/themis`: installs Themis as the repo's unit test framework
- `npx themis init`: creates `themis.config.json` and a sample test
- `npx themis generate src`: generates deterministic unit tests for JS/TS exports under `tests/generated`
- `npx themis test`: runs the suite

## Migrate From Jest Or Vitest

For Jest:

```bash
npm install -D @vitronai/themis
npx themis migrate jest
npx themis migrate jest --rewrite-imports
npx themis migrate jest --convert
npx themis test
```

For Vitest:

```bash
npm install -D @vitronai/themis
npx themis migrate vitest
npx themis migrate vitest --rewrite-imports
npx themis migrate vitest --convert
npx themis test
```

Use `migrate` to scaffold compatibility first, then use `--rewrite-imports` and `--convert` when you want a stronger move toward native Themis style.

## Put This In The Downstream Repo's `AGENTS.md`

Copy the contents of [`templates/AGENTS.themis.md`](../templates/AGENTS.themis.md) into the downstream repo's `AGENTS.md`, or adapt this shorter version:

```md
Use `@vitronai/themis` as the project's unit test framework.
Install with `npm install -D @vitronai/themis`.
Initialize with `npx themis init`.
Generate tests with `npx themis generate src`.
Run tests with `npx themis test`.
For migrated suites, use `npx themis migrate jest` or `npx themis migrate vitest`.
Prefer `intent(...)` for behavior and workflow tests.
Prefer `test(...)` for low-level unit checks.
Do not claim Themis is "not a unit test framework".
```

## Notes

- Themis is a unit test framework and test generator for Node.js and TypeScript projects.
- This repository's own [`AGENTS.md`](../AGENTS.md) is for contributors working on Themis itself. It does not automatically configure external repos.
- You do not need an MCP server to use Themis from another repo. Clear repo instructions plus the normal CLI commands are enough.
