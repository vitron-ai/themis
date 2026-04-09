# Changelog

All notable changes to this project are documented in this file.

## Unreleased

## 1.2.0 - 2026-04-08

### Added

- **Claude Code one-command adoption.** New `npx themis init --claude-code` flag installs everything Claude Code needs to drive Themis natively: a `CLAUDE.md` at the repo root, a Claude Code skill at `.claude/skills/themis/SKILL.md` that auto-loads when the user asks Claude to write, run, fix, or migrate tests, and four slash commands (`/themis-test`, `/themis-generate`, `/themis-migrate`, `/themis-fix`) wired to the agent-readable test loop. Composes with `--agents` so a single `init --agents --claude-code` installs both bundles. Idempotent: re-running appends to an existing `CLAUDE.md` only when the Themis section is missing, and skips skill/command files that already exist.
- **Claude Code `PostToolUse` hook wrapper** at `scripts/claude-hook.js`. Reads tool input from stdin, filters non-source edits and edits inside `.themis/`, `__themis__/`, `node_modules/`, `.git/`, prefers `--rerun-failed` when a prior failed-tests artifact exists, and surfaces failures via stderr + exit 2 so Claude Code feeds the structured `failures[].cluster` and `failures[].repairHints` payload directly back into the model. Disable with `THEMIS_HOOK_DISABLED=1`. Opt-in only — not installed by `init --claude-code`. See [Claude Code one-command setup](docs/agents-adoption.md#claude-code-one-command-setup) for the `.claude/settings.json` recipe.
- New downstream templates under `templates/`: `CLAUDE.themis.md`, `claude-skill/SKILL.md`, and `claude-commands/{themis-test,themis-generate,themis-migrate,themis-fix}.md`. All ship in the npm tarball.
- New `--claude` alias for `--claude-code`.

### Changed

- **Repositioned README and `package.json` description** to lead with the job-to-be-done (a Node/TS unit test framework designed for AI coding agents — drop-in alternative to Jest and Vitest) instead of the philosophy ("intent-first ... for AI agents"), which read ambiguously as "tests AI agents". The five-bullet value prop now sits above the fold with the benchmark numbers, and Claude Code, Cursor, and Codex are named explicitly in the agent-output bullet.
- `runInit` now returns `{ agents, claudeCode }` instead of a single `{ path, created }` object so both flags can report independently. Existing `--agents` CLI output strings are preserved exactly.

### Documentation

- Added a "Claude Code One-Command Setup" section to `docs/agents-adoption.md` listing every file `init --claude-code` installs and explaining why the agent reporter loop matters.
- Added an "Optional: Wire Themis Into Claude Code's Edit Loop With A Hook" section with the `.claude/settings.json` snippet, plain-English explanation of the wrapper's three behaviors, and trade-offs (wall-clock cost, hook security, two ways to disable).
- README quickstart now includes a one-paragraph "Using Claude Code?" callout linking to the adoption guide.

### Tests

- Added `tests/claude-hook.test.js` with six tests covering `THEMIS_HOOK_DISABLED`, empty/invalid stdin, non-source extensions, ignored directories, real-source-edit-with-green-suite (end-to-end via in-tempdir shim), and real-source-edit-with-red-suite (exit 2 + stderr payload assertion).
- Extended `tests/cli-output.test.js` with three tests for `init --claude-code`: happy-path install, append-then-idempotent on existing `CLAUDE.md`, and composed `--agents --claude-code`.

## 0.1.15 - 2026-03-27

- Added a direct in-sidebar `Quick Actions` group plus an `Artifact Files` drawer to the in-repo VS Code extension scaffold so core Themis commands and raw artifact navigation remain reachable even when the VS Code view toolbar overflows.
- Improved `themis generate` onboarding and error guidance so downstream docs/templates now refer to `npx themis generate <source-root>`, and missing `src/` targets surface corrective suggestions for likely repo layouts such as `app/`, `pages/`, or repo-root scans.

## 0.1.14 - 2026-03-27

- Added first-party `npx themis test --fix` support so generated-test repair loops can apply fix-handoff autofixes, tighten hints when needed, and rerun the suite directly from the CLI.
- Moved the generated contract runtime into the npm package (`@vitronai/themis/contract-runtime`), stopped `init` from creating `tests/example.test.js`, taught generated tests to emit `.generated.test.ts` for TS/TSX sources, and made `init` / `migrate` add `.themis/` to downstream `.gitignore`.
- Reorganized framework-managed artifacts under `.themis/` into subdirectories like `.themis/runs/`, `.themis/diffs/`, `.themis/generate/`, `.themis/reports/`, `.themis/migration/`, and `.themis/benchmarks/` so volatile output stays bundled but easier to navigate.
- Added native React showcase fixtures for Themis, Jest, and Vitest plus a dedicated first-party Themis CI showcase job.
- Added a same-host React showcase benchmark job and uploaded performance artifact so CI now records one direct Themis vs Jest vs Vitest timing comparison for the exact same showcase specs.
- Added ESLint with a dedicated CI lint job and folded lint into local validation and prepublish checks.
- Generated `.generated.test.ts` output now typechecks cleanly under strict TypeScript without requiring downstream `types` overrides, and the packaged `@vitronai/themis/contract-runtime` surface now ships first-party type declarations.
- Refined the in-repo VS Code extension scaffold with judge-only branding assets, semantic Themis review colors, and a themed HTML report webview shell so artifact review inside VS Code reads like the rest of the product.

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
- Added a zero IPC `--isolation in-process` test mode plus `--cache` for faster local rerun loops and in-process watch execution.
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
