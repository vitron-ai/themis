const { performance } = require('perf_hooks');
const path = require('path');
const { createExpect } = require('./expect');
const { createModuleLoader } = require('./module-loader');
const { installTestEnvironment } = require('./environment');
const { createContractHarness } = require('./contracts');
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
    skipped: false,
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

async function collectAndRun(filePath, options = {}) {
  const root = createSuite('__root__', null);
  let currentSuite = root;
  const projectRoot = path.resolve(options.cwd || process.cwd());
  const setupFiles = resolveSetupFiles(options.setupFiles, projectRoot);
  const environment = installTestEnvironment(options.environment || 'node');
  const currentTestRef = {
    file: filePath,
    name: '',
    fullName: ''
  };
  const runtimeBindings = {
    api: null,
    testUtils: null
  };
  const moduleLoader = createModuleLoader({
    cwd: projectRoot,
    tsconfigPath: options.tsconfigPath,
    virtualModules: buildCompatibilityVirtualModules(runtimeBindings)
  });
  const contractHarness = createContractHarness({
    cwd: projectRoot,
    updateContracts: Boolean(options.updateContracts),
    getCurrentTest() {
      return currentTestRef;
    }
  });
  const testUtils = createTestUtils({ moduleLoader, contractHarness });
  const runtimeExpect = createExpect();
  const runtimeApi = buildRuntimeApi({
    root,
    options,
    testUtils,
    runtimeExpect,
    getCurrentSuite() {
      return currentSuite;
    },
    setCurrentSuite(nextSuite) {
      currentSuite = nextSuite;
    }
  });
  runtimeBindings.api = runtimeApi;
  runtimeBindings.testUtils = testUtils;

  if (typeof environment.beforeEach === 'function') {
    root.hooks.beforeEach.push(environment.beforeEach);
  }
  if (typeof environment.afterEach === 'function') {
    root.hooks.afterEach.push(environment.afterEach);
  }

  const previousGlobals = installGlobals(runtimeApi);

  let loadError = null;
  try {
    for (const setupFile of setupFiles) {
      await moduleLoader.loadFile(setupFile);
    }
    await moduleLoader.loadFile(filePath);
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
      contracts: [],
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
    currentTestRef
  };

  return runSuite(root, [root], results, runOptions)
    .then(() => ({
      file: filePath,
      tests: results,
      contracts: testUtils.getContractEvents()
    }))
    .finally(() => {
      restoreGlobals(previousGlobals);
      testUtils.restoreAllMocks();
      environment.teardown();
      moduleLoader.restore();
    });
}

function buildRuntimeApi({ root: _root, options, testUtils, runtimeExpect, getCurrentSuite, setCurrentSuite }) {
  const describeApi = createDescribeApi({
    getCurrentSuite,
    setCurrentSuite
  });
  const testApi = createTestApi({
    getCurrentSuite
  });

  return {
    describe: describeApi,
    test: testApi,
    intent(name, define) {
      if (typeof define !== 'function') {
        throw new Error(`intent(${name}) requires a callback`);
      }
      const intentTest = createIntentTest(name, define, {
        noMemes: Boolean(options.noMemes)
      });
      getCurrentSuite().tests.push(intentTest);
    },
    beforeAll(fn) {
      getCurrentSuite().hooks.beforeAll.push(fn);
    },
    beforeEach(fn) {
      getCurrentSuite().hooks.beforeEach.push(fn);
    },
    afterEach(fn) {
      getCurrentSuite().hooks.afterEach.push(fn);
    },
    afterAll(fn) {
      getCurrentSuite().hooks.afterAll.push(fn);
    },
    expect: runtimeExpect,
    resetModules() {
      if (testUtils && typeof testUtils.resetAllMocks === 'function') {
        testUtils.resetAllMocks();
      }
    },
    ...testUtils
  };
}

function createDescribeApi({ getCurrentSuite, setCurrentSuite }) {
  const describeApi = (name, fn) => {
    if (typeof fn !== 'function') {
      throw new Error(`describe(${name}) requires a callback`);
    }
    const suite = createSuite(name, getCurrentSuite());
    getCurrentSuite().suites.push(suite);
    const parent = getCurrentSuite();
    setCurrentSuite(suite);
    try {
      fn();
    } finally {
      setCurrentSuite(parent);
    }
  };

  describeApi.only = describeApi;
  describeApi.skip = (name, fn) => {
    if (typeof fn !== 'function') {
      throw new Error(`describe.skip(${name}) requires a callback`);
    }
    const suite = createSuite(name, getCurrentSuite());
    suite.skipped = true;
    getCurrentSuite().suites.push(suite);
  };

  return wrapEachRunner(describeApi, 'describe.each', (row, index, name, fn) => {
    const args = normalizeEachArgs(row);
    describeApi(formatParameterizedName(name, args, index), () => fn(...args));
  });
}

function createTestApi({ getCurrentSuite }) {
  const addTest = (name, fn, options = {}) => {
    if (typeof fn !== 'function') {
      throw new Error(`test(${name}) requires a callback`);
    }
    getCurrentSuite().tests.push({
      name,
      fn,
      skipped: Boolean(options.skipped)
    });
  };

  const testApi = (name, fn) => {
    addTest(name, fn);
  };

  testApi.only = testApi;
  testApi.skip = (name, fn = async () => {}) => {
    addTest(name, typeof fn === 'function' ? fn : async () => {}, { skipped: true });
  };

  return wrapEachRunner(testApi, 'test.each', (row, index, name, fn) => {
    const args = normalizeEachArgs(row);
    addTest(formatParameterizedName(name, args, index), () => fn(...args));
  });
}

function wrapEachRunner(target, apiName, registerRow) {
  target.each = (rows) => {
    if (!Array.isArray(rows)) {
      throw new Error(`${apiName}(...) requires an array of rows`);
    }

    return (name, fn) => {
      if (typeof fn !== 'function') {
        throw new Error(`${apiName}(...)(...) requires a callback`);
      }
      rows.forEach((row, index) => {
        registerRow(row, index, name, fn);
      });
    };
  };

  return target;
}

function normalizeEachArgs(row) {
  return Array.isArray(row) ? row : [row];
}

function formatParameterizedName(name, args, index) {
  let cursor = 0;
  const formatted = String(name || '').replace(/%[#sdifjop]/g, (token) => {
    if (token === '%#') {
      return String(index);
    }
    const value = args[cursor];
    cursor += 1;
    if (token === '%j' || token === '%o' || token === '%p') {
      return stringifyParameterizedValue(value);
    }
    return String(value);
  });
  return formatted;
}

function stringifyParameterizedValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildCompatibilityVirtualModules(bindings) {
  return {
    '@jest/globals': () => buildJestGlobals(bindings.api, bindings.testUtils),
    vitest: () => buildVitestGlobals(bindings.api, bindings.testUtils),
    '@testing-library/react': () => buildTestingLibraryCompat(bindings.api)
  };
}

function buildJestGlobals(api, testUtils) {
  const jestLike = buildJestLikeApi(api, testUtils);
  return {
    describe: api.describe,
    test: api.test,
    it: api.test,
    expect: api.expect,
    beforeAll: api.beforeAll,
    beforeEach: api.beforeEach,
    afterEach: api.afterEach,
    afterAll: api.afterAll,
    jest: jestLike
  };
}

function buildVitestGlobals(api, testUtils) {
  const jestLike = buildJestLikeApi(api, testUtils);
  return {
    describe: api.describe,
    test: api.test,
    it: api.test,
    expect: api.expect,
    beforeAll: api.beforeAll,
    beforeEach: api.beforeEach,
    afterEach: api.afterEach,
    afterAll: api.afterAll,
    vi: jestLike
  };
}

function buildTestingLibraryCompat(api) {
  return {
    render: api.render,
    screen: api.screen,
    fireEvent: api.fireEvent,
    waitFor: api.waitFor,
    cleanup: api.cleanup,
    act: async (callback) => {
      if (typeof callback !== 'function') {
        return undefined;
      }
      return callback();
    }
  };
}

function buildJestLikeApi(api, testUtils) {
  return {
    fn: api.fn,
    spyOn: api.spyOn,
    mock: api.mock,
    unmock: api.unmock,
    clearAllMocks: api.clearAllMocks,
    resetAllMocks: api.resetAllMocks,
    restoreAllMocks: api.restoreAllMocks,
    useFakeTimers: api.useFakeTimers,
    useRealTimers: api.useRealTimers,
    advanceTimersByTime: api.advanceTimersByTime,
    runAllTimers: api.runAllTimers,
    resetModules() {
      if (testUtils && typeof testUtils.resetAllMocks === 'function') {
        testUtils.resetAllMocks();
      }
    }
  };
}

function resolveSetupFiles(setupFiles, cwd) {
  if (!Array.isArray(setupFiles) || setupFiles.length === 0) {
    return [];
  }

  return setupFiles.map((file) => path.resolve(cwd, file));
}

async function runSuite(suite, lineage, results, options) {
  const nextLineage = suite.name === '__root__' ? lineage : [...lineage, suite];

  if (suite.skipped) {
    pushSkippedSuiteResults(suite, nextLineage, results);
    return;
  }

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

      if (test.skipped || !shouldRun) {
        results.push({
          name: test.name,
          fullName: testName,
          status: 'skipped',
          durationMs: 0,
          error: null
        });
        continue;
      }

      try {
        if (options.currentTestRef) {
          options.currentTestRef.name = test.name;
          options.currentTestRef.fullName = testName;
        }
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
        if (options.currentTestRef) {
          options.currentTestRef.name = '';
          options.currentTestRef.fullName = '';
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

function pushSkippedSuiteResults(suite, lineage, results) {
  const nextLineage = suite.name === '__root__' ? lineage : [...lineage, suite];
  for (const test of suite.tests) {
    results.push({
      name: test.name,
      fullName: [...formatLineage(nextLineage), test.name].join(' > '),
      status: 'skipped',
      durationMs: 0,
      error: null
    });
  }
  for (const child of suite.suites) {
    pushSkippedSuiteResults(child, nextLineage, results);
  }
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
    'restoreAllMocks',
    'resetModules',
    'render',
    'screen',
    'fireEvent',
    'waitFor',
    'cleanup',
    'useFakeTimers',
    'useRealTimers',
    'advanceTimersByTime',
    'runAllTimers',
    'flushMicrotasks',
    'captureContract',
    'mockFetch',
    'restoreFetch',
    'resetFetchMocks'
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
  global.resetModules = api.resetModules;
  global.render = api.render;
  global.screen = api.screen;
  global.fireEvent = api.fireEvent;
  global.waitFor = api.waitFor;
  global.cleanup = api.cleanup;
  global.useFakeTimers = api.useFakeTimers;
  global.useRealTimers = api.useRealTimers;
  global.advanceTimersByTime = api.advanceTimersByTime;
  global.runAllTimers = api.runAllTimers;
  global.flushMicrotasks = api.flushMicrotasks;
  global.captureContract = api.captureContract;
  global.mockFetch = api.mockFetch;
  global.restoreFetch = api.restoreFetch;
  global.resetFetchMocks = api.resetFetchMocks;

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
