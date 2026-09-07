# 触发边界可度量性 campaign 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把技能触发/检索边界变成可回归度量的资产——60 条语料库（负向 22/歧义 8/正向 12/L2 机制 18）、notContains + 类别锚点 + 覆盖矩阵三层负向断言、activation-guide 反例登记册、SKILL.md 触发面反例信号、L0 文档级复用指南。

**架构：** 在现有 `eval/` 双文件（prompts ↔ mappings 1:1）上扩展：prompts.json 增 `category`/`route` 字段承载语料；mappings.json 升 v2 顶层声明 matrix 期望；runner.ts 增 `notContains` 断言（可选 `scopeAnchor` 行域限定）与 `coverageMatrix` 五项校验；`w-model-dev/references/activation-guide.md` 是反例类别的人类可读视图（`- id=N:` 行与语料双向锚定）。治理链遵守 SSoT 优先（SSoT §3.6 → w-model-dev 资产 → README/AGENTS/CHANGELOG → TSV）。

**技术栈：** TypeScript + tsx runtime + node stdlib（**不新增任何 devDep**）；vitest 不覆盖 `eval/`（`config/vitest.config.ts` include 仅 `w-model-dev/scripts/__tests__`），runner 的测试回路是 `--self-check` 模式。

**规格来源：** `docs/superpowers/specs/2026-09-07-trigger-boundary-campaign-design.md`（已批准，commit `7d7afcb`）。

**运行环境注意：** 所有命令在仓库根 `D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack` 执行；`npm run prepush` 须在 Git Bash 跑；`self-test`/`doctor` 可在 PowerShell。仓库已在 main 分支直接工作（本仓库惯例，无 worktree）。

---

## 文件结构

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `docs/skill-design-document_SSoT.md` | 修改 | 新增 §3.6「触发边界与反例登记册」——类别全集、route 三值、数据源/视图/矩阵契约、L0 复用分级的权威定义（治理链第 1 步） |
| `eval/runner.ts` | 修改 | notContains 断言 + scopeAnchor 行域 + coverageMatrix 五项校验 + selfCheck/矩阵自检扩展 |
| `eval/w-model-dev-test-prompts.json` | 修改 | 60 条语料：id 3/6/7 类目化 + 新增 id 26-60 |
| `w-model-dev/references/activation-guide.md` | 创建 | 第 41 份 reference：13 个类别节，示例行与语料双向锚定 |
| `w-model-dev/SKILL.md` | 修改 | frontmatter 反例句、触发决策表第 3 行反例速览、资源计数 40→41 |
| `eval/mappings.json` | 修改 | version 2 + 顶层 matrix 声明 + 3 条类目化 + 新增 35 条映射 |
| `docs/INSTALL.md` | 修改 | 新增「子能力单独复用」节 |
| `docs/adoption-guide.md` | 修改 | 加交叉链接一行 |
| `eval/README.md` | 修改 | 修正过时清单描述 + matrix 机制说明 |
| `README.md` | 修改 | references 计数 40→41（行 194） |
| `AGENTS.md` | 修改 | §2 目录速查 references 行补 activation-guide 词条（若有计数一并同步） |
| `CHANGELOG.md` | 修改 | 本 campaign 变更条目 |
| `eval/w-model-dev-results.tsv` | 修改 | 新增 dry_run 轮次行 |

类别体系（13 类，canonical 名称，用于 guide 标题与断言锚点）：

| route | 类别 | 条目 id | 条数 |
| --- | --- | --- | --- |
| skip | N1 一次性数据/文件脚本 | 26, 27 | 2 |
| skip | N2 样式与小 bug 修复 | 6, 28, 29 | 3 |
| skip | N3 纯问答与技术解释 | 7, 30, 31 | 3 |
| skip | N4 环境与配置变更 | 32, 33 | 2 |
| skip | N5 纯文档撰写与排版 | 34, 35 | 2 |
| skip | N6 数据查询与正则提取 | 36, 37 | 2 |
| skip | N7 依赖升级与小重构 | 38, 39 | 2 |
| skip | N8 非软件开发任务 | 40, 41 | 2 |
| skip | N9 单点执行指令 | 42, 43 | 2 |
| skip | N10 已由其他工具接管的请求 | 44, 45 | 2 |
| ask | A1 完整流程未提 W 模型 | 3, 46, 47 | 3 |
| ask | A2 大型新项目仅说"开始做" | 48, 49, 50 | 3 |
| ask | A3 模糊合规表述 | 51, 52 | 2 |
| enable | （无类别） | 1, 2, 4, 5, 53-60 | 12 |
| —（无 route） | L2 机制存在性 | 8-25 | 18 |

合计 60。每类首条 id（守卫承载条目）：N1=26、N2=28、N3=30、N4=32、N5=34、N6=36、N7=38、N8=40、N9=42、N10=44。

类别守卫的两个 notContains 断言（每负向类别 ≥1 组，写入守卫承载条目）：

- 行域守卫：`{type:'notContains', target:'w-model-dev/SKILL.md', substring:'<类别 canonical 名>', scopeAnchor:'立即启用'}`——类别名不得出现在触发决策表启用行；
- 文件域守卫：`{type:'notContains', target:'w-model-dev/SKILL.md', substring:'<该类反例短语>'}`——反例短语在 SKILL.md 全文任何位置都不该出现。

反例短语表（文件域守卫用，已核对当前 SKILL.md 不含这些字样）：N1=`批量重命名`、N2=`错别字`、N3=`事件循环`、N4=`GitHub Actions`、N5=`中英文排版`、N6=`nginx 访问日志`、N7=`升级到 19`、N8=`工作周报`、N9=`别走流程了`、N10=`跑一下 prettier`。

---

### 任务 1：SSoT §3.6 触发边界与反例登记册（治理链第 1 步）

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`（在行 429 `### 3.5 L0/L1 链接边界（交付分层导航规则）` 节之后、行 430 `## 4. 技能工作流程` 之前插入）

- [ ] **步骤 1：插入新节**

在 `### 3.5` 节内容结束、`## 4. 技能工作流程` 标题之前，插入以下完整内容（标题编号 3.6）：

```markdown
### 3.6 触发边界与反例登记册（Trigger Boundary & Anti-Scenario Registry）

技能触发边界由三层资产共同度量，本节为权威定义（规格：docs/superpowers/specs/2026-09-07-trigger-boundary-campaign-design.md）。

**route 三值语义**：每条评估语料归属 `enable`（立即启用）/ `ask`（先询问，确认前不初始化）/ `skip`（不启用，按普通任务处理）之一；L2 机制存在性条目不带 route。

**类别全集（13 类）**：负向 N1-N10（一次性数据/文件脚本、样式与小 bug 修复、纯问答与技术解释、环境与配置变更、纯文档撰写与排版、数据查询与正则提取、依赖升级与小重构、非软件开发任务、单点执行指令、已由其他工具接管的请求）与歧义 A1-A3（完整流程未提 W 模型、大型新项目仅说"开始做"、模糊合规表述）。类别增删须先改本节，再同步 activation-guide / prompts / mappings。

**三层资产契约**：
- 数据源 = `eval/w-model-dev-test-prompts.json`（60 条，含 category/route 字段）；
- 视图 = `w-model-dev/references/activation-guide.md`（13 个 `## <code> <canonical 名>` 节，示例行 `- id=N: <prompt 原文>`，每节另含判定理由与边界说明——何时升级为 ask/enable）；
- 一致性 = `eval/mappings.json` 顶层 matrix 声明 + `eval/runner.ts` coverageMatrix 五项校验（route 对齐 / 总数符合声明 / 每类别 ≥ minPerCategory / guide 节示例数 == 语料条数 / 每负向类别 ≥1 组 notContains 守卫）。

**触发面分层**：SKILL.md frontmatter description 保留一句英文反例信号（作用于技能加载器的匹配面）；触发决策表"不启用"行含十类速览并链接 activation-guide.md；完整判定细则只在 activation-guide.md 按需加载——常驻面增量 ≤15 行。

**L0 复用分级**：references 分「可单独拷贝」（方法论自包含：root-cause-locator / iceberg-sweep-guide / agent-personas+subagent / conventions / estimation-guide / context-management-guide / coding-quality / toolbox）与「不可单独拷贝」（依赖编排/状态/门禁：phase-N-* / subagent-delegation / signature-chain-guide / rtm-guide / graph-guide / hard-constraints）；权威清单与版本对齐义务见 docs/INSTALL.md「子能力单独复用」节。
```

- [ ] **步骤 2：验证插入位置与格式**

运行：`grep -n "### 3.6 触发边界与反例登记册\|^## 4. 技能工作流程" docs/skill-design-document_SSoT.md`
预期：3.6 节标题行号 < `## 4.` 行号，且二者相邻区间内无其他 `## `/`### ` 标题穿插。

- [ ] **步骤 3：Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): add 3.6 trigger boundary & anti-scenario registry (campaign step 1)"
```

---

### 任务 2：runner.ts 断言机制扩展（notContains + scopeAnchor，TDD）

**文件：**
- 修改：`eval/runner.ts:21-30`（Assertion 类型）、`eval/runner.ts:69-78`（evaluateAssertion）、`eval/runner.ts:114-128`（selfCheck）

- [ ] **步骤 1：先写失败的 self-check 用例**

把 `selfCheck` 函数（当前 114-128 行）替换为：

```ts
function selfCheck(io: FileSystemAdapter): boolean {
  const passCases: Assertion[] = [
    { type: 'fileExists', target: 'package.json' },
    { type: 'contains', target: 'package.json', substring: '"name"' },
    { type: 'notContains', target: 'package.json', substring: '__no_such_substring__' },
    { type: 'notContains', target: 'package.json', substring: 'name', scopeAnchor: '"version"' },
    { type: 'contains', target: 'package.json', substring: '"name"', scopeAnchor: '"name"' },
  ];
  const failCases: Assertion[] = [
    { type: 'fileExists', target: '__no_such_file__.nomatch' },
    { type: 'contains', target: 'package.json', substring: '__no_such_substring__' },
    { type: 'notContains', target: 'package.json', substring: '"name"' },
    { type: 'notContains', target: 'package.json', substring: '"name"', scopeAnchor: '"name"' },
    { type: 'contains', target: 'package.json', substring: '"name"', scopeAnchor: '__no_such_anchor__' },
    { type: 'notContains', target: '__no_such_file__.nomatch', substring: 'x' },
  ];
  const ok =
    passCases.every((c) => evaluateAssertion(c, io) === null) &&
    failCases.every((c) => evaluateAssertion(c, io) !== null);
  console.log(JSON.stringify({ selfCheck: ok }));
  return ok;
}
```

（前提：`package.json` 含 `"name"` 与 `"version"` 行——真；不含 `__no_such_substring__`——真。）

- [ ] **步骤 2：运行验证失败（红）**

运行：`npx tsx eval/runner.ts --self-check`
预期：**类型错误或判定失败退出 1**——`scopeAnchor`/`notContains` 尚未在 `Assertion` 联合类型中定义，或 failCases 中 notContains 被旧逻辑按 contains 处理而误判通过。任一形态的失败即红。

- [ ] **步骤 3：实现类型与判定逻辑**

把 `eval/runner.ts:21-30` 的断言类型区替换为：

```ts
interface ScopeFields {
  /** 行域限定：只在本文件内包含该锚文本的行上判定；锚行不存在视为失败 */
  scopeAnchor?: string;
}
interface ContainsAssertion extends ScopeFields {
  type: 'contains';
  target: string;
  substring: string;
}
interface NotContainsAssertion extends ScopeFields {
  type: 'notContains';
  target: string;
  substring: string;
}
interface FileExistsAssertion {
  type: 'fileExists';
  target: string;
}
type Assertion = ContainsAssertion | NotContainsAssertion | FileExistsAssertion;
```

把 `evaluateAssertion`（当前 69-78 行）替换为：

```ts
function anchoredLines(io: FileSystemAdapter, target: string, anchor: string): string[] {
  const lines = io
    .read(target)
    .split(/\r?\n/)
    .filter((l) => l.includes(anchor));
  if (lines.length === 0) throw new Error(`锚定行不存在（target=${target}, anchor=${anchor}）`);
  return lines;
}

export function evaluateAssertion(a: Assertion, io: FileSystemAdapter): string | null {
  if (a.type === 'fileExists') {
    return io.exists(a.target) ? null : `文件不存在：${a.target}`;
  }
  try {
    if (a.scopeAnchor !== undefined) {
      const lines = anchoredLines(io, a.target, a.scopeAnchor);
      const hit = lines.some((l) => l.includes(a.substring));
      if (a.type === 'notContains') {
        return hit ? `${a.target} 锚定「${a.scopeAnchor}」的行包含不该出现的「${a.substring}」` : null;
      }
      return hit ? null : `${a.target} 锚定「${a.scopeAnchor}」的行未包含「${a.substring}」`;
    }
    const includes = io.read(a.target).includes(a.substring);
    if (a.type === 'notContains') {
      return includes ? `${a.target} 不应包含「${a.substring}」却包含` : null;
    }
    return includes ? null : `${a.target} 未包含「${a.substring}」`;
  } catch (e) {
    return `无法判定：${(e as Error).message}`;
  }
}
```

- [ ] **步骤 4：运行验证通过（绿）**

运行：`npx tsx eval/runner.ts --self-check`
预期：输出 `{"selfCheck":true}`，退出码 0。

- [ ] **步骤 5：回归确认主流程不受影响**

运行：`npm run eval`
预期：25/25 通过，退出码 0（本任务未动 mappings）。

- [ ] **步骤 6：Commit**

```bash
git add eval/runner.ts
git commit -m "feat(eval): add notContains assertion with scopeAnchor row scoping (campaign step 2)"
```

---

### 任务 3：prompts.json 语料扩充（35 新条目 + 3 条类目化）

**文件：**
- 修改：`eval/w-model-dev-test-prompts.json`

- [ ] **步骤 1：类目化既有 3 条**

对 id 3、6、7 三条，在对象内追加字段（其余字段原样保留）：

```json
{ "id": 3, "category": "A1", "route": "ask" }
```
```json
{ "id": 6, "category": "N2", "route": "skip" }
```
```json
{ "id": 7, "category": "N3", "route": "skip" }
```

- [ ] **步骤 2：追加 35 条新语料（id 26-60）**

在 `mappings` 数组……注意：本文件是顶层数组，直接在最后一个元素（id 25）之后追加以下 35 个对象：

```json
[
  { "id": 26, "scenario": "反误触发 N1：一次性脚本批量重命名", "category": "N1", "route": "skip",
    "prompt": "帮我写一个 Python 脚本批量重命名当前目录下的图片文件",
    "expected": "skill 不应启用或初始化 .w-model/；按普通编码任务直接产出脚本并说明用法" },
  { "id": 27, "scenario": "反误触发 N1：CSV 清洗转换", "category": "N1", "route": "skip",
    "prompt": "写个脚本把这个 CSV 里的空行清掉，统一转成 UTF-8 编码",
    "expected": "skill 不应启用；按普通数据处理任务直接产出脚本" },
  { "id": 28, "scenario": "反误触发 N2：CSS 样式调整", "category": "N2", "route": "skip",
    "prompt": "这个按钮没居中，帮我改一下 CSS",
    "expected": "skill 不应启用；直接定位样式规则并修改，不要求需求分析或 RTM" },
  { "id": 29, "scenario": "反误触发 N2：文案错别字修正", "category": "N2", "route": "skip",
    "prompt": "页面上有个错别字，把文案改一下",
    "expected": "skill 不应启用；直接修正文案" },
  { "id": 30, "scenario": "反误触发 N3：概念解释（事件循环）", "category": "N3", "route": "skip",
    "prompt": "解释一下 JavaScript 的事件循环是怎么回事",
    "expected": "skill 不应触发 /wm analyze 或创建项目状态；直接回答技术问题" },
  { "id": 31, "scenario": "反误触发 N3：原理对比问答（WAL vs binlog）", "category": "N3", "route": "skip",
    "prompt": "什么是 WAL 日志？和 MySQL 的 binlog 有什么区别？",
    "expected": "skill 不应启用；直接回答技术问题" },
  { "id": 32, "scenario": "反误触发 N4：tsconfig 与依赖安装", "category": "N4", "route": "skip",
    "prompt": "帮我把 tsconfig 的 strict 打开，顺便装一下 ajv 这个依赖",
    "expected": "skill 不应启用；直接修改配置并执行安装，说明改动影响" },
  { "id": 33, "scenario": "反误触发 N4：CI workflow 新增", "category": "N4", "route": "skip",
    "prompt": "在 GitHub Actions 里加一个跑 lint 的 workflow",
    "expected": "skill 不应启用；直接产出 workflow 配置文件" },
  { "id": 34, "scenario": "反误触发 N5：笔记整理成 README", "category": "N5", "route": "skip",
    "prompt": "帮我把这份调研笔记整理成一篇 README 文档",
    "expected": "skill 不应启用；按普通文档任务直接整理输出" },
  { "id": 35, "scenario": "反误触发 N5：中英文排版规范", "category": "N5", "route": "skip",
    "prompt": "给这篇文章做一下中英文排版，把空格规范一下",
    "expected": "skill 不应启用；直接完成排版修正" },
  { "id": 36, "scenario": "反误触发 N6：SQL 数据查询", "category": "N6", "route": "skip",
    "prompt": "写个 SQL 查一下上个月下单超过 10 单的用户列表",
    "expected": "skill 不应启用；直接产出 SQL 并解释" },
  { "id": 37, "scenario": "反误触发 N6：日志正则提取", "category": "N6", "route": "skip",
    "prompt": "从这个 nginx 访问日志里提取所有返回 5xx 的 IP",
    "expected": "skill 不应启用；直接产出提取命令或脚本" },
  { "id": 38, "scenario": "反误触发 N7：框架版本升级", "category": "N7", "route": "skip",
    "prompt": "把 React 从 18 升级到 19，处理一下 breaking changes",
    "expected": "skill 不应启用；按普通升级任务执行并回归测试（若用户明确要求架构级迁移设计评审，应转 A 类先询问——见 activation-guide N7 边界说明）" },
  { "id": 39, "scenario": "反误触发 N7：行为不变的小重构", "category": "N7", "route": "skip",
    "prompt": "把这个 800 行的工具函数文件拆成几个模块，行为保持不变",
    "expected": "skill 不应启用；直接重构并跑既有测试确认行为不变" },
  { "id": 40, "scenario": "反误触发 N8：工作周报撰写", "category": "N8", "route": "skip",
    "prompt": "帮我写本周的工作周报，重点写进度和风险",
    "expected": "skill 不应启用；非软件开发任务，直接完成撰写" },
  { "id": 41, "scenario": "反误触发 N8：技术方案 PPT", "category": "N8", "route": "skip",
    "prompt": "把这个技术方案做成 10 页 PPT",
    "expected": "skill 不应启用；直接完成 PPT 制作" },
  { "id": 42, "scenario": "反误触发 N9：单点函数修改指令", "category": "N9", "route": "skip",
    "prompt": "别走流程了，直接把这个函数的返回类型改成 Promise",
    "expected": "项目无 .w-model/ 状态时不启用；直接完成单点修改（若项目已有 .w-model/ 状态且处于流程中，按当前阶段处理——见 activation-guide N9 边界说明）" },
  { "id": 43, "scenario": "反误触发 N9：常量提取配置", "category": "N9", "route": "skip",
    "prompt": "直接改：把这个硬编码常量提到配置文件里",
    "expected": "skill 不应启用；直接完成修改并验证" },
  { "id": 44, "scenario": "反误触发 N10：格式化工具执行", "category": "N10", "route": "skip",
    "prompt": "跑一下 prettier 把整个仓库的格式统一了",
    "expected": "skill 不应启用；已由格式化工具接管，直接执行并报告结果" },
  { "id": 45, "scenario": "反误触发 N10：构建执行", "category": "N10", "route": "skip",
    "prompt": "执行 npm run build，把产物路径发我",
    "expected": "skill 不应启用；直接执行构建并报告产物路径" },
  { "id": 46, "scenario": "歧义 A1：新模块全流程", "category": "A1", "route": "ask",
    "prompt": "我们要上一个新模块，从需求梳理到上线全流程走一遍",
    "expected": "skill 不应直接初始化；识别为完整流程信号但未提 W 模型，先询问是否采用 W 模型，确认前不创建 .w-model/" },
  { "id": 47, "scenario": "歧义 A1：需求与测试用例先行", "category": "A1", "route": "ask",
    "prompt": "做个新功能，先把需求和测试用例都定清楚再动手",
    "expected": "skill 不应直接初始化；流程信号强但未点名 W 模型，先询问，确认后再进入阶段 1" },
  { "id": 48, "scenario": "歧义 A2：大型新项目（审批系统）", "category": "A2", "route": "ask",
    "prompt": "开始做内部审批系统，这是个大项目",
    "expected": "skill 不应直接初始化；大型项目信号但未提任何流程要求，先询问是否采用 W 模型及确认范围" },
  { "id": 49, "scenario": "歧义 A2：数据平台项目规划", "category": "A2", "route": "ask",
    "prompt": "新起一个数据平台的项目，先规划一下怎么做",
    "expected": "skill 不应直接初始化；先询问是否采用 W 模型；若确认则从阶段 1 开始" },
  { "id": 50, "scenario": "歧义 A2：老系统重写分期", "category": "A2", "route": "ask",
    "prompt": "我们要把老系统重写，分几期做",
    "expected": "skill 不应直接初始化；先询问是否采用 W 模型，并提示 brownfield 采用路径（先补 RTM 与状态）" },
  { "id": 51, "scenario": "歧义 A3：模糊合规表述（正规一点）", "category": "A3", "route": "ask",
    "prompt": "这个项目要做得正规一点，按行业规范来",
    "expected": "skill 不应直接初始化；'正规''规范'语义模糊，先澄清是否指 W 模型的阶段门/RTM/并行测试设计" },
  { "id": 52, "scenario": "歧义 A3：模糊合规表述（最规范流程）", "category": "A3", "route": "ask",
    "prompt": "按你们最规范的开发流程来做这个支付功能",
    "expected": "skill 不应直接初始化；先询问是否采用 W 模型；支付功能涉及高可靠性可提示 TLA+/BDD 按成熟度启用" },
  { "id": 53, "scenario": "正向变体：中文 W 模型需求分析", "route": "enable",
    "prompt": "用 W 模型给这个库存管理系统做需求分析",
    "expected": "skill 立即启用，进入阶段 1；正式产出前暂停在项目初始化 CHECKPOINT" },
  { "id": 54, "scenario": "正向变体：/wm status 只读命令", "route": "enable",
    "prompt": "/wm status",
    "expected": "skill 执行只读状态快照（当前阶段/进度/RTM 覆盖/最近动作），不产生任何写操作" },
  { "id": 55, "scenario": "正向变体：英文并行测试设计与追溯", "route": "enable",
    "prompt": "Use the W-model to design this order service with parallel test design and traceability",
    "expected": "skill 识别 W-model + traceability 信号立即启用；确认阶段与技术栈后按同步测试设计推进" },
  { "id": 56, "scenario": "正向变体：按阶段门续推进", "route": "enable",
    "prompt": "按 W 模型阶段门继续推进当前项目到系统设计",
    "expected": "skill 启用并读取 .w-model/ 状态；校验上游产物已放行后进入阶段 2，缺上游则拒绝跳阶段" },
  { "id": 57, "scenario": "正向变体：高可靠性 TLA+ 信号", "route": "enable",
    "prompt": "用 W 开发模型跑这个嵌入式固件项目，可靠性要求高，需要 TLA+ 形式化验证",
    "expected": "skill 启用；高可靠性信号按成熟度分级启用 TLA+/BDD 行为门禁（约束 #13）" },
  { "id": 58, "scenario": "正向变体：返工根因定位", "route": "enable",
    "prompt": "阶段 3 的设计评审没过，按 W 模型返工流程先做根因分析",
    "expected": "skill 启用并走返工链：分派 R 子代理产出 RootCauseReport，经 V 复审 + check-rootcause-report.ts 门禁后才分派 S-fix（反模式 #18/#19）" },
  { "id": 59, "scenario": "正向变体：brownfield RTM 补齐", "route": "enable",
    "prompt": "用 W 模型补齐这个 brownfield 项目的 RTM 和四级测试设计",
    "expected": "skill 启用；按 brownfield 采用路径先读现有项目与状态，识别缺失追溯项并补齐，不伪造测试结果" },
  { "id": 60, "scenario": "正向变体：英文阶段门评审", "route": "enable",
    "prompt": "Stage gate review for phase 2 before we proceed, per the W-model",
    "expected": "skill 识别 stage gates + W-model 信号启用；执行 /wm review 语义，评审通过且 CHECKPOINT 用户确认后才放行" }
]
```

- [ ] **步骤 3：结构校验**

运行：`node -e "const d=require('./eval/w-model-dev-test-prompts.json'); const r={}; let n=0; for(const e of d){if(e.route){r[e.route]=(r[e.route]||0)+1;n++; if(!e.expected) throw new Error('id='+e.id+' 缺 expected')}}; console.log(JSON.stringify({total:d.length, routed:n, byRoute:r})); console.log('ids ok:', new Set(d.map(x=>x.id)).size===d.length && d.every((x,i)=>x.id===i+1))"`
预期：`{"total":60,"routed":42,"byRoute":{"ask":8,"enable":12,"skip":22}}` 且 `ids ok: true`（同时校验了每条 route 语料 expected 非空——规格 §2 精编 checklist 的"expected 可判定"项）。

- [ ] **步骤 4：回归（eval 此时应仍 25/25，新语料尚无映射不参与断言）**

运行：`npm run eval`
预期：25/25 通过退出 0（crossCheckIds 只校验 prompts↔mappings 双向，新增 prompt 无 mapping 会报"缺少映射"——**预期此时报 35 条 coverageProblems 且退出 1**，这是中间态，任务 5 消除）。

- [ ] **步骤 5：Commit**

```bash
git add eval/w-model-dev-test-prompts.json
git commit -m "feat(eval): expand corpus to 60 entries with category/route (campaign step 3)"
```

---

### 任务 4：activation-guide.md 新建 + 资源计数同步（40→41）

**文件：**
- 创建：`w-model-dev/references/activation-guide.md`
- 修改：`w-model-dev/SKILL.md:126`、`README.md:194`

- [ ] **步骤 1：创建 activation-guide.md，写入以下完整内容**

```markdown
# 触发激活指南（Activation Guide）

> 触发边界的完整判定细则。SKILL.md 触发决策表是浓缩入口，本文件是类别全集与边界说明。
> 权威定义：`docs/skill-design-document_SSoT.md` §3.6。数据源：`eval/w-model-dev-test-prompts.json`（本文件的示例行与语料一一对应，由 `npm run eval` 的 coverageMatrix 强制一致——增删示例必须同步语料）。

## 判定总则

1. 显式信号（/wm 命令、W 模型/W-model/W 开发模型、明确要求 RTM/阶段门/质量门/开发与测试并行）→ 立即启用。
2. 流程信号但未点名（完整流程/全生命周期/大型新项目/"正规一点"）→ 先询问，确认前不初始化。
3. 其余普通开发/解释/修复/配置/文档/非开发任务 → 不启用，按普通任务处理。

## N1 一次性数据/文件脚本

- 判定理由：单次数据处理或文件操作，无需求/设计/测试设计同步推进的价值。
- 典型示例：
  - id=26: 帮我写一个 Python 脚本批量重命名当前目录下的图片文件
  - id=27: 写个脚本把这个 CSV 里的空行清掉，统一转成 UTF-8 编码
- 边界说明：若脚本涉及高可靠性数据处理（金融对账、不可逆批量操作）且用户提及验证要求，升级为先询问（A 类）。

## N2 样式与小 bug 修复

- 判定理由：局部修改 + 局部验证即可闭环，无需阶段产物。
- 典型示例：
  - id=6: 请修复 src/auth.ts 中的登录错误并运行相关测试
  - id=28: 这个按钮没居中，帮我改一下 CSS
  - id=29: 页面上有个错别字，把文案改一下
- 边界说明：修复涉及跨模块接口变更或用户明确要求设计评审时，升级为先询问。

## N3 纯问答与技术解释

- 判定理由：无产出物、无代码修改，纯知识问答。
- 典型示例：
  - id=7: 请解释 OAuth2 授权码模式的工作原理
  - id=30: 解释一下 JavaScript 的事件循环是怎么回事
  - id=31: 什么是 WAL 日志？和 MySQL 的 binlog 有什么区别？
- 边界说明：问答后用户紧接着要求"按刚才说的实现"，若为单点实现仍属 N9；若出现流程信号转 A 类。

## N4 环境与配置变更

- 判定理由：配置/环境操作有自身工具链语义，不产生需求-设计-代码链路。
- 典型示例：
  - id=32: 帮我把 tsconfig 的 strict 打开，顺便装一下 ajv 这个依赖
  - id=33: 在 GitHub Actions 里加一个跑 lint 的 workflow
- 边界说明：配置变更引发的大范围类型错误修复属 N7 小重构；引发架构调整时升级为先询问。

## N5 纯文档撰写与排版

- 判定理由：文档任务无代码与测试设计同步问题。
- 典型示例：
  - id=34: 帮我把这份调研笔记整理成一篇 README 文档
  - id=35: 给这篇文章做一下中英文排版，把空格规范一下
- 边界说明：为 W 模型项目产出阶段产物文档（需求规格/设计文档）时属技能内 S 角色职责，不适用本类。

## N6 数据查询与正则提取

- 判定理由：一次性查询/提取，答案即交付。
- 典型示例：
  - id=36: 写个 SQL 查一下上个月下单超过 10 单的用户列表
  - id=37: 从这个 nginx 访问日志里提取所有返回 5xx 的 IP
- 边界说明：查询结果驱动新功能开发（"查出来之后做个报表系统"）时，转 A 类先询问。

## N7 依赖升级与小重构

- 判定理由：行为保持不变的机械性变更，靠既有测试回归即可。
- 典型示例：
  - id=38: 把 React 从 18 升级到 19，处理一下 breaking changes
  - id=39: 把这个 800 行的工具函数文件拆成几个模块，行为保持不变
- 边界说明：升级引发架构级迁移（数据层换型、模块边界重划）且用户要求设计评审时，升级为先询问。

## N8 非软件开发任务

- 判定理由：与软件开发流程无关。
- 典型示例：
  - id=40: 帮我写本周的工作周报，重点写进度和风险
  - id=41: 把这个技术方案做成 10 页 PPT
- 边界说明：无升级路径。

## N9 单点执行指令

- 判定理由：用户显式拒绝流程（"直接改"），且无 .w-model/ 状态时无返程可走。
- 典型示例：
  - id=42: 别走流程了，直接把这个函数的返回类型改成 Promise
  - id=43: 直接改：把这个硬编码常量提到配置文件里
- 边界说明：**项目已有 .w-model/ 状态时不适用本类**——处于流程中的项目收到单点指令，应提示该改动是否纳入当前阶段（RTM 回填义务），由用户决定。

## N10 已由其他工具接管的请求

- 判定理由：lint/格式化/构建等工具有确定语义，编排反而添乱。
- 典型示例：
  - id=44: 跑一下 prettier 把整个仓库的格式统一了
  - id=45: 执行 npm run build，把产物路径发我
- 边界说明：构建失败后的缺陷修复属 N2/N9；引发流程级返工时按 W 模型返工链处理（须项目已在流程中）。

## A1 完整流程未提 W 模型

- 判定理由：流程信号明确但未点名 W 模型，直接初始化会替用户做重大流程决策。
- 典型示例：
  - id=3: 帮我做一个博客系统，从需求开始走完整流程
  - id=46: 我们要上一个新模块，从需求梳理到上线全流程走一遍
  - id=47: 做个新功能，先把需求和测试用例都定清楚再动手
- 边界说明：询问话术须说清 W 模型含义（并行测试设计、RTM 和阶段门）；用户确认后才初始化，确认前不创建 .w-model/。

## A2 大型新项目仅说"开始做"

- 判定理由：项目体量大隐含流程需求，但用户未表达流程偏好。
- 典型示例：
  - id=48: 开始做内部审批系统，这是个大项目
  - id=49: 新起一个数据平台的项目，先规划一下怎么做
  - id=50: 我们要把老系统重写，分几期做
- 边界说明：重写/分期类提示 brownfield 采用路径（先补 RTM 与状态，见 adoption-guide）；确认后从阶段 1 进入。

## A3 模糊合规表述

- 判定理由："正规""规范"语义不可判定，需澄清所指。
- 典型示例：
  - id=51: 这个项目要做得正规一点，按行业规范来
  - id=52: 按你们最规范的开发流程来做这个支付功能
- 边界说明：澄清时给出具体选项（阶段门/RTM/并行测试设计/TLA+ 按成熟度）；支付等高可靠性领域可主动提示形式化验证选项。
```

- [ ] **步骤 2：SKILL.md 资源计数同步**

`w-model-dev/SKILL.md:126`：`references/`（40 个 .md）→ `references/`（41 个 .md）。
`README.md:194`：`# 40 份阶段细则与规范` → `# 41 份阶段细则与规范`。

- [ ] **步骤 3：门禁回归**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：退出 0。若报 references 计数或登记缺失，按报错把 `w-model-dev/references/activation-guide.md` 登记进脚本内的 DESIGN_DOCS 清单（`grep -n "w-model-dev/references" w-model-dev/scripts/cli/check-docs-consistency.ts` 定位插入点）后重跑至退出 0。

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/references/activation-guide.md w-model-dev/SKILL.md README.md
git commit -m "feat(skill): add activation-guide reference (41st) and sync counts (campaign step 4)"
```

---

### 任务 5：mappings.json v2 + coverageMatrix 接线（TDD）+ eval 全绿

**文件：**
- 修改：`eval/mappings.json`、`eval/runner.ts`

- [ ] **步骤 1：先写失败的矩阵自检用例**

在 `eval/runner.ts` 的 `selfCheck` 函数之后新增：

```ts
function selfCheckMatrix(): boolean {
  const guide = ['## N1 测试类别', '- id=1: 示例一', '- id=2: 示例二'].join('\n');
  const io: FileSystemAdapter = {
    read: (p: string) => {
      if (p === 'guide.md') return guide;
      throw new Error(`意外读取：${p}`);
    },
    exists: (p: string) => p === 'guide.md',
  };
  const corpus: CorpusEntry[] = [
    { id: 1, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
    { id: 2, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
  ];
  const mappings: Mapping[] = [
    { id: 1, category: 'N1', route: 'skip', layer: 'L1N', scenario: '',
      assertions: [{ type: 'notContains', target: 's.md', substring: '测试类别', scopeAnchor: '立即启用' }],
      evidence: { type: 'assertion' } },
    { id: 2, category: 'N1', route: 'skip', layer: 'L1N', scenario: '', assertions: [], evidence: { type: 'assertion' } },
  ];
  const decl: MatrixDeclaration = { routeTotals: { enable: 0, ask: 0, skip: 2 }, minPerCategory: 2, guidePath: 'guide.md' };
  const okCase = coverageMatrix(corpus, mappings, decl, io);
  const badDecl: MatrixDeclaration = { ...decl, routeTotals: { enable: 0, ask: 0, skip: 3 } };
  const badCase = coverageMatrix(corpus, mappings, badDecl, io);
  const ok = okCase.length === 0 && badCase.length > 0;
  console.log(JSON.stringify({ selfCheckMatrix: ok }));
  return ok;
}
```

并把 `main()` 中 `--self-check` 分支改为同时跑两个自检：

```ts
  if (process.argv.includes('--self-check')) {
    const io = createRealFs();
    const ok = selfCheck(io) && selfCheckMatrix();
    process.exitCode = ok ? 0 : 1;
    return;
  }
```

- [ ] **步骤 2：运行验证失败（红）**

运行：`npx tsx eval/runner.ts --self-check`
预期：编译失败——`CorpusEntry`、`MatrixDeclaration`、`coverageMatrix` 未定义。

- [ ] **步骤 3：实现 CorpusEntry / MatrixDeclaration / coverageMatrix**

在 `eval/runner.ts` 的 `Mapping` 接口后新增（并给 `Mapping` 追加两个可选字段 `category?: string; route?: 'enable' | 'ask' | 'skip';`）：

```ts
export interface CorpusEntry {
  id: number;
  scenario: string;
  prompt: string;
  expected: string;
  category?: string;
  route?: 'enable' | 'ask' | 'skip';
}

export interface MatrixDeclaration {
  routeTotals: { enable: number; ask: number; skip: number };
  minPerCategory: number;
  guidePath: string;
}

/** 覆盖矩阵五项校验：①语料↔映射 route/category 对齐 ②route 总数符合声明 ③每类别 ≥ minPerCategory ④guide 节示例数==语料条数（双向）⑤每负向类别 ≥1 组「立即启用」行 notContains 守卫 */
export function coverageMatrix(
  corpus: CorpusEntry[],
  mappings: Mapping[],
  decl: MatrixDeclaration,
  io: FileSystemAdapter,
): string[] {
  const problems: string[] = [];
  const routed = corpus.filter((c) => c.route !== undefined);
  const byId = new Map(mappings.map((m) => [m.id, m]));
  for (const c of routed) {
    const m = byId.get(c.id);
    if (!m) continue; // 1:1 缺失由 crossCheckIds 报告
    if (m.route !== c.route) problems.push(`id=${c.id} route 不一致：语料=${c.route} 映射=${m.route ?? '无'}`);
    if (m.category !== c.category) problems.push(`id=${c.id} category 不一致：语料=${c.category} 映射=${m.category ?? '无'}`);
  }
  for (const [route, expected] of Object.entries(decl.routeTotals) as Array<[keyof MatrixDeclaration['routeTotals'], number]>) {
    const actual = routed.filter((c) => c.route === route).length;
    if (actual !== expected) problems.push(`route=${route} 总数 ${actual} ≠ 声明 ${expected}`);
  }
  const catCounts = new Map<string, number>();
  for (const c of routed) if (c.category) catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
  const isRegistryCat = (cat: string) => /^(N|A)\d+$/.test(cat);
  for (const [cat, n] of catCounts) {
    if (isRegistryCat(cat) && n < decl.minPerCategory) {
      problems.push(`类别 ${cat} 条数 ${n} < 下限 ${decl.minPerCategory}`);
    }
  }
  let guide: string;
  try {
    guide = io.read(decl.guidePath);
  } catch {
    return [...problems, `无法读取：${decl.guidePath}`];
  }
  const sections = new Map<string, number>();
  let current: string | null = null;
  for (const line of guide.split(/\r?\n/)) {
    const h = line.match(/^## ((?:N|A)\d+) /);
    if (h) {
      current = h[1];
      sections.set(current, 0);
      continue;
    }
    if (current && /^- id=\d+:/.test(line)) sections.set(current, (sections.get(current) ?? 0) + 1);
  }
  for (const [cat, n] of catCounts) {
    if (!isRegistryCat(cat)) continue;
    if (!sections.has(cat)) problems.push(`guide 缺少类别节：${cat}`);
    else if (sections.get(cat) !== n) problems.push(`类别 ${cat}：guide 示例 ${sections.get(cat)} 条 ≠ 语料 ${n} 条`);
  }
  for (const [cat] of sections) {
    if (!catCounts.has(cat)) problems.push(`guide 类别节 ${cat} 无对应语料`);
  }
  for (const [cat] of catCounts) {
    if (!/^N\d+$/.test(cat)) continue;
    const guarded = mappings.some(
      (m) =>
        m.category === cat &&
        m.assertions.some((a) => a.type === 'notContains' && a.scopeAnchor === '立即启用'),
    );
    if (!guarded) problems.push(`负向类别 ${cat} 缺少「立即启用」行 notContains 守卫`);
  }
  return problems;
}
```

- [ ] **步骤 4：main() 接线**

`main()` 中读取语料与 matrix 声明并纳入报告与退出码（替换现有 prompts/crossCheck/report 段）：

```ts
  const mappingsDoc = JSON.parse(io.read('eval/mappings.json')) as {
    mappings: Mapping[];
    matrix: MatrixDeclaration;
  };
  const corpus = JSON.parse(io.read('eval/w-model-dev-test-prompts.json')) as CorpusEntry[];
  const problems = crossCheckIds(mappingsDoc.mappings, corpus.map((p) => p.id));
  const matrixProblems = coverageMatrix(corpus, mappingsDoc.mappings, mappingsDoc.matrix, io);
  const results = mappingsDoc.mappings.map((m) => evaluateMapping(m, io));
  const passed = results.filter((r) => r.passed).length;
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    coverageProblems: problems,
    matrixProblems,
    results,
  };
  fs.writeFileSync(path.join(repoRoot, 'eval', 'results.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`eval: ${passed}/${results.length} 通过`);
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`  ✗ id=${r.id} [${r.layer}] ${r.scenario}`);
    for (const f of r.failures) console.log(`      - ${f}`);
  }
  for (const p of [...problems, ...matrixProblems]) console.log(`  ✗ ${p}`);
  process.exitCode = passed === results.length && problems.length === 0 && matrixProblems.length === 0 ? 0 : 1;
```

- [ ] **步骤 5：运行矩阵自检通过（绿）**

运行：`npx tsx eval/runner.ts --self-check`
预期：`{"selfCheck":true}` 与 `{"selfCheckMatrix":true}`，退出 0。

- [ ] **步骤 6：升级 mappings.json 至 v2**

顶层改为（`description` 更新，新增 `matrix`）：

```json
{
  "version": 2,
  "description": "60 条评估提示词 → 技能资产锚点映射。断言三层：L1 触发词断言（正向 enable）、L1N 负向触发断言（skip/ask，锚定 activation-guide 类别节 + notContains 守卫）、L2 机制存在性断言。顶层 matrix 为覆盖矩阵声明，由 runner coverageMatrix 五项校验强制。",
  "matrix": {
    "routeTotals": { "enable": 12, "ask": 8, "skip": 22 },
    "minPerCategory": 2,
    "guidePath": "w-model-dev/references/activation-guide.md"
  },
  "mappings": [
    /* 既有 25 条原样保留（id 1-25）；紧随本步骤修改 id 3/6/7 三条，再按步骤 7 在数组末尾追加 id 26-60 */
  ]
}
```

对既有 3 条追加字段与断言（其余原样）：

```json
{ "id": 3, "category": "A1", "route": "ask",
  "assertions": [
    { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
    { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "确认前不初始化" },
    { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A1 完整流程未提 W 模型" },
    { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "从需求开始走完整流程" }
  ] }
```
```json
{ "id": 6, "layer": "L1N", "category": "N2", "route": "skip",
  "assertions": [
    { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "不启用" },
    { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N2 样式与小 bug 修复" },
    { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "src/auth.ts 中的登录错误" }
  ] }
```
```json
{ "id": 7, "layer": "L1N", "category": "N3", "route": "skip",
  "assertions": [
    { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "不启用" },
    { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N3 纯问答与技术解释" },
    { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "OAuth2 授权码模式" }
  ] }
```

- [ ] **步骤 7：追加 35 条新映射（id 26-60）**

在 mappings 数组末尾（id 25 之后）追加。负向条目模式：类别节锚点 + 该条 prompt 片段锚点；每类首条另加两组守卫。歧义条目模式：SKILL.md"先询问" + 类别节锚点 + 片段锚点。正向条目模式：SKILL.md 信号锚点。完整 JSON：

```json
[
  { "id": 26, "scenario": "反误触发 N1：一次性脚本批量重命名", "layer": "L1N", "category": "N1", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N1 一次性数据/文件脚本" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "批量重命名当前目录下的图片文件" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "一次性数据/文件脚本", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "批量重命名" }
    ], "evidence": { "type": "assertion" } },
  { "id": 27, "scenario": "反误触发 N1：CSV 清洗转换", "layer": "L1N", "category": "N1", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N1 一次性数据/文件脚本" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "CSV 里的空行清掉" }
    ], "evidence": { "type": "assertion" } },
  { "id": 28, "scenario": "反误触发 N2：CSS 样式调整", "layer": "L1N", "category": "N2", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N2 样式与小 bug 修复" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "这个按钮没居中" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "样式与小 bug 修复", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "错别字" }
    ], "evidence": { "type": "assertion" } },
  { "id": 29, "scenario": "反误触发 N2：文案错别字修正", "layer": "L1N", "category": "N2", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N2 样式与小 bug 修复" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "页面上有个错别字" }
    ], "evidence": { "type": "assertion" } },
  { "id": 30, "scenario": "反误触发 N3：概念解释（事件循环）", "layer": "L1N", "category": "N3", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N3 纯问答与技术解释" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "JavaScript 的事件循环" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "纯问答与技术解释", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "事件循环" }
    ], "evidence": { "type": "assertion" } },
  { "id": 31, "scenario": "反误触发 N3：原理对比问答（WAL vs binlog）", "layer": "L1N", "category": "N3", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N3 纯问答与技术解释" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "WAL 日志" }
    ], "evidence": { "type": "assertion" } },
  { "id": 32, "scenario": "反误触发 N4：tsconfig 与依赖安装", "layer": "L1N", "category": "N4", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N4 环境与配置变更" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "tsconfig 的 strict 打开" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "环境与配置变更", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "GitHub Actions" }
    ], "evidence": { "type": "assertion" } },
  { "id": 33, "scenario": "反误触发 N4：CI workflow 新增", "layer": "L1N", "category": "N4", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N4 环境与配置变更" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "跑 lint 的 workflow" }
    ], "evidence": { "type": "assertion" } },
  { "id": 34, "scenario": "反误触发 N5：笔记整理成 README", "layer": "L1N", "category": "N5", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N5 纯文档撰写与排版" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "调研笔记整理成一篇 README" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "纯文档撰写与排版", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "中英文排版" }
    ], "evidence": { "type": "assertion" } },
  { "id": 35, "scenario": "反误触发 N5：中英文排版规范", "layer": "L1N", "category": "N5", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N5 纯文档撰写与排版" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "把空格规范一下" }
    ], "evidence": { "type": "assertion" } },
  { "id": 36, "scenario": "反误触发 N6：SQL 数据查询", "layer": "L1N", "category": "N6", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N6 数据查询与正则提取" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "下单超过 10 单的用户列表" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "数据查询与正则提取", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "nginx 访问日志" }
    ], "evidence": { "type": "assertion" } },
  { "id": 37, "scenario": "反误触发 N6：日志正则提取", "layer": "L1N", "category": "N6", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N6 数据查询与正则提取" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "返回 5xx 的 IP" }
    ], "evidence": { "type": "assertion" } },
  { "id": 38, "scenario": "反误触发 N7：框架版本升级", "layer": "L1N", "category": "N7", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N7 依赖升级与小重构" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "React 从 18 升级到 19" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "依赖升级与小重构", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "升级到 19" }
    ], "evidence": { "type": "assertion" } },
  { "id": 39, "scenario": "反误触发 N7：行为不变的小重构", "layer": "L1N", "category": "N7", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N7 依赖升级与小重构" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "800 行的工具函数文件" }
    ], "evidence": { "type": "assertion" } },
  { "id": 40, "scenario": "反误触发 N8：工作周报撰写", "layer": "L1N", "category": "N8", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N8 非软件开发任务" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "本周的工作周报" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "非软件开发任务", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "工作周报" }
    ], "evidence": { "type": "assertion" } },
  { "id": 41, "scenario": "反误触发 N8：技术方案 PPT", "layer": "L1N", "category": "N8", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N8 非软件开发任务" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "做成 10 页 PPT" }
    ], "evidence": { "type": "assertion" } },
  { "id": 42, "scenario": "反误触发 N9：单点函数修改指令", "layer": "L1N", "category": "N9", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N9 单点执行指令" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "返回类型改成 Promise" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "单点执行指令", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "别走流程了" }
    ], "evidence": { "type": "assertion" } },
  { "id": 43, "scenario": "反误触发 N9：常量提取配置", "layer": "L1N", "category": "N9", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N9 单点执行指令" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "硬编码常量提到配置文件" }
    ], "evidence": { "type": "assertion" } },
  { "id": 44, "scenario": "反误触发 N10：格式化工具执行", "layer": "L1N", "category": "N10", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N10 已由其他工具接管的请求" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "prettier 把整个仓库的格式" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "已由其他工具接管的请求", "scopeAnchor": "立即启用" },
      { "type": "notContains", "target": "w-model-dev/SKILL.md", "substring": "跑一下 prettier" }
    ], "evidence": { "type": "assertion" } },
  { "id": 45, "scenario": "反误触发 N10：构建执行", "layer": "L1N", "category": "N10", "route": "skip",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## N10 已由其他工具接管的请求" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "npm run build，把产物路径发我" }
    ], "evidence": { "type": "assertion" } },
  { "id": 46, "scenario": "歧义 A1：新模块全流程", "layer": "L1", "category": "A1", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A1 完整流程未提 W 模型" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "从需求梳理到上线全流程走一遍" }
    ], "evidence": { "type": "assertion" } },
  { "id": 47, "scenario": "歧义 A1：需求与测试用例先行", "layer": "L1", "category": "A1", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A1 完整流程未提 W 模型" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "需求和测试用例都定清楚" }
    ], "evidence": { "type": "assertion" } },
  { "id": 48, "scenario": "歧义 A2：大型新项目（审批系统）", "layer": "L1", "category": "A2", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A2 大型新项目仅说\"开始做\"" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "内部审批系统" }
    ], "evidence": { "type": "assertion" } },
  { "id": 49, "scenario": "歧义 A2：数据平台项目规划", "layer": "L1", "category": "A2", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A2 大型新项目仅说\"开始做\"" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "数据平台的项目" }
    ], "evidence": { "type": "assertion" } },
  { "id": 50, "scenario": "歧义 A2：老系统重写分期", "layer": "L1", "category": "A2", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A2 大型新项目仅说\"开始做\"" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "把老系统重写" }
    ], "evidence": { "type": "assertion" } },
  { "id": 51, "scenario": "歧义 A3：模糊合规表述（正规一点）", "layer": "L1", "category": "A3", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A3 模糊合规表述" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "做得正规一点" }
    ], "evidence": { "type": "assertion" } },
  { "id": 52, "scenario": "歧义 A3：模糊合规表述（最规范流程）", "layer": "L1", "category": "A3", "route": "ask",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "## A3 模糊合规表述" },
      { "type": "contains", "target": "w-model-dev/references/activation-guide.md", "substring": "最规范的开发流程" }
    ], "evidence": { "type": "assertion" } },
  { "id": 53, "scenario": "正向变体：中文 W 模型需求分析", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "W 模型" }
    ], "evidence": { "type": "assertion" } },
  { "id": 54, "scenario": "正向变体：/wm status 只读命令", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "/wm status" }
    ], "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/wm-status.ts" } },
  { "id": 55, "scenario": "正向变体：英文并行测试设计与追溯", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "W-model" }
    ], "evidence": { "type": "assertion" } },
  { "id": 56, "scenario": "正向变体：按阶段门续推进", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "阶段门" }
    ], "evidence": { "type": "assertion" } },
  { "id": 57, "scenario": "正向变体：高可靠性 TLA+ 信号", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "TLA+" }
    ], "evidence": { "type": "assertion" } },
  { "id": 58, "scenario": "正向变体：返工根因定位", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "根因" }
    ], "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-rootcause-report.ts" } },
  { "id": 59, "scenario": "正向变体：brownfield RTM 补齐", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "RTM" }
    ], "evidence": { "type": "assertion" } },
  { "id": 60, "scenario": "正向变体：英文阶段门评审", "layer": "L1", "route": "enable",
    "assertions": [
      { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "stage gates" }
    ], "evidence": { "type": "assertion" } }
]
```

注意：A2 节标题含英文引号 `仅说"开始做"`，JSON 内以 `\"` 转义；guide 文件中的标题必须与该锚点逐字一致（任务 4 已按 `## A2 大型新项目仅说"开始做"` 写入）。

- [ ] **步骤 8：运行全量 eval 验证通过（绿）**

运行：`npm run eval`
预期：`eval: 60/60 通过`，无 coverageProblems / matrixProblems，退出 0；`eval/results.json` 含 `matrixProblems: []`。

- [ ] **步骤 9：破坏性验证（guide 漏改必须被抓到）**

```bash
sed -i 's/  - id=26: 帮我写一个 Python 脚本批量重命名当前目录下的图片文件//' w-model-dev/references/activation-guide.md
npx tsx eval/runner.ts > /dev/null 2>&1; echo "exit=$?"
```
预期：`exit=1`，且失败信息含 `类别 N1：guide 示例 1 条 ≠ 语料 2 条` 或 id=26 断言失败。随后恢复：

```bash
git checkout -- w-model-dev/references/activation-guide.md
npx tsx eval/runner.ts > /dev/null 2>&1; echo "exit=$?"   # 预期 exit=0
```

- [ ] **步骤 10：Commit**

```bash
git add eval/mappings.json eval/runner.ts
git commit -m "feat(eval): mappings v2 with matrix declaration and coverageMatrix wiring (campaign step 5)"
```

---

### 任务 6：SKILL.md 触发面改造 + 破坏性验证

**文件：**
- 修改：`w-model-dev/SKILL.md`（frontmatter description、触发决策表第 3 行）

- [ ] **步骤 1：frontmatter 反例句**

在 `description: >-` 块的末尾（`development and testing in parallel. When the user only asks for an end-to-end or complete development process without these signals, ask whether to use the W-model first.` 之后）追加一句（保持 YAML 折叠块缩进）：

```
Do NOT use for one-off scripts, styling fixes or small bug fixes, pure explanations, config changes, document writing, data queries, dependency upgrades, non-development tasks, or single-point edit instructions — see references/activation-guide.md.
```

- [ ] **步骤 2：触发决策表第 3 行反例速览**

把第 3 行：

```markdown
| 普通需求、设计、编码、测试、修复或技术解释 | 不启用，按普通任务处理 |
```

替换为：

```markdown
| 普通需求、设计、编码、测试、修复或技术解释 | 不启用，按普通任务处理。反例十类速览：一次性数据/文件脚本、样式与小 bug 修复、纯问答与技术解释、环境与配置变更、纯文档撰写与排版、数据查询与正则提取、依赖升级与小重构、非软件开发任务、单点执行指令、已由其他工具接管——判定细则与边界见 [references/activation-guide.md](references/activation-guide.md) |
```

- [ ] **步骤 3：回归验证**

运行：`npm run eval`
预期：60/60 通过退出 0（类别名出现在"不启用"行不触碰任何守卫；守卫锚定的是"立即启用"行）。

- [ ] **步骤 4：Commit（破坏性验证前必须先提交，恢复才有正确基线）**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(skill): add anti-scenario signal to trigger surface (campaign step 6)"
```

- [ ] **步骤 5：破坏性验证（反向污染必须被抓到）**

```bash
sed -i 's/或明确要求 RTM、阶段门\/质量门、开发与测试并行 | 立即启用 |/或明确要求 RTM、阶段门\/质量门、开发与测试并行、一次性数据\/文件脚本 | 立即启用 |/' w-model-dev/SKILL.md
npx tsx eval/runner.ts > /dev/null 2>&1; echo "exit=$?"
```
预期：`exit=1`，失败信息含 `锚定「立即启用」的行包含不该出现的「一次性数据/文件脚本」`。恢复到已提交态并复验：

```bash
git checkout -- w-model-dev/SKILL.md
npx tsx eval/runner.ts > /dev/null 2>&1; echo "exit=$?"   # 预期 exit=0
```

---

### 任务 7：L0 复用指南（INSTALL.md + adoption-guide + 依赖审计）

**文件：**
- 修改：`docs/INSTALL.md`、`docs/adoption-guide.md`

- [ ] **步骤 1：依赖审计（确认初判清单）**

对初判"可单独拷贝"的 9 项逐一验证无编排/状态/门禁耦合：

```bash
for f in root-cause-locator iceberg-sweep-guide agent-personas conventions estimation-guide context-management-guide coding-quality toolbox; do
  echo "== $f =="
  grep -c "check-\|\.w-model/\|wm-write\|phase-[1-8]" "w-model-dev/references/$f.md" || true
done
grep -c "check-\|\.w-model/\|wm-write\|phase-[1-8]" w-model-dev/subagent/*.md | grep -v ":0" || echo "subagent/ 全部无耦合"
```

判定规则：命中数 > 0 的文件，逐处确认是否为"可选引用"（如"产出物可被 check-* 校验"）还是"硬依赖"（离开编排无法执行）。硬依赖者移入"不可单独拷贝"清单并在该节注明原因；可选引用者保留但加注。审计结论回填步骤 2 的清单（默认按下列内容写入，仅当审计发现硬依赖时调整对应行）。

- [ ] **步骤 2：INSTALL.md 新增「子能力单独复用」节**

在 `docs/INSTALL.md` 安装章节之后新增：

```markdown
## 子能力单独复用（L0 子集拷贝）

W-Model 的方法论参考类文件可脱离编排单独拷贝到其他 Agent 的 skills 目录复用。权威分级定义见 `docs/skill-design-document_SSoT.md` §3.6。

**可单独拷贝**（方法论自包含，不依赖编排/状态/门禁脚本）：

| 文件 | 可复用能力 |
| --- | --- |
| `references/root-cause-locator.md` | 根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯） |
| `references/iceberg-sweep-guide.md` | 隐藏问题深挖扫掠方法 |
| `references/agent-personas.md` + `subagent/`（28 个人格） | 评审角色提示词与多角度分析 |
| `references/conventions.md` | 术语表 / 格式 / 目录约定 |
| `references/estimation-guide.md` | 工作量估算方法 |
| `references/context-management-guide.md` | 上下文分层与修剪纪律 |
| `references/coding-quality.md` | 设计模式 / 重构 / 坏味道 |
| `references/toolbox.md` | 工具箱 |
| `references/activation-guide.md` | 触发边界判定（作为其他技能编写反例登记册的参考模板） |

**不可单独拷贝**（依赖编排状态机 / `.w-model/` 状态 / 门禁脚本，离开技能整体无意义）：`references/phase-N-*.md`、`subagent-delegation.md`、`signature-chain-guide.md`、`rtm-guide.md`、`graph-guide.md`、`hard-constraints.md`。

**版本对齐义务**：拷贝时记录上游 `SKILL.md` 的 version；上游更新后须手工对齐（技能包不做自动同步）；单独拷贝的子能力不带门禁脚本语义，相关校验不生效。
```

- [ ] **步骤 3：adoption-guide.md 交叉链接**

在 `docs/adoption-guide.md` 合适段落（Greenfield/Brownfield 介绍之后）追加一行：

```markdown
> 只需要部分方法论（如根因分析、评审人格）而不采用完整流程时，见 [INSTALL.md「子能力单独复用」](./INSTALL.md#子能力单独复用l0-子集拷贝)。
```

- [ ] **步骤 4：链接回归**

运行：`npm run audit:l0-links`
预期：退出 0 或仅报已知的 L0/L1 分层边界项（不新增失败）。

- [ ] **步骤 5：Commit**

```bash
git add docs/INSTALL.md docs/adoption-guide.md
git commit -m "docs(install): add L0 sub-capability standalone reuse guide (campaign step 7)"
```

---

### 任务 8：活体文档同步与终验（eval/README、AGENTS、CHANGELOG、TSV、prepush）

**文件：**
- 修改：`eval/README.md`、`AGENTS.md`、`CHANGELOG.md`、`eval/w-model-dev-results.tsv`

- [ ] **步骤 1：eval/README.md 修正**

把开头"本目录存放 W-Model 技能（`w-model-dev/`）的评估产物，共两个文件："及其后两行文件表替换为：

```markdown
本目录存放 W-Model 技能（`w-model-dev/`）的评估资产与记录：

| 文件 | 用途 |
| --- | --- |
| `w-model-dev-test-prompts.json` | 60 条测试提示词（id 1-60），含 category（N1-N10/A1-A3）与 route（enable/ask/skip）字段，作为技能回归测试与外部评估的标准化输入 |
| `mappings.json` | 60 条提示词 → 技能资产锚点映射（version 2），含顶层 matrix 覆盖矩阵声明 |
| `runner.ts` | 断言引擎（`npm run eval`）：L1/L1N/L2 三层断言 + notContains 守卫 + coverageMatrix 五项校验 |
| `results.json` | 最近一次全量运行结果（含 matrixProblems） |
| `w-model-dev-results.tsv` | 评估结果表（TSV，逐轮记录） |
| `e2e/` | e2e 基线与终值记录（`e2e/demo/` 为 gitignored 瞬态工作区） |
```

并在文件末尾追加一节：

```markdown
## 3. 覆盖矩阵（coverageMatrix）

`mappings.json` 顶层 `matrix` 声明 `routeTotals` / `minPerCategory` / `guidePath`；`npm run eval` 据此校验：① 语料与映射 route/category 对齐 ② 各 route 总数符合声明 ③ 每类别条数 ≥ 下限 ④ `activation-guide.md` 每类别节示例数 == 该类语料条数（双向锚定，防双份维护漏改）⑤ 每负向类别 ≥1 组「立即启用」行 notContains 守卫。任一不符即 exit 1。
```

- [ ] **步骤 2：AGENTS.md 同步**

`AGENTS.md` §2 目录速查表 `w-model-dev/references/` 行：在 references 文件列举中「context-management-guide」之后插入「activation-guide（触发边界与反例登记册）」词条；`eval/` 行的描述把「`eval/mappings.json` 25 条提示词→资产锚点」改为「`eval/mappings.json` 60 条提示词→资产锚点（v2，含 matrix 覆盖矩阵）」。全文 grep `25 条` 确认无其他需同步处（`npm run eval` 相关描述若提 25 一并改 60）。

- [ ] **步骤 3：CHANGELOG 条目**

读 `CHANGELOG.md` 顶部确定当前版本节格式，在最新未发布节按既有格式追加：

```markdown
- **触发边界可度量性 campaign**：eval 语料库 25→60 条（负向 22/歧义 8/正向 12，L1N 负向层 + notContains 守卫 + coverageMatrix 五项校验）；新增 `references/activation-guide.md`（第 41 份，13 类反例登记册，与语料双向锚定）；SKILL.md 触发面增反例信号（frontmatter 一句 + 不启用行十类速览）；INSTALL.md 增「子能力单独复用」L0 分级指南；SSoT 新增 §3.6 权威定义。
```

- [ ] **步骤 4：TSV 轮次行**

```bash
printf '%s\t%s\tw-model-dev\t-\t-\tkeep\t触发边界/反例登记册\t语料25→60;负向22条L1N;notContains守卫+coverageMatrix;activation-guide第41份reference\t dry_run\n' "$(date +%Y-%m-%dT%H:%M)" "$(git rev-parse --short HEAD)" >> eval/w-model-dev-results.tsv
```

（注意去掉 `dry_run` 前的多余空格——9 列 tab 分隔；该行 old/new_score 记 `-`，因本轮无外部 judge 盲评，语义在 eval/README.md 本轮次说明中已覆盖。）

- [ ] **步骤 5：终验（全部门禁）**

```bash
npx tsx eval/runner.ts --self-check   # 预期 {"selfCheck":true} {"selfCheckMatrix":true} exit 0
npm run eval                          # 预期 60/60 exit 0
npm run self-test                     # 预期 262 条全过 exit 0
npm run audit:l0-links                # 预期无新增失败
npm run prepush                       # Git Bash；预期 17 项全过 exit 0
```

- [ ] **步骤 6：Commit**

```bash
git add eval/README.md AGENTS.md CHANGELOG.md eval/w-model-dev-results.tsv
git commit -m "docs: sync living docs and record eval round for trigger-boundary campaign (step 8)"
```
