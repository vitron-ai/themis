const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '.themis';
const LAST_RUN_FILE = 'last-run.json';
const FAILED_TESTS_FILE = 'failed-tests.json';
const RUN_DIFF_FILE = 'run-diff.json';
const RUN_HISTORY_FILE = 'run-history.json';
const FIX_HANDOFF_FILE = 'fix-handoff.json';
const GENERATE_MAP_FILE = 'generate-map.json';
const GENERATE_BACKLOG_FILE = 'generate-backlog.json';

function writeRunArtifacts(cwd, result) {
  const artifactDir = path.join(cwd, ARTIFACT_DIR);
  fs.mkdirSync(artifactDir, { recursive: true });

  const runPath = path.join(artifactDir, LAST_RUN_FILE);
  const previousRun = readJsonIfExists(runPath);
  const runId = createRunId(result.meta?.startedAt || new Date().toISOString());
  const comparison = buildRunComparison(previousRun, result);
  const relativePaths = {
    lastRun: path.join(ARTIFACT_DIR, LAST_RUN_FILE),
    failedTests: path.join(ARTIFACT_DIR, FAILED_TESTS_FILE),
    runDiff: path.join(ARTIFACT_DIR, RUN_DIFF_FILE),
    runHistory: path.join(ARTIFACT_DIR, RUN_HISTORY_FILE),
    fixHandoff: path.join(ARTIFACT_DIR, FIX_HANDOFF_FILE)
  };

  result.artifacts = {
    runId,
    comparison,
    paths: relativePaths
  };

  fs.writeFileSync(runPath, `${stringifyArtifact(result)}\n`, 'utf8');

  const failedTests = [];
  for (const fileEntry of result.files || []) {
    for (const test of fileEntry.tests || []) {
      if (test.status !== 'failed') {
        continue;
      }
      failedTests.push({
        file: fileEntry.file,
        name: test.name,
        fullName: test.fullName,
        durationMs: test.durationMs,
        message: test.error ? test.error.message : '',
        stack: test.error ? test.error.stack : ''
      });
    }
  }

  const failuresPayload = {
    schema: 'themis.failures.v1',
    runId,
    createdAt: new Date().toISOString(),
    summary: result.summary,
    failedTests
  };

  const failuresPath = path.join(artifactDir, FAILED_TESTS_FILE);
  fs.writeFileSync(failuresPath, `${stringifyArtifact(failuresPayload)}\n`, 'utf8');

  const diffPayload = {
    schema: 'themis.run.diff.v1',
    runId,
    ...comparison
  };
  const diffPath = path.join(artifactDir, RUN_DIFF_FILE);
  fs.writeFileSync(diffPath, `${stringifyArtifact(diffPayload)}\n`, 'utf8');

  const historyPath = path.join(artifactDir, RUN_HISTORY_FILE);
  const previousHistory = readJsonIfExists(historyPath);
  const nextHistory = Array.isArray(previousHistory) ? previousHistory.slice(-19) : [];
  nextHistory.push({
    runId,
    startedAt: result.meta?.startedAt || '',
    finishedAt: result.meta?.finishedAt || '',
    summary: result.summary,
    failedTests: failedTests.map((entry) => entry.fullName),
    comparison
  });
  fs.writeFileSync(historyPath, `${stringifyArtifact(nextHistory)}\n`, 'utf8');

  const fixHandoffPath = path.join(artifactDir, FIX_HANDOFF_FILE);
  let fixHandoff = null;
  if (failedTests.length > 0) {
    fixHandoff = buildFixHandoffPayload(cwd, result, {
      runId,
      failedTests,
      relativePaths
    });
    fs.writeFileSync(fixHandoffPath, `${stringifyArtifact(fixHandoff)}\n`, 'utf8');
  }

  return {
    runPath,
    failuresPath,
    diffPath,
    historyPath,
    fixHandoffPath,
    failuresPayload,
    comparison,
    fixHandoff
  };
}

function readFailedTestsArtifact(cwd) {
  const failuresPath = path.join(cwd, ARTIFACT_DIR, FAILED_TESTS_FILE);
  if (!fs.existsSync(failuresPath)) {
    return null;
  }

  const raw = fs.readFileSync(failuresPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      failuresPath,
      failedTests: [],
      parseError: String(error?.message || error)
    };
  }

  if (!parsed || !Array.isArray(parsed.failedTests)) {
    return {
      failuresPath,
      failedTests: [],
      parseError: 'Invalid artifact shape: expected "failedTests" to be an array'
    };
  }

  return {
    failuresPath,
    failedTests: parsed.failedTests
  };
}

function buildRunComparison(previousRun, result) {
  const currentFailures = collectFailureNames(result);
  const currentFailureSet = new Set(currentFailures);

  if (!previousRun) {
    return {
      status: 'baseline',
      previousRunId: '',
      previousRunAt: '',
      currentRunAt: result.meta?.startedAt || '',
      delta: {
        total: Number(result.summary?.total || 0),
        passed: Number(result.summary?.passed || 0),
        failed: Number(result.summary?.failed || 0),
        skipped: Number(result.summary?.skipped || 0),
        durationMs: roundDuration(result.summary?.durationMs || 0)
      },
      newFailures: currentFailures,
      resolvedFailures: []
    };
  }

  const previousFailures = collectFailureNames(previousRun);
  const previousFailureSet = new Set(previousFailures);

  return {
    status: 'changed',
    previousRunId: String(previousRun.artifacts?.runId || ''),
    previousRunAt: String(previousRun.meta?.startedAt || ''),
    currentRunAt: String(result.meta?.startedAt || ''),
    delta: {
      total: Number(result.summary?.total || 0) - Number(previousRun.summary?.total || 0),
      passed: Number(result.summary?.passed || 0) - Number(previousRun.summary?.passed || 0),
      failed: Number(result.summary?.failed || 0) - Number(previousRun.summary?.failed || 0),
      skipped: Number(result.summary?.skipped || 0) - Number(previousRun.summary?.skipped || 0),
      durationMs: roundDuration(Number(result.summary?.durationMs || 0) - Number(previousRun.summary?.durationMs || 0))
    },
    newFailures: currentFailures.filter((name) => !previousFailureSet.has(name)),
    resolvedFailures: previousFailures.filter((name) => !currentFailureSet.has(name))
  };
}

function collectFailureNames(result) {
  const names = [];
  for (const fileEntry of result.files || []) {
    for (const test of fileEntry.tests || []) {
      if (test.status === 'failed') {
        names.push(test.fullName);
      }
    }
  }
  return names.sort();
}

function createRunId(startedAt) {
  return String(startedAt || '')
    .replace(/[:.]/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function buildFixHandoffPayload(cwd, result, context) {
  const generateMap = readJsonIfExists(path.join(cwd, ARTIFACT_DIR, GENERATE_MAP_FILE));
  const generateBacklog = readJsonIfExists(path.join(cwd, ARTIFACT_DIR, GENERATE_BACKLOG_FILE));
  const mapEntries = Array.isArray(generateMap && generateMap.entries) ? generateMap.entries : [];
  const backlogItems = Array.isArray(generateBacklog && generateBacklog.items) ? generateBacklog.items : [];
  const byGeneratedTest = new Map();

  for (const entry of mapEntries) {
    if (!entry || !entry.testFile) {
      continue;
    }
    byGeneratedTest.set(path.resolve(cwd, entry.testFile), entry);
  }

  const groupedItems = new Map();
  for (const failedTest of context.failedTests) {
    const generatedEntry = byGeneratedTest.get(path.resolve(failedTest.file));
    if (!generatedEntry) {
      continue;
    }

    const reason = String(failedTest.message || '');
    const category = classifyFixCategory(reason);
    const backlogMatch = backlogItems.find((item) => item && item.sourceFile === generatedEntry.sourceFile);
    const groupKey = `${generatedEntry.testFile}:${category}`;
    if (groupedItems.has(groupKey)) {
      const existing = groupedItems.get(groupKey);
      existing.failureCount += 1;
      existing.failedTests.push(failedTest.fullName);
      continue;
    }

    groupedItems.set(groupKey, {
      file: failedTest.file,
      name: failedTest.name,
      fullName: failedTest.fullName,
      message: reason,
      testFile: generatedEntry.testFile,
      sourceFile: generatedEntry.sourceFile,
      moduleKind: generatedEntry.moduleKind,
      confidence: generatedEntry.confidence,
      scenarios: Array.isArray(generatedEntry.scenarios) ? generatedEntry.scenarios.map((scenario) => scenario.kind) : [],
      hintsFile: generatedEntry.hintsFile || (backlogMatch ? backlogMatch.hintsFile : null),
      category,
      failureCount: 1,
      failedTests: [failedTest.fullName],
      suggestedAction: resolveFixAction(category, generatedEntry, backlogMatch),
      suggestedCommand: resolveFixCommand(category, generatedEntry, backlogMatch)
    });
  }

  const items = [...groupedItems.values()];

  const summary = {
    totalFailures: Number(result.summary?.failed || 0),
    generatedFailures: items.length,
    staleSources: items.filter((item) => item.category === 'source-drift').length,
    contractFailures: items.filter((item) => item.category === 'generated-contract-failure').length
  };

  return {
    schema: 'themis.fix.handoff.v1',
    runId: context.runId,
    createdAt: new Date().toISOString(),
    summary,
    artifacts: {
      failedTests: context.relativePaths.failedTests,
      generateMap: path.join(ARTIFACT_DIR, GENERATE_MAP_FILE),
      generateBacklog: path.join(ARTIFACT_DIR, GENERATE_BACKLOG_FILE),
      fixHandoff: context.relativePaths.fixHandoff
    },
    items,
    nextActions: buildFixNextActions(summary)
  };
}

function classifyFixCategory(message) {
  const lower = String(message || '').toLowerCase();
  if (
    lower.includes('generated from source file has changed since scan')
    || (lower.includes('stale') && lower.includes('npx themis generate'))
  ) {
    return 'source-drift';
  }
  return 'generated-contract-failure';
}

function resolveFixAction(category, entry, backlogMatch) {
  if (category === 'source-drift') {
    return `Regenerate the generated test for ${entry.sourceFile}.`;
  }
  if (backlogMatch && backlogMatch.suggestedAction) {
    return backlogMatch.suggestedAction;
  }
  return `Inspect the generated contract and supporting hints for ${entry.sourceFile}.`;
}

function resolveFixCommand(category, entry, backlogMatch) {
  if (backlogMatch && backlogMatch.suggestedCommand) {
    return backlogMatch.suggestedCommand;
  }
  if (entry && entry.sourceFile) {
    return `npx themis generate ${entry.sourceFile} --update`;
  }
  return null;
}

function buildFixNextActions(summary) {
  const actions = [];
  if (summary.generatedFailures > 0) {
    actions.push('Review .themis/fix-handoff.json and start with source-drift items.');
    actions.push('Regenerate narrow targets before rerunning the full suite.');
  }
  if (summary.generatedFailures === 0) {
    actions.push('No generated-test repair work was detected in this run.');
  }
  return actions;
}

function roundDuration(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function stringifyArtifact(value) {
  return JSON.stringify(value);
}

module.exports = {
  writeRunArtifacts,
  readFailedTestsArtifact
};
