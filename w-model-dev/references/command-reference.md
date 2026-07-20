# `/wm` 命令参考

> 仅在执行 `/wm` 命令时读取。本文件定义输入、输出、失败动作和状态更新；阶段内容仍以对应 `phase-N-*.md` 为准。

## 目录

- 通用命令规则
- `/wm analyze`、`design`、`code`、`test`
- `/wm review`、`status`、`help`
- `/wm reset`、`export`、`import`

## 通用命令规则

1. 先读取 `.w-model/project.json` 与 `.w-model/rtm.json`；首次 `/wm analyze` 可初始化。
2. 检查命令所需上游阶段产物；缺失时拒绝执行并给出返回命令。
3. 只加载当前命令对应阶段参考、`rtm-guide.md` 和所需模板。
4. 所有写操作完成后同步 `updatedAt`；只有阶段放行后更新 `status`。
5. 写入前使用项目语言可用的原子写入方式（临时文件后 rename），避免并发写坏 JSON。

## `/wm analyze <需求>`

- **路由**：阶段 1 需求分析。
- **输入**：需求描述、业务背景；首次进入还需技术栈。
- **读取**：`phase-1-requirements.md`、`rtm-guide.md`、需求与测试模板。
- **产出**：需求规格、验收测试设计、风险清单、RTM 初始映射。
- **失败**：信息不足时列出缺失项并暂停；不得猜测关键业务规则。
- **状态**：初始化为“需求分析”；阶段门与用户均放行后才更新为“系统设计”。

## `/wm design type=<架构|概要|详细>`

| `type` | 路由 | 必需上游产物 | 同步测试设计 |
|---|---|---|---|
| `架构` | 阶段 2 系统设计 | 已放行需求规格 | 系统测试 |
| `概要` | 阶段 3 概要设计 | 已放行系统设计 | 集成测试 |
| `详细` | 阶段 4 详细设计 | 已放行概要设计 | 单元测试 |

- **失败**：`type` 缺失/非法返回合法值；上游产物缺失则拒绝跳阶段。
- **状态**：对应阶段门与用户放行后才切换到下一阶段。

## `/wm code <功能>`

- **路由**：阶段 5 编码实现。
- **前置**：存在已放行详细设计和单元测试设计。
- **读取**：`phase-5-coding.md`、`rtm-guide.md`；质量检查时追加 `quality-standards.md`。
- **产出**：实现代码、单元测试、测试与覆盖率输出、代码检查结果、RTM 代码映射。
- **失败**：没有详细设计时拒绝编码并引导 `/wm design type=详细`；测试/编译/lint 失败时留在阶段 5。
- **状态**：代码评审、单元测试和覆盖率门槛均满足且用户放行后才能进入“集成测试”。

## `/wm test type=<类型> result=<pass|fail>`

- **类型**：`单元 | 集成 | 系统 | 验收`。
- **必要证据**：测试命令、退出码、`passed/failed/pending`；单元测试还需覆盖率。
- **真实回填**：`result` 必须与测试输出一致；缺证据或冲突时拒绝回填。
- **`pass`**：仅将实际通过用例标为通过，并更新 `executionSummary.<type>Test`。
- **`fail`**：记录失败用例、根因和关联模块，更新 RTM，按阶段参考回退。
- **产出**：使用 `templates/test-report.md` 生成测试报告。
- **禁止**：未执行即标通过、LLM 估算结果、`result` 缺省、把 pending 当 passed。

## `/wm review <target>`

返回评审指引，不由命令本身调用 LLM：

1. 按前缀识别目标：`REQ-` → requirement；`DESIGN-` → design；`UAT-/ST-/IT-/UT-` → testcase；否则为 file。
2. 读取 `verifier-spec.md` 对应子标准与提示词。
3. 输出 `targetKind`、目标、子标准、提示词占位符和以下命令：

```bash
npx tsx w-model-dev/scripts/check-verifier-output.ts "<output.json>"
```

4. 说明 A/B 且 `passed=true` 才能进入用户放行检查点；C/D 按 `reworkHints` 返工。

## `/wm status`

只读 `.w-model/project.json` 与 `.w-model/rtm.json`，输出：

1. 当前阶段和 `updatedAt`；
2. 已完成阶段数 / 8 与进度；
3. RTM 已覆盖需求数 / 总需求数；
4. 四级测试 `total/passed/failed/pending`；
5. 基于真实状态的下一步建议。

状态文件缺失时说明项目未初始化；JSON 损坏时转 `operational-recovery.md`，不得猜测状态。

## `/wm help`

输出命令速查、阶段与测试对应关系，以及以下四条：测试设计前置、阶段门不可跳过、测试结果必须真实、退出码 1/2 不得放行。不读取项目状态。

## `/wm reset`

> 🔴 **CHECKPOINT · 重置确认**：执行前展示将删除的实体和将保留的项目元信息，必须获得确认。

- **保留**：`id/name/description/techStack/createdAt`。
- **清空**：需求、设计、测试用例、RTM 实体与执行结果。
- **重置**：`status=需求分析`，刷新 `updatedAt`。
- 用户拒绝时不修改文件，也不重复施压。

## `/wm export [输出目录]`

- 默认目录 `./w-model-export/`。
- 生成 `project.json`、`rtm.md`、`requirements.json`、`designs.json`、`testcases.json`。
- 校验聚合文件与独立文件实体数一致；不一致时导出失败并列出差异。
- 输出路径、文件大小和实体数；路径含空格时命令参数加双引号。

## `/wm import <project.json>`

1. 按 `data-models.md` 校验必填字段、阶段枚举、实体枚举和 ID 唯一性。
2. 校验失败列出字段路径和原因，退出码语义为 2，不写任何文件。
3. `.w-model/` 已有数据时触发覆盖确认检查点；拒绝则不写入。
4. 确认后原子写入 `project.json` 与 `rtm.json`，刷新 `updatedAt`。
5. 输出项目名、阶段、需求数、测试用例数和 RTM 覆盖率。
