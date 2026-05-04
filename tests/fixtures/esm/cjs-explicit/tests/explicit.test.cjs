const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

intent('explicit cjs file loads via require', ({ assert }) => {
  assert(() => {
    expect(pkg.name).toBe('themis-fixture-cjs-explicit');
    expect(pkg.type).toBeUndefined();
  });
});
