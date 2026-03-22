# Themis API Reference

This document defines the public API surface for Themis `0.1.0-beta.0`.

## CLI

## Command

```bash
themis test [options]
themis init
themis generate [path]
```

## `themis init`

Creates:

- `themis.config.json` with default settings
- `tests/example.test.js` sample test (if missing)

## `themis generate`

Scans a source directory and writes generated Themis unit-layer tests.

Default behavior:

- input directory: `src`
- output directory: `tests/generated`
- generated files mirror the scanned source tree with `*.generated.test.js`
- generated tests snapshot normalized runtime export contracts
- scenario adapters cover React components, React hooks, Next app components, Next route handlers, generic route handlers, and Node service functions when inputs can be inferred or hinted
- React component and hook adapters also snapshot inferred interaction/state contracts when event handlers or zero-argument stateful methods are available
- React and Next component adapters also emit DOM-state snapshots that capture visible text, inferred roles, non-event attributes, and interaction-driven UI changes
- project-level providers from `themis.generate.js` / `themis.generate.cjs` can match source files, inject shared fixture data, register runtime mocks, and wrap generated component renders for provider-aware DOM contracts
- `.themis/generate-map.json` records source-to-generated-test mappings plus scenario metadata
- `.themis/generate-last.json` stores the full machine-readable generate payload
- `.themis/generate-handoff.json` stores a compact prompt-ready handoff payload for agents
- `.themis/generate-backlog.json` stores unresolved skips, conflicts, and confidence debt with suggested remediation

## `themis generate` options

| Option | Type | Description |
| --- | --- | --- |
| `--json` | flag | Print a machine-readable generation payload (`themis.generate.result.v1`). |
| `--plan` | flag | Alias for `--review --json`, plus persisted handoff artifacts for agent loops. |
| `--review` | flag | Preview create/update/remove decisions without writing files. |
| `--update` | flag | Refresh existing generated files only. |
| `--clean` | flag | Remove generated files for the selected scope. |
| `--changed` | flag | Limit selection to changed files in the current git worktree. |
| `--write-hints` | flag | Scaffold missing `.themis.json` hint sidecars and use them in the same generate run. |
| `--strict` | flag | Fail generation on skips, conflicts, or entries below `high` confidence. |
| `--fail-on-skips` | flag | Fail generation when any selected source file is skipped. |
| `--fail-on-conflicts` | flag | Fail generation when conflicts remain unresolved. |
| `--files <paths>` | string | Comma-separated list of explicit source files to generate for. |
| `--scenario <name>` | string | Limit generation to one adapter family. |
| `--min-confidence <level>` | string | Keep only entries at or above `low`, `medium`, or `high`. |
| `--require-confidence <level>` | string | Fail generation if selected entries fall below `low`, `medium`, or `high`. |
| `--match-source <regex>` | string | Filter candidate source files by relative path regex. |
| `--match-export <regex>` | string | Filter candidate source files by exported symbol regex. |
| `--include <regex>` | string | Include only source files whose relative path matches regex. |
| `--exclude <regex>` | string | Exclude source files whose relative path matches regex. |
| `--output <path>` | string | Output directory for generated tests (default: `tests/generated`). |
| `--force` | flag | Replace conflicting files that were not created by a prior Themis scan. |

Per-file hint sidecars are supported via `<source>.themis.json`. These can provide:

- `componentProps`
- `componentInteractions`
- `hookArgs`
- `hookInteractions`
- `serviceArgs`
- `routeRequests`
- `routeContext`
- `includeExports`
- `excludeExports`
- `scenarios`

`componentProps` and `routeRequests`/`routeContext` also steer Next app component and Next route handler adapters.

Project-level provider modules are supported via `themis.generate.js` or `themis.generate.cjs` at the repo root. A provider can expose:

- `include` / `exclude` / `files`: source matching rules
- any of the same static fixture keys as sidecars (`componentProps`, `componentInteractions`, `hookArgs`, `hookInteractions`, `serviceArgs`, `routeRequests`, `routeContext`, `scenarios`)
- `applyMocks(context)`: runtime mock registration for generated tests
- `wrapRender(context)`: provider-aware render wrapping for generated React and Next component adapters

`applyMocks(context)` receives:

- `sourceFile`
- `sourcePath`
- `exportName`
- `scenario`
- `mock`
- `fn`

`wrapRender(context)` receives:

- `sourceFile`
- `sourcePath`
- `exportName`
- `scenario`
- `element`

## `themis test` options

| Option | Type | Description |
| --- | --- | --- |
| `--json` | flag | Print full run payload JSON (`RunResult`). |
| `--agent` | flag | Print AI-agent-oriented JSON payload (`themis.agent.result.v1`) with failure fingerprints and cluster analysis. |
| `--next` | flag | Use next-gen human reporter. |
| `--reporter spec\|next\|json\|agent\|html` | string | Explicit reporter override. |
| `--workers <N>` | positive integer | Override worker count. Invalid values fail fast. |
| `--environment node\|jsdom` | string | Override the configured test environment. |
| `-w`, `--watch` | flag | Rerun the selected suite when watched project files change. |
| `-u`, `--update-snapshots` | flag | Update snapshot files when `toMatchSnapshot()` values change. |
| `--stability <N>` | positive integer | Run selected tests `N` times and classify stability (`stable_pass`, `stable_fail`, `unstable`). |
| `--html-output <path>` | string | Output path for `--reporter html` (default: `.themis/report.html`). |
| `--match "<regex>"` | string | Run only tests whose full name matches regex. |
| `--rerun-failed` | flag | Rerun failures from `.themis/failed-tests.json`. |
| `--no-memes` | flag | Disable meme intent aliases (`cook`, `yeet`, `vibecheck`, `wipe`). |
| `--lexicon classic\|themis` | string | Human reporter terminology mode for `next/spec`. |

## Exit behavior

- Exit code `0`: all selected tests passed or were skipped.
- Exit code `1`: any selected test failed, invalid usage, or runtime error.

Generate-specific note:

- `themis generate` exits `1` when active generate gates fail, including unresolved conflicts in write mode.

`--lexicon` does not affect machine payload contracts (`--json`, `--agent`, or artifacts).

## Artifacts

Each run writes to `.themis/`:

- `last-run.json`: full run payload (`RunResult`)
- `failed-tests.json`: failed subset (`themis.failures.v1`)
- `run-diff.json`: diff against the previous run
- `run-history.json`: rolling recent-run history
- `fix-handoff.json`: deduped repair artifact for generated test failures (`themis.fix.handoff.v1`)

Formal schemas:

- `docs/schemas/agent-result.v1.json`
- `docs/schemas/generate-result.v1.json`
- `docs/schemas/generate-map.v1.json`
- `docs/schemas/generate-handoff.v1.json`
- `docs/schemas/generate-backlog.v1.json`
- `docs/schemas/fix-handoff.v1.json`
- `docs/schemas/failures.v1.json`

Human-facing artifact:

- `.themis/report.html`: interactive HTML verdict report

Agent payload details:

- each `failures[]` entry includes a deterministic `fingerprint`
- `analysis.failureClusters` groups failures by shared fingerprint
- `analysis.stability` captures multi-run classifications and per-test status sequences
- `analysis.comparison` reports delta stats plus new and resolved failures against the previous run
- `artifacts.fixHandoff` points to `.themis/fix-handoff.json` for generated failure repair loops

## UI Test Utilities

Themis exposes a lightweight DOM-oriented helper layer for `jsdom` tests:

- `render(input, options?)`
- `screen.getByText(text)`
- `screen.queryByText(text)`
- `screen.getByRole(role, options?)`
- `screen.queryByRole(role, options?)`
- `screen.getByLabelText(labelText)`
- `fireEvent.click(node)`
- `fireEvent.change(node, payload?)`
- `fireEvent.input(node, payload?)`
- `fireEvent.submit(node)`
- `fireEvent.keyDown(node, payload?)`
- `waitFor(assertion, options?)`
- `cleanup()`
- `useFakeTimers()`
- `useRealTimers()`
- `advanceTimersByTime(ms)`
- `runAllTimers()`
- `flushMicrotasks()`
- `mockFetch(handlerOrResponse)`
- `resetFetchMocks()`
- `restoreFetch()`

Supported DOM matchers:

- `expect(node).toHaveTextContent(text)`
- `expect(node).toHaveAttribute(name, value?)`
- `expect(node).toBeInTheDocument()`

These helpers are intentionally small and deterministic. They are designed for generated UI unit-layer tests and human-authored component tests running in Themis `jsdom` mode.

`mockFetch(...)` accepts either:

- a function `(input, init) => response`
- a Response instance
- a shorthand object like `{ status, headers, body }` or `{ status, json }`

The fake timer helpers only patch the current Themis runtime. They do not mutate system time outside the active test process.

## Config File (`themis.config.json`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `testDir` | string | `"tests"` | Root directory for discovery. |
| `testRegex` | string | `"\\.(test\|spec)\\.(js\|jsx\|ts\|tsx)$"` | Regex for filenames. |
| `maxWorkers` | integer | `max(1, cpuCount - 1)` | Parallel worker limit. |
| `reporter` | `spec\|next\|json\|agent\|html` | `"next"` | Default reporter when no CLI override is set. |
| `environment` | `node\|jsdom` | `"node"` | Test runtime environment. |
| `setupFiles` | `string[]` | `[]` | Files loaded before each test file. |
| `tsconfigPath` | `string \| null` | `"tsconfig.json"` | Project tsconfig used for TSX and alias-aware transpilation. |

## Programmatic API

Import:

```js
const themis = require('@vitronai/themis');
```

## `main(argv: string[]): Promise<void>`

Programmatic entrypoint for CLI behavior.

## `collectAndRun(filePath, options?): Promise<FileResult>`

Runs tests in one file in-process with global API installation.

Options:

- `match?: string | null`
- `allowedFullNames?: string[] | null`
- `noMemes?: boolean`
- `cwd?: string`
- `environment?: "node" | "jsdom"`
- `setupFiles?: string[]`
- `tsconfigPath?: string | null`
- `updateSnapshots?: boolean`

## `runTests(files, options?): Promise<RunResult>`

Runs multiple files in worker threads.

Options:

- `maxWorkers?: number`
- `match?: string | null`
- `allowedFullNames?: string[] | null`
- `noMemes?: boolean`
- `cwd?: string`
- `environment?: "node" | "jsdom"`
- `setupFiles?: string[]`
- `tsconfigPath?: string | null`
- `updateSnapshots?: boolean`

## `discoverTests(cwd, config): string[]`

Discovers test files from config.

## `generateTestsFromSource(cwd, options?): GenerateSummary`

Scans exported source modules and writes deterministic generated tests plus mapping artifacts.

Options:

- `targetDir?: string`
- `outputDir?: string`
- `force?: boolean`
- `writeHints?: boolean`
- `plan?: boolean`
- `review?: boolean`
- `update?: boolean`
- `clean?: boolean`
- `changed?: boolean`
- `strict?: boolean`
- `failOnSkips?: boolean`
- `failOnConflicts?: boolean`
- `requireConfidence?: string | null`
- `files?: string[] | string`
- `scenario?: string | null`
- `minConfidence?: string | null`
- `matchSource?: string | null`
- `matchExport?: string | null`
- `include?: string | null`
- `exclude?: string | null`

Generated tests can consume repo-level providers from `themis.generate.js` / `themis.generate.cjs` automatically. No extra flag is required.

Returns absolute paths for scanned files, selected generated files, removed stale generated files, skipped files, detailed per-entry actions, prompt text, and artifact locations.

Generate payload note:

- `mode.writeHints` indicates whether scaffold hint generation was enabled
- `hintFiles` reports created, updated, and unchanged scaffold sidecars for the run

## `buildGeneratePayload(summary, cwd?): GeneratePayload`

Converts a `GenerateSummary` into the same machine-readable payload emitted by `themis generate --json`.

## `buildGenerateBacklogPayload(summary, cwd?): GenerateBacklogPayload`

Builds the unresolved-work artifact persisted at `.themis/generate-backlog.json`.

## `buildGenerateHandoff(payload): GenerateHandoffPayload`

Builds the compact handoff payload persisted at `.themis/generate-handoff.json`.

## `writeGenerateArtifacts(summary, cwd?): { payload, handoff, backlog }`

Writes `.themis/generate-last.json`, `.themis/generate-handoff.json`, and `.themis/generate-backlog.json` for a generate run and returns all three payloads.

## `loadConfig(cwd): ThemisConfig`

Loads `themis.config.json` and merges with defaults.

## `initConfig(cwd): void`

Creates `themis.config.json` if missing.

## `DEFAULT_CONFIG: ThemisConfig`

Default configuration object used by `loadConfig` and `initConfig`.

## `expect(received)`

Built-in matcher API:

- `toBe(expected)`
- `toEqual(expected)`
- `toMatchObject(expected)`
- `toBeTruthy()`
- `toBeFalsy()`
- `toBeDefined()`
- `toBeUndefined()`
- `toBeNull()`
- `toHaveLength(expected)`
- `toContain(item)`
- `toThrow(match?)`
- `toHaveBeenCalled()`
- `toHaveBeenCalledTimes(expected)`
- `toHaveBeenCalledWith(...args)`
- `toMatchSnapshot(name?)`

Machine-facing note:

- `--json` and `--agent` emit compact JSON by design. Tooling should parse the payload rather than rely on pretty-printed formatting.

## Global Test API

When test files run under Themis, these globals are available:

- `describe(name, fn)`
- `test(name, fn)` and `it(name, fn)`
- `beforeAll(fn)`, `beforeEach(fn)`, `afterEach(fn)`, `afterAll(fn)`
- `expect(...)`
- `fn(implementation?)`
- `spyOn(object, methodName)`
- `mock(moduleId, factoryOrExports?)`
- `unmock(moduleId)`
- `clearAllMocks()`
- `resetAllMocks()`
- `restoreAllMocks()`
- `intent(name, define)`

## Intent DSL

Preferred phases:

- `context`
- `run`
- `verify`
- `cleanup`

Compatibility aliases:

- `arrange`, `act`, `assert`
- `given`, `when`, `then`
- `setup`, `infer`, `teardown`, `finally`

Meme aliases (default enabled):

- `cook`, `yeet`, `vibecheck`, `wipe`

Disable meme aliases with `--no-memes` or programmatic `noMemes: true`.

Ordering guarantees:

- Arrange-phase aliases must run before Act/Assert.
- Act-phase aliases must run before Assert.
- At least one Assert-phase alias is required.
- Cleanup phases always run after run phases.
