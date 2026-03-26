## Next-phase focus

1. **Provider/flow depth**
   - Expand `generate` detection to infer React Query usage, router contexts, and persisted store slices so generated tests wrap components/hooks with accurate provider shells.
   - Surface async DOM flows in `__themis__/tests/*` with multi-stage user journeys, empty/loading/error states, and configurable timing fixtures so the runner can validate realistic UI transitions instead of static renders.
   - Add documentation (and optionally VS Code actions) that show how to hook a project-level `themis.generate.js` or `.themis.json` provider configuration for shared auth/session/React Query clients.

2. **Migration helpers**
   - Improve `themis migrate` to rewrite Jest/Vitest imports to the generated compatibility module, create prompt-ready diff artifacts, and log a migration report.
   - Build a VS Code pane or CLI summary showing both the original Jest test and the new generated Themis contract, highlighting the migration delta in code and behavior.
   - Provide a recipe in `docs/migration.md` for teams to adopt Themis incrementally, including a helper to wrap Jest tests inside Themis-generated asserts.
   - Add a native contract-capture workflow that gives teams snapshot-comparable baseline coverage without reviving snapshot-file maintenance.

3. **Proof/polish**
   - Document how to run the generator in "plan" mode for React/Next flows, share the artifact URLs, and point to the new `tests/fixtures/react-app` coverage as proof that CI-enforced flows now run cleanly under the real dependency graph.
   - Consider adding benchmark entries showing the generator/migration loop time compared to Jest baseline.

These steps keep widening the gap versus Jest/Vitest and ensure our agent-and-human workflow stays irresistible.
