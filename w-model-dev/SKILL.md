---
name: w-model-dev
description: >-
  Drive the full W-model software development lifecycle with parallel development
  and test design. Use when the user wants to run requirements analysis, system/outline/detailed
  design, coding with unit tests, integration testing, system testing, or acceptance
  testing as a closed-loop W-model workflow; when the user invokes /wm commands
  (analyze, design, code, test, review, status); or when building software that
  needs synchronized test design alongside each development stage with requirements
  traceability.
---

# W-Model AI Assistant Skill

## 描述

本技能基于 AI 辅助编码技术，实现软件工程中 **W 开发模型**的全流程闭环管理。W 模型由 Evolutif 公司提出，由两个同步推进的"V"字结构组成：左 V 为开发侧（需求分析 → 系统设计 → 概要设计 → 详细设计 → 编码），右 V 为测试侧（验收测试设计 → 系统测试设计 → 集成测试设计 → 单元测试设计 → 测试执行）。

**核心原则**：开发与测试并行推进——每一个开发阶段都同步产出对应的测试设计，使测试前置、缺陷早发现，并通过需求跟踪矩阵（RTM）保证全链路可追溯。

## 使用场景

触发本技能的条件：

- 用户明确提及 W 模型、W 开发模型，或希望按"开发与测试并行"的方式推进项目
- 用户使用 `/wm` 系列命令（analyze / design / code / test / review / status / help / reset / export / import）
- 用户要从需求出发，逐步完成设计、编码、各级测试的完整软件交付
- 用户需要对已有项目补齐测试设计、做需求追溯或质量门检查
- 用户要求在文档/代码/测试之间建立可追踪的对应关系

## 核心约束

1. **并行原则不可破坏**：进入任一开发阶段时，必须同步启动对应测试类型的设计（见下表），不得将测试设计后置。
2. **阶段门评审（Stage Gate）**：每个阶段产出必须通过评审后才能进入下一阶段；评审不通过则回到当前阶段起点返工。
3. **RTM 同步维护**：每次需求或设计变更，必须同步更新需求跟踪矩阵；定期核验需求覆盖率应为 100%。
4. **质量门**：代码覆盖率 ≥ 80%；代码规范检查通过；安全检测无高危漏洞；各级测试全部通过方可放行。
5. **以 SSoT 为准**：本技能以 `skill-design-document_SSoT.md` 为单一事实来源，所有决策、用例、验收标准以其为准。
6. **最小必要信息**：本文件仅保留编排逻辑，各阶段细则按需从 `references/` 加载，模板从 `templates/` 取用。

## 阶段与测试并行对应表

| # | 开发阶段（左 V） | 同步测试设计（右 V） | 对应执行测试 | 详细指引 |
|---|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | 验收测试执行 | [phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | 系统测试执行 | [phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | 集成测试执行 | [phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | 单元测试执行 | [phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | — | [phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | — | 集成测试执行 | [phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | — | 系统测试执行 | [phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | — | 验收测试执行 | [phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |

## 完整工作流程

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

## 命令接口

### 核心命令

| 命令 | 功能 | 参数 | 产出 |
|---|---|---|---|
| `/wm analyze` | 需求分析 | `input`: 需求描述 | 需求规格说明书、验收测试用例 |
| `/wm design` | 系统设计 | `type`: 架构 / 概要 / 详细 | 设计文档、对应测试用例 |
| `/wm code` | 代码生成 | `feature`: 功能描述 | 代码文件、单元测试 |
| `/wm test` | 测试执行 | `type`: 单元 / 集成 / 系统 / 验收 | 测试报告 |
| `/wm review` | 代码审查 | `path`: 文件路径 | 审查报告、优化建议 |
| `/wm status` | 项目状态 | 无 | 当前阶段、完成进度 |

### 辅助命令

| 命令 | 功能 |
|---|---|
| `/wm help` | 显示帮助信息 |
| `/wm reset` | 重置当前项目状态 |
| `/wm export` | 导出项目文档 |
| `/wm import` | 导入现有项目 |

## 指令（执行规则）

### 0. 任务接入

1. 识别用户意图对应的 W 模型阶段（对照"阶段与测试并行对应表"）。
2. 若项目尚未初始化，先确认技术栈（前端 / 后端 / 数据库 / 其他）并建立项目状态记录。
3. 仅加载当前阶段所需的 `references/` 文件，避免一次性载入全部细则。

### 1. 执行阶段任务（每个阶段统一遵循）

1. **读取阶段指引**：用 Read 工具加载对应 `references/phase-N-*.md`，严格按其输入 / 输出 / AI 能力 / 测试用例设计 / 验收标准执行。
2. **并行产出测试设计**：在本阶段开发产物产出后，立即同步产出对应测试类型的设计文档（不得推迟）。
3. **套用模板**：从 `templates/` 取对应模板填充产出物，保证格式规范一致。
4. **更新 RTM**：在 `templates/rtm.md`（或项目内 RTM 文件）登记本阶段产物与需求 / 设计的映射，确保覆盖状态可追踪。RTM 维护规则见 [references/rtm-guide.md](references/rtm-guide.md)。
5. **自检验收标准**：对照阶段指引中的"验收标准"逐条核验，未达标不得提交评审。

### 2. 阶段门评审

1. 汇总本阶段产出与自检结果，向用户呈现评审材料。
2. 评审通过 → 进入下一阶段，更新项目状态。
3. 评审不通过 → 回到本阶段起点返工，记录返工原因。

### 3. 质量门（编码及之后阶段强制）

执行顺序：代码提交 → 自动化代码审查 → 单元测试 → 集成测试 → 系统测试 → 质量门检查 → 发布。任一环节不通过回到编码实现。质量标准见 [references/quality-standards.md](references/quality-standards.md)。

```
代码提交 → 自动化代码审查 ──通过──► 单元测试 ──通过──► 集成测试
                │不通过                 │不通过              │
                ▼                        ▼                   ▼
              回到编码                回到编码           系统测试 ──通过──► 质量门 ──通过──► 发布
                                                                     │不通过         │不通过
                                                                     ▼               ▼
                                                                  回到编码       回到编码
```

### 4. 数据与状态管理

- 项目数据模型、需求 / 设计 / 测试用例数据结构见 [references/data-models.md](references/data-models.md)。
- 项目状态字段取值：`需求分析 | 系统设计 | 概要设计 | 详细设计 | 编码 | 集成测试 | 系统测试 | 验收测试`。
- 每次阶段切换更新 `status` 与 `updatedAt`。

## 交互模式示例

完整交互示例见 `examples/`：

- 需求分析交互：[examples/requirement-analysis.md](examples/requirement-analysis.md)
- 设计阶段交互：[examples/system-design.md](examples/system-design.md)
- 编码阶段交互：[examples/coding.md](examples/coding.md)

## 通用输出规范

1. 阶段开始时简要说明"正在执行 X 阶段"，并列出将同步产出的测试设计类型。
2. 产出文档使用 Markdown，文件命名遵循 `<类型>-<模块>-<时间或序号>.md`。
3. 测试用例必须含：用例 ID、测试场景、输入、预期输出、优先级。
4. 涉及缺陷或风险时给出等级与缓解措施。
5. 每个阶段结束输出"阶段完成摘要"：产出清单、RTM 覆盖状态、下一步建议。

## 验收检查清单（项目级）

- [ ] 需求规格说明书完整
- [ ] 设计文档完整且符合规范
- [ ] 代码实现完成且通过编译
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 系统测试全部通过
- [ ] 安全测试无高危漏洞
- [ ] 性能测试达标
- [ ] 验收测试通过
- [ ] 用户确认签字
- [ ] 交付文档齐全
- [ ] RTM 覆盖率 100%

## 文件清单

```
w-model-dev/
├── SKILL.md                       # 本文件：编排与命令
├── references/                    # 阶段细则（按需加载）
│   ├── phase-1-requirements.md
│   ├── phase-2-system-design.md
│   ├── phase-3-outline-design.md
│   ├── phase-4-detailed-design.md
│   ├── phase-5-coding.md
│   ├── phase-6-integration-test.md
│   ├── phase-7-system-test.md
│   ├── phase-8-acceptance-test.md
│   ├── data-models.md
│   ├── rtm-guide.md
│   └── quality-standards.md
├── templates/                     # 文档模板
│   ├── requirement-spec.md
│   ├── system-design.md
│   ├── detailed-design.md
│   ├── interface-design.md
│   ├── test-case.md
│   ├── test-report.md
│   ├── review-report.md
│   └── rtm.md
└── examples/                      # 交互示例
    ├── requirement-analysis.md
    ├── system-design.md
    └── coding.md
```

## 实现位置

本 SKILL.md 描述的 `/wm` 命令、状态管理与 RTM 维护已由 TypeScript 实现，开箱即用：

| SKILL.md 章节 | 实现文件 | 说明 |
|---|---|---|
| 命令接口（`/wm analyze` 等） | [`src/commands/router.ts`](../src/commands/router.ts) | 10 个命令的路由与处理 |
| 数据与状态管理 | [`src/state/project-state.ts`](../src/state/project-state.ts) | JSON 持久化，跨多轮交互保持上下文 |
| RTM 同步维护 | [`src/state/rtm-manager.ts`](../src/state/rtm-manager.ts) | 自动重建、覆盖率统计、质量门检查 |
| 阶段门评审（LLM-as-a-Verifier） | [`src/core/w-model-enhancer.ts`](../src/core/w-model-enhancer.ts) | 需求 / 设计 / 测试用例三阶段连续评分 |
| LLM Verifier 引擎 | [`src/core/scoring-engine.ts`](../src/core/scoring-engine.ts) | logits 期望值 + fallback 机制 |
| 三维度验证框架 | [`src/core/verification-framework.ts`](../src/core/verification-framework.ts) | 评分粒度 + 重复评估 + 标准分解 |
| PPT 优先级排序 | [`src/core/ppt-ranker.ts`](../src/core/ppt-ranker.ts) | O(N×k) 概率枢轴锦标赛 |
| 公共 API 入口 | [`src/index.ts`](../src/index.ts) | 导出 + `createCommandContext` 工厂 |

### 快速验证

```bash
# 运行 W 模型 8 阶段全流程示例（使用 Mock LLM，无需 API key）
npm run example:run

# 运行测试套件（119 个测试，覆盖率达标）
npm test
```

### 编程式接入

```typescript
import { createCommandContext, dispatch } from 'w-model-dev-skill';

const ctx = await createCommandContext('./my-project', {
  llm: { model: 'mock' },
  fallbackStrategy: 'text-parse',
});

await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
// ... 完整 8 阶段流程
```

详见 [README.md](../README.md) 与 [IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md)。
