#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const artifactDir = path.join(rootDir, '.themis', 'showcase-comparison');

const RUNNERS = {
  themis: {
    fixtureDir: path.join(rootDir, 'tests', 'fixtures', 'showcase', 'themis-react'),
    command: [
      process.execPath,
      path.join(rootDir, 'bin', 'themis.js'),
      'test',
      '--json',
      '--isolation',
      'in-process'
    ],
    rawResultName: 'themis.raw.json',
    parse(cwd, result) {
      const payload = JSON.parse(result.stdout || '{}');
      if (!payload.summary || payload.summary.failed !== 0) {
        throw new Error('Themis showcase fixture reported failures.');
      }
      return {
        runner: 'themis',
        fixture: 'themis-react',
        summary: payload.summary
      };
    }
  },
  jest: {
    fixtureDir: path.join(rootDir, 'tests', 'fixtures', 'showcase', 'jest-react'),
    command: [
      process.execPath,
      path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js'),
      '--runInBand',
      '--json',
      '--outputFile=.themis/jest-result.json'
    ],
    rawResultName: 'jest.raw.json',
    parse(cwd) {
      const payload = JSON.parse(fs.readFileSync(path.join(cwd, '.themis', 'jest-result.json'), 'utf8'));
      if (Number(payload.numFailedTests || 0) !== 0) {
        throw new Error('Jest showcase fixture reported failures.');
      }
      return {
        runner: 'jest',
        fixture: 'jest-react',
        summary: {
          passed: Number(payload.numPassedTests || 0),
          failed: Number(payload.numFailedTests || 0),
          total: Number(payload.numTotalTests || 0)
        }
      };
    }
  },
  vitest: {
    fixtureDir: path.join(rootDir, 'tests', 'fixtures', 'showcase', 'vitest-react'),
    command: [
      process.execPath,
      path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      '--reporter=json',
      '--outputFile=.themis/vitest-result.json'
    ],
    rawResultName: 'vitest.raw.json',
    parse(cwd) {
      const payload = JSON.parse(fs.readFileSync(path.join(cwd, '.themis', 'vitest-result.json'), 'utf8'));
      const summary = extractVitestSummary(payload);
      if (summary.failed !== 0) {
        throw new Error('Vitest showcase fixture reported failures.');
      }
      return {
        runner: 'vitest',
        fixture: 'vitest-react',
        summary
      };
    }
  }
};

function main() {
  const runnerName = process.argv[2];
  if (!runnerName || !RUNNERS[runnerName]) {
    throw new Error(`Usage: node scripts/verify-showcase-fixture.js <${Object.keys(RUNNERS).join('|')}>`);
  }

  const runner = RUNNERS[runnerName];
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.mkdirSync(path.join(runner.fixtureDir, '.themis'), { recursive: true });

  const result = spawnSync(runner.command[0], runner.command.slice(1), {
    cwd: runner.fixtureDir,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      CI: '1',
      NO_COLOR: '1'
    }
  });

  if (result.status !== 0) {
    throw new Error(
      `${runnerName} showcase failed.\n` +
      `${result.stdout || ''}\n${result.stderr || ''}`
    );
  }

  const summary = runner.parse(runner.fixtureDir, result);
  const rawOutput = getRawOutput(runnerName, runner.fixtureDir, result);

  fs.writeFileSync(path.join(artifactDir, `${runnerName}.summary.json`), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, runner.rawResultName), `${rawOutput}\n`, 'utf8');
  console.log(`${runnerName} showcase passed (${summary.summary.passed}/${summary.summary.total}).`);
}

function getRawOutput(runnerName, fixtureDir, result) {
  if (runnerName === 'themis') {
    return (result.stdout || '').trim();
  }
  if (runnerName === 'jest') {
    return fs.readFileSync(path.join(fixtureDir, '.themis', 'jest-result.json'), 'utf8').trim();
  }
  return fs.readFileSync(path.join(fixtureDir, '.themis', 'vitest-result.json'), 'utf8').trim();
}

function extractVitestSummary(payload) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.numTotalTests === 'number') {
      return {
        passed: Number(payload.numPassedTests || 0),
        failed: Number(payload.numFailedTests || 0),
        total: Number(payload.numTotalTests || 0)
      };
    }

    if (Array.isArray(payload.testResults)) {
      let passed = 0;
      let failed = 0;
      for (const suite of payload.testResults) {
        const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];
        for (const assertion of assertions) {
          if (assertion.status === 'passed') {
            passed += 1;
          } else if (assertion.status === 'failed') {
            failed += 1;
          }
        }
      }
      return {
        passed,
        failed,
        total: passed + failed
      };
    }
  }

  return {
    passed: 0,
    failed: 0,
    total: 0
  };
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
