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
    report: path.join(artifactDir, 'report.html')
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
  const parseErrors = [lastRun, failedTests, runDiff]
    .filter((entry) => entry.error)
    .map((entry) => ({ filePath: entry.filePath, message: entry.error }));
  const reportExists = fs.existsSync(paths.report);
  const summary = normalizeSummary(lastRun.value && lastRun.value.summary);
  const failures = normalizeFailures(failedTests.value, lastRun.value);
  const comparison = normalizeComparison(runDiff.value, lastRun.value);
  const hasArtifacts = Boolean(lastRun.exists || failedTests.exists || runDiff.exists || reportExists);

  return {
    workspaceRoot,
    paths,
    hasWorkspace: true,
    hasArtifacts,
    parseErrors,
    lastRun: lastRun.value,
    failedTestsArtifact: failedTests.value,
    runDiff: runDiff.value,
    summary,
    failures,
    comparison,
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
