const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { ARTIFACT_RELATIVE_PATHS } = require('../../../src/artifact-paths');
const { buildResultsTree, loadThemisWorkspaceState } = require('./core');

function activate(context) {
  const controller = new ThemisExtensionController(context);
  context.subscriptions.push(controller);
}

class ThemisExtensionController {
  constructor(context) {
    this.context = context;
    this.provider = new ThemisResultsProvider();
    this.terminals = new Map();
    this.watchers = [];
    this.reportPanel = null;
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = 'themis.runTests';
    this.statusBar.name = 'Themis';
    this.statusBar.tooltip = 'Run Themis tests';

    context.subscriptions.push(
      this.statusBar,
      vscode.window.registerTreeDataProvider('themis.results', this.provider),
      vscode.commands.registerCommand('themis.runTests', () => this.runConfiguredCommand('command', 'npx themis test')),
      vscode.commands.registerCommand('themis.rerunFailed', () => this.runConfiguredCommand('rerunFailedCommand', 'npx themis test --rerun-failed')),
      vscode.commands.registerCommand('themis.updateContracts', () => this.runConfiguredCommand('updateContractsCommand', 'npx themis test --update-contracts')),
      vscode.commands.registerCommand('themis.runMigrationCodemods', () => this.runMigrationCodemods()),
      vscode.commands.registerCommand('themis.openHtmlReport', () => this.openHtmlReport()),
      vscode.commands.registerCommand('themis.refreshResults', () => this.refresh()),
      vscode.commands.registerCommand('themis.openFailure', (location) => this.openFailure(location)),
      vscode.commands.registerCommand('themis.openArtifactFile', (location) => this.openFile(location)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.syncWorkspaceWatchers()),
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh())
    );

    this.syncWorkspaceWatchers();
    this.refresh();
  }

  dispose() {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];

    for (const terminal of this.terminals.values()) {
      terminal.dispose();
    }
    this.terminals.clear();

    if (this.reportPanel) {
      this.reportPanel.dispose();
      this.reportPanel = null;
    }
  }

  getActiveWorkspaceFolder() {
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length === 0) {
      return null;
    }

    const activeUri = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document
      ? vscode.window.activeTextEditor.document.uri
      : null;
    if (activeUri) {
      const activeFolder = vscode.workspace.getWorkspaceFolder(activeUri);
      if (activeFolder) {
        return activeFolder;
      }
    }

    return folders[0];
  }

  syncWorkspaceWatchers() {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];

    for (const folder of vscode.workspace.workspaceFolders || []) {
      const pattern = new vscode.RelativePattern(folder, '.themis/**');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(() => this.refresh());
      watcher.onDidChange(() => this.refresh());
      watcher.onDidDelete(() => this.refresh());
      this.watchers.push(watcher);
      this.context.subscriptions.push(watcher);
    }
  }

  refresh() {
    const folder = this.getActiveWorkspaceFolder();
    const workspaceRoot = folder ? folder.uri.fsPath : null;
    const state = loadThemisWorkspaceState(workspaceRoot);

    this.provider.setState(state);
    this.updateStatusBar(state);

    if (this.reportPanel && state.reportExists) {
      this.renderReportPanel(state.reportPath);
    }
  }

  updateStatusBar(state) {
    if (!state.hasWorkspace) {
      this.statusBar.text = '$(beaker) Themis';
      this.statusBar.tooltip = 'Open a workspace to use Themis.';
      this.statusBar.color = new vscode.ThemeColor('themis.color.muted');
      this.statusBar.backgroundColor = undefined;
      this.statusBar.show();
      return;
    }

    if (!state.hasArtifacts || !state.summary) {
      this.statusBar.text = '$(beaker) Themis: ready';
      this.statusBar.tooltip = 'Run Themis to generate artifacts.';
      this.statusBar.color = new vscode.ThemeColor('themis.color.insight');
      this.statusBar.backgroundColor = undefined;
      this.statusBar.show();
      return;
    }

    const icon = state.summary.failed > 0 ? 'error' : 'pass';
    this.statusBar.text = `$(${icon}) Themis ${state.summary.passed}/${state.summary.total}`;
    this.statusBar.tooltip = state.statusText;
    this.statusBar.color = new vscode.ThemeColor(state.summary.failed > 0 ? 'themis.color.fail' : 'themis.color.pass');
    this.statusBar.backgroundColor = undefined;
    this.statusBar.show();
  }

  runConfiguredCommand(settingName, fallbackCommand) {
    const folder = this.getActiveWorkspaceFolder();
    if (!folder) {
      vscode.window.showWarningMessage('Open a workspace before running Themis.');
      return;
    }

    const config = vscode.workspace.getConfiguration('themis', folder.uri);
    const command = String(config.get(settingName) || fallbackCommand).trim() || fallbackCommand;
    const terminal = this.getTerminal(folder, 'Themis');
    terminal.show(true);
    terminal.sendText(command, true);
  }

  runMigrationCodemods() {
    const folder = this.getActiveWorkspaceFolder();
    if (!folder) {
      vscode.window.showWarningMessage('Open a workspace before running Themis migration codemods.');
      return;
    }

    const state = loadThemisWorkspaceState(folder.uri.fsPath);
    const source = state.migration && state.migration.source
      ? state.migration.source
      : 'jest';
    const fallback = `npx themis migrate ${source} --convert`;
    this.runConfiguredCommand('migrationCommand', fallback);
  }

  getTerminal(folder, name) {
    const key = folder.uri.fsPath;
    const existing = this.terminals.get(key);
    if (existing) {
      return existing;
    }

    const terminal = vscode.window.createTerminal({
      name,
      cwd: folder.uri.fsPath
    });
    this.terminals.set(key, terminal);
    return terminal;
  }

  async openHtmlReport() {
    const folder = this.getActiveWorkspaceFolder();
    if (!folder) {
      vscode.window.showWarningMessage('Open a workspace before opening the Themis report.');
      return;
    }

    const state = loadThemisWorkspaceState(folder.uri.fsPath);
    if (!state.reportExists) {
      vscode.window.showInformationMessage(`No ${ARTIFACT_RELATIVE_PATHS.htmlReport} file found yet. Run \`npx themis test --reporter html\` first.`);
      return;
    }

    if (!this.reportPanel) {
      this.reportPanel = vscode.window.createWebviewPanel(
        'themis.report',
        'Themis Report',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(path.dirname(state.reportPath))]
        }
      );

      this.reportPanel.onDidDispose(() => {
        this.reportPanel = null;
      }, null, this.context.subscriptions);
    } else {
      this.reportPanel.reveal(vscode.ViewColumn.Beside, true);
      this.reportPanel.webview.options = {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.dirname(state.reportPath))]
      };
    }

    this.renderReportPanel(state.reportPath);
  }

  renderReportPanel(reportPath) {
    if (!this.reportPanel || !fs.existsSync(reportPath)) {
      return;
    }

    const rawHtml = fs.readFileSync(reportPath, 'utf8');
    this.reportPanel.webview.html = rewriteReportHtmlForWebview(this.reportPanel.webview, reportPath, rawHtml);
  }

  async openFailure(location) {
    return this.openFile(location);
  }

  async openFile(location) {
    if (!location || !location.filePath) {
      vscode.window.showInformationMessage('This failure does not include a source location.');
      return;
    }

    const uri = vscode.Uri.file(location.filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    const line = Math.max(0, Number(location.lineNumber || 1) - 1);
    const character = Math.max(0, Number(location.columnNumber || 1) - 1);
    const range = new vscode.Range(line, character, line, character);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }
}

class ThemisResultsProvider {
  constructor() {
    this.state = loadThemisWorkspaceState(null);
    this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  }

  setState(state) {
    this.state = state;
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    const descriptors = element ? element._children || [] : buildResultsTree(this.state);
    return descriptors.map((descriptor) => createTreeItem(descriptor));
  }
}

function createTreeItem(descriptor) {
  const collapsibleState = descriptor.children && descriptor.children.length > 0
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.None;
  const item = new vscode.TreeItem(descriptor.label, collapsibleState);
  item.id = descriptor.id;
  item.description = descriptor.description || '';
  item.tooltip = descriptor.tooltip || descriptor.label;
  item.contextValue = descriptor.kind || 'item';
  item._children = descriptor.children || [];

  if (descriptor.icon) {
    item.iconPath = descriptor.color
      ? new vscode.ThemeIcon(descriptor.icon, new vscode.ThemeColor(descriptor.color))
      : new vscode.ThemeIcon(descriptor.icon);
  }

  if (descriptor.command) {
    item.command = {
      command: descriptor.command.id,
      title: descriptor.label,
      arguments: descriptor.command.arguments || []
    };
  }

  return item;
}

function rewriteReportHtmlForWebview(webview, reportPath, html) {
  const reportDir = path.dirname(reportPath);
  const themedHtml = injectReportWebviewChrome(html, reportPath);

  return themedHtml.replace(/(src|href)=["']([^"']+)["']/g, (match, attribute, value) => {
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('#')) {
      return match;
    }

    const targetPath = path.resolve(reportDir, value);
    if (!fs.existsSync(targetPath)) {
      return match;
    }

    const webviewUri = webview.asWebviewUri(vscode.Uri.file(targetPath));
    return `${attribute}="${webviewUri}"`;
  });
}

function injectReportWebviewChrome(html, reportPath) {
  const reviewLabel = escapeHtml(path.basename(reportPath || 'report.html'));
  const themeStyles = `
  <style id="themis-webview-theme">
    :root {
      --themis-shell-bg: #08111b;
      --themis-shell-panel: rgba(9, 20, 31, 0.88);
      --themis-shell-border: rgba(92, 184, 216, 0.22);
      --themis-shell-ink: #eef5fb;
      --themis-shell-dim: #98a8b8;
      --themis-shell-pass: #4db889;
      --themis-shell-fail: #e26d5a;
      --themis-shell-review: #e3a23b;
      --themis-shell-insight: #5cb8d8;
      --bg-1: #08111b;
      --bg-2: #0f2130;
      --bg-3: #15394a;
      --ink: #eef5fb;
      --ink-dim: #9eb0bf;
      --panel: rgba(9, 20, 31, 0.78);
      --panel-border: rgba(92, 184, 216, 0.2);
      --pass: #4db889;
      --fail: #e26d5a;
      --skip: #e3a23b;
      --total: #5cb8d8;
      --accent: #e3a23b;
      --shadow: 0 24px 48px rgba(2, 8, 14, 0.52);
    }

    html {
      background:
        linear-gradient(180deg, rgba(6, 12, 18, 0.98), rgba(8, 17, 27, 1));
    }

    body.themis-webview-report {
      padding-top: 4.5rem;
    }

    body.themis-webview-report::after {
      background:
        linear-gradient(180deg, rgba(4, 9, 15, 0.22), rgba(4, 9, 15, 0.48) 24%, rgba(4, 9, 15, 0.86)),
        radial-gradient(circle at top, rgba(92, 184, 216, 0.12), transparent 34%);
    }

    .themis-webview-chrome {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1.1rem;
      margin: -4.5rem 0 1.2rem;
      background:
        linear-gradient(135deg, rgba(9, 20, 31, 0.94), rgba(12, 29, 40, 0.86)),
        radial-gradient(circle at right, rgba(92, 184, 216, 0.14), transparent 32%);
      border-bottom: 1px solid var(--themis-shell-border);
      box-shadow: 0 16px 32px rgba(2, 8, 14, 0.34);
      backdrop-filter: blur(14px);
    }

    .themis-webview-brand {
      display: grid;
      gap: 0.12rem;
    }

    .themis-webview-kicker {
      font: 700 0.72rem/1 "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--themis-shell-insight);
    }

    .themis-webview-title {
      font: 700 0.95rem/1.2 "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      color: var(--themis-shell-ink);
    }

    .themis-webview-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.44rem 0.72rem;
      border-radius: 999px;
      border: 1px solid rgba(227, 162, 59, 0.22);
      background: rgba(7, 15, 22, 0.64);
      color: var(--themis-shell-dim);
      font: 600 0.74rem/1 "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .themis-webview-badge::before {
      content: "";
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--themis-shell-review), var(--themis-shell-insight));
      box-shadow: 0 0 16px rgba(92, 184, 216, 0.34);
      flex: 0 0 auto;
    }

    body.themis-webview-report .hero {
      border-color: rgba(92, 184, 216, 0.18);
      box-shadow: 0 24px 52px rgba(2, 8, 14, 0.52);
    }

    body.themis-webview-report .hero-kicker {
      border-color: rgba(92, 184, 216, 0.22);
      background: rgba(7, 15, 22, 0.5);
      color: #d9e8f4;
    }

    body.themis-webview-report .hero-kicker::before {
      background: linear-gradient(135deg, var(--themis-shell-review), var(--themis-shell-insight));
      box-shadow: 0 0 18px rgba(92, 184, 216, 0.28);
    }

    body.themis-webview-report .hero-status.passed {
      color: #cff6e5;
      box-shadow: inset 0 0 0 1px rgba(77, 184, 137, 0.2);
    }

    body.themis-webview-report .hero-status.failed {
      color: #ffd8d1;
      box-shadow: inset 0 0 0 1px rgba(226, 109, 90, 0.2);
    }

    body.themis-webview-report .panel,
    body.themis-webview-report .file-panel,
    body.themis-webview-report .stat-card,
    body.themis-webview-report .focus-panel,
    body.themis-webview-report .quick-action,
    body.themis-webview-report .meta-chip,
    body.themis-webview-report .hero-story {
      border-color: rgba(92, 184, 216, 0.16);
    }

    @media (max-width: 620px) {
      .themis-webview-chrome {
        flex-direction: column;
        align-items: flex-start;
        padding: 0.82rem 0.92rem;
      }

      .themis-webview-badge {
        white-space: normal;
      }
    }
  </style>`;
  const chrome = `
  <div class="themis-webview-chrome">
    <div class="themis-webview-brand">
      <div class="themis-webview-kicker">Themis Review Surface</div>
      <div class="themis-webview-title">Verdict Report In VS Code</div>
    </div>
    <div class="themis-webview-badge">${reviewLabel}</div>
  </div>`;

  let nextHtml = html;
  if (/<head[^>]*>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<\/head>/i, `${themeStyles}\n</head>`);
  }
  if (/<body([^>]*)>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<body([^>]*)>/i, (match, attributes) => {
      if (/class=/i.test(attributes)) {
        return match.replace(/class="([^"]*)"/i, (classMatch, classes) => {
          const normalized = classes.includes('themis-webview-report')
            ? classes
            : `themis-webview-report ${classes}`.trim();
          return `class="${normalized}"`;
        });
      }

      return `<body${attributes} class="themis-webview-report">`;
    });
    nextHtml = nextHtml.replace(/<body[^>]*>/i, (match) => `${match}\n${chrome}`);
  }

  return nextHtml;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  rewriteReportHtmlForWebview
};
