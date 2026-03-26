# Why Themis

Themis is built for AI-era testing loops where humans and agents both need reliable signals, fast reruns, and machine-readable context.

The core positioning is simple:

- The best unit test framework for AI agents in Node.js and TypeScript
- An AI verdict engine for human and agent review loops
- A contract-first alternative to snapshot-heavy test maintenance

The adoption path should stay obvious:

```bash
npm install -D @vitronai/themis
npx themis init
npx themis generate src
npx themis test
```

`npx themis init` adds `.themis/` to `.gitignore`, and `npx themis generate src` emits `.generated.test.ts` for TS/TSX sources and `.generated.test.js` for JS/JSX sources.

For downstream repo instructions and a copyable `AGENTS.md` template, see [`docs/agents-adoption.md`](agents-adoption.md).

## What "Next-Gen" Means Here

Next-gen is not styling. It means test infrastructure designed for:

- deterministic execution
- agent-native output contracts
- explicit intent modeling
- performance accountability

## Why It Can Be Best-in-Class

## 1) Intent-First Test Design

The `intent(...)` DSL makes behavior explicit through ordered phases:

- `context`
- `run`
- `verify`
- `cleanup`

This gives agents and humans a clearer semantic map than flat assertion blocks.
Legacy aliases (`arrange/act/assert`, `given/when/then`) remain available for compatibility.

## 2) Agent-Native Outputs

Themis supports structured outputs for tooling loops:

- `--json` for generic automation
- `--agent` for AI-agent workflows
- `.themis/runs/failed-tests.json` for deterministic reruns

## 3) Deterministic Rerun Workflow

`--rerun-failed`, `--watch`, and test-name filtering (`--match`) reduce iteration time and keep failure focus tight.

The fast local loop matters for AI-assisted editing too: `--watch --isolation in-process --cache` gives agents and humans a short edit-run-review cycle instead of full-suite friction.

## 4) Modern JS/TS Project Parity

Themis is built for current Node.js and TypeScript repos:

- `.js`, `.jsx`, `.ts`, `.tsx`
- ESM `.js` in `type: "module"` projects
- `tsconfig` path aliases
- `node` and `jsdom` environments
- `setupFiles` for project harness bootstrapping

## 5) Strong Runtime Guarantees

The runtime enforces intent ordering rules and clear phase-level failure annotation, reducing ambiguous failures.

## 6) TypeScript-Ready Without Runtime Tax

Themis keeps a lean JS runtime and ships first-party typings:

- package API types (`index.d.ts`)
- global test API types (`globals.d.ts`)
- typecheck lane (`npm run typecheck`)

## 7) First-Party Agent Loop Utilities

Themis ships workflow features agents can use directly:

- direct contract assertions instead of snapshot-file churn
- generated contract tests that keep baselines in readable source instead of opaque snapshot blobs
- machine-readable artifacts that let agents inspect and explain changes before updating tests
- mocks and spies with `fn`, `spyOn`, and `mock`
- `.themis/diffs/run-diff.json` and `.themis/runs/run-history.json`
- HTML verdict reports for human review

### Comparable To Snapshot Workflows, Without Snapshot Rot

Many teams use snapshots because they want cheap baseline capture, safe review, and easy updates. Themis should meet that need without copying the snapshot mechanism.

Themis favors:

- normalized contract assertions over broad serialized dumps
- readable generated tests over hidden `.snap` files
- field-level and behavior-level diffs over large text churn
- intentional regeneration and migration flows over blanket "accept all changes"

The result is comparable coverage value with clearer semantics for both humans and agents.

## 8) Migration Path From Jest And Vitest

Adoption does not need to be a rewrite.

Themis already supports:

- runtime compatibility for `@jest/globals`, `vitest`, and `@testing-library/react`
- `themis migrate <jest|vitest>` scaffolding for incremental adoption
- optional import rewriting to a local compatibility bridge

The strategic direction is clear: start with compatibility, then move suites toward native Themis contracts and intent-first tests as teams touch them.

## 9) Performance Discipline, Not Guesswork

Performance is measured and guarded:

- synthetic benchmark runner (`npm run benchmark`)
- regression gate (`npm run benchmark:gate`)
- threshold config (`benchmark-gate.json`)

## 10) CLI Designed for Humans and Machines

- high-signal human reporter (`--next`)
- strict machine reporter outputs (`--json`, `--agent`)
- branded banner for human mode only

## 11) Editor Surface Without Replacing The CLI

Themis includes a thin VS Code extension scaffold that reads `.themis/**` artifacts, reruns tests, and opens the HTML report. The CLI remains the source of truth.

## Proof Checklist

Run these to validate core claims:

```bash
npm test
npm run typecheck
npm run benchmark:gate
```

## Messaging for the Community

If you describe Themis publicly, use this framing:

- "The best unit test framework for AI agents in Node.js and TypeScript"
- "An AI verdict engine for human and agent review loops"
- "Intent-first testing with deterministic reruns and machine-readable artifacts"
- "A better alternative to snapshot-heavy workflows: explicit contracts, readable diffs, intentional updates"
- "JS-fast runtime with first-party TypeScript DX and benchmark-gated discipline"
