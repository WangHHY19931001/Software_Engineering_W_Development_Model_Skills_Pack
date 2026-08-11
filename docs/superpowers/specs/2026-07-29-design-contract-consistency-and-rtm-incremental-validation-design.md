# 设计契约一致性校验与 RTM 增量校验修正

> 创建日期：2026-07-29
> 关联问题：第 21 轮 8 阶段端到端调测发现的三类系统性缺陷
> 方案选择：方案 C（混合：脚本+文档），SSoT 先行

## 1. 问题陈述

### 1.1 背景

第 21 轮对 w-model-dev-demo 执行完整 8 阶段调测，在阶段 8（验收测试）发现 **11 个验收测试用例失败**，经修复后全部通过。但分析失败根因时发现三类系统性问题，指向同一根因：**阶段间追溯链断裂**。

### 1.2 三类问题

#### A 类：测试设计文档与实际实现脱节（6 处）

| 用例 | 设计文档预期 | 实际实现 | 根因 |
|---|---|---|---|
| TC-UAT-006 | 分页参数 `limit` | `pageSize` | 编码偏离设计 |
| TC-UAT-013 | 状态码 204 | 200 | 编码偏离设计 |
| TC-UAT-014 | 响应字段 `author` | `authorId` | 编码偏离设计 |
| TC-UAT-015 | 创建响应含 `tags` | 无（需查详情） | 编码偏离设计 |
| TC-UAT-017 | 搜索路径 `/api/posts/search` | `/api/search` | 编码偏离设计 |
| TC-UAT-020 | 关注返回 200 | 201 | 编码偏离设计 |

**根因**：阶段 5 编码时未对照阶段 1 的验收测试设计，`docs/uat-path-mapping.md` 形同虚设。

#### B 类：验收测试用例设计不完整（5 处）

| 用例 | 问题 | 根因 |
|---|---|---|
| TC-UAT-005 | 用公开接口 `GET /api/posts` 测试 token 失效 | 前置条件分析缺失 |
| TC-UAT-022 | 测试管理员权限但未预创建管理员用户 | 前置条件分析缺失 |
| TC-UAT-023 | 同上 | 同上 |
| TC-UAT-024 | 同上 | 同上 |
| TC-UAT-026 | 同上 | 同上 |

**根因**：阶段 1 验收测试设计缺少前置条件分析（认证状态、角色准备、数据依赖）。

#### C 类：RTM 维护滞后（35 处）

35 个 INTF/SD 节点的 `acceptanceTest` 字段为 `null`，直到阶段 8 工件质量门检查时才发现并补救。

**根因**：`gate-logic.ts` 的 `PHASE_TRACE_FIELDS` 中 phase 1 不含 `acceptanceTest` 字段，导致阶段 1 门禁不校验该字段，Agent 跳过登记。

### 1.3 影响范围

- 阶段 8 验收测试反复返工（11 个用例失败 → 修复 → 重跑）
- RTM 追溯链断裂（35 个节点缺失 acceptanceTest 映射）
- 违反 W 模型核心约束「RTM 为事实源」（不可违反约束 #3）
- 违反反模式 #6（估算 RTM 覆盖率）和 #2（测试设计后置）

## 2. 设计方案

### 2.1 架构总览

采用三层结构，遵循现有技能包的 SSoT→Reference→Script 架构：

```
SSoT 层（skill-design-document_SSoT.md）
  ├─ 新增 §10I：设计契约一致性校验（Design Contract Consistency）
  └─ 新增 §10J：RTM 增量校验修正（Incremental RTM Validation Fix）
       │
       ▼
Reference 层（references/*.md）
  ├─ phase-1-requirements.md：增加验收测试前置条件分析要求
  ├─ phase-5-coding.md：增加验收设计反向对照清单 + uat-path-mapping 回填强制
  ├─ phase-8-acceptance-test.md：增加前置条件校验清单
  └─ rtm-guide.md：增加阶段级增量校验规则
       │
       ▼
Script 层（scripts/*.ts）
  ├─ 新增 check-design-contract-consistency.ts：自动校验编码与验收设计一致性
  ├─ 修复 gate-logic.ts：PHASE_TRACE_FIELDS phase 1 增加 acceptanceTest
  ├─ 新增 schemas/design-contract.schema.json
  ├─ 新增 samples/design-contract/：通过/失败样本各 2 条
  └─ 增强 self-test.ts：增加设计契约一致性校验的回归用例
```

### 2.2 核心设计原则

- **早发现早修复**：不等到阶段 8 终检才发现问题，在阶段 5 编码后就校验
- **SSoT 权威源**：SSoT 定义规则 → Reference 层落实执行方法论 → Script 层提供确定性判定
- **防御纵深**：脚本自动拦截 + 文档人工指引，双保险
- **向后兼容**：不破坏现有 `--phase=8` 终检行为；NFR/CON 行允许豁免

## 3. Script 层详细设计

### 3.1 修复 `gate-logic.ts` PHASE_TRACE_FIELDS（修复 C 类）

**现状（问题所在）**：

```typescript
const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRowShape)[]> = {
  1: ['description', 'designDoc'],           // ← 缺少 acceptanceTest！
  // ...
};
```

**修正后**：

```typescript
const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRowShape)[]> = {
  1: ['description', 'designDoc', 'acceptanceTest'],  // REQ 行须登记验收测试
  // ...
};
```

**校验规则**：
- REQ 行的 `acceptanceTest` 在 phase 1 须非空
- NFR/CON 行允许为 null（横切治理类豁免，用 rowId 前缀区分：`REQ-` 强制校验，`NFR-`/`CON-` 允许 null）
- phase 2-4 不重复校验 acceptanceTest（phase 1 已校验）

### 3.2 新增 `check-design-contract-consistency.ts`（修复 A 类）

**用法**：
```bash
npx tsx w-model-dev/scripts/cli/check-design-contract-consistency.ts [project-dir]
```

**输入**：
- `docs/uat-path-mapping.md`（设计路径 ↔ 实际路径映射，Markdown 表格）
- `src/routes/*.ts`（实际路由定义，通过正则提取）
- `tests/acceptance/*.test.ts`（验收测试用例，通过正则提取断言）

**校验维度**：

| 维度 | 校验内容 | 检测信号 |
|---|---|---|
| D1 路径一致性 | 映射表中「实际路径」须在路由定义中存在 | 路径不存在 |
| D2 参数一致性 | 验收测试使用的分页/筛选参数名须与路由定义一致 | 参数名不匹配 |
| D3 状态码一致性 | 验收测试预期状态码须与路由实际返回一致 | 状态码不匹配 |
| D4 响应字段一致性 | 验收测试断言字段须在实际响应体中存在 | 字段不存在 |

**退出码**：0=一致 / 1=发现不一致 / 2=输入错误

**输出**：stdout 打印结构化校验报告 + 末尾 JSON 摘要（CONTRACT_JSON）

**NFR/CON 行例外**：横切治理类需求不强制 D1~D4 校验（允许路径为「横切」）。

### 3.3 新增 `schemas/design-contract.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["passed", "reasons", "violations"],
  "properties": {
    "passed": { "type": "boolean" },
    "reasons": { "type": "array", "items": { "type": "string" } },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["dimension", "severity", "message"],
        "properties": {
          "dimension": { "enum": ["D1", "D2", "D3", "D4"] },
          "severity": { "enum": ["error", "warning"] },
          "message": { "type": "string" },
          "expected": { "type": "string" },
          "actual": { "type": "string" }
        }
      }
    }
  }
}
```

### 3.4 新增样本

```
samples/design-contract/
  ├─ valid-consistent.json    （路径/参数/状态码/字段全部一致）
  ├─ bad-path-mismatch.json   （映射表路径与路由定义不一致）
  ├─ bad-param-mismatch.json  （参数名不一致，如 limit vs pageSize）
  └─ bad-status-mismatch.json （状态码不一致，如 200 vs 204）
```

### 3.5 增强 `self-test.ts`

增加 4 条回归用例：
- `valid-consistent.json` → expectedPassed=true
- `bad-path-mismatch.json` → expectedPassed=false, reason 匹配 D1
- `bad-param-mismatch.json` → expectedPassed=false, reason 匹配 D2
- `bad-status-mismatch.json` → expectedPassed=false, reason 匹配 D3

## 4. Reference 层详细设计

### 4.1 `phase-1-requirements.md` 增加验收测试前置条件分析要求

在「并行任务（强制）」节后新增「验收测试前置条件分析（强制）」节：

每条验收测试用例须包含以下前置条件分析：

| 前置条件类型 | 要求 | 示例 |
|---|---|---|
| 认证状态 | 明确标注是否需认证 + 角色 | 需 admin token / 需普通用户 token / 无需认证 |
| 数据依赖 | 明确标注依赖的测试数据 | 需预创建文章/用户/标签 |
| 接口路径 | 明确标注 API 路径 + HTTP 方法 | POST /api/posts |

新增禁止行为：
- #12：用公开接口测试认证失效（须选需要认证的接口）
- #13：验收用例未声明前置条件（每条用例须含前置条件分析节）

### 4.2 `phase-5-coding.md` 增加验收设计反向对照清单

在「RTM 登记」节后新增「验收设计反向对照（强制）」节：

编码完成后，S 子代理须对照阶段 1 的 `docs/uat-path-mapping.md` 逐条核对：
- 路径一致性：映射表中「实际路径」列已回填且与路由定义一致
- 参数一致性：分页/筛选参数名与验收测试设计一致
- 状态码一致性：成功/错误状态码与验收测试设计一致
- 响应字段一致性：响应体字段名与验收测试设计一致

G 子代理跑 `check-design-contract-consistency.ts` 校验，exitCode=0 才放行。

### 4.3 `phase-8-acceptance-test.md` 增加前置条件校验清单

在「测试用例设计（执行）」节后新增「验收测试前置条件校验清单」节：

执行验收测试前，须逐条校验用例的前置条件：
- 认证状态：需认证的用例已准备有效 token
- 角色权限：管理员场景已预创建管理员用户
- 数据依赖：依赖的测试数据已准备
- 接口选择：测试 token 失效用例须选需认证接口（非公开接口）

### 4.4 `rtm-guide.md` 增加阶段级增量校验规则

在「各阶段登记职责」表后新增「阶段级增量校验（强制）」节：

`check-artifact-gate.ts --phase=N` 在每阶段门执行，校验当前阶段应完成的 RTM 字段：
- Phase 1: REQ 行 acceptanceTest 须非空（NFR/CON 行允许 null）
- Phase 5: codeModule 须非空 + 跑 check-design-contract-consistency.ts
- Phase 8: 全字段终检 + check-design-contract-consistency.ts 终检

## 5. SSoT 层详细设计

### 5.1 新增 §10I：设计契约一致性校验

位置：§10H 之后、§10.10 之前。

**强制校验维度**（D1~D4，任一失败 → exitCode=1，O 不得放行）：

- D1 路径一致性：uat-path-mapping.md 中「实际路径」须在路由定义中存在
- D2 参数一致性：验收测试使用的分页/筛选参数名须与路由定义一致
- D3 状态码一致性：验收测试预期状态码须与路由实际返回一致
- D4 响应字段一致性：验收测试断言字段须在实际响应体中存在

**校验时机**：
- 阶段 5 编码完成后（G 子代理执行，exitCode=0 才放行进阶段 6）
- 阶段 8 终检时（与 check-artifact-gate.ts 并行执行）

**NFR/CON 行例外**：横切治理类需求不强制 D1~D4 校验。

### 5.2 新增 §10J：RTM 增量校验修正

位置：§10I 之后。

**修正内容**：
- phase 1 PHASE_TRACE_FIELDS 增加 acceptanceTest（REQ 行强制非空）
- NFR/CON 行允许 acceptanceTest 为 null（横切治理类豁免）
- 判定规则：rowId 前缀 `REQ-` 强制校验；`NFR-`/`CON-` 允许 null

## 6. 反模式关联

本次修正关联以下反模式：

| 反模式 | 关联 | 修正方式 |
|---|---|---|
| #2（测试设计后置） | A 类问题 | phase-5 增加反向对照清单 + 脚本强制 |
| #6（估算 RTM 覆盖率） | C 类问题 | phase 1 acceptanceTest 增量校验 |
| #22（角色越权） | B 类问题 | phase-1 增加前置条件分析 |
| #24（副作用时序不一致） | A 类问题 | D4 响应字段一致性校验 |

不新增反模式（现有反模式已覆盖），仅强化执行机制。

## 7. 向后兼容性

- `check-artifact-gate.ts --phase=8` 终检行为不变（向后兼容）
- NFR/CON 行的 acceptanceTest 允许为 null（保持现有行为）
- `uat-path-mapping.md` 格式不变（仅增加回填强制要求）
- 现有 self-test 用例不受影响（仅新增用例）

## 8. 验证计划

### 8.1 自测验证

- `npx tsx w-model-dev/scripts/cli/self-test.ts` 全部通过（含 4 条新用例）
- 新增样本 4 条，通过/失败各 2 条

### 8.2 TypeScript 严格模式

- `npx tsc --noEmit` 0 errors

### 8.3 Vitest 回归

- `npx vitest run` 全部通过（含新增测试）

### 8.4 端到端验证

- 在 w-model-dev-demo 上重跑阶段 5 + 阶段 8，验证：
  - 阶段 1 acceptanceTest 为空的 REQ 行被 phase 1 门禁拦截
  - 阶段 5 编码后 check-design-contract-consistency.ts 检测出 6 处不一致
  - 修复后 exitCode=0
