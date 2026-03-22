# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Changed

- Added a first-party `themis generate` / `themis scan` code-scan flow that generates deterministic contract tests for exported modules, React components, hooks, Next app/router files, route handlers, and Node services; emits richer machine-readable `--json` results for agents; writes `.themis/generate-map.json`, `.themis/generate-last.json`, `.themis/generate-handoff.json`, `.themis/generate-backlog.json`, and `.themis/fix-handoff.json`; supports project-level `themis.generate.js` providers, interaction/state adapters for React components and hooks, automatic `--write-hints` scaffolding, targeted regeneration, planning mode, scenario/confidence steering, review/update/clean workflows, strict quality gates, and backlog remediation commands; and fails generated tests with direct regeneration guidance when scanned sources drift.
- Moved the package line from alpha to beta and defined beta compatibility expectations for CLI, artifacts, and the JS/TS package surface.
- Tightened npm/package positioning around Themis as an intent-first unit test framework for AI agents in Node.js and TypeScript.
- Updated publish-facing docs to consistently frame Themis as an AI verdict engine for human and agent review loops.
- Added `npm run pack:check` for npm publish payload validation.
- Expanded the HTML report with quick actions, failure-first triage, richer file cards, and test-level drilldown.
- Added embedded brand/report asset visuals to the README.
- Added project-aware JS/TS runtime support for TSX, ESM `.js`, `tsconfig` path aliases, `setupFiles`, and `jsdom` environments.
- Added first-party snapshots, mocks, run-diff artifacts, and watch mode for tighter agent rerun loops.
- Added a lightweight DOM-oriented `jsdom` UI test layer with `render`, `screen`, `fireEvent`, `waitFor`, `cleanup`, and UI matchers for text, attributes, and document presence.
- Added an in-repo VS Code extension scaffold for artifact-driven result viewing, reruns, and HTML report opening.
- Expanded the VS Code extension scaffold with generated-review navigation for source/test/hint mappings and unresolved generation backlog.
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
