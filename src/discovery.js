const fs = require('fs');
const path = require('path');

function discoverTests(cwd, config) {
  const start = path.resolve(cwd, config.testDir);
  const regex = new RegExp(config.testRegex);
  const files = [];

  if (!fs.existsSync(start)) {
    return files;
  }

  walk(start, regex, files);
  return files.sort();
}

function walk(dir, regex, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, regex, files);
      continue;
    }
    if (entry.isFile() && regex.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

module.exports = { discoverTests };
