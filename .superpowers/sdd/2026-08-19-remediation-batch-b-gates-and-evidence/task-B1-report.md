# Task B1 Report — Gate Log Schema and Atomic Append

## Scope delivered

- Added independent draft-07 `gate-log.schema.json` with strict root fields and explicit summary variants for BDD, iceberg, and preventive-review callers.
- Reworked `writeGateLog` to validate before I/O, return `GateLogWriteResult`, generate timestamp+UUID names, write via exclusive temporary file plus rename, and remove temporary files on write/rename failure.
- Updated BDD, iceberg, and preventive-review CLIs to preserve the primary `passed`/`exitCode` while publishing `gateLogWriteError` in their non-JSON machine-readable summaries if audit persistence fails.
- Added TDD coverage for validation rejection, uniqueness, atomic write failure cleanup, and all three caller failure-summary contracts.

## TDD evidence

Initial focused red run:

```text
2 test files failed; 9 tests failed because gate-log schema was unregistered and the legacy writer returned undefined.
```

The implementation then made the focused suite green.

## Verification

Passed:

```text
npx vitest run --config config/vitest.config.ts \
  w-model-dev/scripts/__tests__/gate-log-writer.test.ts \
  w-model-dev/scripts/__tests__/schema-validation.test.ts \
  w-model-dev/scripts/__tests__/gate-report.test.ts
# 3 files, 32 tests passed

npm run typecheck
npm run lint:security
npm run self-test
# self-test: 256 passed, 0 failed
```

Blocked solely by the explicit B1 no-doc/no-docs-consistency constraint:

```text
npm test / npm run prepush
```

Both reach the existing docs-consistency gate and fail because the newly required `gate-log.schema.json` is automatically discovered but cannot be listed in `w-model-dev/references/data-models.md` without violating the task prohibition on docs/docs-consistency changes. Direct diagnostic result:

```text
[schema-list] data-models.md「Schema 清单」表未覆盖 gate-log.schema.json
```

No production or test failure occurred before that gate.

## Impact-analysis evidence

Codegraph was unavailable because `D:\w_skill_opt\wmodel-audit-remediation` has no `.codegraph` index. The required fallback query evidence was recorded at:

```text
.w-model/codegraph-queries/2026-08-19-task-B1-gate-log-fallback.json
```

That project runtime evidence is ignored by `.gitignore`, as intended.

## Review remediation — round 1/5

Resolved review findings C1, I1, I2, I3, and M1.

- C1: Every CLI now constructs and awaits its gate-log payload before either default or `--json` summary output. Both output modes preserve the main `passed`/`exitCode` and add the same structured `gateLogWriteError` only when audit persistence fails.
- I1: Publication uses an exclusive temporary file plus `link(temp, destination)`, whose `EEXIST` semantics do not replace an existing destination. A destination collision removes only the caller-owned temporary file, generates a new UUID, and retries. The collision regression test verifies the first log content is unchanged.
- I2: External errors are now stable safe objects: `GATE_LOG_SCHEMA_INVALID`, `GATE_LOG_WRITE_FAILED`, or `GATE_LOG_CLEANUP_FAILED`, with fixed messages. Raw filesystem messages and paths are not included in stdout JSON or stderr; only the safe category is emitted to stderr.
- I3: The root schema enumerates the three production scripts and conditionally binds each to its exact `reportSummary` definition. Test-only empty summaries are no longer accepted.
- M1: Cleanup failure is carried by `cleanupFailed: true`; a post-publication cleanup failure receives the distinct `GATE_LOG_CLEANUP_FAILED` category. Controlled filesystem tests cover cleanup-failure reporting.

### Review-round TDD and verification

Red run after adding review assertions:

```text
3 focused files failed, 4 tests failed: collision overwrote the first log, raw write errors were returned, mismatched script/summary passed schema validation, and CLI summaries leaked raw filesystem paths.
```

Passed after remediation:

```text
npx vitest run --config config/vitest.config.ts \
  w-model-dev/scripts/__tests__/gate-log-writer.test.ts \
  w-model-dev/scripts/__tests__/schema-validation.test.ts \
  w-model-dev/scripts/__tests__/gate-report.test.ts
# 3 files, 32 tests passed

npm run typecheck
npm run lint:security
npm run self-test
# self-test: 256 passed, 0 failed
```

`npm test` ran 49 files: 48 files / 786 tests passed. The only failure remains the known, explicitly permitted `schema-list` docs-consistency block for the new required schema registration. `npm run prepush` reaches the same Vitest/docs-consistency block after all earlier pre-push gates pass. No docs or docs-consistency files were changed.

Additional no-index impact-analysis evidence is recorded in ignored runtime state:

```text
.w-model/codegraph-queries/2026-08-19-task-B1-round1-fallback.json
```
