# Task 2B report — strict M07/R10 evidence

## Result

Task 2B second-round review remediation is recorded in the requested isolated worktree. M07 and R10 no longer trust mutable timestamps for evidence exemptions. Compatibility legacy fields remain present and are zero/empty in strict paths. The controlled-project provenance sub-check passes; overall status remains `DONE_WITH_CONCERNS` because the current worktree is not source-bound and the minimal controlled project does not satisfy the full artifact gate.

## Changes

- Removed `M07_TEST_EVIDENCE_CUTOFF` and the `LEGACY_TEST_EVIDENCE` acceptance/diagnostic path from `gate-logic.ts`.
- M07 phase 5–8 layers with `total > 0` now always require valid evidence; whitespace-only `evidence.command` is rejected by Schema and also reported by the business path as E4 with observable `missing/e4` counts.
- Removed `LEGACY_REVERT_EVIDENCE_CUTOFF` and `LEGACY_REVERT_EVIDENCE` absorption from `run-log-logic.ts`. `fix` and `emergency-fix` without a non-blank command always produce R10 blocking.
- Kept unrelated `LEGACY_VARIANT` and `LEGACY_REWORK_HINTS` behavior. Kept `GATE_JSON.legacy` and `RUN_LOG_JSON.r10.legacy`; strict values are `[]` and `0` respectively.
- Added non-whitespace command patterns to `rtm.schema.json` and `run-log.schema.json`.
- Migrated `valid-test-evidence-legacy.json` to four legal evidence objects while retaining its historical date. Added legal R10 evidence to the affected identity/variant fixture path; retained `bad-fix-missing-revert-evidence.jsonl` as the negative fixture.
- Updated focused assertions and the committed fixture byte/hash contract.

## Verification

Commands run in `D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\.worktrees\review-remediation`:

1. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts`
   - Initial red run: 2 files, 132 tests; 6 failed for the expected timestamp/blank-command gaps.
   - Final: 2 files passed, 132 tests passed.
2. `npm run --silent typecheck` — exit 0.
3. `npx tsx w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/samples/run-log/rootcause-valid.jsonl --json` — exit 0; `passed:true`, `r10={checked:1,missing:0,legacy:0}`.
4. `npx tsx w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/samples/run-log/bad-fix-missing-revert-evidence.jsonl --json` — exit 1; R10 blocking, `r10={checked:1,missing:1,legacy:0}`.
5. `git diff --check` — exit 0.
6. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts -t "evidence.command 仅空白"` — initial rework red run: 1 failed because `testEvidence` was undefined; after the business-path fix: 1 passed, 20 skipped.
7. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts` — exit 0; 1 file and 18 tests passed, including real producer creation followed by source-bound verification.
8. `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/lib/types.ts w-model-dev/schemas/rtm.schema.json w-model-dev/schemas/run-log.schema.json w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts` — exit 0.
9. `git commit --amend -m "fix: remove timestamp-based evidence exemptions"` — exit 0; native hook output was `✓ pre-commit: 无暂存文件，跳过快速检查`. No `--no-verify` was used.
10. `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts` — exit 0; 2 files and 132 tests passed.
11. `npm run --silent typecheck` — exit 0.
12. `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/lib/types.ts w-model-dev/schemas/rtm.schema.json w-model-dev/schemas/run-log.schema.json w-model-dev/scripts/__tests__/gate-test-evidence.test.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts` — exit 0; `All matched files use Prettier code style!`.

## Provenance

### Current worktree boundary

Ran the existing producer in the current worktree:

`npm run --silent wm:verify-evidence-source -- .`

It returned exit 1:

`EVIDENCE_SOURCE_JSON {"script":"wm-verify-evidence-source.ts","ok":false,"exitCode":1,"reason":"UNSAFE_SOURCE_EVIDENCE"}`

followed by `ERROR_JSON {"category":"STRUCTURE_INVALID","message":"source provenance 验证失败","exitCode":1,"rule":"UNSAFE_SOURCE_EVIDENCE"}`. Read-only inspection shows this isolated skill-package worktree has no `.w-model` directory or `.w-model/run-log.jsonl`; this failure is retained and is not represented as a successful migration. No provenance was fabricated or written into the tracked change.

### Controlled temporary project

The existing `evidence-provenance-logic.test.ts` `makeProject` setup was reused to create a real temporary Git project at:

`C:\Users\wangh\AppData\Local\Temp\wm-task2b-controlled-bp3qzE\project`

The setup used the repository's existing `valid.jsonl`, gate-log and signature-chain fixtures, copied the migrated RTM fixture for the artifact-gate invocation, and created a real Git commit with normal Git commands. No `evidence-provenance.json` or provenance/hash field was hand-authored; the producer created that file at:

`C:\Users\wangh\AppData\Local\Temp\wm-task2b-controlled-bp3qzE\project\.w-model\evidence-provenance.json`

The exact producer command was:

`npm run --silent wm:verify-evidence-source -- C:\Users\wangh\AppData\Local\Temp\wm-task2b-controlled-bp3qzE\project`

It returned exit 0 with `verificationLevel=source-bound` and `verificationStatus=passed`. The actual `EVIDENCE_SOURCE_JSON` values were:

```json
{
  "commitSha": "69470d70b18e7046d0049c1a323dd44d29c31090",
  "sourceBundleSha256": "d07664dae35f0a6dea1be7d0faa19cacf4b26167153250fe007850f988331078",
  "runId": "r12",
  "provenanceSha256": "3c4f1b7bcc205931a956ef898bc7de1d24d017dea8ee221768fda7d273566af9"
}
```

The direct `verifySourceProvenance` API then returned exit 0 with the same four values, `verificationLevel=source-bound`, and `verificationStatus=passed`.

Subsequent checks on that same controlled project:

- `npx tsx w-model-dev/scripts/cli/check-run-log.ts C:\Users\wangh\AppData\Local\Temp\wm-task2b-controlled-bp3qzE\project\.w-model\run-log.jsonl --gate-logs=C:\Users\wangh\AppData\Local\Temp\wm-task2b-controlled-bp3qzE\project\.w-model\gate-logs --json` — exit 0, `passed:true`, `r10={checked:0,missing:0,legacy:0}`; one non-blocking `LEGACY_UNSCOPED` diagnostic leaves lifecycle status `NOT_CLOSED_NOT_PROVEN`.
- `npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts C:\Users\wangh\AppData\Local\Temp\wm-task2b-controlled-bp3qzE\project --phase=6 --json` — exit 1, `passed:false`; five expected violations for missing BDD manifest, missing Cucumber report, and absent phase-6 scope binding. Its M07 summary was `checked:2,withEvidence:2,missing:0,legacy:0`.

Conclusion: the plan's controlled-project producer/verify evidence is satisfied and independently source-bound; the current worktree `-- .` boundary remains a genuine failure, and the minimal temporary project is not a full artifact-gate project. Therefore the overall task is not reported as fully accepted.

## Remaining concerns

- Source-bound provenance for the current worktree remains unresolved because its required `.w-model` state and run log are absent. The failure is retained as real evidence; the report does not claim migration completion.
- The out-of-scope active `self-test.ts` and `scripts/samples/README.md` still contain historical cutoff wording. They were not changed because the task explicitly prohibits changes outside the listed files.
- Full repository tests were not run, per task instruction.
