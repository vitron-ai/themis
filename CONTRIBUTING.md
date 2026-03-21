# Contributing

Thanks for contributing to Themis.

## Project Positioning

Themis is positioned as:

- the best unit test framework for AI agents in Node.js and TypeScript
- an AI verdict engine for human and agent review loops

Keep public-facing changes aligned with that framing. Avoid language that makes the project sound like a throwaway prototype when the change is meant for users.

## Local Setup

```bash
npm install
```

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

## Contribution Rules

- Keep public API and CLI changes documented in `README.md` and `docs/api.md`.
- Keep positioning and messaging changes synchronized across `README.md`, `docs/why-themis.md`, and publish-facing copy.
- Keep schema changes synchronized with:
  - runtime emitters (`src/reporter.js`, `src/artifacts.js`)
  - schema files under `docs/schemas/`
  - schema contract tests in `tests/schema-contract.test.js`
- Add or update tests for every behavior change.
- Record user-facing changes in `CHANGELOG.md`.

## Pull Requests

- Include a short summary of behavioral changes.
- Include validation command results.
- Call out any breaking changes explicitly.
