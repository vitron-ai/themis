const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  testDir: 'tests',
  generatedTestsDir: path.join('__themis__', 'tests'),
  testRegex: '\\.(test|spec)\\.(js|jsx|ts|tsx)$',
  maxWorkers: Math.max(1, os.cpus().length - 1),
  reporter: 'next',
  environment: 'node',
  setupFiles: [],
  tsconfigPath: 'tsconfig.json',
  htmlReportPath: path.join('__themis__', 'reports', 'report.html'),
  testIgnore: []
};

function loadConfig(cwd) {
  const configPath = path.join(cwd, 'themis.config.json');
  if (!fs.existsSync(configPath)) {
    return {
      ...DEFAULT_CONFIG,
      setupFiles: [],
      testIgnore: []
    };
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  return normalizeConfig({ ...DEFAULT_CONFIG, ...parsed });
}

function initConfig(cwd) {
  const configPath = path.join(cwd, 'themis.config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
  }
}

function normalizeConfig(config) {
  if (!Array.isArray(config.setupFiles) || !config.setupFiles.every((entry) => typeof entry === 'string')) {
    throw new Error('Invalid config setupFiles value: expected an array of file paths.');
  }

  if (config.tsconfigPath !== null && typeof config.tsconfigPath !== 'string') {
    throw new Error('Invalid config tsconfigPath value: expected a string path or null.');
  }

  if (typeof config.generatedTestsDir !== 'string' || config.generatedTestsDir.trim().length === 0) {
    throw new Error('Invalid config generatedTestsDir value: expected a non-empty string path.');
  }

  if (typeof config.htmlReportPath !== 'string' || config.htmlReportPath.trim().length === 0) {
    throw new Error('Invalid config htmlReportPath value: expected a non-empty string path.');
  }

  if (!Array.isArray(config.testIgnore) || !config.testIgnore.every((entry) => typeof entry === 'string')) {
    throw new Error('Invalid config testIgnore value: expected an array of regex strings.');
  }

  for (const pattern of config.testIgnore) {
    try {
      new RegExp(pattern);
    } catch (error) {
      throw new Error(`Invalid config testIgnore pattern "${pattern}": ${error.message}`);
    }
  }

  return {
    ...config,
    setupFiles: [...config.setupFiles],
    testIgnore: [...config.testIgnore]
  };
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  initConfig
};
