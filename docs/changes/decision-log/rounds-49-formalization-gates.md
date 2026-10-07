# 轮次决策记录：第 49 批（批次 7 形式化与图谱门禁收严，43.1.0）

> 41.7.0 起 SSoT 只承载当前设计事实，本文件登记批次 7（43.1.0）实施前的用户决策与实施期裁定，
> 对应 [43.1.0]（CHANGELOG.md 条目随批次 7 发布回填）。裁定来源：用户 2026-10-07 七项决策与
> 增量规格 [2026-10-07-remediation-leftovers-design.md](../../superpowers/specs/2026-10-07-remediation-leftovers-design.md)
> （§0 决策、§1 热修、§2 批次 7、§5 总清单）；SSoT 权威摘要见其 §10S。原文保留，不篡改。

#### 第 49 批：形式化与图谱门禁收严（43.1.0，2026-10-07）

**目的**：销账增量规格 §5 批次 7 的 21 项——形式化子系统加固（恒真不变式防御 / 死锁指引 / cfg 指南 / 示例库 / 五类退化解负例 / §0 分节导引）、图谱与 RTM/状态机收严（depends-on 环检全 phase / `evidenceStatus=pending` 违规化 / RTM `coverageStatus` enum+必填 / `project.status` 转移校验 / 8·9 常数统一）、批次 6 五项跟进（归一化哈希机制侧 / 降级 human 授权 / R6 首条 `from==L0` / gate-log 损坏两用例 / D-1 收窄负例）。

**用户决策登记（规格 §0，2026-10-07 逐项定案）**

| #   | 决策                  | 结果（逐字口径）                                                                                                    | 本批落点 |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | autocrlf×R19 哈希失配 | **两者都做**：`.gitattributes` 修环境 + 归一化哈希修机制                                                            | 43.0.1 环境侧（`ffd2b08e`）+ 本批 T2（`648a7f80`） |
| 2   | 降级授权              | **除非 human 明确授权否则不允许降级**（降级与升级对称走签名链审批）                                                 | T11（`0aaa9791` + 修复轮 1 `030722c8`，规则 R8） |
| 3   | R6 首条 history 起点  | **加首条 `from==L0`**（第四判定；存量资产迁移）                                                                      | T12（`c59bf326`） |
| 4   | `*_token` 盲区        | **彻底消除 + 防复生守卫**（词段命中即脱敏 + NEGATIVE fixtures 锁定）                                                 | T10（`23993ed1`） |
| 5   | subagentSpawns        | **升级为真门禁**（check-budget 消费 maxSubagentSpawns；estimated 不计入）                                           | 批次 8（43.2.0），不在本批 |
| 6   | 产出形态              | **增量规格**（本文件所属规格；主规格 §6-§8 不重写、继续有效）                                                        | 规格 [§0](../../superpowers/specs/2026-10-07-remediation-leftovers-design.md) |
| 7   | 执行节奏              | **连续推进**：43.0.1 → 批次 7 → 批次 8 → 批次 9；每批独立 prepush 全绿 + 终审宽范围审查后合入 main，随后自动开下一批 | 43.0.1 + 本批；批次 8/9 待续 |

**批次 7 实施裁定（R-B7-1 … R-B7-7，来源 `.superpowers/sdd/2026-10-07-batch7-formalization-gates/progress.md`）**

- **R-B7-1（任务 10，词段分支口径）**：计划指示性代码的词段分支 `seg.endsWith(stem)` 与测试 4d（`mytoken` 不脱敏）矛盾——`"mytoken".endsWith("token")=true` 会被误伤，且对 4a（`refresh_token`）无增益（其 `token` 词段已被精确相等命中）。裁定：词段分支取**精确相等**（`segmentsOf(key)` 与 `SENSITIVE_KEYS` 有交集），无 `endsWith`；后缀分支维持 ≥6 守卫不变。四态测试为权威。
- **R-B7-2（提交信息 `!` 标记）**：计划各 feat 提交信息带 `!` + `breaking`——本批为真实门禁收紧（判据收紧不留兼容），与仓惯例（minor 版本承载 breaking）一致，**保留**；43.0.1 终审的流程备注仅适用于无行为变化的提交。
- **R-B7-3（行号漂移）**：计划任务 4/5/6/9 的 .md/.ts 行号为编写时点参考，**以内容定位为准**（不按行号硬命中）。
- **R-B7-4（43.0.1 终审 riders 并入本批收口）**：①任务 14 将 CHANGELOG 43.0.1 节「新增 `.gitattributes`」改「增补」（实际是增补到既有文件）；②任务 15 CHANGELOG 回填耗时句改准确措辞（`prepush 19 项全绿（实测 1403s，SDD 账本）`——git log 里没有耗时）；③流程备注不改历史；④任务 14 在 `docs/INSTALL.md` 排障节补存量 `autocrlf=true` clone 归一指引一句（`git add --renormalize . && git checkout -- .`）。
- **R-B7-5（任务 4 修复轮 1，死锁指引主形态）**：死锁指引技术性错误修复——主形态取**终态自环**（`NoStuckState` 配套不变式 + 显式豁免兜底），越权形态按简报收敛。
- **R-B7-6（规则号让号）**：T9 已在 `maturity-logic.ts` 落 **R7 = `project.status` 转移校验**；T11 的降级 human 授权改用 **R8**（规则号不回收、编号稳定），同步 `maturity-logic` / `check-maturity` 头注释规则枚举与 AGENTS.md §8 check-maturity 行（R1-R8）。
- **R-B7-7（安全承重，修复轮 1 必须本轮修）**：R8 授权降级**专属绑定**——`verifyMaturityApproval` 增可选 `requireAction`（不传 = 原行为零漂移），`check-maturity` R8 传 `downgrade-approve`；历史 `upgrade-approve` 条目不再天然满足（审查者实跑复现的绕过面关闭），复现钉成负例。

**其余批次内裁定接受与转办（如实登记，不静默遗留）**

- **B1a 空名单跳过（T3 审查者提请，接受）**：cfg 未声明任何 INVARIANTS 时跳过「缺非 Type 业务不变式」判定——否则会改写既有纯死锁冒烟规格 DeadlockDemo 的失败原因，与「原因不变」验收直接冲突；两条约束下唯一自洽解。
- **T5 已知限制**：D6 find-first 缺陷（guard 分歧误报）为既有缺陷、范围外，已写已知限制注并**转批次 8 候选**（按 `expectedEndState` 存在性判定）。
- **T9 转办**：SKILL.md 接线缺口（五门序列传 `--prev-status` 的参数形态 + §6.1 行 + `--rollback-approved` 单独给出时静默无效诊断）**转批次 8 候选**。
- **T12 审查遗留转本批收口**：R6 breaking 的用户可见迁移说明由任务 14 在 CHANGELOG 43.1.0 节「迁移」段明写。
- **T13b 专项**：批次新增 `lint:security` 10 项发现收口（修复 5 项 + baseline 登记 5 项，`ed11685c`），`lint:security` 恢复 exit 0。

| 维度 | 内容 |
|---|---|
| self-test | 403 → **412**（TLA 15→20 / GRAPH 37→39 / MATURITY 3→5，其余不变） |
| 版本号 | 43.1.0（批次 7 目标版本，breaking；判据收紧不留兼容） |
| prepush | **19/19 全绿（实测 1793s，2026-10-07 单次；T15 实测）**；T14 记录：self-test 412/412、docs-consistency 0、eval 68/68、typecheck 0；规则层覆盖口径 75 文件——语句 87.41 / 分支 81.23 / 函数 95.68 / 行 89.97（阈值 80/75/90/85） |
