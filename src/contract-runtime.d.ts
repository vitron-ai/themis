export interface ModuleContractEntry {
  kind: string;
  value?: unknown;
  arity?: number;
  ownKeys?: string[];
  prototypeKeys?: string[];
  length?: number;
  itemTypes?: string[];
  source?: string;
  flags?: string;
  size?: number;
  keys?: string[];
  constructor?: string;
  name?: string;
}

export type ModuleContract = Record<string, ModuleContractEntry>;

export interface RequestSpec {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  json?: unknown;
}

export function listExportNames(moduleExports: unknown): string[];
export function buildModuleContract(moduleExports: unknown): ModuleContract;
export function readExportValue<TValue = unknown>(moduleExports: unknown, name: string): TValue;
export function normalizeBehaviorValue(value: unknown): unknown;
export function normalizeRouteResult(value: unknown): Promise<unknown>;
export function createRequestFromSpec(spec: RequestSpec): unknown;
export function assertSourceFreshness(
  sourceFile: string,
  expectedHash: string,
  sourceLabel: string,
  regenerateCommand: string
): void;
export function runComponentInteractionContract(
  sourceFile: string,
  exportName: string,
  props: Record<string, unknown>,
  interactionPlan?: unknown[],
  options?: {
    wrapRender?: (element: unknown) => unknown;
  }
): Promise<unknown>;
export function runComponentBehaviorFlowContract(
  sourceFile: string,
  exportName: string,
  props: Record<string, unknown>,
  flowPlan?: unknown[],
  options?: {
    wrapRender?: (element: unknown) => unknown;
  }
): Promise<unknown>;
export function runHookInteractionContract(
  sourceFile: string,
  exportName: string,
  args: unknown[],
  interactionPlan?: unknown[]
): unknown;
