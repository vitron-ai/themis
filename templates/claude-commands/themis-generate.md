---
description: Generate Themis tests for a source tree
---

Generate Themis tests for the given source root. If the user did not specify one, default to `src` (or `app` if this is a Next.js App Router project — check for `app/layout.tsx` or `app/page.tsx`).

```bash
npx themis generate $ARGUMENTS
```

Generated tests land under `__themis__/tests`. After generation:
1. Read the summary the command prints — it tells you how many files were generated, skipped, and why.
2. Run `npx themis test --reporter agent` to verify the generated suite passes.
3. If any generated tests are wrong, do not delete them — extend or correct them in place.
