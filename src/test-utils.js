const path = require('path');
const util = require('util');

function createTestUtils(options = {}) {
  const activeMocks = new Set();
  const activeSpies = new Set();
  const moduleLoader = options.moduleLoader;

  function fn(implementation) {
    const mockFn = createMockFunction(implementation);
    activeMocks.add(mockFn);
    return mockFn;
  }

  function spyOn(target, methodName) {
    if (!target || typeof target !== 'object') {
      throw new Error('spyOn expects an object target');
    }

    const original = target[methodName];
    if (typeof original !== 'function') {
      throw new Error(`spyOn expects ${String(methodName)} to be a function`);
    }

    const spy = fn(function spiedMethod(...args) {
      return original.apply(this, args);
    });

    spy.mockRestore = () => {
      target[methodName] = original;
      activeSpies.delete(spy);
      return spy;
    };

    target[methodName] = spy;
    activeSpies.add(spy);
    return spy;
  }

  function mock(request, factoryOrExports) {
    if (!moduleLoader) {
      throw new Error('mock(...) is unavailable outside the Themis runtime');
    }

    const callerFile = resolveCallerFile();
    const normalizedFactory = factoryOrExports === undefined ? {} : factoryOrExports;
    moduleLoader.registerMock(request, callerFile, normalizedFactory);
  }

  function unmock(request) {
    if (!moduleLoader) {
      throw new Error('unmock(...) is unavailable outside the Themis runtime');
    }

    const callerFile = resolveCallerFile();
    moduleLoader.unregisterMock(request, callerFile);
  }

  function clearAllMocks() {
    for (const mockFn of activeMocks) {
      mockFn.mockClear();
    }
  }

  function resetAllMocks() {
    for (const mockFn of activeMocks) {
      mockFn.mockReset();
    }

    if (moduleLoader) {
      moduleLoader.clearModuleMocks();
    }
  }

  function restoreAllMocks() {
    for (const spy of [...activeSpies]) {
      if (typeof spy.mockRestore === 'function') {
        spy.mockRestore();
      }
    }
  }

  return {
    fn,
    spyOn,
    mock,
    unmock,
    clearAllMocks,
    resetAllMocks,
    restoreAllMocks
  };
}

function createMockFunction(implementation) {
  const state = {
    calls: [],
    results: [],
    implementation: implementation
  };

  function mockFn(...args) {
    state.calls.push(args);
    try {
      const value = state.implementation ? state.implementation.apply(this, args) : undefined;
      state.results.push({ type: 'return', value });
      return value;
    } catch (error) {
      state.results.push({ type: 'throw', value: error });
      throw error;
    }
  }

  Object.defineProperty(mockFn, '_isThemisMockFunction', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true
  });

  mockFn.mock = state;
  mockFn.mockImplementation = (nextImplementation) => {
    state.implementation = nextImplementation;
    return mockFn;
  };
  mockFn.mockReturnValue = (value) => {
    state.implementation = () => value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => {
    state.implementation = () => Promise.resolve(value);
    return mockFn;
  };
  mockFn.mockRejectedValue = (value) => {
    state.implementation = () => Promise.reject(value);
    return mockFn;
  };
  mockFn.mockClear = () => {
    state.calls.length = 0;
    state.results.length = 0;
    return mockFn;
  };
  mockFn.mockReset = () => {
    state.calls.length = 0;
    state.results.length = 0;
    state.implementation = undefined;
    return mockFn;
  };
  mockFn.getMockName = () => 'themis.fn';

  return mockFn;
}

function isMockFunction(value) {
  return Boolean(value && value._isThemisMockFunction);
}

function formatMockCalls(value) {
  if (!isMockFunction(value)) {
    return format(value);
  }
  return format(value.mock.calls);
}

function resolveCallerFile() {
  const stack = String(new Error().stack || '').split('\n').slice(2);
  for (const line of stack) {
    const match = line.match(/\((.+?):\d+:\d+\)$/) || line.match(/at (.+?):\d+:\d+$/);
    if (!match) {
      continue;
    }

    const candidate = match[1];
    if (candidate.startsWith('node:')) {
      continue;
    }

    const normalized = candidate.replace(/\\/g, '/');
    if (
      normalized.endsWith('/src/test-utils.js') ||
      normalized.endsWith('/src/runtime.js') ||
      normalized.endsWith('/src/expect.js')
    ) {
      continue;
    }

    return candidate;
  }

  return path.join(process.cwd(), '__themis_unknown_caller__.js');
}

function format(value) {
  return util.inspect(value, { depth: 5, colors: false, maxArrayLength: 20 });
}

module.exports = {
  createTestUtils,
  createMockFunction,
  isMockFunction,
  formatMockCalls
};
