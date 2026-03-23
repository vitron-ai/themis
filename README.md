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
- [Mocks And UI Primitives](#mocks-and-ui-primitives)
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
- Structured contract workflows instead of opaque snapshot files
- Incremental migration path from Jest/Vitest without rewriting everything on day one
- AI verdict engine for human triage and machine automation

## Modern JS/TS Support

Themis is built for modern Node.js and TypeScript projects:

- `.js`, `.jsx`, `.ts`, and `.tsx` support
- ESM `.js` loading in `type: "module"` projects
- `tsconfig` path alias resolution
- `node` and `jsdom` environments
- `setupFiles` for harness bootstrapping
- `testIgnore` patterns for deterministic discovery boundaries
- first-party mocks, spies, and deterministic UI primitives
- compatibility imports for `@jest/globals`, `vitest`, and `@testing-library/react`
- `--watch`, `--rerun-failed`, `--isolation in-process`, and `--cache` for tight local and agent rerun loops

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
npx themis test --watch --isolation in-process --cache --reporter next
```

Incrementally migrate existing Jest/Vitest suites:

```bash
npx themis migrate jest
npx themis migrate jest --rewrite-imports
npx themis test
```

## Code Scan

Themis can scan your JS/TS source tree and generate deterministic unit-layer tests for exported modules, React components, React hooks, Next app components, Next route handlers, generic route handlers, and Node services:

```bash
npx themis generate src
npx themis test
```

Generated files land under `tests/generated` by default. Each generated test:

- checks the scanned export names when Themis can resolve them exactly
- asserts the normalized runtime export contract directly in generated source
- adds scenario adapters for React components/hooks, Next app/router files, route handlers, and service functions when Themis can infer or read useful inputs
- captures React interaction and hook state-transition contracts when event handlers or stateful methods are available
- asserts DOM-state and behavioral flow contracts directly for generated React and Next component adapters
- emits async behavioral flow contracts for generated React and Next component adapters when flow plans are inferred or hinted, including richer inferred input/submit/loading/success paths for common async forms
- supports provider-driven DOM flow contracts for empty, disabled, retry, error, and recovery states with attribute- and role-aware assertions
- fails with a regeneration hint when the source drifts after the scan

Themis also supports per-file generation hints with sidecars like `src/components/Button.themis.json` so humans and agents can provide props, component flows, args, route requests, and route context. When those sidecars do not exist yet, `--write-hints` can scaffold them automatically from the current source analysis.

This is the core alternative to snapshot-driven testing: generated and hand-written tests assert normalized contracts in readable source, so diffs stay reviewable and updates stay intentional.

For repo-wide generation defaults, add `themis.generate.js` or `themis.generate.cjs` at the project root. Providers in that file can match source paths, supply shared props/args/flow plans, register runtime mocks for generated UI scenarios, and wrap generated component renders so generated DOM contracts run inside the same provider shells humans use in app tests. Providers can also declare preset wrapper metadata for router, Next navigation, auth/session shells, React Query, Zustand, and Redux-style app state patterns, including route history/state, query status, auth permissions, and store selector/action metadata.

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

Local test loops can also opt into a zero-IPC execution path:

- `npx themis test --isolation in-process`: executes suites in-process instead of worker mode
- `npx themis test --watch --isolation in-process --cache`: keeps a fast local rerun loop with file-level result caching
- `npx themis test --isolation worker`: keeps process isolation for CI or global-heavy suites

When generated tests fail, Themis also writes:

- `.themis/fix-handoff.json`: a deduped failure-to-fix artifact that maps generated failures back to source files, categories, repair strategies, candidate files, and remediation commands

Migration scaffolds also write:

- `.themis/migration-report.json`: a machine-readable inventory of detected Jest/Vitest compatibility imports and recommended next actions
- `themis.compat.js`: an optional local compatibility bridge used by `themis migrate --rewrite-imports`

## Why Themis

See [`docs/why-themis.md`](docs/why-themis.md) for positioning, differentiators, and community messaging.

Short version:

- Themis aims to deliver the benefits people reach for in snapshots, without snapshot rot.
- Prefer explicit, normalized contracts over broad output dumps.
- Keep changes reviewable through source assertions, machine-readable artifacts, and diff-oriented rerun workflows.

## Reference Docs

- API reference: [`docs/api.md`](docs/api.md)
- Migration guide: [`docs/migration.md`](docs/migration.md)
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
- Contract diff schema: [`docs/schemas/contract-diff.v1.json`](docs/schemas/contract-diff.v1.json)
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
- `npx themis migrate jest`: scaffolds a Themis config/setup bridge for existing Jest suites.
- `npx themis migrate jest --rewrite-imports`: rewrites matched Jest/Vitest/Testing Library imports to a local `themis.compat.js` bridge file.
- `npx themis migrate jest --convert`: applies codemods for common Jest/Vitest matcher/import patterns so suites move closer to native Themis style.
- `npx themis migrate vitest`: scaffolds the same bridge for Vitest suites.
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
- `npx themis test --watch --isolation in-process --cache`: runs a zero-IPC cached local loop for fast edit/rerun cycles.
- `npx themis test --workers 8`: overrides worker count (positive integer).
- `npx themis test --isolation in-process`: runs test files in-process instead of worker processes.
- `npx themis test --cache`: enables file-level result caching for in-process local loops.
- `npx themis test --environment jsdom`: runs tests in a browser-like DOM environment.
- `npx themis test --stability 3`: runs the suite three times and classifies each test as `stable_pass`, `stable_fail`, or `unstable`.
- `npx themis test --match "intent DSL"`: runs only tests whose full name matches regex.
- `npx themis test --rerun-failed`: reruns failing tests from `.themis/failed-tests.json`.
- `npx themis test --update-contracts --match "suite > case"`: accepts reviewed `captureContract(...)` changes for a narrow slice of the suite.
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
- `migration-report.json`: compatibility inventory and next actions for migrated Jest/Vitest suites.
- `contract-diff.json`: contract capture drift, updates, and update commands for `captureContract(...)` workflows.
- `themis.compat.js`: optional local compat bridge for rewritten migration imports.
- `report.html`: interactive HTML verdict report.

`--agent` output includes deterministic failure fingerprints, grouped `analysis.failureClusters`, stability classifications, previous-run comparison data, and a direct pointer to `.themis/fix-handoff.json` so AI agents can jump from generated failures to exact regeneration commands. Fix handoff entries also carry repair strategies, candidate files, and autofix commands for tighter failure-to-fix loops.

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

## Mocks And UI Primitives

Themis now ships first-party test utilities for agent-generated tests:

```js
mock('../src/api', () => ({
  fetchUser: fn(() => ({ id: 'u_1', name: 'Ada' }))
}));

const { fetchUser } = require('../src/api');

test('captures a stable UI contract', () => {
  const user = fetchUser();
  expect(fetchUser).toHaveBeenCalledTimes(1);
  expect(user).toMatchObject({ id: 'u_1', name: 'Ada' });
});
```

Contract capture for reviewable baselines:

```js
test('captures a stable response contract', () => {
  const payload = {
    status: 'ok',
    flags: ['fast', 'deterministic']
  };

  captureContract('status payload', payload);
  expect(payload.status).toBe('ok');
});
```

Themis intentionally avoids first-party snapshot-file workflows. Prefer direct assertions, generated contract tests, and explicit flow expectations over large opaque snapshots. The goal is comparable baseline coverage with better reviewability: normalized contracts, focused assertions, machine-readable artifacts, and intentional updates instead of broad snapshot re-acceptance.

Available globals:

- `fn(...)`
- `spyOn(object, methodName)`
- `mock(moduleId, factoryOrExports)`
- `unmock(moduleId)`
- `clearAllMocks()`
- `resetAllMocks()`
- `restoreAllMocks()`

For UI-oriented `jsdom` tests, Themis also ships a lightweight DOM layer:

- `render(ui)`
- `screen.getByText(...)`
- `screen.getByRole(...)`
- `screen.getByLabelText(...)`
- `fireEvent.click/change/input/submit/keyDown(...)`
- `waitFor(asyncAssertion)`
- `cleanup()`
- `useFakeTimers()`, `advanceTimersByTime(ms)`, `runAllTimers()`, `useRealTimers()`
- `flushMicrotasks()`
- `mockFetch(...)`, `resetFetchMocks()`, `restoreFetch()`

Example:

```tsx
test('submits the form', async () => {
  render(<button onClick={() => document.body.setAttribute('data-state', 'sent')}>Send</button>);

  fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  await waitFor(() => {
    expect(document.body).toHaveAttribute('data-state', 'sent');
  });
});
```

Network and async example:

```ts
test('loads api state deterministically', async () => {
  useFakeTimers();
  const fetchMock = mockFetch({ json: { ok: true } });

  let done = false;
  setTimeout(async () => {
    const response = await fetch('/api/status');
    const payload = await response.json();
    done = payload.ok;
  }, 50);

  advanceTimersByTime(50);
  await flushMicrotasks();

  expect(done).toBe(true);
  expect(fetchMock).toHaveBeenCalled();
  useRealTimers();
  restoreFetch();
});
```

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
  "tsconfigPath": "tsconfig.json",
  "testIgnore": ["^tests/generated(?:/|$)"]
}
```

Modern JS/TS projects can opt into `environment: "jsdom"` for DOM-driven tests and `setupFiles` for hooks, polyfills, or harness bootstrapping.
Use `testIgnore` when you need local generated output, fixture folders, or scratch suites to stay out of the default discovery pass.

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
