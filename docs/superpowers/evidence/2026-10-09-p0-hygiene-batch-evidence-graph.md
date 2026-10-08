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
