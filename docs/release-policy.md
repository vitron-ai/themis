# Release Policy

This document defines release expectations for Themis.

## Current Stage

Current line: `0.1.0-alpha.x`

Alpha means:

- rapid iteration is expected
- APIs may change between alpha builds
- breaking changes are allowed with clear changelog notes

## Versioning Model

Themis follows semantic versioning semantics with pre-release tags:

- `0.1.0-alpha.N`: unstable pre-release
- `0.1.0`: first stable contract baseline
- `0.1.x`: backward-compatible fixes and minor enhancements
- `0.2.0+`: intentional breaking changes with migration notes

## Compatibility Rules During Alpha

- CLI flags may evolve.
- Programmatic API may evolve.
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
- `npm run benchmark:gate`

## Publishing Policy

- Publish target: npm public package `@vitron-ai/themis`.
- Required metadata: license, repository, bugs URL, homepage.
- Recommended command:

```bash
npm publish --access public
```
