import { describe, test, expect, jest } from '@jest/globals';

mock('../src/dependency.js', () => ({
  fetchName: jest.fn(() => 'mocked')
}));

const { fetchName } = require('../src/dependency.js');

describe('jest module mock fixture', () => {
  test('migrates namespace mocks to Themis helpers', () => {
    expect(fetchName()).toBe('mocked');
    expect(fetchName).toBeCalledTimes(1);
  });
});
