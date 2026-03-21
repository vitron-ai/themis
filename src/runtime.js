const { performance } = require('perf_hooks');
const path = require('path');
const { createExpect } = require('./expect');
const { createModuleLoader } = require('./module-loader');
const { installTestEnvironment } = require('./environment');
const { createSnapshotState } = require('./snapshots');
const { createTestUtils } = require('./test-utils');

const INTENT_PHASE_ALIASES = {
  arrange: ['arrange', 'given', 'context', 'setup'],
  act: ['act', 'when', 'run', 'infer'],
  assert: ['assert', 'then', 'verify'],
  cleanup: ['cleanup', 'finally', 'teardown']
};

const MEME_INTENT_PHASE_ALIASES = {
  arrange: ['cook'],
  act: ['yeet'],
  assert: ['vibecheck'],
  cleanup: ['wipe']
};

function createSuite(name, parent = null) {
  return {
    name,
    parent,
    suites: [],
    tests: [],
    hooks: {
      beforeAll: [],
      beforeEach: [],
      afterEach: [],
      afterAll: []
    }
  };
}

function collectAndRun(filePath, options = {}) {
  const root = createSuite('__root__', null);
  let currentSuite = root;
  const projectRoot = path.resolve(options.cwd || process.cwd());
  const setupFiles = resolveSetupFiles(options.setupFiles, projectRoot);
  const moduleLoader = createModuleLoader({
    cwd: projectRoot,
    tsconfigPath: options.tsconfigPath
  });
  const environment = installTestEnvironment(options.environment || 'node');
  const snapshotState = createSnapshotState(path.resolve(filePath), {
    updateSnapshots: Boolean(options.updateSnapshots)
  });
  const testUtils = createTestUtils({ moduleLoader });
  const runtimeExpect = createExpect({ snapshotState });

  if (typeof environment.beforeEach === 'function') {
    root.hooks.beforeEach.push(environment.beforeEach);
  }
  if (typeof environment.afterEach === 'function') {
    root.hooks.afterEach.push(environment.afterEach);
  }

  const previousGlobals = installGlobals({
    describe(name, fn) {
      if (typeof fn !== 'function') {
        throw new Error(`describe(${name}) requires a callback`);
      }
      const suite = createSuite(name, currentSuite);
      currentSuite.suites.push(suite);
      const parent = currentSuite;
      currentSuite = suite;
      try {
        fn();
      } finally {
        currentSuite = parent;
      }
    },
    test(name, fn) {
      if (typeof fn !== 'function') {
        throw new Error(`test(${name}) requires a callback`);
      }
      currentSuite.tests.push({ name, fn });
    },
    intent(name, define) {
      if (typeof define !== 'function') {
        throw new Error(`intent(${name}) requires a callback`);
      }
      const intentTest = createIntentTest(name, define, {
        noMemes: Boolean(options.noMemes)
      });
      currentSuite.tests.push(intentTest);
    },
    beforeAll(fn) {
      currentSuite.hooks.beforeAll.push(fn);
    },
    beforeEach(fn) {
      currentSuite.hooks.beforeEach.push(fn);
    },
    afterEach(fn) {
      currentSuite.hooks.afterEach.push(fn);
    },
    afterAll(fn) {
      currentSuite.hooks.afterAll.push(fn);
    },
    expect: runtimeExpect,
    ...testUtils
  });

  let loadError = null;
  try {
    for (const setupFile of setupFiles) {
      moduleLoader.loadFile(setupFile);
    }
    moduleLoader.loadFile(filePath);
  } catch (error) {
    loadError = normalizeError(error);
  }

  if (loadError) {
    restoreGlobals(previousGlobals);
    testUtils.restoreAllMocks();
    environment.teardown();
    moduleLoader.restore();
    return {
      file: filePath,
      tests: [
        {
          name: 'load',
          fullName: `${filePath} load`,
          status: 'failed',
          durationMs: 0,
          error: loadError
        }
      ]
    };
  }

  const results = [];
  const runOptions = {
    matchRegex: options.match ? new RegExp(options.match) : null,
    allowedFullNames: toSet(options.allowedFullNames),
    snapshotState
  };

  return runSuite(root, [root], results, runOptions)
    .then(() => {
      snapshotState.save();
      return { file: filePath, tests: results };
    })
    .finally(() => {
      restoreGlobals(previousGlobals);
      testUtils.restoreAllMocks();
      environment.teardown();
      moduleLoader.restore();
    });
}

function resolveSetupFiles(setupFiles, cwd) {
  if (!Array.isArray(setupFiles) || setupFiles.length === 0) {
    return [];
  }

  return setupFiles.map((file) => path.resolve(cwd, file));
}

async function runSuite(suite, lineage, results, options) {
  const nextLineage = suite.name === '__root__' ? lineage : [...lineage, suite];

  let beforeAllFailed = false;
  for (const hook of suite.hooks.beforeAll) {
    try {
      await hook();
    } catch (error) {
      beforeAllFailed = true;
      pushHookFailure(results, nextLineage, 'beforeAll', error);
      break;
    }
  }

  if (!beforeAllFailed) {
    for (const test of suite.tests) {
      const start = performance.now();
      let status = 'passed';
      let error = null;
      const testName = [...formatLineage(nextLineage), test.name].join(' > ');
      let beforeEachSucceeded = false;
      const shouldRun = shouldRunTest(testName, options);

      if (!shouldRun) {
        results.push({
          name: test.name,
          fullName: testName,
          status: 'skipped',
          durationMs: 0,
          error: null
        });
        continue;
      }

      if (options.snapshotState) {
        options.snapshotState.setCurrentTestName(testName);
      }

      try {
        const beforeEachHooks = collectHooks(nextLineage, 'beforeEach', false);
        for (const hook of beforeEachHooks) {
          await hook();
        }
        beforeEachSucceeded = true;

        await test.fn();
      } catch (err) {
        status = 'failed';
        error = normalizeError(err);
      } finally {
        if (options.snapshotState) {
          options.snapshotState.clearCurrentTestName();
        }
        if (beforeEachSucceeded) {
          const afterEachHooks = collectHooks(nextLineage, 'afterEach', true);
          for (const hook of afterEachHooks) {
            try {
              await hook();
            } catch (err) {
              if (status !== 'failed') {
                status = 'failed';
                error = normalizeError(err);
              }
            }
          }
        }
      }

      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        name: test.name,
        fullName: testName,
        status,
        durationMs,
        error
      });
    }

    for (const child of suite.suites) {
      await runSuite(child, nextLineage, results, options);
    }
  }

  for (const hook of suite.hooks.afterAll) {
    try {
      await hook();
    } catch (error) {
      pushHookFailure(results, nextLineage, 'afterAll', error);
    }
  }
}

function collectHooks(lineage, kind, reverse) {
  const suites = reverse ? [...lineage].reverse() : lineage;
  const hooks = [];
  for (const suite of suites) {
    hooks.push(...suite.hooks[kind]);
  }
  return hooks;
}

function installGlobals(api) {
  const names = [
    'describe',
    'test',
    'it',
    'intent',
    'beforeAll',
    'beforeEach',
    'afterEach',
    'afterAll',
    'expect',
    'fn',
    'spyOn',
    'mock',
    'unmock',
    'clearAllMocks',
    'resetAllMocks',
    'restoreAllMocks'
  ];
  const previous = {};
  for (const name of names) {
    previous[name] = global[name];
  }

  global.describe = api.describe;
  global.test = api.test;
  global.it = api.test;
  global.intent = api.intent;
  global.beforeAll = api.beforeAll;
  global.beforeEach = api.beforeEach;
  global.afterEach = api.afterEach;
  global.afterAll = api.afterAll;
  global.expect = api.expect;
  global.fn = api.fn;
  global.spyOn = api.spyOn;
  global.mock = api.mock;
  global.unmock = api.unmock;
  global.clearAllMocks = api.clearAllMocks;
  global.resetAllMocks = api.resetAllMocks;
  global.restoreAllMocks = api.restoreAllMocks;

  return previous;
}

function createIntentTest(name, define, options = {}) {
  const phases = [];
  let mode = 'arrange';
  const phaseAliases = resolveIntentPhaseAliases(options);

  const pushPhase = (kind, alias, description, fn) => {
    let normalizedDescription = description;
    let normalizedFn = fn;

    if (typeof normalizedDescription === 'function') {
      normalizedFn = normalizedDescription;
      normalizedDescription = `${alias} phase ${phases.filter((phase) => phase.kind === kind).length + 1}`;
    }

    if (typeof normalizedFn !== 'function') {
      throw new Error(`${kind}(...) requires a callback`);
    }

    if (kind === 'arrange' && mode !== 'arrange') {
      throw new Error('arrange(...) cannot be declared after act(...) or assert(...)');
    }
    if (kind === 'act') {
      if (mode === 'assert') {
        throw new Error('act(...) cannot be declared after assert(...)');
      }
      mode = 'act';
    }
    if (kind === 'assert') {
      mode = 'assert';
    }

    phases.push({ kind, alias, description: String(normalizedDescription), fn: normalizedFn });
  };

  const dsl = {};
  for (const [kind, aliases] of Object.entries(phaseAliases)) {
    for (const alias of aliases) {
      dsl[alias] = (description, fn) => {
        pushPhase(kind, alias, description, fn);
      };
    }
  }

  define(dsl);

  if (!phases.some((phase) => phase.kind === 'assert')) {
    throw new Error(`intent(${name}) must define at least one assert(...) phase`);
  }

  return {
    name,
    async fn() {
      const context = {};
      const cleanupPhases = phases.filter((phase) => phase.kind === 'cleanup');
      const runPhases = phases.filter((phase) => phase.kind !== 'cleanup');

      let runError = null;
      for (const phase of runPhases) {
        try {
          await phase.fn(context);
        } catch (error) {
          runError = annotatePhaseError(error, phase);
          break;
        }
      }

      let cleanupError = null;
      for (const phase of cleanupPhases) {
        try {
          await phase.fn(context);
        } catch (error) {
          cleanupError = annotatePhaseError(error, phase);
          break;
        }
      }

      if (runError) {
        throw runError;
      }
      if (cleanupError) {
        throw cleanupError;
      }
    }
  };
}

function resolveIntentPhaseAliases(options = {}) {
  const aliases = {};
  const includeMemes = !options.noMemes;

  for (const [kind, baseAliases] of Object.entries(INTENT_PHASE_ALIASES)) {
    const merged = [...baseAliases];
    if (includeMemes) {
      merged.push(...(MEME_INTENT_PHASE_ALIASES[kind] || []));
    }
    aliases[kind] = merged;
  }

  return aliases;
}

function annotatePhaseError(error, phase) {
  const message = `Intent phase failed: ${String(phase.alias || phase.kind).toUpperCase()} ${phase.description}`;
  if (error && typeof error === 'object' && error.message) {
    error.message = `${message}\n${error.message}`;
    return error;
  }
  return new Error(message);
}

function restoreGlobals(previous) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete global[name];
    } else {
      global[name] = value;
    }
  }
}

function normalizeError(error) {
  return {
    message: String(error?.message || error),
    stack: String(error?.stack || error)
  };
}

function pushHookFailure(results, lineage, hookName, error) {
  const fullName = [...formatLineage(lineage), hookName].join(' > ') || hookName;
  results.push({
    name: hookName,
    fullName,
    status: 'failed',
    durationMs: 0,
    error: normalizeError(error)
  });
}

function formatLineage(lineage) {
  return lineage
    .map((item) => item.name)
    .filter((name) => name !== '__root__');
}

function toSet(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  return new Set(values);
}

function shouldRunTest(testName, options) {
  if (options.allowedFullNames && !options.allowedFullNames.has(testName)) {
    return false;
  }
  if (options.matchRegex && !options.matchRegex.test(testName)) {
    return false;
  }
  return true;
}

module.exports = {
  collectAndRun
};
