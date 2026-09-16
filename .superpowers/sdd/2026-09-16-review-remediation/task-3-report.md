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
