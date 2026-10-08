# P0 卫生批（43.4.0）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 2026-10-09 两轮分析复核确认的全部 P0/P1 事实缺陷（7 项），版本升 43.4.0，全部通过 prepush。

**架构：** 纯文档与元数据修复批，无脚本变更、无设计决策（规格 §2 定性）。每项修复独立提交，验证走仓库既有元门禁（docs-consistency / eval 锚点 / count-claim / pre-commit 快层），收口走全量 prepush。证据支撑树横切：先建证据图（任务 0），每任务闭环对应叶子，收口全 🟢。

**技术栈：** Markdown + git；验证命令为 `npx tsx w-model-dev/scripts/cli/*.ts`、`npm run eval`、`npm run prepush`（Git Bash，全量约 27 分钟）。

**权威规格：** `docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md` §2（本计划为其任务化）。证据图：`docs/superpowers/evidence/2026-10-09-p0-hygiene-batch-evidence-graph.md`（任务 0 创建）。

**执行环境注意：** 仓库根 = `D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack`，直接在 main 分支小步提交（仓库惯例）。所有行号基于提交 `97881893` 时点，执行时以 grep 重新定位为准（内容锚点优先于行号）。

---

## 文件结构

| 文件 | 动作 | 职责 |
| --- | --- | --- |
| `docs/superpowers/evidence/2026-10-09-p0-hygiene-batch-evidence-graph.md` | 创建→更新 | 本批证据图（E1-E4 纪律） |
| `w-model-dev/subagent/testing-reality-checker.md` | 重写正文 L12-240 | 对齐根因置信度核验职责 |
| `w-model-dev/subagent/design-ux-architect.md` | 修改 L319-323 | 清除 `ai/memory-bank` 外来路径 |
| `w-model-dev/subagent/project-manager-senior.md` | 修改 L27/L35 | 清除 `ai/memory-bank` 外来路径 |
| `w-model-dev/references/hard-constraints.md` | 修改（多处表行） | #48/#18/#19/#20 表缺口 + 格式统一 |
| `AGENTS.md` | 修改 §2 两处 | application/infrastructure 目录 + references 清单补全 |
| `w-model-dev/references/phase-6-integration-test.md` / `phase-7-system-test.md` / `phase-8-acceptance-test.md` | 修改各 1 处标题 | 术语统一「返工定位表」→「返工路径」 |
| `w-model-dev/references/conventions.md` | 修改（术语表） | 登记统一后的术语 |
| `w-model-dev/templates/{requirement-spec,system-design,interface-design,detailed-design}/*.md` 共 20 份 | 各修改 L3 | 清除 DESIGN.md 死指针 |
| `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `README.md` / `CHANGELOG.md` | 版本 43.3.0→43.4.0 | 版本镜像七处联动 |
| `CONTRIBUTING.md` | 修改（发布节） | git tag 惯例成文 |

---

### 任务 0：证据图初始化

**文件：**
- 创建：`docs/superpowers/evidence/2026-10-09-p0-hygiene-batch-evidence-graph.md`

- [ ] **步骤 1：写入证据图**

```markdown
# 证据图：P0 卫生批（43.4.0）

- 计划版本：v1（规格 97881893 + 本计划）
- 图谱状态：执行中
- 批准者：用户（2026-10-09 规格批准） | 批准时间：2026-10-09

## 1. 根节点
- R1: 修复规格 §1 全部中/高严重度 P0 项并升版 43.4.0 | 状态: 🟢 | 证据: 规格表（两轮分析复核后锚点）

## 2. 枝干与叶子
| 节点 | 父节点 | 结论/假设 | 证据锚点 | 状态 | 负责人 | 验证动作 |
|---|---|---|---|---|---|---|
| L1 | R1 | reality-checker 正文错位，须重写 | testing-reality-checker.md:7/26/50/70/99 + root-cause-locator.md:251 | 🟢 | S | 任务 1 验证命令 |
| L2 | R1 | design-ux-architect / project-manager-senior 残留 ai/memory-bank 路径 | design-ux-architect.md:319-323；project-manager-senior.md:27/35 | 🟢 | S | 任务 2 grep 零命中 |
| L3 | R1 | #48 缺席两张速查表；「48」缺 # 前缀 ×2（L281 主清单 + L451 检测信号表） | hard-constraints.md:356/412/451/281 | 🟢 | S | 任务 3 grep 计数 |
| L4 | R1 | 脚本对应表缺 #18/#19/#20 行（核实结论：无意遗漏——#18 有 run-log R8 + signature-chain R9 绑定、#19 有 rootcause-report 门禁绑定、#20 无脚本但同表「无脚本」条目均有行） | hard-constraints.md:147/563-567/1009-1025；operational-recovery.md:484（R8「反模式 #18 轨迹检测」）；signature-chain-guide.md:62；agent-personas.md:746/764 | 🟢（本计划编写期已完成核实，规格 §7 L1 🟡 就此转 🟢） | S | 任务 3 行内容与绑定证据一致 |
| L5 | R1 | AGENTS.md 漏 application//infrastructure/ 与 references 清单漏项 | AGENTS.md grep "application\|infrastructure" 零命中；quickstart.md 存在而 AGENTS.md:0 命中 | 🟢 | S | 任务 4 diff 清单清零 |
| L6 | R1 | 「返工路径/返工定位表」术语分叉；统一方向=返工路径（4 处跨文档入链 vs 0 处） | grep 分布：返工路径 9 处（含 hard-constraints:313/327、subagent-delegation:1935、SSoT:2395/2650 入链）；返工定位表 3 处零入链 | 🟢 | S | 任务 5 全仓 grep |
| L7 | R1 | 子模板 20 处 DESIGN.md 死指针 | grep -rn "DESIGN\.md" w-model-dev/templates/ = 20 处，均在 L3 | 🟢 | S | 任务 6 grep 零命中 |
| L8 | R1 | 零 git tag；tag 惯例须成文 | git tag -l 空；package.json:3 = 43.3.0 | 🟢 | S | 任务 7 git tag -l |

## 3. 依赖与影响
- L3 与 L4 同文件同表（脚本对应表），任务 3 内一次编辑，失效互不影响其他任务。
- 任务 7 版本镜像七处联动（package.json / skill-metadata.json / SKILL.md / README / CHANGELOG / CONTRIBUTING / git tag），docs-consistency 为交叉验证。

## 4. 状态变更与决策日志
| 时间 | 节点 | 旧状态 → 新状态 | 触发证据 | 决策与影响 |
|---|---|---|---|---|
| 2026-10-09 | L1 | （创建即 🟢） | 两轮分析 + 交叉复核 | — |
| 2026-10-09 | 规格 §7 L1 | 🟡 → 🟢 | #18/#19/#20 绑定证据核实（见本图 L4） | 脚本对应表补 4 行，非 3 行 |
```

- [ ] **步骤 2：Commit**

```bash
git add docs/superpowers/evidence/2026-10-09-p0-hygiene-batch-evidence-graph.md
git commit -m "docs(evidence): P0 卫生批证据图初始化——8 叶子挂锚点，规格 L1 🟡 就核实结论转 🟢（43.4.0）"
```

---

### 任务 1：reality-checker 正文重写

**文件：**
- 修改：`w-model-dev/subagent/testing-reality-checker.md`（L1-10 frontmatter 不动；L12-240 正文全部重写）

- [ ] **步骤 1：确认无外部依赖旧正文**

运行：`grep -rn "RealityIntegration\|responsive-desktop\|luxury" w-model-dev/scripts/ w-model-dev/references/ eval/ docs/ --include="*.ts" --include="*.md" --include="*.json" | grep -v "subagent/testing-reality-checker" | head`
预期：零输出（无脚本/文档引用旧正文词面；personaSlice 只引用文件名 `testing-reality-checker`）。若有命中，先在证据图登记新发现再继续。

- [ ] **步骤 2：重写正文（L12 起替换为下文，frontmatter 原样保留）**

```markdown
# 现实检验者（Reality Checker）Agent

## 角色定位与身份思维模式

你是**现实检验者**，任何结论放行前的兜底证据核验角色。你的信条：**没有压倒性证据的「已完成」按未完成处理**。

- **角色**：证据核验者、放行兜底、置信度量化者
- **思维模式**：默认拒绝（default-deny）——先找证据缺口，再考虑放行；「全部通过」的自述是你的输入，不是你的结论
- **性格**：怀疑论者、彻底、证据痴迷、幻想免疫
- **经验**：你见过太多「全绿自述」在证据核对后现出原形——引用不存在的文件、缺失的 gate exitCode、与 run-log 矛盾的产物声明

## 核心职责（W 模型语境）

1. **根因报告置信度核验（canonical 场景）**：对 RootCauseReport 的根因链、证据锚点、可证伪性做现实检验，产出 `confidence ∈ [0,1]`。硬约束：confidence < 0.5 → 该报告最终 `passed=false`（权威定义见 [root-cause-locator.md](../references/root-cause-locator.md) §4.4 第 6 条）。
2. **阶段门兜底视角**：阶段门放行前对产物证据链做「声明 vs 证据」逐条核对，作为 V 评审的必含兜底视角。
3. **幻觉审批拦截**：识别无证据锚点的通过结论——无锚点的「通过」在你不核实时就会流经 CHECKPOINT。
4. **不做**：提出具体修复方案（那是 R/S 的职责）；重跑门禁（那是 G 的职责）——你只核验证据与量化置信度。

## 视角关注面（多角色讨论 / 评审）

**关注面：证据充分性 / 结论可证伪性**。核验时逐答：

1. 被核对象的每条关键结论是否都有可复核锚点（`file:line` / gate exitCode / 测试输出）？
2. 证据链是否断裂（引用文件不存在、exitCode 缺失、时间戳矛盾）？
3. 结论与证据是否一致（文档说 A 而 run-log 记 B 即矛盾）？
4. 根因/结论是否可证伪（存在「什么证据出现即推翻」的表述）？

## 产出格式

现实检验结论（供 RootCauseReport `realityCheck` 字段消费 / 阶段门兜底记录）：

| 字段 | 要求 |
|---|---|
| `persona` | 必须为 `testing-reality-checker`（canonical；`reality-checker` 仅作历史归档 legacy fallback，新产出禁用） |
| `confidence` | 数值 [0,1]；须给出扣分依据——逐项列出证据缺口；关键判据无证据直接 < 0.5 |
| `verdict` | PASS / NEEDS-WORK / FAIL（默认 NEEDS-WORK，除非压倒性证据支持 PASS） |
| `evidenceGaps` | 逐项未证实声明清单（含缺口描述与补验动作） |
| `rationale` | 判定理由，引用 `file:line` / gate exitCode 锚点 |

**落盘**：根因场景由 R persona 报告的 realityCheck 字段承载，经 R-lead 聚合进 RootCauseReport（partial 报告在 `.w-model/rootcause/partial/<reportId>/`）；阶段门场景作为 V 评审组成部分记录（`.w-model/v-reviews/`）。

## 现实检验流程（绝不跳过）

### 步骤 1：证据清点
列出被核对象主张的全部证据锚点；缺失、不可读或指向不存在的文件，逐条记入 `evidenceGaps`。

### 步骤 2：声明-证据核对
逐条对照「结论 ↔ 证据」；无锚点声明按**未证实**处理，不得因「看起来合理」放行。

### 步骤 3：置信度量化
按证据缺口扣分：每项未证实关键声明显著扣减；根因不可证伪、证据链断裂、声明与机器记录矛盾——任一出现即 `confidence < 0.5`。

### 步骤 4：结论输出
按产出格式四字段输出；rationale 中每条判断都可追溯到锚点。

## 低置信度触发条件（默认命中）

- 结论宣称「全部通过 / 未发现问题」但无逐条证据锚点
- 证据链断裂：引用产物不存在、gate exitCode 缺失或与 gate-logs 不一致
- 声明与机器记录矛盾（文档声明与 run-log / gate-logs 不符）
- 根因或结论仅凭自述、不可证伪
- 「生产就绪 / 可放行」判定缺少压倒性证据

## 沟通风格

- **引用证据**：「run-log 第 N 条记 action=produce 而 gate-log 缺失，证据链断裂」
- **质疑幻想**：「自述『全部门禁通过』但未附任何 exitCode 记录」
- **具体明确**：「confidence 0.4——根因链第 2 环无证据锚点，evidenceGaps 见条目 3」
- **保持现实**：「补齐 3 项证据缺口后重新核验；首轮 NEEDS-WORK 是正常预期」

## 边界声明

- **适用**：R 报告置信度核验（R-persona 矩阵必含）+ 阶段门放行前兜底视角（V 评审必含）。
- **换人**：需补证据链时与 `testing-evidence-collector` 并用；需技术根因深挖时让位 `engineering-incident-response-commander`（R-persona 必含项）。

记住：你是最终的现实检查。信任证据而非声明，默认寻找证据缺口，在放行前要求压倒性的证据。
```

- [ ] **步骤 3：验证**

运行：
```bash
grep -cn "luxury\|premium\|responsive-desktop\|RealityIntegration\|ai/memory-bank\|test-results.json" w-model-dev/subagent/testing-reality-checker.md
```
预期：`0`（旧剧本词面零残留）。

```bash
grep -c "confidence\|\.w-model\|root-cause\|gate exitCode\|testing-reality-checker" w-model-dev/subagent/testing-reality-checker.md
```
预期：`≥ 10`（制品与职责词汇在场）。

```bash
git diff --stat w-model-dev/subagent/testing-reality-checker.md
```
预期：diff 仅正文；frontmatter（L1-10）零变更。

- [ ] **步骤 4：证据图回挂 + Commit**

证据图 L1 状态确认 🟢 并在决策日志记「任务 1 完成，验证产物=两条 grep 计数」。

```bash
git add w-model-dev/subagent/testing-reality-checker.md docs/superpowers/evidence/
git commit -m "fix(persona): 重写 testing-reality-checker 正文——对齐根因置信度核验职责（canonical persona、confidence<0.5 硬约束、.w-model 制品词汇），清除 Web 前端测试剧本残留（43.4.0 L1）"
```

---

### 任务 2：清除 ai/memory-bank 外来路径 ×2

**文件：**
- 修改：`w-model-dev/subagent/design-ux-architect.md:317-324`（工作流程第一步代码块）
- 修改：`w-model-dev/subagent/project-manager-senior.md:27` 与 `:35`

- [ ] **步骤 1：修 design-ux-architect.md**

将 L317-324 代码块：

```bash
# 查看项目规格和任务清单
cat ai/memory-bank/site-setup.md
cat ai/memory-bank/tasks/*-tasklist.md

# 理解目标用户和业务目标
grep -i "target\|audience\|goal\|objective" ai/memory-bank/site-setup.md
```

替换为：

```bash
# 阅读派单 brief 列出的上游产物（路径以 .w-model/handoff/<dispatch-id>/brief.md 为准）
cat <brief 指定的需求/设计产物路径>

# 理解目标用户和业务目标
grep -i "target\|audience\|goal\|objective" <brief 指定的需求/设计产物路径>
```

- [ ] **步骤 2：修 project-manager-senior.md**

L27：`- 读**实际的**规格文件（\`ai/memory-bank/site-setup.md\`）`
→ `- 读**实际的**规格文件（派单 brief.md 指定的上游产物路径；阶段 1 场景通常为需求规格主文档）`

L35：`- 任务清单保存到 \`ai/memory-bank/tasks/[project-slug]-tasklist.md\``
→ `- 任务清单保存到派单 brief.md 指定的产物路径（阶段 5 编码计划场景为 \`docs/plans/<changeId>.plan.md\`，配套账本见 \`.superpowers/sdd/<plan>/progress.md\`）`

- [ ] **步骤 3：验证**

运行：`grep -rn "ai/memory-bank" w-model-dev/ docs/ AGENTS.md README.md`
预期：零输出。

- [ ] **步骤 4：证据图回挂 + Commit**

```bash
git add w-model-dev/subagent/design-ux-architect.md w-model-dev/subagent/project-manager-senior.md docs/superpowers/evidence/
git commit -m "fix(persona): 清除 design-ux-architect / project-manager-senior 残留的 ai/memory-bank 外来框架路径，改指 .w-model handoff 契约（43.4.0 L2）"
```

---

### 任务 3：hard-constraints 表修复（#48 / #18 / #19 / #20）

**文件：**
- 修改：`w-model-dev/references/hard-constraints.md`（四处：命中高发阶段表尾、脚本对应表、检测信号表 L451、主清单 L281）

- [ ] **步骤 1：命中高发阶段表补 #48 行**

定位 `| #47（大规模重构式改动） | 阶段 5 | ...` 行（约 L356），其后插入：

```markdown
| #48（子代理越界实施） | 全阶段 | [subagent-delegation.md](subagent-delegation.md) 角色表允许/禁止动作清单 + [`check-run-log.ts`](../scripts/cli/check-run-log.ts) R5 |
```

- [ ] **步骤 2：脚本对应表补 4 行（编号序插入）**

在表中编号 #17 的行之后（保持编号升序；若表内无 #17 行则插入到编号相邻两行之间），插入：

```markdown
| #18（跳过 R 直接 S 返工） | [`check-run-log.ts`](../scripts/cli/check-run-log.ts) R8 轨迹模板校验（V 失败后须先 rootcause 再 S-fix，#18 轨迹检测）+ [`check-signature-chain.ts`](../scripts/cli/check-signature-chain.ts) R9（S@fix 须携带 R 报告来源签名） |
| #19（R 报告未 V 复审） | [`check-rootcause-report.ts`](../scripts/cli/check-rootcause-report.ts)（V 复审 + exit 0 前置于 S-fix）+ [`check-signature-chain.ts`](../scripts/cli/check-signature-chain.ts) 消费链（V@rootcause 消费 R） |
| #20（只规划不执行） | 无专用脚本（检测信号 sig-008：子代理响应无 `tool_use` 块且未附产物路径；编排者/V 人工核验，见 [subagent-delegation.md](subagent-delegation.md)「反模式 #20」节） |
```

在 `| #47（大规模重构式改动） | 无专用脚本... |` 行（表尾，约 L412）之后插入：

```markdown
| #48（子代理越界实施） | [`check-run-log.ts`](../scripts/cli/check-run-log.ts) R5 role-action 配对 + [`check-signature-chain.ts`](../scripts/cli/check-signature-chain.ts) 消费链闭合（与 #10 成对；勿与 #22 混淆） |
```

- [ ] **步骤 3：格式统一（两处「48」→「#48」）**

L451（检测信号表）：行首 `| 48 | run-log role-action 配对异常...` → `| #48 | run-log role-action 配对异常...`（仅改编号格，内容不动）。

L281（主清单）：先核实主清单其余行格式——运行 `grep -n "^| #1 | \|^| 1 | " w-model-dev/references/hard-constraints.md | head -3`。若主清单统一用 `| #N |` 格式，则 L281 `| 48 |` 同步改 `| #48 |`；若主清单统一用 `| N |` 裸数字格式，则 L281 保持不动、仅改 L451。以实际格式一致性为准，两表内不得出现两种编号格式并存。

- [ ] **步骤 4：验证**

```bash
grep -c "^| #48（子代理越界实施）" w-model-dev/references/hard-constraints.md
```
预期：`2`（命中高发阶段表 + 脚本对应表）。

```bash
grep -c "^| #18（\|^| #19（\|^| #20（" w-model-dev/references/hard-constraints.md
```
预期：`≥ 5`（两张速查表新增 3 行 + 命中高发阶段表原有 #18/#19 行）。

```bash
grep -n "^| 48 |" w-model-dev/references/hard-constraints.md
```
预期：零输出，或仅剩主清单裸数字格式行（步骤 3 裁定的合法形态）。

- [ ] **步骤 5：证据图回挂 + Commit**

```bash
git add w-model-dev/references/hard-constraints.md docs/superpowers/evidence/
git commit -m "fix(docs): hard-constraints 速查表补齐 #48/#18/#19/#20——反模式 #48 入两张表，脚本对应表补 4 行（绑定证据：run-log R5/R8、signature-chain R9、rootcause-report 门禁），「48」补 # 前缀（43.4.0 L3/L4）"
```

---

### 任务 4：AGENTS.md 导航补全

**文件：**
- 修改：`AGENTS.md` §2 目录速查表（scripts 行 + references 行 + subagent 行）

- [ ] **步骤 1：生成缺失清单（diff 驱动，不只补已知两项）**

运行：`ls w-model-dev/references/*.md | xargs -n1 basename`，与 AGENTS.md §2 references 单元格逐一比对，列出所有未出现于单元格的文件名。已知缺失：`quickstart.md`、`evidence-anchored-tree.md`；以 diff 结果为准，逐一核实每个缺失文件非废弃态（在 `w-model-dev/SKILL.md` 或其他 references 中被引用即视为在役）。

- [ ] **步骤 2：修 scripts 行**

定位 §2 表中 `w-model-dev/scripts/` 行的：`...分三层：logic/（校验逻辑）+ cli/（CLI 入口）+ lib/（JSON/错误结构工具）。`——注意实际文本以 grep 为准：`grep -n "lib/（JSON/错误结构工具）" AGENTS.md`。

将「`logic/`（校验逻辑）+ `cli/`（CLI 入口）+ `lib/`（JSON/错误结构工具）。」替换为：

「五层：`logic/`（纯校验逻辑）+ `cli/`（CLI 入口）+ `lib/`（共享工具：JSON/错误结构/参数解析）+ `application/`（资产读取层：artifact-gate-assets / audit-l0-links / uat-path-mapping）+ `infrastructure/`（schema 装载与文件系统适配：schema-loader / schema-fs / evidence-fs）；分层方向与例外由 `__tests__/dependency-boundaries.test.ts` 可执行强制。」

（同句后文「**完整 exit-2 脚本 47 清单见 §8 …**」保持不动。）

- [ ] **步骤 3：修 references 行与 subagent 行**

references 单元格：在 `activation-guide（触发边界与反例登记册）` 之后追加 `/ quickstart（5 分钟上手）/ evidence-anchored-tree（证据支撑树联合分析）`（其余 diff 发现的缺失文件按同格式追加，并在证据图决策日志登记清单）。

subagent 单元格：在「36 个 Markdown 人格文件」后补「（目录平铺，以文件名前缀分 engineering / testing / design / product / project 5 类）」，替换原「分 engineering / testing / design / product / project 5 类」的目录式表述。

- [ ] **步骤 4：验证（count-claim 与 docs-consistency 口径）**

```bash
grep -c "quickstart\|evidence-anchored-tree" AGENTS.md
```
预期：`≥ 2`。

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
```
预期：exit 0（计数表述与登记一致；若报 count-claim 红灯，按其 structuredViolations 指引补登记后复跑）。

- [ ] **步骤 5：证据图回挂 + Commit**

```bash
git add AGENTS.md docs/superpowers/evidence/
git commit -m "docs(agents): 导航补全——scripts 五层结构（application/infrastructure 入册）、references 清单补 quickstart/evidence-anchored-tree、subagent 平铺前缀分类澄清（43.4.0 L5）"
```

---

### 任务 5：术语统一（返工定位表 → 返工路径）

**文件：**
- 修改：`w-model-dev/references/phase-6-integration-test.md:119`、`phase-7-system-test.md:132`、`phase-8-acceptance-test.md:200`（各 1 处标题）
- 修改：`w-model-dev/references/conventions.md`（术语表，§「术语表」L8 起）

- [ ] **步骤 1：三个标题改名**

三个文件的 `## 返工定位表` 标题改为 `## 返工路径`（正文表格形态保持不变——统一的是术语，不是形态）。

- [ ] **步骤 2：conventions.md 术语表登记**

在术语表中按现有条目排列方式插入：

```markdown
| 返工路径（rework path） | 阶段门 / V / G 未通过后的定位与回退指引。阶段 1-5 为叙述式，阶段 6-8 为表格式，术语统一为「返工路径」；旧称「返工定位表」已废弃（43.4.0 统一）。入链锚点：hard-constraints.md 命中高发阶段表 #4/#18 行、subagent-delegation.md L0-L4 表 L3 行 |
```

（若术语表非表格形态，按其实际格式等价登记。）

- [ ] **步骤 3：验证**

```bash
grep -rn "返工定位表" w-model-dev/ eval/ docs/skill-design-document_SSoT.md AGENTS.md README.md
```
预期：仅 conventions.md 新条目中的「旧称…已废弃」一处命中，其余零命中。

```bash
grep -c "返工路径" w-model-dev/references/phase-6-integration-test.md w-model-dev/references/phase-7-system-test.md w-model-dev/references/phase-8-acceptance-test.md
```
预期：每文件 `1`。

- [ ] **步骤 4：证据图回挂 + Commit**

```bash
git add w-model-dev/references/ docs/superpowers/evidence/
git commit -m "fix(docs): 术语统一「返工定位表」→「返工路径」（阶段 6-8 三处标题；向 4 处跨文档入链方向收敛，零锚点破坏），conventions 术语表登记（43.4.0 L6）"
```

---

### 任务 6：DESIGN.md 死指针清理（20 处）

**文件：**
- 修改：`w-model-dev/templates/requirement-spec/`（glossary / discipline-dod / behavior-spec）、`templates/system-design/`（6 份）、`templates/interface-design/`（6 份）、`templates/detailed-design/`（5 份）——以 `grep -rln "DESIGN\.md" w-model-dev/templates/` 实际清单为准（编写时点 20 份）

- [ ] **步骤 1：逐文件替换 L3 头注**

统一规则：`> 对应 DESIGN.md <§锚点串>。<域描述>` → `> 主模板：[<父主模板>.md](../<父主模板>.md)（引用块子文件）。<域描述>`——§ 锚点串属已废弃的外部参考文档，删除；域描述保留。按目录映射父主模板：`requirement-spec/*` → `requirement-spec.md`、`system-design/*` → `system-design.md`、`interface-design/*` → `interface-design.md`、`detailed-design/*` → `detailed-design.md`。

代表性替换（其余 17 处同规则机械执行）：

| 文件 | 旧（L3 前段） | 新（L3 前段） |
| --- | --- | --- |
| system-design/system-architecture.md | `> 对应 DESIGN.md §5 顶层架构 + §8 系统行为总览 + §9 运行时架构。系统级设计：` | `> 主模板：[system-design.md](../system-design.md)（引用块子文件：顶层架构 / 系统行为总览 / 运行时架构详述）。系统级设计：` |
| requirement-spec/glossary.md | `> 对应 DESIGN.md §3 核心概念与术语。需求域术语子集；` | `> 主模板：[requirement-spec.md](../requirement-spec.md)（引用块子文件）。需求域术语子集；` |
| detailed-design/data-model.md | `> 对应 DESIGN.md 附录 A.5 ER 图 + §21.5 store 物理层。数据级设计：` | `> 主模板：[detailed-design.md](../detailed-design.md)（引用块子文件：ER 图与 store 物理层详述）。数据级设计：` |
| interface-design/interface-contract.md | `> 对应 DESIGN.md §13.5/§13.7 接口契约 + 错误码分层 + 调用关系。模块接口级设计：` | `> 主模板：[interface-design.md](../interface-design.md)（引用块子文件：接口契约 / 错误码分层 / 调用关系详述）。模块接口级设计：` |

- [ ] **步骤 2：验证**

```bash
grep -rn "DESIGN\.md" w-model-dev/templates/
```
预期：零输出。

```bash
grep -rn "主模板：\[" w-model-dev/templates/ | wc -l
```
预期：`20`（与步骤 1 实际清单数一致）。

- [ ] **步骤 3：证据图回挂 + Commit**

```bash
git add w-model-dev/templates/ docs/superpowers/evidence/
git commit -m "fix(templates): 清除 20 处子模板 DESIGN.md 死指针——改指各域父主模板相对链接，保留域描述（43.4.0 L7）"
```

---

### 任务 7：版本 43.4.0 + CHANGELOG + git tag 惯例

**文件：**
- 修改：`package.json`、`w-model-dev/skill-metadata.json`、`w-model-dev/SKILL.md`（frontmatter）、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`

- [ ] **步骤 1：版本镜像七处联动**

```bash
grep -rn "43\.3\.0" package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md CHANGELOG.md | head -20
```
逐文件将版本声明改为 `43.4.0`（CHANGELOG 的历史条目 `## [43.3.0]` 不改；skill-metadata.json 的 `updatedAt` 改 `2026-10-09`）。SKILL.md frontmatter `version: 43.3.0` → `version: 43.4.0`。

- [ ] **步骤 2：CHANGELOG 新条目**

在 CHANGELOG.md 顶部（`## [43.3.0]` 之前）按既有条目风格插入：

```markdown
## [43.4.0] - 2026-10-09

### Fixed（P0 卫生批——2026-10-09 两轮分析复核确认项）

- **persona**：重写 `testing-reality-checker` 正文对齐根因置信度核验职责（canonical persona、confidence<0.5 硬约束、`.w-model` 制品词汇）；清除 `design-ux-architect` / `project-manager-senior` 残留的 `ai/memory-bank` 外来路径
- **references**：hard-constraints 速查表补齐反模式 #48（两张表）与脚本对应表 #18/#19/#20/#48 四行；两处「48」补 `#` 前缀
- **docs**：AGENTS.md 导航补全（scripts 五层结构、references 清单 quickstart/evidence-anchored-tree）；术语统一「返工定位表」→「返工路径」；子模板 20 处 DESIGN.md 死指针改指父主模板
- **chore**：启用 git tag 惯例（`v43.3.0` 回补，自本版起每版本打 tag，规则入 CONTRIBUTING）

证据图：`docs/superpowers/evidence/2026-10-09-p0-hygiene-batch-evidence-graph.md`（8 叶子全 🟢）。
```

- [ ] **步骤 3：CONTRIBUTING.md 发布节补 tag 规则**

定位 CONTRIBUTING.md 版本/发布相关节（`grep -n "^## " CONTRIBUTING.md` 找承载节），追加：

```markdown
- **版本 tag**：每个版本发布（CHANGELOG 条目 + 版本镜像七处更新）合入后，打 annotated tag `v<版本号>`（如 `v43.4.0`）并随推送（`git push --follow-tags`）。自 43.4.0 起；43.3.0 已回补。
```

- [ ] **步骤 4：回补 43.3.0 tag**

```bash
git tag -a v43.3.0 96841995 -m "W-Model skill 43.3.0（回补：批次 9 工程化卫生收口版）"
git tag -l
```
预期：输出 `v43.3.0`。（96841995 为 43.3.0 版本态最后一个提交；若执行时 HEAD 历史不同，以 `git log --oneline -- package.json` 找到 version=43.3.0 的最后一个提交为准。）

- [ ] **步骤 5：验证版本一致性**

```bash
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts
```
预期：exit 0（七处版本镜像一致）。

```bash
npx tsx w-model-dev/scripts/__tests__/../cli/self-test.ts 2>/dev/null | tail -3
```
预期：全通过（skill-metadata.test.ts 锁定 SKILL.md↔metadata 一致）。

- [ ] **步骤 6：Commit**

```bash
git add package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md CHANGELOG.md CONTRIBUTING.md
git commit -m "chore(release): 43.4.0——P0 卫生批收口；CHANGELOG 条目 + CONTRIBUTING 版本 tag 规则 + v43.3.0 回补"
```

---

### 任务 8：收口验证与证据闭合

- [ ] **步骤 1：eval 语料断言**

```bash
npm run eval
```
预期：exit 0（101 条映射 + coverageMatrix 六项全过——本批未动资产锚点，此步防误伤）。

- [ ] **步骤 2：全量 prepush（不推送，本地跑门禁）**

```bash
npm run prepush
```
预期：19 项全绿（实测约 27 分钟；Windows 用 Git Bash）。任何一项红 → 修复后重跑，不得跳过。

- [ ] **步骤 3：证据图闭合**

更新证据图：图谱状态 → `已归档（本批）`；8 个叶子全部 🟢 并在决策日志逐条记验证产物（grep 计数 / docs-consistency exit 0 / prepush 19 项）；R1 状态 🟢。

```bash
git add docs/superpowers/evidence/
git commit -m "docs(evidence): P0 卫生批证据图闭合——8 叶子全 🟢，验证产物回挂（43.4.0）"
```

- [ ] **步骤 4：打 43.4.0 tag 并推送**

```bash
git tag -a v43.4.0 -m "W-Model skill 43.4.0（P0 卫生批：persona 修复 / 反模式表补齐 / 导航补全 / 术语统一 / 死指针清理）"
git push && git push --follow-tags
```
预期：pre-push 钩子 19 项全绿后推送成功，两个 tag 上远端。

---

## 自检记录

1. **规格覆盖度**：规格 §2 表 7 项 → 任务 1（reality-checker）/2（memory-bank）/3（#48+#18-#20，含 🟡 L4 闭环）/4（AGENTS 导航）/5（术语）/6（死指针）/7（tag）；规格 §5 E1-E4 → 任务 0（E1）+ 各任务回挂步骤（E2/E4）+ 任务 3 绑定证据（E3 退役级证据纪律的前置示范）；规格 §8.1/8.5/8.6 → 任务 8。规格 §3/§4（子项目②③）不在本计划范围（各自独立计划）。无遗漏。
2. **占位符**：任务 6 的「其余 17 处同规则机械执行」附了完整规则 + 4 个代表性全量示例 + 统一映射表，非占位符；任务 4 步骤 1 的 diff 驱动是带核实判据的确定性步骤。无 TODO/待定。
3. **类型一致性**：证据图节点编号（L1-L8/R1）在任务 0 定义、各任务回挂引用一致；术语「返工路径」与 conventions 条目、phase 标题三处一致；版本号 43.4.0 贯穿任务 7/8。
