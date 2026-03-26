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
        '.themis/runs/last-run.json',
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
        '.themis/runs/failed-tests.json',
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
        '.themis/diffs/run-diff.json',
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
      writeFile(
        workspaceRoot,
        '.themis/diffs/contract-diff.json',
        `${JSON.stringify({
          schema: 'themis.contract.diff.v1',
          summary: {
            total: 1,
            created: 0,
            updated: 0,
            drifted: 1,
            unchanged: 0
          },
          items: [
            {
              key: 'suite > fails::banner',
              name: 'banner',
              fullName: 'suite > fails',
              status: 'drifted',
              file: 'tests/sample.test.ts',
              contractFile: '.themis/contracts/tests__sample.test.ts/banner.json',
              updateCommand: 'npx themis test --update-contracts --match "suite > fails"',
              diff: {
                changed: [{ path: '$.label', before: 'initial', after: 'changed' }],
                added: [],
                removed: []
              }
            }
          ]
        })}\n`
      );
      writeFile(
        workspaceRoot,
        '.themis/migration/migration-report.json',
        `${JSON.stringify({
          schema: 'themis.migration.report.v1',
          source: 'jest',
          summary: {
            matchedFiles: 1,
            rewrittenFiles: 1,
            rewrittenImports: 2,
            convertedFiles: 1,
            convertedAssertions: 4
          },
          files: [
            {
              file: 'tests/sample.test.ts',
              imports: ['@jest/globals']
            }
          ],
          nextActions: ['Run npx themis test']
        })}\n`
      );

      writeFile(workspaceRoot, '__themis__/reports/report.html', '<html><body>Themis report</body></html>\n');
      writeFile(
        workspaceRoot,
        '.themis/generate/generate-last.json',
        `${JSON.stringify({
          schema: 'themis.generate.result.v1',
          mode: {
            review: false,
            update: false,
            clean: false,
            changed: false,
            plan: false,
            writeHints: true
          },
          source: {
            targetDir: 'src',
            outputDir: '__themis__/tests'
          },
          filters: {
            plan: false,
            changed: false,
            files: [],
            scenario: null,
            minConfidence: null,
            matchSource: null,
            matchExport: null,
            include: null,
            exclude: null
          },
          gates: {
            strict: true,
            failOnSkips: true,
            failOnConflicts: true,
            requireConfidence: 'high',
            failed: true,
            failures: [
              { code: 'confidence', count: 1, message: '1 generated file fell below required confidence high.' }
            ]
          },
          summary: {
            scanned: 2,
            generated: 2,
            created: 1,
            updated: 1,
            unchanged: 0,
            removed: 0,
            skipped: 0,
            conflicts: 0
          },
          scannedFiles: ['src/components/CounterButton.tsx', 'src/hooks/useToggle.ts'],
          generatedFiles: ['__themis__/tests/components/CounterButton.generated.test.ts', '__themis__/tests/hooks/useToggle.generated.test.ts'],
          removedFiles: [],
          skippedFiles: [],
          conflictFiles: [],
          hintFiles: {
            created: ['src/components/CounterButton.themis.json'],
            updated: [],
            unchanged: ['src/hooks/useToggle.themis.json']
          },
          entries: [
            {
              action: 'create',
              sourceFile: 'src/components/CounterButton.tsx',
              testFile: '__themis__/tests/components/CounterButton.generated.test.ts',
              moduleKind: 'react-component',
              confidence: 'medium',
              exactExports: true,
              exportNames: ['CounterButton'],
              hintsFile: 'src/components/CounterButton.themis.json',
              sourceHash: 'abc',
              scenarios: [{ kind: 'react-component', confidence: 'medium', exports: ['CounterButton'], caseCount: 2 }],
              reason: null
            }
          ],
          backlog: {
            summary: {
              total: 1,
              errors: 1,
              warnings: 0,
              skipped: 0,
              conflicts: 0,
              confidence: 1
            },
            items: [
              {
                type: 'confidence',
                severity: 'error',
                sourceFile: 'src/components/CounterButton.tsx',
                testFile: '__themis__/tests/components/CounterButton.generated.test.ts',
                moduleKind: 'react-component',
                confidence: 'medium',
                stage: null,
                hintsFile: 'src/components/CounterButton.themis.json',
                reason: 'Confidence medium is below required high.',
                suggestedAction: 'Expand the hint file and rerun generate.',
                suggestedCommand: 'npx themis generate src/components/CounterButton.tsx --update'
              }
            ]
          },
          artifacts: {
            generateMap: '.themis/generate/generate-map.json',
            helperFile: '@vitronai/themis/contract-runtime',
            generateResult: '.themis/generate/generate-last.json',
            generateHandoff: '.themis/generate/generate-handoff.json',
            generateBacklog: '.themis/generate/generate-backlog.json'
          },
          promptReady: {
            summary: 'Mode: generate.',
            targets: [],
            unresolved: [],
            nextActions: ['Run npx themis test.'],
            prompt: 'Review the following Themis generation result.'
          },
          hints: {
            runTests: 'npx themis test',
            plan: 'npx themis generate src --plan',
            review: 'npx themis generate src --review --json',
            updateOnly: 'npx themis generate src --update',
            clean: 'npx themis generate src --clean',
            changed: 'npx themis generate src --changed',
            strict: 'npx themis generate src --strict',
            writeHints: 'npx themis generate src --write-hints',
            fileTarget: 'npx themis generate src/path/to/file.ts'
          }
        })}\n`
      );
      writeFile(
        workspaceRoot,
        '.themis/generate/generate-backlog.json',
        `${JSON.stringify({
          schema: 'themis.generate.backlog.v1',
          source: {
            targetDir: 'src',
            outputDir: '__themis__/tests'
          },
          filters: {
            plan: false,
            changed: false,
            files: [],
            scenario: null,
            minConfidence: null,
            matchSource: null,
            matchExport: null,
            include: null,
            exclude: null
          },
          gates: {
            strict: true,
            failOnSkips: true,
            failOnConflicts: true,
            requireConfidence: 'high',
            failed: true,
            failures: [{ code: 'confidence', count: 1, message: '1 generated file fell below required confidence high.' }]
          },
          summary: {
            total: 1,
            errors: 1,
            warnings: 0,
            skipped: 0,
            conflicts: 0,
            confidence: 1
          },
          items: [
            {
              type: 'confidence',
              severity: 'error',
              sourceFile: 'src/components/CounterButton.tsx',
              testFile: '__themis__/tests/components/CounterButton.generated.test.ts',
              moduleKind: 'react-component',
              confidence: 'medium',
              stage: null,
              hintsFile: 'src/components/CounterButton.themis.json',
              reason: 'Confidence medium is below required high.',
              suggestedAction: 'Expand the hint file and rerun generate.',
              suggestedCommand: 'npx themis generate src/components/CounterButton.tsx --update'
            }
          ]
        })}\n`
      );

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
      expect(state.generation.summary.generated).toBe(2);
      expect(state.generation.gates.failed).toBe(true);
      expect(state.contracts.summary.drifted).toBe(1);
      expect(state.migration.summary.convertedFiles).toBe(1);
      expect(state.generation.hintFiles.created).toEqual([path.join(workspaceRoot, 'src/components/CounterButton.themis.json')]);

      const tree = buildResultsTree(state);
      const verdict = tree.find((entry) => entry.id === 'verdict');
      const comparison = tree.find((entry) => entry.id === 'comparison');
      const report = tree.find((entry) => entry.id === 'report');
      const contracts = tree.find((entry) => entry.id === 'contracts');
      const migration = tree.find((entry) => entry.id === 'migration');
      const generation = tree.find((entry) => entry.id === 'generation');
      const failuresGroup = tree.find((entry) => entry.id === 'failures');

      expect(verdict.label).toBe('Action Needed');
      expect(comparison.label).toBe('Run diff +1 failures • +4.1ms');
      expect(report.label).toBe('Open HTML report');
      expect(contracts.label).toBe('Contract Review (1)');
      expect(contracts.children[0].command.id).toBe('themis.updateContracts');
      expect(contracts.children[1].label).toBe('DRIFTED banner');
      expect(migration.label).toBe('Migration Review (1)');
      expect(migration.children[0].command.id).toBe('themis.runMigrationCodemods');
      expect(generation.label).toBe('Generated Review (2)');
      expect(generation.children[0].label).toBe('Mapped targets (1)');
      expect(generation.children[1].label).toBe('Generation backlog (1)');
      expect(generation.children[2].label).toBe('Hint sidecars (2)');
      expect(generation.children[0].children[0].children[0].command.id).toBe('themis.openArtifactFile');
      expect(failuresGroup.label).toBe('Failures (1)');
      expect(failuresGroup.children[0].command.id).toBe('themis.openFailure');
      expect(failuresGroup.children[0].description).toBe('sample.test.ts:4');
    });
  });

  test('surfaces parse errors without crashing the view model', async () => {
    await withWorkspace(async (workspaceRoot) => {
      writeFile(workspaceRoot, '.themis/runs/last-run.json', '{not json\n');

      const state = loadThemisWorkspaceState(workspaceRoot);
      expect(state.hasArtifacts).toBe(true);
      expect(state.parseErrors).toHaveLength(1);
      expect(state.parseErrors[0].filePath.endsWith(path.join('.themis', 'runs', 'last-run.json'))).toBe(true);

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
    expect(commands).toContain('themis.updateContracts');
    expect(commands).toContain('themis.runMigrationCodemods');
    expect(commands).toContain('themis.openHtmlReport');
    expect(commands).toContain('themis.refreshResults');
    expect(commands).toContain('themis.openArtifactFile');
  });
});
