# P5 调试、运维与交互 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。
>
> **批准与边界：** P5 = 设计规格 §11 :305 第五期（依赖 P0；「S23 项先按 §4.4 规则」）。12 项＝ M05/M17/S13/S24/S22/M13/M04/S17/M18/M12/S15/S23。规格 :305 三条硬约束：「**S13 不放松 R2/R3**；**S24 只作按需工具**；**S23 的 `.w-model` 规则先批准**」。**S23 的 `.w-model` 规则已经 D-6 裁定批准**（2026-09-14，裁定 :208/:224）：原则＝「worktree 内禁止写 `.w-model`；跨 worktree 状态与证据一律回主仓」，本计划完成其**定稿**（裁定 :224 所指的定稿工作）。S13 的 schema 分支扩展属 **P0 已批准的 C 级产物清单**（规格 :211），**不适用** M07 式单独批准（M07 是被 D-2 特别切出的例外）。

**目标：** ① R 入场门与收敛判据补齐（M05 红信号四项验收 + 3–5 条排序可证伪假设 + 预测格式；M17 loop 构造 10 种按序 + 提高复现率而非干净复现；S13 「无根因」合法出口 + 「95% 反例」警示）——**闭环 AC-6**；② 污染源二分定位按需工具（S24）；③ 条件等待三要素（S22）与事件接驳前置核实（M13）；④ CHECKPOINT 提问与呈现规范（M04+S17）；⑤ 三路径分诊 + 分类口播（S15，按 D-5 改造）；⑥ 受控低仪式探索通道（M18，按台账改造要求改写）；⑦ pre-commit staged-only 快层（M12，不引入 husky）；⑧ worktree 规则定稿 + 五条隔离纪律 + 清理拥有权 + `prune` 自愈 + clean baseline（S23，验收 AC-9）。

**架构：** 十项为 Markdown 资产（`root-cause-locator.md` / `concurrency-guide.md` / `event-ingress-guide.md` / `command-reference.md` / `quick-self-check.md` / `SKILL.md` / `phase-1-requirements.md` / `phase-5-coding.md` / `phase-8-acceptance-test.md`）；**两个代码落点**：S24 = 新确定性 CLI `w-model-dev/scripts/cli/check-pollution.ts`（0/1/2 型，进 exit-2 集合全链级联）；M12 = 新增 `.githooks/pre-commit`（staged-only 快层；`core.hooksPath=.githooks` 已由 setup-hooks.cjs 设置，无需新接线）；S13 = `schemas/rootcause-report.schema.json` 新增分支 + `logic/root-cause-logic.ts` 校验（**P0 已批准的 C 级产物**，规格 :211——不适用 M07 式单独批准，计划显式记录此依据）。

**技术栈：** 既有 tsx + vitest + ajv；零新增依赖。

---

## 0. 实测基线（勘察 2026-09-16 @be1a77a9 主 checkout）

| 实测事实（file:line） | 对设计的影响 |
| --- | --- |
| `root-cause-locator.md` 实测 **213 行**（旧记录 180 已过期）；小节含 §2.5 复现测试强制 :72-78、**§2.6 ≥3 次判据（P3）:82-113**、§5 与 systematic-debugging 关系 :171-179、§8 辩解义务 :206-213；`grep 红信号\|入场\|复现率` **零命中** → M05/M17 净新增 | M05 的「入场已有红测试」与 §2.5（修复侧）语义相邻须划界；§5 随 M05/M17 更新 |
| **S13 零实现**：`logic/root-cause-logic.ts` / `cli/check-rootcause-report.ts` / `schemas/rootcause-report.schema.json` grep `noRootCause` 均 **0**；R1-R10 在 root-cause-logic.ts（:160-170 清单，R2/R3 收紧 :256 一带）；样本 `samples/rootcause/` 12 文件、ROOTCAUSE_CASES（12）登记于 `samples/README.md:27` | S13 = schema 新分支 + logic 校验 + 夹具/用例；**不放松 R2/R3**（:305 硬约束）；新增夹具须同步 samples/README ROOTCAUSE_CASES 计数 |
| S24 契约面（照 P2-B S32 先例全链）：cli 45→46、**exit-2 44→45**（S24 对非法参数 exit 2 即自动进入集合——`check-docs-consistency.ts:217` 探针机制 + `plan-chunks.ts`/`security-scan.ts` 先例）、NEGATIVE-COVERAGE +1 行（现 44 行表体）、`EXPECTED_GATE_COUNT` 44→45（`exit2-failure-atomicity.test.ts:62`）、SKILL.md:108/:131、conventions.md:118、AGENTS.md:22、dispatch-matrix（`subagent-delegation.md:366-371`）、`command-reference.md` | S24 = 本计划契约面最大的单项；**不得加入 pre-push 18 项**（:187/:305「只作按需工具」） |
| `check-docs-consistency.ts` 的 Vitest facts：`collectVitestMeasurements` :625-680、`WM_VITEST_COUNT_FILE` 快路径 :591、全量 spawn 975-1060s :600-602 | S24 单测**不得** spawn 全量 vitest；测解析逻辑用 mock / `WM_VITEST_COUNT_FILE` JSON 形态（`run-sync.test.ts` 为 mock 先例、`lib/run-sync.ts:463` 为 spawn 工具） |
| `concurrency-guide.md`（43 行）/ `event-ingress-guide.md`（156 行）：S22 三要素与 M13 前置核实**零覆盖**（grep 零命中） | 两项净新增，小文件 |
| M04/S17 **零预落**（`grep grill\|Push right\|Brief\|后撤` 在四个候选文件全零）；`command-reference.md` CHECKPOINT 清单 :455-464 + P3 Ruling 节 :468-484；`quick-self-check.md`（129 行） | M04+S17 合并落（规格 :139「同上合并进 M04」）；与 P3 Ruling 节语义相邻（Ruling 管「记什么」，M04 管「怎么问怎么呈现」——划界写明） |
| S15：`SKILL.md`（134 行）**无分诊节**；:30 已有「任务规模适配」节（语义相邻防双头）；台账 :168 改造要求 + 裁定 D-5（:207）：不引入任务级路由、只采「仪式可缩、门不可缩」+「分类必须口播」、「每消息一个问题」与 M04 冲突（**M04 胜**） | S15 = 按 D-5 改造后的最小落地 |
| M18：`phase-1-requirements.md`（440 行）迷雾册 :147-169（毕业三选一 :160-163）；question-first/捕获纪律/零持久化**零覆盖**；M 台账 :202 改造要求：「No tests」与约束 #14 冲突 → 须登记 `.w-model`（`disposable: true`）+ 最小验证命令 | M18 = 改造后落地，**与约束 #14（真实测试回填）显式调和** |
| S23：`phase-5-coding.md` 475 行（新节邻接 :37 codegraph / :85 opsx / :223 执行方法论）；阶段 8 归档 = `phase-8-acceptance-test.md:276-280`；`.githooks/` 无 pre-commit；**无任何脚本检测「当前在 worktree」**；`evidence-provenance-logic.ts:142-155` 与 `check-docs-consistency.ts:622-623` 是仅有的 worktree 感知逻辑；SSoT `:283` headRef==当前 HEAD 是 §4.4 :195 所指冲突点 | S23 规则定稿写入 `phase-5-coding.md` 新节 + phase-8 归档节行内；**纪律是文档规则（git-only），不新增检测脚本**（§4.4 :197「W-model 不引入平台工具，须重写为 git-only」＋规格 :305 未给 S24 以外的脚本配额） |
| M12：`.githooks/` 仅 `pre-push` + `ensure-platform-deps.sh`，**无 pre-commit**；`core.hooksPath=.githooks` 由 `package.json:24` postinstall→`scripts/setup-hooks.cjs` 设置 | M12 = 新增 `.githooks/pre-commit` 文件即可被拾取；**不引入 husky**、**不改 package.json**；D-4 批准内容 = staged-only `prettier --ignore-unknown` + 增量 `tsc`，全量 suite 留 pre-push |
| 计数现状：references 43 / schemas 34 / cli 45 / exit-2 44 / 反模式 48（**双向断言，不得新增 #49**）/ self-test 340→**实测以收口为准**（P4 后 342）/ `__tests__` 88 / L0 672·95·36 / asset-budget 总行 ≤20000（实测 16824+P4 增量）/ >1000 行 TOC 5 个（subagent-delegation 1684 / verifier-spec 1131 在列——**P5 增行后仍 <2500 即可，勿破 TOC 义务**） | 计数同步义务随任务走 |

### 0.1 设计裁定（控制者决定，实现者不得擅改）

1. **S24 定名与契约**：`w-model-dev/scripts/cli/check-pollution.ts`；用法 `--project=<dir>`（缺省 cwd）；**检查对象**（规格 :206）：`.w-model/` 残留（工作区内的陈旧锁目录）、`*.lock` 锁文件、`coverage/` 残留；**「吞掉测试失败只看产物」语义**=逐文件检查「存在测试失败痕迹但产物却被判通过」的形态，**在注释中显式说明该语义并声明其按需工具性质**；**exit 1 = 发现污染源**；未知/重复 flag → exit 2 ARG_INVALID（进 exit-2 集合，§0 表）。**不得加入 pre-push**。
2. **S24 的 vitest 语义**：检查对象含 vitest 语义的污染形态（`coverage/.tmp` 残留、`--outputFile` JSON 残留、`.w-model` 锁目录残留）；**单测不得 spawn 全量 vitest**——只测解析/判据逻辑（构造临时目录形态），spawn 能力经 `lib/run-sync.ts`。
3. **M05 入场门判据**（回溯台账 M 源 :189）：红信号四项验收（真实跑过 / 断言用户症状 / deterministic / fast / agent-runnable）+ **红得起之前禁进假设** + 3–5 条排序可证伪假设（含预测格式）+ 造不出红信号 → 停下置 blocked 三选一。落 `root-cause-locator.md` 新小节（§2.7 或等位，**不重排既有节**）+ §5 关系更新。
4. **M17 loop 构造 10 种按序**（M 源 :201）：failing test→curl→CLI fixture diff→headless browser→replay trace→throwaway harness→property/fuzz→git bisect run→differential→HITL 兜底；「提高复现率而非干净复现」为判据句。落同文件新小节。
5. **S13 合法出口**（S 源 :166，**不放松 R2/R3**）：schema `rootcause-report.schema.json` 增加可选分支（`noRootCause: {kind: 'environmental'|'timing'|'external', investigation: 非空, mitigation: 非空}` 形态——以你读到的 schema 现状定形，**R2/R3 判据一字不改**）；logic 校验：`noRootCause` 存在时必须完整且 rootCauseChain/falsifiabilityCheck 等既有字段**按 schema 条件豁免而非删除**；cli 无需新参数；**「95% 反例」警示**写入 `root-cause-locator.md` 对应小节；夹具 +2（合法出口 1 + 滥用反例 1——滥用（无调查记录的 noRootCause）必须被拒，证明确实不放松）。
6. **S22/M13/M04+S17/S15/M18**：均按台账原文落散文规则；**S15 按 D-5 最小落地**（仪式可缩、门不可缩、分类口播；不引任务级路由；不写「每消息一个问题」）；**M18 按台账 :202 改写**（探索产出的验证走最小验证命令 + `.w-model` 登记 `disposable: true`，与约束 #14 调和——「No tests」表述不得原样出现）；**M04+S17 合并一节**落 `command-reference.md`（CHECKPOINT 提问与呈现规范）+ `quick-self-check.md` 指针，与 P3 Ruling 节划界（Ruling=记录格式；M04=提问/呈现方式）。
7. **S23 规则定稿**（D-6 已批原则的定稿文本，写入 `phase-5-coding.md` 新节「worktree 纪律（S23）」+ `phase-8-acceptance-test.md` 归档节行内）：**规则正文**＝「worktree 内禁止写 `.w-model/`（含其锁目录）；跨 worktree 的状态与证据一律回主仓 `.w-model/` 登记；`wm-write.ts` 的锁只在主仓路径上生效，worktree 内的平行 `.w-model/` 构成平行事实源，禁止创建」；五条隔离纪律（Step0 已隔离检测+submodule 守卫 `--show-superproject-working-tree` / 建前取用户同意 / 原生工具优先（git-only）/ `git check-ignore` 强制 / clean baseline 强制）+ 清理拥有权判定 + `git worktree prune` 自愈；**不得自动 `git reset`、不得自动清理用户文件**（§4.4 :197 边界）。**S23 纪律为文档规则，不新增检测脚本**（§4.4 :197）。
8. **M12 pre-commit 内容**（D-4 批准）：`.githooks/pre-commit`＝staged-only `npx prettier --ignore-unknown --check` + 增量 `tsc`（仅暂存文件相关项目或 `--noEmit` 全量但**不得跑全量 vitest**）；**不引入 husky**；**不改 package.json**；shell 与 `pre-push` 同风格（bash、`set -euo pipefail` 族）。
9. **P4 无 AC 行先例不适用**：P5 有 **AC-6（闭环）与 AC-9（S23）** 两条——T7 收口时 AC-6 行内把 P3 的「部分达成」升级为**已达成**（附 M05/M17/S13 证据），AC-9 行内追加 S23 达成标注；两者判据文本一字不动。

---

## 1. 全局约束（每个任务都适用）

1. **零新增依赖 / 零新增 Schema 文件**（schemas 34 不变——S13 改既有 rootcause-report.schema.json）/ **唯一新增 CLI = S24**（cli 45→46）；不得调用 LLM。
2. **不升版本号**（五处镜像不动）。
3. **不得放松任何既有判据**（S13 **不放松 R2/R3** 是规格 :305 硬约束；反模式 #18/#19 链条不变）。
4. **不触碰** `CHANGELOG.md`、`docs/changes/`、`docs/superpowers/sources/**`、`package.json`（M12 也不改——hooksPath 已设置）、`eval/**`（S24 不得进 pre-push 18 项，`prePushCount: 18` 不变）。
5. **反模式计数不变**（48）。
6. **计数契约同步义务**：S24 的级联清单（cli 46 / exit-2 45 / NEGATIVE-COVERAGE 45 行 / EXPECTED_GATE_COUNT 45 / SKILL 46 个 .ts / conventions 45 / AGENTS 45 / dispatch-matrix 行）在 T2 内一次完成；self-test 计数随任务同步（9 处声明）。
7. **L0 重基线义务**：新增 markdown 相对链接 → `audit:l0-links` + `helpers/l0-baseline.ts` 流程（P2-B 教训 ④）。
8. **每任务验证清单（强制；教训 ⑤⑥⑦⑧ 全内化）**：(a) `npm run lint:security`；(b) **十二文件守卫组**（十一组 + **examples-contract**）或全量 vitest——**凡触及 .ts 必须加 `npm run typecheck`**（P4 教训 ⑧）；(c) `npm run audit:l0-links`；(d) 新增必需文件/字段 → consumer 搜索；(e) prettier 权威配置；(f) **同一 worktree 内禁止两个 vitest/coverage 并发**（P4 教训 ⑦——控制者保证同一时刻只有一个子代理在跑测试）。
9. **TDD**：S24/S13 的每条判据先红后绿；A 层任务以台账回溯 + 零删改 diff 证明代替。
10. **诚实性**：证据命令真实跑过贴真实输出；S15/M18 的改造标注如实（D-5 / 台账 :202）；S24 的按需工具性质与「吞掉测试失败」语义显式注释。
11. **保持输出流动**（本会话教训）。

---

## 2. 任务分解

### 任务 1（M05 + M17 + S13 文档侧）：R 入场门、loop 清单、无根因出口（散文）
- [ ] 读台账 M05（M 源 :189/:204）/M17（:201）/S13（S 源 :166）原文；`root-cause-locator.md` 现状（§2.5/§2.6/§5）。
- [ ] 新增：§2.7「R 入场门（M05）」（红信号四项验收 + 红得起之前禁进假设 + 3–5 条排序可证伪假设 + 预测格式 + 造不出置 blocked）；§2.8「S 侧 loop 构造方法清单（M17）」（10 种按序 + 复现率判据）；§2.9「『无根因』合法出口（S13）」（三形态 + 95% 反例警示 + **R2/R3 不放松**声明 + 与 §2.5/§2.6 的分工）；§5 关系更新。
- [ ] **验证**：十一文件守卫组（含 examples-contract——**P3 教训：新散文含失败信号措辞时须带链名**）；`audit:l0-links`；反模式 48；零删改 diff 证明。
- [ ] **Commit**：`docs(root-cause): entry gate, loop construction list, and no-root-cause exit (M05+M17+S13 prose)`

### 任务 2（S24）：污染源定位 CLI
- [ ] SSoT §10.5 先行补行；TDD（RED：参数契约 + 判据各例）；`logic/pollution-logic.ts`（或并入既有 logic 文件——**不新增 logic 文件亦可**，以最小为准）纯函数 + `cli/check-pollution.ts` 接线；级联清单（约束 6）一次完成；`command-reference.md` 补节。
- [ ] **验证**：约束 8 全套（**含 `npm run typecheck`**）+ `exit2-failure-atomicity` 46 用例 + `check-samples-coverage` exit 0 + self-test 与声明一致。
- [ ] **Commit**：`feat(cli): add pollution locator CLI (S24, on-demand tool)`

### 任务 3（S13 代码侧）：schema 分支 + logic 校验
- [ ] TDD：合法出口夹具（valid）→ 过；滥用反例（无调查记录的 noRootCause）→ 红；既有 12 夹具全部保持原判定（**不放松**证明：bad-* 夹具逐个原样红）。schema 分支 + `logic/root-cause-logic.ts` 校验；`self-test.ts` ROOTCAUSE_CASES +2 与 `samples/README.md` 计数同步。
- [ ] **验证**：约束 8 全套（含 typecheck）+ `npx tsx cli/check-rootcause-report.ts <样本>` 双向实测。
- [ ] **Commit**：`feat(schema): add the no-root-cause legitimate exit branch (S13)`

### 任务 4（S22 + M13）：条件等待三要素与事件接驳前置核实
- [ ] `concurrency-guide.md` 新小节（三要素 + 三反模式；**写明三要素否则会被读成禁止一切 sleep**——台账 :175 注）；`event-ingress-guide.md` 路由逻辑处加「先核实主张再受理」（按 reporter 步骤复现 / 检出 PR 跑相关测试后再分类）。
- [ ] **验证**：约束 9（文档任务流程）+ 十一守卫组 + l0 + lint。
- [ ] **Commit**：`docs(guides): condition-wait disciplines and event ingress verification (S22+M13)`

### 任务 5（M04 + S17）：CHECKPOINT 提问与呈现规范
- [ ] `command-reference.md` CHECKPOINT 清单后新增「提问与呈现规范（M04+S17）」：grill-the-send / 每题一想法 + 答案 stub / 鼓励 "I don't know" / frontier + 必给推荐答案 / 找事实派子代理不阻塞 / **Push right**（只重排不删 CHECKPOINT）/ **Brief 三段式** / 呈现内核 4 条（逐问判定 / 2-4 选项 / **后撤屏** / **提议独占一条消息**）；与 P3 Ruling 节划界一句。
- [ ] `quick-self-check.md` 行内指针。
- [ ] **验证**：同任务 4。
- [ ] **Commit**：`docs(checkpoint): question and presentation disciplines (M04+S17)`

### 任务 6（S15 + M18）：分诊改造与探索通道
- [ ] `SKILL.md` 新增「阶段开工前分诊」节（**按 D-5 最小落地**：三路径分诊 + 分类口播 + 仪式可缩门不可缩；**不写**「每消息一个问题」；与 :30「任务规模适配」划界）。
- [ ] `phase-1-requirements.md` 迷雾册毕业证据处**行内追加** M18（question-first + 捕获纪律 + **默认零持久化 + `disposable: true` 登记 + 最小验证命令**——与约束 #14 调和的改写，标注改造依据 M 台账 :202）。
- [ ] **验证**：同任务 4 + **SKILL.md 行数 ≤499**（asset-budget skillBodyMaxLines）。
- [ ] **Commit**：`docs(skill): pre-stage triage and controlled exploration channel (S15+M18)`

### 任务 7（S23 + M12）：worktree 纪律定稿与 pre-commit 快层
- [ ] `phase-5-coding.md` 新节「worktree 纪律（S23）」：**规则正文定稿**（D-6 原则逐字 + 平行事实源/锁/SSoT headRef 三点依据引 §4.4 :195）+ 五条隔离纪律 + 清理拥有权判定 + `prune` 自愈 + clean baseline 强制；边界（不得自动 reset/清理用户文件；git-only）。
- [ ] `phase-8-acceptance-test.md:276-280` 归档节行内追加（清理拥有权 + prune 自愈的归档侧动作）。
- [ ] 新增 `.githooks/pre-commit`（M12：staged-only `prettier --ignore-unknown --check` + 增量 tsc；bash 与 pre-push 同风格；**不跑全量 vitest**；不引入 husky）。
- [ ] **验证**：约束 8 全套（**含 typecheck 与 examples-contract**——hooks 文件在 pre-push prettier 门禁面内）；实测 pre-commit 在干净暂存下通过、在有未格式化暂存文件时拦截（临时 clone 或直接 bash 执行验证）；pre-push `prePushCount 18` 不变。
- [ ] **Commit**：`feat(hooks): worktree discipline rulebook and staged-only pre-commit (S23+M12)`

### 任务 8（收口）：全量门禁 + AC-6 闭环 + AC-9 回填
- [ ] `npm run prepush`（独占；预期 18/18 + `PREPUSH_EXIT=0`——**S24 不进 18 项**）。
- [ ] 一致性自查：counts（cli 46 / exit-2 45 / references 43 / schemas 34 / 反模式 48）实测；`audit:l0-links`；self-test 与声明一致；`check-samples-coverage` exit 0。
- [ ] 规格 §13 **AC-6 行内**：把 P3 的「部分达成」升级标注为「**P5 补齐后整体达成**」（M05/M17/S13 证据命令逐条实跑；判据文本一字不动）。**AC-9 行内**追加 S23 达成标注（规则定稿 + 五条 + 清理拥有权 + prune + clean baseline；证据 = 文档落点 + `pre-commit` 存在性）。**不新增 AC 编号**。
- [ ] 计划收尾节（控制者终版回填）。
- [ ] **Commit**：`docs(spec): close AC-6 and record AC-9 after P5`

---

## 自检结果

**1. 规格覆盖度**：12/12 项全部有落点与任务；:305 三条硬约束 → S13（任务 3 + §0.1.5）/ S24（任务 2 + §0.1.1「不进 pre-push」）/ S23（§0.1.7 D-6 定稿）；AC-6 闭环 → 任务 8；AC-9 → 任务 7 + 任务 8。
**2. 占位符扫描**：无。S24 夹具载体与 logic 文件归并形态为有界选择 + 报告义务。
**3. 命名一致性**：`check-pollution.ts` / `tickets` 先例的计数对象形态 / `noRootCause`（台账原文词）/ `disposable: true`（M 台账 :202 原文）/ `integrate-and-verify`。
**4. 与既有验收的关系**：AC-6 闭环（任务 8）；AC-9 达成（任务 7+8）；AC-10/AC-11 不受影响（S24 不进 pre-push、无新 Schema 文件、无新依赖）。

---

## 执行结果（计划收尾节，控制者终版回填 2026-09-16）

**状态：全部 8 个任务完成并通过评审。** 分支 `feat/p5-debug-ops-interaction`，BASE `be1a77a9`（main）→ 本收尾节所在提交。**12/12 采纳项全部落地**（M05/M17/S13/S24/S22/M13/M04/S17/M18/M12/S15/S23），AC-6 已闭环、AC-9 已标注（见规格 §13 :363 / :366）。

### 一、提交序列（12 个）

| # | commit | 内容 | 任务评审 |
| --- | --- | --- | --- |
| 0 | `f0b180c1` | 计划本体（含实测基线） | — |
| 1 | `7e78a04b` | 任务 1：M05 §2.7 入场门 + M17 §2.8 loop 清单 + S13 §2.9 无根因出口（散文） | 通过（0C/0I） |
| 2 | `de7671ff` | 任务 2：S24 `check-pollution.ts` + `pollution-logic.ts` + 级联 11/11 | 不通过 → 修复 → 定向复审通过 |
| 2b | `e2d28b17` | 任务 2 修复：整文件 eslint 豁免收窄为 11 处行级豁免 | ADDRESSED |
| 3 | `40e9ba95` | 任务 3：S13 schema `noRootCause` 分支 + logic 分流 + 夹具 +2 + 计数级联 9 处 | 通过（0C/0I/3M） |
| 4 | `1ddf27e3` | 任务 4：S22 条件等待三要素/三反模式 + M13 受理前核实 | 通过（0C/0I/2M） |
| 5 | `456a02e6` | 任务 5：M04 十条 + S17 呈现内核四条 | 通过（0C/0I/0M） |
| 6 | `d8bff4ef` | 任务 6：S15 阶段开工前分诊（D-5 最小落地）+ M18 受控探索通道 | 通过（0C/0I/3M） |
| 7 | `e93a1b7d` | 任务 7：S23 worktree 纪律定稿 + M12 `.githooks/pre-commit` | 通过（0C/0I/3M） |
| — | `3e890765` | 累积 Minor 修复批（7 项） | — |
| — | `24fe0316` | 最终审查修复波（2 Important + 2 Minor） | 定向复审通过（4/4 ADDRESSED） |
| 8 | `99e4a46e` | 任务 8：AC-6 闭环回填 + AC-9 达成标注 + AGENTS 措辞精度 | — |

### 二、评审与修复轮次（SDD 纪律）

- **逐任务评审 7 轮**，全程独立 V 子代理、附审查包（`review-<base>..<head>.diff`）；**两轮修复**：任务 2 的 I1（整文件 eslint 豁免 → 11 处行级）、最终审查的 I1/I2（见下）。
- **整分支最终审查**（BASE `be1a77a9` → `3e890765`，281960 字节包）：判 **不可合并**，0 Critical / **2 Important** / 2 Minor。
  - **I1**：`phase-1-requirements.md` 的 M18 段规定「登记 `disposable: true`」，但**该字段无 schema 家**——`project.schema.json` 根级 `additionalProperties: false`，且 `wm-status.ts` / `check-budget.ts` / `check-maturity.ts` 对 `project.json` 是**读取侧 fail-closed**（未知字段 → exit 2），照字面执行会让项目**卡死在门禁**。**处置：改写措辞（保留「一次性 / 不参与签名链·阶段门·证据导出」意图句，去掉对无 schema 背书字段的 prescribe）**，并**如实记录该处偏离计划 §0.1.6 字面**。审查者反证：合法 `project.json` → `wm-status` exit 0；加 `disposable: true` → **exit 2 STRUCTURE_INVALID**。
  - **I2**：`root-cause-locator.md` §2.7 写「五件套」，而 AC-6 冻结文本 / M 台账 `:189` / 计划 §0.1.3 用「红信号**四项验收**」，`grep 四项验收` 于 references **零命中** → AC-6 回填后无 grep 锚点。**处置：加别名（两名义并存，判据表仍 5 行）**。
  - Minor：`check-pollution.ts` 的 `coverage/` 判据**名称启发式**未声明（对 `--project=.../samples` 会误报，已补声明、**行为未改**）；`.githooks/pre-commit` 在技能包文档零落点（已补 `AGENTS.md` §2）。
- **修复波后一次定向复审**：4/4 **ADDRESSED**、0 新破坏；工作树干净。

### 三、收口门禁（控制者在最终树独占运行）

`npm run prepush` → **18/18 全绿、`PREPUSH_EXIT=0`**，末行「全部门禁通过，允许推送 ✓」。**S24 未进该 18 项**（`prePushCount: 18` 不变，符合规格 :305「只作按需工具」）。
一致性自查（实测）：`self-test` **344/344**、`audit:l0-links` exit 0（**672/95/36**，无重基线）、`check-samples-coverage` exit 0（`negativeCoverageMissing` / `negativeCoverageDangling` 均 0）、`schemas` **34**、`cli/*.ts` **46**、`references/*.md` **43**、反模式 **48**（无 #49）、版本 **42.2.1** 未升。
**守卫组**：13 文件 `442 passed / GUARD_EXIT=0`（含 `docs-consistency-logic` 190、`exit2-failure-atomicity` 46）。**「342 条用例」计数零残留**（9 处声明全为 344）。

### 四、规格 :305 三条硬约束达成

1. **S13 不放松 R2/R3**：`root-cause-logic.ts` 的 R1/R2/R3 判据**逐字保留**于常规分支（`git diff -w` 对 `MIN/MAX_CHAIN_LENGTH`、`FALSIFIABILITY_PATTERN`、判据句**零增删**；盘上常量 2／5／`/若.*则/` 未变）；新分支为**条件豁免**而非删除；四组绕过探针（双分支并存／皆无／空白 investigation／noRootCause+短链）**全部被拒**。
2. **S24 只作按需工具**：未进 pre-push、未接入任何阶段门，`prePushCount: 18` 不变。
3. **S23 的 `.w-model` 规则先批准**：D-6（裁定 `:133` 原则 + `:224` 生效）→ 定稿于 `phase-5-coding.md` 新节，含三条依据、五条隔离纪律、拥有权判定、`prune` 自愈、clean baseline 强制与三条禁令边界。

### 五、计划勘误（控制者实测，实现未按其字面执行）

1. **计划 §0.1.3「红信号四项验收」列了 5 项**（真实跑过 / 断言用户症状 / deterministic / fast / agent-runnable）——标签笔误；落地文本用「五件套」并列 5 行判据，并在 §2.7 加「四项验收」别名以保住 AC-6 锚点。
2. **计划任务 7 称「hooks 文件在 pre-push prettier 门禁面内」——不成立**。实测该门禁只覆盖 `w-model-dev/scripts/**/*.ts`、`config/**/*.{cjs,ts}`、`scripts/*.cjs`，**不含 `.githooks/**`**；故以 `bash -n` + 三态实跑（干净放行／未格式化拦截／缺工具降级）替代。
3. **计划 §0.1.6 的 `disposable: true`** → 见上「最终审查 I1」，改为不点名无 schema 字段的措辞（**本计划唯一实质偏离，已记录理由**）。

### 六、如实申报的偏差与裁定

- **M12 的 `pre-commit` 排除面（任务 7）**：M12 字面要求对全部暂存 prettier 可处理文件检查，但本仓 `.md` **321/432 非 prettier-clean**（BASE 即如此），照字面会**每次文档提交必被拦**。故 hook 按类别排除 `*.md` / `docs/changes/*` / `eval/*` / `samples/*` / `templates/*` / `docs/index.html`，逐类注明理由。审查者独立实测：**被排除类别内 `.ts`/`.cjs` 计数 = 0 → hook 检查面 ⊇ pre-push 面**，裁定**合理收敛、非放松门禁**。（本任务唯一新增文件约束使其不能改用 `.prettierignore`。）
- **任务 3 由两任实现者接力**：首任落主体实现但未提交且计数级联仅 1/9；续做者补完 7 处并**发现首任 `oneOf` 分支在 Ajv `strict: true` 下编译抛 `strictRequired`**（会导致全部 rootcause 报告 exit 2），按最小方式补同层 `properties` 修复（值恒真、不改判定语义，审查者独立复现该编译错误与修复后 OK）。
- **任务 2 由两任实现者接力**（首任无输出超时终止，留下未提交半成品）。

### 七、遗留（不属 P5，交后续）

1. **CHANGELOG 缺口**：P1/P2-A/P2-B/M07/P3/P4/P5 七期均按批准偏差禁改 CHANGELOG，**须在 M 程序整体收口时统一补记**。
2. **陈旧计数三处**（P2-B 裁定继续搁置，未随本次同步）：`docs/user-guide.md` 的 332、`.githooks/pre-push` 注释的「262 条」、`.code-health-governance.json` 的 `selfTestSamples: 322`——实际均为 344。
3. **P6（M08 拒绝知识库）** 未启动，待用户指示。
4. 本次未新增反模式条目（48 上限，双向断言），新纪律**挂靠既有条目**（如 Push right 只重排不删 CHECKPOINT → 「CHECKPOINT 不可绕过」与反模式 #8/#10；S23 worktree 纪律 → 反模式 #10 的编排者边界）。
