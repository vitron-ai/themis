const fs = require('fs');
const path = require('path');
const { initConfig } = require('./config');
const { ensureGitignoreEntries } = require('./gitignore');

const AGENTS_TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'AGENTS.themis.md');

function runInit(cwd, options = {}) {
  initConfig(cwd);
  ensureGitignoreEntries(cwd, ['.themis/', '__themis__/reports/', '__themis__/shims/']);

  if (options.agents) {
    return ensureAgentsTemplate(cwd);
  }

  return null;
}

function ensureAgentsTemplate(cwd) {
  const targetPath = path.join(cwd, 'AGENTS.md');
  if (fs.existsSync(targetPath)) {
    return {
      path: targetPath,
      created: false
    };
  }

  const source = fs.readFileSync(AGENTS_TEMPLATE_PATH, 'utf8');
  fs.writeFileSync(targetPath, source, 'utf8');
  return {
    path: targetPath,
    created: true
  };
}

module.exports = {
  runInit
};
