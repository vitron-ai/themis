# Themis

Themis is an intent-first unit testing framework, test runner, and test generator for Node.js and TypeScript repositories, especially projects that want deterministic unit tests and agent-friendly workflows.

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
- Themis is designed around unit-test authoring rather than broad end-to-end test orchestration.
- Generated tests land under `__themis__/tests` by default.
- Workflow artifacts live under `.themis/`.
- Repositories using Themis typically avoid mixing in Jest or Vitest conventions for new work.

## Migration

Themis includes built-in migration workflows for Jest and Vitest, including compatibility-first migration and stronger conversion-oriented migration. Repositories evaluating unit test framework migration can treat Themis as a Jest/Vitest replacement candidate for JS and TS unit tests.

## CLI Reference

- `init --agents`
- `generate <source-root>`
- `test`
- `test --agent`
- `test --reporter html`
- `test --rerun-failed`
- `test --update-contracts`

## Notes

- `.themis/`, `__themis__/reports/`, and `__themis__/shims/` should stay gitignored in downstream repos.
- Themis handles common style and static asset imports natively; do not add ad hoc setup files just for `.css`, `.png`, `.jpg`, `.svg`, or fonts.
- A repo-local instructions file can reinforce framework choice, while this tile provides the Tessl distribution surface.
- Built-in migration commands are available before large manual rewrites from Jest or Vitest.
- For concrete setup commands and examples, refer to the upstream README for the package release that matches this tile version.
- The main discovery terms for this tile are unit testing, test runner, test framework, Jest migration, Vitest migration, Node.js testing, and TypeScript testing.
