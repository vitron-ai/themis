# Themis VS Code Extension

This extension is the editor-side companion for Themis.

Current MVP features:

- view the latest Themis summary in a sidebar
- list current failures and jump into the source file
- rerun the suite
- rerun failed tests
- accept reviewed contract drift with `Themis: Update Contracts`
- rerun migration codemods with `Themis: Run Migration Codemods`
- open `.themis/report.html` inside a VS Code webview
- auto-refresh when `.themis/*` artifacts change

## Local Development

1. Open the repository in VS Code.
2. Run `Developer: Install Extension from Location...`
3. Choose `packages/themis-vscode`

Or launch it as an extension development host by pointing VS Code at this folder as the extension development path.

## Commands

- `Themis: Run Tests`
- `Themis: Rerun Failed`
- `Themis: Open HTML Report`
- `Themis: Update Contracts`
- `Themis: Run Migration Codemods`
- `Themis: Refresh Results`

## Expected Artifacts

The extension reads:

- `.themis/last-run.json`
- `.themis/failed-tests.json`
- `.themis/run-diff.json`
- `.themis/contract-diff.json`
- `.themis/migration-report.json`
- `.themis/report.html`

It does not reimplement Themis runtime logic. The CLI and artifacts remain the source of truth.
