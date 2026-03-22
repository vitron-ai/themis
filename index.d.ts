export type Awaitable<T> = T | Promise<T>;

export type TestStatus = 'passed' | 'failed' | 'skipped';

export interface NormalizedError {
  message: string;
  stack: string;
}

export interface TestResult {
  name: string;
  fullName: string;
  status: TestStatus;
  durationMs: number;
  error: NormalizedError | null;
}

export interface FileResult {
  file: string;
  tests: TestResult[];
}

export interface RunMeta {
  startedAt: string;
  finishedAt: string;
  maxWorkers: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export type StabilityStatus = TestStatus | 'missing';
export type StabilityClassification = 'stable_pass' | 'stable_fail' | 'unstable';

export interface StabilityTestResult {
  file: string;
  testName: string;
  fullName: string;
  statuses: StabilityStatus[];
  classification: StabilityClassification;
}

export interface StabilitySummary {
  stablePass: number;
  stableFail: number;
  unstable: number;
}

export interface StabilityReport {
  runs: number;
  summary: StabilitySummary;
  tests: StabilityTestResult[];
}

export interface RunResult {
  meta: RunMeta;
  files: FileResult[];
  summary: RunSummary;
  stability?: StabilityReport;
  artifacts?: RunArtifacts;
}

export type TestEnvironment = 'node' | 'jsdom';

export interface RunOptions {
  maxWorkers?: number;
  match?: string | null;
  allowedFullNames?: string[] | null;
  noMemes?: boolean;
  cwd?: string;
  environment?: TestEnvironment;
  setupFiles?: string[];
  tsconfigPath?: string | null;
  updateSnapshots?: boolean;
}

export interface ThemisConfig {
  testDir: string;
  testRegex: string;
  maxWorkers: number;
  reporter: string;
  environment: TestEnvironment;
  setupFiles: string[];
  tsconfigPath: string | null;
}

export interface GenerateOptions {
  targetDir?: string;
  outputDir?: string;
  force?: boolean;
  strict?: boolean;
  writeHints?: boolean;
  plan?: boolean;
  review?: boolean;
  update?: boolean;
  clean?: boolean;
  changed?: boolean;
  failOnSkips?: boolean;
  failOnConflicts?: boolean;
  requireConfidence?: string | null;
  files?: string[] | string;
  scenario?: string | null;
  minConfidence?: string | null;
  matchSource?: string | null;
  matchExport?: string | null;
  include?: string | null;
  exclude?: string | null;
}

export interface GenerateSkippedFile {
  file: string;
  reason: string;
  stage: string;
}

export interface GenerateScenarioSummary {
  kind: string;
  confidence: string;
  exports: string[];
  caseCount: number;
}

export interface GenerateEntrySummary {
  action: string;
  sourceFile: string;
  testFile: string | null;
  moduleKind: string;
  confidence: string;
  exactExports: boolean;
  exportNames: string[];
  hintsFile: string | null;
  sourceHash: string | null;
  scenarios: GenerateScenarioSummary[];
  reason: string | null;
}

export interface GenerateFilterSummary {
  plan: boolean;
  changed: boolean;
  files: string[];
  scenario: string | null;
  minConfidence: string | null;
  matchSource: string | null;
  matchExport: string | null;
  include: string | null;
  exclude: string | null;
}

export interface GenerateArtifacts {
  generateMap: string;
  helperFile: string;
  generateResult: string;
  generateHandoff: string;
  generateBacklog: string;
}

export interface GenerateHintFiles {
  created: string[];
  updated: string[];
  unchanged: string[];
}

export interface RunArtifactPaths {
  lastRun: string;
  failedTests: string;
  runDiff: string;
  runHistory: string;
  fixHandoff: string;
}

export interface RunComparison {
  status: 'baseline' | 'changed';
  previousRunId: string;
  previousRunAt: string;
  currentRunAt: string;
  delta: RunSummary;
  newFailures: string[];
  resolvedFailures: string[];
}

export interface RunArtifacts {
  runId: string;
  comparison: RunComparison;
  paths: RunArtifactPaths;
}

export interface GenerateGateFailure {
  code: string;
  count: number;
  message: string;
}

export interface GenerateGateSummary {
  strict: boolean;
  failOnSkips: boolean;
  failOnConflicts: boolean;
  requireConfidence: string | null;
  failed: boolean;
  failures: GenerateGateFailure[];
}

export interface GenerateBacklogItem {
  type: string;
  severity: 'warning' | 'error';
  sourceFile: string;
  testFile: string | null;
  moduleKind: string | null;
  confidence: string | null;
  stage: string | null;
  hintsFile: string | null;
  reason: string;
  suggestedAction: string;
  suggestedCommand: string | null;
}

export interface GenerateBacklogSummary {
  total: number;
  errors: number;
  warnings: number;
  skipped: number;
  conflicts: number;
  confidence: number;
}

export interface GenerateBacklog {
  summary: GenerateBacklogSummary;
  items: GenerateBacklogItem[];
}

export interface GeneratePromptTarget {
  action: string;
  sourceFile: string;
  testFile: string | null;
  moduleKind: string;
  confidence: string;
  scenarios: string[];
}

export interface GeneratePromptReady {
  summary: string;
  targets: GeneratePromptTarget[];
  unresolved: GenerateBacklogItem[];
  nextActions: string[];
  prompt: string;
}

export type FixHandoffCategory = 'source-drift' | 'snapshot-drift' | 'generated-contract-failure';

export interface FixHandoffItem {
  file: string;
  name: string;
  fullName: string;
  message: string;
  testFile: string;
  sourceFile: string;
  moduleKind: string | null;
  confidence: string | null;
  scenarios: string[];
  hintsFile: string | null;
  category: FixHandoffCategory;
  failureCount: number;
  failedTests: string[];
  suggestedAction: string;
  suggestedCommand: string | null;
}

export interface FixHandoffPayload {
  schema: 'themis.fix.handoff.v1';
  runId: string;
  createdAt: string;
  summary: {
    totalFailures: number;
    generatedFailures: number;
    staleSources: number;
    snapshotMismatches: number;
    contractFailures: number;
  };
  artifacts: {
    failedTests: string;
    generateMap: string;
    generateBacklog: string;
    fixHandoff: string;
  };
  items: FixHandoffItem[];
  nextActions: string[];
}

export interface GeneratePayload {
  schema: 'themis.generate.result.v1';
  mode: {
    review: boolean;
    update: boolean;
    clean: boolean;
    changed: boolean;
    plan: boolean;
    writeHints: boolean;
  };
  source: {
    targetDir: string;
    outputDir: string;
  };
  filters: GenerateFilterSummary;
  gates: GenerateGateSummary;
  summary: {
    scanned: number;
    generated: number;
    created: number;
    updated: number;
    unchanged: number;
    removed: number;
    skipped: number;
    conflicts: number;
  };
  scannedFiles: string[];
  generatedFiles: string[];
  removedFiles: string[];
  skippedFiles: GenerateSkippedFile[];
  conflictFiles: string[];
  hintFiles: GenerateHintFiles;
  entries: GenerateEntrySummary[];
  backlog: GenerateBacklog;
  artifacts: GenerateArtifacts;
  promptReady: GeneratePromptReady;
  hints: {
    runTests: string;
    plan: string;
    review: string;
    updateOnly: string;
    clean: string;
    changed: string;
    strict: string;
    writeHints: string;
    fileTarget: string;
  };
}

export interface GenerateBacklogPayload {
  schema: 'themis.generate.backlog.v1';
  source: {
    targetDir: string;
    outputDir: string;
  };
  filters: GenerateFilterSummary;
  gates: GenerateGateSummary;
  summary: GenerateBacklogSummary;
  items: GenerateBacklogItem[];
}

export interface GenerateHandoffPayload {
  schema: 'themis.generate.handoff.v1';
  source: {
    targetDir: string;
    outputDir: string;
  };
  filters: GenerateFilterSummary;
  gates: GenerateGateSummary;
  summary: GeneratePayload['summary'];
  artifacts: {
    generateMap: string;
    generateResult: string;
    generateBacklog: string;
  };
  hintFiles: GenerateHintFiles;
  targets: GeneratePromptTarget[];
  unresolved: GenerateBacklogItem[];
  backlog: GenerateBacklogSummary;
  nextActions: string[];
  prompt: string;
}

export interface GenerateSummary {
  targetDir: string;
  outputDir: string;
  helperFile: string;
  mapFile: string;
  scannedFiles: string[];
  generatedFiles: string[];
  removedFiles: string[];
  skippedFiles: GenerateSkippedFile[];
  createdFiles: string[];
  updatedFiles: string[];
  unchangedFiles: string[];
  cleanedFiles: string[];
  conflictFiles: string[];
  entries: GenerateEntrySummary[];
  plan: boolean;
  review: boolean;
  update: boolean;
  clean: boolean;
  changed: boolean;
  writeHints: boolean;
  filters: GenerateFilterSummary;
  gateOptions: {
    strict: boolean;
    failOnSkips: boolean;
    failOnConflicts: boolean;
    requireConfidence: string | null;
  };
  gates: GenerateGateSummary;
  hintFiles: GenerateHintFiles;
  backlog: GenerateBacklog;
  artifacts: GenerateArtifacts;
  prompt: string;
  helperRemoved: boolean;
}

export function main(argv: string[]): Promise<void>;
export function collectAndRun(filePath: string, options?: Omit<RunOptions, 'maxWorkers'>): Promise<FileResult>;
export function runTests(files: string[], options?: RunOptions): Promise<RunResult>;
export function discoverTests(cwd: string, config: ThemisConfig): string[];
export function loadConfig(cwd: string): ThemisConfig;
export function initConfig(cwd: string): void;
export const DEFAULT_CONFIG: ThemisConfig;
export function generateTestsFromSource(cwd: string, options?: GenerateOptions): GenerateSummary;
export function buildGeneratePayload(summary: GenerateSummary, cwd?: string): GeneratePayload;
export function buildGenerateBacklogPayload(summary: GenerateSummary, cwd?: string): GenerateBacklogPayload;
export function buildGenerateHandoff(payload: GeneratePayload): GenerateHandoffPayload;
export function writeGenerateArtifacts(summary: GenerateSummary, cwd?: string): {
  payload: GeneratePayload;
  handoff: GenerateHandoffPayload;
  backlog: GenerateBacklogPayload;
};

export interface MockResult {
  type: 'return' | 'throw';
  value: unknown;
}

export interface MockState<TArgs extends unknown[] = unknown[]> {
  calls: TArgs[];
  results: MockResult[];
}

export interface MockFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  (...args: TArgs): TReturn;
  mock: MockState<TArgs>;
  mockImplementation(implementation: (...args: TArgs) => TReturn): MockFunction<TArgs, TReturn>;
  mockReturnValue(value: TReturn): MockFunction<TArgs, TReturn>;
  mockResolvedValue(value: Awaited<TReturn>): MockFunction<TArgs, TReturn>;
  mockRejectedValue(value: unknown): MockFunction<TArgs, TReturn>;
  mockClear(): MockFunction<TArgs, TReturn>;
  mockReset(): MockFunction<TArgs, TReturn>;
  mockRestore?(): MockFunction<TArgs, TReturn>;
  getMockName(): string;
}

export interface ExpectMatchers<TReceived = unknown> {
  toBe(expected: TReceived): void;
  toEqual(expected: unknown): void;
  toMatchObject(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toHaveLength(expected: number): void;
  toContain(item: unknown): void;
  toThrow(match?: string | RegExp): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledTimes(expected: number): void;
  toHaveBeenCalledWith(...expectedArgs: unknown[]): void;
  toMatchSnapshot(snapshotName?: string): void;
}

export type Expect = <TReceived = unknown>(received: TReceived) => ExpectMatchers<TReceived>;
export const expect: Expect;
export type Fn = <TArgs extends unknown[] = unknown[], TReturn = unknown>(
  implementation?: (...args: TArgs) => TReturn
) => MockFunction<TArgs, TReturn>;
export type SpyOn = <TTarget extends Record<string, unknown>, TKey extends keyof TTarget>(
  target: TTarget,
  methodName: TKey
) => MockFunction<any[], any>;
export type MockModule = (request: string, factoryOrExports?: unknown | (() => unknown)) => void;
export type MockControl = () => void;

export type SuiteFn = () => void;
export type TestFn = () => Awaitable<void>;
export type Describe = (name: string, fn: SuiteFn) => void;
export type Test = (name: string, fn: TestFn) => void;
export type Hook = (fn: TestFn) => void;

export type IntentContext = Record<string, unknown>;
export type IntentPhase<TContext extends IntentContext = IntentContext> = (ctx: TContext) => Awaitable<void>;
export type IntentRegistrar<TContext extends IntentContext = IntentContext> = (
  description: string | IntentPhase<TContext>,
  fn?: IntentPhase<TContext>
) => void;

export interface IntentDSL<TContext extends IntentContext = IntentContext> {
  context: IntentRegistrar<TContext>;
  run: IntentRegistrar<TContext>;
  verify: IntentRegistrar<TContext>;
  cleanup: IntentRegistrar<TContext>;

  arrange: IntentRegistrar<TContext>;
  act: IntentRegistrar<TContext>;
  assert: IntentRegistrar<TContext>;
  given: IntentRegistrar<TContext>;
  when: IntentRegistrar<TContext>;
  then: IntentRegistrar<TContext>;
  setup: IntentRegistrar<TContext>;
  infer: IntentRegistrar<TContext>;
  teardown: IntentRegistrar<TContext>;
  finally: IntentRegistrar<TContext>;
  cook: IntentRegistrar<TContext>;
  yeet: IntentRegistrar<TContext>;
  vibecheck: IntentRegistrar<TContext>;
  wipe: IntentRegistrar<TContext>;
}

export type Intent = <TContext extends IntentContext = IntentContext>(
  name: string,
  define: (dsl: IntentDSL<TContext>) => void
) => void;
