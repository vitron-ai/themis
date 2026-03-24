import { describe, test, expect, vi } from 'vitest';

describe('vitest timers fixture', () => {
  test('advances fake timers after codemod conversion', () => {
    vi.useFakeTimers();
    const events = [];

    setTimeout(() => {
      events.push('tick');
    }, 10);

    vi.advanceTimersByTime(10);
    expect(events).toEqual(['tick']);

    vi.useRealTimers();
  });
});
