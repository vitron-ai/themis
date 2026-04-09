# Authoring Themis Tests for a Document Processing Service

## Problem/Feature Description

Harlow Data has a TypeScript document processing service that the team wants to cover with Themis tests. The service has two main modules: a `DocumentParser` class that coordinates the multi-step parsing pipeline (ingestion → normalization → extraction → enrichment), and a `normalizeText` pure utility function that strips whitespace and lowercases strings.

A new engineer on the team has been asked to hand-author Themis tests for both modules. They've been told that Themis has different constructs for different kinds of tests, and that TypeScript files need a specific setup to get global type access. They need example test files that demonstrate proper, idiomatic Themis TypeScript test authoring so the team has a template to follow.

## Output Specification

Produce the following files:

- `__themis__/tests/document-parser.test.ts` — A Themis test file for the `DocumentParser` pipeline, covering the multi-step processing workflow. Use a realistic but simple test scenario (you can import from a hypothetical `../../src/document-parser` path).
- `__themis__/tests/normalize-text.test.ts` — A Themis test file for the `normalizeText` pure utility function.
- `AUTHORING_NOTES.md` — A short document explaining the two types of Themis test constructs, when each should be used, and what the first line of a Themis TypeScript test file should look like and why.

## Input Files

The following files represent the source code to be tested. Extract them before beginning.

=============== FILE: src/document-parser.ts ===============
export interface ParseResult {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

export class DocumentParser {
  async parse(raw: string): Promise<ParseResult> {
    const ingested = await this.ingest(raw);
    const normalized = await this.normalize(ingested);
    const extracted = await this.extract(normalized);
    return this.enrich(extracted);
  }

  private async ingest(raw: string): Promise<string> {
    return raw.trim();
  }

  private async normalize(text: string): Promise<string> {
    return text.toLowerCase();
  }

  private async extract(text: string): Promise<{ content: string }> {
    return { content: text };
  }

  private async enrich(data: { content: string }): Promise<ParseResult> {
    return {
      id: `doc-${Date.now()}`,
      content: data.content,
      metadata: { source: "manual" },
    };
  }
}

=============== FILE: src/normalize-text.ts ===============
export function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}
