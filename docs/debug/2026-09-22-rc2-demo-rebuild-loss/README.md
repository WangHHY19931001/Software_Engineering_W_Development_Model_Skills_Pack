# RC-2 根因定位报告：demo 重建覆盖 live-run 态证据（`--reset` 无保全模式 × 销毁前保全规则缺位）

> 角色：根因定位者（R）。HEAD = `6dd683f4`（main）。本报告只读分析，未改任何代码/脚本/文档行为；
> 唯一写入物为本目录。所有断言给 `file:line` 或命令输出依据；复核命令见 §8。
> 分析日期：2026-09-22。

---

## 1. 缺陷陈述

「superpowers 替换 opsx」任务 9 以 `python build_workspace.py --reset` 重建 e2e demo 工作区
（命令原文：`docs/debug/2026-09-21-superpowers-replace-replay/replay.txt:9`），覆盖了
2026-09-20 真实 8 阶段调测的 live-run 态（315 行 run-log / 125 环签名链 / E-1 备份文件 /
392 份 gate-logs），装配器基准态（104 行 / 49 环）取而代之（本次实测盘面复核见 §8-1）。
证据仅存于已入库文档（`docs/debug/2026-09-20-wm-8phase-live-run/{README.md,gate-fix-replay.txt}`
与 `docs/debug/2026-09-21-superpowers-replace-replay/`），调试报告 §六 的 replay 命令从此只对应
历史态（该节已由 075e28d5 加「⚠️ 对应历史态」指引，`docs/debug/2026-09-20-wm-8phase-live-run/README.md:78-82`）。

任务 9 对此的裁定是「可接受（demo 是 gitignored 瞬态工作区，其证据已固化在 docs/）」——
登记于 `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/progress.md:78`，发生在重建**执行之后**
（副作用登记，非事前门禁）。

---

## 2. 证据锚点（逐一核实）

| # | 断言 | 位置 | 核实结果 |
|---|---|---|---|
| 1 | `--reset` 是整树清空的唯一路径；参数面仅此一个 flag | `eval/e2e/demo-assets/build_workspace.py:67-70`（argparse 仅 `--reset`） | ✅ 属实。`grep -n "add_argument"` 全文件仅 1 处 |
| 2 | `--reset` 对整树 `rmtree_force`，`.w-model/` 在删除面内；常规运行同样重建 8 目录（含 `.w-model`） | `build_workspace.py:80-84`（哨兵校验后 `rmtree_force(ROOT)`）、`:100-103`（`for d in ('.w-model', '.superpowers', 'tla', 'features', 'src', 'test', 'docs', 'archive')` 逐目录 rmtree） | ✅ 属实 |
| 3 | 装配器无任何保留态/快照/导出模式 | `build_workspace.py` 全文 `grep -n "keep\|backup\|snapshot"` 零命中（仅 rmtree helper） | ✅ 属实 |
| 4 | 装配器的既有护栏方向全是「防删错目录」，无一处「删前保全」 | `build_workspace.py:74-76`（根须以 demo 结尾且非仓库根）、`:25-43`（哨兵判据 SPEC.md + .w-model/project.json） | ✅ 属实 |
| 5 | 任务 9 裁定「可接受」及其理由 | `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/progress.md:78` | ✅ 属实。原文含「E-1 的 `.bak` 备份随重建消失」——即裁定者当时已知道备份丢失 |
| 6 | 计划的 10 条全局硬约束（0-9）无一条涉及 demo 态保全 | `progress.md:17` | ✅ 属实（0=遗留收口…9=每任务收尾验证，无保全项） |
| 7 | 重放记录书面承认装配器无保留模式 | `replay.txt:16-20`（边界声明 1：「装配器的 `--reset` 与『常规运行』都会**删除并重建 `.w-model/`**，装配器没有任何保留既有运行态的模式」） | ✅ 属实 |
| 8 | E-1 两个 .bak 备份留在 demo `.w-model/` 下 | `docs/debug/2026-09-20-wm-8phase-live-run/gate-fix-replay.txt:17`（`run-log.jsonl.bak.20260920T215857Z-preT10-normalize`）、`:32`（`*.bak.20260920T220335Z-preT10-r2fix`）、`:209-211`（「留在 eval/e2e/demo/.w-model/ 供复核」） | ✅ 属实（当时）；**现已不存在**（§8-1 实测 `NO .bak FILES`）——备份在 `.w-model/` 内，正是删除面中心 |
| 9 | 成文导出链：需要交付时先 `wm:verify-evidence-source` 再 `wm:export-evidence` | `AGENTS.md` §1「本地生成物与审计证据」注 | ✅ 存在，但见 #10-#13 的适用性裁定 |
| 10 | producer 无条件要求 git HEAD：`gitHead(project)` 读 `<project>/.git`，失败抛 `MISSING_GIT_HEAD` | `w-model-dev/scripts/logic/evidence-provenance-logic.ts:382`（`const commitSha = await gitHead(project)`）、`:188-223`（无 .git/非法 gitdir → `throw new ProvenanceFailure(1, 'MISSING_GIT_HEAD')` 在 `:223`） | ✅ 属实 |
| 11 | demo 工作区被明令禁止含 `.git` | `build_workspace.py:77-79`（存在 .git 即 fail-closed exit）；`eval/e2e/demo-assets/README.md:40`（坑 1） | ✅ 属实——demo 工作区**永远不满足** #10 的前提 |
| 12 | export 侧要求 `.w-model/evidence-provenance.json` 在场且通过 source 复验 | `w-model-dev/scripts/logic/evidence-export-logic.ts:588-591`（snapshot 失败即 `INVALID_PROVENANCE`）、`:607-609`（`verifySourceProvenance` 不 ok 同样拒绝） | ✅ 属实——export 严格下游于 producer，producer 不可用则 export 整链不可用 |
| 13 | 导出白名单含 run-log.jsonl，但**不含根级 signature-chain.jsonl** | `evidence-export-logic.ts:110-113`（DIRECTORY_SOURCES 仅 `gate-logs/`、`verifier-outputs/`、`signature-chains/`、`codegraph-queries/` 四目录）、`:297-298`（文件特例仅 `run-log.jsonl`） | ✅ 属实。demo 的 125 环链在 `.w-model/signature-chain.jsonl`（根级文件）——即使 #10-#12 前提可满足，链文件也不会进证据包 |
| 14 | 「瞬态可重建」的成文位置（含对运行态清除的书面预告） | `.gitignore:5`；`AGENTS.md` §1 eval/ 行；`eval/e2e/demo-assets/README.md:4`（「gitignored 瞬态目录」）、`:40`（坑 1：「`.w-model` 含 run-log / signature-chain / budget 等运行时状态，重建即回到装配器的基准态」） | ✅ 属实 |
| 15 | CHANGELOG 将该态称为「完整保留」 | `CHANGELOG.md:33`（「该态证据完整保留在 `docs/debug/2026-09-20-wm-8phase-live-run/`，但不可再在工作区内复现」） | ✅ 属实，但「完整保留」言过其实——docs/ 存的是叙事 + 摘录，非制品全文（§5） |
| 16 | live-run 自我定性为只读调测、产物全在瞬态区 | `docs/debug/2026-09-20-wm-8phase-live-run/README.md:4`（「全部产物在 gitignored 瞬态工作区」）、`:74`（§五.5「本报告目录外的产物均为 gitignored 瞬态工作区，不随提交交付」） | ✅ 属实 |
| 17 | 链与 run-log 互不可推导（链 sigHash 只覆盖链字段） | `gate-fix-replay.txt:39-41`（「签名链 sigHash 仅覆盖链环自身字段…不含 run-log 条目体」） | ✅ 属实——丢任一即永久丢该件 |

---

## 3. 5-Why 缺陷链（四条追问线索逐一核实）

**Why 1：为什么重建前没有状态保全？**
任务 9 的授权命令就是重建命令本身（`replay.txt:9`），裁定链（`progress.md:78`）与计划的全局
硬约束 0-9（`progress.md:17`）都**没有一条**要求「重建前保全」——裁定是在重建执行之后对副作用
做的「可接受」登记。裁定链上缺的规则是：**破坏性操作前必须先做证据等级裁定并执行保全**。
裁定者并非不知情——同一行明确登记了「E-1 的 `.bak` 备份随重建消失」与「D-4a/D-4b 的 demo
实证只存在于 live-run 记录」（`progress.md:78`）——即在**完整知情**的状态下仍裁定可接受，
因为可接受的理由（「证据已固化在 docs/」）在其掌握的信息面内是自洽的。

**Why 2：为什么「证据已固化在 docs/」能作为验收前提？**
因为「证据固化」在仓内**没有成文定义**：没有任何文档规定固化的证据类别（run-log 全文？链全文？
gate-logs？）、粒度（全文 vs 摘录）、验证方式（可机器重放 vs 文档断言）。docs/ 实际固化的是
叙事报告（95 行 README）+ 电池转录摘录（212 行 gate-fix-replay），`CHANGELOG.md:33` 随即把它
表述为「完整保留」——把**叙事固化**当成了**制品固化**。裁定验收时没有清单可核对，这个语义
滑坡无人拦截。（追问线索 ① 的答案：裁定链缺的是「销毁前证据分级裁定」规则本身；有了它，
「固化」就必须先被定义、再被核对，理由就不能只是一句话。）

**Why 3：为什么没有保全机制可用？（追问线索 ② + ③）**
- 装配器侧（线索 ②）：参数面仅 `--reset` 一个 flag（`build_workspace.py:67-70`），`--reset` =
  哨兵校验后的整树 `rmtree`（`:80-84`），常规运行同样删 8 目录含 `.w-model`（`:100-103`）；
  全文无 keep/backup/snapshot 语义。这是**从初版（952b6b0a，2026-09-19）就如此的设计边界**，
  不是回归（§6）。
- 成文导出链侧（线索 ③）：`AGENTS.md` §1 的「需要交付时先 `wm:verify-evidence-source` 再
  `wm:export-evidence`」对本例**结构性不可用**——producer 无条件 `gitHead(project)`
  （`evidence-provenance-logic.ts:382`），而 demo 工作区被装配器明令禁止含 `.git`
  （`build_workspace.py:77-79`，目的是让 `--scope` 绑定仓库 HEAD）；无 `.git` 即
  `MISSING_GIT_HEAD`（`:223`）。export 侧又强制要求 producer 产出的
  `evidence-provenance.json`（`evidence-export-logic.ts:588-591`）。**即：即使任务 9 当时想走
  成文链路，也会在第一步失败**——成文规则隐含了「被导出项目是 git 仓库」的前提，而唯一
  会承载真实调测运行的 demo 工作区恰好被设计成永远不满足该前提。另有一处白名单缺口：
  根级 `signature-chain.jsonl` 不在导出面内（`evidence-export-logic.ts:110-113,297-298`），
  125 环链即使其他前提全满足也不会被导出。
- 结论：机制层是**双缺口**——fixture 装配器无保全模式（对瞬态合理）× 唯一成文固化链
  source-bound（对无 .git 的 demo 不可用）。demo 工作区落在「瞬态（无保全）」与
  「真实项目（有导出）」两类之间的空档里。

**Why 4：为什么唯一证据态会放在瞬态工作区？（追问线索 ④ 的前置）**
live-run 的自我定性是「只读调测，全部产物在 gitignored 瞬态工作区」（live README:4,:74）——
执行当时没有规则要求把它当「证据承载运行」对待；仓库证据策略刻意让 `.w-model/` 默认不入库
（`AGENTS.md` §1），而唯一固化路径又被 Why 3 证明对 demo 不可用。工作区角色在 2026-09-20
从「可随时重建的 fixture」变为「唯一证据载体」，但装配器与其 README 的语义停留在 2026-09-19
的 fixture 前提（`demo-assets/README.md:4,:40`）——**角色变更没有被任何一方感知**，
因为没有任何规则要求「工作区开始承载唯一态时复核其可重建性假设」。

**Why 5（根因层）：为什么系统没有在销毁发生前拦住它？**
因为仓库对「Git 跟踪 vs 瞬态」有成文边界（`.gitignore:5`、AGENTS §1）、对「交付导出」有成文
路径（AGENTS §1 + 两个脚本），但**没有任何一条规则把「破坏性操作」与「销毁前的证据分级
裁定 + 保全」绑定**；同时唯一的成文保全机制以 git HEAD 为前提，恰好覆盖不了最常承载真实
运行的 demo 工作区。于是第一次 live-run 之后的例行重建**在结构上必然**静默销毁唯一初级证据。
流程在披露层工作了（`progress.md:78` 如实登记），在预防层没有任何机制工作——`--reset` 执行
前没有任何门禁、提示或裁定步骤。

---

## 4. 根因结论（工作假设裁定）

**控制器登记项成立，根因精化为三层：**

1. **规则层根因（主）**：「销毁前保全」规则缺位——无任何成文要求在破坏性重建/清理前对
   gitignored 工作区的态做证据分级裁定；「证据固化」无定义粒度与核对清单，导致任务 9 裁定
   以未经核对的「已固化在 docs/」（实为叙事固化）为验收前提（Why 1/Why 2）。
2. **机制层根因（辅）**：唯一成文固化链 `wm-verify-evidence-source` → `wm-export-evidence`
   以 source-bound git HEAD 为前提（`evidence-provenance-logic.ts:382,:223`），对被设计为
   无 `.git` 的 demo 工作区结构性不可用（`build_workspace.py:77-79`）；导出白名单另缺根级
   `signature-chain.jsonl`（`evidence-export-logic.ts:110-113,297-298`）（Why 3）。
3. **传播层条件**：装配器 `--reset`/常规运行均无差别删除 `.w-model/`
   （`build_workspace.py:84,:100-103`），E-1 备份在删除面中心（`.w-model/` 内，`gate-fix-replay.txt:209-211`
   → 实测已消失）——「备份」是同目录备份，防写坏不防销毁（Why 3/线索 ④ 的答案）。

不是根因的候选：任务 9 执行者的操作（命令与授权完全一致）；「瞬态不入库」策略本身
（策略合理，缺的是销毁前桥梁规则）；装配器护栏（其目标——防删错目录——已达成）。

---

## 5. 损失实际范围裁决

### 5.1 丢失物（逐项，均实测不可恢复）

| 丢失物 | 内容 | 文档中残存形态 |
|---|---|---|
| run-log 315 行（清洗后终态） | 阶段 1-8 全部 A/S/R/V/G/O 记录 | 角色分布计数（live README:23）+ 尾条 checkpoint 记录原文（`gate-fix-replay.txt:19`）+ B1 关键输出（`replay.txt` 无对应——该态已不在） |
| run-log 321 行原始版（含放行后 6 条 R8/r3-fix 记录） | E-1 簿记缺陷的原始凭证 | 仅描述性记载（live README:12-18；gate-fix-replay:20-23 列出 316-321 条性质），**原始记录全文无存**（其唯一载体 bak-215857Z 亦丢失） |
| signature-chain.jsonl 125 环 | 全链 sigHash/signer/时间戳/inputProvenance | 仅计数（live README:23）与 B3 电池输出（R1-R10 全绿摘要） |
| 392 份 gate-logs | 每次门禁真实执行日志 | 文档引用十余条关键输出（live README §三、gate-fix-replay §二） |
| E-1 `.bak` ×2 | 321 行原始版与 315 行 pre-R2fix 版 | 文件名与操作记载（gate-fix-replay:17,:32,:209-211） |
| 其余运行态 | checkpoint-log ×8、verifier-outputs（live-run 真实 V 输出全文）、budget/maturity/graph 等 | 关键数字幸存于文档引用（580.5M tokens：live README:5；返工 7/275.3%/2.75：gate-fix-replay:128-138） |

### 5.2 幸存物

1. `docs/debug/2026-09-20-wm-8phase-live-run/README.md`（95 行：逐阶段表 §二、38 次拦截分类
   §三、D-1..D-10 §四、§六历史态指引 `:78-82`——075e28d5 补）。
2. `docs/debug/2026-09-20-wm-8phase-live-run/gate-fix-replay.txt`（212 行：B1-B8 逐条命令 +
   退出码 + 关键输出、§三链重放正反例、§四 self-test 358 / prepush 19 项全绿）——**这是
   live-run 态机器可核对证据的主要载体**。
3. `docs/debug/2026-09-21-superpowers-replace-replay/`（replay.txt 526 行 + negative-probes.txt
   69 行，新契约态证据）。
4. Git 历史：`CHANGELOG.md:31-34`、`progress.md:78`、live README 提交史（e7574678 订正、
   075e28d5 历史态指引）。

### 5.3 裁决：「固化在 docs/debug」是否足以支撑「调测结论可复核」？

**结论层：足够。制品层：不足。缺口定性：中。**

- **结论层可复核** ✅：调测报告的结论（8 项发现、12 项门禁终值、38 次拦截、V 三度阻断）由
  两份入库文档自洽承载；门禁**行为**的正确性另有两路独立证据锁定——仓库自身测试套件
  （self-test + vitest 全量，prepush 19 项门禁之列）与新契约 119/119 重放
  （`replay.txt` §五）。审计者核对「当时结论是否可信」有三路交叉。
- **制品层不可复核** ✘：对**当时运行态**重跑门禁已不可能——live README §六 命令今天得到的
  是 104/49（§8-1 实测），R8/r3-fix 原始违规记录、125 环链、392 日志无法再机器验证，只剩
  文档断言。证据等级从「可机器重放」降为「转录摘录 + 叙事」。
- **唯一实质功能缺口**：D-4a/D-4b（killSwitch 返工计数 + Σtokens 上限）的 demo 实证
  （返工 7 ≥ 3、阶段消耗占比 2.75 ≥ 0.9、tokens 超 275%）**随 live-run 态消失且无任何可复现
  载体**——重建基准态下该门为绿（`replay.txt:448-459` §三-3 已如实登记「期望来源不同」并
  建议「由 live-run 状态或专门负向 fixture 承担」）。至今负向 fixture 未建。这是唯一一个从
  「有真实实证」退化为「无实证」的门禁行为项，也是本损失中真正需要后续动作补位的一项。
- **不构成缺口的**：「照抄 §六 命令得到不同结果」的误导面已由历史态指引（live README:78-82）
  封住；新契约态的可复现性由装配器确定性 + `replay.txt` 完整承载，与本次损失无关。

---

## 6. 上游回溯

### 6.1 `--reset` 语义是谁定的（git 实证）

`git log --follow -- eval/e2e/demo-assets/build_workspace.py`（§8-3）：

| 日期 | 提交 | 内容 | 对本缺陷的贡献 |
|---|---|---|---|
| 2026-09-19 | `952b6b0a` | 初版 727 行：`--reset`=整树清空 + 7 目录重建 | **「无差别删除、无保全」从初版即是语义边界** |
| 2026-09-19 | `0170e226`/`8ae12c56`/`bcea41d9` | `--reset` 护栏三轮加固（目录名判据/哨兵/只读解除/fail-fast） | 护栏方向全部是**防删错目录**，无一处删前保全 |
| 2026-09-21 | `50c1531a` | 阶段 5-8 构造改新契约 + 清理面七→八目录 | 本次重建的执行者 |
| 2026-09-21 | `b3e6a163`/`c84545b7` | 回执模板订正 / opsx 退役连带 | 语义不变 |

结论：`--reset` 的「整树清空」语义由 `952b6b0a`（2026-09-19，e2e 可重放资产交付）确立；
保全语义缺位是其**初始设计边界**（对 fixture 用途成立），后续加固从未复核该边界在新用途
（live-run 载体）下是否仍成立。

### 6.2 「瞬态工作区可随时重建」的成文位置

- `.gitignore:5`——「eval/e2e/demo/ … 瞬态工作区，记录文件在 eval/e2e/*.md」。
- `AGENTS.md` §1——eval/ 行「gitignored 瞬态 e2e 工作区」；「本地生成物与审计证据」注
  （`.w-model/` 默认不入库、交付走 producer+export）。
- `eval/e2e/demo-assets/README.md:4`（「受跟踪的可重放资产；工作区本身…瞬态目录」）。
- **`eval/e2e/demo-assets/README.md:40`（坑 1）——最显式的一份书面预告**：「`.w-model` 含
  run-log / signature-chain / budget 等运行时状态，重建即回到装配器的基准态」。

即：知识完全在案（重建会清运行态），缺的是从这条知识到「故唯一态重建前必须保全」的
**规则桥**——这条桥不存在于 AGENTS、references（hard-constraints 48 条反模式、
operation-behaviors F1-F10）、装配器 README 或任务计划的任何一处。

---

## 7. 补救选项矩阵

记号：◎优 / ○可 / △有代价 / ✗差。

### ① 接受现状 + 保留 T10 历史态指引（已做：075e28d5 → live README:78-82）

- 评估：△ 指引正确完成了**导航修复**（防照抄失效命令、给当前态入口），必要；但它不恢复
  制品层复核、不防复发，且对「损失了什么」零披露（§六指引只说「结果会不同」）。
- 成本 ≈ 0。**单独采用：✗ 不足。**

### ② 把 live-run 关键态作为附录固化入库

- 评估：**边际价值低，且大部分已不必要**。gate-fix-replay.txt 已携带关键态的机器可核对摘录
  （尾条记录原文 `:18-23`、B1-B8 退出码与关键输出、预算红三行数字 `:128-138`、链重放
  正反例 `:150-172`）；真正丢失的 315 行全文 / 392 日志**无法用附录恢复，也不应伪造重建**
  （与 E-2 报告反伪造立场同源）。②剩余的可做形态是一节「证据清单地图」（哪条断言由哪段
  摘录承载，约 20-30 行，服务审计者导航）。
- 成本：小（一份文档增补）。收益：低-中（导航增强，零复核力提升）。**推荐：可选、低优先；
  若做，明确标注「摘录为残存全貌，非制品」。**

### ③ 给 `build_workspace.py` 加保全机制 —— **推荐（机制位）**

- 形态建议：不是单加 `--keep-state`（常规运行同样删 `.w-model`，只管 `--reset` 不够），而是：
  (a) **非基准态检测 + fail-closed**——删除 `.w-model` 前（`--reset` 与常规路径同管）检测
  非装配器基准态信号（如 run-log 行数 ≠ 装配器基准、存在 `*.bak.*`、checkpoint 放行记录），
  命中即 exit 并要求显式 `--accept-state-loss` 或先快照——与装配器既有护栏（哨兵判据、
  目录名判据）同一风格；(b) 可选补 **自动快照**：删除前把 run-log / signature-chain /
  checkpoint-log / gate-logs 清单拷入 gitignored 的 `eval/e2e/demo-snapshots/<ts>/`
  （`.gitignore` 加一行），保住「重建后工作树干净」的可重放前提。
- 成本：30-60 行 Python + README 同步 + `.gitignore` 一行；eval 资产非门禁脚本、无登记义务
  连锁（不触碰 exit-2 登记册 / AGENTS §8）。收益：把 Why 5 的结构必然性拆掉——未来任何
  live-run 态在重建前必被检测/快照。**推荐采用，且倾向 (a) 为主（防越权销毁强于代客备份）。**

### ④ 成文规则「销毁前保全」—— **推荐（根因位，主修复）**

- 落点：`AGENTS.md` §1「本地生成物与审计证据」注 + `eval/e2e/demo-assets/README.md`（§「已实测
  的坑」前新增一节）。措辞要点：凡对 gitignored 工作区执行破坏性重建/清理（含
  `build_workspace.py --reset` 与常规运行），若该态可能是唯一证据载体（存在真实调测/运行的
  `.w-model` 态），必须**先**完成证据分级裁定并保全（快照入库 `docs/debug/` 或走导出链——
  同时注明导出链对无 `.git` 工作区不可用的边界，见下）——再销毁。
- 成本：纯文档（不建议新增反模式编号：会牵动 48 条计数四方同步，成本收益不匹配）。
- 收益：直接闭合 Why 5 的规则缺位；使未来任务裁定链上有可核对的清单（证据类别 × 粒度 ×
  验证方式）。
- **推荐采用，与 ③-a 组合**：④ 定义务（何时必须保全），③-a 提供机器拦截（忘了 ④ 时
  `--reset` 会停下）。

### 附加登记（不属本修复，须独立裁定）

- **导出链前提错配**：`wm-verify-evidence-source`/`wm-export-evidence` 以 source-bound git HEAD
  为前提（§2 #10-#12），对无 `.git` 的 demo 类工作区结构性不可用——「瞬态但承载唯一态」的
  工作区在现有两类机制（瞬态/真实项目）之间无保全工具。是否需要一个「package-only producer」
  或「无 git 项目的快照级 provenance」，属规格裁定（与 `wm-export-evidence --verify` 既有
  package-only 形态呼应）。
- **导出白名单缺根级 `signature-chain.jsonl`**（§2 #13）：签名链是一等证据资产
  （signature-chain-guide / check-signature-chain），但导出面只认 `signature-chains/` 目录。
  对 git 项目同样存在——run-log 可导出而链不可导出，证据包不完整。

### 推荐组合

**④（规则，主）+ ③-a（装配器 fail-closed 检测，辅）**，①保留（已完成），②降级为可选的
「证据清单地图」；两条附加登记交规格层裁定。不推荐任何「重述丢失制品」的形态。

---

## 8. 可复核命令

```bash
# 1) 盘面现状（丢失的实测确认）
cd D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack
wc -l eval/e2e/demo/.w-model/run-log.jsonl eval/e2e/demo/.w-model/signature-chain.jsonl
#   → 104 / 49（装配器基准态；live-run 为 315/125，live README:90 记 321/125 为清洗前）
ls eval/e2e/demo/.w-model/*.bak.* 2>/dev/null || echo "NO .bak FILES (wiped)"

# 2) 任务 9 裁定与重放边界声明
grep -n "重要事实登记（demo 重建的副作用）" .superpowers/sdd/2026-09-21-superpowers-replace-opsx/progress.md   # :78
sed -n '15,24p' docs/debug/2026-09-21-superpowers-replace-replay/replay.txt                                    # 边界声明 1-2

# 3) --reset 语义上游
git log --follow --format="%h %ad %s" --date=short -- eval/e2e/demo-assets/build_workspace.py
#   → 952b6b0a 2026-09-19 初版（整树清空语义确立）→ 0170e226/8ae12c56/bcea41d9（护栏）→ 50c1531a（重建执行者）
sed -n '67,84p;95,104p' eval/e2e/demo-assets/build_workspace.py          # 参数面/护栏/整树 rmtree/8 目录重建
grep -n "keep\|backup\|snapshot" eval/e2e/demo-assets/build_workspace.py  # 保全语义零命中

# 4) 导出链对 demo 的结构性不可用
grep -n "await gitHead\|MISSING_GIT_HEAD" w-model-dev/scripts/logic/evidence-provenance-logic.ts   # :382 / :223
sed -n '77,79p' eval/e2e/demo-assets/build_workspace.py                   # demo 禁止 .git（前提永假）
sed -n '585,592p' w-model-dev/scripts/logic/evidence-export-logic.ts      # export 强制 provenance.json
sed -n '108,114p;295,299p' w-model-dev/scripts/logic/evidence-export-logic.ts  # 白名单：无根级 signature-chain.jsonl

# 5) 「瞬态可重建」成文位置
sed -n '4p;40p' eval/e2e/demo-assets/README.md                            # :40 坑1 = 书面预告
grep -n "eval/e2e/demo/" .gitignore                                       # :5
```

本报告作者运行环境：HEAD `6dd683f4`，Windows / Git Bash；§5.1/§8-1 盘面断言由本机
`eval/e2e/demo/` 实测。报告本身为唯一写入物，未改任何代码、脚本或既有文档。
