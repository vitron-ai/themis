# AGENTS.md

This file is the test-authoring contract for AI agents working in this repository.

## Mission

Generate deterministic, high-signal tests for Themis with strong behavior coverage, stable output, measurable performance discipline, and clear JS/TS-first product contracts.

## Test Strategy

- Use `intent(...)` for behavior and workflow validation.
- Use `test(...)` for low-level pure-unit checks.
- Prefer integration-style tests for runtime/CLI behavior (`collectAndRun`, CLI process execution) over only micro assertions.
- For editor-facing behavior, test the artifact/view-model layer directly instead of depending on the VS Code host in CI.
- Cover both success and failure paths for new behavior.

## Intent DSL Rules

- Include at least one `assert(...)` phase.
- Prefer modern phase names: `context -> run -> verify`, with optional `cleanup`.
- Keep phase order valid regardless of alias choice.
- Add `cleanup(...)` when fixtures create files or mutable state.
- Verify error messages for invalid phase order and failure annotation paths when relevant.
- Use `--no-memes` in CI/strict environments when meme aliases must be rejected.

## Determinism Rules

- No network access in tests.
- Avoid wall-clock assumptions and random values unless normalized/mocked.
- Prefer temporary directories (`fs.mkdtempSync`) for filesystem fixtures.
- Keep worker-sensitive tests pinned to a deterministic worker count when needed.

## CLI Output and Snapshots

- Use real CLI invocation via `spawnSync(process.execPath, [CLI_PATH, ...])`.
- Set `NO_COLOR=1` for stable snapshots.
- Parse `--json` and `--agent` output as JSON objects. Do not make tests depend on whitespace formatting.
- Normalize volatile fields before asserting snapshots:
  - timestamps
  - durations
  - worker counts
  - temp paths (including `/var` and `/private/var` variants on macOS)
- Snapshot baselines live in `tests/snapshots/cli-output.snapshots.json`.
- Keep machine-facing status contracts canonical (`passed`, `failed`, `skipped`, `total`) even when human lexicons change.

## Artifact And Extension Contract

- `.themis/last-run.json`, `.themis/failed-tests.json`, `.themis/run-diff.json`, `.themis/run-history.json`, and `.themis/report.html` are workflow artifacts. Treat shape changes as contract changes.
- If artifact payloads change, update:
  - emitters in `src/artifacts.js` and `src/reporter.js`
  - schemas under `docs/schemas/`
  - contract tests in `tests/schema-contract.test.js`, `tests/agent-reporter.test.js`, and related CLI coverage
  - the VS Code view-model logic in `packages/themis-vscode/src/core.js`
- Keep the VS Code extension thin and artifact-driven. Do not duplicate runner logic there.

## Type Safety Tests

- Put compile-time-only checks in `tests/*.types.ts`.
- Use `@ts-expect-error` to assert intentional type failures.
- Keep runtime assertions out of `.types.ts` unless needed for type flow.

## Performance Discipline

- For runner/reporter/runtime changes, run:
  - `npm run benchmark`
  - `npm run benchmark:gate`
- Do not loosen benchmark gate thresholds without measured evidence and explicit rationale.

## Definition of Done

- `npm test` passes.
- `npm run typecheck` passes.
- `npm run benchmark:gate` passes for performance-sensitive changes.
- Documentation is updated when command behavior, artifact contracts, or test authoring policy changes.
