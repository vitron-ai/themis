import { describe, test, expect } from 'vitest';

test.each([
  ['sum one', 1, 2],
  ['sum two', 2, 3]
])('vitest table fixture %s', (label, left, expected) => {
  expect(left + 1).toBe(expected);
  expect(label).toBeTruthy();
});
