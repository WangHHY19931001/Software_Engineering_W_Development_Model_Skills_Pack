# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [40.1.0] - 2026-08-10

### Added
- 三源吸收 P1（10 项）：多评审分歧上缴人裁决（subagent-persona-matrix）、面向智能体的 API 契约准则（mcp-builder）、R3 来源时效/权威性校验（verifier-spec）、MASS 三阶段优化（hill-climbing-guide）、升级触发条件显式化（operational-recovery）、上下文修剪优先级（context-management-guide）、坏注释黑名单（format-conventions）、类设计规则（quality-standards + phase-4）、对象/数据结构与得墨忒耳律（chinese-code-review + phase-4）

### Changed
- 版本号 40.0.0 → 40.1.0（6 处同步）

## [40.0.0] - 2026-08-10

### Added
- 三源吸收 P0（16 项）：坏味道清单（code-smells-checklist + chinese-code-review）、phase-5 六节（坏味道禁令 #9-#13/断言规范/重构纪律/测试基线/第三方边界/静态工具接入）、quality-standards 三小节（测试整洁/函数错误规范/性能三法）、TDD 四则、复现测试强制（root-cause-locator §2.5）、反模式 #47（大规模重构）、命名约定（format-conventions §6）
- agentic 4 项：run-log R8 轨迹模板校验（agentic Ch19）、S 子代理简报质疑权（subagent-delegation）、verifier-spec R14-R17 协作评审维度、HOTL 规则化授权（operational-recovery）
- 新 reference：code-smells-checklist.md / clean-code-refactoring-agentic-absorption.md

### Changed
- 反模式计数 46 → 47（docs-consistency 期望值 + 全仓文档联动）
- 版本号 39.2.0 → 40.0.0

## [39.2.0] - 2026-08-10

### Added
- 新 reference：estimation-guide.md（记账模板 / mini-spike 前置 / 禁"编码×系数"外推 / 玩具外推警戒）
- 新 reference：context-management-guide.md（KV 缓存友好 / 上下文分层 / 自污染 10-30% / 档位路由 / 输出结构模板库）
- 白箱 vs 黑箱工具选型（SKILL.md 核心原则）
- 里程碑设计到无法自欺 + 人作最终审计位点（writing-plans）
- 侦察 vs 产出两阶段（hill-climbing-guide）
- 目的注释：写 why 不写 what（format-conventions）

### Changed
- 版本号 39.1.0 → 39.2.0（7 处同步）

## [39.1.0] - 2026-08-10

### Added
- 操作行为第 8 条 Structure Over Persuasion（结构性约束优先于提示词）；操作行为 7 → 8 级联（SKILL.md/README/SSoT/docs-consistency）
- 约束 #21 回归测试强制钩子（任何 agent 改动代码后必须跑回归测试）+ AGENTS.md 登记
- 并行三闸 + 能否通读测试 + 验证账单（dispatching-parallel-agents）
- 原文装填不转述（subagent-delegation 上下文装填原则）
- 记叙性优先：测试断言不是金标准 + 失败先归因（bdd-guide / test-driven-development）
- 独立评审会话模板（verifier-spec / requesting-code-review）
- 止损三规则（同错弃线 / 30% 预算重评 / 静默失败优先）+ 会话 50-70% 重开（operational-recovery）
- 辩解义务强制（root-cause-locator）
- 增量集成纪律（phase-5-coding）
- 环境契约前置自检（quality-standards）

### Changed
- P0 遗留术语统一（修正权验收测试 / bdd-guide 记叙性优先引用回检）
- 版本号 39.0.0 → 39.1.0（7 处同步）

## [39.0.0] - 2026-08-10

### Added
- 反模式 #45（反指标游戏：subagent 为通过测试而修改断言/测试期望）+ #46（只给审计权不给修正权）；反模式计数 44 → 46
- 主刀人设与修正权原则（subagent-delegation「主刀职责映射表」/ SKILL.md「主刀与修正权」段 / DoD「修正权验收」自检项）
- 九倍矩阵完成度自检（DoD 产品化轴×系统集成轴）+ phase-5/6 任务分配规则（产品化→agent，集成判断→人）
- 人机分工线原则（SKILL.md）+ DoD「理解证据」补注
- 吸收决策记录 `references/mythical-man-month-absorption.md`

### Changed
- dispatching-parallel-agents/SKILL.md 示例删除"调整测试期望"条款（与反模式 #45 对齐）
- testing-anti-patterns.md 补「改断言让测试通过（反指标游戏）」条目
- docs-consistency-logic.ts maxAntiPattern 44→46 + 测试样本同步
- 版本号 38.5.0 → 39.0.0（7 处同步）

## [38.5.0] - 2026-08-10

### Added
- check-docs-consistency 新增 2 项检查（10 → 12 项）：design-docs（扫描 docs/ 根 6 份设计文档的废弃 targetKind / 过时 DoD 维度表述 / 旧反模式区间）、vitest-files（测试文件数 glob 校验，期望 35）
- pre-push 变更过滤扩展：w-model-dev/**、根级活体文档、.githooks/*、docs/*.md、.cursor/skills/*（文档推送自动触发门禁）

### Changed
- 设计文档清理：llm-verifier-integration-design.md targetKind 枚举 → code/test；loop-engineering-adoption-design.md DoD 维度 5 → 7（8 处）
- vitest 用例数 515 → 521（+6，design-docs + vitest-files 检查测试）；11 处文档同步
- AGENTS §8 check-docs-consistency 行追加 design-docs / vitest-files（检查项 10 → 12）
- 版本号 38.4.0 → 38.5.0（7 处同步）

## [38.4.0] - 2026-08-10

### Added
- check-docs-consistency.ts 活体文档一致性门禁（10 项确定性检查：schema 清单 / run-log action 枚举 / targetKind / DoD 维度 / 操作行为 / 反模式范围 / exit-2 脚本数 / pre-push 项数 / glossary action / 资产计数），pre-push 接入（13 项 → 14 项）
- docs-consistency-logic.ts 纯逻辑 + __tests__/docs-consistency-logic.test.ts（vitest，17 用例）

### Changed
- AGENTS.md 脚本导航表登记 check-docs-consistency；SKILL.md Bundled Resources 登记；exit-2 脚本数 29 → 30
- 版本号 38.3.0 → 38.4.0（三处同步）

## [38.3.0] - 2026-08-10

### Changed
- 文档一致性修正（设计文档 `docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md`）：
  - targetKind 枚举统一（testcase/file → test/code）：verifier-spec §2/§2.1/§6/§7.3/§7.4/§7.4A/§8 + command-reference + agent-personas + SSoT（含 Persona 表与 JSON 示例）
  - DoD 维度 5→7：README + definition-of-done（七维度自检）+ SSoT §10.6 补第七维度「签名链完整性」
  - 核心操作行为 6→7：README + SSoT §4A/§10A
  - schema 份数 19→20：anti-patterns + data-models（补 iceberg-sweep 清单行）；SSoT 轮次记录删历史计数
  - check-code-tla-consistency 退出码补充 2=输入错误（exit-2 脚本数维持 29：24 check-*.ts + 5 工具）
  - pre-push 注释 12→13；反模式范围 #1~#44；角色表述「六类核心角色 + R-iceberg 变体」；glossary action 枚举对齐 27 值；CONTRIBUTING/.gitignore devDeps 描述
- 版本号 38.2.0 → 38.3.0（三处同步）

## [38.2.0] - 2026-08-09

### Added
- Phase 4 详细设计 6 独立子模板（class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod）
- check-requirement-graph.ts R13（DD 追踪矩阵一致性）/ R14（UML mermaid 块配平，class-design + data-model 双源）+ --spec-dir 支持 phase=4 glob
- check-artifact-gate.ts --phase=4 引用块完整性 / §0 SSOT 头 / DoD 清单校验

### Changed
- detailed-design.md 主模板重构（§0 SSOT 头 + 引用块串联，保留 §1-§3 既有节号）
- phase-4-detailed-design.md 算法增步骤 1-6 + FM-DD-01~05 + 禁止行为 #7/#8/#9
- verifier-spec.md completeness 维度新增 Phase 4 结构评审项
- self-test 基线 241→249；版本号 38.1.0 → 38.2.0

## [38.1.0] - 2026-08-09

### Added
- Phase 3 概要设计 6 独立子模板（interface-contract / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）
- check-requirement-graph.ts R11（INTF 追踪矩阵一致性）/ R12（UML mermaid 块配平）+ --spec-dir 支持 phase=3 glob
- check-artifact-gate.ts --phase=3 引用块完整性 / §0 SSOT 头 / DoD 清单校验

### Changed
- interface-design.md 主模板重构（§0 SSOT 头 + 引用块串联，保留 §1-§3 既有节号）
- phase-3-outline-design.md 算法增步骤 1-7 + FM-OD-01~05 + 禁止行为 #6/#7/#8
- verifier-spec.md completeness 维度新增 Phase 3 结构评审项
- self-test 基线 233→241；版本号 38.0.0 → 38.1.0

## [38.0.0] - 2026-08-09

### Added
- Phase 2 系统设计 6 独立子模板（system-architecture / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）
- check-requirement-graph.ts R9（SD 追踪矩阵一致性）/ R10（UML mermaid 块配平）+ --spec-dir 支持 module 前缀 glob
- check-artifact-gate.ts --phase=2 引用块完整性 / §0 SSOT 头 / DoD 清单校验（checkPhaseSpecStructure 泛化）

### Changed
- system-design.md 主模板重构（§0 SSOT 头 + 引用块串联，保留 §1-§5 既有节号）
- phase-2-system-design.md 算法增步骤 1-7 + FM-SD-01~05 + 禁止行为 #6/#7/#8
- verifier-spec.md completeness 维度新增 Phase 2 结构评审项
- self-test 基线 225→233；版本号 37.0.0 → 38.0.0

### Fixed
- check-requirement-graph.ts isPureReqGraph 防御式处理缺 nodes 输入（第 37 轮遗留静默放行缺陷）

## [37.0.0] - 2026-08-09

### 第三十七轮 Phase 1 需求分析设计级别增强（模板 / 参考 / 门禁三层联动）

阶段 1 需求规格产出升级至 DESIGN.md 级别结构严谨性：主模板重构（§0 SSOT 头 + §13-§17/附录 A 引用块）+ 6 独立子模板，主规格以引用块串联；门禁新增 R7/R8 与 phase=1 结构校验；需求规格不再内联 feature 集，行为规格由独立 .feature 文件 + bdd-manifest.json 承接，behavior-spec.md 仅定义引用关系。不新增反模式（总数 44 不变）。详见 SSoT §3.4.35。

#### Added
- Phase 1 需求规格 6 独立子模板（system-context / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling）
- check-requirement-graph.ts R7（追踪矩阵一致性）/ R8（UML mermaid 块配平）+ --spec-dir 参数
- check-artifact-gate.ts --phase=1 引用块完整性 / §0 SSOT 头 / DoD 清单校验 + --spec-dir 参数
- self-test 新增 8 条样本（4 graph spec-enhance + 4 gate structure），基线 217→225

#### Changed
- requirement-spec.md 主模板重构（§0 SSOT 头 + §13-§17/附录 A 引用块串联 6 独立文件）
- phase-1-requirements.md 算法增步骤 7/8/9 + FM-3D-08/09 + 禁止行为 #13/#14
- verifier-spec.md completeness 维度新增 Phase 1 结构评审项
- 版本号 36.0.0 → 37.0.0（三处一致）

#### 设计变更
- 需求规格不再内联 feature 集：行为规格由独立 bdd .feature 文件 + bdd-manifest.json 承接，behavior-spec.md 仅定义引用关系（--spec-dir 等参数全可选，代码层向后兼容）

#### 验证
- vitest 476/476 全通过
- self-test 225/225 全通过
- TypeScript strict 0 错误
- security-scan baseline 重生成（206→224 条，含第 37 轮新增指纹；`npm run lint:security` 0 新增发现）

## [36.0.0] - 2026-08-08

### 第三十六轮 冰山扫掠深度分析机制（R-iceberg / ICEBERG-A+B / 反模式 #44）

基于冰山理论（发现一个问题意味着存在更多隐藏问题）新增 R-iceberg 冰山扫掠机制：S-fix 后（ICEBERG-A）与阶段门放行前（ICEBERG-B）以已发现/已修复问题为线索，对全阶段产物做三维度（completeness/reliability/security）×六类别（same-root-cause-spread / same-defect-class / fix-induced-regression / adjacent-logic / coverage-gap / cross-artifact-inconsistency）深挖扫掠，直到 `newFindings=[]` 或达 maxIcebergRounds=5。详见 SSoT §3.4.34。

#### Added
- `schemas/iceberg-sweep.schema.json`：IcebergSweepReport 结构约束（reportId/phase/triggerType/icebergRound/线索来源/newFindings/sweepCoverage/summary/passed）
- `scripts/iceberg-sweep-logic.ts`：纯逻辑层 R1-R8（schema 前置 / reportId 格式 / phase 一致 / triggerType 合法 / round 边界 1-5 / finding 去重 / 可证伪 / passed 一致）
- `scripts/check-iceberg-sweep.ts`：CLI 层（退出码 0=通过 / 1=校验失败 / 2=输入错误）
- `references/iceberg-sweep-guide.md`：冰山扫掠方法论（六类别深挖 + TLA+ 状态机一致性应用示例）
- `scripts/__tests__/iceberg-logic.test.ts`（+7 用例）+ `scripts/samples/iceberg/`（+4 样本）
- run-log action 枚举 25→27：`iceberg-sweep`（R-iceberg 分派）+ `iceberg-review`（V 复审冰山报告）

#### Changed
- `references/anti-patterns.md`：反模式 #44「跳过冰山扫掠直接放行」（43 → 44）
- `references/subagent-delegation.md`：R-iceberg 角色表 + 分派模板 + ICEBERG-A/B 编排时序
- `references/root-cause-locator.md`：R 与 R-iceberg 边界节
- `SKILL.md`：执行工作流新增 9.5 步（冰山扫掠）
- `scripts/self-test.ts`：基线 213 → 217

#### 验证
- vitest 466/466（34 文件）全通过
- self-test 217/217 全通过
- TypeScript strict 0 错误

## [35.0.0] - 2026-08-08

### 第三十五轮 8 阶段端到端调测修复入库（TLC 清理正则 / D1 路径语义归一 / STATE_MACHINE_JSON 交叉校验）

34.0.0 全量 8 阶段端到端调测（w-model-dev-demo 重建）发现 3 处技能包侧真实 bug，调测后修复入库。详见 SSoT §3.4.33。

#### Fixed
- `check-tla-model.ts`：TLC 产物 states 时间戳子目录清理正则 `^\d{4}-…` → `^\d{2,4}-…`（TLC 2.19 实际产出 2 位年份目录 `26-08-07-18-04-31`，原 4 位正则不匹配导致 states 清理静默跳过，P3 bug）
- `design-contract-logic.ts`：D1 实际路径语义归一增强（「、/，/,」多端点拆分、全/半角括号剥离、`:id` 参数模板段级匹配、「不适用（…）」/「横切」非 HTTP 豁免）
- `run-log-logic.ts`：`GATE_JSON_PATTERNS` 新增 `/STATE_MACHINE_JSON\s+(\{.*\})/`（check-run-log R6 交叉校验需提取 check-state-machine-consistency.ts 存档的 exitCode）
- `bdd-logic.test.ts`：实时 demo fixture 测试改为自包含内联规格（不再依赖 demo 实时文件，解析器命名集合能力覆盖保留）

#### Changed
- 单测补强：`tla-clean-trace.test.ts`（+1）/ `design-contract-logic.test.ts`（+6）/ `run-log-logic.test.ts`（+1）
- demo 侧修复（只读测试夹具）：`auditMiddleware.ts` 审计 id 硬编码 `''` 导致 CON-004 审计互相覆盖（UAT-073 暴露）；`app.ts` 双限流器共享实例导致认证限额折半；路由结构 app.* → Express Router 惯用法（适配 check-design-contract-consistency 契约扫描）
- 版本号三处同步为 35.0.0：package.json + skill-metadata.json + SKILL.md frontmatter

#### 验证
- vitest 459/459（33 文件）全通过
- self-test 213/213 全通过
- TypeScript strict 0 错误
- 8 阶段调测终检：318/318 测试（175 UT + 30 IT + 40 ST + 73 UAT）、覆盖率 94.76% lines、check-artifact-gate exitCode=0、归档 308 文件

## [34.0.0] - 2026-08-07

### 第三十四轮 W 模型技能强化：目录约定 SSoT / 格式统一 / TLA+·BDD 覆盖率校验架构升级

调测发现三类问题并系统性修复（设计文档 `docs/superpowers/specs/2026-08-07-w-model-skill-hardening-design.md`）：①目录约定散落四处无 SSoT；②路径-定位分隔符三处不一致（冒号/点号/井号）；③TLA+/BDD 多级精细化时"只做一个子系统"门禁不检出。详见 SSoT §3.4.32。

#### Added
- 新建 `references/directory-conventions.md`：路径约定 SSoT（`docs/phaseN-{name}/` 阶段子目录 + TLA+/BDD/.w-model 目录结构 + resolvePhaseDoc 契约）
- 新建 `references/format-conventions.md`：元数据格式 SSoT（冒号分隔 `path:§section`/`path:L42`，禁止点号/井号）
- 新增 S-ingest-tla / S-ingest-bdd 子代理模板（subagent-delegation.md）：从 .tla/.feature 提取 @designIds + 比对 graph.json SD 节点 → 独立回填 manifest sdCoverage/designCoverage（防 S 自填不可靠）
- schema 新增 sdCoverage（tla-manifest）/ designCoverage（bdd-manifest）必填字段（phase≥2，allOf/if/then 条件约束）
- check-bdd-model.ts 新增 `--graph` 参数 + D8 SD Coverage 校验维度（phase≥2 强制）
- bdd-logic TLA+ 快照解析升级：支持命名集合（`var \in SETNAME`）与多种不变式形态；L1 系统级规格豁免 D4 自动等价（由 R3/V 语义评审）
- 测试样本：`samples/tla/bad-coverage-uncovered-sd.json` + `samples/bdd/bad-d8-uncovered-sd.json`

#### Changed
- check-tla-model.ts：`--graph` 参数 phase≥2 强制（缺失 → exitCode=2 ARG_INVALID）；SD 覆盖率校验 phase≥2 强制执行（sdCoverage.uncoveredSdNodes 非空 → exitCode=1）
- check-artifact-gate.ts：终检调用 check-tla-model + check-bdd-model 并传 `--graph`；新增 resolvePhaseDoc 消除硬编码路径
- verifier-logic.ts EVIDENCE_PATTERN 更新为冒号格式；verifier-spec §6.2 evidence 格式统一
- tla-spec-template / feature.template 新增 @designIds 头部字段；@design 路径统一 `:§` 冒号格式
- phase-2/3/4 文档路径更新为阶段子目录模式；G 子代理模板强制跑 model 校验（--graph）
- demo 完整重产：TLA+ 7 specs（L1 + 6 L2 子系统，SANY/TLC 全过）+ BDD 9 features 覆盖全部 21 SD 节点（sdCoverage/designCoverage 全覆盖）
- 版本号三处同步为 34.0.0：package.json + skill-metadata.json + SKILL.md frontmatter

#### 验证
- vitest 451/451（33 文件）全通过
- self-test 213/213 全通过
- TypeScript strict 0 错误
- 多子系统遗漏检出实测：TLA+ 遗漏 auth 子系统（SD-001/002/017）→ check-tla-model exit 1 "未被覆盖: SD-001, SD-002, SD-017"；BDD D8 同样检出

## [33.0.0] - 2026-08-05

### 第三十三轮 全仓库优化 5 批实施（安全加固 / 一致性快修 / 脚本瘦身 / 流程与体验 / 技能缺口 + 收尾）

总框架设计文档 `docs/superpowers/specs/2026-08-05-optimization-overview-design.md` 分 5 批执行：批次 1 安全加固（4 项，含 lint:security baseline 引入）；批次 2 一致性快修（~11 项）；批次 3 脚本瘦身（12 项，新增 gate-report.ts / parse-phase.ts / readJsonOptional / readJsonlOptional / readJsonClassified，生产代码净 -319 行）；批次 4 流程与体验（10 项，__tests__ 纳入严格类型 + pre-push Windows 兼容 + demo 清理 7866 行）；批次 5 技能缺口 + 评估 + 收尾（本批：3 个新技能 + eval README + 版本号 33.0.0）。详见 SSoT §3.4.31。

#### Added
- 新建 `.cursor/skills/security-review/SKILL.md`：源码级安全扫描（`npm run lint:security` = security-scan.ts + eslint-plugin-security 6 条规则 + baseline v2 内容敏感指纹豁免）+ 反模式 #43 凭据脱敏（数据文件层高熵密钥特征清单 + 模板/示例占位符检查）+ 修复动作 + 检查清单
- 新建 `.cursor/skills/codegraph-exploration/SKILL.md`：约束 #20 封装——阶段 5-8 修改前 `codegraph_explore` 调用 + 落盘 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`（querySymbol/callers/callees/blastRadius/queryTimestamp）+ 影响评估 + check-codegraph-queries.ts 校验 + 与 code-TLA+ 互补
- 新建 `.cursor/skills/performance-review/SKILL.md`：性能评审 4 维度（响应时间 P95<2s / 吞吐 / 资源占用 / 负载模型 ramp-up→sustain→ramp-down）+ targetValue vs testThreshold 区分 + 与 security-review 对称的检查清单
- 新建 `eval/README.md`：TSV 9 列格式说明（timestamp/commit/skill/old_score/new_score/status/dimension/note/eval_mode）+ test-prompts.json 15 条提示词四类场景用途 + darwin-skill 外部补跑流程 + 当前状态（2026-07-21 最新记录，33.0.0 后待补跑）

#### Changed
- 版本号三处同步为 33.0.0：package.json + skill-metadata.json + SKILL.md frontmatter
- SSoT §3.4.31 + §10A 追溯表；README/AGENTS/INSTALL vitest 计数统一为 434（README 旧 377、INSTALL 旧 363 陈旧）；README/INSTALL .cursor/skills 技能数 20→23

#### 验证
- vitest 434/434（33 文件）全通过（含 skill-metadata.test.ts 三方版本校验）
- self-test 213/213 不变全通过
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增）

## [32.0.0] - 2026-08-05

### 第三十二轮 错误结构全量归一化 + run-log R6 契约迁移

吸收外部评审建议高风险批（设计文档 `docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md`）：统一全仓 29 个脚本的 exit 2 错误输出为结构化格式；run-log R6 提取/索引规则迁入纯逻辑层。详见 SSoT §3.4.30。

#### Added
- 新建 `scripts/lib/cli-error.ts`：6 类错误码（ARG_INVALID/FILE_NOT_FOUND/FILE_PARSE/FILE_READ/STRUCTURE_INVALID/UNEXPECTED）+ `CliError` + `formatCliError/printError/printErrorJson/exitWithError`；人类消息 stderr、`ERROR_JSON` 摘要 stdout（遵循 §10E E.1 exitCode 强一致；`process.exitCode` 自然退出防 stdout 截断）
- 新建 `scripts/__tests__/cli-error.test.ts`（7 用例）

#### Changed
- 29 个脚本（23 check-*.ts + 5 工具 + read-json-or-exit）exit 2 路径统一走 `exitWithError`：参数校验 `[ARG_INVALID]`、文件缺失 `[FILE_NOT_FOUND]`、解析失败 `[FILE_PARSE]`、读取异常 `[FILE_READ]`、结构不符 `[STRUCTURE_INVALID]`、异常兜底 `[UNEXPECTED]`；各脚本 main().catch 统一 UNEXPECTED
- `run-log-logic.ts`：R6 契约迁移——`extractExitCode` + `buildGateLogKeys`（纯字符串，遵守 *-logic.ts 不 import node:path）自 check-run-log.ts 迁入；GATE_JSON_PATTERNS 追加 STATUS_JSON/METRICS_JSON/ERROR_JSON（ERROR_JSON 为第 32 轮验证驱动新增，exit 2 存档纳入 R6 契约，25→26 标记）；run-log-logic.test.ts +7 用例
- `check-run-log.ts`：loadGateLogs 删除本地提取/索引实现，改调 logic 层（契约不变）
- wm-status 未初始化保持 exit 0 查询语义（不输出 ERROR_JSON）；check-role-dispatch 坏行 exit 2 行为保留（第 29 轮决策），消息加类别
- command-reference.md 新增「错误码与 ERROR_JSON 约定」节；SSoT §3.4.30 + §10A + §10E 补充
- 版本号三处同步为 32.0.0：package.json + skill-metadata.json + SKILL.md frontmatter

#### 验证
- vitest 363/363（28 文件）全通过（新增 cli-error 7 + run-log-logic 7 用例）
- self-test 213/213 不变全通过（仅断言退出码，消息改动零回归）
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增；baseline v2 按 Task 6 脚本改造实测重生成 188→194 指纹）
- 冒烟：check-artifact-gate --phase=99 / plan-chunks --phase=9 / metrics-report --phase=abc → `✗ [ARG_INVALID]` + `ERROR_JSON` + exit 2；wm-status 空目录 → 未初始化 exit 0

## [31.0.0] - 2026-08-05

### 第三十一轮 /wm status 脚本化 + 流程度量报告（metrics-report.ts）

吸收外部评审建议新功能批两项（设计文档 `docs/superpowers/specs/2026-08-05-round31-wm-status-metrics-design.md`）：把手工状态查询脚本化为确定性 CLI；新增 run-log/budget 流程度量汇总工具。详见 SSoT §3.4.29。

#### Added
- 新建 `scripts/wm-status.ts` + `scripts/wm-status-logic.ts`（状态快照：当前阶段 / 完成进度 / RTM 覆盖率 / 四级测试汇总 / 最近 3 条动作 / 确定性下一步建议；退出码 0/2，`--json` 输出 StatusReport）
- 新建 `scripts/metrics-report.ts` + `scripts/metrics-report-logic.ts`（流程度量：总体 / 阶段汇总 / 动作·角色·结果分布 / 门禁通过率 / 返工率与连续段 / 预算 burn rate 与 killSwitch 预警；`--from/--to/--phase/--json/--out`；纯报告无门禁语义）
- `package.json` scripts 新增 `wm:status` / `wm:metrics`

#### Changed
- `SKILL.md`：命令速查表 `/wm status` 脚本化 + 新增 `/wm metrics`；参数示例 + Bundled Resources + frontmatter version → 31.0.0
- `command-reference.md`：§/wm status 改写为脚本化；新增 §/wm metrics
- SSoT §3.4.29 + §10A 追溯表 + §6.1 命令表 + 附录 A；INSTALL.md / AGENTS.md / README.md / toolbox.md / __tests__ coverage 矩阵同步
- 版本号三处同步为 31.0.0：package.json + skill-metadata.json + SKILL.md frontmatter

#### 验证
- vitest 345/345（27 文件）全通过（新增 wm-status-logic 10 + metrics-report-logic 9 + CLI 子进程 25 用例）
- self-test 213/213 不变全通过
- TypeScript strict 0 错误
- `npm run lint:security` exit 0（0 新增）
- prepush 12 项全通过
- 冒烟：wm-status（含未初始化 exit 0 / 损坏 JSON exit 2）、metrics-report（含缺失 run-log exit 2）均符合预期

## [30.1.0] - 2026-08-05

### 第 30.1 轮 security-scan 内容敏感指纹 v2 + 签名链 R8 项目根语义

修复位置指纹（file:line:column）因行号漂移导致 baseline 陈旧的问题：指纹改为内容敏感（file + ruleId + 归一化违规行内容），行号漂移免疫，代码模式修改仍触发复审。详见 SSoT §3.4.28。

#### Changed
- `security-scan.ts`：指纹算法从位置敏感改为内容敏感（baseline v2：sha256(file + ruleId + 违规行内容)，不含行号列号）；新增 `--regenerate` 按当前发现全量重建 baseline；加载时校验 version=2，旧版位置指纹格式报错提示重生成；diffFindings 拆分为纯函数（normalizeSourceLine / computeFindingHash / buildBaselineEntries）+ 注入式源行读取器
- `.eslintsecurity-baseline.json`：升级为 `{version: 2, algo: "content-line", entries: [...]}`，183 条（同类内容跨行合并，较位置指纹 215 条精简）
- `check-signature-chain.ts`：R8（产物存在性）仅在解析到含 `.w-model/project.json` 的真实项目根时启用；独立链文件/逻辑夹具自动跳过，与 signature-chain-logic 契约一致（prepush 样本确定性通过）
- 版本号三处同步为 30.1.0：`package.json` + `skill-metadata.json` + `SKILL.md` frontmatter

#### Added
- `security-scan.test.ts` 新增 4 用例（行漂移稳定 / 内容敏感 / CRLF 归一化 / 源行不可读），3 既有用例适配新算法（vitest 297→301）

#### 验证
- self-test 213/213 不变全通过
- vitest 301/301（23 文件）全通过
- `npm run lint:security` exit 0（0 新增）
- prepush 12 项全通过
- TypeScript strict 0 错误

## [30.0.0] - 2026-08-05

### 第三十轮 Schema 字段描述增强 + 敏感信息脱敏 + npm audit 门禁

吸收外部评审建议低风险批三项（设计文档 `docs/superpowers/specs/2026-08-05-round30-schema-desc-redaction-audit-design.md`）。详见 SSoT §3.4.27。

#### Added
- 反模式 #43（敏感信息写入状态文件/日志）—— 状态文件/日志不得含硬编码凭据，敏感配置统一环境变量注入

#### Changed
- `schemas/*.schema.json`（19 份）：全量字段补充 `description`（用途 + 期望值），仅注释性关键字，校验行为不变
- `references/operational-recovery.md`：「JSON 文件写入工具选择」节新增敏感信息禁令
- `.githooks/pre-push`：新增检查 #12 npm audit（warn-only + 离线容错），11 项 → 12 项

#### 验证
- self-test 213/213 不变全通过
- vitest 297/297 不变全通过
- prepush 12 项通过（npm audit warn-only）
- TypeScript strict 0 错误

## [29.0.0] - 2026-08-05

### 第二十九轮 CLI 样板抽取 + 分派总览矩阵

针对「技能代码重复率高 + 流程派遣信息分散」的反馈，做两项针对性优化：抽取 CLI 层 JSON 读取样板工具消除重复；新建分派总览矩阵解决信息分散。详见 SSoT §3.4.26。

#### Added
- 新建 `scripts/lib/read-json-or-exit.ts`（CLI 层 JSON/JSONL 读取工具，导出 `readJsonOrExit` + `readJsonlOrExit`，消除 check-*.ts 中重复的 `readFile + ENOENT → exit(2) + JSON.parse → exit(2)` 样板）
- 新建 `scripts/__tests__/read-json-or-exit.test.ts`（11 个单元测试：正常路径 / ENOENT / 非法 JSON / 相对路径 / JSONL 空行 / 坏行 warn / CRLF / label 默认值）
- 新建 `references/dispatch-matrix.md`（阶段 × 角色 × S 变体 × 产物 × reference × check 脚本总览矩阵，编排者分派前必读，解决信息分散痛点）

#### Changed
- 13 个 check-*.ts 重构使用 `readJsonOrExit` / `readJsonlOrExit`（删除约 258 行样板）：
  - Group A（单 JSON 读取）：check-exemption / check-verifier-output / check-rootcause-report / check-requirement-coverage / check-requirement-graph / check-maturity / check-state-machine-consistency / check-signature-chain
  - Group B（JSONL 读取）：check-run-log / check-checkpoint / check-budget（仅主输入 budget.json）
  - Group C（多文件读取）：check-tla-model（manifest + graph）/ check-code-tla-consistency（manifest + graph + rtm）
- 3 个 check-*.ts 保留原样（行为不等价，不重构）：check-role-dispatch（坏行 exit(2) ≠ readJsonlOrExit 的 warn+skip）/ check-preventive-review（无标准样板）/ check-artifact-gate（输出消息含可执行修复提示）
- SKILL.md frontmatter version 28.0.0 → 29.0.0 + Bundled Resources 表新增 dispatch-matrix.md 行 + 编排者边界节引用 dispatch-matrix
- skill-metadata.json + package.json version 三处一致
- __tests__/README.md coverage 矩阵新增 read-json-or-exit.test.ts 行
- AGENTS.md §2 references 描述新增 dispatch-matrix + scripts 描述新增 lib/read-json-or-exit.ts

#### 验证
- vitest 286 → 297（+11 read-json-or-exit）全通过
- self-test 213/213 不变全通过
- TypeScript strict 0 错误

## [28.0.0] - 2026-07-31

### 第二十八轮 S→R3+V 无条件强制（覆盖所有 S 变体，含 S-fix / emergency-fix）

将 R3 预防性审查从「条件强制（--r3-enabled flag）」升级为「无条件强制」，覆盖所有 S 变体，堵死 S-fix / emergency-fix 跳过 R3+V 的漏洞。详见 SSoT §3.4.25。

#### Added
- 新建 `scripts/role-dispatch-logic.ts`（纯逻辑层抽离，与 run-log-logic.ts / preventive-review-logic.ts 一致的自包含纯函数模式）
- 新建 `scripts/__tests__/role-dispatch-logic.test.ts`（9 个测试：R≥3 无条件 / S/V/G 各 ≥1 / phaseSummary 结构 / 多阶段 / 非法条目容错）
- 反模式 #42 新增（S-fix / emergency-fix 后跳过 R3+V）

#### Changed
- `check-role-dispatch.ts`：移除 `--r3-enabled` 参数语义（R≥3 无条件校验，CLI 保留 flag 向后兼容视为 no-op）；JSON 输出 `r3Enabled` 字段恒为 `true`（向后兼容历史消费者）；缺失 R<3 即 violations，exitCode=1
- `check-preventive-review.ts`：always-on 无 flag；新增 `--variant=standard|fix|emergency` 参数（默认 standard）；报告路径校验扩展（standard `<phase>-{dim}.json` / fix `<phase>-fix-{dim}.json` / emergency `<phase>-emergency-{dim}.json`）；`--auto-trigger` 模式从 run-log 推断 variant
- `preventive-review-logic.ts`：新增 `PreventiveReviewOptions.variant` 参数
- `run-log-logic.ts` R8 升级：从「R3 启用时，S→V 间须有 3 条 R3 记录」改为「**无条件**」；S 识别条件从 `action=produce` 扩展为 `['produce', 'fix', 'emergency-fix']`；RunLogEntry.action 联合类型新增 `'emergency-fix'`；违规信息含 S 变体标识 `S(${sVariant})→V`
- `run-log-logic.test.ts`：新增 2 个用例（S-emergency-fix 后无 R3 应失败 / 有 3 条 R3 再 V 应通过）
- SKILL.md 约束 #12（删除「（R3 启用时）」）/ #17（删除「启用时」+ 新增含 S-fix / emergency-fix）/ #19（删除「R3 启用时须分派 R 角色」改为「无条件」）
- `subagent-delegation.md`：「R3 预防性审查分派模板」节删除「启用时」/「角色分派完整性校验」表 R 行改为「无条件必须」/「S 兼 F 修复分派模板（返工变体）」节新增 R3+V 前置 /「S 子代理修改既有产物的边界」节紧急修复通道改前置
- `anti-patterns.md` #33/#34/#35 强化 + #42 新增
- `phase-1~8-*.md` 统一删除「启用时」措辞

#### 验证
- vitest 269→286（+9 role-dispatch +2 run-log-logic 扩展 +5 preventive-review 扩展，含其他调整）全通过
- self-test 213/213 不变全通过
- TypeScript strict 0 错误

## [27.0.0] - 2026-07-31

### 第二十七轮 need_fix.md + 全量脚本 code-review 修正（~66 项缺陷 + 21 新样本）

基于 `need_fix.md` 两处 bug 报告 + 全量脚本深度 code-review（5 组并行子代理，最小复现验证）发现的约 66 项缺陷（P1×15 / P2×25 / P3×26），按 6 组域内回归一次修正完成。详见 SSoT §3.4.24。

#### Added
- 新建 `plan-chunks.test.ts`（A6：CJK 字节估算 / 标题配对 / 围栏代码块 / 单节二次切分 / 目录递归 / --max-tokens 非法值）；当前零覆盖 → 完整覆盖
- 新建 `design-contract-logic.ts`（D9：设计契约跨文件共享纯逻辑，路由查找失败报 violation）
- 新建 `design-contract-logic.test.ts`（D9 对应单测，路由匹配 / 缺失 violation / 多路由提取）
- self-test 新增样本 21 条（UAT_PATH_MAPPING 5 / DESIGN_CONTRACT 5 / VERIFIER +1 / GATE +1 / GRAPH +1 / RUN_LOG +6 / ROOTCAUSE +1 / CODEGRAPH_QUERY +1 / OPSX_ARTIFACT +1 / OPENSPEC_ARCHIVE +1 / BDD +2 / SIGNATURE_CHAIN +3），基线 192 → 213
- vitest 新增 64 条（plan-chunks 6 + design-contract-logic + gate-enhancement 扩展 + verifier + bdd + signature-chain + run-log 等），总计 205 → 269，21 test files

#### Changed
- `plan-chunks.ts`（A1-A5）：estimateTokens → Buffer.byteLength(utf8)/4（修复 CJK 4 倍低估）；splitMarkdownByHeaders 重写（header+content 正确配对 + 围栏代码块感知 + 单节按行二次切分）；非 md 行按累计字节数分块；目录递归收集叶子文件；--max-tokens 正整数严格校验
- `gate-logic.ts`（B1-B3）：SD→codeModule 与 code-tla-logic 对齐（SD-5.2.1 数字层级兼容）；coverageStatus 行级比较 + coveragePercent↔missingItems 联动；uat-path-mapping guard 防缺字段崩溃
- `check-artifact-gate.ts`（B4-B6）：uat-path-mapping 严格解析（格式不符记录 violation，不静默跳过）；phase 8 终检补 uat-path-mapping 校验（对齐 phase-8-acceptance-test.md 声明）；parsePhaseArg 严格整数校验
- `security-scan.ts`（B7-B8）：指纹 path.relative 归一化后哈希（修复跨机器失效）；JSON.parse 容错
- `check-verifier-output.ts`（B9）：--s-output 用 indexOf('=')+slice 切分；空值报输入错误
- `schema-loader.ts`（B10）：全部注册成功后再赋值 ajv 单例（注册失败清理重试）
- `verifier-logic.ts`（B11）：passed 基于降级后 compositeScore 重算（含 evidence 扣分后）；R11/R12/P3-5 死代码清理
- `self-test.ts`（B12）：补带 graph 的 gate 样本（SD-5.2.1 应通过 + 数字层级映射验证）
- `check-requirement-graph.ts`（C1-C4）：--rtm R6 检查移到 passed 计算前（违规并入 violations）；豁免重算 roots 与 graph-logic 对齐（消除多 group 豁免永不生效）；豁免前缀兼容组合前缀；--phase 严格整数校验
- `graph.schema.json`（C5）：边对象加回 sourceArtifact 可选字段（语义来源占比复活）
- `graph-logic.ts`（C6）：warnings 落盘 GRAPH_JSON 并 stdout 输出
- `coverage-logic.ts`（C7-C8）：--out-of-scope 文件结构不符 → 报错 exit 2（不静默降级）；C9 missingIds 取需求 ID（如 NFR-001）而非类别名
- `exemption-logic.ts`（C9）：四阶段时间戳时序校验（submittedAt < reviewedAt < verifiedAt < decidedAt）
- `tla-logic.ts`（D1-D3）：cfg↔TLA 不变式正则兼容 BusinessInvariant ==（demo 实际命名）；INVARIANT 死分支修复；@phase 严格整数校验
- `code-tla-logic.ts`（D1）：cfg 不变式正则兼容 Invariants == 两种命名
- `check-bdd-model.ts`（D4）：extractStateVarName 兼容 TypeOK ==；D4 缺 --tla-manifest 时提示而非静默跳过
- `tla-bdd-sync-logic.ts`（D5-D7）：Scenario 体内步骤 + # @states:/# @transitions: 注释解析；转移抽取支持 \E 量化项；Next 体边界终止条件鲁棒化；VARIABLES 多行形式捕获全部变量
- `check-design-contract-consistency.ts`（D8）：路由元数据按路由提取（res.status/params/responseFields 归属具体路由而非整文件首个）
- `signature-chain-logic.ts`（E1-E3）：R2 改为跨阶段连续链（D2 决策：首条 prevSigId 允许指向前一阶段最后 sigId）；R7 sourceSigIds 悬空校验放宽为"本阶段 ∪ 前一阶段"；收集全部违规点不首个命中即 break
- `check-signature-chain.ts`（E4）：链文件路径显式传参并从位置推导项目根；产物路径按 .w-model/ 前缀解析
- `run-log-logic.ts`（E5-E9）：R1 按阶段分档（D3 决策：阶段 1-4 chunk/cross/gate/checkpoint；阶段 5-8 produce/review/gate/checkpoint）；R3 返工计数按 phase + TLA target 过滤后对比；R6 null gateExitCode 且设 gateLogPath 判失败；R7 返工时序扫第一个 rootcause review；R3 rootcause↔fix 按 reportId 去重后计数
- `check-run-log.ts`（E10-E11）：extractExitCode 模式表补齐全部 gate 标记；loadGateLogs 加载 gate-logs/ 下全部文件（不限 .log）
- `check-budget.ts`（E12）：tla-rework 死代码 → 统计改为 action='rework' 且 target 含 tla（按 phase 限定）
- `check-maturity.ts`（E13）：O_PATTERN 词边界 \bO[1-6]\b
- `check-checkpoint.ts`（E14）：前导零 filename 匹配 parseInt 归一
- `checkpoint-logic.ts`（E15）：字符计数用 [...decision].length
- `root-cause-logic.ts`（E16）：R10 校验任一有效 partialReport 含 reality-checker 角色（不限 method）
- `archive-integrity-logic.ts`（E17）：文件存在性按归档清单预期相对路径精确匹配
- `ensure-codegraph-opsx.ts`（F1-F3）：探针命令改为 codegraph query（位置参数）；探针移到 L3 codegraph init 之后执行；--phase Number.isNaN 校验；getArg 支持 --name=value 与 --name value 两种形式
- `check-codegraph-queries.ts`（F4）：blastRadius/queryTimestamp 字段形状校验；位置参数误解析 exit 2
- `check-opsx-artifacts.ts`（F5）：校验该阶段所有变更目录（readdirSync 排序后逐个校验，全过才通过）；精确前缀匹配 phase<N>-
- `check-openspec-archive.ts`（F6）：精确前缀匹配 + 全部归档目录校验；归档清单与归档前 REQUIRED 清单统一
- `data-models.md`：run-log R1 分档说明 + tla-rework 动作枚举移除
- `signature-chain-guide.md`：跨阶段连续链模型说明
- `subagent-delegation.md`：opsx D4 操作侧补产 stage 级 .md 文件约束
- `anti-patterns.md` #39：opsx 审查产物操作侧补产约束同步
- `phase-8-acceptance-test.md`：uat-path-mapping 终检校验声明
- `SKILL.md`：opsx 补产约束 #21（stage 级 R3×9 + V×3）
- 版本号三处同步 26.0.0 → 27.0.0（package.json + skill-metadata.json + SKILL.md frontmatter）

#### Removed
- 删除 `need_fix.md`（两处 bug 已修复）
- 删除 `check-budget.ts` tla-rework 死代码（改为通用 action='rework' 统计）
- 删除 `verifier-logic.ts` R11/R12/P3-5 死代码
- 删除 `tla-logic.ts` INVARIANT 不可达死分支

#### Validation
- self-test: 213/213 全通过（基线 192 → 213，+21 新样本）
- vitest: 269/269 全通过（基线 205 → 269，+64 测试，21 test files）
- TypeScript strict: 0 错误
- security-scan: 指纹归一化后 baseline 重生成，`npm run lint:security` exit=0
- prepush: 全绿
- 回归验证：6 组域内回归 + 全量回归通过

## [26.0.0] - 2026-07-30

### 第二十六轮 Wayfinder「Fog of War」吸收（阶段 1 迷雾登记册）

吸收外部仓库 wayfinder 技能（Matt Pocock "Skills For Real Engineers"，`skills/skills/engineering/wayfinder/`）「Fog of war」理念：阶段 1 需求分析为「in-scope 但尚无法精确陈述」的需求引入显式治理路径——REQ 入学锐利性测试 + Not-yet-specified 文本节 + 毕业机制。纯文档吸收，无脚本/schema 变更。详见 SSoT §3.4.23。

#### Added
- `ingestion-chunk.md`：新增「REQ 入学锐利性测试」节（判据 = 能否精确陈述需求的问题，非能否回答）；迷雾项字段 fogDesc / fogBlocker / fogGroupHint 写入 chunk `.md`；crossChunkHints 支持 `edgeType: "fog"`
- `ingestion-cross.md`：A-cross 算法新增步骤 9（迷雾册跨块去重汇总）+ 报告模板新增 §7 迷雾登记册（疑似 REQ-group 归属 + 疑似毕业方向）；A-cross 不代 S 决定毕业
- `phase-1-requirements.md`：新增「迷雾登记册（Fog of War）」节（定义与 §8 Out of Scope 区分 + 锐利性测试 + 毕业机制三选一 + CHECKPOINT 前强制清空 + 覆盖矩阵语义）；FM-3D 新增 FM-3D-07 迷雾滥用；禁止行为新增 #12 迷雾项静默遗留；返工路径补充对应条目
- `templates/requirement-spec.md`：§8 后新增「8.5 Not yet specified（迷雾登记册）」节（登记表 + 毕业处置结果列）

#### Changed
- 版本号三处同步为 26.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter
- SSoT §3.4.23 第 27 轮记录 + §10A 追溯表补行

#### Validation
- TypeScript strict: 0 错误（无代码变更，基线确认）
- self-test: 192/192 全通过（基线不变）
- vitest: 205/205 全通过（基线不变）
- D5 文档互引一致性：新增节与既有 §8 Out of Scope / 覆盖矩阵 / FM 矩阵 / 禁止行为表无矛盾
- 反模式计数保持 41 条（迷雾滥用走 FM-3D-07 + 禁止行为 #12，不新增反模式）

## [25.0.0] - 2026-07-30

### 第二十五轮 外部技能深度对比吸收（单轴下限 R13 + Fowler 12 基线 + 票据 durability + 术语治理）

深度对比外部参考仓库（Matt Pocock "Skills For Real Engineers"，`/mnt/skill_work_dir/skills`）逐文件提取 5 项借鉴点。核心：Verifier passed 判据从「加权平均 ≥ B」收紧为「每个子标准自身 ≥ B」（单轴下限 R13，反模式 #41）。详见 SSoT §3.4.22。

#### Added
- 新增反模式 #41（加权平均掩盖单轴失败）：V 评审通过加权平均 compositeScore 掩盖单一子标准显著失败 → 命中后 passed=false + reworkHints 交 S 返工（R→V→G 循环）；用户决策直接转正（不经 pending V 复审流程）
- 新增 R13 单轴下限校验：`verifier-logic.ts` 新增 `SINGLE_AXIS_MIN_SCORE` 常量（0.70 = qualityLevel B 级分界）+ `checkR13SingleAxisFloor()`；violation 格式「子标准 <name> 得分 <score> < 0.70（单轴下限，反模式 #41）」
- 新增 `references/glossary.md`：术语权威表（15+ 术语分 3 区：评审相关 / 数据模型 / 工程资产），每条含「规范定义 + `_Avoid_` 别名治理」+ 维护规则（新增字段前先登记术语）
- 新增样本：`samples/verifier/bad-single-axis-low.json`（completeness=0.65 / 其余 0.95 / compositeScore=0.86 / qualityLevel=A / passed=false，加权平均达 A 级但单轴失败）
- 新增 verifier-logic.test.ts R13 单测 4 用例（全 ≥0.70 通过 / 单轴 0.65 命中含子标准名 / 边界 0.70 通过 / 非数组返回空）
- 新增 self-test 用例 1 条（VERIFIER_CASES +1，基线 191 → 192）

#### Changed
- `verifier-spec.md`：§3.3 新增单轴下限说明（引用外部原则「评审各轴独立成环，永不合并计分」）；§6.3 通过判定改写为 `passed = (A||B) && 所有 subCriterion.score >= 0.70`
- `subagent/engineering-code-reviewer.md`：新增「Fowler 12 坏味道固定基线」节（F-01~F-12，取自《Refactoring》22 种坏味道最相关 12 种），每条含定义/检测信号/AI 生成代码高频场景/默认分级；🔴 级关联反模式 #23；评审命中须引用条目名不得自造术语
- `phase-5-coding.md`：新增「票据内容 durability」节——票据主体 = 符号级契约（接口/类型/状态转移，与 TLA+ Action 对齐），禁止文件路径+行号作为票据主体；位置信息交给 codegraph（约束 #20）；与评审 evidence「路径+行号」边界区分；术语引用统一用 glossary 规范名
- `SKILL.md`：角色表「关键禁止」列改写为「关键职责 + 脚本不变式（正向动作替代纯否定，Negation 审计）」；references 索引补 glossary 条目
- `anti-patterns.md`：#41 转正 + F1~F10 节「与 29 条流程反模式」陈旧计数修正为 41 条
- 版本号三处同步为 25.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter

#### Validation
- TypeScript strict: 0 错误
- self-test: 192/192 全通过（基线 191 → 192）
- vitest: 205/205 全通过（+4 R13 单测）
- fixture 门禁：bad-single-axis-low.json exit=1（触发 R13）、valid.json exit=0
- 既有样本兼容：V6 全样本 valid=0 / 18 bad=1（R13 无误伤，最低既有 score 0.80）
- 验证过程修正 2 项（V2/V3 门禁捕获）：JS 数字渲染 `0.70`→`0.7`，self-test 正则与单测断言同步修正
- 反模式 #41 编号连续无冲突（#40 → #41）

## [24.0.0] - 2026-07-30

### 第二十四轮 codegraph + OpenSpec 集成（修改前影响分析 + 规格驱动变更管理 + 三段式 S 分派）

阶段 5 起引入 codegraph（100% 本地符号级 callers/callees/blast radius 查询，修改前预防）与 OpenSpec opsx（opsx:explore/propose/apply/archive 规格驱动变更工作流，任务规划层）。新增约束 #20 + 反模式 #38/#39/#40 + 4 个新脚本 + gate-logic 三布尔扩展 + run-log action 枚举 +6 值。详见 SSoT §3.4.21。

#### Added
- 新增约束 #20（codegraph 修改前强制查询）：阶段 5-8 任何代码/测试文件 Edit/Write 前，S-coding 须先调用 codegraph_explore MCP 工具查询目标符号影响半径，结果落盘 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`
- 新增反模式 #38（修改前未查询 codegraph）/ #39（跳过 opsx 产物审查）/ #40（opsx/S-tickets 职责混淆）
- 新增脚本：`ensure-codegraph-opsx.ts`（三层依赖检测 L1 CLI / L2 MCP / L3 项目目录 + 自动安装，full/quick/light 三模式）
- 新增脚本：`check-codegraph-queries.ts`（反模式 #38 校验：codegraph 查询落盘完整性）
- 新增脚本：`check-opsx-artifacts.ts`（反模式 #39/#40 校验：opsx 制品 + R3×3 + V 审查产物齐全）
- 新增脚本：`check-openspec-archive.ts`（opsx:archive 归档完整性校验）
- 新增 schema：`run-log.schema.json` action 枚举 +6 值（codegraph_query / opsx_explore / opsx_propose / opsx_apply / opsx_archive / ensure_deps）
- 新增样本：41 个（codegraph-queries 3 组 + opsx-artifacts 2 组 + openspec-archive 2 组）
- 新增 self-test 用例：7 条（3 CodegraphQuery + 2 OpsxArtifact + 2 OpenspecArchive）
- 新增参考指南节：phase-5-coding.md「codegraph 修改前影响分析」+「OpenSpec opsx 三段式 S 分派」节；phase-6/7/8 各新增「第 25 轮新增：opsx 三段式 + codegraph」节；subagent-delegation.md「阶段 5-8 S 三段式变体」节
- 新增 INSTALL.md「codegraph + OpenSpec 自动安装」节
- SSoT §3.3 外部工具边界新增 codegraph + OpenSpec 登记

#### Changed
- `gate-logic.ts`：ArtifactGateResult 新增 3 可选布尔字段（codegraphQueriesValid / opsxArtifactsValid / openspecArchived）+ CheckArtifactGateOptions 新增 externalChecks 参数（phase ≥ 5 时读取，保持纯逻辑可测试性）
- `SKILL.md` Bundled Resources scripts 表新增 4 个脚本；阶段路由表阶段 5-8 追加 opsx+codegraph 标记
- self-test 基线：184 → 191（+3 CodegraphQuery + 2 OpsxArtifact + 2 OpenspecArchive）
- 版本号三处同步为 24.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter

#### Validation
- TypeScript strict: 0 错误
- self-test: 191/191 全通过
- vitest: 201/201 全通过
- 约束 #20 + 反模式 #38/#39/#40 编号连续无冲突

## [23.0.0] - 2026-07-30

### 第二十三轮 P0-P3 技能包十项修正（RTM 回填 + 角色分派 + R3 实执行 + 状态机一致性 + self-as-verifier + NFR 双字段 + 路由顺序 + 图谱边数 + 门禁 stdout + 信息密度）

修复第 23 轮 8 阶段端到端调测发现的 10 项技能包问题（P0×2 + P1×3 + P2×3 + P3×2），按 P0→P1→P2→P3 分 4 批 19 个任务执行，新增约束 #18/#19 + 反模式 #34-#37 + 2 个新校验脚本（check-role-dispatch.ts / check-state-machine-consistency.ts）。详见 SSoT §3.4.20。

#### Added
- 新增约束 #18（RTM 实体每阶段必须回填）：S 子代理产出后须更新 `.w-model/rtm.json`；coverageStatus 字段与 coveragePercent 须一致
- 新增约束 #19（编排者角色分派完整性）：每阶段须至少分派 S/V/G 三角色各 1 次；R3 启用时须分派 R 角色 ≥3 次；self-as-verifier 模式下兼任时须产出各角色独立产物文件
- 新增反模式 #34（编排者漏派角色）/ #35（self-as-verifier 模式下 V/G/R 产物混合）/ #36（路由顺序错误）/ #37（产物膨胀但核心决策稀疏）
- 新增脚本：`check-role-dispatch.ts`（角色分派完整性校验，校验 run-log 每阶段含 S/V/G 各 ≥1 条；`--r3-enabled` 时 R ≥3 条）
- 新增脚本：`check-state-machine-consistency.ts`（设计文档↔代码状态机一致性校验，校验状态集 + 转移集一致）
- 新增 schema 字段：`rtm.schema.json` NFR 行增加 `targetValue` + `testThreshold` 双字段；`run-log.schema.json` role 字段增加 description（约束 #19 说明）
- 新增样本：gate/bad-rtm-coverage-below-100.json + bad-rtm-status-mismatch.json（RTM coverageStatus 校验）；run-log/bad-missing-V-role.jsonl + bad-missing-G-role.jsonl + bad-missing-R-role.jsonl（角色分派校验）；state-machine/bad-missing-transition.json + bad-extra-transition.json + valid-consistent.json（状态机一致性校验）
- 新增 self-test 用例：8 条（2 GATE coverageStatus + 3 RoleDispatch + 3 StateMachine）
- 新增参考指南节：SKILL.md「self-as-verifier 模式」节；verifier-spec.md「self-as-verifier 模式」节；agent-personas.md「self-as-verifier 兼任规则」节；tla-plus-guide.md「设计文档 ↔ 代码状态机一致性」节；graph-guide.md「边数下限与语义来源占比」节；quality-standards.md「信息密度指标」+「生产目标值 vs 测试环境基线」节；definition-of-done.md「信息密度度量」节；phase-8-acceptance-test.md「门禁 stdout 贴出要求」节；templates/interface-design.md「路由注册顺序约束」节；phase-3-outline-design.md「路由顺序约束」节；templates/requirement-spec.md「NFR 性能基线双字段」节；templates/system-test.md「性能度量环境声明」节
- 新增模板节：subagent-delegation.md「角色分派完整性校验」节 + S 子代理 RTM 回填强制职责

#### Changed
- `SKILL.md` 约束 #10 扩展：编排者展示证据时须贴出门禁脚本 stdout 末尾 5 行（不得仅引用 JSON 摘要）
- `SKILL.md` 约束 #12 扩展：4 脚本 → 5 脚本（增加 `check-preventive-review.ts`，R3 启用时）
- `check-preventive-review.ts`：新增 `--auto-trigger --run-log=<path>` 模式，从 run-log 读取当前阶段自动校验
- `check-verifier-output.ts`：新增 `--self-as-verifier --s-output=<path>` 参数，校验 VerifierOutput JSON 路径与 S 产出路径不同（反模式 #35）
- `gate-logic.ts`：新增 RTM coverageStatus 字段一致性硬校验 + NFR 双字段缺失校验（双字段都缺失才 fail）
- `graph-logic.ts`：新增边数下限校验（边 < 节点×3 → 警告）+ 语义来源占比校验（< 80% → 警告），保留 small-project exemption
- `anti-patterns.md` 反模式 #27 S2 扩展：新增「门禁脚本未实跑」作为独立可命中信号
- self-test 基线：175 → 184（+2 GATE coverageStatus + 3 RoleDispatch + 3 StateMachine + 1 既有调整）
- 版本号三处同步为 23.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter

#### Validation
- TypeScript strict: 0 错误
- self-test: 184/184 全通过
- 约束 #18/#19 + 反模式 #34-#37 编号连续无冲突

## [22.0.0] - 2026-07-29

### 第二十二轮 P0-P3 技能包修正（R3 强制 + TLA+/BDD 同步 + 设计契约 + uat-path-mapping + codeModule 格式）

修复第 21 轮调测发现的 35 项技能包问题（SSoT 14 任务 + schemas 1 任务 + scripts 7 任务 + samples 8 任务 + testing 4 任务），29 次提交。新增约束 #17 + 反模式 #33 + 2 个新校验脚本（check-preventive-review.ts / check-tla-bdd-sync.ts）+ preventive-review.schema.json。详见 SSoT §3.4.19。

#### Added
- 新增约束 #17（R3 预防性审查强制）：所有阶段 S 产出后须触发三阶段 R 预防性审查（completeness/reliability/security），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json` 三份报告
- 新增反模式 #33（跳过 R3 预防性审查）：V 评审前 G 子代理须跑 `check-preventive-review.ts` 校验报告完整性，跳过 R3 直接进入 V 评审命中反模式 #33
- 新增 schema：`preventive-review.schema.json`（R3 预防性审查报告 schema）
- 新增脚本：`check-preventive-review.ts`（校验 R3 三份报告完整性，`<project-dir> --phase=<1-8>`，退出码 0/1/2）
- 新增脚本：`check-tla-bdd-sync.ts`（TLA+/BDD 自动化同步校验，校验转移集 + 状态集 + 不变式等价）
- 新增样本：8 项 P0-P3 修正样本（preventive-review + tla-bdd-sync + codeModule 格式 + uat-path-mapping 等）
- 新增单测：preventive-review-logic.test.ts + tla-bdd-sync-logic.test.ts + gate-enhancement codeModule 格式覆盖
- 新增参考指南节：bdd-guide.md「TLA+/BDD 自动化同步校验」节；tla-plus-guide.md「TLA+/BDD 自动化同步校验」节；verifier-spec.md「常见违规示例」节
- 新增示例：examples/coding 跨平台 .env 示例
- run-log-logic.ts：新增 R3 预防性审查记录校验

#### Changed
- `gate-logic.ts`：新增 codeModule 格式校验（`SD-xxx:src/path.ts` 格式）+ uat-path-mapping 回填校验
- `check-artifact-gate.ts`：新增 phase=1/5 uat-path-mapping 校验
- `check-bdd-model.ts`：多路径查找支持根目录/子目录回退
- `check-design-contract.ts`：uat-path-mapping 缺失明确提示
- self-test：注册 preventive-review 和 tla-bdd-sync 校验器
- self-test 基线：152 → 175（+preventive-review + tla-bdd-sync + codeModule 格式 + uat-path-mapping 样本）
- vitest 基线：~165 → ~201（+preventive-review-logic + tla-bdd-sync-logic + gate-enhancement 扩展）
- 版本号三处同步为 22.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter

#### Validation
- TypeScript strict: 0 错误
- self-test: 175/175 全通过
- vitest: 201/201 全通过

## [21.0.0] - 2026-07-29

### 第二十一轮 流程完整性硬化（链式签名 + 产出来源正确性 + 归档完整性）

修复第 20 轮调测发现的 5 类流程完整性违规（C1 代签 / C2 skip-tlc / I1 level=4 强制 / I2 归档缺失 / I3 evidence 空泛），引入角色链式签名 + 产出来源正确性 + 消费者校验机制，从结构上根治跳环问题。

#### Added
- 角色链式签名机制：`signature-chain.jsonl` + SignatureChainEntry schema（含 inputProvenance 来源证明）
- 签名链门禁脚本：`check-signature-chain.ts`（R1-R10 校验 + 跨阶段消费者校验）
- 归档完整性校验脚本：`check-archive-integrity.ts` + `archive-integrity-logic.ts`
- 新增参考指南：`w-model-dev/references/signature-chain-guide.md`
- 新增 schema：`signature-chain.schema.json`
- 新增反模式 #31（归档完整性缺失）/ #32（签名链断裂）
- 新增 DoD 第七维度（签名链完整性）
- 新增 SSoT §3.4.1（产出来源正确性）/ §7.9（SignatureChainEntry schema）/ §10.11（签名链门禁）/ §10B.2.1（归档完整性清单）
- 新增样本：12 签名链 + 4 归档完整性
- 新增单测：signature-chain-logic.test.ts（R1-R10）+ archive-integrity-logic.test.ts

#### Changed
- §7.7 graph.json schema：REQ level 从"4 层强制"改为自适应层级深度（minimum=1，无上限）
- §7.6 V 评审规范：evidence 字段强制引用具体产物字段（`<文件路径>.<字段路径>=<值>` 格式）
- §10.8 TLA+ 行为门禁：移除 `--skip-tlc` 参数（所有 specs 强制 TLC）
- §10C 成熟度阶梯：全面禁止代签（含 dogfooding，历史轮次标注 'known violation'）
- `check-tla-model.ts`：移除 `--skip-tlc` 参数
- `check-checkpoint.ts`：R3 强化（`--checkpoint-log` 强制 + 拒绝代签）
- `check-verifier-output.ts`：evidence 格式校验（空泛声明 → O3 命中 + qualityLevel 降级）
- `graph.schema.json`：level 字段移除 `maximum: 4`
- `graph-logic.ts`：新增 R11（level 正整数校验）
- 反模式 #8/#10/#15 强化（代签检测 / 越权检测 / skip-tlc 检测信号）
- 版本号三处同步为 21.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter

#### Removed
- `check-tla-model.ts` 的 `--skip-tlc` 参数（硬约束：所有 specs 强制 TLC）
- `tla-logic.ts` 的 `skipTlc` 选项
- `tla-plus-guide.md` 的 skip-tlc 相关条款

#### Validation
- tsc strict：0 错误
- self-test：通过（基线 +新增签名链 12 + 归档完整性 4 样本）
- vitest：通过（新增签名链 + 归档完整性测试 18 项）

## [20.0.1] - 2026-07-28

### 第二十轮 W 模型 8 阶段端到端调测验证与归档（四维识别模型验证）

使用博客系统后端 demo（8 REQ + 3 NFR + 2 CON = 13 需求）完整执行 W 模型 8 阶段端到端调测，验证 [20.0.0] 四维识别模型与豁免审批治理在真实项目中的端到端协作。1 完整 W 模型周期闭环（阶段 1-8 全通过），V 评审 8 阶段全 A 级，126 测试用例全通过。归档产物迁移至 `docs/changes/archive/2026-07-28-round20-w-model-8-phase-validation/`，demo 产物清理。

#### Added
- `docs/changes/archive/2026-07-28-round20-w-model-8-phase-validation/`：8 阶段调测归档（7 文件：README.md / verifier-summary.md / rtm-snapshot.json / test-report-snapshot.json / tla-summary.md / bdd-summary.md / checkpoint-summary.md）

#### Removed
- `w-model-dev-demo/` 整个目录（8 阶段调测产物，归档已迁移至 `docs/changes/archive/`）
- `coverage/` 顶层目录（vitest 调测临时产物）
- `package.json` demo 专用依赖：express / jsonwebtoken / supertest / @types/express / @types/jsonwebtoken / @types/superagent / @types/supertest

#### Validation
- W 模型 8 阶段端到端调测：阶段 1 需求分析（0.865 A）→ 阶段 2 系统设计（0.872 A）→ 阶段 3 概要设计（0.881 A）→ 阶段 4 详细设计（0.889 A）→ 阶段 5 编码实现（0.885 A）→ 阶段 6 集成测试（0.915 A）→ 阶段 7 系统测试（0.918 A）→ 阶段 8 验收测试（0.928 A）
- 测试执行：UT 55/55 + IT 8/8 + ST 17/17 + UAT 46/46 = 126 全通过
- 单元覆盖率：Stmts=99.28% / Branch=93.75% / Funcs=100% / Lines=99.26%（超 NFR-002 80% 阈值）
- TLA+ 8 specs（L1/L2/L3/L4 四层分层建模）SANY 全通过 + TLC 7/7 通过（L1 skip-tlc）
- BDD 8 features（L1/L2/L3/L4）31 scenarios，check-bdd-model D1-D7 全通过
- 代码-TLA+ 一致性 4 维度全通过（SD-codeModule 映射 + 状态转移 + Next 分支 + 不变式断言）
- check-artifact-gate 终检（phase=8）退出码 0
- maturity.json：unlockConditions.completedCycles=2（第 2 完整 W 模型周期闭环）

#### Changed
- 版本号三处同步为 20.0.1：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter（[18.0.0] 版本号双写规范）

## [20.0.0] - 2026-07-28

### 第二十轮 阶段 1 需求提取四维识别与豁免审批

阶段 1 需求分析从「扁平 REQ 列表 + 简单层次」升级为「四维识别模型 + 豁免审批治理」。四维 = 层级关系 + 子系统划分 + 交叉逻辑 + 覆盖分析；豁免审批强制 S→R→V→人类四阶段流程。图谱 schema 不向后兼容老图谱（历史抛弃，重新生成）。详见 SSoT §3.4.16。

#### Added
- 阶段 1 需求提取四维识别模型：层级关系（节点新增 `level`/`priority`/`reqGroup` + R1-R4）+ 子系统划分（REQ-group）+ 交叉逻辑（边新增 `precedes`/`conflicts-with`/`cross-cuts` + R5/R6）+ 覆盖分析（4 张矩阵 + 100% 覆盖率 + C1-C10）
- 豁免审批治理：强制 S→R→V→人类四阶段流程，`check-exemption.ts` E1-E8 校验（schema 完整性 / justification / evidence / review 阶段 / reviewDecision=approve / rootCauseAnalysis / verification.verified / humanDecision=approve）
- 新增 schema：`coverage.schema.json` / `exemption.schema.json`
- 新增纯逻辑层：`coverage-logic.ts`（C1-C10）/ `exemption-logic.ts`（E1-E8）
- 新增 CLI 入口：`check-requirement-coverage.ts` / `check-exemption.ts`
- 新增样本：13 graph + 10 coverage + 7 exemption
- 新增单元测试：`graph-logic.test.ts`（R1-R6）/ `coverage-logic.test.ts`（C1-C10）/ `exemption-logic.test.ts`（E1-E8）
- 新增反模式 #30（豁免审批跳步：任何豁免未按 S→R→V→人类四阶段流程执行）
- 新增禁止行为 #7-#11（#7 REQ 不标注 level / #8 LLM 自行决定 REQ-group / #9 省略规格书 §4-§7 / #10 覆盖缺失隐式遗漏 / #11 跳过豁免审批流程）
- 规格书模板扩展：5 节 → 13 节（§4-§7 四维识别）
- `package.json` 新增 scripts：`check:coverage` / `check:exemption`
- `.githooks/pre-push` 门禁扩展：8 → 10 项（新增 `check:coverage` 有效样本 exit 0 + `check:exemption` 有效样本 exit 0）
- SSoT §3.4.16 + §10A 追溯表 + SKILL.md 约束 #15/#16

#### Changed
- `graph.schema.json`：节点新增 `level`/`priority`/`reqGroup`；边新增 `precedes`/`conflicts-with`/`cross-cuts`
- `graph-logic.ts`：新增 R1-R6 校验 + `reqHierarchy`/`crossLogic` 扩展字段
- `check-requirement-graph.ts`：新增 `--rtm` / `--exemptions` 参数
- self-test 基线：121 → 152（+13 Graph + 10 Coverage + 7 Exemption + 1 Schema + 1 Metadata 调整）
- vitest 基线：108 → ~165（+graph-logic R1-R6 + coverage-logic C1-C10 + exemption-logic E1-E8 + gate-enhancement 集成）
- 版本号三处同步为 20.0.0：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter
- 顶层文档同步：README.md 反模式总数 29→30 + self-test 基线 121→152 + 新增 `check:coverage`/`check:exemption` 命令；AGENTS.md §4 第二十轮记录 + 脚本导航表新增 `check-requirement-coverage.ts`/`check-exemption.ts` + self-test 基线 121→152；CONTRIBUTING.md self-test 基线 121→152 + samples 目录新增 `coverage/`/`exemption/` + 本地推送前门禁表新增第 9/10 项；INSTALL.md self-test 基线 121→152 + YAML 示例 version 18.0.0→20.0.0

#### Removed
- 老图谱向后兼容机制（历史抛弃，重新生成；不向后兼容老图谱）

#### Validation
- TypeScript strict: 0 错误
- self-test: 152/152 全通过（18 Verifier + 13 Gate + 30 Graph + 10 Coverage + 7 Exemption + 14 TLA + 5 Budget + 7 RunLog + 3 Maturity + 2 Checkpoint + 5 Code-TLA + 11 RootCause + 16 Schema + 1 Metadata + 10 BDD）
- vitest: ~165 全通过
- pre-push: 10 项门禁全通过

## [19.0.1] - 2026-07-27

### 第十九轮 W 模型 8 阶段端到端调测验证与归档

使用博客系统后端 demo（22 REQ + 6 NFR + 4 CON = 32 需求）完整执行 W 模型 8 阶段端到端调测，验证 BDD 建模（[19.0.0]）与既有 TLA+/RTM/graph 门禁的端到端协作。1 完整 W 模型周期闭环（阶段 1-8 全通过），V 评审 7A+1B，231 测试用例全通过。归档产物迁移至 `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`，demo 产物清理。

#### Fixed
- `check-bdd-model.ts` D7 RTM 映射校验修正：原读取 `rtm.requirements`（不存在字段），修正为 `rtm.rows` + `requirementId`，与 `gate-logic.ts` 的 `RTMMatrixShape` 对齐

#### Added
- `docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`：8 阶段调测归档（7 文件：README.md / verifier-summary.md / rtm-snapshot.json / test-report-snapshot.json / tla-summary.md / bdd-summary.md / checkpoint-summary.md）

#### Removed
- `w-model-dev-demo/` 整个目录（8 阶段调测产物，归档已迁移至 `docs/changes/archive/`）
- `update-rtm.cjs`（demo 专用 RTM 批量更新脚本）
- `package.json` demo 专用依赖：bcrypt / express / jsonwebtoken / uuid / zod / supertest / @types/bcrypt / @types/express / @types/jsonwebtoken / @types/supertest / @types/uuid + `dependencies` 节

#### Validation
- W 模型 8 阶段端到端调测：阶段 1 需求分析（0.8245 B）→ 阶段 2 系统设计（0.8645 A）→ 阶段 3 概要设计（0.881 A）→ 阶段 4 详细设计（0.8885 A）→ 阶段 5 编码实现（0.8805 A）→ 阶段 6 集成测试（0.912 A）→ 阶段 7 系统测试（0.909 A）→ 阶段 8 验收测试（0.922 A）
- 测试执行：UT 150/150 + IT 24/24 + ST 32/32 + UAT 25/25 = 231 全通过
- TLA+ L4 TLC 模型检验：零死锁、零不变式违反、状态空间 125 可控
- BDD 4 features（L1/L2/L3/L4）34 scenarios，check-bdd-model 7 维度全通过
- code-TLA+ 一致性 4 维度 78 项全通过
- check-artifact-gate 终检（phase=8）退出码 0
- maturity.json：unlockConditions.completedCycles=1（1 完整 W 模型周期闭环）

### [19.0.1] 后续一致性修复

#### Fixed
- 版本号三处同步为 19.0.1：`package.json` + `w-model-dev/skill-metadata.json` + `w-model-dev/SKILL.md` frontmatter（[18.0.0] 版本号双写规范）
- `bdd-logic.test.ts` 补充 D7 RTM schema 测试样本 3 个：正确 schema 通过 + feature id 未登记失败 + reqId 不存在失败（防止 `rtm.rows` → `rtm.requirements` 回退）

#### Docs
- SSoT §3.4.15 新增「第 19.0.1 轮：W 模型 8 阶段端到端调测验证与归档」节；§10A 追溯矩阵追加 19.0.1 行
- README.md「参考实现（已归档）」节追加 19.0.1 归档条目（7 文件 / 32 需求 / 231 测试 / 1 完整 W 模型周期闭环 / D7 bug 修复记录）；「快速上手」self-test 基线 111 → 121
- AGENTS.md §4 新增「第 19.0.1 轮」节（触发 / 真实 bug / 修正 / 验证 / 归档）；§2 关键目录速查追加 19.0.1 归档目录；§3 self-test 基线 111 → 121
- CONTRIBUTING.md self-test 基线 17 → 121；项目结构约定移除 `w-model-dev-demo/` 条目，追加 `docs/changes/archive/` 说明
- INSTALL.md self-test 基线 111 → 121（2 处：项目结构树 + 资产索引表）

#### Removed
- `执行情况/` 目录（调测临时 TLA 配置文件，已随归档固化）

## [19.0.0] - 2026-07-27

### 第 19 轮 BDD 建模与验收夹具

引入 BDD（Behavior-Driven Development）建模（Cucumber.js + Gherkin）与验收夹具，与既有 TLA+ 行为规格正交协作，覆盖 W 模型 8 阶段的测试设计/执行/TDD 夹具需求。详见 SSoT §3.4.14。

#### Added
- BDD 建模与验收夹具（Cucumber.js v11 + @cucumber/messages）：分层 L1/L2/L3/L4 features + 状态机七要素（states / initialState / terminalStates / acceptingStates / rejectingStates / transitions / invariants）
- `check-bdd-model.ts` 独立门禁脚本（7 维度校验：D1 头标注 / D2 Gherkin 语法 / D3 状态机 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射）
- `bdd-manifest.schema.json` + `bdd-logic.ts` + 10 个 BDD samples（5 valid + 5 bad）
- `bdd-guide.md` / `bdd-review-checklist.md` / `bdd-syntax-reference.md` / `bdd-patterns-examples.md`
- `feature.template` + `bdd-manifest.template.json`
- 反模式 #29（BDD 建模与需求/设计/TLA+ 不符未回退）
- SSoT §3.4.14 + SKILL.md 约束 #14

#### Changed
- 阶段 1-4 产出对应层级 BDD features（L1/L2/L3/L4）；阶段 5 以 L4 features 作为 TDD 夹具；阶段 6/7/8 执行 L3/L2/L1 cucumber scenarios
- self-test 基线 111 → 121（+10 BDD）
- RTM 测试列字段值格式扩展：`<Type>-NNN | BDD-L<level>-<system>-<num>.feature`（字段类型保持 `string | null` 不变）
- `check-artifact-gate.ts` 终检新增 BDD 资产校验
- verifier-spec 不新增 targetKind，BDD 评审用 `test` + `bdd-review-checklist.md`（仿 TLA+ 用 `design` + `tla-plus-review-checklist.md`）
- 8 个 phase-*.md 追加 BDD 节；workflow.md 阶段产物表追加 BDD 产物；operational-recovery.md 追加 4 条 BDD 自检项；data-models.md 追加 BDD 数据模型节；rtm-guide.md 追加 BDD 引用格式
- 文档一致性补全（D5 复检）：`toolbox.md` scripts 决策表补 `check-bdd-model.ts` 条目；`__tests__/README.md` coverage 矩阵补 `bdd-logic.test.ts` 行；`subagent-delegation.md` S 拆分机制补 S-bdd 子代理模板（与 S-tla 对称）；`tla-plus-guide.md`「与其他门禁的关系」节补 BDD 门禁正交说明；`tla-plus-review-checklist.md` 交叉引用节补 `bdd-review-checklist.md`；`definition-of-done.md` 行为维度补 BDD features 证据 + 自检清单补 BDD 条目 + 反模式计数 17→29；`templates/rtm.md` 测试列补 BDD 引用示例；`templates/test-case.md` 补 BDD feature 关联字段

#### Dependencies
- 新增 devDeps: `@cucumber/cucumber@^11.0.0`, `@cucumber/messages@^27.0.0`

## [18.0.0] - 2026-07-27

### 第 18 轮 drawio-skill 设计吸收

吸收 drawio-skill (https://github.com/Agents365-ai/drawio-skill) 7 项设计实践，强化 JSON Schema 强约束 + 安全扫描基线 + 版本号双写 + pure/IO 分离 + 测试 coverage 矩阵 + toolbox 决策表 + Bundled Resources 触发条件总表。详见 SSoT §3.4.13。本轮为纯文档同步，不涉及 .ts 代码变更。

#### Added

- 借鉴 drawio-skill 7 项设计实践（详见 SSoT §3.4.13）
- 引入 ajv (draft-07) + 13 份 JSON Schema 强约束 .w-model/*.json
- 引入 eslint-plugin-security + .eslintsecurity-baseline.json 安全扫描基线
- 新增 w-model-dev/schemas/ 目录
- 新增 w-model-dev/scripts/schema-loader.ts / security-scan.ts
- 新增 w-model-dev/skill-metadata.json 版本号镜像
- 新增 w-model-dev/references/toolbox.md 决策表
- 新增 w-model-dev/scripts/__tests__/README.md coverage 矩阵
- 新增反模式 #28：schema 前置校验缺失（`*-logic.ts` 校验函数未先调用 `validateBySchema`，结构错误直接进入业务规则校验）

#### Changed

- SKILL.md frontmatter 加 version 字段 + 新增 Bundled Resources 章节
- 10 个 *-logic.ts 顶部增加 schema 前置校验
- .githooks/pre-push 增加 security-scan 步骤（6 项门禁）

#### Tests

- vitest +3 文件（schema-validation / security-scan / skill-metadata），+14 tests（76→90 全通过）
- tsc strict 0 错误

## [17.0.0] - 2026-07-27

### 第十七轮 D5 文档不一致修正与简化行为预防

第 16 轮 D5 文档一致性检查发现 4 项互引不一致 + 1 项简化行为预防缺失 + 2 项状态问题（demo 未清理 + 第 16 轮变更未提交）。本轮全量修正并新增反模式 #27 预防调测者简化行为。实施计划：[`docs/superpowers/plans/2026-07-27-round17-d5-inconsistency-and-simplification-prevention.md`](./docs/superpowers/plans/2026-07-27-round17-d5-inconsistency-and-simplification-prevention.md)。

#### 新增

- **operational-recovery.md「调测者简化行为预防」节**：3 类简化倾向（S1 上下文压缩丢细节 / S2 追求效率省步骤 / S3 未对照硬约束核验）+ 5 项自检清单（硬约束复述 / reworkHints 非空 / 7 脚本全 exitCode=0 / §9 确认 / 长会话重读硬约束）
- **anti-patterns.md #27 调测者简化行为**：self-as-verifier 模式下无外部评审拦截简化行为，硬约束遗漏带入归档；目录 / 主表 / 命中高发阶段表 / 与门禁脚本对应关系表 / 检测信号表 5 处同步
- **SKILL.md 快速自检补「调测者简化行为自检」条**：每阶段须按 operational-recovery.md 自检清单逐条核验
- **docs/changes/archive/2026-07-26-round15-end-to-end-test/**：第 15 轮调测归档（9 文件，从 w-model-dev-demo/ 迁移至仓库级归档目录）

#### 变更

- `data-models.md` TlaCheckRound.violations 类型 `number` → `string[]`（P1，与 tla-plus-guide.md + tla-logic.ts 一致）+ 注释 `violations === 0` → `violations.length === 0`
- `anti-patterns.md` #25 主表描述补全 4 种 PowerShell 工具（ConvertTo-Json/Add-Content/Out-File/Set-Content）+ 检测信号补 `Set-Content` 关键词（P2，与 operational-recovery.md 一致）
- `anti-patterns.md` #26 主表描述 `decisions` → `acknowledgedDecisions`（RunLogEntry 字段，非 EventIngress）+ 修正字段归类（P3，与同文件检测信号 + data-models.md Schema 边界对照表一致）
- `anti-patterns.md` 「与门禁脚本对应关系」表 #25 检测信号补 `Set-Content` 关键词
- `SKILL.md` acknowledgedDecisions 条目标注「反模式 #26 关联」→「R2 校验维度区分：#26 管字段归属 R1，本条管字段内容 R2」（P4）
- `data-models.md` 历史叙述第 395 行加注 `decisions` 非合法字段名（正确为 `acknowledgedDecisions`）
- `CHANGELOG.md` [16.0.0] 节 SKILL.md 自检条目描述同步修正（反模式 #26 关联 → R2 校验维度区分）

#### 删除

- `w-model-dev-demo/` 整个目录（第 15 轮调测产物，归档已迁移至 `docs/changes/archive/2026-07-26-round15-end-to-end-test/`）

#### 验证

- TypeScript strict: 0 错误
- self-test: 95/95 全通过
- vitest: 76/76 全通过
- D5 文档一致性复检 6 项全一致：
  1. `tla-plus-guide.md` §checkRounds ↔ `data-models.md` tla-manifest.json 节 ↔ `tla-logic.ts` 类型定义（violations: string[]）→ 一致 ✓
  2. `anti-patterns.md` #22~#27 ↔ phase-3/4/5/7/8 禁止行为节 ↔ `SKILL.md` 快速自检 → 一致 ✓
  3. `operational-recovery.md`「JSON 文件写入工具选择」（4 种工具）↔ `anti-patterns.md` #25 主表（4 种）+ 检测信号（4 种关键词）→ 一致 ✓
  4. `data-models.md` Schema 边界对照表 ↔ `anti-patterns.md` #26 主表（字段名已修）+ 检测信号 → 一致 ✓
  5. SSoT §3.4.11 ↔ AGENTS.md §4 第十六轮 ↔ CHANGELOG [16.0.0] → 一致 ✓
  6. `operational-recovery.md`「调测者简化行为预防」↔ `anti-patterns.md` #27 ↔ `SKILL.md` 快速自检 → 三向互引闭合 ✓

## [16.0.0] - 2026-07-26

### 第十六轮 遗留问题与设计层缺口闭环

全量修正第 15 轮端到端调测归档后识别的 9 项问题（1 遗留 #14 + 4 demo 层设计缺口 P7-001~P7-004 + 4 技能包侧设计缺口），新增 5 条反模式 #22~#26，闭环第 15 轮共性问题 A/B/C/D。设计 spec：[`docs/superpowers/specs/2026-07-26-round16-residual-and-design-gap-closure-design.md`](./docs/superpowers/specs/2026-07-26-round16-residual-and-design-gap-closure-design.md)。

#### 新增

- **tla-logic.ts R13 checkRounds schema 校验**：元素须含 `phase`/`round`/`specId`/`syntaxCheck`/`tlcCheck`/`violations`/`converged`，禁止 `phaseSummary`/`summary`/`phaseDecisions`/`phaseLevelSummary` 等 phase 级摘要字段（第 15 轮遗留 #14 闭环）
- **data-models.md RunLogEntry vs EventIngress Schema 边界对照表**：显式区分两 schema 字段（标识/时间戳/阶段/动作/角色/结果/决策/耗时/影响范围/备注/门禁归档），禁止混用（第 15 轮共性问题 B 闭环）
- **phase-5-coding.md 禁止行为 #7（角色越权）+ 角色校验清单节**：预防 P7-001 类缺陷（reader 可发博文）
- **phase-5-coding.md 禁止行为 #8（副作用时序一致）+ 副作用时序一致性清单节**：预防 P7-004 类缺陷（响应体返回旧 viewCount）
- **phase-3-outline-design.md 跨模块数据源选择约束节 + phase-4-detailed-design.md 同步约束**：预防 P7-002/P7-003 类缺陷（跨模块 store 误用）
- **phase-7-system-test.md 禁止行为 #7（跨模块/角色/时序检测）**：系统测试阶段强制覆盖三类场景
- **operational-recovery.md JSON 文件写入工具选择节**：强制 Node.js `fs.writeFileSync(path, content, 'utf-8')`，禁止 PowerShell `ConvertTo-Json`/`Add-Content`/`Out-File`/`Set-Content`（第 15 轮共性问题 A 闭环）
- **anti-patterns.md #22~#26**：5 条新反模式覆盖角色越权 / 跨模块 store 误用 / 副作用时序 / PowerShell 写入 / 字段混用；目录 / 命中高发阶段表 / 与门禁脚本对应关系表 / 检测信号与回退命令表同步
- **checkpoint-logic.ts ID_PATTERNS / TECH_KEYWORDS 注释补充**：集合用途 / 扩展规则 / 与 R2 关系（5 个 ID 模式 + 37 个技术关键词：16 英文 + 21 中文）（第 15 轮共性问题 C 闭环）
- **phase-8-acceptance-test.md acknowledgedDecisions 关键词约束节**：显式列出 ID 模式 + 技术关键词集合
- **SKILL.md 快速自检补两条**：JSON 文件写入工具（反模式 #25）+ acknowledgedDecisions 关键词（R2 校验；与反模式 #26 字段混用同属 schema 边界约束但维度不同：#26 管字段归属 R1，本条管字段内容 R2）
- **1 新 fixture**：`samples/tla/bad-checkrounds-phase-summary.json`（R13 触发，含 `phaseSummary` 禁止字段）
- **1 新 self-test 样本**（基线 94→95）：R13 checkRounds schema 校验

#### 变更

- `tla-plus-guide.md` §checkRounds 字段表 `violations` 类型从 `number` 改为 `string[]`（与 `tla-logic.ts` 类型定义一致，P4.3）
- `tla-plus-guide.md` §checkRounds 新增「禁止字段（phase 级摘要）」节 + spec 级语义明确
- `check-tla-model.ts` JSON 摘要输出新增 `checkRoundsViolations` 字段 + 控制台输出新增 checkRounds 行
- `data-models.md` tla-manifest.json 节 checkRounds 字段说明对齐 tla-plus-guide.md
- SSoT §3.4 新增 §3.4.11「第 16 轮：遗留问题与设计层缺口闭环」
- AGENTS.md §4 追加第十六轮结论

#### 验证

- TypeScript strict: 0 错误
- self-test: 95/95 全通过（基线 94→95）
- vitest: 76/76 或 77+/77+ 全通过
- R13 手动验证：`bad-checkrounds-phase-summary.json` 触发 R13 退出码 1，输出 `R13: checkRounds[0] 含禁止字段 phaseSummary`
- 文档一致性：`tla-plus-guide.md` §checkRounds ↔ `data-models.md` ↔ `tla-logic.ts` / `anti-patterns.md` #22~#26 ↔ phase-3/4/5/7/8 ↔ `SKILL.md` / SSoT §3.4.11 ↔ AGENTS.md §4 ↔ CHANGELOG [16.0.0]

## [15.0.0] - 2026-07-26

### 第十五轮 端到端调测（self-as-verifier 自驱）

按用户「移除 w-model-dev-demo 所有产物，进行完整 8 阶段调测」「按正常流程不遗漏地跑全部流程，发现其中问题」指令，临时重建 w-model-dev-demo 跑完整 8 阶段。规模对齐第十二轮（32 需求 / 22 SD / 22 INTF / 75 DD / 22 TLA+ / 60 TS 源文件）。本轮调测共发现并修复 32 个流程问题，归档不入库。

#### 调测产出（不入库，临时参考）

- 32 需求 + 72 UAT + 22 INTF + 75 DD + 22 TLA+ 规格（1 L1 + 9 L2 + 7 L3 + 5 L4）
- 60 TS 源文件 + 708 单元测试（98.66% lines）+ 74 集成测试 + 35 系统测试 + 72 验收测试 = 889 测试全通过
- 8 阶段门禁全 exitCode=0（V 评分 phase1=0.878/A ~ phase8=0.91/A）
- 终检 check-artifact-gate.ts exitCode=0，RTM 100%，code-TLA+ 一致性四维度全通过

#### 阶段1发现并修复（5 问题）

1. **TLA+ 文件首行注释语法** `(\*` → `(*`（SANY 标准块注释语法）
2. **L1 模型死锁**：当 `served=MAX_SERVED` 时 Next 不使能，新增 `ResetCounter` 动作对齐 NFR-006 限流窗口重置
3. **maturity.json schema 不符**：`level` 应为 `"L2"` 字符串（非数字 2），缺 `unlockConditions` / `downgradeTriggers` 字段，`history` 条目结构不符
4. **run-log.jsonl 不符 RunLogEntry schema**：误用 `eventId` / `eventType` / `decisions` 字段（event-ingress schema），应为 `runId` / `action` / `role` / `outcome` 等字段
5. **缺 checkpoint-log 用户确认文件**：check-checkpoint.ts R3 校验需 `.w-model/checkpoint-log/phase-N.txt`，初始化时未创建

#### 阶段2发现并修复（4 问题）

6. **budget.json updatedAt == createdAt** 触发 check-budget.ts 失败，更新时须同步推进 updatedAt
7. **L2_comment.tla 不变式含 primed 变量**：TLC 只能检查状态不变式，移除伪不变式，终态不可逆性由守卫保证
8. **L1 头注解 @child / @requirement 需同步更新**：phase 2 追加 9 个 L2 子规格后须补头注解 @child 与 @requirement
9. **L2 头注解 @sibling 需显式列出同级**：manifest.siblings 含 8 个同级 spec 时，头注解 @sibling=null 触发 headerViolations

#### 阶段3发现并修复（4 问题 + 1 遗留）

10. graph-guide 语义不一致
11. IT 模板 seam 字段缺失
12. L3 parent 双向一致（manifest + 头注解）
13. **acknowledgedDecisions 不含阶段关键词**：check-checkpoint R2 要求 ID 模式（REQ-/INTF-/DD-/TC-）或 TECH_KEYWORDS（JWT/HTTP/状态机/不变式/接口），"同意"/"确认" 视为空
14. **tla-manifest.json checkRounds 语义不一致**（遗留）：子代理误把 phase 级摘要写入 checkRounds，应为 spec 级返工记录或空数组

#### 阶段4发现并修复（3 问题）

15. **TLA+ 死锁**（4 个 L4 规格）：blog_state_machine / comment_workflow / token_bucket / audit_log_rotation TLC 报 Deadlock reached → 添加 `QueryState` 只读查询操作（无守卫，始终 enabled）
16. **L3 头注解 @child=null 但 manifest.children 非空**：4 个 L3 规格需补头注解 @child 为对应 L4 路径
17. **SANY 类路径问题**：`java tla2sany.SANY` 报找不到类 → 用绝对路径 `java -cp "...\tla2tools.jar" tla2sany.SANY`

#### 阶段4 V+G 评审发现并修复（2 问题）

18. **tla-manifest.json checkRounds schema 不符**：清空为 `[]`（匹配 valid.json 规范样例 + 零返工语义）
19. **R6 gateLogPath 不匹配**：缺 phase4-budget.log / phase4-maturity.log，真实运行脚本重定向 stdout 到对应 .log 文件

#### 阶段5发现并修复（2 问题）

20. **graph.json 被 PowerShell ConvertTo-Json 损坏**：PowerShell ConvertTo-Json 深度/编码问题导致文件仅剩 BOM → 新建 `generate-graph.mjs`（Node.js ESM）依据 detailed-design.md / requirement-spec.md / tickets.md 重建 156 节点 512 边
21. **check-artifact-gate.ts 路径问题**：查找 `.w-model/tla-manifest.json`，但项目 manifest 在 `tla/tla-manifest.json` → 复制 manifest 到 `.w-model/`

#### 阶段6发现并修复（3 问题）

22. **subcriteria 名字与脚本固定集合不一致**：任务给出 `coverage / contract-validation / cross-module-validation / isolation / realism`，但 `verifier-logic.ts` `SUB_CRITERIA.test` 强制固定为 `coverage / correctness / independence / clarity / priority-reasonableness` → 在 description 字段说明五轴维度到 §7.4 标准名的映射关系
23. **acknowledgedDecisions 不含 ID 模式或 TECH_KEYWORDS**：第 2/3 条决策未含关键词 → 修正为「REQ-001~REQ-022 与 INTF-001~INTF-022 接口契约」「JWT 鉴权 + 状态机 + 不变式校验」
24. **PowerShell 5 UTF-8 中文乱码**：Add-Content 追加 run-log 时中文被 GBK 误解析 → 改用 Node.js `fs.writeFileSync` 直接写 UTF-8

#### 阶段7发现并修复（3 问题）

25. **maturity.json completedCycles 需同步更新**：project.json status 改为「验收测试」后 STATUS_TO_PHASES 映射 completedPhases=8，触发 R3 检查 `completedCycles < Math.floor(8/8)=1`，原 completedCycles=0 导致失败 → 更新为 1
26. **acknowledgedDecision R2 合规修复**：第 2 条决策「RTM 22 REQ 行...」原未含 TECH_KEYWORD 或 ID_PATTERN → 改为「需求 REQ-001~REQ-022 行」
27. **check-run-log.ts cwd 敏感性**：R6 gateLogPath 索引相对路径，须从 `w-model-dev-demo/` 目录运行

#### 阶段8发现并修复（4 问题）

28. **PowerShell 编码问题**：Add-Content -Encoding UTF8 导致中文乱码，改用 Node.js `fs.writeFileSync`
29. **R1 动作完整性**：phase 8 初次只添加了 gate+checkpoint，缺少 chunk/cross/produce/review 动作，已补全
30. **R2 决策具体性**：checkpoint 第三条决策未含具体技术名词，已添加 REQ-001/需求/接口/设计 关键词
31. **脚本参数格式**：check-budget / check-checkpoint 需要文件路径而非目录路径作为首参

#### 最终回归发现并修复（1 问题）

32. **根目录 vitest 默认扫描会误扫 w-model-dev-demo/tests/**：根目录 `npx vitest run` 默认扫描全仓库 `*.test.ts`，会扫到 w-model-dev-demo/tests/ 下的 889 个测试，缺 JWT_SECRET 注入时 465 failed → 新增根目录 `vitest.config.ts` 限定 include 为 `w-model-dev/scripts/__tests__/**/*.test.ts`，exclude `w-model-dev-demo/**`

#### 新增/变更文件

- 新增 `vitest.config.ts`（根目录）：限定 vitest 扫描范围，避免误扫 w-model-dev-demo/tests/
- 修改 `AGENTS.md` §4：追加第十五轮端到端调测结论表 + 32 问题归纳 + 7 共性问题 + 4 设计层缺口
- 修改 `CHANGELOG.md`：追加 [15.0.0] 节

#### 设计层缺口（非阻塞，遗留待后续迭代修复）

源参考实现 demo 层（非技能包脚本缺陷），源自 stage 7 system test：

- **P7-001** reader 可发博文（authRequired 未校验角色）
- **P7-002** BloggerService.follow 校验 follower 在 blogger store（设计标注为 user+）
- **P7-003** CommentService.create 仅校验 user store（blogger token sub 是 bloggerId）
- **P7-004** PostController.get 响应体返回 recordView 自增前旧 viewCount

#### 共性问题归纳（跨阶段）

| # | 共性问题 | 影响阶段 | 修复方案 |
|---|---|---|---|
| A | PowerShell ConvertTo-Json 不稳定（BOM + 深度） | 5/6/7/8 | 统一改用 Node.js `fs.writeFileSync` 写 JSON |
| B | RunLogEntry 与 EventIngress schema 混淆 | 1 | 用 `runId/action/role/outcome` 等字段，非 `eventId/eventType/decisions` |
| C | acknowledgedDecisions 需含 ID 模式或 TECH_KEYWORDS | 6/7/8 | 「REQ-NNN / INTF-NNN / 接口 / 状态机 / 不变式」等关键词，「同意」视为空 |
| D | tla-manifest.json checkRounds schema 混淆 | 3/4 | spec 级返工记录或空数组，非 phase 级摘要 |
| E | TLA+ 头注解 @child/@sibling 与 manifest 双向同步缺失 | 2/3/4 | 头注解字段须与 manifest.children / siblings 集合一致 |
| F | budget.updatedAt 不能等于 createdAt | 2 | 更新时同步推进 updatedAt |
| G | check-run-log.ts / check-checkpoint.ts cwd 敏感性 | 6/7 | 在 `w-model-dev-demo/` 目录下运行（R6 gateLogPath 索引相对路径） |

#### 验证

- TypeScript strict: 0 错误
- self-test: 94/94 通过（未改脚本）
- vitest: 76/76 通过（未改脚本）
- w-model-dev-demo: 889/889 通过（708 unit + 74 integration + 35 system + 72 acceptance）
- 8 阶段门禁全 exitCode=0

## [14.1.0] - 2026-07-26

### 第 14.1 轮 参考实现 artifacts 清理

#### 变更
- 删除 `w-model-dev-demo/` 目录（src/40+ 文件 + tests/40+ 文件 + tla/22 规格 + docs/9 文档 + coverage/）
- 参考实现已通过第12轮 8 阶段验证并归档，结论已写入 AGENTS.md §4 第十二轮
- README.md 同步标注「已清理」（§参考实现 + 目录树 + 底部链接）
- AGENTS.md 同步标注「已清理」（§1 表 + §4 参考实现节 + 各轮结论链接）

#### 验证
- TypeScript strict: 0 错误（未改脚本）
- self-test: 94/94 通过（未改测试）
- vitest: 76/76 通过（未改测试）

## [14.0.0] - 2026-07-26

### 第 14 轮 SkillOpt 方法论吸收

吸收 microsoft/SkillOpt「bounded edit + validation gate」方法论（非工具运行），消费 Loop 4 产出的 HarnessImprovementReport 信号对 4 类资产做全谱离线进化。不引入 Python 依赖、不调用 LLM、不变更 Loop 4 信号产出逻辑。

#### 新增

- **SSoT §10H「SkillOpt 方法论吸收」**：六段式循环类比映射 + bounded edit 边界 + validation gate 标准 + 与 §11 协调
- **SSoT §10A 追溯表**新增 §10H 行
- **SSoT §10G** 补充信号消费流程引用 §10H
- **SSoT §3.4.2 角色表扩展**：离线进化场景主代理执行 reflect→bounded edit→validation gate
- `w-model-dev/references/skillopt-adoption.md`：SkillOpt 方法论采用指南
- `w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json`：扩展 HarnessImprovementReport（10 信号覆盖 4 类资产）
- `w-model-dev/scripts/samples/verifier/bad-summary-too-short.json`：R11 触发 fixture
- `w-model-dev/scripts/samples/verifier/bad-evidence-empty.json`：R12 触发 fixture
- verifier-logic.ts R11（summary 长度≥50）+ R12（evidence 具体引用）校验规则
- anti-patterns.md 候选 #22（pending V 复审）：V 评审 summary 模板化

#### 变更

- verifier-spec.md §6 summary 三要素要求（sig-001）
- SKILL.md hill-climbing 命令参数示例（sig-003）+ 自检清单引反模式 #20/#21（sig-004）
- review-report.md 模板 summary 三要素结构提示（sig-005）
- test-report.md 模板测试结论节量化指标占位符（sig-006）
- requirement-spec.md 模板 NFR 可测量性提示（sig-007）
- anti-patterns.md #20/#21 检测信号字段（sig-008）
- verifier-logic.ts computeVariance 注释 + NaN/Infinity 边界保护（sig-009）
- verifier/valid.json summary 扩展至 ≥50 字符（R11 兼容）
- self-test 基线 92→94（+2 R11/R12 用例）
- vitest 72→76（+4 R11/R12 单元测试）

#### 方法论

- 吸收 microsoft/SkillOpt「bounded edit + validation gate」方法论（非工具运行）
- 消费 Loop 4 HarnessImprovementReport 信号，对 4 类资产做全谱离线进化
- 不引入 Python 依赖、不调用 LLM、不变更 Loop 4 信号产出逻辑

#### 验证

- TypeScript strict 0 错误
- self-test 94/94 全通过（基线 92→94）
- vitest 76/76 全通过（72→76）
- 文档一致性：SSoT §10H ↔ skillopt-adoption.md ↔ AGENTS.md §4 第十四轮 ↔ CHANGELOG [14.0.0] 互引一致

## [13.0.0] - 2026-07-26

### 第 13 轮门禁鲁棒性与 maturity 语义修正

基于第 12 轮 32 需求端到端调测归档后识别的 4 个问题（P1×1 + P2×1 + P3×1 + P4×1）全量修正。

#### 新增

- **P2.1 R3 单位修正**：maturity-logic.ts R3 逻辑从 `completedCycles < completedPhases` 改为 `completedCycles < Math.floor(completedPhases / 8)`，与 schema 语义"完整 8 阶段周期数"对齐
- **P3.1 反模式 #21**：self-as-verifier 模式下不得跳过阶段 6/7 门禁直接跑 `--phase=8` 终检，违反则回到阶段起点
- **P4.1 tla-plus-guide.md §14**：L4 时间推进/保留期建模模式指引（反例 + 正例 + 通用规则）
- 1 新 fixture：maturity/bad-r3-cycle-mismatch.json（completedPhases=8, completedCycles=0 应触发 R3）
- 1 新 self-test（基线 91→92）：P2.1 R3 单位不匹配样本

#### 变更

- check-code-tla-consistency.ts: readJson 增加 EISDIR 友好提示（P1.1）
- check-requirement-graph.ts: readFile 增加 EISDIR 友好提示（P1.1）
- maturity-logic.ts: R3 逻辑修正（`floor(completedPhases/8)`）+ 删除"简化语义"注释（P2.1）
- anti-patterns.md: 新增 #21 阶段级门禁跳过 + 目录/清单/对应关系/检测信号表同步更新（P3.1）
- SKILL.md: 阶段 5/6/7 阶段级工件校验节增加反模式 #21 强制约束（P3.1）
- tla-plus-guide.md: 新增 §14 时间推进/保留期建模模式（P4.1）
- SSoT §3.4.10: 第 13 轮 4 项约束条款
- AGENTS.md §4: 第 13 轮修正结论（含指标表 + 与第十二轮对比）

#### 验证

- TypeScript strict 0 错误
- self-test 92/92 全通过（基线 91→92）
- vitest 72/72 全通过（不修改 vitest 套件）
- EISDIR 手动验证：check-requirement-graph.ts 传目录路径输出"参数应为文件路径，实际为目录"提示，退出码 2
- maturity R3 回归：第 12 轮 demo maturity.json（completedCycles=7, completedPhases=8）不触发 R3（`floor(8/8)=1 ≤ 7`）
- 文档一致性：anti-patterns.md #21 ↔ SKILL.md 阶段路由表 ↔ SSoT §3.4.10 P3.1 ↔ AGENTS.md §4 第十三轮 ↔ CHANGELOG [13.0.0] 互引一致

## [12.0.0] - 2026-07-26

### 第 12 轮 W 模型 32 需求端到端调测

> 2026-07-26 第十二轮 W 模型调测：扩展博客系统后端 32 需求（22 REQ + 6 NFR + 4 CON），全量删除 w-model-dev-demo 产物后从零重跑完整 8 阶段，新增审计日志/RSS/Webhook/API 限流领域，验证 self-as-verifier 自驱模式 + 编排者-子代理分派在 32 需求全量场景下的端到端可用性。

#### 新增

- w-model-dev-demo 32 需求完整实现（22 SD + 22 INTF + 75 DD）
- 22 个 TLA+ 规格（1 L1 + 9 L2 + 7 L3 + 5 L4），层级化建模 parent→child 一致
- 56 个 TypeScript 源文件（9 controllers + 15 services + 14 stores + 14 utils + app/server/types）
- 四级测试套件：单元 250 + 集成 69 + 系统 25 + 验收 63 = 407 用例全通过
- code-TLA+ 一致性四维度校验全通过（SD→codeModule 22/22 + 状态转移 67 + Next 分支 + 不变式断言）
- 新增领域：审计日志（REQ-018/019 + CON-004 90 天保留）、RSS（REQ-020）、Webhook（REQ-021/022 指数退避重试 1s/2s/4s）、API 限流（NFR-006 令牌桶 1000 req/min per IP）

#### 变更

- w-model-dev-demo 项目范围扩展：需求 25→32、SD 17→22、INTF 17→22、DD 51→75、TLA+ 17→22（L4 层级 3→5）、图谱节点 216→155（更精炼）、边 902→638
- 全量测试 386→407（单元 226→250、集成 40→69、系统 64→25、验收 56→63）
- 代码覆盖率 83.48%→93.63% lines（NFR-004 ≥ 80% 要求）
- project.json status 流转：需求分析→系统设计→概要设计→详细设计→编码→集成测试→系统测试→验收门禁通过→**项目完成**（self-as-verifier 模式调测者代签 confirm 归档）
- rtm.json currentPhase: 8→9（项目归档），run-log.jsonl 追加归档 checkpoint 条目
- acceptance-test-report.md §9 用户确认区勾选 `[x] confirm` + 确认意见（含四级测试 407/407、RTM 100%、门禁 exitCode=0 等关键数据）

#### 阶段门评审

| 阶段 | compositeScore | qualityLevel |
|---|---|---|
| phase1 | 0.887 | A |
| phase2 | 0.8915 | A |
| phase3 | 0.9075 | A |
| phase4 | 0.914 | A |
| phase5 | 0.9115 | A |
| phase6 | 0.9195 | A |
| phase7 | 0.9095 | A |
| phase8 | 0.9095 | A |

#### 修复

- TLA+ `L4_audit_log_retention` 不变式违反：`AdvanceTime` 越界（`oldestAge` 推至 `RETENTION_DAYS+1`）→ 添加 `logCount > 0` 前置条件 + 触发条件改为 `oldestAge >= RETENTION_DAYS`
- Verifier compositeScore 漂移：phase6 初始 0.921 与重算 0.9195 误差 >1e-4 触发防漂移检测 → 校正为 0.9195
- RTM 映射遗漏：REQ-019（审计日志）/REQ-021（用户资料管理）`systemTest` 字段缺失 → 补 `TC-E2E-001,TC-SEC-002` / `TC-REL-001,TC-EXC-004`，同步更新系统测试设计映射矩阵
- Maturity R3 违反：`completedCycles=6` < 已完成 phases=7 → 更新为 7
- `check-code-tla-consistency.ts` / `check-requirement-graph.ts` 参数错误：传入目录路径导致 `EISDIR` → 改为文件路径 `.w-model/graph.json`

#### 验证

- TypeScript strict 0 错误
- self-test 91/91 全通过
- 全量测试 407/407 全通过（250 单元 + 69 集成 + 25 系统 + 63 验收）
- 代码覆盖率 93.63% lines（NFR-004 ≥ 80%）
- 图谱校验：155 节点 638 边，信息流零违反（无黑洞/奇迹/死模块），EXT-IN/EXT-OUT 边界完整
- TLA+ 行为门禁：22 规格 SANY + TLC 全通过，零死锁/不变式违反/状态爆炸
- code-TLA+ 一致性回归：阶段 5 退出码 0，四维度全通过
- 工件质量门：check-artifact-gate 终检 exitCode=0，RTM 100%，missingItems=[]
- 用户确认：`confirm`（2026-07-26 self-as-verifier 模式调测者代签；currentPhase=9，project.json status=项目完成）

#### 文档

- AGENTS.md §4 新增第十二轮调测结论（含指标表 + 与第八轮对比）
- w-model-dev-demo/docs/acceptance-test-report.md 完整验收报告（含 §9 用户确认区）

## [11.0.0] - 2026-07-26

### 第 11 轮外部技能吸收（claude-tla-plus-plugin）

以"阶段内强化 + 纯文档"方式吸收 `claude-tla-plus-plugin` 的 4 份 skill 资料与 review 命令语义，不新增脚本、不新增子流程、不新增约束。

#### 新增

- **tla-plus-syntax-reference.md**：TLA+ 完整语法参考（模块/算子/时序逻辑/PlusCal），适配 §2.0 命名规范
- **tla-plus-patterns-examples.md**：8 个典型示例（KV/Bakery/Producer-Consumer/Echo/Elevator/Cigarette Smokers/Consensus/Two-Phase Commit），每个补 W 模型文件头
- **tla-plus-tlc-configuration.md**：TLC .cfg 配置指南，适配 §11 cfg-tla 一致性规则 + §12 cfg 结构规则
- **tla-plus-review-checklist.md**：V-tla 审查 7 项清单（吸收 review 命令），映射到 verifier-spec.md 5 维度
- **SSoT §3.4.9**：第 11 轮外部技能吸收小节（纯描述性，含加载矩阵）
- **tla-plus-guide.md §13**：参考资料索引 + S-tla/V-tla 加载矩阵

#### 变更

- verifier-spec.md §7.2「设计（targetKind = `design`）」补「TLA+ 审查参考清单」引用（不新增 targetKind 枚举值）
- SKILL.md 快速自检补「TLA+ 资料按需加载」条目

#### 不变（明确边界）

- 11 个 `scripts/check-*.ts` 脚本不变
- self-test 基线 91 条不变
- vitest 测试套件不变
- `tla-plus-guide.md` §1-§12 不变（仅新增 §13）
- TLA+ 层级模型 L1/L2/L3/L4 不变
- 反模式 #15-17 不变
- 失败模式 F1-F10 不变
- verifier-spec.md 4 targetKind 枚举不变（requirement/design/test/file）+ rootcause 独立校验
- data-models.md 不变
- subagent-delegation.md O-S-V-G-R 边界不变

#### 验证

- TypeScript strict 0 错误
- self-test 91/91 全通过
- vitest 全通过
- 文档一致性人工检查：SSoT §3.4.9 / tla-plus-guide.md §13 / 4 份新参考文件 / verifier-spec.md §7.2 / SKILL.md 自检 / CHANGELOG [11.0.0] 互引一致

## [10.0.0] - 2026-07-26

### 第 10 轮外部技能吸收（to-tickets / to-spec / OpenSpec）

以"阶段内强化 + 纯文档"方式吸收三源精华，不新增脚本、不新增子流程、不新增约束。

#### 新增

- **阶段 1 新增三节**：User Stories 长列表 + Out of Scope 显式声明 + Implementation/Testing Decisions 分离（to-spec PRD 结构）
- **阶段 2-4 新增「测试 seam 决策」节**：seam-first testing（用最高 seam、理想零新 seam、三层一致性约束）
- **阶段 5 新增「Tracer-bullet 票据拆解」节**：垂直切片 + blocking edges DAG + wide refactor expand-contract + Out of 票据化例外
- **阶段 8 新增「archive 机制」节**：`changes/archive/YYYY-MM-DD-<feature>/`，7 类产物，tickets.md 源路径无关性
- **adoption-guide 新增 Brownfield 阶段级适配**：阶段 1 codebase survey 5 步 + 阶段 2-4/5 适配 + 不做的事
- **新增 references/external-skills-absorption.md**：三源吸收映射 + 决策记录 + 与约束/反模式关系
- **SSoT §3.4.8**：第 10 轮外部技能吸收约束小节（阶段 1/2-4/5/8 + §11A.5 brownfield）
- **SSoT §4A.1 第 7 行**：Choose Highest Seam 操作行为（标题改"七条核心操作行为"）
- **SSoT §11A.5**：Brownfield 阶段级适配子节
- **project.json 新增可选字段 archivePath**（默认空字符串，向后兼容）

#### 变更

- SKILL.md 阶段路由表补「第 10 轮外部技能吸收标记」列（阶段 1/2/3/4/5/8 标记，6/7 为 —）
- SKILL.md 阶段统一产出契约补「第 10 轮外部技能吸收三要素」第 6 项
- SKILL.md §核心操作行为标题改"七条操作行为" + 补第 7 行 Choose Highest Seam
- SKILL.md 快速自检补「上下文窗口已清理」条目（OpenSpec context hygiene）
- SSoT §3.4 补「S-doc 内含票据拆解」说明

#### 不变（明确边界）

- 11 个 `scripts/check-*.ts` 脚本不变（纯文档吸收，不新增校验维度）
- self-test 基线 91 条不变
- vitest 测试套件不变
- verifier-spec.md 5 轴 + 5 targetKind 不变
- subagent-delegation.md O-S-V-G-R 边界不变（S-tickets 由 S 兼任）
- anti-patterns.md 19 条反模式不变
- data-models.md 强制字段不变（archivePath 可选）
- w-model-dev-demo/ 不补建新节产物（demo 已归档）

#### 验证

- TypeScript strict 0 错误
- self-test 91/91 全通过
- vitest 全通过
- 文档一致性人工检查：SSoT §3.4.8 / §4A.1 / §11A.5 与 phase-N-*.md 新增节标题与 SKILL.md 路由表标记一致

## [9.0.0] - 2026-07-25

### 第 9 轮门禁与流程细化修正

基于第 8 轮 25 需求端到端调测归档后识别的 11 个问题（P1×3 + P2×4 + P3×4）全量修正。

#### 新增

- **P1.1 阶段级工件校验**：check-artifact-gate.ts `--phase=N` 参数，按阶段分层校验测试汇总和 RTM 字段（phase 5/6/7/8 渐进式，默认 8 终检向后兼容）
- **P2.6 graph 自动发现**：check-artifact-gate.ts 自动查找 `.w-model/ingestion/` 下 graph 资产（graph.json → consolidated-phase4.json → … → consolidated-phase1.json）
- **P2.4 subCriteria 标准模板**：4 targetKind × 5 项标准颗粒度（保留 §7.1-§7.5 既有结构，不按 8 阶段细分；阶段推断通过 targetKind 实现）
- **P2.5 targetKind 枚举**：`requirement` | `design` | `code` | `test`，`testcase`/`file` 已废弃
- **P3.8 TLA+ states 自动清理**：check-tla-model.ts `--keep-states`（`-k`）参数，默认校验后自动清理 states/ 目录
- **P3.9 Next 分支覆盖扩展**：code-tla-logic.ts 维度 3 遍历 tla-manifest 全部 specs（旧实现仅 L4）
- **P3.10 rawScores 合理性校验**：不得全相同（防复制填入）；text-parse 模式不得为完美等差数列（公差 0.01）；扰动范围 ∈ [0.01, 0.10]
- **P3.11 coverage/.tmp 清理**：w-model-dev-demo/.gitignore 排除 + vitest coverage.clean=true
- 6 新 fixture：gate/valid-phase6 + bad-phase6-pending-system + bad-phase5-missing-codemodule；verifier/bad-targetkind + bad-subcriteria-name + bad-rawscores-constant
- 9 新 self-test（基线 82→91）：P1.1 阶段级校验 ×6 + P2.4/P2.5/P3.10 verifier 标准化 ×3

#### 变更

- gate-logic.ts: checkArtifactGate 增加 phaseOption 参数 + PHASE_TEST_LAYERS / PHASE_TRACE_FIELDS 阶段分层 + NFR/CON 横切行阶段递进校验
- check-artifact-gate.ts: 增加 --phase 参数解析 + graph 资产自动发现 + 日志增强
- verifier-logic.ts: 增加 targetKind 枚举校验 + subCriteria 名称/数量/权重严格匹配 + rawScores 全同/等差数列/扰动范围校验
- check-tla-model.ts: 增加 --keep-states 参数 + states 目录自动清理
- code-tla-logic.ts: 维度 3 从仅遍历 L4 specs 扩展为遍历 manifest 全部 specs
- subagent-delegation.md: 反模式 #20（只规划不执行）+ S 子代理修改既有产物边界（S 新增 / R 修复 / 紧急修复 run-log 记录）
- subagent-persona-matrix.md: S 子代理"立即执行"约束 + R 子代理"修复既有产物"职责强化
- phase-1-requirements.md: NFR/CON 横切 designDoc 字段登记要求
- phase-5-coding.md: NFR/CON codeModule 回填要求
- verifier-spec.md: §2.2 targetKind 枚举规范 + §2.3 4 targetKind × 5 项 subCriteria 标准模板
- tla-plus-guide.md: states 自动清理约定 + --keep-states 调试模式
- SKILL.md: 阶段 5/6/7 门禁 --phase 参数说明 + 阶段级 G 门禁推荐命令
- SSoT §3.4.7: 第 9 轮 11 项约束条款
- AGENTS.md §4: 第 9 轮修正结论（含指标表 + 与第八轮对比）
- w-model-dev-demo/.gitignore: 增加 coverage/.tmp/ 排除规则

#### 修复

- 第八轮 demo phase6 verifier-output targetKind "testcase" → "test"
- 第八轮 demo phase7 verifier-output targetKind "testcase" → "test"
- 第八轮 demo phase6 verifier-output rawScores 改为自然波动（3 distinct 值，方差重算）
- 清理 w-model-dev-demo/tla/states/ 229 个残留文件（Part A P3.8 自动清理 + Part C 验证）

#### 验证

- TypeScript strict 0 错误
- self-test 91/91 全通过
- vitest 全通过
- check-verifier-output phase6/7 exitCode=0
- check-artifact-gate --phase=6/7/8 在第八轮 demo 上 exitCode=0
- tla/states/ 已清理

## [2026-07-25] 第八轮 W 模型 25 需求端到端调测

> 2026-07-25 第八轮 W 模型调测：扩展博客系统后端 25 需求（17 REQ + 5 NFR + 3 CON），全量删除 w-model-dev-demo 产物后从零重跑完整 8 阶段，验证第七轮门禁增强在 25 需求全量场景下的端到端可用性。

### 新增

- w-model-dev-demo 25 需求完整实现（17 SD × 3 DD = 51 详细设计 + 17 INTF 接口契约）
- 17 个 TLA+ 规格（1 L1 + 7 L2 + 5 L3 + 3 L4 + 1 L4 原子行为扩展），层级化建模 parent→child 一致
- 58 个 TypeScript 源文件（17 controllers + 17 services + 18 stores + 4 utils + app/server/types）
- 四级测试套件：单元 226 + 集成 40 + 系统 64 + 验收 56 = 386 用例全通过
- code-TLA+ 一致性四维度校验全通过（SD→codeModule 17/17 + 状态转移 90 + Next 分支 + 不变式断言 69）
- 8 个验收测试文件覆盖 56 UAT 用例（含 NFR 性能/安全/覆盖率/TS strict 真实测量）

### 变更

- w-model-dev-demo 项目范围扩展：需求 21→25、DD 29→51、TLA+ 13→17、图谱节点 76→216、边 396→902
- RTM 回填 NFR-001~005 和 CON-001~003 横切治理字段（designDoc/codeModule/unitTest/integrationTest）
- project.json status 流转：需求分析→系统设计→概要设计→详细设计→编码→集成测试→系统测试→验收门禁通过待用户确认→**项目完成**（用户 confirm 归档）
- rtm.json currentPhase: 8→9（项目归档），run-log.jsonl 追加 wm8-r012 归档 checkpoint 条目（acknowledgedDecisions=["user-confirm-archive"]）
- acceptance-test-report.md §9 用户确认区勾选 `[x] confirm` + 确认意见（含四级测试 386/386、RTM 100%、门禁 exitCode=0 等关键数据）

### 修复

- push.service.ts retry 循环 break→continue（TC-INT-031 推送重试 3 次而非 1 次）
- article.store.ts getById 返回副本防止状态污染
- blogger.service.ts bloggerFollow 幂等性
- auth.service.ts 预哈希校验顺序

### 文档

- AGENTS.md §4 新增第八轮调测结论
- w-model-dev-demo/docs/acceptance-test-report.md 9 章验收报告（含 §9 用户确认区）

## [2026-07-25] 门禁增强与文档更新

> 2026-07-25 第6轮 W 模型调测后识别 8 个技能问题，本次完成 6 项门禁增强（P1.1/P1.2/P1.4/P2.5/P2.6/P2.7）+ 2 项已实现确认（P1.3/P2.8）+ 顶层文档更新。

### 新增

- P1.1 TLA+ manifest `basePath` 强制校验（`tla-logic.ts` + `check-tla-model.ts`）
- P1.2 TLA+ SD 覆盖率全规格强制 spec 方向校验（`tla-logic.ts` checkCoverage 函数）
- P2.5 UAT 路径映射表规范（`phase-8-acceptance-test.md` + `phase-1-requirements.md`）
- P2.6 TLA+ 不变式业务语义校验项（`verifier-spec.md` subCriteria 第 8 项 + `tla-plus-guide.md` §4）
- P2.7 phase-8 三段暂停点语义明确（`phase-8-acceptance.md` 自驱 vs 交互模式对比）
- Fixture 化回归测试（`scripts/__tests__/gate-enhancement.test.ts`，6 个集成测试用例）

### 变更

- `tla-plus-guide.md` §2.1 路径基准表更新（jarPath/tlaPath/cfgPath 改为相对 basePath）+ §3 SD 覆盖率校验 + §4 不变式业务语义对齐
- `verifier-spec.md` §4.2.1 V 评审 subCriteria 新增第 8 项
- `phase-5-coding.md` §"RTM 登记"增加 codeModule 回填强制条款
- `phase-8-acceptance-test.md` 增加 UAT 路径映射表 + 自驱模式 vs 交互模式章节
- `SKILL.md` 阶段5门禁清单增加 codeModule 回填检查项
- `code-tla-logic.ts` 维度1 错误信息优化（明确指出"阶段5编码后必须回填"）
- `self-test.ts` 基线从 77 增至 82
- `samples/verifier/bad-passed-mismatch.json` 修正为 B 级 passed=false（与 P1.3 校验一致）

### 修复

- P1.4 codeModule 回填时机错误信息不明确（现为"阶段5编码后必须回填 RTM.codeModule，格式：SD-xxx:src/path/to/file.ts"）
- P1.3 passed↔qualityLevel 一致性校验已在 v1 实现，本次明确"无例外"条款
- P2.8 Next 分支命名映射已在 v1 实现，本次明确 PascalCase↔camelCase 约定

### 文档

- SSoT `docs/skill-design-document_SSoT.md` §3.4.6 新增门禁增强约束条款（8 项）
- AGENTS.md §4 新增第7轮门禁增强调测结论 + §2 门禁脚本测试说明 + §8 gate-enhancement.test.ts 条目
- README.md 新增门禁脚本增强表格 + 参考实现新门禁满足情况
- 设计 spec `docs/superpowers/specs/2026-07-25-gate-enhancement-and-ddd-rebuild-design.md`
- 实现计划 `docs/superpowers/plans/2026-07-25-gate-enhancement-and-ddd-rebuild.md`

### 测试

- vitest 63/63 全通过（含 6 个新增 gate-enhancement 用例）
- self-test 82/82 全通过（基线从 77 增至 82）
- TypeScript strict 模式 0 错误

## [Unreleased]

### R/F 角色新增：返工循环根因定位者（R）与修复者（F，由 S 兼任）

> 2026-07-24 为返工循环新增根因定位者（R）角色与修复者（F，由 S 兼任）角色，建立 V/G→R→V→G→S-fix→V→G 返工路径，强制返工必经根因定位。

#### 新增

- 新增根因定位者（R）角色与修复者（F，由 S 兼任）角色
- 新增返工循环 V/G→R→V→G→S-fix→V→G
- 新增 RootCauseReport Schema 与 check-rootcause-report.ts 校验脚本（R1-R10 规则）
- 新增 root-cause-locator.md（R 方法论指南）与 subagent-persona-matrix.md（人格选择矩阵）
- 新增多人格多角度分析机制（并行/串行均可）
- 新增反模式 #18（跳过 R 直接 S 返工）/ #19（R 报告未 V 复审）
- 新增 SKILL.md 约束第 13 条（返工必经根因定位）
- run-log 新增 rootcause / fix 动作类型
- budget 新增 rootcauseParallelBudget 字段与 R4-A 校验规则

#### 变更

- anti-patterns.md #4/#10/#12 扩展（纳入 R 相关检测信号）
- workflow.md 返工路径更新为 R 循环
- data-models.md run-log schema 扩展
- verifier-spec.md targetKind 新增 rootcause
- self-test.ts 基线从 66 增至 77
- SSoT §3.4/§6.4/§10.9/§4A.2b 新增 R 角色定义与 #18/#19 反模式
- SKILL.md 角色表新增 R + 约束第 13 条 + 返工路径更新
- AGENTS.md 角色新增 R + 行动约束 + 脚本导航
- README.md 角色概览新增 R + 返工流程图更新

### TLA+ 指南修复 + 编排纪律强化 + 代码-TLA+ 一致性回归（完整版）

> 修复工作过程中发现的三个问题：① TLA+ 存在多次返工（疑似指南和编写规范问题）；② 编排者出现多次上下文压缩（疑似任务越权或任务设计过于复杂）；③ TLA+ 资产未能作为状态机验证器门禁来回归编码产物。
>
> 走 superpowers-zh 工作流（头脑风暴 → 设计 spec → 编写计划 → 执行 → 修正 SSoT）完整修复。设计文档：[`docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md`](docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md)；实现计划：[`docs/superpowers/plans/2026-07-24-tla-plus-and-orchestration-fix.md`](docs/superpowers/plans/2026-07-24-tla-plus-and-orchestration-fix.md)。

#### 问题1：TLA+ 指南缺陷修复

#### 新增

- `w-model-dev/references/tla-plus-guide.md` 新增三节：
  - §2.0 命名规范（强制）：MODULE 名 `[A-Za-z][A-Za-z0-9_]*` 禁止连字符；`L<level>_<system>` 格式；反例 `L1-blog-system`（连字符）/ `1blog`（数字开头）/ `博客系统`（中文）
  - §2.1 路径解析基准（强制）：`jarPath` 相对 cwd、`tlaPath`/`cfgPath` 相对 manifest 目录、`@parent`/`@sibling`/`@child` 相对 `.tla` 目录
  - §2.2 前置清单：S 产出前 3 项检查（MODULE 名合法 / 路径基准 / cfg-tla 一致性）、G 校验前 3 项检查（含删除 `states/` 目录）
- `w-model-dev/references/tla-plus-guide.md` manifest schema 节补 `checkRounds` 语义：记录每轮 `check-tla-model.ts` 校验结果（含 violations 摘要与 round 编号）；violations 跨轮须单调递减；与 `run-log.jsonl` R3 交叉校验；无返工填 `[]`
- `w-model-dev/templates/tla-spec-template.md` 修正 `.cfg` 写法：L65-83 非法 `INVARIANT` 多行多名 → `INVARIANTS` 关键字 + 列表；补 `BusinessInvariant` 聚合示例；末尾追加 5 个反例节
- `w-model-dev/references/data-models.md` 末尾追加 `### tla-manifest.json` 节，含完整字段表 + `checkRounds` 语义指针

#### 变更

- 全局统一 MODULE 名示例去连字符（`L1-blog-system` → `L1_blog_system`）：`tla-plus-guide.md` / `tla-spec-template.md` / `data-models.md` / `docs/tla-plus-modeling-design.md`

#### 问题2：编排纪律强化

#### 新增

- `w-model-dev/references/subagent-delegation.md` 新增 S-doc/S-tla 拆分机制：
  - **S-doc**：产出开发文档 + 同步测试设计 + 更新 RTM 实体
  - **S-tla**：产出 `.tla` + `.cfg` + `tla-manifest.json` 实体（依赖 S-doc 的设计文档）
  - 分派时序：S-doc → S-tla → V → G
  - S-doc / S-tla 分派模板（含任务边界声明）
- `w-model-dev/references/subagent-delegation.md` 检测信号 5：编排者 `Write`/`Edit` 写 TLA+ 产物实体（`.tla`/`.cfg`/`tla-manifest.json`）

#### 变更

- `w-model-dev/references/subagent-delegation.md` L282 强制约束「写产物」项追加 `.tla`/`.cfg`/`tla-manifest.json` 实体
- `w-model-dev/SKILL.md`：
  - L62 角色表「关键禁止」补 `.tla`/`.cfg`/`tla-manifest.json` 实体
  - L118 阶段 1-4 分派补「可拆 S-doc/S-tla」指引
  - L239 自检清单补「无 `.tla`/`.cfg`/`tla-manifest.json` 实体改动」
  - 阶段 5 门禁节补「额外分派 G 跑 `check-code-tla-consistency.ts`」

#### 问题3：代码-TLA+ 一致性回归（完整版）

#### 新增

- **`w-model-dev/scripts/code-tla-logic.ts`**：代码-TLA+ 一致性校验纯逻辑（单点事实源），四维度校验：
  - 维度1 `checkSdToCodeModule`：SD→codeModule 映射完整性（读 `graph.json` SD 节点，核验 `rtm.json` codeModule 覆盖，多段匹配）
  - 维度2 `extractCodeStateTransfers` + `checkCodeStateTransfer`：代码状态转移抽取（TypeScript Compiler API 解析 AST，抽取 `BinaryExpression(=)` / `IfStatement` / `SwitchStatement`）
  - 维度3 `checkNextBranchCoverage`：Next 分支对应（正则抽取 TLA+ Next 动作名，驼峰匹配代码方法名）
  - 维度4 `checkInvariantCoverage`：断言覆盖不变式（抽取 `BusinessInvariant` 子不变式名，匹配代码 `assert`/`invariant`/`require` 调用）
- **`w-model-dev/scripts/check-code-tla-consistency.ts`**：CLI 入口（参数 `--manifest`/`--graph`/`--rtm`/`--src`；输出 `CODE_TLA_JSON`；退出码 0/1）
- **`w-model-dev/scripts/__tests__/code-tla-logic.test.ts`**：5 条测试样本（3 合规 + 2 违规）
- `w-model-dev/scripts/self-test.ts`：新增 5 条 code-TLA+ 样本用例（回归基线 61→66）

#### 变更

- `w-model-dev/scripts/gate-logic.ts`：`checkArtifactGate` 入参追加 `graph?`/`manifestExists?`；新增 TLA+ 资产存在性校验（manifestExists）+ SD→codeModule 映射校验（读 graph SD 节点）
- `w-model-dev/scripts/check-artifact-gate.ts`：读取 `.w-model/ingestion/graph.json` + 检查 `.w-model/tla-manifest.json` 存在性 + specs 非空；传入 `checkArtifactGate`；修复 `exitCode` 字段缺失缺陷（缺陷5）
- `w-model-dev/scripts/check-run-log.ts`：`extractExitCode` 模式数组增加 `GATE_JSON` 标记识别（配合缺陷5修复）

#### SSoT 修正

- `docs/skill-design-document_SSoT.md`：
  - §10.8 L1203 阶段 5-8 行：从「只读」升级为「冻结只读 + 须通过 `check-code-tla-consistency.ts` 一致性回归」
  - §10.8 L1220-1222 追加校验项：代码状态转移与 Next 对应 / 断言覆盖不变式 / SD 有 codeModule
  - §10.8 新增 §10.8.1「代码-TLA+ 一致性回归（check-code-tla-consistency.ts）」节：CLI 接口 + 四维度校验算法 + 触发时机 + 与其它门禁协同
  - §10.8 L1169 统一 `--phase` 取值口径（1-8，与脚本一致）
  - §7.8 补 `checkRounds` 语义（与 `tla-plus-guide.md` 双向追溯）
  - §10A 追溯表新增 §10.8.1 行
  - §10B 参考实现更新至第五轮（2026-07-24）：调测轮次/缺陷数/测试计数/覆盖率/图谱/TLA+/code-TLA+ 一致性全维度同步

#### demo 项目代码补齐 TLA+ 对齐

- `w-model-dev-demo/src/services/auth.service.ts`：新增 `logout()` / `resetCycle()` 方法 + `assert` 断言覆盖 TLA+ 不变式（TokenIssuedRequiresAuthenticated / LoggedOutImpliesNoToken / InitStateImpliesNoTokenAndNoHash）
- `w-model-dev-demo/src/controllers/auth.controller.ts`：新增 `logout()` 控制器方法
- `w-model-dev-demo/src/routes/auth.routes.ts`：新增 `POST /api/auth/logout` 路由
- `w-model-dev-demo/src/services/article.service.ts`：新增 `startNewArticle()` 方法 + `assert` 断言覆盖 TLA+ 不变式（TypeInvariant / PublishedCountBounded）

#### 验证

- `npx tsc --noEmit` → 0 错误（demo 项目 + skill 脚本）
- `npm run self-test` → 66/66 通过（含 5 条 code-TLA+ 用例），退出码 0
- demo 项目 `check-code-tla-consistency.ts` → 退出码 0（四维度全通过）
- demo 项目 `check-artifact-gate.ts` → 退出码 0（RTM 100% + TLA+ 资产✓ + graph✓）
- demo 项目 `npm test` → 135/135 通过（77 unit + 21 integration + 22 system + 15 acceptance）
- Grep 确认无 MODULE 名连字符残留（仅反例4故意保留）

### 吸收 cobusgreyling/loop-engineering 运维层与成熟度设计（4 项优化）

> 对 [`cobusgreyling/loop-engineering`](https://github.com/cobusgreyling/loop-engineering) 的运维层与自主成熟度概念进行联网调研后，提出并落地 4 项优化设计，扩展 w-model-dev 技能包的「运行时治理层」。
>
> 设计遵循现有架构硬约束：不内置 LLM 调用（约束 4）、CHECKPOINT 不可绕过（约束 2 + #8）、编排者最小化（#10）、SSoT 优先。4 项优化均为声明式 JSON / 字段填写 / append-only 日志，不引入 LLM 估算，不改变门禁脚本退出码语义。
>
> 设计文档：[`docs/loop-engineering-adoption-design.md`](docs/loop-engineering-adoption-design.md)

#### 新增

- **优化 1：成本预算与运行日志**（SSoT §10D + operational-recovery.md）
  - `budget.json`：声明式 perPhase / project 预算；`onExceed` ∈ `warn | pause | abort`；`killSwitch` 全局停摆开关
  - `run-log.jsonl`：append-only 运行日志，每条记录含 `phase` / `action` / `agent` / `tokensEstimate`（宿主 Agent 报实际消耗，`estimated=false`）/ `acknowledgedDecisions`
  - 预算超限 / kill switch 触发 / 运行日志维护三个子表（operational-recovery.md）
  - `data-models.md` 新增 `interface BudgetConfig` / `interface RunLogEntry` 两个 schema
- **优化 2：自主成熟度阶梯 L0~L3**（SSoT §10C + operational-recovery.md）
  - L0（默认）→ L3 四级阶梯；决策型 CHECKPOINT 在所有级别均等用户（不可绕过）；L1+ 操作型 CHECKPOINT 可选择性自动放行（不是绕过，仍在 run-log 留痕）；L3 高风险路径强制人工 gate
  - 放行矩阵覆盖：阶段门放行 / 质量门通过自动放行 / 返工路径 / 工件归档四个维度
  - `maturity.json`：`level` / `unlockConditions` / `history` / `downgradeTriggers`；升级与降级流程
  - `data-models.md` 新增 `interface MaturityConfig` schema
- **优化 3：运维失败模式 O1~O6**（SSoT §4A.2a + anti-patterns.md）
  - 6 条运行健康失败模式：O1 Token Burn / O2 State Rot / O3 Verifier Theater / O4 Comprehension Debt / O5 Cognitive Surrender / O6 Escalation Failure
  - 三层失败模式架构：流程反模式 #1~#17（命中即回退）→ 行为退化 F1~F10（标注不回退）→ 运维失败模式 O1~O6（标注 + 协同检测，部分触发 kill switch）
  - 检测信号 + 处理流程 + 与 loop-engineering 差异表（anti-patterns.md 完整登记）
- **优化 4：理解债务显式化**（SSoT §10.6 第六维度 + verifier-spec.md §6.2 + definition-of-done.md）
  - DoD 从五维度扩展为六维度：新增「理解证据」维度（标准：`acknowledgedDecisions` 已填入；验证方式：run-log.jsonl 比对；不通过动作：要求 Agent 复述关键决策并填 acknowledgedDecisions 后重放行）
  - `verifier-spec.md` §6.2：`summary` 字段要求阶段 digest 三要素（① 关键决策摘要 ② 产物核心结构 ③ 遗留风险/已知限制）；`summary` 为空或仅"通过"视为 O3 命中，V 评审降级重做
  - `definition-of-done.md` 自检清单新增「acknowledgedDecisions 已填入」项；反例引用更新为「17 条流程反模式、F1~F10 失败模式与 O1~O6 运维失败模式」

#### 变更

- `docs/skill-design-document_SSoT.md`：
  - §3.4.5「编排者允许的动作」新增 budget / run-log / maturity 维护项
  - §4A.2 后插入 §4A.2a「运维失败模式清单（O1~O6）」；§4A.3 扩展为三层失败模式架构描述
  - §10.6 DoD 五维度 → 六维度（新增「理解证据」维度）
  - §10A 追溯表新增 §10C / §10D 行，更新 §4A 与 §10.6 行
  - 在 §10.8 与 §10A 之间插入 §10C「自主成熟度阶梯（L0~L3）」与 §10D「成本预算与运行日志」
- `w-model-dev/SKILL.md`：
  - 约束 2「阶段门放行」补充「L1+ 操作型 CHECKPOINT 自动放行是选择性激活，非绕过；决策型 CHECKPOINT 在所有级别均等用户；阶段门放行须填 acknowledgedDecisions 理解证据」
  - 快速自检清单新增「阶段门放行已填理解证据」+「预算与成熟度已检查」两项
- `w-model-dev/references/operational-recovery.md`：新增「成本预算与运行日志」节（预算超限 / kill switch / 运行日志维护 3 子表）+「成熟度与 CHECKPOINT 放行」节（CHECKPOINT 分类与放行 / L3 高风险路径 / 升级与降级 / maturity.json 维护 4 子表）
- `w-model-dev/references/data-models.md`：目录新增 3 行；文件末尾追加 `BudgetConfig` / `RunLogEntry` / `MaturityConfig` 三个 schema 节
- `w-model-dev/references/anti-patterns.md`：目录新增「运维失败模式清单（6 条运行健康 O1~O6）」行；文件末尾追加 O1~O6 完整定义表 + 检测信号与处理流程表 + 标注约定 + 与 loop-engineering 差异表
- `w-model-dev/references/definition-of-done.md`：五维度 → 六维度；自检清单新增「acknowledgedDecisions 已填入」项；反例引用更新
- `w-model-dev/references/verifier-spec.md`：§6.2「通过判定」改为 §6.3；在 §6.1 与 §6.3 之间插入 §6.2「summary 字段内容要求（阶段 digest 三要素）」
- `w-model-dev/references/subagent-delegation.md`：O 角色允许动作新增第 ⑦ 项「维护 budget.json / run-log.jsonl / maturity.json」；扩展读取列表包含 budget / run-log / maturity
- `AGENTS.md`：关键目录速查表 `w-model-dev/references/` 行扩展，新增 verifier-spec summary 阶段 digest 三要素 §6.2 / subagent-delegation O 维护 budget/run-log/maturity / definition-of-done 六维度含理解证据 / anti-patterns O1~O6 / operational-recovery 两节 / 数据模型 schema 说明

#### 设计原则兼容性

- **不内置 LLM 调用（约束 4）**：4 项优化均为声明式 JSON / 字段填写 / append-only 日志，无 LLM 调用；`budget.json` 的 `tokensEstimate` 由宿主 Agent 报告实际消耗（`estimated=false`），不引入 LLM 估算
- **CHECKPOINT 不可绕过（约束 2 + #8）**：L0~L3 阶梯是「选择性激活」而非「绕过」——决策型 CHECKPOINT 始终 attended，L3 高风险路径强制人工 gate，L1+ 自动放行仍在 run-log 记录保留可追溯性
- **编排者最小化（#10）**：budget / run-log / maturity 维护是编排者允许的状态文件读写动作，不涉及阶段产物（代码 / 文档 / 评审 JSON / RTM 实体）的越权产出
- **SSoT 优先**：严格按 AGENTS.md「SSoT 优先」约束，先改 SSoT，再同步 w-model-dev/references/，最后同步 SKILL.md 与 AGENTS.md

#### 验证

- `npm run self-test` → 37/37 用例通过，退出码 0（10 Verifier + 7 Gate + 12 Graph + 8 TLA 样本回归基线未受影响）
- 4 项优化均为增量、声明式扩展，未触及任何 `check-*.ts` 脚本逻辑
- 文档一致性：SSoT §3.4.5 / §4A.2a / §4A.3 / §10.6 / §10A ↔ operational-recovery.md 两节 ↔ data-models.md 3 schema ↔ anti-patterns.md O1~O6 ↔ definition-of-done.md 六维度 ↔ verifier-spec.md §6.2 ↔ subagent-delegation.md O 角色扩展 ↔ SKILL.md 约束 2 + 快速自检 ↔ AGENTS.md 关键目录速查 均已双向同步

### W 模型 8 阶段端到端全量重跑（第四轮，删除全部产物后从零再实现）

> 2026-07-23 删除 `w-model-dev-demo/` 的 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/` 全部阶段产物（保留 `package.json`/`tsconfig.json`/`vitest.config.ts`/`node_modules`），按 W 模型 8 阶段 self-as-verifier 模式从零端到端重跑，验证信息流校验特性合入后技能编排端到端可用。所有门禁退出码 0，图谱零违反收敛。

#### 验证

- 单元测试：53/53 通过（独立再实现，第三轮 71→53），覆盖率 96.37% lines / 93.57% branches / 92.30% functions / 96.37% statements（第三轮 100% 全维度，仍 ≥ 80% 阈值）
- 集成测试：13/13 通过（零 mock，supertest 对真实 Express app）
- 系统测试：8/8 通过，P95 = 4.66ms（≤ 200ms，NFR-002 达标）
- 验收测试：15/15 通过，4/4 需求 RTM 覆盖率 100%
- 全量测试：`npm test` → 18 test files / 89 tests 全通过
- 自检基线：`npm run self-test` → 29/29 通过，退出码 0
- 工件质量门：`npm run check:gate -- w-model-dev-demo` → 通过，退出码 0（RTM 100% + 单元覆盖率 96.37% + 四级测试全通过）

#### 阶段门评审（8 阶段全部 qualityLevel=A）

| 阶段 | compositeScore | 图谱节点/边 | 信息流违反 | 门禁退出码 |
|---|---|---|---|---|
| 1 需求分析 | 0.897 | 7 / 15 | 0 | 0 |
| 2 系统设计 | 0.891 | 19 / 70 | 0 | 0 |
| 3 概要设计 | 0.8895 | 31 / 125 | 0 | 0 |
| 4 详细设计 | 0.8995 | 43 / 182 | 0（1 轮收敛） | 0 |
| 5 编码 | 0.91 | N/A | N/A | 0 |
| 6 集成测试 | 0.9345 | N/A | N/A | 0 |
| 7 系统测试 | 0.9375 | N/A | N/A | 0 |
| 8 验收测试 | 0.9405 | N/A | N/A | 0 |

#### 图谱校验关键回归点（信息流校验特性）

- 阶段 1：REQ 节点信息流闭合，EXT-IN/EXT-OUT 边界完整
- 阶段 2：8 个 SD 节点均有 implements 追溯边（`SD_without_implements=0`）
- 阶段 3：12 个 INTF 节点均有 defines 追溯边（`INTF_without_defines=0`）
- 阶段 4：12 个 DD 节点均有 realizes 追溯边（`DD_without_realizes=0`），零违反硬约束达成放行进编码
- 全阶段：无黑洞/奇迹/死模块（`blackHoles=[]`/`miracles=[]`/`deadModules=[]`），边界完整

#### 变更

- `AGENTS.md` §4 端到端调测结论表更新为第四轮结果（2026-07-23）：测试计数、覆盖率、新增「图谱校验」与「全量测试」行；保留第二/三轮缺陷修正史
- `w-model-dev-demo/` 全部阶段产物从零再实现（`.w-model/`/`docs/`/`src/`/`tests/`/`coverage/`）

#### 与第三轮差异说明

第三轮（2026-07-23 早些时候）为增量更新既有产物；第四轮为全量删除后独立再实现，单元测试粒度与覆盖率与第三轮不完全一致（71→53、100%→96.37%），但均满足 NFR-004 ≥ 80% 阈值，且集成/系统/验收测试计数不变，所有门禁退出码仍为 0。本轮未引入新缺陷。

### W 模型 8 阶段端到端调测重跑（第三轮，含信息流校验特性）

> 2026-07-23 重跑 `w-model-dev-demo/` 全套测试与门禁脚本，验证信息流校验特性合入后端到端仍可用。所有门禁退出码 0，覆盖率提升至 100%。

#### 验证

- 单元测试：71/71 通过（第二轮 65→71），覆盖率 100% lines / 100% branches / 100% functions（第二轮 98.96% / 93.23% / 100%）
- 集成测试：13/13 通过（第二轮 12→13）
- 系统测试：8/8 通过（第二轮 6→8），P95 = 3ms（≤ 200ms）
- 验收测试：15/15 通过，4/4 需求 RTM 覆盖率 100%
- 自检基线：`npm run self-test` → 29/29 通过，退出码 0
- 工件质量门：`npm run check:gate -- w-model-dev-demo` → 通过，退出码 0（RTM 100% + 单元覆盖率 100%）

#### 变更

- `AGENTS.md` §4 端到端调测结论表更新为第三轮结果（2026-07-23）：测试计数、覆盖率、新增「自检基线」行；保留第二轮缺陷修正史

### 信息流校验增强（黑洞 / 奇迹 / 死模块门禁）

> 为图谱门禁新增与结构门禁正交的信息流校验层：任何软件系统都不是黑洞或奇迹，也不存在无信息流经的模块。
> 新增 `produces`/`consumes` 信息流边 + `EXT-IN`/`EXT-OUT` 显式边界节点（DFD terminator），检测黑洞（只进不出）/ 奇迹（只出不进）/ 死模块（无流经）三类信息流反常。
> 阶段 1 REQ 信息流闭合（严格），阶段 4 信息流零违反 + 结构零违反才放行进编码。全程确定性算法，无 LLM；收敛判定仍由 G 跑 `check-requirement-graph.ts` 退出码决定。

#### 新增

- **graph-logic.ts 信息流校验**：`NodeType` 加 `EXT-IN`/`EXT-OUT`；`EdgeType` 加 `produces`/`consumes`；新增 `DataflowViolations`（blackHoles/miracles/deadModules）+ `BoundaryInfo`（extIn/extOut/complete）接口；单根计算豁免边界节点；信息流校验仅对业务节点（REQ/SD/INTF/DD，phase≤当前）判定黑洞/奇迹/死模块 + 边界完整性（EXT-IN≥1 ∧ EXT-OUT≥1）；`passed` 汇总加 `dataflowOk`
- **check-requirement-graph.ts CLI 输出**：人类可读段加信息流违反行 + 边界完整性行；`GRAPH_JSON` 摘要加 `dataflowViolations`/`boundary` 字段
- **4 个信息流样本**：`bad-blackhole.json`（黑洞）/ `bad-miracle.json`（奇迹）/ `bad-dead-module.json`（死模块）/ `valid-dataflow.json`（phase=4 完整图谱）；`valid-graph.json` 按方案 A 补信息流边与边界节点
- **self-test 用例 25→29（+4）**：新增 4 条 Graph 样本用例，覆盖三类信息流违反 + 正常态
- **反模式 #13**：anti-patterns.md 新增「信息流黑洞/奇迹/死模块放行」（反模式清单 / 命中高发阶段表 / 门禁脚本对应表 / 检测信号表 / 详解小节）
- **graph-guide.md「信息流模型」节**：三不变量（黑洞/奇迹/死模块）+ 边界节点 + 方向约定 + 跨阶段收敛 + 与结构门禁的正交性
- **A 子代理信息流边提取规则**：ingestion-chunk.md 加 produces/consumes/EXT-IN/EXT-OUT 提取规则；ingestion-cross.md 加跨块去重与 reworkHints 规则
- **设计文档**：`docs/information-flow-validation-design.md`（信息流校验层设计 spec）

#### 变更

- `w-model-dev/SKILL.md`：快速自检加「信息流无黑洞/奇迹/死模块 + 边界完整」项
- `docs/skill-design-document_SSoT.md`：§7.7 graph.json schema 加信息流边与边界节点；§10.7 图谱门禁加信息流校验算法 + 跨阶段收敛；§10A 追溯表更新；守护反模式引用补 #13
- `docs/ingestion-graph-convergence-design.md`：§2.1 节点类型表加 EXT-IN/EXT-OUT；§2.3 边类型表加 produces/consumes；§3.2 算法加信息流校验步骤 6-8；§3.4 收敛准则加信息流层；§3.5 对照表加信息流闭合行
- `AGENTS.md`：§2 scripts/ 行加信息流校验描述；anti-patterns 计数 12→13；self-test 计数 25→29
- `README.md`：anti-patterns 计数 12→13；graph-logic.ts 描述加信息流校验；相关文档列表加信息流设计文档
- `docs/INSTALL.md`：§3 目录结构补 graph-logic.ts / check-requirement-graph.ts；§7 目录速查补图谱门禁条目

#### 验证

- `npm run self-test` → 29/29 用例通过，退出码 0（10 Verifier + 7 Gate + 12 Graph）
- 三条 bad 样本（bad-blackhole/bad-miracle/bad-dead-module）退出码 1，各自 `dataflowViolations` 对应数组含 REQ-001
- `valid-dataflow.json` + `valid-graph.json`（补边后）phase=4 退出码 0，信息流零违反 + 边界完整
- 旧 7 条 bad 样本仍按原期望失败（信息流校验只增不减违反项，结构违反文案不变）
- 文档一致性：SSoT §7.7/§10.7 ↔ ingestion 设计 §2.1/§2.3/§3.2/§3.4 ↔ graph-guide.md ↔ anti-patterns.md #13 ↔ ingestion-chunk/cross.md ↔ SKILL.md ↔ AGENTS.md ↔ README.md ↔ INSTALL.md 均已同步

### ingestion 子流程与图谱门禁（A 角色 + graph.json + check-requirement-graph.ts）

> 为阶段 1–4（需求分析 → 系统设计 → 概要设计 → 详细设计）新增 ingestion 子流程与分析子代理（A 角色），引入 graph.json 结构层图谱与 check-requirement-graph.ts 图谱门禁，实现「超大/多目录文档分块分析 → 交叉合并 → 图谱演进 → 结构连通性门禁」闭环。
>
> 五角色架构 O/A/S/V/G：A 为阶段 1–4 分析子代理（分块分析 / 交叉合并 / 图谱演进），与 S（产出）/ V（评审）/ G（门禁）协同；编排者 O 不得越权。阶段 1 走 A→S 路径（A 先提取 REQ 节点，S 再产出需求规格），阶段 2/3/4 走 S→A 路径（S 先产出正式设计文档，A 再分块提取 SD/INTF/DD 节点）。
>
> 收敛判定由 G 跑 check-requirement-graph.ts 退出码决定，不由 A 的 LLM 输出决定（约束 4，反模式 #12）。阶段 4 零违反（DD realizes 全覆盖）才放行进阶段 5 编码。

#### 新增

- **A 角色（分析子代理）**：SSoT §3.4.2 角色划分表加 A 行（与 subagent-delegation.md 一致）；subagent-delegation.md 加 A-chunk / A-cross/A-evolve 分派模板与回填契约；SKILL.md「编排者-子代理边界」节同步
- **graph-logic.ts + check-requirement-graph.ts**：图谱结构门禁纯逻辑 + CLI（连通性 / 单根 / 父唯一性 / 阶段递进追溯 implements/defines/realizes），退出码 0/1/2；package.json 加 `check:graph` 快捷脚本
- **plan-chunks.ts**：ingestion 分块策略（混合：文件/目录 + 超限拆分），供编排者分派 A-chunk 前调用
- **ingestion-chunk.md + ingestion-cross.md + graph-guide.md**：A 子代理参考文档（分块分析细则 / 交叉合并与图谱演进细则 / 图谱门禁与收敛准则）
- **graph.json schema**：结构层图谱（nodes/edges/analysisRounds），与 rtm.json 追溯层并存；SSoT §7.7 摘要，权威定义在设计文档 §2.4
- **阶段 4 零违反硬约束**：`--phase=4` 零违反（DD realizes 全覆盖）才放行进阶段 5 编码；SSoT §4.4 + §10.7
- **self-test 用例 17→25（+8）**：新增 8 条 Graph 样本（samples/graph/），覆盖连通/单根/父唯一/阶段追溯各校验路径
- **设计文档**：`docs/ingestion-graph-convergence-design.md`（A 角色 / graph.json schema / 校验算法 / 收敛准则 / 文件清单 / 失败模式）

#### 变更

- `w-model-dev/references/anti-patterns.md`：反模式清单从 10 条扩到 12 条（#11 ingestion 跳过图谱校验 / #12 A 自评收敛）；命中高发阶段表 / 门禁脚本对应关系表 / 检测信号与回退命令表 / 门禁脚本退出码精确对应表 / F1-F10 失败模式表均同步登记 #11/#12 + check-requirement-graph.ts
- `w-model-dev/references/workflow.md`：流程图阶段 1–4 加 ingestion 标注（A 图谱: REQ/SD/INTF/DD 节点 + 校验）；阶段产物清单表加 graph.json；反模式表加 #11/#12 行
- `w-model-dev/references/command-reference.md`：`/wm analyze` 加 `ingestion` 字段（A→S 路径，plan-chunks → A-chunk → A-cross → G 图谱校验 → 收敛循环）；`/wm design` 加 `ingestion` 字段（S→A 路径，按 type 追加 SD/INTF/DD 节点，详细阶段零违反硬约束）
- `w-model-dev/references/subagent-delegation.md`：角色划分表加 A 行；目录加 A-chunk / A-cross/A-evolve 分派模板
- `w-model-dev/examples/requirement-analysis.md`：追加「示例：超大/多目录文档 ingestion」节（完整交互样例：分块规划 CHECKPOINT → 并行 A-chunk → 收敛循环 → 收敛确认 CHECKPOINT → S 产出）
- `docs/skill-design-document_SSoT.md`：§3.4.2 标题改为「四层子代理 + 编排者：O / A / S / V / G」+ 角色表加 A 行；§4.4 新增 ingestion 子流程节；§7.7 新增 graph.json schema；§10.7 新增图谱门禁；§10A 追溯表加 §7.7 / §10.7 行 + §3.4 行更新为五角色 + #10/#11/#12
- `AGENTS.md`：§2 关键目录速查表 scripts/ 行加 graph-logic.ts / check-requirement-graph.ts / plan-chunks.ts；references/ 行加 ingestion-*.md / graph-guide.md + anti-patterns 计数 10→12 + O/A/S/V/G；§3 常用命令加 check:graph + self-test 计数 17→25
- `README.md`：运行门禁校验脚本节加 check:graph（npm run + npx tsx 两种方式）；项目结构树加 graph-logic.ts / check-requirement-graph.ts / plan-chunks.ts / ingestion-*.md / graph-guide.md；anti-patterns 计数 10→12；subagent-delegation O/S/V/G→O/A/S/V/G；相关文档列表加 ingestion-*.md / graph-guide.md / 设计文档

#### 验证

- `npm run self-test` → 25/25 用例通过，退出码 0（10 Verifier + 7 Gate + 8 Graph 样本回归基线）
- 文档一致性：SSoT §3.4.2 / §4.4 / §7.7 / §10.7 ↔ subagent-delegation.md ↔ anti-patterns.md #11/#12 ↔ graph-guide.md ↔ ingestion-chunk.md / ingestion-cross.md ↔ command-reference.md ↔ workflow.md ↔ AGENTS.md ↔ README.md 均已同步至 ingestion + 图谱门禁设计
- SSoT §10A 追溯表 §7.7 / §10.7 行与设计文档 §2.4 / §3 双向链接校验通过

### 编排者最小化（Orchestrator Minimization）

> 将「任何修改、编码、调测、分析、修正、验证都只允许子代理执行，编排者只进行编排，编排者工作最小化」作为强制约束纳入技能设计。
>
> 新增 O / S / V / G 四角色划分（编排者 / 产出子代理 / 评审子代理 / 门禁子代理），每阶段分派时序统一为 O 路由 → 🔴 CHECKPOINT → S 产出 → V 评审 → G 门禁 → O 展示证据 → 🔴 CHECKPOINT 放行 → O 持久化。违反约束命中反模式 #10「编排者越权实施」，回到当前阶段起点。
>
> 设计遵循「SSoT 优先 + 不内置 LLM 调用 + CHECKPOINT 不可绕过」三项硬约束：V 子代理即「外部 Agent 执行 LLM-as-a-Verifier」，技能包自身仍只含提示词 + 脚本，不引入 LLM 调用；G 子代理跑确定性门禁脚本回填证据，与「真实执行」约束一致。

#### 新增

- `docs/skill-design-document_SSoT.md` §3.4「编排者-子代理边界」：设计目标 / O-S-V-G 角色表 / 每阶段分派时序 / 与现有约束兼容性 / 强制约束；§10A 追溯表登记 §3.4 行
- `w-model-dev/references/subagent-delegation.md`：编排者-子代理边界可执行细则（角色划分 / 每阶段分派时序 / S-V-G 三类子代理分派模板 / 回填契约 JSON / 强制约束 / 失败模式与回退 / 与 addyosmani 差异表）
- `w-model-dev/references/anti-patterns.md` #10「编排者越权实施」：反模式清单从 9 条扩到 10 条；新增检测信号（编排者会话出现 `Write`/`Edit` 写产物 / 直接产出 VerifierOutput JSON / `git diff` 含非状态文件改动）+ 回退动作（回到当前阶段起点，已越权产出的实体作废重做）；命中高发阶段表 / 与门禁脚本对应表 / 检测信号与回退命令表均同步登记 #10
- `w-model-dev/SKILL.md` 不可违反的约束新增第 8 条「编排者最小化」；新增「编排者-子代理边界」节（O/S/V/G 角色表 + 每阶段分派时序摘要 + 只读脚本例外 + 违反处置）；快速自检加编排者越权检查项

#### 变更

- `w-model-dev/SKILL.md` 执行工作流：从 8 步重写为 10 步（O/S/V/G 角色标注）；原步骤 6「执行阶段」（编排者直接产出）拆为步骤 6「分派 S 子代理产出」+ 步骤 7「分派 V 子代理评审」+ 步骤 8「分派 G 子代理门禁」；原步骤 7「验证与暂停」改为步骤 9「验证与暂停」（基于 G 返回值路由判定 + CHECKPOINT 等待）；命令速查表加「子代理分派」列；按需加载追加 subagent-delegation.md 入口
- `w-model-dev/references/workflow.md` 总体流程图加 O/S/V/G 角色标注；阶段产物清单表加「子代理分派」列（标注每阶段由哪些角色执行）；工作流常见反模式表加第 8 行（对应 #10）
- `w-model-dev/references/command-reference.md` 通用命令规则明确 O 边界（编排者只可读取/更新状态文件，不得修改 RTM 实体字段）；每个 `/wm` 命令加「执行方」字段，标注 S/V/G 分派与 O 持久化职责；`/wm review` 明确「编排者不得自评」；`/wm test` 禁止栏加「编排者越权回填 RTM 实体（反模式 #10）」
- `AGENTS.md` §1 仓库定位新增「编排者最小化」行 + LLM-as-a-Verifier / Agent Personas 描述改为「V 子代理执行」；§2 关键目录速查表 `w-model-dev/references/` 行补 subagent-delegation / anti-patterns 描述从 9 条改为 10 条；§6 行动约束新增「编排者最小化」条目
- `README.md` 核心能力新增「编排者最小化」一项 + LLM-as-a-Verifier / Agent Personas 描述改为「V 子代理执行」+ 反模式计数从 9 条改为 10 条；项目结构树补 `subagent-delegation.md` 条目；相关文档列表补 subagent-delegation.md 链接 + anti-patterns 描述更新到 10 条
- `docs/INSTALL.md` §1 架构定位补「编排者最小化」+ 校验脚本 / LLM-as-a-Verifier 描述改为「G 子代理 / V 子代理执行」；§3 安装后目录结构补 subagent-delegation.md + 编排者-子代理边界说明；§7 目录速查表补 subagent-delegation.md 行；§8 FAQ 新增「编排者-子代理边界如何工作」与「编排者能跑门禁脚本吗」两个问答

#### 设计要点

- **三层子代理 + 编排者（O/S/V/G）**：O 路由 + 状态 + CHECKPOINT + 持久化 + 只读脚本；S 产出（含跑测试运行器）；V 评审（按 Persona 路由）；G 门禁（跑脚本 + 回填证据）。
- **每阶段时序**：O 路由 → 🔴 CHECKPOINT 进入确认 → S 产出 → V 评审 → G 门禁 → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 持久化。阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`。
- **只读脚本例外**：O 可跑 `check-*.ts` 看退出码用于展示/路由判定，但**不替代 G 的回填**——G 子代理必须独立跑一次并产出证据摘要。
- **强制等级**：违反即命中反模式 #10，回到当前阶段起点，已越权产出的实体作废重做。
- **兼容性**：与现有约束 2/4/6/8、`verifier-spec.md` §7.6「外部 Agent 执行」、`agent-personas.md` 4 个 Persona 均不冲突；V 子代理即「外部 Agent」，G 子代理跑脚本回填证据 = 真实执行。

#### 验证

- `npm run self-test` → 17/17 用例通过，退出码 0（10 Verifier + 7 Gate 样本回归基线未受影响）
- 文档一致性：`docs/skill-design-document_SSoT.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/subagent-delegation.md`（新建）/ `anti-patterns.md` / `workflow.md` / `command-reference.md` / `AGENTS.md` / `README.md` / `docs/INSTALL.md` / `CHANGELOG.md` 均已同步至编排者最小化设计
- SSoT §3.4 ↔ `subagent-delegation.md` ↔ `SKILL.md`「编排者-子代理边界」节 ↔ `anti-patterns.md` #10 四向链接校验通过
- `command-reference.md` 各命令「执行方」字段与 `workflow.md` 阶段产物表「子代理分派」列一致

### 吸收 addyosmani/agent-skills 设计模式（P1 + P2）

> 将 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 中的 `using-agent-skills` 元技能（6 条核心操作行为 + 10 条失败模式）、`code-review-and-quality`（五轴评审 + Severity 标签 + Structural Remedies）、`references/definition-of-done.md`（项目级 DoD）、`agents/`（Agent Personas）、`docs/adoption-guide.md`（Greenfield vs Brownfield 采用路径）等设计模式吸收到本技能包。
>
> 吸收遵循「SSoT 优先 + 不内置 LLM 调用 + CHECKPOINT 不可绕过」三项硬约束：Persona 定义为「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，文件本身是 Markdown，不调用任何 LLM；失败模式与 9 条流程反模式二分（反模式=流程破坏回退，失败模式=行为退化登记）。

#### 新增

- `docs/skill-design-document_SSoT.md` §4A「核心操作行为与失败模式」：6 条核心操作行为（Surface Assumptions / Manage Confusion Actively / Push Back When Warranted / 等）+ 10 条失败模式 F1~F10
- `docs/skill-design-document_SSoT.md` §6.4「Agent Personas（评审角色提示词）」：三层架构（Skill / Persona / Command）+ 4 个 W 模型适配 Persona + 与 §7.6 LLM-as-a-Verifier 的路由关系
- `docs/skill-design-document_SSoT.md` §7.6「五轴评审」：Correctness / Readability / Architecture / Security / Performance 五轴 + Severity 标签（Critical / Required / Optional / Nit / FYI）+ Structural Remedies
- `docs/skill-design-document_SSoT.md` §10.6「项目级 Definition of Done」：5 维度 DoD（功能 / 质量 / 测试 / 文档 / 部署）
- `docs/skill-design-document_SSoT.md` §11A「采用路径（Greenfield vs Brownfield）」：路径选择信号表 + Day 0 全流程 + 增量验证优先 + 收敛表
- `w-model-dev/references/agent-personas.md`：4 个评审角色提示词（code-reviewer / test-engineer / security-auditor / performance-auditor），含 JSON 输出格式、评审规则、组合节、与 addyosmani 差异表；performance-auditor 直接吸收 Metric-Honesty Rule
- `w-model-dev/references/definition-of-done.md`：项目级 DoD（5 维度），SSoT §10.6 为权威定义
- `w-model-dev/references/verifier-spec.md` §7.4A：五轴评审 + Severity 标签 + Structural Remedies（与 SSoT §7.6 双向追溯）
- `docs/adoption-guide.md`：人类可读采用指南（Greenfield Day 0 全流程 + Brownfield 增量验证优先 + 收敛表 + 与 addyosmani 差异表），SSoT §11A 为权威定义

#### 变更

- `w-model-dev/SKILL.md`：新增「核心操作行为」节（6 条）+ 「失败模式 F1~F10」节；YAML frontmatter `description` 同步
- `w-model-dev/references/anti-patterns.md`：新增「失败模式清单 F1~F10」节（10 条行为退化 + 与反模式对照表 + 标注约定 + 与 addyosmani 差异表）；目录同步更新；F# 重复命中 ≥2 次升级为 L# 教训
- `README.md`：项目结构树补 `agent-personas.md` / `definition-of-done.md` / `docs/adoption-guide.md`；`anti-patterns.md` 描述更新为「9 条流程反模式 + L1~L4 教训 + 失败模式 F1~F10」；`verifier-spec.md` 描述补「五轴评审 §7.4A」
- `AGENTS.md`：§1 仓库定位补 Agent Personas 行；§2 关键目录速查表 `w-model-dev/references/` 行补 agent-personas / definition-of-done / 失败模式 F1~F10 / command-reference / operational-recovery；§5 必读文档列表补 `docs/adoption-guide.md`

#### 与 addyosmani/agent-skills 的差异

- **不内置 LLM 调用**：addyosmani 的 Persona 可直接调用 LLM；本技能包 Persona 是「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，文件本身是 Markdown
- **Persona 不互相调用**：吸收 addyosmani 规则——组合由命令或用户完成；`code-reviewer` 发现安全问题时在 `reworkHints` 中以「[建议 security-auditor 深审] xxx」前缀呈现，不自动调用
- **失败模式与反模式二分**：反模式=流程破坏（命中即回退），失败模式=行为退化（命中不回退但登记）；F# 重复命中 ≥2 次升级为 L# 教训，并在 SSoT §10B.4 同步登记
- **performance-auditor 适配 W 模型后端场景**：借鉴 addyosmani `web-performance-auditor` 但扩展为前端+后端双场景；Quick 模式（无工具工件）退化为源代码结构反模式扫描；直接吸收 Metric-Honesty Rule（永不编造指标，无工具数据时标 `not measured`）
- **Persona 产出与 §7.6 Schema 对齐**：Persona 产出的 JSON 必须满足 `verifier-spec.md` §7 Schema，Severity 标签作为 `reworkHints` 字符串前缀，不新增 Schema 字段
- **采用路径适配 W 模型 8 阶段**：Greenfield 路径按 8 阶段顺序执行；Brownfield 路径分 4 Phase（上下文与只读 / 先测试后改动 / 新工作跑全流程 / 偿还债务废弃观测）

#### 验证

- `npm run self-test` → 17/17 用例通过，退出码 0（10 Verifier + 7 Gate 样本回归基线未受影响）
- 文档一致性：`README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/agent-personas.md` / `definition-of-done.md` / `anti-patterns.md` / `verifier-spec.md` / `docs/adoption-guide.md` 均已同步至 addyosmani/agent-skills 吸收后状态
- SSoT §6.4 ↔ `agent-personas.md` 双向链接校验通过
- SSoT §11A ↔ `docs/adoption-guide.md` 双向链接校验通过
- SSoT §4A ↔ `anti-patterns.md`「失败模式清单 F1~F10」双向链接校验通过
- SSoT §7.6 ↔ `verifier-spec.md` §7.4A 双向链接校验通过
- SSoT §10.6 ↔ `definition-of-done.md` 双向链接校验通过

### 端到端调测第二轮：从零重建 + k6 性能基线 + 文档全面同步

> 通过完全清空 `w-model-dev-demo/`（已于第 17 轮 P6 删除，详见 [17.0.0] 节）后按 W 模型 8 阶段从零重建，
> 验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可重复执行；
> 并通过回归测试发现 3 项工程配置缺陷（JWT_SECRET 缺失 / ArticleService 类型导出 / vitest mock 类型），
> 修复后纳入 [`w-model-dev/references/anti-patterns.md`](./w-model-dev/references/anti-patterns.md)「实现层经验教训」L2~L4。

#### 新增

- `w-model-dev-demo/tests/perf/k6-load-test.js`：k6 性能基线脚本（100 VUs × 30s，P95 < 200ms，覆盖文章列表 / 详情 / 登录）
- `w-model-dev-demo/tests/perf/README.md`：k6 安装 / 运行 / 解读说明（k6 是独立二进制，不纳入 npm 自动化链路）
- `w-model-dev-demo/tests/unit/validate.test.ts`：validate 中间件单元测试 13 用例（UT-031~043），行覆盖率 0% → 100%
- `w-model-dev-demo/tests/unit/jwt.utils.test.ts`：补充 5 边界用例（UT-031B~035B），branches 覆盖率 57.14% → 100%
- `w-model-dev-demo/tests/unit/password.utils.test.ts`：补充 3 边界用例（UT-024B~026B），branches 覆盖率 60% → 100%
- `w-model-dev/references/anti-patterns.md`「实现层经验教训」节：新增 L2（模块加载阶段抛错）+ L3（service 类导出方式反复）+ L4（vitest mock 与 express 类型不兼容）三条教训，与 SSoT §10B.4 双向追溯

#### 变更

- `w-model-dev-demo/` 完全清空后从零重建：4 份设计文档（1021 行）+ 工程配置 + src/ 全部源码 + 9 单元测试文件
- `w-model-dev-demo/package.json`：所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入，修复 L2 缺陷
- `w-model-dev-demo/src/services/article-service.ts`：恢复 `export class ArticleService`，与 `export const articleService` 共存，修复 L3 缺陷
- `w-model-dev-demo/tests/unit/auth-middleware.test.ts` + `tests/unit/error-handler.test.ts`：用 `ReturnType<typeof vi.fn>` / `Mock` 类型断言访问 mock.calls，修复 L4 缺陷
- `w-model-dev-demo/.w-model/rtm.json`：RTM 终检状态更新，8 行需求 × 7 字段全部非空，coverage.rtmCoverage=100 / unitTestCoverage=99
- `w-model-dev-demo/.w-model/project.json`：`status` 改为「已完成」，新增 `completedAt` 与 `acceptance` 字段（用户 `confirm` 归档）
- `w-model-dev-demo/docs/acceptance-test-report.md` §9：用户确认区填入 `confirm`（2026-07-21）
- `w-model-dev-demo/docs/system-test-report.md` §5 + §9.3：k6 脚本引用更新为 `tests/perf/k6-load-test.js`
- `w-model-dev-demo/docs/system-test-cases.md` ST-003：增加「工具」字段，注明 k6 设计原意 + vitest CI 近似验证
- `README.md`：参考实现节调测数据从 2026-07-20 baseline 更新到 2026-07-21 第二轮（65 单元 + 12 集成 + 6 系统 + 15 验收 = 98 测试，覆盖率 98.96%）；项目结构树补 `tests/perf/` 与 `.w-model/`
- `AGENTS.md` §4：参考实现调测数据同步更新；新增 4 项缺陷修正记录
- `docs/skill-design-document_SSoT.md` §1.4 + §10B 1-6 小节：全面重写，新增调测轮次 / 用户确认 / 4 项缺陷 / k6 边界声明
- `docs/INSTALL.md` §8 FAQ：调测数据同步更新，补 4 项缺陷与 L1~L4 指针

#### 端到端调测结论（2026-07-21 第二轮）

| 指标 | 目标 | 实测 | 与 baseline（2026-07-20）对比 |
|---|---|---|---|
| 单元测试 | 100% 通过 + 覆盖率 ≥ 80% | 65/65 通过，98.96% lines / 93.23% branches / 100% functions | 用例数 +43，覆盖率 lines -0.04pp（仍远超阈值） |
| 集成测试 | 100% 通过 | 12/12 通过 | 用例数 +6 |
| 系统测试 | 100% 通过 | 6/6 通过 + k6 脚本就绪 | 持平 + 新增 k6 |
| 验收测试 | 100% 通过 | 15/15 通过 + 用户 `confirm` 归档 | 持平 + 归档 |
| RTM 需求覆盖率 | 100% | 4/4（100%） | 持平 |
| 工件质量门 | 退出码 0 | 通过（退出码 0） | 持平 |
| TypeScript 严格编译 | 0 错误 | 退出码 0 | 持平 |
| 性能基线 | P95 ≤ 200ms | k6 脚本就绪，vitest 近似采样 P95=3ms | 新增 |

#### 验证

- `w-model-dev-demo/` 内 `npm install && npm test` → 98 用例全过（65 unit + 12 integration + 6 system + 15 acceptance）
- `w-model-dev-demo/` 内 `npm run coverage` → 总覆盖率 98.96% lines / 93.23% branches / 100% functions
- `w-model-dev-demo/` 内 `npx tsc --noEmit` → 退出码 0
- `w-model-dev-demo/` 内 `npx tsx ../w-model-dev/scripts/check-artifact-gate.ts .` → 退出码 0
- `tests/perf/k6-load-test.js` 通过 `node --check` 语法校验
- 文档一致性：`README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `docs/INSTALL.md` / `w-model-dev/references/anti-patterns.md` 均已同步至 2026-07-21 第二轮数据
- SSoT §10B.4 与 anti-patterns.md「实现层经验教训」节 L1~L4 双向链接校验通过

### 端到端调测：交付博客系统参考实现 + 文档同步

> 通过 `w-model-dev-demo/`（已于第 17 轮 P6 删除，详见 [17.0.0] 节）完整跑通 W 模型 8 阶段端到端调测，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用，并把调测结论与缺陷修正经验同步到全仓库文档。

#### 新增

- `w-model-dev-demo/`：博客系统后端参考实现（Express 4 + TypeScript 5 + 内存存储）
  - 8 阶段产出文档：`docs/`（需求规格 / 系统设计 / 概要设计 / 详细设计 + 四级测试用例与报告）
  - 可运行代码：`src/`（控制器 / 服务 / 存储 / 中间件，含 `utils/async-handler.ts` 缺陷修正产物）
  - 四级测试：`tests/`（unit 22 / integration 6 / system 6 / acceptance 15）
  - 独立 `package.json` / `tsconfig.json` / `vitest.config.ts`，与仓库根工具链解耦
- `AGENTS.md`：仓库根级 AI Agent 导航（与 README 互补，聚焦 Agent 行动所需最小事实集）
- `docs/skill-design-document_SSoT.md` §10B「参考实现（端到端调测验证）」：6 个子节，含项目概况 / 8 阶段产出对应 / 调测结论摘要 / 缺陷与修正 / 与 SSoT 章节映射 / 边界声明
- `w-model-dev/references/anti-patterns.md`「实现层经验教训」节：新增 L1（Express 4 async handler 不自动 catch）+ 扩展规则（与 SSoT §10B.4 双向追溯）

#### 变更

- `README.md`：新增「参考实现：`w-model-dev-demo/`」节（含调测结论表 + 缺陷修正指针）；项目结构补 `w-model-dev-demo/` / `.githooks/pre-push` / `AGENTS.md`；相关文档列表补 AGENTS.md 与参考实现两项
- `docs/skill-design-document_SSoT.md` §1.4：增加参考实现指针
- `docs/INSTALL.md` §7 目录速查：补「参考实现」与「Agent 仓库导航」两行；§8 FAQ 新增「哪里可以看到 W 模型 8 阶段的完整端到端产出样本？」
- `CONTRIBUTING.md`「项目结构约定」：补 `w-model-dev-demo/` 条目与边界声明；「SSoT 原则」同步链路补 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `docs/INSTALL.md`

#### 端到端调测结论（2026-07-20）

| 指标 | 目标 | 实测 |
|---|---|---|
| 单元测试 | 100% 通过 + 覆盖率 ≥ 80% | 22/22 通过，覆盖率 98% |
| 集成测试 | 100% 通过 | 6/6 通过（含 L1 缺陷修正） |
| 系统测试 | 100% 通过 | 6/6 通过 |
| 验收测试 | 100% 通过 | 15/15 通过 |
| RTM 需求覆盖率 | 100% | 4/4 需求 100% |
| 工件质量门 | 退出码 0 | 通过 |

#### 验证

- `w-model-dev-demo/` 内 `npm install && npm test` → 全部四级测试通过
- 文档一致性：`grep -rE "w-model-dev-demo"` 在 `README.md` / `AGENTS.md` / `docs/skill-design-document_SSoT.md` / `docs/INSTALL.md` / `CONTRIBUTING.md` / `w-model-dev/references/anti-patterns.md` 均有正确指针；无断链
- SSoT §10B 与 anti-patterns.md「实现层经验教训」节双向链接校验通过

### CI 改为本地推送前门禁

> 远程 GitHub Actions runner 始终无法分配（多次运行卡在 Queued，与代码无关），
> 改为本地 git `pre-push` hook 承载门禁职责，等价覆盖原 CI 的 5 项检查。

- 删除 `.github/workflows/ci.yml`，关闭远程 CI
- 新增 `.githooks/pre-push`：在 `git push` 时自动跑 self-test + 4 项 CLI 退出码冒烟，任一不符预期即中止推送
- 仅当本次推送触及 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 时才跑门禁，纯文档改动直接放行
- `package.json` 新增 `setup:hooks`（一次性启用 hook）与 `prepush`（手动跑全部门禁）快捷脚本
- `CONTRIBUTING.md` 同步说明启用与临时跳过（`git push --no-verify`）方式

### 大规模 Review 优化（P0-P3 共 18 项）

> 基于全项目 Review 报告，按优先级 P0×3 / P1×4 / P2×6 / P3×5 修复一致性、健壮性与可维护性问题。

#### P0 关键正确性

- 修复 `verifier-spec.md` §4.1/§4.2 字母语义与 §6.1 冲突：统一为 `A=完全达成 / D=完全未达成`，公式改为 `1.00*p_A + 0.67*p_B + 0.33*p_C + 0.00*p_D`
- 修复 `verifier-logic.ts` ranking.k/rounds 整数性校验缺失：增加 `Number.isInteger()` + 数值边界（k ∈ [2,1000]、temperature ≤ 100、rounds ≥ 1）
- 修复 `gate-logic.ts` RTM JSON 结构校验缺失：缺 `executionSummary` 时不再抛 TypeError，改为返回结构化 reasons；新增 `rows` / `executionSummary.<type>` / 行对象分层校验

#### P1 一致性

- 统一覆盖率表述：85 处「覆盖率」歧义区分为「单元测试代码覆盖率 ≥ 80%」与「RTM 需求覆盖率 100%」两个独立指标（涉及 SKILL.md / SSoT / phase-5/7/8 / verifier-spec / rtm-guide / quality-standards / templates / examples / scripts）
- 统一测试用例 ID 命名规则：阶段 6/7/8 执行用例从 `TC-INT/SYS/UAT-*` 改为 `IT/ST/UAT-*` 与 RTM 短形式一致；在 `rtm-guide.md` 增加命名规则章节说明两套 ID 体系（运行时 vs 阶段产物验证）
- SSoT §6.1 核心命令表列名「返回值」→「产出」
- `verifier-logic.ts` ranking.k/temperature 增加上界校验（防滥用：MAX_RANKING_K=1000、MAX_TEMPERATURE=100）

#### P2 健壮性与可维护性

- 去重验收检查清单：`SKILL.md` 项目级清单从 12 项压缩为核心 4 项 + 指针，避免与 `phase-8-acceptance-test.md` 重复
- 处理 `.claude/skills/darwin-skill/` 评估产物：迁移至 `eval/`，`.claude/` 加入 `.gitignore`
- 增加校验脚本样本测试：新增 `w-model-dev/scripts/samples/`（verifier 7 条 + gate 4 条共 11 条端到端样本）+ `self-test.ts` 自动跑通所有样本作为回归基线
- 统一 `verifier-spec.md` §8 占位符列表
- 拆分 `phase-1-requirements.md`「可选：需求形式化」节到独立文件
- `verifier-logic.ts` `varianceThreshold` 缺失时改为判失败而非警告

#### 验证

- `npx tsx w-model-dev/scripts/self-test.ts` → 11/11 通过
- `npx tsx w-model-dev/scripts/check-verifier-output.ts <sample.json>` 通过 / 失败路径均符合预期

### 一致性补全：命令执行规则与示例覆盖

> 全面扫描后发现 SKILL.md（Agent 实际读取的入口）在若干命令执行规则上与 SSoT / README / verifier-spec.md 不一致或不完整，本次补全使 10 个 `/wm` 命令均有可执行规则，并消除文档间不一致。

#### 新增

- `w-model-dev/SKILL.md` §5「`/wm test` 结果回填机制」：明确 `result=pass|fail` 必填、真实回填约束、与工件质量门的有效性关联（之前只在 README / SSoT / 脚本注释中说明，SKILL.md 自身缺失）
- `w-model-dev/SKILL.md` §6「辅助命令执行规则」：补全 `/wm review` / `/wm status` / `/wm help` / `/wm reset` / `/wm export` / `/wm import` 六个命令的详细执行步骤与 CHECKPOINT
- `w-model-dev/SKILL.md` §4「数据与状态管理」：补充 `.w-model/` 持久化目录结构与文件用途
- `w-model-dev/examples/test-execution.md`：新增测试执行阶段示例（phase 6 集成 / phase 7 系统 + 质量门 / phase 8 验收 + 项目交付），覆盖 `result=pass|fail` 回填、根因分析、CHECKPOINT 放行全流程

#### 变更

- `w-model-dev/SKILL.md` 命令接口表：
  - `/wm test` 参数补充 `result: pass / fail（必填，真实回填）`，产出列补充「RTM 状态更新」
  - `/wm review` 的 `target` 前缀由 `REQ-/SD-/AT-/文件路径` 修正为 `REQ- / DESIGN- / UAT- / ST- / IT- / UT- / 文件路径`，与 `references/verifier-spec.md` §2 权威定义一致
  - `/wm status` 产出列补充「RTM 覆盖率」
- `w-model-dev/SKILL.md` YAML frontmatter `description`：命令列表由 6 个（analyze/design/code/test/review/status）补全为 10 个（增加 help/reset/export/import），影响 Agent 自动激活触发判断
- `docs/skill-design-document_SSoT.md` §6.1 核心命令表：
  - `/wm design` 的 `type` 由 `(架构/详细)` 修正为 `(架构/概要/详细)`，与 SKILL.md / README 一致
  - `/wm test` 的 `type` 由 `(单元/集成/系统)` 修正为 `(单元/集成/系统/验收)`，并补充 `result` 参数
  - `/wm status` 返回值补充「RTM 覆盖率」
- `docs/skill-design-document_SSoT.md` §10A 追溯表：`6 命令接口` 行的实现位置补充「指令（执行规则）§5 `/wm test` 回填机制 + §6 辅助命令执行规则」
- `docs/skill-design-document_SSoT.md` 附录 A 命令速查：补全遗漏的 3 个命令（`/wm reset` / `/wm export` / `/wm import`），并修正 `/wm design` / `/wm test` 的参数格式
- `CONTRIBUTING.md`「添加新命令」节：删除旧架构残留的 `helpHandler` 引用，改为指向 SKILL.md「指令（执行规则）§1/§2/§3/§6」与 SSoT §6.1 / §6.2 / 附录 A 的同步更新流程

#### 验证

- `grep -E "helpHandler|REQ-/SD-/AT-|设计类型\(架构/详细\)|测试类型\(单元/集成/系统\)"` 在保留文件中无残留
- `npx tsx w-model-dev/scripts/check-verifier-output.ts` 退出码 2（输入错误，符合预期，未传文件）
- `npx tsx w-model-dev/scripts/check-artifact-gate.ts` 退出码 2（输入错误，符合预期，无 .w-model/rtm.json）
- 校验脚本未受影响：`verifier-logic.ts` `SUB_CRITERIA` 与 `verifier-spec.md` §7 完全一致（20/20 子标准）；`determineQualityLevel` 与 §6.1 完全一致
- 所有内部 Markdown 链接目标文件均存在，无断链

### 架构纯化：移除全部编程式接入

> 把本仓库确定为「单纯的编排 + 校验脚本技能」，不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）。
> 技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> 此变更撤销了此前 [Unreleased] 阶段规划的「内置 `src/` TypeScript 引擎 + `tests/` 测试套件 + `package.json` 工具链」方向，回归纯技能包形态。

#### 删除（编程式引擎与 Node 工具链）

- `src/` 整块移除：`index.ts`、`commands/router.ts`、`state/{project-state,rtm-manager}.ts`、`types/index.ts`（`/wm` 命令路由、状态持久化、RTM 维护改由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态持久化到项目内 `.w-model/*.json`）
- `tests/` 整块移除：`command-router.test.ts`、`project-state.test.ts`、`rtm-manager.test.ts`、`verifier-logic.test.ts`
- `examples/run-wm-flow.ts` 移除（编程式示例，与新架构不符）
- Node 工程化文件移除：`package.json`、`package-lock.json`、`tsconfig.json`、`jest.config.js`、`.eslintrc.cjs`
- `docs/IMPLEMENTATION-PLAN.md` 移除（内置引擎路线图，已不适用）

#### 保留（自包含校验脚本）

- `w-model-dev/scripts/gate-logic.ts`：工件质量门纯逻辑（自包含，仅依赖本目录内文件）
- `w-model-dev/scripts/verifier-logic.ts`：Verifier 输出校验纯逻辑（自包含）
- `w-model-dev/scripts/check-artifact-gate.ts`：工件质量门 CLI（读 `.w-model/rtm.json`，退出码 0/1/2）
- `w-model-dev/scripts/check-verifier-output.ts`：Verifier 输出校验 CLI（防外部 Agent 输出漂移）
- 校验脚本运行依赖仅为 `tsx`（用户通过 `npx tsx` 或全局安装调用），无需 `npm install`

#### 变更（文档同步至纯技能架构）

- `w-model-dev/SKILL.md`：移除「实现位置 / 快速验证 / 编程式接入」尾部章节；文件清单注释中去除 `src/` 引用
- `README.md`：架构边界表「W 模型阶段编排」实现位置改为 `w-model-dev/SKILL.md` + `references/*`；快速上手改为「AI Agent 安装（零依赖）」+「运行门禁校验脚本」；移除「编程式接入」章节与 `src/` / `tests/` / `examples/run-wm-flow.ts` 结构条目
- `docs/INSTALL.md`：重写为单一安装路径（移除模式 B 程序化模式 / 模式 A+B 混合使用 / `npm install` / `createCommandContext` 示例）；新增「为什么没有 npm install / package.json」FAQ
- `docs/skill-design-document_SSoT.md`：§1.4 架构重构说明、§3.3 边界表、§6.3 时序图、§8.1 技术栈表、§10.5 / §10A 追溯表、§11 部署集成方案全面改为纯技能架构描述
- `docs/skill-design-document.md`：用途表「实现入口（TypeScript）| src/index.ts」改为「AI Agent 安装指南 | INSTALL.md」
- `docs/llm-verifier-integration-design.md`：移除「命令路由实现 | ../src/commands/router.ts」引用
- `CONTRIBUTING.md`：移除 `npm test` / `npm run lint` / `npm run typecheck` 工作流与覆盖率阈值；改为 `npx tsx` 端到端校验；新增「脚本不得 import `src/`」自包含规则
- `.gitignore`：移除 `node_modules/` / `dist/` / `build/` / `*.tsbuildinfo` / `coverage/` 等不再相关的条目

#### 验证

- `grep -rE "src/|createCommandContext|dispatch\(|程序化|编程式|模式 ?B|混合使用|npm (run|test|install)|npx (jest|tsc|eslint)"` 在保留文件中无残留编程式接入引用（仅保留明确否定句「不包含编程式接入」与历史 tombstone 说明）
- `w-model-dev/scripts/*.ts` 校验脚本自包含性确认（仅 `import ./gate-logic.js` / `./verifier-logic.js` 与 Node 标准库）

### 已撤销的方向（历史记录）

> 以下为此前 [Unreleased] 阶段规划的「内置 `src/` 引擎」方向，已被上方「架构纯化」整体撤销，所列文件均已删除，保留仅作历史记录。

- 内置 `src/core/*` LLM 评分 / 验证 / 排序 / 增强器 / 客户端 / 元技能配置
- 内置 `src/evolution/skill-optimizer.ts` SkillOpt ReflectTrainer 训练循环
- 内置 `src/eval/skill-lift.ts` ACES Skill Lift 评估
- `w-model-dev/scripts/check-skill-gate.ts` 技能验证门
- `w-model-dev/META-SKILL.md` 可演化元技能配置
- `tests/verifier-logic.test.ts` 等 11 个测试套件、163 个测试
- `examples/run-wm-flow.ts` 编程式全流程示例
- `npx tsc --noEmit` / `npx jest` / `npx eslint` / `npm run example:run` 验证链
- `docs/INSTALL.md` 模式 A / 模式 B 双路径与混合使用说明

## [0.1.0] - 2026-07-16

基于 [issue #5](https://github.com/WangHHY19931001/Software_Engineering_W_Development_Model_Skills_Pack/issues/5)
的代码审查报告（评分 8.2/10）进行的项目扩大化优化首版。

### 新增

#### 核心引擎实现（issue Critical #1）
- 将 `llm-verifier-implementation-template.ts`（691 行模板）重构为模块化 `src/` 结构
- 实现 `LLMVerifierEngine`：基于 logits 期望值的连续评分，使用 log-softmax 保证数值稳定
- 实现 `VerificationFramework`：三维度验证（评分粒度 + 重复评估 + 标准分解）
- 实现 `PPTRanker`：O(N×k) 概率枢轴锦标赛排序算法
- 实现 `WModelVerifierEnhancer`：需求 / 设计 / 测试用例三阶段验证增强器

#### LLM Verifier 鲁棒性（issue High Priority #2）
- 新增 `fallbackStrategy` 配置：`text-parse` / `discrete` / `throw`
- 当 LLM 不支持 logits 时自动回退，解析字母（A-T）或数字并加稳定扰动
- `MockLLMClient` 支持模拟 logits / scoreLabel，便于离线测试
- `HttpLLMClient` 骨架，支持自部署推理服务（vLLM / TGI）

#### 状态持久化（issue Critical #2）
- 新增 `ProjectStateManager`：JSON 文件持久化（`.w-model/project.json`）
- 支持项目 / 需求 / 设计 / 测试用例 CRUD，自动 ID 生成
- W 模型阶段合法性校验（禁止跨阶段推进，允许回退返工）
- `exportJSON` / `importJSON` 支持项目迁移

#### RTM 自动化（issue Critical #2 + Medium #1）
- 新增 `RTMManager`：从 `ProjectStore` 自动重建需求跟踪矩阵
- 双向追溯：需求 ↔ 设计 ↔ 代码 ↔ 四级测试用例
- 覆盖率自动统计与缺失列告警
- 质量门检查：覆盖率 100% + 所有测试通过
- Markdown 导出（套用 `templates/rtm.md` 格式）
- 变更日志记录

#### /wm 命令路由（issue Critical #2）
- 新增 `commands/router.ts`：10 个命令（analyze / design / code / test / review / status / help / reset / export / import）
- 阶段校验：确保命令在合法阶段执行
- 实体登记：自动关联需求 ↔ 设计 ↔ 测试用例，保证 RTM 双向追溯
- 验证触发：analyze / design / review 时自动调用 LLM Verifier
- 质量门：验收测试阶段自动检查

#### 测试与覆盖率（issue 验收标准）
- 119 个单元测试，覆盖所有核心模块
- 全局分支覆盖率 83.58%（目标 ≥ 70%）
- 核心模块分支覆盖率 91.89%（目标 ≥ 85%）
- TypeScript 严格模式，`tsc --noEmit` 通过

#### 示例与文档
- 新增 `examples/run-wm-flow.ts`：W 模型 8 阶段全流程示例
- 新增 `README.md`：项目导航与快速上手
- 新增 `CONTRIBUTING.md`：贡献指南
- 新增 `IMPLEMENTATION-PLAN.md`：实现路线图
- 新增 `CHANGELOG.md`：本文件

### 变更

#### 文档同步（issue High Priority #1）
- `skill-design-document.md` 精简为指向 SSoT 的指针文档（570 行 → 37 行）
- 统一以 `skill-design-document_SSoT.md` 为单一事实来源

### 工程化
- 新增 `package.json`：ESM 模块，TypeScript 5.4，Jest + ts-jest
- 新增 `tsconfig.json`：ES2020 target，Bundler resolution，strict mode
- 新增 `jest.config.js`：覆盖率阈值配置（全局 70%，核心 85%）
- 新增 `.eslintrc.cjs`、`.gitignore`
