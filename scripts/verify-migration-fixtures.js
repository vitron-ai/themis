#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveArtifactDir, resolveArtifactPath } = require('../src/artifact-paths');

const rootDir = path.resolve(__dirname, '..');
const fixturesDir = path.join(rootDir, 'tests', 'fixtures', 'migration');
const proofDir = resolveArtifactDir(rootDir, 'migration', 'fixtures');

const FIXTURES = [
  {
    name: 'jest-basic',
    source: 'jest'
  },
  {
    name: 'vitest-basic',
    source: 'vitest'
  },
  {
    name: 'jest-table',
    source: 'jest'
  },
  {
    name: 'vitest-table',
    source: 'vitest'
  },
  {
    name: 'jest-rtl',
    source: 'jest'
  },
  {
    name: 'jest-timers',
    source: 'jest'
  },
  {
    name: 'vitest-timers',
    source: 'vitest'
  },
  {
    name: 'jest-module-mock',
    source: 'jest'
  },
  {
    name: 'vitest-module-mock',
    source: 'vitest'
  },
  {
    name: 'jest-rtl-provider',
    source: 'jest'
  },
  {
    name: 'vitest-rtl-provider',
    source: 'vitest'
  }
];

function main() {
  fs.rmSync(proofDir, { recursive: true, force: true });
  fs.mkdirSync(proofDir, { recursive: true });

  const results = FIXTURES.map((fixture) => verifyFixture(fixture));
  const payload = {
    schema: 'themis.migration.fixtures.v1',
    createdAt: new Date().toISOString(),
    fixtures: results
  };

  fs.writeFileSync(path.join(proofDir, 'summary.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Verified ${results.length} migration fixture(s).`);
}

function verifyFixture(fixture) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `themis-${fixture.name}-`));
  const fixtureRoot = path.join(fixturesDir, fixture.name);

  try {
    copyDirectory(fixtureRoot, tempDir);

    runCommand(tempDir, ['node', path.join(rootDir, 'bin', 'themis.js'), 'migrate', fixture.source, '--convert']);
    const report = readJson(resolveArtifactPath(tempDir, 'migrationReport'));
    if (report.source !== fixture.source) {
      throw new Error(`Expected migration source "${fixture.source}", received "${report.source}".`);
    }
    if (Number(report.summary && report.summary.convertedFiles || 0) < 1) {
      throw new Error(`Expected at least one converted file for ${fixture.name}.`);
    }

    const testRun = runCommand(tempDir, ['node', path.join(rootDir, 'bin', 'themis.js'), 'test', '--json']);
    const payload = JSON.parse(testRun.stdout);
    if (payload.summary.failed !== 0) {
      throw new Error(`Expected migrated fixture ${fixture.name} to pass under Themis.`);
    }

    const fixtureProofDir = path.join(proofDir, fixture.name);
    fs.mkdirSync(fixtureProofDir, { recursive: true });
    copyDirectory(path.join(tempDir, 'tests'), path.join(fixtureProofDir, 'tests'));
    if (fs.existsSync(path.join(tempDir, 'themis.config.json'))) {
      fs.copyFileSync(path.join(tempDir, 'themis.config.json'), path.join(fixtureProofDir, 'themis.config.json'));
    }
    fs.copyFileSync(resolveArtifactPath(tempDir, 'migrationReport'), path.join(fixtureProofDir, 'migration-report.json'));
    fs.copyFileSync(resolveArtifactPath(tempDir, 'lastRun'), path.join(fixtureProofDir, 'last-run.json'));

    return {
      name: fixture.name,
      source: fixture.source,
      summary: report.summary,
      runSummary: payload.summary
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runCommand(cwd, cmd) {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    throw new Error(
      `${cmd.join(' ')} failed in ${cwd}\n` +
      `${result.stdout || ''}\n${result.stderr || ''}`
    );
  }

  return result;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}
