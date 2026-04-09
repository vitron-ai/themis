#!/usr/bin/env node

/**
 * First-try test pass-rate benchmark.
 *
 * For each fixture source file, asks Claude to generate unit tests using
 * Themis, Vitest, and Jest, then runs each generated test and records whether
 * it passes on the first try. Outputs a JSON artifact and a markdown summary.
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY set in the environment
 *   - npm install has been run (jest, vitest, react, etc. in node_modules)
 *
 * Usage:
 *   node scripts/benchmark-first-try.js
 *   FIRST_TRY_MODEL=claude-sonnet-4-20250514 node scripts/benchmark-first-try.js
 *   FIRST_TRY_REPEATS=3 node scripts/benchmark-first-try.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveArtifactDir } = require('../src/artifact-paths');

const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(__dirname, 'benchmark-fixtures');
const ARTIFACT_DIR = resolveArtifactDir(ROOT_DIR, 'benchmarks', 'first-try');

const MODEL = process.env.FIRST_TRY_MODEL || 'claude-sonnet-4-20250514';
const REPEATS = Math.max(1, parseInt(process.env.FIRST_TRY_REPEATS || '1', 10));
const API_KEY = process.env.ANTHROPIC_API_KEY;

const THEMIS_BIN = path.join(ROOT_DIR, 'bin', 'themis.js');
const JEST_BIN = path.join(ROOT_DIR, 'node_modules', 'jest', 'bin', 'jest.js');
const VITEST_BIN = path.join(ROOT_DIR, 'node_modules', 'vitest', 'vitest.mjs');

// ---------------------------------------------------------------------------
// Framework-specific context (what Claude sees in each scenario)
// ---------------------------------------------------------------------------

const THEMIS_CONTEXT = fs.readFileSync(
  path.join(ROOT_DIR, 'templates', 'CLAUDE.themis.md'),
  'utf8'
);

const VITEST_CONTEXT = `# Testing With Vitest

This repository uses Vitest as its unit test framework.

## Commands
- Run tests: npx vitest run
- Run in watch mode: npx vitest

## Conventions
- Import test utilities from 'vitest': import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
- For React components, use @testing-library/react: import { render, screen, fireEvent } from '@testing-library/react'
- For React hooks, use @testing-library/react: import { renderHook, act } from '@testing-library/react'
- For mocking: use vi.fn(), vi.spyOn(), vi.mock()
- For fake timers: use vi.useFakeTimers(), vi.advanceTimersByTime(), vi.runAllTimers()
- For fetch mocking: use vi.stubGlobal('fetch', vi.fn())
- Test files go next to source files or under tests/ with .test.js or .test.ts extension
`;

const JEST_CONTEXT = `# Testing With Jest

This repository uses Jest as its unit test framework.

## Commands
- Run tests: npx jest
- Run in watch mode: npx jest --watch

## Conventions
- Jest globals are available: describe, it, test, expect, beforeEach, afterEach, jest
- For React components, use @testing-library/react: const { render, screen, fireEvent } = require('@testing-library/react')
- For React hooks, use @testing-library/react: const { renderHook, act } = require('@testing-library/react')
- For mocking: use jest.fn(), jest.spyOn(), jest.mock()
- For fake timers: use jest.useFakeTimers(), jest.advanceTimersByTime(), jest.runAllTimers()
- For fetch mocking: use global.fetch = jest.fn()
- Test files go next to source files or under __tests__/ with .test.js extension
`;

const FRAMEWORKS = {
  themis: {
    context: THEMIS_CONTEXT,
    testExt: '.test.js',
    configFile: 'themis.config.json',
    config: {
      testDir: '.',
      testRegex: '\\.test\\.js$',
      maxWorkers: 1,
      reporter: 'json',
      environment: 'jsdom'
    },
    run(cwd) {
      return spawnSync(process.execPath, [THEMIS_BIN, 'test', '--json', '--isolation', 'in-process'], {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CI: '1', NO_COLOR: '1' }
      });
    },
    parse(result) {
      try {
        const payload = JSON.parse(result.stdout || '{}');
        const summary = payload.summary || {};
        return {
          passed: summary.passed || 0,
          failed: summary.failed || 0,
          total: (summary.passed || 0) + (summary.failed || 0) + (summary.skipped || 0),
          syntaxError: false
        };
      } catch (_err) {
        return { passed: 0, failed: 0, total: 0, syntaxError: true };
      }
    }
  },
  vitest: {
    context: VITEST_CONTEXT,
    testExt: '.test.js',
    configFile: 'vitest.config.js',
    configContent: `import { defineConfig } from 'vitest/config';\nexport default defineConfig({\n  test: {\n    environment: 'jsdom',\n    globals: true\n  }\n});\n`,
    run(cwd) {
      return spawnSync(process.execPath, [VITEST_BIN, 'run', '--reporter=json', `--outputFile=${path.join(cwd, 'vitest-result.json')}`], {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CI: '1', NO_COLOR: '1' }
      });
    },
    parse(result, cwd) {
      try {
        const resultPath = path.join(cwd, 'vitest-result.json');
        if (!fs.existsSync(resultPath)) {
          // Vitest may also write to stdout
          const payload = JSON.parse(result.stdout || '{}');
          return extractVitestSummary(payload);
        }
        const payload = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        return extractVitestSummary(payload);
      } catch (_err) {
        return { passed: 0, failed: 0, total: 0, syntaxError: true };
      }
    }
  },
  jest: {
    context: JEST_CONTEXT,
    testExt: '.test.js',
    configFile: 'jest.config.js',
    configContent: `module.exports = {\n  testEnvironment: 'jsdom'\n};\n`,
    run(cwd) {
      return spawnSync(process.execPath, [JEST_BIN, '--runInBand', '--json', `--outputFile=${path.join(cwd, 'jest-result.json')}`], {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CI: '1', NO_COLOR: '1' }
      });
    },
    parse(result, cwd) {
      try {
        const resultPath = path.join(cwd, 'jest-result.json');
        if (!fs.existsSync(resultPath)) {
          const payload = JSON.parse(result.stdout || '{}');
          return {
            passed: Number(payload.numPassedTests || 0),
            failed: Number(payload.numFailedTests || 0),
            total: Number(payload.numTotalTests || 0),
            syntaxError: false
          };
        }
        const payload = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        return {
          passed: Number(payload.numPassedTests || 0),
          failed: Number(payload.numFailedTests || 0),
          total: Number(payload.numTotalTests || 0),
          syntaxError: false
        };
      } catch (_err) {
        return { passed: 0, failed: 0, total: 0, syntaxError: true };
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

async function callClaude(systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return stripCodeFences(text);
}

function stripCodeFences(text) {
  const fenced = text.match(/```(?:js|javascript|jsx|ts|typescript|tsx)?\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(fixturePath, frameworkName, frameworkContext) {
  const source = fs.readFileSync(fixturePath, 'utf8');
  const filename = path.basename(fixturePath);

  const system = `You are an expert test engineer. You write comprehensive, correct unit tests that pass on the first run. You output ONLY the test file contents — no explanation, no markdown fences, just valid JavaScript/JSX that can be saved directly as a .test.js file.

IMPORTANT:
- The source file is located at './${filename}' relative to the test file.
- Use require() for imports (CommonJS), not import/export, unless the framework context explicitly says otherwise.
- For React components and hooks, use require('react') and require('@testing-library/react').
- Make sure every assertion is correct. Do not write tests that will fail.
- Do not use any APIs that do not exist in the framework.`;

  const user = `Write unit tests for this source file using ${frameworkName}.

## Framework context

${frameworkContext}

## Source file: ${filename}

\`\`\`javascript
${source}
\`\`\`

Write comprehensive tests covering the main functionality, edge cases, and error cases. Output ONLY the test code.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function setupTempDir(fixturePath, frameworkName) {
  const framework = FRAMEWORKS[frameworkName];
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), `themis-first-try-${frameworkName}-`));

  // Copy fixture source into temp dir
  const filename = path.basename(fixturePath);
  fs.copyFileSync(fixturePath, path.join(tempDir, filename));

  // Symlink node_modules from repo root
  fs.symlinkSync(
    path.join(ROOT_DIR, 'node_modules'),
    path.join(tempDir, 'node_modules'),
    'junction'
  );

  // Write framework config
  if (framework.configContent) {
    fs.writeFileSync(path.join(tempDir, framework.configFile), framework.configContent, 'utf8');
  } else if (framework.config) {
    fs.writeFileSync(path.join(tempDir, framework.configFile), JSON.stringify(framework.config, null, 2), 'utf8');
  }

  // Vitest needs a package.json with type: module for ESM config
  if (frameworkName === 'vitest') {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  }

  return tempDir;
}

async function runSingleTrial(fixturePath, frameworkName) {
  const framework = FRAMEWORKS[frameworkName];
  const filename = path.basename(fixturePath);
  const testFilename = filename.replace(/\.(js|jsx|ts|tsx)$/, framework.testExt);

  const { system, user } = buildPrompt(fixturePath, frameworkName, framework.context);

  const startGen = Date.now();
  let testCode;
  try {
    testCode = await callClaude(system, user);
  } catch (err) {
    return {
      fixture: filename,
      framework: frameworkName,
      generationError: err.message,
      testCode: null,
      passed: 0,
      failed: 0,
      total: 0,
      syntaxError: false,
      generationMs: Date.now() - startGen,
      executionMs: 0
    };
  }
  const generationMs = Date.now() - startGen;

  const tempDir = setupTempDir(fixturePath, frameworkName);
  fs.writeFileSync(path.join(tempDir, testFilename), testCode, 'utf8');

  const startRun = Date.now();
  const result = framework.run(tempDir);
  const executionMs = Date.now() - startRun;

  const parsed = framework.parse(result, tempDir);

  // If tests all errored or no tests detected, check if it's a syntax/import error
  if (parsed.total === 0 && result.status !== 0) {
    parsed.syntaxError = true;
    parsed.failed = 1;
    parsed.total = 1;
  }

  // Clean up temp dir
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_err) {
    // ignore cleanup errors
  }

  return {
    fixture: filename,
    framework: frameworkName,
    generationError: null,
    testCode,
    ...parsed,
    generationMs,
    executionMs
  };
}

function extractVitestSummary(payload) {
  let passed = 0;
  let failed = 0;
  const suites = payload.testResults || [];
  for (const suite of suites) {
    const tests = suite.assertionResults || [];
    for (const t of tests) {
      if (t.status === 'passed') passed++;
      else failed++;
    }
  }
  return { passed, failed, total: passed + failed, syntaxError: false };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function renderMarkdown(payload) {
  const lines = [
    '# First-Try Test Pass-Rate Benchmark',
    '',
    `Model: \`${payload.model}\`  `,
    `Repeats per fixture: \`${payload.repeats}\`  `,
    `Date: \`${payload.createdAt}\``,
    '',
    '## Results',
    '',
    '| Fixture | Themis | Vitest | Jest |',
    '|---------|--------|--------|------|'
  ];

  for (const fixture of Object.keys(payload.byFixture)) {
    const entry = payload.byFixture[fixture];
    const cells = ['themis', 'vitest', 'jest'].map((fw) => {
      const d = entry[fw];
      if (!d) return '-';
      if (d.generationError) return 'gen error';
      if (d.syntaxError) return 'syntax error';
      return `${d.passRate}% (${d.passed}/${d.total})`;
    });
    lines.push(`| ${fixture} | ${cells.join(' | ')} |`);
  }

  lines.push('');
  lines.push('## Aggregate');
  lines.push('');
  lines.push('| Framework | Total Tests | Passed | Failed | Pass Rate |');
  lines.push('|-----------|-------------|--------|--------|-----------|');

  for (const fw of ['themis', 'vitest', 'jest']) {
    const agg = payload.aggregate[fw];
    lines.push(`| ${fw} | ${agg.total} | ${agg.passed} | ${agg.failed} | **${agg.passRate}%** |`);
  }

  lines.push('');

  const t = payload.aggregate.themis;
  const v = payload.aggregate.vitest;
  const j = payload.aggregate.jest;

  if (t.passRate > v.passRate) {
    lines.push(`Themis first-try pass rate is **${round(t.passRate - v.passRate)} percentage points higher** than Vitest.  `);
  }
  if (t.passRate > j.passRate) {
    lines.push(`Themis first-try pass rate is **${round(t.passRate - j.passRate)} percentage points higher** than Jest.  `);
  }

  lines.push('');
  return lines.join('\n');
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is required. Set it in your environment.');
    process.exit(1);
  }

  const fixtures = fs.readdirSync(FIXTURES_DIR)
    .filter((f) => /\.(js|jsx|ts|tsx)$/.test(f))
    .map((f) => path.join(FIXTURES_DIR, f))
    .sort();

  if (fixtures.length === 0) {
    console.error('No fixture files found in', FIXTURES_DIR);
    process.exit(1);
  }

  console.log(`First-try benchmark: ${fixtures.length} fixtures x 3 frameworks x ${REPEATS} repeat(s)`);
  console.log(`Model: ${MODEL}`);
  console.log('');

  const allResults = [];

  for (const fixturePath of fixtures) {
    const filename = path.basename(fixturePath);
    for (const frameworkName of ['themis', 'vitest', 'jest']) {
      for (let r = 0; r < REPEATS; r++) {
        const label = REPEATS > 1 ? ` (trial ${r + 1}/${REPEATS})` : '';
        process.stdout.write(`  ${filename} × ${frameworkName}${label}...`);
        const trial = await runSingleTrial(fixturePath, frameworkName);
        const status = trial.generationError
          ? 'gen error'
          : trial.syntaxError
            ? `syntax error`
            : `${trial.passed}/${trial.total} passed`;
        console.log(` ${status} (gen ${trial.generationMs}ms, run ${trial.executionMs}ms)`);
        allResults.push(trial);
      }
    }
  }

  // Aggregate by fixture and framework
  const byFixture = {};
  const aggregate = {
    themis: { passed: 0, failed: 0, total: 0 },
    vitest: { passed: 0, failed: 0, total: 0 },
    jest: { passed: 0, failed: 0, total: 0 }
  };

  for (const trial of allResults) {
    if (!byFixture[trial.fixture]) byFixture[trial.fixture] = {};
    if (!byFixture[trial.fixture][trial.framework]) {
      byFixture[trial.fixture][trial.framework] = {
        passed: 0, failed: 0, total: 0,
        syntaxError: false, generationError: null,
        trials: []
      };
    }

    const entry = byFixture[trial.fixture][trial.framework];
    entry.trials.push(trial);
    entry.passed += trial.passed;
    entry.failed += trial.failed;
    entry.total += trial.total;
    if (trial.syntaxError) entry.syntaxError = true;
    if (trial.generationError) entry.generationError = trial.generationError;

    aggregate[trial.framework].passed += trial.passed;
    aggregate[trial.framework].failed += trial.failed;
    aggregate[trial.framework].total += trial.total;
  }

  // Compute pass rates
  for (const fixture of Object.values(byFixture)) {
    for (const fw of Object.values(fixture)) {
      fw.passRate = fw.total > 0 ? round((fw.passed / fw.total) * 100) : 0;
    }
  }
  for (const fw of Object.values(aggregate)) {
    fw.passRate = fw.total > 0 ? round((fw.passed / fw.total) * 100) : 0;
  }

  const payload = {
    schema: 'themis.first-try-benchmark.v1',
    createdAt: new Date().toISOString(),
    model: MODEL,
    repeats: REPEATS,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    fixtures: fixtures.map((f) => path.basename(f)),
    byFixture,
    aggregate,
    trials: allResults.map((t) => ({
      fixture: t.fixture,
      framework: t.framework,
      passed: t.passed,
      failed: t.failed,
      total: t.total,
      syntaxError: t.syntaxError,
      generationError: t.generationError,
      generationMs: t.generationMs,
      executionMs: t.executionMs
    }))
  };

  const markdown = renderMarkdown(payload);

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'first-try-results.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'first-try-results.md'),
    markdown,
    'utf8'
  );

  // Also save generated test code for review
  const codeDir = path.join(ARTIFACT_DIR, 'generated-tests');
  fs.mkdirSync(codeDir, { recursive: true });
  for (const trial of allResults) {
    if (trial.testCode) {
      const name = `${trial.fixture.replace(/\.[^.]+$/, '')}.${trial.framework}.test.js`;
      fs.writeFileSync(path.join(codeDir, name), trial.testCode, 'utf8');
    }
  }

  console.log('');
  console.log(markdown);
  console.log(`Artifacts written to ${ARTIFACT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
