intent('mjs basic', ({ arrange, act, assert }) => {
  let value;
  arrange(() => { value = 21; });
  act(() => { value = value * 2; });
  assert(() => { expect(value).toBe(42); });
});

test('top-level test() also works in mjs', () => {
  expect(1 + 1).toBe(2);
});
