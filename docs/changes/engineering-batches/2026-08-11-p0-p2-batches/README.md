# P0/P1/P2 工程化批次归档（2026-08-11 ~ 2026-08-12，关联版本 41.2.0）

> 本目录为 CHANGELOG.md [41.2.0] 条目的**工程化批次**完整清单归档（41.5.0 拆分）。
> 三个批次（P0/P1/P2）均**不涉及版本语义**，属纯工程化改造（重构 / 工具链 / 文档结构），
> 与版本功能变更（四源吸收 P2、版本号 bump）分离，CHANGELOG 只保留版本语义变更 + 本目录指针。
>
> **不参与门禁**：本目录仅文档记录，`check-docs-consistency` / pre-push 不读取（与
> `docs/changes/archive/` 同规范）。**41.3.0 之后的批次**（评审修正批次等）与版本语义一体，
> 不再拆分，直接在 CHANGELOG 对应版本条目内记录。

## 批次总览

| 批次 | 时间 | 主题 | 条目数（Changed） | 设计 spec |
|---|---|---|---|---|
| P0 | 2026-08-11 | scripts 四层重组 + check-artifact-gate 拆分 + CliError rule/field + README 重构 | 7 | `docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md` |
| P1 | 2026-08-11 | violations 双轨结构化 + 复杂逻辑注释 + 常量/类型集中 + security baseline 门禁 + --json 可观测性 + npm audit 阻断 + TypeDoc + 归档 INDEX + config 集中 + postinstall 钩子 + 协作模板 | 11 | 同上 |
| P2 | 2026-08-12 | loadAndValidate 统一 IO + 格式统一 + vitest 覆盖率入 pre-push + 用户文档 + Docsify 站点 + templates 扩充 + npm Workspace + examples 扩充 + 版本机制维持 | 9 | 同上 |

## P0（2026-08-11）

- `w-model-dev/scripts/` 四层重组：25 个 check-*.ts + 5 工具（self-test/security-scan/wm-status/metrics-report/ensure-codegraph-opsx）迁入 `cli/`；全部 *-logic.ts + schema-loader/plan-chunks 迁入 `logic/`；`lib/` 保持。同步全部跨层 import（含 __tests__ 29 处）、`.githooks/pre-push` 路径、`check-docs-consistency` 统计路径（数量 30 不变）、`package.json` scripts、100+ 文档引用（含 .cursor/skills、examples）
- `check-artifact-gate.ts` 拆分（486→249 行）：拆出 `lib/phase-doc-map.ts`、`cli/artifact-gate-assets.ts`、`cli/uat-path-mapping.ts`；`checkUatPathMappingContent` 保持 re-export 兼容 self-test（注：两模块已于 41.4.0 移入 `lib/`）
- `lib/cli-error.ts`：CliError 新增 `rule`/`field` 可选字段；`formatCliError` 附加 `[rule=...]` 段；`printErrorJson` 条件输出（向后兼容）；全仓 exitWithError 按已知规则 ID 补齐 P0-1/P0-2/P0-3（含 readJsonClassified 与动态 category 分支）
- README.md 重构：新增 Mermaid 架构图、W 模型 8 阶段×门禁对应表、5 步快速入门教程、阶段 4 典型场景（含真实 ERROR_JSON 示例）；项目结构树对齐四层布局；健康指标同步 35 files / 534 tests
- README/AGENTS 标注 `eval/` 目录为非技能包边界；README「相关文档」补齐 2 个缺失链接；AGENTS vitest 计数 530→534
- 新增 `.gitattributes`：shell 钩子（.githooks/*）强制 LF 行尾（Windows autocrlf 兼容）
- 文档一致性审查确认 SKILL.md/toolbox.md/dispatch-matrix.md 无逐字冗余、候选废弃文档均已含指针声明，A4/A5 无结构性改动

## P1（2026-08-11）

- A2b violations 双轨结构化：各 `*-logic.ts` 保留 `violations: string[]` 并新增可选 `structuredViolations?: Array<{rule; field?; message}>`；check-*.ts 人类可读输出与 `--json` 输出优先读结构化字段（`e13857b`、`0412166`）
- B1 复杂逻辑注释：`code-tla-logic.ts` 映射一致性四维度判定、`tla-bdd-sync-logic.ts` 状态机同步补设计依据/参考规则/边界处理块注释（`548bd7e`、`2179de2`）
- B2 常量与类型集中：新增 `lib/constants.ts`（RTM 追溯字段 / phase 枚举 / 门禁退出码 / 工件相对路径）与 `lib/types.ts`（校验输入输出类型），消除多文件重复定义（`da7b261`）
- B3 security baseline 维持：docs-consistency 新增「scripts/** 变更必须同步 `.eslintsecurity-baseline.json`」检查 + vitest 实测用例数门禁（`1f18931`、`d0bbf3a`）
- B4 `--json` 可观测性：25 个 check-*.ts 全部支持 `--json` 机器可读报告（类型/passed/reasons/违规类型分布/耗时 ms），复用 gate-report 扩展字段，默认人类可读输出不变（`f8c5328`、`5850c32`）
- B5 npm audit 阻断升级：pre-push 第 13 项由 warn-only 升级为阻断（exit 1），网络不可达/registry 不支持时跳过（`90970b2`、`e0b5685`、`4728fd6`）
- B6 TypeDoc API 文档：配置 TypeDoc 输出 `docs/api/`（`npm run docs:build`）；check-*.ts 头注释补 JSDoc（输入参数/输出结构/退出码/错误字段）（`1eee4fc`、`c4b862c`）
- B7 归档 INDEX.md：新增 `docs/changes/archive/INDEX.md`，为 5 个归档目录提供顶层导航 + 每轮一行摘要，链接各轮 README.md（`80f98de`）
- B8 config/ 配置集中：ESLint/TSConfig/Vitest 配置迁入 `config/`；security-scan 联动 `npx eslint --config config/.eslintrc.cjs`（`.eslintsecurity-baseline.json` 保持根目录）；package.json scripts 分组注释（`e4fde77`、`1adcb03`）
- B9 postinstall 钩子：新增跨平台 `postinstall` 自动配置 `core.hooksPath`（Node 实现，非 git 仓库/配置失败仅 warn 不阻断 install），免去手动 `npm run setup:hooks`；不引入 Husky（`5b9fda8`）
- B10 协作模板：新增 `.github/ISSUE_TEMPLATE/`（bug-report/feature-request）与 `.github/PULL_REQUEST_TEMPLATE.md`；CONTRIBUTING 增补 Conventional Commits 规范（type/scope/PR 标题格式/提交流程）（`ba73357`）

## P2（2026-08-12）

- C1 loadAndValidate 统一 IO：`lib/read-json-or-exit.ts` / `schema-loader.ts` 之上封装「读取 → JSON 解析 → schema 校验」复用方法（沿用 AJV，不引入 zod），哨兵错误区分调用方并补覆盖率（`6509420`、`c0512da`）
- C2 格式统一：ESLint `import/order` 规则 + Prettier 全仓格式化 + 新增 `.editorconfig`（缩进/换行/字符集），一次格式化后全量回归（`6138321`、`e48fb51`）
- C3 vitest 覆盖率入 pre-push：`config/vitest.config.ts` 配置 coverage 阈值（stmts 75 / branch 65 / funcs 85 / lines 75，仅统计 logic/ + lib/），pre-push 第 12 项升级为 `vitest run --coverage` 阈值门禁；docs-consistency vitest 计数收集改为按 config include 范围（修复嵌套 worktree 双倍计数误报）、docs:build 补 `--tsconfig`（`e4f463e`、`0351b50`、`3640cff`）
- C4 用户文档：新增 `docs/user-guide.md`（常见校验失败排查 + 规则依据 + 修复建议）与 `docs/troubleshooting.md`（FAQ + 环境问题），README 导航同步（`008559b`）
- C5 文档站点：新增 docsify 入口与侧边栏（docs/ + w-model-dev/references/ 渲染为可浏览 HTML 站点），package.json 新增 `docs:site` 本地预览命令（`a8b54e9`）
- C6 templates 扩充：补齐阶段 5-8 缺口——coding / integration-test / acceptance-test 3 份 Markdown 模板 + budget / run-log 2 份 JSON 工件模板（SKILL.md Bundled Resources 同步）（`2de4bd7`）
- C7 npm Workspace：仓库根 + `w-model-dev/` 双 workspace，分离开发依赖与技能包运行时依赖；新建的 `w-model-dev/package.json` 不声明 version，避免第四处版本破坏三地方程式（`88cbc4e`；**注：C7 决策已于 41.5.0 逆转移除 workspaces**）
- C8 examples 扩充：新增 stage 1/5/6/7/8 阶段编排示例（含可复用命令行），与既有 4 份示例覆盖 8 阶段完整编排流程（`fc11507`）
- C9 版本机制维持：维持现有人工三地方程式（根 package.json + SKILL.md frontmatter + skill-metadata.json），`skill-metadata.test.ts` 4 用例验证通过，未引入自动化版本发布；semantic-release 已剔除（spec §6 决策记录）；C9 无代码改动

## 批次内修复（Fixed）与文档同步（Docs）

- 恢复 A6 批量替换越界改写的历史归档（docs/superpowers、docs/changes、CHANGELOG.md 历史条目）
- 修正 usage 注释 / ARG_INVALID 错误消息 / references 相对链接中的旧平铺脚本路径（54 处源码 + 3 处文档）
- security baseline 重生成（A1 拆分新模块的 6 条文件移动所致 hash 失配）
- P0-P2 工程化批次合并后文档一致性同步（2026-08-12）：SSoT 新增 §3.4.42 第 42 轮 P0-P2 批次记录 + 修正 §10H.5 V1/V3 命令（`9ecc7b4`）；SKILL.md 修复 5 处 `scripts/` → `scripts/cli/` 旧路径链接（`e523123`）；INSTALL.md 结构树同步 cli/logic/lib、计数 530→558、devDeps 补充 eslint-plugin-import/prettier/typedoc/docsify-cli、workspaces 说明（`f4a4f8c`）；README 健康指标日期刷新 2026-08-12 + coverage 阈值行（`debac0f`）；AGENTS.md 确认无残留（P0-P2 批次中已同步）
