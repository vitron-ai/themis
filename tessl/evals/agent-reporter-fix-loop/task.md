# Diagnosing and Fixing a Broken Themis Test Suite

## Problem/Feature Description

The backend team at Fenwick Labs has a Node.js/TypeScript service (`order-processor`) with a Themis test suite that was working last week, but after a recent refactor to the `OrderValidator` and `PricingEngine` modules, several tests are now failing. The team is heads-down on a release and needs an agent to diagnose the failures, apply targeted fixes, and confirm the suite is green — all without running the entire (slow) test suite repeatedly.

The project already has Themis installed and initialized. Your job is to produce a shell script that documents the exact sequence of commands you'd run to investigate the failures and fix them efficiently, and a brief report summarizing what the failure output told you.

## Output Specification

Produce the following files:

- `fix-workflow.sh` — A shell script containing the commands (in order) that an agent would run to diagnose failures using structured output, fix them, and confirm the fixes without a full suite re-run. Include comments explaining each step.
- `DIAGNOSIS_REPORT.md` — A markdown report describing: what information the structured failure output provides (listing the specific fields available), how you would use each field to locate and fix problems, and why you would avoid re-reading raw stack traces.

The shell script should represent a realistic workflow from "tests are failing" to "confirmed fixed" using Themis tooling.

## Input Files

No source files are required — write the workflow based on the described scenario and your knowledge of the Themis CLI.
