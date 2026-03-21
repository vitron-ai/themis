const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
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
      vscode.commands.registerCommand('themis.openHtmlReport', () => this.openHtmlReport()),
      vscode.commands.registerCommand('themis.refreshResults', () => this.refresh()),
      vscode.commands.registerCommand('themis.openFailure', (location) => this.openFailure(location)),
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
      const pattern = new vscode.RelativePattern(folder, '.themis/*');
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
      this.renderReportPanel(state.paths.report);
    }
  }

  updateStatusBar(state) {
    if (!state.hasWorkspace) {
      this.statusBar.text = '$(beaker) Themis';
      this.statusBar.tooltip = 'Open a workspace to use Themis.';
      this.statusBar.show();
      return;
    }

    if (!state.hasArtifacts || !state.summary) {
      this.statusBar.text = '$(beaker) Themis: ready';
      this.statusBar.tooltip = 'Run Themis to generate artifacts.';
      this.statusBar.show();
      return;
    }

    const icon = state.summary.failed > 0 ? 'error' : 'pass';
    this.statusBar.text = `$(${icon}) Themis ${state.summary.passed}/${state.summary.total}`;
    this.statusBar.tooltip = state.statusText;
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
      vscode.window.showInformationMessage('No .themis/report.html file found yet. Run `npx themis test --reporter html` first.');
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
          localResourceRoots: [vscode.Uri.file(path.dirname(state.paths.report))]
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
        localResourceRoots: [vscode.Uri.file(path.dirname(state.paths.report))]
      };
    }

    this.renderReportPanel(state.paths.report);
  }

  renderReportPanel(reportPath) {
    if (!this.reportPanel || !fs.existsSync(reportPath)) {
      return;
    }

    const rawHtml = fs.readFileSync(reportPath, 'utf8');
    this.reportPanel.webview.html = rewriteReportHtmlForWebview(this.reportPanel.webview, reportPath, rawHtml);
  }

  async openFailure(location) {
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
    item.iconPath = new vscode.ThemeIcon(descriptor.icon);
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

  return html.replace(/(src|href)=["']([^"']+)["']/g, (match, attribute, value) => {
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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
