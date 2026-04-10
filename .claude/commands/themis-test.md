---
description: Run the Themis test suite with agent-readable output
---

Run `npx themis test --reporter agent` and read the JSON output. If there are failures:

1. Group them by `failures[].cluster` — fixes for the same cluster usually share a root cause.
2. For each cluster, read `failures[].repairHints` before reading the raw stack trace.
3. Apply the smallest fix that addresses the root cause, then re-run with `npx themis test --rerun-failed` to verify.
4. Only run the full suite again once `--rerun-failed` is green.

If the user passed extra arguments, forward them to `npx themis test`: $ARGUMENTS
