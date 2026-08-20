# Task D7B Report

- Task: produce source-bound verification provenance for evidence export.
- Commit: this commit (`feat(evidence): produce source-bound verification provenance`)
- Scope: evidence provenance schema/producer/CLI, evidence export verification semantics, registration documents and fixtures.
- D7A Markdown sanitizer and export safety behavior retained; no plans/spec/review/.codegraph files are part of this task.

## Changes

- Added `evidence-provenance.schema.json` and `evidence-provenance-logic.ts`. The producer requires a real Git HEAD, valid run-log, passed gate logs, a valid signature chain, and a recomputed source bundle before atomically writing `.w-model/evidence-provenance.json`.
- Added `wm-verify-evidence-source` as a producer+verify command. Its documented contract explicitly says it writes source provenance and is not a read-only verification command.
- Bound `wm-export-evidence` export and verification to source provenance. Manifest verification without `--source-project` reports `verificationLevel=package-only`; with `--source-project` it rebuilds and compares source-bound provenance and reports `verificationLevel=source-bound`.
- Registered the schema and CLI in package scripts, dispatch matrix, SKILL, AGENTS, INSTALL, README, command reference, data models, glossary, anti-patterns, SSoT, user guide, and navigation fixtures. Dynamic counts are based on a successful current-HEAD Vitest artifact only.
- Added focused producer CLI, package-only/source-bound, schema inventory, docs-consistency fixture, and coverage-matrix regression assertions. The producer CLI test uses asynchronous `execFile` so it remains inside the centralized synchronous-process boundary.
- Recorded the formal CodeGraph impact query under `.w-model/codegraph-queries/`.

## Final Measurements

The trusted artifact `.w-model/d7b-verification/vitest-results.json` was generated from the final committed tree and reports:

- Vitest: 55 files, 905 total, 905 passed, 0 failed, `success=true`.
- The final verification handoff records the artifact SHA-256 and commit binding; failed artifacts are never used for documentation counts.
- Docs-consistency dynamic measurements: 23 schemas, 36 CLI scripts, 35 exit-2 scripts, 55 test files, 905 tests; 0 violations.
- Exit-2 probe inventory: 37 probes; all returned status 2 with `ERROR_JSON.exitCode=2`; export probes left no output and emitted no export summary.

## Verification

- Focused D7B suite: PASS, 4 files / 175 tests.
- Full Vitest with coverage and JSON artifact: PASS, 55 files / 905 tests.
- TypeScript: PASS, `npx tsc -p config/tsconfig.json`.
- Security: PASS, `npm run lint:security`, 0 new findings.
- Docs consistency: PASS, `npm run check:docs-consistency -- --json`, 0 violations.
- Pre-push: PASS, `npm run prepush`, all 17 checks passed, including npm audit, samples coverage, Prettier, and typecheck.
