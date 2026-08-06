---
name: codegraph-exploration
description: "任何代码/测试文件修改前必须使用此技能——阶段 5-8 的 Edit/Write 操作前，先通过 codegraph_explore 查询目标符号的 callers/callees/blast radius 并落盘到 .w-model/codegraph-queries/，完成影响分析后才允许修改。对应约束 #20（codegraph 修改前影响分析）与反模式 #38（修改前未查询 codegraph）。"
version: "1.0.0"
license: MIT
metadata:
  hermes:
    tags: [codegraph, exploration, impact-analysis]
---

# codegraph 影响分析：修改前探索影响半径

在修改任何代码/测试文件之前，通过 codegraph_explore 查询目标符号的 callers / callees / blast radius，评估修改的波及范围，并将查询结果落盘供校验脚本核验。

<HARD-GATE>
在你完成 codegraph_explore 查询并将结果落盘到 `.w-model/codegraph-queries/` 之前，不得对目标符号所在的代码/测试文件执行任何 Edit/Write。这是修改前门禁（约束 #20）：先查影响、再落盘、后修改。
</HARD-GATE>

本门禁与 brainstorming 的设计门禁（"先展示设计并获得用户批准，再实现"）不同——本技能约束的是**修改动作本身**：任何 Edit/Write 都必须先有已落盘的 codegraph 查询记录，与设计阶段是否完成无关。

## 何时使用

阶段 5-8（编码、测试、修复、返工）中，任何代码/测试文件的 `Edit`/`Write` 之前都必须执行本流程：

- 对应约束 #20（codegraph 修改前影响分析）与反模式 #38（修改前未查询 codegraph）
- `check-codegraph-queries.ts` 脚本会校验：若阶段 5-8 存在代码/测试修改但 `.w-model/codegraph-queries/` 下无对应查询落盘，将以退出码 1 命中反模式 #38

## 修改前流程

1. **查询**：调用宿主 Agent 的 `codegraph_explore` MCP 工具查询目标符号，获取 callers（调用方）、callees（被调用方）与 blast radius（影响半径）
2. **落盘**：将查询结果写入 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`，字段对齐 check-codegraph-queries.ts 接口：`querySymbol`（string）、`callers`（数组）、`callees`（数组）、`blastRadius`（number）、`queryTimestamp`（string）
3. **评估**：分析修改是否波及 callers（调用方是否需要同步适配）；是否需同步修改 callees（被调用方行为变化）
4. **安全确认**：影响半径评估完成后，再执行 `Edit`/`Write`
5. **（可选）再查**：修改完成后可再查询一次，确认影响未意外扩大

## 校验

运行校验脚本核验查询落盘是否齐全：

```bash
npx tsx w-model-dev/scripts/check-codegraph-queries.ts <project-root> --phase <5|6|7|8>
```

退出码含义：

- `0`：该阶段所有修改都有对应的 codegraph 查询落盘，校验通过
- `1`：存在未查询的修改（命中反模式 #38）——补跑 codegraph_explore 查询并落盘后重跑校验
- `2`：输入错误（缺少 `<project-root>` 或 `--phase` 参数，或阶段号不在 5-8 范围内）

命中退出码 1 时：暂停未查询的修改，补查目标符号并落盘，重新评估影响半径后再继续。

## 与 code-TLA+ 的关系

- **codegraph** = 修改前预防：在 Edit/Write 之前识别影响半径，避免误改被广泛依赖的符号
- **code-TLA+** = 修改后回归：修改完成后验证一致性，捕获引入的回归

两者互补不冲突：codegraph 管住"改之前"，code-TLA+ 管住"改之后"。

## 检查清单

按顺序执行：

1. 调用 `codegraph_explore` 查询目标符号的 callers / callees / blast radius
2. 将查询结果落盘到 `.w-model/codegraph-queries/phase<N>-<ticket>-<symbol>.json`（含 querySymbol / callers / callees / blastRadius / queryTimestamp）
3. 评估修改是否波及 callers，是否需同步修改 callees
4. 影响确认安全后执行 Edit/Write
5. （可选）修改后再查一次，确认影响未扩大
6. 运行 `npx tsx w-model-dev/scripts/check-codegraph-queries.ts <project-root> --phase <5|6|7|8>`，退出码为 0
