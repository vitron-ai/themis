import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRaw = await readFile(join(here, '..', 'package.json'), 'utf8');
const pkg = JSON.parse(pkgRaw);

intent('post-migrate node:test shape works under Themis', ({ assert }) => {
  assert(() => {
    expect(pkg.type).toBe('module');
    expect(pkg.name).toBe('themis-fixture-mjs-node-test');
  });
});
