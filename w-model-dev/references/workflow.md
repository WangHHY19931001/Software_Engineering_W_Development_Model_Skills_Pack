# 完整工作流程（W-Model Workflow）

> 本文件由 [`w-model-dev/SKILL.md`](../SKILL.md)「完整工作流程」节拆出，
> 供 Agent 在初始化项目、阶段切换、向用户解释整体流程时按需加载。
> SKILL.md 中保留简短摘要 + 指针。

## 目录

- 总体流程与阶段对应
- 阶段产物和切换判定
- 阶段门与质量门
- 回退路径和工作流反模式

## 总体流程图

> 角色标注：**O** = 编排者（路由 / 状态 / CHECKPOINT / 持久化）；**S** = 产出子代理；**V** = 评审子代理；**G** = 门禁子代理；**A** = 分析子代理（阶段 1–4 活跃，ingestion 子流程 + 图谱演进，详见 [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) / [graph-guide.md](graph-guide.md)）。详见 [subagent-delegation.md](subagent-delegation.md)。

```
[O 路由] 需求分析 ──(S 同步验收测试设计)+(A 图谱: REQ 节点+连通单根校验)──► [V 评审] ──[G 门禁通过]──► 系统设计
                                                    │不通过► 回到需求分析（O 分派 S 返工）
[O 路由] 系统设计 ──(S 同步系统测试设计)+(A 图谱: SD 节点+implements 校验)──► [V 评审] ──[G 门禁通过]──► 概要设计
                                                    │不通过► 回到系统设计
[O 路由] 概要设计 ──(S 同步集成测试设计)+(A 图谱: INTF 节点+defines 校验)──► [V 评审] ──[G 门禁通过]──► 详细设计
                                                    │不通过► 回到概要设计
[O 路由] 详细设计 ──(S 同步单元测试设计)+(A 图谱: DD 节点+realizes 校验, 零违反硬约束)──► [V 评审] ──[G 门禁通过]──► 编码实现
                                                    │不通过► 回到详细设计
[O 路由] 编码实现 ──(S 执行单元测试)──────► [V 代码审查] ──[G 门禁通过]──► 集成测试
                                                    │不通过► 回到编码实现
[O 路由] 集成测试 ──(S 接口验证)──────────► [G 门禁通过]──► 系统测试
                              │不通过► 回到编码实现
[O 路由] 系统测试 ──(S 性能/安全测试)─────► [S 缺陷修复] ──[G 门禁完成]──► 验收测试
                              │需修复► 回到编码实现
[O 路由] 验收测试 ──(S 执行)──► [G 终检 check-artifact-gate.ts] ──[O CHECKPOINT 用户确认]──► 项目完成
                              │不通过► 回到需求分析 / 编码
```

> **编排者越权实施**（如 O 直接产出 / 评审 / 跑门禁并替代 G 回填）命中反模式 #10，回到当前阶段起点（见 [anti-patterns.md](anti-patterns.md) #10）。

## 阶段与测试并行对应表

| # | 开发阶段（左 V） | 同步测试设计（右 V） | 对应执行测试 | 详细指引 |
|---|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | 验收测试执行 | [phase-1-requirements.md](phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | 系统测试执行 | [phase-2-system-design.md](phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | 集成测试执行 | [phase-3-outline-design.md](phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | 单元测试执行 | [phase-4-detailed-design.md](phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | — | [phase-5-coding.md](phase-5-coding.md) |
| 6 | 集成测试 | — | 集成测试执行 | [phase-6-integration-test.md](phase-6-integration-test.md) |
| 7 | 系统测试 | — | 系统测试执行 | [phase-7-system-test.md](phase-7-system-test.md) |
| 8 | 验收测试 | — | 验收测试执行 | [phase-8-acceptance-test.md](phase-8-acceptance-test.md) |

## 阶段产物清单与切换条件（指令具体性）

> 每个流程图节点的输入 / 产物 / 切换判定条件明确化，Agent 据此判定阶段是否可推进，禁止凭印象切换。
>
> **子代理分派列**标注本阶段由哪些角色执行（O=编排者 / S=产出子代理 / V=评审子代理 / G=门禁子代理）。编排者不得越权实施（反模式 #10）。

| 阶段 | 输入 | 产物（artifact） | 子代理分派 | 切换到下一阶段判定 | 回退阶段编号 |
|---|---|---|---|---|---|
| 1 需求分析 | 用户需求陈述 / 业务背景 | 需求规格说明书（`*-requirement-spec.md`）、RTM 需求列 + 验收测试列、graph.json（REQ 节点） | O 路由 → S 产出 → V 评审 → G 门禁 | `check-verifier-output.ts` 退出码 0 且 `VerifierOutput.passed=true` 且 `qualityLevel ∈ {A,B}` | — |
| 2 系统设计 | 阶段 1 全部产物 | 系统设计文档（`SD-N.N.N`）、RTM 设计文档列 + 系统测试列、graph.json（SD 节点） | O 路由 → S 产出 → V 评审 → G 门禁 | 同上 | 阶段 1 |
| 3 概要设计 | 阶段 2 全部产物 | 接口设计文档（`SD-N.N.N`）、RTM 接口列 + 集成测试列、graph.json（INTF 节点） | O 路由 → S 产出 → V 评审 → G 门禁 | 同上 | 阶段 2 |
| 4 详细设计 | 阶段 3 全部产物 | 详细设计文档（`SD-N.N.N`）、RTM 详细列 + 单元测试列、graph.json（DD 节点） | O 路由 → S 产出 → V 评审 → G 门禁 | 同上 | 阶段 3 |
| 5 编码实现 | 阶段 4 全部产物 | 源代码文件、RTM 代码模块列 | O 路由 → S 产出代码+单测 → V 代码审查 → G 门禁 | `check-verifier-output.ts` 退出码 0 + 单元测试退出码 0 + 覆盖率 ≥ 80% | 阶段 4 |
| 6 集成测试 | 阶段 5 全部产物 + 集成测试设计 | 集成测试报告、RTM 集成测试状态列 | O 路由 → S 执行测试+回填 → V 评审报告 → G 门禁 | 集成测试退出码 0，`rtm.json.executionSummary.failed=0` | 阶段 5 |
| 7 系统测试 | 阶段 6 全部产物 + 系统测试设计 | 系统测试报告、RTM 系统测试状态列 | O 路由 → S 执行测试+回填 → V 评审报告 → G 门禁 | 系统测试退出码 0，性能 P95 < 2s，高危漏洞数 = 0 | 阶段 5 |
| 8 验收测试 | 阶段 7 全部产物 + 验收测试设计 | 验收测试报告、RTM 验收测试状态列 + 终检 | O 路由 → S 执行测试+回填 → V 评审报告 → G 终检门禁 | `check-artifact-gate.ts` 退出码 0 + 用户确认放行 | 阶段 1（需求级缺陷）/ 阶段 5（一般缺陷） |

### 阶段切换判定字段（精确对应）

- **VerifierOutput.passed**：阶段 1~4 的主判定字段，`true` 才可推进。
- **VerifierOutput.qualityLevel**：必须 ∈ {A, B}；C/D 一律回退到对应阶段起点。
- **rtm.json.executionSummary**：阶段 5~8 的状态字段，`failed=0` 且 `pending=0` 才可推进。
- **check-artifact-gate.ts 退出码**：阶段 8 终检，0 才可发布；1/2 一律回阶段 5。
- **覆盖率 / 性能 / 安全阈值**：阶段 5~7 的硬阈值（覆盖率 ≥ 80%、P95 < 2s、高危漏洞数 = 0），不达标回阶段 5。

### 回退路径阶段编号映射

| 当前阶段 | 触发回退的判定 | 回退到 |
|---|---|---|
| 阶段 1~4 | `VerifierOutput.passed=false` / `qualityLevel ∈ {C,D}` | 当前阶段起点（重产出 + 重评） |
| 阶段 5 | 单元测试退出码 ≠ 0 / 覆盖率 < 80% / Verifier `passed=false` | 阶段 5 编码返工 |
| 阶段 6 | 集成测试退出码 ≠ 0 / `executionSummary.failed>0` | 阶段 5 编码实现 |
| 阶段 7 | 系统测试退出码 ≠ 0 / 性能不达标 / 高危漏洞 > 0 | 阶段 5 编码实现 |
| 阶段 8 | `check-artifact-gate.ts` 退出码 1/2 | 阶段 5（一般缺陷）/ 阶段 1（需求级缺陷，罕见） |

### 回退路径阶段编号映射（R 根因分类扩展）

> 当 R 定位根因标记 `upstreamDefect.present=true` 且 `rollbackRecommended=true`，并经 V 复审通过后，按以下映射决定回退目标阶段（见 root-cause-locator.md 场景 5 阶段回退）。

| 当前阶段 | R 根因分类 | upstreamDefect.upstreamPhase | 回退到 |
|---|---|---|---|
| 阶段 2-4 | `requirement-gap` | 阶段 1 | 阶段 1 |
| 阶段 3-4 | `design-flaw` | 阶段 2 | 阶段 2 |
| 阶段 4 | `design-flaw` | 阶段 3 | 阶段 3 |
| 阶段 5-8 | `requirement-gap` | 阶段 1 | 阶段 1（罕见，重大需求缺陷） |
| 阶段 5-8 | `design-flaw` | 阶段 2/3/4 | 阶段 2/3/4 |
| 阶段 5-8 | `coding-error` | — | 阶段 5（当前阶段返工，不回退） |
| 阶段 6-8 | `coding-error` | 阶段 5 | 阶段 5 |

## 阶段门评审（每个阶段统一）

> 🔴 **CHECKPOINT · 每个阶段门**：流程图中每个「评审」节点都是暂停点。Agent 必须按 [verifier-spec.md](verifier-spec.md) §8 提示词执行 LLM-as-a-Verifier 评审，调用 `npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>` 防漂移，向用户展示「质量等级 / 各子标准分 / reworkHints」由用户确认放行或返工。**禁止越过评审节点自动推进**（见 [anti-patterns.md](anti-patterns.md) #1/#8）。

每个开发阶段产出后必须经过 LLM-as-a-Verifier 评审：

- 评审通过（`passed=true`，质量等级 A/B） → 进入下一阶段，更新项目状态。
- 评审不通过（`passed=false`，质量等级 C/D） → 回到本阶段起点返工，**必须经 R 根因定位 → V 复审 → G 门禁 → S-fix 修复 → V → G 循环**（见下方返工循环流程图），禁止直接分派 S 返工（命中反模式 #18）。
- 评审流程详见 [`verifier-spec.md`](verifier-spec.md) 与 SKILL.md「阶段门与质量门」节。

### 返工循环（V/G→R→V→G→S-fix→V→G）

```
S 产出 → V 评审 → G 门禁 ──通过──► 阶段门放行
                       │不通过（exitCode≠0 或 qualityLevel∈{C,D}）
                       ▼
                  O 分派 R 定位（输入：reworkHints + 失败产物 + 上游产物）
                       │
                       ▼
                  R 产出 RootCauseReport（含根因链 + fixRecommendation + upstreamDefect?）
                       │
                       ▼
                  O 分派 V 复审根因报告（targetKind=rootcause）
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
       V 复审不通过            V 复审通过
            │                     │
            ▼                     ▼
       O 重派 R（带 V 的        O 分派 G 门禁（check-rootcause-report.ts）
       rootcause reworkHints）       │
       → R 重定位 ──循环──    ┌──────┴──────┐
                              ▼             ▼
                          G 门禁不通过   G 门禁通过
                              │             │
                              ▼             ▼
                          O 重派 R     O 分派 S 兼 F 修复
                                      （输入：R 报告 + fixRecommendation）
                                           │
                                           ▼
                                      S 修复产物 + 更新 RTM
                                           │
                                           ▼
                                      O 分派 V 评审修复产物
                                           │
                                           ▼
                                      O 分派 G 门禁
                                           │
                                 ┌─────────┴─────────┐
                                 ▼                   ▼
                            G 通过               G 不通过
                                 │                   ▼
                                 ▼            新一轮 R 定位
                            阶段门放行           （round++）
```

### R 介入说明

V/G 不通过（exitCode≠0 或 qualityLevel∈{C,D}）时，编排者必须分派 R 子代理定位根因，禁止直接分派 S 返工（命中反模式 #18）。R 产出后须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix 修复。详见 [root-cause-locator.md](root-cause-locator.md)。

## 质量门（编码及之后阶段强制）

> 🔴 **CHECKPOINT · 质量门放行**：流程图中「质量门」节点是发布前最后暂停点。Agent 必须执行 `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]` 获取确定性判定（退出码 0=通过 / 1=未通过 / 2=输入错误），向用户展示「RTM 覆盖率 / 四级测试结果 / GATE_JSON 摘要」由用户确认发布或返工。**退出码 1/2 一律回编码，不得放行**（见 [anti-patterns.md](anti-patterns.md) #7）。

执行顺序：代码提交 → 自动化代码审查 → 单元测试 → 集成测试 → 系统测试 → 质量门检查 → 发布。
任一环节不通过回到编码实现。

```
代码提交 → 自动化代码审查 ──通过──► 单元测试 ──通过──► 集成测试
                │不通过                 │不通过              │
                ▼                        ▼                   ▼
              回到编码                回到编码           系统测试 ──通过──► 质量门 ──通过──► 发布
                                                                     │不通过         │不通过
                                                                     ▼               ▼
                                                                  回到编码       回到编码
```

质量门由 [`check-artifact-gate.ts`](../scripts/check-artifact-gate.ts) 守护：
退出码 0 = 通过（RTM 需求覆盖率 100% + 四级测试全部通过）；退出码 1/2 = 未通过 / 输入错误，一律回到编码实现。

质量标准详见 [`quality-standards.md`](quality-standards.md)。

## 工作流常见反模式

> 与 [anti-patterns.md](anti-patterns.md) 互引：以下是工作流执行中的高发陷阱，命中即回退到对应阶段起点。

| # | 反模式 | 对应 anti-patterns | 正确做法 |
|---|---|---|---|
| 1 | 跳过阶段门评审直接进下一阶段 | #1 | 每个评审节点必须暂停，禁止越过 🔴 CHECKPOINT 自动推进 |
| 2 | 将测试设计后置到编码之后 | #2 | 进入开发阶段时同步产出对应测试设计（见并行对应表） |
| 3 | 用 LLM 估算质量门结果 | #3 / #6 | 必须执行 `check-artifact-gate.ts` 获取退出码 |
| 4 | 评审未通过时悄悄小修后继续 | #4 | 评审不通过必须回到阶段起点返工，按 reworkHints 修复 |
| 5 | 一次性载入全部 references/ | #5 | 仅加载当前阶段对应的 `phase-N-*.md` |
| 6 | 越过 🔴 CHECKPOINT 自动推进 | #8 | CHECKPOINT 标记的暂停点必须等用户确认 |
| 7 | 谎报阶段状态（未完成标为完成） | #9 | 状态字段必须如实反映实际进度 |
| 8 | 编排者越权实施（直接产出 / 评审 / 替代 G 回填） | #10 | 编排者只分派 S / V / G；自身只做路由 + 状态 + CHECKPOINT + 只读脚本（见 [subagent-delegation.md](subagent-delegation.md)） |
| 9 | ingestion 跳过图谱校验直接进 S 产出 | #11（新增） | 阶段 1-4 必须跑 `check-requirement-graph.ts`，不得跳过 A→G 收敛循环 |
| 10 | A 子代理自评收敛（用 LLM 输出判定收敛） | #12（新增） | 收敛判定由 G 跑脚本退出码决定，A 的 reworkHints 仅作指引 |
