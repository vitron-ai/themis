# Release Policy

This document defines release expectations for Themis.

## Current Stage

Current line: `0.1.0-beta.x` (preparing for `0.1.0`)

Beta means:

- the core CLI, artifact, and JS/TS package shape should be considered mostly stable
- compatibility remains a deliberate goal across beta builds
- breaking changes are still possible, but they should be uncommon and called out clearly

We are currently finishing a release-candidate sprint toward `0.1.0`. Follow [`docs/release-checklist.md`](docs/release-checklist.md) for the remaining sign-off items.

## Versioning Model

Themis follows semantic versioning semantics with pre-release tags:

- `0.1.0-alpha.N`: unstable early pre-release
- `0.1.0-beta.N`: pre-release with mostly stable product shape
- `0.1.0`: first stable contract baseline
- `0.1.x`: backward-compatible fixes and minor enhancements
- `0.2.0+`: intentional breaking changes with migration notes

## Compatibility Rules During Beta

- CLI flags should remain stable unless a clear product issue requires change.
- Programmatic API should prefer additive changes over renames or removals.
- Payload schemas keep explicit `schema` identifiers (`themis.agent.result.v1`, `themis.failures.v1`).
- If schema behavior changes in a breaking way, schema ID must bump.

## Deprecation Policy

- New deprecations are documented in `CHANGELOG.md`.
- Deprecated APIs should keep at least one pre-release cycle before removal when practical.
- Meme aliases can be disabled any time with `--no-memes`; strict environments should use this flag.

## Quality Gates

Before publishing:

- `npm test`
- `npm run typecheck`
- `npm run benchmark`
- `npm run benchmark:gate`

Additional release prep steps are tracked in [`docs/release-checklist.md`](docs/release-checklist.md).

## Publishing Policy

- Publish target: npm public package `@vitronai/themis`.
- Required metadata: license, repository, bugs URL, homepage.
- Recommended command:

```bash
npm publish --access public
```
