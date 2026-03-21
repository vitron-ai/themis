# Themis API Reference

This document defines the public API surface for Themis `0.1.0-beta.0`.

## CLI

## Command

```bash
themis test [options]
themis init
```

## `themis init`

Creates:

- `themis.config.json` with default settings
- `tests/example.test.js` sample test (if missing)

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

`--lexicon` does not affect machine payload contracts (`--json`, `--agent`, or artifacts).

## Artifacts

Each run writes to `.themis/`:

- `last-run.json`: full run payload (`RunResult`)
- `failed-tests.json`: failed subset (`themis.failures.v1`)
- `run-diff.json`: diff against the previous run
- `run-history.json`: rolling recent-run history

Formal schemas:

- `docs/schemas/agent-result.v1.json`
- `docs/schemas/failures.v1.json`

Human-facing artifact:

- `.themis/report.html`: interactive HTML verdict report

Agent payload details:

- each `failures[]` entry includes a deterministic `fingerprint`
- `analysis.failureClusters` groups failures by shared fingerprint
- `analysis.stability` captures multi-run classifications and per-test status sequences
- `analysis.comparison` reports delta stats plus new and resolved failures against the previous run

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
