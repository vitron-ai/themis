# Release Checklist

This checklist tracks the release work for Themis `0.1.0` and future stable milestone cuts.

## Documentation polish

- confirm README, API reference, and VS Code docs clearly describe the stable story
- publish [`docs/showcases.md`](docs/showcases.md) with migration/comparison examples
- surface release expectations in [`docs/release-policy.md`](docs/release-policy.md)
- link to this checklist from the release policy and README so the team knows the remaining steps

## Gates & proof

- `npm test`
- `npm run typecheck`
- `npm run benchmark`
- `npm run benchmark:gate`
- verify `.themis/benchmark-last.json` and `.themis/migration-proof.json` are up to date

## Release actions

- confirm the release version (current target `0.1.0`)
- bump `package.json` and `packages/themis-vscode/package.json`
- update `docs/api.md` version header
- run `npm pack` / `npm publish --dry-run` if publishing
- tag `v0.1.0` and push the tag
- update the changelog/release notes for the stable release
- announce `0.1.0` with the improved story and benchmarks
