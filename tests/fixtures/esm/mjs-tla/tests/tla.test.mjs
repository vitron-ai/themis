const computed = await Promise.resolve({ value: 7 });
const doubled = await new Promise((resolve) => setImmediate(() => resolve(computed.value * 2)));

intent('top-level await resolves before tests register', ({ assert }) => {
  assert(() => {
    expect(computed.value).toBe(7);
    expect(doubled).toBe(14);
  });
});

test('TLA result is captured into closure', () => {
  expect(doubled).toBe(14);
});
