# SDD ledger — plan: docs/superpowers/plans/2026-09-16-review-remediation.md

## Preparation

- Base branch: `codex/review-remediation` at `6ba77ed7b222b3c362420d58dd7c7e2ab2b90120`.
- Worktree: `.worktrees/review-remediation`.
- Plan copy hash matches the approved plan in the primary workspace.
- Execution policy: strict M07/R10 evidence; no mutable timestamp legacy absorption.
- The WSL wrapper must set `GIT_DIR=/mnt/d/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.git/worktrees/review-remediation` and `GIT_WORK_TREE=/mnt/d/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/review-remediation` when running SDD helper scripts.

## Tasks

- [x] Task 1: establish regression contracts and migration inventory.
- [x] Task 2: implement safe project paths and strict evidence policy.
- [x] Task 3: fix S18 exact symbol matching.
- [x] Task 4: fix review-package input, determinism, and atomic writes.
- [x] Task 5: fix pre-commit staged-only behavior and cross-platform execution.
- [x] Task 6: make negative coverage real, complete, and auditable.
- [x] Task 7: close documentation, test-matrix, and deterministic-order gaps (two deviations registered).
- [ ] Task 8: run full verification, gates, and final review (in progress — see below).

## Completed

- Task 1: fix round 1/5 (5 addressed, 1 open — direct safe-path/junction contract, real commit prefix collision, subprocess registration, S18 positive boundary, and output-directory coverage; commit 738cbe45).
- Task 1: fix round 2/5 (1 addressed, 0 open — real distinct commit objects sharing a seven-character prefix; commit 672bbc82).
- Task 1: complete (commits 6ba77ed7..672bbc82, review clean).
- Task 2: first implementation attempt interrupted after no changes; split into 2A (safe paths/E2/tickets) and 2B (strict M07/R10 evidence) to reduce scope.
- Task 2A: fix round 1/5 (added E2 symlink integration coverage, real CLI NUL validation, and corrected ticket-path classification comment; commits 3e11936d..808c86bb).
- Task 2A: complete (review 3ddd65a8..808c86bb CLEAN; safe project paths, E2, and --tickets boundary are ready for 2B).
- Task 2B: review round 1 found M07 business-layer and quality/provenance issues; round 2 fixed them and clarified controlled-project provenance.
- Task 2B: complete (commit a6f9aa61; review f96e93ff..a6f9aa61 CLEAN; strict M07/R10 evidence, schema/fixture migration, and provenance records accepted).
- Task 3: review round 1 found a range-wording drift; subsequent net-diff review against the original task base confirmed the raw baseline is preserved and S18 changes are clean (current commit 9d615c9b).
- Task 3: complete (net review a6f9aa61..9d615c9b CLEAN; exact S18 symbol matching, focused boundary coverage, and active documentation accepted).
- Task 4: review round 1 found five missing boundary/atomic-write assertions; the remediation commit 549b9898 added ARG_INVALID repo handling, zero-Git-call checks, fs fault seams, identity revalidation, and complete writes. Review CLEAN; one Windows permission case is explicitly skipped.
- Task 4: complete (review f015a198..549b9898 CLEAN; deterministic full-SHA review packages and atomic output accepted).
- Task 5: fix round 3/5 (8th round) — the full-file run refuted the 7th round's focused-only evidence: 5 failed | 17 passed (22). Root causes: `ps -o` unsupported on Git Bash made descendant enumeration silently empty (orphaned node + `git cat-file --batch` held the pipes → 61s, EBUSY, leftover temp dirs), and the hook mixed `C:/...` with `/tmp/...` for one directory. Fixed by probing the process table (`ps -ef` fallback, fail-closed when unusable), a single-snapshot descendant closure, `normalize_bash_path` for the repository root, and a Node-helper watchdog/signal path. Commit fd387daa; 22/87/190 passed with exit codes.
- Task 5: complete (review 5ce21cd7..fd387daa CLEAN; the reviewer reproduced the old defect by running the new tests against the old hook blob: 6 failed | 16 passed, 18-minute orphan, EBUSY). One mechanism correction: on Git Bash the closure contains only node (MSYS reports the batch helper as PPID=1), so reclamation rides on node's death via libuv — recorded in the hook comment and task-5-report.md §第九轮.
- Hygiene (before Task 6): `lint:security` was already red at fd387daa (83 new findings, stale baseline) and `self-test` was already red (1 case: `gate/valid-phase6.json[p6]` lacked the M07 evidence that Task 2B's strict mode requires). Both halves of pre-push would have failed for reasons predating this session. Fixed in code without touching the baseline (0 new findings) and by adding real evidence to the phase-6 fixture; commit 957aa1fc and the Task 8 record.
- Task 6: complete (commit 77f46144) — `lib/exit2-probe-registry.ts` as the single probe source, 45 rows / 47 serial probes all exit 2 with isolated-root zero drift, strict row syntax and `file:line` evidence checks, the two placeholder rows replaced with real evidence. Deviations and the +68.7s pre-push cost are registered in task-6-report.md.
- Task 7: complete with two registered deviations (commit 77f46144) — AGENTS §8 exact table matching, tests-matrix set equality (9 files relisted, 90 = 90), locale-stable pollution ordering, gate-test-evidence CLI两态 tests, and the M07/R10 legacy doc drift in data-models.md/AGENTS.md/self-test.ts fixed. Not done: step 3 (whole-repo snapshot would reintroduce the documented vitest flakiness) and the exit-0 state of step 4 (no phase-8-valid project fixture exists). See task-7-report.md.
- Task 8: verified so far — `typecheck` exit 0; `self-test` 352/352 exit 0; `lint:security` exit 0 with 0 new findings; `check-samples-coverage` exit 0 (45 rows / 47 probes); prettier (pre-push scope) exit 0; `git diff --check` clean. The full 18-item `npm run prepush` re-run and the resulting record are the remaining step; the earlier prepush attempt stopped at item 1 (self-test) because of the pre-existing failure now fixed.

