const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, loadConfig } = require('./config');

const SUPPORTED_MIGRATION_SOURCES = new Set(['jest', 'vitest']);
const THEMIS_SETUP_FILE = path.join('tests', 'setup.themis.js');
const MIGRATION_REPORT_FILE = path.join('.themis', 'migration-report.json');
const SCANNABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.themis']);

function runMigrate(cwd, framework) {
  const source = String(framework || '').trim().toLowerCase();
  if (!SUPPORTED_MIGRATION_SOURCES.has(source)) {
    throw new Error(`Unsupported migrate source: ${String(framework)}. Use "jest" or "vitest".`);
  }

  const projectRoot = path.resolve(cwd || process.cwd());
  const configPath = path.join(projectRoot, 'themis.config.json');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const setupPath = path.join(projectRoot, THEMIS_SETUP_FILE);
  const reportPath = path.join(projectRoot, MIGRATION_REPORT_FILE);

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

  const report = buildMigrationReport(projectRoot, source);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    source,
    configPath,
    setupPath,
    packageJsonPath: fs.existsSync(packageJsonPath) ? packageJsonPath : null,
    packageUpdated,
    reportPath,
    report
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

function buildMigrationReport(projectRoot, source) {
  const files = [];
  walkProject(projectRoot, files);
  const matches = [];

  for (const file of files) {
    const sourceText = fs.readFileSync(file, 'utf8');
    const relativeFile = path.relative(projectRoot, file).split(path.sep).join('/');
    const detected = detectMigrationImports(sourceText);
    if (detected.length === 0) {
      continue;
    }

    matches.push({
      file: relativeFile,
      imports: detected
    });
  }

  return {
    schema: 'themis.migration.report.v1',
    source,
    createdAt: new Date().toISOString(),
    summary: {
      matchedFiles: matches.length,
      jestGlobals: matches.filter((entry) => entry.imports.includes('@jest/globals')).length,
      vitest: matches.filter((entry) => entry.imports.includes('vitest')).length,
      testingLibraryReact: matches.filter((entry) => entry.imports.includes('@testing-library/react')).length
    },
    files: matches,
    nextActions: [
      'Run npx themis test to execute migrated suites under the Themis runtime.',
      'Replace any unsupported Jest/Vitest-only helpers with Themis built-ins or project setup utilities.',
      'Use npx themis generate src for source-driven unit-layer coverage alongside migrated suites.'
    ]
  };
}

function walkProject(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walkProject(path.join(dir, entry.name), files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!SCANNABLE_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push(path.join(dir, entry.name));
  }
}

function detectMigrationImports(sourceText) {
  const matches = [];
  if (hasModuleReference(sourceText, '@jest/globals')) {
    matches.push('@jest/globals');
  }
  if (hasModuleReference(sourceText, 'vitest')) {
    matches.push('vitest');
  }
  if (hasModuleReference(sourceText, '@testing-library/react')) {
    matches.push('@testing-library/react');
  }
  return matches;
}

function hasModuleReference(sourceText, moduleName) {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:import\\s+[^;]*?from\\s+['"]${escaped}['"]|import\\s*\\(\\s*['"]${escaped}['"]\\s*\\)|require\\(\\s*['"]${escaped}['"]\\s*\\))`).test(sourceText);
}

module.exports = {
  runMigrate
};
