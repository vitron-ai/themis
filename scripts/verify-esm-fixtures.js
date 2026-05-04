#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveArtifactDir } = require('../src/artifact-paths');

const rootDir = path.resolve(__dirname, '..');
const fixturesDir = path.join(rootDir, 'tests', 'fixtures', 'esm');
const proofDir = resolveArtifactDir(rootDir, 'esm', 'fixtures');

const FIXTURES = [
  { name: 'mjs-basic', expected: 2 },
  { name: 'mjs-tla', expected: 2 },
  { name: 'mjs-node-test', expected: 1 },
  { name: 'cjs-explicit', expected: 1 },
  { name: 'js-in-esm-package', expected: 1 }
];

function main() {
  fs.rmSync(proofDir, { recursive: true, force: true });
  fs.mkdirSync(proofDir, { recursive: true });

  const results = FIXTURES.map((fixture) => verifyFixture(fixture));
  const payload = {
    schema: 'themis.esm.fixtures.v1',
    createdAt: new Date().toISOString(),
    fixtures: results
  };

  fs.writeFileSync(path.join(proofDir, 'summary.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Verified ${results.length} ESM fixture(s).`);
}

function verifyFixture(fixture) {
  const fixtureRoot = path.join(fixturesDir, fixture.name);
  if (!fs.existsSync(fixtureRoot)) {
    throw new Error(`ESM fixture missing: ${fixtureRoot}`);
  }

  const result = spawnSync('node', [path.join(rootDir, 'bin', 'themis.js'), 'test'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    throw new Error(
      `themis test failed in ${fixtureRoot}\n${result.stdout || ''}\n${result.stderr || ''}`
    );
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Failed to parse json reporter output for ${fixture.name}: ${error.message}\n${result.stdout}`);
  }

  if (payload.summary.failed !== 0) {
    throw new Error(`Expected ESM fixture ${fixture.name} to pass; got ${payload.summary.failed} failure(s).`);
  }

  if (payload.summary.passed !== fixture.expected) {
    throw new Error(
      `Expected ESM fixture ${fixture.name} to report ${fixture.expected} passing test(s); got ${payload.summary.passed}.`
    );
  }

  return {
    name: fixture.name,
    summary: payload.summary
  };
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}
