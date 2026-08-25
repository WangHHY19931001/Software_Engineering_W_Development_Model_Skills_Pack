# Task B2 report — runtime state schema contract

- Status: DONE_WITH_CONCERNS
- Workspace: `D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
- Baseline HEAD: `f79f8c3`
- Scope: B2 tests only; no production TypeScript rewrite was needed because the existing registry and write path already satisfy the requested runtime contract.

## Fact check

- Runtime registrations confirmed in `w-model-dev/scripts/lib/state-schema-registry.ts`:
  - `.w-model/project.json` → `project`, JSON
  - `.w-model/rtm.json` → `rtm`, JSON
  - `.w-model/budget.json` → `budget`, JSON
  - `.w-model/maturity.json` → `maturity`, JSON
  - `.w-model/run-log.jsonl` → `run-log`, JSONL
- `w-model-dev/scripts/cli/wm-write.ts` is the only discovered CLI write entry and calls `writeStateJson()` from `w-model-dev/scripts/logic/state-write-logic.ts`.
- `checkpoint-log`, `event-ingress`, and `hill-climbing-report` were found only as schema/checker/fixture inputs; no runtime `wm-write` or `writeStateJson` consumer was found. They remain absent from the runtime registration table.
- CodeGraph was unavailable because no `.codegraph/` index exists. Equivalent `rg` import/call analysis was recorded in `.w-model/codegraph-queries/2026-08-25-B2-state-contract.md` (local ignored evidence file).

## Changes

- `w-model-dev/scripts/__tests__/state-schema-registry.test.ts`
  - Locks fixture-only schemas to `null` resolution.
  - Locks prefix-like and outside-project path boundaries.
- `w-model-dev/scripts/__tests__/state-write-logic.test.ts`
  - Locks physical JSONL line numbers across blank lines.
  - Locks validator exceptions propagating fail-closed with lock cleanup.
  - Locks validator `valid:false` rejection and no target creation.
  - Locks outside-project targets not being classified as project state.
  - Locks valid project/RTM/budget/maturity/run-log fixtures through the registered schema contract.
- Existing tests already covered unregistered default rejection, explicit `allowUntyped` tracking, registered-schema enforcement despite `allowUntyped`, JSON/JSONL schema rejection, and CLI exit 0/1/2 paths; those tests were retained.

## Verification (real commands)

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/schema-validation.test.ts w-model-dev/scripts/__tests__/state-schema-registry.test.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts w-model-dev/scripts/__tests__/wm-write.test.ts`
  - Exit 0; 4 test files passed; 97 tests passed; 0 failed.
- `npm run typecheck`
  - Exit 0.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/state-schema-registry.test.ts w-model-dev/scripts/__tests__/state-write-logic.test.ts`
  - Exit 0; all matched files use Prettier code style.
- `git diff --check`
  - Exit 0; only pre-existing `progress.md` CRLF warning was emitted by Git.
- No full test suite and no network command was run.

## Concerns

1. CodeGraph remained unavailable as required by the current workspace; the fallback impact analysis is recorded locally but `.w-model/` is Git-ignored.
2. The worktree contains a pre-existing unrelated modification to `.superpowers/sdd/w-model-reliability-optimization/progress.md`; it is intentionally excluded from the B2 commit.
3. Because the requested contract was already implemented at baseline, this commit adds regression coverage but does not alter production TypeScript.
