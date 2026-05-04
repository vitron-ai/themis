#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveArtifactDir } = require('../src/artifact-paths');

const rootDir = path.resolve(__dirname, '..');
const themisCli = path.join(rootDir, 'bin', 'themis.js');

const ALETHIA_MCP_REPO = process.env.ALETHIA_MCP_REPO || '/Users/higgs/github/alethia-mcp';
const MIN_PASSED = Number(process.env.THEMIS_DOGFOOD_MIN_PASSED || 50);

function main() {
  if (!fs.existsSync(ALETHIA_MCP_REPO)) {
    console.log(`SKIP verify:dogfood — alethia-mcp repo not found at ${ALETHIA_MCP_REPO}`);
    console.log('Set ALETHIA_MCP_REPO to override the default path.');
    return;
  }

  const required = ['bridge-tests', 'dist', 'package.json', 'node_modules'];
  for (const entry of required) {
    if (!fs.existsSync(path.join(ALETHIA_MCP_REPO, entry))) {
      throw new Error(
        `alethia-mcp repo at ${ALETHIA_MCP_REPO} is missing required entry "${entry}". ` +
        `Run npm install + npm run build in alethia-mcp before invoking verify:dogfood.`
      );
    }
  }

  const proofDir = resolveArtifactDir(rootDir, 'dogfood', 'alethia-bridge');
  fs.rmSync(proofDir, { recursive: true, force: true });
  fs.mkdirSync(proofDir, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'themis-alethia-dogfood-'));
  try {
    copyEntries(ALETHIA_MCP_REPO, tempDir, ['dist', 'package.json', 'node_modules']);
    copyDirectory(path.join(ALETHIA_MCP_REPO, 'bridge-tests'), path.join(tempDir, 'tests'));

    const migrate = runCli(tempDir, ['migrate', 'node', '--convert']);
    if (migrate.status !== 0) {
      dump(migrate, 'migrate node failed');
      throw new Error('themis migrate node returned non-zero exit');
    }

    const reportPath = path.join(tempDir, '.themis', 'migration', 'migration-report.json');
    if (!fs.existsSync(reportPath)) {
      throw new Error(`migration report missing at ${reportPath}`);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (report.source !== 'node') {
      throw new Error(`Expected migration source "node", received "${report.source}".`);
    }
    if (report.summary.convertedFiles < 1) {
      throw new Error('Expected at least one converted file from migrate node.');
    }

    const testRun = runCli(tempDir, ['test', '--json', '--isolation', 'process']);
    if (testRun.status !== 0) {
      dump(testRun, 'themis test failed');
      throw new Error('themis test returned non-zero exit on migrated alethia-mcp bridge-tests');
    }

    let payload;
    try {
      payload = JSON.parse(testRun.stdout);
    } catch (error) {
      throw new Error(`Failed to parse json reporter output: ${error.message}\n${testRun.stdout.slice(0, 500)}`);
    }

    if (payload.summary.failed !== 0) {
      throw new Error(
        `Dogfood failed: ${payload.summary.failed} failure(s) out of ${payload.summary.total} tests.\n` +
        firstFailureContext(payload)
      );
    }
    if (payload.summary.passed < MIN_PASSED) {
      throw new Error(
        `Dogfood under-performed: ${payload.summary.passed} passed, expected at least ${MIN_PASSED}. ` +
        `Adjust THEMIS_DOGFOOD_MIN_PASSED if the bridge-tests corpus shrank intentionally.`
      );
    }

    fs.copyFileSync(reportPath, path.join(proofDir, 'migration-report.json'));
    fs.writeFileSync(path.join(proofDir, 'last-run.json'), JSON.stringify(payload, null, 2));
    fs.writeFileSync(
      path.join(proofDir, 'summary.json'),
      JSON.stringify({
        schema: 'themis.dogfood.alethia.v1',
        createdAt: new Date().toISOString(),
        alethiaMcpRepo: ALETHIA_MCP_REPO,
        migration: report.summary,
        run: payload.summary
      }, null, 2)
    );

    console.log(
      `Dogfood OK — alethia-mcp bridge-tests under Themis: ` +
      `${payload.summary.passed} passed / ${payload.summary.total} total ` +
      `(migrated ${report.summary.convertedFiles} files, ${report.summary.convertedAssertions} assertions).`
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runCli(cwd, args) {
  return spawnSync('node', [themisCli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, NO_COLOR: '1' }
  });
}

function dump(result, label) {
  console.error(`---${label}---`);
  if (result.stdout) console.error('stdout:', result.stdout.slice(0, 2000));
  if (result.stderr) console.error('stderr:', result.stderr.slice(0, 2000));
}

function firstFailureContext(payload) {
  for (const file of payload.files) {
    for (const t of file.tests) {
      if (t.status === 'failed') {
        const msg = (t.error && t.error.message) || '';
        return `First failure: ${file.file}\n  ${t.fullName || t.name}\n  ${msg.slice(0, 400)}`;
      }
    }
  }
  return '';
}

function copyEntries(sourceDir, targetDir, names) {
  for (const name of names) {
    const sourcePath = path.join(sourceDir, name);
    const targetPath = path.join(targetDir, name);
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath);
      try { fs.symlinkSync(linkTarget, targetPath); } catch { /* skip dangling links */ }
      continue;
    }
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}
