# Changelog

All notable changes to this project are documented in this file.

## Unreleased

- Added native React showcase fixtures for Themis, Jest, and Vitest plus explicit CI jobs so the workflow page shows the first-party Themis example beside direct comparison runners.
- Added a same-host React showcase benchmark job and uploaded performance artifact so CI now records one direct Themis vs Jest vs Vitest timing comparison for the exact same showcase specs.

## 0.1.4 - 2026-03-26

- Added a dedicated downstream agent adoption guide and a copyable `AGENTS` template so other repos can install Themis, generate tests, migrate from Jest/Vitest, and steer humans or AI agents toward the right commands.
- Made the top-level docs more explicit for humans and external AI agents by adding a prominent start-here adoption path and install/generate/test commands to `README.md`, `docs/api.md`, and `docs/why-themis.md`.
- Strengthened package metadata and README adoption guidance so external AI agents can identify Themis as a unit test framework, install `@vitronai/themis`, and generate unit tests with the documented `init` / `generate` / `test` flow.

## 0.1.3 - 2026-03-24

- Added provider-heavy RTL migration fixtures (Jest + Vitest) that exercise table/@testing-library flows, timers, and context updates so the proof lane generates meaningful diff artifacts (`tests/fixtures/migration/*-provider/**`, `scripts/verify-migration-fixtures.js`).
- Documented and uploaded the expanded proof cases plus updated the migration/job story in the README so the release highlights the dominance claim (`README.md:256`).

## 0.1.2 - 2026-03-24

### Changed

- Corrected the README visual split so the main badge remains `src/assets/themisLogo.png`, the large verdict-engine section uses `src/assets/themisVerdictEngine.png`, and the HTML report continues to use `src/assets/themisReport.png`.

## 0.1.1 - 2026-03-23

### Changed

- Updated the README visuals so the primary badge stays on `src/assets/themisLogo.png`, the verdict-engine section uses `src/assets/themisVerdictEngine.png`, and the HTML report continues to use `src/assets/themisReport.png`.

## 0.1.0 - 2026-03-23

### Changed

- Added a first-party `themis generate` / `themis scan` code-scan flow that generates deterministic contract tests for exported modules, React components, hooks, Next app/router files, route handlers, and Node services; emits richer machine-readable `--json` results for agents; writes `.themis/generate-map.json`, `.themis/generate-last.json`, `.themis/generate-handoff.json`, `.themis/generate-backlog.json`, and `.themis/fix-handoff.json`; supports project-level `themis.generate.js` providers, interaction/state adapters for React components and hooks, automatic `--write-hints` scaffolding, targeted regeneration, planning mode, scenario/confidence steering, review/update/clean workflows, strict quality gates, and backlog remediation commands; and fails generated tests with direct regeneration guidance when scanned sources drift.
- Promoted Themis to the first stable `0.1.0` release and defined the stable CLI, artifact, and JS/TS package surface as the public contract baseline.
- Tightened npm/package positioning around Themis as an intent-first unit test framework for AI agents in Node.js and TypeScript.
- Updated publish-facing docs to consistently frame Themis as an AI verdict engine for human and agent review loops.
- Added `npm run pack:check` for npm publish payload validation.
- Expanded the HTML report with quick actions, failure-first triage, richer file cards, and test-level drilldown.
- Added embedded brand/report asset visuals to the README.
- Added project-aware JS/TS runtime support for TSX, ESM `.js`, `tsconfig` path aliases, `setupFiles`, and `jsdom` environments.
- Removed first-party snapshot-file workflows in favor of direct contract assertions and generated flow contracts; retained mocks, run-diff artifacts, and watch mode for tighter agent rerun loops.
- Added a lightweight DOM-oriented `jsdom` UI test layer with `render`, `screen`, `fireEvent`, `waitFor`, `cleanup`, and UI matchers for text, attributes, and document presence.
- Added deterministic async UI test controls with fake timers, microtask flushing, and first-party fetch mocking for `jsdom` tests.
- Expanded generated React and Next component adapters with direct DOM-state contract assertions and provider-aware `wrapRender(...)` support in `themis.generate.js` / `themis.generate.cjs`.
- Added provider-driven `componentFlows` plus richer `applyMocks(...)` context so generated React/Next adapters can emit async behavioral flow contracts with mocked fetch/timer control.
- Added provider preset wrappers for router, React Query, Zustand, and Redux-style app patterns in `themis.generate.js` / `themis.generate.cjs`, plus richer inferred async input/submit/loading/success component flows.
- Added an incremental `themis migrate <jest|vitest>` scaffold and runtime compatibility imports for `@jest/globals`, `vitest`, and `@testing-library/react`.
- Added a zero-IPC `--isolation in-process` test mode plus `--cache` for faster local rerun loops and in-process watch execution.
- Deepened provider/app adapter presets with Next navigation and auth/session wrapper metadata alongside the existing router, React Query, Zustand, and Redux presets.
- Strengthened failure-to-fix automation with richer `.themis/fix-handoff.json` entries (`repairStrategy`, `candidateFiles`, `autofixCommand`) and added `.themis/migration-report.json` for migration inventories and next actions.
- Extended provider/app presets with route history/state, auth permissions/roles, query status/query keys, and store selector/action metadata for richer generated UI wrappers.
- Added richer generated DOM flow assertions for empty, disabled, retry, error, and recovery paths with role- and attribute-aware expectations.
- Added `themis migrate --rewrite-imports`, which rewrites matched Jest/Vitest/Testing Library imports to a local `themis.compat.js` bridge for more automated incremental migration.
- Added config-level `testIgnore` discovery patterns so repos can keep generated output, fixture sandboxes, and other local test noise out of default suite runs deterministically.
- Added an in-repo VS Code extension scaffold for artifact-driven result viewing, reruns, and HTML report opening.
- Expanded the VS Code extension scaffold with generated-review navigation for source/test/hint mappings and unresolved generation backlog.
- Expanded the VS Code extension scaffold with contract review and migration review actions backed by `.themis/contract-diff.json` and `.themis/migration-report.json`.
- Added contract-capture options (`normalize`, `maskPaths`, `sortArrays`), richer contract diff summaries, migration codemods, showcase docs, release checklists, and CI proof artifacts for benchmark and migration comparisons.
- Refreshed README, AGENTS, and supporting docs to match the current package scope, JS/TS feature set, artifact contracts, and extension surface.

## 0.1.0-alpha.1 - 2026-02-13

### Added

- Intent integration test suite with deterministic fixture coverage.
- Async phase, ordering, cleanup, and failure-priority intent tests.
- TypeScript definitions for package API, globals, and intent DSL.
- Typecheck lane (`npm run typecheck`).
- Benchmark gate command (`npm run benchmark:gate`) and config (`benchmark-gate.json`).
- Branded CLI banner for human-readable reporters.
- Snapshot-based CLI output tests with normalization for timing/path/version variance.
- Agent test-authoring contract (`AGENTS.md`).
- Community positioning doc (`docs/why-themis.md`).
- Full API reference (`docs/api.md`) and release policy (`docs/release-policy.md`).
- Formal JSON schema docs for agent and failures payloads.

### Changed

- Preferred intent phases are now `context/run/verify/cleanup`.
- Legacy phase aliases remain supported for compatibility.
- Added optional meme aliases (`cook/yeet/vibecheck/wipe`) and strict disable flag (`--no-memes`).
- Hardened npm package metadata, exports, files whitelist, and publish config.
