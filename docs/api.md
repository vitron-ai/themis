# Themis API Reference

This document defines the public API surface for Themis `0.1.0`.

## Start Here

Themis is a unit test framework and test generator for Node.js and TypeScript projects.

Use it in a repo with:

```bash
npm install -D @vitronai/themis
npx themis init --agents
npx themis generate <source-root>
npx themis test
```

Use `src` for conventional source trees and `app` for Next App Router repos. `npx themis generate <source-root>` writes generated tests under `__themis__/tests` by default.

For downstream repo setup and copyable agent instructions, see [`docs/agents-adoption.md`](agents-adoption.md) and [`templates/AGENTS.themis.md`](../templates/AGENTS.themis.md).
For machine-readable agent adoption metadata, see [`themis.ai.json`](../themis.ai.json).

## CLI

## Command

```bash
themis test [options]
themis init [--agents]
themis generate [path]
themis migrate <jest|vitest>
```

## `themis init`

Creates:

- `themis.config.json` with default settings
- adds `.themis/`, `__themis__/reports/`, and `__themis__/shims/` to `.gitignore`
- with `--agents`, also writes a downstream `AGENTS.md` from the bundled Themis template when one does not already exist

## `themis test`

Runs discovered tests, writes `.themis/**` run artifacts, and supports rerun, contract-update, and generated-test repair loops.

If generated tests fail because scanned source files drifted or hints need tightening, use:

```bash
npx themis test --fix
```

`--fix` reads `.themis/runs/fix-handoff.json`, regenerates the affected generated suites with `--update`, scaffolds hints when the repair strategy requires them, and reruns the suite.

## `themis generate`

Scans a source directory and writes generated Themis unit-layer tests.

Themis uses generation and explicit assertions as a contract-first alternative to snapshot-heavy workflows. The goal is comparable baseline coverage with more reviewable diffs, more intentional updates, and stronger machine-readable artifacts for agents.

Default behavior:

- input directory when omitted: `src`
- output directory: `__themis__/tests`
- generated files mirror the scanned source tree with `*.generated.test.ts` for TS/TSX sources and `*.generated.test.js` for JS/JSX sources
- generated TypeScript suites emit `import` syntax so downstream lint and ESM rules do not reject Themis output for using `require(...)`
- generated tests import their shared contract runtime from `@vitronai/themis/contract-runtime` instead of writing framework helper files into the repo
- generated tests assert normalized runtime export contracts directly in generated source
- scenario adapters cover React components, React hooks, Next app components, Next route handlers, generic route handlers, and Node service functions when inputs can be inferred or hinted
- React component and hook adapters also assert inferred interaction/state contracts when event handlers or zero-argument stateful methods are available
- React and Next component adapters also emit direct DOM-state contract assertions that capture visible text, inferred roles, non-event attributes, and interaction-driven UI changes
- React and Next component adapters can also emit async behavioral flow contracts when `componentFlows` are inferred or supplied, including richer inferred input/submit/loading/success flows for common async forms
- project-level providers from `themis.generate.js` / `themis.generate.cjs` can match source files, inject shared fixture data, register runtime mocks, and wrap generated component renders for provider-aware DOM contracts and behavioral flow coverage
- provider presets can declare router, Next navigation, auth/session, React Query, Zustand, and Redux-style wrapper metadata without hand-writing every wrapper shell
- richer flow expectations can assert text transitions, attribute state, and role presence for empty, disabled, retry, error, and recovery paths
- `.themis/generate/generate-map.json` records source-to-generated-test mappings plus scenario metadata
- `.themis/generate/generate-last.json` stores the full machine-readable generate payload
- `.themis/generate/generate-handoff.json` stores a compact prompt-ready handoff payload for agents
- `.themis/generate/generate-backlog.json` stores unresolved skips, conflicts, and confidence debt with suggested remediation

If `src/` does not exist but the repo uses `app/` or `pages/`, pass that path explicitly. Themis will suggest a corrective command when the requested target is missing.

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
| `--output <path>` | string | Output directory for generated tests (default: `__themis__/tests`). |
| `--force` | flag | Replace conflicting files that were not created by a prior Themis scan. |

Per-file hint sidecars are supported via `<source>.themis.json`. These can provide:

- `componentProps`
- `componentInteractions`
- `componentFlows`
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
- any of the same static fixture keys as sidecars (`componentProps`, `componentInteractions`, `componentFlows`, `hookArgs`, `hookInteractions`, `serviceArgs`, `routeRequests`, `routeContext`, `scenarios`)
- `router`: preset router wrapper metadata (`path`, `params`, `search`)
- `router`: also supports `name`, `history`, and `state`
- `nextNavigation`: preset Next navigation wrapper metadata (`pathname`, `params`, `searchParams`)
- `nextNavigation`: also supports `segment` and `locale`
- `auth`: preset auth/session wrapper metadata (`user`, `session`, `state`)
- `auth`: also supports `roles` and `permissions`
- `reactQuery`: preset React Query wrapper metadata (`clientName`, `state`, `cache`)
- `reactQuery`: also supports `status`, `fetchStatus`, and `queries`
- `zustand`: preset Zustand wrapper metadata (`name`, `state`)
- `zustand`: also supports `selectors` and `actions`
- `redux`: preset Redux wrapper metadata (`slice`, `state`)
- `redux`: also supports `selectors` and `actions`
- `applyMocks(context)`: runtime mock registration for generated tests
- `wrapRender(context)`: provider-aware render wrapping for generated React and Next component adapters

`applyMocks(context)` receives:

- `sourceFile`
- `sourcePath`
- `exportName`
- `scenario`
- `mock`
- `fn`
- `mockFetch`
- `resetFetchMocks`
- `restoreFetch`
- `useFakeTimers`
- `useRealTimers`
- `advanceTimersByTime`
- `runAllTimers`
- `flushMicrotasks`

`wrapRender(context)` receives:

- `sourceFile`
- `sourcePath`
- `exportName`
- `scenario`
- `element`
- `withProviderShell(type, element, attrs)`
- `withReactRouter(element, config?)`
- `withNextNavigation(element, config?)`
- `withAuthSession(element, config?)`
- `withReactQuery(element, config?)`
- `withZustandStore(element, config?)`
- `withReduxStore(element, config?)`

## `themis migrate`

Scaffolds an incremental migration bridge for existing Jest or Vitest suites.

This command is designed for incremental adoption, not forced rewrites. Teams can keep existing suites running under Themis first, then move touched tests toward native Themis contracts and `intent(...)` flows over time.

Behavior:

- writes or updates `themis.config.json`
- adds `tests/setup.themis.js` to `setupFiles`
- writes `themis.compat.js` as a local compatibility bridge
- adds `test:themis` to `package.json` when missing
- writes `.themis/migration/migration-report.json` with detected compatibility imports and next actions
- relies on built-in runtime compatibility for `@jest/globals`, `vitest`, and `@testing-library/react`
- preserves a path to replace snapshot-heavy suites with direct assertions and generated contract tests instead of porting snapshot files as-is

Migration options:

- `--rewrite-imports`: rewrites matched imports from `@jest/globals`, `vitest`, and `@testing-library/react` to the local `themis.compat.js` bridge
- `--convert`: removes common framework imports and rewrites common Jest/Vitest matcher patterns (`it`, `toStrictEqual`, `toContainEqual`, `toBeCalled*`) into Themis-native forms

## `themis test` options

| Option | Type | Description |
| --- | --- | --- |
| `--json` | flag | Print full run payload JSON (`RunResult`). |
| `--agent` | flag | Print AI-agent-oriented JSON payload (`themis.agent.result.v1`) with failure fingerprints and cluster analysis. |
| `--next` | flag | Use next-gen human reporter. |
| `--reporter spec\|next\|json\|agent\|html` | string | Explicit reporter override. |
| `--workers <N>` | positive integer | Override worker count. Invalid values fail fast. |
| `--environment node\|jsdom` | string | Override the configured test environment. |
| `--isolation worker\|in-process` | string | Select worker isolation or a zero IPC in-process execution mode. |
| `--cache` | flag | Enable file-level result caching for in-process local loops. |
| `--update-contracts` | flag | Accept updated `captureContract(...)` baselines for the selected tests. |
| `-w`, `--watch` | flag | Rerun the selected suite when watched project files change. |
| `--stability <N>` | positive integer | Run selected tests `N` times and classify stability (`stable_pass`, `stable_fail`, `unstable`). |
| `--html-output <path>` | string | Output path for `--reporter html` (default: `__themis__/reports/report.html`). |
| `--match "<regex>"` | string | Run only tests whose full name matches regex. |
| `--rerun-failed` | flag | Rerun failures from `.themis/runs/failed-tests.json`. |
| `--fix` | flag | Apply generated-test autofixes from `.themis/runs/fix-handoff.json` and rerun the suite. |
| `--no-memes` | flag | Disable meme intent aliases (`cook`, `yeet`, `vibecheck`, `wipe`). |

Migration compatibility:

- imports from `@jest/globals` are supported at runtime
- imports from `vitest` are supported at runtime
- imports from `@testing-library/react` are supported via Themis `render`, `screen`, `fireEvent`, `waitFor`, `cleanup`, and `act`
- `themis migrate <jest|vitest>` also emits `.themis/migration/migration-report.json` with detected files and recommended next actions

Additional option:

| `--lexicon classic\|themis` | string | Human reporter terminology mode for `next/spec`. |

Execution note:

- `--watch --isolation in-process --cache` is the fastest local rerun mode
- `--isolation worker` remains the safer mode for CI and global-heavy suites
- `--watch` is intended for short edit-run-review loops for both humans and AI agents

Snapshot note:

- Themis no longer supports first-party snapshot files or `-u` update flows.
- Prefer direct assertions, generated contract tests, and explicit flow expectations.
- The intended replacement is comparable outcome with better reviewability: normalized contracts, readable source assertions, diff-oriented artifacts, and intentional regeneration.
- `captureContract(name, value)` writes a normalized baseline under `.themis/contracts/`, fails on drift by default, and pairs with `--update-contracts` for explicit acceptance.
- `captureContract(name, value, options)` also supports:
  - `normalize(value)`: rewrite volatile payloads before persistence
  - `maskPaths: string[]`: replace selected JSON-style paths such as `$.requestId`
  - `sortArrays: true`: sort normalized array values for order-insensitive contracts

## Exit behavior

- Exit code `0`: all selected tests passed or were skipped.
- Exit code `1`: any selected test failed, invalid usage, or runtime error.

Generate-specific note:

- `themis generate` exits `1` when active generate gates fail, including unresolved conflicts in write mode.

`--lexicon` does not affect machine payload contracts (`--json`, `--agent`, or artifacts).

## Artifacts

Themis writes artifacts under `.themis/`:

- `.themis/runs/last-run.json`: full run payload (`RunResult`)
- `.themis/runs/failed-tests.json`: failed subset (`themis.failures.v1`)
- `.themis/diffs/run-diff.json`: diff against the previous run
- `.themis/runs/run-history.json`: rolling recent-run history
- `.themis/runs/fix-handoff.json`: deduped repair artifact for generated test failures (`themis.fix.handoff.v1`)
- `.themis/migration/migration-report.json`: migration inventory for Jest/Vitest bridge scaffolds (`themis.migration.report.v1`)
- `.themis/diffs/contract-diff.json`: contract capture drift, updates, and update commands (`themis.contract.diff.v1`)
- `.themis/generate/generate-last.json`: latest generate payload (`themis.generate.result.v1`)
- `.themis/generate/generate-map.json`: source-to-generated-test mapping (`themis.generate.map.v1`)
- `.themis/generate/generate-handoff.json`: compact agent handoff (`themis.generate.handoff.v1`)
- `.themis/generate/generate-backlog.json`: unresolved generation debt (`themis.generate.backlog.v1`)
- `.themis/benchmarks/benchmark-last.json`: latest benchmark comparison payload plus migration proof (`themis.benchmark.result.v1`)
- `.themis/benchmarks/migration-proof.json`: synthetic migration conversion proof emitted by `npm run benchmark` (`themis.migration.proof.v1`)

Formal schemas:

- `docs/schemas/agent-result.v1.json`
- `docs/schemas/generate-result.v1.json`
- `docs/schemas/generate-map.v1.json`
- `docs/schemas/generate-handoff.v1.json`
- `docs/schemas/generate-backlog.v1.json`
- `docs/schemas/fix-handoff.v1.json`
- `docs/schemas/failures.v1.json`
- `docs/schemas/contract-diff.v1.json`

Human-facing artifact:

- `__themis__/reports/report.html`: interactive HTML verdict report

Agent payload details:

- each `failures[]` entry includes a deterministic `fingerprint`
- `analysis.failureClusters` groups failures by shared fingerprint
- `analysis.stability` captures multi-run classifications and per-test status sequences
- `analysis.comparison` reports delta stats plus new and resolved failures against the previous run
- `artifacts.fixHandoff` points to `.themis/runs/fix-handoff.json` for generated failure repair loops
- fix handoff entries include `repairStrategy`, `candidateFiles`, and `autofixCommand` for machine repair loops
- `hints.repairGenerated` points to `npx themis test --fix` for a first-party generated-suite repair command

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

When the handler form is used, shorthand objects returned by the handler are normalized into `Response` instances before the generated test consumes them.

The fake timer helpers only patch the current Themis runtime. They do not mutate system time outside the active test process.

## Config File (`themis.config.json`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `testDir` | string | `"tests"` | Root directory for discovery. |
| `generatedTestsDir` | string | `"__themis__/tests"` | Additional discovery root for generated Themis suites. |
| `testRegex` | string | `"\\.(test\|spec)\\.(js\|jsx\|ts\|tsx)$"` | Regex for filenames. |
| `maxWorkers` | integer | `max(1, cpuCount - 1)` | Parallel worker limit. |
| `reporter` | `spec\|next\|json\|agent\|html` | `"next"` | Default reporter when no CLI override is set. |
| `environment` | `node\|jsdom` | `"node"` | Test runtime environment. |
| `setupFiles` | `string[]` | `[]` | Files loaded before each test file. |
| `tsconfigPath` | `string \| null` | `"tsconfig.json"` | Project tsconfig used for TSX and alias-aware transpilation. |
| `htmlReportPath` | string | `"__themis__/reports/report.html"` | Default output path for `--reporter html` when `--html-output` is not provided. |
| `testIgnore` | `string[]` | `[]` | Regex strings matched against repo-relative paths during discovery. Matching files and directories are skipped. |

Runtime loader note:

- Themis handles common frontend style imports (`.css`, `.scss`, `.sass`, `.less`, `.styl`, `.pcss`) and common static assets (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`, `.svg`, font/media files) without extra setup.
- Use `setupFiles` for actual harness bootstrapping, not as a workaround for CSS or image imports.
- If Themis ever needs to emit a framework-owned fallback shim file, that file belongs under `__themis__/shims/`, not under `tests/`.

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

Builds the unresolved-work artifact persisted at `.themis/generate/generate-backlog.json`.

## `buildGenerateHandoff(payload): GenerateHandoffPayload`

Builds the compact handoff payload persisted at `.themis/generate/generate-handoff.json`.

## `writeGenerateArtifacts(summary, cwd?): { payload, handoff, backlog }`

Writes `.themis/generate/generate-last.json`, `.themis/generate/generate-handoff.json`, and `.themis/generate/generate-backlog.json` for a generate run and returns all three payloads.

## `loadConfig(cwd): ThemisConfig`

Loads `themis.config.json` and merges with defaults.

Discovery note:

- Themis discovers both `testDir` and `generatedTestsDir` by default.
- `testIgnore` is applied to repo-relative file and directory paths before descent, so use it only for paths you intentionally want to skip, such as fixtures or scratch suites.

## `initConfig(cwd): void`

Creates `themis.config.json` if missing.

## `runMigrate(cwd, framework): MigrationResult`

Scaffolds an incremental migration bridge for `jest` or `vitest`.

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
