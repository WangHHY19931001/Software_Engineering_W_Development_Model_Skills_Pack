# RC-3 根因定位报告：退役门禁在 eval 按日基线中的残留，与「基线保持原样」裁定的未成文性

> 角色：根因定位者（R）。HEAD = `6dd683f4`（main）。本报告只读分析，未改任何代码/门禁行为；
> 唯一写入物为本目录。所有断言给 `file:line` 或命令输出依据；复核命令见 §9。
> 分析日期：2026-09-22。

---

## 1. 缺陷陈述（含对原陈述的核实订正）

**原陈述**：`check-opsx-artifacts` / `check-openspec-archive` 两门已退役（脚本 `git rm`），但
`eval/e2e/2026-08-28-baseline.md`（批次 1 按日基线）的 :93/:114 仍记录它们的基线值与命令行——
按这些命令重放会 hit 不存在的脚本。任务 10 的裁定是「按日历史测量保持原样」，未成文。

**核实结果：残留事实成立，缺陷机理需两处订正。**

- ✅ **残留属实**：`eval/e2e/2026-08-28-baseline.md:93` 与 `:114` 各含 1 处 `check-openspec-archive`
  字样（D11 归档机制偏差注）；全文件**不含** `check-opsx-artifacts`（grep 0 命中）——原陈述
  「两脚本」只有一半成立。终值记录 `2026-08-28-final.md` 零残留。
- ❌ **「记录基线值与命令行」不实**：:93/:114 是 D11 偏差注，记录的恰是该归档门**未被运行**
  及原因（demo 为 gitignored 瞬态工作区、不建归档目录、以本记录代归档载体）。全文不存在
  这两个脚本的任何命令行或测量值。
- ❌ **「重放会 hit 不存在的脚本」不成立（对点名集）**：基线点名的 12 个门禁脚本名
  （verifier-output / tla-model / bdd-model / tla-bdd-sync / requirement-graph（:40 短名）/
  artifact-gate / code-tla-consistency / preventive-review / rootcause-report /
  archive-integrity / role-dispatch / signature-chain）中，除已退役的
  `check-openspec-archive` 外，**其余 11 个在 HEAD 全部存续**（`test -f` 逐一验证，§9；
  含 D3 记为「未跑」的 role-dispatch / signature-chain——存续性与是否执行过无关）；且整
  记录重放本来就不可能——worktree `.worktrees/b1-3dim`（基线 :6）与 gitignored demo 工作区均已不存在
  （D2/D11，:105/:114 自认环境耦合）。
- ✅ **「裁定未成文」属实且是真正缺陷**：任务 8/任务 10 两次以「按日历史基线，改它即篡改
  历史测量」为由豁免该文件，但这一裁定的全部文字载体都在 **gitignore 的** 目录里
  （`.superpowers/sdd/.gitignore:1` = `*`；`git ls-files` 该战役目录 = 0 个文件）——
  任何 tracked 面（CHANGELOG / AGENTS / eval/README / conventions）均无此规则（§2 锚 9）。

**缺陷一句话**：不是「有人忘了基线」（流程其实两次都抓住了它），而是**豁免理由只存在于
不入库的战役账本，从未晋升为任何 tracked 权威面上的成文规则**——下一次退役战役的残留
grep 会再次命中同样两行，且拿不到任何上下文，处置结果（注记/改写/沉默保留）将完全取决于
当次执行者的临场推断。

---

## 2. 证据锚点（逐一核实）

| # | 断言 | 位置 | 核实结果 |
|---|---|---|---|
| 1 | 残留仅 `check-openspec-archive` 2 处（:93/:114），`check-opsx-artifacts` 0 处 | `eval/e2e/2026-08-28-baseline.md` | ✅ grep 实测（§9-1）；终值 `2026-08-28-final.md` 零残留 |
| 2 | :93/:114 为 D11 偏差注：归档门「面向真实项目」、demo 不适用、以记录代归档载体——无命令行、无基线值 | 同上 :93、:114 | ✅ 原文核对 |
| 3 | 两脚本本体已 `git rm`：`e797524a`（openspec-archive，批次 1）、`c84545b7`（opsx-artifacts，最终评审 C-1） | 两提交 `--stat`；HEAD `w-model-dev/scripts/cli/` 无此二文件 | ✅ |
| 4 | 基线文件自创建未再改 | `git log --follow` 仅 `213247d0`（2026-08-29 08:29，docs(eval): record batch-1 e2e baseline rebuild） | ✅ |
| 5 | 基线点名的 12 个门禁脚本名中，除退役名 `check-openspec-archive` 外 11 个在 HEAD 全部存续（含 D3 记为未跑的 role-dispatch / signature-chain） | `test -f` 逐一验证（§9-2） | ✅ 「重放即失败」对点名集不成立 |
| 6 | 任务 8：语料改写与基线保留**同任务分轨**——语料 id=21 整条改写（`0b49b03d`），基线「按简报保持历史原样不改」 | `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/task-8-report.md:24`、`:59`（**未跟踪**） | ✅ :59 原文：「简报允许『加退役注』或『保持原样并在报告说明』。我选择保持原样——…插入退役注会改写历史记录的可追溯性；本报告即为其说明」 |
| 7 | 任务 10 的 grep **包含且命中**了基线：C.1 路径集 =「技能包 + 活体文档 + eval 语料 + config + `.githooks`」，25 条残留中含基线 2 条，判为「按日历史基线」非活性 | `task-10-report.md:40`、`:42`（**未跟踪**） | ✅ 原陈述「grep 清单没包含它」不实——包含且命中；被豁免的是**处置**而非发现 |
| 8 | 控制器裁定原文：「『grep 活体面零命中』按无活性引用验收（25 条残留…全属退役声明/负向断言/按日历史基线/夹具清单/矩阵文案）」；修复轮复述「2 条按日历史基线…改它即篡改历史测量」 | `progress.md:88`、`task-10-report.md:88`（**未跟踪**） | ✅ |
| 9 | 裁定零 tracked 载体：CHANGELOG grep「按日/历史基线/baseline.md」0 命中；tracked 计划 `docs/superpowers/plans/2026-09-21-superpowers-replace-opsx.md` 无任何 baseline.md 处置指令；`eval/README.md:69-76`（§4）只列记录不立规则；`AGENTS.md:23`（eval 边界节）只说「非技能包运行时代码：不参与 `/wm` 编排、门禁脚本不读取」 | grep + 原文核对 | ✅ |
| 10 | 裁定的唯一文字载体不入库：`.superpowers/sdd/.gitignore:1` = `*`；`git ls-files .superpowers/sdd/2026-09-21-superpowers-replace-opsx/` = 0（历史 39 份旧账本为显式 force-add 例外，本战役未列入）；而 `CHANGELOG.md:14` 明文指引读者「逐任务报告与评审 diff 存 `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/`」 | `git ls-files` / `git check-ignore -v` | ✅ tracked 权威面把决策溯源指向了一个 gitignore 目录 |
| 11 | 「历史不可改」的成文先例存在但**不覆盖 eval/e2e**：gate-count 检查的活体文档白名单注释明写「CHANGELOG.md / CHANGELOG-archive.md / docs/changes/**（历史不可改）」；CHANGELOG 本身「批次 3-4 登记…原文保留不改」+「:16/:27 为时点状态、按 :29 例行豁免」 | `w-model-dev/scripts/logic/docs-consistency-logic.ts:1995-1999`；`CHANGELOG.md:29`、`:43` | ✅ 白名单是**该单一检查**的防假阳性手段，不是全仓历史记录分层规则；eval/e2e 未被归入任何层 |
| 12 | 「给历史记录加注」的先例存在且**同战役已两度使用**：docs/debug 活体调测报告加「⚠️ 对应历史态…直接照抄本节命令会得到与当时不同的结果」注记（`075e28d5`，I-1）；`eval/e2e/demo-assets/README.md:36` 写入 opsx 门退役注（`c84545b7`）——**唯独基线 .md 未获同款处置** | `docs/debug/2026-09-20-wm-8phase-live-run/README.md:78-82`；`eval/e2e/demo-assets/README.md:36` | ✅ |
| 13 | 门禁集漂移属实但与本次退役无关的度量面：a9808ea（2026-08-28）= 26 个 `check-*.ts`；HEAD = 27（+coding-plan / +coverage-scope / +pollution，−2 退役）；两退役脚本在基线时点**在盘** | `git ls-tree a9808ea` vs `ls`（§9-3） | ✅ |

---

## 3. 5-Why 缺陷链

**Why 1：为什么退役后基线里仍有已退役脚本名？**
不是遗漏——是**两次显式豁免**的叠加结果。任务 8（批次 2，`0b49b03d` 同提交窗口）处置 eval
面时把语料与基线分轨：语料是 `npm run eval` 的断言输入、不跟随即门禁红，必须改写；基线是
测量产物、无门禁消费，实现者按简报给的两个选项选了「保持原样」并写明理由
（`task-8-report.md:59`）。任务 10（批次 4，`8fdefd95`）残留清理 grep 命中同样 2 行，复审者
逐条复核判为「按日历史基线」非活性引用，控制器按「无活性引用」验收（`progress.md:88`）。

**Why 2：为什么两次都选择不改？**
因为该文件是**按日冻结的测量记录**：「改它等于篡改基线测量」（`task-10-report.md:42`）。
这个判断本身正确——且与仓库对 CHANGELOG / docs/changes 的既有精神一致
（`docs-consistency-logic.ts:1999`「历史不可改」、`CHANGELOG.md:29`「原文保留不改」）。

**Why 3：为什么这个正确的判断今天不可见？**
因为它只写在 `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/` 的 task-8-report /
task-10-report / progress 里，而该目录被 `.superpowers/sdd/.gitignore:1`（`*`）整体忽略、
本战役账本不在 39 份 force-add 例外之列。克隆本仓的人**读不到**裁定原文；更糟的是
`CHANGELOG.md:14` 把读者指向这个目录当作决策记录的家。

**Why 4：为什么没有任何 tracked 面接住它？**
因为「按日基线 = 不可变测量记录」从未被立法。仓库现存的「历史不可改」成文只有两处窄口径：
gate-count 检查的白名单注释（`docs-consistency-logic.ts:1995-1999`，目的是防该检查假阳性，
非全仓分层规则）与 CHANGELOG 自身的时点豁免惯例（`CHANGELOG.md:43`）。AGENTS.md:23 的
eval 边界节在本战役中被更新过（`e797524a`/`c84545b7` 均触 AGENTS.md），但只同步了注册表/
计数事实，未同步基线处置约定；`eval/README.md` §4 罗列了两份记录（:73）却没有一句
「它们是什么性质、退役时怎么对待」。缺陷不在判断缺失，在**规则无家**。

**Why 5（根因层）：为什么批次 8/10 的执行者各做了局部正确的事，合起来却留下一个不可复用的
决定？**
因为本战役的残留清理被构形为「**活体引用清理**」（C.1 grep + 无活性引用验收，
`task-10-report.md:40,88`），没有「**历史记录处置**」这一步——即对每个不可改写的历史面，
处置结论必须落一个 tracked 注记或规则条目。结果各历史面靠临场发挥各自解决：docs/debug
报告在同战役最终评审中拿到 ⚠️ 历史态注（`075e28d5`）、demo-assets README 拿到退役注
（`c84545b7`）、CHANGELOG 以「原文保留 + 追加登记」收口（`8fdefd95`/`18b9bb76`）——唯独
eval 基线选择了「沉默保留 + 未跟踪报告说明」。**惯例在实践中存在，规则在任何可复核的
地方都不存在**；下一次战役只能重推一遍，且可能推出相反结论（例如「顺手改写」——恰是
`task-10-report.md:42` 自己警告的篡改）。

---

## 4. 根因结论（工作假设裁定）

**控制器工作假设：成立，并作两处精化。**

> 假设原文：「基线保持原样」与「语料同步改写」采用了不同策略且没有成文规则。

- **策略分轨 ✅ 成立且合理**（Why 1）：语料 = 断言输入（受 `npm run eval` 门禁约束，必须
  跟随 HEAD）；基线 = 测量输出（无消费者，冻结即价值）。这不是双人分歧，是同一原则
  「输入跟随、产物冻结」的一致应用。
- **精化 1（缺陷落点从「策略分歧」移到「规则缺位」）**：真正缺陷不是两种策略并存，而是
  支撑其中「冻结」一极的理由**零 tracked 载体**（Why 3/4）。一个只存在于 gitignore 目录的
  豁免，对下一个战役等价于不存在。
- **精化 2（真风险裁决，回应原陈述的「两风险孰真」）**：
  - **「重放即失败」＝臆测级**。被点名的退役脚本在基线中无命令行、无测量值，其两处出现
    本身就是「该门未运行」的偏差记录（D11）；基线点名各门（除退役名外 11 个）全部存续；整记录重放被
    worktree/demo 消失独立阻断（与脚本存亡无关）。
  - **「可比性被破坏」＝弱**。两退役脚本从未进入基线的执行集，任何被比较的度量
    （V 分、分派/CHECKPOINT/返工计数、四级测试 74/74）都不依赖它们；门禁集 26→27 的漂移
    是技能演化的固有属性，记录自载日期即可承载。
  - **真风险 = 豁免不可复用性**：①下次退役战役 grep 命中同样 2 行时无任何 tracked 上下文，
    处置随机化（最坏分支＝「清理干净」式改写冻结测量，`task-10-report.md:42` 明言即篡改）；
    ②次要风险 = 读者把 D11 里的 `check-openspec-archive` 当现存门（无后继指引
    ——同战役对 docs/debug 已用 ⚠️ 注解决的同款问题，锚 12）。

---

## 5. 上游回溯

### 5.1 基线的生成与当时门禁集（「重放即失败」证伪）

- **生成方式**：批次 1 e2e 是**过程记录**而非脚本产物——Task 1.5（计划
  `docs/superpowers/plans/2026-08-28-w-model-dev-3dim-optimization.md`，基线 :3），在
  worktree `.worktrees/b1-3dim` 自 `a9808ea`（2026-08-28）起以技能自身跑 8 阶段，记录于
  `213247d0`（2026-08-29）。不存在可「重放」的生成命令；同时点语料基线另有
  `npm run eval`（28da1d1，`eval/README.md:71`）。
- **当时门禁集**：a9808ea 的 `w-model-dev/scripts/cli/` 含 **26 个 `check-*.ts`**（37 个
  cli .ts），`check-openspec-archive.ts` / `check-opsx-artifacts.ts` 均在盘。基线点名的
  11 门（除退役名外）在 HEAD 全部存续（§2 锚 5）；两退役门**不在执行集**——openspec-archive 仅以 D11
  「不适用」注出现，opsx-artifacts 全文未出现。
- **裁定**：「按这些命令重放会 hit 不存在的脚本」对基线**不成立**（无命令可重放 + 执行集
  完好）；成立的最弱版本是「读者按 D11 字样去找该脚本会扑空」——文档指引问题，非测量
  失真问题。

### 5.2 处置决策链时间线（git + 账本实证）

| 时点 | 提交/载体 | 内容 | 性质 |
|---|---|---|---|
| 2026-08-29 | `213247d0` | 基线记录创建（:93/:114 的 D11 注随初版即有） | tracked |
| 2026-09-21 午 | `e797524a`（批次 1） | `check-openspec-archive` 退役，语义并入 archive-integrity `codingPlanSnapshot`；未触基线 | tracked |
| 2026-09-21 | `0b49b03d`（批次 2，任务 8） | eval 语料 id=21 改写；基线「保持原样」，理由记于 `task-8-report.md:59` | 提交 tracked / **理由 untracked** |
| 2026-09-21 晚 | `8fdefd95`（批次 4，任务 10） | C.1 grep 命中基线 2 条 → 判「按日历史基线」→「无活性引用」验收（`progress.md:88`、`task-10-report.md:42,88`） | **裁定 untracked** |
| 2026-09-21 深夜 | `c84545b7`（最终评审 C-1） | `check-opsx-artifacts` 彻底退役；给 `eval/e2e/demo-assets/README.md:36` 写退役注；基线零命中故未触 | tracked |
| 2026-09-21/22 | `075e28d5`（最终评审 I-1）→ `6dd683f4` | 给 docs/debug 活体报告加 ⚠️ 历史态注；订正 CHANGELOG 时点陈述——**同波未给基线任何注记** | tracked |

**结论**：决策链在当次是闭合的（发现 → 分类 → 豁免 → 记录），缺的是最后一跳
「处置结论晋升到 tracked 权威面」。这不是某一个人的疏忽：任务 8 报告明确写了「本报告即
为其说明」，而仓库的惯例恰好允许该报告不入库——**惯例给它留的归位处本身就是临时的**。

---

## 6. 同类先例审计（原问题 2：基线该不该归入「历史不可改」类而未归入？）

**该归入，且未归入。** 仓库现存的历史面分层与先例：

| 历史面 | 成文处 | 待遇 |
|---|---|---|
| `CHANGELOG.md` / `CHANGELOG-archive.md` / `docs/changes/**` | `docs-consistency-logic.ts:1999` 白名单注释「历史不可改」；`CHANGELOG.md:29/:43` 时点状态原文保留 + 例行豁免 | 追加不改写（本战役两次示范：`:29` 批次 3-4 登记、`:43` C-1 订正） |
| `docs/debug/**` | 无成文规则；`fixwave-report.md:90`（untracked）把它列入「历史档案」 | 同战役实践中**加注不改写**（live-run ⚠️，`075e28d5`） |
| `docs/superpowers/{plans,specs}/**` | 同上（untracked 分类） | 原样保留（151 条残留不改写，`task-10-report.md:44`） |
| **`eval/e2e/*.md`（按日基线/终值）** | **无处**——`AGENTS.md:23` 仅定性「评估资产与基线记录…非技能包运行时代码」；`eval/README.md` §4 只列清单 | 本战役实际按「不可改」对待，但**该定性只存在于未跟踪账本** |

按日基线与 docs/changes 归档在性质上同类（有日期、终值冻结、被 `AGENTS.md:23/:51` 与
`eval/README.md:73` 引用为历史证据），却在唯一的成文白名单（gate-count 注释）与 untracked
分类（fixwave :90）里都缺席。**归类缺位 + 决策 untracked，两者叠加构成缺陷全貌。**

---

## 7. 补救选项矩阵

记号：◎优 / ○可 / △有代价 / ✗差。维度：测量保真（不动冻结内容）、读者防误导、根因消除
（规则可复核）、成本、门禁/兼容影响。

### ① 维持原样 + 文件头加按日快照注记

| 维度 | 评价 |
|---|---|
| 测量保真 | ○ 在 :3-6 既有元信息 blockquote 追加一条带日期的注记（与 live-run ⚠️ 同型：声明「门禁名以记录时点为准，`check-openspec-archive` 已于 2026-09-21 退役、由 `check-archive-integrity` `codingPlanSnapshot` 承接」），不触碰任何测量内容。任务 8 当初的顾虑（「改写可追溯性」）可由该先例化解——**注记 ≠ 改写**，前提是注记自载日期、明示补记身份 |
| 读者防误导 | ◎ 直接消除唯一残余风险（D11 扑空 + 无后继指引） |
| 根因消除 | ✗ 单独使用不解决规则缺位——下一个按日基线（终值已示范会有）还会重演 |
| 成本/影响 | ◎ 低。eval/e2e/*.md 不在任何门禁扫描面（gate-count 白名单仅 4 份活体文档；L0 链接基线不加链接即不漂移） |

### ② 为 ：93/:114 逐处补「退役注」行

| 维度 | 评价 |
|---|---|
| 测量保真 | △ 在历史声明的行内插入后见文本，正是任务 8 明确拒绝过的形态（`task-8-report.md:59`）；且 D11 是「未运行」记录，行内注 adds nothing that ① 的头注说不清 |
| 读者防误导 | ◎（与 ① 等效） |
| 根因消除 | ✗ 同 ① |
| 成本/影响 | ○ 低，但**被 ① 支配**（改两处历史行 vs 加一条元注记） |

### ③ 重测生成新基线（2026-09-2x-baseline）并声明旧基线仅历史

| 维度 | 评价 |
|---|---|
| 测量保真 | ◎ 不动旧记录 |
| 读者防误导 | ○ 间接（新记录用现役门名，旧记录仍在） |
| 根因消除 | ✗ 不解决；且旧基线「仅历史」的声明又是……一条需要成文的规则 |
| 成本/影响 | ✗ 整 8 阶段 e2e 重跑（基线卡点记录 :118-119 显示当次已撞用量上限）；无待裁决的比较在等它（批次 3 终值已是最新对照点）。**成本收益不成立** |

### ④ 把「基线不可变 + 退役需注记/指引」写入 eval/README 成文

| 维度 | 评价 |
|---|---|
| 测量保真 | ◎ 不触记录 |
| 读者防误导 | ○（对已入仓记录间接；配合 ① 达 ◎） |
| 根因消除 | ◎ 唯一直击根因的选项：规则落在 tracked、活体、且本就由 eval 任务持续维护的面（AGENTS.md:23 明文要求评估任务同步维护 eval 面）；下一个战役 grep 命中时规则自解释，「无活性引用」验收有 tracked 依据可引 |
| 成本/影响 | ◎ 低。eval/README.md 非 docs-consistency 扫描白名单文档；不加链接则 L0 三数不动；`npm run eval` 不读它 |

---

## 8. 推荐 + 落点草图

**推荐：④ + ① 组合**（④ 为根因修复、必选；① 为读者面最小注记、强烈建议）。②被 ① 支配，
③成本收益不成立。理由浓缩：唯一同时满足「冻结测量不动摇、豁免可复核、下次战役免重推、
成本趋零」的组合；与同战役对 docs/debug、demo-assets 的既有处置完全同型，无新惯例发明。

落点草图（落点级，非实施计划）：

1. **`eval/README.md` §4（根因修复）**：在 e2e 记录清单后追加一小节（约 4-6 行），成文
   三点——①`e2e/*.md` 基线/终值是**按日冻结的测量记录**：不随技能演化改写测量内容；
   ②记录中出现的门禁/脚本名以**记录时点**为准，退役名不作回改，遇到时以后继门语义为准
   （给一例：`check-openspec-archive` → `check-archive-integrity` `codingPlanSnapshot`）；
   ③退役/残留清理战役对 eval 历史记录的处置 = **注记或指引，不改写**，处置结论须落在
   tracked 面（本 README 或 CHANGELOG），不得仅存 `.superpowers/sdd/` 账本。
2. **`eval/e2e/2026-08-28-baseline.md` 头部（读者面）**：在 :3-6 元信息 blockquote 末追加
   一行，形如「> 补记（2026-09-22）：本记录为按日冻结测量；文中门禁名以 2026-08-28 时点
   为准，`check-openspec-archive` 已于 2026-09-21 退役，归档校验由
   `check-archive-integrity.ts` 的 `codingPlanSnapshot` 条件项承担（见 eval/README §4 约定）」。
   `2026-08-28-final.md` 无退役残留，可不动（若求对称亦可同款一行，非必需）。
3. **验证口径**：`npm run eval`（60/60 不受影响）+ `npm run audit:l0-links`（未加链接，
   三数应零漂移）+ `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
   （eval/README 不在其检查面，应零波及）；收口按仓库惯例全量 prepush。
4. **明确不做的**：不改 ：93/:114 原文（保真）；不重测基线（③）；不把 eval/e2e 塞进
   `GATE_COUNT_DOC_NAMES` 类门禁白名单（本缺陷不需要门禁化，成文即可——门禁化反而是
   「用机制补判断」的过度设计，且 docs-consistency 的白名单注释口径是单一检查防假阳性，
   不宜扩义）。

---

## 9. 可复核命令

```bash
# 1) 残留定位（缺陷面边界）
grep -n "check-openspec-archive\|check-opsx-artifacts" eval/e2e/2026-08-28-baseline.md
#   → 仅 :93 / :114 两行 check-openspec-archive；check-opsx-artifacts 零命中
grep -rn "check-openspec-archive\|check-opsx-artifacts" eval/ | grep -v demo-assets
#   → demo-assets（已有退役注）之外仅基线 2 行

# 2) 点名脚本存续（「重放即失败」证伪）
for s in check-verifier-output check-tla-model check-bdd-model check-tla-bdd-sync \
         check-requirement-graph check-artifact-gate check-code-tla-consistency \
         check-preventive-review check-rootcause-report check-archive-integrity \
         check-role-dispatch check-signature-chain; do
  test -f "w-model-dev/scripts/cli/$s.ts" && echo "OK $s" || echo "MISSING $s"; done
#   → 12/12 OK（基线点名全集；退役名 openspec-archive 不在其中）

# 3) 门禁集对比（基线时点 vs HEAD）
git ls-tree --name-only a9808ea -- w-model-dev/scripts/cli/ | grep -c "check-.*\.ts$"   # → 26
ls w-model-dev/scripts/cli/check-*.ts | wc -l                                            # → 27
diff <(git ls-tree --name-only a9808ea -- w-model-dev/scripts/cli/ | grep "check-.*\.ts$" | xargs -n1 basename | sort) \
     <(ls w-model-dev/scripts/cli/check-*.ts | xargs -n1 basename | sort)
#   → +coding-plan/+coverage-scope/+pollution；−openspec-archive/−opsx-artifacts

# 4) 基线不可变 + 裁定 untracked（根因实证）
git log --oneline --follow -- eval/e2e/2026-08-28-baseline.md                            # → 仅 213247d0
git ls-files .superpowers/sdd/2026-09-21-superpowers-replace-opsx/ | wc -l               # → 0
git check-ignore -v .superpowers/sdd/2026-09-21-superpowers-replace-opsx/task-10-report.md
#   → .superpowers/sdd/.gitignore:1:*  命中
grep -n "按日\|历史基线\|baseline.md" CHANGELOG.md                                        # → 0 命中（裁定无 tracked 载体）

# 5) 裁定原文（本机账本，未入库）
sed -n '59p' .superpowers/sdd/2026-09-21-superpowers-replace-opsx/task-8-report.md
sed -n '40,42p;88p' .superpowers/sdd/2026-09-21-superpowers-replace-opsx/task-10-report.md
sed -n '88p' .superpowers/sdd/2026-09-21-superpowers-replace-opsx/progress.md
```

本报告作者运行环境：HEAD `6dd683f4`，Windows / Git Bash。`.superpowers/sdd/` 下的账本引用
为**本机工作区现状**（gitignore 未入库），克隆环境不可复现该三行——这正是 §4 根因的
直接展示。
