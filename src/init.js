const fs = require('fs');
const path = require('path');
const { initConfig } = require('./config');

function runInit(cwd) {
  initConfig(cwd);

  const testsDir = path.join(cwd, 'tests');
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  const sample = path.join(testsDir, 'example.test.js');
  if (!fs.existsSync(sample)) {
    const content = `describe('math', () => {\n  test('adds numbers', () => {\n    expect(1 + 1).toBe(2);\n  });\n});\n`;
    fs.writeFileSync(sample, content, 'utf8');
  }
}

module.exports = {
  runInit
};
