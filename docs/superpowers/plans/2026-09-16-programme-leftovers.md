# 程序收尾（M 程序遗留清偿）实现计划

> **单元定位**：M 程序（P0–P6）已全部落地并合并（main @ `63d7bb41`）。本单元清偿**各期收尾节登记的遗留**，不是新采纳项——**不引入任何新机制、不升版本号、不新增文件**。

## 0. 实测基线（2026-09-16 @63d7bb41）

| 实测事实（file:line） | 对本单元的影响 |
| --- | --- |
| **CHANGELOG 缺口实测**：`grep -n "subprocess-serial\|project-split" CHANGELOG.md` = **0 命中**；`grep -n "外部技能\|expanded-external" CHANGELOG.md` = **0 命中** → **P0–P6 全程序 + vitest 项目拆分工作均未记录** | 补记两组条目 |
| **CHANGELOG 版本节头解析**：`docs-consistency-logic.ts:893-897` 的 `extractChangelogVersion` 取**首个** `^##\s*\[([^\]]+)\]` 再套 `VERSION_PATTERN`（`:931` 参与 version-consistency 七处比对） | **禁止**在顶部新增 `## [Unreleased]`（会解析出 `null` → **version-consistency 直接红**）。**必须**把新条目放在既有 `## [42.2.1] - 2026-09-01` **节内**，作为 `###` 子节 |
| **既有先例**：`## [42.2.1]` 节内已有日期**晚于该版本日期**（2026-09-01）的子节 `### 门禁完整性与证据事实对账（…2026-09-12）`（`CHANGELOG.md:12`） | 「在原版本节内追加带日期子节、不 bump」是**本仓既有做法**，非本单元发明 |
| `## [42.2.1]` 节内子节顺序：2026-09-12 在最前（`:12`），其后为无日期/更早者 | 新条目（2026-09-16 / 09-14）插在 **`## [42.2.1]` 行之后、`### 门禁完整性…2026-09-12` 之前** |
| **陈旧计数 1**：`docs/user-guide.md:110`「332 条样本回归基线」 | → **352** |
| **陈旧计数 2**：`.githooks/pre-push:320` 注释 `# 1. self-test：262 条样本回归基线…` | → **352**。⚠️ 该文件被 `check-docs-consistency` 的 `checkPrePushCount` 解析（要求 `# 1.`…`# 18.` **恰 18 块** + 字面「**18 项检查**」）；**只改冒号后数字**，`# 1.` 前缀与「18 项检查」字面**不得动** |
| **陈旧计数 3**：`.code-health-governance.json:3` `"selfTestSamples": 322`（**已跟踪**，`git ls-files` 确认） | → **352**。消费者 `code-health-test-logic.ts:253-257`（declared vs expected，失配须 `explained:self-test` 事实才放行）——改的是**仓库自有期望值**，与当前实测一致即正确 |
| **无测试断言旧值**：`grep "322\|332\|262"` 于 `__tests__/**` 与 `code-health-*logic.ts` → **仅命中 manifest 自身** | 三处计数为**纯文档/清单**，无测试回归面 |
| `checkExit2ScriptCount` 只匹配「`N 个脚本`」，**不匹配**「`N 清单`」 | 说明 **`AGENTS.md:41` 的「43 清单」长期逃过门禁**（P6 T5 已修为 45）；本单元不重复处理 |
| 计数现状（本单元须保持）：`self-test` **352** / `cli` 46 / exit-2 45 / `schemas` 34 / `references` 43 / `prePushCount` 18 / `maxAntiPattern` 48 / 版本 **42.2.1** / L0 672·95·36 | 本单元**只动文本/清单数字**，不改任何计数契约 |
| **历史不可改**：`docs/changes/decision-log/README.md` 明写「归档内容保留原文，不篡改历史事实」；`docs-consistency-logic.ts:1741` 明写 `CHANGELOG.md`/`CHANGELOG-archive.md`/`docs/changes/**`「历史不可改」 | **不得改写任何既有 CHANGELOG 条目文本**（含其上文里的「当时值」如 262/322/332）；**不得**改 `CHANGELOG-archive.md` 与 `docs/changes/**` 任何文件 |

## 0.1 裁定（控制者决定，实现者不得擅改）

1. **CHANGELOG 条目落点 = 既有 `## [42.2.1]` 节内新增 `###` 子节，不新增 `[Unreleased]`、不 bump 版本。** 理由见 §0 的解析实测（`extractChangelogVersion` 取首个 `## [...]`）。**本仓所有 P1–P6 计划均含「不升版本号」约束**，本单元延续。
2. **条目分两组**（各自一个 `###` 子节，带日期，风格对齐既有子节）：
   - **A 组：M 程序（外部技能采纳）P0–P6**，日期 **2026-09-14 ~ 2026-09-16**。逐期列**用户可见变更**（不逐提交堆砌）：P0 裁定录入 / P1 元理论层（M01+S03+S04+S02+S05+M02+S01+M16+M15）/ P2-A、P2-B 门禁可信度（M06+S25+S26+S28+S29+S27+S31+S32+S30）/ M07（RTM `testSummary.evidence`，**独立 Schema 批准单元**）/ P3 角色独立性与评审 / P4 测试质量与设计规则 / P5 调试运维与交互（含**新增按需工具 CLI `check-pollution.ts`** 与**新增 `.githooks/pre-commit` 快层**）/ P6 拒绝知识库（M08）。
     **必须如实记录三处「用户会注意到」的语义变化**：① **新增一个 CLI**（`cli/*.ts` 45→46；**不进 pre-push**，`prePushCount` 仍 18）；② **新增 `.githooks/pre-commit`**（提交前快层；**不引入 husky**、不改 `package.json`）；③ **phase-1 结构门禁的数据要求收紧**（§8 须为合规五列表格）——即 P6 的 AC-11 披露。
     **必须如实记录计数变化**：exit-2 脚本 43→**45**（P2-B S32 +1、P5 S24 +1）；`self-test` 332→**352**；`references` 42→**43**；`schemas` 仍 34。**以实测为准，不得沿用各期文档里的中间值**。
     指向权威：验收判据在 `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md` §13（AC-0…AC-12）；各期计划在 `docs/superpowers/plans/2026-09-1*-p*…md`。
   - **B 组：vitest 执行模型与推送前门禁确定性（2026-09-15 ~ 2026-09-16）**：`5d212e52` vitest 拆为 `subprocess-serial` / `pure-parallel` 两 project；`b71c2fe1` 串行化文件执行使 pre-push 确定；配套 `docs/changes/vitest-parallel-flakiness-finding.md`（**既有文件，不得改**）与 `docs/troubleshooting.md` 1.7a 条目。**如实写明**：这是**测试基础设施**变更，不影响 `/wm` 命令语义与门禁项数（**prepush 项数仍 18**）。
3. **三处陈旧计数一次性清偿**（§0 已给各自风险点）：`docs/user-guide.md:110` 332→352；`.githooks/pre-push:320` 注释 262→352（**只改数字**）；`.code-health-governance.json` `selfTestSamples` 322→352。
4. **P6 的两个观察项裁定为「接受、不改」**（在计划收尾节记录，不改文件）：① 模板 §8 用具体 `dark-mode` 示例行替代占位符（同节已标注「仅为形态示范，须替换」）；② `REQ-102` 为新增标识但仍是 `REQ-xxx` 形态、**未发明第二套编号**（符合 P6 §0.1.7）。
5. **历史不可改**（§0 末行）：不改写任何既有 CHANGELOG 条目（含其中的历史数值）、不改 `CHANGELOG-archive.md`、不改 `docs/changes/**` 任何文件。**这与「清偿陈旧计数」不矛盾**：清偿对象是**活体文档/清单**（user-guide、pre-push 注释、governance manifest），不是历史记录。

## 1. 全局约束

1. **零新增文件**；**零 .ts 逻辑改动**（唯一触及的 `.ts` 面 = 无；`.code-health-governance.json` 是 JSON 清单）；零 Schema / 零依赖。
2. **不升版本号**（七处镜像不动：`package.json` / `SKILL.md` frontmatter / `skill-metadata.json` / `README.md`「当前版本」/ `docs/INSTALL.md` / `CHANGELOG.md` **首个版本节头** / `package-lock.json` 根 version）。**首个版本节头必须仍是 `## [42.2.1]`**。
3. **不触碰**：`CHANGELOG-archive.md`、`docs/changes/**`（全部，含 finding 文档）、`docs/superpowers/**`、`package.json`、`package-lock.json`、`eval/**`、`w-model-dev/scripts/**`、`w-model-dev/schemas/**`、`w-model-dev/references/**`、`w-model-dev/templates/**`。
   **授权改动面仅 4 处**：`CHANGELOG.md`（节内新增子节）、`docs/user-guide.md`（1 个数字）、`.githooks/pre-push`（1 个数字）、`.code-health-governance.json`（1 个数字）。
4. **反模式计数仍 48**（不得新增 #49）；无 LLM 调用。
5. **pre-push 契约保护**：改 `.githooks/pre-push` 后必须实测 `grep -c "^# [0-9]*\." .githooks/pre-push` = **18** 且字面「**18 项检查**」仍在。
6. **L0**：不改任何 markdown 相对链接（`audit:l0-links` 应仍 672/95/36）。
7. **验证清单**：`npm run self-test`（352/352）；`npm run audit:l0-links`；`npm run lint:security`；**`docs-consistency-logic.test.ts` 聚焦批**（本单元唯一有门禁风险的改动是 CHANGELOG 的版本节头，该测试覆盖 version-consistency；单文件耗约 436s，跑一次）；`npx vitest run … skill-metadata.test.ts`（版本七处一致性回归）；`.code-health-governance.json` 改后跑 `npx vitest run … code-health-tests.test.ts`（consumer 回归）。
8. **诚实性**：CHANGELOG 条目中的**每个计数与结论必须实测**（尤其 exit-2 45 / self-test 352 / references 43 / prePushCount 18）；**不得**把各期文档里的中间值（如 43、44、332、340、344）当现值抄进去。

## 2. 任务分解

### 任务 1：CHANGELOG 补记（A 组 + B 组）
- [ ] 读 `CHANGELOG.md:10` 起的 `## [42.2.1]` 节与既有子节风格（尤其 `:12` 的 2026-09-12 子节）作形态参照；读各期计划收尾节（`docs/superpowers/plans/2026-09-1*-p*.md` 与 `2026-09-15-m07-*.md`、`2026-09-16-p*…md`）取用户可见变更与实测计数；读规格 §13 的各 AC 行取验收结论。
- [ ] 在 `## [42.2.1] - 2026-09-01` **行之后**插入 **两个 `###` 子节**（A 组 M 程序 2026-09-14~16；B 组 vitest 执行模型 2026-09-15~16），顺序**新的在前**（B 组日期更早，故 A 组在前）。风格对齐既有子节：`### <标题>（<slug>，<日期>）` + 要点式条目。
- [ ] **必含三条语义变化披露**与**计数变化**（§0.1.2）。
- [ ] **不得**改动该节既有子节任何文本；**不得**新增 `[Unreleased]`；**不得**改首个版本节头。
- [ ] **验证**：`grep -m1 "^## \[" CHANGELOG.md` 仍为 `## [42.2.1] - 2026-09-01`；`git diff --numstat CHANGELOG.md` 应为纯增（0 删除）；`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（**本单元唯一门禁风险点**，贴真实结果）；`npx vitest run … skill-metadata.test.ts`。
- [ ] **Commit**：`docs(changelog): record the M programme (P0-P6) and the vitest execution-model work`

### 任务 2：三处陈旧计数清偿
- [ ] `docs/user-guide.md:110`：332 → **352**（只改数字，句子其余不动）。
- [ ] `.githooks/pre-push:320`：注释里的 262 → **352**（**只改冒号后的数字**；`# 1.` 前缀与「18 项检查」字面不得动）。
- [ ] `.code-health-governance.json`：`selfTestSamples` 322 → **352**（只改值；JSON 其余不动）。
- [ ] **不得**顺手改 CHANGELOG 历史条目里的 262/322/332（历史不可改，§0.1.5）。
- [ ] **验证**：`grep -c "^# [0-9]*\." .githooks/pre-push` = 18；`grep -n "18 项检查" .githooks/pre-push`；`npm run self-test`（352/352）；`npx vitest run … code-health-tests.test.ts`（`selfTestSamples` consumer 回归）；`npm run lint:security`；`npm run audit:l0-links`；`git diff --numstat` 三处各为 1/1。
- [ ] **Commit**：`docs: pay down the three stale self-test sample counts`

### 任务 3：收口（全量门禁 + 计划收尾节）
- [ ] `npm run prepush`（独占，唯一一次；预期 18/18 + `PREPUSH_EXIT=0`）。
- [ ] 一致性自查（实测）：`self-test` 352 / `cli` 46 / exit-2 45 / `schemas` 34 / `references` 43 / `prePushCount` 18 / `maxAntiPattern` 48 / 版本 42.2.1 七处一致 / L0 672·95·36。
- [ ] 计划收尾节（控制者终版回填）：记录本单元范围、**活动体计数清偿的三处**、**P6 两观察项裁定为「接受不改」**、以及**「历史不可改」的边界说明**（哪些数字**故意**保持历史值）。
- [ ] **Commit**：`docs(plan): record the programme-leftovers closeout`

## 自检结果

**1. 遗留覆盖度**：三组遗留（CHANGELOG 缺口 / 三处陈旧计数 / P6 观察项）→ 任务 1 / 任务 2 / 任务 3（裁定记录）。
**2. 占位符扫描**：无。CHANGELOG 条目的**条目粒度**为有界选择 + 报告义务（逐期列用户可见变更，不逐提交堆砌）。
**3. 命名一致性**：子节标题沿用既有 `### <中文标题>（<slug>，<日期>）` 形态。
**4. 与既有验收的关系**：不改任何 AC 行（AC-0…AC-12 已由各期回填）；不改任何门禁判据；**唯一门禁面变化 = CHANGELOG 首个版本节头必须仍可解析**（§0 已给机制与验证）。

---

## 执行结果（计划收尾节，控制者终版回填 2026-09-16）

**状态：三组遗留全部清偿完毕。** 分支 `feat/programme-leftovers`，BASE `63d7bb41`（main）。

### 一、提交序列（3 个）

| # | commit | 内容 |
| --- | --- | --- |
| 0 | `4a98bd07` | 本计划（含实测的 CHANGELOG 缺口与 `extractChangelogVersion` 约束） |
| 1 | `a34f9d00` | CHANGELOG 补记：M 程序 P0–P6（A 组）+ vitest 执行模型（B 组），`CHANGELOG.md` **28/0 纯增** |
| 2 | `ac83fc76` | 三处陈旧 self-test 计数清偿（各 1/1） |

### 二、收口门禁（控制者在最终树独占运行）

`npm run prepush` → **18/18 全绿、`PREPUSH_EXIT=0`**，末行「全部门禁通过，允许推送 ✓」。
控制者核验（实测）：`grep -m1 "^## \[" CHANGELOG.md` 仍 = `## [42.2.1] - 2026-09-01`（**首个版本节头可解析**，version-consistency 不破）；`git diff --numstat` 对 `CHANGELOG.md` = **28/0**（纯增）；`.githooks/pre-push` 的 `^# [0-9]*\.` 块 = **18** 且字面「18 项检查」仍在；`grep -c Unreleased CHANGELOG.md` = **0**；改动文件恰 **5**（4 处授权 + 本计划）；`cli` 46 / `schemas` 34 / `references` 43 未变。
实现者实测：`self-test` **352/352**；`audit:l0-links` exit 0（672/95/36）；`lint:security` 新增 0；`skill-metadata` 6/6；`code-health-tests` 28/28；**`docs-consistency-logic` 190/190（404.14s）**——本单元唯一门禁风险点（version-consistency）已通过；另在真实 CHANGELOG 上模拟 `extractChangelogVersion` → `"42.2.1"` 且匹配 `VERSION_PATTERN`。

### 三、清偿明细

1. **CHANGELOG 缺口**（实测覆盖 P0–P6 全程序 **+** vitest 执行模型，两者此前均零记录）：两个 `###` 子节落 `## [42.2.1] - 2026-09-01` 节内、既有 2026-09-12 子节之前（新者在前）。**未新增 `## [Unreleased]`**（`extractChangelogVersion` 取首个 `## [...]` 再套版本正则，`[Unreleased]` 会解析为 `null` → version-consistency 直红）；**未 bump 版本**（延续各期「不升版本号」）；**未改写任何既有条目文本**（含其中的历史数值 262/322/332）。
   A 组如实记录三处**用户可见语义变化**：① 新增按需工具 CLI `check-pollution.ts`（**不进 pre-push**，`prePushCount` 仍 18）；② 新增 `.githooks/pre-commit` 快层（**不引入 husky**、不改 `package.json`）；③ **phase-1 结构门禁数据要求收紧**（§8 须为合规五列表格 = P6 的 AC-11 披露）。
   计数变化按实测写入：`cli/*.ts` **44→46**、exit-2 脚本 **43→45**、`self-test` **332→352**、`references` **42→43**、`schemas` 仍 **34**。
2. **三处陈旧计数**（活体文档/清单，非历史记录）：`docs/user-guide.md:110` 332→**352**；`.githooks/pre-push:320` 注释 262→**352**（**只改数字**，`# 1.` 前缀与「18 项检查」字面未动）；`.code-health-governance.json` 的 `selfTestSamples` 322→**352**（仓库自有期望值，与当前实测一致）。
3. **P6 两个观察项：裁定「接受、不改」**（记录于此，未改文件）：① 模板 §8 用具体 `dark-mode` 示例行替代原占位符——同节已显式标注「**仅为形态示范，须替换为本项目实际登记行**」，且保留原占位行必然破坏「交付模板逐字过自己的门禁」守卫（状态格 `` `rejected` / `reconsidered` `` 非单一合法枚举），**自洽优先**；② `REQ-102` 为新增标识但**仍是 `REQ-xxx` 形态**，未发明第二套编号，符合 P6 §0.1.7。

### 四、「历史不可改」边界（说明哪些数字**故意**保持历史值）

本单元清偿的是**活体文档与清单**；以下**故意未动**（属审计轨迹，改即篡改历史）：
- `CHANGELOG.md` 既有条目内出现的 262 / 322 / 332（**当时值**）；
- `CHANGELOG-archive.md` 全文；
- `docs/changes/**` 全部（含 `decision-log/README.md`「归档内容保留原文，不篡改历史事实」所辖记录、`vitest-parallel-flakiness-finding.md`）；
- `docs/superpowers/**` 各期计划与规格里的**中间值**（如 P2-A 的 43、P4 的 342、P5 的 344）——它们是各期当时的实测快照。

### 五、控制者记录更正（本单元发现，前几期遗留的错误前提）

1. **`cli/*.ts` 的 P2-B→P5 增量是 +2 而非 +1**：44（P2-B 前）→ 45（P2-B S32 `review-package.ts`）→ 46（P5 S24 `check-pollution.ts`）。前几期文档只记了 P5 那一步。
2. **vitest 拆分的两个 project 真实名为 `cli-serial` / `unit-parallel`**；`subprocess-serial` / `pure-parallel` 只是提交主题的措辞（在 P5 的纪律盘点中被当作 project 名引用过）。
3. **vitest 拆分的提交时间是 2026-09-14（02:44 → 03:43，先全局串行、后拆 project）**，不是 09-15~16。

### 六、M 程序（P0–P6）到此**整体收尾**

- P0–P6 全部落地并合并；规格 §13 的 **AC-0…AC-12 全部有处置**（AC-0 部分达成 + 本单元未改；AC-6/AC-9/AC-10 已由 P5/P6 闭环或标注；AC-11 已含 P6 的判据强化披露）。
- **遗留清零**：本单元清偿了 P5/P6 收尾节登记的三组遗留。**当前无已知未登记遗留。**
- 版本仍 **42.2.1**（本程序全程未 bump）；`main` 领先 `origin/main`，**未推送**。
