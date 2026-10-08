# D8 R10 Persona Review S-fix Report

## Status

- Worktree: `D:\w_skill_opt\wmodel-audit-remediation`
- Expected HEAD before work: `794e21f15c066a848bcfcac4ab0f4c565299c4b9`
- No install, network, push, or main-branch operation performed.
- R10 canonical RootCauseReport: `.w-model/rootcause/RC-phase8-10-01.json` / `.md`
- V approved report: `task-D8-r10-persona-review-rootcause-v-approved.md`
- G approved report: `task-D8-r10-persona-review-rootcause-gate-approved.md`
- RootCause gate remained exit 0 before and after S-fix.
- This report does not claim a V/G review of the implementation and does not rewrite the old run-log history.

## Findings Fixed

### I1 deterministic exit-2 probe

- `metrics-report.ts` now has the dedicated deterministic probe:
  `args=[<probeRoot>/probe-project,'--phase=0','--json']` and `cwd=<probeRoot>`.
- `metrics-report` validates the invalid phase before reading `<projectDir>/.w-model/run-log.jsonl`.
- The expected result is status `2`, `ERROR_JSON.exitCode=2`, category `ARG_INVALID`, rule `P0-1`.
- Every probe records stable `probeId`, `args`, `cwd`, `status`, `errorExitCode`, `category`, and `rule`; counting and deduplication use stable probe identity.
- Fixture setup no longer rewrites `AGENTS.md` or adapts live documentation.
- Same-checkout fixtures with no `.w-model` and with a minimal valid `.w-model/run-log.jsonl` produced identical probe maps and `exit2ScriptCount=35`.
- Negative declarations `AGENTS=34` and `INSTALL=25 check + 9 tools` fail as expected.
- Live inventory is `36 CLI files = 26 check + 9 tools + self-test`, with `35` exit-2 scripts and self-test excluded.

### I2 complete R10 contract chain

- Added the unique `checkRootCauseR10Contract` checker in `docs-consistency-logic.ts`.
- `REQUIRED_PATHS` and `DocConsistencyInput` independently read all seven sources:
  1. authority spec
  2. rootcause schema
  3. root-cause checker source/JSDoc
  4. SSoT
  5. root-cause-locator reference
  6. verifier-spec reference
  7. command-reference
- Each source contains and is checked for all seven semantic clauses:
  `canonical-name`, `threshold`, `legacy-fallback`, `same-artifact-dedupe`,
  `cross-artifact-conflict`, `canonical-duplicate`, and `legacy-duplicate`.
- Missing sources fail closed.
- Source-by-clause mutation matrix: `7 sources x 7 clauses = 49/49` explicit violations.
- The contract requires semantic relations, not isolated keyword counts: canonical identity, threshold, fallback condition, same-artifact canonical-first dedupe, cross-artifact conflict, and both duplicate fail-closed branches.

### I3 duplicate branch coverage

- Parent implementation RED was verified in a temporary checkout at parent commit `2dd9252141bda6fa567814aa0a36ea93fa7f8061`: both dedicated duplicate tests failed.
- The temporary test file was deleted and the parent checkout was not changed.
- Current implementation GREEN:
  - two canonical entries: `passed=false`, duplicate reason, `canonical=2`, `legacy=0`;
  - two legacy entries: `passed=false`, duplicate reason, `canonical=0`, `legacy=2`;
  - same-artifact canonical high confidence takes priority over legacy low confidence.
- Current focused root-cause suite: `20/20` passed.
- Historical `task-D8-r10-persona-fix-report.md` retains its original `17 tests / 4 RED` facts and now explicitly clarifies that those four failures did not cover the two dedicated duplicate branches.

## Run-log

The current run-log was appended through `wm-write` only after implementation and validation were green.

- Before append: `11` JSONL entries.
- After append: `12` JSONL entries.
- First historical `runId` remained `RC-phase8-2-02-partial-incident-20260821T221928Z`.
- Appended record: `action=fix`, `role=S`, `basedOnReport=RC-phase8-10-01`, `reportId=RC-phase8-10-01`, `round=10`, `outcome=success`.
- No future V/G/checkpoint/test action was fabricated.

`check-run-log.ts .w-model/run-log.jsonl` was run truthfully after the append and returned exit `1`. Findings:

1. Existing historical `RC-phase8-2-02` has no corresponding fix record.
2. Existing historical `RC-phase8-2-02` has V/R count mismatch.
3. Append-only placement makes the new S-fix entry later than the existing R10 V review.
4. Append-only placement makes the new S-fix entry later than the existing R10 G gate.

These are recorded as process/history facts. The old run-log was not rewritten and the result was not represented as passing.

## Verification Results

| Check | Result | Exit/statistics |
|---|---|---|
| R10 parent duplicate RED | PASS evidence | temporary parent checkout: 2/2 failed for the intended missing branches |
| R10 duplicate focused GREEN | PASS | 20/20 |
| I2 source x clause mutation | PASS | 49/49 mutations failed closed |
| I1 dual-environment equivalence and negative inventory | PASS | same probe map; count 35; 34/25 declarations fail |
| Full Vitest | PASS | 55 files / 942 tests / 942 passed / 0 failed, exit 0 |
| Self-test | PASS | 260/260, 0 failed, exit 0 |
| TypeScript typecheck | PASS | exit 0 |
| Rootcause schema validation | PASS | 23/23 schemas compiled, exit 0 |
| RootCauseReport gate | PASS | `check-rootcause-report.ts`, exit 0, reasonCount 0 |
| Real-root docs-consistency | PASS | exit 0; 23 schemas / 36 CLI / 35 exit2 / 55 files / 942 tests |
| Samples coverage | PASS | exit 0, zero violations |
| Phase 8 codegraph gate | PASS | 4 valid queries, exit 0 |
| Security scan | PASS | 0 new findings, exit 0 |
| Formal Prettier scope | PASS | exit 0 |
| `git diff --check` | PASS | exit 0 |
| `check-run-log.ts` | EXPECTED FAIL | exit 1 for the four truthful history/ordering findings above |

The implementation, test, documentation, and allowed authority-spec changes are ready for review. This report does not claim the run-log gate is green because the user explicitly prohibited rewriting history or fabricating future actions.
