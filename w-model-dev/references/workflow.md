# 完整工作流程（W-Model Workflow）

> 本文件由 [`w-model-dev/SKILL.md`](../SKILL.md)「完整工作流程」节拆出，
> 供 Agent 在初始化项目、阶段切换、向用户解释整体流程时按需加载。
> SKILL.md 中保留简短摘要 + 指针。

## 总体流程图

```
需求分析 ──(同步验收测试设计)──► 评审 ──通过──► 系统设计
                                              │不通过► 回到需求分析
系统设计 ──(同步系统测试设计)──► 评审 ──通过──► 概要设计
                                              │不通过► 回到系统设计
概要设计 ──(同步集成测试设计)──► 评审 ──通过──► 详细设计
                                              │不通过► 回到概要设计
详细设计 ──(同步单元测试设计)──► 评审 ──通过──► 编码实现
                                              │不通过► 回到详细设计
编码实现 ──(执行单元测试)──────► 代码审查 ──通过──► 集成测试
                                              │不通过► 回到编码实现
集成测试 ──(接口验证)──────────► 通过──► 系统测试
                              │不通过► 回到编码实现
系统测试 ──(性能/安全测试)─────► 缺陷修复 ──完成──► 验收测试
                              │需修复► 回到编码实现
验收测试 ──(用户确认)──────────► 通过──► 项目完成
                              │不通过► 回到需求分析
```

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

## 阶段门评审（每个阶段统一）

> 🔴 **CHECKPOINT · 每个阶段门**：流程图中每个「评审」节点都是暂停点。Agent 必须按 [verifier-spec.md](verifier-spec.md) §8 提示词执行 LLM-as-a-Verifier 评审，调用 `npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>` 防漂移，向用户展示「质量等级 / 各子标准分 / reworkHints」由用户确认放行或返工。**禁止越过评审节点自动推进**（见 [anti-patterns.md](anti-patterns.md) #1/#8）。

每个开发阶段产出后必须经过 LLM-as-a-Verifier 评审：

- 评审通过（`passed=true`，质量等级 A/B） → 进入下一阶段，更新项目状态。
- 评审不通过（`passed=false`，质量等级 C/D） → 回到本阶段起点返工，按 `reworkHints` 修复。
- 评审流程详见 [`verifier-spec.md`](verifier-spec.md) 与 SKILL.md §2「阶段门评审」。

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
