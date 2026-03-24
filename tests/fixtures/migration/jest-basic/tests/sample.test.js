import { describe, it, expect } from '@jest/globals';

describe('jest basic fixture', () => {
  it('converts matcher aliases and still runs', () => {
    const worker = fn();
    worker('ok');

    expect({ status: 'ok' }).toStrictEqual({ status: 'ok' });
    expect([1, 2]).toContainEqual(2);
    expect(worker).toBeCalledTimes(1);
    expect(worker).lastCalledWith('ok');
  });
});
