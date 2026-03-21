const fs = require('fs');
const os = require('os');
const path = require('path');
const extensionManifest = require('../packages/themis-vscode/package.json');
const {
  buildResultsTree,
  extractFailureLocation,
  loadThemisWorkspaceState
} = require('../packages/themis-vscode/src/core');

describe('vscode extension scaffold', () => {
  function withWorkspace(run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-vscode-'));

    return Promise.resolve()
      .then(() => run(tempDir))
      .finally(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
  }

  function writeFile(rootDir, relativePath, source) {
    const targetPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, source, 'utf8');
    return targetPath;
  }

  test('loads artifacts into a VS Code friendly state model', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const sourcePath = writeFile(
        workspaceRoot,
        'tests/sample.test.ts',
        `test('fails', () => {\n  expect(true).toBe(false);\n});\n`
      );

      writeFile(
        workspaceRoot,
        '.themis/last-run.json',
        `${JSON.stringify({
          meta: {
            startedAt: '2026-03-20T12:00:00.000Z',
            finishedAt: '2026-03-20T12:00:01.000Z',
            maxWorkers: 4
          },
          files: [
            {
              file: sourcePath,
              tests: [
                {
                  name: 'fails',
                  fullName: 'suite > fails',
                  status: 'failed',
                  durationMs: 18.3,
                  error: {
                    message: 'Expected true to be false',
                    stack: `Error: Expected true to be false\n    at ${sourcePath}:4:7`
                  }
                }
              ]
            }
          ],
          summary: {
            total: 1,
            passed: 0,
            failed: 1,
            skipped: 0,
            durationMs: 18.3
          }
        })}\n`
      );

      writeFile(
        workspaceRoot,
        '.themis/failed-tests.json',
        `${JSON.stringify({
          schema: 'themis.failures.v1',
          runId: 'run_1',
          createdAt: '2026-03-20T12:00:01.000Z',
          summary: {
            total: 1,
            passed: 0,
            failed: 1,
            skipped: 0,
            durationMs: 18.3
          },
          failedTests: [
            {
              file: sourcePath,
              name: 'fails',
              fullName: 'suite > fails',
              durationMs: 18.3,
              message: 'Expected true to be false',
              stack: `Error: Expected true to be false\n    at ${sourcePath}:4:7`
            }
          ]
        })}\n`
      );

      writeFile(
        workspaceRoot,
        '.themis/run-diff.json',
        `${JSON.stringify({
          schema: 'themis.run.diff.v1',
          runId: 'run_1',
          status: 'changed',
          previousRunId: 'run_0',
          previousRunAt: '2026-03-20T11:59:00.000Z',
          currentRunAt: '2026-03-20T12:00:00.000Z',
          delta: {
            total: 0,
            passed: -1,
            failed: 1,
            skipped: 0,
            durationMs: 4.1
          },
          newFailures: ['suite > fails'],
          resolvedFailures: []
        })}\n`
      );

      writeFile(workspaceRoot, '.themis/report.html', '<html><body>Themis report</body></html>\n');

      const state = loadThemisWorkspaceState(workspaceRoot);
      expect(state.hasWorkspace).toBe(true);
      expect(state.hasArtifacts).toBe(true);
      expect(state.reportExists).toBe(true);
      expect(state.summary).toEqual({
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 18.3
      });
      expect(state.comparison.status).toBe('changed');
      expect(state.failures).toHaveLength(1);
      expect(state.verdictLabel).toBe('Action Needed');

      const tree = buildResultsTree(state);
      expect(tree[0].label).toBe('Action Needed');
      expect(tree[1].label).toBe('Run diff +1 failures • +4.1ms');
      expect(tree[2].label).toBe('Open HTML report');
      expect(tree[3].label).toBe('Failures (1)');
      expect(tree[3].children[0].command.id).toBe('themis.openFailure');
      expect(tree[3].children[0].description).toBe('sample.test.ts:4');
    });
  });

  test('surfaces parse errors without crashing the view model', async () => {
    await withWorkspace(async (workspaceRoot) => {
      writeFile(workspaceRoot, '.themis/last-run.json', '{not json\n');

      const state = loadThemisWorkspaceState(workspaceRoot);
      expect(state.hasArtifacts).toBe(true);
      expect(state.parseErrors).toHaveLength(1);
      expect(state.parseErrors[0].filePath.endsWith(path.join('.themis', 'last-run.json'))).toBe(true);

      const tree = buildResultsTree(state);
      const parseErrorGroup = tree.find((entry) => entry.id === 'parse-errors');
      expect(Boolean(parseErrorGroup)).toBe(true);
      expect(parseErrorGroup.children).toHaveLength(1);
    });
  });

  test('extracts source locations from POSIX and Windows-like stacks', () => {
    const posix = extractFailureLocation({
      stack: 'Error: boom\n    at /tmp/themis/tests/sample.test.ts:12:8'
    });
    expect(posix).toEqual({
      filePath: '/tmp/themis/tests/sample.test.ts',
      lineNumber: 12,
      columnNumber: 8
    });

    const windows = extractFailureLocation({
      stack: 'Error: boom\n    at C:\\repo\\tests\\sample.test.ts:9:3'
    });
    expect(windows).toEqual({
      filePath: 'C:\\repo\\tests\\sample.test.ts',
      lineNumber: 9,
      columnNumber: 3
    });
  });

  test('declares the core commands and results view in the extension manifest', () => {
    expect(extensionManifest.main).toBe('./src/extension.js');
    expect(extensionManifest.activationEvents).toContain('onView:themis.results');
    expect(extensionManifest.contributes.views.themis[0].id).toBe('themis.results');

    const commands = extensionManifest.contributes.commands.map((entry) => entry.command);
    expect(commands).toContain('themis.runTests');
    expect(commands).toContain('themis.rerunFailed');
    expect(commands).toContain('themis.openHtmlReport');
    expect(commands).toContain('themis.refreshResults');
  });
});
