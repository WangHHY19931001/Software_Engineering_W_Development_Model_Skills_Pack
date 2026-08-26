# Task D2 Report

## Scope

强化 `w-model-dev/scripts/{cli,application,infrastructure,logic,lib}` 的依赖边界与公开 TypeDoc 回归保护，保持生产脚本运行行为不变。

## Audit and impact analysis

- Baseline: `2c3ddd2`.
- CodeGraph 不可用：工作树不存在 `.codegraph/` 索引，因此采用 fallback 影响分析。
- 影响分析已落盘：`.w-model/codegraph-queries/2026-08-25-D2-layer-boundaries.md`。
- 审计确认原测试已有递归导入图、`lib → logic`、`infrastructure → cli`、运行时循环和基础 type-only 分类；本次只补长期回归缺口。

## Changes

- `w-model-dev/scripts/__tests__/dependency-boundaries.test.ts`
  - 使用 TypeScript AST 同时识别静态 import/export 与字面量运行时 `import()`。
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

## Delivery

- Intended commit: `test(architecture): enforce script layer boundaries`.
- No `progress.md`, `.w-model/`, or generated `docs/api/` files are included in the D2 commit.

## Concerns

- TypeDoc still emits 34 pre-existing warnings for unknown documentation tags, unlisted referenced types, archive directory links, and syntax highlighting; build remains exit 0.
- CodeGraph indexing was unavailable in this worktree; the fallback analysis documents the scanned files, current graph findings, and verification plan.
