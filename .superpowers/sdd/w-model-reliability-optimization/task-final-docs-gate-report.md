# Final Docs Consistency Gate Report

- Worktree: `D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
- Baseline HEAD: `71f5965`
- Commit: `fix(docs): close consistency gate gaps`

## Root Cause

The final `docs-consistency` run found three static contract drifts and one dynamic probe contract defect:

- `dispatch-matrix.md` omitted `check-tla-bdd-sync` and `platform-deps-install`.
- `SKILL.md` declared 36 CLI `.ts` files while `w-model-dev/scripts/cli/` contained 37.
- `platform-deps-install.ts#invalid-argument` emitted `ERROR_JSON` without the required `rule` field.

The probe contract requires `category`, `exitCode`, and a `P0-N` rule to agree with the normalized `Exit2ProbeResult`.

## Changes

- Added `rule: 'P0-1'` to the platform install CLI argument-error path.
- Added a regression assertion for the platform install `ERROR_JSON` rule.
- Registered `check-tla-bdd-sync` and `platform-deps-install` in the authoritative dispatch matrix.
- Synchronized CLI inventory and exit-2 counts to 37 and 36 in `SKILL.md`, `AGENTS.md`, and `docs/INSTALL.md`.
- Updated docs-consistency test fixtures and expectations to the real inventory and probe facts.
- Added/updated TDD coverage for the real CLI registry and platform error contract.

## Verification Evidence

- TDD red phase:
  - Platform invalid-argument regression failed because `ERROR_JSON.rule` was absent.
  - Real CLI registry regression failed for the two missing dispatch entries and the 36-vs-37 SKILL count.
- Related tests: `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts w-model-dev/scripts/__tests__/platform-deps-install.test.ts` -> **2 files, 196 tests passed**.
- Full Vitest: `npx vitest run --config config/vitest.config.ts` -> **58 files, 1222 tests passed, 0 failed**.
- TypeScript: `npx tsc -p config/tsconfig.json --noEmit` -> **exit 0**.
- Prettier TypeScript check: changed `.ts` files with `--end-of-line=crlf` -> **all matched files use Prettier code style**.
- `git diff --check` -> **exit 0**.
- Final gate: `npm run check:docs-consistency -- --json` -> **exit 0**.

Final gate measurements:

```json
{
  "passed": true,
  "staticViolations": [],
  "dynamicViolations": [],
  "schemaCount": 23,
  "cliScriptCount": 37,
  "exit2ScriptCount": 36,
  "testFileCount": 58,
  "vitestTestCount": 1222,
  "numPassedTests": 1222,
  "numFailedTests": 0,
  "success": true,
  "vitestCommitSha": "71f5965ae884d811ed8e205b3e17b8c9d07650f7"
}
```

The final exit-2 probe set contained 38 probe results; all had status 2, `errorExitCode=2`, known categories, valid `P0-N` rules, and matching raw `ERROR_JSON` fields. The platform probe reported `rule="P0-1"`.
