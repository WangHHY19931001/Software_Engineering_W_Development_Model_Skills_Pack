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
| 2026-10-09 | L1 | 🟢 → 🟢（验证期新发现登记，状态不变） | 任务 1 步骤 1 grep 命中 5 处，全部位于 `docs/superpowers/sources/agency-agents-zh/testing-reality-checker.md`（vendor 上游源料存档，commit dc8c7da2 引入；非脚本/门禁/eval 对旧正文的消费引用） | 按简报步骤 1「若有命中先登记再继续」处置：源料存档不改（非运行时资产），不阻断任务 1 |
| 2026-10-09 | L1 | 🟢 → 🟢（正文重写完成） | 两条 grep 计数：旧剧本词面残留=0；制品与职责词汇=10（≥10）；frontmatter L1-10 逐字节零变更（diff 全部 hunk 位于 L12 起） | 任务 1 完成，验证产物=两条 grep 计数；正文已对齐 root-cause-locator.md:251 §4.4 第 6 条 canonical persona + confidence<0.5 硬约束 |
| 2026-10-09 | L1 | 🟢 → 🟢（措辞修正） | 上游裁定两项：①步骤 1 sources 存档词面命中属上游 vendor 存档 `docs/superpowers/sources/agency-agents-zh/` 自身内容、非技能资产，不需处理；②「四字段」意图=persona 标识 + 四个结论字段（confidence/verdict/evidenceGaps/rationale），原文措辞不精确 | 「按产出格式四字段输出」→「按产出格式表输出（persona 标识 + 四个结论字段）」，单行修改，三条验证复跑全过（0 / 10 / frontmatter 零变更） |
| 2026-10-09 | 规格 §7 L1 | 🟡 → 🟢 | #18/#19/#20 绑定证据核实（见本图 L4） | 脚本对应表补 4 行，非 3 行 |
| 2026-10-09 | L2 | 🟢 → 🟢（外来路径清除完成） | 三段验证：①技能资产面 `w-model-dev/` + AGENTS.md + README.md 零命中（exit 1）；②`docs/superpowers/sources/` 零命中（vendor 存档无此词面）；③简报原文验证命令剩余命中 3 文件，均为批次自身计划/规格/证据文档（`docs/superpowers/plans/2026-10-09-p0-hygiene-batch.md`、`docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md`、本图 L2 行）对简报旧文的自我指涉引用 | 任务 2 完成：design-ux-architect.md L317-324 代码块改指 `.w-model/handoff/<dispatch-id>/brief.md` 派单契约（2 行 cat/grep 均改占位路径）；project-manager-senior.md L27/L35 改指派单 brief 指定产物路径；剩余命中属计划/规格文档自我指涉非活体指导，不在修复范围（超出本批允许变更三文件边界），如实登记不阻断 |
| 2026-10-09 | L3 + L4 | 🟢 → 🟢（速查表补齐完成） | 三条验证命令：①`^\| #48（子代理越界实施）` 计数=2（命中高发阶段表 + 脚本对应表，符合预期 2）；②`^\| #18（\|^\| #19（\|^\| #20（` 计数=6（≥5：脚本对应表新增 3 行 + 命中高发阶段表原有 #18/#19/#20 三行，简报预估 5 系漏计 #20 原有行）；③裸数字 `^\| 48 \|` 仅剩 L281 主清单一行（合法形态） | 任务 3 完成：hard-constraints.md +6/-1 行（命中高发阶段表补 #48；脚本对应表按编号序在 #17 与 #21 之间补 #18/#19/#20、表尾补 #48；检测信号表 L451「48」→「#48」）。步骤 3 证据驱动裁定：主清单统一 `\| N \|` 裸数字格式（L234 `\| 1 \|` 佐证），L281 保持不动仅改 L451（该表统一 `\| #N \|` 格式）；#20 行 sig-008 与 hard-constraints.md L567 检测信号一致 |
| 2026-10-09 | L5 | 🟢 → 🟢（导航补全完成） | 验证：①docs-consistency exit 0（静态/动态违规均 0，count-claim 165 份活体 markdown 扫描通过，无红灯不需补登记）；②逐词出现计数 quickstart=1 / evidence-anchored-tree=1（合计 2，满足简报 ≥2 意图；字面 `grep -c` 计 1 系两词同居 L46 单行表格单元格，按现有形态保持不拆行）；③diff 复核：4 个真缺失项全部入册，表格 3 列结构与总行数 204 不变 | 任务 4 完成，最终缺失清单与裁定：AGENTS.md 三处编辑——scripts 行「三层」→「五层」（`application/`：artifact-gate-assets / audit-l0-links / uat-path-mapping；`infrastructure/`：schema-loader / schema-fs / evidence-fs，与 `ls w-model-dev/scripts/` 实测一致；分层方向与例外由 `__tests__/dependency-boundaries.test.ts` 可执行强制）+ references 单元格 activation-guide 后补 4 项 + subagent 行补「目录平铺，以文件名前缀分 5 类」（实测 `find` 子目录数=1、36 文件、前缀恰为 5 类）。diff 驱动缺失清单：真缺失 4 项——quickstart（SKILL.md L20 引用）、evidence-anchored-tree（SKILL.md L142 引用）、superpowers-adoption（SKILL.md L142 + AGENTS.md §1 L20 引用，新发现）、workflow（SKILL.md L107 引用，新发现）——均核实服役态后补入；判定不补 2 类（非缺失，无废弃文件）：data-models 以中文名「数据模型」条目在册、phase-1-requirements 至 phase-8-acceptance-test 共 8 文件由单元格首条「阶段细则」统称条目覆盖 |
