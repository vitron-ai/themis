const { main } = require('./src/cli');
const { collectAndRun } = require('./src/runtime');
const { runTests } = require('./src/runner');
const { discoverTests } = require('./src/discovery');
const { loadConfig, initConfig, DEFAULT_CONFIG } = require('./src/config');
const { runMigrate } = require('./src/migrate');
const { expect } = require('./src/expect');
const {
  generateTestsFromSource,
  buildGeneratePayload,
  buildGenerateBacklogPayload,
  buildGenerateHandoff,
  writeGenerateArtifacts
} = require('./src/generate');

module.exports = {
  main,
  collectAndRun,
  runTests,
  discoverTests,
  loadConfig,
  initConfig,
  runMigrate,
  DEFAULT_CONFIG,
  generateTestsFromSource,
  buildGeneratePayload,
  buildGenerateBacklogPayload,
  buildGenerateHandoff,
  writeGenerateArtifacts,
  expect
};
