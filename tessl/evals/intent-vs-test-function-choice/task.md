# Add Tests for a TypeScript Utility Library

## Problem Description

Your team maintains a small TypeScript utility library called `string-tools` that handles common string manipulation tasks. The library has been growing, and two modules now need test coverage before the next release:

1. **`src/slugify.ts`** — a pure function that converts a string to a URL-safe slug (lowercases, replaces spaces with hyphens, strips non-alphanumeric characters).
2. **`src/pipeline.ts`** — a higher-level text processing pipeline that chains together multiple transformations (trim → normalize whitespace → slugify → truncate) and is designed to be called as part of a content ingestion workflow.

The repository already uses Themis as its unit testing framework. A colleague has been asking for tests that clearly separate the pure function checks from the workflow behavior.

## Output Specification

Write the test files for both modules. Use whatever file locations and naming are appropriate for a Themis project. The test files should be valid TypeScript and should import the modules under test.

To make the source modules available for import in your test files, inline their implementations directly in the test file using a local definition or a mock, since the actual source files are not available on disk. You do not need to run the tests.

Provide a short `DECISIONS.md` file explaining which Themis construct you chose for each module and why.

## Input Files

The following files describe the modules to be tested. Extract them before beginning.

=============== FILE: src/slugify.ts ===============
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

=============== FILE: src/pipeline.ts ===============
import { slugify } from './slugify';

export interface PipelineOptions {
  maxLength?: number;
}

export function processText(raw: string, opts: PipelineOptions = {}): string {
  const trimmed = raw.trim();
  const normalized = trimmed.replace(/\s+/g, ' ');
  const slugged = slugify(normalized);
  if (opts.maxLength && slugged.length > opts.maxLength) {
    return slugged.slice(0, opts.maxLength);
  }
  return slugged;
}
