# D7A Report: Markdown table secret sanitization

## Scope

Changed only:

- `w-model-dev/scripts/logic/evidence-export-logic.ts`
- `w-model-dev/scripts/__tests__/evidence-export-logic.test.ts`

No provenance architecture, CLI, documentation, hooks, schema, package, baseline, plan, or spec files changed.

## Implementation

- Added a cell-aware Markdown table sanitizer for `.md` evidence.
- Sensitive key/value rows redact values for normalized sensitive key variants, including case, hyphen, and underscore variants.
- Standard Markdown table headers mark sensitive columns; subsequent data rows redact only those cells.
- Escaped pipes are not used as cell delimiters, and row boundaries, leading/trailing pipes, and no-tail-pipe rows are retained.
- Existing ordinary text handling, absolute-path redaction, relative paths, and HTTPS URLs remain intact.
- `verifyEvidence` continues to use `sanitizeContent`, so hash-valid packages containing unsanitized Markdown table secrets return `UNSANITIZED_EVIDENCE`.

## TDD Evidence

New tests were written before the implementation and initially failed as expected:

- Markdown table secrets remained visible during export.
- Hash-valid unsanitized Markdown passed verification.

The final tests cover no-header sensitive rows, header-driven sensitive columns, sensitive key variants, escaped pipes, no-tail-pipe rows, ordinary values, relative paths, HTTPS URLs, and verify rejection after manually recomputing hashes.

## Verification

Passed:

```text
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts
23 passed

npm run typecheck
passed

npm run lint:security
passed; 0 new findings
```
