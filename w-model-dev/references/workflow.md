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

每个开发阶段产出后必须经过 LLM-as-a-Verifier 评审：

- 评审通过（`passed=true`，质量等级 A/B） → 进入下一阶段，更新项目状态。
- 评审不通过（`passed=false`，质量等级 C/D） → 回到本阶段起点返工，按 `reworkHints` 修复。
- 评审流程详见 [`verifier-spec.md`](verifier-spec.md) 与 SKILL.md §2「阶段门评审」。

## 质量门（编码及之后阶段强制）

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
