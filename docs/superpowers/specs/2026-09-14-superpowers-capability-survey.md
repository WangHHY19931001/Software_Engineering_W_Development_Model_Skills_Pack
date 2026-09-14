# superpowers 仓库能力调研报告（W-model 内化候选台账）

> **状态：调研报告，非决议、非设计。** 只登记"外部有什么、W-model 缺什么、冲突在哪、建议处置"，不构成任何能力声明或阶段放行依据。采纳与否由 `2026-09-14-expanded-external-skill-adoption-design.md`（v3）按 SSoT 变更流程决议。
>
> **来源锚定：** 外部仓库 `D:/w_skill_opt/superpowers`（obra/superpowers **v6.3.0**），受控 commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`（2026-08-12，Release v6.3.0）。全部 `文件:行号` 证据相对该仓库根。commit 或路径变化使本台账失效。
>
> **原文未 vendor：** 只记录结论与定位证据，未复制原文。被采纳项的原文摘录须在实现阶段 vendor 进 `docs/superpowers/sources/`（见 v3 §2.2）。
>
> **与既有调研的关系：** 本仓库已对另一个外部仓库（mattpocock/skills）完成调研并选定 M01–M18（见 [`2026-09-14-external-repo-capability-survey.md`](./2026-09-14-external-repo-capability-survey.md)）。本报告：(a) 登记 superpowers 的独立候选 S01–S32；(b) **对 5 个 M 项给出修正**（§8，多数是"改以 superpowers 版为主源"）；(c) 记录两个外部源之间的冲突。
>
> **既有边界事实：** W-model 的 `references/root-cause-locator.md:138-141` 已自述吸收过 superpowers 的 `systematic-debugging`，但**仅吸收 9 个 md 中的 `root-cause-tracing.md`**，并明确划走"运行时 bug 调试"。本报告的首要任务之一是精确复核这个边界（§4.2）。

## 0. 调研方法与边界

- **分区**：14 个技能 + 工程层（`tests/` / `hooks/` / `scripts/` / 8 个平台插件层 / 元文件 / `docs/`），共 8 个并行只读子代理。
- **覆盖度**：14 个 `SKILL.md` 及其全部附属 md（94 个 md / 29,322 行）读完；`tests/` 16 个子目录（60 文件 / 8,760 行）全量登记、重点文件精读；插件层与元文件全量清点。
- **判定口径**：每个技能给四档处置 —— 直接可内化 / 需改造后内化 / 与既有能力重叠（**须点名 W-model 资产与行号**）/ 不适用，并要求逐条列冲突。
- **对抗性要求**：明确要求区分"真能力"与"提示词风格"；**不得因"对方也做了 X"就建议采纳**——只在对方确实更强或有 W-model 缺失判据时才建议。

## 1. 仓库画像

### 1.1 定位

obra/superpowers 是"给 agent 用的工程技能集"，14 个技能，全部为 Markdown + 少量 shell/node 辅助脚本。与同时期调研的 mattpocock/skills 相比，它的技能更长（`writing-skills` 2,589 行）、更强调"纪律"（Iron Law 式硬规则），并自带一套工程设施（tests/hooks/多平台插件）。

### 1.2 工程现实：设施看似完备，实际守护强度低（对抗性要点）

| 事实 | 证据 |
| --- | --- |
| **无 CI** | `.github/` 仅 6 个文件（FUNDING / ISSUE_TEMPLATE ×3 / PULL_REQUEST_TEMPLATE / config.yml）；**无 `.github/workflows/`** |
| **`package.json` 无 `scripts` 字段** | `docs/testing.md:22` 所述 `npm test` 是空指针 |
| **`.pre-commit-config.yaml` 是死配置** | 3 个 hook 全部只匹配 `^evals/.*\.py$`，而 `evals/` 被 `.gitignore:13` 忽略且本 checkout 不存在 |
| **`tests/` 无顶层 run-all** | 仅 `explicit-skill-requests/run-all.sh`；各子目录自带 `run-tests.sh`，无总入口 |
| **技能行为验证已搬出仓库且不在 CI** | `docs/testing.md:3-6` 定义二分：`tests/` = "插件的非 LLM 代码能工作吗"；`evals/` = "agent 在真实 LLM 会话中行为正确吗"。后者由外部仓库 `superpowers-evals` 的 drill harness 驱动真 tmux 会话 + LLM-as-verifier 判定；`CLAUDE.md:102-104` + `docs/testing.md:24-35` 原文照抄："**They are not part of CI today**" |
| **强行为测试曾被删除** | `RELEASE-NOTES.md:270-272`：`test-requesting-code-review.sh` 曾往小项目**植入真 bug（SQL 注入 / 明文口令 / 凭据日志）**，断言评审子代理标为 Critical/Important **且拒绝批准 diff**；该测试已于 2026-05-06 抬进 drill 场景 `code-review-catches-planted-bugs.yaml` 并从 `tests/` 删除 |
| 留存的行为测试自我降格 | `tests/subagent-driven-development/test-...sh:1-8` 自我声明"**测的是描述召回（description-recall），不是行为**" |
| 抢跑被观测但未被强制 | `tests/explicit-skill-requests/run-test.sh:103-121` 检测"技能调用前是否已有非 Skill 工具动作"，但只 `echo WARNING`；`:132-136` 退出码仅由 `TRIGGERED` 决定 |

> **结论**：W-model 的 `.githooks/pre-push` 18 项 + 43 个 exit-2 门禁 + 332 条 self-test 在**自动守护强度上严格优于** superpowers。**不要因为"对方有 tests/ 目录"就以为它在守护什么**。superpowers 值得吸收的是**断言模式与规则文本**，不是它的守护设施。

### 1.3 平台与分发

- 仓库本身即插件，6–8 个 harness 共享同一份 `skills/`，**无 in-repo 复制**；分叉的是薄适配层，三种形态：Shape A shell-hook（Claude/Cursor/Copilot）、Shape B 进程内插件（OpenCode/pi/Hermes）、Shape C 指令文件（Gemini `contextFileName` 两行 `@`-include）（`docs/porting-to-a-new-harness.md:225-297`）。
- 唯一的"复制"是 Codex 走外部 fork 仓库：`scripts/sync-to-codex-plugin.sh` 用 rsync `-av --delete --delete-excluded` 推进镜像并自动开 PR（`:321-322`）——上游删除会同步删除镜像。
- `AGENTS.md` 是指向 `CLAUDE.md` 的**符号链接**（`git ls-files -s` → mode `120000`，全仓唯一 symlink）；`GEMINI.md` 仅 92 字节两行 include。**零冗余，故无同步问题。**

## 2. 逐技能台账

处置列：**内化** / **改造内化** / **重叠**（点名 W-model 资产）/ **参考** / **排除**。

| 技能 | md/行 | 目的 | 处置 | 关键机制与证据 |
| --- | --- | --- | --- | --- |
| writing-skills | 5/2,589 | 技能编写规范 + 技能测试方法论 | **改造内化（最高价值）** | 见 §5 S01–S05；Iron Law "NO SKILL WITHOUT A FAILING TEST FIRST"（`:374-393`）；pressure scenario 3+ 复合压力 7 类压力源（testing-skills:96-161）；micro-test 5 条协议（`:575-585`）；**Match the Form to the Failure 决策表（`:459-474`）**；description 只写 when（`:99-103,150-158`）；渐进披露阈值（`anthropic-best-practices.md:235-408,1099`）；graphviz 形状词汇（`graphviz-conventions.dot:5-33`）。**排除** `persuasion-principles.md`（Unity/Liking/Reciprocity 与 V 独立性对立）、`render-graphs.js` + graphviz 二进制（外部依赖 + 写入资产树） |
| systematic-debugging | 9/1,017 | 根因调查四阶段 + 运行时调试 | **改造内化（3 条）** | 见 §4.2 逐文件边界表。真缺口：**find-polluter 污染定位**（`root-cause-tracing.md:97-107` + `find-polluter.sh:37-68`）、**条件等待三要素**（`condition-based-waiting.md:36-46,58-107`）、**"无根因"合法出口**（`SKILL.md:266-275`）、≥3 次修复失败的技术判据（`:191-212`）、四层防御（`defense-in-depth.md:20-95,114-122`）。**排除** `SKILL.md:168-190`（Phase 4 自调查自修复，命中反模式 #18）；`root-cause-tracing.md` 主体已被吸收且 W-model 版更强 |
| subagent-driven-development | 4/1,044 | 编排协议：worktree + ledger + 每任务评审循环 + 终审 | **改造内化（5 条 L0）** | 真增量：**禁止编排者预判 findings**（`:339-344`）、Ruling 三要素（`:22-25,473-480`）、**模型档位 × 轮次 escalation + 必须显式指定模型**（`:184-219`）、reviewer 反锚定三条（`task-reviewer-prompt.md:64-92`）、**preflight 成对冲突扫描表**（`:162-182`）、scoped re-review + 逐 finding 裁决（`re-review-prompt.md:52-57`）。**完全被 W-model 覆盖**：文件化交接、ledger/compaction 恢复、上下文预算、实现者不派子代理、返工上限升级人。**排除**：O 自主裁决（`:366-371,411-429`）、"不 stall 不问人"（`:17`）、并行 implementer（`:282`）、无 R 的 fix loop（命中 #18） |
| test-driven-development | 2/518 | RED-GREEN-REFACTOR + 好测试定义 | **改造内化（改为主源）** | 见 §8 修正 M03/M07。独有：**change detector（`expect(MAX_RETRIES).toBe(5)` 类常量断言）**（`writing-good-tests.md:41-46`）、**string-presence trap**（`:48-53`）、**Mutation Check 5 类变异**（`:157-169`）、**mock 三条硬规则**（`:99-133`）、"Name the break" 前置门（`:23-25`）。**排除**：Iron Law 的自动删除（`:37-45`，与 CHECKPOINT / 硬约束 #46 冲突）、例外自裁 |
| brainstorming | 3/598 + 5 脚本 | 设计探索 + 三路径 router + 视觉伴生 | **改造内化（文本内核）** | 三路径 router + 单向棘轮（`SKILL.md:22-52`）、"ceremony scales with the task; the approval gate never does"（`:14-20`）、失败模式命名 "presenting the design and starting in the same breath is skipping the gate"（`:91`）、spec self-review 4 项（`:211-219`）、独立 spec reviewer + calibration（`spec-document-reviewer-prompt.md:19-34`）、CHECKPOINT 呈现内核 4 条（`visual-companion.md:7,127-136,277` + `SKILL.md:240`）。**排除** 5 个脚本（1232 行非 Markdown/TS；`server.cjs:106,242-252` 默认注入外部品牌图 = CDN 式外链；`.superpowers/brainstorm/` 状态目录 = 平行事实源） |
| using-superpowers | 6/329 | 元技能：调用前置 + 优先级 + 平台映射 | **参考 + 排除** | 正文仅"process skill 先于 implementation skill"一条可文本化。**排除强制注入机制**：其强制力来自 `hooks/session-start:11,27`（SessionStart 注入）与 `.opencode/plugins/superpowers.js:66-92`（pre_llm_call），不引 hook 则只剩弱约束；且 `run-hook.cmd:37-39` 是 **fail-open 静默降级** |
| requesting-code-review | 2/276 | 派发 reviewer + 评审者提示词模板 | **改造内化（1 条）** | 评审包 4 字段 `{DESCRIPTION}/{PLAN_OR_REQUIREMENTS}/{BASE_SHA}/{HEAD_SHA}`（`code-reviewer.md:36-40`）、reviewer 只读且不得再派 reviewer（`:33-44`）、**"不要相信报告"**（`task-reviewer-prompt.md:64-71`）、双轴 rubric（Spec Compliance × Code Quality，`:94-138`）。W-model 的 V 五轴 + R13 + 签名链更强；真增量是 S07 |
| receiving-code-review | 1/205 | 接收评审意见的纪律 | **改造内化（1 条）** | 六步 READ→UNDERSTAND→VERIFY→EVALUATE→RESPOND→IMPLEMENT（`:16-25`）、**任一条不清即停机、禁止部分实施**（`:40-57`）、**技术质疑权 6 条清单**（建议破坏既有功能/reviewer 缺上下文/违反 YAGNI/技术栈不正确/兼容性/与人类架构决策冲突，`:113-129`）、YAGNI 现实核查（`:88-98`）、禁表演式附和（`:29-38`）。W-model 的 V→R→V→G→S-fix 已覆盖约 70%；真增量是 S08 |
| finishing-a-development-branch | 1/225 | 分支收尾（验证→菜单→执行→清理） | **改造内化（1 条）** | 清理**拥有权判定**：仅清理 `.worktrees/`/`worktrees/` 下的，非自建的绝不清理（`:159-201,221`）；`git worktree prune` 自愈（`:169-174`）；"PR 未落地前 worktree 不删"（`:220`）；丢弃须键入 `discard`（`:132-157`）；绿测前置且"绿色只证明它跑过的那棵树"（`:216`）。W-model 无分支合并模型 → 只取 worktree 清理纪律（S23） |
| using-git-worktrees | 1/167 | 隔离工作区 | **改造内化** | Step0 检测已隔离 + **submodule 守卫**（`:26-33`）、**建前先取用户同意**（`:41-45`）、原生工具优先（`:12,164`）、**`git check-ignore` 强制且未忽略先加 .gitignore 并 commit**（`:80-88`）、**clean baseline 强制**（`:121-133,167`）、本技能不清理（清理由 finishing 承担） |
| writing-plans | 2/220 | 写实现计划（假定执行者零上下文） | **改造内化（1 条）** | **No Placeholders 七条黑名单**（`:131-139`，含 TBD/"add appropriate error handling"/"Write tests for the above"/"Similar to Task N"/只描述不展示/引用未定义类型）；Buildability 判据（`plan-document-reviewer-prompt.md:25`）+ calibration（`:29-34`）；`## Global Constraints` 节（`:72-77`）；任务右尺寸判据"可被独立否决即拆分"（`:36-43`）。**否决**：`**Files:** path:N-M`（`:87-90`）与内联完整实现（`:100-116`）——与 W-model 票据 durability 正面冲突（禁令见 `phase-5-coding.md:166-173`） |
| executing-plans | 1/64 | 逐任务执行计划（无子代理降级路径） | **参考** | 三步（`:16-38`）、停手条件（`:42-48`）、"Never start implementation on main/master without explicit user consent"（`:64`）；`:14` 明写有子代理时改用 SDD。**排除 batch 语义**（`:29` "Follow each step exactly" 会压掉逐票据 V/G） |
| dispatching-parallel-agents | 1/167 | 并行分派判据 | **参考** | 判据树（`:18-45`）+ **四条"不可并行"**（失败彼此相关 / 需完整系统状态 / agent 互相干扰 / 探索性调试，`:36-45,129-134`）。W-model 的 parallel/serial/degraded 降级 + R3×3 更强；整合验证（人工 spot check，`:161-167`）被 V/G 覆盖 |
| verification-before-completion | 1/120 | 完成声明前的证据强制 | **改造内化（2 条）** | Iron Law "NO COMPLETION CLAIMS WITHOUT **FRESH** VERIFICATION EVIDENCE"（`:14-20`，"in this message"）、**5 步 Gate Function**（`:24-36`）、**"声明 → 必需证据 → 不足证据"负例表**（`:40-48`）、**回归测试回滚证伪协议**（`:82-86`：Write→Run(pass)→**Revert fix→Run(MUST FAIL)**→Restore→Run(pass)）。W-model `command-reference.md:150-155` 已覆盖测试类声明；真增量是 S27 与"非测试声明" |

## 3. 工程层台账

### 3.1 `tests/`（60 文件 / 8,760 行 / 16 子目录）

三类测试形式泾渭分明：

1. **脚本/工具的黑盒断言**（bash，多数）：`mktemp -d` 造 fixture → 跑被测脚本 → `grep -Fq` 断言输出/退出码 → 统计 FAILURES。
2. **monkey-patch 插桩**（node）：`opencode/test-bootstrap-caching.mjs:14-29` 替换 `fs.existsSync/readFileSync` 计数，断言"第二次 transform 零额外读盘"——**不可见副作用的定量断言**。
3. **真实 agent 黑盒**（bash + 真 `claude -p`）：`explicit-skill-requests/`、`claude-code/`。**无快照测试、无 mock LLM**。

**平台 manifest 测试**（kimi/devin/antigravity/codex）设计上只做**结构 + 字段存在性 + 版本登记**断言，但顺带做了**负向校验**：拒绝不该出现的字段（`kimi/test-plugin-manifest.sh:71-86` 拒绝 `tools/hooks/inject/configFile` 等）。属"平台契约白名单"而非行为验证。

**明确更正**：`tests/pi` 并非 0 行——`tests/pi/test-pi-extension.mjs` = 137 行、`.pi/extensions/superpowers.ts` = 121 行；`tests/` 下唯一 0 行文件是 `tests/hermes/__init__.py`（包占位）。

### 3.2 `hooks/`（4 文件）

- `hooks/hooks.json:3-14` 注册 `SessionStart`，matcher = `startup|clear|compact`，`shell: "bash"`。
- `hooks/session-start:11` 把**整份 `skills/using-superpowers/SKILL.md`（含 frontmatter）**原样读出，`:27` 包进 `<EXTREMELY_IMPORTANT>` 写入会话上下文；`:38-46` 按平台环境变量输出**三种互斥 JSON 形状**（Cursor `additional_context` / Claude `hookSpecificOutput{additionalContext}` / 其余 `additionalContext`）。注释 `:33-34` 点明 Claude Code 会同时读两个字段且不去重 → 多发一个字段就**双重注入**。
- `hooks/run-hook.cmd` 是**同时合法于 cmd.exe 与 bash 的 polyglot**；`:21-35` 先找 `C:\Program Files\Git\bin\bash.exe` 再找 PATH 上的 bash；找不到时 `:37-39` **静默 `exit /b 0`**（注释："plugin still works, just without SessionStart context injection"）。`docs/windows/polyglot-hooks.md` 说明 hook 脚本**必须无扩展名**、`.gitattributes` 专门锁 LF。

### 3.3 `scripts/`（4 文件）

- `bump-version.sh` + `.version-bump.json`（9 条 path+field 的声明式多点清单，含 `plugins.0.version` 嵌套路径）：三模式 `--check`（collect + `sort -u` 判漂移）/ `--audit`（**先算当前版本再全仓 grep 该版本字面量，凡命中但不在清单里的文件全部列出**）/ bump（`preflight_manifests()` 逐条预检可读性，yaml 用 `select(tag == "!!str")` 拒绝非字符串版本）。
- `lint-shell.sh`（212 行）、`sync-to-codex-plugin.sh`（15K，`:12-13` 承诺"同一 upstream SHA 跑两次产出 diff 完全相同"）、`package-codex-plugin.sh`（10K）。

### 3.4 元文件

`README.md` / `AGENTS.md`（→ symlink 到 CLAUDE.md） / `CLAUDE.md` / `GEMINI.md`（92 字节）/ `RELEASE-NOTES.md` / `.pre-commit-config.yaml`（死配置，见 §1.2）。

## 4. 重点专题

### 4.1 `writing-skills` 与四个元理论概念

W-model 在 mattpocock 调研中识别出的缺口是"技能编写元理论层（No-op / Negation / Predictability / 信息层级阶梯）"。superpowers 的 `writing-skills` 逐条覆盖情况：

| 概念 | 覆盖度 | 证据与判定 |
| --- | --- | --- |
| **Negation** | **覆盖且远超 M02** | `SKILL.md:459-474` 的 **Match the Form to the Failure** 决策表：按 baseline 失败类型选形式（压力下明知故犯→禁令 + rationalization 表；**遵循了但输出形状错→正向 recipe，用禁令会反噬**；漏必填项→结构化 REQUIRED 字段；条件依赖→可观测谓词）。量化排序 `:470`：禁令臂产出的 unwanted content 明显多于 recipe 臂且**劣于 no-guidance 对照**。另两条硬子规则：**No nuance clauses**（`:473`，"Don't X unless it matters" 把胜出 recipe 从 consistent 降为 noisy）、**Exemption clauses don't scope**（`:474`，"此限制不适用于代码块" 仍压制代码块，要重构使规则触不到）。作用域自限：禁令式 bulletproofing **只对 discipline 失败有效**（`:480`） |
| **No-op** | **覆盖（授权时）** | `:580` "Always include a no-guidance control. If the control doesn't exhibit the failure, there is nothing to fix — **stop, don't author the guidance**"；`:645` 写入 GREEN checklist。是**授权前的必要性门禁**，非存量剪枝 |
| **信息层级阶梯** | **覆盖最完整，带数字阈值** | 4 层运行时阶梯（startup 只预载 name+description → 触发后读 SKILL.md → 按需读 reference → **脚本执行而不载入上下文**）（`anthropic-best-practices.md:1013-1051,921-928`）；body **<500 行**（`:241-242,1099`）；**>100 行拆独立文件**、**<50 行内联**（`SKILL.md:84-91`）；词数 **<150/<200/<500**（`:217-220`）；**引用最多一层深**（`:353-381`）；**>100 行 reference 加 TOC**（`:383-385`）；描述性文件名（`:1027`） |
| **Predictability** | **部分覆盖（最弱）** | 唯一原文 `SKILL.md:583`："**Variance is a metric.** When guidance lands, reps converge on the same shape. Five different interpretations across five reps means the wording isn't binding — tighten the form before adding words."。方向正确但**无指标、无阈值（除"5 reps"轶事）、无测量协议** |

**技能测试主张**：Iron Law "NO SKILL WITHOUT A FAILING TEST FIRST"（`:374-393`，明确适用"编辑既有技能"）；RED = 不给技能跑压力场景、逐字记录 rationalization；压力场景须 **3+ 种复合压力**、7 类压力源（time/sunk cost/authority/economic/exhaustion/social/pragmatic）、必须可选 A/B/C、真实约束、"What do you do?"、不给 easy out（`testing-skills-with-subagents.md:96-161`）；**micro-test 5 条协议**（每次一个 fresh-context 样本、恒带 no-guidance control、每变体 5+ 次、逐条人工读、variance 是度量）（`SKILL.md:575-585`）；meta-testing（问"怎样写才能让你明确只有 A 可接受"）（`:240-265`）。

**对抗性发现**：本分区**最强的两条机制**（`:470` 的量化排序、`:154` 的因果事故链）**均无随仓 fixture / 数据 / 脚本支撑**，且文档自己在 `:470` 尾句退让"micro-test your own case rather than assuming"。引入时应作为**待本地 A/B 的假设**，不是既定事实。另：全仓**无任何技能资产的确定性校验器**（`tests/writing-skills/` 唯一的 113 行测试是 `render-graphs.js` 的 shell 测试）；1024/64 字符上限、name 字符集、description 格式**全部无强制**；`anthropic-best-practices.md:752-754` 自认"We do not currently provide a built-in way to run these evaluations"。

**内部矛盾（采用前须择一）**：`anthropic-best-practices.md:187-199` 要求 description 含 "what + when"，`SKILL.md:150` 要求 "ONLY when, NEVER what"。**取 `SKILL.md` 版**（有因果事故支撑，`:154`）。

### 4.2 `systematic-debugging` 逐文件吸收边界（复核 W-model 声称的边界）

W-model `root-cause-locator.md:140-141` 自述只吸收 `root-cause-tracing.md` 原则。逐文件复核：

| 文件 | 核心规则 | 是否已吸收（W-model 证据） | 判定 |
| --- | --- | --- | --- |
| `root-cause-tracing.md` | 反向追踪到原始触发点，fix at source；`NEVER fix just where the error appears`（`:130-154`） | **已吸收**：`root-cause-locator.md:140-143` + `:82-88`（根因可证伪/禁现象当根因）+ `:44-57`（缺陷链/上游回溯） | **重复**，W-model 更强（跨产物缺陷链 + `root-cause-logic.ts:274-277` 的 `[若...则]` 正则强制） |
| `SKILL.md`（四阶段） | Iron Law + 4 阶段 + 红牌 11 条 + rationalization 8 条 + 3+ 失败质疑架构 | 部分：`hard-constraints.md:61`（反模式 #18）、`root-cause-locator.md:76-77,85` | **互补**。W-model 的"必须先 R"是**脚本强制**（`root-cause-logic.ts` + run-log），superpowers 是提示词自律 → 此维度不可反向采纳 |
| `defense-in-depth.md` | 四层防御（入口/业务/环境守卫/插桩）+ **逐层测"试绕第 1 层验证第 2 层真接住"** | **未吸收**（全仓 grep 仅命中严重度措辞与人格描述） | **互补**，属 S 的编码质量而非 R |
| `condition-based-waiting.md` | 条件轮询替代任意 sleep；三反模式（轮询过快/无 timeout/getter 在循环外取陈旧数据）；任意超时唯三要素 | **未吸收**（grep `flaky/轮询/polling` 仅命中事故复盘与 plans，`references/` 零命中） | **真缺口**，且 W-model 已付代价（见 §6 X 条） |
| `find-polluter.sh` | 逐文件跑测试，停在第一个污染源 | **未吸收**（grep `polluter/污染源` 全仓 = 0） | **真缺口**（唯一可执行的确定性工具） |
| `condition-based-waiting-example.ts` | `waitForEvent` / `waitForEventCount` / `waitForEventMatch` | 未吸收 | 与上同源 |
| `CREATION-LOG.md` / `test-academic.md` / `test-pressure-{1,2,3}.md` | 技能元层与自验证语料 | 未吸收 | **参考**（压力场景可作 V 的 persona 素材，非机制） |

**被划走的部分里，是真缺口的共 4 类**：污染源二分定位（F）、条件等待三要素（E）、"无根因"合法出口（J）、≥3 次失败的技术判据（G）。其中 **J 最尖锐**：`check-rootcause-report.ts` R2 强制 `rootCauseChain` 长度 [2,5] 单链、R3 强制 `[若...则]`（`root-cause-logic.ts:234-277`），当现象真是环境/时序型时 schema **没有合法分支** → 门禁会诱发"为过门禁而编造一条可证伪根因链"。`SKILL.md:266-275` 恰好补这个洞（并警示"95% 的'无根因'是调查不完整"）。

### 4.3 与 mattpocock 源的关系（两个外部源的取舍）

| 判据 | superpowers | mattpocock | 取舍 |
| --- | --- | --- | --- |
| RED 失败证据（M07） | `test-driven-development/SKILL.md:113-128` 强制运行、**区分 failure 与 error**、失败原因须匹配 | **完全缺失**（`tdd/SKILL.md:36` 只要求"先写失败测试"） | superpowers 严格更强 |
| 测试质量反模式（M03） | 有 change detector / string-presence / Mutation Check / mock 三条硬规则（均独有） | 有 tautological / implementation-coupled 命名 + mock 边界清单 | superpowers 更强（除下述） |
| **seam 选择** | **无 seam 概念** | `tdd/SKILL.md:18-26` "Test only at pre-agreed seams… No test is written at an unconfirmed seam" | **mattpocock 独有，须保留** |
| **水平切片命名** | 有"one test → one minimal implementation"但**未命名反模式** | `tdd/SKILL.md:32` 明确命名 anti-pattern + tracer bullet 语义 | mattpocock 更强 |
| R 入场门（M05） | 仅三问（能可靠触发？确切步骤？每次发生？`SKILL.md:58-62`），**无四项验收** | 四项验收 + red-capable 断言用户确切症状 + "造不出就 blocked" | mattpocock 更强 |
| 假设数量 | **单一假设**（`SKILL.md:147-150` "Form Single Hypothesis"） | **3–5 条排序可证伪假设**（防锚定，`diagnosing-bugs/SKILL.md:90`） | **mattpocock 胜**（superpowers 的单假设会锚定在第一个看似合理的主意上） |
| loop 构造法（M17） | **无方法库** | 10 种按序 | mattpocock 独有 |
| 完成证据形式 | `verification-before-completion` 整份（claim→证据→不足表 + 5 步 Gate Function） | 无对应技能 | superpowers 独有 |
| 四层防御 / 条件等待 / 污染定位 / Mutation Check / mock 深度 | 独有 | 零覆盖 | superpowers 独有 |

> **结论**：两个源**互补而非替代**。M05/M17 **保持 mattpocock 为主源**；M03/M07 **改以 superpowers 为主源**；seam 规则单列为 M 侧保留项；S19–S22 为 superpowers 独有增量。

## 5. 候选机制矩阵（S01–S32）

层：**A** = 纯 L0 文本（零新脚本）；**C** = 确定性门禁/fixture 扩展。

| ID | 机制 | 证据 | W-model 缺口（点名资产） | 层 | 冲突 |
| --- | --- | --- | --- | --- | --- |
| S01 | **Match the Form to the Failure**（按失败类型选指令形式）+ No nuance clauses + Exemption clauses don't scope | `writing-skills/SKILL.md:459-474,480` | `hard-constraints.md:186` 反模式主表为**单形态**（"命中 #N 一律回退"），无按失败类型分流的判据 | A | 无（**修正 M02**） |
| S02 | description 只写 when、绝不概括工作流（含因果事故链与正反例） | `:99-103,150-158,160-197` | **现网违规**：`w-model-dev/SKILL.md:4-10` 的 description 概括了工作流又挂长串 "Do NOT use for…" 否定链 | A | 无 |
| S03 | 渐进披露数字阈值（body<500 行 / >100 行拆 / <50 行内联 / 引用一层深 / >100 行加 TOC）+ 指针约定（REQUIRED SUB-SKILL 标记、**禁 `@` 深链**及其 200k context 成本） | `anthropic-best-practices.md:235-408,1099`；`SKILL.md:84-91,217-220,278-288` | W-model 的"按需加载"是原则，**无阈值、无指针写法规范**（`references/` 约 30 份；AGENTS.md 反例 #5 只有禁令） | A | 无（**替代 M01 同类条目为权威数值**） |
| S04 | no-guidance control 的**"授权不写"**语义：control 不复现失败即不得写这条规则 | `SKILL.md:580,645` | 全仓无"这条规则是否 no-op"的检查 | A | 无（与 M01 的存量剪枝**互补双持**） |
| S05 | **机械约束→自动化，文档只留判断题** | `SKILL.md:59` | L0/L1 分层已实现（`audit-l0-links.ts`、SSoT §3.5）但**缺判定准则** | A | 无 |
| S06 | **禁止编排者预判 findings**（不得在 dispatch prompt 写 "do not flag"/"at most Minor"/"the plan chose"） | `subagent-driven-development/SKILL.md:339-344` | W-model 全库无此规则；`check-verifier-output.ts` 只校验 V 的输出，**拦不住 O 在提示词里暗示 V 放水** | A | 无（封 V 独立性最后漏洞） |
| S07 | **"不信任报告"**：作者 rationale 是 claim、**不得降级 finding 严重度**；plan 作者不自评自己的 plan；test output 的 warning 本身即 finding | `task-reviewer-prompt.md:64-71,84,152-157` | W-model 有反模式 #45 与行号证据要求，**无"不得以 S 自辩降级"与"plan 作者不自评"** | A | 无 |
| S08 | 面向 V finding 的**误报/不必要质疑通道**（回流新 V，**不得由 O 裁决**） | `receiving-code-review/SKILL.md:76-84,88-98,113-129` | W-model 只有 S 简报可执行性（`subagent-delegation.md:419`）与 TLA+ state-machine 误报豁免（`tla-plus.md:770-774`），**无通用通道** | A | 须**禁止** O 裁决（反模式 #10 / #41 入口） |
| S09 | scoped re-review：只审 fix delta + **逐 finding 判 ADDRESSED/NOT ADDRESSED**（"**Attempted is not addressed**"）+ Minor 不进 loop | `re-review-prompt.md:52-57`；SDD `:361-365,372-373` | W-model 返工是"重跑 V/G 评产物"，**无 finding 级处置状态** → S-fix 可能只修一部分而门禁仍放行 | A | 须**保留 R 前置**（否则命中 #18） |
| S10 | **Ruling 三要素** `Ruling: <决定> — <为什么> — <若错代价>` + 收尾穷尽上缴用户 | SDD `:22-25,473-480` | W-model 有 decision/`acknowledgedDecisions` 与 CHECKPOINT，**无"若错代价"字段与穷尽上缴义务** | A | 剥离其"不 stall 不问人"的自主性 |
| S11 | **模型档位 × 修复轮次 escalation + 必须显式指定模型**（不指定即继承最贵模型） | SDD `:184-219` | `estimation-guide.md:44-50` 只有"档位 × 思考预算"的**估算**准则，**无执行期选档规则** | A | 无 |
| S12 | **preflight 成对冲突扫描表**（逐对共享文件/接口的任务 + 逐任务文本自洽；输出必须是表不是结论） | SDD `:162-182` | `phase-5-coding.md:175-186` 有 blocking edges DAG + frontier，**无逐对共享面扫描** | A | 无 |
| S13 | **"无根因"合法出口**（真环境/时序/外部 → 走完流程 + 记录调查 + 实现重试/超时/错误提示 + 加监控）+ "95% 的'无根因'是调查不完整" | `systematic-debugging/SKILL.md:266-275` | `check-rootcause-report.ts` R2 强制单链 [2,5]、R3 强制 `[若...则]`，**真环境型现象无合法分支** → 诱发编造根因链 | A | 须新增显式分支，**不得放松 R2/R3** |
| S14 | **≥3 次修复失败的技术判据**（每个修复暴露新的共享状态/耦合且位置不同 / 修复要求大规模重构 / 每个修复在别处产生新症状 → "这不是假设失败，而是架构错误"） | `SKILL.md:191-212` | `operational-recovery.md:322,330` 有 `maxReworkRounds` **预算升级**，缺**收敛性技术判据** | A | 无 |
| S15 | **三路径分诊 + 单向棘轮 + 分类口播**（spike / bounded / architectural；"Nothing downgrades mid-task"；"给贴标签的动机本身即怀疑"；分类须说出口让用户可否决） | `brainstorming/SKILL.md:22-52,63-73` | W-model 只有阶段级流程，**无"这个请求不值得开阶段 1-4 文档仪式"的合法降级出口** | A | **须改造**：bounded **不得成为绕过阶段门/CHECKPOINT 的后门**；"每消息一个问题"与 M04 frontier 冲突（M04 胜） |
| S16 | spec self-review 4 项（placeholder/consistency/scope/ambiguity）+ **独立 spec reviewer + calibration 阈值**（"只报会导致下游规划真问题的问题；除非有严重缺口否则批准"） | `brainstorming/SKILL.md:211-219`；`spec-document-reviewer-prompt.md:19-34` | 与 W-model V 角色同构；**真增量是 calibration**（可治 V 过度判负） | A | 无 |
| S17 | **CHECKPOINT 呈现内核 4 条**：逐问判定（"看见比读到更清楚吗"）/ 2-4 选项 / **后撤屏（推进时显式作废上一问的呈现物）** / **提议独占一条消息** | `visual-companion.md:7,127-136,277`；`SKILL.md:240` | 与 M04 同位置可合并；后撤屏与"提议独占一条消息"是 M04 未涉及的**消息类型规则** | A | 分节逐节批准与 M04 Push right 冲突（**M04 胜**） |
| S18 | **No Placeholders 黑名单**（源文 **6 条**，见 §10：TBD / "add appropriate error handling" / "Write tests for the above"（无实际测试码）/ "Similar to Task N"（须重复代码）/ 只描述不展示 / 引用任何任务都未定义的类型函数）+ Buildability 判据 | `writing-plans/SKILL.md:131-139`；`plan-document-reviewer-prompt.md:25` | W-model 票据只有 durability 禁令（禁路径/行号，`phase-5-coding.md:162`），**无"占位符/不可执行"黑名单** | A | 路径类黑名单须换成**符号类** |
| S19 | **Mutation Check 5 类变异**（错误常量/参数、错误分支、缺失状态变更/副作用、空或 default 返回、零/空/nil/未授权/畸形输入缺校验）+ 判据"a mutation nothing catches marks the behavior as unprotected — or the test as tautological" | `test-driven-development/writing-good-tests.md:157-169` | `hard-constraints.md:333` 明示 **"#45 无专用脚本（V 评审人工核验）"** | A/C | 无（可先作 V checklist，后可接变异工具做门禁） |
| S20 | **Mock 三条硬规则**：替换前先学真实方法全部副作用（`writing-good-tests.md:99-102`）/ mock 响应必须**镜像完整真实结构**（all documented fields，部分 mock 会在下游读缺失字段时静默通过，`:119-123`）/ **仅测试调用的方法不得作为生产类方法**（`:125-127`）；mock 装配量超过测试逻辑时改真组件集成测试（`:129-133`） | 同上 | **W-model 零覆盖**；反模式 #45 症状描述亦未覆盖"mock 结构不完整导致集成断裂"；其 `samples/` fixture 驱动形态亦无 mock 纪律 | A | 须限定作用域为"被测生产代码"，**不得波及门禁脚本自身的 fixture 契约** |
| S21 | 测试质量独有判据：**change detector**（`expect(MAX_RETRIES).toBe(5)` 类常量断言，`:41-46`）/ **string-presence trap**（断言脚本/技能/配置含某行文本，`:48-53`）/ **"Name the break" 前置门**（写测试体前先答"哪个生产变更会让它失败，且该变更属 bug 而非决策"，`:23-25`）/ **期望值独立推导**（禁用被测代码或其 helper 计算期望值，`:27-39`） | `writing-good-tests.md` | 同上（#45 无脚本）；其中**期望值独立推导**与 change detector 可做**静态启发式检测**（断言两侧是否共享 symbol/调用） | A/C | 无 |
| S22 | **条件等待三要素**（先等触发条件 / 基于已知节奏而非猜测 / 注释说明原因）+ **三反模式**（轮询过快 / 无 timeout / getter 在循环外取陈旧数据） | `condition-based-waiting.md:36-46,58-107` | W-model 已记录**两起 flake 事故**，现处置是"放宽上限 / 受控交错"（治症状），**未覆盖"等待真实条件"** | A | 须写明三要素，否则会被读成"禁止一切 sleep"（与"提高复现率注入 sleep"用途混淆） |
| S23 | **worktree 隔离五条**：Step0 已隔离检测 + **submodule 守卫**（`--show-superproject-working-tree`）/ 建前取用户同意 / 原生工具优先（绕过会产生 harness 看不见的 phantom state）/ **`git check-ignore` 强制**（未忽略先加 .gitignore 并 commit）/ **clean baseline 强制**（"A dirty baseline makes every later failure ambiguous"）+ 清理拥有权判定 + `git worktree prune` 自愈 | `using-git-worktrees/SKILL.md:12,26-33,41-45,80-88,121-133,164-167`；`finishing-a-development-branch/SKILL.md:159-201,220-221` | W-model `.worktrees/` 已 gitignore 且**已真实踩坑**（两个残留 checkout 含 node_modules 致 docs-consistency CLI 探针 30s 超时），当前**只靠修 fixture 打补丁、零纪律资产** | A | **worktree 有独立 `.w-model/`** → 与 `wm-write.ts` 单写者锁 + "不引入平行事实源"冲突，须先定规则 |
| S24 | **污染源二分定位**：出现不该出现的产物但不知哪个测试造成 → 逐文件跑，停在第一个污染源 | `root-cause-tracing.md:97-107`；`find-polluter.sh:37-68` | W-model 有 1,600+ 测试与 18 项 pre-push **却零污染定位工具**，且已真实经历并行事故 | C | 须重写为 vitest 语义 + 检查对象扩展到 `.w-model/` 残留/锁/`coverage/`；保留 `\|\| true` 语义并显式注释；**只能作按需工具，不得当门禁**（逐文件跑全量会压垮 pre-push） |
| S25 | **规则负载性因果测试**（RED/GREEN/PRESSURE 三相位：**移除该规则文本后必须复现旧行为**；RED 相位把"出现新行为"判为 UNEXPECTED 失败） | `tests/claude-code/test-worktree-native-preference.sh:10-19,87-89,115-119` | W-model 有 30+ 份**散文 L0 规则**却**零因果测试**——**没有任何测试证明"删掉这条规则，违规就会复现"**。M06 只证"违规会被抓"，此项证"没有这条规则就会出错" | C | 无（**超越 M06**） |
| S26 | M06 补强：**fail-closed + 状态逐字节不变**（注入违规后断言 fixture 未被污染） | `tests/version-bump/test-bump-version.sh:61-74`（`cmp -s` 前后 manifest）；`tests/codex-plugin-sync/…:698-708`（退出 1 + 保留被改文件 + 不建分支） | M06 只要求"必须失败"，**不要求"失败时没留下半成品"**；W-model 除 `wm-write.ts` 外 43 个门禁的副作用路径无此断言 | C | 无 |
| S27 | **回归测试回滚证伪协议**：`Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass)` | `verification-before-completion/SKILL.md:82-86` | 约束 #14（`hard-constraints.md:81`）只要求"改动后跑回归"，**无法排除回归测试本身是永真测试** | C | 无（可用既有 `assertionHash` 模式表达为 `revertEvidence`） |
| S28 | **"断言必须能失败"的自检纪律**：瞄准最小证据单元 + 注释写明它防的那个回归（"若改成匹配全文则此回归会漏过"） | `tests/pi/test-pi-extension.mjs:125-136`；`tests/hermes/test_bootstrap.py:66-68`（用特征行证明嵌入的是真 `SKILL.md` 而非 stub） | 是 M06 的**前置条件**：夹具若无法区分"规则在咬"与"规则是空操作"，注入违规也会假通过 | C | 无 |
| S29 | **测试替身保真**：mock 复刻历史 bug 的真实契约，让回归"响亮失败"而非静默通过 | `tests/hermes/conftest.py:15-25`（故意对非 `Path` 抛错，注释写明 2026-07-23 真实静默失效） | 成本近零，能阻止"修复被静默回退"；W-model 无此纪律 | C | 无 |
| S30 | **定量预算断言**：内容尺寸/加载量上限并打印实际值 + 说明溢出后果 | `tests/hermes/test_bootstrap.py:13-16,95-98`（10,000 字符上限） | W-model 关心上下文成本（约 30 份 references + 28 人格按需加载）但**无任何数值门禁** | C | 无 |
| S31 | **完整性审计**：declared-list + **全仓 grep 该事实字面量，凡命中但未登记的文件全部列出**（区别于"计数相等"） | `scripts/bump-version.sh:152-215` | `check-docs-consistency.ts` 做的是**计数相等**（schema 34 / action 27 / 反模式 #1-#48 / pre-push 18 / exit-2 43）；本项抓"新增了引用该事实的文件却忘了登记" | C | 无（正交互补） |
| S32 | **评审包物化为确定性单文件**（commit list + `git diff --stat` + `git diff -U10` 合成一个文件按 range 命名；reviewer 一次 Read 即得，**不进编排者上下文**） | `subagent-driven-development/scripts/review-package:7-9,32-43` | W-model 阶段 5-8 的 V 拿的是产物路径，**无"一 Read 到位的 diff 包 + BASE 显式记录"** | C | 无（符合 W-model"确定性脚本优于提示词"） |

## 6. 冲突台账

| # | superpowers 主张 | 冲突的不变式 | 处置 |
| --- | --- | --- | --- |
| Y1 | TDD Iron Law "Write code before the test? **Delete it.** Start over."（`test-driven-development/SKILL.md:37-45`） | CHECKPOINT 不可绕过；硬约束 #46（只给审计权不给修正权）；code-health"只有 human 能授权删除" | 改为"标记废弃 + CHECKPOINT 请求删除"，不得自动删 |
| Y2 | 例外自裁（throwaway prototype / generated code / config，`:16-29`） | 豁免须走 `check-exemption.ts` E1-E9 四阶段人类链 | 映射为 CHECKPOINT 豁免，不由技能自裁 |
| Y3 | Brownfield 假定缺失（Iron Law 无存量代码分支） | W-model 明确支持 Brownfield（`docs/adoption-guide.md`） | 须显式写入阶段 5 adoption 分支，否则 Iron Law 会要求删除存量已上线代码 |
| Y4 | REFACTOR 在 TDD 内循环内（`:185-192`） | 反模式 #47（大规模重构式改动）；diff 须可审 | 取 mattpocock 侧"重构归 V 评审"，并限定为"微重构且不跨模块" |
| Y5 | **O 对 reviewer 的裁定权**（SDD `:366-371,411-429`） | 反模式 #10（编排者不得自评）、#41 | **必须剥离**：对 finding 的争议回流新 V 或 R |
| Y6 | fix loop 无 R 入场（SDD `:354-443`） | 反模式 #18 | 接收纪律只能作用于"R 报告 + V/G 通过之后的 S-fix" |
| Y7 | "Continuous execution / Rulings, not stalls"（SDD `:17-25`） | CHECKPOINT 不可绕过 | 只取记录格式，裁决权归 CHECKPOINT |
| Y8 | `writing-plans` 的 `**Files:** path:N-M` + 内联完整实现（`:87-90,100-116`） | 票据 durability 禁令（`phase-5-coding.md:166-173`）+ 约束 #14（票据预置路径 = 绕过 codegraph 定位） | **否决**，降级为符号级契约 |
| Y9 | `executing-plans` 的 batch 语义（`:29` "Follow each step exactly"） | 逐票据 V/G | **拒绝 batch 语义** |
| Y10 | brainstorming 的 HTML/JS/Node server（1232 行）+ 默认注入外部品牌图（`server.cjs:106,242-252`） | "资产全 Markdown + TS"、"无 HTML 产物"、"无 CDN 依赖" | **排除**；只取 4 条文本内核（S17） |
| Y11 | `.superpowers/brainstorm/<session>/` 状态目录 + 提示用户加 `.gitignore`（`start-server.sh:116-124`） | "不引入平行事实源" | **排除** |
| Y12 | 平台会话 hook（`hooks/session-start` + `.opencode/plugins/*` + `.pi/extensions/*`，N 平台 N 份配置） | "不引入外部平台 hook"；破坏"整体拷贝 `w-model-dev/`"单一分发模型 | **排除** |
| Y13 | hook 的 **fail-open 静默降级**（`run-hook.cmd:37-39` 找不到 bash 即 `exit /b 0`） | W-model 的 fail-closed 门禁哲学（0/1/2 三值 + 不得用 LLM 估算） | 采纳 hooks 即等于引入"坏了也不报错"的通道 → **排除** |
| Y14 | 退出码只用 0/1，**无 `2 = 输入错误`** 三值契约 | 全仓 43 脚本的 exit-2 结构化错误约定 | 不得照抄其脚本与测试风格；借用时须重映射 |
| Y15 | `sync-to-codex-plugin.sh` 的镜像同步（`--delete --delete-excluded`） | "不引入平行事实源" | 排除（若引入镜像通道即产生从属副本） |
| Y16 | `persuasion-principles.md` 的 Unity / Liking / Reciprocity | V 不得自评、反谄媚立场 | **明确排除出任何 V 提示词** |
| Y17 | 引入 `tests/` 全套所需依赖（`ws` / python3+pytest / jq / yq / shellcheck / shfmt / rsync / gh / tmux） | devDep 纪律（ajv / ajv-formats / eslint-plugin-security / tsx / typescript / vitest） | 仅借**断言模式**，不引入任何新依赖 |
| Y18 | worktree 有独立 `.work-model/`（实测：`.worktrees/<x>/.w-model/codegraph-queries/`） | `wm-write.ts` 单写者锁（锁在**同一文件路径**上，多 worktree 各写各的不保证全局单写者）；"不引入平行事实源"；SSoT `:283` 要求 headRef sha == 当前 HEAD | 采纳 worktree 前须先定"worktree 内 `.w-model` 合法性 + 合并回主仓"规则 |
| Y19 | `brainstorming` 的"每消息一个问题"（`SKILL.md:171`）与"分节逐节批准"（`:99,185`） | M04 的 frontier 批量问 + Push right（"人只被问一次且问得晚"） | **M04 胜**；逐节确认降级为"每节自检 Done 判据，批准统一放最后一轮" |
| Y20 | superpowers 内部矛盾：`anthropic-best-practices.md:187-199`（description 含 what+when）vs `SKILL.md:150`（ONLY when, NEVER what） | —— | 取 `SKILL.md` 版（有因果事故支撑） |
| Y21 | superpowers 的**单假设**（`systematic-debugging/SKILL.md:147-150`）vs M05 的 3–5 条排序假设 | 防锚定 | **M05 胜**；保留"最小实验 / 一次一变量"作为**测试阶段**执行纪律（先列多条，再逐条单变量验证） |

## 7. 排除台账

**整套排除**

| 对象 | 理由 |
| --- | --- |
| `hooks/` 全部（含 `run-hook.cmd` polyglot、三种 JSON 形状、`session-start`） | Y12 + Y13（平台 hook + fail-open） |
| 8 个平台插件层（`.claude-plugin` / `.codex-plugin` / `.cursor-plugin` / `.devin-plugin` / `.hermes-plugin` / `.kimi-plugin` / `.opencode` / `.pi`） | 单一分发模型下无移植需求 |
| `brainstorming/scripts/` 5 个脚本（server.cjs 723 行 / helper.js / frame-template.html / start/stop-server.sh） | Y10 + Y11（HTML 产物、外部品牌图、平行状态目录、本地服务攻击面、`maybeOpenBrowser` 操作用户桌面） |
| `writing-skills/persuasion-principles.md` | Y16（与 V 独立性对立） |
| `writing-skills/render-graphs.js` + graphviz 二进制依赖 | 外部二进制 + 默认写入 `<skill>/diagrams/` 污染受 git 跟踪的资产树 |
| `writing-skills/anthropic-best-practices.md` 作为**整体** | 44% 行数为 Anthropic 上游文档搬运（残留 `<Note>`/`<Tip>`/mintcdn 链接/`theme={null}`），且与外层 SKILL.md 有矛盾 → 按需摘取 |
| `systematic-debugging/SKILL.md:168-190`（Phase 4 实现，自调查自修复） | 反模式 #18 + 编排者最小化 |
| `systematic-debugging` 的 stack trace 插桩手艺（`root-cause-tracing.md:66-95,156-161`） | 运行时手艺；W-model 的诊断对象是阶段产物而非运行进程 |
| `subagent-driven-development` 的 O 自主裁决 / 不 stall / 并行 implementer / 无 R 的 fix loop | Y5 / Y6 / Y7 |
| `requesting-code-review` + `finishing-a-development-branch` 的 git 菜单与合并策略自动推断 | W-model 无分支合并模型（阶段 8 归档 + CHECKPOINT 承载"人类决定集成"） |
| `receiving-code-review:62-66`（人类反馈可直接实施） | 必须受 CHECKPOINT 与 R 闸门约束 |
| `using-superpowers` 的 SessionStart / pre_llm_call 注入机制 | Y12 |
| `writing-plans` 的 `path:N-M` 与内联完整实现；`executing-plans` 的 batch 语义与"运行时计划文件为产物" | Y8 / Y9 |
| `docs/superpowers/plans/` 产物路径与落盘约定 | W-model 运行时**不产计划文件**（`/wm code` 直通 O→S→V→G），代码级切片是 `tickets.md`；本仓 `docs/superpowers/plans/` 是**维护者开发技能包自身**的计划，不参与 `/wm` 编排 |
| `scaffold-exercises` 类上游私有工具链、Codex 镜像同步 | Y15 + 平台绑定 |

**纯提示词风格 / 无迁移价值**

- `finishing-a-development-branch` 的 no-gratitude 话术（W-model 门禁校验产物不校验语气，Schema 门禁使表演式附和无害）
- `dispatching-parallel-agents` 的整合验证（人工 spot check）—— 被 W-model V/G 覆盖
- `brainstorming` 的 emoji/版式与 `visual-companion.md` 的 CSS 类清单
- `CREATION-LOG.md` / `test-academic.md` / `test-pressure-*.md`（技能自验证语料，可作 V persona 素材而非机制）

## 8. 对已选 M 项的修正与补充（§4.3 的结论落表）

| M 项 | 原处置（v2） | superpowers 调研后的修正 |
| --- | --- | --- |
| **M01** 资产编写杠杆 | 采纳（来自 mattpocock `writing-for-agents`） | **数值与指针约定改以 superpowers 为权威**（S03：<500 行 / >100 行拆 / <50 行内联 / 引用一层深 / >100 行加 TOC / 禁 `@` 深链）；no-op test **互补双持**（M01 存量剪枝 + S04 授权前必要性门禁） |
| **M02** 反模式否定式整改 | 采纳为"补正向目标表述" | **被 S01 修正**：不是"去掉否定"，而是**按失败类型分流**——对 discipline 失败禁令才是正确形式；对"形状错误/漏项"必须改正向 recipe。另加 No nuance clauses / Exemption clauses don't scope 两条硬子规则 |
| **M03** 测试质量反模式 | 采纳（来自 mattpocock `tdd`） | **改以 superpowers `writing-good-tests.md` 为主源**：独有 change detector / string-presence trap / Mutation Check 5 类 / mock 三条硬规则 / 期望值独立推导；mattpocock 版保留为补充 |
| **M04** CHECKPOINT 提问与呈现规范 | 采纳（来自 mattpocock `to-questionnaire` + `grilling` + `loop-me`） | **保持 mattpocock 为主源**（Y19：brainstorming 的逐节批准与 Push right 冲突，M04 胜）；**并入 S17 的呈现内核 4 条**（后撤屏、提议独占一条消息）与 S16 的 reviewer calibration |
| **M05** R 入场门 | 采纳（来自 mattpocock `diagnosing-bugs`） | **保持 mattpocock 为主源**（Y21：superpowers 单假设会锚定；四项验收在 superpowers 无等价物）；superpowers 仅补 S14（≥3 次失败技术判据） |
| **M06** 负向 fixture 协议 | 采纳为"注入违规必须失败" | **被 S25 超越**（还要证明"没有这条规则就会出错"）+ **被 S26 补强**（失败时状态逐字节不变）+ S28 作前置条件（断言必须能失败） |
| **M07** RED 证据可验证化 | 采纳（来自 mattpocock 的反例） | **不改为增量采纳**：W-model 已有更强实现（`code-health-gap.schema.json:91,256-296` 强制 `redEvidence.observation:"observed"` + `exitCode ≥ 1` + `assertionHash` + `failureClass` 反伪造）。superpowers 的 Verify RED 仅作**需求依据**：把 code-health 的 RED 证据模式**扩展到阶段 5-8 的 RTM `testSummary`**（`rtm.schema.json:96-100` 目前只有 total/passed/failed/pending/coverage） |
| **M17** S 的 loop 构造法 | 采纳（来自 mattpocock `diagnosing-bugs:24-35`） | **保持 mattpocock 独有**（superpowers 无方法库）；superpowers 补 S24（污染源定位工具）与 S22（条件等待） |

## 9. 台账自检

- **覆盖完整**：14 个 `SKILL.md` 及其全部附属 md（94 个 md / 29,322 行）、`tests/` 16 子目录（60 文件 / 8,760 行）、`hooks/` 4 文件、`scripts/` 4 文件、8 个平台插件层、全部元文件均已登记。
- **证据可定位**：全部结论带 `文件:行号`；commit 与路径已固定（§0）。
- **缺口可验证**：S 项的"W-model 缺口"列均点名具体资产与行号，可独立复核。
- **两个外部源已对比取舍**：§4.3 逐判据给出 superpowers vs mattpocock 的取舍，§8 落表为对 M 项的修正。
- **冲突与排除均已记账**：§6 二十一条冲突、§7 全量排除理由，不含"待定"项。
- **明确更正**：`tests/pi` 并非空目录（137 行测试 + 121 行扩展）；`hooks` 的冲突性质与 mattpocock `git-guardrails` **不同**（不是退出码语义冲突，而是 fail-open vs fail-closed）。
- **未越权**：全程只读，未修改外部仓库与本仓库任何文件；未声称任何能力已存在。

## 10. vendor 复核修正（2026-09-14）

P0a 原文固化时对每个采纳项做了**逐字节**摘录校验（46 个摘录段全部与源文件比对，0 mismatch），结果如下。**权威证据锚点自此为 vendor 文件**（[`docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md`](../sources/2026-09-14-superpowers-adopted-excerpts.md)，1309 行 / 32 节），本台账行号降级为导航参考。

### 10.1 实质修正（影响结论表述）

| 项 | 原表述 | 源文实际 | 处置 |
| --- | --- | --- | --- |
| **S18** | "No Placeholders **七条**黑名单" | 源文 `writing-plans/SKILL.md:133-139` 只有 **6 条** bullet；本台账 §5 的枚举实际也只列了 6 项 | **改为"6 条"**。"七条"在源文中无依据，属本台账自造的计数；机制内容与行号无误 |

### 10.2 行号修正（精度）

| 项 | 台账记 | 实测 | 性质 |
| --- | --- | --- | --- |
| **S09** | `re-review-prompt.md:52-57` | `ADDRESSED / NOT ADDRESSED` 与 `"Attempted" is not addressed` 在 **L80-85**；L52-57 实为 "You Do Not Dispatch Subagents" 尾句 + "Scope" 节 | **显著错位**（机制本身真实存在，仅锚点错） |
| S04 | `:645` | L644-645 | 少一头行（L644 提供上下文） |
| S07 | `:84`；`:152-157` | L84-85；L153-157 | 首尾各差一行 |
| S08 | `:76-84` | L68-84 | L76 是自 L68 起的代码块尾部，为自包含前移 |
| S10 | `:22-25` | L19-25 | `Ruling:` 三要素句起于 L19，L22 是句中截断 |
| S20 | `:125-127` | L124-127 | 少一头行 |
| S21 | `:23-25`；`:48-53` | L22-25；L47-52 | 各少一句首 |
| S29 | `conftest.py:15-25` | L16-26 | 整体偏移一行（L15 为空行） |

**汇总**：S01–S32 中 8 项存在行号偏移（其中 S09 为显著错位），均已由 vendor 文件按实测标注；**机制内容全部确认存在，无一项被推翻**。

### 10.3 未确证项

**无。** 32 项全部完成实测复核；S17–S32 均为外部正向摘录，无负面证据项、无内部证据项。
