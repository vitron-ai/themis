const { initConfig } = require('./config');
const { ensureGitignoreEntries } = require('./gitignore');

function runInit(cwd) {
  initConfig(cwd);
  ensureGitignoreEntries(cwd, ['.themis/']);
}

module.exports = {
  runInit
};
