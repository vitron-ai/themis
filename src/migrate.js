const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, loadConfig } = require('./config');
const { ARTIFACT_RELATIVE_PATHS } = require('./artifact-paths');
const { ensureGitignoreEntries } = require('./gitignore');

const SUPPORTED_MIGRATION_SOURCES = new Set(['jest', 'vitest']);
const THEMIS_SETUP_FILE = path.join('tests', 'setup.themis.js');
const THEMIS_COMPAT_FILE = 'themis.compat.js';
const MIGRATION_REPORT_FILE = ARTIFACT_RELATIVE_PATHS.migrationReport;
const SCANNABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.themis']);
const MIGRATION_ASSIST_PATTERNS = Object.freeze([
  {
    id: 'remaining-framework-import',
    category: 'remaining-framework-import',
    severity: 'warning',
    pattern: /(?:import\s+[^;]*?from\s+['"](?:@jest\/globals|vitest|@testing-library\/react)['"]|import\s*\(\s*['"](?:@jest\/globals|vitest|@testing-library\/react)['"]\s*\)|require\(\s*['"](?:@jest\/globals|vitest|@testing-library\/react)['"]\s*\))/,
    message: 'Framework-specific imports are still present after migration scaffolding.',
    suggestion: 'Rewrite or remove remaining framework imports so the suite only depends on Themis-compatible entry points.'
  },
  {
    id: 'unsupported-helper',
    category: 'unsupported-helper',
    severity: 'warning',
    pattern: /\b(?:jest|vi)\.(?:mocked|doMock|dontMock|setMock|requireActual|requireMock|createMockFromModule|isolateModules|isolateModulesAsync|unstable_mockModule|importActual|importMock)\s*\(/,
    message: 'Unsupported Jest/Vitest helper detected.',
    suggestion: 'Replace the helper with an explicit Themis mock, fixture, or project-local test utility before relying on the migrated suite.'
  },
  {
    id: 'async-matcher-chain',
    category: 'async-matcher-chain',
    severity: 'warning',
    pattern: /\.\s*(?:resolves|rejects)\b/,
    message: 'Promise matcher chains remain in the migrated file.',
    suggestion: 'Rewrite promise assertions to explicit await-based checks so they run under Themis without framework-specific matcher chaining.'
  },
  {
    id: 'focused-alias',
    category: 'focused-alias',
    severity: 'warning',
    pattern: /\b(?:fit|xit|fdescribe|xdescribe)\s*\(/,
    message: 'Focused or excluded Jest/Vitest aliases remain in the migrated file.',
    suggestion: 'Replace focused aliases with Themis-supported describe/test forms before running the migrated suite broadly.'
  }
]);

function runMigrate(cwd, framework, options = {}) {
  const source = String(framework || '').trim().toLowerCase();
  if (!SUPPORTED_MIGRATION_SOURCES.has(source)) {
    throw new Error(`Unsupported migrate source: ${String(framework)}. Use "jest" or "vitest".`);
  }

  const projectRoot = path.resolve(cwd || process.cwd());
  const configPath = path.join(projectRoot, 'themis.config.json');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const setupPath = path.join(projectRoot, THEMIS_SETUP_FILE);
  const compatPath = path.join(projectRoot, THEMIS_COMPAT_FILE);
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

  if (!fs.existsSync(compatPath)) {
    fs.writeFileSync(compatPath, buildMigrationCompatSource(), 'utf8');
  }

  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  const gitignore = ensureGitignoreEntries(projectRoot, ['.themis/', '__themis__/reports/', '__themis__/shims/']);

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

  const scan = scanMigrationFiles(projectRoot);
  const rewriteSummary = options.rewriteImports
    ? rewriteMigrationImports(projectRoot, scan.matches, compatPath)
    : { rewrittenFiles: [], rewrittenImports: 0 };
  const conversionSummary = options.convert
    ? convertMigrationFiles(projectRoot, scan.matches)
    : { convertedFiles: [], convertedAssertions: 0, removedImports: 0 };
  const assistSummary = analyzeMigrationAssist(projectRoot, scan.matches, {
    enabled: Boolean(options.assist)
  });
  const report = buildMigrationReport(projectRoot, source, scan.matches, rewriteSummary, conversionSummary, assistSummary, {
    rewriteImports: Boolean(options.rewriteImports),
    convert: Boolean(options.convert),
    assist: Boolean(options.assist)
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    source,
    configPath,
    setupPath,
    compatPath,
    packageJsonPath: fs.existsSync(packageJsonPath) ? packageJsonPath : null,
    packageUpdated,
    gitignorePath: gitignore.path,
    gitignoreUpdated: gitignore.updated,
    reportPath,
    report,
    rewriteImports: Boolean(options.rewriteImports),
    rewrittenFiles: rewriteSummary.rewrittenFiles,
    convert: Boolean(options.convert),
    convertedFiles: conversionSummary.convertedFiles,
    assist: Boolean(options.assist),
    assistSummary
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

function buildMigrationCompatSource() {
  return `const themisCompat = {
  describe,
  test,
  it: test,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act: async (callback) => (typeof callback === 'function' ? callback() : undefined)
};

const jestLike = {
  fn,
  spyOn,
  mock,
  unmock,
  clearAllMocks,
  resetAllMocks,
  restoreAllMocks,
  useFakeTimers,
  useRealTimers,
  advanceTimersByTime,
  runAllTimers
};

module.exports = {
  ...themisCompat,
  jest: jestLike,
  vi: jestLike
};
`;
}

function scanMigrationFiles(projectRoot) {
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
    files,
    matches
  };
}

function buildMigrationReport(
  projectRoot,
  source,
  matches,
  rewriteSummary = { rewrittenFiles: [], rewrittenImports: 0 },
  conversionSummary = { convertedFiles: [], convertedAssertions: 0, removedImports: 0 },
  assistSummary = buildEmptyAssistSummary(false),
  mode = { rewriteImports: false, convert: false, assist: false }
) {
  const effectiveAssistSummary = normalizeAssistSummary(assistSummary, Boolean(mode.assist));
  return {
    schema: 'themis.migration.report.v1',
    source,
    createdAt: new Date().toISOString(),
    mode: {
      rewriteImports: Boolean(mode.rewriteImports),
      convert: Boolean(mode.convert),
      assist: Boolean(mode.assist)
    },
    summary: {
      matchedFiles: matches.length,
      jestGlobals: matches.filter((entry) => entry.imports.includes('@jest/globals')).length,
      vitest: matches.filter((entry) => entry.imports.includes('vitest')).length,
      testingLibraryReact: matches.filter((entry) => entry.imports.includes('@testing-library/react')).length,
      rewrittenFiles: Array.isArray(rewriteSummary.rewrittenFiles) ? rewriteSummary.rewrittenFiles.length : 0,
      rewrittenImports: Number(rewriteSummary.rewrittenImports || 0),
      convertedFiles: Array.isArray(conversionSummary.convertedFiles) ? conversionSummary.convertedFiles.length : 0,
      convertedAssertions: Number(conversionSummary.convertedAssertions || 0),
      removedImports: Number(conversionSummary.removedImports || 0),
      assistedFiles: Number(effectiveAssistSummary.analyzedFiles || 0),
      unresolvedFiles: Array.isArray(effectiveAssistSummary.unresolvedFiles) ? effectiveAssistSummary.unresolvedFiles.length : 0,
      findings: Array.isArray(effectiveAssistSummary.findings) ? effectiveAssistSummary.findings.length : 0,
      unsupportedPatterns: Number(effectiveAssistSummary.unsupportedPatterns || 0)
    },
    files: matches,
    nextActions: [
      'Run npx themis test to execute migrated suites under the Themis runtime.',
      ...(effectiveAssistSummary.findings.length > 0
        ? ['Resolve assistant findings in the migration report before relying on the migrated suite in CI.']
        : []),
      'Replace any unsupported Jest/Vitest-only helpers with Themis built-ins or project setup utilities.',
      'Use npx themis generate src for source-driven unit-layer coverage alongside migrated suites.'
    ],
    rewrites: Array.isArray(rewriteSummary.rewrittenFiles)
      ? rewriteSummary.rewrittenFiles
      : [],
    conversions: Array.isArray(conversionSummary.convertedFiles)
      ? conversionSummary.convertedFiles
      : [],
    assistant: effectiveAssistSummary
  };
}

function analyzeMigrationAssist(projectRoot, matches, options = {}) {
  const enabled = Boolean(options.enabled);
  if (!enabled) {
    return buildEmptyAssistSummary(false);
  }

  const findings = [];
  const unresolvedFiles = new Set();

  for (const match of matches) {
    const absoluteFile = path.join(projectRoot, match.file);
    const sourceText = fs.readFileSync(absoluteFile, 'utf8');

    for (const definition of MIGRATION_ASSIST_PATTERNS) {
      if (!definition.pattern.test(sourceText)) {
        continue;
      }
      unresolvedFiles.add(match.file);
      findings.push({
        file: match.file,
        category: definition.category,
        severity: definition.severity,
        pattern: definition.id,
        message: definition.message,
        suggestion: definition.suggestion
      });
    }
  }

  return normalizeAssistSummary(
    {
      enabled: true,
      analyzedFiles: matches.length,
      findings,
      unresolvedFiles: Array.from(unresolvedFiles).sort(),
      unsupportedPatterns: findings.length
    },
    true
  );
}

function buildEmptyAssistSummary(enabled) {
  return {
    enabled: Boolean(enabled),
    analyzedFiles: 0,
    findings: [],
    unresolvedFiles: [],
    unsupportedPatterns: 0
  };
}

function normalizeAssistSummary(summary, enabled) {
  const findings = Array.isArray(summary && summary.findings) ? summary.findings : [];
  const unresolvedFiles = Array.isArray(summary && summary.unresolvedFiles) ? summary.unresolvedFiles : [];
  return {
    enabled: Boolean(enabled),
    analyzedFiles: Number((summary && summary.analyzedFiles) || 0),
    findings,
    unresolvedFiles,
    unsupportedPatterns: Number((summary && summary.unsupportedPatterns) || findings.length)
  };
}

function convertMigrationFiles(projectRoot, matches) {
  const convertedFiles = [];
  let convertedAssertions = 0;
  let removedImports = 0;

  for (const match of matches) {
    const absoluteFile = path.join(projectRoot, match.file);
    const original = fs.readFileSync(absoluteFile, 'utf8');
    const converted = convertMigrationSourceText(original);
    if (converted.source !== original) {
      fs.writeFileSync(absoluteFile, converted.source, 'utf8');
      convertedFiles.push(match.file);
      convertedAssertions += converted.convertedAssertions;
      removedImports += converted.removedImports;
    }
  }

  return {
    convertedFiles,
    convertedAssertions,
    removedImports
  };
}

function convertMigrationSourceText(sourceText) {
  let source = sourceText;
  let convertedAssertions = 0;
  let removedImports = 0;

  source = source.replace(
    /^\s*import\s+\{[^}]*\}\s+from\s+['"]@jest\/globals['"];\s*\n?/gm,
    () => {
      removedImports += 1;
      return '';
    }
  );
  source = source.replace(
    /^\s*import\s+\{[^}]*\}\s+from\s+['"]vitest['"];\s*\n?/gm,
    () => {
      removedImports += 1;
      return '';
    }
  );
  source = source.replace(
    /^\s*import\s+\{[^}]*\}\s+from\s+['"]@testing-library\/react['"];\s*\n?/gm,
    () => {
      removedImports += 1;
      return '';
    }
  );

  const replacements = [
    { pattern: /\bit\s*\(/g, replacement: 'test(' },
    { pattern: /\btest\.only\s*\(/g, replacement: 'test(' },
    { pattern: /\bit\.only\s*\(/g, replacement: 'test(' },
    { pattern: /\btest\.skip\s*\(/g, replacement: 'test.skip(' },
    { pattern: /\bit\.skip\s*\(/g, replacement: 'test.skip(' },
    { pattern: /\.toStrictEqual\s*\(/g, replacement: '.toEqual(' },
    { pattern: /\.toContainEqual\s*\(/g, replacement: '.toContain(' },
    { pattern: /\.toBeCalledTimes\s*\(/g, replacement: '.toHaveBeenCalledTimes(' },
    { pattern: /\.toBeCalledWith\s*\(/g, replacement: '.toHaveBeenCalledWith(' },
    { pattern: /\.toBeCalled\s*\(/g, replacement: '.toHaveBeenCalled(' },
    { pattern: /\.lastCalledWith\s*\(/g, replacement: '.toHaveBeenCalledWith(' },
    { pattern: /\.toBeTruthy\s*\(\s*\)/g, replacement: '.toBeTruthy()' },
    { pattern: /\.toBeFalsy\s*\(\s*\)/g, replacement: '.toBeFalsy()' },
    { pattern: /\b(?:jest|vi)\.fn\s*\(/g, replacement: 'fn(' },
    { pattern: /\b(?:jest|vi)\.spyOn\s*\(/g, replacement: 'spyOn(' },
    { pattern: /\b(?:jest|vi)\.mock\s*\(/g, replacement: 'mock(' },
    { pattern: /\b(?:jest|vi)\.unmock\s*\(/g, replacement: 'unmock(' },
    { pattern: /\b(?:jest|vi)\.clearAllMocks\s*\(/g, replacement: 'clearAllMocks(' },
    { pattern: /\b(?:jest|vi)\.resetAllMocks\s*\(/g, replacement: 'resetAllMocks(' },
    { pattern: /\b(?:jest|vi)\.restoreAllMocks\s*\(/g, replacement: 'restoreAllMocks(' },
    { pattern: /\b(?:jest|vi)\.useFakeTimers\s*\(/g, replacement: 'useFakeTimers(' },
    { pattern: /\b(?:jest|vi)\.useRealTimers\s*\(/g, replacement: 'useRealTimers(' },
    { pattern: /\b(?:jest|vi)\.advanceTimersByTime\s*\(/g, replacement: 'advanceTimersByTime(' },
    { pattern: /\b(?:jest|vi)\.runAllTimers\s*\(/g, replacement: 'runAllTimers(' },
    { pattern: /\b(?:jest|vi)\.resetModules\s*\(/g, replacement: 'resetModules(' }
  ];

  for (const entry of replacements) {
    source = source.replace(entry.pattern, () => {
      convertedAssertions += 1;
      return typeof entry.replacement === 'function' ? entry.replacement() : entry.replacement;
    });
  }

  source = source.replace(/\n{3,}/g, '\n\n');

  return {
    source,
    convertedAssertions,
    removedImports
  };
}

function rewriteMigrationImports(projectRoot, matches, compatPath) {
  const rewrittenFiles = [];
  let rewrittenImports = 0;

  for (const match of matches) {
    const absoluteFile = path.join(projectRoot, match.file);
    const original = fs.readFileSync(absoluteFile, 'utf8');
    const compatSpecifier = toPortableRelativeSpecifier(path.relative(path.dirname(absoluteFile), compatPath));
    const rewritten = rewriteMigrationSourceText(original, compatSpecifier);
    if (rewritten.source !== original) {
      fs.writeFileSync(absoluteFile, rewritten.source, 'utf8');
      rewrittenFiles.push(match.file);
      rewrittenImports += rewritten.rewrites;
    }
  }

  return {
    rewrittenFiles,
    rewrittenImports
  };
}

function rewriteMigrationSourceText(sourceText, compatSpecifier) {
  const patterns = [
    /(['"])@jest\/globals\1/g,
    /(['"])vitest\1/g,
    /(['"])@testing-library\/react\1/g
  ];

  let rewrites = 0;
  let nextSource = sourceText;
  for (const pattern of patterns) {
    nextSource = nextSource.replace(pattern, (match, quote) => {
      rewrites += 1;
      return `${quote}${compatSpecifier}${quote}`;
    });
  }

  return {
    source: nextSource,
    rewrites
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

function toPortableRelativeSpecifier(relativePath) {
  const normalized = String(relativePath || '').split(path.sep).join('/');
  if (normalized.startsWith('.')) {
    return normalized;
  }
  return `./${normalized}`;
}

module.exports = {
  runMigrate
};
