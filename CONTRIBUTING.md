# Contributing

Thanks for contributing to Themis.

## Before You Start

- Open an issue before large feature work or breaking API changes.
- Keep changes focused. Avoid mixing product, refactor, and release work in one PR.
- Prefer behavior coverage over broad speculative refactors.

## Project Positioning

Themis is positioned as:

- the best unit test framework for AI agents in Node.js and TypeScript
- an AI verdict engine for human and agent review loops
- a contract-first alternative to snapshot-heavy test maintenance
- an incremental migration path from Jest/Vitest to native Themis contracts

Keep public-facing changes aligned with that framing. Avoid language that makes the project sound like a throwaway prototype when the change is meant for users.

## Local Setup

```bash
npm install
```

Recommended environment:

- Node.js 18 or 20
- npm

## Validation

Run the full quality bar before opening a PR:

```bash
npm run validate
npm run pack:check
```

This command runs:

- `npm test`
- `npm run typecheck`
- `npm run benchmark:gate`

And `npm run pack:check` previews the npm publish payload.

For targeted local work, the most useful commands are:

- `npm test`
- `npm run typecheck`
- `npm run benchmark:gate`

## Contribution Rules

- Keep public API and CLI changes documented in `README.md` and `docs/api.md`.
- Keep positioning and messaging changes synchronized across `README.md`, `docs/why-themis.md`, and publish-facing copy.
- Keep schema changes synchronized with:
  - runtime emitters (`src/reporter.js`, `src/artifacts.js`)
  - schema files under `docs/schemas/`
  - schema contract tests in `tests/schema-contract.test.js`
- Add or update tests for every behavior change.
- Record user-facing changes in `CHANGELOG.md`.
- Keep changes deterministic. Do not add network dependence, unstable clocks, or randomness to tests without normalization or mocks.
- For runner, reporter, or runtime changes, do not bypass the benchmark gate without measured evidence.

## Tests

- Use `intent(...)` for behavior and workflow coverage.
- Use `test(...)` for low-level unit checks.
- Prefer integration-style coverage for CLI/runtime behavior.
- Cover both success and failure paths for new behavior.
- When artifact payloads or schemas change, update the corresponding docs, emitters, and contract tests together.

## Pull Requests

- Include a short summary of behavioral changes.
- Include validation command results.
- Call out any breaking changes explicitly.
- Mention any artifact, schema, or CLI contract changes clearly.

## Release Notes

If your change affects users, update the changelog entry under `Unreleased`.
