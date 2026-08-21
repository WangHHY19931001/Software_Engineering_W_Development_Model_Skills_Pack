# Task D7B Report

- Task: remediate D7B source-bound evidence verification findings.
- Base: D7B commit `e4e71ab` (`feat(evidence): produce source-bound verification provenance`).
- Scope: source-bound export verification, provenance producer coverage, schemas, focused regressions, and the D7B report.
- D7A Markdown sanitizer and export safety behavior are retained; no D7A rollback or unrelated worktree artifacts are included.

## Findings Resolved

- **Critical source-bound verification bypass:** `verifyEvidence(manifest, sourceProject)` now rebuilds the exporter allowlist from the current source project, including the exact sanitized bytes and each `path`/`kind`/`sha256`. The rebuilt manifest file list must match the package manifest exactly. Recomputing package hashes after modifying ordinary non-sensitive exported content therefore fails closed with `INVALID_PROVENANCE`, while an unchanged source-bound package passes.
- **Important provenance coverage gap:** the producer now recursively covers the exporter allowlist for `codegraph-queries`, records each query in `sourceFiles`, and adds the `codegraphQueries` measurement. Source changes to codegraph evidence consequently invalidate producer/verify/export bindings.

## Changes

- Extended evidence schemas and runtime measurement validation with `codegraphQueries`.
- Reused a single exporter source rebuild path for export and source-bound verification, preserving D7A sanitization and path/symlink/content safety checks.
- Hardened producer source-file collection to match the text allowlist, reject symlinks and unsafe/binary content, and include nested codegraph query files.
- Added TDD regressions for ordinary-content tampering with recomputed package hashes, unchanged source-bound success, and producer codegraph source-file/measurement coverage.
- Updated the provenance measurement documentation from four to five categories.
- CodeGraph impact query was completed before edits and remains in local `.w-model/codegraph-queries/`; ignored planning/review artifacts are outside the D7B commit scope.

## Verification

- Focused D7B suite: PASS, 3 files / 161 tests (`evidence-export-logic`, `evidence-provenance-logic`, `docs-consistency-logic`).
- Full Vitest: PASS, 55 files / 908 tests, 908 passed, 0 failed.
- TypeScript: PASS, `npx tsc -p config/tsconfig.json --noEmit`.
- Security: PASS, `npm run lint:security`, 0 new findings.
- Docs consistency: PASS, `npm run check:docs-consistency -- --json`, 0 violations; dynamic measurement 55 files / 908 tests and all 37 exit-2 probes matched.
- Pre-push: PASS, `npm run prepush`, all 17 checks passed, including npm audit, samples coverage, Prettier, and typecheck.
