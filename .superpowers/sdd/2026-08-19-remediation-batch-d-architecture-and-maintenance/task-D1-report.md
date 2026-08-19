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

---

## Review remediation — round 1 of 5

### Closed findings

1. **TypeDoc API preservation**: `docs:build` now includes `w-model-dev/scripts/infrastructure`. `schema-loader.ts` documents its public `validateBySchema` function and `SchemaValidationResult` interface, and the generated API output includes both symbols.
2. **Runtime import classification**: dependency-boundaries now uses the TypeScript AST for import/export declarations. It distinguishes declaration-level and named type-only specifiers, including `import { type T }`, mixed value/type imports, and type-only/mixed re-exports. Only declarations containing a runtime specifier form runtime graph edges.
3. **Model child-process entry paths**: `runModelChecks` resolves TLA+/BDD scripts explicitly through `../cli/`. The regression test asserts the exact CLI entry paths and verifies the files exist before checking the bounded spawn options.
4. **Migration terminology**: stale script comments now refer to `application/` and `infrastructure/` rather than the old `lib/` and `logic/` locations.

### Additional TDD evidence

- Before the remediation, the added AST fixture classified `import { type NamedType }` as a runtime dependency, and the added model-check regression received nonexistent `scripts/application/check-*.ts` arguments.
- Both tests passed after the minimal implementation changes.

### Round-1 validation

- Focused review regression suite: 5 files / 50 tests passed.
- `npm run typecheck` passed.
- `npm run lint:security` passed with 0 new findings.
- `npm run docs:build` passed and generated public pages for `validateBySchema` and `SchemaValidationResult` (33 existing TypeDoc warnings remain).
- Full `npm test` ran 53 files / 856 tests: 855 passed; the sole failing docs-consistency fixture is the known 52/853 live-count drift and is outside this round's permitted hook/docs-consistency scope.
- `npm run prepush` reached the coverage gate; all preceding checks passed, and coverage exited 1 because the same docs-consistency count drift is included in the coverage run. The drift is recorded rather than changing hook, baseline, or docs-consistency files.
