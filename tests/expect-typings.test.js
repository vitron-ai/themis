const fs = require('fs');
const path = require('path');
const { expect: runtimeExpect } = require('../src/expect');

// Every matcher the runtime provides must be declared on ExpectMatchers in index.d.ts,
// or TypeScript users get "Property ... does not exist" for a working matcher.
function declaredMatchers() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.d.ts'), 'utf8');
  const body = source.match(/export interface ExpectMatchers<[^>]*> \{([\s\S]*?)\n\}/);
  if (!body) {
    throw new Error('ExpectMatchers interface not found in index.d.ts');
  }
  return [...body[1].matchAll(/^\s+(?:readonly\s+)?([A-Za-z]\w*)\??[(:]/gm)].map((match) => match[1]).sort();
}

describe('expect typings', () => {
  test('index.d.ts declares every runtime matcher', () => {
    const runtime = Object.keys(runtimeExpect(1)).sort();
    const declared = declaredMatchers();
    expect(runtime.filter((name) => !declared.includes(name))).toEqual([]);
  });

  test('index.d.ts declares no matcher the runtime lacks', () => {
    const runtime = Object.keys(runtimeExpect(1));
    expect(declaredMatchers().filter((name) => !runtime.includes(name))).toEqual([]);
  });
});
