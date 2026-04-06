# Generate Baseline Tests for a TypeScript Module

## Problem Description

The `analytics-core` package is a TypeScript library that processes event streams. The library has several source modules that have never had automated tests. A new policy requires all modules to have at least baseline test coverage before the next release.

The team uses Themis and wants to take advantage of its test generation capabilities to bootstrap coverage for the `src/` directory, rather than writing every test from scratch. An engineer has been asked to run the generation workflow and document what was produced.

After generation, the engineer should also add at least two hand-authored tests for the `aggregator.ts` module — one that validates aggregate behavior across a sequence of events (a workflow), and one that verifies the pure arithmetic of a single aggregation step.

## Output Specification

1. A shell script `generate-tests.sh` that contains the commands to generate baseline tests for the `src/` directory using the Themis CLI.
2. At least two hand-authored test files for the `aggregator.ts` module (one for workflow behavior, one for a pure unit check). Place them in the location that Themis expects for authored tests.
3. A `GENERATION_REPORT.md` file describing what commands were run, where the generated tests would land, and what directories Themis uses for its artifacts versus committed test files.

You do not need to actually run the generation. Produce the script and the hand-authored tests as output files.

## Input Files

The following files are provided as inputs. Extract them before beginning.

=============== FILE: src/aggregator.ts ===============
export interface Event {
  type: string;
  value: number;
  timestamp: number;
}

export interface AggregateResult {
  total: number;
  count: number;
  average: number;
}

export function aggregateStep(current: AggregateResult, event: Event): AggregateResult {
  const total = current.total + event.value;
  const count = current.count + 1;
  return { total, count, average: total / count };
}

export function runPipeline(events: Event[]): AggregateResult {
  const initial: AggregateResult = { total: 0, count: 0, average: 0 };
  return events.reduce(aggregateStep, initial);
}

=============== FILE: package.json ===============
{
  "name": "analytics-core",
  "version": "1.0.0",
  "scripts": {
    "test": "themis test"
  },
  "devDependencies": {
    "themis": "latest",
    "typescript": "^5.0.0"
  }
}
