# External Skills Absorption

> 三源（to-tickets / to-spec / OpenSpec）吸收决策记录。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.8 / §4A.1 / §11A + 各 `phase-N-*.md` 新增节为准；本文件为吸收映射与决策回溯。

## 1. 吸收源清单

| 源 | URL | 吸收日期 | 吸收范围 |
|---|---|---|---|
| to-tickets | https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md | 2026-07-26 | tracer-bullet 垂直切片 + blocking edges + wide refactor expand-contract |
| to-spec | https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md | 2026-07-26 | seam-first testing + User Stories 长列表 + Out of Scope + Implementation/Testing Decisions 分离 |
| OpenSpec | https://github.com/Fission-AI/OpenSpec | 2026-07-26 | 四产物结构映射 + archive 机制 + brownfield 适配 + context hygiene |

## 2. 吸收决策记录

### 2.1 落地策略：阶段内强化
- 选项：阶段内强化 / 新增子流程 / 双轨制 / 全量融合
- 选定：阶段内强化
- 理由：与"编排者最小化"约束最契合，不新增子流程脚本，方法论由 S 子代理按文档执行

### 2.2 吸收深度：纯文档
- 选项：纯文档 / 文档+可选脚本 / 强门禁
- 选定：纯文档
- 理由：不破坏现有 self-test 基线（91 条），不新增 check-tickets.ts，G 子代理既有职责不变

### 2.3 Brownfield 适配：补充 adoption-guide
- 选项：补充 adoption-guide / 阶段1加分支 / 本轮不做
- 选定：补充 adoption-guide
- 理由：不改阶段主流程，brownfield 路径作为 SSoT §11A.5 子节，与 greenfield 并列

## 3. 三源 → W 模型阶段映射表

| OpenSpec 产物 | W 模型阶段 | W 模型对应产物 | 备注 |
|---|---|---|---|
| proposal.md | 阶段 1 | requirement-spec.md 的「问题陈述+解决方案+User Stories+Out of Scope」节 | 第 4 节强化 |
| specs/ | 阶段 1 | RTM 需求行 + acceptance-test-cases.md | 不变 |
| design.md | 阶段 2-4 | system-design.md + outline-design.md + detailed-design.md | 不变 |
| tasks.md | 阶段 5 | tickets.md（新增） | 第 6 节强化 |
| archive/ | 阶段 8 | changes/archive/YYYY-MM-DD-<feature>/（新增） | 第 7 节强化 |

## 4. 三源精华 → 阶段产物分布

### 4.1 阶段 1（[phase-1-requirements.md](phase-1-requirements.md) 新增节）
- User Stories 长列表（to-spec）
- Out of Scope 显式声明（to-spec）
- Implementation/Testing Decisions 分离（to-spec）

### 4.2 阶段 2-4（phase-2/3/4-*.md 新增「测试 seam 决策」节）
- Seam-first testing 决策（to-spec）
- 三层 seam 一致性约束（to-spec）
- 与 TLA+ 行为门禁正交（已有约束 9）

### 4.3 阶段 5（[phase-5-coding.md](phase-5-coding.md) 新增「Tracer-bullet 票据拆解」节）
- 票据清单 + blocking edges（to-tickets）
- Wide refactor expand-contract（to-tickets）
- 票据内容契约（to-tickets）
- Out of 票据化例外（to-tickets + OpenSpec easy not complex）

### 4.4 阶段 8（[phase-8-acceptance-test.md](phase-8-acceptance-test.md) 新增「archive 机制」节）
- archive 路径 + 产物清单（OpenSpec）
- archive 规则（OpenSpec + to-spec 路径禁用）

### 4.5 adoption-guide（SSoT §11A.5 + [adoption-guide.md](../../docs/adoption-guide.md)）
- Brownfield 适配路径（OpenSpec）

## 5. 与现有约束/反模式的关系

### 5.1 强化现有约束

| 约束 | 强化点 | 来源 |
|---|---|---|
| 约束 1（测试设计前置） | seam 决策是测试设计的前置输入 | to-spec |
| 约束 5（Maintain Scope Discipline） | Out of Scope 显式声明 + brownfield 不重构无关历史代码 | to-spec + OpenSpec |
| 约束 6（按需加载） | context hygiene 提示性补强（阶段切换新会话） | OpenSpec |
| 约束 8（编排者最小化） | S-tickets 由 S 兼任，编排者只按 frontier 路由 | to-tickets |
| 约束 9（TLA+ 行为门禁） | TLA+ 不变式断言覆盖私有状态机，不在代码层引入测试 seam | to-spec |

### 5.2 不引入新约束
- 三源吸收不新增硬红线（保持 19 条约束 + 19 条反模式 + 10 条失败模式不变）
- 新增节是"操作行为"层面（违反不回退，降低质量），不是"硬约束"层面（违反回退）
- §4A.1 第 7 行「Choose Highest Seam」是操作行为，不是硬约束

### 5.3 不弱化现有反模式
- 反模式 #10（编排者越权）：S-tickets 拆解由 S 执行，编排者不越权
- 反模式 #18（跳过 R 直接 S 返工）：票据化不绕过返工循环
- 反模式 #16（TLA+ 占位）：seam 决策不替代 TLA+ 行为门禁

## 6. Verifier 评审影响

### 6.1 不改 verifier-spec.md
- §7.1-§7.5 既有 5 轴评审不变
- 4 targetKind × 5 项标准颗粒度不变
- rawScores 自然波动校验不变

### 6.2 V 子代理引用方式
- V 子代理在 summary digest 时引用各 phase-N-*.md 新增节作为完整性检查项
- 不新增 subCriteria（保持 coverage/correctness/independence/clarity/priority-reasonableness 5 项）
- 不新增 targetKind（保持 requirement/design/code/test/rootcause 5 类）

## 7. 不做的事

- 不新增 check-tickets.ts 脚本（纯文档吸收）
- 不改 check-artifact-gate.ts（不新增票据维度校验）
- 不改 self-test 基线（91 条不变）
- 不改 RTM schema（archivePath 为可选字段，不破坏现有 schema）
- 不改 verifier-spec.md（V 子代理引用方式不变）
- 不改 subagent-delegation.md 角色划分（S-tickets 由 S 兼任）
- 不改 data-models.md 强制字段（archivePath 可选）

## 8. 未来扩展（非本轮）

- 若票据拆解需强门禁：可后续新增 check-tickets.ts（校验 DAG 无环 + frontier + 垂直切片）
- 若 archive 需校验：可后续扩展 check-artifact-gate.ts 校验 archivePath
- 若 brownfield 需独立流程：可后续新增 references/brownfield-guide.md
