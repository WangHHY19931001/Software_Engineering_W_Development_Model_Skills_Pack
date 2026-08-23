# D8 run-log identity S-fix2 report

- Worktree: `D:\w_skill_opt\wmodel-audit-remediation`
- Branch: `fix/audit-remediation`
- Base HEAD before this S-fix2: `e8d697e7ab977dbb5bc99370cff5201d44ef26e9`
- Scope: run-log identity/lifecycle reducer, CLI lifecycle status output, focused regressions, live documentation test-count synchronization, and security-clean test changes.
- Raw `.w-model/run-log.jsonl`: unchanged, 18 lines, 14107 bytes, SHA-256 `22c9081a86f0a195fdcc331a2ec11bd3afcad34a9c47959e27878d01fac5f3a1`.

## CodeGraph evidence

The required pre-edit symbol impact query was executed before code/test edits and saved at:

`.w-model/codegraph-queries/phase8-run-log-identity-sfix2.json`

It covers `checkRunLog`, `check-run-log.ts`, `RunLogEntry`, lifecycle identity projection, schema validation, R3/R7/R8 paths, callers, callees, tests, and blast radius. The phase 8 codegraph gate passed with exit 0.

## Implemented contract

- Added `implementationTarget` to the TypeScript `RunLogEntry` contract and six-dimensional implementation identity projection.
- Kept action-specific projections distinct: rootcause R/V/G use rootcause identity; fix, implementation V/G, and R3 use complete implementation identity.
- Required exact `phase`, `round`, `reportId`, `basedOnReport`, `targetKind`, and `implementationTarget` matching for implementation evidence. Fix artifacts/target must also contain/match the implementation target.
- R7 rootcause-to-fix matching now requires exact fix `reportId === rootcause.reportId`, exact `basedOnReport`, complete identity, role S, and successful outcome.
- Strict phase 8 and legacy records are isolated. Missing identity is emitted as `LEGACY_UNSCOPED`/deferred and cannot provide lifecycle, R3, V, G, or R8 credit. Historical incomplete fixes remain non-blocking diagnostics and are not treated as closed.
- Rootcause V/G approval requires exact report identity and, in strict phase 8, exact `basedOnReport`.
- R3 accepts only role R, successful records, complete exact fix identity, and exactly one record for each completeness/reliability/security dimension. Failed, duplicated, missing-identity, wrong-target, and cross-report records do not provide credit.
- R8 checks each fix window independently, bounded by the next fix or successful checkpoint terminal event. A later checkpoint/window cannot mask an earlier inversion.
- CLI JSON/human output now separates checker exit status from lifecycle status. The raw checker reports `NOT_CLOSED_NOT_PROVEN` when diagnostics remain and states that exit 0 only means no blocking diagnostics under current rules.
- Synchronized live Vitest counts from 970 to measured 980 in `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/INSTALL.md`, `.githooks/pre-push`, and docs-consistency fixtures/tests.

## TDD evidence

Initial focused RED after adding the requested negative cases:

- 62 tests total
- 55 passed
- 7 failed as expected
- Failures exposed implementation-target borrowing, cross-report R7 fix acceptance, missing-identity gate/R3 credit, failed R3 credit, duplicate R3 credit, and R8 multi-fix masking.

Final focused GREEN:

- `run-log-logic.test.ts`: 62/62 passed
- run-log + CLI report tests: 81/81 passed

Requested negative coverage includes target mismatch, cross-report fix, missing identity review/gate/R3, failed R3, duplicate R3, mixed strict/legacy, two fix windows, and `implementationTarget` schema/type mismatch. Existing missing-fix fixture and missing-input exit 2 coverage were retained.

## Verification evidence

All commands were run in the target worktree without installing dependencies, networking, pushing, or modifying `main`.

- `npm test`: 55 test files, 980 tests passed, 0 failed.
- `npm run self-test`: 260/260 samples passed.
- `npm run check:docs-consistency -- --json`: passed, 980 Vitest passed, 0 failed, 35 valid exit-2 probes.
- `npm run lint:security`: baseline 405, exempted 405, new findings 0. Baseline was not regenerated.
- `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts --json`: passed, exit 0.
- `npx tsx w-model-dev/scripts/cli/check-codegraph-queries.ts . --phase 8 --json`: passed, exit 0.
- `npx tsc -p config/tsconfig.json --noEmit`: passed.
- Prettier `--check` over scripts/config: passed.
- `git diff --check`: passed.
- Missing run-log input: exit 2, stderr human-readable `FILE_NOT_FOUND`, stdout `ERROR_JSON` with exitCode 2.
- Raw run-log checker: `passed=true`, `reasons=[]`, `exitCode=0`, `lifecycleStatus=NOT_CLOSED_NOT_PROVEN`, six diagnostics retained, and explicit status note that exit 0 does not mean lifecycle closed or phase release.

## Commit scope

The intended commit contains only these tracked files:

- `.githooks/pre-push`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `docs/INSTALL.md`
- `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
- `w-model-dev/scripts/__tests__/run-log-logic.test.ts`
- `w-model-dev/scripts/cli/check-run-log.ts`
- `w-model-dev/scripts/lib/types.ts`
- `w-model-dev/scripts/logic/run-log-logic.ts`
- `task-D8-run-log-identity-sfix2-report.md`

Pre-existing untracked plans, specs, reviews, reports, `.codegraph`, and all `.w-model` content are excluded from the commit. The raw run-log is not staged or committed.
