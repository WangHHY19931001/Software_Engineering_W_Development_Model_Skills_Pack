# R-persona 选择可校验化与人格能力声明（实施记录）

> 日期：2026-09-17。状态：已实施，待全量验收（`npm run prepush`）。
> 触发：用户提问「R 是不是应该按需加载证据、定位、code-review 等人格？」
> 仓库：`D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack`（main，直接在主分支工作，本仓库惯例）。

## 1. 分析结论（决定了改动范围）

R **已经在**按需加载人格。现行规则的真实作用域是「R 不加载 `agent-personas.md` 的 4 个 V 评审 Persona」——理由是 V 之后还要复审 R 的产出（`targetKind=rootcause`），同视角自审会破坏独立性（反模式 #18/#19 的精神）。R 加载的是 `subagent/` 28 人格库，且早有按 `rootCause.category` 的选择矩阵（`agent-personas.md` §2）与数量约束（§4：默认 3 / 上限 5）。

用户点名的三类在库里已有对应：证据 → `testing-evidence-collector`；code-review → `engineering-code-reviewer`；**「定位/诊断」没有专门人格**，由 `engineering-incident-response-commander` 兼任（且被 §4 定为必含）。

真正的缺口是**「按需」不可校验**，共三处：

| # | 缺口 | 实测证据 |
|---|---|---|
| G1 | 能力声明四字段（§1.5）是「建议补充」，未落地 | 28 份人格文件含该四字段者 **0 份** |
| G2 | 矩阵只有一维选择键（`rootCause.category` 为 R 自述），无第二键、无仲裁规则 | 原 §2 表把「类别行」与「信号行」混在一张表里，语义未区分 |
| G3 | 矩阵选择完全不可门禁校验 | `check-rootcause-report.ts` 只查 R9（partialReports 非空）与 R10（canonical reality-checker + confidence ≥0.5）；**无任何脚本校验实际选了哪些人格**，也无数量/必含校验 |

## 2. 实施的改动

### 改动 1：persona 能力声明四字段（G1）

- 28 份 `w-model-dev/subagent/*.md` 的 YAML frontmatter 补 `capabilities` / `inputs` / `outputs` / `boundaries` 四字段（单行、值内只用全角标点、写在 `description:` 之后）。内容按各 persona 正文的「角色定位 / 核心使命」撰写，判别性内容而非填充（如 `boundaries: 适用：…；换人：…` 直接回答「何时该换人」）。
- `agent-personas.md` §1.5 由「建议补充」改为**门禁强制**契约表。
- 新增门禁 `check-docs-consistency.ts` 的 `persona-capability-declarations`：任一文件缺任一字段即 exit 1；清单为空或文件无 frontmatter 亦 fail-closed。
- 决策：字段放**人格文件 frontmatter** 而非矩阵表——加载单元是人格文件（`boundaries` 随文件进入上下文），且避免「文件 + 表格」两处副本漂移。

### 改动 2：R-persona 两键矩阵（G2）

- 第一键 = `rootCause.category`（R 自述，schema 枚举，7 行）；第二键 = **风险域信号**（安全 / 性能 / AI-LLM，由 V/G 产出特征读出，不由 R 自述——避免「自己归类决定自己视角」的循环），命中即**叠加**。
- 新增四条仲裁规则：并集；上限 5 时保留 reality-checker（R10 必含）与第一键行成员并记录裁剪；第一键分歧须改判 `category` 或写入 `rootCause.evidence`；门禁边界如实陈述。
- 原 §2 的 3 行「信号」行从类别表中拆出，避免「类别」与「信号」在同一张表里语义混淆。

### 改动 3：R11 校验 + 矩阵一致性门禁（G3）

- `logic/root-cause-logic.ts` 新增 `R_PERSONA_MATRIX` / `R_PERSONA_SIGNAL_MATRIX` 常量（R11 判据源）与 **R11**：多角度报告（`method=combined`）的 `partialReports[].personaSlice` 必须（a）落在矩阵内已知 persona 集合，（b）与 `rootCause.category` 第一键行候选集有交集。`partialReports` 缺失由 R9 判失败、`noRootCause` 分支无 category —— 两者跳过 R11。legacy `reality-checker` 归一化为 canonical 后参与比较。
- 新增 `docs-consistency` 的 `rootcause-persona-matrix` 检查：**独立解析**（TS AST，不 import 被检查模块）`root-cause-logic.ts` 的两个常量与 `agent-personas.md` §2 两张表的键与候选集**双向等价**，并断言矩阵引用的每个 persona 均存在于 `subagent/<name>.md`。
- fixture：`bad-r10-no-reality-checker.json` 的 personaSlice 由**不存在的人格名**（`engineering-testability` / `design-architect`）改为真实矩阵人格，保持「仅触发目标规则」的夹具原则（并以单测钉住该性质）；新增 `bad-r11-unknown-persona.json`（矩阵外人格）与 `bad-r11-category-mismatch.json`（自述类别与视角行无交集）。`ROOTCAUSE_CASES` 14 → 16。

## 3. 兼容性披露（行为收紧，需知悉）

- **收紧**：多角度 `RootCauseReport` 若 `partialReports` 用矩阵外人格、或视角与自述 `category` 完全不相交，从现在起 `check-rootcause-report.ts` **exit 1**。此前这类报告可通过。
- **不设时间戳豁免**：与 2026-09-16 review-remediation 确立的「删除时间戳豁免」语义一致（`analysisTimestamp` 只作日志，不参与信任判定），R11 对全部报告生效，无 legacy 窗口。
- 已有 fixture 与新规则的交互已逐条核对：`valid-no-root-cause.json`（noRootCause 分支跳过）、`bad-r9-partial-missing.json`（无 partialReports，R9 负责）、`bad-r10-reality-confidence.json`（`reality-checker` → 归一化后落在 `requirement-gap` 行内）均不误报。

## 4. 明确**不做**的事（以及为什么）

- **不强制数量 3/5**：数量是分派默认，且 §5 允许 Optional/Nit 缺陷走单 R-lead；强制下限会在 degraded 单会话模式产生误报。
- **不强制 `incident-response-commander` 必含**：§4 的必含与 §2 表格行并不一致（7 行类别里只有 3 行含它），硬强制等于改变 R 的选择语义；已改为在 §4 注明「分派默认，非门禁判据」，并同步进 §10.9 的边界陈述。
- **不把第二键做成门禁**：需要报告声明信号字段（`meta.failureSignal` 之类），属于 schema 扩展；本次只落文档 + 分派指导。若将来要强制，须先加 schema 字段（含 description，受 `checkSchemaFieldDescriptions` 约束）。
- **不新增「定位/诊断」人格**：R 的方法论在 `root-cause-locator.md`，人格只提供视角不提供方法；新增人格会增加 PartialReport 聚合成本，不提升定位准确性。
- **不扩大人格数量**：R 的产出受 R10 约束（只认 canonical reality-checker、重复即 fail-closed），人格越多越容易触发多角度分歧上缴人裁决（编排停顿）。

## 5. 实施过程中发现并修复的自身缺陷

| # | 缺陷 | 发现方式 | 处置 |
|---|---|---|---|
| S1 | `checkRootCausePersonaMatrix` 的「persona 存在性」检查用 `Object.values(code.categories)`，而 `categories` 是 **Map** → `Object.values(Map)` 恒为空数组，检查被**静默缩窄**到只剩信号行（类别行引用的不存在 persona 检不出） | 新门禁的**负向对照**（逐条注入缺陷，断言期望消息）——首轮 N2 只报 1 条而非 2 条，据此定位 | 改为 `[...code.categories.values()].flat()`，复验 N2/N7 各报 2 条（候选集不一致 + 引用不存在 persona）；真实仓库仍 0 违规 |
| S2 | 新增代码引入 6 条 security-scan 新发现（prepush 第 5 项 exit 1）：`detect-non-literal-regexp`（动态构造字段正则）、`detect-object-injection`（`lines[i]` / `right[i]` / `R_PERSONA_MATRIX[category]`）、`detect-non-literal-fs-filename`（测试内 readdir 派生路径 ×2） | `npm run prepush` 全量运行 | **改代码而非改 baseline**：字段正则改字面量 pattern 数组、`lines.at(i)` / `right.at(i)`、新增 `R_PERSONA_ROW_BY_CATEGORY` Map 视图并以 `.get()` 查表；仅测试内两处 readdir 派生读文件按仓库既有风格加**具名豁免注释**。复验 `lint:security` 新增发现 0（baseline 未改） |
| S3 | `lib/run-sync.ts` 的 `SYNC_PROCESS_EXCEPTIONS` 台账行号 provenance 漂移（9 条指向 `__tests__/docs-consistency-logic.test.ts` 的条目）：我在该测试文件顶部加了 2 行 import，其后所有直接子进程调用整体下移 2 行 | `npm run prepush` 第 12 项 vitest 失败（`run-sync.test.ts`「audits every direct synchronous child-process call」断言 `exception.line === call.line`，报 2778 vs 2780） | 9 条 line 字段 2780/2821/2824/2830/2833/2840/2841/2893/2916（各 +2）；复验 `run-sync` 19 项全绿。这是仓库「行号即 provenance」机制的预期维护面，非机制缺陷 |

> 记录这三条的理由：S1 是「门禁看起来在工作、实际判据被静默缩窄」的典型，只有负向对照能抓到；S2 是门禁自身对实现的约束，修代码优于扩 baseline；S3 说明给测试文件顶部加行会连带台账行号，属该机制的既定维护动作。

## 6. 验证记录

| 验证项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck` | exit 0 |
| R11 单测 | `npx vitest run --config config/vitest.config.ts root-cause-logic` | 27 passed（新增 5 例：矩阵外人格 / 无交集 / R10 不误报 R11 / legacy 归一化 / noRootCause 豁免） |
| docs-consistency 单测 | `npx vitest run --config config/vitest.config.ts docs-consistency-logic` | 206 passed（新增 8 例，含 2 例真实仓库零违规 + 合成负例双向对账 + fail-closed） |
| 新门禁负向对照 | 临时脚本（已删）逐条注入缺陷 | 6/6 命中期望消息；据此抓到并修复 S1 |
| docs-consistency CLI | `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` | exit 0 |
| security 扫描 | `npm run lint:security` | 新增发现 0（baseline 312 指纹未改） |
| 格式 | `npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"` | exit 0（仅新增区域被格式化，`git diff` 纯新增） |
| 台账 provenance | `npx vitest run --config config/vitest.config.ts run-sync` | 19 passed（S3 修复后） |
| 回归基线 | `npm run self-test` | exit 0（352 条样本，含新增 2 条 rootcause 负向样本） |
| **全量验收** | `npm run prepush` | **18/18 全绿，`PREPUSH_EXIT=0`，末行「全部门禁通过，允许推送 ✓」** |

## 7. 收口

- 全量验收经 **3 轮** prepush 才转绿：第 1 轮止于 security-scan（S2），第 2 轮止于 vitest（S3），第 3 轮 18/18 通过。前两轮失败均为本次新增代码/行数引起，一律按「改代码而非放宽门禁」处置（baseline 未改，除测试内两处具名注释外无新增豁免）。
- 关键项实测：`vitest 单元测试 + coverage 阈值通过（exit 0）`、`docs-consistency 活体文档一致（exit 0）`、`samples 覆盖矩阵一致（无未登记 fixture）（exit 0）`、`tsc 类型检查 0 错误（exit 0）`、`eval 语料断言与覆盖矩阵全绿（exit 0）`。
- 工作区改动保留、未提交：45 改 + 3 新增（本记录 + 2 份 R11 fixture）。提交与否由用户决定。
- 遗留（已裁定不做，见 §4）：第二键若要门禁强制需先加 `meta.failureSignal` schema 字段；数量 3/5 与 `incident-response-commander` 必含保持为分派默认。
