# w-model-dev 三维度全面优化设计（收尾 + 审计）

> 日期：2026-09-01
> 状态：已获用户批准（brainstorming 流程）
> 定位：全面优化——先收尾清债，再全门禁 + 静态审计，一轮完整闭环
> 前序：42.0.0 三维度优化（批次 1 有效性 / 批次 2 可靠性 / 批次 3 易用性）与 42.1.0 证据支撑树集成已完成

## 1. 背景与现状

- 当前版本 42.1.0（package.json 与 SKILL.md 一致），工作区干净，main HEAD `93f6f3a`。
- 42.1.1 deferred 修正计划的 3 个任务已落库但**未收口**：
  - `e20e579` + `0d03b4a`：run-sync ↔ dependency-boundaries 并行竞态修复（跳过 `.d2-` 瞬态 fixture）
  - `7e97baa`：security baseline v2 全量对账（49 提交漂移，删 116 孤儿条目）
  - `93f6f3a`：活体文档/风格微修批次（R15 用途列、§2.1 复用说明、A-chunk L42 示例、§10A 表行对齐、§3.1 触发表补行、`test()`→`it()`）
  - 缺：版本号 42.1.1、CHANGELOG 条目、验收记录。
- 已确认遗留债务：
  - **易用性**：19 个重定向 stub 承诺「42.1.0 移除」但 42.1.0 被证据支撑树占用，承诺过期；SKILL.md 106 非空行 vs 批次 3 设计目标 <100。
  - **可靠性**：负载敏感 flake（state-write-logic 锁测试 + R10 探针，环境容量问题，已加 per-test 90s 预算缓解）。
- 引用摸底（stub 移除前置调研）：19 个 stub 名在全仓 1080 处匹配 / 100 文件，其中**活体资产**（references / templates / examples / tools / schemas 描述 / 测试契约 / eval mappings / SKILL.md / AGENTS.md / SSoT）需精确重链；**历史文档**（docs/superpowers/、docs/changes/、CHANGELOG-archive.md、CHANGELOG.md 历史条目）按项目惯例不重写历史。
- 关键排除项：`templates/**/glossary.md` 为同名真实模板子文件（非 references/glossary.md stub 引用），清点时必须排除。

## 2. 目标

| 维度 | 目标 | 验收判据 |
|---|---|---|
| 有效性（收口） | 42.1.1 发布收口，CHANGELOG 归属清晰 | 版本/CHANGELOG/验收记录三者齐备 |
| 易用性（清债） | 19 个过期 stub 移除且零死链；SKILL.md 收敛 <100 非空行 | 全仓无指向已删 stub 的活体引用；`grep -cv '^[[:space:]]*$' SKILL.md` < 100 |
| 可靠性+有效性（审计） | 全 17 项门禁真实执行全绿；静态审计发现按 P0-P2 修复 | 门禁矩阵真实退出码记录；发现台账 P0-P2 清零、P3 留档 |

## 3. 总体架构

三批次串行，每批次独立验收：

```dot
digraph {
  rankdir=LR;
  b1 [label="批次1: 42.1.1 收口\n(版本/CHANGELOG/验收记录)"];
  b2 [label="批次2: 42.2.0 易用性清债\n(stub 移除+重链+SKILL.md 收敛)"];
  b3 [label="批次3: 全门禁体检\n+静态审计+修复"];
  b1 -> b2 -> b3;
}
```

- 批次间依赖严格串行：批次 2 依赖批次 1 的版本基线；批次 3 的审计覆盖批次 1/2 的变更质量。
- 每批次独立提交链 + 验收记录（docs/changes/）+ CHANGELOG 条目，遵循项目既有惯例。
- 执行方式：writing-plans 产出实施计划 → 子代理驱动逐任务执行（推荐）或内联执行。

## 4. 批次 1：42.1.1 收口（纯发布卫生，零代码变更）

### 4.1 变更清单

| 文件 | 操作 |
|---|---|
| `package.json` + `w-model-dev/SKILL.md` | version 42.1.0 → 42.1.1 |
| `CHANGELOG.md` | 新增 `[42.1.1] - 2026-09-01`：3 项修正（附 commit 身份） |
| `docs/changes/<实际执行日>-42.1.1-deferred-fixes-acceptance.md` | 新增验收记录（真实退出码；日期前缀以实际执行日为准） |

### 4.2 验证

- `npm run self-test`（预期 262/262）
- run-sync × dependency-boundaries 组合 5 连跑（竞态修复证据，预期 5 次全绿）
- `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`（预期 exit 0）

### 4.3 风险

零代码变更，仅文档与版本号。若版本号变更触发 docs-consistency 契约（版本一致性检查），同提交更新契约。

## 5. 批次 2：42.2.0 易用性清债（结构性变更，核心风险门）

### 5.1 stub 移除与引用重链

**19 个 stub 及合并目标**（与 b3 验收记录逐字一致）：

| stub（19） | 合并目标 |
|---|---|
| tla-plus-guide / tla-plus-syntax-reference / tla-plus-patterns-examples / tla-plus-review-checklist / tla-plus-tlc-configuration（5） | `tla-plus.md` |
| bdd-guide / bdd-syntax-reference / bdd-patterns-examples / bdd-review-checklist（4） | `bdd.md` |
| anti-patterns（1） | `hard-constraints.md` |
| dispatch-matrix（1） | `subagent-delegation.md` |
| subagent-persona-matrix（1） | `agent-personas.md` |
| glossary / format-conventions / directory-conventions（3） | `conventions.md` |
| design-patterns-catalog / refactoring-catalog / code-smells-checklist（3） | `coding-quality.md` |
| definition-of-done（1） | `quick-self-check.md` |

**重链范围（活体资产，逐一清点）**：

1. `w-model-dev/references/*.md`：phase-1/2/3/4（各 6-7 处）、quick-self-check（1）、evidence-anchored-tree（1）等
2. `w-model-dev/templates/*.md`：system-design / requirement-spec / interface-design / detailed-design / README（注意排除 `templates/**/glossary.md` 同名真实子文件）
3. `w-model-dev/examples/*.md`：stage1-requirement-analysis（2）、README（4）
4. `w-model-dev/tools/README.md`（2）
5. `w-model-dev/schemas/*.json` description 字段：iceberg-sweep（2）、hill-climbing-report（1）
6. `w-model-dev/scripts/__tests__/`：docs-consistency-logic.test.ts（5）、gate-enhancement.test.ts（9）——测试契约若断言 stub 存在/引用 stub 名，同步更新
7. `eval/mappings.json`：锚点若指向 stub 则更新（b3 已改 4 处，需复核是否残留）
8. `w-model-dev/SKILL.md`（资源计数 59→40）、`AGENTS.md`（§2 目录速查 references 行）、`docs/skill-design-document_SSoT.md`（§10A 资源计数）

**不重写**：`docs/superpowers/`（内部规划目录）、`docs/changes/`（历史验收记录）、`CHANGELOG.md` 历史条目、`CHANGELOG-archive.md`。

**重链规则**：链接指向合并目标文件；若原引用语义对应合并文件内特定章节，带锚点/章节名（如 `tla-plus.md` 的对应指南节），由实现者按目标文件实际结构落位。

### 5.2 SKILL.md 收敛（106 → <100 非空行）

- 压缩对象（按优先序）：「门禁契约与资源清单」节的证据与审计长段落、「快速自检」节并入工作流末步、「阶段路由」表吸收标记列措辞收敛。
- 约束：所有指针（references 链接、命令、门禁 flag）全保留，语义零丢失；收敛后逐一核对链接可解析。
- 验收：`grep -cv '^[[:space:]]*$' w-model-dev/SKILL.md` 输出 < 100。

### 5.3 同提交门禁闭合（不留隔夜红灯）

单提交内（或提交链尾提交内）全部真实执行并全绿：

- `npm run eval`（25/25）
- `npm run self-test`（262）
- `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`（exit 0）
- `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`（exit 0）
- `npm run prepush`（17 项全绿）

### 5.4 版本与记录

- version → 42.2.0（结构性资产变更，minor）
- CHANGELOG `[42.2.0]`：stub 移除（含重链计数）、SKILL.md 收敛实测值、资源计数 59→40
- 验收记录 `docs/changes/<实际执行日>-42.2.0-usability-debt-acceptance.md`（含 42.1.0 stub 承诺过期说明的闭环；日期前缀以实际执行日为准）

### 5.5 错误处理

- docs-consistency 契约因 stub 移除失败 → 同提交更新契约与 fixture。
- eval 锚点断言失败 → 同提交更新 mappings.json。
- 死链检查发现遗漏引用 → 补齐重链后重跑门禁。

## 6. 批次 3：全门禁体检 + 静态审计 + 修复

### 6.1 门禁矩阵（真实退出码，逐项记录）

`npm run eval` / `npm run self-test` / `npm run prepush`（17 项）/ `npm run doctor` / `check-samples-coverage` / `npm run lint:security` / `tsc -p config/tsconfig.json`。

### 6.2 静态审计清单（新视角）

| 审计项 | 方法 | 判据 |
|---|---|---|
| L0 拷贝体验 | 模拟拷贝 `w-model-dev/`（不含 scripts/）到全新目录，走 quickstart 路径 | SKILL.md 所有相对链接可解析、无死链；quickstart 5 分钟路径真实可行 |
| 文档-脚本一致性 | dispatch-matrix 登记（subagent-delegation.md §6）vs `scripts/cli/*.ts` 实际文件；command-reference vs package.json scripts vs SKILL.md 命令表 | 三方一致，无未登记脚本/幽灵命令 |
| 示例新鲜度 | examples/ 内容 vs 42.0.0 重写后 SKILL.md 流程（CHECKPOINT/角色/命令形态） | 示例与现行流程无冲突表述 |
| Schema 描述漂移 | schemas/*.json description 引用的文档名/路径现状 | 与当前 references 布局一致 |
| 资源计数一致性 | SKILL.md / AGENTS.md / SSoT §10A 的 references/schemas/scripts 计数 vs 实测 | 计数与实测逐字一致 |

### 6.3 发现分级与处置

- **P0**（阻断使用/事实错误）：必修，修复后重跑受影响门禁。
- **P1**（体验/可靠性降级）：必修。
- **P2**（打磨）：修。
- **P3**（仅记录）：登记留档（deferred 台账），不修须给出裁定理由。
- 产出：发现台账（含定位/级别/修复 commit/验证证据）。

### 6.4 版本与记录

- 若有代码/资产修复 → 42.2.1 + CHANGELOG + 验收记录 `docs/changes/<实际执行日>-42.2.1-audit-remediation-acceptance.md`（日期前缀以实际执行日为准）
- 若仅登记无修复 → 不升版本，审计报告并入批次 2 验收记录附录（以实际发现为准）

### 6.5 已知观察点（审计时复核，不预设结论）

- 负载敏感 flake：若批次 3 全量 prepush 复现（state-write-logic 锁测试 / R10 探针超时），按发现台账登记并处置（P1）；未复现则维持「环境容量问题已缓解」结论留档。

## 7. 验证策略（跨批次）

- 全程真实退出码（硬红线 #4/#9），禁止估算；门禁结果与 run-log 交叉校验规则不变。
- 批次 2 为核心风险门：eval + docs-consistency + prepush 必须同提交全绿。
- 竞态敏感组合（run-sync × dependency-boundaries）5 连跑作为批次 1 必含证据。
- 每批次验收记录只收录实际执行的命令与结果，未执行不作通过声明。

## 8. 明确不做（YAGNI）

- e2e 8 阶段重跑（批次 3 终值已有 `eval/e2e/2026-08-28-final.md`，用户已确认不重跑）。
- 历史文档重写（CHANGELOG-archive / decision-log / superpowers plans+specs / 历史验收记录）。
- 负载敏感 flake 深挖（已缓解；仅当批次 3 复现时按发现处置）。
- 不新增功能、不合并/拆分 references 内容本身（本设计仅移除 stub 与重链，内容重组另行立项）。
- 不改 `.w-model/` 证据协议、不改门禁脚本行为逻辑（测试契约随重链同步除外）。

## 9. 交付物清单

| 批次 | 交付物 |
|---|---|
| 1 | 版本 42.1.1、CHANGELOG 条目、验收记录、提交链 |
| 2 | 版本 42.2.0、19 stub 删除 + 重链提交链、SKILL.md <100 行、验收记录 |
| 3 | 门禁矩阵记录、发现台账（P0-P2 清零 / P3 留档）、修复提交链、验收记录、（视发现）版本 42.2.1 |

## 10. 后续

本设计批准后进入 writing-plans 产出实施计划（`docs/superpowers/plans/2026-09-01-w-model-dev-full-optimization.md`），按批次拆任务、每任务含 TDD/验证步骤与提交点。
