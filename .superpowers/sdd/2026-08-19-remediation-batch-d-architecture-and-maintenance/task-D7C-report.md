# Task D7C Report

- Task: document source-bound evidence verification and synchronize dynamic provenance/count facts.
- Review scope: the single commit `git diff d659e82^ d659e82` only. Earlier D7A/B commits are not part of the D7C review scope.
- Measurement HEAD: `d659e8239f47c90499066f87ba64731a114cca1a`.
- Requested commit: `docs: anchor D7C verification evidence`.
- Report path: `.superpowers/sdd/2026-08-19-remediation-batch-d-architecture-and-maintenance/task-D7C-report.md`.

## Changes in the reviewed D7C commit

- Added the source-bound provenance boundary to the six live documents covered by the local evidence contract: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/INSTALL.md`, `w-model-dev/SKILL.md`, and `w-model-dev/references/command-reference.md`.
- Documented `evidence-provenance.schema.json`, `wm-verify-evidence-source.ts`, and `npm run wm:verify-evidence-source -- <project-dir>` as the producer+verify path.
- Documented that `wm-export-evidence --verify` is package-only without `--source-project`, and source-bound only with `--source-project <project-dir>`.
- Explicitly bounded controlled-local provenance as process integrity based on HEAD/source hash/run/gate measurements, not a cryptographic signature or third-party non-repudiation proof; package-only is not verified-source evidence.
- Updated the allowed live count declarations and the descriptive pre-push count to the measured values below.
- Retained the D7C per-document contract regression, the dynamic provenance checks, and stale-count negative cases.

This report uses only the reviewed single-commit scope above and does not use a broad diff to make claims about earlier production changes.

## TDD Evidence

- Red: a deliberate stale-count mutation changed the 55/910 assertion to 55/909; the focused test failed with exit 1 and reported `expected [ 55, 910 ] to deeply equal [ 55, 909 ]`.
- Green: after restoring the test, the focused D7C suite passed; the stale-count negative case remains and fails closed when a live declaration is changed.

## Measured Provenance

The coverage JSON and provenance JSON were generated outside the repository in one run from the measurement HEAD above. The previous parent-commit artifact was deleted and is not referenced by this report.

- Artifact relative ID: `vitest/results.json`
- Artifact SHA-256: `9b4cd0412e95dfc1ec74a19746ebc9c6b4de7955bac224ac9476fe4be0b03af6`
- Provenance run ID: `8f909dd7117df0ac`
- Measurement commit SHA: `d659e8239f47c90499066f87ba64731a114cca1a`
- `testResults.length`: 55
- `numTotalTests`: 910
- `numPassedTests`: 910
- `numFailedTests`: 0
- `success`: `true`
- Schemas: 23
- CLI scripts: 36
- Exit-2 scripts confirmed by real probes: 35
- Current test files: 55
- Self-test: 260/260
- Samples coverage: 280 fixtures, 242 referenced files, 15 referenced directories, 0 unregistered, 0 undeclared directories

## Verification

- Focused D7C regressions: 130 passed, 0 failed.
- Full `npm test`: 55 files, 910 tests passed, 0 failed.
- `npm run check:docs-consistency -- --json`: passed; 0 violations; all 37 exit-2 probes returned status 2 with `ERROR_JSON.exitCode=2`.
- `npm run self-test`: 260 passed, 0 failed.
- `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`: passed; 0 unregistered and 0 undeclared.
- `npm run typecheck`: passed.
- `npm run lint:security`: passed; 0 new findings.
- Prettier check: passed.
- `npm run prepush`: passed; all 17 checks passed, including coverage, npm audit, docs consistency, samples coverage, Prettier, and typecheck.
