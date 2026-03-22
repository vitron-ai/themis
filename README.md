# Themis

<p align="center">
  <img src="src/assets/themisLogo.png" alt="Themis logo mark" width="42" valign="middle">
  <a href="https://github.com/vitron-ai/themis/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/vitron-ai/themis/ci.yml?branch=main&style=for-the-badge&label=THEMIS%20VERDICT%20PIPELINE&labelColor=111827&color=16a34a" alt="Themis verdict pipeline status" valign="middle">
  </a>
</p>

Themis is an intent-first unit test framework for AI agents in Node.js and TypeScript.

It is built to be the best test loop for agent workflows: deterministic reruns, machine-readable outputs, strict phase semantics, and a branded AI verdict engine for humans.

<p align="center">
  <img src="src/assets/themisReport.png" alt="Themis HTML verdict report" width="960">
</p>

## Contents

- [Quickstart](#quickstart)
- [Code Scan](#code-scan)
- [Positioning](#positioning)
- [Modern JS/TS Support](#modern-jsts-support)
- [Commands](#commands)
- [Agent Guide](#agent-guide)
- [VS Code](#vs-code)
- [Snapshots And Mocks](#snapshots-and-mocks)
- [Intent Syntax](#intent-syntax)
- [Config](#config)
- [TypeScript](#typescript)
- [Benchmark](#benchmark)
- [Publish Readiness](#publish-readiness)
- [Why Themis](docs/why-themis.md)
- [API Reference](docs/api.md)
- [Release Policy](docs/release-policy.md)
- [Publish Guide](docs/publish.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Positioning

- Best-in-class unit testing for AI agents in Node.js and TypeScript
- Deterministic execution with fast rerun loops
- Agent-native JSON and HTML reporting
- AI verdict engine for human triage and machine automation

## Modern JS/TS Support

Themis is built for modern Node.js and TypeScript projects:

- `.js`, `.jsx`, `.ts`, and `.tsx` support
- ESM `.js` loading in `type: "module"` projects
- `tsconfig` path alias resolution
- `node` and `jsdom` environments
- `setupFiles` for harness bootstrapping
- first-party snapshots, mocks, and spies
- `--watch` and `--rerun-failed` for tight local and agent rerun loops

## Visuals

- Real Themis brand mark: [`src/assets/themisLogo.png`](src/assets/themisLogo.png)
- HTML verdict report art: [`src/assets/themisReport.png`](src/assets/themisReport.png)
- Background art used by the report: [`src/assets/themisBg.png`](src/assets/themisBg.png)

## Quickstart

```bash
npm install -D @vitronai/themis
npx themis init
npx themis generate src
npx themis test
```

Generate the next-gen HTML report:

```bash
npx themis test --reporter html
```

Use the AI-agent payload:

```bash
npx themis test --agent
```

Stay in a local rerun loop while editing:

```bash
npx themis test --watch --reporter next
```

## Code Scan

Themis can scan your JS/TS source tree and generate deterministic unit-layer tests for exported modules, React components, React hooks, Next app components, Next route handlers, generic route handlers, and Node services:

```bash
npx themis generate src
npx themis test
```

Generated files land under `tests/generated` by default. Each generated test:

- checks the scanned export names when Themis can resolve them exactly
- snapshots a normalized runtime contract for the module surface
- adds scenario adapters for React components/hooks, Next app/router files, route handlers, and service functions when Themis can infer or read useful inputs
- captures React interaction and hook state-transition contracts when event handlers or stateful methods are available
- fails with a regeneration hint when the source drifts after the scan

Themis also supports per-file generation hints with sidecars like `src/components/Button.themis.json` so humans and agents can provide props, args, route requests, and route context. When those sidecars do not exist yet, `--write-hints` can scaffold them automatically from the current source analysis.

For repo-wide generation defaults, add `themis.generate.js` or `themis.generate.cjs` at the project root. Providers in that file can match source paths, supply shared props/args/interaction plans, and register runtime mocks for generated React, route, and service adapters.

For CI and agent loops, Themis can also enforce generation quality instead of only writing files. Strict runs emit a structured backlog, fail on unresolved scan debt, and hand back exact remediation commands.

Use these flags to control the generation loop:

- `--json`: machine-readable payload for agents, including prompt-ready next steps
- `--plan`: alias for `--review --json` with persisted handoff artifacts
- `--review`: dry-run create/update/remove decisions without writing files
- `--update`: refresh existing generated files only
- `--clean`: remove generated files for the selected scope
- `--changed`: target changed files in a git worktree
- `--write-hints`: scaffold missing `.themis.json` sidecars so the next generate pass has explicit component props, hook args, service args, and route requests
- `--scenario`: limit generation to one adapter family such as `react-hook`, `next-app-component`, or `next-route-handler`
- `--min-confidence`: keep only entries at or above a confidence threshold
- `--strict`: fail the generate run on skips, conflicts, or entries below `high` confidence
- `--fail-on-skips`, `--fail-on-conflicts`: turn unresolved scan debt into a non-zero exit code
- `--require-confidence`: fail if selected generated tests fall below a confidence threshold
- `--files`, `--match-source`, `--match-export`, `--include`, `--exclude`: narrow the scan scope
- `--force`: replace a conflicting non-Themis file
- `--output <dir>`: change the generated test directory

Every generation run also writes:

- `.themis/generate-map.json`: source-to-generated-test mapping plus scenario/confidence metadata
- `.themis/generate-last.json`: the full machine-readable generate payload
- `.themis/generate-handoff.json`: a compact agent handoff artifact with prompt-ready next actions
- `.themis/generate-backlog.json`: unresolved skips, conflicts, and confidence debt with suggested fixes

When generated tests fail, Themis also writes:

- `.themis/fix-handoff.json`: a deduped failure-to-fix artifact that maps generated failures back to source files, categories, and remediation commands

## Why Themis

See [`docs/why-themis.md`](docs/why-themis.md) for positioning, differentiators, and community messaging.

## Reference Docs

- API reference: [`docs/api.md`](docs/api.md)
- Release policy: [`docs/release-policy.md`](docs/release-policy.md)
- Publish guide: [`docs/publish.md`](docs/publish.md)
- VS Code extension notes: [`docs/vscode-extension.md`](docs/vscode-extension.md)
- Agent result schema: [`docs/schemas/agent-result.v1.json`](docs/schemas/agent-result.v1.json)
- Generate result schema: [`docs/schemas/generate-result.v1.json`](docs/schemas/generate-result.v1.json)
- Generate map schema: [`docs/schemas/generate-map.v1.json`](docs/schemas/generate-map.v1.json)
- Generate handoff schema: [`docs/schemas/generate-handoff.v1.json`](docs/schemas/generate-handoff.v1.json)
- Generate backlog schema: [`docs/schemas/generate-backlog.v1.json`](docs/schemas/generate-backlog.v1.json)
- Fix handoff schema: [`docs/schemas/fix-handoff.v1.json`](docs/schemas/fix-handoff.v1.json)
- Failures artifact schema: [`docs/schemas/failures.v1.json`](docs/schemas/failures.v1.json)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security: [`SECURITY.md`](SECURITY.md)

## Commands

- `npx themis init`: creates `themis.config.json` and a sample test.
- `npx themis generate src`: scans source files and generates contract tests under `tests/generated`.
- `npx themis generate src --json`: emits a machine-readable generation payload for agents and automation.
- `npx themis generate src --plan`: emits a planning payload and handoff artifact without writing generated tests.
- `npx themis generate src --review --json`: previews create/update/remove decisions without writing files.
- `npx themis generate src --review --strict --json`: fails fast on unresolved generation debt while still emitting a machine-readable plan.
- `npx themis generate src --write-hints`: scaffolds missing hint sidecars and uses them in the same generate pass.
- `npx themis generate src --update`: refreshes existing generated tests only.
- `npx themis generate src --clean`: removes generated tests for the selected scope.
- `npx themis generate src --changed`: regenerates against changed files in the current git worktree.
- `npx themis generate src --scenario react-hook --min-confidence high`: targets one adapter family at a confidence threshold.
- `npx themis generate app --scenario next-route-handler`: focuses generation on Next app router request handlers.
- `npx themis generate src --require-confidence high`: enforces a quality bar for all selected generated tests.
- `npx themis generate src --files src/routes/ping.ts`: targets one or more explicit source files.
- `npx themis generate src --match-source "routes/" --match-export "GET|POST"`: narrows generation by source path and exported symbol.
- `npx themis generate src --output tests/contracts`: writes generated tests to a custom directory.
- `npx themis generate src --force`: replaces conflicting files in the target output directory.
- `npx themis test`: discovers and runs tests.
- `npx themis test --next`: next-gen console output mode.
- `npx themis test --json`: emits JSON result payload.
- `npx themis test --agent`: emits AI-agent-oriented JSON schema.
- `npx themis test --reporter html`: generates a next-gen HTML report file.
- `npx themis test --reporter html --html-output reports/themis.html`: writes HTML report to a custom path.
- `npx themis test --watch`: reruns the suite when watched project files change.
- `npx themis test --workers 8`: overrides worker count (positive integer).
- `npx themis test --environment jsdom`: runs tests in a browser-like DOM environment.
- `npx themis test -u`: updates stored snapshots.
- `npx themis test --stability 3`: runs the suite three times and classifies each test as `stable_pass`, `stable_fail`, or `unstable`.
- `npx themis test --match "intent DSL"`: runs only tests whose full name matches regex.
- `npx themis test --rerun-failed`: reruns failing tests from `.themis/failed-tests.json`.
- `npx themis test --no-memes`: disables meme phase aliases (`cook`, `yeet`, `vibecheck`, `wipe`).
- `npx themis test --lexicon classic|themis`: rebrands human-readable status labels in `next/spec` reporters.
- `npm run validate`: runs test, typecheck, and benchmark gate in one command.
- `npm run typecheck`: validates TypeScript types for Themis globals and DSL contracts.
- `npm run benchmark:gate`: fails when benchmark performance exceeds the configured threshold.
- `npm run pack:check`: previews the npm publish payload.

## Agent Guide

See [`AGENTS.md`](AGENTS.md) for the AI-agent test authoring contract used in this repository.

Each run writes artifacts to `.themis/`:

- `last-run.json`: full machine-readable run payload.
- `failed-tests.json`: compact failure list for retry loops.
- `run-diff.json`: diff against the previous run, including new and resolved failures.
- `run-history.json`: rolling recent-run history for agent comparison loops.
- `fix-handoff.json`: source-oriented repair handoff for generated test failures.
- `report.html`: interactive HTML verdict report.

`--agent` output includes deterministic failure fingerprints, grouped `analysis.failureClusters`, stability classifications, previous-run comparison data, and a direct pointer to `.themis/fix-handoff.json` so AI agents can jump from generated failures to exact regeneration commands.

Machine-facing reporters intentionally emit compact JSON. Agents and tooling should parse the payloads rather than depend on whitespace formatting.

The HTML reporter is designed for agent-adjacent review workflows too: it combines verdict status, slow-test surfacing, artifact navigation, and interactive file filtering in one report.

## VS Code

The repo now includes a thin VS Code extension scaffold at [`packages/themis-vscode`](packages/themis-vscode).

The extension is intentionally artifact-driven:

- reads `.themis/last-run.json`, `.themis/failed-tests.json`, `.themis/run-diff.json`, `.themis/generate-last.json`, `.themis/generate-map.json`, `.themis/generate-backlog.json`, and `.themis/report.html`
- shows the latest verdict and failures in a sidebar
- adds generated-review navigation for source/test/hint mappings plus unresolved generation backlog
- reruns Themis from VS Code commands
- opens the HTML report inside a webview

It does not replace the CLI. The CLI and `.themis/*` artifacts remain the source of truth.

## Snapshots And Mocks

Themis now ships first-party test utilities for agent-generated tests:

```js
mock('../src/api', () => ({
  fetchUser: fn(() => ({ id: 'u_1', name: 'Ada' }))
}));

const { fetchUser } = require('../src/api');

test('captures a stable UI contract', () => {
  const user = fetchUser();
  expect(fetchUser).toHaveBeenCalledTimes(1);
  expect(user).toMatchSnapshot();
});
```

Available globals:

- `fn(...)`
- `spyOn(object, methodName)`
- `mock(moduleId, factoryOrExports)`
- `unmock(moduleId)`
- `clearAllMocks()`
- `resetAllMocks()`
- `restoreAllMocks()`
- `expect(value).toMatchSnapshot()`

## Intent Syntax

Themis supports a strict code-native intent DSL:

```js
intent('user can sign in', ({ context, run, verify, cleanup }) => {
  context('a valid user', (ctx) => {
    ctx.user = { email: 'a@b.com', password: 'pw' };
  });

  run('the user submits credentials', (ctx) => {
    ctx.result = { ok: true };
  });

  verify('authentication succeeds', (ctx) => {
    expect(ctx.result.ok).toBe(true);
  });

  cleanup('remove test state', (ctx) => {
    delete ctx.user;
  });
});
```

Preferred phase names are `context`, `run`, `verify`, `cleanup`.
Legacy aliases are still supported (`arrange/act/assert`, `given/when/then`, `setup/infer/teardown`).
Easter egg aliases are also available: `cook`, `yeet`, `vibecheck`, `wipe`.

## Config

`themis.config.json`

```json
{
  "testDir": "tests",
  "testRegex": "\\.(test|spec)\\.(js|jsx|ts|tsx)$",
  "maxWorkers": 7,
  "reporter": "next",
  "environment": "node",
  "setupFiles": ["tests/setup.ts"],
  "tsconfigPath": "tsconfig.json"
}
```

Modern JS/TS projects can opt into `environment: "jsdom"` for DOM-driven tests and `setupFiles` for hooks, polyfills, or harness bootstrapping.

## TypeScript

The package ships first-party typings for:

- programmatic APIs (`collectAndRun`, `runTests`, config helpers)
- global test APIs (`describe`, `test`, `intent`, hooks, `expect`)
- typed intent context (`intent<MyCtx>(...)`)
- project-aware module loading for `ts`, `tsx`, ESM `js`, `jsx`, `tsconfig` path aliases, and setup files

Themis is designed to feel native in modern TypeScript projects without requiring a separate Babel or ts-node setup just to run tests.

Use the global types in your project with:

```json
{
  "compilerOptions": {
    "types": ["@vitronai/themis/globals"]
  }
}
```

## Benchmark

```bash
npm run benchmark
npm run benchmark:gate
```

Optional env vars:

- `BENCH_FILES` (default `40`)
- `BENCH_TESTS_PER_FILE` (default `25`)
- `BENCH_REPEATS` (default `3`)
- `BENCH_WORKERS` (default `4`)
- `BENCH_INCLUDE_EXTERNAL=1` to include Jest/Vitest/Bun comparisons
- `BENCH_MAX_AVG_MS` to override the gate threshold
- `BENCH_GATE_CONFIG` to point `benchmark:gate` at a custom config file

The benchmark always runs Themis and will include Jest/Vitest/Bun only when they are available locally.
The default gate profile and threshold live in `benchmark-gate.json`.

## Publish Readiness

Before publishing a release:

```bash
npm run validate
npm run pack:check
```

The npm package should ship a clean CLI, first-party typings, schemas, docs, and report assets.
