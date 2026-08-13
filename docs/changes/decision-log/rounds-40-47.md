# 轮次决策记录：第 40-47 轮（SSoT §3.4.40-47 原文归档）

> 自 SSoT 移出（41.7.0 全仓去历史化）：本文件为 SSoT §3.4.40-47 轮次记录原文，
> 对应 CHANGELOG.md [41.0.0] ~ [41.6.0] 条目。原文保留，不篡改。

#### 3.4.40 第 40 轮：三源吸收（Clean Code / Refactoring 2 / Agentic Design Patterns）

**目的**：补四类空白——代码内容规范、代码结构坏味道维度、测试代码自身质量、agentic 编排缺口（轨迹/简报质疑/协作评审/HOTL 授权）。

**P0（40.0.0，16 项）**：坏味道清单（chinese-code-review + code-smells-checklist）、编码规范（phase-5 六节）、质量规范（quality-standards 三小节）、TDD 四则、复现测试（root-cause-locator §2.5）、反模式 #47、命名约定（format-conventions §6）、agentic 4 项（run-log R8 / 简报质疑权 / R14-R17 / HOTL 授权）。

**P1（40.1.0，10 项）**：多评审分歧上缴人 / MCP 契约准则 / R3 来源校验 / MASS 三阶段 / 升级时效 / 修剪优先级 / 坏注释黑名单 / 类设计规则 / 对象数据结构 / 级联。（已落地，40.1.0）

**P2（40.2.0，9 项）**：concurrency-guide / refactoring-catalog（2 新 reference）/ 推理预算 / decisionConfidence 字段 / 最小权限 / 票据动态重排 / 错误分类 / persona 能力声明。（已落地，40.2.0）

**关键决策**：坏味道/并发检查双轨（语言静态工具 + LLM 语义评审，不新增 AST 脚本）；轨迹符合性校验（check-run-log R8）；吸收决策记录见 references/clean-code-refactoring-agentic-absorption.md。

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 不变 |
| 版本号 | 40.2.0（P2 批，三处一致） |

---

#### 3.4.41 第 41 轮：四源吸收（软件设计哲学 / 凤凰架构 / GoF 设计模式 / 失控）

**目的**：补四类空白——设计质量判据（深/浅模块、信息泄露、复杂三症状）、方案词汇表（设计模式目录）、架构决策框架（CAP/微服务粒度/容错/安全）、机制说理层（蜂群共识/元控制/约束创造）。

**P0（41.0.0，11 项）**：code-smells-checklist 组 X + 设计判据条目、quality-standards 类设计规则补充 + 设计投资、format-conventions 接口注释清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 设计自检、verifier-spec 评审提问、class-design 模板「方案权衡」列、候选反模式登记（四源-α/β/γ/δ）。

**P1（41.1.0，10 项）**：design-patterns-catalog（新建 reference，GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列（坏味道→手法→GoF 模式闭环）、code-smells 补子类爆炸/继承破坏封装/Getter-Setter 浅方法、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture 评审问题（8 类重新设计原因/Visitor 判据/交集并集/网关轻量）+ Security 评审（认证/授权/凭证/传输）、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness 术语、security-review 认证授权传输维度、phase-6 补偿/故障注入测试用例。

**P2（41.2.0，10 项）**：subagent-persona-matrix 证据加权共识（失控 ch2 蜜蜂决策）、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing-guide 爬山法哲学基础（变异-选择-累积循环）、tla-plus-guide 不连续系统穷举「为什么」段落、operational-recovery 集成初期混沌预期 + 超标模块重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准（日志/度量/追踪）、SKILL.md 受控的失控 + clockware/swarmware 选择法则。

**关键决策**：设计判据双轨（静态工具 + LLM 语义评审）；「方案权衡」为模板提示级不触发脚本；候选反模式不正式编号；说理层并入既有文档不新增哲学参考；吸收决策记录见 references/four-source-absorption.md。

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 不变 |
| 版本号 | 41.2.0（P2 批，三处一致） |

---

#### 3.4.42 第 42 轮：P0-P2 工程化批次（脚本分层重构 + 错误结构统一 + 可观测性 + 配置集中 + 工程化基础设施）

**目的**：完成 P0-P2 三批工程化修正（2026-08-11~12）——重构脚本分层（scripts/cli/logic/lib 四层）、错误结构统一（CliError rule/field + violations 双轨结构化）、可观测性（--json 机器可读 + npm audit 阻断 + TypeDoc）、配置集中（config/）、工程化基础设施（postinstall 钩子 / 协作模板 / npm workspaces / Docsify 站点 / 用户文档 / 覆盖率门禁）。

**P0（6 项，2026-08-11）**：A1 check-artifact-gate 拆分（486→249 行，拆出 `lib/phase-doc-map.ts` / `cli/artifact-gate-assets.ts` / `cli/uat-path-mapping.ts`，`checkUatPathMappingContent` 保持 re-export 兼容 self-test）+ 全仓脚本四层重组（25 个 check-*.ts 迁入 `cli/`、*-logic.ts 迁入 `logic/`，`lib/` 保持，同步跨层 import、`.githooks/pre-push` 路径、100+ 文档引用）；A2a CliError 新增 `rule`/`field` 可选字段（`lib/cli-error.ts`，`formatCliError` 附加 `[rule=...]` 段、`printErrorJson` 条件输出向后兼容，全仓 exitWithError 按已知规则 ID 补齐，exit 2 统一 ERROR_JSON）；A3 新增 `.gitattributes` 强制 shell 钩子（.githooks/*）LF 行尾（Windows autocrlf 兼容）；A4 AGENTS.md 同步（vitest 计数 530→534）+ README/AGENTS 标注 `eval/` 目录为非技能包边界；A5 security baseline 重生成（A1 拆分新模块 6 条文件移动所致 hash 失配）；A6 CHANGELOG 记录（[41.2.0] 条目 Added/Changed/Fixed）。

**P1（11 项，2026-08-11）**：A2b violations 双轨结构化（各 `*-logic.ts` 保留 `violations: string[]` 并新增可选 `structuredViolations?: Array<{rule; field?; message}>`，check-*.ts 人类可读与 `--json` 输出优先读结构化字段，试点 code-tla-logic + tla-bdd-sync-logic）；B1 复杂逻辑注释（`code-tla-logic.ts` 映射一致性四维度判定、`tla-bdd-sync-logic.ts` 状态机同步补设计依据/参考规则/边界处理块注释）；B2 常量与类型集中（新建 `lib/constants.ts`：RTM 追溯字段 / phase 枚举 / 门禁退出码 / 工件相对路径；`lib/types.ts`：校验输入输出类型，全仓复用消除多文件重复定义）；B3 docs-consistency 新增 baseline-sync 门禁（`scripts/**` 变更必须同步 `.eslintsecurity-baseline.json`）+ vitest 实测用例数门禁；B4 `--json` 可观测性（25 个 check-*.ts 全部支持 `--json` 机器可读报告，gate-report.ts 新增 printJsonReport/buildViolationDistribution，默认人类可读输出不变）；B5 npm audit 阻断升级（pre-push 第 13 项由 warn-only 升级为 high 以上阻断 exit 1，网络不可达/registry 不支持 audit 时跳过）；B6 TypeDoc API 文档（配置输出 `docs/api/`，`npm run docs:build`，docs/api/ 生成物入 .gitignore，check-*.ts 头注释补 JSDoc）；B7 新增 `docs/changes/archive/INDEX.md` 归档导航（5 个归档目录顶层导航 + 每轮一行摘要）；B8 配置集中（`.eslintrc.cjs` / `tsconfig.json` / `vitest.config.ts` / `.eslintignore` 迁入 `config/`，security-scan 改 `--no-eslintrc --config config/.eslintrc.cjs --ignore-path config/.eslintignore`，`.eslintsecurity-baseline.json` 留根目录，package.json scripts 分组注释）；B9 postinstall 钩子（`scripts/setup-hooks.cjs` 跨平台 Node 实现自动配置 `core.hooksPath`，非 git 仓库/配置失败仅 warn 不阻断 install，不引入 Husky）；B10 协作模板（`.github/ISSUE_TEMPLATE/` bug-report/feature-request + `.github/PULL_REQUEST_TEMPLATE.md`，CONTRIBUTING 增补 Conventional Commits 规范）。

**P2（9 项，2026-08-12）**：C1 loadAndValidate 统一 IO（`lib/load-and-validate.ts` 在 `read-json-or-exit.ts` / `schema-loader.ts` 之上封装「读取→JSON 解析→schema 校验」复用方法，复用 schema-loader 单例，哨兵错误区分调用方并补覆盖率，沿用 AJV 不引入 zod）；C2 格式统一（ESLint `import/order` 规则 + Prettier 全仓格式化 + 新增 `.editorconfig`，import/order 存量 108→0，一次格式化后全量回归）；C3 vitest 覆盖率入 pre-push（`config/vitest.config.ts` 配置 v8 阈值 stmts 75 / branch 65 / funcs 85 / lines 75，仅统计 `logic/` + `lib/`，pre-push 第 12 项升级为 `vitest run --coverage` 阈值门禁，docs-consistency vitest 计数收集改为按 config include 范围）；C4 用户文档（新增 `docs/user-guide.md` 常见校验失败排查 + `docs/troubleshooting.md` FAQ，README 导航同步）；C5 Docsify 文档站点（`docs/index.html` + `_sidebar.md`，docs/ + w-model-dev/references/ 渲染为可浏览 HTML 站点，package.json 新增 `docs:site` 本地预览）；C6 templates 扩充（补齐阶段 5-8 缺口：coding / integration-test / acceptance-test 3 份 Markdown 模板 + budget / run-log 2 份 JSON 工件模板，SKILL.md Bundled Resources 同步）；C7 npm workspaces（仓库根 + `w-model-dev/` 双 workspace 分离开发依赖与技能包运行时依赖，新建 `w-model-dev/package.json` 不声明 version 避免第四处版本破坏三地方程式，createRequire typescript 解析验证）；C8 examples 扩充（新增 stage 1/5/6/7/8 阶段编排示例含可复用命令行，与既有 4 份覆盖 8 阶段完整编排流程 + 编排导览 README）；C9 版本机制维持（维持人工三地方程式：根 package.json + SKILL.md frontmatter + skill-metadata.json，`skill-metadata.test.ts` 4 用例验证通过，不引入 semantic-release，spec §6 决策记录；C9 无代码改动）。

**关键决策**：错误结构统一扩展采用双轨过渡（structuredViolations 可选字段，历史违规点保持 `string[]` 不动，向后兼容）；`--json` 机器可读输出全量铺开（默认人类可读不变）；config/ 配置集中 + security-scan 显式 `--config` 联动（`--no-eslintrc` 防 worktree 级联污染）；npm audit 阻断 fail-closed（网络不可达/registry 不支持跳过）；npm workspaces 子包不声明 version（防第四处 version 破坏三地方程式）；版本机制维持人工三地方程式（不引入 semantic-release）；设计 spec：docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md。

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 不变 |
| vitest | 35 files / 558 tests |
| 版本号 | 41.2.0（维持，批次不涉及版本语义，三处一致） |

---

#### 3.4.43 第 43 轮：移除 .cursor 技能包（仓库级资产清理 + docs-consistency 门禁解耦）

**目的**：完成 `.cursor/skills/` 技能包（23 个 Cursor 适配技能，已在 e74b886 中删除，12097 行）的残留引用清理——`check-docs-consistency` 门禁因 `REQUIRED_PATHS` 硬编码 `.cursor/skills` 缺失而每次推送必失败（exit 2），本轮将门禁与已删除资产解耦并同步全部活动文档（2026-08-13）。

**变更（2026-08-13）**：C1 docs-consistency 门禁解耦——`check-docs-consistency.ts` REQUIRED_PATHS 移除 `.cursor/skills`、目录计数删除、input 组装与日志同步；`docs-consistency-logic.ts` EXPECTED 移除 `cursorSkillCount=23`、`DocConsistencyInput` 移除字段、`checkAssetCounts` 单参数化（仅 persona）；`docs-consistency-logic.test.ts` 同步（vitest 总数 558 不变）；C2 `.githooks/pre-push` 变更过滤移除 `.cursor/skills/**` case 分支与触发条件注释；C3 活动文档清理——AGENTS.md 导航表行、README.md 结构树行与 pre-push 注释、references 5 处死链（phase-5-coding 删除空「相关资源」节 / phase-4-detailed-design 去链接保文字 / verifier-spec 重定向 agent-personas.md / anti-patterns 去链接 / subagent-delegation 两处去链接）；C4 `.gitignore` 追加 `.cursor/`（与 `.claude/` 同款）；C5 版本号 41.2.0 → 41.3.0（三处一致：package.json / skill-metadata.json / SKILL.md frontmatter）+ CHANGELOG [41.3.0] 段。

**关键决策**：references 死链统一「保留文字、去除链接标记」（引用的方法论描述仍有价值）；verifier-spec 代码审查员提示重定向到技能包内 `agent-personas.md`（等价物）；历史记录（CHANGELOG 旧条目 / SSoT §3.4.31/39/41/42 / docs/superpowers 归档）保留不动。

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 不变 |
| vitest | 35 files / 558 tests |
| 版本号 | 41.3.0（三处一致） |

---

#### 3.4.44 第 44 轮：评审修正批次（版本号门禁 + SKILL.md 减负 + 约束重排 + 交付层分层）

**目的**：落实外部评审（2026-08-13）指认的 3 个 P0 bug（版本号漂移 / 模板占位符双写法 / docsify CDN 离线白屏）与 P1/P2 建议（SKILL.md 过重 / 约束数量过多 / TLA+/BDD 强制门槛 / L0/L1 交付分层）（2026-08-13）。

**变更（2026-08-13，41.3.1）**：

- **P0-1 版本号五处一致性门禁**：修复 41.3.0 发布时 README 未同步的漂移（README `41.2.0` vs 其余三处 `41.3.0`，且实际存在第 5 处声明 `docs/INSTALL.md:135`）；`docs-consistency-logic.ts` 新增 `checkVersionConsistency()`（`EXPECTED.currentVersion` + package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / INSTALL.md 激活示例五处全量比对，任一漂移或不可解析即违规）；`REQUIRED_PATHS` 增补三文件；`skill-metadata.test.ts` 新增第 5 用例；CONTRIBUTING「数字一致性」由「三处」更新为「五处」。
- **P0-2 模板占位符统一**：7 份阶段模板 SSOT 头「文档版本」由 `v{{1.0}}`（字面+部分占位）统一为 `{{v1.0}}`（全段占位，与元数据区一致）；`format-conventions.md` 新增 §7「模板占位符语法」规范。
- **P0-3 docsify 离线降级**：`docs/index.html` 新增 `<noscript>` 提示 + CDN `onerror` 兜底文案。
- **P1-1 SKILL.md 减负 524 → 216 行**：硬约束完整版 → 新建 `references/hard-constraints.md`（14 条 + 编号迁移表）；八条操作行为 + F1-F10 → 新建 `references/operation-behaviors.md`；自检清单 → 新建 `references/quick-self-check.md`；Bundled Resources 四表压缩为目录级索引（指向 dispatch-matrix / command-reference）；阶段门/质量门说明压缩。`docs-consistency-logic.ts` 联动：`checkOperatingBehaviors` 改为指针模式（SKILL.md 含指针 + operation-behaviors.md 含完整表 + 防内联回退），新增 `checkHardConstraints`（hard-constraints.md `## #1`-`## #14` 编号连续性 + SKILL.md 指针）。
- **P1-2 硬约束 21 → 14 条重排**：#9 TLA+ 与 #14 BDD 合并为「#13 行为门禁按成熟度分级」；#20 codegraph 与 #21 回归合并为「#14 代码改动前后门禁」；#15/#16/#17/#18/#19 分别并入 #10/#2/#11/#3/#8。全仓活体文件（SKILL.md / references / schemas / scripts / 模板 / AGENTS / SSoT）326+ 处「约束 #N」与「约束 N」引用同步重编号（归档 docs/superpowers、docs/changes、eval 历史记录不动）；hard-constraints.md 附「编号迁移表」。
- **P1-3 TLA+/BDD 成熟度开关**（约束 #13 可执行化）：L1 教学/demo → 可选；L2 生产小项目 → TLA+ L1 + BDD L1 必跑；L3 → 全必跑。编排层开关（非脚本参数，`--skip-tlc` 禁令维持）；`operational-recovery.md` 新增「成熟度与行为门禁」节。
- **P1-4 L0/L1 双交付层**：SKILL.md 顶部「交付层」说明 + INSTALL.md §2「交付层选择」表（L0 纯 Markdown 零依赖 / L1 带门禁需 npm install）。
- **P1-5/P2**：删除无引用的孤儿文件 `w-model-dev/test-prompts.json`（评估场景以 `eval/` 15 条为准）；CHANGELOG 拆分（41.0.0 之前 2089 行移入新建 `CHANGELOG-archive.md`）；SKILL.md 顶部 5 段方法论 → 新建 `references/design-philosophy.md`；vitest 计数 558 → 571 文档同步。

**关键决策**：① 版本门禁 fail-loud（任一来源不可解析即违规，不静默放行）；② 行为门禁开关放编排层而非脚本参数（避免重蹈 `--skip-tlc` 削弱门禁覆辙）；③ 约束重排不触碰归档（docs/superpowers、docs/changes、eval、CHANGELOG-archive 保留历史编号）；④ `w-model-dev/package.json` 维持不声明 version（C7 决策不变，评审建议不采纳）。【注：决策 ④ 已于 41.5.0 §3.4.46 O1 逆转移除 workspaces 并删除 `w-model-dev/package.json`，本条为历史记录。】

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 不变 |
| vitest | 35 files / 571 tests |
| 版本号 | 41.3.1（五处一致：package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL.md） |

---

#### 3.4.45 第 45 轮：外部评审报告核实修正批次（cli/lib 分层 + 文档-实际数据自洽 + 计数门禁）

**目的**：落实外部评审报告（2026-08-13，沙箱静态阅读版）中经三路 Explore 核实为属实的问题——cli/ 目录命名/分层残留（N1）、references 计数漂移（D1）、dispatch-matrix 过时版本号（D2）、测试跨层导入 cli IO 函数（N2）、AGENTS 角色表述（A4）、docs/superpowers 未声明（O3）、tla2tools.jar 无本地声明（A6）；报告中的 D3（SSoT 558 为历史轮次记录，非残留，不改）、A1（SSoT 按轮次记录是设计，不改）、T4（两套测试体系定位不同，不合并）经核实为误判/低价值，不采纳（2026-08-13，41.4.0）。

**变更（2026-08-13，41.4.0）**：

- **N1 cli/ 分层修正**：`cli/artifact-gate-assets.ts` / `cli/uat-path-mapping.ts`（check-artifact-gate 拆出的 IO 解析模块，仅被其 import）移入 `lib/`；`check-artifact-gate.ts` import ×2 + re-export + 头部注释同步；exit-2 脚本计数 30 不变（实测构成：25 check-* + 4 工具 CLI + `logic/plan-chunks.ts`；self-test.ts 非 exit-2），`check-docs-consistency.ts` / `docs-consistency-logic.ts` 注释修正；SKILL.md Bundled Resources `scripts/cli/` 表述由「30 个 exit-2 脚本」改为「30 个 .ts：25 个 check-* 门禁 + 5 个工具 CLI」。
- **D1 references 计数自洽 + 门禁**：SKILL.md「references/（53 个 .md）」→「（57 个 .md）」（第 44 轮新建 4 篇漏同步）；`docs-consistency-logic.ts` 新增 `checkReferencesCount`（`EXPECTED.referencesCount=57` + 实测 references/*.md 数 + SKILL.md 表述三重比对，镜像 `checkAssetCounts`/personaCount 模式）；CLI 层 readdirSync 计数；`docs-consistency-logic.test.ts` 扩展（vitest 计数 571 不变）。
- **N2 TLA 轨迹清理跨层修正**：`cleanTraceFiles` / `isTlcStatesDir` 自 `cli/check-tla-model.ts` 移入新建 `lib/tla-clean-trace.ts`（IO 辅助归 lib/ 层，logic/ 保持纯函数约定——评审建议的「logic/ + 注入式 IO 适配器」无先例，不采纳）；`tla-clean-trace.test.ts` import 同步。
- **D2**：`dispatch-matrix.md` 数据来源行移除过时版本号 35.0.0，改为「随版本演进，以当前 SKILL.md 为准」。
- **A4**：AGENTS.md 角色表述澄清——六类角色 = O（编排者）+ 五类子代理（A/S/V/G/R；R 含 R-iceberg 变体）。
- **O3**：AGENTS.md `docs/` 行声明 `docs/superpowers/`（plans/ + specs/）为内部规划目录，不参与门禁、非面向用户。
- **A6**：新建 `w-model-dev/tools/README.md`（tla2tools.jar 版本 TLC2 2.19 of 08 August 2024 / 来源 / BSD-2-Clause / 手动同步策略；权威记录指向 tla-plus-guide.md「工具链」节——评审报告漏查该处已有版本声明）。

**关键决策**：① 计数门禁镜像既有 `checkAssetCounts` 模式（实测数 + EXPECTED + 文档表述三重比对，fail-loud），references/*.md 新增时强制同步 SKILL.md 与 EXPECTED；② 历史记录（SSoT §3.4.42/43 的 558、CHANGELOG 41.2.0 的 cli/ 路径）一律不动，不篡改演进史；③ N2 归属 lib/ 而非 logic/——`__tests__/README.md` 的纯函数约定只约束 `*-logic.ts`，lib/ 已有 read-json-or-exit 等 IO 辅助先例；④ 测试扩展并入既有用例，vitest 计数 571 保持稳定（避免 README/AGENTS/pre-push 三处计数文档涟漪）。

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 不变 |
| vitest | 35 files / 571 tests |
| 版本号 | 41.4.0（五处一致：package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL.md） |

---

#### 3.4.46 第 46 轮：samples 覆盖门禁 + 真实证据示例 + 去重/批次/workspaces 收尾（T1/T2/A2/A5/O1 五项落地）

**目的**：落实外部评审报告顺延项（41.4.0 轮未做）——T1 samples 覆盖矩阵门禁、T2 examples 真实命令证据、A2 Markdown 去重（收敛版）、A5 CHANGELOG 批次拆分、O1 workspaces 决策（2026-08-13，41.5.0）。

**变更（2026-08-13，41.5.0）**：

- **T1 samples 覆盖矩阵门禁**：新建 `scripts/cli/check-samples-coverage.ts`——扫描 `samples/` 全树（排除 .w-model 运行时产物 / states / README / 隐藏文件），按行号区间解析 self-test.ts 的 run 函数（`for (const v of X_CASES)` ↔ `path.join(samplesDir, '<dir>', ...)` 配对 + 两参 join 目录变量 + 循环变量非 c + manifestFile 字段四类兼容形态）与用例数组（file / sampleDir / manifestFile / featureFiles 字段），核对每个 fixture 被引用 + 每个子目录在 `samples/README.md` 矩阵声明；tla-e2e 豁免（手动/CI 端到端 fixture，README 声明兜底）。新建成 `samples/README.md` 覆盖矩阵（26 子目录 × check 脚本 × 用例数组 × 嵌套说明 + 新增 fixture 四步流程）；pre-push 新增第 15 项（`prePushCount` 14→15，EXPECTED / pre-push 注释「15 项检查」/ README / AGENTS 同步）。
- **T1 首跑发现并处置 5 个孤儿 fixture**：`samples/` 5 个全仓零引用文件——登记 3 个有效样本（gate/bad-phase5-codemodule-format → GATE_CASES phaseOption=5 codeModule 格式校验；tla/bad-coverage-uncovered-sd → TLA_CASES SD 覆盖完整性；bdd/bad-d8-uncovered-sd → BDD_CASES D8，featureFiles=[] 空数组）；删除 2 个「名字与实际行为不符」伪样本（valid-phase5-with-uat-path-mapping 任何 phase 均 failed、bad-phase5-missing-uat-path-mapping 纯逻辑 passed=true，均由真实逻辑探针验证）。self-test 基线 249→252；exit-2 脚本计数 30→31（新增 check-samples-coverage，26 check-* + 4 工具 CLI + logic/plan-chunks.ts）。
- **T2 真实证据示例**：新建 `examples/real-run-evidence.md`（唯一真实证据：5 命令 × exit 0/1/2 三态真实输出实录 + 使用约定）；4 份对话文件（coding / requirement-analysis / system-design / test-execution）头部标注「伪示例，仅供 LLM 行为对齐」+ 虚构数字改「以真实运行器为准」+ coding.md 删除 `echo > .env`（反模式 #25 冲突）改环境变量注入两方式 + test-execution.md 质量门语义修正（GATE_JSON 补 exitCode 字段）；examples/README.md 文件清单表补 real-run-evidence 行并区分「真实证据 / 伪示例 / 编排示例」三类。
- **A2 Markdown 去重（收敛版）**：实测文本级复制仅 3 处（原报告 8h 估计基于泛泛判断）——AGENTS.md §6「编排者最小化」与 §1 双份 → 一句 + 指针；INSTALL.md 安装引导段角色描述（:88）与 §1/FAQ 重复 → 指针化；SKILL.md 内联 14 行硬约束摘要表**保留**（编排入口速查价值 + :57 已有指针，第 44 轮刻意设计；`checkHardConstraints` 只要求指针字串）。b/e/f 主题（CHECKPOINT / 角色表 / 反模式列表）实测已是健康分层指针结构，无需动。
- **A5 CHANGELOG 批次拆分**：41.2.0 的 P0/P1/P2 工程化批次（27 项 Changed + 3 修复 + 1 文档同步，显式标注「不涉及版本语义」）移入新建 `docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md`（批次总览表 + 三批逐项清单 + 批次内修复/文档同步）；CHANGELOG [41.2.0] 精简为四源吸收 P2 + 版本 bump + 批次指针；清理 `docs/changes/` 空目录（2026-07-28-round20-phase1-4dim-identification/）；批次 README 声明「41.3.0 之后批次与评审修正一体不拆」。
- **O1 移除 npm workspaces（C7 决策逆转）**：删除根 package.json `workspaces: ["w-model-dev"]` + `w-model-dev/package.json`。逆转理由：① 子包零依赖（devDeps 全在根包）、② 全仓零 `w-model-dev` 包名 import/require（脚本全走显式相对路径）、③ createRequire('typescript')（2 处）/ vitest / tsconfig / typedoc / eslint / pre-push 均不依赖 workspace 解析（Node 向上查找根 node_modules 两种模式等价）、④ 空包无实际作用且造成「npm workspaces」心智负担；INSTALL.md FAQ 改为单根包表述。package-lock.json 由 npm install 重装重写。

**关键决策**：① 门禁提取用「行号区间切块」而非正则前瞻（避免 run 函数块误吞），目录型用例（sampleDir）覆盖子树、bdd .feature 由 featureFiles 字段显式登记（manifest 虚引用不产生文件级覆盖要求）；② 孤儿 fixture 处置三原则——有效样本登记进 self-test.ts（校验规则回归保护）、伪样本删除（名字与行为不符且零引用）、tla-e2e 豁免（端到端手动 fixture，README 声明兜底）；③ 计数联动走既有「EXPECTED + 锚文本」门禁机制（prePushCount 15 / exit2ScriptCount 31 / self-test 252，vitest 571 保持稳定）；④ A2 收敛不采纳原报告 8h 全量重构（实测复制少、门禁红线锚文本集中在少数字面量）；⑤ O1 逆转 C7 需在轮次记录中显式声明（41.3.1 曾重申 C7，本轮回转有据）。

| 维度 | 内容 |
|---|---|
| self-test | 基线 249 → 252（登记 3 条孤儿样本） |
| vitest | 35 files / 571 tests |
| 版本号 | 41.5.0（五处一致：package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL.md） |

---

### 3.4.47 第 47 轮：SSoT 权威性审查修复（41.4.0/41.5.0 两轮变更后的一致性核验）

**目的**：41.4.0/41.5.0 两轮大改后（cli/lib 移动、workspaces 移除、计数联动、新门禁/示例/归档），对 SSoT 是否仍能承担「单一事实来源」做全面审查——三路 Explore 并行扫描数字计数 / 路径结构 / 结构健康度三个维度（2026-08-13，41.6.0）。

**审查结论**：SSoT 核心职能**仍成立**——① 数字全部一致（版本 41.5.0 / exit-2 31 / pre-push 15 / self-test 252 / vitest 571 / references 57 / schema 20 / persona 28 / 反模式 47 / 约束 14，当前状态声明零漂移）；② 路径引用零死链（68 个相对链接全部有效）；③ cli/artifact-gate-assets 与 workspaces 等旧引用仅存于历史轮次记录（§3.4.42/44/45，按「不篡改演进史」设计保留）。**无需重写**；但发现 6 处实质缺陷，本轮止血修复。

**变更（2026-08-13，41.6.0）**：

- **F1 修 SSoT 内部互斥（TLA+ 门槛）**：§3.4.3 阶段门（原「阶段 4 TLA+ 零违反…才放行」绝对式）与 §3.4.6 P1.2（原「TLA+ SD 覆盖率全规格强制（无例外）」）为第 44 轮 P1-3 之前的旧规则，与最新决策（L1 教学/demo 可选 / L2 必跑 / L3 全必跑，约束 #13 成熟度开关）互斥。修复：§3.4.3 补分级说明段（含编排层开关位置与 `--skip-tlc` 禁令维持），P1.2 标题改「按成熟度分级（第 44 轮起）」+ L1 豁免条款。读者读当前章节即可得最新规则，无需回溯轮次。
- **F2 修活体指针**：AGENTS.md:21「错误结构」指针原仅指 §3.4.30（第 32 轮全量归一化），但当前定义含 §3.4.42 A2a/A2b（CliError rule/field + violations 双轨）——补为「§3.4.30（全量归一化）+ §3.4.42（CliError rule/field 扩展，当前定义）」。
- **F3 修 §10A 追溯表**：① 补缺 §3.4.42 行（CHANGELOG [41.2.0]「Docs」声称「SSoT 新增 §3.4.42 轮记录 + 追溯表行」而表中缺失——41.5.0 A5 把批次移入 engineering-batches 时漏掉表行）；② 修复 §3.4.36/37/38 三行残缺（仅 2 列破坏 4 列表格结构，自对应轮次记录提取设计内容/实现位置/一致性补全）。
- **F4 修标题层级**：§3.4.40-46 标题为 `###`（h3）与 §3.4.7-39 轮次记录的 `####`（h4）混排——统一为 `####`，恢复「§3.4 下当前定义 h3 / 轮次记录 h4」的层级纪律。
- **F5 双副本权威声明**：SSoT §4A.1（八条操作行为全表）与 §10.6（DoD 七维度全表）是 references/operation-behaviors.md / definition-of-done.md 的全量副本且门禁分别锚定两处、无对等校验——本轮在表头标注「权威源 + 摘要副本」声明（改行为/维度须先改权威源并同步），降低双权威语义；§7 数据模型补「结构权威 = data-models.md」声明（C6）。
- **F6 历史决策逆转指针**：§3.4.44 关键决策④（C7「维持不声明 version」重申）追加「【注：已于 41.5.0 §3.4.46 O1 逆转移除 workspaces 并删除 w-model-dev/package.json，本条为历史记录】」——防读者把已被逆转的决策当现行规则（§3.4.44 的「重申」曾证明人工纪律会失效）。
- **F7 samples/README.md 基线同步**：头部「249 条回归基线」→「252 条」（41.5.0 轮新建 README 时未同步 self-test 基线，SSoT §3.4.46 已记录 249→252）。

**关键决策**：① 审查方法论——「历史轮次记录保留」与「当前状态声明必须最新」双原则判定每一项发现（不篡改演进史，但当前章节必须与最新轮次一致）；② 止血优先于重写——SSoT 可修复缺陷（互斥 2 处 / 指针 1 处 / 追溯表 2 处 / 层级 7 处 / 声明 3 处），未达「权威定义整体失效」阈值；轮次区拆分（方案 b）与全量重写（方案 c）评估后留作后续（改动量中/高、门禁锚文本与 29 处外部指针牵连、信息丢失风险）；③ 双副本采用「声明式指针」而非删除副本（门禁锚文本 `### 4A.1 八条核心操作行为` / `| **签名链完整性** |` / `DOD_SSOT_TRACE` 字符串分别锚定 SSoT §4A.1/§10.6/§10A，删表即违规）。

| 维度 | 内容 |
|---|---|
| self-test | 基线 252 不变 |
| vitest | 35 files / 571 tests |
| 版本号 | 41.6.0（五处一致：package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL.md） |

## 附录 A：§10A 追溯表轮次行（§3.4.40-47，原文）

> 自 SSoT §10A 移出（41.7.0）：轮次→落地文件的追溯映射，随轮次记录归档。

| 3.4.40 第 40 轮三源吸收（P0） | 坏味道清单 / 编码规范 / 测试规范 / agentic 4 项 / 反模式 #47 | `w-model-dev/references/code-smells-checklist.md` + phase-5/quality-standards/verifier-spec/operational-recovery 等新增节 + `check-run-log.ts` R8 + `anti-patterns.md` #47 | 已落地（40.0.0） |
| 3.4.40 第 40 轮三源吸收（P1） | 多评审分歧上缴人 / MCP 契约准则 / R3 来源校验 / MASS 三阶段 / 升级时效 / 修剪优先级 / 坏注释黑名单 / 类设计规则 / 对象数据结构 | `w-model-dev/references/subagent-persona-matrix.md` + mcp-builder / verifier-spec / hill-climbing-guide / operational-recovery / context-management-guide / format-conventions / quality-standards + phase-4 / chinese-code-review + phase-4 | 已落地（40.1.0） |
| 3.4.40 第 40 轮三源吸收（P2） | concurrency-guide / refactoring-catalog / 推理预算 / decisionConfidence 字段 / 最小权限 / 票据动态重排 / 错误分类 / persona 能力声明 / 级联（9 项） | `w-model-dev/references/concurrency-guide.md` + `refactoring-catalog.md` + estimation-guide / run-log.schema.json+data-models+run-log-logic / verifier-spec / phase-5 / operational-recovery / subagent-persona-matrix 新增节 | 已落地（40.2.0） |
| 3.4.41 第 41 轮四源吸收（P0） | 组 X 复杂度症状 / 设计判据条目 / 类设计规则补充 / 设计投资 / 接口注释清单 / 命名一致性三要求 / 备选方案对比 / 方案权衡列 / 候选反模式登记 | code-smells-checklist + quality-standards + format-conventions + phase-3/4 + verifier-spec + class-design 模板 + anti-patterns | 已落地（41.0.0） |
| 3.4.41 第 41 轮四源吸收（P1） | design-patterns-catalog / 重构目标结构列 / code-smells 三坏味道 / phase-2 决策框架 / quality-standards 容错日志 / verifier-spec 双轴评审 / tla-plus 场景库 / security-review 维度 / phase-6 补偿故障注入 | `design-patterns-catalog.md` + refactoring-catalog + code-smells-checklist + phase-2 + quality-standards + verifier-spec + tla-plus-guide + security-review + phase-6 | 已落地（41.1.0） |
| 3.4.41 第 41 轮四源吸收（P2） | 证据加权共识 / 验证器定位三原则 / 候选转正评审 + 错误聚集超标丢弃 / 爬山法哲学基础 / 不连续系统穷举 / 混沌预期 + 超标重写 / 约束创造 + 满意化完成 / 可观测性验收 / 受控失控 + clockware-swarmware | subagent-persona-matrix + verifier-spec + anti-patterns + hill-climbing-guide + tla-plus-guide + operational-recovery + quality-standards + phase-7 + SKILL.md | 已落地（41.2.0） |
| 3.4.42 第 42 轮 P0-P2 工程化批次 | scripts 四层重组（cli/logic/lib）/ check-artifact-gate 拆分（phase-doc-map + artifact-gate-assets + uat-path-mapping）/ CliError rule/field + violations 双轨 / --json 可观测性 / config 集中 / vitest 覆盖率入 pre-push / npm Workspace（C7 引入，已于 41.5.0 §3.4.46 O1 逆转移除） | 25 个 check-*.ts + 5 工具迁入 `cli/`、*-logic.ts 迁入 `logic/`、`lib/` 保持 + 新建 `config/` + `.githooks/pre-push` 第 13 项升级 + 新建 `w-model-dev/package.json`（41.5.0 已删） | 已落地（41.2.0）；批次详情见 `docs/changes/engineering-batches/2026-08-11-p0-p2-batches/` |
| 3.4.43 第 43 轮移除 .cursor 技能包 | docs-consistency 门禁解耦（REQUIRED_PATHS / EXPECTED / checkAssetCounts）/ pre-push 过滤清理 / 活动文档与 5 处死链同步 / .gitignore 追加 .cursor / 版本号三处 41.3.0 | `check-docs-consistency.ts` + `docs-consistency-logic.ts` + `docs-consistency-logic.test.ts` + `.githooks/pre-push` + AGENTS.md + README.md + references 5 处 + `.gitignore` + package.json / skill-metadata.json / SKILL.md / INSTALL.md | 已落地（41.3.0） |
| 3.4.44 第 44 轮评审修正批次 | 版本号五处一致性门禁（version-consistency）/ 模板占位符统一（{{v1.0}}）/ docsify noscript 降级 / SKILL.md 减负 524→216（hard-constraints + operation-behaviors + quick-self-check + design-philosophy）/ 硬约束 21→14 重排（全仓引用同步）/ TLA+/BDD 成熟度开关（L1/L2/L3）/ L0/L1 双交付层 / 孤儿 test-prompts.json 删除 / CHANGELOG 拆分 | `check-docs-consistency.ts` + `docs-consistency-logic.ts` + `docs-consistency-logic.test.ts` + `skill-metadata.test.ts` + SKILL.md + 7 模板 + format-conventions + operational-recovery + 新建 references×4 + INSTALL.md + README.md + AGENTS.md + CONTRIBUTING.md + docs/index.html + 32 处约束引用文件 + CHANGELOG.md + CHANGELOG-archive.md + SSoT | 已落地（41.3.1） |
| 3.4.45 第 45 轮外部评审核实修正批次 | cli/ 两 IO 模块移入 lib/（artifact-gate-assets + uat-path-mapping，exit-2 注释修正）/ SKILL.md references 53→57 + 新增 references-count 门禁（EXPECTED.referencesCount=57）/ cleanTraceFiles+isTlcStatesDir 移入新建 lib/tla-clean-trace.ts / dispatch-matrix 过时版本号移除 / AGENTS 角色表述（O+五子代理+R-iceberg）/ docs/superpowers 内部目录声明 / tools/README.md（tla2tools.jar 声明） | `check-artifact-gate.ts` + 新建 `lib/artifact-gate-assets.ts` + `lib/uat-path-mapping.ts` + `check-docs-consistency.ts` + `docs-consistency-logic.ts` + `docs-consistency-logic.test.ts` + 新建 `lib/tla-clean-trace.ts` + `check-tla-model.ts` + `tla-clean-trace.test.ts` + SKILL.md + dispatch-matrix.md + AGENTS.md + 新建 tools/README.md + package.json / skill-metadata.json / README.md / INSTALL.md + CHANGELOG.md + SSoT | 已落地（41.4.0） |
| 3.4.46 第 46 轮五项落地批次 | 新建 check-samples-coverage.ts（fixture 引用 + 矩阵声明双核对，行号区间切块提取）+ 新建 samples/README.md 覆盖矩阵 + pre-push 15 项（prePushCount 14→15）/ 孤儿样本处置（登记 gate/tla/bdd 3 条 + 删除 2 伪样本，self-test 249→252，exit-2 30→31）/ 新建 examples/real-run-evidence.md（真实输出实录）+ 4 对话文件伪示例标注与数字修正 / A2 收敛去重（AGENTS §6 + INSTALL:88 指针化，SKILL 摘要表保留）/ engineering-batches 归档 + CHANGELOG [41.2.0] 精简 + 空目录清理 / 移除 workspaces（C7 逆转） | 新建 `check-samples-coverage.ts` + `samples/README.md` + `examples/real-run-evidence.md` + `docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md` + `self-test.ts`（+3 用例，删 2 样本）+ `.githooks/pre-push` + `docs-consistency-logic.ts` + `docs-consistency-logic.test.ts` + AGENTS.md + README.md + INSTALL.md + SKILL.md + 4 examples 对话文件 + examples/README.md + CHANGELOG.md（[41.5.0] + [41.2.0] 精简）+ package.json（去 workspaces）+ 删 `w-model-dev/package.json` + SSoT | 已落地（41.5.0） |
| 3.4.47 第 47 轮 SSoT 权威性审查修复 | 修 SSoT 内部互斥（§3.4.3/§3.4.6 P1.2 TLA+ 门槛与 §3.4.44 P1-3 成熟度开关对齐）/ 修 AGENTS.md:21 错误结构指针（补 §3.4.42）/ 修 §10A 追溯表（补 §3.4.42 行 + 修复 36/37/38 残缺行）/ 修 §3.4.40-46 标题层级（h3→h4）/ 双副本权威声明（§4A.1 → operation-behaviors.md、§10.6 → definition-of-done.md、§7 → data-models.md）/ §3.4.44 C7 逆转指针 / samples/README.md 基线 249→252 | `docs/skill-design-document_SSoT.md`（F1-F6）+ AGENTS.md（F2）+ `w-model-dev/scripts/samples/README.md`（F7）+ package.json / skill-metadata.json / SKILL.md / README.md / INSTALL.md + CHANGELOG.md（[41.6.0]）+ SSoT §3.4.47 | 已落地（41.6.0） |
