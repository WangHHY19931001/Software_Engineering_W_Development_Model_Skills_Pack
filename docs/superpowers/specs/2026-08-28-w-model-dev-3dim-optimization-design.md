# w-model-dev 三维度优化设计（可靠性 / 易用性 / 有效性）

> 状态：设计已获用户逐节确认（2026-08-28）。
> 本文是本轮融资优化的 SSOT 设计文档；实施计划由后续 writing-plans 产出。
> 仓库现状基线：`main@57b399b`，skill v41.19.0。

## 0. 背景与审计结论

### 0.1 审计方法

- 通读 `w-model-dev/SKILL.md`、`eval/README.md`、`eval/w-model-dev-test-prompts.json`、`docs/superpowers/plans/2026-08-25-w-model-reliability-optimization.md`、`docs/changes/2026-08-25-c2-documentation-acceptance.md`。
- 真实执行：`npm run self-test`（260/260 通过）、`npm test`（**28 失败** / 1239）、`npm run check:docs-consistency`（**exit 1**）、`bash --version` / `where.exe bash`（确认 PATH 首位为 WSL bash）。
- 规模测量：SKILL.md 173 行；references 53 个 .md 共 11886 行；生产脚本 89 个 .ts 共 28386 行。

### 0.2 三维度问题清单（基于真实执行证据）

**有效性（红）**

| # | 发现 | 证据 |
|---|---|---|
| E1 | 外部评估自 2026-07-21 暂停，v36→v41.19 六个大版本（v36-v41）零盲评 | eval/README.md §4「评估暂停中」 |
| E2 | 25 条标准化提示词资产完备，但无仓内自动化评估入口 | eval/ 目录仅 TSV + prompts.json |
| E3 | e2e 重建仅 1 条历史记录（2026-07-21），此后 40+ 轮改动无 e2e 验证 | eval/w-model-dev-results.tsv |

**可靠性（红）**

| # | 发现 | 证据 |
|---|---|---|
| R1 | 26-28 个测试失败集中在 `platform-deps-hook.test.ts`，退出码 127（command not found） | npm test 输出 |
| R2 | 根因：PATH 首位 `C:\Windows\System32\bash.exe`（WSL bash）优先于 Git Bash；测试用裸 `bash` 调用 hook 脚本 → WSL bash 无法执行 Windows 路径脚本 | where.exe bash；测试源码 L24-28 |
| R3 | 次生失败：EBUSY 临时目录清理竞争 | 失败输出 [32-37/49] |
| R4 | `check:docs-consistency` exit 1——R1 失败传导至 fail-closed 动态门禁（vitest 事实包不可信：27 failed） | docs-consistency 输出 DOCS_CONSISTENCY_JSON |
| R5 | C2 验收遗留：活体文档硬编码计数漂移（55 files/1002 tests vs 真实 58/1239）+ `dispatch-matrix.md`/`SKILL.md` 对 `check-tla-bdd-sync`、`platform-deps-install.ts` 登记漂移 | 2026-08-25-c2-documentation-acceptance.md §Deferred concerns |
| R6 | pre-push、lint:security、Persona CLI smoke、provenance 均无最新执行证据 | 同上 §Deferred #3 |

**易用性（黄）**

| # | 发现 | 证据 |
|---|---|---|
| U1 | SKILL.md 173 行「规则堆叠」形态：14 约束表 + 48 反模式引用 + 6 角色大表 + 多协议细节混排 | SKILL.md 全文 |
| U2 | references 53 文件 11886 行，认知负担大；TLA+ 6 文件 / BDD 4 文件 / 角色类 4 文件成组读取却分散 | 目录测量 |
| U3 | 新用户上手路径长（install→self-test→doctor→理解交付层→首个命令），无 5 分钟最小闭环 | README + INSTALL 结构 |
| U4 | Windows 新用户第一步 `npm test` 即见 26 红（易用性×可靠性交叉） | R1 |

### 0.3 已确认的决策（用户逐项拍板）

| 决策点 | 结论 |
|---|---|
| 与 2026-08-25 计划的关系 | **开新一轮全面优化**（不延续旧批次框架，但继承其执行纪律与未闭合事实） |
| 三维度顺序 | **有效性 → 可靠性 → 易用性** |
| 评估闭环形态 | **仓内资产 + 执行评估**（建 `npm run eval` 自动化资产，并由 Agent 实际执行基线与终值评估，双证据回填 TSV） |
| 易用性重构容忍度 | **大幅精简重写**（SKILL.md <100 行，references 合并） |
| 执行架构 | **方案 A：三批次串行**（评估资产+基线 → 可靠性修复 → 大重构+终值评估） |

## 1. 总体架构与批次契约

```
┌─ 批次 1 有效性：评估资产与基线 ──────────────────────────────┐
│ 新增仓内评估资产（npm run eval）                              │
│ 执行基线评估：仓内断言全量 + e2e demo 重建                    │
│ 回填 TSV 两条基线记录                                          │
│ 验收：npm run eval 可重复运行且 exit 0；TSV 有基线行           │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌─ 批次 2 可靠性：红灯清零 ────────────────────────────────────┐
│ 修 platform-deps-hook 的 bash 解析（显式 Git Bash 定位）       │
│ 修 EBUSY 临时目录清理健壮性（仅复现时）                        │
│ 最小文档对齐 → check:docs-consistency 转绿                    │
│ 补齐 pre-push/安全扫描/Persona CLI/provenance 执行证据        │
│ 验收：npm test 全绿 + docs-consistency exit 0 + 证据记录       │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌─ 批次 3 易用性：大幅精简重写 + 终值评估 ─────────────────────┐
│ SKILL.md 重写 <100 行（约束/反模式/角色细节下沉 references）   │
│ references 合并重组 + 新增 QUICKSTART                          │
│ 同步 docs-consistency 门禁契约与全部交叉引用                   │
│ 终值评估：npm run eval 全量 + 第 2 次 e2e → 回填 TSV           │
│ 验收：SKILL.md <100 行 + 全部门禁绿 + 评估终值 ≥ 基线          │
└──────────────────────────────────────────────────────────────┘
```

**关键设计决策**：

- **每批次独立提交**，在隔离 worktree 执行（沿用仓库既有纪律），批次间串行——符合「文档修改禁止并行」约束。
- **基线先行归因**：批次 1 在任何修复之前采集基线；批次 3 结束时「终值 vs 基线」对比即本次优化的有效性证明。
- **e2e demo 固定规格**：两次 e2e 用同一份最小规格，确保可比性（规格见 §2.3）。
- **不改动的边界**（继承仓库纪律）：8 阶段流程、RTM、CHECKPOINT、O/S/V/G/R 角色边界、「技能包不调用 LLM」、TLA+/BDD 领域规则全部不动。本设计优化的是「技能资产的可评估性、测试稳定性、文档认知负担」，不是方法论本身。

## 2. 批次 1：仓内评估资产与基线

### 2.1 定位

`npm run eval` 是第三条正交门禁：self-test 管行为回归、docs-consistency 管文档一致性、**eval 管「25 个场景要求的技能行为支撑是否完备」**。

核心洞察：25 条提示词的 `expected` 描述 Agent 应有行为，Agent 行为本身无法仓内自动化，但「支撑该行为的技能资产是否存在且被验证」可以。评估资产 = **提示词 ↔ 技能资产的映射验证器**。

### 2.2 三层断言

| 断言层 | 覆盖 | 机制 |
|---|---|---|
| L1 触发词断言 | id 1-7（触发/歧义/反误触发） | 正向触发词必须命中 SKILL.md 触发决策表；反误触发词不得出现；歧义词必须在「先询问」分支 |
| L2 机制存在性断言 | id 8-25（流程防护/新机制） | expected 引用的每个机制（如 `MAX_GRAPH_ROUNDS=5`、opsx 三段、反模式 #10）必须在三处有实体：脚本存在 + 逻辑层常量/规则存在 + references 对应章节锚点存在 |
| L3 行为证据映射 | 全部 25 条 | 每条 expected 至少映射到一个已存在的 self-test fixture 或 eval 断言，输出映射覆盖率 |

### 2.3 产出物与基线执行

**产出物**：

- `eval/runner.ts`（tsx 执行）+ `eval/mappings.json`（25 条提示词 → 资产锚点映射表，可审计）
- 输出 `eval/results.json`（逐条断言结果）+ 终端摘要 + 通过率（即有效性分数，供 TSV 基线/终值对比）
- 映射表本身有缺口时（某条 expected 找不到资产锚点）→ 该条失败，**缺口即优化 backlog**——「评估驱动优化排序」的机制

**基线执行**（批次 1 内完成）：

1. `npm run eval` 首跑 → 基线通过率 + 缺口清单 → 回填 TSV（dry_run 断言行）。
2. **e2e demo 重建**：固定规格 = Node 内置 `http` + 内置 `test:runner` 的极简 Todo REST API（零外部依赖，排除环境变量）；按 L2 成熟度、**非 self-as-verifier**（Agent 作编排者分派 S/V/G/R 子代理）走完整 8 阶段 → 回填 TSV（e2e 行）。
3. demo 规格与两次 e2e 的可比性规则：同一技术栈、同一成熟度级别、同一角色模式、同一通过判据（全阶段门 exit 0 + RTM 覆盖完整 + 四级测试真实执行）。

**边界**：不引入 LLM 调用；不修改 25 条提示词语义；eval runner 不进技能包交付层（留在仓库 `eval/`，不增加用户负担）。

## 3. 批次 2：可靠性红灯清零

### 3.1 修复项 1：bash 解析（根因修复）

`platform-deps-hook.test.ts` 的 `execFileAsync('bash', ...)` 裸调用命中 PATH 上的 WSL bash。修复为显式解析链：

```
GIT_BASH 环境变量 → git --exec-path 推导（../bin/bash.exe）→ 常见安装路径探测
→ 全部失败：结构化 skip + 明确诊断（"检测到 WSL bash，需 Git Bash"）
```

Windows 上 git 必备（仓库本身依赖 git），Git Bash 必然存在——问题是 PATH 顺序，不是缺依赖。修复后 127 消失，EBUSY 作为次生失败大概率随之消失；只有复现才加 cleanup retry（避免过度设计）。

### 3.2 修复项 2：以运行时证据重定范围

C2 验收文档（2026-08-25）的 3 条 deferred concerns 之后又有 15+ 提交，部分可能已闭合（今日实测静态违规已为 0）。批次 2 开工先跑门禁矩阵盘点真实缺口，**只修仍红灯的**，不做已闭合项的重复工作。

### 3.3 修复项 3：证据补齐

测试转绿后在同一 reviewed HEAD 跑齐：`npm test`（全量）、`check:docs-consistency`、`pre-push`、`lint:security`、`check:gate --validate-templates`、`check:samples-coverage`、4 个 Persona 真实 CLI smoke——结果写入 `docs/changes/` 验收记录（沿用仓库惯例，含 commit 身份链）。

### 3.4 验收标准

- 全量测试 0 失败（含 Windows/WSL-bash-PATH 环境下的 platform-deps-hook 28 条）。
- `check:docs-consistency` exit 0。
- 门禁矩阵全绿 + 验收记录落盘。
- TDD 纪律：bash 解析修复先写失败测试（模拟 WSL-bash-first PATH）再实现。

**已知风险**：如果某些 deferred concern 实际需要大改（如 `platform-deps-install.ts` 的 probe 契约），而它又在批次 3 的重写范围内——则批次 2 只做最小止血，大改留给批次 3，避免重复劳动。

## 4. 批次 3：易用性大重构与终值评估

### 4.1 SKILL.md 重写（173 行 → <100 行）

```
保留（高频决策必备）          下沉（references 已有完整版）
─────────────────────      ─────────────────────────────
frontmatter 触发词           14 约束表 → hard-constraints.md
核心原则（3 条铁律）          编排者-子代理大表 → subagent-delegation.md
触发决策表                    self-as-verifier 细节
最小执行路径（7 步新写）       阶段门命令块 → workflow.md
命令速查表（精简列）           Bundled Resources 表 → dispatch-matrix.md
阶段路由表                    provenance 边界说明 → 独立 reference
按需加载指针（一行一资源）     约束/反模式编号细节
CHECKPOINT 三条
```

原则：**SKILL.md 只回答「要不要启用、下一步分派谁、去哪读细则」三个问题**。触发决策表是 eval L1 断言锚点，原样保留。

### 4.2 references 合并——只合「成组读取」的

合并判据是真实读取模式，不是机械减数量：

- TLA+ 系列 6 文件 → `tla-plus.md`（guide + checklist 总是一起用）
- BDD 系列 4 文件 → `bdd.md`（同上）
- 约束+反模式 → `hard-constraints.md`（互引最频繁）
- 角色四文件（delegation/dispatch-matrix/persona-matrix/agent-personas）→ 收敛为 2 个
- **8 个 phase-N 文件不动**（按需加载契约的基石，独立触发）
- 目标：53 文件 → 约 38 文件
- **过渡策略**：合并用「旧文件留一行重定向指针」过渡一个版本（42.0.0），42.1.0 再删

### 4.3 QUICKSTART

新增 `references/quickstart.md`（随技能包交付），5 分钟路径 = 安装 → self-test → doctor → 一个 `/wm analyze` 最小回合。

### 4.4 门禁契约同步

docs-consistency 的 SKILL.md 结构预期、内链校验、dispatch-matrix 登记、相关 self-test fixture 全部随重写更新。批次 3 单 commit 内完成「重写 + 门禁同步 + 测试更新」，不留隔夜红灯。

### 4.5 终值评估收口

- `npm run eval` 全量 → 终值通过率 vs 基线（**验收线：不低于基线**）。
- 第 2 次 e2e（同规格 demo）→ 过程指标对比（分派次数 / CHECKPOINT 次数 / 返工次数）。
- 回填 TSV 终值行 + eval/README 状态节改「评估恢复」。
- 版本 bump：SKILL.md 大重写属 breaking 级 → `42.0.0`（沿用 version-bump 单源脚本）。

**回退策略**：批次 3 独立 worktree；终值评估 < 基线即回退重迭代，不硬合。

## 5. 风险与缓解

| # | 风险 | 概率 | 缓解 |
|---|---|---|---|
| 1 | **e2e 跑不通**：8 阶段全流程依赖 TLA+/BDD/图谱门禁，demo 规格复杂度定错会卡死 | 中 | 固定规格选零依赖 REST API + L2 成熟度；批次 1 先跑一次探路，卡点即降级为「记录卡点 + 仓内断言基线仍有效」——e2e 是增强证据不是阻塞项 |
| 2 | **EBUSY 不随 bash 修复消失**（Windows 文件锁独立根因） | 中 | 复现后再修：cleanup 加 retry + 忽略 EBUSY 清理失败（测试断言不依赖临时目录删除成功） |
| 3 | **SKILL.md 精简破坏触发行为**：下沉内容后 Agent 找不到关键约束 | 中 | eval L1 触发词断言 + L2 机制锚点断言全量回归；终值 < 基线即回退迭代 |
| 4 | **合并 references 打破 40+ 轮建立的交叉引用**（内部互链、反模式编号、dispatch-matrix 登记） | 高 | 合并前先跑内链扫描建立引用图；合并用「旧文件留一行重定向指针」过渡一个版本，42.1.0 再删 |
| 5 | **docs-consistency 门禁契约与重写不同步**导致中间态红灯 | 高 | 批次 3 单 commit 内完成「重写 + 门禁同步 + 测试更新」，不留隔夜红灯 |
| 6 | 评估映射表本身有错（假阳性/假阴性） | 低 | mappings.json 评审纳入用户审查点；断言失败时输出具体锚点证据供人工核 |

## 6. 执行纪律

- 每批次独立 worktree + 独立提交，批次间串行。
- TypeScript 改动前记录符号影响半径；codegraph 不可用时记录到 `.w-model/codegraph-queries/`。
- TDD：先失败测试再修复。
- 编排者只负责分派、状态和证据；代码/测试/文档实施由 S 子代理执行，V 子代理独立评审，G 子代理执行门禁（沿用仓库 W 模型纪律）。
- **不伪造任何评估/门禁证据**——所有 TSV 回填值来自真实执行输出。

## 7. 非目标（明确不做）

- 改 8 阶段方法论、改 O/S/V/G/R 角色边界。
- 引入 LLM 调用（技能包不调 LLM 的铁律不动）。
- 改 TLA+/BDD 领域规则。
- 重写 darwin-skill 外部工具集成（外部工具不在仓库内）。
- 把纯 Windows 无 Bash 的既有放行策略改成另一套平台策略。

## 8. 验收总表

| 批次 | 验收线 |
|---|---|
| 批次 1 | `npm run eval` 可重复运行且 exit 0；TSV 有基线行（dry_run + e2e 各一条） |
| 批次 2 | `npm test` 0 失败；`check:docs-consistency` exit 0；门禁矩阵证据落盘 `docs/changes/` |
| 批次 3 | SKILL.md <100 行；references ≈38 文件；全部门禁绿；eval 终值 ≥ 基线；TSV 终值行 + eval/README 状态更新；版本 42.0.0 |
