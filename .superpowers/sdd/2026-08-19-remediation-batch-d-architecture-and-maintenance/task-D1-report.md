# D1 Report — Script One-Way Infrastructure Dependencies

## Scope completed

- Moved the Ajv/schema infrastructure to `w-model-dev/scripts/infrastructure/`:
  - `schema-loader.ts`
  - `schema-fs.ts`
- Updated all logic, CLI, library, and test consumers to import the infrastructure loader.
- Moved artifact-gate orchestration and UAT mapping composition into `scripts/application/`, removing every runtime `lib → logic` edge.
- Added `dependency-boundaries.test.ts`, which recursively resolves relative TypeScript imports under `cli/`, `application/`, `logic/`, `lib/`, and `infrastructure/` and enforces:
  - no runtime `lib → logic` imports;
  - no runtime cycles;
  - infrastructure does not import CLI;
  - direct logic filesystem/process imports require centralized allowlisting;
  - type-only imports do not become runtime graph edges.

## TDD evidence

1. Added the boundary test first.
2. Observed it fail on the old graph with six runtime reverse edges:
   - `lib/artifact-gate-assets.ts → logic/gate-logic.ts`
   - `lib/artifact-gate-assets.ts → logic/schema-loader.ts`
   - `lib/gate-log-writer.ts → logic/schema-loader.ts`
   - `lib/load-and-validate.ts → logic/schema-loader.ts`
   - `lib/uat-path-mapping.ts → logic/gate-logic.ts`
   - `lib/uat-path-mapping.ts → logic/design-contract-logic.ts`
3. Performed the minimal relocation/import rewiring and reran the test successfully.

## Codegraph fallback

`codegraph_explore` was attempted before edits but the worktree has no `.codegraph/` index. The no-index replacement was a recursive runtime-import graph scan implemented by the new boundary test, supplemented by repository-wide import searches and direct-I/O searches. No index was created because indexing is an owner decision.

## Validation

Passed:

- Targeted migration/boundary suite: 5 files, 49 tests.
- `npm run typecheck`.
- `npm run lint:security` (0 new findings).
- `npm run docs:build` (exit 0; 33 pre-existing TypeDoc warnings).
- Patch whitespace check and static scan confirming no runtime `lib → logic` imports.

Blocked outside the permitted scope:

- Adding `dependency-boundaries.test.ts` changes the real suite from 52/853 to 53/855. The unmodified `.githooks/pre-push` still states `52 test files / 853 tests`; therefore `npm run check:docs-consistency`, full `npm test`, and `npm run prepush` stop on the living-document count mismatch. The task explicitly prohibits modifying hook and docs-consistency files, so neither was changed.

## Behavior preservation

No schema content, gate decision logic, package configuration, hook behavior, or security baseline was changed. The migration preserves existing exports and call behavior while separating runtime layers.
