const fs = require('fs');
const path = require('path');
const {
  ARTIFACT_DIR,
  ARTIFACT_RELATIVE_PATHS,
  getArtifactPathCandidates
} = require('../../../src/artifact-paths');

const THEME_COLORS = Object.freeze({
  pass: 'themis.color.pass',
  fail: 'themis.color.fail',
  review: 'themis.color.review',
  insight: 'themis.color.insight',
  muted: 'themis.color.muted'
});

function getArtifactPaths(workspaceRoot) {
  if (!workspaceRoot) {
    return null;
  }

  const artifactDir = path.join(workspaceRoot, ARTIFACT_DIR);
  return {
    artifactDir,
    lastRun: getArtifactPathCandidates(workspaceRoot, 'lastRun'),
    failedTests: getArtifactPathCandidates(workspaceRoot, 'failedTests'),
    runDiff: getArtifactPathCandidates(workspaceRoot, 'runDiff'),
    contractDiff: getArtifactPathCandidates(workspaceRoot, 'contractDiff'),
    migrationReport: getArtifactPathCandidates(workspaceRoot, 'migrationReport'),
    report: getArtifactPathCandidates(workspaceRoot, 'htmlReport'),
    generateLast: getArtifactPathCandidates(workspaceRoot, 'generateResult'),
    generateMap: getArtifactPathCandidates(workspaceRoot, 'generateMap'),
    generateBacklog: getArtifactPathCandidates(workspaceRoot, 'generateBacklog'),
    generateHandoff: getArtifactPathCandidates(workspaceRoot, 'generateHandoff')
  };
}

function loadThemisWorkspaceState(workspaceRoot) {
  const paths = getArtifactPaths(workspaceRoot);
  if (!paths) {
    return {
      workspaceRoot: null,
      paths: null,
      hasWorkspace: false,
      hasArtifacts: false,
      parseErrors: [],
      summary: null,
      failures: [],
      comparison: null,
      reportExists: false,
      statusText: 'Open a workspace to view Themis results.',
      verdictLabel: 'No workspace'
    };
  }

  const lastRun = readJsonArtifact(paths.lastRun);
  const failedTests = readJsonArtifact(paths.failedTests);
  const runDiff = readJsonArtifact(paths.runDiff);
  const contractDiff = readJsonArtifact(paths.contractDiff);
  const migrationReport = readJsonArtifact(paths.migrationReport);
  const generateLast = readJsonArtifact(paths.generateLast);
  const generateMap = readJsonArtifact(paths.generateMap);
  const generateBacklog = readJsonArtifact(paths.generateBacklog);
  const generateHandoff = readJsonArtifact(paths.generateHandoff);
  const parseErrors = [lastRun, failedTests, runDiff, contractDiff, migrationReport, generateLast, generateMap, generateBacklog, generateHandoff]
    .filter((entry) => entry.error)
    .map((entry) => ({ filePath: entry.filePath, message: entry.error }));
  const reportPath = findExistingPath(paths.report);
  const reportExists = Boolean(reportPath);
  const summary = normalizeSummary(lastRun.value && lastRun.value.summary);
  const failures = normalizeFailures(failedTests.value, lastRun.value);
  const comparison = normalizeComparison(runDiff.value, lastRun.value);
  const contracts = normalizeContractDiff(workspaceRoot, contractDiff.value);
  const migration = normalizeMigrationReport(workspaceRoot, migrationReport.value);
  const generation = normalizeGenerationReview(
    workspaceRoot,
    generateLast.value,
    generateMap.value,
    generateBacklog.value,
    generateHandoff.value
  );
  const hasArtifacts = Boolean(
    lastRun.exists
      || failedTests.exists
      || runDiff.exists
      || contractDiff.exists
      || migrationReport.exists
      || generateLast.exists
      || generateMap.exists
      || generateBacklog.exists
      || generateHandoff.exists
      || reportExists
  );

  return {
    workspaceRoot,
    paths,
    hasWorkspace: true,
    hasArtifacts,
    parseErrors,
    lastRun: lastRun.value,
    failedTestsArtifact: failedTests.value,
    runDiff: runDiff.value,
    contractDiff: contractDiff.value,
    migrationReport: migrationReport.value,
    generateLast: generateLast.value,
    generateMap: generateMap.value,
    generateBacklog: generateBacklog.value,
    generateHandoff: generateHandoff.value,
    summary,
    failures,
    comparison,
    contracts,
    migration,
    generation,
    reportExists,
    statusText: buildStatusText(summary),
    verdictLabel: buildVerdictLabel(summary, hasArtifacts),
    reportPath
  };
}

function buildResultsTree(state) {
  if (!state.hasWorkspace) {
    return [
      {
        id: 'no-workspace',
        kind: 'info',
        label: 'Open a workspace to use Themis',
        description: '',
        tooltip: 'Themis needs a workspace folder to find .themis artifacts.',
        color: THEME_COLORS.muted,
        icon: 'folder-opened'
      }
    ];
  }

  if (!state.hasArtifacts) {
    return [
      buildQuickActionsGroup(state),
      {
        id: 'no-results',
        kind: 'action',
        label: 'Run Themis to generate results',
        description: '',
        tooltip: 'Run `npx themis test` to create .themis artifacts.',
        color: THEME_COLORS.insight,
        icon: 'play',
        command: { id: 'themis.runTests' }
      }
    ];
  }

  const items = [
    buildQuickActionsGroup(state),
    {
      id: 'verdict',
      kind: 'summary',
      label: state.verdictLabel,
      description: state.statusText,
      tooltip: `${state.verdictLabel}\n${state.statusText}`,
      color: state.summary && state.summary.failed > 0 ? THEME_COLORS.fail : THEME_COLORS.pass,
      icon: state.summary && state.summary.failed > 0 ? 'error' : 'pass'
    }
  ];

  if (state.comparison) {
    items.push({
      id: 'comparison',
      kind: 'comparison',
      label: buildComparisonLabel(state.comparison),
      description: buildComparisonDescription(state.comparison),
      tooltip: buildComparisonTooltip(state.comparison),
      color: state.comparison.status === 'baseline' ? THEME_COLORS.insight : THEME_COLORS.review,
      icon: state.comparison.status === 'baseline' ? 'pulse' : 'git-compare'
    });
  }

  items.push({
    id: 'report',
    kind: 'action',
    label: state.reportExists ? 'Open HTML report' : 'HTML report not generated yet',
      description: state.reportExists ? path.basename(state.reportPath || findExistingPath(state.paths.report) || '') : '',
      tooltip: state.reportExists
        ? 'Open the interactive Themis HTML verdict report.'
        : `Run \`npx themis test --reporter html\` to generate ${ARTIFACT_RELATIVE_PATHS.htmlReport}.`,
      color: state.reportExists ? THEME_COLORS.insight : THEME_COLORS.muted,
      icon: 'globe',
      command: state.reportExists ? { id: 'themis.openHtmlReport' } : null
    });

  if (state.generation) {
    items.push({
      id: 'generation',
      kind: 'group',
      label: buildGenerationLabel(state.generation),
      description: buildGenerationDescription(state.generation),
      tooltip: buildGenerationTooltip(state.generation),
      color: state.generation.gates && state.generation.gates.failed ? THEME_COLORS.review : THEME_COLORS.insight,
      icon: state.generation.gates && state.generation.gates.failed ? 'warning' : 'symbol-array',
      children: buildGenerationChildren(state.generation)
    });
  }

  if (state.contracts) {
    items.push({
      id: 'contracts',
      kind: 'group',
      label: buildContractLabel(state.contracts),
      description: buildContractDescription(state.contracts),
      tooltip: buildContractTooltip(state.contracts),
      color: state.contracts.summary.drifted > 0 ? THEME_COLORS.review : THEME_COLORS.pass,
      icon: state.contracts.summary.drifted > 0 ? 'warning' : 'symbol-constant',
      children: buildContractChildren(state.contracts)
    });
  }

  if (state.migration) {
    items.push({
      id: 'migration',
      kind: 'group',
      label: buildMigrationLabel(state.migration),
      description: buildMigrationDescription(state.migration),
      tooltip: buildMigrationTooltip(state.migration),
      color: THEME_COLORS.insight,
      icon: 'git-pull-request',
      children: buildMigrationChildren(state.migration)
    });
  }

  if (state.parseErrors.length > 0) {
    items.push({
      id: 'parse-errors',
      kind: 'group',
      label: `Artifact issues (${state.parseErrors.length})`,
      description: 'Refresh or rerun tests',
      tooltip: 'One or more Themis artifact files could not be parsed.',
      color: THEME_COLORS.fail,
      icon: 'warning',
      children: state.parseErrors.map((entry, index) => ({
        id: `parse-error-${index}`,
        kind: 'error',
        label: path.basename(entry.filePath),
        description: entry.message,
        tooltip: `${entry.filePath}\n${entry.message}`,
        color: THEME_COLORS.fail,
        icon: 'warning'
      }))
    });
  }

  items.push(buildArtifactFilesGroup(state));

  items.push({
    id: 'failures',
    kind: 'group',
    label: `Failures (${state.failures.length})`,
    description: state.failures.length > 0 ? 'Open a failing file' : 'No current failures',
    tooltip: state.failures.length > 0
      ? 'Open a failure to jump into the source file.'
      : 'The latest Themis run has no failing tests.',
    color: state.failures.length > 0 ? THEME_COLORS.fail : THEME_COLORS.pass,
    icon: state.failures.length > 0 ? 'error' : 'pass',
    children: state.failures.length > 0
      ? state.failures.map((failure, index) => {
          const location = extractFailureLocation(failure);
          return {
            id: `failure-${index}`,
            kind: 'failure',
            label: failure.fullName || failure.name || `Failure ${index + 1}`,
            description: location ? `${path.basename(location.filePath)}:${location.lineNumber}` : path.basename(failure.file || ''),
            tooltip: buildFailureTooltip(failure, location),
            color: THEME_COLORS.fail,
            icon: 'circle-filled',
            command: {
              id: 'themis.openFailure',
              arguments: [
                {
                  filePath: location ? location.filePath : failure.file,
                  lineNumber: location ? location.lineNumber : 1,
                  columnNumber: location ? location.columnNumber : 1
                }
              ]
            }
          };
        })
      : [
          {
            id: 'failure-none',
            kind: 'info',
            label: 'No failing tests',
            description: '',
            tooltip: 'The latest Themis run completed without failures.',
            color: THEME_COLORS.pass,
            icon: 'pass'
          }
        ]
  });

  return items;
}

function buildQuickActionsGroup(state) {
  const actions = [
    {
      id: 'quick-action-run-tests',
      kind: 'action',
      label: 'Run Tests',
      description: 'Run the full Themis suite',
      tooltip: 'Run `npx themis test` in the current workspace.',
      color: THEME_COLORS.insight,
      icon: 'play',
      command: { id: 'themis.runTests' }
    },
    {
      id: 'quick-action-rerun-failed',
      kind: 'action',
      label: 'Rerun Failed',
      description: state.failures.length > 0 ? `${state.failures.length} current failures` : 'Use the latest failed-tests artifact',
      tooltip: 'Run `npx themis test --rerun-failed` in the current workspace.',
      color: state.failures.length > 0 ? THEME_COLORS.fail : THEME_COLORS.muted,
      icon: 'debug-rerun',
      command: { id: 'themis.rerunFailed' }
    },
    {
      id: 'quick-action-open-report',
      kind: 'action',
      label: 'Open HTML Report',
      description: state.reportExists ? path.basename(state.reportPath || findExistingPath(state.paths.report) || '') : 'Generate the report first',
      tooltip: state.reportExists
        ? 'Open the interactive Themis HTML verdict report.'
        : `Run \`npx themis test --reporter html\` to generate ${ARTIFACT_RELATIVE_PATHS.htmlReport}.`,
      color: state.reportExists ? THEME_COLORS.insight : THEME_COLORS.muted,
      icon: 'globe',
      command: state.reportExists ? { id: 'themis.openHtmlReport' } : null
    },
    {
      id: 'quick-action-update-contracts',
      kind: 'action',
      label: 'Update Contracts',
      description: state.contracts ? `${state.contracts.summary.drifted} drifted` : 'No contract diff loaded',
      tooltip: 'Run `npx themis test --update-contracts` in the current workspace.',
      color: state.contracts && state.contracts.summary.drifted > 0 ? THEME_COLORS.review : THEME_COLORS.muted,
      icon: 'symbol-constant',
      command: { id: 'themis.updateContracts' }
    },
    {
      id: 'quick-action-run-migration',
      kind: 'action',
      label: 'Run Migration Codemods',
      description: state.migration ? `${state.migration.summary.matchedFiles} matched suites` : 'Use detected or default source',
      tooltip: 'Run `npx themis migrate <source> --convert` in the current workspace.',
      color: state.migration ? THEME_COLORS.review : THEME_COLORS.muted,
      icon: 'git-pull-request',
      command: { id: 'themis.runMigrationCodemods' }
    },
    {
      id: 'quick-action-refresh',
      kind: 'action',
      label: 'Refresh Results',
      description: 'Re-read .themis artifacts',
      tooltip: 'Refresh the Themis sidebar from the latest artifact files.',
      color: THEME_COLORS.muted,
      icon: 'refresh',
      command: { id: 'themis.refreshResults' }
    }
  ];

  return {
    id: 'quick-actions',
    kind: 'group',
    label: 'Quick Actions',
    description: 'Run, rerun, refresh, and review',
    tooltip: 'Core Themis commands, available even when the view toolbar overflows.',
    color: THEME_COLORS.insight,
    icon: 'tools',
    collapsibleState: 'expanded',
    children: actions
  };
}

function buildArtifactFilesGroup(state) {
  const artifactItems = [
    buildExistingArtifactFileItem('artifact-last-run', 'Run artifact', state.paths && state.paths.lastRun, 'Open the latest .themis/runs/last-run.json payload.'),
    buildExistingArtifactFileItem('artifact-failed-tests', 'Failed tests', state.paths && state.paths.failedTests, 'Open the latest .themis/runs/failed-tests.json payload.'),
    buildExistingArtifactFileItem('artifact-run-diff', 'Run diff', state.paths && state.paths.runDiff, 'Open the latest .themis/diffs/run-diff.json payload.'),
    buildExistingArtifactFileItem('artifact-contract-diff', 'Contract diff', state.paths && state.paths.contractDiff, 'Open the latest .themis/diffs/contract-diff.json payload.'),
    buildExistingArtifactFileItem('artifact-migration-report', 'Migration report', state.paths && state.paths.migrationReport, 'Open the latest .themis/migration/migration-report.json payload.'),
    buildExistingArtifactFileItem('artifact-generate-last', 'Generate result', state.paths && state.paths.generateLast, 'Open the latest .themis/generate/generate-last.json payload.'),
    buildExistingArtifactFileItem('artifact-generate-map', 'Generate map', state.paths && state.paths.generateMap, 'Open the latest .themis/generate/generate-map.json payload.'),
    buildExistingArtifactFileItem('artifact-generate-backlog', 'Generate backlog', state.paths && state.paths.generateBacklog, 'Open the latest .themis/generate/generate-backlog.json payload.'),
    buildExistingArtifactFileItem('artifact-generate-handoff', 'Generate handoff', state.paths && state.paths.generateHandoff, 'Open the latest .themis/generate/generate-handoff.json payload.')
  ].filter(Boolean);

  return {
    id: 'artifact-files',
    kind: 'group',
    label: `Artifact Files (${artifactItems.length})`,
    description: artifactItems.length > 0 ? 'Open raw Themis outputs' : 'No artifact files found yet',
    tooltip: 'Raw Themis artifacts for direct inspection inside the editor.',
    color: artifactItems.length > 0 ? THEME_COLORS.insight : THEME_COLORS.muted,
    icon: 'folder-library',
    collapsibleState: 'collapsed',
    children: artifactItems.length > 0
      ? artifactItems
      : [
          {
            id: 'artifact-files-empty',
            kind: 'info',
            label: 'No artifact files tracked yet',
            description: '',
            tooltip: 'Run Themis to generate .themis artifacts for direct inspection.',
            color: THEME_COLORS.muted,
            icon: 'info'
          }
        ]
  };
}

function buildExistingArtifactFileItem(id, labelPrefix, filePathOrCandidates, tooltip) {
  const filePath = findExistingPath(filePathOrCandidates);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return buildOpenFileItem(id, labelPrefix, filePath, tooltip);
}

function extractFailureLocation(failure) {
  if (!failure || typeof failure !== 'object') {
    return null;
  }

  const stack = String(failure.stack || '');
  const lines = stack.split('\n');
  for (const line of lines) {
    const match =
      line.match(/\(((?:[A-Za-z]:\\|\/).+?):(\d+):(\d+)\)/) ||
      line.match(/at ((?:[A-Za-z]:\\|\/).+?):(\d+):(\d+)$/);

    if (!match) {
      continue;
    }

    const filePath = match[1];
    if (filePath.includes('/node:') || filePath.includes('/internal/') || filePath.includes('\\node:')) {
      continue;
    }

    return {
      filePath,
      lineNumber: Number(match[2]),
      columnNumber: Number(match[3])
    };
  }

  if (typeof failure.file === 'string' && failure.file.length > 0) {
    return {
      filePath: failure.file,
      lineNumber: 1,
      columnNumber: 1
    };
  }

  return null;
}

function findExistingPath(filePathOrCandidates) {
  const candidates = Array.isArray(filePathOrCandidates) ? filePathOrCandidates : [filePathOrCandidates];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0] || '';
}

function readJsonArtifact(filePathOrCandidates) {
  const filePath = findExistingPath(filePathOrCandidates);
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      filePath,
      exists: false,
      value: null,
      error: null
    };
  }

  try {
    return {
      filePath,
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
      error: null
    };
  } catch (error) {
    return {
      filePath,
      exists: true,
      value: null,
      error: String(error && error.message ? error.message : error)
    };
  }
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  return {
    total: Number(summary.total || 0),
    passed: Number(summary.passed || 0),
    failed: Number(summary.failed || 0),
    skipped: Number(summary.skipped || 0),
    durationMs: roundDuration(summary.durationMs || 0)
  };
}

function normalizeFailures(failedTestsArtifact, lastRun) {
  if (failedTestsArtifact && Array.isArray(failedTestsArtifact.failedTests)) {
    return failedTestsArtifact.failedTests;
  }

  const failures = [];
  const files = Array.isArray(lastRun && lastRun.files) ? lastRun.files : [];
  for (const fileEntry of files) {
    for (const test of Array.isArray(fileEntry.tests) ? fileEntry.tests : []) {
      if (test.status !== 'failed') {
        continue;
      }

      failures.push({
        file: fileEntry.file,
        name: test.name,
        fullName: test.fullName,
        durationMs: test.durationMs,
        message: test.error ? test.error.message : '',
        stack: test.error ? test.error.stack : ''
      });
    }
  }

  return failures;
}

function normalizeComparison(runDiff, lastRun) {
  if (runDiff && typeof runDiff === 'object') {
    return {
      status: String(runDiff.status || 'baseline'),
      previousRunId: String(runDiff.previousRunId || ''),
      previousRunAt: String(runDiff.previousRunAt || ''),
      currentRunAt: String(runDiff.currentRunAt || ''),
      delta: normalizeDelta(runDiff.delta),
      newFailures: Array.isArray(runDiff.newFailures) ? runDiff.newFailures : [],
      resolvedFailures: Array.isArray(runDiff.resolvedFailures) ? runDiff.resolvedFailures : []
    };
  }

  const comparison = lastRun && lastRun.artifacts && lastRun.artifacts.comparison;
  if (!comparison || typeof comparison !== 'object') {
    return null;
  }

  return {
    status: String(comparison.status || 'baseline'),
    previousRunId: String(comparison.previousRunId || ''),
    previousRunAt: String(comparison.previousRunAt || ''),
    currentRunAt: String(comparison.currentRunAt || ''),
    delta: normalizeDelta(comparison.delta),
    newFailures: Array.isArray(comparison.newFailures) ? comparison.newFailures : [],
    resolvedFailures: Array.isArray(comparison.resolvedFailures) ? comparison.resolvedFailures : []
  };
}

function normalizeGenerationReview(workspaceRoot, generateLast, generateMap, generateBacklog, generateHandoff) {
  const payload = generateLast && typeof generateLast === 'object' ? generateLast : null;
  const mapEntries = Array.isArray(generateMap && generateMap.entries) ? generateMap.entries : [];
  const backlogItems = Array.isArray(generateBacklog && generateBacklog.items)
    ? generateBacklog.items
    : Array.isArray(payload && payload.backlog && payload.backlog.items)
      ? payload.backlog.items
      : [];

  if (!payload && mapEntries.length === 0 && backlogItems.length === 0) {
    return null;
  }

  return {
    source: payload && payload.source ? payload.source : null,
    summary: normalizeGenerateSummary(payload && payload.summary),
    gates: normalizeGenerateGates(payload && payload.gates),
    hintFiles: normalizeHintFiles(
      workspaceRoot,
      payload && payload.hintFiles,
      payload && payload.handoff && payload.handoff.hintFiles,
      generateHandoff && generateHandoff.hintFiles
    ),
    entries: normalizeGenerateEntries(workspaceRoot, payload && payload.entries, mapEntries),
    backlog: {
      summary: normalizeGenerateBacklogSummary(
        payload && payload.backlog && payload.backlog.summary,
        generateBacklog && generateBacklog.summary,
        generateHandoff && generateHandoff.backlog
      ),
      items: normalizeGenerateBacklogItems(workspaceRoot, backlogItems)
    },
    handoff: generateHandoff && typeof generateHandoff === 'object' ? generateHandoff : null
  };
}

function normalizeGenerateSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  return {
    scanned: Number(summary.scanned || 0),
    generated: Number(summary.generated || 0),
    created: Number(summary.created || 0),
    updated: Number(summary.updated || 0),
    unchanged: Number(summary.unchanged || 0),
    removed: Number(summary.removed || 0),
    skipped: Number(summary.skipped || 0),
    conflicts: Number(summary.conflicts || 0)
  };
}

function normalizeGenerateGates(gates) {
  if (!gates || typeof gates !== 'object') {
    return null;
  }

  return {
    strict: Boolean(gates.strict),
    failed: Boolean(gates.failed),
    failOnSkips: Boolean(gates.failOnSkips),
    failOnConflicts: Boolean(gates.failOnConflicts),
    requireConfidence: gates.requireConfidence || null,
    failures: Array.isArray(gates.failures) ? gates.failures : []
  };
}

function normalizeHintFiles(workspaceRoot, ...candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    return {
      created: Array.isArray(candidate.created) ? candidate.created.map((entry) => resolveWorkspacePath(workspaceRoot, entry)).filter(Boolean) : [],
      updated: Array.isArray(candidate.updated) ? candidate.updated.map((entry) => resolveWorkspacePath(workspaceRoot, entry)).filter(Boolean) : [],
      unchanged: Array.isArray(candidate.unchanged) ? candidate.unchanged.map((entry) => resolveWorkspacePath(workspaceRoot, entry)).filter(Boolean) : []
    };
  }

  return {
    created: [],
    updated: [],
    unchanged: []
  };
}

function normalizeGenerateEntries(workspaceRoot, entries, fallbackEntries) {
  const input = Array.isArray(entries) && entries.length > 0 ? entries : fallbackEntries;
  return input.map((entry, index) => ({
    id: `generate-entry-${index}`,
    action: String(entry.action || 'generate'),
    sourceFile: resolveWorkspacePath(workspaceRoot, entry.sourceFile),
    testFile: resolveWorkspacePath(workspaceRoot, entry.testFile),
    moduleKind: String(entry.moduleKind || 'module-contract'),
    confidence: String(entry.confidence || 'low'),
    hintsFile: resolveWorkspacePath(workspaceRoot, entry.hintsFile),
    reason: entry.reason ? String(entry.reason) : null,
    scenarios: Array.isArray(entry.scenarios) ? entry.scenarios.map((scenario) => scenario.kind || scenario) : []
  }));
}

function normalizeGenerateBacklogSummary(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    return {
      total: Number(candidate.total || 0),
      errors: Number(candidate.errors || 0),
      warnings: Number(candidate.warnings || 0),
      skipped: Number(candidate.skipped || 0),
      conflicts: Number(candidate.conflicts || 0),
      confidence: Number(candidate.confidence || 0)
    };
  }

  return {
    total: 0,
    errors: 0,
    warnings: 0,
    skipped: 0,
    conflicts: 0,
    confidence: 0
  };
}

function normalizeGenerateBacklogItems(workspaceRoot, items) {
  return items.map((item, index) => ({
    id: `generate-backlog-${index}`,
    type: String(item.type || 'backlog'),
    severity: String(item.severity || 'warning'),
    sourceFile: resolveWorkspacePath(workspaceRoot, item.sourceFile),
    testFile: resolveWorkspacePath(workspaceRoot, item.testFile),
    hintsFile: resolveWorkspacePath(workspaceRoot, item.hintsFile),
    reason: String(item.reason || ''),
    suggestedAction: String(item.suggestedAction || ''),
    suggestedCommand: item.suggestedCommand ? String(item.suggestedCommand) : null
  }));
}

function normalizeContractDiff(workspaceRoot, payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    return null;
  }

  return {
    summary: {
      total: Number(payload.summary && payload.summary.total || 0),
      created: Number(payload.summary && payload.summary.created || 0),
      updated: Number(payload.summary && payload.summary.updated || 0),
      drifted: Number(payload.summary && payload.summary.drifted || 0),
      unchanged: Number(payload.summary && payload.summary.unchanged || 0)
    },
    items: payload.items.map((item, index) => ({
      id: `contract-${index}`,
      key: String(item.key || ''),
      name: String(item.name || ''),
      status: String(item.status || 'unchanged'),
      file: resolveWorkspacePath(workspaceRoot, item.file),
      contractFile: resolveWorkspacePath(workspaceRoot, item.contractFile),
      fullName: String(item.fullName || ''),
      updateCommand: String(item.updateCommand || ''),
      diff: item.diff || { changed: [], added: [], removed: [] }
    }))
  };
}

function normalizeMigrationReport(workspaceRoot, payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return {
    source: String(payload.source || ''),
    summary: {
      matchedFiles: Number(payload.summary && payload.summary.matchedFiles || 0),
      rewrittenFiles: Number(payload.summary && payload.summary.rewrittenFiles || 0),
      rewrittenImports: Number(payload.summary && payload.summary.rewrittenImports || 0),
      convertedFiles: Number(payload.summary && payload.summary.convertedFiles || 0),
      convertedAssertions: Number(payload.summary && payload.summary.convertedAssertions || 0)
    },
    files: Array.isArray(payload.files) ? payload.files.map((entry, index) => ({
      id: `migration-file-${index}`,
      file: resolveWorkspacePath(workspaceRoot, entry.file),
      imports: Array.isArray(entry.imports) ? entry.imports : []
    })) : [],
    nextActions: Array.isArray(payload.nextActions) ? payload.nextActions : []
  };
}

function resolveWorkspacePath(workspaceRoot, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    return null;
  }
  if (path.isAbsolute(targetPath) || !workspaceRoot) {
    return targetPath;
  }
  return path.join(workspaceRoot, targetPath);
}

function buildGenerationLabel(generation) {
  const summary = generation.summary;
  const total = summary ? summary.generated : generation.entries.length;
  return `Generated Review (${total})`;
}

function buildGenerationDescription(generation) {
  const summary = generation.summary;
  const backlog = generation.backlog.summary;
  const created = summary ? summary.created : generation.entries.filter((entry) => entry.action === 'create').length;
  const updated = summary ? summary.updated : generation.entries.filter((entry) => entry.action === 'update').length;
  return `${created} created • ${updated} updated • ${backlog.total} backlog`;
}

function buildGenerationTooltip(generation) {
  const summary = generation.summary;
  const backlog = generation.backlog.summary;
  const lines = [
    generation.source && generation.source.targetDir ? `Target: ${generation.source.targetDir}` : 'Generated review artifacts',
    summary
      ? `Generated ${summary.generated}, created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, conflicts ${summary.conflicts}`
      : `Entries: ${generation.entries.length}`,
    `Backlog: ${backlog.total} (${backlog.errors} error, ${backlog.warnings} warning)`
  ];

  if (generation.gates) {
    lines.push(`Gates: ${generation.gates.failed ? 'failed' : 'passed'}`);
  }

  return lines.join('\n');
}

function buildGenerationChildren(generation) {
  const children = [];

  children.push({
    id: 'generation-targets',
    kind: 'group',
    label: `Mapped targets (${generation.entries.length})`,
    description: generation.entries.length > 0 ? 'Open source, generated tests, or hint sidecars' : 'No generated mappings',
    tooltip: 'Source-to-generated-test mappings from the latest Themis generate run.',
    color: THEME_COLORS.insight,
    icon: 'files',
    children: generation.entries.length > 0
      ? generation.entries.map((entry) => buildGenerateEntryItem(entry))
      : [
          {
            id: 'generation-targets-empty',
            kind: 'info',
            label: 'No generated targets',
            description: '',
            tooltip: 'Run `npx themis generate src` to populate generated mappings.',
            color: THEME_COLORS.muted,
            icon: 'info'
          }
        ]
  });

  children.push({
    id: 'generation-backlog',
    kind: 'group',
    label: `Generation backlog (${generation.backlog.summary.total})`,
    description: generation.backlog.summary.total > 0 ? 'Resolve skips, conflicts, and low-confidence entries' : 'No generation backlog',
    tooltip: `Unresolved generation backlog from ${ARTIFACT_RELATIVE_PATHS.generateBacklog}.`,
    color: generation.backlog.summary.errors > 0 ? THEME_COLORS.review : THEME_COLORS.pass,
    icon: generation.backlog.summary.errors > 0 ? 'warning' : 'pass',
    children: generation.backlog.items.length > 0
      ? generation.backlog.items.map((item) => buildGenerateBacklogItem(item))
      : [
          {
            id: 'generation-backlog-empty',
            kind: 'info',
            label: 'No backlog items',
            description: '',
            tooltip: 'The latest generate run does not report unresolved backlog.',
            color: THEME_COLORS.pass,
            icon: 'pass'
          }
        ]
  });

  const hintTotal = generation.hintFiles.created.length + generation.hintFiles.updated.length + generation.hintFiles.unchanged.length;
  children.push({
    id: 'generation-hints',
    kind: 'group',
    label: `Hint sidecars (${hintTotal})`,
    description: hintTotal > 0 ? 'Review scaffolded or reused hint files' : 'No hint sidecars tracked',
    tooltip: 'Hint sidecars from the latest generate run.',
    color: hintTotal > 0 ? THEME_COLORS.review : THEME_COLORS.muted,
    icon: 'edit',
    children: hintTotal > 0
      ? buildHintFileItems(generation.hintFiles)
      : [
          {
            id: 'generation-hints-empty',
            kind: 'info',
            label: 'No hint sidecars recorded',
            description: '',
            tooltip: 'Run `npx themis generate src --write-hints` to scaffold hint files.',
            color: THEME_COLORS.muted,
            icon: 'info'
          }
        ]
  });

  return children;
}

function buildContractLabel(contracts) {
  return `Contract Review (${contracts.summary.total})`;
}

function buildContractDescription(contracts) {
  return `${contracts.summary.drifted} drifted • ${contracts.summary.updated} updated • ${contracts.summary.created} created`;
}

function buildContractTooltip(contracts) {
  return [
    `Drifted: ${contracts.summary.drifted}`,
    `Updated: ${contracts.summary.updated}`,
    `Created: ${contracts.summary.created}`
  ].join('\n');
}

function buildContractChildren(contracts) {
  const children = [
    {
      id: 'contracts-update-command',
      kind: 'action',
      label: 'Run Update Contracts',
      description: 'Accept reviewed contract changes',
      tooltip: 'Run `npx themis test --update-contracts` from the workspace root.',
      color: THEME_COLORS.review,
      icon: 'play',
      command: { id: 'themis.updateContracts' }
    }
  ];

  if (contracts.items.length === 0) {
    children.push({
      id: 'contracts-empty',
      kind: 'info',
      label: 'No contract diffs',
      description: '',
      tooltip: 'The latest run did not record contract drift or updates.',
      color: THEME_COLORS.pass,
      icon: 'pass'
    });
    return children;
  }

  for (const item of contracts.items) {
    const contractFileItem = buildOpenFileItem(`${item.id}-contract`, 'Contract file', item.contractFile, 'Open the captured contract file.');
    const sourceFileItem = buildOpenFileItem(`${item.id}-source`, 'Test file', item.file, 'Open the test file that captured this contract.');
    children.push({
      id: item.id,
      kind: 'group',
      label: `${item.status.toUpperCase()} ${item.name}`,
      description: path.basename(item.contractFile || item.file || ''),
      tooltip: [item.fullName, item.updateCommand].filter(Boolean).join('\n'),
      color: item.status === 'drifted' ? THEME_COLORS.review : THEME_COLORS.pass,
      icon: item.status === 'drifted' ? 'warning' : 'symbol-constant',
      children: [contractFileItem, sourceFileItem].filter(Boolean)
    });
  }

  return children;
}

function buildMigrationLabel(migration) {
  return `Migration Review (${migration.summary.matchedFiles})`;
}

function buildMigrationDescription(migration) {
  return `${migration.summary.convertedFiles} converted • ${migration.summary.rewrittenFiles} rewritten`;
}

function buildMigrationTooltip(migration) {
  return [
    `Source: ${migration.source || 'unknown'}`,
    `Matched files: ${migration.summary.matchedFiles}`,
    `Converted assertions: ${migration.summary.convertedAssertions}`
  ].join('\n');
}

function buildMigrationChildren(migration) {
  const children = [
    {
      id: 'migration-run-convert',
      kind: 'action',
      label: 'Run Migration Codemods',
      description: 'Run `themis migrate --convert` in this workspace',
      tooltip: 'Apply migration codemods for the current framework.',
      color: THEME_COLORS.review,
      icon: 'play',
      command: { id: 'themis.runMigrationCodemods' }
    }
  ];

  for (const entry of migration.files.slice(0, 20)) {
    const item = buildOpenFileItem(entry.id, 'Suite', entry.file, `Imports: ${entry.imports.join(', ')}`);
    if (item) {
      children.push(item);
    }
  }

  return children;
}

function buildGenerateEntryItem(entry) {
  const children = [
    buildOpenFileItem(`${entry.id}-source`, 'Source', entry.sourceFile, 'Open the source file that produced this generated test.')
  ];

  if (entry.testFile) {
    children.push(buildOpenFileItem(`${entry.id}-test`, 'Generated test', entry.testFile, 'Open the generated Themis test file.'));
  }

  if (entry.hintsFile) {
    children.push(buildOpenFileItem(`${entry.id}-hint`, 'Hint sidecar', entry.hintsFile, 'Open the hint sidecar used for this generated mapping.'));
  }

  return {
    id: entry.id,
    kind: 'group',
    label: `${entry.action.toUpperCase()} ${path.basename(entry.sourceFile)}`,
    description: `${entry.moduleKind} • ${entry.confidence}`,
    tooltip: [entry.sourceFile, entry.testFile || '(no generated test)', entry.reason || ''].filter(Boolean).join('\n'),
    color: entry.action === 'conflict' ? THEME_COLORS.review : THEME_COLORS.insight,
    icon: entry.action === 'conflict' ? 'warning' : 'symbol-event',
    children
  };
}

function buildGenerateBacklogItem(item) {
  return {
    id: item.id,
    kind: 'artifact',
    label: `${item.severity.toUpperCase()} ${path.basename(item.sourceFile)}`,
    description: item.type,
    tooltip: [item.reason, item.suggestedAction, item.suggestedCommand || ''].filter(Boolean).join('\n\n'),
    color: item.severity === 'error' ? THEME_COLORS.review : THEME_COLORS.insight,
    icon: item.severity === 'error' ? 'warning' : 'info',
    command: {
      id: 'themis.openArtifactFile',
      arguments: [
        {
          filePath: item.hintsFile || item.testFile || item.sourceFile,
          lineNumber: 1,
          columnNumber: 1
        }
      ]
    }
  };
}

function buildHintFileItems(hintFiles) {
  return [
    ...hintFiles.created.map((filePath, index) => buildOpenFileItem(`hint-created-${index}`, 'CREATED', filePath, 'Open a scaffolded hint sidecar.')),
    ...hintFiles.updated.map((filePath, index) => buildOpenFileItem(`hint-updated-${index}`, 'UPDATED', filePath, 'Open an updated hint sidecar.')),
    ...hintFiles.unchanged.map((filePath, index) => buildOpenFileItem(`hint-unchanged-${index}`, 'UNCHANGED', filePath, 'Open a reused hint sidecar.'))
  ];
}

function buildOpenFileItem(id, labelPrefix, filePath, tooltip) {
  if (!filePath) {
    return null;
  }
  return {
    id,
    kind: 'artifact',
    label: `${labelPrefix}: ${path.basename(filePath)}`,
    description: filePath,
    tooltip,
    color: resolveOpenFileColor(labelPrefix),
    icon: 'go-to-file',
    command: {
      id: 'themis.openArtifactFile',
      arguments: [
        {
          filePath,
          lineNumber: 1,
          columnNumber: 1
        }
      ]
    }
  };
}

function resolveOpenFileColor(labelPrefix) {
  if (labelPrefix === 'CREATED') {
    return THEME_COLORS.review;
  }
  if (labelPrefix === 'UPDATED') {
    return THEME_COLORS.insight;
  }
  if (labelPrefix === 'UNCHANGED') {
    return THEME_COLORS.muted;
  }
  return THEME_COLORS.insight;
}

function normalizeDelta(delta) {
  if (!delta || typeof delta !== 'object') {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0
    };
  }

  return {
    total: Number(delta.total || 0),
    passed: Number(delta.passed || 0),
    failed: Number(delta.failed || 0),
    skipped: Number(delta.skipped || 0),
    durationMs: roundDuration(delta.durationMs || 0)
  };
}

function buildStatusText(summary) {
  if (!summary) {
    return 'No Themis results yet.';
  }

  return `${summary.passed} passed • ${summary.failed} failed • ${summary.skipped} skipped • ${formatDuration(summary.durationMs)}`;
}

function buildVerdictLabel(summary, hasArtifacts) {
  if (!hasArtifacts) {
    return 'Themis is ready';
  }
  if (!summary) {
    return 'Results available';
  }
  if (summary.failed > 0) {
    return 'Action Needed';
  }
  return 'All Checks Cleared';
}

function buildComparisonLabel(comparison) {
  if (comparison.status === 'baseline') {
    return 'Baseline run';
  }

  const failures = formatSignedNumber(comparison.delta.failed);
  const duration = formatSignedDuration(comparison.delta.durationMs);
  return `Run diff ${failures} failures • ${duration}`;
}

function buildComparisonDescription(comparison) {
  if (comparison.status === 'baseline') {
    return `${comparison.newFailures.length} current failures`;
  }

  return `${comparison.newFailures.length} new • ${comparison.resolvedFailures.length} resolved`;
}

function buildComparisonTooltip(comparison) {
  return [
    `Status: ${comparison.status}`,
    `New failures: ${comparison.newFailures.length}`,
    `Resolved failures: ${comparison.resolvedFailures.length}`,
    `Passed delta: ${formatSignedNumber(comparison.delta.passed)}`,
    `Failed delta: ${formatSignedNumber(comparison.delta.failed)}`,
    `Duration delta: ${formatSignedDuration(comparison.delta.durationMs)}`
  ].join('\n');
}

function buildFailureTooltip(failure, location) {
  const parts = [failure.fullName || failure.name || 'Failure'];
  if (location) {
    parts.push(`${location.filePath}:${location.lineNumber}:${location.columnNumber}`);
  } else if (failure.file) {
    parts.push(failure.file);
  }
  if (failure.message) {
    parts.push('');
    parts.push(failure.message);
  }
  return parts.join('\n');
}

function formatDuration(value) {
  return `${roundDuration(value)}ms`;
}

function formatSignedDuration(value) {
  const rounded = roundDuration(value);
  return `${rounded > 0 ? '+' : ''}${rounded}ms`;
}

function formatSignedNumber(value) {
  const numeric = Number(value || 0);
  return `${numeric > 0 ? '+' : ''}${numeric}`;
}

function roundDuration(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  buildResultsTree,
  extractFailureLocation,
  getArtifactPaths,
  loadThemisWorkspaceState
};
