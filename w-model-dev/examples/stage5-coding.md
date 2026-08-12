# 阶段编排示例：阶段 5 编码实现（含单元测试执行）

> 对应 W 模型阶段 5（左 V 第 5 阶段，同步右 V 单元测试执行）。命令入口：`/wm code <功能描述>` + `/wm test type=单元`。
> 本示例聚焦编排流程中的 check 脚本调用、命令行与预期输出；交互对话示例见 [coding.md](coding.md)。

## 阶段目标

- 依据《详细设计文档》与单元测试设计生成分层代码（controllers / services / models / routes）。
- 执行单元测试并产出覆盖率报告（目标 ≥ 80%）。
- 回填 RTM `codeModule` 列，形成 需求 → 设计 → 代码 追溯链。
- 通过代码-TLA+ 一致性、设计契约一致性门禁，防止编码偏离 TLA+ 行为规格与接口契约。

## 输入工件清单

| 工件 | 路径（示例） | 说明 |
|---|---|---|
| 详细设计文档 | `docs/phase4-detailed/*.md` | 类图 / 方法级定义（阶段 4 产出） |
| 单元测试用例设计 | `docs/test-cases/unit/*.md` | 阶段 4 同步设计 |
| TLA+ 规格 + 清单 | `.w-model/tla-manifest.json` | L1~L4 规格，code-TLA 一致性校验输入 |
| 需求图谱 | `.w-model/ingestion/graph.json` | type=SD/INTF/DD 节点，供映射校验 |
| RTM | `.w-model/rtm.json` | `codeModule` 列待回填 |
| 技术栈要求 | `.w-model/project.json` | 已登记技术栈 |

产出：实现代码（`src/`）、单元测试（`tests/unit/`）、覆盖率报告、codegraph 查询落盘（`docs/codegraph/`）、opsx 制品（`opsx/`）、RTM codeModule 回填。

## 门禁脚本与命令行

阶段 5 完成时，G 子代理依次运行：

```bash
# 1) 代码-TLA+ 一致性回归：C1 路径 / C2 状态 / C3 转换 与 TLA+ 规格逐项映射
npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts \
  --manifest=.w-model/tla-manifest.json \
  --graph=.w-model/ingestion/graph.json \
  --rtm=.w-model/rtm.json \
  --src=src/

# 2) 设计契约一致性：D1 路径 / D2 参数 / D3 状态码 / D4 响应字段 与验收设计对齐
npx tsx w-model-dev/scripts/cli/check-design-contract-consistency.ts .

# 3) 阶段 5 工件质量门：单元测试通过 + 覆盖率 ≥ 80% + codeModule 回填
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts . --phase=5
```

> 阶段 5-8 附加门禁：`check-codegraph-queries.ts`（约束 #14：改码前必须 codegraph 查询）与 `check-opsx-artifacts.ts`（opsx 三段式制品完整）；评审证据经 `check-verifier-output.ts` 回填。

## 预期输出（示例输出）

### 退出码 0（全部通过）

```
CONTRACT_JSON {"type":"design-contract","passed":true,"routes":18,"mismatches":0,"reasons":[]}

════════════════════════════════════════════════════════════
工件质量门校验（Artifact Gate）--phase=5
RTM 覆盖率    : 100%
单元测试      : 18/18 通过（覆盖率 95% ≥ 80%）
校验结果      : ✓ 通过
════════════════════════════════════════════════════════════
GATE_JSON {"type":"artifact","phase":5,"passed":true,"coveragePercent":100,"reasons":[]}
```

→ 退出码 0 → 🔴 CHECKPOINT · 阶段门放行，进入阶段 6 集成测试。

### 退出码 1（校验失败示例）

```
✗ [C1-3] src/services/userService.ts:42 register() 状态转移 user_registered → user_pending 与 TLA+ L4 规格不符（应为 → user_active）
CODE_TLA_JSON {"type":"code-tla-consistency","passed":false,"checkedSymbols":12,"violations":[{"file":"src/services/userService.ts","rule":"C1-3"}],"reasons":["C1-3 状态转移不一致"]}
```

→ 退出码 1：O 按 `reworkHints` 分派 S 返工（回阶段 5 编码），修复后重跑全部门禁；回归测试强制钩子（约束 #14）同时触发。

### 退出码 2（输入错误示例）

```
ERROR_JSON {"category":"ARG_INVALID","rule":"P0-1","message":"参数缺失 --manifest/--graph/--rtm/--src","exitCode":2}
```

→ 退出码 2：必填参数缺失（check-code-tla-consistency 四参数必填），修正命令行后重跑。

## 编排说明

- 阶段 5 采用 opsx 三段式 S 分派（S-explore → S-propose → S-coding），每片代码 `Write`/`Edit` 前须 codegraph_explore 查询并落盘。
- 单元测试覆盖率 < 80% 或代码审查（V，`targetKind=code` 五轴评审）未通过，均留在阶段 5 返工。
- 单元测试**执行**（阶段 5）、集成（阶段 6）、系统（阶段 7）、验收（阶段 8）四级测试逐步回填 RTM，阶段 5 质量门仅校验单元层。

## 要点

- `--phase=5` 必须显式传递，阶段级门禁不得跳过（反模式 #21）。
- 阶段 5 同时产出代码与单元测试执行结果，是右 V 测试执行的第一个落地阶段。
- codeModule 回填后，RTM 形成完整左 V 追溯链（需求 → 设计 → 代码），为后续各级测试列回填奠基。
