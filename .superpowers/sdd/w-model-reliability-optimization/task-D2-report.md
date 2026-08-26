# Task D2 Report

## Scope

强化 `w-model-dev/scripts/{cli,application,infrastructure,logic,lib}` 的依赖边界与公开 TypeDoc 回归保护，保持生产脚本运行行为不变。

## Audit and impact analysis

- Baseline parent of the D2 commit: `0d8e305`.
- Original D2 commit under review: `fecf259`.
- CodeGraph 不可用：工作树不存在 `.codegraph/` 索引，因此采用 fallback 影响分析。
- 影响分析已落盘：`.w-model/codegraph-queries/2026-08-25-D2-layer-boundaries.md`。
- 审计确认原测试已有递归导入图、`lib → logic`、`infrastructure → cli`、运行时循环和基础 type-only 分类；本次只补长期回归缺口。

## Changes

- `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`
  - 主门禁统一调用 `boundaryViolations(runtimeEdges)`，避免集中 Node I/O 集合与主门禁逻辑漂移。
  - 使用真实临时 `logic/` fixture 回归裸 `fs` import，证明未登记 logic I/O 会被主门禁阻断。
  - 使用 TypeScript AST 同时识别静态 import/export 与字面量运行时 `import()`；非字面量动态 import 有意不解析。
  - 增强相对 `.js` → `.ts`、`.ts` 和 `index.ts` 解析回归；生产目录所有相对导入必须可解析。
  - 明确排除 `samples/` 与 `__tests__/`，避免 fixture/test 导入污染生产图。
  - 增加 fixture 断言：`lib → logic`、`infrastructure → cli`、未登记 `child_process`/fs I/O、type-only 边和 runtime cycle。
  - 将 logic Node I/O 例外改为带文件级说明的 Map，并校验文件存在、模块属于受控集合、说明非空，防止静默扩大 allowlist。
  - 增加 TypeDoc 命令断言，确保 application 不作为入口且显式排除。
- `package.json`
  - `docs:build` 增加 `--exclude "w-model-dev/scripts/application/**"`，明确 application 是内部编排层，不属于公开 TypeDoc API。

## TDD evidence

- 先添加 TypeDoc application exclusion 断言，基线定向测试：1 failed / 2 passed，失败原因为当前命令无 application 显式排除。
- 最小配置与测试辅助修正后，D2 定向测试通过。

## Verification output

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`
  - PASS: 1 test file, 9 tests passed.
- `npm run typecheck`
  - PASS: `tsc -p config/tsconfig.json` exit 0.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/dependency-boundaries.test.ts package.json`
  - PASS: all matched files use Prettier code style.
- `git diff --check`
  - PASS; only reported the pre-existing modified `progress.md` line-ending warning.
- `npm run docs:build`
  - PASS: TypeDoc generated `docs/api`, 0 errors and 34 existing documentation warnings. `docs/api/` is ignored and not tracked.

## Repair round 1

- Review finding: the original main gate duplicated boundary checks and only recognized `node:fs`, `node:fs/promises`, and `node:child_process`.
- Repair: the main gate now delegates to `boundaryViolations`, which uses the centralized `LOGIC_DIRECT_IO_MODULES` set and catches bare `fs`, `fs/promises`, and `child_process` imports.
- Review finding: the original baseline was recorded incorrectly; this report now records the actual parent `0d8e305`.
- Review finding: dynamic import coverage now asserts literal imports are collected while non-literal imports are intentionally ignored by static analysis.

## Repair verification output

- Red phase: before the repair, the real temporary `logic/.d2-boundary-fixture-<pid>.ts` containing bare `import 'fs'` failed the main-gate assertion because the duplicated check did not recognize bare `fs`.
- Green phase: `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts` — PASS, 1 file and 9 tests passed.
- `npm run typecheck` — PASS, `tsc -p config/tsconfig.json` exit 0.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/dependency-boundaries.test.ts package.json` — PASS.
- `git diff --check` — PASS; only reported existing ignored/unrelated working-tree line-ending warnings for `progress.md` and this report.

## Repair round 2

- Review finding I-1: repair round 1 replaced the fixture-free production clean-graph assertion with a temporary bare-`fs` fixture assertion, so the fixture proof could mask a newly introduced production `lib → logic`, `infrastructure → cli`, or logic I/O violation.
- Red phase: a temporary real file `w-model-dev/scripts/lib/.d2-production-gate-red.ts` importing `../logic/gate-logic.js` caused the new fixture-free production-graph assertion to fail with `lib → logic: lib/.d2-production-gate-red.ts → logic/gate-logic.ts`.
- Green phase: after deleting the red-only file, the separate production-graph test requires `boundaryViolations(runtimeEdges) === []` and `cyclesIn(runtimeEdges) === []`; the independent temporary `logic/` bare-`fs` fixture test remains in place.
- Review finding I-2: the local fallback record now consistently states initial D2 parent `0d8e305`, initial implementation `fecf259`, and repair round 1 `9b0c681`; it also records its D2 scope and local-only, uncommitted status.
- Repair round 2 commit: `fix(architecture): restore production boundary gate`.

## Repair round 2 verification output

- `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/dependency-boundaries.test.ts` — PASS, 1 file and 10 tests passed after removal of the red-only fixture.
- `npm run typecheck` — PASS, `tsc -p config/tsconfig.json` exit 0.
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/dependency-boundaries.test.ts package.json` — PASS.
- `git diff --check` — PASS; only reported existing/unrelated working-tree line-ending warnings for `progress.md` and `cli-natural-exit.test.ts`, plus this report.

## Delivery

- Original commit: `fecf259 test(architecture): enforce script layer boundaries`.
- Repair commit: `fix(architecture): close dependency boundary audit gap`.
- No `progress.md`, `.w-model/`, or generated `docs/api/` files are included in the repair commit.

## Concerns

- TypeDoc still emits 34 pre-existing warnings for unknown documentation tags, unlisted referenced types, archive directory links, and syntax highlighting; build remains exit 0.
- CodeGraph indexing was unavailable in this worktree; the fallback analysis documents the scanned files, current graph findings, and verification plan. The fallback file itself is intentionally left unchanged because this repair request explicitly prohibits touching `.w-model/`.
