describe('expect matcher typings', () => {
  test('toMatch accepts a substring or a RegExp', () => {
    expect('themis verdict').toMatch('verdict');
    expect('themis verdict').toMatch(/^themis/);
    // @ts-expect-error toMatch takes a string or RegExp
    expect('themis verdict').toMatch(42);
  });
});
