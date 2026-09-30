# 门禁工程（批次 3）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 给门禁诊断加符号级 subject/fixHints（四热点门禁）、签名链 sigHash v2 版本化字节绑定 + GATE_JSON verifiedArtifacts、根因报告 scope 强制，并落地总纲 §5.1 四项同期项。

**架构：** 机制层单点扩展（lib/types.ts 增 subject/fixHints/verifiedArtifacts；signature-chain-logic 增 v2 公式分流 + R11；root-cause-logic R4 扩展），四热点门禁按映射表填充，schemas 三处先行（additionalProperties:false 强制），文档消费契约两处（signature-chain-guide §6.2、subagent-delegation scope 对照）。

**技术栈：** TypeScript + tsx + vitest（config/vitest.config.ts）；ajv schema 校验（infrastructure/schema-loader）；无新依赖、无新 CLI 脚本。

**规格：** [2026-10-01-gate-engineering-design.md](../specs/2026-10-01-gate-engineering-design.md)；跨批次契约：[批次总纲 §4](../specs/2026-09-30-absorption-batches-master-outline.md)。

> **⚠️ 前置条件（D10）**：本计划实现**待批次 1（feature/batch1-sdmap-anchors，17 提交）合入 main 后**启动，实现分支自合并后 main 开启。本文行号以分支 feature/batch1-sdmap-anchors 版文件为准（采集于 2026-10-01）；`signature-chain-logic.ts`、schemas、samples/signature-chain、samples/rootcause 两分支一致，`lib/types.ts`/`gate-logic.ts`/`self-test.ts`/`command-reference.md`/`conventions.md` 以分支版为准。

---

## 与规格的偏差与澄清（实施前必读）

1. **verifier-logic 与 design-contract-logic 均无双轨**（采集实证：`verifier-logic.ts` grep structuredViolations 零命中；`design-contract-logic.ts:23-25` 结果仅 {passed, reasons, violations}）——B1 对这两门禁是**引入**结构化双轨（新建规则常量 + structured 填充 + CLI 透传），不是增量加字段。工作量高于规格表观感，计划按引入编排（任务 6/8）。
2. **command-reference.md 无 check-signature-chain 独立条目**（仅泛引）——R11 的 command-reference 同步改为：更新 `check-rootcause-report` 条目（R4-scope）+ **AGENTS.md §8 两行**（check-signature-chain 行补 R11/v2、check-rootcause-report 行补 R4-scope）；不为 check-signature-chain 新建条目（避免扩文档面）。
3. **gate-log.schema.json 的 script enum 仅 3 个生产脚本**（L12）——verifiedArtifacts 为顶层可选字段，不扩 enum；四热点门禁的 GATE_JSON/JsonReport 透传即可，gate-log 落盘面自然跟随（仅 3 脚本产 gate-log）。
4. **differences 透传取最小面**：`printJsonReport` 增 `differences` 键；`printGateReport` 手写计数清单**不动**（R 消费走 --json，总纲「透传一行」的最小兑现）。

## 文件结构（改动面锁定）

| 文件 | 动作 | 职责 |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | 修改（§10.8 签名链 v2/R11、§10L 诊断面、根因 scope 强制对应节） | 设计先行 |
| `w-model-dev/schemas/signature-chain.schema.json` | 修改（entry.sigHashAlgo、SourceArtifact.sha256） | schema 先行 |
| `w-model-dev/schemas/gate-log.schema.json` | 修改（顶层可选 verifiedArtifacts） | 同上 |
| `w-model-dev/schemas/rootcause-report.schema.json` | 修改（fixRecommendation.items.scope 进 required） | 同上 |
| `w-model-dev/scripts/lib/types.ts` | 修改（StructuredViolation.subject/fixHints、JsonReport.verifiedArtifacts） | 类型基座 |
| `w-model-dev/scripts/logic/signature-chain-logic.ts` | 修改（computeSigHash 分流、R6 分流、R11） | B2 核心 |
| `w-model-dev/scripts/logic/root-cause-logic.ts` | 修改（R4 scope 强制） | B3 核心 |
| `w-model-dev/scripts/logic/gate-logic.ts` | 修改（SDMAP structured subject/fixHints、SDMAP-5 结构化收编） | B1 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | 修改（verifiedArtifacts 接线 + 透传） | B1/B2 |
| `w-model-dev/scripts/logic/design-contract-logic.ts` + `cli/check-design-contract-consistency.ts` | 修改（引入双轨 + verifiedArtifacts） | B1/B2 |
| `w-model-dev/scripts/logic/code-tla-logic.ts` + `cli/check-code-tla-consistency.ts` | 修改（四维度 subject/fixHints + verifiedArtifacts） | B1/B2 |
| `w-model-dev/scripts/logic/verifier-logic.ts` + `cli/check-verifier-output.ts` | 修改（引入双轨 + verifiedArtifacts） | B1/B2 |
| `w-model-dev/scripts/logic/state-machine-logic.ts` + `cli/check-state-machine-consistency.ts` | 修改（classification 挂钩 + differences 透传） | 同期 |
| `w-model-dev/scripts/cli/self-test.ts` | 修改（SIGNATURE_CHAIN_CASES +3、ROOTCAUSE_CASES +1） | 负向覆盖 |
| `w-model-dev/scripts/samples/signature-chain/`（+3 fixture）、`samples/rootcause/`（16 文件补 scope + 1 新 fixture） | 修改/新增 | 样本 |
| `w-model-dev/scripts/__tests__/code-gate-parity.test.ts` | 新增 | property 测试 |
| 文档：`signature-chain-guide.md`（§6.2）、`root-cause-locator.md`（§4.4+Schema）、`subagent-delegation.md`（scope 对照）、`command-reference.md`（rootcause 条目）、`conventions.md`（4 术语）、`AGENTS.md`（2 行）、`CHANGELOG.md`+`package.json`（42.7.0） | 修改 | 同步面 |

**不新增**：cli 脚本、references 文件、pre-push 项。

---

### 任务 1：SSoT 修订 + schemas 三处（设计先行）

**文件：**
- 修改：`docs/skill-design-document_SSoT.md`（三处：签名链条目层「sigHashAlgo v1|v2 + v2 公式纳入产物清单整体 + R11 sha256 必填」；诊断面「StructuredViolation.subject/fixHints 四热点填充与 R 消费」；根因报告「fixRecommendation.scope 强制 + V 对照消费」——以内容定位节，签名链权威节为 §10.8 邻域、诊断词汇为 §10L.4 邻域）
- 修改：`w-model-dev/schemas/signature-chain.schema.json`（L63 sigHash 后增 `sigHashAlgo`：`{type:"string", enum:["v1","v2"], description:"sigHash 公式版本；缺省 v1。v2 将 artifacts 与 sourceArtifacts 两清单整体（含 sha256）纳入公式；v2 条目适用 R11"}`；L94-101 SourceArtifact properties 内增 `sha256: {type:"string", pattern:"^[a-fA-F0-9]{64}$", description:"来源产物内容哈希（v2 链必填，R11）"}`）
- 修改：`w-model-dev/schemas/gate-log.schema.json`（L46 stdoutSummary 后增顶层可选 `verifiedArtifacts: {type:"array", items:{type:"object", additionalProperties:false, required:["path","sha256","bytes"], properties:{path:{type:"string"}, sha256:{type:"string",pattern:"^[a-fA-F0-9]{64}$"}, bytes:{type:"number",minimum:0}}}, description:"本次门禁判定承重输入文件字节清单（消费前可复验同一字节）"}`）
- 修改：`w-model-dev/schemas/rootcause-report.schema.json`（L194-198 邻域 items 内增 `scope: {type:"object", additionalProperties:false, required:["allowed","forbidden"], properties:{allowed:{type:"array",items:{type:"string",minLength:1}}, forbidden:{type:"array",items:{type:"string",minLength:1}}}, description:"修复范围声明：allowed=允许触碰面，forbidden=禁改面（测试/语义/证据）。R4 强制：至少一侧非空。V scoped re-review 对照消费"}`，并把 `scope` 加入 items.required）

- [ ] **步骤 1**：SSoT 三处修订（措辞与规格 §4.1/§5/§6.1 逐字对齐；v2 增益边界半句「声明不可抵赖；声明 vs 真实字节的自动核查待 gate-log 索引基建」须在 SSoT 在场）
- [ ] **步骤 2**：schemas 三处字段增补（全部可选入 properties、仅 rootcause scope 入 items.required；description 逐字）
- [ ] **步骤 3**：验证 `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0
- [ ] **步骤 4**：Commit：`docs(ssot+schema): sigHash v2/R11 + subject/fixHints 诊断面 + fixRecommendation.scope 强制（批次3 任务1，SSoT+schema 先行）`

### 任务 2：类型基座（subject/fixHints/verifiedArtifacts）

**文件：** 修改 `w-model-dev/scripts/lib/types.ts`（StructuredViolation :14-20 邻域、JsonReport verifiedArtifacts 键）；测试 `__tests__/gate-enhancement.test.ts` 末尾追加

- [ ] **步骤 1：失败测试**（类型契约——RED 由 tsc 承载，vitest 对纯类型恒绿为既定口径）：

```typescript
describe('批次3 诊断面类型契约', () => {
  it('subject/fixHints 可选且 fixHints 为字符串数组', () => {
    const v: StructuredViolation = { rule: 'SDMAP-1', message: 'x', classification: 'semantic', subject: 'SD-2.2', fixHints: ['补条目', '核对 graph'] };
    expect(v.subject).toBe('SD-2.2');
    expect(v.fixHints).toHaveLength(2);
  });
  it('JsonReport.verifiedArtifacts 可选三字段', () => {
    const r: JsonReport = { type: 'artifact-gate', passed: true, reasons: [], violations: {}, verifiedArtifacts: [{ path: '.w-model/rtm.json', sha256: 'a'.repeat(64), bytes: 10 }] };
    expect(r.verifiedArtifacts![0]!.bytes).toBe(10);
  });
});
```

- [ ] **步骤 2**：`npm run --silent typecheck` 确认 RED（TS2353/TS2339）
- [ ] **步骤 3：实现**——StructuredViolation 增：

```typescript
  /** 批次 3（总纲 §4.2）：符号级定位（面向修复者 LLM），四热点门禁填充 */
  subject?: string;
  /** 批次 3：修复建议（≤3 条祈使句） */
  fixHints?: string[];
```

JsonReport 增（sdmapViolations 后）：

```typescript
  /** 批次 3 B2：本次判定承重输入文件字节清单（消费前可复验同一字节）；四热点门禁填充 */
  verifiedArtifacts?: Array<{ path: string; sha256: string; bytes: number }>;
```

- [ ] **步骤 4**：typecheck exit 0 + 聚焦 vitest（gate-enhancement）PASS
- [ ] **步骤 5**：Commit：`feat(types): StructuredViolation.subject/fixHints + JsonReport.verifiedArtifacts（批次3 任务2）`

### 任务 3：signature-chain v2（公式分流 + R11）+ 样本

**文件：** 修改 `logic/signature-chain-logic.ts`（:113-124 computeSigHash 邻域、:314 R6、:386 后 R11）；新增 `samples/signature-chain/valid-v2.jsonl`、`bad-v2-missing-sha256.jsonl`、`bad-v2-tampered-sha256.jsonl`；修改 `cli/self-test.ts`（SIGNATURE_CHAIN_CASES :2474 邻域 +3）；测试 `__tests__/signature-chain-logic.test.ts` 扩展

- [ ] **步骤 1：失败测试**（logic 单测）：

```typescript
describe('批次3 sigHash v2', () => {
  const base = { sigId: 'sig-v2-1', phase: 5, role: 'G' as const, action: 'gate', runId: 'r1', artifacts: ['out/gate.json'], prevSigId: '', prevSigHash: '', signedAt: '2026-10-01T00:00:00.000Z', signer: 'G', inputProvenance: { sourceSigIds: [], sourceArtifacts: [{ path: 'out/gate.json', sourceSigId: 'sig-0', sourceRole: 'G' as const, sha256: 'a'.repeat(64) }], transformDescription: 't' }, sigHashAlgo: 'v2' as const };
  it('v2 公式纳入 sha256：篡改 sha256 → R6', () => {
    const tampered = { ...base, inputProvenance: { ...base.inputProvenance, sourceArtifacts: [{ ...base.inputProvenance.sourceArtifacts[0]!, sha256: 'b'.repeat(64) }] } };
    expect(computeSigHash(tampered as never)).not.toBe(computeSigHash(base as never));
  });
  it('v1 链缺省重算与现状逐字节一致', () => {
    const v1 = { ...base }; delete (v1 as Record<string, unknown>).sigHashAlgo;
    delete (v1.inputProvenance.sourceArtifacts[0] as Record<string, unknown>).sha256;
    expect(computeSigHash(v1 as never)).toBe(computeSigHash(v1 as never)); // 幂等
  });
  it('R11：v2 条目 sha256 缺失/非 64-hex → 违规；v1 条目不触发', () => {
    const missing = { ...base, inputProvenance: { ...base.inputProvenance, sourceArtifacts: [{ path: 'x', sourceSigId: 's', sourceRole: 'G' as const }] } };
    const r = checkSignatureChain([missing]);
    expect(r.violations.some((v: string) => v.startsWith('R11'))).toBe(true);
    const v1Entry = { ...missing, sigHashAlgo: undefined };
    expect(checkSignatureChain([v1Entry]).violations.some((v: string) => v.startsWith('R11'))).toBe(false);
  });
});
```

- [ ] **步骤 2**：聚焦 vitest RED（computeSigHash 不分流/R11 不存在）
- [ ] **步骤 3：实现**——

```typescript
export type SigHashAlgo = 'v1' | 'v2';
function artifactsV2(entry: SignatureChainEntry): string {
  return JSON.stringify({ artifacts: entry.artifacts, sourceArtifacts: entry.inputProvenance?.sourceArtifacts ?? [] });
}
export function computeSigHashV2(entry: Omit<SignatureChainEntry, 'sigHash'>): string {
  const input = `${entry.sigId}|${entry.phase}|${entry.role}|${entry.action}|${entry.runId}|${artifactsV2(entry as SignatureChainEntry)}|${entry.prevSigHash}|${entry.signedAt}|${entry.signer}|${JSON.stringify(entry.inputProvenance)}`;
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}
export function computeSigHashFor(entry: Omit<SignatureChainEntry, 'sigHash'>): string {
  return (entry as SignatureChainEntry).sigHashAlgo === 'v2' ? computeSigHashV2(entry) : computeSigHash(entry);
}
```

R6 处（:314 邻域）改调 `computeSigHashFor`（按条目 algo 分流）；R11 新块（R10 后）：`sigHashAlgo==='v2'` 时遍历 `inputProvenance.sourceArtifacts`，`sha256` 缺失或不匹配 `^[a-fA-F0-9]{64}$` → `R11: <sigId> v2 条目来源 sha256 缺失或非法`。

- [ ] **步骤 4**：三个新 fixture（`node -e` 实算 sha256 与 sigHash 填入；valid-v2 全合规过；bad-v2-missing-sha256 → R11；bad-v2-tampered-sha256 = 合法 v2 后手工改一个 sha256 字符但保留原 sigHash → R6）；self-test SIGNATURE_CHAIN_CASES +3（expectedPassed / expectedRulesFailed: ['R11'] / ['R6']）
- [ ] **步骤 5**：聚焦 vitest + self-test exit 0（**既有 14 个 v1 样本零破坏**）+ typecheck
- [ ] **步骤 6**：Commit：`feat(chain)!: sigHash v2 公式版本化（artifactsV2 纳入内容哈希）+ R11 sha256 必填（批次3 任务3）`

### 任务 4：root-cause R4 scope 强制 + 存量补齐

**文件：** 修改 `logic/root-cause-logic.ts`（:391 R4 邻域）；`samples/rootcause/` 16 文件（valid* 补 scope；bad-r1..bad-r11 等含 fixRecommendation 者补 scope——它们因各自目标规则仍失败，R4 不再额外触发）；新增 `samples/rootcause/bad-r4-scope-missing.json`；`cli/self-test.ts` ROOTCAUSE_CASES（:1684 邻域）+1；测试 `__tests__/root-cause-logic.test.ts`（若无则新建）扩展

- [ ] **步骤 1：失败测试**：

```typescript
describe('批次3 R4 scope 强制', () => {
  it('缺 scope → R4 违规', () => {
    const r = checkRootCauseReport(makeReport({ fixRecommendation: [{ target: 't', location: 'l', action: 'a', rationale: 'r' }] }));
    expect(r.violations.some((v: string) => v.includes('R4') && v.includes('scope'))).toBe(true);
  });
  it('空双数组 / 非字符串项 → R4 违规', () => {
    expect(checkRootCauseReport(makeReport({ fixRecommendation: [{ target: 't', location: 'l', action: 'a', rationale: 'r', scope: { allowed: [], forbidden: [] } }] })).violations.some((v: string) => v.includes('scope'))).toBe(true);
    expect(checkRootCauseReport(makeReport({ fixRecommendation: [{ target: 't', location: 'l', action: 'a', rationale: 'r', scope: { allowed: [''], forbidden: [] } }] })).violations.some((v: string) => v.includes('scope'))).toBe(true);
  });
  it('合规 scope（单侧非空）→ 通过', () => {
    expect(checkRootCauseReport(makeReport({ fixRecommendation: [{ target: 't', location: 'l', action: 'a', rationale: 'r', scope: { allowed: ['src/auth/**'], forbidden: ['src/auth/login.test.ts'] } }] })).violations.filter((v: string) => v.includes('scope'))).toEqual([]);
  });
});
```

- [ ] **步骤 2**：RED
- [ ] **步骤 3：实现**（R4 块内追加）：

```typescript
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
recs.forEach((rec: RootCauseFixRecommendation, i: number) => {
  const s = rec.scope;
  const ok = !!s && Array.isArray(s.allowed) && Array.isArray(s.forbidden)
    && (s.allowed.length > 0 || s.forbidden.length > 0)
    && s.allowed.every(isNonEmptyString) && s.forbidden.every(isNonEmptyString);
  if (!ok) violations.push(`R4: fixRecommendation[${i}] 缺合规 scope（{allowed,forbidden} 双数组必填，至少一侧非空，项为非空字符串）`);
});
```

（RootCauseFixRecommendation 类型增 `scope: { allowed: string[]; forbidden: string[] }` 必填。）
- [ ] **步骤 4**：16 个存量样本补 scope（各按其 target 语义写 allowed/forbidden，如 `allowed:['src/auth/**'], forbidden:['src/auth/login.test.ts']`）；新增 bad-r4-scope-missing.json（其余字段合规、仅缺 scope）；self-test ROOTCAUSE_CASES +1（期望 `/R4.*scope/`）
- [ ] **步骤 5**：聚焦 vitest + self-test exit 0（**bad-r4 原 `/fixRecommendation.*rationale/` 用例仍过**）+ typecheck
- [ ] **步骤 6**：Commit：`feat(rootcause)!: R4 强制 fixRecommendation.scope（双数组至少一侧非空）+ 存量样本补齐（批次3 任务4）`

### 任务 5：B1/B2 artifact-gate（SDMAP subject/fixHints + SDMAP-5 结构化 + verifiedArtifacts）

**文件：** 修改 `logic/gate-logic.ts`（SDMAP structured 填充 :288-344、checkCodeModuleFormat :356-403）；`cli/check-artifact-gate.ts`（verifiedArtifacts 构建与透传）；测试 `__tests__/gate-enhancement.test.ts` + `__tests__/gate-test-evidence.test.ts`

- [ ] **步骤 1：失败测试**（gate-enhancement SDMAP describe 内追加）：

```typescript
it('批次3 SDMAP structured 带 subject 与 fixHints', () => {
  const graph = { nodes: [{ id: 'SD-2.2', type: 'SD' }] };
  const r = checkSdToCodeModuleMapping(graph, rowsOf('SD-2.1:src/a.ts:L1') as never, new Map([['src/a.ts', 3]]));
  const s1 = r.structured.find((s) => s.rule === 'SDMAP-1')!;
  expect(s1.subject).toBe('SD-2.2');
  expect(s1.fixHints!.length).toBeGreaterThan(0);
  expect(s1.fixHints!.length).toBeLessThanOrEqual(3);
});
it('批次3 SDMAP-5 结构化收编 sdmapViolations（semantic）', () => {
  // checkCodeModuleFormat 产出 structured（rule 'SDMAP-5'，classification 'semantic'，subject=条目 raw）
  const v = checkCodeModuleFormat(rowsOf('SD-2.1:src/bad.ts') as never);
  expect(v.structured?.[0]?.rule).toBe('SDMAP-5');
  expect(v.structured?.[0]?.classification).toBe('semantic');
});
```

- [ ] **步骤 2**：RED
- [ ] **步骤 3：实现**——gate-logic.ts 增常量表（模块级）：

```typescript
const SDMAP_FIX_HINTS: Record<string, string[]> = {
  'SDMAP-1': ['在 rtm.json 对应 REQ 行 codeModule 增加前缀为该 SD id 的条目', '确认该 SD 节点属本阶段设计范围，否则修正 graph.json'],
  'SDMAP-2': ['删除或修正该条目的 SD 前缀', '若为新增子系统，先补 graph.json SD 节点再回填 RTM'],
  'SDMAP-3': ['修正 src 路径拼写', '若文件已删除，更新 RTM 指向现存实现或移除该条目'],
  'SDMAP-4': ['校正行号区间到文件真实行数内', '用编辑器行号或 git diff 定位真实位置'],
  'SDMAP-5': ['按 SD-<id>:src/<path>:L<start>[-<end>] 语法补齐条目', 'NFR/CON 行不得携带 SD- 前缀，配置类约束用「横切」'],
};
```

SDMAP-1/2/3/4 structured.push 处补 `subject`（SDMAP-1/2=SD id；3/4=entry.srcPath）与 `fixHints: SDMAP_FIX_HINTS[rule]`；`checkCodeModuleFormat` 增第二返回值结构（返回 `{ violations: string[]; structured: StructuredViolation[] }`，rule 'SDMAP-5'、classification 'semantic'、subject=e.raw、fixHints=SDMAP_FIX_HINTS['SDMAP-5']），调用处（主函数 :1690 邻域与自身消费方）适配——**文案前缀「codeModule 格式错误」保留**（self-test :468 依赖）；SDMAP-5 structured 并入 `result.sdmapViolations`。
- [ ] **步骤 4：verifiedArtifacts 接线**——check-artifact-gate.ts 在 rtm/graph/tickets 读取完成后构建：

```typescript
const verifiedArtifacts: Array<{ path: string; sha256: string; bytes: number }> = [];
const addVerified = (abs: string, rel: string) => { try { const buf = nodeFs.readFileSync(abs); verifiedArtifacts.push({ path: rel, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length }); } catch { /* 不存在不入表 */ } };
addVerified(rtmFile, ARTIFACT_PATHS.rtm);
if (graphAssetPath) addVerified(graphAssetPath, path.relative(projectDir, graphAssetPath));
if (ticketsFile) addVerified(ticketsFile, path.relative(projectDir, ticketsFile));
```

（graphAssetPath 为 `discoverGraphAsset` 返回的绝对路径，若现函数只返目录则适配取文件路径；createHash import 自 node:crypto。）`--json` 与 GATE_JSON 两路增 `verifiedArtifacts` 键（恒存在，允许空数组——照 sdmapViolations 先例）。
- [ ] **步骤 5**：聚焦 vitest（gate-enhancement + gate-test-evidence）→ self-test → typecheck
- [ ] **步骤 6**：Commit：`feat(gate): SDMAP structured subject/fixHints + SDMAP-5 结构化 + verifiedArtifacts 接线（批次3 任务5）`

### 任务 6：B1/B2 design-contract（引入双轨 + verifiedArtifacts）

**文件：** 修改 `logic/design-contract-logic.ts`（:14-25 邻域 + :221-224 邻域）、`cli/check-design-contract-consistency.ts`（:286-300 printJsonReport、:320 printGateReport、:221-226/:268-270 输入读取）；测试 `__tests__/design-contract-logic.test.ts`（若无则新建，照既有 CLI 集成形态）

- [ ] **步骤 1：失败测试**：

```typescript
it('批次3 双轨：违规带 rule/subject/fixHints', () => {
  const r = checkDesignContractConsistency(makeInputWithMismatch()); // 照既有用例输入构造
  const v = r.violations[0]!;
  expect(v.rule).toBe(v.dimension); // 'D1'|'D2'|'D3'|'D4'
  expect(typeof v.subject).toBe('string');
  expect(v.fixHints!.length).toBeGreaterThan(0);
});
```

- [ ] **步骤 2**：RED
- [ ] **步骤 3：实现**——`DesignContractViolation` 增 `rule: string`（=dimension）、`subject: string`（D1=`"<uatPath> → <actualPath>"`，D2=参数名，D3=状态码对，D4=字段名——实现时按各 dimension 的 expected/actual 语义取）、`fixHints: string[]`（把 :222-224 风格 message 内嵌指引文本抽为数组，每 dimension 1-2 条）；`checkDesignContractConsistency` 结果增 `structuredViolations: StructuredViolation[]`（classification：D1/D2='semantic'、D3/D4='semantic'——契约一致性全为 semantic）；message 保留原文本（前缀 `[D1]` 等既有形态不动，消费者兼容）。
- [ ] **步骤 4：verifiedArtifacts**——CLI 在 :221-226/:268-270 读取处对**实际被 parse 的文件**登记（uat-path-mapping.md + src/routes/tests-acceptance 中被扫描的单文件），透传进 printJsonReport（新增键）与 printGateReport（不动的手写清单外，仅 --json 承载）。
- [ ] **步骤 5**：聚焦 vitest + self-test（DESIGN_CONTRACT_CASES 若存在）+ typecheck
- [ ] **步骤 6**：Commit：`feat(contract): design-contract 结构化双轨（rule/subject/fixHints）+ verifiedArtifacts（批次3 任务6）`

### 任务 7：B1/B2 code-tla（四维度 subject/fixHints + verifiedArtifacts）

**文件：** 修改 `logic/code-tla-logic.ts`（structured 填充点 :253/:266/:395/:551/:652/:774）、`cli/check-code-tla-consistency.ts`（:221-227 输入读取、:253-261 透传）；测试 `__tests__/code-tla-logic.test.ts`

- [ ] **步骤 1：失败测试**：

```typescript
it('批次3 四维度 structured 带 subject/fixHints', () => {
  const r = checkCodeTlaConsistency(makeInput()); // 照既有用例（含 D2 缺转移）
  const d2 = r.dimensions.codeStateTransfer.structuredViolations?.[0];
  expect(d2?.subject).toBeDefined();
  expect(d2?.fixHints!.length).toBeGreaterThan(0);
});
```

- [ ] **步骤 2**：RED
- [ ] **步骤 3：实现**——常量表：

```typescript
const CODE_TLA_FIX_HINTS: Record<string, string[]> = {
  'SDMAP-1': ['为该 SD 在 rtm.json 补前缀精确的 codeModule 条目'],
  'SDMAP-2': ['删除该幽灵前缀条目或先补图节点'],
  'CODE_TLA_D2': ['在设计文档补该状态转移或修正代码状态机实现'],
  'CODE_TLA_D3': ['为该 action 补实现或修正 TLA+ Next 分支'],
  'CODE_TLA_D4': ['为该不变量补代码侧断言或测试'],
  'INPUT-NO-SHARED-SD': ['核对 graph 与 rtm 是否描述同一系统；版本错位则回退到对应阶段产物'],
  'CODE_TLA_INPUT': ['修正 manifest/graph/rtm 输入路径与结构'],
  'CODE_TLA_SCHEMA': ['按 code-tla-manifest schema 修正字段'],
};
```

各填充点补 `subject`（D1=SD id；D2=transitionKey（from→to [event]）；D3=action 名；D4=invariant 名；INPUT/SCHEMA=文件路径）与 `fixHints: CODE_TLA_FIX_HINTS[rule] ?? []`；分类维持批次 1 已填 classification。
- [ ] **步骤 4：verifiedArtifacts**——CLI :221-223 readJsonOrExit 三输入 + loadTlaContents 的 .tla 文件登记（相对 projectDir 路径），:253-261 printJsonReport 增键透传（printGateReport 不动）。
- [ ] **步骤 5**：聚焦 vitest + self-test（CODE_TLA_CASES `/SD-REVIEW 无对应 codeModule/` 前缀仍过）+ typecheck
- [ ] **步骤 6**：Commit：`feat(tla): 四维度 structured subject/fixHints + verifiedArtifacts（批次3 任务7）`

### 任务 8：B1/B2 verifier-output（引入双轨 + verifiedArtifacts）

**文件：** 修改 `logic/verifier-logic.ts`（:117-125 结果接口、:411/:520 等违规点）、`cli/check-verifier-output.ts`（:118-129 printJsonReport）；测试 `__tests__/verifier-logic.test.ts`（若无为新建——既有 verifier 测试文件先 grep 确认）

- [ ] **步骤 1：失败测试**：

```typescript
it('批次3 双轨：verifier 违规带 rule/subject/fixHints', () => {
  const r = checkVerifierOutput(makeBadVarianceOutput()); // 照既有方差用例构造
  const v = r.structuredViolations?.find((s) => s.rule === 'VERIFIER-VARIANCE');
  expect(v?.subject).toContain('subCriteria');
  expect(v?.fixHints!.length).toBeGreaterThan(0);
});
```

- [ ] **步骤 2**：RED（VerifierCheckResult 无 structuredViolations）
- [ ] **步骤 3：实现**——常量与映射：

```typescript
const VERIFIER_FIX_HINTS: Record<string, string[]> = {
  'VERIFIER-SCHEMA': ['按 verifier-output schema 修正 schemaVersion 与必填字段'],
  'VERIFIER-SCORE': ['对低于 0.70 的子标准补 evidence 定位后重评，不得改分数'],
  'VERIFIER-VARIANCE': ['方差超阈值属不可重复评审：换 Persona/新上下文重评'],
  'VERIFIER-EVIDENCE': ['evidence 补 <路径>:<定位>=<值> 形态；禁裸声明'],
  'VERIFIER-STRUCTURE': ['补齐缺失字段后重新提交'],
};
```

`VerifierCheckResult` 增 `structuredViolations?: StructuredViolation[]`；在各违规 push 处同步填 structured（rule ∈ 上表；subject=字段路径如 `subCriteria[2].variance` 或 `schemaVersion`；classification='semantic'）；reasons 文本保留（既有消费者兼容）。
- [ ] **步骤 4：verifiedArtifacts**——CLI 读入的被验 JSON 文件登记，:118-129 printJsonReport 增键（printGateReport 不动）。
- [ ] **步骤 5**：聚焦 vitest + self-test（VERIFIER_CASES 既有正则不破）+ typecheck
- [ ] **步骤 6**：Commit：`feat(verifier): 结构化双轨（VERIFIER-* 规则/subject/fixHints）+ verifiedArtifacts（批次3 任务8）`

### 任务 9：同期项 1+4（state-machine 透传 + 类型挂钩 + 救场用例）

**文件：** 修改 `logic/state-machine-logic.ts`（differences 类型 :35-41）、`cli/check-state-machine-consistency.ts`（:101-111 printJsonReport）；测试 `__tests__/state-machine-logic.test.ts`

- [ ] **步骤 1：失败测试**：

```typescript
it('批次3 classification 挂钩权威类型 + sharedTransition 救场', () => {
  const cls: ChangeClassification = 'topology';
  const r = checkStateMachineConsistency({
    designStates: ['a'], codeStates: ['x'], // 状态零交集
    designTransitions: [{ from: 'a', to: 'b' }], codeTransitions: [{ from: 'a', to: 'b' }], // 转移有交集
  });
  expect(r.reasons.some((s: string) => s.includes('cannot prove same system'))).toBe(false); // 救场路径
  expect(r.differences!.every((d) => d.classification === cls)).toBe(true);
});
```

（文件顶部 `import type { ChangeClassification } from '../lib/types.js';`）
- [ ] **步骤 2**：RED（类型挂钩前 classification 为内联字面量——本任务改为 `classification: Extract<ChangeClassification, 'topology'>`；救场用例预期新过则 RED 不成立，改以类型断言编译期验证 + 现有用例回归）
- [ ] **步骤 3：实现**——differences 类型挂钩；CLI printJsonReport（:101-111）增 `differences: result.differences ?? []`（printGateReport 不动，偏差 4）。
- [ ] **步骤 4**：聚焦 vitest + self-test + typecheck
- [ ] **步骤 5**：Commit：`feat(sm): differences 权威类型挂钩 + CLI 透传 + 救场路径用例（批次3 任务9）`

### 任务 10：同期项 3（双实现 property 测试）

**文件：** 新增 `__tests__/code-gate-parity.test.ts`

- [ ] **步骤 1：编写测试**（表驱动；投影 = `${rule}@${field ?? subject}`）：

```typescript
import { checkArtifactGate } from '../logic/gate-logic';
import { checkCodeTlaConsistency } from '../logic/code-tla-logic';

const CASES: Array<{ name: string; graph: { nodes: Array<{ id: string; type: string }> }; rows: Array<Record<string, string>> }> = [
  { name: '全对齐', graph: { nodes: [{ id: 'SD-AUTH', type: 'SD' }] }, rows: [{ requirementId: 'REQ-1', codeModule: 'SD-AUTH:src/auth.ts:L1' }] },
  { name: '缺映射', graph: { nodes: [{ id: 'SD-AUTH', type: 'SD' }] }, rows: [{ requirementId: 'REQ-1', codeModule: 'SD-BILL:src/b.ts:L1' }] },
  { name: '幽灵前缀', graph: { nodes: [{ id: 'SD-AUTH', type: 'SD' }] }, rows: [{ requirementId: 'REQ-1', codeModule: 'SD-AUTH:src/a.ts:L1, SD-GHOST:src/g.ts:L1' }] },
  { name: '多 SD 混合', graph: { nodes: [{ id: 'SD-A', type: 'SD' }, { id: 'SD-B', type: 'SD' }] }, rows: [{ requirementId: 'REQ-1', codeModule: 'SD-A:src/a.ts:L1' }, { requirementId: 'REQ-2', codeModule: 'SD-C:src/c.ts:L1' }] },
  { name: '数字层级', graph: { nodes: [{ id: 'SD-5.2.1', type: 'SD' }] }, rows: [{ requirementId: 'REQ-1', codeModule: 'SD-5.2.1:src/auth/login.ts:L42-58' }] },
];

describe.each(CASES)('双实现一致性（批次3 property）: $name', ({ graph, rows }) => {
  const project = (sv: Array<{ rule: string; field?: string }>) => new Set(sv.map((s) => `${s.rule}@${s.field ?? ''}`));
  it('gate SDMAP ≡ code-tla D1（rule@field 投影集合相等）', () => {
    const gate = checkArtifactGate(makeMatrix(rows), { graph, phaseOption: 5 });
    const tla = checkCodeTlaConsistency(makeTlaInput(graph, rows));
    expect(project(tla.dimensions.sdToCodeModule.structuredViolations ?? [])).toEqual(project(gate.sdmapViolations?.filter((s) => s.rule !== 'SDMAP-5') ?? []));
  });
});
```

（`makeMatrix`/`makeTlaInput` 为文件内 helper：照 gate-enhancement :900-956 与 code-tla-logic.test :69-118 既有构造拷改；投影集合语义 = 判定与规则 ID 一致，message 文案允许两实现差异。）
- [ ] **步骤 2**：`npx vitest run w-model-dev/scripts/__tests__/code-gate-parity.test.ts --config config/vitest.config.ts` → PASS（若 FAIL：分叉实证，修两实现中偏离者并向控制者上报，不得静默改语义）
- [ ] **步骤 3**：typecheck
- [ ] **步骤 4**：Commit：`test(parity): gate SDMAP ≡ code-tla D1 双实现 property 测试（批次3 任务10）`

### 任务 11：文档同步 + CHANGELOG 42.7.0 + prepush 收口

**文件：** 修改 `signature-chain-guide.md`（L171 后插 §6.2「v2 签名与 sha256 抄录」：v2 条目 sha256 必填、从上游 verifiedArtifacts 抄录、R11/R6 语义）、`root-cause-locator.md`（Schema 节 scope 撰写指引 + §4.4 扩展「R 引用 subject 定位；reworkHints 按 classification 排序并转写 fixHints（≤3 条）」）、`subagent-delegation.md`（scoped re-review 节 :230-237 邻域增「fix diff 触碰 scope.forbidden 或超出 scope.allowed → 该 finding NOT ADDRESSED / 上报 CHECKPOINT」）、`command-reference.md`（check-rootcause-report 条目 :213-218 补 R4-scope 语义）、`conventions.md` §3（inputProvenance L102 后插 4 条：subject / fixHints / verifiedArtifacts / sigHashAlgo，照 :82-85 形态）、`AGENTS.md` §8 两行（check-signature-chain 行补「R11 v2 sha256 必填 + sigHashAlgo v1|v2 分流重算」、check-rootcause-report 行补「R4 强制 scope」）、`CHANGELOG.md` + `package.json`（42.7.0）

- [ ] **步骤 1**：逐文档修改（术语/规则名与代码事实一致；AGENTS.md 两行措辞最小）
- [ ] **步骤 2**：验证：check-docs-consistency exit 0 → self-test exit 0 → typecheck → `npm run eval`（预期零影响）→ `npm run prepush`（19 项全绿，约 25 分钟）
- [ ] **步骤 3**：Commit：`chore(release): 42.7.0 批次3 收口——门禁工程（subject/fixHints 四热点/sigHash v2/R11/scope 强制/同期四项；prepush 19 项全绿）`

---

## 自检记录（计划编写者已执行）

1. **规格覆盖度**：§4.1→任务 1/3；§4.2→任务 2/5/6/7/8；§5→任务 2/5/6/7/8；§6.1→任务 1/4；§6.2 四项→任务 5（②）/9（①④）/10（③）；§7 同步面→任务 1/11 + 各任务内 CLI 透传；§8 DoD→任务 3（①②）/4（③）/5-8（④）/10（⑤）/11（⑥）。规格遗漏补齐：AGENTS.md 两行（偏差 2）、verifier/design-contract 双轨引入（偏差 1）。
2. **占位符**：无「待定/TODO」；`makeReport`/`makeInput`/`makeMatrix` 等 helper 均指明既有用例拷改来源行号。
3. **类型一致性**：`SigHashAlgo`/`computeSigHashFor`（任务 3 定义、3 消费）、`scope` 形状（任务 1 schema = 任务 4 logic = 任务 11 文档）、`subject`/`fixHints`（任务 2 定义、5/6/7/8 填充）、`verifiedArtifacts`（任务 2 定义、5/6/7/8 填充、1 schema）、`differences` 透传（任务 9）——签名一致。
