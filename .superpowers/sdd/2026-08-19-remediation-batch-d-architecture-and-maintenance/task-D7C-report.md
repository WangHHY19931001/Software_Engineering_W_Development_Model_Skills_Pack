# Task D7C Report

- Task: document source-bound evidence verification and synchronize dynamic provenance/count facts.
- Worktree: `D:\\w_skill_opt\\wmodel-audit-remediation`
- Measurement HEAD: `6aa68c8bea3e425a7d1110256a5bab3903e918b2`
- Requested commit: `docs: document source-bound evidence verification`
- Scope respected: D7A/B logic and schema contents, package behavior, hook control flow, security baseline, plans, and specs were not changed.

## Changes

- Added the source-bound provenance boundary to the six live documents covered by the local evidence contract: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/INSTALL.md`, `w-model-dev/SKILL.md`, and `w-model-dev/references/command-reference.md`.
- Documented `evidence-provenance.schema.json`, `wm-verify-evidence-source.ts`, and `npm run wm:verify-evidence-source -- <project-dir>` as the producer+verify path.
- Documented that `wm-export-evidence --verify` is package-only without `--source-project`, and source-bound only with `--source-project <project-dir>`.
- Explicitly bounded controlled-local provenance as process integrity based on HEAD/source hash/run/gate measurements, not a cryptographic signature or third-party non-repudiation proof; package-only is not verified-source evidence.
- Updated the allowed live count declarations and the descriptive pre-push count to the current measured values.
- Added a TDD contract regression that checks each live document independently; removing any Schema, CLI, source-bound/package-only, source-project, or non-cryptographic-boundary clause fails the contract.
- Updated the D7C changelog entry with the measured schema/CLI/exit-2/test/self-test/samples inventory.

## TDD Evidence

- Red: the new per-document contract failed before documentation synchronization because `README.md` lacked the newly required `evidence-provenance.schema.json` declaration.
- Green: the focused D7C contract suite passed after the six documents were synchronized; the stale-count mutation still fails closed.

## Measured Provenance

Artifact was generated outside the repository and bound to the measurement HEAD above:

- Artifact ID: `vitest-results.json`
- Artifact SHA-256: `39e27c40a60e0011def25a2bdb768ea208c129a29a3ef9fcce555ec6c8b93d9c`
- Provenance run ID: `39e27c40a60e0011`
- `testResults.length`: 55
- `numTotalTests`: 910
- `numPassedTests`: 910
- `numFailedTests`: 0
- `success`: `true`
- Schemas: 23
- CLI scripts: 36
- Exit-2 scripts confirmed by real probes: 35
- Test files: 55
- Self-test: 260/260
- Samples coverage: 280 fixtures, 242 referenced files, 15 referenced directories, 0 unregistered, 0 undeclared directories

## Verification

All required checks passed on the final worktree:

- Focused D7C regressions: 8 passed, 122 skipped (the selected tests from the 130-test docs-consistency file).
- Full `npm test`: 55 files, 910 tests passed, 0 failed.
- `npm run check:docs-consistency -- --json`: passed; 0 violations; all 37 exit-2 probes returned status 2 with `ERROR_JSON.exitCode=2`.
- `npm run self-test`: 260 passed, 0 failed.
- `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`: passed; 0 unregistered and 0 undeclared.
- `npm run typecheck`: passed.
- `npm run lint:security`: passed; 0 new findings.
- Prettier check: passed.
- `npm run prepush`: passed; all 17 checks passed, including coverage, npm audit, docs consistency, samples coverage, Prettier, and typecheck.
