# 第 28 轮技能包修正实现计划（need_fix + 全量 code-review）

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。规格见 `docs/superpowers/specs/2026-07-31-round28-script-bugfix-design.md`。

**目标：** 修复 plan-chunks.ts（need_fix.md）两处 bug + code-review 发现的 ~66 项脚本缺陷，版本 26.0.0 → 27.0.0。

**架构：** 按 6 个脚本域分组修正（G-A plan-chunks / G-B gate-verifier-security / G-C graph-coverage-exemption / G-D TLA-BDD-code / G-E 状态-日志-签名 / G-F opsx-codegraph），每组域内即时回归，全部完成后全量回归 + 文档版本同步。实施遵循 W-model 纪律：编排者只读，每组由 implementation 子代理执行。

**技术栈：** TypeScript（strict，`noUncheckedIndexedAccess`）、tsx runtime、vitest（单测）、self-test.ts（samples 驱动回归基线）、ajv schema 校验。

**关键约束：**
- 退出码约定：`0=通过 / 1=校验失败 / 2=输入错误`
- 脚本不得 import 外部业务模块，仅依赖同目录文件 + Node 标准库 + devDeps
- 修改 `w-model-dev/scripts/**` 后必须通过 `.githooks/pre-push` 门禁（含 self-test + security-scan）
- 每个实现子代理必须：修改前先 `git log --oneline -3` 了解上下文、修改后运行对应回归命令、TypeScript strict 0 错误

---

### 任务 0：预检（全量回归对照基线）

**文件：** 无修改

- [ ] **步骤 1：运行现有全量基线确认绿**

运行：
```bash
cd /mnt/skill_work_dir/Software_Engineering_W_Development_Model_Skills_Pack
npm run self-test
npx vitest run scripts/__tests__/ --config vitest.config.ts
npx tsc --noEmit
```
预期：self-test 192 条全过、vitest 205 条全过、tsc 0 错误。若失败先记录失败项（作为已知基线），继续任务 1。

### 任务 1：G-A plan-chunks.ts 重写（A1-A5，need_fix Bug 1/2 + 扩展）

**文件：**
- 修改：`w-model-dev/scripts/logic/plan-chunks.ts`

- [ ] **步骤 1：重写 `estimateTokens`（A1，need_fix Bug 1）**

将 `estimateTokens` 改为字节计数：
```typescript
function estimateTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
}
```

- [ ] **步骤 2：新增围栏感知的标题切分函数（A2 基础）**

在 `splitMarkdownByHeaders` 前新增：
```typescript
function splitMarkdownSections(content: string): string[] {
  const lines = content.split('\n');
  const sections: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) inFence = !inFence;
    if (!inFence && /^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join('\n'));
  return sections;
}
```
注意：`split` 带捕获组的旧实现（`content.split(/^(#{1,6}\s)/m)`）返回奇偶交错的 `[非标题, 标记, 内容, ...]`，配合 `if (i !== 0) i++` 的隐含推进是脆弱来源——新实现直接产出干净的 section 数组，每个 section 恰被消费一次（need_fix Bug 2 描述的核心）。

- [ ] **步骤 3：新增字节感知的行二次切分函数（A3 基础）**

```typescript
function splitByLines(text: string, maxTokens: number, filePath: string, chunkIdPrefix: string): Chunk[] {
  const lines = text.split('\n');
  const chunks: Chunk[] = [];
  const OVERLAP = 5;
  let buf: string[] = [];
  let bufBytes = 0;
  let idx = 1;
  const flush = () => {
    if (buf.length === 0) return;
    const slice = buf.join('\n');
    chunks.push({ id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`, path: filePath, kind: 'section', tokens: estimateTokens(slice) });
    idx++;
    const keep = buf.slice(-OVERLAP);
    buf = [...keep];
    bufBytes = keep.reduce((a, l) => a + Buffer.byteLength(l, 'utf8') + 1, 0);
  };
  for (const line of lines) {
    const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
    if (bufBytes + lineBytes > maxTokens * 4 && buf.length > 0) flush();
    buf.push(line);
    bufBytes += lineBytes;
  }
  if (buf.length > 0) flush();
  return chunks;
}
```

- [ ] **步骤 4：重写 `splitMarkdownByHeaders`（A2 单节二次切分 + 正确配对）**

```typescript
async function splitMarkdownByHeaders(
  content: string,
  maxTokens: number,
  filePath: string,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  const sections = splitMarkdownSections(content);
  const chunks: Chunk[] = [];
  let current = '';
  let idx = 1;
  for (const sec of sections) {
    if (estimateTokens(current + sec) > maxTokens && current.length > 0) {
      chunks.push({ id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`, path: filePath, kind: 'section', tokens: estimateTokens(current) });
      idx++;
      current = '';
    }
    if (estimateTokens(sec) > maxTokens) {
      const sub = splitByLines(sec, maxTokens, filePath, `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`);
      chunks.push(...sub);
      idx += sub.length;
      current = '';
    } else {
      current += sec;
    }
  }
  if (current.length > 0) {
    chunks.push({ id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`, path: filePath, kind: 'section', tokens: estimateTokens(current) });
  }
  return chunks;
}
```

- [ ] **步骤 5：修复 `planFile` 目录递归（A4）**

目录分支改为递归进入子目录并按名排序（保证确定性输出）：
```typescript
if (stat.isDirectory()) {
  const entries = await fs.readdir(filePath, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const chunks: Chunk[] = [];
  let idx = 1;
  for (const e of entries) {
    const childPath = path.join(filePath, e.name);
    if (e.isFile() || e.isDirectory()) {
      const sub = await planFile(childPath, maxTokens, `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`);
      chunks.push(...sub);
      idx++;
    }
  }
  return chunks;
}
```

- [ ] **步骤 6：修复非 md 文件行切分（A3）与 `--max-tokens` 校验（A5）**

`planFile` 非 md 分支改为调用 `splitByLines`（删除原 `linesPerChunk = Math.ceil((maxTokens * 4) / 1)` 与 `i += linesPerChunk - 50` 的步长算术）：
```typescript
if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
  return splitMarkdownByHeaders(content, maxTokens, filePath, chunkIdPrefix);
}
return splitByLines(content, maxTokens, filePath, chunkIdPrefix);
```
`parseArgs` 末尾（返回前）加：
```typescript
if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
  console.error(`✗ --max-tokens 必须为正整数，实际: ${maxTokens}`);
  process.exit(2);
}
```
同时将 `--phase` 校验改为 `!Number.isInteger(phase) || ![1,2,3,4].includes(phase!)`（拒绝 `2x`/`2.5`）。

- [ ] **步骤 7：验证**（用真实 CJK + 围栏 + 嵌套目录构造复现）

```bash
cd /tmp/opencode && mkdir -p dirsplit/sub/nested && printf '# A\n' > dirsplit/sub/nested/b.md
cd /mnt/skill_work_dir/Software_Engineering_W_Development_Model_Skills_Pack
npx tsx w-model-dev/scripts/logic/plan-chunks.ts /tmp/opencode/dirsplit --phase=1 --node-type=DD
npx tsx w-model-dev/scripts/logic/plan-chunks.ts /tmp/opencode/dirsplit --phase=1 --node-type=DD --max-tokens=0; echo "expect exit=2, got $?"
```
预期：目录包含嵌套 b.md；`--max-tokens=0` 报错 exit 2。再用含 CJK 的大 md 验证 estimateTokens 输出约为字符数（如 30194 字符 → ≥10000 tokens 触发分段）。

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/logic/plan-chunks.ts
git commit -m "fix(plan-chunks): 字节级 token 估算 + 围栏感知标题切分 + 单节二次切分 + 目录递归 + 参数校验（round28 G-A）"
```

### 任务 2：G-A plan-chunks 单测（A6）

**文件：**
- 创建：`w-model-dev/scripts/__tests__/plan-chunks.test.ts`

- [ ] **步骤 1：编写测试**（覆盖 CJK 估算、标题配对不丢内容、围栏不切分、单节二次切分、目录递归、max-tokens 非法值）

```typescript
/**
 * plan-chunks.ts 单元测试 —— 分块规划纯逻辑
 *
 * 覆盖：
 *   - estimateTokens：ASCII 字符数/4；CJK 字节数/4（中文 30194 字符 ≥ 10000 tokens 阈值）
 *   - splitMarkdownSections：header+content 正确配对不丢内容；围栏代码块内 # 行不切分
 *   - splitByLines：单节超限按行二次切分（每块 ≤ maxTokens）；overlap 5 行
 *   - planFile 目录递归：含嵌套子目录的树产出完整分块计划
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { estimateTokens, splitMarkdownSections, splitByLines } from '../plan-chunks.js';
```
注意：若 `splitMarkdownSections`/`splitByLines` 未导出，把 `function` 改为 `export function` 导出（保持脚本 CLI 行为不变，`main()` 仍只在 `isMain` 时执行）。`planFile` 目录递归测试用 `fs.mkdtemp` + 写入 `a.md`、`sub/nested/b.md`，调用导出的 `planFile` 断言 2 个文件均出现在 chunks。
断言要点：
- `estimateTokens('中文'.repeat(5000))` ≈ `Math.ceil(Buffer.byteLength('中文'.repeat(5000),'utf8')/4)`（15000）
- `splitMarkdownSections('```\n# not header\n```\n# Real\nbody')` 长度 2，第二节以 `# Real` 开头
- `splitByLines` 输出每块 `estimateTokens ≤ maxTokens`（单行超长除外）

- [ ] **步骤 2：运行测试**

```bash
npx vitest run scripts/__tests__/plan-chunks.test.ts --config vitest.config.ts
```
预期：全绿。若步骤 1 中修改了导出，先补导出再跑。

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/scripts/logic/plan-chunks.ts w-model-dev/scripts/__tests__/plan-chunks.test.ts
git commit -m "test(plan-chunks): 字节估算/标题配对/围栏/二次切分/目录递归单测（round28 G-A）"
```

### 任务 3：G-B gate-logic 修正（B1-B3）

**文件：**
- 修改：`w-model-dev/scripts/logic/gate-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/gate-enhancement.test.ts`

- [ ] **步骤 1：写失败测试（B1：SD-5.2.1 应通过）**

在 `gate-enhancement.test.ts` 追加：构造含 `SD-5.2.1:src/auth/login.ts` 的 `codeModuleMapping` 的 gate 样本，期望 `checkSdToCodeModuleMapping` 返回无 violation。运行确认当前失败（`segments.length === 0` 误报）。

- [ ] **步骤 2：修 B1（与 code-tla-logic.ts 对齐）**

`checkSdToCodeModuleMapping`（约 142-160 行）：`SD-` 剥离后按 `[-_.]+` 拆段并 `filter(s.length >= 2)` 后，若 `segments.length === 0`，退化用前缀精确匹配兜底（对齐 `code-tla-logic.ts:163` 的 `cm.includes(\`${id}:\`)`）：
```typescript
const stripped = id.replace(/^SD-/, '');
const segments = stripped.split(/[-_.]+/).filter(s => s.length >= 2);
if (segments.length === 0 && cm.some((m: string) => m.includes(`${id}:`))) {
  continue; // 数字层级 id（如 SD-5.2.1）命中 codeModule 前缀映射
}
```

- [ ] **步骤 3：写失败测试（B2：coverageStatus 行级比较）**

gate 样本：行 A 完整 `coverageStatus="100%"` + 行 B 缺 acceptanceTest 且 `coverageStatus="0%"` → 只应 flag 行 B，不应 flag 行 A。运行确认当前 A/B 都被 flag。

- [ ] **步骤 4：修 B2**

coverageStatus 一致性检查改为**行级**：对每行，用该行自身的完整性（所需 RTM 字段是否齐全）判断 coverageStatus 是否一致，不再与矩阵全局 coveragePercent 比较。coveragePercent 计算与 missingItems 联动（若 `missingItems.length > 0` 则 coveragePercent 强制 `< 100`）。

- [ ] **步骤 5：修 B3（checkUatPathMappingBackfill guard）**

`checkUatPathMappingBackfill`（约 217 行）在 `m.actualPath.includes(...)` 前加类型 guard：`typeof m.actualPath !== 'string' || typeof m.mappingType !== 'string'` 则 push violation 后 `continue`。

- [ ] **步骤 6：回归**

```bash
npx vitest run scripts/__tests__/gate-enhancement.test.ts scripts/__tests__/schema-validation.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：新增测试绿、既有全绿、tsc 0 错误。

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "fix(gate-logic): SD 数字层级前缀兜底 + coverageStatus 行级比较 + backfill guard（round28 G-B）"
```

### 任务 4：G-B check-artifact-gate 修正（B4-B6）

**文件：**
- 修改：`w-model-dev/scripts/cli/check-artifact-gate.ts`

- [ ] **步骤 1：写失败测试（B4：uat-path-mapping 空表/畸形行报错）**

构造 `docs/uat-path-mapping.md` 空表（只有表头无数据行）与畸形行样本，当前脚本对空表 `mappings=[]` 静默通过。确认失败。

- [ ] **步骤 2：修 B4（解析严格化）**

uat-path-mapping 解析器：数据行格式不符（单元格数不符/空单元格）→ 记录 violation 并计入结果，不静默跳行；表头校验：首列必须为 `UAT-` 前缀；`mappings=[]` 且文件非空 → violation `uat-path-mapping 无有效映射行`。

- [ ] **步骤 3：写失败测试（B5：phase 8 终检也校验）**

不带 `--phase`（终检默认 phase 8）跑含缺 actualPath 的 uat-path-mapping 的样本，当前不校验（仅 phaseOption===5）。确认失败。

- [ ] **步骤 4：修 B5**

`checkUatPathMappingBackfill` 的调用条件从 `phaseOption === 5` 扩展为 `phaseOption === 5 || phaseOption === undefined`（终检），并同步 self-test 新增终检样本。

- [ ] **步骤 5：修 B6（parsePhaseArg 严格整数）**

`parsePhaseArg`：拒绝 `5abc`/`3.7`（`Number.isInteger` + 字符串全数字校验），非法时 `console.error` + `process.exit(2)`。

- [ ] **步骤 6：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/ --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿。若既有样本因 B4/B5 行为变化失败，同步更新样本（记录在 commit message）。

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/cli/check-artifact-gate.ts w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(artifact-gate): uat-path-mapping 严格解析 + phase8 终检校验 + 严格整数参数（round28 G-B）"
```

### 任务 5：G-B security-scan 修正（B7-B8）

**文件：**
- 修改：`w-model-dev/scripts/cli/security-scan.ts`
- 修改：`.eslintsecurity-baseline.json`（重新生成）
- 测试：`w-model-dev/scripts/__tests__/security-scan.test.ts`

- [ ] **步骤 1：修 B7（指纹归一化）**

`fingerprint` 调用前归一化文件路径。`diffFindings` 中计算 hash 时用 `path.relative(仓库根, f.filePath)`（仓库根 = `path.resolve(process.cwd())`）：
```typescript
const rel = path.relative(process.cwd(), f.filePath).split(path.sep).join('/');
const h = fingerprint(rel, m.line, m.column, m.ruleId);
```
`newFindings` 的 `file` 字段同时写归一化相对路径。

- [ ] **步骤 2：修 B8（JSON 容错）**

`main()` 中 `JSON.parse(r.stdout || '[]')` 包 try/catch：非 JSON 输出 → `console.error` + exit 2。

- [ ] **步骤 3：更新单测**

`security-scan.test.ts`：断言 `diffFindings` 对同一相对路径、不同绝对路径（`/tmp/x` vs `/mnt/.../x` 同文件名）命中同一 hash。

- [ ] **步骤 4：重新生成 baseline**

```bash
cd /mnt/skill_work_dir/Software_Engineering_W_Development_Model_Skills_Pack
rm .eslintsecurity-baseline.json
node -e "
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const r = spawnSync('npx', ['eslint', 'w-model-dev/scripts/', '--format', 'json'], { encoding: 'utf-8', shell: process.platform === 'win32' });
const findings = JSON.parse(r.stdout || '[]');
const entries = [];
for (const f of findings) for (const m of f.messages) {
  if (!m.ruleId) continue;
  const rel = path.relative(process.cwd(), f.filePath).split(path.sep).join('/');
  entries.push({ hash: createHash('sha256').update(\`\${rel}:\${m.line}:\${m.column}:\${m.ruleId}\`).digest('hex'), rule_id: m.ruleId, file: rel, line: m.line, reason: 'Accepted finding (auto-generated baseline)' });
}
fs.writeFileSync('.eslintsecurity-baseline.json', JSON.stringify(entries, null, 2));
console.log('baseline entries:', entries.length);
"
npm run lint:security
```
预期：lint:security exit 0（`新增发现数: 0`）。确认 baseline 内 `file` 字段为相对路径（无盘符/`/mnt/...` 前缀）。**切勿**在归一化前生成。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/security-scan.ts .eslintsecurity-baseline.json w-model-dev/scripts/__tests__/security-scan.test.ts
git commit -m "fix(security-scan): 指纹路径归一化 + baseline 重新生成 + JSON 容错（round28 G-B）"
```

### 任务 6：G-B verifier/schema 修正（B9-B11）

**文件：**
- 修改：`w-model-dev/scripts/cli/check-verifier-output.ts`（B9）
- 修改：`w-model-dev/scripts/logic/schema-loader.ts`（B10）
- 修改：`w-model-dev/scripts/logic/verifier-logic.ts`（B11）
- 测试：`w-model-dev/scripts/__tests__/verifier-logic.test.ts`

- [ ] **步骤 1：修 B9（--s-output 解析）**

`check-verifier-output.ts:76`：`a.split('=')[1]` 改为 `a.slice(a.indexOf('=') + 1)`；`--s-output=` 空值 → 输入错误 exit 2。

- [ ] **步骤 2：修 B10（schema-loader 单例）**

`schema-loader.ts`：先在新局部变量中注册全部 schema，全部成功后赋值模块级 `ajv`；中途抛错 → 清理并抛带上下文的错误（`SCHEMAS_DIR` 不存在 → 明确错误信息）。

- [ ] **步骤 3：修 B11（verifier-logic passed 重算）**

`verifier-logic.ts`：evidence 格式扣分（compositeScore -0.1）后，`passed` 与 qualityLevel 基于**降级后**的 compositeScore 重新判定（R13 单轴下限保留）；同时清理 P3-5（isIso8601 死代码）与 P3-8（checkR11SummaryLength 死代码，schema minLength 已拦截——删除或标注不可达）。

- [ ] **步骤 4：写测试（B11）**

`verifier-logic.test.ts` 追加：构造 evidence 格式违规样本，断言返回的 `compositeScore`（降级后）与 `passed`/qualityLevel 映射自洽（passed 为降级后的结果）。

- [ ] **步骤 5：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/verifier-logic.test.ts scripts/__tests__/schema-validation.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；若既有样本因 B11 passed 语义变化失败，按新语义更新样本。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/logic/schema-loader.ts w-model-dev/scripts/logic/verifier-logic.ts w-model-dev/scripts/__tests__/verifier-logic.test.ts w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(verifier/schema): s-output 解析 + ajv 单例原子化 + evidence 扣分后 passed 重算 + 死代码清理（round28 G-B）"
```

### 任务 7：G-B self-test gate 样本补全（B12）

**文件：**
- 修改：`w-model-dev/scripts/cli/self-test.ts`
- 创建：`w-model-dev/scripts/samples/gate/valid-sd-numeric-levels.json`（若 gate 样本走文件驱动）

- [ ] **步骤 1：补带 graph 的 gate 样本**

`self-test.ts` GATE_CASES：新增一条含 `graph` 的 gate 样本，`codeModuleMapping` 含 `SD-5.2.1:src/auth/login.ts`（数字层级），期望 passed。确认此前 gate 样本从不传 graph（runGateCases 只传 `{phaseOption}`）→ 修正 runner 透传 graph。

- [ ] **步骤 2：验证**

```bash
npm run self-test
```
预期：全绿，新增样本覆盖 `checkSdToCodeModuleMapping`（此前从未被 self-test 覆盖）。

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): 补带 graph 的 gate 样本覆盖 SD 数字层级映射（round28 G-B）"
```

### 任务 8：G-C check-requirement-graph 修正（C1-C4）

**文件：**
- 修改：`w-model-dev/scripts/cli/check-requirement-graph.ts`
- 修改：`w-model-dev/scripts/logic/graph-logic.ts`（仅导出供复用，如需要）
- 测试：`w-model-dev/scripts/__tests__/graph-logic.test.ts`

- [ ] **步骤 1：写失败测试（C1：--rtm R6 违规应拦）**

构造含 `cross-cuts` 边且源非 NFR/CON 的 graph + `--rtm`，期望 exit 1；当前 exit 0。确认失败。

- [ ] **步骤 2：修 C1**

把 `--rtm` R6 检查移到 `checkRequirementGraph` 结果返回**之前**：将 crossCutsSourceTypeViolations 合并进 `result.violations`，再统一计算 `result.passed`。即在 `const result = checkRequirementGraph(parsed, effectivePhase);` 之后立即执行 R6 检查并**重算 passed**（或把 R6 校验下沉进 `graph-logic.ts` 的 `checkRequirementGraph`，通过参数传入 rtmRows）。

- [ ] **步骤 3：写失败测试（C2：豁免后多 group 通过）**

2 个 level=1 根的 phase-1 纯 REQ 图 + 1 条 R3 违规 + `grantedExemptions:['R3']`，期望豁免后 exit 0；当前 roots 重算 `===1` 导致 exit 1。确认失败。

- [ ] **步骤 4：修 C2**

豁免重算块（约 151-159 行）的 roots 条件对齐 `graph-logic.ts:771`：
```typescript
const isPhase1PureReq = effectivePhase === 1; // 与 graph-logic 判定一致（纯 REQ 图）
result.passed =
  (isPhase1PureReq ? result.roots.length >= 1 : result.roots.length === 1) &&
  result.connectedComponents === 1 &&
  result.isolatedNodes.length === 0 &&
  result.orphans.length === 0 &&
  result.multiParent.length === 0 &&
  traceabilityOk && dataflowOk &&
  result.violations.length === 0;
```
注意确认 `graph-logic.ts` 中 `isPhase1PureReq` 的精确判定（含节点类型检查），保持两处一致（可导出复用）。

- [ ] **步骤 5：修 C3（豁免前缀匹配）**

豁免过滤（约 132-137 行）：`v.startsWith(\`${rule} \`)` 增加对组合前缀的匹配——R1 消息形如 `R1-R4 层级校验失败：...`，需匹配 `rule === 'R1' && v.startsWith('R1-')`；或对 R1 专门用 `/^R1\b/` 判断（`R1 ` 或 `R1-R4` 或 `R1:` 均命中）。

- [ ] **步骤 6：修 C4（--phase 严格整数）**

`--phase` 解析拒绝 `2x`/`2.5`（`Number.isInteger` + 字符串全数字），非法 exit 2。

- [ ] **步骤 7：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/graph-logic.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；新增 C1/C2 样本入 self-test。

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/cli/check-requirement-graph.ts w-model-dev/scripts/logic/graph-logic.ts w-model-dev/scripts/cli/self-test.ts w-model-dev/scripts/samples w-model-dev/scripts/__tests__/graph-logic.test.ts
git commit -m "fix(graph): rtm R6 纳入 passed + 豁免多 group 对齐 + 前缀匹配 + 严格参数（round28 G-C）"
```

### 任务 9：G-C graph.schema + graph-logic warnings（C5-C6）

**文件：**
- 修改：`w-model-dev/schemas/graph.schema.json`
- 修改：`w-model-dev/scripts/logic/graph-logic.ts`
- 修改：`w-model-dev/scripts/cli/check-requirement-graph.ts`

- [ ] **步骤 1：修 C5（schema 放行 sourceArtifact）**

`graph.schema.json` 边对象：`properties` 增加 `"sourceArtifact": { "type": "string" }`（optional），保持 `additionalProperties: false`。同步 `GraphEdge` 类型若已有 `sourceArtifact?: string` 则无需改。确认语义来源占比统计（graph-logic.ts:749）重新生效：带 `sourceArtifact` 的合法边不再 schema 失败。

- [ ] **步骤 2：写失败测试（C6：warnings 落盘）**

构造边数低于 `节点×3` 下限的 graph，当前 warnings 计算后不输出。断言 `check-requirement-graph.ts` 输出的 GRAPH_JSON 含 `warnings` 字段。确认失败。

- [ ] **步骤 3：修 C6**

`check-requirement-graph.ts`：stdout 输出 warnings（`警告：` 前缀逐条打印）+ GRAPH_JSON 增加 `warnings` 字段（来自 `result.warnings` 或 graph-logic 返回）。

- [ ] **步骤 4：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/graph-logic.test.ts scripts/__tests__/schema-validation.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；graph schema 校验样本同步确认 sourceArtifact 合法。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/schemas/graph.schema.json w-model-dev/scripts/logic/graph-logic.ts w-model-dev/scripts/cli/check-requirement-graph.ts
git commit -m "fix(graph): schema 放行 sourceArtifact + warnings 落盘输出（round28 G-C）"
```

### 任务 10：G-C coverage-logic + exemption-logic 修正（C7-C9）

**文件：**
- 修改：`w-model-dev/scripts/logic/coverage-logic.ts`
- 修改：`w-model-dev/scripts/cli/check-requirement-coverage.ts`
- 修改：`w-model-dev/scripts/logic/exemption-logic.ts` + `w-model-dev/scripts/cli/check-exemption.ts`
- 测试：`w-model-dev/scripts/__tests__/coverage-logic.test.ts` + `exemption-logic.test.ts`

- [ ] **步骤 1：修 C7（out-of-scope 结构不符报错）**

`coverage-logic.ts`：显式传入 `--out-of-scope` 但文件无 `items` 数组 → violation（fail）而非降级为 warning。`check-requirement-coverage.ts` 读取文件时做结构校验，不符 exit 2。

- [ ] **步骤 2：修 C8（C9 missingIds 取需求 ID）**

`coverage-logic.ts` C9：`missingIds` 对 requirementTypes 缺失条目产出**具体需求 ID**（`NFR-001`）而非类别名（`NFR`）。核对 out-of-scope items 的结构字段名，取需求的 `requirementId`/`id`。

- [ ] **步骤 3：修 C9（exemption 时间戳时序）**

`exemption-logic.ts` E 规则新增时序校验：`submittedAt < reviewedAt < verifiedAt < decidedAt`（ISO 比较），违反 push violation。

- [ ] **步骤 4：写测试**

`coverage-logic.test.ts`：C7（OOS 形状不符 fail）、C8（missingIds 含具体 ID）。`exemption-logic.test.ts`：时序乱序 fail、时序合规 pass。

- [ ] **步骤 5：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/coverage-logic.test.ts scripts/__tests__/exemption-logic.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/logic/coverage-logic.ts w-model-dev/scripts/cli/check-requirement-coverage.ts w-model-dev/scripts/logic/exemption-logic.ts w-model-dev/scripts/cli/check-exemption.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(coverage/exemption): OOS 形状报错 + C9 ID 粒度 + 时间戳时序校验（round28 G-C）"
```

### 任务 11：G-D tla-logic 修正（D1-D3）

**文件：**
- 修改：`w-model-dev/scripts/logic/tla-logic.ts`
- 修改：`w-model-dev/scripts/logic/code-tla-logic.ts`（同步 D1）
- 测试：`w-model-dev/scripts/__tests__/tla-logic.test.ts` + `code-tla-logic.test.ts`

- [ ] **步骤 1：写失败测试（D1：`Invariants ==` 命名）**

构造含 `Invariants == TypeOK /\ AuthInvariant` 的 TLA+ 源码 + cfg 含 `INVARIANT TypeOK` 等，当前报"多余不变式"（正则只匹配 `BusinessInvariant ==`）。确认失败。

- [ ] **步骤 2：修 D1**

`tla-logic.ts:612-613`（`checkCfgInvariantsConsistency`）正则放宽为匹配 `Invariants\s*==|BusinessInvariant\s*==`（并提取右端标识符集）；同步 `code-tla-logic.ts:462`（`extractBusinessInvariants`）与 `checkInvariantCoverage` 对 `Invariants` 命名的支持。对照 demo 的 `L1-BlogSystem.tla` 验证。

- [ ] **步骤 3：修 D2（INVARIANT 格式死分支）**

`checkCfgStructure`（约 656-667 行）：`INVARIANT` 行无名字（`^INVARIANT\s*$`）应报"缺少不变式名"——当前条件分支不可达。重写该分支为可达校验。

- [ ] **步骤 4：修 D3（@phase 严格）**

`@phase` 解析拒绝 `4x`/`3.9`（`Number.isInteger`）。

- [ ] **步骤 5：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/tla-logic.test.ts scripts/__tests__/code-tla-logic.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；若 demo tla 样本受影响同步更新。

- [ ] **步骤 6：Commit**

```bash
git add w-model-dev/scripts/logic/tla-logic.ts w-model-dev/scripts/logic/code-tla-logic.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(tla): cfg↔TLA 不变式命名兼容 Invariants== + INVARIANT 死分支 + @phase 严格（round28 G-D）"
```

### 任务 12：G-D bdd-logic + tla-bdd-sync 修正（D4-D7）

**文件：**
- 修改：`w-model-dev/scripts/logic/bdd-logic.ts` + `check-bdd-model.ts`（D4/D5）
- 修改：`w-model-dev/scripts/logic/tla-bdd-sync-logic.ts` + `check-tla-bdd-sync.ts`（D6/D7）
- 测试：`w-model-dev/scripts/__tests__/bdd-logic.test.ts` + `tla-bdd-sync-logic.test.ts`

- [ ] **步骤 1：修 D5（extractStateVarName 兼容 TypeOK）**

`check-bdd-model.ts`（约 370/399 行）`extractStateVarName` 硬编码 `TypeInvariant ==` → 放宽为 `TypeOK\s*==|TypeInvariant\s*==|Invariants\s*==`；同步 `extractTlaStates/Init/Transitions/Invariants`。对照 demo `L1-BlogSystem.tla`（`TypeOK ==`）验证 D4 不再空集。

- [ ] **步骤 2：修 D4（--tla-manifest 缺参提示）**

`check-bdd-model.ts`：未传 `--tla-manifest` 时 D4 不再静默跳过——输出提示 `提示：未提供 --tla-manifest，跳过 D4 TLA+ 等价校验`（不计 fail）。

- [ ] **步骤 3：修 D6（tla-bdd-sync 读 Scenario + 注释声明）**

`tla-bdd-sync-logic.ts` `extractBddStateMachine`（约 123-176 行）：从 Scenario 体内 Given/When/Then 提取状态与转移（当前只读 Background），并识别 `# @states:` / `# @transitions:` 注释声明。对照 demo features（状态机由注释声明）验证。

- [ ] **步骤 4：修 D7（转移抽取支持 \E 量化 + 边界鲁棒）**

`tla-bdd-sync-logic.ts:67`：正则 `\\\/\s*([A-Za-z_]\w*)` 增加对 `\E ... :` 量化项的支持（先剥离 `\E 变量 \in 集合 :` 前缀再匹配析取项）；`:64,81` Next 体边界：以 `/\* ... \n` 注释块起点/EOF 终结（不吞入无关定义）；`VARIABLES` 多行形式捕获全部变量。

- [ ] **步骤 5：写测试**

`tla-bdd-sync-logic.test.ts`：含 `\E req \in Request : ReceiveRequest(req)` 的 Next 抽取；Scenario 体步骤提取；多行 `VARIABLES`。

- [ ] **步骤 6：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/bdd-logic.test.ts scripts/__tests__/tla-bdd-sync-logic.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；demo 相关样本（w-model-dev-demo 只读夹具除外）同步更新。

- [ ] **步骤 7：Commit**

```bash
git add w-model-dev/scripts/logic/bdd-logic.ts w-model-dev/scripts/cli/check-bdd-model.ts w-model-dev/scripts/logic/tla-bdd-sync-logic.ts w-model-dev/scripts/cli/check-tla-bdd-sync.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(bdd/tla-sync): TypeOK 兼容 + Scenario 步骤提取 + \\E 量化 + 边界鲁棒化（round28 G-D）"
```

### 任务 13：G-D design-contract 修正（D8-D9）

**文件：**
- 修改：`w-model-dev/scripts/cli/check-design-contract-consistency.ts`
- 修改：`w-model-dev/scripts/logic/design-contract-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/`（新增 design-contract 测试，若尚无则新建 `design-contract-logic.test.ts`）

- [ ] **步骤 1：修 D8（路由元数据按路由提取）**

`check-design-contract-consistency.ts` `extractSuccessStatus`（约 85-87 行）：不再取文件内第一个 `res.status(N)` 赋给所有路由——改为按路由方法/路径分组解析（每个 `router.<method>('<path>', handler)` 块内的 `res.status(N)` 归属该路由）。params/responseFields 同理按路由块提取。对照真实 fixture（同文件 POST 201 + GET 200）验证 GET 不再误报 201。

- [ ] **步骤 2：修 D9（路由查找失败报 violation）**

`design-contract-logic.ts`（约 127/146/163 行）：断言指向的路由在 routes 定义中不存在时，push violation `路由 ${method} ${path} 未在路由定义中找到`，不再 `continue` 静默跳过。支持路径归一化（尾斜杠/query 剥离）。

- [ ] **步骤 3：写测试**

构造多状态码单文件 fixture + 不存在路由断言，验证 D3 不再误报、F9 报 violation。

- [ ] **步骤 4：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/ --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-design-contract-consistency.ts w-model-dev/scripts/logic/design-contract-logic.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts
git commit -m "fix(design-contract): 路由级元数据提取 + 未找到路由报 violation（round28 G-D）"
```

### 任务 14：G-E signature-chain 修正（E1-E4，D2 连续链）

**文件：**
- 修改：`w-model-dev/scripts/logic/signature-chain-logic.ts`
- 修改：`w-model-dev/scripts/cli/check-signature-chain.ts`
- 测试：`w-model-dev/scripts/__tests__/signature-chain-logic.test.ts`
- 文档：`w-model-dev/references/signature-chain-guide.md`（§5 同步）

- [ ] **步骤 1：写失败测试（E1：跨阶段连续链）**

构造 2 阶段链：阶段 2 首条 O `prevSigId` 指向阶段 1 最后一条 checkpoint sigId（连续链语义）。当前：
- archive 模式（无 --phase）R2 对"每阶段 genesis 重启"链报断 → 新语义应接受连续链；
- `--phase=2` 模式 R2 对连续链首条应接受（prevSigId 指向上一阶段最后一条并校验存在）。
构造 3 组用例：连续链 archive pass、连续链 --phase=2 pass、断链（prevSigId 不存在）fail。确认当前行为不符。

- [ ] **步骤 2：修 E1（R2 连续链语义）**

`signature-chain-logic.ts` R2（约 152-167 行）：
- archive 全链模式：逐条校验 `prevSigId` 等于链中前一条 sigId（连续链），首条为 genesis；
- `--phase=N` 模式：phase 内首条允许 `prevSigId` 指向**上一阶段最后一条**（从全链计算上一阶段末条 sigId 集），其余条须等于 phase 内前一条。
同列表内前条用列表索引（如 `phaseEntries[i-1]`）而非全量 `entries`。

- [ ] **步骤 3：修 E2（R7 悬空来源放宽）**

`signature-chain-logic.ts` R7（约 226-237 行）：`--phase=N` 模式 `allSigIds` 从"仅本阶段"扩展为"本阶段 ∪ 上一阶段"（跨阶段消费者校验要求阶段 N+1 引用阶段 N 的 sigId）。校验 sourceSigIds 每个 id ∈ 该并集。

- [ ] **步骤 4：修 E3（收集全部违规）**

各规则循环（R2/R3/R7/R8/R9）去掉首个命中即 `break`，聚合全部违规点进 `rulesFailed`/`reasons`。

- [ ] **步骤 5：修 E4（基路径显式化）**

`check-signature-chain.ts`（约 100-121 行）：支持 `--chain=<path>` 显式链文件路径，项目根由链文件位置推导（`<proj>/.w-model/` 或链文件所在目录向上找 `.w-model/`）；产物路径（R8 存在性校验）统一按 `.w-model/` 前缀解析。

- [ ] **步骤 6：同步文档**

`signature-chain-guide.md`：R2 语义改为"跨阶段连续链"，补充 `--phase=N` 边界规则（首条 prevSigId 可指向上阶段末条、R7 来源并集）。

- [ ] **步骤 7：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/signature-chain-logic.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；`samples/signature-chain/valid-all-roles.jsonl` 若按每阶段 genesis 重启构造，需按连续链语义更新样本。

- [ ] **步骤 8：Commit**

```bash
git add w-model-dev/scripts/logic/signature-chain-logic.ts w-model-dev/scripts/cli/check-signature-chain.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts w-model-dev/references/signature-chain-guide.md
git commit -m "fix(signature-chain): 跨阶段连续链 R2 + R7 来源并集 + 全违规聚合 + 基路径显式化（round28 G-E，D2）"
```

### 任务 15：G-E run-log 修正（E5-E9，D3 分档）

**文件：**
- 修改：`w-model-dev/scripts/logic/run-log-logic.ts`
- 测试：`w-model-dev/scripts/__tests__/run-log-logic.test.ts`
- 文档：`w-model-dev/references/data-models.md`（动作分档说明）

- [ ] **步骤 1：写失败测试（E5：阶段 5 不要求 chunk/cross）**

按阶段 5 文档化流程构造 run-log（produce/review/gate/checkpoint），当前 R1 报"缺 chunk/cross"。确认失败。

- [ ] **步骤 2：修 E5（R1 按阶段分档）**

`run-log-logic.ts` R1（约 155-167 行）：
- 阶段 1-4：要求 chunk / cross / gate(类) / checkpoint；
- 阶段 5-8：要求 produce / review / gate(类) / checkpoint。
```typescript
const required =
  phase >= 1 && phase <= 4
    ? ['chunk', 'cross', 'gate', 'checkpoint']
    : ['produce', 'review', 'gate', 'checkpoint'];
// gate 类包含 gate/tla-gate/graph-gate；用 action 集合判定
```

- [ ] **步骤 3：修 E6（R3 返工计数按 phase+target）**

R3（约 202-210 行）：`reworkCount` 从"全部 phase 的 rework"改为按当前 phase 过滤，且仅统计 target 含 TLA 的返工（run-log rework 条目 target 字段）与 `options.tlaCheckRounds` 语义对齐（读 tla-manifest 各 phase 的 checkRounds 汇总）。

- [ ] **步骤 4：修 E7（R6 gateExitCode null 判失败）**

R6（约 307-323 行）：`gateLogPath` 存在但 `gateExitCode` 非 number → violation `R6: 条目 ${runId} gateLogPath 已设但 gateExitCode 未回填`。

- [ ] **步骤 5：修 E8（R7 扫 targetKind）**

R7 返工时序（约 351-369 行）：rootcause 后找第一个 `action==='review' && targetKind==='rootcause'` 的条目，不再找第一个任意 review。

- [ ] **步骤 6：修 E9（R3 rootcause↔fix 按 reportId 关联）**

R3 扩展（约 213-233 行）：`fixActions` 的 `basedOnReport` 与 `rootcauseActions` 的 `reportId` 建立映射去重后比较（一个 fix 可覆盖多份 R 报告），V 复审 rootcause 记录按 reportId 去重计数。

- [ ] **步骤 7：写测试**

`run-log-logic.test.ts` 追加：E5（阶段 5 无 chunk/cross 通过）、E7（gateExitCode null 失败）、E8（中间夹普通 review 不误报）、E9（1 fix 覆盖 2 R 报告通过）。

- [ ] **步骤 8：同步文档**

`data-models.md`：run-log 动作分档说明（阶段 5-8 动作集合）与 R1 规则同步。

- [ ] **步骤 9：回归**

```bash
npm run self-test
npx vitest run scripts/__tests__/run-log-logic.test.ts --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿；既有 run-log 样本若按旧 R1 语义构造需同步更新。

- [ ] **步骤 10：Commit**

```bash
git add w-model-dev/scripts/logic/run-log-logic.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts w-model-dev/references/data-models.md
git commit -m "fix(run-log): R1 阶段分档 + 返工计数归因 + gateExitCode 强制 + targetKind 时序 + reportId 关联（round28 G-E，D3）"
```

### 任务 16：G-E check-run-log/budget/maturity/checkpoint/rootcause/archive 修正（E10-E17）

**文件：**
- 修改：`w-model-dev/scripts/cli/check-run-log.ts`（E10/E11）
- 修改：`w-model-dev/scripts/logic/budget-logic.ts` + `check-budget.ts`（E12）
- 修改：`w-model-dev/scripts/cli/check-maturity.ts`（E13）
- 修改：`w-model-dev/scripts/cli/check-checkpoint.ts`（E14）+ `checkpoint-logic.ts`（E15）
- 修改：`w-model-dev/scripts/logic/root-cause-logic.ts`（E16）
- 修改：`w-model-dev/scripts/logic/archive-integrity-logic.ts`（E17）
- 测试：对应 `__tests__/*.test.ts`

- [ ] **步骤 1：修 E10（extractExitCode 模式表补齐）**

`check-run-log.ts`（约 79-103 行）：`GATE_JSON` 模式表补齐 `SIGNATURE_CHAIN_JSON` / `ARCHIVE_INTEGRITY_JSON` / `ROLE_DISPATCH_JSON` / `CODE_TLA_JSON` / `COVERAGE_JSON` / `EXEMPTION_JSON` / `CONTRACT_JSON` / `OPSX_ARTIFACTS_JSON` / `OPENSPEC_ARCHIVE_JSON` / `CODEGRAPH_QUERIES_JSON`；`check-bdd-model.ts` / `check-preventive-review.ts` / `check-rootcause-report.ts` / `check-tla-bdd-sync.ts` 无标记 → 给这些脚本补 `<KEY>_JSON` 标记输出（对齐其它 check 脚本的 `GATE_JSON` 模式）。

- [ ] **步骤 2：修 E11（loadGateLogs 全部文件）**

`check-run-log.ts`（约 134-135 行）：`if (!file.endsWith('.log')) continue;` → 加载 gate-logs/ 下全部文件（按"前缀-时间戳-脚本名"解析，`-bdd.json`/`-preventive-review.json` 等参与 R6/R5）。

- [ ] **步骤 3：修 E12（budget tla-rework 死代码）**

`budget-logic.ts`（约 129-136 行）+ `check-budget.ts`（约 92-93 行）：`countReworks` 统计改为 `action==='rework' && target.includes('tla')`（若 run-log schema 有 target 字段；否则按 phase 限定 rework 计数），删除 `tla-rework` 假枚举依赖；`data-models.md` 动作枚举说明同步。

- [ ] **步骤 4：修 E13（maturity 词边界）**

`check-maturity.ts`（约 67/91-93 行）：`/O[1-6]/` → `/\bO[1-6]\b/`，同一 note 多个命中按匹配次数计。

- [ ] **步骤 5：修 E14/E15（checkpoint 前导零 + 字符计数）**

`check-checkpoint.ts`（约 100-108 行）：文件名 `01.txt` 的 phase 解析 `parseInt(match[1], 10)` 后再与 `String(phase)` 比较；`checkpoint-logic.ts`（约 211 行）：`decision.length` → `[...decision].length`。

- [ ] **步骤 6：修 E16（rootcause R10 reality-checker）**

`root-cause-logic.ts`（约 293-303 行）：R10 从"仅 5-why 校验"改为"任一有效 partialReport 含 `personaSlice==='reality-checker'`"（不限 method）。

- [ ] **步骤 7：修 E17（archive 精确匹配）**

`archive-integrity-logic.ts`（约 71-78 行）：`.includes(requiredFile)` → 按归档清单预期相对路径精确匹配（`relPath === requiredFile` 或 `relPath.endsWith('/' + requiredFile)` 且限定归档根下）。

- [ ] **步骤 8：写测试 + 回归**

对应 `__tests__` 追加用例（E10 模式表命中、E13 `O100` 不误命中、E14 前导零、E16 combined 缺 reality-checker fail、E17 非归档根同名文件不满足），然后：
```bash
npm run self-test
npx vitest run scripts/__tests__/ --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿。

- [ ] **步骤 9：Commit**

```bash
git add w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/logic/budget-logic.ts w-model-dev/scripts/cli/check-budget.ts w-model-dev/scripts/cli/check-maturity.ts w-model-dev/scripts/cli/check-checkpoint.ts w-model-dev/scripts/logic/checkpoint-logic.ts w-model-dev/scripts/logic/root-cause-logic.ts w-model-dev/scripts/logic/archive-integrity-logic.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts w-model-dev/references/data-models.md
git commit -m "fix(state/logs): gate 标记补齐 + gate-log 全量加载 + budget 返工口径 + 词边界 + 前导零 + R10 复用 + 归档精确匹配（round28 G-E）"
```

### 任务 17：G-F ensure-codegraph-opsx 修正（F1-F3）

**文件：**
- 修改：`w-model-dev/scripts/cli/ensure-codegraph-opsx.ts`

- [ ] **步骤 1：修 F1（探针命令 + 执行时机）**

`checkMcpCodegraph`（约 67 行）：`codegraph query --symbol main` → `codegraph query main`（`query` 是位置参数）。调用顺序：把探针移到 L3 `codegraph init`（建索引）**之后**执行；在 init 前不做 query 探针（避免"未初始化"假阴性）。同时禁止探针命令使用 `--yes` 或任何自动改写全局 opencode 配置的行为（恢复型副作用回滚：若检测到全局配置被改写则还原）。

- [ ] **步骤 2：修 F2（--phase Number.isNaN）**

`--phase` 解析（约 202-206 行）：`parseInt` 后 `Number.isNaN` 校验，非法 exit 2（对齐其它 check 脚本）。`JSON.stringify` 输出前保证 phase 为数字。

- [ ] **步骤 3：修 F3（getArg 支持两种形式）**

`getArg`（约 188-191 行）：支持 `--name=value` 与 `--name value` 两种形式（当前只支持后者）。

- [ ] **步骤 4：验证**

```bash
cd /mnt/skill_work_dir/Software_Engineering_W_Development_Model_Skills_Pack
npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --phase 5 --project-root /tmp/opencode/nonexistent --mode light; echo "exit=$?"
npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --phase=5 --project-root=/tmp/opencode/nonexistent --mode=light; echo "exit=$?"
npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --phase abc --project-root /tmp/opencode/nonexistent --mode light; echo "expect exit=2, got=$?"
```
预期：light 模式输出依赖检测结果（exit 0 或按设计）；`--phase abc` exit 2；两种参数形式等价。注意**不要**以 full 模式在本机实跑（避免再触发全局配置改写）；验证探针参数用 `codegraph query --help` 对照。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/ensure-codegraph-opsx.ts
git commit -m "fix(ensure-codegraph-opsx): 探针命令/时机修正 + phase 校验 + getArg 双形式（round28 G-F）"
```

### 任务 18：G-F check 脚本修正 + opsx 操作文档（F4-F7）

**文件：**
- 修改：`w-model-dev/scripts/cli/check-codegraph-queries.ts`（F4）
- 修改：`w-model-dev/scripts/cli/check-opsx-artifacts.ts`（F5/F6）
- 修改：`w-model-dev/scripts/cli/check-openspec-archive.ts`（F6/F9）
- 修改：`w-model-dev/SKILL.md`（F7，D4 约束）
- 修改：`w-model-dev/references/subagent-delegation.md`（F7）
- 修改：`w-model-dev/references/anti-patterns.md`（#39 描述，F7）

- [ ] **步骤 1：修 F4（check-codegraph-queries）**

`check-codegraph-queries.ts`：
- `blastRadius`（查询结果影响半径）字段存在性 + 数组类型校验；`queryTimestamp` 类型校验；
- 位置参数误解析（仅 `--phase 5` 缺 project-root 时把 `'5'` 当项目根）→ 补用法错误校验：位置参数必须是存在的目录，否则 exit 2 报用法。

- [ ] **步骤 2：修 F5/F6（check-opsx-artifacts）**

`check-opsx-artifacts.ts`：
- 校验该阶段**所有** `phase<N>-*` 变更目录（`readdirSync` 按名排序后逐个校验，任一不齐即 fail，列出全部缺失），不再只取 `entries[0]`；
- 目录名精确前缀匹配 `^phase<N>-`（排除 `archive`）；
- R3/V 审查产物（D4 决策 B）：保留 9+3 份 stage 级 `.md` 校验不变。
`check-openspec-archive.ts`：目录名精确前缀匹配；REQUIRED_ARCHIVED_ARTIFACTS 与归档前清单统一（补 `tickets.md`）。

- [ ] **步骤 3：修 F7（操作文档 D4 约束）**

- `SKILL.md`：约束 #17 或新增约束条目——阶段 5-8 opsx 三段式（S-explore/S-propose/S-coding）每段 R3 预防性审查产出 `.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md` ×9 + 每段 V 评审产出 `.w-model/v-reviews/phase<N>-{explore,propose,coding}.md` ×3（与 check-opsx-artifacts.ts 一致）；
- `subagent-delegation.md`：R3 分派模板同步新增 stage 级产出；V 评审产物位置明确；
- `anti-patterns.md`：#39 描述与校验口径同步（产物路径/文件名）。

- [ ] **步骤 4：写测试 + 回归**

`__tests__` 追加：多变更目录缺件 → 报出全部缺失（非 entries[0]）；archive tickets.md 缺失 → fail。然后：
```bash
npm run self-test
npx vitest run scripts/__tests__/ --config vitest.config.ts
npx tsc --noEmit
```
预期：全绿。

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-codegraph-queries.ts w-model-dev/scripts/cli/check-opsx-artifacts.ts w-model-dev/scripts/cli/check-openspec-archive.ts w-model-dev/scripts/__tests__ w-model-dev/scripts/samples w-model-dev/scripts/cli/self-test.ts w-model-dev/SKILL.md w-model-dev/references/subagent-delegation.md w-model-dev/references/anti-patterns.md
git commit -m "fix(opsx/codegraph): 全目录校验 + blastRadius + 精确前缀 + 操作文档补产 stage 级 R3/V（round28 G-F，D4）"
```

### 任务 19：全量回归 + security-scan baseline 复核

**文件：** 无修改（仅验证）

- [ ] **步骤 1：全量回归**

```bash
cd /mnt/skill_work_dir/Software_Engineering_W_Development_Model_Skills_Pack
npm run self-test
npx vitest run scripts/__tests__/ --config vitest.config.ts
npx tsc --noEmit
npm run lint:security
```
预期：self-test 新基线全绿、vitest 全绿、tsc 0 错误、security-scan exit 0（新增发现数 0）。

- [ ] **步骤 2：pre-push 门禁**

```bash
npm run prepush
```
预期：11 项门禁全过。若有项失败，定位并修复（回到对应任务），重新执行。

### 任务 20：文档与版本同步 + 删除 need_fix.md

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`（§3.4.24 + §10A 追溯表）
- 修改：`CHANGELOG.md`（[27.0.0]）
- 修改：`package.json` / `w-model-dev/SKILL.md`（frontmatter version）/ `w-model-dev/skill-metadata.json`（三处 26.0.0 → 27.0.0）
- 修改：`AGENTS.md`（§4 round28 记录 + §8 self-test/vitest 基线计数）
- 修改：`README.md` / `CONTRIBUTING.md` / `INSTALL.md`（基线计数、反模式总数、脚本表如有变化）
- 修改：`w-model-dev/references/phase-8-acceptance-test.md`（uat-path-mapping 终检校验声明）
- 删除：`need_fix.md`

- [ ] **步骤 1：版本号三处同步**

`package.json` version → `27.0.0`；`w-model-dev/SKILL.md` frontmatter `version: 26.0.0` → `27.0.0`；`w-model-dev/skill-metadata.json` version → `27.0.0`。运行 `npx vitest run scripts/__tests__/skill-metadata.test.ts --config vitest.config.ts` 确认三处一致。

- [ ] **步骤 2：SSoT §3.4.24**

按 §3.4.23 模板格式写第 28 轮记录（触发/修正方案/脚本改动清单/新增测试/版本号），§10A 追溯表补行。

- [ ] **步骤 3：CHANGELOG [27.0.0] + AGENTS §4/§8 + README/CONTRIBUTING/INSTALL**

更新基线计数为实际 self-test/vitest 数字；反模式总数如未新增保持 41；脚本表如有新增脚本/行为变化同步。

- [ ] **步骤 4：删除 need_fix.md**

```bash
git rm need_fix.md
```

- [ ] **步骤 5：最终验证 + Commit**

```bash
npm run prepush
git add -A
git commit -m "docs(round28): SSoT §3.4.24 + CHANGELOG [27.0.0] + 版本号 27.0.0 三处 + 基线计数同步 + 移除 need_fix.md"
```

---

## 自检

**1. 规格覆盖度**（对照 `docs/superpowers/specs/2026-07-31-round28-script-bugfix-design.md`）：
- G-A A1-A6 → 任务 1+2 ✓
- G-B B1-B12 → 任务 3-7 ✓
- G-C C1-C9 → 任务 8-10 ✓
- G-D D1-D9 → 任务 11-13 ✓
- G-E E1-E17 → 任务 14-16 ✓
- G-F F1-F7 → 任务 17-18 ✓
- §4 测试回归 → 任务 19 ✓；§5 文档版本 → 任务 20 ✓；§6 执行顺序 → 任务分组即按序 ✓；§7 风险 → 各任务验证步骤已含 baseline 重生成顺序与 demo 样本同步 ✓

**2. 占位符扫描**：无"待定/TODO/后续实现"。任务 13 的测试文件"若尚无则新建 design-contract-logic.test.ts"——确认 `__tests__` 下确实无该文件（有 `__tests__` 列表核对：仅 gate-enhancement/verifier/.../无 design-contract-logic.test.ts），新建即可。任务 18 `__tests__` 引用 check-opsx 测试——确认无 opsx-artifacts 单测文件，新增。

**3. 类型一致性**：
- `splitMarkdownSections`/`splitByLines`/`estimateTokens` 在任务 1 定义、任务 2 测试引用（需导出）✓
- `checkSdToCodeModuleMapping`（gate-logic）与 `checkSdToCodeModule`（code-tla-logic）名称不同，任务 3/11 各自引用正确文件 ✓
- R6/crossLogic 字段名（`crossCutsSourceTypeViolations`）来自 check-requirement-graph.ts 现有代码 ✓
- `isPhase1PureReq` 语义以 graph-logic.ts:771 为准，任务 8 已注明核对精确判定 ✓
