import { describe, it, expect } from 'vitest';

describe('vitest basic fixture', () => {
  it('runs through vitest compatibility and codemods', () => {
    expect({ status: 'ok' }).toStrictEqual({ status: 'ok' });
    expect([1, 2]).toContainEqual(2);
    expect(true).toBeTruthy();
  });
});
