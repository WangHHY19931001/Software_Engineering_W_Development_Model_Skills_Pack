# 需求跟踪矩阵（RTM）指南

> 来源：SSoT 第 9 章。RTM 是 W 模型全链路可追溯的核心机制。

## RTM 结构

| 需求 ID | 需求描述     | 设计文档 | 代码模块             | 单元测试 | 集成测试 | 系统测试 | 验收测试 | 覆盖状态 |
| ------- | ------------ | -------- | -------------------- | -------- | -------- | -------- | -------- | -------- |
| REQ-001 | 用户注册功能 | SD-3.2.1 | userController.ts    | UT-001   | IT-001   | ST-001   | UAT-001  | 100%     |
| REQ-002 | 用户登录功能 | SD-3.2.2 | authService.ts       | UT-002   | IT-002   | ST-002   | UAT-002  | 100%     |
| REQ-003 | 商品浏览功能 | SD-3.3.1 | productController.ts | UT-003   | IT-003   | ST-003   | UAT-003  | 100%     |
| REQ-004 | 购物车功能   | SD-3.3.2 | cartService.ts       | UT-004   | IT-004   | ST-004   | UAT-004  | 100%     |
| REQ-005 | 订单管理功能 | SD-3.4.1 | orderController.ts   | UT-005   | IT-005   | ST-005   | UAT-005  | 100%     |

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

| 阶段       | 登记 / 更新的 RTM 列             |
| ---------- | -------------------------------- |
| 1 需求分析 | 需求 ID、需求描述、验收测试      |
| 2 系统设计 | 设计文档（系统）、系统测试       |
| 3 概要设计 | 设计文档（接口）、集成测试       |
| 4 详细设计 | 设计文档（详细）、单元测试       |
| 5 编码     | 代码模块                         |
| 6 集成测试 | 集成测试状态                     |
| 7 系统测试 | 系统测试状态                     |
| 8 验收测试 | 验收测试状态、RTM 需求覆盖率终检 |

### 阶段级增量校验（强制）

> 每阶段门的 RTM 字段增量校验，防止 acceptanceTest 等字段留空至阶段 8 终检才暴露。

`check-artifact-gate.ts --phase=N` 在每阶段门执行，校验当前阶段应完成的 RTM 字段：

| Phase | 校验的 RTM 字段                            | 新增校验项                                  |
| ----- | ------------------------------------------ | ------------------------------------------- |
| 1     | description, designDoc, **acceptanceTest** | REQ 行 acceptanceTest 须非空                |
| 2     | description, designDoc, **acceptanceTest** | SD 行 acceptanceTest 须非空                 |
| 3     | description, designDoc, **acceptanceTest** | INTF 行 acceptanceTest 须非空               |
| 4     | description, designDoc, **acceptanceTest** | DD 行 acceptanceTest 须非空                 |
| 5     | + codeModule, unitTest, **acceptanceTest** | 跑 check-design-contract-consistency.ts     |
| 8     | 全字段终检                                 | + check-design-contract-consistency.ts 终检 |

NFR/CON 行的 acceptanceTest 允许为 null（横切治理类豁免，由 `isCrossCutting` 逻辑覆盖）。

## 测试执行证据（M07）

> `rtm.json` 的 `executionSummary.<layer>.evidence` 承载「本层测试摘要来自哪次真实运行」。`check-artifact-gate.ts --phase=N`（阶段 5~8，与既有四级测试校验同一链路）校验；RTM 是这一证据的**唯一载体**。

**字段形态**（`rtm.schema.json` `definitions.testSummary.evidence`，schema 层整块**可选**，`evidence` 自身 `additionalProperties: false`）：

| 字段              | 必填 | 形态              | 说明                                                                              |
| ----------------- | ---- | ----------------- | --------------------------------------------------------------------------------- |
| `command`         | 是   | 非空字符串        | 产生该层摘要的真实命令；禁 `;` `&` `\|` `<` `>` 与换行                            |
| `exitCode`        | 是   | 非负整数          | 真实进程退出码，是「结果与真实运行绑定」的锚点                                    |
| `observedAt`      | 是   | UTC ISO-8601 毫秒 | 形如 `2026-09-15T10:00:00.000Z`                                                   |
| `rawOutputPath`   | 否   | 项目根相对路径    | 原始输出文件；须与 `rawOutputSha256` 成对出现，不得为绝对路径 / 盘符 / 越出项目根 |
| `rawOutputSha256` | 否   | 64 位小写十六进制 | 由门禁重新计算文件 SHA-256 比对；须与 `rawOutputPath` 成对出现                    |

**四条门禁规则**（`gate-logic.ts`，M07 / D-2）：

- **E1 配对**：`rawOutputPath` 与 `rawOutputSha256` 要么都无、要么都有；只出现其一 → 违规。
- **E2 哈希核验**（仅在二者齐备时）：以项目根解析 `rawOutputPath`（非法路径 / 越出根即拒），文件必须存在，其 SHA-256 必须等于 `rawOutputSha256`；不符或缺失 → 违规。**哈希是可选层，不登记输出文件即不触发 E2。**
- **E3 结果一致性**（只要该层填写了 `evidence` 即强制，与该层是否属于当前阶段、与 cutoff 无关）：`failed=0 && pending=0` ⇒ `exitCode=0`；`failed>0` ⇒ `exitCode≥1`（记录里有失败，就不可能来自一次绿色运行）；`failed=0 && pending>0` 不作约束（部分执行两种退出码都合理，如实不编码）。
- **E4 存在性**：`lastUpdated` 不早于 cutoff 时，**当前阶段须校验的层**（阶段 5 = `unitTest`；6 = +`integrationTest`；7 = +`systemTest`；8 = +`acceptanceTest`）只要 `total>0` 就必须携带 `evidence`；缺失 → 违规（携带的 evidence 再由 E1~E3 校验合法性）。

**cutoff 吸收**：cutoff = `2026-09-15T00:00:00Z`（M07/D-2 批准日零点 UTC）。

- `lastUpdated` **早于** cutoff 的旧 RTM，在其阶段范围内 `total>0` 的层缺 `evidence` → 输出 `LEGACY_TEST_EVIDENCE` **非阻断诊断**（不改变退出码）。
- `lastUpdated` **缺失或不可解析** → 按 cutoff 后处理（**保守不吸收**），即仍须携带 `evidence`，否则退出码 1。
- `GATE_JSON.testEvidence` 给出 `{checked, withEvidence, e4}`（另有非阻断 `legacy` 数组，仅非空时出现）。

**与 run-log `revertEvidence` 的边界（不同载体、不得互相替代）**：两者都叫「证据」，但绑定对象与门禁挂点不同——

| 维度     | RTM `testSummary.evidence`（M07）                                 | run-log `revertEvidence`（P2-B / R10）                             |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| 载体     | `.w-model/rtm.json`                                               | `.w-model/run-log.jsonl`                                           |
| 绑定对象 | **阶段级测试运行**（某层 `passed/failed/pending` 摘要的产出依据） | **S-fix 的复现测试**（执行命令使复现测试回到失败态，证伪修复声明） |
| 校验     | `check-artifact-gate.ts` E1~E4                                    | `check-run-log.ts` R10                                             |
| 可否替代 | 不得用 run-log 声明充当阶段测试证据                               | 不得用 RTM 证据充当 S-fix 的回滚证伪                               |

## 代码健康治理的 RTM 影响（Phase 1–4）

`/wm code-health` 的每个候选携带 `rtmImpact`（`rtmBefore` / `rtmAfter` 需求 ID 集合 + `coverageBefore` / `coverageAfter` + `testLevels` + `unmappedScenarios`）与 `coverageImpact`，其中 `coverageIsSignalOnly: true`、覆盖率数值恒为 `null`——**coverage 只作发现信号，不授权删除或跳过维度**。

- 删除代码 / 删除测试 / 抽象重复前，人类批准的 scope 必须显式给出受影响的 RTM 行；apply 后 S 子代理须回填 `rtm.json` 实体字段（不得由 O 越权代填）。
- 任意 RTM 行删除都必须有人类 `ApprovalDecision` + candidate/scope/revision 绑定；无法证明「非保护」的删除按默认拒绝处理。
- 失败的删除/抽象必须回滚到 pre-change revision（`git apply -R` + `git diff --exit-code`=0），RTM 同步恢复。

详见 [code-health-governance.md](code-health-governance.md) 与 SSoT §10K。

## 测试用例 ID 命名规则

RTM 与各阶段文档使用两套 ID，按用途区分，不可混用：

| ID 格式                                         | 用途                                                                                                  | 出现位置                                                                                                                                           | 示例                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `<Type>-NNN`，Type ∈ {`UT`, `IT`, `ST`, `UAT`}  | **运行时测试用例 ID**，登记到 RTM 的四级测试列                                                        | RTM、`templates/rtm.md`、`templates/{system,interface,detailed,requirement}-design.md`、`examples/`、阶段 5/6/7/8 文档的「测试用例设计（执行）」表 | `UT-001`（单元测试）、`IT-001`（集成测试）、`ST-001`（系统测试）、`UAT-001`（验收测试）    |
| `TC-<PHASE>-NNN`，PHASE ∈ {`REQ`, `DES`, `COD`} | **阶段产物验证用例 ID**，校验该阶段产物本身是否合格（如「类图生成」「需求完整性检查」），不登记到 RTM | 阶段 1/2/3/4/5 文档的「测试用例设计」表、SSoT §3.2.1-3.2.3                                                                                         | `TC-REQ-001`（需求解析）、`TC-DES-002`（类图生成）、`TC-COD-004`（单元测试代码覆盖率检查） |

要点：

- **运行时测试用例**（四级测试）一律采用短形式 `UT/IT/ST/UAT-NNN`，登记到 RTM 对应列；同一类型在项目内连续编号（如 `UT-001 ~ UT-018`）。
- **阶段产物验证用例**采用 `TC-<PHASE>-NNN`，仅出现在阶段文档与 SSoT 中作为示例，用于校验阶段产出物（需求规格、设计文档、代码、覆盖率报告）是否合格，不进入 RTM。
- **历史兼容**：早期版本阶段 6/7/8 文档曾使用 `TC-INT-*` / `TC-SYS-*` / `TC-UAT-*` 表示执行用例，已统一改为 `IT-*` / `ST-*` / `UAT-*`，与 RTM 短形式一致。

## RTM 登记命令与覆盖率算法（指令具体性）

> 每阶段 RTM 字段更新的具体命令清单 + 覆盖率计算公式 + 缺失项检测算法。Agent 须按此执行，禁止凭印象登记。

### 1. 各阶段 RTM 字段更新清单

| 阶段       | 更新的 RTM 字段               | 登记命令（伪代码）                                                        | 校验                        |
| ---------- | ----------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| 1 需求分析 | 需求 ID、需求描述、验收测试列 | `rtm.addRequirement({id:'REQ-NNN', desc, uatId:'UAT-NNN'})`               | 字段非空 + ID 唯一          |
| 2 系统设计 | 设计文档列、系统测试列        | `rtm.updateDesign(reqId, {sd:'SD-N.N.N', stId:'ST-NNN'})`                 | `sd` 非空 + `stId` 关联 REQ |
| 3 概要设计 | 接口设计列、集成测试列        | `rtm.updateDesign(reqId, {interfaceDoc:'SD-N.N.N', itId:'IT-NNN'})`       | 同上                        |
| 4 详细设计 | 详细设计列、单元测试列        | `rtm.updateDesign(reqId, {detailedDoc:'SD-N.N.N', utId:'UT-NNN'})`        | 同上                        |
| 5 编码     | 代码模块列                    | `rtm.updateCode(reqId, '<filename>.ts')`                                  | 文件路径存在                |
| 6 集成测试 | 集成测试状态列                | `rtm.updateStatus(itId, '通过' \| '失败')`                                | 状态 ∈ 枚举                 |
| 7 系统测试 | 系统测试状态列                | `rtm.updateStatus(stId, '通过' \| '失败')`                                | 同上                        |
| 8 验收测试 | 验收测试状态列、覆盖率终检    | `rtm.updateStatus(uatId, '通过' \| '失败')` + 跑 `check-artifact-gate.ts` | 退出码 0                    |

### codeModule 格式规范

`codeModule` 字段须按行类型填写不同格式：

| 行类型 | 格式                            | 正则                                       | 示例                          |
| ------ | ------------------------------- | ------------------------------------------ | ----------------------------- |
| REQ 行 | `SD-xxx:src/path/to/file.ts`    | `^SD-[\d.]+:src/.+\.(ts\|js\|py\|java)$`   | `SD-5.2.1:src/auth/login.ts`  |
| NFR 行 | `src/path/to/file.ts` 或 `横切` | `^src/.+\.(ts\|js\|py\|java)$` 或 `^横切$` | `src/middleware/rateLimit.ts` |
| CON 行 | 同 NFR                          | 同 NFR                                     | `横切`                        |

**校验时机**：`check-artifact-gate.ts --phase=5` 强制校验。
**校验逻辑**：按 `requirementId` 前缀（`REQ-` / `NFR-` / `CON-`）分支匹配正则。

### 2. 覆盖率计算公式

**需求覆盖率 =（7 个追溯字段均非空的需求数 / 总需求数）× 100%**。每个 `REQ-NNN` 须具备 `description` / `designDoc` / `codeModule` / `unitTest` / `integrationTest` / `systemTest` / `acceptanceTest`；任一字段为空，该需求即未覆盖。`coverageStatus` 仅用于展示，门禁脚本会从原始字段重算，不信任手工填写的状态。

### 3. 缺失项检测算法

阶段 8 终检前必须执行（实际由 `check-artifact-gate.ts` 实现，此处仅作流程透明化）：遍历 `rtm.json` 的 `requirements[]`，对每个 REQ 检查 7 个必需字段（`desc` / `designDoc` / `codeModule` / `unitTest` / `integrationTest` / `systemTest` / `acceptanceTest`）是否非空；任一字段为空即记入 `missingItems`。`missingItems` 非空 → 退出码 1，Agent 须将缺失明细透传给用户并记录为 R 定位线索；完成普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）后，再按 R 结论由 S-fix 补齐并重新执行；为空 → 退出码 0 可发布。

> 缺失项明细由 `check-artifact-gate.ts` 输出到 stdout，Agent 须将其透传给用户。

### BDD features 引用格式

BDD features 文件引用附加在短 ID 之后，用 `|` 分隔：

- `UAT-NNN | BDD-L1-<system>-<num>.feature`
- `ST-NNN | BDD-L2-<system>_<subsystem>-<num>.feature`
- `IT-NNN | BDD-L3-<system>_<subsystem>-<num>.feature`
- `UT-NNN | BDD-L4-<system>_<subsystem>_<atom>-<num>.feature`

RTM 行 schema 字段类型保持 `string | null` 不变（BDD 引用作为字符串值的一部分，不新增字段）。
