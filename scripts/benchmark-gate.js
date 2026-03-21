#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { runBenchmark } = require('./benchmark');

const rootDir = path.resolve(__dirname, '..');
const defaultConfigPath = path.join(rootDir, 'benchmark-gate.json');

function main() {
  const configPath = process.env.BENCH_GATE_CONFIG
    ? path.resolve(process.cwd(), process.env.BENCH_GATE_CONFIG)
    : defaultConfigPath;

  const config = loadConfig(configPath);
  const profile = resolveProfile(config.profile);
  const maxThemisAvgMs = resolveNumber(process.env.BENCH_MAX_AVG_MS, config.maxThemisAvgMs);

  if (!Number.isFinite(maxThemisAvgMs) || maxThemisAvgMs <= 0) {
    throw new Error('benchmark gate requires a positive max average threshold (BENCH_MAX_AVG_MS or benchmark-gate.json).');
  }

  const payload = runBenchmark(profile);
  const themis = payload.results.find((entry) => entry.name === 'themis');

  if (!themis) {
    throw new Error('benchmark gate could not find a themis result.');
  }

  console.log(`Benchmark gate profile: ${payload.options.files} files x ${payload.options.testsPerFile} tests, repeats=${payload.options.repeats}`);
  console.log(`Themis average: ${themis.average}ms (threshold: ${maxThemisAvgMs}ms)`);

  if (themis.average > maxThemisAvgMs) {
    console.error(`Benchmark gate failed: themis avg ${themis.average}ms exceeds ${maxThemisAvgMs}ms.`);
    process.exit(1);
  }

  console.log('Benchmark gate passed.');
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function resolveProfile(profile) {
  const resolved = {};

  resolved.files = resolveNumber(process.env.BENCH_FILES, profile?.files);
  resolved.testsPerFile = resolveNumber(process.env.BENCH_TESTS_PER_FILE, profile?.testsPerFile);
  resolved.repeats = resolveNumber(process.env.BENCH_REPEATS, profile?.repeats);
  resolved.workers = resolveNumber(process.env.BENCH_WORKERS, profile?.workers);

  if (process.env.BENCH_INCLUDE_EXTERNAL !== undefined) {
    resolved.includeExternal = process.env.BENCH_INCLUDE_EXTERNAL === '1';
  } else if (profile && Object.prototype.hasOwnProperty.call(profile, 'includeExternal')) {
    resolved.includeExternal = Boolean(profile.includeExternal);
  }

  return resolved;
}

function resolveNumber(rawValue, fallback) {
  if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
    return Number(rawValue);
  }
  if (fallback !== undefined && fallback !== null) {
    return Number(fallback);
  }
  return undefined;
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
