#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { artifactDir, runShowcaseRunner } = require('./showcase-runner');

const DEFAULTS = {
  warmups: 1,
  repeats: 5
};

const RUNNER_ORDER = ['themis', 'jest', 'vitest'];

function main() {
  const options = {
    warmups: resolvePositiveInteger('SHOWCASE_BENCH_WARMUPS', DEFAULTS.warmups),
    repeats: resolvePositiveInteger('SHOWCASE_BENCH_REPEATS', DEFAULTS.repeats)
  };

  const results = [];

  for (const runnerName of RUNNER_ORDER) {
    for (let i = 0; i < options.warmups; i += 1) {
      runShowcaseRunner(runnerName, { cleanArtifacts: true, writeArtifacts: false });
    }

    const samples = [];
    let lastPayload = null;
    for (let i = 0; i < options.repeats; i += 1) {
      const run = runShowcaseRunner(runnerName, {
        cleanArtifacts: true,
        writeArtifacts: i === options.repeats - 1
      });
      lastPayload = run.payload;
      samples.push(run.payload.elapsedMs);
    }

    results.push({
      runner: runnerName,
      fixture: lastPayload.fixture,
      summary: lastPayload.summary,
      samplesMs: samples,
      medianMs: median(samples),
      averageMs: average(samples),
      minMs: Math.min(...samples),
      maxMs: Math.max(...samples)
    });
  }

  results.sort((left, right) => left.medianMs - right.medianMs);

  const fastest = results[0] || null;
  const themis = results.find((entry) => entry.runner === 'themis') || null;
  const payload = {
    schema: 'themis.showcase.benchmark.v1',
    createdAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    options: {
      warmups: options.warmups,
      repeats: options.repeats,
      suite: 'react-showcase',
      measurement: 'median wall-clock milliseconds on clean fixture runs',
      caveat: 'Compare these results only within this single job and host; separate CI jobs are not timing-comparable.'
    },
    fastest: fastest ? fastest.runner : null,
    runners: results,
    comparisons: buildComparisons(results, fastest, themis)
  };

  const markdown = renderMarkdown(payload);
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'perf-summary.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'perf-summary.md'), markdown, 'utf8');

  console.log(markdown.trimEnd());
}

function buildComparisons(results, fastest, themis) {
  return results.map((entry) => ({
    runner: entry.runner,
    versusFastest: fastest && entry.runner !== fastest.runner
      ? diffSummary(entry.medianMs, fastest.medianMs)
      : null,
    versusThemis: themis && entry.runner !== 'themis'
      ? diffSummary(entry.medianMs, themis.medianMs)
      : null
  }));
}

function diffSummary(currentMs, baselineMs) {
  const deltaMs = round(currentMs - baselineMs);
  const deltaPercent = baselineMs > 0
    ? round(((currentMs - baselineMs) / baselineMs) * 100)
    : null;

  return {
    deltaMs,
    deltaPercent,
    relation: deltaMs === 0 ? 'equal' : deltaMs > 0 ? 'slower' : 'faster'
  };
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push('# React Showcase Runner Comparison');
  lines.push('');
  lines.push(`Measured on the same CI host with ${payload.options.warmups} warmup run(s) and ${payload.options.repeats} measured run(s) per runner.`);
  lines.push('');
  lines.push('| Runner | Tests | Median (ms) | Avg (ms) | Min (ms) | Max (ms) | vs Themis |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | --- |');

  const themis = payload.runners.find((entry) => entry.runner === 'themis') || null;
  for (const entry of payload.runners) {
    lines.push(`| ${entry.runner} | ${entry.summary.total} | ${entry.medianMs} | ${entry.averageMs} | ${entry.minMs} | ${entry.maxMs} | ${formatVersusThemis(entry, themis)} |`);
  }

  lines.push('');
  lines.push(`Fastest median runner in this job: **${payload.fastest || 'n/a'}**`);
  if (themis) {
    lines.push('');
    for (const entry of payload.runners) {
      if (entry.runner === 'themis') {
        continue;
      }
      lines.push(`- ${renderThemisComparison(entry, themis)}`);
    }
  }
  lines.push('');
  lines.push(`Samples are wall-clock CLI runs on clean fixture state. ${payload.options.caveat}`);
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function formatVersusThemis(entry, themis) {
  if (!themis || entry.runner === 'themis') {
    return 'baseline';
  }
  const comparison = diffSummary(entry.medianMs, themis.medianMs);
  return `${Math.abs(comparison.deltaPercent)}% ${comparison.relation}`;
}

function renderThemisComparison(entry, themis) {
  const comparison = diffSummary(entry.medianMs, themis.medianMs);
  if (comparison.relation === 'equal') {
    return `${entry.runner} matched Themis on median time.`;
  }
  if (comparison.relation === 'slower') {
    return `Themis was ${Math.abs(comparison.deltaPercent)}% faster than ${entry.runner} (${Math.abs(comparison.deltaMs)}ms lower median).`;
  }
  return `Themis was ${Math.abs(comparison.deltaPercent)}% slower than ${entry.runner} (${Math.abs(comparison.deltaMs)}ms higher median).`;
}

function resolvePositiveInteger(envName, fallback) {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (Number.isInteger(value) && value > 0) {
    return value;
  }
  throw new Error(`Invalid ${envName}: expected a positive integer, received "${raw}"`);
}

function average(values) {
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return round(sorted[middle]);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
