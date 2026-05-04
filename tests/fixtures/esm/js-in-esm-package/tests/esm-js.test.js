import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

intent('.js test in type:module package loads via dynamic import', ({ assert }) => {
  assert(() => {
    expect(pkg.type).toBe('module');
    expect(pkg.name).toBe('themis-fixture-js-in-esm-package');
  });
});
