# RC-1 根因定位报告：coding-plan-logic 直连 node:fs/node:path 的架构债（未解清单⑤）

> 角色：根因定位者（R）。HEAD = `6dd683f4`（main）。本报告只读分析，未改任何代码/门禁行为；
> 唯一写入物为本目录。所有断言给 `file:line` 或命令输出依据；复核命令见 §8。
> 分析日期：2026-09-22。

---

## 1. 缺陷陈述

新门禁的纯逻辑模块 `w-model-dev/scripts/logic/coding-plan-logic.ts` 出生即直连
`node:fs` / `node:path`（`:41-42`：`existsSync / readdirSync / readFileSync / statSync` + `path`，
全文件 27 处 fs/path 调用点），以 `__tests__/dependency-boundaries.test.ts` 的**过渡例外表**
登记放行（2 条具名理由，`dependency-boundaries.test.ts:62-69`）。登记与放行发生在出生当日：
出生提交 `ee2a41a2`（2026-09-21），例外登记提交 `ea31c22a`（同日，+16 行）。CHANGELOG
未解清单⑤（`CHANGELOG.md:39`）登记「待改为 IO 注入式后从例外表摘除（届时例外表与期望数组
各 −2）」。本报告裁决：该债该不该还、怎么还、还是转永久登记。

---

## 2. 证据锚点（逐一核实）

| # | 断言 | 位置 | 核实结果 |
|---|---|---|---|
| 1 | 直连导入与调用面：logic 模块头部 import `node:fs` 四函数 + `node:path` | `w-model-dev/scripts/logic/coding-plan-logic.ts:41-42`；fs/path 调用点 27 处（`archivePlanDirs :118-126`、`resolvePlanLocation :132-150`、`validateStageReviews :266-289`、`validateLedgerAndArtifacts :292-355`、`checkCodingPlan :447-463`） | ✅ |
| 2 | 头部先例引用：「本层直接读取 projectRoot 下的制品文件（**gate-logic.ts 同型先例**）」 | `coding-plan-logic.ts:7` | ✅ 属实。注意这是**半真先例**：gate-logic 的聚合入口确实直读，但其可复用纯函数是注入式的（§4.1）——引用只取了对直连有利的一半 |
| 3 | 任务分派骨架来源：「骨架**复用 `check-opsx-artifacts.ts` 的模式**」；该被复用者是 CLI 层文件、直连合法 | `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/task-1-brief.md:5`；退役脚本导入面 `git show ee2a41a2:w-model-dev/scripts/cli/check-opsx-artifacts.ts` `:43-44`（`import * as path from 'node:path'` + `import { existsSync, readdirSync } from 'node:fs'`） | ✅ 属实。依赖边界只限 logic 层（`dependency-boundaries.test.ts:204` `layerOf(from)==='logic'` 才判），CLI 直连合法——骨架模式跨层平移时 IO 跟着走了 |
| 4 | 规格未定义 IO 形态：规格任务表写「logic 纯函数 + CLI」，全篇无「注入 / IO / fs」约定 | `docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md:95`；grep「注入\|node:fs\|IO」全篇零命中 | ✅ 属实。「纯函数」被实现为「放进 logic/ 目录」，不是「无直接 IO」 |
| 5 | 全仓 references 无逻辑层 IO 约定文档 | `grep -rn "IO 注入\|注入式\|文件系统注入" w-model-dev/references/ docs/*.md` → 零命中 | ✅ 属实。约定只存在于 gate-logic 的代码形态与边界测试里，无任何作者侧契约 |
| 6 | 例外登记与承诺：2 条 coding-plan 具名例外 + 期望数组钉住；放行语境「首次全量 prepush 暴露」 | `dependency-boundaries.test.ts:62-69`（Map）与 `:326-331`（钉住数组）；`ea31c22a`（2026-09-21，该文件 +16 行）；`CHANGELOG.md:37`（「批次 1-3 的两处既有红在首次全量 prepush 时暴露并修复」） | ✅ 属实 |
| 7 | 未解清单⑤原文：「待改为 IO 注入式后从例外表摘除（届时例外表与期望数组各 −2）」 | `CHANGELOG.md:39`⑤ | ✅ 属实。**注意「−2」的可兑现性存疑，见 §6 选项矩阵** |
| 8 | gate-logic 注入形态：模块级真实适配器 + 纯函数注入参数 + 聚合入口接线 | `gate-logic.ts:2`（`import * as nodeFs`）、`:902-909`（`nodeFsAdapter`）、`:1122-1131`（`checkPhaseSpecStructure(phase, specDir, fs)`，`@param fs 文件系统注入…便于单测 mock`）、`:1218`（`checkTemplatesStructure` 同）、`:1446`（聚合接线 `checkPhaseSpecStructure(phase, options.specDir, nodeFsAdapter)`） | ✅ 属实。**gate-logic 自身因此永久保留 `node:fs` 例外**（`:47` 理由即「uses the injected filesystem adapter implementation」） |
| 9 | 注入形态的测试收益实证：内存 fs stub | `__tests__/gate-enhancement.test.ts:997`（`mkFs` 内存 stub）、`:1030` 等 20+ 用例零落盘；**:1329**「checkArtifactGate 内部经 nodeFsAdapter 真实读盘（**不可注入内存 fs**），故用 node:fs + os.tmpdir」 | ✅ 属实。注入只到内层纯函数为止，聚合层仍然真读盘——仓内「金标准」也只做了一半 |
| 10 | l0 直连形态与测试面 | `l0-link-audit-logic.ts:1-2`（`import { promises as fs }` + `path`，无接缝）；测试真建 mkdtemp fixture 树（`__tests__/l0-link-audit-logic.test.ts:27-28`，含 symlink/逃逸 fixture，**必须**真文件系统） | ✅ 属实 |
| 11 | coding-plan 现行测试面：35 个用例全部经 mkdtemp 真盘树 | `__tests__/coding-plan-logic.test.ts:16-18`（真 fs 导入）、`:27-40`（mkdtemp 池 + afterEach 清理）、`:86-110`（`writeValidTree` 每正例写约 19 个文件） | ✅ 属实 |
| 12 | 共享函数耦合面：`extractCompletedTaskNumbers` 是纯字符串函数，被 archive-integrity-logic 复用 | `coding-plan-logic.ts:256-263`；`archive-integrity-logic.ts:16,131` | ✅ 属实。**「注入式改造会连锁 check-archive-integrity」的担忧不成立**——该函数 IO 无关，改造不触碰 |
| 13 | 内容注入先例（第四形态）已在生产使用：CLI 读内容、logic 收文本 | `cli/check-archive-integrity.ts:161`（`manifest.progressMdContent = await fs.readFile(...)`）→ `archive-integrity-logic.ts:48`（`@param progressMdContent 归档账本文本`） | ✅ 属实 |
| 14 | checkCodingPlan 生产调用点恰 3 处 | `cli/check-coding-plan.ts:121`、`cli/check-artifact-gate.ts:284`、`cli/self-test.ts:4016` | ✅ 属实（导入分别在 `:49` / `:76` / `:114`） |

---

## 3. 5-Why 缺陷链

**Why 1：为什么新模块带着直连 IO 出生？**
因为它是**移植件而非新设计**：task-1 分派明确「骨架复用 `check-opsx-artifacts.ts` 的模式」
（`task-1-brief.md:5`）。被复用的 opsx 门是 CLI 层文件，直连 fs/path 在那一层**合法**（边界
规则只判 logic 层，`dependency-boundaries.test.ts:204`）；移植时四态目录解析、
validateStageReviews 等 IO 例程作为「要保住的行为」一并搬进了新 logic 模块。

**Why 2：为什么分派给了「移植」框架而不是「按注入约定新写」？**
本批次的任务是**契约平移**（退役 opsx、语义并入新链路：`CHANGELOG.md:45`「语义并入
check-coding-plan.ts R5」），规格对任务 1 的全部 IO 侧要求就是四个字「logic 纯函数」
（`2026-09-21-superpowers-replace-opsx-design.md:95`）——而这四个字没有操作化定义：全仓
references 零处记载「logic 层 IO 形态约定」（§2 #5），S 子代理可依赖的只有两个信号：(a)
brief 点名的 opsx 骨架（直连）；(b) 新文件头部自引的「gate-logic.ts 同型先例」（`:7`，且只引了
其聚合直读的一半）。**不知道**（约定未成文）+ **引用了错一半的先例**，两者叠加。

**Why 3：为什么出生时没被拦住、而是同日被登记放行？**
边界规则是一张**跑在全量测试里的网**，不是作者侧的卡口。批次 1-3 迭代期按快速车道只跑目标
测试，违规活到了「首次全量 prepush」才暴露（`CHANGELOG.md:37` 原文承认这两处是「既有红」）。
暴露时点上门禁已完成、重放证据（119/119，`CHANGELOG.md:32`）已落盘，此刻诚实的最短闭环
就是例外表——而例外表的设计目标恰是「具名 + 留理由而非静默放宽」
（`dependency-boundaries.test.ts:41-44`），它把「违规」转写成「登记」，成本一次、手续合法。

**Why 4：为什么登记之后债务没有归还机制？**
因为「过渡例外」是**措辞不是机制**：例外表条目不挂 ticket、不挂 owner、不挂截止条件，唯一
的「待还」载体是 CHANGELOG 散文一句（`:39`⑤）。其余 9 条先例条目（l0 / state-write / 5 个
path 归一化）事实上都是永久登记，表内没有任何一条真正被「摘除」过——「过渡」在既有实践里
没有兑现先例，新条目自然滑向同一轨道。

**Why 5（根因层）：为什么这套体系会持续产出「带债出生」的 logic 模块？**
因为**「logic = 纯函数」在这套技能包里只是一张下游测试网，不是一条上游作者契约**：规则存在
于 `dependency-boundaries.test.ts`（prepush 末端才跑），不存在于 SKILL.md 分派模板、
subagent-delegation 的 S 角色职责、或 asset-authoring 的资产编写杠杆（均零命中，§2 #5）；
加上例外表提供了零摩擦的合法化通道、且「移植旧 CLI 门」是这类批次的标准任务形态——三个
条件齐备，**任何一个新的文件图门禁只要从 CLI 前身移植，就会带着直连 IO 出生，再被登记**。
coding-plan-logic 不是意外，是当前规则拓扑下的必然产出。

---

## 4. 根因结论

**工作假设裁定：成立，并作两处精化。** 假设问的是「任务 1 分派未给注入式骨架？先例为何没
沿用？」——实证答案是：

- **主根因（约定缺位）**：logic 层 IO 形态约定从未成文，规则只以「末端测试 + 例外表」形态
  存在；分派（brief）与规格（design.md:95）因此都只能在「目录归属」意义上理解「纯函数」，
  IO 形态留给了实现者从手头先例（opsx 骨架）外推。
- **精化 1（先例是「引用错半」而非「不知道 gate-logic」）**：实现者在头部 `:7` 明确引用了
  gate-logic，说明知道其存在；但只引用了「聚合入口直读」的半面，把一个「注入接缝 + 默认
  适配器」的双形文件误读为直连同型。这半真先例之所以能自洽，是因为 gate-logic 自己也
  永久挂着 `node:fs` 例外（§2 #8）——**连金标准都没有兑现「摘除」，例外表事实上没有教过
  任何人「注入化是为了摘除」**。
- **精化 2（成本问题在暴露时点才出现）**：注入式并非「不适用」，而是**在 prepush 暴露时点
  改造的边际成本最高**（重放证据已定稿）。登记是当时唯一诚实的合法化路径，这一步本身
  无可指摘；可指摘的是登记后没有挂任何归还机制（Why 4）。

---

## 5. 仓内先例谱系（logic 层 IO 处理形态全集）

`grep "from 'node:fs'" w-model-dev/scripts/logic/` 全量命中 3 文件（+ coding-plan 共 4 个
fs 族例外）；`node:path` 例外另有 3 个纯归一化文件。按 IO 形态分四型：

| 形态 | 文件 | 结构 | 测试面 | 可测性实际损失 |
|---|---|---|---|---|
| **① 注入接缝 + 模块内默认适配器**（gate-logic 同型） | `gate-logic.ts`（`:2` 直连导入、`:902-909` 适配器、`:1122/:1218` 注入参数、`:1446` 接线） | 内层纯函数收 `fs` 参数；聚合入口用真实适配器真读盘；**模块级 `node:fs` 导入永存 → 例外永久** | 纯函数层：内存 stub 零落盘（`gate-enhancement.test.ts:997,1030+`）；聚合层：真盘 tmpdir（**:1329** 明示「不可注入内存 fs」） | 无损（纯函数层）；聚合层与②同 |
| **② 直连、无接缝** | `l0-link-audit-logic.ts:1-2`；`coding-plan-logic.ts:41-42` | IO 内嵌 | 全部用例真建 mkdtemp 盘上 fixture（`l0-...test.ts:27-28`；`coding-plan-logic.test.ts:27-40,86-110`） | ①比②多出的是：纯分支可内存表驱动。但 coding-plan 现行 35 用例已把 R1-R6（含锚定三态、日历校验 `:498-516`）**行为全部锁绿**——损失不在正确性覆盖，在于每用例付盘上往返（速度 + Windows AV/索引器 flake 面，仓内已有两轮盘测 flake 收敛史：`CHANGELOG.md:342,514`），以及单谓词（如 `isValidArchiveDatePrefix`）须搭全树才能测的工效损耗 |
| **③ 直连但 IO 即本职** | `state-write-logic.ts`（`node:fs/promises` + `node:path` 例外，理由「state persistence implementation」） | 持久化写入器，IO 是职责本身 | 真盘 + gated-writer 等待用例 | 不适用（无可注入化的意义） |
| **④ 内容注入（caller 读、logic 收文本）** | `archive-integrity-logic.ts`（`progressMdContent` 参数，`:48`；生产接线 `cli/check-archive-integrity.ts:161`）；另有 3 个 path-only 归一化文件（docs-consistency / evidence-export / evidence-provenance） | logic 对 fs 零依赖（故不在 fs 族例外表） | 纯文本用例，零落盘 | 无损（对可文本化的判定而言） |

**「现行盘测算不算已足够」的裁决**：作为**行为锁定**——足够（35 用例正反例覆盖 R1-R6 全分支，
含负向 fail-closed 形态）；作为**架构一致性**——不够（module 族的①④形态证明仓内已把
「logic 可内存测」当作可达成标准），作为**测试工效**——有真实但温和的损失（盘上往返、
flake 面、单谓词工效）。这决定了 §6 的收益侧不能夸大：这是**一致性 + 工效**债，不是
**正确性**债。

---

## 6. 债务承重性裁决：三选项评估矩阵

记号：◎优 / ○可 / △有代价 / ✗差。先校准两个事实约束：

- **「−2」承诺按 gate-logic 先例不可兑现**：只要默认适配器留在模块内（gate-logic 同型），
  `node:fs` 导入就在，例外摘不掉（gate-logic 自己就是活证，§2 #8）。要摘 `node:fs` 例外，
  适配器必须外置（CLI/lib 接线）——这**超越**了仓内金标准的现状。
- **调用方连锁远小于登记时的直觉**：共享函数 `extractCompletedTaskNumbers` 是纯字符串函数
  （§2 #12），注入化零触碰；真实连锁 = `checkCodingPlan` 签名加参 × 恰 3 个调用点
  （§2 #14）；archive-integrity 链路结构无关（内容注入，§2 #13）。

| 维度 | **A：兑现⑤（强注入形）**——fs 参数外置适配器，logic 零 fs 导入；node:path 转永久登记 | **B：gate-logic 同型（弱注入形）**——可选 fs 参 + 模块内默认适配器 | **C：转永久登记、撤回「待注入」承诺**（l0 先例口径） |
|---|---|---|---|
| 例外表诚实度 | ◎ `node:fs` 例外真摘除（−1）；`node:path` 改写为与其余 5 个 path 例外同款的永久理由。表内不再有「挂账未还」条目，⑤以修正口径（−2 → −1 + path 永久化）销项 | ✗ 两条例外都摘不掉（模块内导入永存），⑤必须改写为「已注入化、例外转永久（同 gate-logic）」——承诺变相放弃 | △ 零摘除；⑤以「裁定：接受直连为文件图门禁常态」销项。诚实但降级了规则走向 |
| 可测性增量 | ◎ 纯函数层内存表驱动成为可能（mkFs 先例 `:997`）；盘测可收缩为少数集成例（或经 samples 真目录） | ◎ 同 A（接缝等价） | ✗ 维持 35 用例全盘测；flake 面延续 |
| 改造成本 | ○ 27 处 fs/path 调用点中 fs 族约 20 处穿参（机械）；3 个调用点各加适配器实参（或提 `lib/` 小适配器防三抄）；35 用例改造或双轨 | ○ 略低于 A（调用点不动），但低出的恰是 A 的最小增量——**被 A 支配** | ◎ 零改造（改 2 条理由文案 + CHANGELOG 销项） |
| 规则层信号 | ◎ 边界走向「logic 逐步纯化」，且把「注入化 = 为了摘除」第一次变成既成事实 | △ 接缝有了、表纹丝不动——「过渡例外」语义彻底名存实亡 | ✗ 边界走向「登记台」：每个未来 logic 直连都可合法化。且 C 的先例类比有硬伤：l0 扫描的是**分发技能包树**、state-write **本职即 IO**，两者是 IO-native 职责；coding-plan 的 IO 是**偶发的**（契约校验器，输入恰好是文件），「常态」论证比表面弱 |
| 与仓内先例一致性 | ○ 超越 gate-logic（外置适配器）；复用④形态思路 | ◎ 恰为 gate-logic 同型 | ○ 沿 l0/state-write 口径 |
| 风险 | △ 路径/存在性语义须逐点等值（现 35 用例 + CLI 子进程测试可护航）；改动面大但纯机械 | △ 同左，略小 | ◎ 无技术风险；付出规则信号代价 |

**裁决**：B 被 A 支配（A 的额外成本 = 3 个调用点穿参，额外收益 = 真摘除 + 真销项）。
实质对决在 **A vs C**：A 赢在例外表回归「永久登记」语义、模块进纯函数族、测试工效与 flake
面改善，且连锁面已被实证为小；C 赢在零成本，但把一条**偶发 IO** 的模块与两条 **IO 本职**
先例混为一谈，规则信号是降级的。**推荐 A**，并显式修正⑤的「−2」为「−1 + path 永久登记」
（对齐 gate-logic 先例的现实口径——金标准自己都没做到 −2，承诺应改成可达成的形状）。

---

## 7. 推荐 + 落点草图（落点级，非实现计划）

**推荐：选项 A（fs 注入 + node:path 转永久登记），同步修正⑤承诺口径。**

1. **`w-model-dev/scripts/logic/coding-plan-logic.ts`（核心）**
   - 定义最小端口接口（结构化，不引 Node 类型依赖）：
     `export interface CodingPlanFs { existsSync(p: string): boolean; readFileSync(p: string): string; statSync(p: string): { isFile(): boolean; size: number }; readdirSync(p: string, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }> }`。
   - `checkCodingPlan(projectRoot, phase, changeId, fs: CodingPlanFs)` 签名加第 4 必选参；
     `resolvePlanLocation / archivePlanDirs / listArchiveDirNames / validateStageReviews /
     validateLedgerAndArtifacts` 穿参；**删除 `:41` 的 `node:fs` 导入，保留 `:42` 的
     `node:path`**（`toRel` 展示路径已全是 `/` 拼接，`:164-166`；绝对路径拼接留 path.join
     不做 Windows 分隔符冒险）。
2. **真实适配器外置（一处，防三抄）**：新增 `w-model-dev/scripts/lib/coding-plan-fs.ts`
   （lib 层 fs 导入合法，边界只判 logic 层）导出 `nodeCodingPlanFs`；3 个调用点
   （`cli/check-coding-plan.ts:121`、`cli/check-artifact-gate.ts:284`、`cli/self-test.ts:4016`）
   各传实参。`extractCompletedTaskNumbers`（`:256-263`）零触碰，archive-integrity 链零波及。
3. **测试**
   - `coding-plan-logic.test.ts`：35 用例改内存 stub（`gate-enhancement.test.ts:997` mkFs
     同款；日历/锚定谓词可顺手抽成表驱动直测）；另留 2-3 个真适配器集成用例直接打
     `samples/coding-plan/` 三 fixture（真仓库路径、只读），保住「端到端真盘语义」一角。
   - `check-coding-plan.test.ts`（CLI 子进程）不动——天然覆盖真实适配器路径。
4. **`dependency-boundaries.test.ts`**：Map（`:62-65`）与钉住数组（`:326-328`）删除
   `coding-plan-logic.ts:node:fs` 条目；`node:path` 条目（`:66-69` / `:329-332`）理由改写为
   永久口径（「normalizes coding plan artifact and archive snapshot paths」已是永久语气，
   保留即可，但须与⑤的销项文案对齐）。
5. **`CHANGELOG.md:39`⑤ 销项**：改为「已裁定并实施：fs 例外摘除（−1）；node:path 依
   gate-logic 等 6 文件先例转永久登记；原『各 −2』口径按先例现实修正」。若 SSoT §10M 有
   对应句一并订正（行动约束：SSoT 优先）。
6. **流程补丁（堵 Why 5 的再发轴）**：在 `w-model-dev/references/asset-authoring.md`（资产
   编写杠杆节）或 `subagent-delegation.md` 的 S 角色职责处，补一条成文约定：「新增
   `logic/` 模块默认零 `node:fs` 导入——文件图门禁采 gate-logic 注入接缝形（fs 参数 +
   CLI/lib 默认适配器）或 archive-integrity 内容注入形；直连须在分派 brief 里显式申请例外」。
   这是防「下一个移植件再带债出生」的唯一根治落点，优先级与注入化本身相同。
7. **验收口径**：定向 vitest（coding-plan* / dependency-boundaries / gate-enhancement /
   check-coding-plan / samples 覆盖）+ 全量收口按仓库惯例跑 prepush；实施本身按约束 #14
   走 codegraph 修改前查询与回归钩子（流程约束，非缺陷面）。

---

## 8. 可复核命令

```bash
# 1) 直连面与先例谱系
grep -rn "from 'node:fs'" w-model-dev/scripts/logic/                 # 恰 3 文件 + coding-plan
sed -n '41,42p;7p' w-model-dev/scripts/logic/coding-plan-logic.ts    # 导入面 + 半真先例引用
sed -n '902,909p;1122,1131p;1446p' w-model-dev/scripts/logic/gate-logic.ts   # 注入形态三件
sed -n '1,2p' w-model-dev/scripts/logic/l0-link-audit-logic.ts        # 直连形态

# 2) 出生与登记时间线
git log --oneline --follow -- w-model-dev/scripts/logic/coding-plan-logic.ts   # ee2a41a2 出生
git show ea31c22a --stat                                                       # 同日例外登记 +16
git show ee2a41a2:w-model-dev/scripts/cli/check-opsx-artifacts.ts | sed -n '43,44p'  # 被移植骨架的直连导入
sed -n '5p' .superpowers/sdd/2026-09-21-superpowers-replace-opsx/task-1-brief.md     # 「骨架复用 opsx 模式」

# 3) 例外表与承诺
sed -n '30,70p;305,344p' w-model-dev/scripts/__tests__/dependency-boundaries.test.ts
grep -n "仍未完成" -A 3 CHANGELOG.md                                    # :39 ⑤原文

# 4) 耦合面实测
grep -n "extractCompletedTaskNumbers" w-model-dev/scripts/logic/archive-integrity-logic.ts   # :16,:131 纯函数复用
grep -n "checkCodingPlan(" w-model-dev/scripts/cli/*.ts                  # 恰 3 调用点
grep -n "progressMdContent" w-model-dev/scripts/cli/check-archive-integrity.ts               # :161 内容注入先例

# 5) 注入形态的测试收益对照
sed -n '997,1000p;1329p' w-model-dev/scripts/__tests__/gate-enhancement.test.ts
grep -c "it(" w-model-dev/scripts/__tests__/coding-plan-logic.test.ts   # 35（全盘测）

# 6) 约定缺位实证（双零命中）
grep -rn "IO 注入\|注入式\|文件系统注入" w-model-dev/references/ docs/*.md
grep -n "注入\|node:fs" docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md
```

本报告作者运行环境：HEAD `6dd683f4`，Windows / Git Bash。
