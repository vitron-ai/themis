# Publish Guide

This guide covers publishing Themis to npm.

## Preconditions

- npm account has publish access for scope `@vitronai`
- you are logged in (`npm login`)
- working tree is clean
- quality checks pass

## Release Checklist

1. Update version in `package.json` (`npm version ...`).
2. Update `CHANGELOG.md`.
3. Confirm the public messaging still matches the project:
   - best-in-class unit test framework for AI agents in Node.js and TypeScript
   - AI verdict engine for human and agent review loops
4. Run:

```bash
npm run validate
npm run pack:check
```

5. Review publish payload:

```bash
npm pack --dry-run
tar -tf vitronai-themis-*.tgz
```

6. Publish:

```bash
npm publish --access public
```

## Post Publish

Verify installation:

```bash
npx @vitronai/themis test --help
```

If needed, deprecate a release:

```bash
npm deprecate @vitronai/themis@<version> "<message>"
```

## VS Code Extension

The scaffold under `packages/themis-vscode` is a separate release surface. It does not ship in the npm tarball and can be published later on its own schedule.
