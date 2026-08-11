# 第 21 轮：流程完整性硬化设计 spec

> **版本**：v21.0.0
> **日期**：2026-07-29
> **触发**：第 20 轮端到端调测根因分析发现 5 类流程完整性违规（C1/C2/I1/I2/I3）
> **范围**：SSoT 文档 + Reference 文件 + 门禁脚本 全栈修正
> **执行顺序**：SSoT → Reference → 脚本 → 回归验证
> **状态**：spec 阶段（待用户审阅 → writing-plans → 执行）

---

## 1. 背景与根因

### 1.1 触发事件

第 20 轮 W 模型 8 阶段端到端调测（blog-system-demo，2026-07-28 归档）的 code review 根因分析发现 5 类流程完整性违规：

| 编号 | 级别 | 问题 | 根因主题 |
|---|---|---|---|
| C1 | Critical | 阶段 1-4 全部 CHECKPOINT 使用 "self-as-verifier 代签"，无真实用户确认 | self-as-verifier 模式合法性歧义（系统性根因） |
| C2 | Critical | TLA+ L1 使用 `--skip-tlc` 跳过 TLC 检查，违反硬约束 | 门禁脚本盲区（`--skip-tlc` 参数与反模式 #15 矛盾）+ 调测者简化行为 |
| I1 | Important | REQ 层级树仅 3 层，"4 层强制"条款不合理（项目规模差异大） | 硬约束设计缺陷（应自适应层级深度） |
| I2 | Important | 6 项强制文档未在归档留证 | 归档完整性缺口 |
| I3 | Important | 覆盖矩阵/冲突检测无证据，V 评审 evidence 空泛 | V 评审 evidence 无格式约束 + 门禁脚本执行证据未持久化 |

### 1.2 根因主题

1. **self-as-verifier 模式合法性歧义**：技能包 dogfooding 历史（第 5-20 轮）全部使用代签作为标准模式，与 🔴 CHECKPOINT 约定直接矛盾
2. **门禁脚本盲区**：脚本在关键校验点留有"合法跳过"通道（`--skip-tlc` / R3 接受代签）
3. **归档完整性缺口**：归档仅快照 7 份"关键指标"文件，事后无法审计 V 评审声明真实性
4. **调测者简化行为（#27）**：self-as-verifier 模式下无外部评审拦截简化行为

### 1.3 用户决策

| 决策点 | 用户选择 |
|---|---|
| C1 代签模式处置 | 全面禁止代签（含 dogfooding，历史轮次标注 'known violation'） |
| C2 `--skip-tlc` 处置 | 全面移除 `--skip-tlc` 参数 |
| I2/I3 归档完整性处置 | 两者都做（强制全量快照 + V 评审 evidence 强制引用） |
| I1 REQ 层级约束 | 层数不应该限制，改为自适应层级深度 |
| 修复方案 | 方案 C（SSoT + Reference + 脚本全栈修正） |
| 机制增强 | 链式签名 + G 校验签名链 + 产出来源正确性 + 消费者校验 |

---

## 2. 设计架构

### 2.1 三层改动架构

```
层 1：SSoT 文档（权威源）
  docs/skill-design-document_SSoT.md
    ├─ §7.7 graph.json schema：移除"4 层强制"，改为自适应层级深度
    ├─ §7.6 V 评审规范：evidence 字段强制引用具体产物字段
    ├─ §10.8 TLA+ 行为门禁：移除 --skip-tlc 合法性，声明所有 specs 强制 TLC
    ├─ §10B.2 参考实现：新增归档完整性清单条款
    ├─ §10C 成熟度阶梯：全面禁止代签，历史轮次标注 'known violation'
    ├─ §10B.4 缺陷表：登记本轮 5 项缺陷（D20-1~D20-5）
    ├─ §3.4 编排者-子代理边界：新增产出来源正确性条款
    ├─ §7.9 新增 SignatureChainEntry schema（含 inputProvenance）
    └─ §10.11 新增签名链门禁条款

层 2：Reference 文件（可执行细则）
  w-model-dev/references/
    ├─ anti-patterns.md：#8/#10/#15 强化；新增 #31（归档完整性缺失）/ #32（签名链断裂）
    ├─ phase-1-requirements.md：修正"4 层强制"为自适应层级深度
    ├─ definition-of-done.md：第六维度强化（代签视为 O4 命中）；新增第七维度（签名链完整性）
    ├─ verifier-spec.md：evidence 字段强制引用具体产物字段
    ├─ tla-plus-guide.md：移除 skip-tlc 相关条款
    └─ signature-chain-guide.md（新增）：签名链 + 产出来源正确性规则

层 3：门禁脚本（技术强制层）
  w-model-dev/scripts/
    ├─ check-tla-model.ts：移除 --skip-tlc 参数
    ├─ check-checkpoint.ts：R3 强化（强制用户确认，拒绝代签）
    ├─ check-requirement-graph.ts：移除 level=4 强制校验；新增 R11（level 正整数）
    ├─ check-verifier-output.ts：新增 evidence 格式校验
    ├─ check-archive-integrity.ts（新增）：归档完整性校验脚本
    ├─ check-signature-chain.ts（新增）：签名链 + 产出来源校验脚本
    ├─ signature-chain-logic.ts（新增）：纯逻辑层
    └─ __tests__/signature-chain-logic.test.ts（新增）：单测
```

### 2.2 执行顺序

1. **SSoT 文档层**（权威源先行）→ 9 个章节修改/新增
2. **Reference 文件层**（可执行细则同步）→ 5 个文件修改 + 1 个新增
3. **脚本层**（技术强制层收口）→ 4 个脚本修改 + 3 个新增
4. **回归验证**：tsc strict + self-test + vitest + 8 阶段端到端调测

### 2.3 依赖关系

- 层 1 是层 2/3 的权威源，必须先改
- 层 2 是层 3 的可执行细则，须与层 1 同步
- 层 3 实现层 1/2 的技术强制，须最后改以避免回归风险
- 新增反模式 #31/#32 须在层 1/2 同步登记，层 3 实现检测逻辑

---

## 3. SSoT 文档改动详述

### 3.1 §7.7 graph.json schema — 自适应层级深度

**现状**：phase-1-requirements.md 声明"4 层强制（domain → module → feature → acceptance），强制必填，无降级"

**改动**：
- 移除"4 层强制"硬约束
- 改为"自适应层级深度"条款：
  - 最小层级深度 = 2（domain → acceptance，适用极小项目）
  - 推荐层级深度 = 4（domain → module → feature → acceptance）
  - 最大层级深度 = 不限（复杂项目可扩展至 5+ 层）
  - 每个 REQ 节点须标注 level（正整数，从 1 开始单调递增），level 值不限定上限
  - 校验规则：level 单调性（子节点 level > 父节点 level）+ 根节点 level=1 + 叶节点须可追溯到验收级
  - 禁止行为 #7 修正：从"level 无法判定 → blocked 返回"改为"level 非正整数或非单调 → blocked 返回"

**影响扩散**：
- `check-requirement-graph.ts`：移除 level=4 强制校验（若存在），保留 level 单调性校验，新增 R11（level 正整数）
- `graph.schema.json`：level 字段从 `enum: [1,2,3,4]` 改为 `type: integer, minimum: 1`

### 3.2 §7.6 V 评审规范 — evidence 强制引用

**现状**：V 评审 evidence 字段允许空泛声明（如"C1-C10 全通过"）

**改动**：
- evidence 字段强制引用具体产物字段
- 新增 evidence 格式规范：
  - 每条 evidence 须含 `<文件路径>.<字段路径>=<值>` 格式
  - 合法示例：`coverage.json.matrices.stakeholder.coverage=100%`
  - 合法示例：`tla-manifest.json.specs[0].tlcChecked=true`
  - 非法示例：`C1-C10 全通过` / `质量良好` / `评审通过`
- 空泛声明视为 O3（Verifier Theater）命中，V 评审降级重做
- evidence 字段为空 → 评审失败

**影响扩散**：
- `verifier-spec.md` §6 summary 三要素要求同步强化
- `check-verifier-output.ts`：新增 evidence 格式校验（正则匹配 `<文件路径>.<字段路径>=<值>`）

### 3.3 §10.8 TLA+ 行为门禁 — 移除 --skip-tlc

**现状**：`check-tla-model.ts` 提供 `--skip-tlc` 参数，允许跳过 TLC 检查

**改动**：
- 移除 `--skip-tlc` 参数的合法性
- 声明所有 TLA+ specs（L1/L2/L3/L4+）均须通过 SANY 语法检查 + TLC 模型检查
- 反模式 #15 强化：移除"skip-tlc 例外"条款，任何场景不得跳过 TLC
- 新增豁免条款：若 TLC 因状态爆炸无法完成，须走规格拆解（而非 skip），拆解决策须记录在 `tla-manifest.json` 的 `splitDecision` 字段

**影响扩散**：
- `check-tla-model.ts`：移除 `--skip-tlc` 参数
- `tla-plus-guide.md`：移除 skip-tlc 相关条款
- `anti-patterns.md` #15：移除 skip-tlc 例外

### 3.4 §10B.2 参考实现 — 归档完整性清单

**现状**：归档仅快照 7 份"关键指标"文件，未覆盖各阶段强制产出文档

**改动**：
- 新增"归档完整性清单"条款：
  - 归档时必须快照各阶段所有强制产出文档
  - phase-1 强制快照：requirements.md / risk-assessment.md / uat-path-mapping.md / coverage.json / graph.json / tla-manifest.json / bdd-manifest.json
  - phase-2 强制快照：system-design.md / system-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json
  - phase-3 强制快照：outline-design.md / integration-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json
  - phase-4 强制快照：detailed-design.md / unit-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json
  - phase-5-8 强制快照：代码 / 测试报告 / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl
  - 全阶段强制快照：signature-chain.jsonl / verifier-output-*.json / gate-logs/
  - 缺失即归档失败（exitCode=1）
- 新增反模式 #31：归档完整性缺失

**影响扩散**：
- 新增 `scripts/check-archive-integrity.ts`：归档完整性校验脚本
- `anti-patterns.md`：新增 #31

### 3.5 §10C 成熟度阶梯 — 全面禁止代签

**现状**：技能包 dogfooding 历史（第 5-20 轮）全部使用代签作为标准模式

**改动**：
- §10C.3 L0~L3 放行矩阵：所有 CHECKPOINT 节点（含 L3 自动放行路径）均须真实用户确认
- 新增条款："self-as-verifier 代签全面禁止"
  - 任何场景（含技能包内部 dogfooding）均须真实用户确认
  - 历史轮次（第 5-20 轮）代签记录标注为 'known violation'
  - 编排者 O 不得代替用户在 🔴 CHECKPOINT 处签字放行
  - `acknowledgedDecisions` 须由用户陈述，O 不得代填（违反反模式 #10）
- §10C.4 L3 高风险路径定义修正：即使 L3 自动放行路径，CHECKPOINT 节点仍须真实用户确认（仅降低其他门禁的强制程度，不降低用户确认）

**影响扩散**：
- `check-checkpoint.ts` R3：强化为要求 checkpoint-log 含非 O 角色用户确认记录
- `definition-of-done.md` 第六维度：代签视为 O4（Comprehension Debt Spiral）命中
- `anti-patterns.md` #8/#10：强化代签检测信号

### 3.6 §10B.4 缺陷表 — 登记本轮 5 项缺陷

新增 5 项缺陷登记：

| 缺陷 ID | 描述 | 根因 | 修正 |
|---|---|---|---|
| D20-1 | 阶段 1-4 全部 CHECKPOINT 代签 | self-as-verifier 模式滥用 | §10C 全面禁止代签 + check-checkpoint.ts R3 强化 + 签名链 R5 代签检测 |
| D20-2 | TLA+ L1 skip-tlc 违反硬约束 | `--skip-tlc` 参数与 #15 矛盾 | §10.8 移除 `--skip-tlc` + check-tla-model.ts 移除参数 |
| D20-3 | REQ 层级仅 3 层（应自适应） | "4 层强制"条款不合理 | §7.7 改为自适应层级深度 |
| D20-4 | 6 项强制文档未留证 | 归档完整性缺口 | §10B.2 归档完整性清单 + check-archive-integrity.ts |
| D20-5 | 覆盖矩阵/冲突检测无证据 | V 评审 evidence 空泛 | §7.6 evidence 强制引用 + check-verifier-output.ts 格式校验 |

### 3.7 §3.4 编排者-子代理边界 — 产出来源正确性

**改动**：新增条款
> 各角色产出须含 `inputProvenance` 来源证明；后续阶段消费者须校验前一阶段产出来源正确性；来源缺失或来源错误即拒绝消费，回退前一阶段。

### 3.8 §7.9 新增 SignatureChainEntry schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://w-model-dev/schemas/signature-chain.schema.json",
  "title": "SignatureChainEntry",
  "type": "object",
  "additionalProperties": false,
  "required": ["sigId", "phase", "role", "action", "runId", "artifacts", "prevSigId", "prevSigHash", "sigHash", "signedAt", "signer", "inputProvenance"],
  "properties": {
    "sigId": {"type": "string", "pattern": "^wm\\d+-r\\d+-[OSAVGR]$"},
    "phase": {"type": "integer", "minimum": 1, "maximum": 8},
    "phaseName": {"type": "string"},
    "role": {"type": "string", "enum": ["O", "S", "A", "V", "G", "R"]},
    "action": {"type": "string"},
    "runId": {"type": "string"},
    "artifacts": {"type": "array", "items": {"type": "string"}},
    "prevSigId": {"type": "string"},
    "prevSigHash": {"type": "string", "pattern": "^sha256:[0-9a-f]{64}$|^0$"},
    "sigHash": {"type": "string", "pattern": "^sha256:[0-9a-f]{64}$"},
    "signedAt": {"type": "string", "format": "date-time"},
    "signer": {"type": "string"},
    "gateExitCode": {"type": "integer"},
    "gateLogPath": {"type": "string"},
    "inputProvenance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sourceSigIds", "sourceArtifacts", "transformDescription"],
      "properties": {
        "sourceSigIds": {"type": "array", "items": {"type": "string"}},
        "sourceArtifacts": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["path", "sourceSigId", "sourceRole"],
            "properties": {
              "path": {"type": "string"},
              "sourceSigId": {"type": "string"},
              "sourceRole": {"type": "string", "enum": ["O", "S", "A", "V", "G", "R"]}
            }
          }
        },
        "transformDescription": {"type": "string"}
      }
    }
  }
}
```

### 3.9 §10.11 新增签名链门禁条款

- 强制约束：每阶段每角色动作完成后须写入 `signature-chain.jsonl`
- G 角色职责扩展：跑 gate 脚本前先校验签名链完整性（R1-R10）
- O 角色职责扩展：checkpoint 前校验签名链 + 用户确认签名
- 归档完整性清单新增：`signature-chain.jsonl` 须快照
- 签名链断裂即降级回 L0

---

## 4. 角色链式签名 + G 校验机制

### 4.1 签名链数据结构

每阶段每角色完成动作后产出签名记录，写入 `signature-chain.jsonl`（schema 见 §3.8）。

**链式约束**：
- `prevSigId` 指向同阶段前一环签名（形成链）
- `sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`
- 首环 `prevSigId = "genesis"`，`prevSigHash = "0"`（阶段起点）
- 末环（G 签名）的 `sigHash` 作为该阶段签名链根 hash，写入 run-log checkpoint 条目

### 4.2 阶段角色签名顺序（强制链）

```
阶段 1 签名链：
genesis → O(chunk) → A(cross) → S(produce) → V(review) → G(graph-gate) → G(tla-gate) → G(bdd-gate) → G(coverage-gate) → O(checkpoint-用户确认)

阶段 2-4 签名链：
genesis → O(chunk) → A(cross) → S(produce) → V(review) → G(graph-gate) → G(tla-gate) → G(bdd-gate) → O(checkpoint-用户确认)

阶段 5 签名链：
genesis → O(chunk) → S(produce) → V(review-code) → G(check-code-tla-consistency) → G(check-artifact-gate --phase=5) → O(checkpoint-用户确认)

阶段 6-7 签名链：
genesis → O(chunk) → S(produce) → V(review) → G(check-artifact-gate --phase=N) → O(checkpoint-用户确认)

阶段 8 签名链：
genesis → O(chunk) → S(produce) → V(review-acceptance) → G(check-artifact-gate --phase=8) → G(check-archive-integrity) → O(checkpoint-用户确认)
```

**关键约束**：
- 每个角色签名须在前一环签名之后才能产出（时间戳单调递增）
- 跳过任一角色即链断裂（如 O 直接 checkpoint 但无 S/V/G 签名）
- O checkpoint 签名须包含用户确认标记（`signer` 字段须为用户 ID，非 O 角色）

### 4.3 各角色来源正确性规则

| 角色 | 动作 | 强制来源（sourceArtifacts 须包含） | 禁止来源 |
|---|---|---|---|
| **O** | chunk | 无（阶段起点） | — |
| **A** | cross/evolve | 上一环 O chunk 签名 + chunk 产物 | S/V/G/R 产物 |
| **S** | produce | A cross 签名 + A 产物 | V/G/R 产物 |
| **R** | locate | V/G 失败信号 + 失败产物 | S 产物（R 须独立定位） |
| **V** | review | S produce 签名 + S 产物 | G/R 产物（V 保持独立性） |
| **G** | gate | V review 签名 + V 产物 | S 产物（G 须通过 V 评审） |
| **O** | checkpoint | G gate 签名 + G 产物（GATE_JSON）+ 用户确认记录 | S/A 产物 |

### 4.4 G 角色校验签名链（新增 G 职责）

G 角色在跑门禁脚本前，**先调用 `check-signature-chain.ts` 校验签名链完整性 + 产出来源正确性**：

| 校验规则 | 校验内容 | 失败后果 |
|---|---|---|
| R1 | 当前阶段所有强制角色签名齐全 | 门禁失败（exitCode=1），标注缺失角色 |
| R2 | 签名链连续（prevSigHash 匹配） | 门禁失败，标注断裂点 |
| R3 | 时间戳单调递增 | 门禁失败，标注时序异常 |
| R4 | 签名角色与阶段角色清单匹配 | 门禁失败，标注越权角色 |
| R5 | O checkpoint 签名 signer 为用户 ID | 门禁失败，标注代签（O4 命中） |
| R6 | sigHash 重算一致（防篡改） | 门禁失败，标注篡改签名 |
| R7 | 各角色 sourceSigIds 均存在于签名链中 | 门禁失败，标注悬空来源 |
| R8 | 各角色 sourceArtifacts 路径存在于磁盘 | 门禁失败，标注缺失产物 |
| R9 | 各角色来源符合"强制来源/禁止来源"矩阵 | 门禁失败，标注越权消费 |
| R10 | O checkpoint 的 sourceArtifacts 含 G gate 产物 + 用户确认记录 | 门禁失败，标注绕过门禁 |

**校验时机**：
- G 跑每个 gate 脚本前：`check-signature-chain.ts --phase=N --stage=pre-gate`（R1-R10 全通过）
- O 在 checkpoint 前：`check-signature-chain.ts --phase=N --stage=pre-checkpoint`（R1-R10 + R5 用户确认）
- 归档时：`check-signature-chain.ts --phase=all --stage=archive`（全阶段链完整性 + 来源正确性）

### 4.5 跨阶段消费者校验

后续阶段消费者须校验前一阶段产出来源正确性：

| 消费者 | 校验内容 | 失败后果 |
|---|---|---|
| 阶段 N+1 的 O chunk | 阶段 N 的 G gate 签名存在 + O checkpoint 签名 signer 为用户 ID | 拒绝启动阶段 N+1，回退阶段 N |
| 阶段 N+1 的 S produce | 阶段 N 的 S produce 签名 + V review 签名 + G gate 签名齐全 | 拒绝产出，回退阶段 N |
| 阶段 5 的 S produce（编码） | 阶段 1-4 全部 G gate 签名齐全 + 签名链连续 | 拒绝编码，回退缺失阶段 |
| 阶段 8 的 G gate（终检） | 阶段 1-7 全部签名链完整 + 来源正确 | 拒绝终检，回退缺失阶段 |

### 4.6 与反模式协同

| 反模式 | 来源正确性守护 |
|---|---|
| #10（O 越权实施） | R9 校验 O 的 `sourceArtifacts` 不得含 S 产物 |
| #18（跳过 R 直接 S 返工） | R9 校验 S-fix 的 `sourceArtifacts` 须含 R 报告 |
| #19（R 报告未 V 复审） | R9 校验 S-fix 的 `sourceArtifacts` 须含 V 复审签名 |
| #8（越过 CHECKPOINT） | R10 校验 O checkpoint 的 `sourceArtifacts` 须含 G gate 产物 + 用户确认 |
| #4（评审未通过悄悄小修） | R9 校验 V review 的 `sourceArtifacts` 须含 S produce 签名 |

---

## 5. Reference 文件改动详述

### 5.1 anti-patterns.md

**新增 #31 归档完整性缺失**：
- 危害：归档未包含强制产出文档，事后无法审计 V 评审声明真实性，审计链断裂
- 检测信号：`check-archive-integrity.ts` 退出码 1（缺失任一阶段强制快照清单文件）
- 回退动作：回到归档前状态，补齐缺失文件后重跑 `check-archive-integrity.ts`

**新增 #32 签名链断裂**：
- 危害：跳过角色 / 签名链不连续 / 篡改签名 / 代签 checkpoint / 来源缺失 / 来源越权，流程完整性失守
- 检测信号：`check-signature-chain.ts` R1-R10 任一失败
- 回退动作：回到当前阶段起点，补齐缺失角色签名 / 来源证明，重跑签名链校验

**强化 #8 越过 CHECKPOINT**：
- 检测信号新增：`signature-chain.jsonl` 中 O checkpoint 签名 `signer` 为 O 角色 ID（代签检测）
- 回退动作新增：清空 O 代签的 `acknowledgedDecisions`，要求用户重新陈述决策

**强化 #10 编排者越权实施**：
- 检测信号新增：`signature-chain.jsonl` 中 O 角色 `action=produce/review/gate`（O 越权承担 S/V/G 职责）
- 回退动作新增：作废 O 越权签名，重新分派对应角色子代理

**强化 #15 TLA+ 死锁/状态爆炸/不变式违反放行**：
- 移除"skip-tlc 例外"条款
- 检测信号新增：`signature-chain.jsonl` 中 G 签名 `action=gate` 但 `gateExitCode` 字段缺失（skip-tlc 无 GATE_JSON）
- 回退动作新增：回到当前阶段起点，跑完整 TLC 检查

**反模式清单总数**：30 条 → 32 条（#31 + #32 新增）

### 5.2 phase-1-requirements.md

**§维度1 层级树条款修正**：

原文：
> 构建需求层级树【维度1】（4 层：domain → module → feature → acceptance）…每个 REQ 节点须标注 level（1-4，强制必填，无降级）

改为：
> 构建需求层级树【维度1】（自适应层级深度）…每个 REQ 节点须标注 level（正整数，从 1 开始单调递增，无上限）
> - 最小层级深度 = 2（domain → acceptance，适用极小项目）
> - 推荐层级深度 = 4（domain → module → feature → acceptance）
> - 最大层级深度 = 不限（复杂项目可扩展至 5+ 层）
> - 校验规则：level 单调性（子节点 level > 父节点 level）+ 根节点 level=1 + 叶节点须可追溯到验收级

**禁止行为 #7 修正**：

原文：
> REQ 节点不标注 level（1-4）…level 无法判定 → blocked 返回，禁止降级为缺省值

改为：
> REQ 节点不标注 level（正整数）…level 非正整数或非单调 → blocked 返回，禁止降级为缺省值

**算法步骤 2 成功条件修正**：

原文：
> 成功: 产出 4 层层级树（含 level/priority/reqGroup 字段）

改为：
> 成功: 产出自适应层级树（含 level/priority/reqGroup 字段，level 单调性校验通过）

### 5.3 definition-of-done.md

**第六维度「理解证据」强化**：

原文：
> 放行前须填 `acknowledgedDecisions` ≥1 关键决策；空确认视为 O4 命中

改为：
> 放行前须填 `acknowledgedDecisions` ≥1 关键决策；空确认视为 O4 命中；**self-as-verifier 代签视为 O4 命中**（`signature-chain.jsonl` 中 O checkpoint 签名 `signer` 为 O 角色 ID 即代签）

**新增第七维度「签名链完整性」**：
> 每阶段每角色动作完成后须写入 `signature-chain.jsonl`；G 角色跑门禁脚本前须校验签名链完整性（R1-R10 全通过）；签名链断裂视为 #32 命中，拒绝放行

### 5.4 verifier-spec.md

**§6 summary 三要素要求强化**：

新增 evidence 格式规范节：
> evidence 字段每条须含 `<文件路径>.<字段路径>=<值>` 格式
> - 合法示例：`coverage.json.matrices.stakeholder.coverage=100%`
> - 非法示例：`C1-C10 全通过` / `质量良好` / `评审通过`
> - 空泛声明视为 O3（Verifier Theater）命中，V 评审降级重做

**§7.1 completeness 四维核验强化**：
- 豁免审批缺失 → completeness 判 0 分（已有）
- **新增：归档完整性缺失 → completeness 判 0 分**
- **新增：签名链断裂 → completeness 判 0 分**

### 5.5 tla-plus-guide.md

**「校验脚本」节修正**：

移除所有 `--skip-tlc` 相关条款
新增条款：
> 所有 TLA+ specs（L1/L2/L3/L4+）均须通过 SANY 语法检查 + TLC 模型检查
> - 不得使用 `--skip-tlc` 跳过 TLC（参数已移除）
> - 若 TLC 因状态爆炸无法完成，须走规格拆解（而非 skip）
> - 拆解决策须记录在 `tla-manifest.json` 的 `splitDecision` 字段

**「合规性约束」节强化**：
- 新增：G 签名须附带 `check-tla-model.ts` 退出码 + GATE_JSON，skip-tlc 无 GATE_JSON 即签名链断裂

### 5.6 新增 references/signature-chain-guide.md

**内容结构**：
1. 签名链数据结构（SignatureChainEntry schema，含 inputProvenance）
2. 阶段角色签名顺序（8 阶段签名链清单）
3. 各角色来源正确性规则（强制来源/禁止来源矩阵）
4. G 角色校验职责（R1-R10 校验规则）
5. O 角色 checkpoint 签名约束（signer 须为用户 ID）
6. 跨阶段消费者校验规则
7. 签名链篡改检测机制（sigHash 重算）
8. 与反模式 #32 的对应关系
9. 与归档完整性清单的协同（signature-chain.jsonl 纳入强制快照）

---

## 6. 脚本改动详述

### 6.1 check-tla-model.ts — 移除 --skip-tlc 参数

**改动点**：
- 移除 `--skip-tlc` CLI 参数解析
- 移除 `skipTlc` 相关逻辑分支（步骤 7 跳过逻辑）
- 强制所有 specs 跑 SANY + TLC 双重检查
- 新增 `splitDecision` 字段校验（若 TLC 状态爆炸，须记录拆解决策，不得 skip）

**调用方式变化**：
```bash
# 改动前
npx tsx w-model-dev/scripts/check-tla-model.ts <project-dir> [--skip-tlc]

# 改动后
npx tsx w-model-dev/scripts/check-tla-model.ts <project-dir>
```

**退出码不变**：0=通过 / 1=校验失败 / 2=输入错误

### 6.2 check-checkpoint.ts — R3 强化

**改动点**：
- R3 校验从"接受 self-as-verifier 代签"改为"要求 checkpoint-log 含非 O 角色用户确认记录"
- 新增 R3 校验逻辑：
  - `--checkpoint-log=<dir>` 参数变为强制（原为可选）
  - checkpoint-log 目录须存在
  - 目录下 phase-N 文件须存在（N 为当前阶段）
  - 文件内容须含用户身份标记（非 O 角色）
- 未提供 `--checkpoint-log` 或无 phase-N 文件 → R3 失败（exitCode=1）
- 文件内容为 O 角色签名 → R3 失败（代签检测，O4 命中）

**调用方式变化**：
```bash
# 改动前
npx tsx w-model-dev/scripts/check-checkpoint.ts <run-log.jsonl> [--checkpoint-log=<dir>]

# 改动后（--checkpoint-log 变为强制）
npx tsx w-model-dev/scripts/check-checkpoint.ts <run-log.jsonl> --checkpoint-log=<dir>
```

### 6.3 check-requirement-graph.ts — 移除 level=4 强制校验

**改动点**：
- 移除 R7 校验中"level=4 节点存在性"检查（若存在）
- 保留 level 单调性校验（子节点 level > 父节点 level）
- 保留根节点 level=1 校验
- 保留叶节点须可追溯到验收级校验

**新增 R11 校验**：level 字段为正整数（防 0 / 负数 / 非整数）

### 6.4 check-verifier-output.ts — evidence 格式校验

**改动点**：
- 新增 evidence 格式校验逻辑：
  - 每条 evidence 须匹配正则 `^[\w/.-]+\.[\w-]+(?:\.[\w-\[\]]+)*=.+$`
  - 示例合法：`coverage.json.matrices.stakeholder.coverage=100%`
  - 示例非法：`C1-C10 全通过` / `质量良好`
- evidence 空泛声明 → 评审降级（qualityLevel 降一级）
- evidence 字段为空 → 评审失败（exitCode=1）

### 6.5 新增 check-archive-integrity.ts

**职责**：归档完整性校验

**调用方式**：
```bash
npx tsx w-model-dev/scripts/check-archive-integrity.ts <archive-dir>
```

**校验清单**（按阶段）：

| 阶段 | 强制快照文件 |
|---|---|
| 1 | requirements.md / risk-assessment.md / uat-path-mapping.md / coverage.json / graph.json / tla-manifest.json / bdd-manifest.json |
| 2 | system-design.md / system-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json |
| 3 | outline-design.md / integration-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json |
| 4 | detailed-design.md / unit-test-design.md / graph.json / tla-manifest.json / bdd-manifest.json |
| 5 | src/ / unit-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 6 | integration-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 7 | system-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 8 | acceptance-test-report.json / rtm.json / run-log.jsonl / checkpoint-log.jsonl / signature-chain.jsonl |
| 全阶段 | signature-chain.jsonl / verifier-output-*.json / gate-logs/ |

**退出码**：0=通过 / 1=完整性缺失（列出缺失文件） / 2=输入错误

### 6.6 新增 check-signature-chain.ts + signature-chain-logic.ts

**职责**：签名链完整性 + 产出来源正确性校验

**调用方式**：
```bash
npx tsx w-model-dev/scripts/check-signature-chain.ts <signature-chain.jsonl> [--phase=N] [--stage=pre-gate|pre-checkpoint|archive]
```

**校验规则**：R1-R10（见 §4.4）+ 跨阶段消费者校验（见 §4.5）

**退出码**：0=通过 / 1=校验失败（列出违反规则） / 2=输入错误

### 6.7 signature-chain.schema.json

新增 schema 文件（见 §3.8）。

### 6.8 signature-chain-logic.test.ts

新增单测文件，测试用例：

| 测试类别 | 测试用例 |
|---|---|
| R1 角色齐全 | valid-all-roles.jsonl / bad-missing-V.jsonl / bad-missing-G.jsonl |
| R2 链连续 | valid-chain.jsonl / bad-broken-chain.jsonl |
| R3 时序 | valid-monotonic.jsonl / bad-backdated.jsonl |
| R4 角色匹配 | valid-roles.jsonl / bad-O-produce.jsonl |
| R5 代签检测 | valid-user-checkpoint.jsonl / bad-O-self-sign.jsonl |
| R6 防篡改 | valid-hash.jsonl / bad-tampered-hash.jsonl |
| R7 悬空来源 | valid-provenance.jsonl / bad-dangling-source.jsonl |
| R8 缺失产物 | valid-artifacts-exist.jsonl / bad-missing-artifact.jsonl |
| R9 越权消费 | valid-S-consumes-A.jsonl / bad-S-consumes-G.jsonl / bad-R-consumes-S.jsonl |
| R10 绕过门禁 | valid-O-consumes-G.jsonl / bad-O-bypass-G.jsonl |
| 跨阶段 | valid-cross-phase.jsonl / bad-missing-prior-phase.jsonl |

### 6.9 samples/ 新增样本

- `samples/signature-chain/valid-*.jsonl`（对应测试用例）
- `samples/signature-chain/bad-*.jsonl`（对应测试用例）

### 6.10 schemas/graph.schema.json — level 字段修正

**改动点**：
- level 字段从 `enum: [1,2,3,4]` 改为 `type: integer, minimum: 1`
- 移除最大值限制

### 6.11 现有 __tests__/ 测试基线更新

- `tla-logic.test.ts`：移除 skip-tlc 相关测试用例
- `graph-logic.test.ts`：移除 level=4 强制校验测试用例
- `checkpoint-logic.test.ts`：新增 R3 强制用户确认测试用例
- `verifier-output.test.ts`（如有）：新增 evidence 格式校验测试用例

---

## 7. 回归验证计划

| 验证项 | 命令 | 预期结果 |
|---|---|---|
| TypeScript 编译 | `npx tsc --noEmit --strict` | 0 错误 |
| Self-test | `npm run self-test` | 通过（基线 149 → 预计 170+，新增签名链 + 归档完整性测试） |
| Vitest | `npx vitest run` | 通过（基线 165 → 预计 185+，新增签名链 + 归档完整性测试） |
| 8 阶段端到端调测 | 跑一轮 demo | 签名链 + 来源正确性 + 归档完整性 + 真实用户确认 + 全 specs TLC 通过 |

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| 签名链机制增加流程复杂度，可能被调测者视为负担而简化 | #32 反模式检测 + G 强制校验 + 归档完整性强制 |
| 全面禁止代签可能拖慢 dogfooding 速度 | dogfooding 可使用 L3 自动放行（仅 CHECKPOINT 仍须用户确认） |
| 移除 --skip-tlc 可能导致 TLC 状态爆炸无法完成 | 新增 `splitDecision` 字段，走规格拆解而非 skip |
| 归档全量快照可能增加存储负担 | 归档是 git 提交，增量存储；完整性优先于存储优化 |
| evidence 格式校验可能过严导致 V 评审频繁降级 | 正则允许灵活格式，仅拦截明显空泛声明 |

---

## 9. 版本与归档

- **版本号**：v21.0.0
- **CHANGELOG.md**：新增 [21.0.0] 节
- **归档目录**：`docs/changes/archive/2026-07-29-round21-process-integrity-hardening/`
- **归档强制文件**：按 §3.4 归档完整性清单执行（含 signature-chain.jsonl）

---

## 10. 不在范围内（Out of Scope）

- 历史轮次（第 5-20 轮）归档的 retroactive 审计（仅标注 'known violation'，不回填修复）
- Loop 4 爬坡循环的签名链信号检测（留待 Loop 4 增强）
- SkillOpt/darwin-skill 的签名链消费（外部工具，不在本仓库）
- 签名链的加密签名（当前用 sha256 hash 防篡改，不引入 PKI）

---

## 附录 A：与 project_memory.md 硬约束的对应

| project_memory 硬约束 | 本 spec 对应改动 |
|---|---|
| TLA+ models must pass TLC check | §3.3 移除 --skip-tlc + §6.1 脚本移除参数 |
| TLA+ files must not contain placeholder implementations | §3.3 新增 splitDecision 字段（状态爆炸走拆解而非 skip） |
| All gate scripts must have exitCode consistent with JSON 'passed' field | §6.6 check-signature-chain.ts 遵循同一约束 |
| Verifier rawScores must not be identical | §3.2 evidence 强制引用（间接强化 rawScores 真实性） |

## 附录 B：反模式清单变更

| 编号 | 名称 | 状态 | 守护机制 |
|---|---|---|---|
| #8 | 越过 CHECKPOINT | 强化（代签检测信号） | check-signature-chain.ts R5 + check-checkpoint.ts R3 |
| #10 | 编排者越权实施 | 强化（签名链越权检测信号） | check-signature-chain.ts R4/R9 |
| #15 | TLA+ 死锁/违反放行 | 强化（移除 skip-tlc 例外） | check-tla-model.ts 移除 --skip-tlc |
| #31 | 归档完整性缺失（新增） | 新增 | check-archive-integrity.ts |
| #32 | 签名链断裂（新增） | 新增 | check-signature-chain.ts R1-R10 |
