# 真实命令证据：门禁脚本实际输出实录（41.9.0）

> 本文件是 examples/ 中唯一的**真实证据**示例——以下命令在本仓库实际执行（2026-08-13，41.9.0），
> 输出为真实截取（含退出码与 JSON 摘要），非示意。对话类示例（coding / requirement-analysis /
> system-design / test-execution）为「伪示例」，仅供 LLM 行为对齐，其字段不代表真实输出，以本文件为准。
>
> 命令基座：仓库根目录，`npx tsx w-model-dev/scripts/cli/<check>.ts`；退出码约定：0=通过 / 1=校验失败 / 2=输入错误。

## 1. 校验通过（exit 0）

```bash
$ npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json
质量等级      : A
校验结果      : ✓ 通过
────────────────────────────────────────────────────────────
输出结构符合 verifier-spec.md §6 Schema 与各数值约束。
────────────────────────────────────────────────────────────
VERIFIER_JSON {"type":"verifier-output","passed":true,"selfAsVerifier":false,"compositeScore":0.8735,"expectedCompositeScore":0.8735,"qualityLevel":"A","reasons":[],"exitCode":0}
```

退出码 `0`。机器可读摘要在 stdout 末行 `VERIFIER_JSON {...}`（Agent 正则截取用）。

## 2. 校验失败（exit 1）

```bash
$ npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-ranking-k.json
────────────────────────────────────────────────────────────
未通过原因：
  - [schema] /ranking/k: must be integer [type]

外部 Agent 必须按上述原因重新执行评审，详见：
  w-model-dev/references/verifier-spec.md
────────────────────────────────────────────────────────────
VERIFIER_JSON {"type":"verifier-output","passed":false,"selfAsVerifier":false,"compositeScore":0,"expectedCompositeScore":0,"qualityLevel":"N/A","reasons":["[schema] /ranking/k: must be integer [type]"],"exitCode":1}
```

退出码 `1`。violations 在人类可读段列出，`reasons[]` 进 JSON 摘要。

## 3. 输入错误（exit 2，结构化 ERROR_JSON）

```bash
$ npx tsx w-model-dev/scripts/cli/check-verifier-output.ts
✗ [ARG_INVALID] 参数缺失 <output.json> [rule=P0-1]: 用法: npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <output.json> [--self-as-verifier --s-output=<path>]
ERROR_JSON {"category":"ARG_INVALID","message":"参数缺失 <output.json>","exitCode":2,"rule":"P0-1"}
```

退出码 `2`。人类可读错误走 stderr（`✗ [CATEGORY] ...`），`ERROR_JSON {...}` 摘要走 stdout。

## 4. 图谱门禁：通过（exit 0，含警告不阻断）

```bash
$ npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev/scripts/samples/graph/valid-req-hierarchy.json
  - 边数下限警告：当前边数 4 < 节点数 × 3 = 15（可能存在孤立节点或边缺失）
  - 语义来源占比警告：语义来源边占比 0.0% < 80%（可能存在过多人工补丁边）
────────────────────────────────────────────────────────────
GRAPH_JSON {"type":"requirement-graph","passed":true,"phase":1,"totalNodes":5,"totalEdges":4,"connectedComponents":1,"isolatedNodes":[],"roots":["REQ-001"],"orphans":[],"multiParent":[],"traceabilityViolations":{"SD_without_implements":0,"INTF_without_defines":0,"DD_without_realizes":0},"dataflowViolations":{"blackHoles":[],"miracles":[],"deadModules":[]},"boundary":{"extIn":0,"extOut":0,"complete":true},"reqHierarchy":{"groups":["REQ-001"],"maxDepth":4,"levelDistribution":{"1":1,"2":1,"3":1,"4":2},"orphanReqs":[],"multiParentReqs":[],"levelMonotonicViolations":[],"missingLevelReqs":[]},"crossLogic":{"dependsOnCycles":[],"precedesCycles":[],"conflictsAsymmetric":[],"crossCutsSourceTypeViolations":[],"crossCutsTargetTypeViolations":[]},"exemptionsApplied":[],"violations":[],"warnings":["边数下限警告：当前边数 4 < 节点数 × 3 = 15（可能存在孤立节点或边缺失）","语义来源占比警告：语义来源边占比 0.0% < 80%（可能存在过多人工补丁边）"],"converged":true,"exitCode":0}
```

退出码 `0`。警告（`warnings[]`）不阻断放行；`converged:true` 表示图谱满足收敛准则。

## 5. 图谱门禁：失败（exit 1，violations 明细）

```bash
$ npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev/scripts/samples/graph/bad-orphan.json
────────────────────────────────────────────────────────────
警告：
  - 边数下限警告：当前边数 4 < 节点数 × 3 = 15（可能存在孤立节点或边缺失）
  - 语义来源占比警告：语义来源边占比 0.0% < 80%（可能存在过多人工补丁边）
────────────────────────────────────────────────────────────
GRAPH_JSON {"type":"requirement-graph","passed":false,"phase":1,"totalNodes":5,"totalEdges":4,"connectedComponents":1,"isolatedNodes":[],"roots":["REQ-001"],"orphans":["SD-002"],"multiParent":[],"traceabilityViolations":{"SD_without_implements":0,"INTF_without_defines":0,"DD_without_realizes":0},"dataflowViolations":{"blackHoles":[],"miracles":[],"deadModules":[]},"boundary":{"extIn":1,"extOut":1,"complete":true},"reqHierarchy":{"groups":[],"maxDepth":0,"levelDistribution":{"0":1},"orphanReqs":[],"multiParentReqs":[],"levelMonotonicViolations":[],"missingLevelReqs":["REQ-001"]},"crossLogic":{"dependsOnCycles":[],"precedesCycles":[],"conflictsAsymmetric":[],"crossCutsSourceTypeViolations":[],"crossCutsTargetTypeViolations":[]},"exemptionsApplied":[],"violations":["单根校验失败：根候选含非 REQ 节点: SD-002（根必须是系统 REQ 节点）","orphan 校验失败：以下节点无法从根 REQ-001 经 parent 边追溯: SD-002","R1-R4 层级校验失败：REQ 节点缺 level 字段（强制必填，无降级）：REQ-001"],"warnings":["边数下限警告：当前边数 4 < 节点数 × 3 = 15（可能存在孤立节点或边缺失）","语义来源占比警告：语义来源边占比 0.0% < 80%（可能存在过多人工补丁边）"],"converged":false,"exitCode":1}
```

退出码 `1`。`violations[]` 逐条列出失败原因（单根 / orphan 追溯 / R1-R4 层级），`converged:false`。

## 6. 本仓库自身门禁（exit 0）

```bash
$ npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts
Samples Coverage Checker
────────────────────────────────────────────────────────────
✓ 全部 fixture 已被 self-test.ts 引用，矩阵声明齐全
────────────────────────────────────────────────────────────
SAMPLES_COVERAGE_JSON {"fixtureCount":272,"referencedFiles":234,"referencedDirs":15,"unregistered":0,"undeclaredDirs":0,"exitCode":0}
```

## 使用约定

- 引用真实输出时优先用本文件；若脚本输出演进（JSON 字段增减），同步更新本文件并重跑命令验证——本文件所有块均为可重跑命令。
- 对话类示例的「退出码 / JSON 前缀 / 错误分类」应与本文件一致；字段细节以本文件与脚本实际输出为准。
