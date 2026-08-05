# 测试 Coverage 矩阵

> 借鉴 drawio-skill/tests/README.md 的「Area | What's locked in」表设计：明示每个 test 文件覆盖的 R 规则，便于回归与新增校验项时定位。

## 测试文件清单

| File | Area | What's locked in |
|---|---|---|
| bdd-logic.test.ts | BDD | parseFeatureHeader 头标注解析 / parseBackgroundStateMachine 七要素解析 / validateStateMachineCompleteness 状态机完整性 / validateScenarioPath 路径合法性 / validateTlaEquivalence BDD↔TLA+ 等价性 / checkBddModel schema 失败 exitCode=2 |
| budget-logic.test.ts | Budget | R1 时效性 / R2 schema / R3 onExceed / R4 killSwitch / R5 触发检测 |
| code-tla-logic.test.ts | Code-TLA+ | SD→codeModule 映射 / 状态转移 / Next 分支 / 不变式覆盖 |
| gate-enhancement.test.ts | Gate | basePath 强制 / SD 覆盖率 / passed↔qualityLevel / phase 三段语义 |
| root-cause-logic.test.ts | RootCause | R1 schema / R2 链长 / R3 可证伪 / R4 修复建议 / R5 预防 / R6 上游 / R7 质量 / R8 报告 ID / R9 多角度 / R10 reality |
| run-log-logic.test.ts | RunLog | R1 完整性 / R2 tokens / R3 返工 / R4 决策 / R5 O越权 / R6 exitCode / R7 时序 |
| tla-logic.test.ts | TLA+ | 文件头 / 层次 / 拆解 / SANY / TLC / R13 checkRounds schema |
| schema-validation.test.ts | Schema | additionalProperties 拒绝 / missing required 拒绝 / wrong type 拒绝 / 合法样本接受 |
| security-scan.test.ts | Security | baseline 命中豁免 / 新增发现识别 / sha256 指纹稳定性 |
| skill-metadata.test.ts | Metadata | frontmatter version 与 metadata.json 一致 / name 一致 / schemaVersion 存在 |
| read-json-or-exit.test.ts | CLI IO | readJsonOrExit 正常/ENOENT/非法 JSON/相对路径 / readJsonlOrExit 正常/空行/坏行 warn/ENOENT/CRLF/label 默认值 |
| wm-status-logic.test.ts | WmStatus | 9 态 → phase 映射 / completedPhases 与 progress / RTM 覆盖计数 / 四级测试透传 / recentActions 尾部 3 条精简字段 / rtm·runLog 缺失降级 / nextSteps 确定性 |
| metrics-report-logic.test.ts | Metrics | 总体汇总 / 阶段分组 / 动作·角色·结果分布 / 返工率与连续段 / gate 通过率（0/非0/null 归类）/ 预算 burn rate 与 killSwitch 两路径 / 窗口与 phase 过滤 / 空 run-log |

## pure/IO 函数边界（借鉴点 5）

所有 `*-logic.ts` 必须保持纯函数：
- 不 import `node:fs` / `node:child_process` / `node:path`
- 不调用 `process.exit` / `process.argv` / `process.env` / `process.stdout` / `process.stderr`
- 不修改外部状态

IO 调用必须在 `check-*.ts` 入口层完成，传纯数据给 logic 层。

违反检测：

```bash
cd w-model-dev/scripts && grep -nE "from 'node:fs'|from 'node:child_process'|process\.(exit|argv|env|stdout|stderr)" *-logic.ts
```

应无输出。

## 新增测试时

1. 在本表追加 `File | Area | What's locked in` 行
2. 在 `self-test.ts` 同步追加样本用例（若涉及 logic 层）
3. 必要时在 `samples/<area>/` 增加 `bad-*.json` 反例
