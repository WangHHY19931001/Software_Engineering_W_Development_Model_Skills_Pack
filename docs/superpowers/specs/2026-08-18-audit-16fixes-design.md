# W-Model 技能包 16 项审计修复 — 设计规格（决策层勘误版）

> **日期**：2026-08-18
> **状态**：已确认（用户逐节批准：架构决策 D1-D5 / 勘误表 E1-E3 / 验证策略与执行编排）
> **关联文档**：[2026-08-16-audit-16fixes-plan.md](./2026-08-16-audit-16fixes-plan.md)（步骤权威源，含 12 任务 TDD 细节；原 `d:\w_skill_opt\问题.md`，2026-08-18 移入本目录并更名，使 specs/ 自包含）
> **先例**：`docs/superpowers/specs/2026-08-15-skill-opt-audit-21fixes-design.md`

---

## 0. 文档定位与权威关系

本 spec 为**决策层勘误版**：只承载架构决策、对16fixes-plan.md 的勘误、口径定义与验证策略，**不复制**16fixes-plan.md 的实施步骤与代码片段。

权威关系：
- **16fixes-plan.md** = 步骤权威源（Task 1-12 的 TDD 步骤、代码片段、验证命令）
- **本 spec** = 决策与勘误权威源（终态定义、口径、批次门禁）
- **冲突时本 spec 优先**：plan 编写与子代理执行遇到本文勘误表覆盖的条目，以本 spec 终态为准

## 1. 背景与核查结论

2026-08-16 仓库审计发现 16 项问题（P1-P16），16fixes-plan.md 已给出 12 任务修复计划。2026-08-18 逐项核查确认：**16/16 问题在技能包现状中全部真实存在**，16fixes-plan.md 具备执行前提。

核查同时发现16fixes-plan.md 自身 2 处瑕疵（详见 §3 勘误表 E1/E3），另补 1 处口径定义缺失（E2），共 3 项勘误。基线：self-test 256/256、vitest 42 files / 691 tests、check-docs-consistency 通过、版本 41.17.0。

## 2. 架构决策（D1-D5，已确认）

**D1 分层原则**（P5/P8/P9 统一依据）：`logic/` = 纯函数（零 node:fs / 零 process.* / 零 console）；`cli/` = IO + 参数解析 + 输出边界；`lib/` = 跨 CLI 共享工具。plan-chunks 拆分与 schema-loader 下沉均由此推导，非个案处理。

**D2 错误出口单一化**（P10 依据）：`exitWithError`（输出 + 设退出码）→ 抛 `HandledCliError` 哨兵 → `runMain` 识别后静默退出。全仓唯一错误出口路径，`process.exit` 从 lib/logic 层绝迹。

**D3 反模式追加不重排**（P1/P11 依据）：新增 #48 追加至表尾，编号 #1-47 冻结。禁止重排或复用编号——`#N` 锚点散布于 SKILL.md / references / scripts，重排引发全库连锁失效。

**D4 SSoT 同步顺序**（Task 12 依据）：代码与资产修复完成 → SSoT → w-model-dev 资产 → README / AGENTS / CHANGELOG，严格串行，与仓库 AGENTS.md §6 一致。

**D5 版本策略**：41.17.0 → 41.18.0 单次 minor 发布，16 项修复合计一个 CHANGELOG 条目。

## 3. 勘误表（E1-E3，覆盖16fixes-plan.md 对应条目）

### E1｜P6 verifier-spec 章节引用错误（事实性修正）

- 16fixes-plan.md Task 8 终态文案：「verifier-spec.md **§7（输出 Schema）** + §8（提示词模板）」
- 实测结构：**§6 = 输出 Schema（JSON）**（verifier-spec.md L399）；§7 = 子标准定义（L535）；§8 = 评审提示词模板（L752）
- **勘误终态**：引用统一为「verifier-spec.md **§6（输出 Schema）+ §8（提示词模板）**」
- 落点：`subagent-delegation.md:1187`、`SKILL.md:83`（V 行）
- 验证：`grep -rn "§7（输出 Schema）\|§8 产出 VerifierOutput" w-model-dev/` 无输出

### E2｜P7 双计数口径定义（口径定义补全）

拆分 plan-chunks 后存在两个计数维度，全部文档必须带口径限定词：

| 口径 | 值 | 构成 |
|---|---|---|
| `cli/` 文件总数 | **34** | 26 check-* + 7 工具 CLI + self-test |
| exit-2 脚本数 | **33** | 34 − self-test（self-test 为回归基线，exit 0/1） |

- **勘误终态**：SKILL.md:165、INSTALL.md:80、docs-consistency-logic.ts:22、glossary.md 四处全部按此口径表述
- 禁止裸写「33 个脚本」「34 个脚本」而不带口径限定词

### E3｜Task 6 内部口径自相矛盾（新发现，事实性修正）

- 16fixes-plan.md 3d 令 SKILL.md 写「26 check + **8 个工具** CLI」（self-test 计入工具）；3e 令 INSTALL.md 写「26 check + **7 个工具**」（self-test 不计入）——同一物体两种数法，是 P7 所修「口径混用」的复发
- **勘误终态**：统一为「**7 个工具 CLI**（security-scan / wm-status / metrics-report / ensure-codegraph-opsx / wm-write / doctor / plan-chunks）+ **self-test 单列**」。任何位置不得将 self-test 计入工具 CLI

## 4. 验证策略（4 批次门禁，已确认）

| 批次 | 任务 | 覆盖问题 | 批末验证门禁 |
|---|---|---|---|
| 批 1 代码缺陷 | Task 1-4 | P2 / P4 / P3 / P10 | self-test 256 + vitest 全量 + check-docs-consistency |
| 批 2 结构调整 | Task 5-6 | P5 / P7 | 批 1 门禁 + 纯度 grep（logic 层无 fs/exit，gate-logic 既有豁免除外）+ plan-chunks CLI 端到端 exit 0/2 |
| 批 3 内容修正 | Task 7-11 | P1 / P11 / P6 / P14 / P8 / P9 / P12 / P13 / P15 / P16 | 批 2 门禁 + 勘误终态 grep（§6 引用 / 7 工具口径 / #48 存在 / 「反模式 #22」「47 条」零残留） |
| 批 4 发布收尾 | Task 12 | 全量同步 | **npm run prepush 16 项门禁全绿**（含 samples 覆盖矩阵、prettier、npm audit） |

依赖约束（继承16fixes-plan.md）：Task 4 → Task 9（runMain 迁移）；Task 6 → Task 12（计数同步）；Task 7 依赖 Task 6 结束后的文件终态。

## 5. 执行编排（串行子代理，已确认）

**执行者**：批次内逐任务串行派发子代理；批次间隔由主会话跑全量验证。

**代码类任务指令模板**（Task 1-6、9）：写失败测试 → 确认 FAIL → 按16fixes-plan.md 实现 → 测试绿 → self-test → conventional commit。

**文档类任务指令模板**（Task 7、8、10-12）：grep 定位 → 读取上下文 → 分析 → 按**本 spec 勘误终态**（非16fixes-plan.md 原文）修改 → 重读确认。

**全体子代理约束**：单任务单派发；禁止并行修改（对齐用户既有偏好：文档修改必须准确无冲突）；任务结束报告「改动文件清单 + 验证命令输出摘要」。

**全局约束（继承16fixes-plan.md，逐任务适用）**：
- 修改任何 `*-logic.ts` 后运行 `npm run self-test`（期望 exit 0）
- 新增/修改测试后运行 `npx vitest run --config config/vitest.config.ts`（期望全绿）
- 禁止引入新依赖（仅 Node 标准库 + 已声明 devDeps）
- 不碰 `eval/`、`docs/superpowers/` 既有文件、`.trae-html-share-packages/`
- 提交信息 conventional 风格（fix / refactor / docs / test / chore）
- 所有验证命令在技能包仓库根目录执行（package.json 所在处）

## 6. 完成定义（DoD）

1. 16fixes-plan.md DoD 5 条全部满足：self-test / vitest / prepush 全绿；`反模式 #22`、`47 条` grep 零残留；`logic/plan-chunks.ts` 已删除且 `schema-loader.ts` 无 `node:fs` / `process.exit`；版本三处一致 41.18.0（SKILL.md frontmatter = skill-metadata.json = CHANGELOG）；16 项问题全部有落点
2. **spec 增量 DoD**：E1-E3 勘误已落实——§6 引用生效；「7 工具 + self-test 单列」口径在 SKILL.md / INSTALL.md / docs-consistency-logic / glossary 四处统一；任何文档无裸计数
3. 每批次验证记录留档（批次号 + 验证命令 + 输出摘要），供 Task 12 CHANGELOG 条目与最终审查引用

## 7. 风险与缓解（增量，16fixes-plan.md 风险表之外）

| 风险 | 缓解 |
|---|---|
| 子代理照抄16fixes-plan.md 原文忽略 spec 勘误（E1-E3） | 文档类任务指令模板强制引用本 spec 终态；批 3 门禁含勘误终态 grep |
| 勘误口径（34/33/7/8）在 Task 12 SSoT 同步时再次漂移 | E2 口径表为 Task 12 的 SSoT 同步输入；DoD 第 2 条四处统一校验兜底 |
| check-docs-consistency 的 vitest-files/vitest-tests 实测计数随新增测试文件变化 | Task 12 以最终实测值回填（16fixes-plan.md Task 12 Step 2 已有），不预设数字 |
