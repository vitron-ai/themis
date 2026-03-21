const { loadConfig } = require('./config');
const { discoverTests } = require('./discovery');
const { runTests } = require('./runner');
const { printSpec, printJson, printAgent, printNext, writeHtmlReport } = require('./reporter');
const { runInit } = require('./init');
const { writeRunArtifacts, readFailedTestsArtifact } = require('./artifacts');
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
    runInit(cwd);
    console.log('Themis initialized. Run: npx themis test');
    return;
  }

  if (command !== 'test') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(cwd);
  const flags = parseFlags(argv.slice(1));

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
  if (flags.watch) {
    await runWatchMode({
      cwd,
      cliArgs: argv.slice(1)
    });
    return;
  }
  printBanner(reporter);
  const maxWorkers = resolveWorkerCount(flags.workers, config.maxWorkers);
  const stabilityRuns = resolveStabilityRuns(flags.stability);

  let files = discoverTests(cwd, config);
  if (files.length === 0) {
    console.log(`No test files found in ${config.testDir}`);
    return;
  }

  let allowedFullNames = null;
  if (flags.rerunFailed) {
    const artifact = readFailedTestsArtifact(cwd);
    if (artifact && artifact.parseError) {
      console.log(
        `Failed to parse failed test artifact at ${artifact.failuresPath}: ${artifact.parseError}. Run a full test pass to regenerate it.`
      );
      return;
    }

    if (!artifact || artifact.failedTests.length === 0) {
      console.log('No failed test artifact found. Run a failing test first.');
      return;
    }

    const fileSet = new Set(artifact.failedTests.map((entry) => entry.file));
    allowedFullNames = artifact.failedTests.map((entry) => entry.fullName);
    files = files.filter((file) => fileSet.has(file));

    if (files.length === 0) {
      console.log('No matching files found for failed test artifact.');
      return;
    }
  }

  const runResults = [];
  for (let i = 0; i < stabilityRuns; i += 1) {
    const runResult = await runTests(files, {
      maxWorkers,
      match: flags.match || null,
      allowedFullNames,
      noMemes: Boolean(flags.noMemes),
      cwd,
      environment,
      setupFiles: config.setupFiles,
      tsconfigPath: config.tsconfigPath,
      updateSnapshots: Boolean(flags.updateSnapshots)
    });
    runResults.push(runResult);
  }

  const result = runResults[runResults.length - 1];
  const stabilityReport = stabilityRuns > 1 ? buildStabilityReport(runResults) : null;
  if (stabilityReport) {
    result.stability = stabilityReport;
  }

  writeRunArtifacts(cwd, result);
  printResult(reporter, result, {
    lexicon,
    cwd,
    htmlOutput: flags.htmlOutput || null
  });

  const revealFailed = result.summary.failed > 0 || hasStabilityBreaches(stabilityReport);
  await maybeRevealVerdict(reporter, result, stabilityReport, revealFailed);

  if (revealFailed) {
    process.exitCode = 1;
  }
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
    if (token === '-w' || token === '--watch') {
      flags.watch = true;
      continue;
    }
    if (token === '-u' || token === '--update-snapshots') {
      flags.updateSnapshots = true;
      continue;
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
  }
  return flags;
}

function validateRegex(pattern) {
  try {
    new RegExp(pattern);
  } catch (error) {
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
  console.log('  init                    Create themis.config.json and sample tests');
  console.log('  test [--json] [--agent] [--next] [--reporter spec|next|json|agent|html] [--workers N] [--stability N] [--environment node|jsdom] [-w|--watch] [-u|--update-snapshots] [--html-output path] [--match regex] [--rerun-failed] [--no-memes] [--lexicon classic|themis]');
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
