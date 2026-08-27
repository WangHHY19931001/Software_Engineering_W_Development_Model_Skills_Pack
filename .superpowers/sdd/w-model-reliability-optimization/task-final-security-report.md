# Final Security Scan Remediation Report

## Scope and Reproduction

Target base commit: `49e8435bea65cadc0bac1564792a2b3a98c4e6f3`.

The requested baseline facts reported 82 new findings. Reproducing `npm run lint:security` in the supplied worktree produced **81** new findings, with 405 baseline entries and 418 baseline-hit messages. The difference is reported here rather than inferred away: there was no 82nd finding in the scanner output or its JSON-equivalent ESLint results.

The initial 81 findings were classified before changing the baseline:

| Class                                    | Count | Disposition                                                                              |
| ---------------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| Test-owned temporary/fixed fixture paths |    63 | Exact `eslint-disable-next-line` comments with the controlled root or fixed asset reason |
| Test-only static findings                |     6 | Code fixes, not baseline entries                                                         |
| Production findings fixed in code        |     7 | Safe access or syntax changes                                                            |
| Stable production path exceptions        |     5 | Exact content-sensitive baseline entries with ownership/path rationale                   |
| Total                                    |    81 | No bulk baseline regeneration                                                            |

## Complete Finding Classification

### Test-owned controlled paths: 63

All entries below are test fixture paths produced below a `mkdtemp` root, a copied test fixture root, or a fixed repository test asset. Each is locally suppressed immediately before the relevant I/O statement; no file-wide suppression was added.

| File                                       |                                                                                                                                       Findings | Classification                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------- |
| `__tests__/artifact-gate-assets.test.ts`   |                                                                                                          7: 163, 164, 227, 260, 313, 447 twice | `detect-non-literal-fs-filename`; temporary TLA/BDD/Cucumber files below `tmpDir`                     |
| `__tests__/cli-natural-exit.test.ts`       |                                                               16: 89, 99, 103, 104, 115, 116, 174, 181, 187, 188, 226, 227, 266, 267, 289, 291 | `detect-non-literal-fs-filename`; temporary command, project, scanner, and samples fixtures           |
| `__tests__/docs-consistency-logic.test.ts` |                                                                                                                            3: 1233, 1844, 2408 | `detect-non-literal-fs-filename`; fixed documentation inventory or isolated copied repository fixture |
| `__tests__/gate-report.test.ts`            | 28: 271, 324, 343, 362, 365, 367, 385, 392, 411, 413, 430, 435, 437, 454, 455, 457, 478, 498, 501, 503, 523, 524, 526, 546, 706, 707, 751, 756 | `detect-non-literal-fs-filename`; gate-log and model files below each test's temporary root           |
| `__tests__/platform-deps-hook.test.ts`     |                                                                                                           8: 55, 58, 59, 66, 67, 100, 122, 539 | `detect-non-literal-fs-filename`; temporary hook workspace/command fixture or fixed pre-push asset    |
| `__tests__/run-sync.test.ts`               |                                                                                                                                         1: 220 | `detect-non-literal-fs-filename`; temporary `tla2tools.jar` fixture                                   |

### Test-only static fixes: 6

| File                                      |                                    Findings | Resolution                                                                                   |
| ----------------------------------------- | ------------------------------------------: | -------------------------------------------------------------------------------------------- |
| `__tests__/evidence-export-logic.test.ts` |               792 `detect-object-injection` | Replaced a loop-selected provenance assignment with the two fixed allowed field assignments. |
| `__tests__/platform-deps-install.test.ts` |                97 `detect-object-injection` | Replaced test tar-buffer bracket indexing with `Buffer.readUInt8`.                           |
| `__tests__/run-sync.test.ts`              | 304 twice and 305 twice `no-useless-escape` | Removed the unnecessary quote escapes inside regex character classes.                        |

### Production findings fixed in code: 7

| File                                  |                                    Findings | Resolution                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application/artifact-gate-assets.ts` |                          291 `prefer-const` | Changed immutable `bddManifestValid` to `const`.                                                                                                                                                                                                                                        |
| `cli/platform-deps-install.ts`        | 243 twice and 255 `detect-object-injection` | Replaced dynamic manifest property indexing with fixed `main`/`module` access and `Object.getOwnPropertyDescriptor` for `exports["."]` conditions. This keeps package entry candidate semantics while preventing prototype-chain lookup.                                                |
| `lib/platform-deps-tar.ts`            |                31 `detect-object-injection` | Replaced unchecked Buffer bracket access with bounds-checked `readUInt8`. Completed the existing uncommitted PAX `Map` migration: PAX parsing accepts Buffer/string input, all PAX reads use `Map.get`, reset remains a `Map`, and `linkpath` now correctly overrides the header value. |
| `logic/evidence-export-logic.ts`      |               681 `detect-object-injection` | Replaced sorted-array dynamic indexing with iterator consumption during manifest order validation.                                                                                                                                                                                      |
| `logic/run-log-logic.ts`              |              1175 `detect-object-injection` | Replaced fixed-name dynamic record indexing with explicit `stdoutSummary`/`reportSummary` property access.                                                                                                                                                                              |

The PAX work has an added behavioral regression: a PAX `linkpath` must override the symlink header `linkname`. The initial test run failed against the incomplete Map migration, including PAX state reset and linkpath access; after the fix, the full platform dependency test file passed.

### Stable production exceptions: 5

These are the only baseline additions. They are all in `logic/state-write-logic.ts`, operate on the explicit caller-selected `absPath` or paths derived from it, and execute under the module's owned lock/atomic rollback protocol. They remain scanner-visible and carry narrow content-sensitive hashes:

| Original line | Hash prefix | Operation                    | Baseline rationale                                                    |
| ------------: | ----------- | ---------------------------- | --------------------------------------------------------------------- |
|           141 | `92bac38f`  | Read lock metadata           | Metadata path is derived from the owned lock directory.               |
|           387 | `59116765`  | Write rollback payload       | Path is derived from the owned target and lock token.                 |
|           415 | `6edbc461`  | Read rollback payload        | Read occurs after ownership and atomic-move checks.                   |
|           422 | `6558f434`  | Check target absence         | Only the caller-selected target is inspected while the lock is owned. |
|           482 | `ab5c1380`  | Read original target content | Only the caller-selected target is read while the lock is owned.      |

Baseline entry count changed **405 to 410**. `--regenerate` was not run. No ESLint rule, configuration, or global ignore pattern was weakened. A future code-line change produces a different v2 content hash and must be reviewed again.

## Ancillary Required Maintenance

The added local comments in `docs-consistency-logic.test.ts` shifted its direct child-process call locations. `lib/run-sync.ts` is the repository's line-accurate audit provenance manifest, so its eight affected test-call line values were synchronized with the actual AST locations and verified by `run-sync.test.ts`.

The first complete pre-push attempt reached the Prettier gate only after all earlier gates passed. It identified two final-HEAD files that were already nonconformant to the current formatter:

- `__tests__/platform-deps-repair-core.test.ts`
- `lib/platform-deps-installer.ts`

They were formatted without semantic edits solely to remove the pre-push blocker. They do not correspond to scanner findings or broaden the remediation scope.

## Verification Evidence

| Command                                                                                                       | Result                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial `npm run lint:security`                                                                               | Failed as expected: 81 new findings.                                                                                                                             |
| PAX red test run                                                                                              | Failed as expected on incomplete Map migration and missing PAX `linkpath` behavior.                                                                              |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-install.test.ts` | Passed: 45 tests.                                                                                                                                                |
| Related targeted tests (`artifact-gate-assets`, `evidence-export-logic`, `run-log-logic`)                     | Passed: 182 tests.                                                                                                                                               |
| Final affected-suite run                                                                                      | Initially 478/479 passed; line-audit provenance was corrected. Final `run-sync.test.ts`: 18/18 passed.                                                           |
| `npm run lint:security`                                                                                       | Passed: baseline entries 410, baseline-hit messages 410, new findings 0.                                                                                         |
| `npm run typecheck`                                                                                           | Passed: `tsc -p config/tsconfig.json`.                                                                                                                           |
| `npx prettier --check` over modified files                                                                    | Passed.                                                                                                                                                          |
| `git diff --check`                                                                                            | Passed.                                                                                                                                                          |
| `npm run prepush`                                                                                             | Passed on the second run: all 17 pre-push gates passed, including full Vitest coverage, audit, security scan, docs/samples consistency, Prettier, and typecheck. |

## Final Result

Security scan blocking is closed in this worktree. The final state has no new scanner findings and a narrow, documented baseline increase of five content-sensitive state-write exceptions.

## Final Security Boundary Fix Round (2026-08-26)

This round addresses the two Important findings carried over from the independent final security review.

### Broad suppression removal

- Removed the file-level `eslint-disable security/detect-non-literal-fs-filename` from `w-model-dev/scripts/cli/platform-deps-install.ts`.
- Replaced the suppression with statement-local `eslint-disable-next-line` comments immediately before each remaining dynamic filesystem call.
- Each local comment documents the concrete source boundary: lockfile/package-selected paths, verified package metadata under isolated staging, npm-pack's fixed staging directory, or the explicitly selected offline tarball. No new file-wide disable was added.
- Before the change, the existing broad suppression kept `npm run lint:security` at exit 0 with baseline 410/hits 410/new 0. After removal, lint exposed 13 findings; after local suppression, it exposed 1 tar `lstat` call; after that final local suppression, lint returned baseline 410/hits 410/new 0. The baseline was not regenerated and remains unchanged at 410 entries.

### `extractArchive()` self-defense

- `w-model-dev/scripts/lib/platform-deps-tar.ts::extractArchive()` now independently rejects absolute/drive-qualified paths, `..`, `.`, empty segments, NUL bytes, symlink/hardlink entries, and any `linkname`-bearing entry before extraction I/O. It uses the shared archive path predicate and preserves the caller-side `validateArchiveEntries()` check as defense in depth.
- It resolves each target beneath the extraction root, rejects symlink ancestors in the root and target hierarchy, creates directories one component at a time with post-create checks, and uses exclusive file creation (`flag: 'wx'`) to prevent existing targets/symlinks from being followed or overwritten.
- The parser retains the untrimmed archive path for the extractor's own validation, so repeated trailing separators cannot be hidden by directory-marker normalization. UStar/PAX/GNU long paths and tar modes remain supported; executable modes continue to be passed through for valid entries.
- Direct-call tests now cover traversal, absolute/drive paths, empty segments, NUL/PAX paths, symlink/hardlink/linkname entries, pre-existing symlink ancestors, no partial writes for rejected archives, and the existing executable-mode/UStar/PAX/GNU installation paths.
- As an adjacent boundary check, `parseArgs()` now rejects path-traversing `--package` values before any install target is constructed; this keeps the local CLI path suppressions' lockfile/package-root premise true.

TDD evidence for this round: the new direct extraction tests failed against the old implementation (5 failures, including traversal/empty-segment/NUL and partial-write behavior); the adjacent package-target test also failed once before its guard was added. After the implementation, the affected platform suite passed 54/54, the repair-core suite passed 27/27, and the final full suite passed 58/58 files. `npm run lint:security` passes with no new findings and no baseline change.

### Final verification for this round

| Command                                                                                                                                         | Result                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest directed Vitest (`platform-deps-install`, `platform-deps-repair-core`, `evidence-export-logic`, `evidence-provenance-logic`, `run-sync`) | Passed: 5 files / 156 tests.                                                                                                                                                                                                                                                          |
| Full `npm test`                                                                                                                                 | Passed: 58 files / 1234 tests.                                                                                                                                                                                                                                                        |
| Coverage run (`npx vitest run --coverage`)                                                                                                      | Passed: 58 files / 1234 tests; aggregate 77.57% statements, 72.09% branches, 86.03% functions, 79.41% lines. Final prepush coverage also passed.                                                                                                                                      |
| `npm run lint:security`                                                                                                                         | Passed: baseline 410, baseline hits 410, new findings 0. No baseline file change.                                                                                                                                                                                                     |
| `npm run typecheck`                                                                                                                             | Passed: `tsc -p config/tsconfig.json`, exit 0.                                                                                                                                                                                                                                        |
| Targeted `npx prettier --check`                                                                                                                 | Passed for all 4 changed source/test files.                                                                                                                                                                                                                                           |
| `git diff --check`                                                                                                                              | Passed, exit 0. Git emitted only expected LF→CRLF normalization warnings for two edited TypeScript files.                                                                                                                                                                             |
| `npm run prepush`                                                                                                                               | Final run passed all 17 gates, including full coverage Vitest, npm audit, docs/samples consistency, Prettier, and typecheck. An earlier concurrent run transiently returned 1 at the Vitest gate with no captured failure output; exact command and final sequential run both passed. |

No `.eslintsecurity-baseline.json` change was needed in this round. The ignored local fallback CodeGraph record was written to `.w-model/codegraph-queries/2026-08-26-final-security-boundary.md`; it is intentionally not part of the commit. `progress.md`, `.w-model`, logs, and unrelated reports remain uncommitted.

## Archive extraction race-boundary follow-up (2026-08-27)

The final uncommitted `extractArchive` implementation was reviewed against an attacker who can alter the selected extraction tree concurrently (including replacing a checked directory with a POSIX symlink or Windows junction) while the process is between archive validation and filesystem I/O. The underlying TOCTOU defect was that lexical path checks and `lstat` checks do not pin the directory object used by a later path-based write; a replacement can therefore redirect a write after validation.

The implementation now stages all archive output in a private `mkdtemp` workspace below the validated extraction root, creates directories component-by-component, rejects symlink/non-directory components, pins each component through `realpath`, and uses exclusive file creation. Where Node exposes POSIX directory descriptors, file creation is addressed through `/proc/self/fd/<fd>` (or `/dev/fd/<fd>`) with `O_NOFOLLOW`/`O_DIRECTORY` when available; the parent directory identity is checked around the open. Windows has no equivalent portable no-follow directory-descriptor API in this Node path, so the implementation uses `O_EXCL`, post-open parent identity verification, immediate ancestor/link and `realpath` checks, and fail-closed cleanup. This is a best-effort boundary, not a claim of kernel-level no-TOCTOU semantics on Windows.

Before any extraction I/O, canonical archive paths are checked for traversal, NUL/empty/dot segments, links, duplicate canonical names, and file-versus-descendant conflicts. Canonical comparison normalizes slash direction and, on Windows, case; trailing directory separators are retained in `rawPath` for validation but removed for the staged target. Duplicate entries are rejected rather than last-entry-wins. UStar, PAX, GNU long-name/long-link parsing and mode propagation remain covered by the existing tests.

The required full platform dependency test file produced **59/59 passed** in the final run. This includes the duplicate/conflict/race coverage already present in the uncommitted worktree diff; no race assertion was weakened or removed. `npm run typecheck`, `npx prettier --check` over the three allowed files, `npm run lint:security` (baseline 410, hits 410, new findings 0), and `git diff --check` all passed. No `.eslintsecurity-baseline.json` update was made. `npm run prepush` reached the Vitest + coverage gate after all preceding gates passed, but exited 1 there; the hook emitted only its temporary JSON report path, which was removed by the hook cleanup before inspection. The targeted required suite remains green; this pre-push full-suite result is recorded as an unresolved verification concern rather than claimed as passed. No baseline update was authorized.

## Windows archive fail-closed contract follow-up (2026-08-27)

This follow-up preserves the uncommitted archive race-boundary implementation and closes the remaining Windows test/typecheck contract issues. `extractArchive()` rejects immediately on `win32`, before `assertNoSymlinkAncestors`, root creation, `mkdtemp`, `fs.open`, or any other extraction write. The descriptor child helper also has no path-based fallback: if the platform cannot provide the required directory/no-follow descriptor boundary, it rejects rather than attempting a best-effort path open. Duplicate canonical paths and file-versus-descendant conflicts remain validated from parsed archive bytes before any filesystem write.

The test suite now keeps Windows installation expectations explicit: a Windows extraction refusal is `install-error`, exit code `1`, with no installed target or staging residue; the two-package CLI refusal summary is `passed: 0` and `failed: 2` while retaining the independent integrity error. POSIX-only assertions continue to cover successful extraction, UStar/GNU/PAX paths and modes, symlink rejection, descriptor-relative parent/file checks, close-error handling, root/workspace cleanup, and top-level no-replace/rollback helpers. No file-level ESLint suppression was added.

### Verification evidence for this follow-up

| Command                                                                                                                                          | Result                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc -p config/tsconfig.json --noEmit` before the test-only fix                                                                              | Failed only with TS2367 at `platform-deps-install.test.ts` lines 451 and 460; both comparisons were unreachable after the Windows early-return guard.                                                                                                                                      |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-install.test.ts` before and after the type-only fix | Passed: 68/68 on the current Windows (`win32`) runner. The Windows CLI assertions include `install-error` and the multi-package `passed: 0` / `failed: 2` contract.                                                                                                                        |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-repair-core.test.ts`                                | Passed: 27/27.                                                                                                                                                                                                                                                                             |
| `npm run typecheck`                                                                                                                              | Passed: `tsc -p config/tsconfig.json`, exit 0.                                                                                                                                                                                                                                             |
| `npx prettier --config config/prettier.config.cjs --check <three allowed files>`                                                                 | Passed: all three files formatted.                                                                                                                                                                                                                                                         |
| `git diff --check`                                                                                                                               | Passed; only expected LF→CRLF normalization warnings were emitted by Git on the Windows checkout.                                                                                                                                                                                          |
| `npm run lint:security`                                                                                                                          | Passed after statement-local test suppressions: baseline 410, hits 410, new findings 0; no baseline update.                                                                                                                                                                                |
| `npm run prepush`                                                                                                                                | Passed: all 17 pre-push gates, including full Vitest plus coverage, npm audit, docs/samples consistency, Prettier, and typecheck.                                                                                                                                                          |
| Platform evidence                                                                                                                                | Current runner is Windows (`node -p "process.platform"` → `win32`). POSIX descriptor-relative success paths cannot be executed natively here; they remain covered by platform-guarded tests and the implementation rejects when the required descriptor/no-follow boundary is unavailable. |

Only the redundant post-guard platform checks were removed from the test; the archive implementation and its fail-closed behavior were not weakened. No security baseline or unrelated tracked file was changed.
