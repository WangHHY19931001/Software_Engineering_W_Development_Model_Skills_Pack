# 交互示例：设计阶段

> 对应 W 模型阶段 2/3/4。命令：`/wm design type=架构|概要|详细`。
> 本阶段同步产出系统测试 / 集成测试 / 单元测试设计。

> **⚠️ 伪示例（仅供 LLM 行为对齐）**：本文件为「示例对话」风格的编排演示，对话中的产物字段、数字
> 与输出均为示意，不代表真实校验结果。**真实命令输出以 [real-run-evidence.md](./real-run-evidence.md) 为准**；
> 任何门禁结论必须以脚本退出码为准（反模式 #6/#7/#12），不得用对话内容替代。

## 示例对话（系统设计）

```
用户: 请进行系统架构设计

AI: 正在执行【系统设计】阶段，将同步产出系统测试设计...

AI: 技术选型建议：
    - 前端: React + TypeScript
    - 后端: Node.js + Express
    - 数据库: MongoDB + Redis
    - 中间件: RabbitMQ（订单异步处理）

AI: 已生成系统架构图（分层架构：接入层 → 应用层 → 数据层）与模块接口定义。

AI: 已同步生成系统测试用例（类型=系统测试），覆盖各模块集成场景：
    - ST-001 端到端下单流程
    - ST-002 高并发浏览性能基线
    - ST-003 支付安全基线
    - ...

S: RTM 已补登：REQ-001~005 → SD-3.2.x、ST-001~（覆盖状态：部分）。

R/G/V/G: S 产出后，R 完成 R3×3，G 运行 check-preventive-review.ts 且 exit 0；
         V 评审系统设计与系统测试设计，G 运行阶段 2 门禁并回填真实证据。

O: 展示系统设计、系统测试设计、RTM、R3/V/G 证据与 reworkHints。
O: 🔴 CHECKPOINT · 阶段 2 放行
   请确认是否放行进入【概要设计】（/wm design type=概要）；未确认不得跨阶段。
```

## 普通 V/G 失败分支

```text
V/G: 阶段 2-4 的评审或门禁失败不能直接命令 S 重写设计，也不能自动跳到上游阶段。
O: 分派 R；R 报告经 V 复审与 G 的 check-rootcause-report exit 0 后，才分派 S-fix。
S-fix: 完成 R3×3 → G(check-preventive-review exit 0) → V → G。
O: 展示 R/V/G 证据并进入 🔴 CHECKPOINT；只有用户确认，才执行 R 推荐的阶段内重做或上游回退。

完整链：V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT
```

## 示例对话（概要设计 → 详细设计）

```
用户: /wm design type=概要

AI: 正在执行【概要设计】阶段，将同步产出集成测试设计...
AI: 已生成模块间接口定义（接口契约、参数、错误码）。
AI: 已同步生成集成测试用例：IT-001 接口合法调用、IT-002 非法参数校验、IT-003 跨模块数据传递。
S: RTM 已补登：接口设计列、集成测试列。

R/G/V/G: 阶段 3 S 产出后，R 完成 R3×3，G 运行 check-preventive-review.ts 且 exit 0；
         V 评审概要设计与集成测试设计，G 运行阶段 3 门禁并回填真实证据。

O: 🔴 CHECKPOINT · 阶段 3 放行
   展示接口设计、集成测试设计、RTM、R3/V/G 证据与 reworkHints；用户确认后才允许进入阶段 4。

用户: /wm design type=详细

AI: 正在执行【详细设计】阶段，将同步产出单元测试设计...
S: 已生成类图、数据库 ER 图、方法级定义，并同步生成覆盖核心逻辑与边界条件的单元测试设计。
S: RTM 已补登：详细设计列、单元测试列。

R/G/V/G: 阶段 4 S 产出后，R 完成 R3×3，G 运行 check-preventive-review.ts 且 exit 0；
         V 评审详细设计与单元测试设计，G 运行阶段 4 门禁并回填真实证据。

O: 🔴 CHECKPOINT · 阶段 4 放行
   展示详细设计、单元测试设计、RTM、R3/V/G 证据与 reworkHints。
   只有用户确认，才进入【编码实现】（/wm code）并执行单元测试。
```

## 要点

- 系统设计 → 同步系统测试设计；概要设计 → 同步集成测试设计；详细设计 → 同步单元测试设计。
- 三类测试用例本阶段**设计**，分别在阶段 6/7/5 **执行**。
- 每个子阶段评审通过后推进，RTM 逐列补登。
