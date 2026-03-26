#!/usr/bin/env node

const { RUNNERS, runShowcaseRunner } = require('./showcase-runner');

function main() {
  const runnerName = process.argv[2];
  if (!runnerName || !RUNNERS[runnerName]) {
    throw new Error(`Usage: node scripts/verify-showcase-fixture.js <${Object.keys(RUNNERS).join('|')}>`);
  }

  const result = runShowcaseRunner(runnerName, { writeArtifacts: true });
  console.log(`${runnerName} showcase passed (${result.payload.summary.passed}/${result.payload.summary.total}) in ${result.payload.elapsedMs}ms.`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
