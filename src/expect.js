const util = require('util');
const { isMockFunction, formatMockCalls } = require('./test-utils');

function createExpect(context = {}) {
  return function expect(received) {
    return {
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
          throw new Error('toHaveLength expects a value with a length property');
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

        throw new Error('toContain only supports strings and arrays');
      },
      toThrow(match) {
        if (typeof received !== 'function') {
          throw new Error('toThrow expects a function');
        }
        let thrown = null;
        try {
          received();
        } catch (error) {
          thrown = error;
        }

        if (!thrown) {
          throw new Error('Expected function to throw');
        }

        if (match === undefined) {
          return;
        }

        const message = String(thrown.message || thrown);
        if (typeof match === 'string' && !message.includes(match)) {
          throw new Error(`Expected thrown message ${format(message)} to include ${format(match)}`);
        }
        if (match instanceof RegExp && !match.test(message)) {
          throw new Error(`Expected thrown message ${format(message)} to match ${String(match)}`);
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
  };
}

function assertMockFunction(received, matcherName) {
  if (!isMockFunction(received)) {
    throw new Error(`${matcherName} expects a mock function`);
  }
}

function matchesObjectShape(received, expected) {
  if (!received || typeof received !== 'object' || Array.isArray(received)) {
    return false;
  }

  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    return false;
  }

  for (const [key, value] of Object.entries(expected)) {
    if (!Object.prototype.hasOwnProperty.call(received, key)) {
      return false;
    }

    const receivedValue = received[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!matchesObjectShape(receivedValue, value)) {
        return false;
      }
      continue;
    }

    if (!util.isDeepStrictEqual(receivedValue, value)) {
      return false;
    }
  }

  return true;
}

function format(value) {
  return util.inspect(value, { depth: 5, colors: false, maxArrayLength: 20 });
}

function assertDomNode(received, matcherName) {
  if (typeof Node === 'undefined' || !(received instanceof Node)) {
    throw new Error(`${matcherName} expects a DOM node`);
  }
  return received;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const expect = createExpect();

module.exports = {
  createExpect,
  expect
};
