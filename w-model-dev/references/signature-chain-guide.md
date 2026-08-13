# 签名链与产出来源正确性指南

> 。对应 SSoT §7.9 SignatureChainEntry schema + §10.11 签名链门禁 + §3.4.17 产出来源正确性。

## 1. 签名链数据结构

每阶段每角色完成动作后产出签名记录，写入 `signature-chain.jsonl`（schema 见 SSoT §7.9 / `schemas/signature-chain.schema.json`）。

**链式约束**：
- `prevSigId` 指向同阶段前一环签名（形成链）
- `sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`
- 首环 `prevSigId = "genesis"`，`prevSigHash = "0"`（阶段起点）
- 末环（G 签名）的 `sigHash` 作为该阶段签名链根 hash，写入 run-log checkpoint 条目

## 2. 阶段角色签名顺序（强制链）

### 跨阶段连续链语义（[round28 G-E]）

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
... → V/G 失败 → R(locate) → S(fix) → V(review-fix) → G(re-gate) → ...
```

R 签名插入在 V/G 失败之后、S-fix 之前；S-fix 须包含 R 报告作为来源证明（反模式 #18 守护）。

**关键约束**：
- 每个角色签名须在前一环签名之后才能产出（时间戳单调递增）
- 跳过任一角色即链断裂
- O checkpoint 签名须包含用户确认标记（`signer` 字段须为用户 ID，非 O 角色）

## 3. 各角色来源正确性规则

| 角色 | 动作 | 强制来源（sourceArtifacts 须包含） | 禁止来源 |
|---|---|---|---|
| **O** | chunk | 无（阶段起点） | — |
| **A** | cross/evolve | 上一环 O chunk 签名 + chunk 产物 | S/V/G/R 产物 |
| **S** | produce | A cross 签名 + A 产物 | V/G/R 产物 |
| **R** | locate | V/G 失败信号 + 失败产物 | S 产物（R 须独立定位） |
| **V** | review | S produce 签名 + S 产物 | G/R 产物（V 保持独立性） |
| **G** | gate | V review 签名 + V 产物 | S 产物（G 须通过 V 评审） |
| **O** | checkpoint | G gate 签名 + G 产物（GATE_JSON）+ 用户确认记录 | S/A 产物 |

## 4. G 角色校验职责（R1-R10）

G 角色在跑门禁脚本前，**先调用 `check-signature-chain.ts` 校验签名链完整性 + 产出来源正确性**：

| 规则 | 校验内容 | 失败后果 |
|---|---|---|
| R1 | 当前阶段所有强制角色签名齐全 | 门禁失败（exitCode=1），标注缺失角色 |
| R2 | 签名链连续（prevSigHash 匹配）+ 跨阶段连续链语义 | 门禁失败，标注断裂点 |
| R3 | 时间戳单调递增 | 门禁失败，标注时序异常 |
| R4 | 签名角色与阶段角色清单匹配 | 门禁失败，标注越权角色 |
| R5 | O checkpoint 签名 signer 为用户 ID | 门禁失败，标注代签（O4 命中） |
| R6 | sigHash 重算一致（防篡改） | 门禁失败，标注篡改签名 |
| R7 | 各角色 sourceSigIds 均存在于签名链中（--phase=N 模式来源并集 = 本阶段 ∪ 上一阶段） | 门禁失败，标注悬空来源 |
| R8 | 各角色 sourceArtifacts 路径存在于磁盘 | 门禁失败，标注缺失产物 |
| R9 | 各角色来源符合"强制来源/禁止来源"矩阵 | 门禁失败，标注越权消费 |
| R10 | O checkpoint 的 sourceArtifacts 含 G gate 产物 + 用户确认记录 | 门禁失败，标注绕过门禁 |

**校验时机**：
- G 跑每个 gate 脚本前：`check-signature-chain.ts --phase=N --stage=pre-gate`（R1-R10 全通过）
- O 在 checkpoint 前：`check-signature-chain.ts --phase=N --stage=pre-checkpoint`（R1-R10 + R5 用户确认）
- 归档时：`check-signature-chain.ts --phase=all --stage=archive`（全阶段链完整性 + 来源正确性）

## 5. 跨阶段消费者校验

各规则循环（R2/R3/R7/R8/R9）聚合全部违规点（不早停），便于一次性修复所有缺陷。Validation result 的 `violations` 数组包含所有违规项。

后续阶段消费者须校验前一阶段产出来源正确性：

| 消费者 | 校验内容 | 失败后果 |
|---|---|---|
| 阶段 N+1 的 O chunk | 阶段 N 的 G gate 签名存在 + O checkpoint 签名 signer 为用户 ID | 拒绝启动阶段 N+1，回退阶段 N |
| 阶段 N+1 的 S produce | 阶段 N 的 S produce 签名 + V review 签名 + G gate 签名齐全 | 拒绝产出，回退阶段 N |
| 阶段 5 的 S produce（编码） | 阶段 1-4 全部 G gate 签名齐全 + 签名链连续 | 拒绝编码，回退缺失阶段 |
| 阶段 8 的 G gate（终检） | 阶段 1-7 全部签名链完整 + 来源正确 | 拒绝终检，回退缺失阶段 |

## 6. 签名链篡改检测机制（sigHash 重算）

`sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`

R6 校验规则：对每条签名记录，用上述公式重算 sigHash，与记录中的 sigHash 比对；不一致即篡改。

## 7. 与反模式 #32 的对应关系

反模式 #32（签名链断裂）检测信号：`check-signature-chain.ts` R1-R10 任一失败。详见 [`anti-patterns.md`](./anti-patterns.md) #32。

## 8. 与归档完整性清单的协同

`signature-chain.jsonl` 须纳入归档完整性强制快照清单（SSoT §10B.2.1）。归档时由 `check-archive-integrity.ts` 校验存在性，由 `check-signature-chain.ts --stage=archive` 校验完整性。
