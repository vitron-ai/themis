const path = require('path');

const ARTIFACT_DIR = '.themis';
const USER_OUTPUT_DIR = '__themis__';
const RUNS_DIR = ['runs'];
const DIFFS_DIR = ['diffs'];
const GENERATE_DIR = ['generate'];
const MIGRATION_DIR = ['migration'];
const BENCHMARKS_DIR = ['benchmarks'];
const REPORTS_DIR = ['reports'];
const SHOWCASE_COMPARISON_DIR = [...BENCHMARKS_DIR, 'showcase-comparison'];
const MIGRATION_FIXTURES_DIR = [...MIGRATION_DIR, 'fixtures'];

const ARTIFACT_LOCATIONS = Object.freeze({
  lastRun: { root: ARTIFACT_DIR, segments: [...RUNS_DIR, 'last-run.json'] },
  failedTests: { root: ARTIFACT_DIR, segments: [...RUNS_DIR, 'failed-tests.json'] },
  runDiff: { root: ARTIFACT_DIR, segments: [...DIFFS_DIR, 'run-diff.json'] },
  runHistory: { root: ARTIFACT_DIR, segments: [...RUNS_DIR, 'run-history.json'] },
  fixHandoff: { root: ARTIFACT_DIR, segments: [...RUNS_DIR, 'fix-handoff.json'] },
  contractDiff: { root: ARTIFACT_DIR, segments: [...DIFFS_DIR, 'contract-diff.json'] },
  generateMap: { root: ARTIFACT_DIR, segments: [...GENERATE_DIR, 'generate-map.json'] },
  generateResult: { root: ARTIFACT_DIR, segments: [...GENERATE_DIR, 'generate-last.json'] },
  generateHandoff: { root: ARTIFACT_DIR, segments: [...GENERATE_DIR, 'generate-handoff.json'] },
  generateBacklog: { root: ARTIFACT_DIR, segments: [...GENERATE_DIR, 'generate-backlog.json'] },
  migrationReport: { root: ARTIFACT_DIR, segments: [...MIGRATION_DIR, 'migration-report.json'] },
  htmlReport: { root: USER_OUTPUT_DIR, segments: [...REPORTS_DIR, 'report.html'] },
  benchmarkLast: { root: ARTIFACT_DIR, segments: [...BENCHMARKS_DIR, 'benchmark-last.json'] },
  migrationProof: { root: ARTIFACT_DIR, segments: [...BENCHMARKS_DIR, 'migration-proof.json'] }
});

const LEGACY_ARTIFACT_LOCATIONS = Object.freeze({
  lastRun: { root: ARTIFACT_DIR, segments: ['last-run.json'] },
  failedTests: { root: ARTIFACT_DIR, segments: ['failed-tests.json'] },
  runDiff: { root: ARTIFACT_DIR, segments: ['run-diff.json'] },
  runHistory: { root: ARTIFACT_DIR, segments: ['run-history.json'] },
  fixHandoff: { root: ARTIFACT_DIR, segments: ['fix-handoff.json'] },
  contractDiff: { root: ARTIFACT_DIR, segments: ['contract-diff.json'] },
  generateMap: { root: ARTIFACT_DIR, segments: ['generate-map.json'] },
  generateResult: { root: ARTIFACT_DIR, segments: ['generate-last.json'] },
  generateHandoff: { root: ARTIFACT_DIR, segments: ['generate-handoff.json'] },
  generateBacklog: { root: ARTIFACT_DIR, segments: ['generate-backlog.json'] },
  migrationReport: { root: ARTIFACT_DIR, segments: ['migration-report.json'] },
  htmlReport: { root: ARTIFACT_DIR, segments: ['report.html'] },
  benchmarkLast: { root: ARTIFACT_DIR, segments: ['benchmark-last.json'] },
  migrationProof: { root: ARTIFACT_DIR, segments: ['migration-proof.json'] }
});

function joinRelative(location) {
  return path.posix.join(location.root, ...location.segments);
}

function joinAbsolute(cwd, location) {
  return path.join(cwd, location.root, ...location.segments);
}

function buildRelativePathMap(locationMap) {
  return Object.fromEntries(
    Object.entries(locationMap).map(([key, location]) => [key, joinRelative(location)])
  );
}

const ARTIFACT_RELATIVE_PATHS = Object.freeze(buildRelativePathMap(ARTIFACT_LOCATIONS));
const LEGACY_ARTIFACT_RELATIVE_PATHS = Object.freeze(buildRelativePathMap(LEGACY_ARTIFACT_LOCATIONS));
const ARTIFACT_SEGMENTS = Object.freeze(
  Object.fromEntries(
    Object.entries(ARTIFACT_LOCATIONS).map(([key, location]) => [key, [...location.segments]])
  )
);

function resolveArtifactPath(cwd, key) {
  return joinAbsolute(cwd, ARTIFACT_LOCATIONS[key]);
}

function resolveLegacyArtifactPath(cwd, key) {
  return joinAbsolute(cwd, LEGACY_ARTIFACT_LOCATIONS[key]);
}

function resolveArtifactDir(cwd, ...segments) {
  return path.join(cwd, ARTIFACT_DIR, ...segments);
}

function resolveRelativeDir(...segments) {
  return path.posix.join(ARTIFACT_DIR, ...segments);
}

function getArtifactPaths(cwd) {
  return Object.fromEntries(
    Object.keys(ARTIFACT_LOCATIONS).map((key) => [key, resolveArtifactPath(cwd, key)])
  );
}

function getArtifactPathCandidates(cwd, key) {
  const nextPath = resolveArtifactPath(cwd, key);
  const legacyPath = resolveLegacyArtifactPath(cwd, key);
  return nextPath === legacyPath ? [nextPath] : [nextPath, legacyPath];
}

module.exports = {
  ARTIFACT_DIR,
  USER_OUTPUT_DIR,
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
