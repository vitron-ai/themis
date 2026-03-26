# Release Policy

This document defines release expectations for Themis.

## Current Stage

Current line: `0.1.x`

Stable means:

- the core CLI, artifact, and JS/TS package shape are the public contract
- compatibility remains a deliberate goal across stable patch releases
- breaking changes require intentional version bumps and migration notes

## Versioning Model

Themis follows semantic versioning:

- `0.1.0-alpha.N`: unstable early pre-release
- `0.1.0-beta.N`: pre-release with mostly stable product shape
- `0.1.0`: first stable contract baseline
- `0.1.x`: backward-compatible fixes and minor enhancements
- `0.2.0+`: intentional breaking changes with migration notes

## Compatibility Rules During Stable

- CLI flags should remain stable unless a clear product issue requires change.
- Programmatic API should prefer additive changes over renames or removals.
- Payload schemas keep explicit `schema` identifiers (`themis.agent.result.v1`, `themis.failures.v1`).
- If schema behavior changes in a breaking way, schema ID must bump.

## Deprecation Policy

- New deprecations are documented in `CHANGELOG.md`.
- Deprecated APIs should keep at least one stable release cycle before removal when practical.
- Meme aliases can be disabled any time with `--no-memes`; strict environments should use this flag.

## Quality Gates

Before publishing:

- `npm test`
- `npm run typecheck`
- `npm run benchmark`
- `npm run benchmark:gate`

## Publishing Policy

- Publish target: npm public package `@vitronai/themis`.
- Required metadata: license, repository, bugs URL, homepage.
- Recommended command:

```bash
npm publish --access public
```
