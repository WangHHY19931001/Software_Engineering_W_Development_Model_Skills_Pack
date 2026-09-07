# 触发边界快追（fast-follow）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 收掉最终审查的 4 项快追——① `npm run eval` 进 pre-push 第 18 项（含项数门禁与路径过滤同步）；② 10 条「不启用」行 scopeAnchor contains 断言钉住常驻面速览成员资格；③ selfCheckMatrix 假 fixture 覆盖校验①③④⑤；④ runner 三层术语统一 + eval/README「共 42 条」消歧。

**架构：** 无引擎行为变更（runner 判定逻辑不动，只扩自检 fixtures 与注释）；② 用现有断言能力表达（零引擎改动）；① 改 `EXPECTED.prePushCount` 常量 + pre-push 编号块/声明文本/路径过滤 + 全部计数消费方。

**技术栈：** 现有工具链，零新依赖。基线：`da7935b`（主 campaign HEAD）。版本保持 42.2.1 不 bump。

**规格来源：** 主 campaign 最终审查报告（会话记录）+ 账本 Fast-follow backlog；主计划 `docs/superpowers/plans/2026-09-07-trigger-boundary-campaign.md`。

**全局约束（对全部任务生效）：**
- exit code 语义不变；不新增 devDep；版本不 bump。
- CHANGELOG 历史小节（行 19-59、221、318-331 等含「17 项」的历史记录）**一律不改**——只改活体文档的现时性陈述。
- 已裁定「可保留」的 Minor（引号风格、措辞并行性等）不在本计划范围。
- 术语 canonical 口径（任务 1 定稿，全仓一致）：**L1 = 触发词断言（正向 enable 与歧义 ask）；L1N = 负向触发断言（skip 反例）；L2 = 机制存在性断言；行为证据映射 = 每条映射的 evidence 字段（不是层）**。

---

### 任务 1：eval 强化（不启用锚点 + selfCheckMatrix 负例 + 术语统一）

**文件：**
- 修改：`eval/mappings.json`、`eval/runner.ts`、`eval/README.md`

- [ ] **步骤 1：mappings.json 增 10 条「不启用」行锚点断言**

对守卫承载条目 **26/28/30/32/34/36/38/40/42/44**（类别依次 N1-N10），在每组 notContains 守卫之后、`evidence` 之前各追加一条：

```json
{ "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "<规范类名>", "scopeAnchor": "不启用" }
```

规范类名逐条：26=一次性数据/文件脚本；28=样式与小 bug 修复；30=纯问答与技术解释；32=环境与配置变更；34=纯文档撰写与排版；36=数据查询与正则提取；38=依赖升级与小重构；40=非软件开发任务；42=单点执行指令；44=已由其他工具接管的请求。

（安全性前提：`w-model-dev/SKILL.md` 全文仅行 28 含「不启用」，十类名都在该行——`grep -n "不启用" w-model-dev/SKILL.md` 先行确认。）

- [ ] **步骤 2：runner.ts 头注释术语统一**

把 `eval/runner.ts:5-9` 的三层描述替换为：

```
 * 断言分层（设计见 docs/superpowers/specs/2026-08-28-w-model-dev-3dim-optimization-design.md §2.2 与
 * docs/superpowers/specs/2026-09-07-trigger-boundary-campaign-design.md §5）：
 *   L1 触发词断言 —— 正向 enable 与歧义 ask 的触发契约在 SKILL.md / activation-guide.md 中可命中；
 *   L1N 负向触发断言 —— skip 反例：activation-guide 类别节锚点 + notContains 守卫（「立即启用」行域 + 文件域）+ 「不启用」行锚点；
 *   L2 机制存在性断言 —— expected 引用的机制在「脚本 + 逻辑常量 + references 锚点」有实体；
 *   行为证据映射 —— 每条映射的 evidence 字段指向已存在的 self-test fixture / 测试文件 / 既有断言。
```

- [ ] **步骤 3：mappings.json description 术语对齐**

description 中 `L1 触发词断言（正向 enable）` → `L1 触发词断言（正向 enable 与歧义 ask）`；`L1N 负向触发断言（skip/ask，锚定 activation-guide 类别节 + notContains 守卫）` → `L1N 负向触发断言（skip 反例，锚定 activation-guide 类别节 + notContains 守卫 + 「不启用」行锚点）`；`断言三层：` → `断言分层：`；句末追加 `每条映射另以 evidence 字段做行为证据映射。`

- [ ] **步骤 4：eval/README.md:39「共 42 条」消歧**

把 `category`（负向 N1-N10 十类 / 歧义 A1-A3 三类，共 42 条）与 `route`（`enable` 立即启用 / `ask` 先询问、确认前不初始化 / `skip` 不启用）字段 改为：

`category`（负向 N1-N10 十类 22 条 / 歧义 A1-A3 三类 8 条，共 30 条）与 `route`（`enable` 立即启用 12 条 / `ask` 先询问、确认前不初始化 8 条 / `skip` 不启用 22 条，共 42 条）字段——带增补字段者合计 42 条（30 条类目化 + 12 条正向仅 route）

（其后「正向语料 12 条仅含 route=enable，L2 …18 条不带」子句保留。）

- [ ] **步骤 5：selfCheckMatrix 负例扩展（校验①③④⑤）**

把 `eval/runner.ts` 的 `selfCheckMatrix` 重构为多 case 形式（保持既有 ② routeTotals 负例，新增①③④⑤各一负例；输出键名不变）：

```ts
function selfCheckMatrix(): boolean {
  const mkIo = (guide: string): FileSystemAdapter => ({
    read: (p: string) => {
      if (p === 'guide.md') return guide;
      throw new Error(`意外读取：${p}`);
    },
    exists: (p: string) => p === 'guide.md',
  });
  const guideTwo = ['## N1 测试类别', '- id=1: 示例一', '- id=2: 示例二'].join('\n');
  const guideOne = ['## N1 测试类别', '- id=1: 示例一'].join('\n');
  const guard: Assertion = { type: 'notContains', target: 's.md', substring: '测试类别', scopeAnchor: '立即启用' };
  const corpusA: CorpusEntry[] = [
    { id: 1, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
    { id: 2, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
  ];
  const corpusOne: CorpusEntry[] = [
    { id: 1, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
  ];
  const guarded: Mapping = { id: 1, category: 'N1', route: 'skip', layer: 'L1N', scenario: '', assertions: [guard], evidence: { type: 'assertion' } };
  const unguarded: Mapping = { id: 1, category: 'N1', route: 'skip', layer: 'L1N', scenario: '', assertions: [], evidence: { type: 'assertion' } };
  const misrouted: Mapping = { ...guarded, route: 'enable' };
  const declSkip2: MatrixDeclaration = { routeTotals: { enable: 0, ask: 0, skip: 2 }, minPerCategory: 2, guidePath: 'guide.md' };
  const declSkip1: MatrixDeclaration = { routeTotals: { enable: 0, ask: 0, skip: 1 }, minPerCategory: 2, guidePath: 'guide.md' };

  const results = {
    ok: coverageMatrix(corpusA, [guarded, unguarded], declSkip2, mkIo(guideTwo)).length === 0,
    badTotals: coverageMatrix(corpusA, [guarded, unguarded], { ...declSkip2, routeTotals: { enable: 0, ask: 0, skip: 3 } }, mkIo(guideTwo)).length > 0,
    badRouteAlign: coverageMatrix(corpusA, [misrouted, unguarded], declSkip2, mkIo(guideTwo)).some((p) => p.includes('route 不一致')),
    badMinPerCat: coverageMatrix(corpusOne, [guarded], declSkip1, mkIo(guideOne)).some((p) => p.includes('下限')),
    badGuideCount: coverageMatrix(corpusA, [guarded, unguarded], declSkip2, mkIo(guideOne)).some((p) => p.includes('≠ 语料')),
    badMissingGuard: coverageMatrix(corpusA, [unguarded, unguarded], declSkip2, mkIo(guideTwo)).some((p) => p.includes('notContains 守卫')),
  };
  const ok = Object.values(results).every(Boolean);
  console.log(JSON.stringify({ selfCheckMatrix: ok }));
  return ok;
}
```

（`main()` 的 `--self-check` 接线不动；若项目 tsconfig 对 `Object.values` 无碍则照抄。）

- [ ] **步骤 6：验证（绿 + 破坏性）**

```bash
npx tsx eval/runner.ts --self-check   # 预期 {"selfCheck":true} {"selfCheckMatrix":true} exit 0
npm run eval                          # 预期 60/60 exit 0
# 破坏性验证：删 SKILL.md:28 的「非软件开发任务」一名 → eval 必须红（id=40 不启用锚点断言失败）→ 恢复 → 绿
```

- [ ] **步骤 7：Commit**

```bash
git add eval/mappings.json eval/runner.ts eval/README.md
git commit -m "feat(eval): pin trigger-row membership, matrix negative fixtures, unify assertion-layer terms"
```

---

### 任务 2：pre-push 第 18 项接线（eval 进本地 CI）

**文件：**
- 修改：`w-model-dev/scripts/logic/docs-consistency-logic.ts`、`.githooks/pre-push`、`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`、`README.md`、`CONTRIBUTING.md`、`AGENTS.md`、`.github/PULL_REQUEST_TEMPLATE.md`、`docs/skill-design-document_SSoT.md`

- [ ] **步骤 1：常量与门禁本体**

1. `w-model-dev/scripts/logic/docs-consistency-logic.ts:220`：`prePushCount: 17` → `prePushCount: 18`（同函数 doc 注释中「#1..#17」等字样同步 18）。
2. `.githooks/pre-push:293`：`# 全部门禁共 17 项检查（第 13 项 npm audit 为阻断项），退出码必须全部符合预期才放行。` → `18 项检查`。
3. `.githooks/pre-push` 第 17 项块之后、`log "全部门禁通过…"` 之前追加：

```bash
# 18. eval 语料断言：60 条触发边界语料 + coverageMatrix 五项校验全绿（触发边界 campaign 快追；
#     断言引擎 --self-check 由 eval/ 自身维护，此处跑全量断言）
run_expect "eval 语料断言与覆盖矩阵全绿" 0 npx tsx eval/runner.ts || exit 1
```

- [ ] **步骤 2：路径过滤纳入 eval/**

1. `files_need_gate()` case 块（`config/*|scripts/*|.githooks/*` 行后）加：`eval/*)                                  return 0 ;;`
2. 头注释（行 12-17）：`其余（eval/、纯目录等）放行` → `其余（纯目录等非内容变更）放行`；触发路径清单增补一行 `#   - eval/**：评估资产（语料 / mappings / runner）——触发边界断言是活体门禁（第 18 项）`。

- [ ] **步骤 3：受影响测试同步**

`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`：
- 行 60-63 与 981 附近的合法 fixture（连续 #1..#17 块 + 「17 项检查」声明）→ 18（若由 `EXPECTED.prePushCount` 派生则自动适配，确认即可）；
- 行 972 伪造 fixture 与 2036 的 `prTemplate: '- [ ] npm run prepush 17 项通过'` → 同步 18（伪造用例的断言若锚定具体消息含「17」一并改）；
- 行 3013 注释「守住与 17 项门禁并列的触发语义防线」→「与 18 项门禁并列」；
- grep `files_need_gate|eval/\*` 确认是否有钉死路径模式清单的源级断言，若有则把 `eval/*` 纳入期望模式。

- [ ] **步骤 4：活体文档计数同步（17 → 18）**

- `README.md:31`：`推送前门禁（本地 CI，17 项）` → `18 项`；`README.md:209`：`本地 CI：17 项门禁，git push 时自动执行` → `本地 CI：18 项门禁（含 eval 语料断言），git push 时自动执行`。
- `CONTRIBUTING.md:90`：`自动跑 17 项检查` → `18 项检查`；门禁表追加行 `| 18 | npx tsx eval/runner.ts（触发边界语料断言 + coverageMatrix 五项校验） | 0 |`；`:215` 与 `:233` 的 `17 项` → `18 项`。
- `AGENTS.md:51`：`自动跑 17 项门禁（… + tsc 类型检查）` → `自动跑 18 项门禁（… + tsc 类型检查 + eval 语料断言）`，同单元格触发路径枚举补 `eval/**`；`AGENTS.md:92`：`17 项门禁检查` → `18 项门禁检查`。
- `.github/PULL_REQUEST_TEMPLATE.md:13`：`npm run prepush` 17 项通过 → 18 项通过。

- [ ] **步骤 5：SSoT 先行同步**

- `docs/skill-design-document_SSoT.md:1219` 路径命中清单：`config/*` / `scripts/*` / `.githooks/*` 之后插入 `eval/*`（评估资产：语料 / mappings / runner，对应 pre-push 第 18 项）。
- `docs/skill-design-document_SSoT.md` §3.6「三层资产契约」段末追加一句：`npm run eval 已纳入 pre-push 第 18 项门禁（触发边界快追，2026-09-07）。`

- [ ] **步骤 6：验证**

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts   # 预期全过
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts       # 预期全过（路径过滤行为级）
npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts   # 预期 exit 0（编号块 #1..#18 连续 + 「18 项检查」声明 + PR 模板计数）
npm run audit:l0-links && npm run eval && npx tsx eval/runner.ts --self-check   # 预期全绿
```

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/docs-consistency-logic.ts .githooks/pre-push w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts README.md CONTRIBUTING.md AGENTS.md .github/PULL_REQUEST_TEMPLATE.md docs/skill-design-document_SSoT.md
git commit -m "feat(hooks): add eval corpus assertion as pre-push gate #18 with path filter and count sync"
```

---

### 任务 3：治理收口与终验（CHANGELOG + TSV + prepush 全绿）

**文件：**
- 修改：`CHANGELOG.md`、`eval/w-model-dev-results.tsv`

- [ ] **步骤 1：CHANGELOG 快追小节**

在「触发边界可度量性 campaign」小节之后按兄弟体例新增：

```markdown
### 触发边界快追（trigger-boundary-fastfollow，2026-09-07）

- **eval 纳入 pre-push 第 18 项门禁**：路径过滤纳入 `eval/**`（此前 eval/ 变更不触发本地 CI），`EXPECTED.prePushCount` 17→18，编号块/声明文本/CONTRIBUTING 门禁表/README/AGENTS/PR 模板计数全量同步。
- **常驻面速览成员资格钉死**：10 条 `scopeAnchor:"不启用"` contains 断言将十类反例名钉在 SKILL.md「不启用」行——速览删名/改名即 eval 红。
- **selfCheckMatrix 负例扩展**：coverageMatrix 校验①③④⑤各增已知假 fixture（route 失配 / 类别下限 / guide 计数 / 缺守卫），自检从单一 routeTotals 负例扩到五项全覆盖。
- **术语统一**：L1（正向 enable 与歧义 ask）/ L1N（skip 反例）/ L2（机制存在性）口径在 runner 头注释、mappings description、eval/README 三处归一，evidence 明确为字段而非层；eval/README「共 42 条」消歧（category 30 / route 42）。
```

末尾按兄弟小节体例补指针与不 bump 句（规格/计划指针指向本快追计划文件；`版本保持 42.2.1，不 bump。`）。

- [ ] **步骤 2：TSV 轮次行**

`eval/w-model-dev-results.tsv` 追加一行（9 列 tab 分隔，无前导空格；timestamp 用真实当前时间，commit 列用任务 2 的短 SHA）：

```
<ISO 分钟级>	<task2 短sha>	w-model-dev	-	-	keep	触发边界快追	pre-push第18项eval;不启用行锚点10条;selfCheckMatrix负例×5;术语L1/L1N/L2归一	dry_run
```

- [ ] **步骤 3：终验**

```bash
npx tsx eval/runner.ts --self-check   # 双 true exit 0
npm run eval                          # 60/60 exit 0
npm run self-test                     # 262 条 exit 0
npm run prepush -- --force            # Git Bash；预期 18 项全绿 exit 0
```

- [ ] **步骤 4：Commit**

```bash
git add CHANGELOG.md eval/w-model-dev-results.tsv
git commit -m "docs: record trigger-boundary fastfollow round (pre-push #18 eval gate)"
```
