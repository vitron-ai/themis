const { expect: directExpect } = require('../src/expect');

describe('expect matchers', () => {
  describe('toMatch', () => {
    test('passes when string matches a regex', () => {
      directExpect('hello world').toMatch(/hello/);
      directExpect('alethia-mcp v0.8.6').toMatch(/^alethia-mcp v\d+\.\d+\.\d+$/);
    });

    test('passes when string includes a substring', () => {
      directExpect('hello world').toMatch('world');
    });

    test('throws when regex does not match', () => {
      expect(() => directExpect('hello').toMatch(/^world$/)).toThrow('match');
    });

    test('throws when substring is not present', () => {
      expect(() => directExpect('hello').toMatch('world')).toThrow('match');
    });

    test('throws when received is not a string', () => {
      expect(() => directExpect(42).toMatch(/4/)).toThrow('expects a string');
      expect(() => directExpect(undefined).toMatch('x')).toThrow('expects a string');
      expect(() => directExpect(null).toMatch('x')).toThrow('expects a string');
    });

    test('throws when expected is neither string nor RegExp', () => {
      expect(() => directExpect('hello').toMatch(42)).toThrow('string or RegExp');
      expect(() => directExpect('hello').toMatch(null)).toThrow('string or RegExp');
    });
  });
});

describe('toMatchObject', () => {
  const passes = (received, expected) => directExpect(received).toMatchObject(expected);
  const fails = (received, expected) => expect(() => directExpect(received).toMatchObject(expected)).toThrow('to match object shape');

  test('matches a subset of keys, recursively', () => {
    passes({ status: 'ok', meta: { team: 'themis', stable: true } }, { meta: { team: 'themis' } });
    fails({ status: 'ok' }, { status: 'error' });
    fails({ status: 'ok' }, { missing: undefined });
  });

  test('matches objects inside arrays partially', () => {
    passes({ items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }, { items: [{ id: 1 }, { id: 2 }] });
    fails({ items: [{ id: 1, name: 'a' }] }, { items: [{ id: 2 }] });
  });

  test('accepts arrays as the received value', () => {
    passes([{ id: 1 }], [{ id: 1 }]);
    passes([{ id: 1, name: 'a' }], [{ id: 1 }]);
    passes([[{ id: 1, extra: true }]], [[{ id: 1 }]]);
  });

  test('requires arrays to have the same length', () => {
    fails([{ id: 1 }, { id: 2 }], [{ id: 1 }]);
    fails({ items: [1] }, { items: [1, 2] });
    fails({ items: { 0: 1 } }, { items: [1] });
  });

  test('compares Date, RegExp, Map and Set by value instead of by keys', () => {
    passes({ at: new Date(1) }, { at: new Date(1) });
    fails({ at: new Date(1) }, { at: new Date(2) });
    fails({ pattern: /a/ }, { pattern: /b/ });
    fails({ lookup: { a: 1 } }, { lookup: new Map() });
    passes({ tags: new Set(['x']) }, { tags: new Set(['x']) });
    fails({ tags: new Set(['x']) }, { tags: new Set(['y']) });
  });

  test('rejects non-object expectations', () => {
    fails({ a: 1 }, null);
    fails('text', 'text');
  });
});
