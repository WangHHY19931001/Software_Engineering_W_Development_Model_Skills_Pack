# Task 3 report: fix S18 exact symbol matching

## Result

Implemented and committed the S18 canonical symbol-head matching fix in the isolated worktree.

## Commands and actual results

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts` before the implementation: **failed**, 35 tests with 1 failure in the existing parameter-name overlap regression (`Other.call(job)` was incorrectly accepted).
- The expanded RED run after adding the boundary tests: **failed**, 38 tests with 3 failures, including the owner mismatch and nested-generic cases.
- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts` after implementation: **passed**, 38/38 tests.
- `npm run --silent typecheck`: **passed**, exit 0.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts w-model-dev/references/command-reference.md w-model-dev/references/data-models.md w-model-dev/scripts/samples/gate/tickets-valid.md`: **passed**, all matched files use Prettier code style.
- `git diff --check`: **passed**, exit 0.

Every npm invocation printed the existing warning `npm warn Unknown user config "home"`; it did not affect exit status. No unrelated test suite was run, and `npm test` was not run.

## Modified files

- `w-model-dev/scripts/logic/gate-logic.ts`: parses owner/member or unowned function heads, balances nested generic/call delimiters, canonicalizes whitespace, and matches exact canonical keys instead of identifier-token intersections.
- `w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`: retains the minimal `Foo.run`/`Other.call` counterexample, preserves parameter-name-only positive matching, and adds nested generic, whitespace/backtick, same-parameter, owner mismatch, duplicate-definition, and unowned-call coverage.
- `w-model-dev/references/command-reference.md`: documents exact S18 canonical-head semantics and complete-span diagnostics.
- `w-model-dev/references/data-models.md`: adds the active S18 ticket-content data-model semantics.
- `w-model-dev/scripts/samples/gate/tickets-valid.md`: removes the accidental test-runner token-overlap dependency from the valid sample.
- `.superpowers/sdd/2026-09-16-review-remediation/task-3-report.md`: this report.

## Unresolved issues

None for Task 3. The pre-existing npm configuration warning remains informational.

## Round 1 rework (2026-09-17)

Independent review found an out-of-scope wording regression introduced by formatting: the active command reference said `阶段 1~~7` and `阶段 5~~8` instead of the baseline `阶段 1~7` and `阶段 5~8`. Restored only those two range expressions from baseline `a6f9aa61`; the S18 documentation additions remain unchanged.

Validation:

- `npx prettier --config config/prettier.config.cjs --check w-model-dev/references/command-reference.md`: returned exit 1 because the formatter proposes changing the restored baseline wording `阶段 1~7 / 阶段 5~8` back to `1~~7 / 5~~8`; this round preserves the required baseline semantics instead of accepting that formatter rewrite. The baseline content from `a6f9aa61` was checked with the same formatter input path and did not report a content error.
- `git diff --check`: passed.
- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`: passed, 38/38 (rerun as a short focused regression check).

No full test suite was run.

## Round 2 rework (2026-09-17)

The review requested the active command-reference wording `阶段 1~~7 / 阶段 5~~8`; restored only those two expressions and left the S18 documentation unchanged. A byte-level `git show a6f9aa61:w-model-dev/references/command-reference.md` check in this checkout emitted the single-tilde form, which conflicts with the explicit round-2 target; the requested target text was followed and the discrepancy is recorded here.

Validation:

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`: passed, 38/38.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/references/command-reference.md`: passed after restoring the document's original CRLF line endings.
- `git diff --check`: passed; the only output was Git's existing LF-to-CRLF warning for the report/document working-copy line endings.

No full test suite was run.

## Corrected round 3 rework (2026-09-17)

Ran the requested read-only baseline check `git show a6f9aa61:w-model-dev/references/command-reference.md | rg -n -F '阶段 1'`; line 163 contains `阶段 1~7` and the corresponding range is `阶段 5~8`. Restored the current command-reference line to that single-tilde baseline wording while preserving the S18 documentation addition. The earlier double-tilde round-2 change was reverted.

Validation:

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/gate-ticket-content.test.ts`: passed, 38/38.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/references/command-reference.md`: returned exit 1 because the formatter proposes changing the restored single-tilde baseline wording back to double tildes; the historical baseline semantics were preserved as requested.
- `git diff --check`: passed; the only output was Git's existing LF-to-CRLF warning for the report/document working-copy line endings.

No full test suite was run.
