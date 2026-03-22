const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, loadConfig } = require('./config');

const SUPPORTED_MIGRATION_SOURCES = new Set(['jest', 'vitest']);
const THEMIS_SETUP_FILE = path.join('tests', 'setup.themis.js');

function runMigrate(cwd, framework) {
  const source = String(framework || '').trim().toLowerCase();
  if (!SUPPORTED_MIGRATION_SOURCES.has(source)) {
    throw new Error(`Unsupported migrate source: ${String(framework)}. Use "jest" or "vitest".`);
  }

  const projectRoot = path.resolve(cwd || process.cwd());
  const configPath = path.join(projectRoot, 'themis.config.json');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const setupPath = path.join(projectRoot, THEMIS_SETUP_FILE);

  const existingConfig = fs.existsSync(configPath) ? loadConfig(projectRoot) : { ...DEFAULT_CONFIG, setupFiles: [], testIgnore: [] };
  const nextSetupFiles = Array.isArray(existingConfig.setupFiles) ? [...existingConfig.setupFiles] : [];
  if (!nextSetupFiles.includes(THEMIS_SETUP_FILE)) {
    nextSetupFiles.push(THEMIS_SETUP_FILE);
  }

  const nextConfig = {
    ...existingConfig,
    setupFiles: nextSetupFiles
  };

  fs.mkdirSync(path.dirname(setupPath), { recursive: true });
  if (!fs.existsSync(setupPath)) {
    fs.writeFileSync(setupPath, buildMigrationSetupSource(source), 'utf8');
  }

  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');

  let packageUpdated = false;
  if (fs.existsSync(packageJsonPath)) {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = parsed.scripts && typeof parsed.scripts === 'object' ? { ...parsed.scripts } : {};
    if (!scripts['test:themis']) {
      scripts['test:themis'] = 'themis test';
      parsed.scripts = scripts;
      fs.writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
      packageUpdated = true;
    }
  }

  return {
    source,
    configPath,
    setupPath,
    packageJsonPath: fs.existsSync(packageJsonPath) ? packageJsonPath : null,
    packageUpdated
  };
}

function buildMigrationSetupSource(source) {
  return `// Themis migration bridge for ${source} suites.
// Themis runtime supports imports from "@jest/globals", "vitest",
// and "@testing-library/react" directly, so this file can stay minimal.

afterEach(() => {
  restoreAllMocks();
  cleanup();
});
`;
}

module.exports = {
  runMigrate
};
