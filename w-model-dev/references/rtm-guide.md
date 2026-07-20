# 需求跟踪矩阵（RTM）指南

> 来源：SSoT 第 9 章。RTM 是 W 模型全链路可追溯的核心机制。

## RTM 结构

| 需求 ID | 需求描述 | 设计文档 | 代码模块 | 单元测试 | 集成测试 | 系统测试 | 验收测试 | 覆盖状态 |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | 用户注册功能 | SD-3.2.1 | userController.ts | UT-001 | IT-001 | ST-001 | UAT-001 | 100% |
| REQ-002 | 用户登录功能 | SD-3.2.2 | authService.ts | UT-002 | IT-002 | ST-002 | UAT-002 | 100% |
| REQ-003 | 商品浏览功能 | SD-3.3.1 | productController.ts | UT-003 | IT-003 | ST-003 | UAT-003 | 100% |
| REQ-004 | 购物车功能 | SD-3.3.2 | cartService.ts | UT-004 | IT-004 | ST-004 | UAT-004 | 100% |
| REQ-005 | 订单管理功能 | SD-3.4.1 | orderController.ts | UT-005 | IT-005 | ST-005 | UAT-005 | 100% |

> 实际填写时使用 [templates/rtm.md](../templates/rtm.md) 模板。

## 跟踪方向（双向可追溯）

```
业务需求 → 系统需求 → 设计文档 → 代码实现 → 测试用例 → 测试执行 → 缺陷
   ↑─────────────────────────────────────────────────────┘
                       反向追溯
```

正向：需求一路向下追溯到测试执行与缺陷。
反向：任一缺陷可回溯到对应的测试、代码、设计、需求。

## 维护规则

1. **变更同步**：每次需求或设计变更必须同步更新 RTM。
2. **覆盖检查**：定期检查需求覆盖率，确保 100% 覆盖。
3. **优先级标记**：根据需求优先级确定测试优先级。
4. **状态追踪**：实时更新测试执行状态（待执行 / 通过 / 失败）。
5. **缺陷关联**：将缺陷与对应的需求和测试用例关联。

## 各阶段登记职责

| 阶段 | 登记 / 更新的 RTM 列 |
|---|---|
| 1 需求分析 | 需求 ID、需求描述、验收测试 |
| 2 系统设计 | 设计文档（系统）、系统测试 |
| 3 概要设计 | 设计文档（接口）、集成测试 |
| 4 详细设计 | 设计文档（详细）、单元测试 |
| 5 编码 | 代码模块 |
| 6 集成测试 | 集成测试状态 |
| 7 系统测试 | 系统测试状态 |
| 8 验收测试 | 验收测试状态、RTM 需求覆盖率终检 |

## 测试用例 ID 命名规则

RTM 与各阶段文档使用两套 ID，按用途区分，不可混用：

| ID 格式 | 用途 | 出现位置 | 示例 |
|---|---|---|---|
| `<Type>-NNN`，Type ∈ {`UT`, `IT`, `ST`, `UAT`} | **运行时测试用例 ID**，登记到 RTM 的四级测试列 | RTM、`templates/rtm.md`、`templates/{system,interface,detailed,requirement}-design.md`、`examples/`、阶段 5/6/7/8 文档的「测试用例设计（执行）」表 | `UT-001`（单元测试）、`IT-001`（集成测试）、`ST-001`（系统测试）、`UAT-001`（验收测试） |
| `TC-<PHASE>-NNN`，PHASE ∈ {`REQ`, `DES`, `COD`} | **阶段产物验证用例 ID**，校验该阶段产物本身是否合格（如「类图生成」「需求完整性检查」），不登记到 RTM | 阶段 1/2/3/4/5 文档的「测试用例设计」表、SSoT §3.2.1-3.2.3 | `TC-REQ-001`（需求解析）、`TC-DES-002`（类图生成）、`TC-COD-004`（单元测试代码覆盖率检查） |

要点：

- **运行时测试用例**（四级测试）一律采用短形式 `UT/IT/ST/UAT-NNN`，登记到 RTM 对应列；同一类型在项目内连续编号（如 `UT-001 ~ UT-018`）。
- **阶段产物验证用例**采用 `TC-<PHASE>-NNN`，仅出现在阶段文档与 SSoT 中作为示例，用于校验阶段产出物（需求规格、设计文档、代码、覆盖率报告）是否合格，不进入 RTM。
- **历史兼容**：早期版本阶段 6/7/8 文档曾使用 `TC-INT-*` / `TC-SYS-*` / `TC-UAT-*` 表示执行用例，已统一改为 `IT-*` / `ST-*` / `UAT-*`，与 RTM 短形式一致。

## RTM 登记命令与覆盖率算法（指令具体性）

> 每阶段 RTM 字段更新的具体命令清单 + 覆盖率计算公式 + 缺失项检测算法。Agent 须按此执行，禁止凭印象登记。

### 1. 各阶段 RTM 字段更新清单

| 阶段 | 更新的 RTM 字段 | 登记命令（伪代码） | 校验 |
|---|---|---|---|
| 1 需求分析 | 需求 ID、需求描述、验收测试列 | `rtm.addRequirement({id:'REQ-NNN', desc, uatId:'UAT-NNN'})` | 字段非空 + ID 唯一 |
| 2 系统设计 | 设计文档列、系统测试列 | `rtm.updateDesign(reqId, {sd:'SD-N.N.N', stId:'ST-NNN'})` | `sd` 非空 + `stId` 关联 REQ |
| 3 概要设计 | 接口设计列、集成测试列 | `rtm.updateDesign(reqId, {interfaceDoc:'SD-N.N.N', itId:'IT-NNN'})` | 同上 |
| 4 详细设计 | 详细设计列、单元测试列 | `rtm.updateDesign(reqId, {detailedDoc:'SD-N.N.N', utId:'UT-NNN'})` | 同上 |
| 5 编码 | 代码模块列 | `rtm.updateCode(reqId, '<filename>.ts')` | 文件路径存在 |
| 6 集成测试 | 集成测试状态列 | `rtm.updateStatus(itId, '通过' \| '失败')` | 状态 ∈ 枚举 |
| 7 系统测试 | 系统测试状态列 | `rtm.updateStatus(stId, '通过' \| '失败')` | 同上 |
| 8 验收测试 | 验收测试状态列、覆盖率终检 | `rtm.updateStatus(uatId, '通过' \| '失败')` + 跑 `check-artifact-gate.ts` | 退出码 0 |

### 2. 覆盖率计算公式

**需求覆盖率 =（7 个追溯字段均非空的需求数 / 总需求数）× 100%**。每个 `REQ-NNN` 须具备 `description` / `designDoc` / `codeModule` / `unitTest` / `integrationTest` / `systemTest` / `acceptanceTest`；任一字段为空，该需求即未覆盖。`coverageStatus` 仅用于展示，门禁脚本会从原始字段重算，不信任手工填写的状态。

### 3. 缺失项检测算法

阶段 8 终检前必须执行（实际由 `check-artifact-gate.ts` 实现，此处仅作流程透明化）：遍历 `rtm.json` 的 `requirements[]`，对每个 REQ 检查 7 个必需字段（`desc` / `designDoc` / `codeModule` / `unitTest` / `integrationTest` / `systemTest` / `acceptanceTest`）是否非空；任一字段为空即记入 `missingItems`。`missingItems` 非空 → 退出码 1，Agent 须将缺失明细透传给用户并回阶段 5 补齐；为空 → 退出码 0 可发布。

> 缺失项明细由 `check-artifact-gate.ts` 输出到 stdout，Agent 须将其透传给用户。
