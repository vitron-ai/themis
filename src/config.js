const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  testDir: 'tests',
  testRegex: '\\.(test|spec)\\.(js|jsx|ts|tsx)$',
  maxWorkers: Math.max(1, os.cpus().length - 1),
  reporter: 'next',
  environment: 'node',
  setupFiles: [],
  tsconfigPath: 'tsconfig.json',
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
