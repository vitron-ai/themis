const util = require('util');
const { isMockFunction, formatMockCalls } = require('./test-utils');

function createExpect(_context = {}) {
  return function expect(received) {
    const matchers = {
      toBe(expected) {
        if (!Object.is(received, expected)) {
          throw new Error(`Expected ${format(received)} to be ${format(expected)}`);
        }
      },
      toEqual(expected) {
        if (!util.isDeepStrictEqual(received, expected)) {
          throw new Error(`Expected ${format(received)} to deeply equal ${format(expected)}`);
        }
      },
      toMatchObject(expected) {
        if (!matchesObjectShape(received, expected)) {
          throw new Error(`Expected ${format(received)} to match object shape ${format(expected)}`);
        }
      },
      toBeTruthy() {
        if (!received) {
          throw new Error(`Expected ${format(received)} to be truthy`);
        }
      },
      toBeFalsy() {
        if (received) {
          throw new Error(`Expected ${format(received)} to be falsy`);
        }
      },
      toBeDefined() {
        if (received === undefined) {
          throw new Error('Expected value to be defined');
        }
      },
      toBeUndefined() {
        if (received !== undefined) {
          throw new Error(`Expected ${format(received)} to be undefined`);
        }
      },
      toBeNull() {
        if (received !== null) {
          throw new Error(`Expected ${format(received)} to be null`);
        }
      },
      toHaveLength(expected) {
        if (!received || typeof received.length !== 'number') {
          throw usageError('toHaveLength expects a value with a length property');
        }

        if (received.length !== expected) {
          throw new Error(`Expected length ${received.length} to be ${expected}`);
        }
      },
      toContain(item) {
        if (typeof received === 'string') {
          if (!received.includes(item)) {
            throw new Error(`Expected string ${format(received)} to contain ${format(item)}`);
          }
          return;
        }

        if (Array.isArray(received)) {
          if (!received.some((entry) => util.isDeepStrictEqual(entry, item))) {
            throw new Error(`Expected array ${format(received)} to contain ${format(item)}`);
          }
          return;
        }

        throw usageError('toContain only supports strings and arrays');
      },
      toMatch(expected) {
        if (typeof received !== 'string') {
          throw usageError(`toMatch expects a string, received ${format(received)}`);
        }
        if (typeof expected === 'string') {
          if (!received.includes(expected)) {
            throw new Error(`Expected ${format(received)} to match substring ${format(expected)}`);
          }
          return;
        }
        if (expected instanceof RegExp) {
          if (!expected.test(received)) {
            throw new Error(`Expected ${format(received)} to match ${String(expected)}`);
          }
          return;
        }
        throw usageError('toMatch expects a string or RegExp');
      },
      toThrow(match) {
        if (typeof received !== 'function') {
          throw usageError('toThrow expects a function');
        }
        let thrown = null;
        let threw = false;
        let result;
        try {
          result = received();
        } catch (error) {
          thrown = error;
          threw = true;
        }

        if (!threw && isThenable(result)) {
          // The assertion fails either way; don't also leave an unhandled rejection behind.
          result.then(undefined, () => {});
          throw usageError('toThrow received a function that returned a promise. Use `await expect(promise).rejects.toThrow()` for async code.');
        }

        if (!threw) {
          throw new Error('Expected function to throw');
        }

        if (match === undefined) {
          return;
        }

        if (typeof match === 'function') {
          if (!(thrown instanceof match)) {
            throw new Error(`Expected function to throw ${match.name || 'the given class'}, but it threw ${format(thrown)}`);
          }
          return;
        }

        const message = String((thrown && thrown.message) || thrown);
        if (typeof match === 'string' && !message.includes(match)) {
          throw new Error(`Expected thrown message ${format(message)} to include ${format(match)}`);
        }
        if (match instanceof RegExp && !match.test(message)) {
          throw new Error(`Expected thrown message ${format(message)} to match ${String(match)}`);
        }
      },
      toStrictEqual(expected) {
        if (!util.isDeepStrictEqual(received, expected)) {
          throw new Error(`Expected ${format(received)} to strictly equal ${format(expected)}`);
        }
      },
      toBeGreaterThan(expected) {
        assertComparable(received, expected, 'toBeGreaterThan');
        if (!(received > expected)) {
          throw new Error(`Expected ${format(received)} to be greater than ${format(expected)}`);
        }
      },
      toBeGreaterThanOrEqual(expected) {
        assertComparable(received, expected, 'toBeGreaterThanOrEqual');
        if (!(received >= expected)) {
          throw new Error(`Expected ${format(received)} to be greater than or equal to ${format(expected)}`);
        }
      },
      toBeLessThan(expected) {
        assertComparable(received, expected, 'toBeLessThan');
        if (!(received < expected)) {
          throw new Error(`Expected ${format(received)} to be less than ${format(expected)}`);
        }
      },
      toBeLessThanOrEqual(expected) {
        assertComparable(received, expected, 'toBeLessThanOrEqual');
        if (!(received <= expected)) {
          throw new Error(`Expected ${format(received)} to be less than or equal to ${format(expected)}`);
        }
      },
      toBeCloseTo(expected, numDigits = 2) {
        if (typeof received !== 'number' || typeof expected !== 'number') {
          throw usageError(`toBeCloseTo expects numbers, received ${format(received)} and ${format(expected)}`);
        }
        // Same rule as Jest: equal infinities match, otherwise the difference must be under half a unit
        // in the numDigits-th decimal place.
        const close = received === expected || Math.abs(expected - received) < 10 ** -numDigits / 2;
        if (!close) {
          throw new Error(`Expected ${format(received)} to be close to ${format(expected)} (${numDigits} decimal places)`);
        }
      },
      toBeInstanceOf(expected) {
        if (typeof expected !== 'function') {
          throw usageError(`toBeInstanceOf expects a class or constructor, received ${format(expected)}`);
        }
        if (!(received instanceof expected)) {
          throw new Error(`Expected ${format(received)} to be an instance of ${expected.name || 'the given class'}`);
        }
      },
      toHaveProperty(keyPath, ...expectedValue) {
        if (received === null || received === undefined) {
          throw usageError(`toHaveProperty expects an object, received ${format(received)}`);
        }
        const lookup = readPropertyPath(received, keyPath);
        if (!lookup.found) {
          throw new Error(`Expected ${format(received)} to have property ${format(keyPath)}`);
        }
        if (expectedValue.length > 0 && !util.isDeepStrictEqual(lookup.value, expectedValue[0])) {
          throw new Error(`Expected property ${format(keyPath)} to be ${format(expectedValue[0])}, received ${format(lookup.value)}`);
        }
      },
      toHaveBeenCalled() {
        assertMockFunction(received, 'toHaveBeenCalled');
        if (received.mock.calls.length === 0) {
          throw new Error('Expected mock function to have been called');
        }
      },
      toHaveBeenCalledTimes(expected) {
        assertMockFunction(received, 'toHaveBeenCalledTimes');
        if (received.mock.calls.length !== expected) {
          throw new Error(`Expected mock function to be called ${expected} times, received ${received.mock.calls.length}`);
        }
      },
      toHaveBeenCalledWith(...expectedArgs) {
        assertMockFunction(received, 'toHaveBeenCalledWith');
        if (!received.mock.calls.some((args) => util.isDeepStrictEqual(args, expectedArgs))) {
          throw new Error(
            `Expected mock function to have been called with ${format(expectedArgs)}\nReceived calls: ${formatMockCalls(received)}`
          );
        }
      },
      toHaveTextContent(expected) {
        const node = assertDomNode(received, 'toHaveTextContent');
        const actual = normalizeText(node.textContent);
        const target = normalizeText(expected);
        if (!actual.includes(target)) {
          throw new Error(`Expected element text ${format(actual)} to contain ${format(target)}`);
        }
      },
      toHaveAttribute(name, expectedValue) {
        const node = assertDomNode(received, 'toHaveAttribute');
        const actual = node.getAttribute(name);
        if (actual === null) {
          throw new Error(`Expected element to have attribute ${String(name)}`);
        }
        if (expectedValue !== undefined && actual !== String(expectedValue)) {
          throw new Error(`Expected attribute ${String(name)} to be ${format(expectedValue)}, received ${format(actual)}`);
        }
      },
      toBeInTheDocument() {
        const node = assertDomNode(received, 'toBeInTheDocument');
        if (!node.ownerDocument || !node.ownerDocument.documentElement.contains(node)) {
          throw new Error('Expected element to be attached to the current document');
        }
      }
    };
    return withModifiers(matchers, received, expect);
  };
}

function assertMockFunction(received, matcherName) {
  if (!isMockFunction(received)) {
    throw usageError(`${matcherName} expects a mock function`);
  }
}

// Jest semantics: plain objects match on the expected keys only, arrays must have the same
// length with each element matched by the same rules, and anything else (primitives, Date,
// RegExp, Map, Set, class instances) must be deeply equal.
function matchesObjectShape(received, expected) {
  if (!expected || typeof expected !== 'object') {
    return false;
  }
  return matchesSubset(received, expected);
}

function matchesSubset(received, expected) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(received) &&
      received.length === expected.length &&
      expected.every((item, index) => matchesSubset(received[index], item))
    );
  }

  if (isPlainObject(expected)) {
    if (!received || typeof received !== 'object' || Array.isArray(received)) {
      return false;
    }
    return Object.entries(expected).every(
      ([key, value]) => Object.prototype.hasOwnProperty.call(received, key) && matchesSubset(received[key], value)
    );
  }

  return util.isDeepStrictEqual(received, expected);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function format(value) {
  return util.inspect(value, { depth: 5, colors: false, maxArrayLength: 20 });
}

function assertDomNode(received, matcherName) {
  if (typeof Node === 'undefined' || !(received instanceof Node)) {
    throw usageError(`${matcherName} expects a DOM node`);
  }
  return received;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// Misuse (wrong received type, bad arguments) throws a TypeError so `.not` reports it instead
// of treating it as a failed assertion and passing.
function usageError(message) {
  return new TypeError(message);
}

function isThenable(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
}

function assertComparable(received, expected, matcherName) {
  const comparable = (value) => typeof value === 'number' || typeof value === 'bigint';
  if (!comparable(received) || !comparable(expected)) {
    throw usageError(`${matcherName} expects numbers or bigints, received ${format(received)} and ${format(expected)}`);
  }
}

// 'a.b[0].c' or ['a', 'b', 0, 'c']. The array form allows keys that contain dots.
function readPropertyPath(received, keyPath) {
  let keys;
  if (Array.isArray(keyPath)) {
    keys = keyPath.map(String);
  } else if (typeof keyPath === 'string' && keyPath.length > 0) {
    keys = keyPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  } else {
    throw usageError(`toHaveProperty expects a non-empty string or array path, received ${format(keyPath)}`);
  }

  let current = received;
  for (const key of keys) {
    if (current === null || current === undefined || !(key in Object(current))) {
      return { found: false };
    }
    current = current[key];
  }
  return { found: true, value: current };
}

const MODIFIERS = new Set(['not', 'resolves', 'rejects']);

function describeReceived(received) {
  if (isMockFunction(received)) {
    return 'mock function';
  }
  return typeof received === 'function' ? 'function' : format(received);
}

// toHaveBeenCalledWith -> "have been called with"
function describeMatcher(name) {
  return name.replace(/^to/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
}

function negate(matchers, received) {
  const negated = {};
  for (const name of Object.keys(matchers).filter((key) => !MODIFIERS.has(key))) {
    negated[name] = (...args) => {
      try {
        matchers[name](...args);
      } catch (error) {
        if (error instanceof TypeError) {
          throw error;
        }
        return;
      }
      const shownArgs = args.length > 0 ? ` ${args.map(format).join(', ')}` : '';
      throw new Error(`Expected ${describeReceived(received)} not to ${describeMatcher(name)}${shownArgs}`);
    };
  }
  return negated;
}

// `.resolves` / `.rejects`: every matcher becomes async and runs against the settled value.
// `.rejects.toThrow(...)` checks the rejection reason, as in Jest.
function promiseMatchers(received, kind, negated, matcherNames, expect) {
  async function settle() {
    const promise = typeof received === 'function' ? received() : received;
    if (!isThenable(promise)) {
      throw usageError(`.${kind} expects a promise, received ${format(promise)}`);
    }
    let fulfilled = true;
    let value;
    try {
      value = await promise;
    } catch (error) {
      fulfilled = false;
      value = error;
    }
    if (kind === 'resolves' && !fulfilled) {
      throw new Error(`Expected promise to resolve, but it rejected with ${format(value)}`);
    }
    if (kind === 'rejects' && fulfilled) {
      throw new Error(`Expected promise to reject, but it resolved with ${format(value)}`);
    }
    return value;
  }

  const result = {};
  for (const name of matcherNames) {
    result[name] = async (...args) => {
      const value = await settle();
      const subject = kind === 'rejects' && name === 'toThrow' ? () => { throw value; } : value;
      const assertion = expect(subject);
      (negated ? assertion.not : assertion)[name](...args);
    };
  }
  if (!negated) {
    result.not = promiseMatchers(received, kind, true, matcherNames, expect);
  }
  return result;
}

function withModifiers(matchers, received, expect) {
  const names = Object.keys(matchers).filter((name) => !MODIFIERS.has(name));
  return Object.defineProperties(matchers, {
    not: { enumerable: true, get: () => negate(matchers, received) },
    resolves: { enumerable: true, get: () => promiseMatchers(received, 'resolves', false, names, expect) },
    rejects: { enumerable: true, get: () => promiseMatchers(received, 'rejects', false, names, expect) }
  });
}

const expect = createExpect();

module.exports = {
  createExpect,
  expect
};
