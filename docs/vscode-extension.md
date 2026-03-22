# VS Code Extension

Themis includes an in-repo VS Code extension scaffold at [`packages/themis-vscode`](../packages/themis-vscode).

This is the intended shape of the editor UX:

- a Themis activity-bar container
- a results sidebar driven by `.themis/*` artifacts
- commands to run tests, rerun failures, refresh results, and open the HTML report
- failure navigation that jumps from artifact data into the source file
- generated-review navigation for source files, generated tests, hint sidecars, and backlog items

## Current MVP Scope

The scaffold currently supports:

- reading `.themis/last-run.json`
- reading `.themis/failed-tests.json`
- reading `.themis/run-diff.json`
- reading `.themis/generate-last.json`
- reading `.themis/generate-map.json`
- reading `.themis/generate-backlog.json`
- opening `.themis/report.html` in a webview
- surfacing generated source/test/hint mappings in the sidebar
- surfacing unresolved generate backlog and gate state in the sidebar
- refreshing when `.themis/*` files change

The extension is intentionally thin. It shells out to Themis commands and treats the CLI plus artifacts as the canonical contract.

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
