# Archive Race-Boundary Security Report

## Delivery Scope

- Worktree: `D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
- Starting HEAD: `ecf42f45c80300e20456498249ce5312fc41e055`
- Delivery subject: `fix(security): close archive race boundary`
- Tracked delivery files: this report, `w-model-dev/scripts/lib/platform-deps-tar.ts`, and `w-model-dev/scripts/__tests__/platform-deps-install.test.ts`.

Validation ran against current pre-delivery HEAD `ecf42f45c80300e20456498249ce5312fc41e055` with only the three delivery files modified. The verified remediation implementation and tests were committed as `b4697053ad7074ee0d860c154dd7cffa66ef7ac9` using `fix(security): close archive race boundary`. This report is bound in a follow-up commit because a Git commit cannot truthfully contain its own content-derived object ID.

## Security Boundary

`extractArchive()` parses and canonical-preflights the complete archive before platform capability checks or extraction I/O. It rejects absolute or drive-qualified paths, traversal, dot and empty segments, NUL bytes, symlink and hardlink entries, every `linkname`, duplicate canonical paths, and file-ancestor/descendant conflicts, including non-adjacent ancestors.

On supported POSIX systems, extraction opens the caller-provided, existing root and each parent with `O_DIRECTORY | O_NOFOLLOW`, then uses descriptor-child paths rooted at `/proc/self/fd/<fd>` or Darwin `/dev/fd/<fd>`. Files use `O_CREAT | O_EXCL | O_NOFOLLOW`. There is no `mkdtemp`, `copyFile`, `rename`, staging transfer, or path-based write fallback in `platform-deps-tar.ts`.

A successful `mkdir` or file `open` is immediately recorded as owned before any later identity, write, mode, or close operation. The newly added post-`mkdir` parent-descriptor containment check detects a parent moved outside the original root before further child handling. On failure, rollback processes every owned entry in reverse order, aggregates removal and close errors, and continues to later entries. Before `unlink` or `rmdir`, rollback verifies the retained parent identity and that its descriptor still resolves under the original extraction root; a moved parent is rejected instead of cleaning an external location.

Containment is also checked through both parent and file descriptors before and after file writes. Successful extraction closes retained ownership parent handles in reverse order; a close failure is surfaced rather than hidden.

The production hierarchy remains narrow: `verifyPlatformDependency()` invokes its injected `createTemporaryDirectory()` before its verification extraction call and removes that directory in `finally`; the existing installer subsequently creates its own private staging root before its separate `extractArchive()` call. This report does not change or broaden that caller-owned temporary-directory and installer lifecycle.

## Regression Coverage

The platform suite retains coverage for PAX UTF-8 records and `x`/`g` headers, UStar modes, GNU `L` and `K` records, PAX `linkpath`, duplicate canonical paths, non-adjacent file ancestors, symlink/hardlink/linkname rejection, mkdir-followup and file-stat failures, write and close failures, continued rollback after one removal failure, and root/parent descriptor rename-outside races.

The new containment tests follow a red-green sequence:

1. The static POSIX seam failed because the post-`mkdir` containment check was absent.
2. After adding that check, the seam passed.
3. The same seam then failed because rollback lacked a retained-parent containment gate.
4. After adding the rollback gate, the seam passed again.

Windows branches do not simulate a POSIX success path. They either run on the actual `win32` host or temporarily select only the Windows refusal branch while every extraction filesystem method is guarded. The current host is `win32`; native POSIX descriptor-relative extraction and race execution cannot be performed here and are not claimed by these results.

## Current Verification Evidence

All results below are current commands run against pre-delivery HEAD `ecf42f45c80300e20456498249ce5312fc41e055` with the three delivery files modified.

| Command                                                                                                                                                                                                                                                                                                                                                  | Actual result                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-install.test.ts w-model-dev/scripts/__tests__/platform-deps-repair-core.test.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts` | Passed: 5 files, 182 tests.                                                                                                                              |
| `npm run typecheck`                                                                                                                                                                                                                                                                                                                                      | Passed: `tsc -p config/tsconfig.json`, exit 0.                                                                                                           |
| `npx prettier --config config/prettier.config.cjs --write` on the three delivery files                                                                                                                                                                                                                                                                   | Passed: all three files reported unchanged.                                                                                                              |
| `npx prettier --config config/prettier.config.cjs --check` on the three delivery files                                                                                                                                                                                                                                                                   | Passed: all matched files use Prettier code style.                                                                                                       |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                       | Passed, exit 0; Git emitted only expected LF-to-CRLF working-copy warnings.                                                                              |
| `npm run lint:security`                                                                                                                                                                                                                                                                                                                                  | Passed: baseline 410, baseline hits 410, new findings 0. Node emitted existing `DEP0190`; no baseline changed.                                           |
| Sequential `npm run prepush`                                                                                                                                                                                                                                                                                                                             | Passed all 17 gates: platform readiness, self-test, gate probes, security scan, full Vitest with coverage, audit, docs/samples, Prettier, and typecheck. |

## Residual Limits

- Secure extraction is intentionally unavailable on Windows and on systems without usable `O_DIRECTORY`, nonzero `O_NOFOLLOW`, and descriptor filesystem support. This is a fail-closed availability tradeoff.
- The Windows execution verifies pre-write refusal and source-level POSIX ordering only. A POSIX runner is still required for native end-to-end descriptor syscall and race coverage.
- CodeGraph is unavailable because this worktree has no `.codegraph/` index. The implementation and caller path were inspected with repository source search.
- Ignored `.w-model`, `coverage`, and `.zcode` output are not part of this delivery.
