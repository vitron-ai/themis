const fs = require('fs');
const path = require('path');
const { initConfig } = require('./config');
const { ensureGitignoreEntries } = require('./gitignore');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const AGENTS_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'AGENTS.themis.md');
const CLAUDE_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'CLAUDE.themis.md');
const CLAUDE_SKILL_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'claude-skill', 'SKILL.md');
const CLAUDE_COMMANDS_TEMPLATE_DIR = path.join(TEMPLATES_DIR, 'claude-commands');
const CURSOR_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'cursorrules.themis.md');

function runInit(cwd, options = {}) {
  initConfig(cwd);
  ensureGitignoreEntries(cwd, ['.themis/', '__themis__/reports/', '__themis__/shims/']);

  const hasExplicitFlags = options.agents || options.claudeCode || options.cursor;
  const detected = hasExplicitFlags ? options : detectAgents(cwd, options);

  const result = {};

  if (detected.agents) {
    result.agents = ensureAgentsTemplate(cwd);
  }

  if (detected.claudeCode) {
    result.claudeCode = ensureClaudeCodeAssets(cwd);
  }

  if (detected.cursor) {
    result.cursor = writeCursorRules(cwd);
  }

  result.autoDetected = !hasExplicitFlags;
  return result;
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

function ensureClaudeCodeAssets(cwd) {
  const result = {
    claudeMd: writeClaudeMd(cwd),
    skill: writeClaudeSkill(cwd),
    commands: writeClaudeCommands(cwd)
  };
  return result;
}

function writeClaudeMd(cwd) {
  const targetPath = path.join(cwd, 'CLAUDE.md');
  const source = fs.readFileSync(CLAUDE_TEMPLATE_PATH, 'utf8');

  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, source, 'utf8');
    return { path: targetPath, created: true, appended: false };
  }

  const existing = fs.readFileSync(targetPath, 'utf8');
  if (existing.includes('@vitronai/themis')) {
    return { path: targetPath, created: false, appended: false };
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(targetPath, existing + separator + source, 'utf8');
  return { path: targetPath, created: false, appended: true };
}

function writeClaudeSkill(cwd) {
  const targetDir = path.join(cwd, '.claude', 'skills', 'themis');
  const targetPath = path.join(targetDir, 'SKILL.md');
  if (fs.existsSync(targetPath)) {
    return { path: targetPath, created: false };
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const source = fs.readFileSync(CLAUDE_SKILL_TEMPLATE_PATH, 'utf8');
  fs.writeFileSync(targetPath, source, 'utf8');
  return { path: targetPath, created: true };
}

function writeClaudeCommands(cwd) {
  const targetDir = path.join(cwd, '.claude', 'commands');
  fs.mkdirSync(targetDir, { recursive: true });

  const entries = fs.readdirSync(CLAUDE_COMMANDS_TEMPLATE_DIR);
  const written = [];
  const skipped = [];

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const sourcePath = path.join(CLAUDE_COMMANDS_TEMPLATE_DIR, entry);
    const targetPath = path.join(targetDir, entry);
    if (fs.existsSync(targetPath)) {
      skipped.push(targetPath);
      continue;
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(targetPath, source, 'utf8');
    written.push(targetPath);
  }

  return { dir: targetDir, written, skipped };
}

function detectAgents(cwd) {
  const flags = { agents: true, claudeCode: false, cursor: false };

  // Claude Code: .claude/ dir or CLAUDE.md exists
  if (fs.existsSync(path.join(cwd, '.claude')) || fs.existsSync(path.join(cwd, 'CLAUDE.md'))) {
    flags.claudeCode = true;
  }

  // Cursor: .cursorrules or .cursor/ dir exists
  if (fs.existsSync(path.join(cwd, '.cursorrules')) || fs.existsSync(path.join(cwd, '.cursor'))) {
    flags.cursor = true;
  }

  return flags;
}

function writeCursorRules(cwd) {
  const targetPath = path.join(cwd, '.cursorrules');
  const source = fs.readFileSync(CURSOR_TEMPLATE_PATH, 'utf8');

  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, source, 'utf8');
    return { path: targetPath, created: true, appended: false };
  }

  const existing = fs.readFileSync(targetPath, 'utf8');
  if (existing.includes('@vitronai/themis')) {
    return { path: targetPath, created: false, appended: false };
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(targetPath, existing + separator + source, 'utf8');
  return { path: targetPath, created: false, appended: true };
}

module.exports = {
  runInit
};
