#!/usr/bin/env node

// Themis Claude Code PostToolUse hook.
//
// This script is invoked by Claude Code after Edit/Write/MultiEdit tool calls.
// It reads the tool input from stdin, decides whether the edit is worth
// re-running tests for, and if so runs `themis test --reporter agent` (using
// --rerun-failed when there is a prior failed-tests artifact). When tests
// fail, the JSON failure payload is written to stderr and the script exits
// with code 2 — Claude Code feeds that back into the model so it can fix
// failures using the structured `failures[].cluster` and
// `failures[].repairHints` fields.
//
// Wire it up in `.claude/settings.json`:
//
// {
//   "hooks": {
//     "PostToolUse": [
//       {
//         "matcher": "Edit|Write|MultiEdit",
//         "hooks": [
//           { "type": "command", "command": "node node_modules/@vitronai/themis/scripts/claude-hook.js" }
//         ]
//       }
//     ]
//   }
// }
//
// Disable temporarily by setting THEMIS_HOOK_DISABLED=1 in your environment.
// Disable permanently by removing the entry from .claude/settings.json.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IGNORED_PATH_SEGMENTS = ['.themis', '__themis__', 'node_modules', '.git'];

function exitSilent() {
  process.exit(0);
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_err) {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

function extractFilePath(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const input = payload.tool_input;
  if (!input || typeof input !== 'object') return null;
  if (typeof input.file_path === 'string') return input.file_path;
  // MultiEdit nests edits in an array but still uses the top-level file_path.
  return null;
}

function isWorthRerunning(filePath, cwd) {
  if (!filePath) return false;
  const normalized = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const relative = path.relative(cwd, normalized);
  if (relative.startsWith('..')) return false;

  const segments = relative.split(path.sep);
  for (const segment of segments) {
    if (IGNORED_PATH_SEGMENTS.includes(segment)) return false;
  }

  const ext = path.extname(normalized).toLowerCase();
  if (!SOURCE_EXT.has(ext)) return false;

  return true;
}

function hasFailedTestsArtifact(cwd) {
  const candidates = [
    path.join(cwd, '.themis', 'runs', 'failed-tests.json'),
    path.join(cwd, '.themis', 'failed-tests.json')
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function findThemisBin(cwd) {
  // Prefer the locally installed bin so the hook does not depend on `npx`
  // resolution behavior or network state.
  const localBin = path.join(cwd, 'node_modules', '.bin', 'themis');
  if (fs.existsSync(localBin)) return { command: localBin, args: [] };
  const localScript = path.join(cwd, 'node_modules', '@vitronai', 'themis', 'bin', 'themis.js');
  if (fs.existsSync(localScript)) return { command: process.execPath, args: [localScript] };
  return { command: 'npx', args: ['--no-install', 'themis'] };
}

function main() {
  if (process.env.THEMIS_HOOK_DISABLED) exitSilent();

  const raw = readStdinSync();
  const payload = parsePayload(raw);
  const cwd = (payload && typeof payload.cwd === 'string' && payload.cwd) || process.cwd();
  const filePath = extractFilePath(payload);

  if (!isWorthRerunning(filePath, cwd)) exitSilent();

  const themis = findThemisBin(cwd);
  const args = [...themis.args, 'test', '--reporter', 'agent'];
  if (hasFailedTestsArtifact(cwd)) args.push('--rerun-failed');

  const result = spawnSync(themis.command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    maxBuffer: 32 * 1024 * 1024
  });

  if (result.error) {
    // Hook itself failed (binary not found, etc). Stay silent rather than
    // blocking the user's edit loop on infrastructure problems.
    exitSilent();
  }

  const stdout = (result.stdout || Buffer.alloc(0)).toString('utf8');
  const stderr = (result.stderr || Buffer.alloc(0)).toString('utf8');

  if (result.status === 0) {
    exitSilent();
  }

  // Tests failed. Surface the agent JSON payload (or stderr fallback) to
  // Claude via stderr + exit 2 so it lands in the model's context.
  process.stderr.write('Themis tests failed after edit. Use failures[].cluster and failures[].repairHints below to fix:\n');
  if (stdout.trim().length > 0) {
    process.stderr.write(stdout);
    if (!stdout.endsWith('\n')) process.stderr.write('\n');
  } else if (stderr.trim().length > 0) {
    process.stderr.write(stderr);
    if (!stderr.endsWith('\n')) process.stderr.write('\n');
  }
  process.exit(2);
}

main();
