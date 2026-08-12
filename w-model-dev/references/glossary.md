# 术语表（Glossary）

> **权威定义入口（第 26 轮新增）**：本文件为 W-Model skill 包核心术语的**单一权威定义**。
> 各参考文档定义与本节冲突时，以本节为准（SSoT 例外——SSoT §7 数据模型 schema 为结构权威，本节为语义权威）。
> 每条含「规范定义 + `_Avoid_` 指令」（禁用别名 / 易混词），防止术语同义异写。
>
> 来源：外部 domain-modeling/CONTEXT-FORMAT.md 的 GLOSSARY + `_Avoid_` 治理实践（第 26 轮吸收）。

## 1. 评审相关

### qualityLevel

- **规范定义**：综合评分质量等级，由 `compositeScore` 加权平均映射（verifier-spec §6.1）：`≥0.85 → A` / `≥0.70 → B` / `≥0.50 → C` / `<0.50 → D`。
- **_Avoid_**：等级/评级/grade/level（仅 V 评审产物使用「qualityLevel」字段名，不得写作「level」「grade」）。

### compositeScore

- **规范定义**：V 评审综合分数 = Σ(子标准 score × weight)，保留 4 位小数，必须与各子标准加权和一致（误差 ≤ 1e-4）。
- **_Avoid_**：总分/平均分/综合分/overallScore/score（「score」专指子标准得分，不得混用）。

### passed

- **规范定义**：阶段门通过判定布尔值。`passed = (qualityLevel === 'A' || 'B') && 所有 subCriterion.score >= 0.70`（第 26 轮 R13 单轴下限，反模式 #41）。
- **_Avoid_**：是否通过/通过与否/approved/accepted（产物字段名必须为「passed」）。

### 单轴下限（R13）

- **规范定义**：任一子标准得分 `< 0.70`（B 级分界）即 `passed=false`，即使加权平均达标也不放行。防止加权平均掩盖单轴失败（反模式 #41）。
- **_Avoid_**：下限阈值/单维门槛/floor（脚本 violation 消息格式固定为「子标准 <name> 得分 <score> < 0.70（单轴下限）」）。

### targetKind

- **规范定义**：V 评审目标类型枚举，仅 4 值：`requirement`（阶段 1）/ `design`（阶段 2-4）/ `code`（阶段 5）/ `test`（阶段 6-8）。
- **_Avoid_**：`testcase`（已废弃，用 `test`）、`file`（已废弃，用 `code`）、type/target（「target」是评审对象描述字段，不同概念）。

### mappingType

- **规范定义**：SD（概要设计）→ codeModule（代码模块）映射关系类型，仅 3 值：`直接`（同名/直映射）/ `等价`（行为等价）/ `替代`（SD 产物被代码模块承载）。
- **_Avoid_**：映射类型/mapType/relation/对应关系（文档与脚本统一使用「mappingType」字段名）。

## 2. 数据模型相关

### runId vs eventId

- **规范定义**：`runId` = RunLogEntry 的运行标识（Run-log / 运行日志）；`eventId` = EventIngress 事件标识（Loop 3 事件接驳）。**两个 schema 不可混用**（反模式 #26）。
- **_Avoid_**：互用/等价（RunLogEntry 用 `runId`+`action`+`role`+`outcome`，EventIngress 用 `eventId`+`eventType`）。

### action（RunLogEntry）

- **规范定义**：run-log 动作类型枚举（共 27 值，以 `run-log.schema.json` 为准）：`chunk` / `cross` / `evolve` / `produce` / `review`（V 评审）/ `gate` / `tla-gate` / `graph-gate` / `test` / `checkpoint` / `rework` / `rollback` / `rootcause` / `fix` / `emergency-fix` / `escalate` / `r3-completeness` / `r3-reliability` / `r3-security` / `codegraph_query` / `opsx_explore` / `opsx_propose` / `opsx_apply` / `opsx_archive` / `ensure_deps` / `iceberg-sweep` / `iceberg-review`。
- **_Avoid_**：operation/op/行为/事件（「action」字段名固定；EventIngress 的同类字段是 `eventType`）。

### checkRounds

- **规范定义**：tla-manifest.json 中 **spec 级** 返工记录（每次 TLA+ spec 因门禁失败返工的记录项），非 phase 级摘要；无返工时为空数组。
- **_Avoid_**：phase 级摘要/轮次记录/检查轮数（第 15 轮遗留 bug 即因把 phase 级摘要写入 checkRounds 触发 R13 拦截；见 tla-plus-guide.md）。

### coverageStatus

- **规范定义**：RTM 行覆盖状态（`covered` / `partial` / `not-covered`），与 `coveragePercent` 数值须一致（第 24 轮硬校验）。
- **_Avoid_**：状态/status（「status」字段在 project.json 等其它上下文使用，RTM 行必须用「coverageStatus」）。

### acknowledgedDecisions

- **规范定义**：CHECKPOINT 用户确认的决策数组，须含 ID 模式（REQ-NNN / INTF-NNN）或技术关键词（接口/状态机/不变式等），「同意」「确认」视为空（check-checkpoint R2）。
- **_Avoid_**：decisions/确认项/决策列表（字段名必须为「acknowledgedDecisions」，第 17 轮 D5 修正）。

## 3. 工程资产相关

### codeModule

- **规范定义**：代码模块映射标识，格式 `SD-xxx:src/path.ts`（SD 概要设计 ID + 冒号 + 相对项目根的代码路径）。check-artifact-gate 强制格式校验（第 22 轮）。
- **_Avoid_**：codeFile/module/路径（「codeFile」是 code-TLA+ 输入里的代码文件对象，不同结构）。

### signatureHash

- **规范定义**：签名链条目哈希，`sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`，首环 prevSigHash="0"（SSoT §7.9）。
- **_Avoid_**：hash/签名/摘要（字段名固定「signatureHash」；「签名」在自然语言中泛指该机制）。

### inputProvenance

- **规范定义**：签名链条目输入来源证明（上游产物路径 + 角色），S 子代理产出时强制回填（反模式 #32 守护）。
- **_Avoid_**：来源/inputSource/provenance（字段名固定「inputProvenance」）。

### tickets.md vs tasks.md

- **规范定义**：`tickets.md` = S-tickets 的代码垂直切片（how，tracer-bullet + blocking edges DAG）；`tasks.md` = opsx:propose 的高层任务清单（what/why）。职责不同，不可互替（反模式 #40）。
- **_Avoid_**：互替/混用（二者在阶段 5 共存，S-propose 分派时先后产出）。

### R3 预防性审查

- **规范定义**：S 产出后强制触发的三阶段审查（completeness / reliability / security），产物落盘 `.w-model/preventive-reviews/<phase>-<dimension>.json`（约束 #11，反模式 #33）。
- **_Avoid_**：预防性检查/预防审查/R3 评审（固定称呼「R3 预防性审查」，三份报告维度名固定为 completeness / reliability / security）。

---

> **维护规则**：新增 `.w-model/*.json` 字段或脚本 violation 消息前，先在本表登记术语，再改 schema / 文档（反模式 #28 schema 前置校验缺失同类纪律）。首版 12+ 条（第 26 轮）。
