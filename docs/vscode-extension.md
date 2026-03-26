# VS Code Extension

Themis includes an in-repo VS Code extension scaffold at [`packages/themis-vscode`](../packages/themis-vscode).

This is the intended shape of the editor UX:

- a Themis activity-bar container
- a results sidebar driven by `.themis/**` artifacts
- commands to run tests, rerun failures, refresh results, and open the HTML report
- commands to accept reviewed contract baselines and rerun migration codemods
- failure navigation that jumps from artifact data into the source file
- generated-review navigation for source files, generated tests, hint sidecars, and backlog items
- contract-review and migration-review groups driven by `.themis/diffs/contract-diff.json` and `.themis/migration/migration-report.json`

## Current MVP Scope

The scaffold currently supports:

- reading `.themis/runs/last-run.json`
- reading `.themis/runs/failed-tests.json`
- reading `.themis/diffs/run-diff.json`
- reading `.themis/diffs/contract-diff.json`
- reading `.themis/migration/migration-report.json`
- reading `.themis/generate/generate-last.json`
- reading `.themis/generate/generate-map.json`
- reading `.themis/generate/generate-backlog.json`
- opening `.themis/reports/report.html` in a webview
- surfacing generated source/test/hint mappings in the sidebar
- surfacing unresolved generate backlog and gate state in the sidebar
- refreshing when `.themis/**` files change

The extension is intentionally thin. It shells out to Themis commands and treats the CLI plus artifacts as the canonical contract.

Current command surface:

- `Themis: Run Tests`
- `Themis: Rerun Failed`
- `Themis: Update Contracts`
- `Themis: Run Migration Codemods`
- `Themis: Open HTML Report`
- `Themis: Refresh Results`

## Local Development

Open the repository in VS Code and use an Extension Development Host pointed at:

`packages/themis-vscode`

The extension does not need marketplace publishing to be exercised locally.

## Publishing Later

When you decide to publish:

1. create a VS Code publisher
2. package the extension under `packages/themis-vscode`
3. publish it separately from the npm package

The npm package and the VS Code extension should version together, but they do not need to ship from the same registry.
