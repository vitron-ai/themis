import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';

let workerCalls;

before(() => {
  workerCalls = [];
});

describe('node basic fixture', () => {
  test('converts assert calls and still runs', () => {
    const worker = (value) => { workerCalls.push(value); };
    worker('ok');

    assert.equal(workerCalls.length, 1);
    assert.deepEqual({ status: 'ok' }, { status: 'ok' });
    assert.strictEqual(workerCalls[0], 'ok');
    assert.ok(workerCalls.includes('ok'));
  });
});
