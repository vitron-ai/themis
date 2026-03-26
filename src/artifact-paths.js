const path = require('path');

const ARTIFACT_DIR = '.themis';
const RUNS_DIR = ['runs'];
const DIFFS_DIR = ['diffs'];
const GENERATE_DIR = ['generate'];
const REPORTS_DIR = ['reports'];
const MIGRATION_DIR = ['migration'];
const BENCHMARKS_DIR = ['benchmarks'];
const SHOWCASE_COMPARISON_DIR = [...BENCHMARKS_DIR, 'showcase-comparison'];
const MIGRATION_FIXTURES_DIR = [...MIGRATION_DIR, 'fixtures'];

const ARTIFACT_SEGMENTS = Object.freeze({
  lastRun: [...RUNS_DIR, 'last-run.json'],
  failedTests: [...RUNS_DIR, 'failed-tests.json'],
  runDiff: [...DIFFS_DIR, 'run-diff.json'],
  runHistory: [...RUNS_DIR, 'run-history.json'],
  fixHandoff: [...RUNS_DIR, 'fix-handoff.json'],
  contractDiff: [...DIFFS_DIR, 'contract-diff.json'],
  generateMap: [...GENERATE_DIR, 'generate-map.json'],
  generateResult: [...GENERATE_DIR, 'generate-last.json'],
  generateHandoff: [...GENERATE_DIR, 'generate-handoff.json'],
  generateBacklog: [...GENERATE_DIR, 'generate-backlog.json'],
  migrationReport: [...MIGRATION_DIR, 'migration-report.json'],
  htmlReport: [...REPORTS_DIR, 'report.html'],
  benchmarkLast: [...BENCHMARKS_DIR, 'benchmark-last.json'],
  migrationProof: [...BENCHMARKS_DIR, 'migration-proof.json']
});

const LEGACY_ARTIFACT_SEGMENTS = Object.freeze({
  lastRun: ['last-run.json'],
  failedTests: ['failed-tests.json'],
  runDiff: ['run-diff.json'],
  runHistory: ['run-history.json'],
  fixHandoff: ['fix-handoff.json'],
  contractDiff: ['contract-diff.json'],
  generateMap: ['generate-map.json'],
  generateResult: ['generate-last.json'],
  generateHandoff: ['generate-handoff.json'],
  generateBacklog: ['generate-backlog.json'],
  migrationReport: ['migration-report.json'],
  htmlReport: ['report.html'],
  benchmarkLast: ['benchmark-last.json'],
  migrationProof: ['migration-proof.json']
});

function joinRelative(segments) {
  return path.posix.join(ARTIFACT_DIR, ...segments);
}

function joinAbsolute(cwd, segments) {
  return path.join(cwd, ARTIFACT_DIR, ...segments);
}

function buildRelativePathMap(segmentMap) {
  return Object.fromEntries(
    Object.entries(segmentMap).map(([key, segments]) => [key, joinRelative(segments)])
  );
}

const ARTIFACT_RELATIVE_PATHS = Object.freeze(buildRelativePathMap(ARTIFACT_SEGMENTS));
const LEGACY_ARTIFACT_RELATIVE_PATHS = Object.freeze(buildRelativePathMap(LEGACY_ARTIFACT_SEGMENTS));

function resolveArtifactPath(cwd, key) {
  return joinAbsolute(cwd, ARTIFACT_SEGMENTS[key]);
}

function resolveLegacyArtifactPath(cwd, key) {
  return joinAbsolute(cwd, LEGACY_ARTIFACT_SEGMENTS[key]);
}

function resolveArtifactDir(cwd, ...segments) {
  return path.join(cwd, ARTIFACT_DIR, ...segments);
}

function resolveRelativeDir(...segments) {
  return path.posix.join(ARTIFACT_DIR, ...segments);
}

function getArtifactPaths(cwd) {
  return Object.fromEntries(
    Object.keys(ARTIFACT_SEGMENTS).map((key) => [key, resolveArtifactPath(cwd, key)])
  );
}

function getArtifactPathCandidates(cwd, key) {
  const nextPath = resolveArtifactPath(cwd, key);
  const legacyPath = resolveLegacyArtifactPath(cwd, key);
  return nextPath === legacyPath ? [nextPath] : [nextPath, legacyPath];
}

module.exports = {
  ARTIFACT_DIR,
  RUNS_DIR,
  DIFFS_DIR,
  GENERATE_DIR,
  REPORTS_DIR,
  MIGRATION_DIR,
  BENCHMARKS_DIR,
  SHOWCASE_COMPARISON_DIR,
  MIGRATION_FIXTURES_DIR,
  ARTIFACT_SEGMENTS,
  ARTIFACT_RELATIVE_PATHS,
  LEGACY_ARTIFACT_RELATIVE_PATHS,
  resolveArtifactPath,
  resolveLegacyArtifactPath,
  resolveArtifactDir,
  resolveRelativeDir,
  getArtifactPaths,
  getArtifactPathCandidates
};
