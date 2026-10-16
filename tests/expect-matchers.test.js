const { expect: directExpect } = require('../src/expect');

async function rejectsWith(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the assertion to fail');
}

describe('.not', () => {
  test('inverts passing and failing assertions', () => {
    directExpect([1, 2]).not.toContain(3);
    directExpect('themis').not.toBe('jest');
    directExpect({ a: 1 }).not.toEqual({ a: 2 });
    directExpect(() => {}).not.toThrow();
    expect(() => directExpect([1, 2]).not.toContain(2)).toThrow('Expected [ 1, 2 ] not to contain 2');
    expect(() => directExpect(() => { throw new Error('boom'); }).not.toThrow()).toThrow('Expected function not to throw');
  });

  test('works with mock matchers', () => {
    const mockFn = fn();
    directExpect(mockFn).not.toHaveBeenCalled();
    mockFn('a');
    directExpect(mockFn).not.toHaveBeenCalledWith('b');
    expect(() => directExpect(mockFn).not.toHaveBeenCalled()).toThrow('Expected mock function not to have been called');
  });

  test('reports misuse instead of passing', () => {
    expect(() => directExpect(42).not.toContain(4)).toThrow('toContain only supports strings and arrays');
    expect(() => directExpect(42).not.toMatch('4')).toThrow('toMatch expects a string');
    expect(() => directExpect('x').not.toHaveBeenCalled()).toThrow('expects a mock function');
  });
});

describe('number matchers', () => {
  test('compare numbers and bigints', () => {
    directExpect(3).toBeGreaterThan(2);
    directExpect(3).toBeGreaterThanOrEqual(3);
    directExpect(2).toBeLessThan(3);
    directExpect(3).toBeLessThanOrEqual(3);
    directExpect(10n).toBeGreaterThan(9n);
    directExpect(1).not.toBeGreaterThan(1);
    expect(() => directExpect(1).toBeGreaterThan(2)).toThrow('Expected 1 to be greater than 2');
    expect(() => directExpect(3).toBeLessThanOrEqual(2)).toThrow('to be less than or equal to 2');
  });

  test('NaN never compares', () => {
    expect(() => directExpect(NaN).toBeGreaterThan(0)).toThrow('to be greater than');
    expect(() => directExpect(NaN).toBeLessThanOrEqual(0)).toThrow('to be less than or equal to');
  });

  test('reject non-numbers', () => {
    expect(() => directExpect('3').toBeGreaterThan(2)).toThrow('expects numbers or bigints');
  });

  test('toBeCloseTo uses Jest precision rules', () => {
    directExpect(0.1 + 0.2).toBeCloseTo(0.3);
    directExpect(0.123).toBeCloseTo(0.12, 1);
    directExpect(Infinity).toBeCloseTo(Infinity);
    directExpect(0.1).not.toBeCloseTo(0.2);
    expect(() => directExpect(0.124).toBeCloseTo(0.12, 3)).toThrow('to be close to 0.12 (3 decimal places)');
    expect(() => directExpect('1').toBeCloseTo(1)).toThrow('toBeCloseTo expects numbers');
  });
});

describe('object matchers', () => {
  test('toStrictEqual', () => {
    directExpect({ a: [1, { b: 2 }] }).toStrictEqual({ a: [1, { b: 2 }] });
    expect(() => directExpect({ a: 1 }).toStrictEqual({ a: '1' })).toThrow('to strictly equal');
  });

  test('toBeInstanceOf', () => {
    class Custom {}
    directExpect(new Custom()).toBeInstanceOf(Custom);
    directExpect([]).toBeInstanceOf(Array);
    directExpect({}).not.toBeInstanceOf(Custom);
    expect(() => directExpect({}).toBeInstanceOf(Custom)).toThrow('to be an instance of Custom');
    expect(() => directExpect({}).toBeInstanceOf('Custom')).toThrow('expects a class or constructor');
  });

  test('toHaveProperty with dotted, bracketed and array paths', () => {
    const value = { a: { b: [{ c: 1 }] }, 'dotted.key': true, nothing: undefined };
    directExpect(value).toHaveProperty('a.b[0].c');
    directExpect(value).toHaveProperty('a.b.0.c', 1);
    directExpect(value).toHaveProperty(['a', 'b', 0, 'c'], 1);
    directExpect(value).toHaveProperty(['dotted.key'], true);
    directExpect(value).toHaveProperty('nothing', undefined);
    directExpect(value).not.toHaveProperty('a.missing');
    directExpect('text').toHaveProperty('length', 4);
    expect(() => directExpect(value).toHaveProperty('a.b[1].c')).toThrow("to have property 'a.b[1].c'");
    expect(() => directExpect(value).toHaveProperty('a.b[0].c', 2)).toThrow("Expected property 'a.b[0].c' to be 2, received 1");
    expect(() => directExpect(null).toHaveProperty('a')).toThrow('toHaveProperty expects an object');
    expect(() => directExpect(value).toHaveProperty('')).toThrow('non-empty string or array path');
  });
});

describe('toThrow', () => {
  test('matches an error class', () => {
    directExpect(() => { throw new TypeError('bad'); }).toThrow(TypeError);
    directExpect(() => { throw new TypeError('bad'); }).toThrow(Error);
    expect(() => directExpect(() => { throw new Error('bad'); }).toThrow(TypeError)).toThrow('Expected function to throw TypeError');
  });

  test('treats a thrown falsy value as a throw', () => {
    directExpect(() => { throw null; }).toThrow();
  });

  test('points async functions to .rejects without leaking the rejection', async () => {
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      expect(() => directExpect(async () => { throw new Error('x'); }).toThrow()).toThrow('.rejects.toThrow()');
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    directExpect(unhandled).toHaveLength(0);
  });
});

describe('.resolves and .rejects', () => {
  test('.resolves runs matchers against the resolved value', async () => {
    await directExpect(Promise.resolve(42)).resolves.toBe(42);
    await directExpect(Promise.resolve({ a: 1, b: 2 })).resolves.toMatchObject({ a: 1 });
    await directExpect(Promise.resolve(1)).resolves.not.toBe(2);
    await directExpect(async () => 'from a function').resolves.toContain('function');

    const error = await rejectsWith(directExpect(Promise.resolve(1)).resolves.toBe(2));
    directExpect(error.message).toBe('Expected 1 to be 2');
  });

  test('.resolves fails when the promise rejects', async () => {
    const error = await rejectsWith(directExpect(Promise.reject(new Error('nope'))).resolves.toBe(1));
    directExpect(error.message).toMatch(/^Expected promise to resolve, but it rejected with Error: nope/);
  });

  test('.rejects.toThrow checks the rejection reason', async () => {
    await directExpect(Promise.reject(new Error('boom'))).rejects.toThrow('boom');
    await directExpect(Promise.reject(new TypeError('bad'))).rejects.toThrow(TypeError);
    await directExpect(async () => { throw new Error('async boom'); }).rejects.toThrow(/async/);
    await directExpect(Promise.reject(new Error('boom'))).rejects.toBeInstanceOf(Error);
    await directExpect(Promise.reject(new Error('boom'))).rejects.not.toThrow('other');

    const error = await rejectsWith(directExpect(Promise.reject(new Error('boom'))).rejects.toThrow('other'));
    directExpect(error.message).toBe("Expected thrown message 'boom' to include 'other'");
  });

  test('.rejects fails when the promise resolves', async () => {
    const error = await rejectsWith(directExpect(Promise.resolve('ok')).rejects.toThrow());
    directExpect(error.message).toBe("Expected promise to reject, but it resolved with 'ok'");
  });

  test('a non-promise is a usage error', async () => {
    const error = await rejectsWith(directExpect(42).resolves.toBe(42));
    directExpect(error).toBeInstanceOf(TypeError);
    directExpect(error.message).toBe('.resolves expects a promise, received 42');
  });
});
