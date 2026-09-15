# 需求跟踪矩阵（RTM）

> 全流程维护。各阶段按 [references/rtm-guide.md](../references/rtm-guide.md) 登记对应列。

## 项目信息

- 项目名称：{{项目名称}}
- 最后更新：{{YYYY-MM-DD}}
- 当前阶段：{{阶段名}}

## 跟踪矩阵

| 需求 ID | 需求描述 | 设计文档 | 代码模块 | 单元测试 | 集成测试 | 系统测试 | 验收测试 | 覆盖状态 |
|---|---|---|---|---|---|---|---|---|
| REQ-001 | {{描述}} | {{SD-3.2.1}} | {{userController.ts}} | {{UT-001 \| BDD-L4-blog_system_user_controller-001.feature}} | {{IT-001 \| BDD-L3-blog_system_auth-001.feature}} | {{ST-001 \| BDD-L2-blog_system_auth-001.feature}} | {{UAT-001 \| BDD-L1-blog_system-001.feature}} | {{100%}} |
| REQ-002 | {{描述}} | — | — | — | — | — | {{UAT-002}} | {{部分}} |
| REQ-003 | {{描述}} | — | — | — | — | — | — | {{待覆盖}} |

## 状态说明

- `—`：尚未到达该阶段，待填充。
- 单元 / 集成 / 系统 / 验收测试列填用例 ID，并在测试报告产出后追加状态（如 `UT-001 ✅`）。
- BDD features 引用附加在短 ID 之后，用 ` | ` 分隔（如 `UAT-001 | BDD-L1-<system>-<num>.feature`），格式详见 [references/rtm-guide.md](../references/rtm-guide.md)「BDD features 引用格式」节。
- 覆盖状态：由门禁脚本从 7 个追溯字段重算；`100%`（全部字段已填充且测试通过）/ `部分` / `待覆盖` 仅作为展示值，不能替代 `.w-model/rtm.json` 的确定性校验。

## 测试执行状态汇总

| 测试类型 | 用例数 | 通过 | 失败 | 待执行 | 通过率 |
|---|---|---|---|---|---|
| 单元测试 | {{}} | {{}} | {{}} | {{}} | {{%}} |
| 集成测试 | {{}} | {{}} | {{}} | {{}} | {{%}} |
| 系统测试 | {{}} | {{}} | {{}} | {{}} | {{%}} |
| 验收测试 | {{}} | {{}} | {{}} | {{}} | {{%}} |

> **测试执行证据（M07）**：更新本表时，阶段范围内 `total>0` 的层须在该层 `executionSummary.<layer>` 登记 `evidence`（`command` + `exitCode` + `observedAt`，可选 `rawOutputPath` + `rawOutputSha256` **成对**）；`lastUpdated` 早于 `2026-09-15T00:00:00Z` 的旧 RTM 缺证据由门禁 `LEGACY_TEST_EVIDENCE` 非阻断吸收，`lastUpdated` 缺失或不可解析则必须携带。字段与规则详见 `references/rtm-guide.md`「测试执行证据（M07）」节。

## RTM 需求覆盖率检查

- [ ] 所有需求均有设计文档对应
- [ ] 所有需求均有代码模块对应
- [ ] 所有需求均有四级测试用例对应
- [ ] RTM 需求覆盖率 100%（验收阶段终检）

## 变更记录

| 日期 | 变更内容 | 影响需求 | 操作者 |
|---|---|---|---|
| {{YYYY-MM-DD}} | {{新增/修改需求}} | REQ-001 | {{}} |
