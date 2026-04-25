const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, loadConfig } = require('./config');
const { ARTIFACT_RELATIVE_PATHS } = require('./artifact-paths');
const { ensureGitignoreEntries } = require('./gitignore');

const SUPPORTED_MIGRATION_SOURCES = new Set(['jest', 'vitest', 'node']);
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
    pattern: /(?:import\s+[^;]*?from\s+['"](?:@jest\/globals|vitest|@testing-library\/react|node:test|node:assert(?:\/strict)?)['"]|import\s*\(\s*['"](?:@jest\/globals|vitest|@testing-library\/react|node:test|node:assert(?:\/strict)?)['"]\s*\)|require\(\s*['"](?:@jest\/globals|vitest|@testing-library\/react|node:test|node:assert(?:\/strict)?)['"]\s*\))/,
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
    id: 'node-test-context',
    category: 'unsupported-helper',
    severity: 'warning',
    pattern: /\bt\.(?:mock|diagnostic|signal|name|fullName|filePath|skip|todo|runOnly)\b/,
    message: 'Node test context (t.mock, t.diagnostic, t.skip, etc.) is not supported by Themis.',
    suggestion: 'Drop the test-context parameter and replace t.mock with module-level mocks, t.diagnostic with console output, and t.skip with test.skip().'
  },
  {
    id: 'node-assert-residual',
    category: 'unsupported-helper',
    severity: 'warning',
    pattern: /\bassert\.(?:fail|partialDeepStrictEqual|ifError|CallTracker)\b/,
    message: 'Node assert helper has no automatic Themis equivalent.',
    suggestion: 'Replace assert.fail/ifError/CallTracker with explicit expect() assertions before relying on the migrated suite.'
  },
  {
    id: 'node-assert-deferred',
    category: 'async-matcher-chain',
    severity: 'warning',
    pattern: /\bassert\.(?:notEqual|notStrictEqual|notDeepEqual|notDeepStrictEqual|match|doesNotMatch|doesNotThrow|rejects|doesNotReject)\b/,
    message: 'Node assert call still routes through the compat shim; Themis lacks the matcher needed to inline it.',
    suggestion: 'Leave as-is for now. When Themis adds .not / .toMatch / .rejects matchers, rewrite to native expect() chains.'
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
    throw new Error(`Unsupported migrate source: ${String(framework)}. Use "jest", "vitest", or "node".`);
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
  const noteForNode = source === 'node'
    ? '// node:test users: this scaffold relies on --rewrite-imports (and --convert\n// for assert.* calls). The Themis runtime cannot intercept "node:" specifiers\n// because they are Node built-ins, so the rewrite step is required, not optional.\n'
    : '// Themis runtime supports imports from "@jest/globals", "vitest",\n// and "@testing-library/react" directly, so this file can stay minimal.\n';
  return `// Themis migration bridge for ${source} suites.
${noteForNode}
afterEach(() => {
  restoreAllMocks();
  cleanup();
});
`;
}

function buildMigrationCompatSource() {
  // Note: every export must be assigned with a literal `module.exports.X = ...`
  // line so cjs-module-lexer can detect it for ESM-style named imports
  // (`import { describe } from '../themis.compat.js'`). Object spreads or
  // dynamic Object.assign would hide these from the static lexer and break
  // named imports under Node's require-of-ESM bridge.
  //
  // node:assert helpers throw directly rather than delegating to expect(...)
  // chains so they don't depend on matchers that Themis currently lacks
  // (.not, .toMatch, .rejects).
  return `const util = require('util');

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

function fmt(value) {
  try { return util.inspect(value, { depth: 4, breakLength: 80 }); } catch { return String(value); }
}

const nodeAssertLike = {
  equal: (actual, expected) => {
    if (!Object.is(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to equal ' + fmt(expected));
  },
  strictEqual: (actual, expected) => {
    if (!Object.is(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to strictly equal ' + fmt(expected));
  },
  notEqual: (actual, expected) => {
    if (Object.is(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to not equal ' + fmt(expected));
  },
  notStrictEqual: (actual, expected) => {
    if (Object.is(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to not strictly equal ' + fmt(expected));
  },
  deepEqual: (actual, expected) => {
    if (!util.isDeepStrictEqual(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to deeply equal ' + fmt(expected));
  },
  deepStrictEqual: (actual, expected) => {
    if (!util.isDeepStrictEqual(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to deeply strict-equal ' + fmt(expected));
  },
  notDeepEqual: (actual, expected) => {
    if (util.isDeepStrictEqual(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to not deeply equal ' + fmt(expected));
  },
  notDeepStrictEqual: (actual, expected) => {
    if (util.isDeepStrictEqual(actual, expected)) throw new Error('Expected ' + fmt(actual) + ' to not deeply strict-equal ' + fmt(expected));
  },
  ok: (value) => {
    if (!value) throw new Error('Expected truthy value, received ' + fmt(value));
  },
  match: (value, regex) => {
    if (!regex.test(value)) throw new Error('Expected ' + fmt(value) + ' to match ' + String(regex));
  },
  doesNotMatch: (value, regex) => {
    if (regex.test(value)) throw new Error('Expected ' + fmt(value) + ' to not match ' + String(regex));
  },
  throws: (block, expected) => {
    let thrown = null;
    try { block(); } catch (e) { thrown = e; }
    if (!thrown) throw new Error('Expected function to throw');
    if (expected instanceof RegExp && !expected.test(String(thrown.message || thrown))) {
      throw new Error('Expected thrown message to match ' + String(expected));
    }
  },
  doesNotThrow: (block) => {
    try { block(); } catch (e) { throw new Error('Expected function not to throw, threw: ' + (e && e.message ? e.message : String(e))); }
  },
  rejects: async (block, expected) => {
    const promise = typeof block === 'function' ? block() : block;
    let thrown = null;
    try { await promise; } catch (e) { thrown = e; }
    if (!thrown) throw new Error('Expected promise to reject');
    if (expected instanceof RegExp && !expected.test(String(thrown.message || thrown))) {
      throw new Error('Expected rejection message to match ' + String(expected));
    }
  },
  doesNotReject: async (block) => {
    const promise = typeof block === 'function' ? block() : block;
    try { await promise; } catch (e) { throw new Error('Expected promise not to reject, rejected: ' + (e && e.message ? e.message : String(e))); }
  }
};
nodeAssertLike.strict = nodeAssertLike;

module.exports.describe = describe;
module.exports.test = test;
module.exports.it = test;
module.exports.expect = expect;
module.exports.beforeAll = beforeAll;
module.exports.beforeEach = beforeEach;
module.exports.afterEach = afterEach;
module.exports.afterAll = afterAll;
module.exports.before = beforeAll;
module.exports.after = afterAll;
module.exports.render = render;
module.exports.screen = screen;
module.exports.fireEvent = fireEvent;
module.exports.waitFor = waitFor;
module.exports.cleanup = cleanup;
module.exports.act = async (callback) => (typeof callback === 'function' ? callback() : undefined);
module.exports.fn = fn;
module.exports.spyOn = spyOn;
module.exports.mock = mock;
module.exports.unmock = unmock;
module.exports.clearAllMocks = clearAllMocks;
module.exports.resetAllMocks = resetAllMocks;
module.exports.restoreAllMocks = restoreAllMocks;
module.exports.useFakeTimers = useFakeTimers;
module.exports.useRealTimers = useRealTimers;
module.exports.advanceTimersByTime = advanceTimersByTime;
module.exports.runAllTimers = runAllTimers;
module.exports.jest = jestLike;
module.exports.vi = jestLike;
module.exports.assert = nodeAssertLike;
module.exports.strict = nodeAssertLike;
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
      nodeTest: matches.filter((entry) => entry.imports.includes('node:test')).length,
      nodeAssert: matches.filter((entry) => entry.imports.includes('node:assert') || entry.imports.includes('node:assert/strict')).length,
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
  source = source.replace(
    /^\s*import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{[^}]*\}\s+from\s+['"]node:test['"];?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );
  source = source.replace(
    /^\s*import\s+[A-Za-z_$][\w$]*\s+from\s+['"]node:test['"];?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );
  source = source.replace(
    /^\s*import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{[^}]*\}\s+from\s+['"]node:assert(?:\/strict)?['"];?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );
  source = source.replace(
    /^\s*import\s+[A-Za-z_$][\w$]*\s+from\s+['"]node:assert(?:\/strict)?['"];?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );
  source = source.replace(
    /^\s*const\s+\{[^}]*\}\s*=\s*require\(\s*['"]node:test['"]\s*\);?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );
  source = source.replace(
    /^\s*const\s+[A-Za-z_$][\w$]*\s*=\s*require\(\s*['"]node:test['"]\s*\);?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );
  source = source.replace(
    /^\s*const\s+(?:\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]node:assert(?:\/strict)?['"]\s*\);?\s*\n?/gm,
    () => { removedImports += 1; return ''; }
  );

  source = convertNodeAssertCalls(source, (n) => { convertedAssertions += n; });

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
    { pattern: /\b(?:jest|vi)\.resetModules\s*\(/g, replacement: 'resetModules(' },
    { pattern: /(?<![.\w])before\s*\(/g, replacement: 'beforeAll(' },
    { pattern: /(?<![.\w])after\s*\(/g, replacement: 'afterAll(' },
    { pattern: /\bmock\.method\s*\(/g, replacement: 'spyOn(' },
    { pattern: /\bmock\.fn\s*\(/g, replacement: 'fn(' },
    { pattern: /\bmock\.reset\s*\(/g, replacement: 'resetAllMocks(' },
    { pattern: /\bmock\.restoreAll\s*\(/g, replacement: 'restoreAllMocks(' },
    { pattern: /\bmock\.timers\.enable\s*\(/g, replacement: 'useFakeTimers(' },
    { pattern: /\bmock\.timers\.reset\s*\(/g, replacement: 'useRealTimers(' },
    { pattern: /\bmock\.timers\.tick\s*\(/g, replacement: 'advanceTimersByTime(' },
    { pattern: /\bmock\.timers\.runAll\s*\(/g, replacement: 'runAllTimers(' }
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
  let rewrites = 0;
  let nextSource = sourceText;

  // node:test default and combined imports must be rewritten to named form
  // because the compat module's CJS exports are a namespace object, not a
  // callable test() function.
  nextSource = nextSource.replace(
    /import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}\s+from\s+['"]node:test['"]/g,
    (_m, defaultName, named) => { rewrites += 1; return `import { ${defaultName}, ${named.trim()} } from '${compatSpecifier}'`; }
  );
  nextSource = nextSource.replace(
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]node:test['"]/g,
    (_m, defaultName) => { rewrites += 1; return `import { ${defaultName} } from '${compatSpecifier}'`; }
  );

  // node:assert default imports rewrite to a named `assert` import.
  // `import { strict as assert } from 'node:assert'` collapses to the same.
  nextSource = nextSource.replace(
    /import\s+\{\s*strict\s+as\s+([A-Za-z_$][\w$]*)\s*\}\s+from\s+['"]node:assert['"]/g,
    (_m, name) => { rewrites += 1; return `import { ${name === 'assert' ? 'assert' : `assert as ${name}`} } from '${compatSpecifier}'`; }
  );
  nextSource = nextSource.replace(
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]node:assert(?:\/strict)?['"]/g,
    (_m, name) => { rewrites += 1; return `import { ${name === 'assert' ? 'assert' : `assert as ${name}`} } from '${compatSpecifier}'`; }
  );

  // CommonJS equivalents.
  nextSource = nextSource.replace(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]node:assert(?:\/strict)?['"]\s*\)/g,
    (_m, name) => { rewrites += 1; return name === 'assert'
      ? `const { assert } = require('${compatSpecifier}')`
      : `const { assert: ${name} } = require('${compatSpecifier}')`; }
  );
  nextSource = nextSource.replace(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]node:test['"]\s*\)/g,
    (_m, name) => { rewrites += 1; return name === 'test'
      ? `const { test } = require('${compatSpecifier}')`
      : `const { test: ${name} } = require('${compatSpecifier}')`; }
  );

  // Remaining specifier-only rewrites for named-import shapes.
  const specifiers = [
    /(['"])@jest\/globals\1/g,
    /(['"])vitest\1/g,
    /(['"])@testing-library\/react\1/g,
    /(['"])node:test\1/g,
    /(['"])node:assert\/strict\1/g,
    /(['"])node:assert\1/g
  ];
  for (const pattern of specifiers) {
    nextSource = nextSource.replace(pattern, (_match, quote) => {
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
  if (hasModuleReference(sourceText, 'node:test')) {
    matches.push('node:test');
  }
  if (hasModuleReference(sourceText, 'node:assert/strict')) {
    matches.push('node:assert/strict');
  } else if (hasModuleReference(sourceText, 'node:assert')) {
    matches.push('node:assert');
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

// ---------------------------------------------------------------------------
// node:assert call-site rewrites
//
// Each rewrite parses arguments at depth=1 with awareness of strings, template
// literals, and regex literals so we don't mis-split inside an arg. Calls that
// can't be parsed cleanly are left intact and surface as `--assist` findings.
// ---------------------------------------------------------------------------

// Only conversions that produce code working under current Themis matchers
// land here. Negated forms (notEqual, doesNotMatch, doesNotThrow), regex
// matches, and async rejection helpers stay as `assert.X` calls; the compat
// shim implements them, and `--assist` flags them for manual cleanup once
// Themis adds .not / .toMatch / .rejects.
const NODE_ASSERT_TWO_ARG = {
  equal: (a, b) => `expect(${a}).toBe(${b})`,
  strictEqual: (a, b) => `expect(${a}).toBe(${b})`,
  deepEqual: (a, b) => `expect(${a}).toEqual(${b})`,
  deepStrictEqual: (a, b) => `expect(${a}).toEqual(${b})`
};

const NODE_ASSERT_ONE_OR_TWO_ARG = {
  throws: (args) => args.length === 1
    ? `expect(${args[0]}).toThrow()`
    : `expect(${args[0]}).toThrow(${args[1]})`
};

const NODE_ASSERT_ONE_ARG = {
  ok: (a) => `expect(${a}).toBeTruthy()`
};

function convertNodeAssertCalls(source, incrementCounter) {
  let result = source;
  for (const method of Object.keys(NODE_ASSERT_TWO_ARG)) {
    result = transformAssertCall(result, method, (args) => {
      if (args.length < 2 || args.length > 3) return null;
      return NODE_ASSERT_TWO_ARG[method](args[0], args[1]);
    }, incrementCounter);
  }
  for (const method of Object.keys(NODE_ASSERT_ONE_OR_TWO_ARG)) {
    result = transformAssertCall(result, method, (args) => {
      if (args.length < 1 || args.length > 3) return null;
      return NODE_ASSERT_ONE_OR_TWO_ARG[method](args);
    }, incrementCounter);
  }
  for (const method of Object.keys(NODE_ASSERT_ONE_ARG)) {
    result = transformAssertCall(result, method, (args) => {
      if (args.length < 1 || args.length > 2) return null;
      return NODE_ASSERT_ONE_ARG[method](args[0]);
    }, incrementCounter);
  }
  return result;
}

function transformAssertCall(source, methodName, transform, incrementCounter) {
  const opener = new RegExp(`\\bassert\\.${methodName}\\s*\\(`, 'g');
  let result = '';
  let cursor = 0;
  let match;
  while ((match = opener.exec(source)) !== null) {
    const callStart = match.index;
    const argsStart = opener.lastIndex;
    const parsed = readCallArgs(source, argsStart);
    if (!parsed) continue;
    const replacement = transform(parsed.args);
    if (replacement === null) continue;
    result += source.slice(cursor, callStart) + replacement;
    cursor = parsed.end;
    opener.lastIndex = parsed.end;
    incrementCounter(1);
  }
  result += source.slice(cursor);
  return result;
}

// Walks `source` from `start` (just past an opening `(`) and returns the
// top-level argument list. Handles single/double/template strings, regex
// literals, and line/block comments. Returns `null` if the call is malformed
// (unbalanced parens, etc.) so the caller can leave the original text alone.
function readCallArgs(source, start) {
  const args = [];
  let depth = 1;
  let argStart = start;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"') { i = skipString(source, i, ch); continue; }
    if (ch === '`') { i = skipTemplateLiteral(source, i); continue; }
    if (ch === '/' && source[i + 1] === '/') { i = skipLineComment(source, i); continue; }
    if (ch === '/' && source[i + 1] === '*') { i = skipBlockComment(source, i); continue; }
    if (ch === '/' && isRegexLiteralStart(source, i)) { i = skipRegexLiteral(source, i); continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; i += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const tail = source.slice(argStart, i).trim();
        if (tail.length > 0 || args.length > 0) args.push(tail);
        return { args, end: i + 1 };
      }
      i += 1; continue;
    }
    if (ch === ',' && depth === 1) {
      args.push(source.slice(argStart, i).trim());
      argStart = i + 1;
      i += 1; continue;
    }
    i += 1;
  }
  return null;
}

function skipString(source, start, quote) {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === quote) return i + 1;
    if (ch === '\n') return i + 1;
    i += 1;
  }
  return i;
}

function skipTemplateLiteral(source, start) {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') return i + 1;
    if (ch === '$' && source[i + 1] === '{') {
      i = skipTemplateExpression(source, i + 2);
      continue;
    }
    i += 1;
  }
  return i;
}

function skipTemplateExpression(source, start) {
  let depth = 1;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"') { i = skipString(source, i, ch); continue; }
    if (ch === '`') { i = skipTemplateLiteral(source, i); continue; }
    if (ch === '{') { depth += 1; i += 1; continue; }
    if (ch === '}') { depth -= 1; if (depth === 0) return i + 1; i += 1; continue; }
    i += 1;
  }
  return i;
}

function skipLineComment(source, start) {
  let i = start + 2;
  while (i < source.length && source[i] !== '\n') i += 1;
  return i;
}

function skipBlockComment(source, start) {
  let i = start + 2;
  while (i < source.length) {
    if (source[i] === '*' && source[i + 1] === '/') return i + 2;
    i += 1;
  }
  return i;
}

function isRegexLiteralStart(source, index) {
  for (let j = index - 1; j >= 0; j -= 1) {
    const c = source[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
    return /[(,=&|!?:;[{<>+\-*%^~]/.test(c);
  }
  return true;
}

function skipRegexLiteral(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '[') { inClass = true; i += 1; continue; }
    if (ch === ']') { inClass = false; i += 1; continue; }
    if (ch === '/' && !inClass) {
      i += 1;
      while (i < source.length && /[a-z]/i.test(source[i])) i += 1;
      return i;
    }
    if (ch === '\n') return start + 1;
    i += 1;
  }
  return start + 1;
}

module.exports = {
  runMigrate
};
