---
description: Fix failing Themis tests using the agent reporter's repair hints
---

Read the most recent Themis run output and fix the failures.

1. Run `npx themis test --reporter agent` and capture the JSON output.
2. Group the failures by `failures[].cluster`. Fixes within a cluster usually share a root cause — address the cluster, not each failure independently.
3. For each cluster, read `failures[].repairHints` first. They are structured suggestions you can act on directly.
4. Apply the smallest fix that addresses the root cause. Do not refactor surrounding code.
5. Re-run with `npx themis test --rerun-failed` to confirm the cluster is fixed.
6. Repeat for the next cluster. Only run the full suite once `--rerun-failed` is green.

If the user passed specific test names or files, scope the work to those: $ARGUMENTS
