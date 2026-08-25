# C2 文档入口与 SSoT 收尾验收记录

> Reviewed baseline HEAD：`f7c13896305c6ea97731e9b1f2cfeb8d1b6690c8`（`test(verifier): isolate original failure regression`）。
> 本记录只收录本任务实际执行的命令和结果；未执行的全量门禁、pre-push 与证据导出不作通过声明。

## 变更范围

- 审计了 `README.md`、`docs/INSTALL.md`、`docs/adoption-guide.md`、`AGENTS.md`、`CONTRIBUTING.md` 与 `docs/skill-design-document_SSoT.md`。
- 入口契约已有满足项未重写：仓库验证与 Skill 安装双入口、Node/Git/npm registry 要求、PowerShell 5.1 逐行命令、Git Bash/WSL 边界、`postinstall` 的 `core.hooksPath` 本地副作用、pre-push 不自动安装、显式平台依赖入口、Agent-specific 路径和 Windows/WSL `node_modules` 隔离。
- SSoT §3.1 已有 SkillPackage / Host / Tools 三边界 Mermaid 图及边界说明，因此未重复改写 SSoT 正文。
- 最小修复：`docs-consistency-logic.ts` 现在在 SSoT §3.1 区段内校验三边界图、Host 关系和交付边界文字；测试补充缺失边界的失败回归、真实 SSoT 三边界断言，并保持 C3 入口回归。

## 真实执行记录

| 命令 | 结果 |
|---|---|
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts -t 'SSoT 三边界架构契约缺失'` | 先失败（修复前红灯），修复后同测试通过：1 passed。 |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts -t 'C3 文档入口契约|三边界'` | 通过：3 passed。 |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts --reporter=dot` | 失败：159 tests，152 passed，7 failed。失败集中在既有动态 docs-consistency fixture 的 script registry / `platform-deps-install.ts` exit-2 probe 契约漂移，详见 deferred concerns。未将其写成通过。 |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | 通过：`fixtureCount=280`、`referencedFiles=242`、`referencedDirs=15`、`unregistered=0`、`undeclaredDirs=0`、`exitCode=0`。 |
| `npm run typecheck` | 通过，`tsc -p config/tsconfig.json` exit 0。 |
| `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 通过：所有目标文件符合 Prettier。 |
| `git diff --check` | 通过；仅报告预存在的 `progress.md` 行尾转换提示。 |
| `npm run check:docs-consistency` | 未通过，且未宣称通过：动态 Vitest 事实包因失败测试不可采信；同时报告当前文档/登记基线漂移（57 test files、约 1203 tests、SKILL/dispatch-matrix 脚本登记及 `platform-deps-install.ts` probe）。 |
| Persona 真实 CLI smoke tests | 未执行；本任务没有修改 Persona fixture 或 Verifier 逻辑。 |
| `npm run prepush` / `.githooks/pre-push` | 未执行；不得表述为通过。 |
| `npm run self-test`、全量 `npm test`、`npm run lint:security` | 未执行；本任务按简报要求不跑无界全量。 |
| `wm:export-evidence` / `wm:export-evidence --verify` | 未执行。 |
| `wm:verify-evidence-source` | 未执行。 |

## 证据与 provenance 级别

- Reviewed baseline 身份：`f7c13896305c6ea97731e9b1f2cfeb8d1b6690c8`。
- C2 产生的 Git 提交由任务提交后以 `git log` 输出为准；本记录不预填不可在提交前确定的自引用 SHA。
- package-only provenance：未生成、未验证。
- source-bound provenance：未生成、未验证；没有 `--source-project` 级别证据。
- `.w-model/`、`.zcode/`、`coverage/` 及历史归档未作为本次当前 HEAD 验收证据；fallback 影响分析记录位于被忽略的 `.w-model/codegraph-queries/2026-08-25-C2-docs.md`，未提交运行期生成物。

## Deferred concerns

1. `check-docs-consistency` 当前动态门禁仍受基线漂移阻断：活体文档保留 `55 files / 1002 tests`，工作树真实测试库存为 57 个文件、约 1203 条；本 C2 不做跨文档计数刷新，避免把既有失败与入口收尾混在一起。
2. `dispatch-matrix.md` / `SKILL.md` 对 `check-tla-bdd-sync`、`platform-deps-install.ts` 的登记与计数，以及 `platform-deps-install.ts` 的结构化 `rule` probe 仍需独立修复；该修复会触及更广的门禁事实源，未在 C2 越界实施。
3. pre-push、全量自检、安全扫描、Persona CLI 和 provenance producer/verify 均没有本次执行证据。
