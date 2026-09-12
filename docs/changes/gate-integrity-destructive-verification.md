# 门禁完整性 campaign — 破坏性验证记录（2026-09-12）

> 对应计划 [任务 15](../superpowers/plans/2026-09-12-gate-integrity-evidence-reconciliation.md) 与规格 §4。
> 逐项记录：**命令 + 预期 + 实测**。格式沿用 `2026-09-07-trigger-boundary-campaign` 的破坏性验证步骤。
>
> 验证环境：worktree `feat/gate-integrity-evidence-reconciliation`（基于 `72081e2`），Windows x64 + Git Bash。
> 全部实测在 `npm run prepush` 18 项全绿之后执行。

## 判定原则

本 campaign 修的四个缺陷共享同一根因：**形态合规但事实不正确**。因此每一项破坏性验证的判据不是"脚本报错了"，而是**脚本因预期的那一条子项报错，且还原后恢复绿**。若某次红灯来自无关原因（例如测试夹具自身 schema 不合法），该项记为**无效控制**并在下方如实标注，不以"exit 1"充数。

## 十项结果总览

| # | 项                     | 命令类别                    | 预期                | 实测                              | 判定         |
| - | ---------------------- | --------------------------- | ------------------- | --------------------------------- | ------------ |
| 1 | 三视角不一致           | `check-iceberg-sweep.ts`    | exit 1 + reasons 含 R6 | exit 1，`R6 视角间存在未对账差异：graph↔rtm 差异项：SD-001, SD-002` | ✅ 有效       |
| 2 | 空 `sweptArtifacts`    | `check-iceberg-sweep.ts`    | 被 schema 拦截      | exit 1，`/sweepCoverage/sweptArtifacts: must NOT have fewer than 1 items [minItems]` | ✅ 有效       |
| 3 | R3 `passed=false`      | `check-preventive-review.ts` | exit 1 + violation  | exit 1，`R3 报告声明未通过：… passed=false` | ✅ 有效       |
| 4 | 节点缺 `evidenceAnchor` | `check-requirement-graph.ts` | exit 1 + R15a      | exit 1，`R15a evidenceAnchor 缺失：REQ-001（阶段 1-4 全节点必填）` | ✅ 有效       |
| 5 | `pending` 常态扫描     | DoD 自检清单               | 阻断放行            | 三处判据齐备（含放行前清单项），见下 | ✅ 有效       |
| 6 | `evidenceAnchor` 路径不存在 | `check-requirement-graph.ts` | exit 1 + R15c  | exit 1，`R15c 证据路径不存在：REQ-001（nonexistent/does-not-exist.md）` | ✅ 有效       |
| 7 | 跨轮次 A→C             | `check-run-log.ts`          | exit 1 + R9        | exit 1，`R9 跨轮次评审不一致：… 跨 2 档` | ✅ 有效       |
| 8 | `confirmed` 缺签名链环 | `check-requirement-graph.ts` | exit 1 + R15e      | exit 1，`R15e confirmed 缺签名链 V review 环：REQ-001` | ✅ 有效       |
| 9 | 方差坍缩               | `checkR18ResolutionFloor`   | 触发 R18            | 触发（`resolution-collapse-001`） | ✅ 有效       |
| 10 | 5 类既有豁免仍绿      | `check-exemption.ts`        | exit 0             | exit 0（另第 6 类亦 exit 0）      | ✅ 有效       |

**10/10 有效**，无一项以无关红灯充数。

## 关键项详情

### 项 1：三视角不一致（R6，规格 §4 第 1 项）

`check-iceberg-sweep.ts` 的分母来自**真实落盘产物**，不是报告自述。故验证必须构造真实的项目树，否则视角集合推导不出来（此时 R6 按设计不触发——空集合与"未读盘"语义不同，见 CLI 层 `buildIcebergExternalEvidence` 注释）。

构造：临时项目含 `.w-model/ingestion/graph.json`（节点 SD-001、SD-002）与 `.w-model/rtm.json`（含 SD-001、SD-002），放入视角不一致的报告。

```bash
npx tsx w-model-dev/scripts/cli/check-iceberg-sweep.ts <tmp>/.w-model/iceberg/bad-view-disagreement.json
```

实测：exit 1，reasons 含 `R6 视角间存在未对账差异：graph↔rtm 差异项：SD-001, SD-002`。

**注意（复盘发现）**：直接对仓库内 fixture 路径跑 CLI 会 exit 0——因为 `resolveProjectRoot` 自 fixture 所在目录向上找到仓库根的 `.w-model/`（不存在），四个上游产物全 `undefined`，视角集合推导为空，R6 按设计跳过。`self-test.ts` 通过 `injectViewSets` 注入面覆盖逻辑层；**真实落盘路径的验证必须另建项目树**（即本项）。这一区分已记录，避免后续维护者以"fixture 跑出 exit 0"误判 R6 失效。

### 项 2：空 `sweptArtifacts`（规格 §4 第 2 项）

把 `bad-empty-findings-uncovered.json` 的 `sweepCoverage.sweptArtifacts` 置为 `[]`。

实测：exit 1，schema 报 `minItems`。即"零发现 + 空声明"不再可通过——这正是 `newFindings: []` 原可放行的漏洞。

### 项 5：`pending` 常态扫描

判据落在 DoD 自检（`quick-self-check.md`）而非 graph 门禁，故"阻断"的验证点是判据存在且口径一致。实测三处：

- `:24` 自检清单新增项「未验证证据锚点已清零」；
- `:65` 七维度标准「文档」维度行；
- `:99` **阶段门放行前**清单项。

三处均写明：存在 `pending` 即阻断放行，须补验证转 `confirmed` 或走 `exemption` 第 6 类；并注明**常态触发（非返工触发）**及其理由——pending 是"尚未验证"而非"产物有缺陷"，走 R 会把"没做功课"误判为"产物有缺陷"。

> **无效控制记录**：本次曾以「构造 `evidenceStatus: 'pending'` 的 graph.json 并断言 graph 门禁 exit 1」作为本项验证，实测 exit 1 但原因是 **R15c 路径不存在**（临时目录解析不到锚点），与 pending 无关。该控制无效，已改用上述 DoD 判据核对，如实记录于此。

### 项 8 + 早期阶段不误红（规格 §4 第 6 项，且为计划重点 1）

R15e 的设计要求：`confirmed` 锚点须在签名链中存在引用该节点的 V review 环，指向该锚点；但**签名链文件不存在时（阶段 1 早期）不得产生 violation**，否则早期阶段必然假红。

实测（同一夹具、仅改签名链文件的有无）：

| 条件                        | 命令                                         | 预期 | 实测 |
| --------------------------- | -------------------------------------------- | ---- | ---- |
| `.w-model/signature-chain.jsonl` **不存在** | `check-requirement-graph.ts <graph> --phase=1` | 0    | **0** ✅ |
| `.w-model/signature-chain.jsonl` **存在但为空** | 同上                                      | 1    | **1** ✅ |

这是本 campaign 最易写错的一处（"缺席静默跳过"与"缺席即失败"之间），实测证明实现取的是正确的一侧：**文件不存在 = 尚未到签名链阶段 → 不报；文件存在但无环 = 声称已核验却无证据 → 报。**

## 还原确认

所有破坏性验证在临时目录或临时构造的文件中进行；验证后 `git status --porcelain` 为空，仓库内 fixture 未被修改。项 1/5/8 用到的项目树已删除。

## 未覆盖项与边界

- **R15d（覆盖对账）未实现**，故无对应破坏性验证。原因见 `evidence-anchored-tree.md` §3 与 SSoT §10L.2：codegraph `--scope` 覆盖语义限定在阶段 5-8，图谱节点只在阶段 1-4，定义域不相交。编号空缺为**已决议项**。
- **语义支持性不验证**：锚点指向的内容是否**真的支持**该结论需要判断，属 V 评审职责，不在确定性门禁能力范围内。本 campaign 只保证"引用的东西真实存在且已被核验"，不保证"引用得对"。
