const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');
const { resolveArtifactDir } = require('../src/artifact-paths');

const rootDir = path.resolve(__dirname, '..');
const artifactDir = resolveArtifactDir(rootDir, 'benchmarks', 'showcase-comparison');

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

function runShowcaseRunner(runnerName, options = {}) {
  const {
    cleanArtifacts = true,
    writeArtifacts = false
  } = options;

  const runner = RUNNERS[runnerName];
  if (!runner) {
    throw new Error(`Unknown showcase runner "${runnerName}"`);
  }

  prepareFixtureArtifacts(runner.fixtureDir, cleanArtifacts);

  const startedAt = performance.now();
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
  const elapsedMs = round(performance.now() - startedAt);

  if (result.status !== 0) {
    const details = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(`${runnerName} showcase failed.\n${details}`);
  }

  const summary = runner.parse(runner.fixtureDir, result);
  const rawOutput = getRawOutput(runnerName, runner.fixtureDir, result);
  const payload = {
    ...summary,
    elapsedMs,
    command: runner.command.slice(1),
    fixtureDir: path.relative(rootDir, runner.fixtureDir).split(path.sep).join('/')
  };

  if (writeArtifacts) {
    writeRunnerArtifacts(runnerName, payload, rawOutput, runner.rawResultName);
  }

  return {
    payload,
    rawOutput
  };
}

function prepareFixtureArtifacts(fixtureDir, cleanArtifacts) {
  const fixtureArtifactDir = path.join(fixtureDir, '.themis');
  if (cleanArtifacts) {
    fs.rmSync(fixtureArtifactDir, { recursive: true, force: true });
  }
  fs.mkdirSync(fixtureArtifactDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });
}

function writeRunnerArtifacts(runnerName, payload, rawOutput, rawResultName) {
  fs.writeFileSync(path.join(artifactDir, `${runnerName}.summary.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, rawResultName), `${rawOutput}\n`, 'utf8');
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

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  artifactDir,
  rootDir,
  RUNNERS,
  runShowcaseRunner
};
