# Batch A1 Report: wm-write State Transaction Reliability

## Changes

- `w-model-dev/scripts/logic/state-write-logic.ts`
  - Validates owner metadata shape and timestamp before treating it as live/stale.
  - Treats empty, missing, or corrupt owner metadata as unknown: implicit recovery does not delete or audit it and returns `STALE_LOCK`; explicit `recoverStaleLock` atomically moves it to a `.stale-*` audit directory before acquiring a new owner.
  - Captures original target content and existence before commit.
  - Restores no-backup transactions with an atomic temporary-file replacement when the target originally existed.
  - Restores an originally absent target by atomically moving the failed payload to a temporary path and removing that temporary path only after ownership is rechecked.
  - Keeps lock-token and payload-content checks before rollback replacement and reports `rolledBack: false` when ownership changes.
- `w-model-dev/scripts/__tests__/state-write-logic.test.ts`
  - Added no-backup rollback preservation, originally-missing target rollback, token mismatch, and corrupt/empty metadata recovery coverage.
- `w-model-dev/scripts/__tests__/wm-write.test.ts`
  - Added explicit `spawnSync` timeout of 15 seconds.
  - Added real child-process competition against one old mtime; exactly one writer commits and the other receives `MTIME_CONFLICT`.
  - Added CLI corrupt/empty owner metadata implicit rejection and explicit recovery coverage.
- `w-model-dev/scripts/lib/run-sync.ts`
  - Updated the existing centralized synchronous-process exception entry to record the new explicit test timeout.
- `.w-model/codegraph-queries/phase5-A1-state-write-logic.json`
  - Records that codegraph is unavailable in this worktree and records the actual `rg`/import impact analysis without fabricating codegraph output.

## Verification

- Red phase before implementation:
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts`
  - Expected failures: 7 tests covering no-backup rollback and unknown owner metadata; the independent child-process competition test already passed against the existing lock implementation.
- Focused green phase:
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts`
  - Passed: 62/62 tests.
- Focused process-audit regression:
  - `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts`
  - Passed: 75/75 tests.
- Type checking:
  - `npm run typecheck`
  - Passed, exit 0.
- Full test suite:
  - `npm test`
  - 1011/1012 tests passed. One existing environment-dependent docs-consistency probe failed because the local Windows platform dependencies are missing: `@esbuild/win32-x64@0.28.2` and `@rolldown/binding-win32-x64-msvc@1.2.4`. The failure occurs in the fixture's pre-push dependency check, not in the A1 tests.
- `git diff --check`
  - Passed.

## Remaining Risk

- Full-suite verification remains environment-blocked until the missing Windows platform dependencies are installed with the repository's explicit platform dependency workflow.
- Rollback ownership checks are performed immediately before each atomic rename, as required by the existing lock protocol; an external filesystem actor that changes the owner or target in the narrow OS-level interval after the final check remains outside the process-level lock contract.
- Unknown owner metadata is intentionally fail-closed by default and can require explicit operator recovery when a crashed writer left corrupt metadata.
