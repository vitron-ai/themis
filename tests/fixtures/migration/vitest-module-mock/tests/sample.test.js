import { describe, test, expect, vi } from 'vitest';

mock('../src/dependency.js', () => ({
  fetchName: vi.fn(() => 'mocked')
}));

const { fetchName } = require('../src/dependency.js');

describe('vitest module mock fixture', () => {
  test('migrates namespace mocks to Themis helpers', () => {
    expect(fetchName()).toBe('mocked');
    expect(fetchName).toBeCalledTimes(1);
  });
});
