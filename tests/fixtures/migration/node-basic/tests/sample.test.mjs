import test from 'node:test';
import assert from 'node:assert/strict';

let seenAfterEach = 0;

test('equal handles primitives', () => {
  assert.equal(1 + 1, 2);
  assert.equal('alethia', 'alethia');
});

test('deepEqual handles nested objects', () => {
  assert.deepEqual({ a: { b: [1, 2, 3] } }, { a: { b: [1, 2, 3] } });
});

test('ok accepts truthy values and ignores message arg', () => {
  assert.ok(42, 'should be truthy');
  assert.ok('non-empty');
});

test('match passes a string against a RegExp', () => {
  assert.match('alethia-mcp v0.8.6', /^alethia-mcp v\d+\.\d+\.\d+$/);
});

test('balanced-paren scanner handles nested calls in args', () => {
  assert.equal(JSON.stringify({ a: 1, b: [2, 3] }), '{"a":1,"b":[2,3]}');
});

test('rejects with regex matcher', async () => {
  await assert.rejects(
    () => Promise.reject(new Error('cold-path offline error: missing pin')),
    /missing pin/,
    'should mention the missing pin'
  );
});

test('rejects with no matcher', async () => {
  await assert.rejects(() => Promise.reject(new Error('any error')));
});

test.afterEach(() => {
  seenAfterEach += 1;
});

test.after(() => {
  if (seenAfterEach < 7) {
    throw new Error(`Expected afterEach to fire 7 times, saw ${seenAfterEach}`);
  }
});
