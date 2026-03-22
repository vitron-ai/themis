const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '.themis';

function getArtifactPaths(workspaceRoot) {
  if (!workspaceRoot) {
    return null;
  }

  const artifactDir = path.join(workspaceRoot, ARTIFACT_DIR);
  return {
    artifactDir,
    lastRun: path.join(artifactDir, 'last-run.json'),
    failedTests: path.join(artifactDir, 'failed-tests.json'),
    runDiff: path.join(artifactDir, 'run-diff.json'),
    report: path.join(artifactDir, 'report.html'),
    generateLast: path.join(artifactDir, 'generate-last.json'),
    generateMap: path.join(artifactDir, 'generate-map.json'),
    generateBacklog: path.join(artifactDir, 'generate-backlog.json'),
    generateHandoff: path.join(artifactDir, 'generate-handoff.json')
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
  const generateLast = readJsonArtifact(paths.generateLast);
  const generateMap = readJsonArtifact(paths.generateMap);
  const generateBacklog = readJsonArtifact(paths.generateBacklog);
  const generateHandoff = readJsonArtifact(paths.generateHandoff);
  const parseErrors = [lastRun, failedTests, runDiff, generateLast, generateMap, generateBacklog, generateHandoff]
    .filter((entry) => entry.error)
    .map((entry) => ({ filePath: entry.filePath, message: entry.error }));
  const reportExists = fs.existsSync(paths.report);
  const summary = normalizeSummary(lastRun.value && lastRun.value.summary);
  const failures = normalizeFailures(failedTests.value, lastRun.value);
  const comparison = normalizeComparison(runDiff.value, lastRun.value);
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
    generateLast: generateLast.value,
    generateMap: generateMap.value,
    generateBacklog: generateBacklog.value,
    generateHandoff: generateHandoff.value,
    summary,
    failures,
    comparison,
    generation,
    reportExists,
    statusText: buildStatusText(summary),
    verdictLabel: buildVerdictLabel(summary, hasArtifacts)
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
        icon: 'folder-opened'
      }
    ];
  }

  if (!state.hasArtifacts) {
    return [
      {
        id: 'no-results',
        kind: 'action',
        label: 'Run Themis to generate results',
        description: '',
        tooltip: 'Run `npx themis test` to create .themis artifacts.',
        icon: 'play',
        command: { id: 'themis.runTests' }
      }
    ];
  }

  const items = [
    {
      id: 'verdict',
      kind: 'summary',
      label: state.verdictLabel,
      description: state.statusText,
      tooltip: `${state.verdictLabel}\n${state.statusText}`,
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
      icon: state.comparison.status === 'baseline' ? 'pulse' : 'git-compare'
    });
  }

  items.push({
    id: 'report',
    kind: 'action',
    label: state.reportExists ? 'Open HTML report' : 'HTML report not generated yet',
    description: state.reportExists ? path.basename(state.paths.report) : '',
    tooltip: state.reportExists
      ? 'Open the interactive Themis HTML verdict report.'
      : 'Run `npx themis test --reporter html` to generate .themis/report.html.',
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
      icon: state.generation.gates && state.generation.gates.failed ? 'warning' : 'symbol-array',
      children: buildGenerationChildren(state.generation)
    });
  }

  if (state.parseErrors.length > 0) {
    items.push({
      id: 'parse-errors',
      kind: 'group',
      label: `Artifact issues (${state.parseErrors.length})`,
      description: 'Refresh or rerun tests',
      tooltip: 'One or more Themis artifact files could not be parsed.',
      icon: 'warning',
      children: state.parseErrors.map((entry, index) => ({
        id: `parse-error-${index}`,
        kind: 'error',
        label: path.basename(entry.filePath),
        description: entry.message,
        tooltip: `${entry.filePath}\n${entry.message}`,
        icon: 'warning'
      }))
    });
  }

  items.push({
    id: 'failures',
    kind: 'group',
    label: `Failures (${state.failures.length})`,
    description: state.failures.length > 0 ? 'Open a failing file' : 'No current failures',
    tooltip: state.failures.length > 0
      ? 'Open a failure to jump into the source file.'
      : 'The latest Themis run has no failing tests.',
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
            icon: 'pass'
          }
        ]
  });

  return items;
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

function readJsonArtifact(filePath) {
  if (!fs.existsSync(filePath)) {
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
  const backlog = generation.backlog.summary;
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
            icon: 'info'
          }
        ]
  });

  children.push({
    id: 'generation-backlog',
    kind: 'group',
    label: `Generation backlog (${generation.backlog.summary.total})`,
    description: generation.backlog.summary.total > 0 ? 'Resolve skips, conflicts, and low-confidence entries' : 'No generation backlog',
    tooltip: 'Unresolved generation backlog from .themis/generate-backlog.json.',
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
            icon: 'info'
          }
        ]
  });

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
  return {
    id,
    kind: 'artifact',
    label: `${labelPrefix}: ${path.basename(filePath)}`,
    description: filePath,
    tooltip,
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
