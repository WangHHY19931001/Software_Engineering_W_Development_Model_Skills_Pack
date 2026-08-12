# 编码实现文档

> 阶段 5（编码实现）产出。套用时替换 `{{}}` 占位符。
>
> 编码聚焦：按详细设计与票据（tickets.md）实现代码 + 单元测试，产出覆盖率报告。
> 编码前须执行 codegraph 修改前影响分析（约束 #14）与 opsx 三段式分派（启用时），详见 [phase-5-coding.md](../references/phase-5-coding.md)。

## 文档信息

- 项目名称：{{项目名称}}
- 文档版本：{{v1.0}}
- 编码日期：{{YYYY-MM-DD}}
- 编码者：{{执行者（S 子代理）}}

## 0. 文档定位与 SSOT 头

> **文档版本**：{{v1.0}}（{{YYYY-MM-DD}} 首版）
> **SSOT 声明**：本编码文档 + `.w-model/rtm.json` 的 `codeModule` 列为阶段 5 代码实现的唯一事实来源；代码模块↔需求/设计映射以 RTM 为准，本文档不重复维护映射。
> **DoD 引用**：阶段 5 完成度按 [definition-of-done.md](../references/definition-of-done.md) 七维度标准 + [phase-5-coding.md](../references/phase-5-coding.md)「验收标准」判定；放行前逐项勾选。
> **自身校验**：`check-code-tla-consistency.ts` 校验 codeModule↔TLA+ 一致性（维度 1）；`check-artifact-gate.ts --phase=5` 校验 NFR/CON codeModule 回填与 `codeModule` 格式。
> **禁止占位词**：TBD/TODO/undefined 不得进入正式交付。

## 1. 实现清单

| 票据 ID | 实现契约（符号级） | 代码模块（RTM codeModule） | 状态 |
|---|---|---|---|
| 01 | {{实现 XX 契约：入参/返回/状态转移}} | SD-5.2.1:src/services/article.service.ts | ✅ 完成 |

> 票据主体为符号级契约（接口 / 类型 / 行为），文件路径由 codegraph 查询落盘决定（见 [phase-5-coding.md](../references/phase-5-coding.md)「票据内容 durability」）。

## 2. 单元测试

### 2.1 用例执行结果

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 | 状态 |
|---|---|---|---|---|---|
| TC-UNIT-001 | {{}} | {{}} | {{}} | 高 | ✅ 通过 |
| TC-UNIT-002 | {{}} | {{}} | {{}} | 高 | ✅ 通过 |

### 2.2 覆盖率

| 指标 | 目标 | 实测 |
|---|---|---|
| 行覆盖率 | ≥ 80% | {{%}} |
| 分支覆盖率 | ≥ 80% | {{%}} |

## 3. 规范检查

| 检查项 | 命令 | 结果 |
|---|---|---|
| 编译验证 | `npx tsc --noEmit`（TS）/ `npm run build` | 退出码 {{0}} |
| 规范检查 | `npx eslint . --max-warnings=0` + `npx prettier --check .` | 0 error / 0 warning |
| 静态检查 | {{语言静态工具（pylint/ruff/spotbugs/golangci-lint 等）}} | {{结果落盘路径}} |

## 4. 代码审查摘要

| 审查项 | 结果 | reworkHints |
|---|---|---|
| 安全性 / 可读性 / 可维护性 / 规范一致性 | qualityLevel {{A/B}} | {{无 / 列表}} |

## 5. 验收设计反向对照（强制）

> 第 22 轮新增。编码完成后逐条核对，违反任一条 → 回编码修正，禁止「以代码为准」忽略设计。

- [ ] 路径一致性：`docs/uat-path-mapping.md`「实际路径」已回填且与路由定义一致
- [ ] 参数一致性：分页/筛选参数名与验收测试设计一致
- [ ] 状态码一致性：成功/错误状态码与验收测试设计一致
- [ ] 响应字段一致性：响应体字段名与验收测试设计一致

## 6. RTM 登记

- [ ] REQ 行 `codeModule` 已回填（格式 `SD-xxx:src/path/to/file.ts`，多个用逗号分隔）
- [ ] NFR/CON 行 `codeModule` 已回填（文件清单或 `横切`）

## 7. 校验

- `check-code-tla-consistency.ts`：codeModule↔TLA+ 一致性回归，退出码 0
- `check-artifact-gate.ts --phase=5`：阶段级校验（codeModule 格式 + NFR/CON 回填），退出码 0
- `check-codegraph-queries.ts` / `check-opsx-artifacts.ts`（启用 opsx 三段式时）：退出码 0
- 门禁脚本 stdout 末尾 5 行须贴出作为放行证据（约束 #9，第 24 轮新增）

## 8. 结论

- [ ] 代码可编译通过、规范检查 0 error / 0 warning
- [ ] 单元测试全部通过，覆盖率 ≥ 80%
- [ ] 代码审查无高危问题
- [ ] RTM 已补登代码模块映射
- [ ] 阶段门放行前向用户展示：编译结果 / 规范检查 / 单元测试通过率 / 覆盖率 / 审查报告摘要
