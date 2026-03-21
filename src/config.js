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
  tsconfigPath: 'tsconfig.json'
};

function loadConfig(cwd) {
  const configPath = path.join(cwd, 'themis.config.json');
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, setupFiles: [] };
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

  return {
    ...config,
    setupFiles: [...config.setupFiles]
  };
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  initConfig
};
