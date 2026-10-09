# 代谢机制批（43.5.0）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 落地规格 §3 的四维自迭代机制——M1 复杂度度量与棘轮预算、M2 规则生命周期（登记册+退役）、M3 门禁效能反馈、M4 定期简化检查点（CONTRIBUTING 成文）、M5 pre-push 快/全双档——版本升 43.5.0，全部通过 prepush。

**架构：** 4 个新 CLI（3 只读 + 1 强制门禁）按仓库五层模式（`logic/` 纯函数无 fs + `cli/` 装载注入，仿 `check-coverage-scope` 范式）；1 个新 schema（`rule-registry.schema.json`，schema-loader 按目录约定自动发现、零 loader 改动）；1 个登记册 JSON（62 条迁移）；docs-consistency 增设 `checkRuleRegistry` 接线（计数从登记册派生）；pre-push 增第 20 项（budget 门禁）+ 快/全双档。执行于 git worktree（分支 `metabolism-batch-43.5.0`），逐任务提交 + 任务审查 + 最终宽范围审查（与批次①同流程）。

**技术栈：** TypeScript（tsx runtime，devDeps 不变——零新增依赖）、JSON Schema draft-07、bash（.githooks）、vitest 三 project。

**权威规格：** `docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md` §3（M1-M5）+ §5（证据树）。**侦察事实包**（本计划全部行号锚点的来源，行号基于提交 `4b097d61`）：见附录 A。

**行号纪律：** 以下行号为编写时点实测；执行时一律先以 grep 重新定位，内容锚点优先于行号。

---

## 全局约束（审查者的注意力透镜）

1. **分层禁令**：新 logic 层文件禁止 import `node:fs/path/child_process`（`__tests__/dependency-boundaries.test.ts` 强制，例外清单 `ALLOWED_LOGIC_NODE_BOUNDARY_IMPORTS` **不新增条目**）；文件遍历与读盘全部在 cli 层完成后以纯数据注入 logic。
2. **exit-2 家族约定**：全部新 CLI 走 `lib/cli-error.ts` 的 `exitWithError`（stderr 人类消息 + stdout `ERROR_JSON`）+ `isDirectInvocation` + `runMain`；重复/未知 flag → `ARG_INVALID`。
3. **每个新 CLI 的注册五件套**（缺一被既有元门禁红灯）：① `subagent-delegation.md` dispatch-matrix 一行（`checkScriptRegistry` 逐文件核对 basename）；② `samples/NEGATIVE-COVERAGE.md` 一行 + 头注计数；③ `cli/self-test.ts` 用例函数（4 处注册点，附录 A R5）；④ `__tests__/cli-subprocess-smoke.test.ts` 一个 describe；⑤ 全仓计数口径同步（任务 8 sweep）。
4. **fail-closed**：门禁输入缺失/坏行按违规处理；只读脚本坏输入走 `FILE_PARSE`/`STRUCTURE_INVALID` exit 2，不静默跳过。
5. **零 LLM、零新增 devDep**；文档改动遵守 SSoT 优先链（任务 1 先行）。
6. **CHECKPOINT 不可绕过**：任务 10 是人类裁定任务，执行者必须停下等用户。

---

## 文件结构

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| `docs/superpowers/evidence/2026-10-09-p1-metabolism-batch-evidence-graph.md` | 创建 | 本批证据图 |
| `docs/skill-design-document_SSoT.md` | 修改（§10U + §10A 行） | 设计权威摘要先行 |
| `w-model-dev/scripts/logic/complexity-logic.ts` | 创建 | 度量与预算纯函数 |
| `w-model-dev/scripts/cli/wm-complexity-report.ts` | 创建 | 只读度量 CLI（exit 0/2） |
| `w-model-dev/scripts/cli/check-complexity-budget.ts` | 创建 | 预算门禁（exit 0/1/2） |
| `eval/complexity-baseline.json` | 创建 | 首测基线快照 |
| `eval/complexity-caps.json` | 创建 | 棘轮预算（初值=首测） |
| `w-model-dev/schemas/rule-registry.schema.json` | 创建 | 登记册 schema（自动发现） |
| `w-model-dev/rule-registry.json` | 创建 | 62 条规则登记册 |
| `w-model-dev/scripts/logic/docs-consistency-logic.ts` | 修改 | `checkRuleRegistry` + EXPECTED 派生 |
| `w-model-dev/scripts/cli/wm-rule-lifecycle.ts` | 创建 | 退役候选只读 CLI |
| `w-model-dev/scripts/cli/wm-gate-effectiveness.ts` | 创建 | 门禁效能只读 CLI |
| `.githooks/pre-push` | 修改 | 第 20 项 + 快/全双档 |
| `w-model-dev/scripts/logic/docs-consistency-logic.ts` 内 vitest JSON 消费点 | 修改 | 缺 JSON 降级为非阻断诊断 |
| `CONTRIBUTING.md` | 修改 | M4 仪式 + cap 上调规则 + 双档说明 |
| `w-model-dev/references/hard-constraints.md` | 修改 | 「已退役」区 + C1/C2 裁决落地 |
| 计数口径 6 处（任务 8 清单） | 修改 | 48→52 .ts / 47→51 / ≈43%→≈39% / 19→20 项 |
| `eval/mappings.json` + `eval/w-model-dev-test-prompts.json` | 修改 | 3 条新映射（双向成对） |
| 测试 4-6 个文件 | 创建/修改 | logic 单测 + self-test 用例 + 子进程冒烟 |
| 版本镜像 7 处 | 修改 | 43.5.0 + CHANGELOG + tag v43.5.0 |

---

### 任务 0：证据图初始化

**文件：** 创建 `docs/superpowers/evidence/2026-10-09-p1-metabolism-batch-evidence-graph.md`

- [ ] **步骤 1：写入证据图**（格式沿用批次①；根节点 R1=「落地规格 §3 五机制并升版 43.5.0」🟢）。12 个叶子：L1=SSoT §10U、L2=complexity 报告脚本、L3=budget 门禁+pre-push 第 20 项、L4=登记册 62 条、L5=docs-consistency 接线、L6=lifecycle CLI、L7=effectiveness CLI、L8=计数口径 sweep、L9=快/全双档+M4 仪式、L10=C1/C2 裁决（🔴 状态 🟡：待用户）、L11=eval 语料、L12=43.5.0 发布。每个叶子挂规格 §3 锚点与附录 A 侦察锚点。
- [ ] **步骤 2：登记三个 🟡 待核项**（执行中最先消解）：
  - 🟡-a `check-docs-consistency` 对 vitest JSON 的确切消费点（grep `check-docs-consistency.ts` 中 `--report`/`coverage`/`vitest` 参数与对应 logic 函数）——决定任务 9 的 #15 降级模式形态；
  - 🟡-b `.w-model/gate-logs/` 旧式 144 个 `<ISO>-iceberg-sweep.json` 内是否带 `script` 字段（抽 3 个核实）——决定任务 7 解析器的回退逻辑占比；
  - 🟡-c caps/baseline 初值在任务 2 落地时实测（程序性，非风险）。
- [ ] **步骤 3：Commit**——`docs(evidence): 代谢机制批证据图初始化——12 叶子挂规格 §3 与侦察锚点，3 个 🟡 待核（43.5.0）`

---

### 任务 1：SSoT §10U 权威摘要 + §10A 追溯行

**文件：** 修改 `docs/skill-design-document_SSoT.md`（:2533 后插 §10U；:2656 后补 §10A 表行）

- [ ] **步骤 1：插入 §10U**（格式仿 §10T：`## 10U. 批次 10：代谢机制（43.5.0）`，内含 **目标** 段 → `| 项 | 落点 |` 两列表 → `- **能力分工（不夸大）**` → `- **判据披露**` → `- **后续候选**` → `---`）。落点表行：M1→`wm-complexity-report.ts`/`check-complexity-budget.ts`/`eval/complexity-{baseline,caps}.json`；M2→`rule-registry.json`+schema+`wm-rule-lifecycle.ts`+docs-consistency `checkRuleRegistry`；M3→`wm-gate-effectiveness.ts`；M4→CONTRIBUTING「定期简化检查点」节；M5→pre-push 快/全双档。判据披露必含：**棘轮 cap 机器层只判 current≤cap，cap 上调唯一通道=🔴 CHECKPOINT+decision-log；退役/降级建议只报告不自动裁决；三个只读脚本只读既有数据**。能力分工：机制全部无 LLM、读本地 `.w-model/gate-logs`（不外发）。
- [ ] **步骤 2：§10A 追溯表**补一行（项=§10U 各机制、落点=对应文件、状态=完整）。
- [ ] **步骤 3：验证**——`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0。
- [ ] **步骤 4：Commit**——`docs(ssot): §10U 代谢机制权威摘要 + §10A 追溯行（43.5.0 设计先行，L1）`

---

### 任务 2：M1 度量——complexity-logic + wm-complexity-report + 基线

**文件：** 创建 `logic/complexity-logic.ts`、`cli/wm-complexity-report.ts`、`eval/complexity-baseline.json`；测试 2 个

- [ ] **步骤 1：写失败的 logic 单测**（`__tests__/complexity-logic.test.ts`，进 unit-parallel project）。核心接口（纯函数，数据注入）：

```ts
export interface FileLines { path: string; lines: number; }
export interface ComplexityMeasurement {
  referencesFiles: FileLines[];      // w-model-dev/references/*.md
  scriptFiles: FileLines[];          // w-model-dev/scripts/{cli,logic,lib,application,infrastructure}/*.ts（不含 __tests__）
  antiPatternCount: number;          // 登记册落地前暂由调用方数 hard-constraints 主表行（任务 4 后改读登记册）
  hardConstraintCount: number;
  personaAdaptedCount: number;       // 正文命中适配词表 ≥2 项的人格数
  personaTotal: number;              // 36
  sedimentCount: number;             // references/*.md 中含「已删除|已退役|审查更正」的行数
}
export const PERSONA_ADAPTION_MARKERS = ['.w-model', 'run-log', 'verifier-output', 'phase-analyses', 'RTM'];
export function countPersonaAdaption(bodyText: string): number; // 命中 marker 数
export function computeComplexityReport(m: ComplexityMeasurement): ComplexityReport;
// ComplexityReport: { oversizedReferences: FileLines[]; oversizedScripts: FileLines[]; m; generatedAt: string }
export interface BudgetCaps {
  referencesDefaultMaxLines: number; referencesExceptions: Record<string, number>;
  scriptsDefaultMaxLines: number; scriptsExceptions: Record<string, number>;
  antiPatternMaxCount: number; hardConstraintMaxCount: number;
  personaAdaptedMinCount: number; sedimentMaxCount: number;
}
export function checkComplexityBudget(m: ComplexityMeasurement, caps: BudgetCaps): { passed: boolean; violations: string[] };
// violations 文案逐条带实测值与 cap（如 "references/tla-plus.md 2471 > cap 2471 以外不得上调；current 2471 > cap 1200"）
```

用例覆盖：正常/超限/异常表缺席（文件不在 exceptions 也超 default → violation）/人格适配计数边界（恰好 2 个 marker）/sediment 计数/空输入 fail-closed（STRUCTURE 语义由 cli 层负责，logic 抛 `ComplexityFormatError` 仿 `CoverageScopeFormatError`，coverage-scope-logic.ts:19 范式）。

- [ ] **步骤 2：跑测试确认失败**——`npx vitest run __tests__/complexity-logic.test.ts --config config/vitest.config.ts` → FAIL（模块不存在）。
- [ ] **步骤 3：实现 logic**（照 `coverage-scope-logic.ts` 范式：类型 + 纯函数 + FormatError；零 fs import）。
- [ ] **步骤 4：实现 cli `wm-complexity-report.ts`**（照 `check-coverage-scope.ts` 范式 R7）：cli 层 `readdirSync`+`readFileSync` 收集 Measurement（行数=按 `\n` 切分计数；sediment 用行级正则 `/已删除|已退役|审查更正/`；人格适配=逐文件读正文数 marker ≥2 计入）→ 调 logic → stdout 单行 `COMPLEXITY_REPORT_JSON {...}`（`--json` 同字节确定：不含时间戳，`generatedAt` 仅人类通道输出）→ 退出码恒 0（度量成功即 0；输入坏 → `STRUCTURE_INVALID`/`ARG_INVALID` exit 2）。
- [ ] **步骤 5：生成基线**——运行 `npx tsx w-model-dev/scripts/cli/wm-complexity-report.ts --save-baseline=eval/complexity-baseline.json`（cli 增加 `--save-baseline` 参数：把报告写入指定路径，JSON 缩进 2 空格）。将 `eval/complexity-baseline.json` 加入 git。记录实测值（任务 0 🟡-c 转 🟢）。
- [ ] **步骤 6：注册五件套之 ③④**——`self-test.ts` 增 `runComplexityReportCases`（仿 runGraphCases：构造 tmp 目录夹具喂 cli 进程内调用，注册 4 点见附录 A R5）；`cli-subprocess-smoke.test.ts` 增 describe（对真实仓库根跑一次，断言 stdout 含 `COMPLEXITY_REPORT_JSON` 且 exit 0）。
- [ ] **步骤 7：验证 + Commit**——全量 `npx vitest run --config config/vitest.config.ts` 中新测试绿；`npx tsx w-model-dev/scripts/cli/wm-complexity-report.ts` exit 0。Commit：`feat(complexity): M1 度量——complexity-logic 纯函数 + wm-complexity-report 只读 CLI + 基线快照（43.5.0 L2）`

---

### 任务 3：M1 预算——caps + check-complexity-budget + pre-push 第 20 项

**文件：** 创建 `eval/complexity-caps.json`、`cli/check-complexity-budget.ts`；修改 `.githooks/pre-push`、`self-test.ts`、`cli-subprocess-smoke.test.ts`、计数文档（此处只改 pre-push 相关，其余任务 8）

- [ ] **步骤 1：写 caps 文件**——`eval/complexity-caps.json`（入库，schemaVersion 1.0）。初值规则（程序性，非占位）：`referencesExceptions` = 任务 2 基线中 >1200 行的 references 文件（当前已知 6 份：tla-plus/subagent-delegation/bdd/verifier-spec/data-models/hard-constraints，**以基线实测为准**）；`scriptsExceptions` = 基线中 >1200 行的 scripts 文件（已知 12 份，含 self-test.ts 5662）；`referencesDefaultMaxLines`/`scriptsDefaultMaxLines` = 1200；`antiPatternMaxCount`/`hardConstraintMaxCount` = 实测 48/14；`personaAdaptedMinCount` = 实测值（≥4：批次①后 reality-checker + 3 份原生适配）；`sedimentMaxCount` = 基线实测。文件头 description 写明棘轮语义与上调唯一通道。
- [ ] **步骤 2：写失败的 budget 测试**——logic 用例并入 `complexity-logic.test.ts`（caps 边界：恰好等于 cap 通过、超 1 行违规、violation 文案含数值）；`cli/check-complexity-budget.ts` 的冒烟 describe（caps 正常 → exit 0；构造超限 tmp 夹具 → exit 1 + stderr `✗ [BUDGET]`；caps 坏 JSON → exit 2）。
- [ ] **步骤 3：实现 cli**——照 R7 范式：`readFileSync(caps)`（`FILE_NOT_FOUND`）→ `JSON.parse`（`FILE_PARSE`）→ caps 自身 schema 缺字段（`STRUCTURE_INVALID`）→ 复用任务 2 的 cli 层采集器（抽公共函数到 cli 层共享模块 `cli/complexity-collect.ts` 或函数复用，避免两 CLI 采集逻辑漂移）→ `checkComplexityBudget` → stdout 单行 `COMPLEXITY_BUDGET_JSON {...含 violations 全文}` → `!passed → exit 1`。
- [ ] **步骤 4：pre-push 接第 20 项**——在 L1 并行车道（:410-496 区间）末尾追加：

```bash
par_expect 20 "复杂度棘轮预算（eval/complexity-caps.json）" 0 \
  npx tsx w-model-dev/scripts/cli/check-complexity-budget.ts
```

同时更新 `logic/docs-consistency-logic.ts` 的 `EXPECTED.prePushCount` 19→20（`checkPrePushCount` :1857-1880 会核对 `.githooks/pre-push` 中的项数注释——若其计数来源是注释文本，同步头注 :330-338 的「19 项」为「20 项」与逐项清单）。
- [ ] **步骤 5：注册五件套之 ①②**——dispatch-matrix 加 `check-complexity-budget` 行（subagent-delegation.md §6 登记表，含阶段列=仓库级元门禁）；NEGATIVE-COVERAGE.md 加行（fixture=`--d4-invalid-argument` invocation 形态——新 CLI 自动纳入默认探针，R4）+ 头注 47→51 暂缓到任务 8 统一（避免中途数字不一致红灯——**头注与行数必须同提交更新**，故此处直接 47→48 并在任务 6/7 各 +1、任务 8 收口核对）。
- [ ] **步骤 6：验证 + Commit**——`npm run prepush` 本地全量（~38 分钟）全绿（首次含第 20 项）。Commit：`feat(budget): M1 棘轮预算门禁 check-complexity-budget + pre-push 第 20 项 + caps 初值（43.5.0 L3）`

---

### 任务 4：M2 登记册——schema + 62 条迁移

**文件：** 创建 `w-model-dev/schemas/rule-registry.schema.json`、`w-model-dev/rule-registry.json`；创建 `logic/rule-registry-logic.ts`；测试 1 个

- [ ] **步骤 1：写 schema**（draft-07，全字段 description——`checkSchemaFieldDescriptions` 强制含 properties 的节点必须有 description，叶子与 `$ref` 不在强制范围）：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "rule-registry.schema.json",
  "title": "Rule Registry",
  "type": "object",
  "description": "反模式与硬约束的生命周期登记册——计数与状态的单一事实源。43.5.0 批次 10 引入。",
  "required": ["schemaVersion", "rules"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": "1.0", "description": "登记册结构版本。" },
    "rules": {
      "type": "array", "minItems": 62,
      "items": { "$ref": "#/definitions/ruleEntry" }
    }
  },
  "definitions": {
    "ruleEntry": {
      "type": "object",
      "required": ["id", "kind", "title", "status", "boundScript"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^(ap|hc)-[0-9]+$|^C[12]$", "description": "ap-N=反模式 N；hc-N=硬约束 N；C1/C2=候选。" },
        "kind": { "enum": ["anti-pattern", "hard-constraint", "candidate"], "description": "条目种类。" },
        "title": { "type": "string", "minLength": 2, "description": "与 hard-constraints.md 主清单/约束标题一致的中文名。" },
        "status": { "enum": ["active", "candidate", "retired"], "description": "生命周期状态；retired 须有 retiredIn 与理由。" },
        "boundScript": { "type": ["string", "null"], "description": "守护脚本文件名或 null（无脚本，人工核验）。" },
        "retiredIn": { "type": ["string", "null"], "description": "退役版本号，如 43.5.0。" },
        "rationale": { "type": "string", "description": "状态依据；retired 必填，其余可空串。" }
      }
    }
  }
}
```

- [ ] **步骤 2：迁移 62 条**——`w-model-dev/rule-registry.json`：48 条 `ap-1..ap-48`（title 取 hard-constraints 主清单各行反模式名；boundScript 取「与门禁脚本的对应关系」表——批次①已补齐 #18/#19/#20/#48；无脚本者 null）+ 14 条 `hc-1..hc-14`（boundScript 按约束正文挂接；#11 挂 check-run-log）+ `C1`/`C2` 两条 `kind=candidate, status=candidate`。**逐条与 hard-constraints.md 现文核对**（条目名、绑定脚本名真实存在），对不上的在报告中列出而不是猜。前 3 条示例（其余同构）：

```json
{ "id": "ap-1", "kind": "anti-pattern", "title": "跳过评审", "status": "active", "boundScript": null, "retiredIn": null, "rationale": "由 workflow.md 阶段门评审节 + CHECKPOINT 承载" },
{ "id": "ap-4", "kind": "anti-pattern", "title": "评审未通过悄悄小修", "status": "active", "boundScript": "check-verifier-output.ts", "retiredIn": null, "rationale": "rework 闭环校验" },
{ "id": "hc-11", "kind": "hard-constraint", "title": "闭环与轨迹（原 #11 闭环强制）", "status": "active", "boundScript": "check-run-log.ts", "retiredIn": null, "rationale": "R11 闭环五脚本 + R8 轨迹模板" }
```

- [ ] **步骤 3：写 logic + 失败测试**——`logic/rule-registry-logic.ts`：`validateRuleRegistry(data): RegistryReport`（入口 `validateBySchema('rule-registry', data)`——schema-loader 按 basename 自动发现，零 loader 改动；再业务校验：id 唯一、48 条 active ap、14 条 active hc、retired 必有 retiredIn+rationale）；`crossCheckRegistryAgainstDocs(registry, hardConstraintsText): CrossCheckReport`（登记册 ↔ hard-constraints 主表 `| N |` 行集合、`## #N` 约束标题集合双向精确相等；active ap/hc 计数 = 主表行数）。测试 `__tests__/rule-registry-logic.test.ts`（合法全量/缺 1 条/多 1 条/status 非法/retired 缺 rationale → 各断言）。
- [ ] **步骤 4：验证 + Commit**——单测绿 + `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` 仍 exit 0（本任务不改其行为）。Commit：`feat(registry): M2 规则登记册——schema + 62 条迁移 + 校验纯函数（43.5.0 L4）`

---

### 任务 5：M2 接线——docs-consistency 从登记册派生计数

**文件：** 修改 `logic/docs-consistency-logic.ts`、`cli/check-docs-consistency.ts`；samples 2 个；测试追加

- [ ] **步骤 1：新增 `checkRuleRegistry`**——在 docs-consistency-logic.ts（`checkAntiPatterns` :1804 附近）新增：装载 `w-model-dev/rule-registry.json`（cli 层读盘注入；文件缺失/坏 JSON → blocking violation「登记册缺失，计数失去单一事实源」）→ 调任务 4 的 `crossCheckRegistryAgainstDocs` → 任何不等 → blocking。**EXPECTED 派生**：`EXPECTED.maxAntiPattern`（:273）与 `hardConstraintCount`（:276）改为从登记册 active 计数取得（保留字面 48/14 作为「登记册漂移哨兵」——若与登记册不等即报「登记册与 EXPECTED 漂移」，双重保险）。
- [ ] **步骤 2：samples + 测试**——`samples/registry/valid-registry.json`（最小合法子集形态，供单测）与 `bad-registry-drift.json`（active 计数与 EXPECTED 不符）；`docs-consistency-logic.test.ts` 追加 describe（接线前后行为：无登记册=blocking、登记册与文档漂移=blocking、一致=passed）。
- [ ] **步骤 3：验证 + Commit**——真实登记册在位 → docs-consistency exit 0；临时移走登记册 → exit 1（手工演练后还原）。Commit：`feat(registry): docs-consistency checkRuleRegistry 接线——计数从登记册派生，漂移 blocking（43.5.0 L5）`

---

### 任务 6：M2 生命周期——wm-rule-lifecycle.ts

**文件：** 创建 `cli/wm-rule-lifecycle.ts`；修改 `self-test.ts`、`cli-subprocess-smoke.test.ts`、dispatch-matrix、NEGATIVE-COVERAGE.md

- [ ] **步骤 1：实现**——输入：登记册（cli 读盘）+ 各 references 文本（cli 采集：每条规则的 title 与 id 的全仓 references 命中计数，排除其定义文档 hard-constraints.md 自身与登记册）+ gate-logs 目录路径（可选 `--gate-logs=<dir>`，缺省 `<root>/.w-model/gate-logs`；目录不存在 → 输出空语料诊断仍 exit 0，标注 `corpus: "missing"`）。判据（全满足才是候选）：①活文档引用零命中（搜索 `[#/]?{N}（{title 前 6 字}` 与 boundScript 名两种锚）；②boundScript 为 null，或该脚本名在 gate-logs 语料中零出现；③`introducedVersion` 早于当前版本 ≥10 个 minor（登记册无版本字段——**首版判定：id 非候选即视为存续 ≥10**，登记册 v1 不设 introducedVersion，写入 schema description 说明）。输出单行 `RULE_LIFECYCLE_JSON {candidates:[], checked, corpus}`；候选只报告不裁决。
- [ ] **步骤 2：注册五件套**——①②③④同任务 3 清单（self-test 增 `runRuleLifecycleCases`：tmp 夹具构造 1 命中/0 命中两态；smoke describe 对真实仓库跑断言 `RULE_LIFECYCLE_JSON`）。⑤计数口径归任务 8。
- [ ] **步骤 3：验证 + Commit**——真实仓库运行：C1/C2 出现在 candidates 或有明确非候选理由（写入报告）；其余 62 条零误报（若误报，修判据锚而非放宽）。Commit：`feat(lifecycle): M2 wm-rule-lifecycle 只读 CLI——退役候选三判据（43.5.0 L6）`

---

### 任务 7：M3 效能——wm-gate-effectiveness.ts

**文件：** 创建 `cli/wm-gate-effectiveness.ts`；注册四件套同上

- [ ] **步骤 1：实现**——输入 `--gate-logs=<dir>`（缺省同任务 6；目录缺失 → `GATE_EFFECTIVENESS_JSON {gates:[], corpus:0, note:"missing"}` exit 0）。解析 `*.json`（跳过 `.log`）：每文件取 `script` 字段，缺失时回退文件名第三段（`<ISO>-<uuid>-<script>.json`，R1）；坏 JSON 计入 `parseErrors` 并在输出标注（不静默）。聚合 per-gate：`{script, runs, blocked(exitCode=1), errors(exitCode=2), lastFired(文件名 ISO 段取 max), distinctTriggers?}`（distinctTriggers 仅当 reportSummary 含可辨识键时尽力而为，无则省略字段——schema-free 报告，不做过度解析）。排序按 runs 降序。
- [ ] **步骤 2：注册五件套**（同前；self-test 用 tmp 目录构造 3 个合成 gate-log：2 绿 1 阻断，断言聚合值）。
- [ ] **步骤 3：真实语料验证 + Commit**——对本仓 `.w-model/gate-logs`（1,067 文件，🟡-b 结论决定旧式文件占比）运行：iceberg-sweep 应 ~1,055 runs 居首；输出写入任务报告与证据图（M4 仪式首秀数据）。Commit：`feat(effectiveness): M3 wm-gate-effectiveness 只读 CLI——按门禁聚合 runs/blocked/lastFired（43.5.0 L7）`

---

### 任务 8：计数口径 sweep（C7 披露 + 6 处活体文档）

**文件：** 修改 `hard-constraints.md:361 区`、`SKILL.md:123/148`、`AGENTS.md:25 与 §2 pre-push 行`、`conventions.md:156`、`subagent-delegation.md:390-393 + dispatch-matrix 核对`、`NEGATIVE-COVERAGE.md:4`、`README/INSTALL 如有 19 项表述`

- [ ] **步骤 1：统一新口径**（以实测为准，预期值）：`.ts` 48→**52**；exit-2 门禁 47→**51**；阶段必跑链 20 个不变 → 占比 ≈43%→**≈39%**；「其余 27 个」→**31 个**；pre-push 19 项→**20 项**（逐项清单补第 20 项）；NEGATIVE-COVERAGE「全表 47 行」→**51 行**（此时行数=4 新行已加齐）。
- [ ] **步骤 2：dispatch-matrix 核对**——4 个新 CLI 的登记行在位（`checkScriptRegistry` :1514 逐 basename 核对，缺失即红灯）。
- [ ] **步骤 3：验证 + Commit**——`check-docs-consistency` exit 0 + `check-samples-coverage` exit 0 + self-test 全绿（412+新增用例）。Commit：`docs(counts): 43.5.0 计数口径 sweep——52 .ts/51 exit-2/≈39%/pre-push 20 项/登记表 51 行（43.5.0 L8）`

---

### 任务 9：M5 快/全双档 + M4 仪式成文

**文件：** 修改 `.githooks/pre-push`（插入点 `:287` 后）、`logic/docs-consistency-logic.ts`（🟡-a 降级）、`CONTRIBUTING.md`

- [ ] **步骤 1：消解 🟡-a**——grep `cli/check-docs-consistency.ts` 与 logic 中 vitest JSON 路径（`coverage`/`vitest`/`--report`）的消费函数。两种结果：(a) 有消费点 → 该检查增加「输入缺席 → 非阻断诊断 + 仍计 passed」（仿 check-budget 缺 `--run-log` 先例）；(b) 消费只在 hook 侧（拼参数）→ hook 快车道对 #15 改传 `--no-vitest-json` 显式 flag。按实际结构落地并在证据图登记选择。
- [ ] **步骤 2：hook 双档改造**——在变更集判定块结束后（`:287` 日志行后、`:289` 依赖检查前）插入：

```bash
# ---------- M5 快/全双档（43.5.0） ----------
FAST_LANE=0
if [ "${FORCE:-0}" != "1" ]; then
  if ! printf '%s\n' $changed_files | grep -q '^package\.json$' \
     && printf '%s\n' $changed_files | grep -qvE '^(docs/|README\.md$|CHANGELOG\.md$|AGENTS\.md$|CONTRIBUTING\.md$)'; then
    FAST_LANE=0   # 触及技能资产/脚本/schema/eval → 全量
  else
    FAST_LANE=1   # 纯仓库元文档 → 快车道
  fi
fi
log "M5 车道判定：FAST_LANE=$FAST_LANE"
```

（实现时按 `$changed_files` 的实际分隔形态——换行分隔数组——调整遍历写法；语义钉死：**含 package.json → 全量；全部命中 docs/**、README、CHANGELOG、AGENTS、CONTRIBUTING → 快；其余 → 全量。**）快车道效果：跳过第 12 项 `par_expect`（:455-456 区间以 `if [ "$FAST_LANE" != "1" ]` 包裹）与第 13 项 L3 段（:546-549 同样包裹——其输入是 #12 的 coverage JSON，跳 #12 必须跳 #13）；第 15 项按步骤 1 结论降级或照常；**其余 17 项一律照跑**。汇总循环（:499-536）对被跳项输出 `SKIP (fast-lane)` 行而非静默。
- [ ] **步骤 3：hook 双态演练**——`git init --bare /tmp/wm-push-test.git && git remote add push-test /tmp/wm-push-test.git`：①构造 docs-only 提交推 push-test → 断言日志含 `FAST_LANE=1`、`SKIP (fast-lane)`、总耗时 <10 分钟、exit 0；②构造触及 `w-model-dev/references/` 的提交推送 → 断言 `FAST_LANE=0` 全 20 项跑、exit 0；③构造 package.json 变更 → 全量。演练后删临时 remote。结果记入证据图。
- [ ] **步骤 4：CONTRIBUTING.md 增「定期简化检查点（M4）」节**——四步定型：跑三只读脚本（complexity-report/lifecycle/effectiveness）→ 刷新证据图 → 🔴 CHECKPOINT 裁定本批简化配额 → 决策落 decision-log；明确触发时机=每个新的优化批次开工前；cap 上调唯一通道=CHECKPOINT+decision-log；快/全双档语义与 FORCE=1 全量逃生。文本写入计划执行时按 CONTRIBUTING 既有节风格成文，要点以上述为验收判据。
- [ ] **步骤 5：验证 + Commit**——`npm run prepush`（全量，FORCE 路径不受影响）全绿。Commit：`feat(hooks): M5 快/全双档 + M4 定期简化检查点成文 + docs-consistency 输入缺席降级（43.5.0 L9）`

---

### 任务 10：C1/C2 裁决（🔴 CHECKPOINT——人类任务）

**文件：** 修改 `hard-constraints.md`（候选区 + 新「已退役」区）、`w-model-dev/rule-registry.json`、（若转正）计数文档

- [ ] **步骤 1：准备裁决简报**——跑 `wm-rule-lifecycle` 取 C1/C2 证据；汇总 C1（:593-604，V summary 模板化，Jaccard>0.8 且 <50 字符）与 C2（:605-615，无限返工循环）的原始提出信号、现行守护面（C2 已由 L0-L4 收敛视图承载——subagent-delegation「分层反馈回路」节；C1 无脚本承载）。
  - **裁决辅助框架（吸收①，用户 2026-10-09 裁定并入本任务）**：按 [stop-that-shit 吸收评估](../../superpowers/specs/2026-10-09-stop-that-shit-absorption-assessment.md) 折入 SHIT 四类判定（S 范围膨胀 / H 无用防御 / I 意图越界 / T 任务打转）+ Stop Ladder 五步（明确责任→直接方案→补具体缺口→按效果评判防御→验证并结束）作为「C1/C2 是否仍在防止真实失败 / 是否可由既有机置承载」的判定问题集；用到的 S/H/I/T 维度结论写入裁决简报供用户三选一时参考。
- [ ] **步骤 2：🔴 CHECKPOINT 向用户提交三选一**（各自机械后果写明）：转正（C2→#49：主表/速查表/检测表/登记册/计数 48→49 五处联动；C1 同理→#50）；退役（移入新「已退役」区：原编号+退役版本 43.5.0+理由，登记册 status=retired+retiredIn，计数不变）；维持候选但设定复审期限（登记册 status=candidate + rationale 记期限——**不满足规格「不留 pending」除非用户明示豁免**）。等用户裁定，不得自动推进。
- [ ] **步骤 3：按裁定落地**——创建 `## 已退役反模式与约束` 区（「反模式（48 条）」节之后）；登记册状态回写；docs-consistency/eval 复跑绿。
- [ ] **步骤 4：Commit**——`docs(rules): C1/C2 用户裁定落地——<按实际>（43.5.0 L10）`

---

### 任务 11：eval 语料补充（双向成对）

**文件：** 修改 `eval/mappings.json`、`eval/w-model-dev-test-prompts.json`

- [ ] **步骤 1：加 3 条映射**（id 接续现有最大值；每条 mappings 侧 + 语料侧 prompt **成对**——`crossCheckIds` 双向校验，R8）：
  - 「如何度量仓库复杂度与棘轮预算」→ L2，evidence fileExists `w-model-dev/scripts/cli/check-complexity-budget.ts`，assertions contains（`COMPLEXITY_BUDGET_JSON` 于 command-reference 或 CONTRIBUTING、`complexity-caps` 于 SSoT §10U）；
  - 「反模式何时退役、谁裁决」→ L2，evidence fileExists `w-model-dev/scripts/cli/wm-rule-lifecycle.ts`，assertions contains（「已退役」于 hard-constraints、登记册路径于 SSoT §10U）；
  - 「门禁从未阻断过怎么评估」→ L2，evidence fileExists `w-model-dev/scripts/cli/wm-gate-effectiveness.ts`，assertions contains（CONTRIBUTING M4 节锚点）。
  - **成对映射（吸收②，用户 2026-10-09 裁定并入本任务）**：追加 2 条 Bad/Good 成对映射（id 接续；同一场景双向断言）——「无用防御简化」（H 维度：省略无人读取校验和等）与「必要防御保留」（发布校验等真实消费者场景），两向 assertions 指向同一吸收锚（[stop-that-shit 吸收评估](../../superpowers/specs/2026-10-09-stop-that-shit-absorption-assessment.md) 或任务 10 落地后的 hard-constraints「已退役/维持」节），断言各自方向的文档化判定存在。
- [ ] **步骤 2：验证 + Commit**——`npm run eval` exit 0（101→104 条；coverageMatrix 六项不受影响——未新增 references 文件）。Commit：`test(eval): 代谢机制三断言入语料——mappings/语料双向成对（43.5.0 L11）`

---

### 任务 12：版本 43.5.0 + 收口

**文件：** 版本镜像 7 处、`CHANGELOG.md`、`CONTRIBUTING.md`（如 tag 节需提及）

- [ ] **步骤 1：版本联动**——package.json / skill-metadata.json（updatedAt）/ SKILL.md frontmatter / README / docs/INSTALL.md / package-lock.json → 43.5.0；CHANGELOG 顶部新条目（五机制 + C1/C2 裁决结果 + 计数新口径 52/51/20 项）。
- [ ] **步骤 2：验证**——docs-consistency exit 0 + skill-metadata 单测绿。
- [ ] **步骤 3：全量收口**——`npm run prepush`（FORCE 全量路径，20 项）全绿；证据图 L1-L12 全 🟢 + 状态「已归档（本批）」+ 决策日志回挂；提交后 `git tag -a v43.5.0 -m "W-Model skill 43.5.0（代谢机制批：复杂度棘轮预算 / 规则生命周期 / 门禁效能反馈 / 定期简化检查点 / 快全双档）"`。push 由控制者在最终审查后统一执行。
- [ ] **步骤 4：Commit**——`chore(release): 43.5.0——代谢机制批收口（L12）`

---

## 任务依赖与顺序

0 → 1 → 2 → 3（依赖 2 的 logic 与基线）→ 4 → 5（依赖 4）→ 6（依赖 4）→ 7 → 8（依赖 3/6/7 的注册齐）→ 9 → 10（依赖 6 的候选报告 + 5 的派生接线）→ 11 → 12。串行执行，绝不并行实现者。

## 自检记录

1. **规格覆盖度**：规格 §3 M1→任务 2/3；M2→任务 4/5/6/10；M3→任务 7；M4→任务 9 步骤 4；M5→任务 9 步骤 2-3；SSoT 优先链→任务 1；「全部新脚本注册清单」→任务 3/6/7 各含五件套 + 任务 8 收口；版本/收口→任务 12。规格 §2 出口判据中「rule-registry 成为单一事实源」「C1/C2 获裁决」「M4 成文」「三只读脚本可出非空报告」分别由任务 5/10/9/6/7 承载。无遗漏。
2. **占位符**：caps 初值、🟡-a/b 消解、C1/C2 裁决结果均为**带判定程序的程序性步骤**（执行时按给定规则测定/由用户裁定），非未定占位；hook 代码片段语义钉死、实现形态按 `$changed_files` 实际分隔调整已显式声明。
3. **类型一致性**：`ComplexityMeasurement`/`BudgetCaps`/`RegistryReport` 跨任务签名一致；JSON 标记名（COMPLEXITY_REPORT_JSON/COMPLEXITY_BUDGET_JSON/RULE_LIFECYCLE_JSON/GATE_EFFECTIVENESS_JSON）全文一致；叶子编号 L1-L12 与任务 0 证据图一致。

## 附录 A：侦察事实包（行号锚点，基线 4b097d61）

- **R1 gate-logs**：1,067 文件；`<ISO>-<uuid>-<script>.json` 911（iceberg）+ 旧式 `<ISO>-iceberg-sweep.json` 144 + preventive 3 + log 9；字段 `{script, exitCode, passed, reasons[], reportSummary{...}}`；写入经 `validateBySchema('gate-log')`（gate-log-writer.ts:60-90）。
- **R2 pre-push**：#12 vitest :452-456；#13 :458-461（执行 :546-549）；#15 :474-478（执行 :551）；L1+L2 分发 :409-496；L3 :536-551；汇总 :499-536；变更集 `files_need_gate()` :118-142、stdin 主循环 :180-248；**M5 插入点 :287 后**。
- **R3 docs-consistency-logic**：`EXPECTED.maxAntiPattern:48` :273 / `hardConstraintCount:14` :276；`checkHardConstraints` :1778；`checkAntiPatterns` :1804；`checkExit2ScriptCount` :1840；`checkScriptRegistry` :1514（cli readdir :747 自动发现）；`countValidExit2Scripts` :408；`checkPrePushCount` :1857-1880。
- **R4 探针**：`listGateScripts` = readdir 减 self-test（exit2-probe-registry.ts:62-64）→ 新 CLI 自动纳入默认 `--d4-invalid-argument` 探针；NEGATIVE-COVERAGE 4 列格式，头注 :4。
- **R5 self-test**：模式=runGraphCases :3289-3325；注册 4 点：main :5435、Promise.all 解构 :5495-5539、调用数组 :5540-5583、all 数组 :5590+；可选计数 log :5470-5480。
- **R6 SSoT**：§10T :2512-2533；§10U 插 :2533 后（§10.10 :2534 前）；§10A 表 :2612-2657。
- **R7 分层范式**：coverage-scope-logic.ts :19-150（FormatError/纯函数）；check-coverage-scope.ts :39-145（parseArgs/readFileSync/JSON.parse/单行 JSON/exitCode）。
- **R8 eval**：mappings 条目形态 :54-59；`crossCheckIds` :167 双向；coverageMatrix :180 六项；route/category 联动 matrix.routeTotals（42/9/24）。
- **R9 schema-loader**：按目录自动发现（schema-fs.ts:25-35，basename 去 `.schema.json` 注册 :58-59）；logic 调用式 `validateBySchema('rule-registry', data)`（仿 budget-logic.ts:142）。
- **R10 计数同步点**：AGENTS.md:25；SKILL.md:123/148；hard-constraints.md:361；conventions.md:156；subagent-delegation.md:390-393 + dispatch-matrix；NEGATIVE-COVERAGE.md:4。
- **R11 vitest**：新测试默认 unit-parallel；真实 spawn 须登记 `SUBPROCESS_TEST_FILES`（config/vitest.config.ts:42-89）否则 vitest-project-split.test.ts 红；smoke 范式 cli-subprocess-smoke.test.ts:40-48。
- **R12 候选区**：目录指针 :206；C1 :593-604；C2 :605-615；「已退役」区不存在（需新建）。
