# 采用指南：新项目 vs 既有代码库

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `docs/adoption-guide.md`。
> SSoT [§11A](./skill-design-document_SSoT.md) 为权威定义，本文件为人类可读的采用指南，不参与门禁判定。
>
> 如何推广 W 模型技能包很大程度上取决于代码库所处阶段。绿地项目可从首次提交就采用完整生命周期；数年历史的代码库则需要一条增量路径，尊重既有代码、约定、未文档化的决策，以及你宁愿不去盲改的测试覆盖缺口。
>
> 本指南覆盖两条路径。安装机制见 [`INSTALL.md`](./INSTALL.md)；技能功能见 [`../w-model-dev/SKILL.md`](../w-model-dev/SKILL.md)。

## 你在哪条路径上？

| 信号 | Greenfield（绿地） | Brownfield（棕地） |
|---|---|---|
| 代码库年龄 | 数天至数周 | 数月至数年 |
| 测试覆盖率 | Day 0 可控 | 不均匀，部分区域无测试 |
| 约定 | 随开发定义 | 已存在，常未文档化 |
| 团队习惯 | 形成中 | 已固化（好坏皆然） |
| Agent 错误改动风险 | 影响面小 | 可能破坏无人记得如何修复的部分 |
| **采用策略** | **Day 0 全流程启用** | **增量、验证优先** |

> 处于两者之间（年轻项目但已上线）→ 按棕地路径起步并加速，最终收敛到同一稳态。

---

## 路径 A | Greenfield：Day 0 全流程

新项目是最佳场景：无遗留行为需保留，质量门成本几乎为零且从首次提交开始复利。

### Day 0 | 安装与初始化

1. 按 [`INSTALL.md`](./INSTALL.md) 安装 `w-model-dev/` 到目标 Agent 的 skills 目录（Trae / Claude Code / Cursor / Codex 等）。
2. 首次启用执行 `/wm analyze`，触发 SSoT [§4A.1](./skill-design-document_SSoT.md)「显式声明假设」：列出对需求 / 技术栈 / 范围的假设，等用户确认。
3. 创建 `.w-model/` 持久化目录，初始化 `project.json` / `rtm.json`。
4. 在仓库根 `AGENTS.md`（或 `CLAUDE.md`）写入项目规则：技术栈、构建 / 测试命令、目录含义、已知雷区。

### Day 0 | 按顺序跑完整 W 模型 8 阶段

```
/wm analyze           →  需求规格 + 验收测试设计       (阶段 1)
/wm design type=架构   →  系统设计 + 系统测试设计       (阶段 2)
/wm design type=概要   →  概要设计 + 集成测试设计       (阶段 3)
/wm design type=详细   →  详细设计 + 单元测试设计       (阶段 4)
/wm code              →  代码 + 单元测试执行            (阶段 5)
/wm test type=集成     →  集成测试                       (阶段 6)
/wm test type=系统     →  系统测试 + 性能 + 安全         (阶段 7)
/wm test type=验收     →  验收测试 + 工件质量门          (阶段 8)
```

每个阶段门评审由外部 Agent 按 SSoT [§7.6](./skill-design-document_SSoT.md) + [§6.4](./skill-design-document_SSoT.md) 执行；每个 🔴 CHECKPOINT 必须等用户确认（不可绕过）。

### 从 Day 0 起视为常开

- **测试设计前置**（SSoT 约束 1）：阶段 1–4 的开发产物完成后立即产出对应测试设计。
- **RTM 维护**（SSoT 约束 3）：每次产物变更同步更新 `.w-model/rtm.json`。
- **真实执行**（SSoT 约束 4）：不得估算覆盖率或测试结果，必须执行真实测试 / 脚本并回填。
- **如实状态**（SSoT 约束 7）：未完成、未评审或未确认的阶段不得标为完成。

### 项目成长后追加

| 触发条件 | 追加动作 |
|---|---|
| 首个对外 API 或模块边界 | 调用 [`code-reviewer`](../w-model-dev/references/agent-personas.md) Persona 评审接口设计 |
| 首次涉及认证 / 加密 / 输入校验 | 调用 [`security-auditor`](../w-model-dev/references/agent-personas.md) Persona 深审 |
| 首次涉及性能热点循环 / DB 查询 | 调用 [`performance-auditor`](../w-model-dev/references/agent-personas.md) Persona + 准备 k6 基线脚本 |
| 首次 CI 流水线 | 在 CI 中调用 [`check-artifact-gate.ts`](../w-model-dev/scripts/check-artifact-gate.ts) 作为质量门 |
| 首次部署到生产 | 执行 SSoT [§10.5](./skill-design-document_SSoT.md) 工件质量门 + 用户确认归档 |

### Greenfield 反模式

- **跳过 `/wm analyze` 因为「只是个原型」**：原型会变成产品。需求规格是此代码库最便宜的产物，跳过它就是为后续所有阶段埋下假设地雷。
- **一次性加载全部 `references/`**：违反 SSoT 约束 6「按需加载」，污染上下文，使 Agent 失去阶段聚焦。按阶段加载，由 [`SKILL.md`](../w-model-dev/SKILL.md) 路由。
- **推迟性能基线到「有东西可测」**：阶段 7 系统测试前必须准备 k6 脚本，否则违反 SSoT [§10.5](./skill-design-document_SSoT.md) 工件质量门「性能指标达标」要求。
- **跳过 🔴 CHECKPOINT 因为「自己心里有数」**：违反 SSoT 约束 2 + 8，命中 [`anti-patterns.md`](../w-model-dev/references/anti-patterns.md) #8。
- **估算覆盖率放行**：违反 SSoT 约束 4，命中 [`anti-patterns.md`](../w-model-dev/references/anti-patterns.md) #3 / #6。

---

## 路径 B | Brownfield：增量、验证优先

棕地代码库的风险剖面反转：危险不是「建错东西」，而是「改了无人完整定义过的东西」。因此采用顺序从「读和保护」开始，最后才到「改」。

### Phase 1 | 上下文与只读技能

目标：Agent 在修改任何东西前先理解代码库。

1. **项目规则文件优先**：在仓库根 `AGENTS.md` / `CLAUDE.md` 描述真实约定（代码中的，不是 wiki 中的）——构建 / 测试命令、目录含义、已知雷区（「不要碰 `legacy/billing`，无测试 + 三个已知 workaround」）。这是 [`context-engineering`](https://github.com/addyosmani/agent-skills/blob/main/skills/context-engineering/SKILL.md) 思想的直接应用。
2. **`/wm review` on 进来的改动**：评审零风险且立即可用——五轴评审与 Severity 标签在任何 PR 上都可用，与代码库状态无关。先从 [`code-reviewer`](../w-model-dev/references/agent-personas.md) Persona 开始。
3. **`/wm test type=单元 result=fail` for 既存 bug**：执行五步 triage（重现 → 定位 → 缩减 → 修复 → 加守卫），「加守卫」步骤开始建立你没有的回归测试套件。
4. **SSoT [§4A.1](./skill-design-document_SSoT.md) 行为 3「Push Back」作为安全网**：遗留代码正是「不熟悉的代码 + 错误代价高」的场景。Agent 对遗留系统工作方式的自信声明须经 SSoT [§7.6](./skill-design-document_SSoT.md) 评审验证后再提交。

### Phase 2 | 先测试后改动

目标：Agent 将触及的每个区域先加安全网。

- **选择性应用测试设计前置**：不追求全局覆盖率，追求「计划改动处」的覆盖率。对未测试的遗留行为写**特征化测试（characterization tests）**——锁定当前行为（无论对错）后再改。Beyonce Rule 适用：如果 Agent 喜欢某个行为到依赖它，就应该给它加测试。
- **[`code-reviewer`](../w-model-dev/references/agent-personas.md) on 最差热点**：Chesterton's Fence 是操作原则——Persona 强制 Agent 先理解代码存在的原因再动手。行为保持不变的简化 + 特征化测试是让遗留代码可改的最低风险路径。
- **小原子提交**：~100 行的提交在棕地更重要——改老代码破坏微妙行为时，可二分定位；2000 行「现代化」提交则不可。

### Phase 3 | 新工作跑全流程

目标：双速采用，遗留代码留在 Phase 1–2；新功能获得 Greenfield 待遇。

- 老代码库中的新功能？`/wm analyze → /wm design → /wm code → /wm test`。`/wm analyze` 的边界声明节是声明「新功能可触碰 / 不可触碰哪些遗留面」的地方。
- **[`security-auditor`](../w-model-dev/references/agent-personas.md) at 接缝**：当代码必须与遗留代码对话时，按边界契约设计接口。Hyrum's Law 在数年代码库中不是理论——每个可观察行为（包括 bug）都有人依赖。
- **[`security-auditor`](../w-model-dev/references/agent-personas.md) as 审计 → 然后作为门**：先在现有攻击面（auth / 输入处理 / 依赖）跑一次，归档发现，然后对新改动强制执行。依赖审计单独通常就值得这次演练。

### Phase 4 | 偿还债务、废弃、观测

- 阶段 8 验收后，将「废弃与迁移」作为下一周期目标：用受控方式缩小遗留面而非仅包裹它。
- 沿实际调试路径回填可观测性：结构化日志 + RED 指标优先放在 Top 事件源上。
- 性能优化在回归重要时启动——[`performance-auditor`](../w-model-dev/references/agent-personas.md) 的「Measure-First」规则防止「优化从未是瓶颈的代码」这一遗留陷阱。

### Brownfield 反模式

- **「大爆炸」采用**：在遗留代码库 Day 0 加载完整 8 阶段流程会为已存在的代码产出规格，并在无安全网下重构。必须分阶段。
- **让 Agent 重构未测试代码**：无特征化测试，不重构。这是棕地采用中最昂贵的捷径。
- **跳过项目规则文件因为「代码就是文档」**：Agent 会从它碰巧读到的最差文件推断约定。告诉它真实的。
- **将遗留系统行为默认视为错误**：Chesterton's Fence：那个奇怪的 retry 循环可能是承重的。先理解，再改。
- **无棘轮**：采用应使质量单调提升——每个 Phase 加一道不再撤回的门。如果一个月后你说不出「现在有什么是强制执行而之前不是的」，采用已停滞。
- **估算覆盖率放行**：违反 SSoT 约束 4，与 Greenfield 反模式相同——棕地不是降低标准的理由。

---

## 两条路径的收敛

两条路径终态相同：新工作跑全 8 阶段、常开 RTM 维护与真实执行、阶段门评审在合并前、`references/` 按阶段加载而非批量。Greenfield 在数天内到达；Brownfield 在约一个季度内到达，差异正是老代码库从未有的安全网（上下文 / 特征化测试 / 边界）。

| 维度 | Greenfield | Brownfield |
|---|---|---|
| 首次加载的技能 | `w-model-dev` + `/wm analyze` | 项目规则文件 + `/wm review` |
| 首次交付的价值 | 规格化、测试先行的首个功能 | 零风险评审与更安全的 bug 修复 |
| 测试设计前置姿态 | 从首次提交全启用 | 选择性：在计划改动处前置 |
| 重构规则 | 罕见（无东西可重构） | 特征化测试先行，永远 |
| 最高风险反模式 | 跳过 `/wm analyze` | 重构未测试代码 |
| 到达全流程时间 | Day 0 | 约一个季度，中间双速 |

---

## 与 addyosmani/agent-skills 的差异

| 维度 | addyosmani 原版 | W 模型适配版 |
|---|---|---|
| 全流程 | `/spec → /plan → /build → /test → /review → /ship` 6 步 | `/wm analyze → design → code → test → review → 验收` 8 阶段（含概要 / 详细设计分离 + 4 级测试） |
| Day 0 起常开 | TDD + git workflow + security + documentation | 测试设计前置 + RTM 维护 + 真实执行 + 如实状态 |
| Brownfield Phase 1 | `context-engineering` + `code-review-and-quality` + `debugging-and-error-recovery` + `doubt-driven-development` | 项目规则文件 + `/wm review` + `/wm test type=单元 result=fail` + SSoT §4A.1 行为 3「Push Back」 |
| Brownfield Phase 2 | `test-driven-development` 选择性 + `code-simplification` + `git-workflow-and-versioning` | 选择性测试设计前置 + `code-reviewer` Persona + 小原子提交 |
| Brownfield Phase 3 | 新功能跑 `/spec → /plan → /build → /review` + `api-and-interface-design` + `security-and-hardening` 审计转门 | 新功能跑 `/wm analyze → design → code → test` + `security-auditor` Persona |
| 工件质量门 | 无（依赖各技能自带的 verification gate） | SSoT [§10.5](./skill-design-document_SSoT.md) 工件质量门（退出码 0 才放行） |
| 收敛稳态 | `/spec → /plan → /build → /review → /ship` + TDD + git + 评审门 | 全 8 阶段 + RTM + 真实执行 + 阶段门 + 工件质量门 |
