const path = require('path');
const { loadConfig } = require('./config');
const { discoverTests } = require('./discovery');
const { runTests } = require('./runner');
const { printSpec, printJson, printAgent, printNext, writeHtmlReport } = require('./reporter');
const { ARTIFACT_RELATIVE_PATHS } = require('./artifact-paths');
const { runInit } = require('./init');
const { runMigrate } = require('./migrate');
const { generateTestsFromSource, writeGenerateArtifacts } = require('./generate');
const { writeRunArtifacts, readFailedTestsArtifact, readFixHandoffArtifact } = require('./artifacts');
const { buildStabilityReport, hasStabilityBreaches } = require('./stability');
const { verdictReveal } = require('./verdict');
const { runWatchMode } = require('./watch');
const { version: THEMIS_VERSION } = require('../package.json');
const SUPPORTED_REPORTERS = new Set(['spec', 'next', 'json', 'agent', 'html']);
const SUPPORTED_LEXICONS = new Set(['classic', 'themis']);
const SUPPORTED_ENVIRONMENTS = new Set(['node', 'jsdom']);

async function main(argv) {
  const command = argv[0] || 'test';
  const cwd = process.cwd();

  if (command === 'init') {
    const initFlags = parseInitFlags(argv.slice(1));
    const initResult = runInit(cwd, initFlags);
    console.log('Themis initialized. Next: npx themis generate <source-root> && npx themis test');
    if (initResult.autoDetected) {
      const detected = [];
      if (initResult.agents) detected.push('AGENTS.md');
      if (initResult.claudeCode) detected.push('Claude Code');
      if (initResult.cursor) detected.push('Cursor');
      if (detected.length > 0) {
        console.log(`Auto-detected: ${detected.join(', ')}`);
      }
    }
    if (initFlags.agents || initResult.agents) {
      const agents = initResult.agents;
      if (agents && agents.created) {
        console.log(`Agents: created ${formatCliPath(cwd, agents.path)} from the Themis downstream template.`);
      } else {
        console.log('Agents: skipped AGENTS.md scaffold because one already exists.');
      }
    }
    if (initResult.cursor) {
      const cur = initResult.cursor;
      if (cur.created) {
        console.log(`Cursor: created ${formatCliPath(cwd, cur.path)} from the Themis Cursor template.`);
      } else if (cur.appended) {
        console.log(`Cursor: appended Themis section to ${formatCliPath(cwd, cur.path)}.`);
      } else {
        console.log(`Cursor: skipped .cursorrules update (already mentions @vitronai/themis).`);
      }
    }
    if (initResult.claudeCode) {
      const cc = initResult.claudeCode;
      if (cc.claudeMd.created) {
        console.log(`Claude Code: created ${formatCliPath(cwd, cc.claudeMd.path)} from the Themis Claude template.`);
      } else if (cc.claudeMd.appended) {
        console.log(`Claude Code: appended Themis section to ${formatCliPath(cwd, cc.claudeMd.path)}.`);
      } else {
        console.log(`Claude Code: skipped CLAUDE.md update (already mentions @vitronai/themis).`);
      }
      if (cc.skill.created) {
        console.log(`Claude Code: installed skill at ${formatCliPath(cwd, cc.skill.path)}.`);
      } else {
        console.log(`Claude Code: skipped skill (${formatCliPath(cwd, cc.skill.path)} already exists).`);
      }
      if (cc.commands.written.length > 0) {
        console.log(`Claude Code: installed ${cc.commands.written.length} slash command(s) under ${formatCliPath(cwd, cc.commands.dir)}.`);
      }
      if (cc.commands.skipped.length > 0) {
        console.log(`Claude Code: skipped ${cc.commands.skipped.length} existing slash command file(s).`);
      }
    }
    return;
  }

  if (command === 'generate' || command === 'scan') {
    const flags = parseGenerateFlags(argv.slice(1));
    if (!flags.json) {
      printBanner('next');
    }
    const summary = generateTestsFromSource(cwd, {
      targetDir: flags.targetDir || 'src',
      outputDir: flags.outputDir,
      force: Boolean(flags.force),
      strict: Boolean(flags.strict),
      writeHints: Boolean(flags.writeHints),
      review: Boolean(flags.review),
      update: Boolean(flags.update),
      clean: Boolean(flags.clean),
      changed: Boolean(flags.changed),
      plan: Boolean(flags.plan),
      failOnSkips: Boolean(flags.failOnSkips),
      failOnConflicts: Boolean(flags.failOnConflicts),
      requireConfidence: flags.requireConfidence || null,
      scenario: flags.scenario || null,
      minConfidence: flags.minConfidence || null,
      files: flags.files || null,
      matchSource: flags.matchSource || null,
      matchExport: flags.matchExport || null,
      include: flags.include || null,
      exclude: flags.exclude || null
    });
    const { payload } = writeGenerateArtifacts(summary, cwd);
    if (flags.json) {
      console.log(JSON.stringify(payload));
      if (summary.gates.failed) {
        process.exitCode = 1;
      }
      return;
    }
    printGenerateSummary(summary, cwd);
    if (summary.gates.failed) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'migrate') {
    const migrateFlags = parseMigrateFlags(argv.slice(1));
    const result = runMigrate(cwd, migrateFlags.source, migrateFlags);
    console.log(`Themis migration scaffold created for ${result.source}.`);
    console.log(`Config: ${formatCliPath(cwd, result.configPath)}`);
    console.log(`Setup: ${formatCliPath(cwd, result.setupPath)}`);
    console.log(`Compat: ${formatCliPath(cwd, result.compatPath)}`);
    if (result.packageUpdated && result.packageJsonPath) {
      console.log(`Scripts: updated ${formatCliPath(cwd, result.packageJsonPath)} with test:themis`);
    }
    if (result.gitignoreUpdated) {
    console.log(`Gitignore: updated ${formatCliPath(cwd, result.gitignorePath)} with .themis/, __themis__/reports/, and __themis__/shims/`);
    }
    if (result.rewriteImports) {
      console.log(`Imports: rewrote ${result.rewrittenFiles.length} file(s) to local Themis compatibility imports.`);
    }
    if (result.convertedFiles && result.convertedFiles.length > 0) {
      console.log(`Codemods: converted ${result.convertedFiles.length} file(s) to Themis-native patterns.`);
    }
    if (result.assist) {
      console.log(`Assistant: analyzed ${result.assistSummary.analyzedFiles} migrated file(s).`);
      if (result.assistSummary.findings.length > 0) {
        console.log(
          `Assistant: flagged ${result.assistSummary.findings.length} manual follow-up item(s) across ${result.assistSummary.unresolvedFiles.length} file(s).`
        );
      } else {
        console.log('Assistant: no unsupported Jest/Vitest-only patterns detected in migrated files.');
      }
      console.log(`Report: ${formatCliPath(cwd, result.reportPath)}`);
    }
    if (result.source === 'node') {
      console.log('Runtime compatibility for node:test relies on --rewrite-imports; use --convert to rewrite mock.* call sites.');
    } else {
      console.log('Runtime compatibility is enabled for @jest/globals, vitest, and @testing-library/react imports.');
    }
    console.log('Next: run npx themis test or npm run test:themis');
    return;
  }

  if (command !== 'test') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const flags = parseFlags(argv.slice(1));
  const watchIsolation = flags.watch ? (flags.isolation || 'in-process') : flags.isolation;
  const watchCache = flags.watch ? (flags.cache !== undefined ? flags.cache : watchIsolation === 'in-process') : flags.cache;
  if (watchIsolation) {
    validateIsolation(watchIsolation);
  }
  if (flags.watch) {
    await runWatchMode({
      cwd,
      cliArgs: argv.slice(1),
      inProcess: watchIsolation === 'in-process',
      executeInProcess: async (cliArgs) => {
        const rerunFlags = parseFlags(cliArgs);
        rerunFlags.watch = false;
        if (!rerunFlags.isolation && watchIsolation) {
          rerunFlags.isolation = watchIsolation;
        }
        if (rerunFlags.cache === undefined && watchCache !== undefined) {
          rerunFlags.cache = watchCache;
        }
        await executeTestRun(cwd, rerunFlags);
      }
    });
    return;
  }

  await executeTestRun(cwd, flags);
}

async function executeTestRun(cwd, flags) {
  const execution = flags.fix
    ? await executeTestFixRun(cwd, flags)
    : await runTestCommand(cwd, flags);

  await finalizeTestExecution(execution);
}

async function executeTestFixRun(cwd, flags) {
  let fixArtifact = readFixHandoffArtifact(cwd);

  if (fixArtifact && fixArtifact.parseError) {
    return {
      notices: [
        `Failed to parse fix handoff artifact at ${fixArtifact.fixHandoffPath}: ${fixArtifact.parseError}. Run npx themis test to regenerate it.`
      ],
      ...(await runTestCommand(cwd, { ...flags, fix: false }))
    };
  }

  let seededExecution = null;
  if (!fixArtifact || fixArtifact.items.length === 0) {
    seededExecution = await runTestCommand(cwd, { ...flags, fix: false });
    fixArtifact = readFixHandoffArtifact(cwd);

    if (fixArtifact && fixArtifact.parseError) {
      return {
        ...seededExecution,
        notices: [
          `Failed to parse fix handoff artifact at ${fixArtifact.fixHandoffPath}: ${fixArtifact.parseError}.`
        ]
      };
    }

    if (!fixArtifact || fixArtifact.items.length === 0) {
      const notices = seededExecution.result.summary.failed > 0
        ? [`No generated-test autofixes were available for this run. Review ${ARTIFACT_RELATIVE_PATHS.fixHandoff} when generated tests fail.`]
        : ['No generated-test repairs were needed.'];
      return {
        ...seededExecution,
        notices
      };
    }
  }

  const fixSummary = applyGeneratedAutofix(cwd, fixArtifact.payload || { items: fixArtifact.items });
  const rerunExecution = await runTestCommand(cwd, { ...flags, fix: false });
  return {
    ...rerunExecution,
    notices: [
      `Applied generated-test fixes for ${fixSummary.sources.length} source file(s).`,
      ...fixSummary.messages
    ]
  };
}

async function runTestCommand(cwd, flags) {
  const config = loadConfig(cwd);

  if (flags.match) {
    validateRegex(flags.match);
  }

  const reporter = resolveReporter(flags, config);
  validateReporter(reporter);
  const lexicon = resolveLexicon(flags);
  validateLexicon(lexicon);
  validateWorkerCount(flags.workers, config.maxWorkers);
  validateStabilityRuns(flags.stability);
  const environment = resolveEnvironment(flags, config);
  validateEnvironment(environment, flags.environment, config.environment);
  if (flags.isolation) {
    validateIsolation(flags.isolation);
  }
  const maxWorkers = resolveWorkerCount(flags.workers, config.maxWorkers);
  const stabilityRuns = resolveStabilityRuns(flags.stability);

  let files = discoverTests(cwd, config);
  if (files.length === 0) {
    return buildNoResultExecution(reporter, lexicon, cwd, flags, [`No test files found in ${config.testDir}`]);
  }

  let allowedFullNames = null;
  if (flags.rerunFailed) {
    const artifact = readFailedTestsArtifact(cwd);
    if (artifact && artifact.parseError) {
      return buildNoResultExecution(
        reporter,
        lexicon,
        cwd,
        flags,
        [`Failed to parse failed test artifact at ${artifact.failuresPath}: ${artifact.parseError}. Run a full test pass to regenerate it.`]
      );
    }

    if (!artifact || artifact.failedTests.length === 0) {
      return buildNoResultExecution(reporter, lexicon, cwd, flags, ['No failed test artifact found. Run a failing test first.']);
    }

    const fileSet = new Set(artifact.failedTests.map((entry) => entry.file));
    allowedFullNames = artifact.failedTests.map((entry) => entry.fullName);
    files = files.filter((file) => fileSet.has(file));

    if (files.length === 0) {
      return buildNoResultExecution(reporter, lexicon, cwd, flags, ['No matching files found for failed test artifact.']);
    }
  }

  const runResults = [];
  for (let i = 0; i < stabilityRuns; i += 1) {
    const runResult = await runTests(files, {
      maxWorkers,
      match: flags.match || null,
      allowedFullNames,
      noMemes: Boolean(flags.noMemes),
      updateContracts: Boolean(flags.updateContracts),
      cwd,
      environment,
      setupFiles: config.setupFiles,
      tsconfigPath: config.tsconfigPath,
      isolation: flags.isolation || 'worker',
      cache: Boolean(flags.cache)
    });
    runResults.push(runResult);
  }

  const result = runResults[runResults.length - 1];
  const stabilityReport = stabilityRuns > 1 ? buildStabilityReport(runResults) : null;
  if (stabilityReport) {
    result.stability = stabilityReport;
  }

  writeRunArtifacts(cwd, result);
  return {
    reporter,
    lexicon,
    result,
    cwd,
    htmlOutput: flags.htmlOutput || null
  };
}

async function finalizeTestExecution(execution) {
  printBanner(execution.reporter);

  if (execution.reporter !== 'json' && execution.reporter !== 'agent') {
    for (const notice of execution.notices || []) {
      console.log(notice);
    }
  }

  if (!execution.result) {
    return;
  }

  printResult(execution.reporter, execution.result, {
    lexicon: execution.lexicon,
    cwd: execution.cwd,
    htmlOutput: execution.htmlOutput || null
  });

  const revealFailed = execution.result.summary.failed > 0 || hasStabilityBreaches(execution.result.stability);
  await maybeRevealVerdict(execution.reporter, execution.result, execution.result.stability, revealFailed);

  if (revealFailed) {
    process.exitCode = 1;
  }
}

function buildNoResultExecution(reporter, lexicon, cwd, flags, notices) {
  return {
    reporter,
    lexicon,
    cwd,
    htmlOutput: flags.htmlOutput || null,
    notices,
    result: null
  };
}

function applyGeneratedAutofix(cwd, fixPayload) {
  const bySourceFile = new Map();
  for (const item of fixPayload.items || []) {
    if (!item || !item.sourceFile) {
      continue;
    }
    const current = bySourceFile.get(item.sourceFile);
    if (!current) {
      bySourceFile.set(item.sourceFile, item);
      continue;
    }
    if (current.repairStrategy !== 'tighten-hints' && item.repairStrategy === 'tighten-hints') {
      bySourceFile.set(item.sourceFile, item);
    }
  }

  const sources = [...bySourceFile.keys()];
  const messages = [];

  for (const sourceFile of sources) {
    const item = bySourceFile.get(sourceFile);
    const writeHints = item.repairStrategy === 'tighten-hints' || item.category === 'generated-contract-failure';
    const summary = generateTestsFromSource(cwd, {
      targetDir: sourceFile,
      update: true,
      writeHints
    });
    writeGenerateArtifacts(summary, cwd);

    const createdHintCount = Number(summary.hintFiles?.created?.length || 0);
    const updatedHintCount = Number(summary.hintFiles?.updated?.length || 0);
    if (writeHints && (createdHintCount > 0 || updatedHintCount > 0)) {
      messages.push(`Updated hints for ${sourceFile} (${createdHintCount} created, ${updatedHintCount} updated).`);
    }
  }

  return {
    sources,
    messages
  };
}

function resolveReporter(flags, config) {
  if (flags.reporter) {
    return flags.reporter;
  }
  if (flags.next) {
    return 'next';
  }
  if (flags.agent) {
    return 'agent';
  }
  if (flags.json) {
    return 'json';
  }
  return config.reporter;
}

function resolveLexicon(flags) {
  return flags.lexicon || 'classic';
}

function resolveEnvironment(flags, config) {
  return flags.environment || config.environment || 'node';
}

function printResult(reporter, result, options = {}) {
  if (reporter === 'json') {
    printJson(result);
    return;
  }
  if (reporter === 'agent') {
    printAgent(result);
    return;
  }
  if (reporter === 'next') {
    printNext(result, options);
    return;
  }
  if (reporter === 'html') {
    const reportPath = writeHtmlReport(result, {
      cwd: options.cwd,
      outputPath: options.htmlOutput,
      lexicon: options.lexicon
    });
    console.log(`HTML report written to ${reportPath}`);
    return;
  }
  printSpec(result, options);
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--json') {
      flags.json = true;
      continue;
    }
    if (token === '--agent') {
      flags.agent = true;
      continue;
    }
    if (token === '--next') {
      flags.next = true;
      continue;
    }
    if (token === '--rerun-failed') {
      flags.rerunFailed = true;
      continue;
    }
    if (token === '--no-memes') {
      flags.noMemes = true;
      continue;
    }
    if (token === '--update-contracts') {
      flags.updateContracts = true;
      continue;
    }
    if (token === '--fix') {
      flags.fix = true;
      continue;
    }
    if (token === '-w' || token === '--watch') {
      flags.watch = true;
      continue;
    }
    if (token === '-u' || token === '--update-snapshots') {
      throw new Error('Snapshots have been removed from Themis. Replace -u/--update-snapshots with direct assertions or generated contract flows.');
    }
    if (token === '--reporter') {
      flags.reporter = requireFlagValue(args, i, '--reporter');
      i += 1;
      continue;
    }
    if (token === '--lexicon') {
      flags.lexicon = requireFlagValue(args, i, '--lexicon');
      i += 1;
      continue;
    }
    if (token === '--workers') {
      flags.workers = requireFlagValue(args, i, '--workers');
      i += 1;
      continue;
    }
    if (token === '--environment') {
      flags.environment = requireFlagValue(args, i, '--environment');
      i += 1;
      continue;
    }
    if (token === '--html-output') {
      flags.htmlOutput = requireFlagValue(args, i, '--html-output');
      i += 1;
      continue;
    }
    if (token === '--stability') {
      flags.stability = requireFlagValue(args, i, '--stability');
      i += 1;
      continue;
    }
    if (token === '--match') {
      flags.match = requireFlagValue(args, i, '--match');
      i += 1;
      continue;
    }
    if (token === '--isolation') {
      flags.isolation = requireFlagValue(args, i, '--isolation');
      i += 1;
      continue;
    }
    if (token === '--cache') {
      flags.cache = true;
      continue;
    }
    if (token.startsWith('-')) {
      throw new Error(`Unsupported test option: ${token}`);
    }
  }
  return flags;
}

function parseMigrateFlags(args) {
  const flags = {
    source: args[0],
    rewriteImports: false,
    convert: false,
    assist: false
  };

  for (let i = 1; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--rewrite-imports') {
      flags.rewriteImports = true;
      continue;
    }
    if (token === '--convert') {
      flags.convert = true;
      continue;
    }
    if (token === '--assist') {
      flags.assist = true;
      flags.rewriteImports = true;
      flags.convert = true;
      continue;
    }
    if (token.startsWith('-')) {
      throw new Error(`Unsupported migrate option: ${token}`);
    }
  }

  return flags;
}

function parseInitFlags(args) {
  const flags = {
    agents: false,
    claudeCode: false,
    cursor: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--agents') {
      flags.agents = true;
      continue;
    }
    if (token === '--claude-code' || token === '--claude') {
      flags.claudeCode = true;
      continue;
    }
    if (token === '--cursor') {
      flags.cursor = true;
      continue;
    }
    if (token.startsWith('-')) {
      throw new Error(`Unsupported init option: ${token}`);
    }
  }

  return flags;
}

function parseGenerateFlags(args) {
  const flags = {};

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--json') {
      flags.json = true;
      continue;
    }
    if (token === '--plan') {
      flags.plan = true;
      flags.review = true;
      flags.json = true;
      continue;
    }
    if (token === '--output') {
      flags.outputDir = requireFlagValue(args, i, '--output');
      i += 1;
      continue;
    }
    if (token === '--write-hints') {
      flags.writeHints = true;
      continue;
    }
    if (token === '--files') {
      flags.files = requireFlagValue(args, i, '--files');
      i += 1;
      continue;
    }
    if (token === '--match-source') {
      flags.matchSource = requireFlagValue(args, i, '--match-source');
      i += 1;
      continue;
    }
    if (token === '--match-export') {
      flags.matchExport = requireFlagValue(args, i, '--match-export');
      i += 1;
      continue;
    }
    if (token === '--scenario') {
      flags.scenario = requireFlagValue(args, i, '--scenario');
      i += 1;
      continue;
    }
    if (token === '--require-confidence') {
      flags.requireConfidence = requireFlagValue(args, i, '--require-confidence');
      i += 1;
      continue;
    }
    if (token === '--min-confidence') {
      flags.minConfidence = requireFlagValue(args, i, '--min-confidence');
      i += 1;
      continue;
    }
    if (token === '--include') {
      flags.include = requireFlagValue(args, i, '--include');
      i += 1;
      continue;
    }
    if (token === '--exclude') {
      flags.exclude = requireFlagValue(args, i, '--exclude');
      i += 1;
      continue;
    }
    if (token === '--force') {
      flags.force = true;
      continue;
    }
    if (token === '--strict') {
      flags.strict = true;
      continue;
    }
    if (token === '--fail-on-skips') {
      flags.failOnSkips = true;
      continue;
    }
    if (token === '--fail-on-conflicts') {
      flags.failOnConflicts = true;
      continue;
    }
    if (token === '--review') {
      flags.review = true;
      continue;
    }
    if (token === '--update') {
      flags.update = true;
      continue;
    }
    if (token === '--clean') {
      flags.clean = true;
      continue;
    }
    if (token === '--changed') {
      flags.changed = true;
      continue;
    }
    if (token.startsWith('--')) {
      throw new Error(
        'Unsupported generate option: ' + token +
        '. Use --json, --plan, --output <dir>, --files <paths>, --match-source <regex>, --match-export <regex>, --scenario <name>, --min-confidence <level>, --require-confidence <level>, --include <regex>, --exclude <regex>, --force, --strict, --write-hints, --fail-on-skips, --fail-on-conflicts, --review, --update, --clean, or --changed.'
      );
    }
    if (flags.targetDir) {
      throw new Error(`Unexpected extra argument: ${token}`);
    }
    flags.targetDir = token;
  }

  return flags;
}

function validateRegex(pattern) {
  try {
    new RegExp(pattern);
  } catch {
    throw new Error(`Invalid --match regex: ${pattern}`);
  }
}

function requireFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (typeof value !== 'string' || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function validateReporter(reporter) {
  if (SUPPORTED_REPORTERS.has(reporter)) {
    return;
  }
  throw new Error(`Unsupported reporter: ${reporter}. Use one of: spec, next, json, agent, html.`);
}

function validateLexicon(lexicon) {
  if (SUPPORTED_LEXICONS.has(lexicon)) {
    return;
  }
  throw new Error(`Unsupported --lexicon value: ${lexicon}. Use one of: classic, themis.`);
}

function validateEnvironment(environment, flagValue, configValue) {
  if (SUPPORTED_ENVIRONMENTS.has(environment)) {
    return;
  }

  if (flagValue !== undefined) {
    throw new Error(`Unsupported --environment value: ${flagValue}. Use one of: node, jsdom.`);
  }

  throw new Error(
    `Unsupported config environment value: ${String(configValue)}. Use one of: node, jsdom.`
  );
}

function validateWorkerCount(flagValue, configValue) {
  const sourceValue = flagValue !== undefined ? flagValue : configValue;
  const parsed = Number(sourceValue);
  if (Number.isInteger(parsed) && parsed > 0) {
    return;
  }

  if (flagValue !== undefined) {
    throw new Error(`Invalid --workers value: ${flagValue}. Use a positive integer.`);
  }
  throw new Error(`Invalid config maxWorkers value: ${String(configValue)}. Use a positive integer.`);
}

function validateIsolation(value) {
  if (value === 'worker' || value === 'in-process') {
    return;
  }
  throw new Error(`Unsupported --isolation value: ${value}. Use one of: worker, in-process.`);
}

function resolveWorkerCount(flagValue, configValue) {
  const sourceValue = flagValue !== undefined ? flagValue : configValue;
  return Number(sourceValue);
}

function validateStabilityRuns(value) {
  if (value === undefined) {
    return;
  }
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return;
  }
  throw new Error(`Invalid --stability value: ${value}. Use a positive integer.`);
}

function resolveStabilityRuns(value) {
  if (value === undefined) {
    return 1;
  }
  return Number(value);
}

function printUsage() {
  console.log('Usage: themis <command> [options]');
  console.log('Commands:');
  console.log('  init [--agents]         Create themis.config.json, gitignore framework paths, and optionally scaffold AGENTS.md');
  console.log('  generate [path]         Scan source files and generate Themis contract tests');
  console.log('                         Options: [--json] [--plan] [--output path] [--files a,b] [--match-source regex] [--match-export regex] [--scenario name] [--min-confidence level] [--require-confidence level] [--include regex] [--exclude regex] [--review] [--update] [--clean] [--changed] [--force] [--strict] [--write-hints] [--fail-on-skips] [--fail-on-conflicts]');
  console.log('  scan [path]             Alias for generate');
  console.log('  migrate <jest|vitest|node> [--rewrite-imports] [--convert] [--assist]   Scaffold an incremental migration bridge for existing suites');
  console.log('  test [--json] [--agent] [--next] [--reporter spec|next|json|agent|html] [--workers N] [--stability N] [--environment node|jsdom] [--isolation worker|in-process] [--cache] [--update-contracts] [--fix] [-w|--watch] [--html-output path] [--match regex] [--rerun-failed] [--no-memes] [--lexicon classic|themis]');
}

function printGenerateSummary(summary, cwd) {
  const target = formatCliPath(cwd, summary.targetDir);
  const output = formatCliPath(cwd, summary.outputDir);
  console.log('THEMIS CODE SCAN COMPLETE');
  console.log(`  target: ${target}`);
  console.log(`  output: ${output}`);
  console.log(`  scanned: ${summary.scannedFiles.length}`);
  console.log(`  generated: ${summary.generatedFiles.length}`);
  console.log(`  created: ${summary.createdFiles.length}`);
  console.log(`  updated: ${summary.updatedFiles.length}`);
  console.log(`  unchanged: ${summary.unchangedFiles.length}`);
  console.log(`  removed: ${summary.removedFiles.length}`);
  console.log(`  skipped: ${summary.skippedFiles.length}`);
  console.log(`  conflicts: ${summary.conflictFiles.length}`);

  if (summary.plan || summary.review || summary.update || summary.clean || summary.changed || summary.writeHints) {
    console.log('');
    console.log('Mode');
    console.log(`  plan: ${summary.plan ? 'yes' : 'no'}`);
    console.log(`  review: ${summary.review ? 'yes' : 'no'}`);
    console.log(`  update: ${summary.update ? 'yes' : 'no'}`);
    console.log(`  clean: ${summary.clean ? 'yes' : 'no'}`);
    console.log(`  changed: ${summary.changed ? 'yes' : 'no'}`);
    console.log(`  write-hints: ${summary.writeHints ? 'yes' : 'no'}`);
  }

  if (summary.filters.scenario || summary.filters.minConfidence) {
    console.log('');
    console.log('Steering');
    console.log(`  scenario: ${summary.filters.scenario || '(any)'}`);
    console.log(`  min-confidence: ${summary.filters.minConfidence || '(any)'}`);
  }

  if (summary.gates.failed || summary.gates.strict || summary.gates.failOnSkips || summary.gates.requireConfidence) {
    console.log('');
    console.log('Gates');
    console.log(`  strict: ${summary.gates.strict ? 'yes' : 'no'}`);
    console.log(`  fail-on-skips: ${summary.gates.failOnSkips ? 'yes' : 'no'}`);
    console.log(`  fail-on-conflicts: ${summary.gates.failOnConflicts ? 'yes' : 'no'}`);
    console.log(`  require-confidence: ${summary.gates.requireConfidence || '(none)'}`);
    console.log(`  status: ${summary.gates.failed ? 'failed' : 'passed'}`);
  }

  if (summary.generatedFiles.length > 0) {
    console.log('');
    console.log('Selected Generated Files');
    for (const file of summary.generatedFiles.slice(0, 10)) {
      console.log(`  ${formatCliPath(cwd, file)}`);
    }
    if (summary.generatedFiles.length > 10) {
      console.log(`  ... ${summary.generatedFiles.length - 10} more`);
    }
  }

  if (summary.removedFiles.length > 0) {
    console.log('');
    console.log('Removed Files');
    for (const file of summary.removedFiles.slice(0, 10)) {
      console.log(`  ${formatCliPath(cwd, file)}`);
    }
    if (summary.removedFiles.length > 10) {
      console.log(`  ... ${summary.removedFiles.length - 10} more`);
    }
  }

  if (summary.skippedFiles.length > 0) {
    console.log('');
    console.log('Skipped Files');
    for (const entry of summary.skippedFiles.slice(0, 5)) {
      console.log(`  ${formatCliPath(cwd, entry.file)} (${entry.reason})`);
    }
    if (summary.skippedFiles.length > 5) {
      console.log(`  ... ${summary.skippedFiles.length - 5} more`);
    }
  }

  if (summary.conflictFiles.length > 0) {
    console.log('');
    console.log('Conflicting Files');
    for (const file of summary.conflictFiles.slice(0, 5)) {
      console.log(`  ${formatCliPath(cwd, file)}`);
    }
    if (summary.conflictFiles.length > 5) {
      console.log(`  ... ${summary.conflictFiles.length - 5} more`);
    }
  }

  if (summary.hintFiles.created.length > 0 || summary.hintFiles.updated.length > 0 || summary.hintFiles.unchanged.length > 0) {
    console.log('');
    console.log('Hint Files');
    console.log(`  created: ${summary.hintFiles.created.length}`);
    console.log(`  updated: ${summary.hintFiles.updated.length}`);
    console.log(`  unchanged: ${summary.hintFiles.unchanged.length}`);
    for (const file of [...summary.hintFiles.created, ...summary.hintFiles.updated].slice(0, 5)) {
      console.log(`  ${formatCliPath(cwd, file)}`);
    }
  }

  if (summary.backlog.summary.total > 0) {
    console.log('');
    console.log('Backlog');
    console.log(`  total: ${summary.backlog.summary.total}`);
    console.log(`  errors: ${summary.backlog.summary.errors}`);
    console.log(`  warnings: ${summary.backlog.summary.warnings}`);
    for (const item of summary.backlog.items.slice(0, 5)) {
      console.log(`  ${item.severity.toUpperCase()} ${formatCliPath(cwd, item.sourceFile)} (${item.reason})`);
    }
    if (summary.backlog.items.length > 5) {
      console.log(`  ... ${summary.backlog.items.length - 5} more`);
    }
  }

  if (summary.gates.failed) {
    console.log('');
    console.log('Gate Failures');
    for (const failure of summary.gates.failures) {
      console.log(`  ${failure.code}: ${failure.message}`);
    }
  }

  console.log('');
  console.log('Prompt');
  console.log(`  ${summary.prompt}`);

  console.log('');
  console.log('Artifacts');
  console.log(`  ${formatCliPath(cwd, summary.artifacts.generateResult)}`);
  console.log(`  ${formatCliPath(cwd, summary.artifacts.generateHandoff)}`);
  console.log(`  ${formatCliPath(cwd, summary.artifacts.generateBacklog)}`);
  console.log(`  ${formatCliPath(cwd, summary.artifacts.generateMap)}`);

  console.log('');
  console.log('Next Step');
  console.log(`  Run: ${summary.review ? summary.gates.failed ? 'resolve backlog items, rerun generate, then npx themis test' : 'npx themis generate ' + target + ' && npx themis test' : summary.gates.failed ? 'resolve backlog items, rerun generate, then npx themis test' : 'npx themis test'}`);
}

function formatCliPath(cwd, targetPath) {
  const relative = path.relative(cwd, targetPath);
  return relative && !relative.startsWith('..') ? relative.split(path.sep).join('/') : targetPath;
}

function printBanner(reporter) {
  if (reporter === 'json' || reporter === 'agent') {
    return;
  }

  const displayVersion = normalizeDisplayVersion(THEMIS_VERSION);
  const lines = [
    '══════════════════════════════════════════════════════',
    `                 ⚖️  THEMIS v${displayVersion}`,
    '              AI UNIT TEST FRAMEWORK',
    '               AI’S VERDICT ENGINE',
    '══════════════════════════════════════════════════════',
    '',
    '  ████████╗██╗  ██╗███████╗███╗   ███╗██╗███████╗',
    '  ╚══██╔══╝██║  ██║██╔════╝████╗ ████║██║██╔════╝',
    '     ██║   ███████║█████╗  ██╔████╔██║██║███████╗',
    '     ██║   ██╔══██║██╔══╝  ██║╚██╔╝██║██║╚════██║',
    '     ██║   ██║  ██║███████╗██║ ╚═╝ ██║██║███████║',
    '     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝╚══════╝',
    '',
    '══════════════════════════════════════════════════════'
  ];

  console.log(lines.join('\n'));
  console.log('');
}

function normalizeDisplayVersion(version) {
  const value = String(version || '').trim();
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return value;
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

async function maybeRevealVerdict(reporter, result, stabilityReport, failed) {
  if (reporter !== 'next' && reporter !== 'spec') {
    return;
  }

  const unstable = Number(stabilityReport?.summary?.unstable || 0);
  const stableFail = Number(stabilityReport?.summary?.stableFail || 0);
  let detail = 'TRUTH UPHELD';

  if (failed) {
    if (unstable > 0) {
      detail = `UNSTABLE SIGNAL (${unstable})`;
    } else if (stableFail > 0) {
      detail = `STABLE FAILURES (${stableFail})`;
    } else {
      detail = `${result.summary.failed} FAILURE${result.summary.failed === 1 ? '' : 'S'} DETECTED`;
    }
  }

  await verdictReveal({
    ok: !failed,
    title: 'THEMIS VERDICT',
    detail,
    delayMs: process.env.THEMIS_REVEAL_DELAY_MS
  });
}

module.exports = { main };
