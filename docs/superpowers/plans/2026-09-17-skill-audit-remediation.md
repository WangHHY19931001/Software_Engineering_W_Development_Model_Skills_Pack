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

**`npm run prepush` 18/18 全绿（`PREPUSH_EXIT=0`，末行「全部门禁通过，允许推送 ✓」）**，提交 `c5edcfc8`（39 文件，+447/−102）。

转绿过程中另修三处（均由门禁抓出，非猜测）：
1. **`docs-consistency-logic.test.ts` 8 项失败**：文档批把 `tool-gap` 行的说明写进了**矩阵表格单元格**，矩阵解析器把 `Schema` 的 `chema` 与 `capabilities` 当成候选人格 → 真实仓库出现 1 条 matrix 违规。两处同修：说明移出单元格 + 解析器按 5 类前缀限定 token。
2. **security-scan 2 项新发现**：均在 R12 正则上（`detect-unsafe-regex` + `no-useless-escape`）→ 见 §1.3 第三轮返工。
3. **L0 链接基线漂移 672 → 674**：文档批在 `hard-constraints.md` 与 `subagent-delegation.md` 各新增 1 条指向 `iceberg-sweep-guide.md` 的跨引用。用「逐文件回退到 HEAD 再跑审计 CLI」二分定位（回退任一文件即 −1；`l1Only` 仍 95、占位符 36、违规 0），按仓库惯例带 provenance 重定基线。

**未修（如实记录）**：审查共 46 项发现，本批修 3 个优先级组共 30 余项。仍未处理的主要为「建议」级与超出本次范围者：`self-test.ts`（约 5000 行）逐条断言质量、`code-health` 6 个 CLI 的端到端语义、其余 36 个 logic 文件的规则负载性变异测试、coverage 口径（`include` 未生效 + statements 余量仅 ~1.9pp）、以及审计 D 维度的 J1/J2/J3/J4（约束 #11 无执行核验、信息密度阈值空档 [1,2)、两处检测信号引用不存在字段、强化节空括号残留）。

---

## 8. 第二批：建议级与剩余项（2026-09-17 续）

第 1-3 批收口后，按审查清单继续处理「建议」级与超范围项。

| # | 项 | 处置 |
|---|---|---|
| A | **剩余阻断**：L0/L1 成熟度豁免 vs 工件门 TLA+/BDD 强制（文档承诺、门禁无 maturity 输入） | **已实现**：`check-artifact-gate.ts` 读 `.w-model/maturity.json` 的 `level`，L0/L1 且阶段 1-4 时豁免 TLA+/BDD 资产与同步要求（`tlaBddWaived`），GATE_JSON 输出 `maturityLevel`/`tlaBddWaived` + 人类横幅；缺文件/level 非法 → 不豁免（保持严格）。三臂回归：L1+阶段1 豁免命中 / L2+阶段1 不豁免 / L1+阶段5 不豁免（`gate-report.test.ts`）。文档（operational-recovery / hard-constraints）同步为「由门禁强制」 |
| B | **coverage 口径**：`include` 不生效、分母混入 CLI 层、statements 余量 ~1.9pp | **未解决（已完成测量与归因）**：根因确认——**被测试 import 的文件总会进报告**，`include` 只影响未被 import 的文件；全量实测 83 文件（logic 37 / lib 30 / cli 10 / infrastructure 3 / application 2 / __tests__ 1），合并值 stmts **76.83** / branch 71.64 / funcs 87.86 / lines 78.88，statements 距阈值仅 **+1.83pp**。两种 `exclude` 写法（相对路径与 `**/` 前缀）在**聚焦运行生效、全量运行均不生效**（机制未查明）→ 已回退配置，**不发布"已限定口径"的不实声明**；阈值维持 75/65/85/75 并在 `config/vitest.config.ts` 注释中如实标注风险与两次失败的尝试 |
| C | 弱断言 4 处（`?? true` 恒真、仅断言 typeof ×3） | **已修**：改为可证伪断言（`not.toBe(false)`；`coveredFileCount === requiredFileCount`；`durationMs` 有界；`payload.bytes` 与磁盘字节数相等） |
| D | fixture 与内容不符（3 对同字节） | **部分修**：BDD 侧删除与 `valid-manifest.json` 逐字节相同的 `bad-no-rtm-mapping.manifest.json`，用例改为直接引用前者（其「坏」由 `rtmRows` 参数注入）+ samples/README 增「同字节复用」说明；两个 coverage 复用对**保留**并已文档化（差异同样由参数注入，未强行构造假差异） |
| E | 登记册 `reg:82` 引用指向上一用例收尾 | **已修**：`docs-consistency-logic.test.ts:2352 → :2356`（过滤语句 :2356 → :2358） |
| F | `isNonEmptyString` 两套语义（非 trim 版可被单空格绕过） | **已修**：`code-health-archive-boundary.ts` 统一为 trim 语义并移除 `isHumanActor` 的补丁；237 项 code-health 测试通过 |
| G | 反模式 #10 声称 signature-chain 检测 O 越权（实现不存在） | **已改文档如实化**：标注「无自动化检测——R4 允许 O 出现在任意位置，R5/R9 只覆盖代签与越权消费；完整判定依赖宿主会话日志，属人工核验」 |
| H | 人工校验派给 G（越出 G 的角色边界） | **已修**：#36 / #43 的两处「G 门禁人工校验」改为「V 评审人工核验」并注明 G 的允许动作不含核验 |
| I | 约束 #11「5 脚本每阶段门执行」无门禁核验 | **已如实标注边界**：注明门禁侧不校验这 5 个脚本是否跑过、执行责任在 G 的分派时序、机器核验需新增 run-log 规则（未实现） |
| J2 | 信息密度阈值空档 [1,2) | **已修**：`hard-constraints.md` 与 `quick-self-check.md` 统一为「< 2/章节 即命中」 |
| J3 | 两处检测信号引用不存在的字段 | **已修**：#20 的伪 action（`plan`/`implement`/`verify` 不在 run-log 27 值枚举内）改为真实判据（无 `tool_use` 块且未附产物路径）；#21 的 `phaseOption`（CLI 局部变量，不出现在 GATE_JSON）改为真实键集合 |
| J4 | 强化节空括号残留 | **已修**：清理 4 处悬空「（…，）」并为 #10 补上如实说明 |
| M | self-test 负向用例断言强度 | **经复核无缺口（两轮自身误报已撤回）**：初版扫描称 23 条无断言（因数组间字段名不同 `expectedViolationPatterns`），二版称 12 条（又漏了 `expectedRulesFailed`）。用完整字段集（`expectedRulesFailed` / `expectedReasonPatterns` / `expectedViolationPatterns` / `expectedErrorPatterns`）重扫 **213 条负向用例 → 无任何断言字段者 0 条**；本批对 self-test 的插入已全部回退（仅保留 BDD fixture 去重一处，且其 +2 行曾触发锚点规则报警，已回填） |
| N | code-health 6 个 CLI 端到端语义 | **未做**（超出本轮预算）：注意其**规则层**已由 self-test 的 `CODE_HEALTH_*_CASES`（43 条）覆盖，端到端（真实 git/工作区）语义未审计 |
| O | 其余 36 个 logic 文件的规则负载性变异测试 | **未做**（研究性任务）：本轮只对 `root-cause-logic.ts`（第一批）与 R11 全行（第二批）做过变异验证；建议按「覆盖率最低的 5 个 logic 文件」优先做 |

### 过程中的自我纠正（第二批）

1. **M 的误报**：首轮扫描用单一字段名 `expectedReasonPatterns` 判「无断言」，而 codegraph/opsx/uat 三个数组用的是 `expectedViolationPatterns` → 11 条被误判。复核后改为通用 `expected\w*Patterns` 扫描。教训同 §1.3：**先证伪自己的结论，再写进报告**。
2. **锚点规则立刻抓到我的漂移**：为 BDD 用例加两行注释后，登记册中其后 10 条 `self-test.ts:<行>` 引用全部偏移 2 行，`check-samples-coverage` 立即报出 `negative-coverage-evidence-anchor`——这正是第一批新增该规则的目的，回填后转绿。
3. **L0 链接基线二次漂移**：规则层修正给 `hard-constraints.md` 又加 1 条跨引用 → 674 → 675，按同法带 provenance 重定基线。
