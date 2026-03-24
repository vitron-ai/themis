import { describe, test, expect, jest } from '@jest/globals';

describe('jest timers fixture', () => {
  test('advances fake timers after codemod conversion', () => {
    jest.useFakeTimers();
    const events = [];

    setTimeout(() => {
      events.push('tick');
    }, 10);

    jest.advanceTimersByTime(10);
    expect(events).toEqual(['tick']);

    jest.useRealTimers();
  });
});
