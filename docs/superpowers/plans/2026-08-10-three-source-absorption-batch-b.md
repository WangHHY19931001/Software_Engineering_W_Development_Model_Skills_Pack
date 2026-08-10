# 三源吸收批次 B（P1，40.1.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地三源吸收 P1 中吸收项 10 项：多评审分歧上缴人裁决、MCP 契约准则、R3 来源校验、MASS 三阶段、升级时效、修剪优先级、坏注释黑名单、类设计规则、对象/数据结构、级联，版本 40.0.0 → 40.1.0。

**Architecture:** 纯文档任务（10 项全部为 reference/.cursor 技能文档插入 + SSoT/CHANGELOG/版本级联），无脚本行为改动。沿用批次 A 的"精确插入文本 + 子代理驱动 + 两阶段评审"模式。

**Tech Stack:** Markdown（references/ 与 .cursor/skills/ 文档）、无 TS 脚本改动。

**设计文档（spec）:** `docs/superpowers/specs/2026-08-10-three-source-absorption-design.md` §3.2

**版本级联:** 40.0.0 → 40.1.0（package.json / skill-metadata.json / SKILL.md frontmatter / README / INSTALL / CONTRIBUTING / SSoT §版本号）

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `w-model-dev/references/subagent-persona-matrix.md` | 「多评审分歧上缴人裁决」节（agentic Ch7） |
| `.cursor/skills/mcp-builder/SKILL.md` | 「面向智能体的 API/工具契约准则」节（agentic Ch10） |
| `w-model-dev/references/verifier-spec.md` | R3 reliability 补「来源时效/权威性校验」检查项（agentic Ch14） |
| `w-model-dev/references/hill-climbing-guide.md` | 「MASS 三阶段方法论」节（agentic Ch17） |
| `w-model-dev/references/operational-recovery.md` | 「升级触发条件显式化」节（agentic Ch13） |
| `w-model-dev/references/context-management-guide.md` | 「上下文修剪优先级」节（agentic Ch16） |
| `w-model-dev/references/format-conventions.md` | 第 5 节扩展「坏注释黑名单」6 条（Clean-Code ch4） |
| `w-model-dev/references/quality-standards.md` + `phase-4-detailed-design.md` | 「类设计规则」节（Clean-Code ch10） |
| `.cursor/skills/chinese-code-review/SKILL.md` + `phase-4-detailed-design.md` | 「对象/数据结构 + 得墨忒耳律」条目（Clean-Code ch6） |
| `docs/skill-design-document_SSoT.md` | §3.4.40 增补 P1 小节 + §10A |
| `CHANGELOG.md` + 顶层级联 6 处 | 版本 40.1.0 |

---

### Task 1: subagent-persona-matrix.md 新增「多评审分歧上缴人裁决」节

**Files:**
- Modify: `w-model-dev/references/subagent-persona-matrix.md`

- [ ] **Step 1: 在「3. V-persona 选择矩阵」节的表后追加节**

定位「3. V-persona 选择矩阵」节末尾（评审场景表之后、`## 4. 分派数量约束` 之前），插入：

```markdown
### 多评审分歧上缴人裁决（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch7「辩论与共识」：多角度独立评审可降低单评审者偏见。分歧不自动共识，上缴人裁决。

- **触发**：高争议决策（评审间结论冲突 / 质量等级跨 A-B / 方案取舍重大）时，V-lead 分派 2+ V-persona **独立评审**（不共享中间状态）。
- **分歧纪要**：评审结论分歧时产出 `分歧纪要`（各 persona 结论 + 冲突点 + 各方依据），随 VerifierOutput 提交用户。
- **不自动共识**：禁止为消除分歧而强行折中/投票；分歧上缴用户裁决（CHECKPOINT 人裁决机制）。
- **与 R14-R17 的关系**：多评审属协作评审场景，交接/计划/角色匹配/增量价值四问仍须回答（verifier-spec R14-R17）。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/subagent-persona-matrix.md
git commit -m "feat(subagent-persona-matrix): add multi-review divergence escalation to human (agentic Ch7)"
```

### Task 2: mcp-builder 技能新增「面向智能体的 API/工具契约准则」节

**Files:**
- Modify: `.cursor/skills/mcp-builder/SKILL.md`

- [ ] **Step 1: 在「3. Tool 设计原则」节末尾（输出小节之后）追加**

```markdown
### 面向智能体的 API/工具契约准则（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch10：MCP 价值取决于底层 API 设计——面向智能体的 API 应加确定性过滤/排序、返回智能体可读格式、结构化错误，不能只包装遗留 API。

- **确定性优先**：结果须确定性排序/分页（AI 依赖稳定输出推断，随机顺序 = 幻觉来源）。
- **可解析格式**：数据返回 JSON/结构化文本；避免返回 PDF/图片等 AI 不可解析格式（需要时返回可解析摘要 + 原文路径）。
- **结构化错误**：错误返回含错误码 + 人类可读消息 + 建议动作（`isError: true` + 结构化 content），禁止吞错或返回模糊 "failed"。
- **描述写明何时用/何时不用**：每个工具描述说明适用场景 + 明确不适用的场景（防误调用）。
- **与 W 模型操作行为 #8 的关系**：确定性优先 = Structure Over Persuasion 的工具侧落地。
```

- [ ] **Step 2: Commit**

```bash
git add .cursor/skills/mcp-builder/SKILL.md
git commit -m "feat(mcp-builder): add agent-facing API/tool contract principles (agentic Ch10)"
```

### Task 3: verifier-spec.md R3 reliability 补「来源时效/权威性校验」

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`

- [ ] **Step 1: 在「3. 三维度验证」的 reliability 相关描述处追加检查项**

定位 §7（subCriteria 标准表）中 `Reliability` 或 `reliability` 相关条目处（约 L595 附近 `Security` 行之前），在可靠性维度标准中追加检查项：

```markdown
- **来源时效/权威性校验（第 40 轮三源吸收，agentic Ch14）**：评审中引用的依据/参考来源（规范文档、需求行、外部资料）须校验时效性与权威性——过期来源（如 2020 博客 vs 2025 政策）与冲突来源须显式标注；知识缺口（无来源支撑的断言）须记录为证据缺失。落点：R3 preventive review 的 reliability 维度检查项。
```

> 若 §7 的可靠性行是表格结构，追加为该行的子项或独立 bullet；以既有格式为准（先读取确认）。

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): add source freshness/authority check to reliability dimension (agentic Ch14)"
```

### Task 4: hill-climbing-guide.md 新增「MASS 三阶段方法论」节

**Files:**
- Modify: `w-model-dev/references/hill-climbing-guide.md`

- [ ] **Step 1: 在「侦察 vs 产出两阶段」节之后、`## HarnessImprovementReport Schema` 之前插入**

```markdown
## MASS 三阶段优化（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch17（Multi-Agent System Synergy 三阶段）：先块级优化单智能体提示 → 再拓扑优化 → 最后工作流级联合优化。

- **阶段 1：单智能体提示优化**——先修单个子代理的 prompt/模板（成本最低、收益最快），不先动协作结构。
- **阶段 2：拓扑优化**——单点优化后仍不足，再调整子代理拓扑（角色分工 / persona 选择 / 交接方式）。
- **阶段 3：工作流级联合优化**——最后才动整体流程（阶段顺序 / 门禁策略 / R3 维度组合）。
- **Loop 4 信号分类**：HarnessImprovementReport 的改进信号按上述三档标注 `optimizationLevel: 1|2|3`，人审时按档位排优先级（先 1 后 2 后 3）。
- **与「Loop 4 不自动改 harness」的关系**：本方法论只用于人审时对改进信号排序，不改变"人审后手动应用"的边界。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/hill-climbing-guide.md
git commit -m "feat(hill-climbing): add MASS three-stage optimization methodology (agentic Ch17)"
```

### Task 5: operational-recovery.md 新增「升级触发条件显式化」节

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`

- [ ] **Step 1: 在「HOTL 规则化授权」节之后插入**

```markdown
## 升级触发条件显式化（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch13「升级策略」：升级触发条件应显式化——什么情况升级、升级给谁、等待多久。

- **升级触发条件清单**：每次升级到人须显式声明三要素：
  1. **触发条件**：什么情况升级（超出授权规则 / 高危路径 / 预算超限 / 新依赖 / 评审争议）。
  2. **升级对象**：升级给谁（用户 / 主刀 / 指定评审人）。
  3. **等待时长与降级选项**：等多久（如 10 分钟 / 1 小时）；超时未响应时的降级选项（暂停等待 / 按最保守路径回退，禁止静默推进）。
- **与豁免 E1-E8 的关系**：E1-E8 管豁免审批流程结构；本节补升级时效与降级选项维度。
- **登记**：升级触发条件写入 run-log 的 `outcome=escalate` 条目 note，随留痕可审计。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "feat(operational-recovery): add explicit escalation trigger conditions (agentic Ch13)"
```

### Task 6: context-management-guide.md 新增「上下文修剪优先级」节

**Files:**
- Modify: `w-model-dev/references/context-management-guide.md`

- [ ] **Step 1: 在「输出结构模板库」节之前插入**

```markdown
## 上下文修剪优先级（第 40 轮三源吸收）

> 吸收自 Agentic Design Patterns ch16「上下文修剪」：战略性最小化 token、只保留最相关信息；修剪从"省上下文"升级为"保证据"。

- **保留**：决策证据（CHECKPOINT 确认记录）、门禁输出摘要（GATE_JSON / 退出码）、RTM/run-log 增量、未闭合问题清单。
- **丢弃**：中间推理草稿、已消费的输入原文（可经文件路径重取）、冗长报错栈（保留首行 + 定位信息）。
- **修剪优先级**：证据类 > 状态类 > 任务类 > 草稿类；上下文紧张时按此序压缩。
- **与约束 #6 的关系**：按需加载管"不加载无关"，本节管"已加载的如何修剪"——互补。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/context-management-guide.md
git commit -m "feat(context-management): add pruning priority rules (agentic Ch16)"
```

### Task 7: format-conventions.md 第 5 节扩展「坏注释黑名单」

**Files:**
- Modify: `w-model-dev/references/format-conventions.md`

- [ ] **Step 1: 在第 5 节「注释与提示词目的规范」末尾追加**

```markdown
### 坏注释黑名单（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch4：以下 6 类注释应删除或改写（对应 code-smells-checklist 组 C）。

| # | 坏注释类型 | 检测信号 | 处理 |
|---|---|---|---|
| 1 | 喃喃自语 | 无信息量、自我解释的废话注释 | 删除 |
| 2 | 冗余注释 | 复述代码本身（what） | 删除（重构让代码自解释） |
| 3 | 误导性注释 | 注释与代码现状不符/过期 | 删除或修正 |
| 4 | 日志式注释 | 逐条记录修改历史（应归版本控制） | 删除 |
| 5 | 注释掉的代码 | 被注释的代码块 | 删除（版本控制可恢复） |
| 6 | 循规式注释 | 为遵守格式而写的空泛 Javadoc/头注释 | 删除或补充实质内容 |
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/format-conventions.md
git commit -m "feat(format-conventions): add bad-comment blacklist (Clean-Code ch4)"
```

### Task 8: quality-standards.md + phase-4-detailed-design.md 补「类设计规则」

**Files:**
- Modify: `w-model-dev/references/quality-standards.md`
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1: quality-standards.md 补「类设计规则」小节**

在「函数与错误处理规范」小节之后插入：

```markdown
### 类设计规则（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch10：类按"职责数"而非行数度量。

- **类要小、单一职责（SRP）**：25 词描述测试——若无法用 25 词（禁 if/and/or/but）描述类的职责，类太大。
- **类名警报**：名称含 Processor / Manager / Super / Util 等模糊后缀 → 重新审视职责边界。
- **内聚性**：字段与方法的关联度；失去内聚就拆分。
- **OCP/DIP**：对扩展开放、对修改封闭；依赖抽象接口而非具体实现（构造注入 / 接口依赖）。
- **私有方法服务面窄 = 拆分信号**：某私有方法只被极少数方法使用 → 该职责应独立成类。
```

- [ ] **Step 2: phase-4-detailed-design.md 补引用**

在 phase-4-detailed-design.md 的「详细设计算法」节或「测试 seam 决策」附近追加引用（先读取确认合适位置）：

```markdown
## 类设计规则引用（第 40 轮三源吸收）

详细设计阶段的类划分须遵循 [quality-standards.md](quality-standards.md)「类设计规则」小节：25 词职责测试、SRP/OCP/DIP、类名警报、内聚性。类设计不满足时回改设计再进入编码。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/quality-standards.md w-model-dev/references/phase-4-detailed-design.md
git commit -m "feat: add class design rules to quality-standards and phase-4 (Clean-Code ch10)"
```

### Task 9: chinese-code-review + phase-4 补「对象/数据结构 + 得墨忒耳律」

**Files:**
- Modify: `.cursor/skills/chinese-code-review/SKILL.md`
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1: chinese-code-review 补对象/数据结构条目**

在「坏味道检查清单（第 40 轮三源吸收）」节末尾追加：

```markdown
### 对象/数据结构与得墨忒耳律（第 40 轮三源吸收）

> 吸收自《代码整洁之道》ch6：对象暴露行为、隐藏数据；数据结构暴露数据、无行为——二者反对称，混合结构是坏味道。

| # | 检查点 | 检测信号 | 分级 |
|---|---|---|---|
| 1 | 得墨忒耳律 | `a.getB().getC().doX()` 火车失事式长链 | 建议修改 |
| 2 | 数据抽象 | getter/setter 直接暴露内部字段（不=封装） | 建议修改 |
| 3 | 混合结构 | 半对象半数据（既暴露数据又藏行为） | 必须修复 |
| 4 | DTO 与 Active Record | 往 Active Record/实体塞业务规则 | 建议修改 |
```

- [ ] **Step 2: phase-4-detailed-design.md 补引用**

在 phase-4-detailed-design.md 追加（与 Task 8 Step 2 同位置风格）：

```markdown
## 对象/数据结构设计引用（第 40 轮三源吸收）

详细设计阶段的对象/数据结构划分须遵循 [chinese-code-review](../../.cursor/skills/chinese-code-review/SKILL.md)「对象/数据结构与得墨忒耳律」节：遵守得墨忒耳律、数据抽象、避免混合结构、DTO 不塞业务规则。
```

- [ ] **Step 3: Commit**

```bash
git add .cursor/skills/chinese-code-review/SKILL.md w-model-dev/references/phase-4-detailed-design.md
git commit -m "feat: add object/data-structure and law-of-demeter rules (Clean-Code ch6)"
```

### Task 10: SSoT 增补 P1 小节 + CHANGELOG + 版本 40.1.0 级联

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `CHANGELOG.md` / `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `README.md` / `docs/INSTALL.md` / `CONTRIBUTING.md`

- [ ] **Step 1: SSoT §3.4.40 增补 P1 小节**

在 SSoT §3.4.40 的 P1 行之后（P2 行之前）确认 P1 描述已含 10 项（批次 A 已写入）；如已含则补充「已落地」标注。再在 §10A 追溯表补第 40 轮 P1 行（若批次 A 只写了 P0 行）。

- [ ] **Step 2: 版本号 40.0.0 → 40.1.0（6 处）**

package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」 / INSTALL frontmatter 示例 / CONTRIBUTING tag 示例。历史文档（docs/superpowers/、CHANGELOG 历史条目）保留 40.0.0 不误改。

- [ ] **Step 3: CHANGELOG 顶部新增 [40.1.0]**

```markdown
## [40.1.0] - 2026-08-10

### Added
- 三源吸收 P1（10 项）：多评审分歧上缴人裁决（subagent-persona-matrix）、面向智能体的 API 契约准则（mcp-builder）、R3 来源时效/权威性校验（verifier-spec）、MASS 三阶段优化（hill-climbing-guide）、升级触发条件显式化（operational-recovery）、上下文修剪优先级（context-management-guide）、坏注释黑名单（format-conventions）、类设计规则（quality-standards + phase-4）、对象/数据结构与得墨忒耳律（chinese-code-review + phase-4）

### Changed
- 版本号 40.0.0 → 40.1.0（6 处同步）
```

- [ ] **Step 4: 验证**

```bash
npm run self-test            # 249/249 通过
npx vitest run               # 35 files / 530 tests 全过
npx tsc --noEmit             # 0 错误
npx tsx w-model-dev/scripts/check-docs-consistency.ts .  # exit 0 全部一致
bash .githooks/pre-push --force  # 14 项全通过
```

- [ ] **Step 5: Commit**

```bash
git add docs/skill-design-document_SSoT.md CHANGELOG.md package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md docs/INSTALL.md CONTRIBUTING.md
git commit -m "feat: P1 three-source absorption (40.1.0) — review divergence, MCP contract, MASS, escalation, pruning"
```

---

## 自审记录（Self-Review）

- **Spec 覆盖**：批次 B 10 项全部映射：spec §3.2 #1（Task 1）、#2（Task 2）、#3（Task 3）、#4（Task 4）、#5（Task 5）、#6（Task 6）、#7（Task 7）、#8（Task 8）、#9（Task 9）、#10（Task 10）。全覆盖。
- **占位符扫描**：所有插入内容给出完整 Markdown；无 TBD/TODO。
- **类型一致性**：无 TS 改动；文档插入均为独立节，无跨任务符号依赖。
- **已知风险**：Task 3 的 §7 表格结构以执行期读取为准（计划给出两种适配路径）；Task 8/9 在 phase-4 的插入位置以执行期读取为准。均为执行期适配非占位符。
