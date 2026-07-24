# 根因定位者方法论指南（Root Cause Locator Guide）

> **定位**：R 子代理的可执行方法论指南，与 `agent-personas.md` 平级。
> **权威定义**：见 [skill-design-document_SSoT.md](../../docs/skill-design-document_SSoT.md) §6.4 R 角色定义节。
> **关联 spec**：[2026-07-24-root-cause-locator-and-fixer-roles-design.md](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §3 + §9
> **与 agent-personas.md 的关系**：agent-personas.md 定义 V 子代理的评审角色视角；本文件定义 R 子代理的诊断方法论。两者互补，R 不调用 Persona，Persona 不调用 R。

---

## 1. 根因分析方法库（4 种方法，按场景选用）

### 方法 1：5-Why 追溯（默认方法）

**适用**：单一缺陷的纵向根因追溯。

```
现象（V/G 的 reworkHint）
  └─ Why 1: 为什么出现？→ <直接原因>
       └─ Why 2: 为什么出现直接原因？→ <深层原因>
            └─ Why 3: ...
                 └─ Why N: 直到触及 <根因>
```

**终止条件**：触及「流程缺失 / 规格遗漏 / 设计缺陷 / 上游产物缺陷」之一，或达到 5 层。

### 方法 2：鱼骨图分析（多因素缺陷）

**适用**：一个 reworkHint 涉及多因素。

**维度（适配 W 模型）**：
- **需求维度**：需求规格是否清晰/完整/无歧义？
- **设计维度**：设计是否覆盖需求/接口明确/状态机完整？
- **编码维度**：代码是否遵循设计/边界处理/错误路径覆盖？
- **测试维度**：测试是否覆盖该路径/用例正确？
- **流程维度**：阶段门是否跳过/ingestion 是否遗漏/TLA+ 是否建模？
- **工具维度**：门禁脚本是否漏检/Schema 是否缺失校验？

**产出**：每个维度的「是/否/部分」+ 证据 + 主因标记。

### 方法 3：缺陷链追溯（跨产物传播）

**适用**：缺陷在多个产物间传播。

```
需求规格 ──缺陷──► 系统设计 ──继承──► 详细设计 ──实现──► 代码 ──漏测──► 测试
   ↑                      ↑                    ↑              ↑            ↑
  根因                  传播                  传播           表现         未拦截
```

**产出**：缺陷链节点列表 + 每节点「引入/传播/表现/未拦截」标签 + 根因节点标记。

### 方法 4：上游回溯（跨阶段根因）

**适用**：R 在当前阶段产物中找不到根因，怀疑根因在上游阶段。

**约束**：R 仅标记 `upstreamDefect`，不修改上游产物。`upstreamDefect` 经 V 复审通过后，编排者可触发阶段回退（见 spec §6.5 场景 5）。

---

## 2. 方法选择规则

| reworkHint 特征 | 选用方法 |
|---|---|
| 单一明确缺陷（如 null 指针） | 5-Why |
| 多因素复合缺陷 | 鱼骨图 |
| 缺陷在多产物间传播 | 缺陷链追溯 |
| 当前阶段产物无明显缺陷但 V/G 不通过 | 上游回溯 |
| 复杂场景 | 组合（先鱼骨图定位维度，再 5-Why 纵向追溯） |

---

## 3. R 产出质量标准

1. **根因必须可证伪**：每条根因须附「若根因消除，现象是否消失」的可验证假设。
2. **禁止现象当根因**：「代码写错了」是现象不是根因；「需求规格未规定 null 处理，编码默认不检查」才是根因。
3. **fixRecommendation 必须针对根因**：禁止「建议修复代码」泛化建议；须指明「修改 `<文件>:<行>` 的 `<具体内容>`，因为 `<根因>`」。
4. **prevention 必须可执行**：禁止「加强评审」泛化建议；须指明「在 `<phase-N>` 的 `<检查项>` 中增加 `<具体检查>`」。
5. **upstreamDefect 必须附证据**：标记上游缺陷须引用上游产物的具体段落/行号/节点 ID。

---

## 4. 多人格多角度分析机制

> **本机制的本质是「多角度」，不是「并行」。** 并行只是性能优化，串行同样合法。详见 spec §9.2。

### 4.1 核心原则

在强制多角度场景（Critical/Required 缺陷的 R 定位、根因报告 V 复审、maxReworkRounds 最后一轮）下，R-lead / V-lead **必须**加载 N 个不同 persona，从 N 个不同视角产出 N 份 PartialReport 并聚合——**不论这 N 个 persona 是同时分派（并行）还是依次分派（串行）**。

### 4.2 分派方式选择

| 宿主 Agent 能力 | 分派方式 | 说明 |
|---|---|---|
| 支持并行子代理 | **并行分派**（推荐） | N 个 R-persona 同时执行，R-lead 收齐 N 份后聚合 |
| 仅支持串行子代理 | **串行分派**（合法等价） | R-lead 依次分派 N 个 R-persona，每个产出后收集，N 份齐后聚合 |
| 单会话无子代理 | **单 R-lead 多轮切换 persona**（降级） | R-lead 自身多轮加载不同 persona |

**关键约束（三种方式均强制）**：
1. N 份 PartialReport 必须独立产出
2. 聚合规则不变（见 spec §9.6）
3. PartialReport 归档不变（`.w-model/rootcause/partial/<reportId>/<personaSlice>.json`）
4. run-log 记录不变（每份 PartialReport 各记一条 `rootcause` 动作）

### 4.3 persona 选择矩阵

详见 [subagent-persona-matrix.md](subagent-persona-matrix.md)。

### 4.4 R-lead 聚合规则

1. **根因收敛**：≥⌈N×0.6⌉ 个 persona 收敛到同一根因 → 采纳
2. **分歧仲裁**：根因分散时，R-lead 须记录分歧 + 选择主根因 + 标注 minority 视角
3. **证据合并**：合并所有 persona 的 evidence，去重
4. **fixRecommendation 合并**：按根因收敛度排序
5. **upstreamDefect 仲裁**：任一 persona 标记则 R-lead 须复核
6. **reality-check 硬约束**：testing-reality-checker confidence < 0.5 → 最终 `passed=false`

---

## 5. 与 systematic-debugging 技能的关系

本方法论吸收 `systematic-debugging` 技能的 `root-cause-tracing.md` 原则，但适配 W 模型：
- systematic-debugging 面向「运行时 bug 调试」
- 本方法论面向「W 模型阶段产物缺陷诊断」
- 两者共享「根因优先于症状」「可证伪假设」「缺陷链追溯」原则

---

## 6. 分派模板

详见 [subagent-delegation.md](subagent-delegation.md)「R 子代理分派模板」节与「R-lead 子代理分派模板（多角度变体）」节。
