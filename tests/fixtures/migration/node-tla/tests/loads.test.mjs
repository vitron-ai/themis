import test from 'node:test';
import assert from 'node:assert/strict';

const config = await Promise.resolve({ runtime: 'alethia', version: '0.7.8' });
const computed = await new Promise((resolve) => setImmediate(() => resolve(config.version + '-tla')));

test('TLA result is captured before tests register', () => {
  assert.equal(config.runtime, 'alethia');
  assert.equal(config.version, '0.7.8');
});

test('TLA-derived value flows into closures', () => {
  assert.equal(computed, '0.7.8-tla');
  assert.match(computed, /^0\.7\.8-tla$/);
});
