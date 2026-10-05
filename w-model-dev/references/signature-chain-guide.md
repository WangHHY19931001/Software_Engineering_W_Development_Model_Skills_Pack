# 签名链与产出来源正确性指南

> 对应 SSoT §7.9 SignatureChainEntry schema + §10.11 签名链门禁 + §3.4.17 产出来源正确性。

## 1. 签名链数据结构

每阶段每角色完成动作后产出签名记录，写入 `signature-chain.jsonl`（schema 见 SSoT §7.9 / `schemas/signature-chain.schema.json`）。

**链式约束**：

- `prevSigId` 指向同阶段前一环签名（形成链）
- `sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`
- 首环 `prevSigId = "genesis"`，`prevSigHash = "0"`（阶段起点）
- 签名链在 `signature-chain.jsonl` 内自包含闭环（genesis/首条锚定）；run-log **不**承载链根字段（run-log.schema.json `additionalProperties: false`），亦无任何「链根 hash」消费点
- 可选字段 `targetKind`（返工链语义分类，D-1）是**不入哈希**的元数据：带与不带 `targetKind` 的同一环 sigHash 相同（否则 R6 重算会让全部既有签名链失效）；缺省语义为 `standard`

## 2. 阶段角色签名顺序（强制链）

### 跨阶段连续链语义

签名链支持跨阶段连续链：阶段 N+1 的首条签名的 `prevSigId` 可指向阶段 N 的末条签名（而非仅限于同阶段 genesis）。这允许将全部 8 阶段构建为一条完整的连续签名链。

- **archive 全链模式**：所有条目按 `signedAt` 排序后校验为一条连续链（首条 `prevSigId="genesis"`，其余条 `prevSigId/prevSigHash` 与前条匹配）
- **--phase=N 模式**：phase 内首条 `prevSigId` 允许指向上一阶段末条（从全链查找），其余条须等于 phase 内前条（使用列表索引 `phaseEntries[i-1]`）

### 阶段 1 签名链

```
genesis → O(chunk) → A(cross) → S(produce) → V(review) → G(graph-gate) → G(tla-gate) → G(bdd-gate) → G(coverage-gate) → O(checkpoint-用户确认)
```

### 阶段 2-4 签名链

```
genesis → O(chunk) → A(cross) → S(produce) → V(review) → G(graph-gate) → G(tla-gate) → G(bdd-gate) → O(checkpoint-用户确认)
```

### 阶段 5 签名链

```
genesis → O(chunk) → S(produce) → V(review-code) → G(check-code-tla-consistency) → G(check-artifact-gate --phase=5) → O(checkpoint-用户确认)
```

### 阶段 6-7 签名链

```
genesis → O(chunk) → S(produce) → V(review) → G(check-artifact-gate --phase=N) → O(checkpoint-用户确认)
```

### 阶段 8 签名链

```
genesis → O(chunk) → S(produce) → V(review-acceptance) → G(check-artifact-gate --phase=8) → G(check-archive-integrity) → O(checkpoint-用户确认)
```

### 返工场景签名链子流程

```
... → V/G 不通过 → R(locate) → S(fix) → V(review-fix) → G(re-gate) → ...
```

R 签名插入在 V/G 失败之后、S-fix 之前；S-fix 须包含 R 报告作为来源证明（反模式 #18 守护）。

返工环上的 `targetKind` 填写约定（D-1）：

- **S(fix)/S(emergency-fix)**：消费 R 报告是义务而非越权（action 即为例外判据，`targetKind` 可不填或填 `standard`）
- **V(review-fix)**：复审 RootCauseReport 的环填 `targetKind: "rootcause"`
- **R(locate) 做预防性审查（R3）**：消费 S 产物的环填 `targetKind: "preventive"`
- 冰山扫掠（ICEBERG-A/B）环填 `targetKind: "iceberg"`；其余所有环不填（缺省即 `standard`）。尾注：该值当前**不解锁 R9 例外**（R-iceberg 环消费 S 产物仍须按 §3 矩阵裁定；`isAllowedSource` 三例外不含 `iceberg`）

**关键约束**：

- 每个角色签名须在前一环签名之后才能产出（时间戳单调递增）
- 跳过任一角色即链断裂
- O checkpoint 签名须包含用户确认标记（`signer` 字段须为用户 ID，非 O 角色）

## 3. 各角色来源正确性规则

| 角色  | 动作         | 强制来源（sourceArtifacts 须包含）              | 禁止来源                  |
| ----- | ------------ | ----------------------------------------------- | ------------------------- |
| **O** | chunk        | 无（阶段起点）                                  | —                         |
| **A** | cross/evolve | 上一环 O chunk 签名 + chunk 产物                | S/V/G/R 产物              |
| **S** | produce      | A cross 签名 + A 产物                           | V/G/R 产物                |
| **R** | locate       | V/G 失败信号 + 失败产物                         | S 产物（R 须独立定位）    |
| **V** | review       | S produce 签名 + S 产物                         | G/R 产物（V 保持独立性）  |
| **G** | gate         | V review 签名 + V 产物                          | S 产物（G 须通过 V 评审） |
| **O** | checkpoint   | G gate 签名 + G 产物（GATE_JSON）+ 用户确认记录 | S/A 产物                  |

### 返工例外（D-1：role×action×targetKind 三元判定）

上表「禁止来源」在以下三种**具名例外**下放行（权威实现：`signature-chain-logic.ts` `isAllowedSource`；其余组合一律仍拒，违规文案不变）：

| 例外               | 条件（三者须同时成立）                                   | 设计依据                                                         |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------- |
| S-fix 消费 R       | `role=S` ∧ `srcRole=R` ∧ `action ∈ {fix, emergency-fix}` | S-fix 必须携带 R 报告执行返工修复（反模式 #18 守护）             |
| V 复审 R 报告      | `role=V` ∧ `srcRole=R` ∧ `targetKind=rootcause`          | V 复审 RootCauseReport（返工链 V→G 必经环节，反模式 #19 守护）   |
| R 预防性审查消费 S | `role=R` ∧ `srcRole=S` ∧ `targetKind=preventive`         | R3 预防性审查须以 S 产物为输入（独立定位与预防性审查是两类动作） |

`targetKind` 四值语义（schema `enum`，缺省即 `standard`）：

- `rootcause` — 该环复审 R 报告（RootCauseReport）
- `preventive` — 该环为预防性审查（R3 报告）
- `iceberg` — 该环为冰山扫掠报告（ICEBERG-A/B）
- `standard` — 默认/非返工语境（既有链无该字段时即此值，行为不变）

> 注意：签名链 schema 的 `targetKind` 与 run-log schema 的同名 `targetKind`（requirement/design/code/test 等词表）是**不同 schema 中的不同词表**，重叠值仅 `rootcause` 且语义一致。`targetKind` 不参与 sigHash 计算（见 §1）。

## 4. G 角色校验职责（R1-R11）

G 角色在跑门禁脚本前，**先调用 `check-signature-chain.ts` 校验签名链完整性 + 产出来源正确性**：

| 规则 | 校验内容                                                                                                 | 失败后果                             |
| ---- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| R1   | 当前阶段所有强制角色签名齐全                                                                             | 门禁失败（exitCode=1），标注缺失角色 |
| R2   | 签名链连续（prevSigHash 匹配）+ 跨阶段连续链语义                                                         | 门禁失败，标注断裂点                 |
| R3   | 时间戳单调递增                                                                                           | 门禁失败，标注时序异常               |
| R4   | 签名角色与阶段角色清单匹配                                                                               | 门禁失败，标注越权角色               |
| R5   | O checkpoint 签名 signer 为用户 ID                                                                       | 门禁失败，标注代签（O4 命中）        |
| R6   | sigHash 重算一致（防篡改；按条目 `sigHashAlgo` 分流重算，见 §6.2）                                       | 门禁失败，标注篡改签名               |
| R7   | 各角色 sourceSigIds 均存在于签名链中（--phase=N 模式来源并集 = 本阶段 ∪ 上一阶段）                       | 门禁失败，标注悬空来源               |
| R8   | 各角色 sourceArtifacts 路径存在于磁盘                                                                    | 门禁失败，标注缺失产物               |
| R9   | 各角色来源符合"强制来源/禁止来源"矩阵                                                                    | 门禁失败，标注越权消费               |
| R10  | O checkpoint 的 sourceArtifacts 含 G gate 产物 + 用户确认记录                                            | 门禁失败，标注绕过门禁               |
| R11  | v2 条目（`sigHashAlgo='v2'`）的 sourceArtifacts[].sha256 必填且匹配 64-hex（v1 条目不触发，语义见 §6.2） | 门禁失败，标注缺失/非法来源 sha256   |

**校验时机**：

- G 跑每个 gate 脚本前：`check-signature-chain.ts --phase=N --stage=pre-gate`（R1-R11 全通过）
- O 在 checkpoint 前：`check-signature-chain.ts --phase=N --stage=pre-checkpoint`（R1-R11 + R5 用户确认）
- 归档时：`check-signature-chain.ts --phase=all --stage=archive`（全阶段链完整性 + 来源正确性）

## 5. 跨阶段消费者校验

各规则循环（R2/R3/R7/R8/R9）聚合全部违规点（不早停），便于一次性修复所有缺陷。Validation result 的 `violations` 数组包含所有违规项。

后续阶段消费者须校验前一阶段产出来源正确性：

| 消费者                      | 校验内容                                                                                                                                       | 失败后果                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 阶段 N+1 的 O chunk         | 阶段 N 的 G gate 签名存在 + O checkpoint 签名 signer 为用户 ID                                                                                 | 拒绝启动阶段 N+1，回退阶段 N |
| 阶段 N+1 的 S produce       | 阶段 N 的 S produce 签名 + V review 签名 + G gate 签名齐全                                                                                     | 拒绝产出，回退阶段 N         |
| 阶段 5 的 S produce（编码） | 签名链连续（R2）+ sourceSigIds 引用经 archive 跨阶段校验（R7）；阶段 1-4 全部 G gate 签名全量交叉核对由人工/外部审计承载（SSoT §10.11 如实化） | 拒绝编码，回退缺失阶段       |
| 阶段 8 的 G gate（终检）    | 阶段 1-7 全部签名链完整 + 来源正确                                                                                                             | 拒绝终检，回退缺失阶段       |

## 6. 签名链篡改检测机制（sigHash 重算）

`sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`

R6 校验规则：对每条签名记录，用上述公式重算 sigHash，与记录中的 sigHash 比对；不一致即篡改。

### 6.1 R15e：签名链作为 `evidenceStatus=confirmed` 的证据来源

`check-requirement-graph.ts` 的 R15e 把签名链当作**外部证据源**消费：图谱节点标 `confirmed` 时，
必须有签名链事实支撑，不得自报。判据（权威实现：`graph-logic.ts` `checkEvidenceAnchors`）——
签名链中须存在**同时满足以下三条**的条目（同一环，缺一不可）：

1. `role === 'V'` 且 `action === 'review'`；
2. `artifacts` 数组**包含该节点 id**（即这个 V 评审审的就是这个节点）；
3. 该条目的 `inputProvenance.sourceArtifacts[].path` **等于锚点的 path 部分**（`evidenceAnchor` 中 `:` 之前的那段）。

即：V 评审不仅覆盖了该节点，且其来源被显式指向该锚点引用的事实——"评审过这个节点"与
"核验过这个锚点"是两件事，R15e 要求两者同时成立。

**为什么不读自身字段**：`evidenceStatus` 是产出者的声明，声明本身不能作为声明为真的证据
（本战役的共同根因）。R15e 的整个意义就是把"已核验"从自报改为对账。

**触发边界**：

- 仅 `evidenceStatus === 'confirmed'` 触发；`pending` 不触发（pending 本来就是"尚未验证"，见 [evidence-anchored-tree.md](evidence-anchored-tree.md) §3 与 `exemption` 第 6 类）。
- 仅在 CLI 注入签名链条目时校验。阶段 1 早期签名链文件可能尚不存在，此时**跳过**而非报错（规格 §5：不得误红）。
- 锚点格式非法时跳过 R15e（path 部分不可信，避免二次噪声违规）。

### 6.2 v2 签名与 sha256 抄录（批次 3）

签名链条目可选 `sigHashAlgo`（枚举 `v1` | `v2`，**缺省即 `v1`**）声明其 sigHash 公式版本（SSoT §7.9）：

- **v2 公式**：与 v1 的差别仅在槽位 6——`artifacts` 清单换为 `artifactsV2 = JSON.stringify({ artifacts, sourceArtifacts })`，即 artifacts 与 sourceArtifacts 两清单整体（含每条 `sha256`）纳入内容哈希；其余槽位不变。
- **R11（仅 v2 条目适用）**：`inputProvenance.sourceArtifacts[]` 每条 `sha256` 必填且匹配 `^[a-fA-F0-9]{64}$`，缺失或非法即违规（`R11: <sigId> v2 条目来源 sha256 缺失或非法`）；v1 条目（含缺省）不触发 R11。
- **R6 按条目分流重算**：`sigHashAlgo==='v2'` 走 v2 公式，缺省/`v1` 走 v1 公式（权威实现：`signature-chain-logic.ts` `computeSigHashFor`）；v1 路径逐字节不变，既有链零破坏。
- **v1/v2 增益澄清（42.7.0 终审勘误）**：v1 公式槽 10 已将 `inputProvenance` 整体（含 `sourceArtifacts` 及其任何字段）纳入内容哈希，v1 链篡改来源声明同样会被 R6 抓获；v2 的真实增益是公式显式版本化（`sigHashAlgo` 可演进）、槽位 6 产物清单显式化（artifacts 与 sourceArtifacts 分列）、R11 强制 `sourceArtifacts[].sha256` 必填——而非「v1 抓不到来源篡改」。

**sha256 抄录约定**：v2 条目签名时，`sourceArtifacts[].sha256` 须从上游 GATE_JSON 的 `verifiedArtifacts`（本次门禁判定承重输入文件字节清单 `Array<{path, sha256, bytes}>`，四热点门禁 `--json` 恒存在、空数组允许）按 path 对应抄录——保证「签名声明的字节 = 上游门禁实际校验的字节」；无上游清单（`verifiedArtifacts` 为空或缺该 path）的来源按磁盘现算。抄录后的 sha256 随 v2 公式进入内容哈希：事后篡改该字段而不改 `sigHash`，会被 R6 重算抓获（篡改声明的其他字段同理）。知情边界：「声明 vs 真实字节」的自动核查需 gate-log 索引基建，v2 本批只绑定声明不可抵赖（D6 已裁定接受）。

## 7. 与反模式 #32 的对应关系

反模式 #32（签名链断裂）检测信号：`check-signature-chain.ts` R1-R11 任一失败。详见 [`hard-constraints.md`](./hard-constraints.md) #32。

## 8. 与归档完整性清单的协同

`signature-chain.jsonl` 须纳入归档完整性强制快照清单。归档时由 `check-archive-integrity.ts` 校验存在性，由 `check-signature-chain.ts --stage=archive` 校验完整性。
