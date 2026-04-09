# Migrating a Vitest Project Fully to Themis

## Problem/Feature Description

Caldwell Engineering has been using Vitest for their TypeScript API gateway service. The team has decided to fully adopt Themis, and they want a complete migration — not just compatibility scaffolding, but a real conversion that rewrites test imports and test syntax to native Themis. They've tried manually converting files before and it took days and introduced bugs; they want the migration done using whatever built-in tooling is available to avoid that pain.

The team lead specifically wants a two-tier migration plan: first a safety-net pass that validates existing behavior is preserved, then a deeper conversion pass that produces idiomatic Themis code. They also want the post-migration steps documented so anyone on the team can handle failures that come up during the transition.

## Output Specification

Produce the following files:

- `migrate.sh` — A shell script implementing the full Vitest-to-Themis migration. The script must include both a compatibility-first pass and a full conversion pass with import rewriting, plus all post-migration steps for handling failures and contract drift.
- `MIGRATION_PLAN.md` — A markdown document describing the two-phase migration strategy, what each command does, and how to handle the three possible post-migration states: all tests pass, some tests fail due to bugs introduced during migration, and some tests fail because the source code intentionally changed behavior.

The script and plan should cover the full workflow from starting state (Vitest installed) to confirmed stable Themis suite.
