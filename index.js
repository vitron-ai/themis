const { main } = require('./src/cli');
const { collectAndRun } = require('./src/runtime');
const { runTests } = require('./src/runner');
const { discoverTests } = require('./src/discovery');
const { loadConfig, initConfig, DEFAULT_CONFIG } = require('./src/config');
const { expect } = require('./src/expect');

module.exports = {
  main,
  collectAndRun,
  runTests,
  discoverTests,
  loadConfig,
  initConfig,
  DEFAULT_CONFIG,
  expect
};
