# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 41.0.0 之前的历史变更已归档至 [CHANGELOG-archive.md](./CHANGELOG-archive.md)。

## [41.4.0] - 2026-08-13

### Changed
- 版本号 41.3.1 → 41.4.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **cli/ 分层修正（评审 N1）**：`cli/artifact-gate-assets.ts` / `cli/uat-path-mapping.ts`（check-artifact-gate 拆出的 IO 解析模块）移入 `lib/`；`check-artifact-gate.ts` import/re-export 同步；exit-2 脚本计数 30 不变，`check-docs-consistency` 与 `docs-consistency-logic` 注释修正（5 工具 = 4 工具 CLI + `logic/plan-chunks.ts`，self-test.ts 非 exit-2 不计入）；SKILL.md Bundled Resources `scripts/cli/` 表述改为「30 个 .ts：25 个 check-* 门禁 + 5 个工具 CLI」
- **references 计数修正 + 门禁（评审 D1）**：SKILL.md「references/（53 个 .md）」→「（57 个 .md）」（第 44 轮新建 4 篇未同步）；`check-docs-consistency` 新增 **references-count 检查项**（`EXPECTED.referencesCount=57` + 实测 .md 数 + SKILL.md 表述三重比对，镜像 personaCount 模式）
- **TLA 轨迹清理工具跨层修正（评审 N2）**：`cleanTraceFiles` / `isTlcStatesDir` 自 `cli/check-tla-model.ts` 移入新建 `lib/tla-clean-trace.ts`（IO 辅助归 lib/，logic/ 保持纯函数约定）；`tla-clean-trace.test.ts` import 同步
- `dispatch-matrix.md` 数据来源行移除过时版本号 35.0.0（评审 D2），改为「随版本演进，以当前 SKILL.md 为准」
- AGENTS.md 角色表述澄清（评审 A4）：六类角色 = O（编排者）+ 五类子代理（A/S/V/G/R；R 含 R-iceberg 变体）
- AGENTS.md `docs/` 行声明 `docs/superpowers/` 为内部规划目录（评审 O3），不参与门禁、非面向用户
- 新建 `w-model-dev/tools/README.md`（评审 A6）：tla2tools.jar 版本（TLC2 2.19 of 08 August 2024）/ 来源 / license / 同步策略，权威记录指向 `references/tla-plus-guide.md`

### Docs
- SSoT 新增 §3.4.45 第 45 轮记录 + 追溯表行

## [41.3.1] - 2026-08-13

### Changed
- 版本号 41.3.0 → 41.3.1（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例；41.3.0 发布时 README 未同步导致漂移，本轮补齐并加门禁防再漂）
- `check-docs-consistency` 新增 **version-consistency 检查项**：`EXPECTED.currentVersion` + 五处版本声明全量比对（package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例），任一漂移或不可解析即 exit 1；`REQUIRED_PATHS` 增补 package.json / skill-metadata.json / docs/INSTALL.md；CONTRIBUTING「数字一致性」表述由「三处」更新为「五处」
- `skill-metadata.test.ts` 新增第 5 个用例：README / INSTALL.md 版本与 package.json 一致（五处镜像断言）
- 模板占位符统一：7 份阶段模板 SSOT 头「文档版本」由 `v{{1.0}}`（字面+部分占位）统一为 `{{v1.0}}`（全段占位，与元数据区 9 处既有风格一致）；`format-conventions.md` 新增 §7「模板占位符语法」规范（全段占位约定 + 固定占位符表 + 检查）
- docsify 离线降级：`docs/index.html` 新增 `<noscript>` 提示 + CDN `onerror` 兜底文案（离线/断网白屏时给出解释与本地预览指引）
- **SKILL.md 减负 524 → 216 行**：硬约束完整版 → 新建 `references/hard-constraints.md`；八条操作行为 + F1-F10 → 新建 `references/operation-behaviors.md`；自检清单 → 新建 `references/quick-self-check.md`；顶部 5 段方法论 → 新建 `references/design-philosophy.md`；Bundled Resources 四表压缩为目录级索引；阶段门/质量门说明压缩。`check-docs-consistency` 联动：`checkOperatingBehaviors` 改指针模式（防内联回退），新增 `checkHardConstraints`（## #1-## #14 编号连续性 + SKILL.md 指针）
- **硬约束 21 → 14 条重排**（第 44 轮）：#9 TLA+ 与 #14 BDD 合并为「#13 行为门禁按成熟度分级」；#20 codegraph 与 #21 回归合并为「#14 代码改动前后门禁」；#15/#16/#17/#18/#19 分别并入 #10/#2/#11/#3/#8。全仓活体文件 326+ 处「约束 #N」/「约束 N」引用同步重编号（归档 docs/superpowers、docs/changes、eval 历史记录不动）；`hard-constraints.md` 附「编号迁移表」
- **TLA+/BDD 成熟度开关**（约束 #13 可执行化）：L1 教学/demo 可选 / L2 生产小项目 TLA+ L1 + BDD L1 必跑 / L3 全必跑；编排层开关（非脚本参数，`--skip-tlc` 禁令维持）；`operational-recovery.md` 新增「成熟度与行为门禁」节
- **L0/L1 双交付层**：SKILL.md 顶部「交付层」说明 + INSTALL.md §2「交付层选择」表（L0 纯 Markdown 零依赖拷贝即用 / L1 带门禁需 `npm install`）
- `w-model-dev/test-prompts.json` 删除（14 条孤儿文件，无任何文档/脚本引用；评估场景以 `eval/w-model-dev-test-prompts.json` 15 条为准）
- `CHANGELOG.md` 拆分：41.0.0 之前（含 40.x 及更早）历史条目移入新建 `CHANGELOG-archive.md`（2169 行 → 80 行）
- anti-patterns.md 新增「反模式-硬约束映射」表（14 条硬约束 × 47 条反模式双向定位 + 高频标注）
- vitest 计数 558 → 571（新增 13 条单测），README / AGENTS.md / INSTALL.md / CONTRIBUTING.md / pre-push 同步

### Docs
- SSoT 新增 §3.4.44 第 44 轮记录 + 追溯表行

## [41.3.0] - 2026-08-13

### Changed
- 移除 `.cursor/skills/` 技能包资产残留引用（目录已在 e74b886 中删除，12097 行）：`check-docs-consistency` 门禁解耦——`REQUIRED_PATHS` 移除 `.cursor/skills`（此前缺失直接 exit 2 阻断每次推送）、`EXPECTED` 移除 `cursorSkillCount=23`、`checkAssetCounts` 单参数化（仅 persona）、目录计数删除；`.githooks/pre-push` 变更过滤移除 `.cursor/skills/**` 分支与触发条件注释；AGENTS.md 导航表 / README.md 结构树与 pre-push 注释清理；references 5 处死链修复（phase-5-coding 删除空「相关资源」节、phase-4-detailed-design / anti-patterns / subagent-delegation×2 去链接保留文字、verifier-spec 重定向到技能包内 agent-personas.md）
- 版本号 41.2.0 → 41.3.0（三处一致：package.json / skill-metadata.json / SKILL.md frontmatter；INSTALL.md 示例同步）
- `.gitignore` 追加 `.cursor/`（与 `.claude/` 同款，防误跟踪）

### Docs
- SSoT 新增 §3.4.43 第 43 轮记录 + 追溯表行

## [41.2.0] - 2026-08-10

### Added
- 四源吸收 P2（10 项）：subagent-persona-matrix 证据加权共识、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing 爬山法哲学基础、tla-plus 不连续系统穷举「为什么」、operational-recovery 集成混沌预期 + 超标重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准、SKILL.md 受控的失控 + clockware/swarmware 选择法则
- P0 工程化批次（2026-08-11，不涉及版本语义）：scripts 四层重组、check-artifact-gate 拆分、CliError rule/field、README 重构（详见 Changed/Fixed）
- P1 工程化批次（2026-08-11，不涉及版本语义）：violations 双轨结构化、复杂逻辑注释、常量/类型集中、security baseline 维持门禁、--json 可观测性、npm audit 阻断升级、TypeDoc API 文档、归档 INDEX、config/ 配置集中、postinstall 自动钩子、协作模板（详见 Changed）
- P2 工程化批次（2026-08-12，不涉及版本语义）：loadAndValidate 统一 IO 封装、格式统一（import/order + Prettier + editorconfig）、vitest 覆盖率入 pre-push、用户文档、Docsify 文档站点、templates 阶段 5-8 扩充、npm Workspace、examples 8 阶段扩充、版本机制维持（详见 Changed）

### Changed
- 版本号 41.1.0 → 41.2.0
- `w-model-dev/scripts/` 四层重组：25 个 check-*.ts + 5 工具（self-test/security-scan/wm-status/metrics-report/ensure-codegraph-opsx）迁入 `cli/`；全部 *-logic.ts + schema-loader/plan-chunks 迁入 `logic/`；`lib/` 保持。同步全部跨层 import（含 __tests__ 29 处）、`.githooks/pre-push` 路径、`check-docs-consistency` 统计路径（数量 30 不变）、`package.json` scripts、100+ 文档引用（含 .cursor/skills、examples）
- `check-artifact-gate.ts` 拆分（486→249 行）：拆出 `lib/phase-doc-map.ts`、`cli/artifact-gate-assets.ts`、`cli/uat-path-mapping.ts`；`checkUatPathMappingContent` 保持 re-export 兼容 self-test
- `lib/cli-error.ts`：CliError 新增 `rule`/`field` 可选字段；`formatCliError` 附加 `[rule=...]` 段；`printErrorJson` 条件输出（向后兼容）；全仓 exitWithError 按已知规则 ID 补齐 P0-1/P0-2/P0-3（含 readJsonClassified 与动态 category 分支）
- README.md 重构：新增 Mermaid 架构图、W 模型 8 阶段×门禁对应表、5 步快速入门教程、阶段 4 典型场景（含真实 ERROR_JSON 示例）；项目结构树对齐四层布局；健康指标同步 35 files / 534 tests
- README/AGENTS 标注 `eval/` 目录为非技能包边界；README「相关文档」补齐 2 个缺失链接；AGENTS vitest 计数 530→534
- 新增 `.gitattributes`：shell 钩子（.githooks/*）强制 LF 行尾（Windows autocrlf 兼容）
- 文档一致性审查确认 SKILL.md/toolbox.md/dispatch-matrix.md 无逐字冗余、候选废弃文档均已含指针声明，A4/A5 无结构性改动
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
- C1 loadAndValidate 统一 IO：`lib/read-json-or-exit.ts` / `schema-loader.ts` 之上封装「读取 → JSON 解析 → schema 校验」复用方法（沿用 AJV，不引入 zod），哨兵错误区分调用方并补覆盖率（`6509420`、`c0512da`）
- C2 格式统一：ESLint `import/order` 规则 + Prettier 全仓格式化 + 新增 `.editorconfig`（缩进/换行/字符集），一次格式化后全量回归（`6138321`、`e48fb51`）
- C3 vitest 覆盖率入 pre-push：`config/vitest.config.ts` 配置 coverage 阈值（stmts 75 / branch 65 / funcs 85 / lines 75，仅统计 logic/ + lib/），pre-push 第 12 项升级为 `vitest run --coverage` 阈值门禁；docs-consistency vitest 计数收集改为按 config include 范围（修复嵌套 worktree 双倍计数误报）、docs:build 补 `--tsconfig`（`e4f463e`、`0351b50`、`3640cff`）
- C4 用户文档：新增 `docs/user-guide.md`（常见校验失败排查 + 规则依据 + 修复建议）与 `docs/troubleshooting.md`（FAQ + 环境问题），README 导航同步（`008559b`）
- C5 文档站点：新增 docsify 入口与侧边栏（docs/ + w-model-dev/references/ 渲染为可浏览 HTML 站点），package.json 新增 `docs:site` 本地预览命令（`a8b54e9`）
- C6 templates 扩充：补齐阶段 5-8 缺口——coding / integration-test / acceptance-test 3 份 Markdown 模板 + budget / run-log 2 份 JSON 工件模板（SKILL.md Bundled Resources 同步）（`2de4bd7`）
- C7 npm Workspace：仓库根 + `w-model-dev/` 双 workspace，分离开发依赖与技能包运行时依赖；新建的 `w-model-dev/package.json` 不声明 version，避免第四处版本破坏三地方程式（`88cbc4e`）
- C8 examples 扩充：新增 stage 1/5/6/7/8 阶段编排示例（含可复用命令行），与既有 4 份示例覆盖 8 阶段完整编排流程（`fc11507`）
- C9 版本机制维持：维持现有人工三地方程式（根 package.json + SKILL.md frontmatter + skill-metadata.json），`skill-metadata.test.ts` 4 用例验证通过，未引入自动化版本发布；semantic-release 已剔除（spec §6 决策记录）；C9 无代码改动

### Fixed
- 恢复 A6 批量替换越界改写的历史归档（docs/superpowers、docs/changes、CHANGELOG.md 历史条目）
- 修正 usage 注释 / ARG_INVALID 错误消息 / references 相对链接中的旧平铺脚本路径（54 处源码 + 3 处文档）
- security baseline 重生成（A1 拆分新模块的 6 条文件移动所致 hash 失配）

### Docs
- P0-P2 工程化批次合并后文档一致性同步（2026-08-12，不涉及版本语义）：SSoT 新增 §3.4.42 第 42 轮 P0-P2 批次记录 + 修正 §10H.5 V1/V3 命令（`9ecc7b4`）；SKILL.md 修复 5 处 `scripts/` → `scripts/cli/` 旧路径链接（`e523123`）；INSTALL.md 结构树同步 cli/logic/lib、计数 530→558、devDeps 补充 eslint-plugin-import/prettier/typedoc/docsify-cli、workspaces 说明（`f4a4f8c`）；README 健康指标日期刷新 2026-08-12 + coverage 阈值行（`debac0f`）；AGENTS.md 确认无残留（P0-P2 批次中已同步）

## [41.1.0] - 2026-08-10

### Added
- 四源吸收 P1（10 项）：design-patterns-catalog.md（GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture/Security 评审问题、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness、security-review 认证授权传输维度、phase-6 补偿/故障注入测试

### Changed
- code-smells-checklist 补子类爆炸/继承破坏封装/Getter-Setter 浅方法
- 版本号 41.0.0 → 41.1.0

## [41.0.0] - 2026-08-10

### Added
- 四源吸收 P0（11 项）：code-smells-checklist 组 X 复杂度症状 + 设计判据条目（信息泄露/时间分解/过度专用/特殊情况爆炸/透传变量/实现文档污染接口/难以描述/难以取名/通用容器滥用/隐藏副作用/为拆而拆）、quality-standards 类设计规则补充（深度优先/多类症/组合拆分四信号/通用专用分离）+ 设计投资节、format-conventions 接口注释必备清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 信息隐藏/下沉复杂性/异常策略三选项、verifier-spec 三信息来源 + 复杂三症状 + 设计三项检查、class-design 模板「方案权衡」必填列
- 候选反模式登记：四源-α 复杂性增量累积 / 四源-β 模式装饰性引用 / 四源-γ 过度 swarm 化 / 四源-δ 纸面理由替代真实门禁（候选区，不正式编号）
- 新 reference：four-source-absorption.md（吸收决策记录，挂 Bundled Resources）

### Changed
- 版本号 40.2.0 → 41.0.0

