# 技能包全面审查与修复（audit-remediation）实施记录

> 日期：2026-09-17。状态：三批修复已实施，待全量验收（`npm run prepush`）。
> 触发：用户要求「对当前仓库开发的技能进行全面审查」。
> 方法：4 个独立审计子代理分维度（门禁脚本 / 文档一致性 / 测试与样本 / 规则与角色）产出带 `文件:行号` 与可复现命令的发现；**主代理逐条复现全部阻断级结论**后才计入修复清单（不采信未复现的断言）。

## 0. 审查发现的分布

| 维度 | 阻断 | 应修 | 建议 |
|---|---|---|---|
| 门禁脚本（46 CLI + logic/lib） | 3（fail-open） | 4 | 4 |
| 文档一致性 | — | 6 | 5 |
| 测试与样本 | — | 3 | 4 |
| 规则与角色 | 1（L0/L1 豁免无实现） | 7 | 4 |

**系统性模式（主结论）**：不止一处门禁把「没有发现违规」当作「通过」，未区分**「验证过了」**与**「什么都没验证」**——即「零证据＝合规」类 fail-open。第二模式是「静默跳过」（可选输入缺失 → 整组校验不执行且输出侧不可分辨）。第三类是**治理证据链退化**（有证据形式但内容不准：登记册行号、自检计数、规则枚举）。

## 1. 第 1 批：堵 fail-open 与"让跳过可见"

### 1.1 逐条复现（修复前 → 修复后）

| # | 门禁 | 修复前（我复现） | 修复后（我复验） |
|---|---|---|---|
| 1 | `check-checkpoint` | 空 run-log + 空/不存在目录 → `passed:true` exit 0（并打印「已跳过 R3 用户确认校验」） | `R0 零证据守卫` → exit 1，reason 明确 |
| 2 | `check-state-machine-consistency` | 四数组全空 → exit 0（CLI 头注却写「不得按全空合法图放行」） | exit 1 |
| 3 | `check-code-tla-consistency` | manifest 指向的 `.tla` 缺失 → 静默置空 → 维度 3/4 跳过 → exit 0 | exit 2 / FILE_NOT_FOUND；内联 `tlaContent` 的自包含 manifest 仍 exit 0（对照臂验证） |
| 4 | `check-budget` R4-A | 删掉可选字段 `rootcauseParallelBudget` → 整条规则失效，且无任何提示 | 语义保持「未配置不校验」，但改为**可见跳过**（warning）；删除 `checkBudget` 丢弃子结果 warnings 的缺陷后警告真的出现了 |
| 5 | `check-iceberg-sweep` | `evidence`/`hypothesis` = 单空格 → exit 0 | exit 1（trim 语义） |
| 6 | `wm-status --json` | 未初始化 → exit 0 且 **stdout 为空** | 输出 `{"type":"status","initialized":false,…}` |

### 1.2 让「静默跳过」可查

- `check-artifact-gate`：阶段 1-4 未传 `--spec-dir` → 整组设计级校验不执行。新增 GATE_JSON 字段 `specStructure: 'checked' | 'skipped' | null`（键恒存在）+ 人类横幅 `设计级结构 : ⚠ 未执行（未提供 --spec-dir…）`。实测 `--phase=1` 输出 `"specStructure":"skipped"`。
- `check-signature-chain`：未提供 `existingPaths` 时 R8 不执行，却仍 `rulesPassed.push('R8')` 并打印「R1-R10 全通过」。新增 `rulesSkipped`，横幅改为「已执行规则全通过（未执行：R8——缺对应输入，不计入通过）」，实测输出符合。
- `check-verifier-output` R12：**两处放行都堵上**——① 原 `!hasSpecificRef && e.length < 20` 放行「长而无引用」；② 收紧后暴露裸词根误判（`行/节/章` 命中「执行」「细节」「文章」）。最终模式改为结构化形态（文件路径+可选行号 / §章节 / 第 N 章节行 / L 级 / 仓库 ID 前缀），6 组正负探针全符合。
- R13：非有限数值 `score` 由静默跳过改为显式违规（探针：`'0.1'` 字符串分值现在报违规）。

### 1.3 过程中的两个自我纠错（如实记录）

- **`exitWithError` 不中断调用链**：首次实现 code-tla fail-closed 时只调用 `exitWithError` 就 `return`，探针显示实验臂仍 exit 0——因为后续流程照常算出 `passed=true` 并把退出码覆盖回 0。补 `throw new HandledCliError()` 后才生效。
- **`checkBudget` 丢 warnings**：R4-A 的跳过警告最初没出现在输出里，追查发现 `checkBudget` 只 `violations.push(...r4a.violations)`，把 `r4a.warnings` 静默丢弃。属同一缺陷类的第二个实例。

- **R12 正则的三轮返工（含一次"我的理由本身是错的"）**：收紧 R12 后写了一版结构化正则，`security/detect-unsafe-regex` 报警。我先按"线性量词白名单"加了具名豁免并写下「实测 < 30ms」——随后用对抗输入计时**证伪了自己**：无界前缀（字符类 + 一个必须的后缀 `.` + 扩展名）在不匹配输入上是二次复杂度（4 万字符 2.4s）。改为「有界段 + 斜杠分隔」形态后**更糟**（8 万字符 14.3s，8 处不变）。最终定位两个真因：① 未锚定的可匹配整串前缀必然从每个位置重扫 → 每个分支改为**字面锚点起始**（`.` + 已知扩展名 / `§` / `第` / `L` / `line` / ID 前缀）；② 行号后缀写成「含量词的组再被量化」（`:L?` + 数字 + 可选区间，整体再可选）即 star height 2，且对判据无贡献（`:L45` 前必有扩展名）→ 删除。终态行为 12/12、对抗输入 ≤0.4ms、安全扫描 **0 新发现**（无需任何豁免）。教训：**门禁报警时的第一反应应是推翻自己的"它很安全"假设，并用测量而非论证说话**。

## 2. 第 2 批：治理证据链

1. **负向覆盖登记册**：把「文件存在 + 行号在范围内」升级为**内容锚点**——引用行内容必须出现该 fixture 名（新违规码 `negative-coverage-evidence-anchor`）。
   - 一次性回填 **29 条**（26 条 `file:` 型 + 3 条 `sampleDir` 目录型）。回填前抽查确认：如 `reg:45` 引 `self-test.ts:454`，该行实为 artifact-gate 的用例说明，真实引用在 `:531`。
   - 两臂验证：正向 exit 0；把一条引用 +3 行 → 精确报出 `引用行未指向该 fixture：…:2168 内容不含「bad-empty-stakeholder.json」` 且 exit 1。
   - 登记册表头由「已知局限（尚未实现机器可查）」改为「2026-09-17 起强制内容锚点」并写明历史（29/29 漂移）。
2. **自检计数**：AST 实测各 `*_CASES` 实加 **353** + 1 元数据 = **354**；`AGENTS.md` / `CONTRIBUTING.md`×3 / `docs/user-guide.md` / `samples/README.md`×2 / `.githooks/pre-push` / `.code-health-governance.json` 的 352 全部校正为 354。
3. **R11 负载性**：新增 7 行正向（含本行任一 persona 即通过）+ 5 行负向（仅 reality-checker 且该行不含它 → 拦截）。首版负向名单写错（把 `design-flaw` / `requirement-gap` 也纳入，而这两行**确实**含 reality-checker），按矩阵事实修正为 5 行。

## 3. 第 3 批：文档矛盾（13 项）

由子代理按封闭清单执行（仅改 `.md`），逐项状态与验证 grep 见其报告。要点：
- 冰山放行判据三口径统一；规则集号 R1-R5 → R1-R8；数值改指代码常量。
- BDD D2 如实标注未实装（门禁 7 维度 + D2 人工核验）。
- code-health 发现者角色三方对齐；V 规则枚举 → R1-R18；`targetKind` 4→5 值；`--skip-tlc` 残留删除；maturity/交付层 L0 同名澄清；模板脆锚；examples 份数；矩阵外 6 份人格入册 + 换人指针修正。

**run-log R8 的处置转向（重要）**：审计判定「规范要求 S→V 间 3 条 R3 记录，实现只比较首个 R3」。我先按文档实现了维度完备性校验，**run-log 测试立即报出 2 条失败**——两条既有测试断言「无 R3 的 produce→V→G→checkpoint」合法。复核后确认：① 该轨迹的**实质缺陷**（三维度不齐）已由 `check-role-dispatch` 阶段级无条件强制；② R8 的职责是链序而非计数。故**撤回代码改动**（`git checkout` 恢复），改为**文档对齐实现**并在两处写明「R8 只校验首个 R3 落在 S 与 V 之间；三维度齐全由 check-role-dispatch 强制」。这是一次「证据指向与初始判断相反」的处置，记录在此以免被读成漏修。

## 4. 验证记录

| 项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck` | exit 0 |
| 定向测试（14 文件，本轮触及门禁） | `npx vitest run --config config/vitest.config.ts root-cause-logic verifier checkpoint state-machine budget iceberg signature-chain code-tla wm-status artifact-gate run-log` | 391 passed |
| 回归基线 | `npx tsx w-model-dev/scripts/cli/self-test.ts` | 354/354 通过 |
| samples 覆盖门禁（含新锚点规则） | `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | exit 0（45 行 / 47 探针） |
| 格式 | `npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"` | exit 0 |
| fail-open 探针 | 见 §1.1（每行均为修复后复验） | 6/6 符合预期 |
| 全量验收 | `npm run prepush` | 见下方收口 |

## 5. 收口

（待全量 prepush 结果补记。）
