# Task D7B Report

- Task: docs-consistency probe consumption and schema-loader documentation path
- Commit: pending
- Scope: `w-model-dev/SKILL.md`, docs-consistency CLI/logic/tests, this report
- D7A evidence export files were not modified.

## Changes

- Migrated the SKILL bundled schema loader reference from `scripts/logic/schema-loader.ts` to `scripts/infrastructure/schema-loader.ts`.
- Added per-document detection of the stale path in injected skill-package Markdown documents.
- Consumed all wm-export probe safety facts: `status`, `errorExitCode`, `outputExistsAfter`, and `emittedEvidenceExport`.
- Emitted probe failures as dynamic `exit2-probe` violations while preserving top-level `violations` and `dynamicMeasurements.exit2ProbeResults` compatibility fields.
- Kept the probe commands and pre-push gate order unchanged.

## Verification

- Red proof: focused docs-consistency test failed for all four probe facts and three stale-path document cases before implementation.
- Focused: PASS, docs-consistency test file, 129 tests.
- Typecheck: PASS, `tsc -p config/tsconfig.json`.
- Full Vitest: BLOCKED by pre-existing D7A evidence changes: 895 passed, 2 D7A evidence tests failed; total observed 897.
- Security: BLOCKED by pre-existing D7A findings in `evidence-export-logic.ts` lines 266 and 386; no D7B security findings.
- Docs consistency: BLOCKED because the failed full Vitest run produced an untrusted 897-test artifact and existing active docs remain synchronized to 895.
- Pre-push: BLOCKED at security-scan for the same pre-existing D7A findings; earlier pre-push checks passed.
