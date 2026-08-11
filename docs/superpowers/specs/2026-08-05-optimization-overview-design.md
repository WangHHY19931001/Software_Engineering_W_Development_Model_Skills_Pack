# 第 33 轮设计：全仓库优化 5 批实施（总框架）

> 触发：对技能包仓库进行全仓库深入分析（脚本代码 / .cursor/skills / w-model-dev 资产 / 根目录与附属目录），产出 P0-P3 分级发现 ~40 项。用户经头脑风暴确定"5 批全做、分批推进"实施策略。
>
> 当前版本：`32.0.0`；目标版本：`33.0.0`（package.json + SKILL.md frontmatter + skill-metadata.json 三处同步，全部批次完成后统一升级）。
>
> 工作流：头脑风暴 → 设计（本文为总框架）→ 各批次独立 spec → 各批次 plan → 分批实施 → 分批验证与提交 → 收尾（版本号 + SSoT + CHANGELOG + 顶层文档同步）。
>
> 文档定位：本文是**总框架与决策记录**，不替代各批次的详细 spec/plan。批次 1-5 各自在实施前产出独立 spec 与 plan。

## 1. 背景与分析结论摘要

### 1.1 分析范围

对仓库 5 大区域做并行只读深入审查：

| 区域 | 规模 | 分析重点 |
|---|---|---|
| `w-model-dev/scripts/` | 29 check 脚本 + 21 逻辑层/工具 + self-test(213 条) + 28 测试 | 代码质量、性能、安全 |
| `.cursor/skills/` | 20 个 Cursor 技能包（含脚本） | 技能实用性、一致性 |
| `w-model-dev/` 核心资产 | SKILL.md + 41 references + 19 schema + 29 subagent + templates/examples | 结构、可维护性、漂移 |
| 根目录 + docs + eval + demo + .githooks | README/AGENTS/CHANGELOG/SSoT(3065 行) 等 | 入口文档一致性、流程效率 |

### 1.2 总体结论

- 工程质量高：版本号三处一致、反模式 #1–#43 编号无跳号、references 交叉链接无 404、19 份 schema 无字段级矛盾、脚本无 shell 注入/ReDoS/敏感日志面。
- **无 P0 阻断项**。
- 问题集中在：**计数陈旧**（"29 条反模式""13 份 schema"等历史数字残留）、**少量 P1 安全缺陷**（1 处 Windows 路径门禁静默放行）、**文档与事实漂移**（README 结构树过时、data-models 矛盾注释、eval 数据冻结在 v13 时代）。

### 1.3 发现统计（按级别）

| 级别 | 数量 | 代表项 |
|---|---|---|
| P0 | 0 | — |
| P1 | 4 | isMain Windows 路径缺陷、macOS 残留、29→43 计数、README 树过时 |
| P2 | ~12 | exit 0/1 模板重复、--phase 校验 5 种实现、graph O(n²)、anti-patterns 表缺行、双轨漂移等 |
| P3 | ~10 | gitignore/tsconfig 补充、孤立文件清理、JSON reviver 防御等 |

## 2. 决策记录（用户确认）

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 实施范围与推进方式 | **5 批全做、分批推进**；每批完成后独立验证并提交 |
| D2 | 版本号策略 | 5 批全部完成后**统一升级** 33.0.0（三处同步，遵循仓库"重大轮次升级"惯例） |
| D3 | git 提交粒度 | **子任务级 commit**（每批内按子任务拆分多个 commit） |
| D4 | 删除边界 | **按分析报告建议删除**（macOS 残留、孤立文件、demo 冗余 build 脚本与 txt、diag-fix.ts、已提交的运行时产物） |
| D5 | 依赖变更 | **允许移除未使用 devDeps**（@cucumber/cucumber、@cucumber/messages），package.json + INSTALL.md 同步 |
| D6 | 组织方案 | **方案 B：批次独立 spec**——5 份 spec 完全独立，每批各自"设计→计划→执行→验证" |
| D7 | eval 处理 | **补跑评估**（外部工具 darwin-skill 执行，仓库内接收产物更新 TSV + README） |

## 3. 批次划分与依赖

| 批次 | 名称 | 性质 | 内容数 | 风险 | 依赖 |
|---|---|---|---|---|---|
| 批次 1 | 安全加固 | 脚本修复 | 4 项 | 低 | 无 |
| 批次 2 | 一致性快修 | 文档修正 + 文件清理 | ~11 项 | 低 | 无 |
| 批次 3 | 脚本瘦身 | 代码重构（须行为等价） | ~12 项 | 中 | 批次 1（state-machine 同一文件先修后重构） |
| 批次 4 | 流程与体验 | 配置 + 清理 + 契约 | ~10 项 | 低-中 | 批次 2（部分文档交叉） |
| 批次 5 | 技能缺口 + 评估 | 新建技能 + 外部评估 | 3 项核心 + 收尾 | 中 | 批次 1-4 完成 |

### 3.1 批次 1：安全加固（4 项）

| # | 级别 | 内容 | 位置 |
|---|---|---|---|
| 1.1 | P1 | isMain 守卫改 `fileURLToPath(import.meta.url)`（消除 Windows 特殊路径下门禁静默 exit 0 放行） | `w-model-dev/scripts/check-state-machine-consistency.ts:159-165` |
| 1.2 | P2 | `cleanTraceFiles` 限定 TLC 产物白名单（防 manifest 指向敏感目录时递归误删） | `w-model-dev/scripts/check-tla-model.ts:176-204` |
| 1.3 | P2 | `BRAINSTORM_OPEN_CMD` 拼接改 `execFile` 参数数组（消除命令注入面） | `.cursor/skills/brainstorming/scripts/server.cjs:539` |
| 1.4 | P3 | JSON.parse 入口统一加 `__proto__`/`constructor` reviver 防御 | `lib/read-json-or-exit.ts` 及全部 parse 入口 |

### 3.2 批次 2：一致性快修（~11 项）

| # | 级别 | 内容 |
|---|---|---|
| 2.1 | P1 | 删除 macOS 残留 `subagent/engineering-technical-writer (1).md`（逐字节重复） |
| 2.2 | P1 | "29 条→43 条"三处修正：SKILL.md:132 / anti-patterns.md:709 / definition-of-done.md:58 |
| 2.3 | P1 | README 结构树整体刷新：恢复 demo 条目、补 `.cursor/`、补 12+ 脚本、补 references 缺项、归档 2→4、eval 3→15 条 |
| 2.4 | P1 | data-models.md 修正：删除"B3 待同步"矛盾注释、Schema 清单 13→19、checkpoint-log 第 833 行不实声明 |
| 2.5 | P2 | AGENTS.md self-test 分解明细 215→213（按 self-test.ts 实际输出核对） |
| 2.6 | P2 | 轮次编号口径统一（CHANGELOG [32.0.0]"第三十三轮" vs 各处"第 32 轮"，以版本号为准） |
| 2.7 | P2 | anti-patterns.md 三张速查表补 #31–#43 行，统一 `#33`/`#42` 格式 |
| 2.8 | P2 | command-reference.md 补 `/wm hill-climbing` 章节 |
| 2.9 | P2 | SKILL.md Bundled Resources 补 `signature-chain-guide.md`；决策 `signature-chain.schema.json` 去留 |
| 2.10 | P2 | persona-matrix / agent-personas 的 product 类计数 3→4 |
| 2.11 | P3 | 其余计数陈旧：quality-standards"8 模板"、README"10 个 logic import"、dispatch-matrix 30.1.0→32.0.0、skill-metadata.test 纳入 package.json 版本校验 |

### 3.3 批次 3：脚本瘦身（~12 项，行为等价）

| # | 级别 | 内容 |
|---|---|---|
| 3.1 | P2 | 抽 `lib/report.ts` 统一 exit 0/1 报告模板（约 20 个 check 脚本，预计删 600+ 行） |
| 3.2 | P2 | 统一 `--phase` 严格校验工具函数（以 artifact-gate 的 `/^\d+$/`+`Number.isInteger` 为准） |
| 3.3 | P2 | graph-logic.ts 用 outEdges/inEdges 索引替换 4 处线性扫描（O(n²)→O(n)） |
| 3.4 | P2 | code-tla-logic.ts getLine 改 `ts.getLineAndCharacterOfPosition` |
| 3.5 | P2 | state-machine 纯逻辑下沉为 `state-machine-logic.ts`（消除"逻辑与 CLI 同文件"唯一反例） |
| 3.6 | P2 | bdd-model TLA+ 快照解析 + self-test BDD 场景解析收敛至 tla-logic/bdd-logic 单一实现 |
| 3.7 | P2 | 统一 UAT 表格解析（artifact-gate 与 design-contract 两套正则合一） |
| 3.8 | P2 | JSONL 扫描样板合并（budget/maturity/role-dispatch/preventive-review 复用 readJsonlOrExit） |
| 3.9 | P3 | 移除未用 devDeps（@cucumber/*）+ SCRIPT_JSON 死模式 + 孤儿样本清理 |
| 3.10 | P3 | 删除 diag-fix.ts + 清理 samples/.w-model/gate-logs 已提交产物 |
| 3.11 | P3 | signature-chain-logic 原地 sort 改副本排序 |
| 3.12 | P3 | 抽取 `readJsonOptional`（可选 JSON 附属输入三分支样板 5 处） |

### 3.4 批次 4：流程与体验（~10 项）

| # | 级别 | 内容 |
|---|---|---|
| 4.1 | P3 | 根 .gitignore 补 `coverage/`、`*.tsbuildinfo`、`.eslintcache`；demo .gitignore 补 `.w-model/` |
| 4.2 | P3 | tsconfig 将 `__tests__` 纳入 tsc 类型检查 |
| 4.3 | P2 | pre-push 改 `set -euo pipefail` + L109 注释 149→213 + Windows 兼容入口 |
| 4.4 | P2 | demo 清理 10 个 build-*.cjs + 5 个 integration-*.txt（约瘦身 15-20%） |
| 4.5 | P3 | docs/changes 孤悬 design.md 移入 archive/ |
| 4.6 | P2 | 技能双轨契约对齐：writing-plans ↔ phase-5-coding、code-reviewer ↔ verifier-spec 补交叉引用 |
| 4.7 | P2 | `__tests__/README.md` 覆盖矩阵补 12/28 行 |
| 4.8 | P3 | start-server.sh 补 set -euo pipefail + kill 前 PID 归属校验 |
| 4.9 | P3 | brainstorming SKILL.md 技能路径前缀修正（`skills/`→`.cursor/skills/`） |
| 4.10 | P3 | 归档 systematic-debugging 下 5 个孤立测试产物 |

### 3.5 批次 5：技能缺口 + 评估（3 项核心 + 收尾）

| # | 级别 | 内容 |
|---|---|---|
| 5.1 | P1 | 新建 `security-review` 技能（对齐 security-scan.ts + 反模式 #43 凭据脱敏） |
| 5.2 | P2 | 新建 `codegraph-exploration` 技能（封装约束 #20 查询落盘流程） |
| 5.3 | P2 | eval 补跑 darwin-skill 评估（外部工具执行，仓库内接收产物更新 TSV + README） |
| 5.4 | P3 | 可选：performance-review 技能（视 5.1/5.2 完成后效果决定） |

**收尾（批次 5 完成后统一执行）**：版本号三处升级 32.0.0→33.0.0、SSoT 新增轮次记录、CHANGELOG [33.0.0]、README/AGENTS/CONTRIBUTING/INSTALL 同步。

## 4. 共享约束（跨批次不变量）

1. **行为等价**：脚本改动必须保持输出等价（stdout / stderr / exit code 三要素）；self-test 213 条基线 + vitest 363 条 + TS strict 0 错误为强制验收门槛。
2. **文档修改串行执行、禁止并行**（用户既定规则）：文档修改须先 grep 定位 → 读取 → 分析 → 修正 → 再读确认。
3. **每批独立验证 + 子任务级 commit**：每批完成后跑全量验证并提交，不跨批混提。
4. **删除类操作按本设计授权执行**，删除清单见各批次明细。
5. **依赖变更受限**：仅允许移除已确认未用的 devDeps；不新增运行时依赖。
6. **脚本自包含**：`w-model-dev/scripts/*.ts` 不得 import 任何 `src/` 或外部业务模块，仅依赖本目录内文件 + Node 标准库 + 已声明 devDeps。

## 5. 验证策略与验收标准

### 5.1 全局验证基线（每批强制门槛）

| 验证项 | 命令 | 门槛 |
|---|---|---|
| 自检基线 | `npm run self-test` | 213 条全通过（批次 3 后预期不变或按新增样本同步更新计数） |
| 单元测试 | `npx vitest run` | 363 条 / 28 files 全通过 |
| 类型检查 | `npx tsc --noEmit` | 0 错误（strict） |
| 安全基线 | `npm run lint:security` | baseline 比对通过（新增代码触发新指纹时走 `--regenerate` 流程） |
| 推送门禁 | `npm run prepush` | 12 项全过（批次 4 修复 Windows 入口后 PowerShell 下可运行） |
| 版本一致性 | 三处比对 | package.json = SKILL.md frontmatter = skill-metadata.json |

### 5.2 分批验收标准

**批次 1**：全局基线全过；含空格/中文路径下 state-machine 门禁正常校验（不再静默 exit 0）；cleanTraceFiles 对恶意 manifest 拒绝删除；server.cjs 含空格参数正常执行；JSON reviver 过滤 `__proto__`。

**批次 2**：`grep "29 条流程反模式"` 全仓 0 命中；subagent 目录无 `(1)` 残留；README 结构树与实际目录逐项一致；data-models 无"待同步/B3"矛盾注释且 Schema 清单 19 份；AGENTS 明细合计 213；轮次口径统一；anti-patterns 三张表覆盖 #1–#43。

**批次 3**：全局基线全过；**行为等价抽查**——每个重构脚本用 samples/ 代表性样本（valid+bad+边界）对比重构前后 stdout/stderr/exit code 完全一致；净代码行数减少 ≥ 600；`npm install` 干净无告警；samples/.w-model/gate-logs 清理且被 gitignore。

**批次 4**：`npm run prepush` 在 Windows PowerShell 下 12 项全过；demo 瘦身 15-20% 且测试套件不受影响；`.gitignore` 新规则生效；tsconfig 纳入 `__tests__` 后 tsc 0 错误；双轨契约交叉引用补齐无 404。

**批次 5**：新技能通过 writing-skills 校验（frontmatter 规范、指令可执行、无占位符）；新技能与 w-model-dev 对应机制对齐；eval TSV 更新为当前版本评估记录；收尾验证（三处版本 33.0.0、SSoT/CHANGELOG/顶层文档同步、全局基线全过）。

### 5.3 行为等价验证方法（批次 3 专用）

1. 重构前 `git stash` 或 `git show HEAD:<file>` 留存旧版副本。
2. 对每个重构脚本运行样本矩阵：samples/ 下 valid + bad 样本 + 边界输入（无参数、目录路径、非法 phase 格式）。
3. 逐脚本比对三要素：stdout / stderr / exit code。
4. 差异为 0 才算通过；任一差异即回退该子任务并修正。

### 5.4 文档一致性验证方法（批次 2/4 专用）

- 数字口径：对关键计数（反模式 43 / schema 19 / 模板 12 / self-test 213 / vitest 363 / 轮次口径）做全仓 grep 核对。
- 链接完整性：抽查 references/SKILL/README 的 markdown 链接目标存在性。
- 结构树核对：README 树 vs 实际目录逐项比对。

## 6. 产出物安排

| 阶段 | 产出物 | 位置 |
|---|---|---|
| 本设计 | 总框架 spec（本文） | `docs/superpowers/specs/2026-08-05-optimization-overview-design.md` |
| 每批实施前 | 批次 spec × 5 | `docs/superpowers/specs/2026-08-05-opt-batch-N-<name>-design.md` |
| 每批实施前 | 批次 plan × 5 | `docs/superpowers/plans/2026-08-05-opt-batch-N-<name>.md` |
| 批次 5 收尾 | 版本号三处 33.0.0 + SSoT §3.4.N + CHANGELOG [33.0.0] + 顶层文档同步 | 仓库各对应位置 |

## 7. 不涉及范围

- 不改 exit 1 校验语义（violations 列表 + `XXX_JSON` 摘要结构不变）。
- 不改 check-role-dispatch 坏行行为（第 29 轮已决策，行为不等价不重构）。
- 不引入新运行时依赖；不新增 LLM 调用；技能包"纯提示词 + 门禁脚本"架构定位不变。
- 不做技能拆分（早前会话已评估：W 模型方法论为固有领域复杂度，拆分弊大于利）。
