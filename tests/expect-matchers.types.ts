describe('expect modifier and matcher typings', () => {
  test('.not exposes the same matchers', () => {
    expect([1, 2]).not.toContain(3);
    expect(3).not.toBeLessThan(2);
    // @ts-expect-error modifiers do not chain
    expect(1).not.not.toBe(1);
  });

  test('number and object matchers', () => {
    expect(3).toBeGreaterThan(2);
    expect(10n).toBeLessThanOrEqual(10n);
    expect(0.3).toBeCloseTo(0.1 + 0.2, 5);
    expect({ a: { b: 1 } }).toHaveProperty('a.b', 1);
    expect({ a: [1] }).toHaveProperty(['a', 0]);
    expect(new Error('x')).toBeInstanceOf(Error);
    expect({ a: 1 }).toStrictEqual({ a: 1 });
    expect(() => { throw new TypeError('x'); }).toThrow(TypeError);
    // @ts-expect-error toBeGreaterThan takes a number or bigint
    expect(3).toBeGreaterThan('2');
  });

  test('.resolves and .rejects return promises', async () => {
    const resolved: Promise<void> = expect(Promise.resolve(1)).resolves.toBe(1);
    await resolved;
    await expect(Promise.resolve('x')).resolves.not.toBe('y');
    await expect(Promise.reject(new Error('x'))).rejects.toThrow('x');
    // @ts-expect-error resolved value is a number
    await expect(Promise.resolve(1)).resolves.toBe('1');
  });
});
