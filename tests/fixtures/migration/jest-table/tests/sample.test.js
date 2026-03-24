import { describe, test, expect } from '@jest/globals';

describe.each([
  ['double two', 2, 4],
  ['double three', 3, 6]
])('jest table fixture %s', (label, input, expected) => {
  test('computes %i to %i', () => {
    expect(input * 2).toBe(expected);
    expect(label).toBeTruthy();
  });
});
