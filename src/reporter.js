const fs = require('fs');
const path = require('path');
const { buildStabilityReport } = require('./stability');

const REPORT_LEXICONS = {
  classic: {
    pass: 'PASS',
    fail: 'FAIL',
    skip: 'SKIP',
    total: 'TOTAL',
    summaryPassWord: 'passed',
    summaryFailWord: 'failed',
    summarySkipWord: 'skipped',
    filePassWord: 'pass',
    fileFailWord: 'fail',
    fileSkipWord: 'skip'
  },
  themis: {
    pass: 'CLEAR',
    fail: 'BREACH',
    skip: 'DEFERRED',
    total: 'DOCKET',
    summaryPassWord: 'clear',
    summaryFailWord: 'breach',
    summarySkipWord: 'deferred',
    filePassWord: 'clear',
    fileFailWord: 'breach',
    fileSkipWord: 'deferred'
  }
};

function printSpec(result, options = {}) {
  const lexicon = resolveLexicon(options.lexicon);
  for (const file of result.files) {
    console.log(`\n${file.file}`);
    for (const test of file.tests) {
      const icon = test.status === 'passed' ? lexicon.pass : (test.status === 'skipped' ? lexicon.skip : lexicon.fail);
      console.log(`  ${icon} ${test.fullName} (${test.durationMs}ms)`);
      if (test.error) {
        console.log(`    ${test.error.message}`);
      }
    }
  }

  const summaryLine =
    `\n${result.summary.passed}/${result.summary.total} ${lexicon.summaryPassWord}, ` +
    `${result.summary.failed} ${lexicon.summaryFailWord}, ` +
    `${result.summary.skipped} ${lexicon.summarySkipWord} in ${result.summary.durationMs}ms`;
  if (result.summary.failed > 0) {
    console.error(summaryLine);
  } else {
    console.log(summaryLine);
  }
}

function printJson(result) {
  console.log(JSON.stringify(result));
}

function printAgent(result) {
  const failures = collectAgentFailures(result.files || []);
  const failureClusters = clusterFailures(failures);
  const stability = result.stability || buildStabilityReport([result]);
  const comparison = result.artifacts?.comparison || buildAgentComparison(result, failures);
  const artifactPaths = result.artifacts?.paths || {
    lastRun: '.themis/last-run.json',
    failedTests: '.themis/failed-tests.json',
    runDiff: '.themis/run-diff.json',
    runHistory: '.themis/run-history.json',
    fixHandoff: '.themis/fix-handoff.json',
    contractDiff: '.themis/contract-diff.json'
  };

  const payload = {
    schema: 'themis.agent.result.v1',
    meta: result.meta,
    summary: result.summary,
    failures,
    artifacts: artifactPaths,
    analysis: {
      fingerprintVersion: 'fnv1a32-message-v1',
      failureClusters,
      stability,
      comparison
    },
    hints: {
      rerunFailed: 'npx themis test --rerun-failed',
      targetedRerun: 'npx themis test --match "<regex>"',
      diffLastRun: 'cat .themis/run-diff.json',
      repairGenerated: 'cat .themis/fix-handoff.json',
      reviewContracts: 'cat .themis/contract-diff.json'
    }
  };

  console.log(JSON.stringify(payload));
}

function buildAgentComparison(result, failures) {
  return {
    status: 'baseline',
    previousRunId: '',
    previousRunAt: '',
    currentRunAt: String(result.meta?.startedAt || ''),
    delta: {
      total: Number(result.summary?.total || 0),
      passed: Number(result.summary?.passed || 0),
      failed: Number(result.summary?.failed || 0),
      skipped: Number(result.summary?.skipped || 0),
      durationMs: roundDuration(result.summary?.durationMs || 0)
    },
    newFailures: failures.map((failure) => failure.fullName),
    resolvedFailures: []
  };
}

function writeHtmlReport(result, options = {}) {
  const cwd = options.cwd || process.cwd();
  const outputPath = resolveHtmlOutputPath(cwd, options.outputPath);
  const backgroundRelativePath = ensureHtmlBackgroundAsset(outputPath, options.backgroundAssetPath);
  const reportArtRelativePath = ensureHtmlReportAsset(outputPath, options.reportAssetPath);
  const html = renderHtmlReport(result, {
    ...options,
    backgroundRelativePath,
    reportArtRelativePath
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}

function printNext(result, options = {}) {
  const lexicon = resolveLexicon(options.lexicon);
  const style = createStyle();
  const files = Array.isArray(result.files) ? result.files : [];
  const summary = result.summary || { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
  const meta = result.meta || {};
  const stability = result.stability || null;

  const allTests = [];
  for (const file of files) {
    for (const test of file.tests || []) {
      allTests.push({
        ...test,
        file: file.file
      });
    }
  }

  const slowest = [...allTests]
    .filter((test) => test.status !== 'skipped')
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    .slice(0, 5);

  const failures = allTests.filter((test) => test.status === 'failed');
  const contractItems = collectContractItems(files);
  const notableContracts = contractItems.filter((item) => item.status !== 'unchanged');

  console.log('');
  console.log(style.cyan(bannerLine('=')));
  console.log(style.bold(style.cyan('THEMIS NEXT REPORT')));
  console.log(
    `${style.dim('started')} ${meta.startedAt || 'n/a'}  ${style.dim('workers')} ${meta.maxWorkers || 'n/a'}  ${style.dim('duration')} ${formatMs(summary.durationMs)}`
  );
  console.log(style.cyan(bannerLine('-')));
  console.log(
    `${statusBadge(style, 'passed', summary.passed, lexicon)}  ` +
    `${statusBadge(style, 'failed', summary.failed, lexicon)}  ` +
    `${statusBadge(style, 'skipped', summary.skipped, lexicon)}  ${style.bold(`${lexicon.total} ${summary.total}`)}`
  );
  console.log(style.cyan(bannerLine('=')));

  if (stability && stability.runs > 1) {
    const unstableCount = Number(stability.summary?.unstable || 0);
    const stableFailCount = Number(stability.summary?.stableFail || 0);
    const stablePassCount = Number(stability.summary?.stablePass || 0);
    const gateStatus = unstableCount === 0 && stableFailCount === 0 ? style.green('STABLE') : style.red('UNSTABLE');
    console.log(style.bold('Stability Gate'));
    console.log(
      `  ${style.dim('runs')} ${stability.runs}  ` +
      `${style.dim('stable_pass')} ${stablePassCount}  ` +
      `${style.dim('stable_fail')} ${stableFailCount}  ` +
      `${style.dim('unstable')} ${unstableCount}  ` +
      `${style.bold(gateStatus)}`
    );

    if (unstableCount > 0) {
      const unstableTests = stability.tests
        .filter((entry) => entry.classification === 'unstable')
        .slice(0, 5);
      for (const entry of unstableTests) {
        console.log(`  ${style.yellow('UNSTABLE')} ${entry.fullName} ${style.dim(`[${entry.statuses.join(' -> ')}]`)}`);
      }
    }

    if (stableFailCount > 0) {
      const stableFailTests = stability.tests
        .filter((entry) => entry.classification === 'stable_fail')
        .slice(0, 5);
      for (const entry of stableFailTests) {
        console.log(`  ${style.red('STABLE_FAIL')} ${entry.fullName} ${style.dim(`[${entry.statuses.join(' -> ')}]`)}`);
      }
    }

    console.log(style.cyan(bannerLine('-')));
  }

  for (const file of files) {
    const fileStats = summarizeTests(file.tests || []);
    const fileStatus = fileStats.failed > 0 ? 'failed' : (fileStats.passed > 0 ? 'passed' : 'skipped');
    const fileDuration = roundDuration((file.tests || []).reduce((sum, test) => sum + (test.durationMs || 0), 0));

    console.log(
      `${statusTag(style, fileStatus, lexicon)} ${file.file} ` +
      `${style.dim(`(${fileStats.passed} ${lexicon.filePassWord}, ${fileStats.failed} ${lexicon.fileFailWord}, ${fileStats.skipped} ${lexicon.fileSkipWord}, ${formatMs(fileDuration)})`)}`
    );

    for (const test of file.tests || []) {
      if (test.status !== 'failed') {
        continue;
      }
      console.log(`  ${style.red(lexicon.fail)} ${test.fullName}`);
      if (test.error && test.error.message) {
        const messageLines = String(test.error.message).split('\n').slice(0, 2);
        for (const line of messageLines) {
          console.log(`    ${style.dim(line)}`);
        }
      }
    }
  }

  if (slowest.length > 0) {
    console.log('');
    console.log(style.bold('Slowest Tests'));
    for (const test of slowest) {
      console.log(`  ${padLeft(formatMs(test.durationMs), 10)}  ${test.fullName}`);
    }
  }

  if (failures.length > 0) {
    const failureClusters = clusterFailures(collectAgentFailures(files));

    if (failureClusters.length > 0) {
      console.log('');
      console.log(style.bold('Failure Clusters'));
      for (const cluster of failureClusters.slice(0, 5)) {
        const label = `${cluster.count}x ${cluster.message}`;
        console.log(`  ${style.red(cluster.fingerprint)} ${label}`);
      }
    }

    console.log('');
    console.log(style.bold(style.red('Failure Details')));
    failures.forEach((test, index) => {
      console.log(`  ${index + 1}. ${test.fullName}`);
      console.log(`     ${style.dim(test.file)}`);
      if (test.error && test.error.stack) {
        const stackLines = String(test.error.stack).split('\n').slice(0, 8);
        for (const line of stackLines) {
          console.log(`     ${style.dim(`| ${line}`)}`);
        }
      }
    });
  }

  if (notableContracts.length > 0) {
    console.log('');
    console.log(style.bold('Contract Diffs'));
    for (const item of notableContracts.slice(0, 8)) {
      const tone = item.status === 'drifted'
        ? style.red(item.status.toUpperCase())
        : (item.status === 'updated' ? style.yellow(item.status.toUpperCase()) : style.green(item.status.toUpperCase()));
      console.log(`  ${tone} ${item.fullName} :: ${item.name}`);
      console.log(`    ${style.dim(item.contractFile)}`);
      const summaryLine = formatContractDiffSummary(item.diff);
      if (summaryLine) {
        console.log(`    ${style.dim(summaryLine)}`);
      }
    }
  }

  console.log('');
  console.log(style.bold('Agent Loop Commands'));
  console.log(`  ${style.cyan('rerun failed:')} npx themis test --rerun-failed --reporter next`);
  console.log(`  ${style.cyan('targeted rerun:')} npx themis test --match \"<regex>\" --reporter next`);
  console.log(`  ${style.cyan('update contracts:')} npx themis test --update-contracts --match \"<regex>\" --reporter next`);
  console.log(style.cyan(bannerLine('=')));
}

function summarizeTests(tests) {
  const passed = tests.filter((test) => test.status === 'passed').length;
  const failed = tests.filter((test) => test.status === 'failed').length;
  const skipped = tests.filter((test) => test.status === 'skipped').length;
  return { passed, failed, skipped };
}

function statusBadge(style, kind, value, lexicon) {
  if (kind === 'passed') {
    return `${style.bold(style.green(lexicon.pass))} ${value}`;
  }
  if (kind === 'failed') {
    return `${style.bold(style.red(lexicon.fail))} ${value}`;
  }
  return `${style.bold(style.yellow(lexicon.skip))} ${value}`;
}

function statusTag(style, kind, lexicon) {
  if (kind === 'passed') {
    return style.bold(style.green(`[${lexicon.pass}]`));
  }
  if (kind === 'failed') {
    return style.bold(style.red(`[${lexicon.fail}]`));
  }
  return style.bold(style.yellow(`[${lexicon.skip}]`));
}

function resolveLexicon(name) {
  if (name && REPORT_LEXICONS[name]) {
    return REPORT_LEXICONS[name];
  }
  return REPORT_LEXICONS.classic;
}

function createStyle() {
  const enabled = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
  return {
    bold(text) {
      return applyAnsi(enabled, text, [1]);
    },
    dim(text) {
      return applyAnsi(enabled, text, [2]);
    },
    red(text) {
      return applyAnsi(enabled, text, [31]);
    },
    green(text) {
      return applyAnsi(enabled, text, [32]);
    },
    yellow(text) {
      return applyAnsi(enabled, text, [33]);
    },
    cyan(text) {
      return applyAnsi(enabled, text, [36]);
    }
  };
}

function applyAnsi(enabled, text, codes) {
  if (!enabled) {
    return text;
  }
  const open = codes.map((code) => `\x1b[${code}m`).join('');
  return `${open}${text}\x1b[0m`;
}

function bannerLine(char) {
  return char.repeat(72);
}

function formatMs(value) {
  return `${roundDuration(value)}ms`;
}

function roundDuration(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function padLeft(value, width) {
  const text = String(value);
  if (text.length >= width) {
    return text;
  }
  return `${' '.repeat(width - text.length)}${text}`;
}

function collectAgentFailures(files) {
  const failures = [];
  for (const file of files) {
    for (const test of file.tests || []) {
      if (test.status !== 'failed') {
        continue;
      }
      const message = test.error ? test.error.message : 'Unknown error';
      const stack = test.error ? test.error.stack : '';
      failures.push({
        file: file.file,
        testName: test.name,
        fullName: test.fullName,
        durationMs: test.durationMs,
        message,
        stack,
        fingerprint: computeFailureFingerprint(message)
      });
    }
  }
  return failures;
}

function collectContractItems(files) {
  const items = [];
  for (const file of files || []) {
    for (const contract of file.contracts || []) {
      items.push({
        ...contract,
        file: file.file
      });
    }
  }
  return items;
}

function formatContractDiffSummary(diff) {
  if (!diff) {
    return '';
  }
  const parts = [];
  if (Array.isArray(diff.changed) && diff.changed.length > 0) {
    parts.push(`${diff.changed.length} changed${diff.changed[0] ? ` (${diff.changed[0].path})` : ''}`);
  }
  if (Array.isArray(diff.added) && diff.added.length > 0) {
    parts.push(`${diff.added.length} added${diff.added[0] ? ` (${diff.added[0].path})` : ''}`);
  }
  if (Array.isArray(diff.removed) && diff.removed.length > 0) {
    parts.push(`${diff.removed.length} removed${diff.removed[0] ? ` (${diff.removed[0].path})` : ''}`);
  }
  return parts.join(', ');
}

function clusterFailures(failures) {
  const byFingerprint = new Map();

  for (const failure of failures) {
    let cluster = byFingerprint.get(failure.fingerprint);
    if (!cluster) {
      cluster = {
        fingerprint: failure.fingerprint,
        count: 0,
        message: normalizeFailureMessage(failure.message),
        tests: []
      };
      byFingerprint.set(failure.fingerprint, cluster);
    }
    cluster.count += 1;
    cluster.tests.push(failure.fullName);
  }

  const clusters = [...byFingerprint.values()];
  for (const cluster of clusters) {
    cluster.tests.sort();
  }

  clusters.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.fingerprint.localeCompare(b.fingerprint);
  });

  return clusters;
}

function computeFailureFingerprint(message) {
  const normalized = normalizeFailureMessage(message);
  const hash = fnv1a32(`v1|${normalized}`);
  return `f1-${hash}`;
}

function normalizeFailureMessage(message) {
  return String(message || '')
    .split('\n')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fnv1a32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function resolveHtmlOutputPath(cwd, outputPath) {
  if (!outputPath) {
    return path.join(cwd, '.themis', 'report.html');
  }
  if (path.isAbsolute(outputPath)) {
    return outputPath;
  }
  return path.join(cwd, outputPath);
}

function renderHtmlReport(result, options = {}) {
  const lexicon = resolveLexicon(options.lexicon);
  const backgroundRelativePath = options.backgroundRelativePath || null;
  const files = Array.isArray(result.files) ? result.files : [];
  const summary = result.summary || { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
  const meta = result.meta || {};
  const stability = result.stability || null;

  const allTests = [];
  for (const file of files) {
    for (const test of file.tests || []) {
      allTests.push({
        ...test,
        file: file.file
      });
    }
  }

  const slowest = [...allTests]
    .filter((test) => test.status !== 'skipped')
    .sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))
    .slice(0, 8);

  const failures = allTests.filter((test) => test.status === 'failed');
  const contractItems = collectContractItems(files);
  const notableContracts = contractItems.filter((item) => item.status !== 'unchanged');
  const failureClusters = clusterFailures(collectAgentFailures(files));
  const gateState = stability && stability.runs > 1
    ? (Number(stability.summary?.unstable || 0) === 0 && Number(stability.summary?.stableFail || 0) === 0 ? 'stable' : 'unstable')
    : null;
  const runStatus = summary.failed > 0 ? 'FAILED' : 'PASSED';
  const pageTitle = `Themis Test Report — ${runStatus} (${summary.passed}/${summary.total} passed)`;

  const summaryCards = [
    { key: 'passed', label: lexicon.pass, value: summary.passed, tone: 'pass' },
    { key: 'failed', label: lexicon.fail, value: summary.failed, tone: 'fail' },
    { key: 'skipped', label: lexicon.skip, value: summary.skipped, tone: 'skip' },
    { key: 'total', label: lexicon.total, value: summary.total, tone: 'total' }
  ]
    .map((card, index) => {
      return (
        `<article class="stat-card ${card.tone}" style="--card-index:${index};">` +
        `<div class="stat-label">${escapeHtml(String(card.label))}</div>` +
        `<div class="stat-value">${escapeHtml(String(card.value))}</div>` +
        '</article>'
      );
    })
    .join('\n');

  const stabilitySection = stability && stability.runs > 1
    ? (
      '<section class="panel">' +
      '<h2>Stability Gate</h2>' +
      `<div class="stability-grid">` +
      `<div class="chip"><span>Runs</span><strong>${escapeHtml(String(stability.runs))}</strong></div>` +
      `<div class="chip"><span>stable_pass</span><strong>${escapeHtml(String(stability.summary?.stablePass || 0))}</strong></div>` +
      `<div class="chip"><span>stable_fail</span><strong>${escapeHtml(String(stability.summary?.stableFail || 0))}</strong></div>` +
      `<div class="chip"><span>unstable</span><strong>${escapeHtml(String(stability.summary?.unstable || 0))}</strong></div>` +
      `<div class="chip gate ${gateState}"><span>Gate</span><strong>${gateState === 'stable' ? 'STABLE' : 'UNSTABLE'}</strong></div>` +
      '</div>' +
      renderStabilityHighlights(stability) +
      '</section>'
    )
    : '';

  const failureClusterSection = failureClusters.length > 0
    ? (
      '<section class="panel">' +
      '<h2>Failure Clusters</h2>' +
      `<div class="cluster-list">` +
      failureClusters.slice(0, 10).map((cluster) => {
        return (
          '<article class="cluster-item">' +
          `<div class="cluster-fingerprint">${escapeHtml(cluster.fingerprint)}</div>` +
          `<div class="cluster-message">${escapeHtml(cluster.message)}</div>` +
          `<div class="cluster-count">${escapeHtml(`${cluster.count}x`)}</div>` +
          '</article>'
        );
      }).join('\n') +
      '</div>' +
      '</section>'
    )
    : '';

  const filePanels = files.map((file, fileIndex) => {
    const fileStats = summarizeTests(file.tests || []);
    const fileStatus = fileStats.failed > 0 ? 'failed' : (fileStats.passed > 0 ? 'passed' : 'skipped');
    const fileDuration = roundDuration((file.tests || []).reduce((sum, test) => sum + Number(test.durationMs || 0), 0));
    const fileFailures = (file.tests || []).filter((test) => test.status === 'failed');
    const searchBlob = [
      file.file,
      ...(file.tests || []).map((test) => test.fullName || test.name || ''),
      ...fileFailures.map((test) => test.error?.message || ''),
    ].join(' ').toLowerCase();
    const fileTestRows = (file.tests || []).map((test) => {
      const testTone = test.status === 'passed' ? 'pass' : (test.status === 'failed' ? 'fail' : 'skip');
      const testLabel = test.status === 'passed'
        ? lexicon.pass
        : (test.status === 'failed' ? lexicon.fail : lexicon.skip);
      const errorPreview = String(test.error?.message || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map((line) => `<div class="test-error-line">${escapeHtml(line)}</div>`)
        .join('');

      return (
        `<li class="test-item ${testTone}">` +
        `<div class="test-status ${testTone}">${escapeHtml(String(testLabel))}</div>` +
        '<div class="test-main">' +
        `<div class="test-name">${escapeHtml(test.fullName || test.name || 'Unnamed test')}</div>` +
        (errorPreview ? `<div class="test-error">${errorPreview}</div>` : '') +
        '</div>' +
        `<div class="test-duration">${escapeHtml(formatMs(test.durationMs || 0))}</div>` +
        '</li>'
      );
    }).join('\n');
    const fileSummaryGrid =
      '<div class="file-summary-grid">' +
      `<div class="file-summary-chip"><span>${escapeHtml(String(lexicon.pass))}</span><strong>${escapeHtml(String(fileStats.passed))}</strong></div>` +
      `<div class="file-summary-chip"><span>${escapeHtml(String(lexicon.fail))}</span><strong>${escapeHtml(String(fileStats.failed))}</strong></div>` +
      `<div class="file-summary-chip"><span>${escapeHtml(String(lexicon.skip))}</span><strong>${escapeHtml(String(fileStats.skipped))}</strong></div>` +
      `<div class="file-summary-chip"><span>DURATION</span><strong>${escapeHtml(formatMs(fileDuration))}</strong></div>` +
      '</div>';
    const fileDetails = (file.tests || []).length > 0
      ? (
        `<details class="file-details"${fileFailures.length > 0 ? ' open' : ''}>` +
        `<summary>View tests <span>${escapeHtml(String((file.tests || []).length))}</span></summary>` +
        `<ul class="test-list">${fileTestRows}</ul>` +
        '</details>'
      )
      : '';

    return (
      `<article class="file-panel ${fileStatus}" data-file-status="${escapeHtml(fileStatus)}" data-file-search="${escapeHtml(searchBlob)}" style="--card-index:${fileIndex};">` +
      '<header class="file-header">' +
      `<div class="file-path">${escapeHtml(file.file)}</div>` +
      `<div class="file-meta">${escapeHtml(`${fileStats.passed} ${lexicon.filePassWord}, ${fileStats.failed} ${lexicon.fileFailWord}, ${fileStats.skipped} ${lexicon.fileSkipWord}, ${formatMs(fileDuration)}`)}</div>` +
      '</header>' +
      fileSummaryGrid +
      (fileFailures.length > 0
        ? `<ul class="failure-list">` +
          fileFailures.map((test) => {
            const lines = String(test.error?.message || '').split('\n').slice(0, 2).map((line) => `<div class="failure-line">${escapeHtml(line)}</div>`).join('');
            return (
              '<li class="failure-entry">' +
              `<div class="failure-name">${escapeHtml(test.fullName)}</div>` +
              lines +
              '</li>'
            );
          }).join('\n') +
          '</ul>'
        : '<div class="file-pass">No failing tests in this file.</div>') +
      fileDetails +
      '</article>'
    );
  }).join('\n');

  const slowestSection = slowest.length > 0
    ? (
      '<section class="panel">' +
      '<h2>Slowest Tests</h2>' +
      '<div class="slow-list">' +
      slowest.map((test) => {
        return (
          '<article class="slow-item">' +
          `<div class="slow-time">${escapeHtml(formatMs(test.durationMs))}</div>` +
          `<div class="slow-name">${escapeHtml(test.fullName)}</div>` +
          '</article>'
        );
      }).join('\n') +
      '</div>' +
      '</section>'
    )
    : '';

  const generatedAt = new Date().toISOString();
  const hasInteractiveFilters = files.length > 0;
  const backgroundImageLayer = backgroundRelativePath
    ? `url("${escapeCssUrl(backgroundRelativePath)}")`
    : 'none';
  const heroReportArt = options.reportArtRelativePath
    ? `<div class="hero-story-art"><img src="${escapeHtml(options.reportArtRelativePath)}" alt="" aria-hidden="true"></div>`
    : '';
  const statusLabel = runStatus === 'PASSED' ? 'Passed' : 'Action Needed';
  const statusHeadline = runStatus === 'PASSED' ? 'All Checks Cleared' : 'Failures Need Attention';
  const statusSummary = runStatus === 'PASSED'
    ? 'The run completed cleanly. Review the slowest tests and file timings below.'
    : 'The run completed with failures or instability. Use the sections below to triage quickly.';
  const quickActionsSection =
    '<section class="panel triage-panel" id="actions">' +
    '<h2>Quick Actions</h2>' +
    '<div class="action-grid">' +
    [
      {
        title: 'Update Contracts',
        description: 'Accept reviewed contract changes for a narrow slice of the suite.',
        command: 'npx themis test --update-contracts --match "<regex>" --reporter html'
      },
      {
        title: failures.length > 0 ? 'Rerun Failed' : 'Rerun Workflow',
        description: failures.length > 0
          ? 'Replay only the failing tests from the last recorded run.'
          : 'Keep the failure loop ready when the suite turns red.',
        command: 'npx themis test --rerun-failed --reporter html'
      },
      {
        title: 'Targeted Match',
        description: 'Run a narrow slice of the suite while investigating one area.',
        command: 'npx themis test --match "<regex>" --reporter html'
      },
      {
        title: 'Agent Payload',
        description: 'Emit the machine-readable verdict contract for agents and tooling.',
        command: 'npx themis test --agent'
      },
      {
        title: 'Stability Sweep',
        description: 'Repeat the suite to classify tests as stable or unstable.',
        command: 'npx themis test --stability 3 --reporter html'
      }
    ].map((action) => {
      return (
        '<article class="action-card">' +
        `<div class="action-title">${escapeHtml(action.title)}</div>` +
        `<p class="action-description">${escapeHtml(action.description)}</p>` +
        `<code class="action-command">${escapeHtml(action.command)}</code>` +
        `<button class="copy-button" type="button" data-copy-text="${escapeHtml(action.command)}">Copy</button>` +
        '</article>'
      );
    }).join('\n') +
    '</div>' +
    '</section>';
  const focusPanel = failures.length > 0
    ? (
      '<section class="panel triage-panel" id="focus">' +
      '<h2>Primary Failures</h2>' +
      '<div class="focus-list">' +
      failures.slice(0, 4).map((test) => {
        const firstLine = String(test.error?.message || 'No error message available').split('\n')[0];
        return (
          '<article class="focus-item">' +
          '<div class="focus-head">' +
          `<div class="focus-name">${escapeHtml(test.fullName)}</div>` +
          `<div class="focus-duration">${escapeHtml(formatMs(test.durationMs || 0))}</div>` +
          '</div>' +
          `<div class="focus-file">${escapeHtml(test.file || '')}</div>` +
          `<div class="focus-message">${escapeHtml(firstLine)}</div>` +
          '</article>'
        );
      }).join('\n') +
      '</div>' +
      '</section>'
    )
    : (
      '<section class="panel triage-panel" id="focus">' +
      '<h2>Clean Verdict</h2>' +
      '<div class="clean-state">' +
      '<strong>No failing tests in this run.</strong>' +
      '<p>The report is ready for speed review, stability sweeps, and artifact handoff to AI agents.</p>' +
      '</div>' +
      '</section>'
    );
  const contractDiffPanel = notableContracts.length > 0
    ? (
      '<section class="panel insight-panel" id="contracts">' +
      '<h2>Contract Diffs</h2>' +
      '<div class="cluster-list">' +
      notableContracts.slice(0, 10).map((item) => {
        return (
          '<article class="cluster-item">' +
          `<div class="cluster-fingerprint">${escapeHtml(item.status.toUpperCase())}</div>` +
          `<div class="cluster-message">${escapeHtml(`${item.fullName} :: ${item.name}`)}</div>` +
          `<div class="cluster-count">${escapeHtml(formatContractDiffSummary(item.diff) || item.contractFile)}</div>` +
          '</article>'
        );
      }).join('\n') +
      '</div>' +
      '</section>'
    )
    : '';
  const stabilityPanel = stabilitySection
    ? stabilitySection.replace('<section class="panel">', '<section class="panel insight-panel" id="stability">')
    : '';
  const failureClusterPanel = failureClusterSection
    ? failureClusterSection.replace('<section class="panel">', '<section class="panel insight-panel" id="clusters">')
    : '';
  const slowestPanel = slowestSection
    ? slowestSection.replace('<section class="panel">', '<section class="panel insight-panel" id="slowest">')
    : '';
  const insightsGrid = [stabilityPanel, failureClusterPanel, contractDiffPanel, slowestPanel].filter(Boolean).join('\n');
  const triageGrid = [quickActionsSection, focusPanel].join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root {
      --bg-1: #071521;
      --bg-2: #0f2736;
      --bg-3: #1f4a52;
      --ink: #f5f8fb;
      --ink-dim: #a0b4c2;
      --panel: rgba(7, 16, 25, 0.76);
      --panel-border: rgba(173, 214, 255, 0.2);
      --pass: #22c55e;
      --fail: #ef4444;
      --skip: #f59e0b;
      --total: #2dd4bf;
      --accent: #f97316;
      --shadow: 0 24px 48px rgba(2, 7, 12, 0.48);
    }

    * { box-sizing: border-box; }

    html {
      min-height: 100%;
      background: #050d14;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(64rem 34rem at 12% 10%, rgba(249, 115, 22, 0.18), transparent 68%),
        radial-gradient(72rem 40rem at 88% 16%, rgba(45, 212, 191, 0.16), transparent 64%),
        linear-gradient(160deg, rgba(4, 11, 18, 0.97), rgba(7, 20, 30, 0.96) 44%, rgba(8, 25, 35, 0.98));
      background-attachment: fixed;
      line-height: 1.45;
      position: relative;
      overflow-x: hidden;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background-image: ${backgroundImageLayer};
      background-repeat: no-repeat;
      background-position: center top;
      background-size: cover;
      opacity: 0.46;
      filter: saturate(1.05) contrast(1.08);
      transform: scale(1.02);
      transform-origin: center top;
    }

    body::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        linear-gradient(180deg, rgba(5, 10, 16, 0.16), rgba(5, 10, 16, 0.42) 24%, rgba(5, 10, 16, 0.82)),
        radial-gradient(circle at top, rgba(125, 211, 252, 0.08), transparent 36%);
    }

    .wrap {
      width: min(1100px, 92vw);
      margin: 1.5rem auto 3rem;
      display: grid;
      gap: 1.1rem;
      position: relative;
      z-index: 1;
    }

    .hero {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(7, 17, 28, 0.82), rgba(8, 26, 38, 0.56)),
        radial-gradient(circle at top right, rgba(45, 212, 191, 0.12), transparent 28%);
      border: 1px solid rgba(126, 188, 255, 0.22);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 1.35rem;
      backdrop-filter: blur(14px);
      animation: rise 520ms ease both;
    }

    .hero::before {
      content: "";
      position: absolute;
      inset: auto -12% 56% 38%;
      height: 14rem;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.14), transparent 66%);
      pointer-events: none;
    }

    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.1rem;
    }

    .hero-kicker {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.38rem 0.72rem;
      border-radius: 999px;
      border: 1px solid rgba(173, 214, 255, 0.22);
      background: rgba(5, 14, 22, 0.42);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #d8e9f8;
    }

    .hero-kicker::before {
      content: "";
      width: 0.52rem;
      height: 0.52rem;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--accent), #facc15);
      box-shadow: 0 0 18px rgba(249, 115, 22, 0.5);
      flex: 0 0 auto;
    }

    .hero-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 8.5rem;
      padding: 0.48rem 0.82rem;
      border-radius: 999px;
      border: 1px solid rgba(173, 214, 255, 0.18);
      background: rgba(3, 12, 19, 0.5);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .hero-status.passed {
      color: #baf7ce;
      box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.14);
    }

    .hero-status.failed {
      color: #fecaca;
      box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.14);
    }

    .hero-main {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      align-items: stretch;
    }

    .hero-copy {
      display: grid;
      gap: 1rem;
      align-content: start;
    }

    .hero-story {
      position: relative;
      overflow: hidden;
      display: grid;
      align-items: center;
      min-height: 18rem;
      padding: 1.2rem clamp(16rem, 37%, 29rem) 1.15rem 1.2rem;
      border-radius: 20px;
      border: 1px solid rgba(173, 214, 255, 0.16);
      background: linear-gradient(180deg, rgba(5, 15, 23, 0.62), rgba(5, 17, 26, 0.34));
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .hero-story::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, rgba(5, 15, 23, 0.97) 0%, rgba(5, 15, 23, 0.9) 36%, rgba(5, 15, 23, 0.54) 60%, rgba(5, 15, 23, 0.08) 100%);
    }

    .hero-story > * {
      position: relative;
      z-index: 1;
    }

    .hero-story-art {
      position: absolute;
      inset: 0.8rem 0.85rem 0.8rem auto;
      width: clamp(16rem, 39%, 30rem);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
      border-radius: 18px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(7, 18, 28, 0.48), rgba(7, 20, 31, 0.18)),
        radial-gradient(circle at 50% 30%, rgba(125, 211, 252, 0.12), transparent 60%);
    }

    .hero-story-art img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center center;
      display: block;
      opacity: 0.98;
      filter:
        drop-shadow(0 28px 38px rgba(0, 0, 0, 0.34))
        drop-shadow(0 0 28px rgba(125, 211, 252, 0.12));
      transition:
        transform 280ms ease,
        filter 280ms ease,
        opacity 280ms ease;
    }

    .hero-story-copy {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 0.82rem;
      max-width: 34rem;
    }

    .hero-brand-copy {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem 0.8rem;
    }

    .eyebrow {
      margin: 0;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .hero-wordmark {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem;
      font-size: clamp(1.05rem, 1.8vw, 1.4rem);
      line-height: 1.05;
      letter-spacing: -0.02em;
      color: #f7fbff;
    }

    .hero-wordmark span {
      display: inline-flex;
      align-items: center;
      min-height: 2rem;
      padding: 0.28rem 0.62rem;
      border-radius: 999px;
      border: 1px solid rgba(125, 211, 252, 0.24);
      background: rgba(10, 34, 49, 0.62);
      color: #83d6ff;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero-brand-summary {
      margin: 0;
      color: #9db4c6;
      font-size: 0.92rem;
    }

    .hero-copy h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3.4rem);
      letter-spacing: -0.02em;
      line-height: 0.94;
      max-width: 8ch;
      text-wrap: balance;
    }

    .hero-summary {
      margin: 0;
      max-width: 58ch;
      color: #d6e7f4;
      font-size: 1rem;
    }

    .hero-side {
      border-radius: 20px;
      border: 1px solid rgba(173, 214, 255, 0.16);
      background: linear-gradient(180deg, rgba(5, 14, 22, 0.76), rgba(6, 18, 28, 0.52));
      padding: 1.05rem;
      display: grid;
      gap: 0.9rem;
      align-content: start;
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .hero-side-label {
      margin: 0;
      color: var(--ink-dim);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .meta {
      margin-top: 0;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .meta-chip {
      display: grid;
      gap: 0.34rem;
      align-content: start;
      min-height: 5rem;
      padding: 0.78rem 0.82rem;
      border-radius: 14px;
      border: 1px solid rgba(173, 214, 255, 0.16);
      color: var(--ink-dim);
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 0.75rem;
      background: linear-gradient(180deg, rgba(6, 16, 24, 0.58), rgba(6, 18, 27, 0.34));
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease;
    }

    .meta-chip strong {
      color: #7fcfff;
      font-size: 0.7rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .meta-chip span {
      color: #dce9f5;
      font-size: 0.92rem;
      font-weight: 700;
      line-height: 1.25;
      word-break: break-word;
    }

    .hero-statline {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.7rem;
      margin-top: 0.1rem;
    }

    .hero-stat {
      padding: 0.75rem 0.82rem;
      border-radius: 16px;
      border: 1px solid rgba(173, 214, 255, 0.16);
      background: linear-gradient(180deg, rgba(5, 14, 22, 0.42), rgba(6, 18, 28, 0.24));
      color: #d8e7f4;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease;
    }

    .hero-stat strong {
      display: block;
      margin: 0 0 0.22rem;
      color: #fff;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      font-weight: 700;
      font-size: 1.2rem;
      letter-spacing: -0.03em;
    }

    .stats {
      display: grid;
      gap: 0.8rem;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .stat-card {
      position: relative;
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid var(--panel-border);
      background:
        linear-gradient(180deg, rgba(7, 16, 25, 0.78), rgba(7, 18, 28, 0.5)),
        radial-gradient(circle at top right, rgba(125, 211, 252, 0.08), transparent 34%);
      box-shadow: var(--shadow);
      padding: 1rem 1.05rem;
      animation: rise 580ms ease both;
      animation-delay: calc(60ms * var(--card-index));
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .stat-card::after {
      content: "";
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, rgba(249, 115, 22, 0.82), rgba(125, 211, 252, 0.42));
      opacity: 0.7;
    }

    .stat-label {
      font-size: 0.72rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--ink-dim);
      font-weight: 700;
    }

    .stat-value {
      margin-top: 0.28rem;
      font-size: clamp(1.15rem, 2.4vw, 1.8rem);
      font-weight: 700;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    }

    .stat-card.pass .stat-value { color: var(--pass); }
    .stat-card.fail .stat-value { color: var(--fail); }
    .stat-card.skip .stat-value { color: var(--skip); }
    .stat-card.total .stat-value { color: var(--total); }

    .panel {
      border-radius: 16px;
      border: 1px solid var(--panel-border);
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 0.95rem 1rem;
      animation: rise 640ms ease both;
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .panel h2 {
      margin: 0 0 0.6rem;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #d7e8f5;
    }

    .insights-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .triage-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
      gap: 1rem;
      align-items: start;
    }

    .triage-panel {
      min-height: 100%;
    }

    .insight-panel {
      min-height: 100%;
    }

    .insights-grid .insight-panel:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    .section-nav,
    .files-toolbar {
      border-radius: 16px;
      border: 1px solid var(--panel-border);
      background: rgba(6, 16, 24, 0.72);
      box-shadow: var(--shadow);
      padding: 0.9rem 1rem;
    }

    .section-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
    }

    .section-link,
    .filter-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.2rem;
      padding: 0.42rem 0.78rem;
      border-radius: 999px;
      border: 1px solid rgba(173, 214, 255, 0.18);
      background: rgba(5, 14, 22, 0.42);
      color: #dbe9f5;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease,
        color 180ms ease;
    }

    .section-link:hover,
    .filter-chip:hover {
      border-color: rgba(125, 211, 252, 0.36);
      background: rgba(8, 24, 35, 0.74);
    }

    .files-toolbar {
      display: grid;
      gap: 0.9rem;
    }

    .files-toolbar-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    .files-toolbar h2 {
      margin: 0;
    }

    .toolbar-count {
      color: var(--ink-dim);
      font-size: 0.8rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .toolbar-controls {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) auto;
      gap: 0.75rem;
      align-items: center;
    }

    .search-input {
      width: 100%;
      min-height: 2.8rem;
      border-radius: 14px;
      border: 1px solid rgba(173, 214, 255, 0.18);
      background: rgba(4, 13, 20, 0.72);
      color: var(--ink);
      padding: 0.72rem 0.88rem;
      font: inherit;
    }

    .search-input::placeholder {
      color: #7e96a7;
    }

    .search-input:focus {
      outline: none;
      border-color: rgba(125, 211, 252, 0.48);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
    }

    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .filter-chip.active {
      border-color: rgba(125, 211, 252, 0.42);
      background: rgba(10, 36, 54, 0.86);
      color: #ffffff;
    }

    .action-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .action-card {
      display: grid;
      gap: 0.55rem;
      padding: 0.85rem 0.9rem;
      border-radius: 14px;
      border: 1px solid rgba(173, 214, 255, 0.18);
      background:
        linear-gradient(180deg, rgba(5, 15, 23, 0.64), rgba(6, 18, 28, 0.42)),
        radial-gradient(circle at top right, rgba(125, 211, 252, 0.08), transparent 36%);
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .action-title {
      color: #f4f8fc;
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .action-description {
      margin: 0;
      color: var(--ink-dim);
      font-size: 0.82rem;
    }

    .action-command {
      display: block;
      padding: 0.65rem 0.72rem;
      border-radius: 12px;
      border: 1px solid rgba(173, 214, 255, 0.14);
      background: rgba(4, 13, 20, 0.72);
      color: #a8e0ff;
      font-size: 0.76rem;
      line-height: 1.4;
      word-break: break-word;
    }

    .copy-button {
      width: fit-content;
      min-height: 2rem;
      padding: 0.42rem 0.72rem;
      border-radius: 999px;
      border: 1px solid rgba(173, 214, 255, 0.18);
      background: rgba(8, 24, 35, 0.74);
      color: #ffffff;
      font: inherit;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease;
    }

    .copy-button:hover {
      border-color: rgba(125, 211, 252, 0.42);
      background: rgba(10, 36, 54, 0.9);
    }

    .focus-list {
      display: grid;
      gap: 0.65rem;
    }

    .focus-item,
    .clean-state {
      display: grid;
      gap: 0.34rem;
      padding: 0.82rem 0.88rem;
      border-radius: 14px;
      border: 1px solid rgba(173, 214, 255, 0.16);
      background: linear-gradient(180deg, rgba(5, 15, 23, 0.64), rgba(6, 18, 28, 0.38));
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .focus-item {
      border-color: rgba(239, 68, 68, 0.28);
      background: linear-gradient(180deg, rgba(39, 10, 13, 0.56), rgba(24, 11, 16, 0.28));
    }

    .focus-head {
      display: flex;
      gap: 0.75rem;
      justify-content: space-between;
      align-items: baseline;
    }

    .focus-name {
      color: #f8d0d0;
      font-size: 0.86rem;
      font-weight: 700;
    }

    .focus-duration {
      color: #fca5a5;
      font-size: 0.76rem;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    }

    .focus-file {
      color: #c7dceb;
      font-size: 0.75rem;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      word-break: break-all;
    }

    .focus-message,
    .clean-state p {
      color: var(--ink-dim);
      font-size: 0.82rem;
      margin: 0;
    }

    .clean-state strong {
      color: #c3f4d0;
      font-size: 0.92rem;
    }

    .stability-grid {
      display: grid;
      gap: 0.45rem;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin-bottom: 0.5rem;
    }

    .chip {
      border-radius: 12px;
      border: 1px solid rgba(173, 214, 255, 0.24);
      background: rgba(6, 14, 23, 0.54);
      padding: 0.44rem 0.55rem;
      display: grid;
      gap: 0.16rem;
    }

    .chip span {
      color: var(--ink-dim);
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .chip strong {
      font-size: 0.95rem;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    }

    .chip.gate.stable strong { color: var(--pass); }
    .chip.gate.unstable strong { color: var(--fail); }

    .stability-list {
      margin: 0;
      padding-left: 0;
      list-style: none;
      display: grid;
      gap: 0.34rem;
    }

    .stability-list li {
      border-left: 3px solid rgba(248, 113, 113, 0.72);
      padding: 0.34rem 0.5rem;
      background: rgba(6, 12, 20, 0.55);
      border-radius: 8px;
      font-size: 0.82rem;
    }

    .file-grid {
      display: grid;
      gap: 0.7rem;
    }

    .file-panel {
      border-radius: 14px;
      border: 1px solid rgba(173, 214, 255, 0.22);
      background: rgba(5, 13, 20, 0.56);
      box-shadow: var(--shadow);
      padding: 0.8rem 0.9rem;
      animation: rise 720ms ease both;
      animation-delay: calc(32ms * var(--card-index));
      transition:
        transform 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        background 220ms ease;
    }

    .file-panel.failed { border-color: rgba(239, 68, 68, 0.52); }
    .file-panel.passed { border-color: rgba(34, 197, 94, 0.45); }
    .file-panel.is-hidden { display: none; }

    .file-header {
      display: grid;
      gap: 0.35rem;
      margin-bottom: 0.5rem;
    }

    .file-path {
      font-size: 0.84rem;
      word-break: break-all;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      color: #c8dded;
    }

    .file-meta {
      color: var(--ink-dim);
      font-size: 0.78rem;
    }

    .file-pass {
      color: #9fc8ad;
      font-size: 0.82rem;
    }

    .file-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.55rem;
      margin-bottom: 0.7rem;
    }

    .file-summary-chip {
      display: grid;
      gap: 0.18rem;
      padding: 0.52rem 0.58rem;
      border-radius: 12px;
      border: 1px solid rgba(173, 214, 255, 0.14);
      background: rgba(6, 16, 24, 0.38);
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease;
    }

    .file-summary-chip span {
      color: var(--ink-dim);
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .file-summary-chip strong {
      color: #f4f8fc;
      font-size: 0.82rem;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
    }

    .failure-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.46rem;
    }

    .failure-entry {
      padding: 0.45rem 0.55rem;
      border-radius: 10px;
      background: rgba(47, 12, 12, 0.45);
      border: 1px solid rgba(252, 165, 165, 0.28);
    }

    .failure-name {
      font-weight: 600;
      font-size: 0.82rem;
      margin-bottom: 0.2rem;
    }

    .failure-line {
      font-size: 0.76rem;
      color: #f5b3b3;
    }

    .file-details {
      margin-top: 0.78rem;
      border-top: 1px solid rgba(173, 214, 255, 0.12);
      padding-top: 0.78rem;
    }

    .file-details summary {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      cursor: pointer;
      color: #e1eef9;
      font-size: 0.82rem;
      font-weight: 700;
      transition: color 180ms ease, transform 180ms ease;
    }

    .file-details summary::-webkit-details-marker {
      display: none;
    }

    .file-details summary span {
      color: #8bd7ff;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: 0.76rem;
    }

    .test-list {
      margin: 0.75rem 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.55rem;
    }

    .test-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.65rem;
      align-items: start;
      padding: 0.62rem 0.66rem;
      border-radius: 12px;
      border: 1px solid rgba(173, 214, 255, 0.12);
      background: rgba(6, 14, 23, 0.48);
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease;
    }

    .test-status {
      min-width: 4.25rem;
      padding: 0.26rem 0.42rem;
      border-radius: 999px;
      text-align: center;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid transparent;
    }

    .test-status.pass {
      color: #baf7ce;
      border-color: rgba(34, 197, 94, 0.24);
      background: rgba(14, 48, 28, 0.38);
    }

    .test-status.fail {
      color: #fecaca;
      border-color: rgba(239, 68, 68, 0.24);
      background: rgba(60, 18, 18, 0.36);
    }

    .test-status.skip {
      color: #fde68a;
      border-color: rgba(245, 158, 11, 0.22);
      background: rgba(58, 35, 8, 0.34);
    }

    .test-main {
      display: grid;
      gap: 0.28rem;
      min-width: 0;
    }

    .test-name {
      color: #e6f0f9;
      font-size: 0.8rem;
      font-weight: 600;
      word-break: break-word;
    }

    .test-duration {
      color: #8bd7ff;
      font-size: 0.74rem;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      white-space: nowrap;
    }

    .test-error {
      display: grid;
      gap: 0.16rem;
    }

    .test-error-line {
      color: #f1b5b5;
      font-size: 0.74rem;
    }

    .cluster-list,
    .slow-list {
      display: grid;
      gap: 0.45rem;
    }

    .cluster-item,
    .slow-item {
      display: grid;
      gap: 0.3rem;
      align-items: center;
      border-radius: 10px;
      border: 1px solid rgba(173, 214, 255, 0.2);
      background: rgba(6, 12, 18, 0.56);
      padding: 0.5rem 0.56rem;
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease,
        box-shadow 180ms ease;
    }

    .cluster-item {
      grid-template-columns: auto 1fr auto;
    }

    .cluster-fingerprint {
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      color: #fecaca;
      font-size: 0.72rem;
    }

    .cluster-message {
      font-size: 0.82rem;
    }

    .cluster-count {
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      color: #fca5a5;
      font-size: 0.78rem;
    }

    .slow-item {
      grid-template-columns: auto 1fr;
    }

    .slow-time {
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      color: #7dd3fc;
      font-size: 0.78rem;
      min-width: 5.8rem;
    }

    .slow-name {
      font-size: 0.82rem;
      color: #d9e7f3;
    }

    .footer {
      color: var(--ink-dim);
      font-size: 0.75rem;
      text-align: right;
      font-family: "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      padding: 0.2rem 0.15rem;
    }

    @media (hover: hover) {
      .hero-story:hover,
      .hero-side:hover,
      .stat-card:hover,
      .panel:hover,
      .action-card:hover,
      .focus-item:hover,
      .clean-state:hover,
      .file-panel:hover {
        transform: translateY(-3px);
        border-color: rgba(125, 211, 252, 0.28);
        box-shadow: 0 28px 54px rgba(2, 7, 12, 0.42);
      }

      .hero-story:hover {
        background: linear-gradient(180deg, rgba(7, 18, 28, 0.72), rgba(6, 20, 31, 0.42));
      }

      .hero-story:hover .hero-story-art img {
        transform: scale(1.03) translateY(-4px);
        filter:
          drop-shadow(0 34px 42px rgba(0, 0, 0, 0.38))
          drop-shadow(0 0 34px rgba(125, 211, 252, 0.18));
      }

      .hero-side:hover .meta-chip,
      .file-panel:hover .file-summary-chip {
        border-color: rgba(125, 211, 252, 0.22);
        background: rgba(8, 22, 33, 0.56);
      }

      .hero-stat:hover,
      .meta-chip:hover,
      .file-summary-chip:hover,
      .test-item:hover,
      .cluster-item:hover,
      .slow-item:hover {
        transform: translateY(-2px);
        border-color: rgba(125, 211, 252, 0.26);
        background: rgba(8, 24, 35, 0.68);
        box-shadow: 0 14px 28px rgba(2, 7, 12, 0.24);
      }

      .section-link:hover,
      .filter-chip:hover,
      .copy-button:hover,
      .file-details summary:hover {
        transform: translateY(-1px);
      }

      .section-link:hover,
      .filter-chip:hover {
        box-shadow: 0 10px 22px rgba(2, 7, 12, 0.22);
      }

      .copy-button:hover {
        box-shadow: 0 12px 24px rgba(2, 7, 12, 0.24);
      }

      .file-details summary:hover {
        color: #ffffff;
      }
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 980px) {
      .hero-main { grid-template-columns: 1fr; }
      .hero-story {
        min-height: 16rem;
        padding-right: clamp(13rem, 38%, 20rem);
      }
      .hero-story-copy { max-width: 30rem; }
      .meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .triage-grid { grid-template-columns: 1fr; }
      .action-grid { grid-template-columns: 1fr; }
      .toolbar-controls { grid-template-columns: 1fr; }
      .insights-grid { grid-template-columns: 1fr; }
      .file-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .stability-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .chip.gate { grid-column: span 2; }
    }

    @media (max-width: 620px) {
      .wrap { width: min(1100px, 94vw); margin-top: 1rem; }
      .hero { padding: 1rem; }
      .hero-top { flex-direction: column; align-items: stretch; }
      .hero-status { width: fit-content; }
      .hero-main { gap: 1rem; }
      .hero-brand-copy { gap: 0.34rem; }
      .hero-story {
        min-height: 0;
        padding: 0.9rem;
      }
      .hero-story-art {
        inset: 0.7rem 0.7rem auto auto;
        width: 9rem;
        height: 9rem;
      }
      .hero-story-copy { max-width: none; }
      .hero-copy h1 { font-size: clamp(1.5rem, 10vw, 2.3rem); max-width: none; }
      .meta { grid-template-columns: 1fr; }
      .meta-chip { min-height: auto; }
      .hero-statline { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .file-summary-grid { grid-template-columns: 1fr 1fr; }
      .test-item { grid-template-columns: 1fr; }
      .test-duration { white-space: normal; }
      .meta-chip { padding: 0.56rem 0.64rem; }
      .cluster-item { grid-template-columns: 1fr; }
      .slow-item { grid-template-columns: 1fr; }
      .slow-time { min-width: auto; }
      body::before { background-position: center top; opacity: 0.54; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="hero-top">
        <div class="hero-kicker">THEMIS TEST REPORT</div>
        <div class="hero-status ${runStatus === 'PASSED' ? 'passed' : 'failed'}">${escapeHtml(statusLabel)}</div>
      </div>
      <div class="hero-main">
        <div class="hero-copy">
          <div class="hero-story">
            ${heroReportArt}
            <div class="hero-story-copy">
              <div class="hero-brand-copy">
                <p class="eyebrow">Verdict Engine</p>
                <p class="hero-wordmark">Themis <span>${escapeHtml(statusLabel)}</span></p>
              </div>
              <h1>${escapeHtml(statusHeadline)}</h1>
              <p class="hero-summary">${escapeHtml(statusSummary)}</p>
              <p class="hero-brand-summary">High-signal test reporting designed for fast triage, timing review, and failure navigation.</p>
            </div>
          </div>
          <div class="hero-statline">
            <div class="hero-stat"><strong>${escapeHtml(String(summary.passed || 0))}</strong>passed</div>
            <div class="hero-stat"><strong>${escapeHtml(String(summary.failed || 0))}</strong>failed</div>
            <div class="hero-stat"><strong>${escapeHtml(String(summary.skipped || 0))}</strong>skipped</div>
            <div class="hero-stat"><strong>${escapeHtml(String(summary.total || 0))}</strong>total</div>
          </div>
          <div class="hero-side">
            <p class="hero-side-label">Run Overview</p>
            <div class="meta">
              <div class="meta-chip"><strong>Started</strong><span>${escapeHtml(meta.startedAt || 'n/a')}</span></div>
              <div class="meta-chip"><strong>Finished</strong><span>${escapeHtml(meta.finishedAt || 'n/a')}</span></div>
              <div class="meta-chip"><strong>Workers</strong><span>${escapeHtml(String(meta.maxWorkers || 'n/a'))}</span></div>
              <div class="meta-chip"><strong>Duration</strong><span>${escapeHtml(formatMs(summary.durationMs || 0))}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="stats" id="summary">
      ${summaryCards}
    </section>

    <nav class="section-nav" aria-label="Report sections">
      <a class="section-link" href="#summary">Summary</a>
      <a class="section-link" href="#triage">Triage</a>
      ${stabilityPanel ? '<a class="section-link" href="#stability">Stability</a>' : ''}
      ${failureClusterPanel ? '<a class="section-link" href="#clusters">Clusters</a>' : ''}
      ${slowestPanel ? '<a class="section-link" href="#slowest">Slowest</a>' : ''}
      <a class="section-link" href="#files">Files</a>
    </nav>

    <section class="triage-grid" id="triage">
      ${triageGrid}
    </section>

    ${insightsGrid ? `<section class="insights-grid">${insightsGrid}</section>` : ''}

    <section class="files-toolbar" id="files">
      <div class="files-toolbar-top">
        <h2>Files</h2>
        <div class="toolbar-count"><span data-files-count>${escapeHtml(String(files.length))}</span> shown</div>
      </div>
      ${hasInteractiveFilters ? `
      <div class="toolbar-controls">
        <input class="search-input" type="search" placeholder="Search files, tests, or failure text" aria-label="Search files" data-file-search-input>
        <div class="filter-row" role="group" aria-label="Filter file results">
          <button class="filter-chip active" type="button" data-file-filter="all">All</button>
          <button class="filter-chip" type="button" data-file-filter="failed">Failed</button>
          <button class="filter-chip" type="button" data-file-filter="passed">Passed</button>
          <button class="filter-chip" type="button" data-file-filter="skipped">Skipped</button>
        </div>
      </div>` : ''}
    </section>

    <section class="panel">
      <div class="file-grid">
        ${filePanels || '<article class="file-panel"><div class="file-pass">No files executed.</div></article>'}
      </div>
    </section>

    <div class="footer">generated ${escapeHtml(generatedAt)} | failures ${escapeHtml(String(failures.length))}</div>
  </main>
  <script>
    (() => {
      const cards = Array.from(document.querySelectorAll('[data-file-status]'));
      const searchInput = document.querySelector('[data-file-search-input]');
      const buttons = Array.from(document.querySelectorAll('[data-file-filter]'));
      const count = document.querySelector('[data-files-count]');
      const copyButtons = Array.from(document.querySelectorAll('[data-copy-text]'));
      let activeFilter = 'all';

      const applyFilters = () => {
        const query = (searchInput?.value || '').trim().toLowerCase();
        let visible = 0;

        cards.forEach((card) => {
          const status = card.getAttribute('data-file-status') || '';
          const haystack = card.getAttribute('data-file-search') || '';
          const matchesFilter = activeFilter === 'all' || status === activeFilter;
          const matchesQuery = !query || haystack.includes(query);
          const show = matchesFilter && matchesQuery;
          card.classList.toggle('is-hidden', !show);
          if (show) visible += 1;
        });

        if (count) count.textContent = String(visible);
      };

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          activeFilter = button.getAttribute('data-file-filter') || 'all';
          buttons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
          applyFilters();
        });
      });

      searchInput?.addEventListener('input', applyFilters);

      copyButtons.forEach((button) => {
        button.addEventListener('click', async () => {
          const text = button.getAttribute('data-copy-text') || '';
          const original = button.textContent || 'Copy';
          try {
            if (navigator.clipboard && text) {
              await navigator.clipboard.writeText(text);
              button.textContent = 'Copied';
            } else {
              button.textContent = 'Copy N/A';
            }
          } catch (error) {
            button.textContent = 'Copy N/A';
          }
          window.setTimeout(() => {
            button.textContent = original;
          }, 1400);
        });
      });

      applyFilters();
    })();
  </script>
</body>
</html>
`;
}

function renderStabilityHighlights(stability) {
  if (!stability || !Array.isArray(stability.tests)) {
    return '';
  }
  const highlights = stability.tests
    .filter((entry) => entry.classification !== 'stable_pass')
    .slice(0, 8);

  if (highlights.length === 0) {
    return '<ul class="stability-list"><li>All tracked tests remained stable across runs.</li></ul>';
  }

  return (
    '<ul class="stability-list">' +
    highlights.map((entry) => {
      return `<li><strong>${escapeHtml(entry.classification.toUpperCase())}</strong> ${escapeHtml(entry.fullName)} <span>${escapeHtml(`[${entry.statuses.join(' -> ')}]`)}</span></li>`;
    }).join('') +
    '</ul>'
  );
}

function ensureHtmlBackgroundAsset(outputPath, backgroundAssetPath) {
  const sourcePath = backgroundAssetPath || path.join(__dirname, 'assets', 'themisBg.png');
  return ensureHtmlAsset(outputPath, sourcePath, 'themis-bg');
}

function ensureHtmlReportAsset(outputPath, reportAssetPath) {
  const sourcePath = reportAssetPath || path.join(__dirname, 'assets', 'themisReport.png');
  return ensureHtmlAsset(outputPath, sourcePath, 'themis-report');
}

function ensureHtmlAsset(outputPath, sourcePath, name) {
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  const outputDir = path.dirname(outputPath);
  const extension = path.extname(sourcePath) || '.png';
  const destinationPath = path.join(outputDir, `${name}${extension}`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return path.basename(destinationPath);
}

function escapeCssUrl(value) {
  return String(value).replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  printSpec,
  printJson,
  printAgent,
  printNext,
  writeHtmlReport
};
