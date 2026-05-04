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
