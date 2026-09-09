# Task 1 Ledger Contract Repair — Round 2

Date: 2026-09-07
Status: **BLOCKED**

## Scope

接管并提交任务 1 剩余变更，仅涉及：

- `w-model-dev/scripts/logic/code-health-ledger-logic.ts`
- `w-model-dev/scripts/__tests__/code-health-ledger.test.ts`
- `w-model-dev/schemas/code-health-candidate.schema.json`
- `w-model-dev/schemas/code-health-ledger-event.schema.json`

未触碰已提交的 `39d1671` command/redaction 文件，也未实现任务 2-8、文档同步或 pre-push。

## Round 2 verification

Command:

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/code-health-ledger.test.ts w-model-dev/scripts/__tests__/schema-validation.test.ts -t "code-health"
```

Results:

- Schema validation: **PASS** — 38 tests, 33 skipped by the focused name filter.
- Ledger contract: **21 passed, 3 failed** — overall command exit code 1.

未运行完整 `npm test`、`prepush` 或其他全量命令。

## Fixed in this round

- `recordGateFailure(ledger, candidateId, evidence)` now persists structured `gateFailureEvidence` containing the explicit candidate identity and real command result; the legacy identity-less overload remains fail-closed.
- Runtime candidate/event command validation now rejects negative exit codes; candidate Schema and ledger-event Schema declare non-negative integer exit codes.
- Runtime candidate validation now rejects additional nested properties in rollback, signatures, change scope, and archive records.
- Repository-relative path validation rejects empty segments, duplicate separators, NUL bytes, backslashes, absolute paths, and parent traversal.
- The task-1 cross-task API/type surface was added to the ledger module with fail-closed behavior for unimplemented phase-specific analysis/execution paths.
- The rollback test fixture was aligned with the safe command contract (`git revert COMMIT`).

## Unresolved blocking findings

1. **Critical — rollback transition still relies on evidence-reference text.** `transitionCandidate` still requires an evidence reference matching `/rollback|revert|patch/i`. This violates the requirement that rollback must be proven by structured, real evidence rather than a forged reference name.
2. **Critical — archiveCampaign/verifyArchive are not fully source-bound.** `archiveCampaign` can return success from candidate metadata without verifying that every manifest file exists and hashes to the recorded digest. `verifyArchive` only upgrades to `source-bound` when a source project option is present and does not yet verify the real source provenance/revision bundle. This violates the requirement that source-bound archive success be based on a real manifest/hash/source binding.
3. **Important — task-1 API fail-closed contract is inconsistent.** The focused test still fails because `applyApproved` rejects an invalid lifecycle scope before reaching its explicit task-1 “not implemented/fail-closed” result. The exported API exists, but the expected failure contract is not yet normalized.
4. **Important — ledger-event Schema does not yet model the runtime `gateFailureEvidence` object.** Runtime events can carry the structured field, while the event Schema currently has no corresponding definition/property, so strict runtime/Schema parity is incomplete.

## Final disposition

**BLOCKED.** The current commit records the real round-2 state, but it must not be described as task-1 complete or as passing focused ledger verification until the critical rollback and source-bound archive findings are resolved and the focused ledger test exits 0.
