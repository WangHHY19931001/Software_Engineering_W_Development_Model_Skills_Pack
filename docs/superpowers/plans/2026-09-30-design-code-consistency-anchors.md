# 设计↔代码一致性证据化对账（批次 1）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 SD→codeModule 终检从子串匹配升级为行号锚点语法的双向精确对账（SDMAP-1..5），给一致性检查加 ChangeClassification 分类与零交集 fail-closed 守卫，修复一处悬空引用。

**架构：** 锚点语法升级 `rtm.json` 的 `codeModule` 值（`SD-<id>:src/<path>:L<start>[-<end>]`，逗号多值）；`gate-logic` 的映射校验重写为前缀精确双向对账，路径存在性/行号经 CLI 注入面（`srcLineCounts`，照 `anchorLineCounts` 先例）；`state-machine-logic` / `code-tla-logic` 增可选 classification 字段与「无共享 ID（cannot prove same system）」守卫；阻断语义不变（任何差异仍违规）。

**技术栈：** TypeScript + tsx runtime + vitest（配置 `config/vitest.config.ts`）；无新依赖、无新脚本、无新 schema 文件。

**规格：** [2026-09-30-design-code-consistency-anchors-design.md](../specs/2026-09-30-design-code-consistency-anchors-design.md)；跨批次契约：[批次总纲 §4](../specs/2026-09-30-absorption-batches-master-outline.md)。

---

## 与规格的偏差与澄清（实施前必读）

1. **code-tla D1 纳入本计划（规格 §4.2 的完整落地）**：复核发现 SD→codeModule 有**两份独立实现**——`gate-logic.ts:205` 与 `code-tla-logic.ts:186`（D1，前缀+子串回退）。只改 gate-logic 会导致 `check-artifact-gate` 与 `check-code-tla-consistency` 对同一 rtm.json 给出分叉判定。任务 6 同步升级 D1，语义与 gate-logic 完全一致。
2. **存量数字修正（规格 §4.5 的 36 处/19 文件为估算）**：实测 (a) `samples/gate/` 14 文件 21 行；(b) `__tests__/` 5 文件 15 行（其中 `gate-enhancement.test.ts:900` 一行是断言文案非数据）；(c) `samples/code-tla/` 2 文件用命名 SD（如 `SD-AUTH`）+ 无前缀 `src/auth.ts` 形态，同受 D1 匹配语义影响；(d) `eval/e2e/demo-assets/build_workspace.py` 5 处（生成器，须同步）；(e) `eval/e2e/demo/`（gitignored 瞬态）与 `demo-snapshots/`（历史快照）**不改**——历史记录保原貌。
3. **B6 不加反模式 #47 关联**：#47「大规模重构式改动」的处方（小步重构）与「超标丢弃重写」存在语义张力，直接关联会误导；只删悬空括注（规格 §6 的「不匹则仅删括注」分支）。
4. **GATE_JSON 落地形态**：照 `specStructure` 先例（`types.ts:66-71`，键恒存在便于审计区分「通过」与「未执行」）增 `sdAnchorCheck: 'checked'|'skipped'|null`；结构化违规进新可选键 `sdmapViolations: StructuredViolation[]`（含 classification）。

## 文件结构（改动面锁定）

| 文件 | 动作 | 职责 |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | 修改 :388（§3.4.6 P1.4）、:1590（§10.8 追加项）、:1612（§10.8.1 维度1）、§10L 新增小节 | 设计决策先行（仓规） |
| `w-model-dev/schemas/rtm.schema.json` | 修改 codeModule 字段 description | schema 自描述同步（docs-consistency checkSchemaFieldDescriptions 强制） |
| `w-model-dev/scripts/lib/types.ts` | 修改 :11-15、JsonReport 增 2 可选键 | ChangeClassification 类型 + classification 字段 + sdAnchorCheck |
| `w-model-dev/scripts/logic/gate-logic.ts` | 重写 :205-277 | 条目解析 + SDMAP-1/2/5 + 注入面 SDMAP-3/4 |
| `w-model-dev/scripts/cli/check-artifact-gate.ts` | 修改（读 rtm 后、构造 options 处） | 构建 `srcLineCounts` 注入表 + GATE_JSON 两键 |
| `w-model-dev/scripts/logic/code-tla-logic.ts` | 修改 D1（:186-247）+ 四维度 structured classification + 零交集守卫 | 第二实现同步 + A2 |
| `w-model-dev/scripts/logic/state-machine-logic.ts` | 修改（:24-51 区域） | differences + 零交集守卫（A2） |
| `w-model-dev/scripts/cli/self-test.ts` | 修改 GATE_CASES/CODE_TLA_CASES 邻域 + GateCase 增可选字段 | 新负向用例 + 存量适配 |
| `w-model-dev/templates/rtm.md` `coding.md` | 修改示例/DoD | 锚点语法落地 |
| `w-model-dev/references/` rtm-guide / phase-5-coding / iceberg-sweep-guide / root-cause-locator / conventions / command-reference / operational-recovery | 修改 | 指引同步 + 术语登记 + B6 |
| `w-model-dev/scripts/samples/gate/*.json`（14 文件）、`samples/code-tla/*.json`（2 文件）、`__tests__/` 5 文件、`eval/e2e/demo-assets/build_workspace.py` | 修改 | 硬切补锚点 |
| `w-model-dev/scripts/samples/gate/` 新增 2 fixture、`samples/NEGATIVE-COVERAGE.md`、`samples/README.md` | 新增/修改 | 负向覆盖登记 |
| 测试 | `__tests__/gate-enhancement.test.ts` `code-tla-logic.test.ts` `state-machine-logic.test.ts`（现有文件扩展） | TDD |

**不新增**：references 文件、cli 脚本、schema 文件、pre-push 项。

---

### 任务 1：SSoT 修订 + rtm.schema.json description 同步（设计先行）

**文件：**
- 修改：`docs/skill-design-document_SSoT.md:388`（§3.4.6 P1.4）、`:1590`（§10.8「SD-codeModule 对应」追加项）、`:1612`（§10.8.1 维度1）、§10L（:2234 起，新增小节 §10L.4）
- 修改：`w-model-dev/schemas/rtm.schema.json`（codeModule 字段 description，:59-62 邻域）

- [ ] **步骤 1：改写 SSoT §10.8 追加项（:1590）**

将「`**SD-codeModule 对应**（check-code-tla-consistency.ts 维度1 + check-artifact-gate.ts 终检）：每个 SD 子系统须有对应 codeModule——违反 → exitCode=1.`」整条替换为：

```markdown
**SD-codeModule 双向精确对账**（check-code-tla-consistency.ts 维度1 + check-artifact-gate.ts 终检，两实现语义一致）：codeModule 值为行号锚点语法（REQ 条目 `SD-<id>:src/<path>:L<start>[-<end>]`，NFR/CON 条目 `src/<path>:L<start>[-<end>]`，单格逗号多值逐条目校验，`横切` 整格特例免锚点）。双向对账：①每个 SD 图节点须有 ≥1 条 REQ 条目前缀精确等于其 id（SDMAP-1）；②每条 REQ 条目 SD 前缀须存在于图 SD 节点集（SDMAP-2）；③条目 src 路径须在注入表中存在（SDMAP-3）；④锚点行号须落在文件总行数内（SDMAP-4）；⑤条目须匹配锚点语法（SDMAP-5）。SDMAP-3/4 依赖 CLI 注入面（path→总行数表），注入缺失时该两子项记 skipped（不冒充 passed，`GATE_JSON.sdAnchorCheck` 三态：checked/skipped/null）。违反任一 → exitCode=1。完成判据：每个 codeModule 断言有源证据锚点；无数量目标——不设锚点数/行数凑数指标。
```

- [ ] **步骤 2：改写 §10.8.1 维度1（:1612）**

将「读取 graph.json 中所有 type=SD 节点，核验 rtm.json 中每个 SD 节点均有对应 codeModule 映射（多段匹配…）」中的「多段匹配…」描述改为「前缀精确对账（解析 REQ 条目 `SD-<id>:` 前缀与图节点 id 全等比较；映射语义与 check-artifact-gate.ts SDMAP 一致，见 §10.8 追加项）」。保留该节其余内容。

- [ ] **步骤 3：改写 §3.4.6 P1.4（:388）**

在 P1.4 回填时机条目的 codeModule 回填描述后追加一句：「回填值须为行号锚点语法（见 §10.8 SD-codeModule 双向精确对账）；`check-artifact-gate.ts --phase>=5` 与 `check-code-tla-consistency.ts` 同步校验。」

- [ ] **步骤 4：§10L 新增 §10L.4 分类词汇小节**

在 §10L.3（:2276 冰山分母对账）之后新增：

```markdown
#### 10L.4 一致性差异分类（ChangeClassification）

一致性门禁（check-state-machine-consistency / check-code-tla-consistency / check-artifact-gate SDMAP）的差异输出附可选 `classification` 字段，取值三态（唯一权威定义见 docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md §4.1）：`semantic`（语义/映射/不变式内容差异）、`topology`（集合成员差异）、`evidence-only`（断言未变、仅证据位置失效）。分类仅供 R 根因定位与 reworkHints 排序消费，不改变阻断语义——任何真实差异仍判违规。两侧比对键均非空且零交集时 fail-closed：「无共享设计 ID（cannot prove same system）」，不判一致。
```

- [ ] **步骤 5：更新 rtm.schema.json codeModule description**

将 codeModule 字段的 description 替换为：「代码模块映射锚点。REQ 行条目格式 `SD-<id>:src/<path>:L<start>[-<end>]`（如 `SD-5.2.1:src/auth/login.ts:L42-58`），NFR/CON 行条目 `src/<path>:L<start>[-<end>]`，单格逗号分隔多条目，NFR/CON 允许整格 `横切`。行号须落在文件总行数内（门禁 SDMAP 校验）。」

- [ ] **步骤 6：验证 + Commit**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
预期：exit 0（schema 字段自描述项通过）

```bash
git add docs/skill-design-document_SSoT.md w-model-dev/schemas/rtm.schema.json
git commit -m "docs(ssot): SD-codeModule 双向精确对账 + 锚点语法 + ChangeClassification 词汇（批次1 任务1，SSoT 先行）"
```

---

### 任务 2：ChangeClassification 类型与 StructuredViolation 扩展

**文件：**
- 修改：`w-model-dev/scripts/lib/types.ts:11-15`（StructuredViolation）+ JsonReport（增 2 可选键）
- 测试：`w-model-dev/scripts/__tests__/gate-enhancement.test.ts`（新增 describe）

- [ ] **步骤 1：编写失败的类型编译测试**

在 `__tests__/gate-enhancement.test.ts` 末尾追加：

```typescript
import type { StructuredViolation } from '../lib/types';

describe('批次1 ChangeClassification 类型契约', () => {
  it('classification 为可选三值字段', () => {
    const v1: StructuredViolation = { rule: 'SDMAP-1', message: 'x' };
    const v2: StructuredViolation = { rule: 'SDMAP-3', message: 'x', classification: 'evidence-only' };
    const v3: StructuredViolation = { rule: 'SDMAP-1', message: 'x', classification: 'semantic' };
    const v4: StructuredViolation = { rule: 'SDMAP-2', message: 'x', classification: 'topology' };
    expect([v1.classification, v2.classification, v3.classification, v4.classification]).toEqual([
      undefined, 'evidence-only', 'semantic', 'topology',
    ]);
  });
});
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run w-model-dev/scripts/__tests__/gate-enhancement.test.ts --config config/vitest.config.ts`
预期：FAIL（TS 编译错：classification 不在 StructuredViolation 上）

- [ ] **步骤 3：实现类型扩展**

`lib/types.ts` 的 StructuredViolation（:11-15）改为：

```typescript
/** 一致性差异分类（批次总纲 §4.1 唯一权威；cosmetic 明确不引入） */
export type ChangeClassification = 'semantic' | 'topology' | 'evidence-only';

export interface StructuredViolation {
  rule: string;
  field?: string;
  message: string;
  /** 批次 1（总纲 §4.2）：可选分类，向后兼容；语义见总纲 §4.1 */
  classification?: ChangeClassification;
}
```

JsonReport 接口追加两个可选字段（放在 `tickets?` 之后）：

```typescript
  /** SDMAP 锚点校验执行态（照 specStructure 先例：checked=已校验/skipped=注入面缺失/null=phase<5 未触发） */
  sdAnchorCheck?: 'checked' | 'skipped' | null;
  /** SDMAP 结构化违规（含 classification）；通过且已校验时空数组 */
  sdmapViolations?: StructuredViolation[];
```

- [ ] **步骤 4：运行验证通过 + 全量类型检查**

运行：`npx vitest run w-model-dev/scripts/__tests__/gate-enhancement.test.ts --config config/vitest.config.ts` → PASS
运行：`npm run --silent typecheck` → exit 0

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/lib/types.ts w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "feat(types): ChangeClassification 类型 + StructuredViolation.classification 可选字段 + JsonReport sdAnchorCheck/sdmapViolations（批次1 任务2）"
```

---

### 任务 3：锚点条目解析与 checkCodeModuleFormat 升级（SDMAP-5）

**文件：**
- 修改：`w-model-dev/scripts/logic/gate-logic.ts:245-277`（checkCodeModuleFormat）+ 新增解析 helper（置于 :205 前）
- 测试：`__tests__/gate-enhancement.test.ts`（P0-2 describe 邻域扩展）

- [ ] **步骤 1：编写失败的测试**

在 gate-enhancement.test.ts 的 `describe('P0-2 codeModule 格式校验')` 内追加用例（`makeRow`/构造方式照该文件既有用例）：

```typescript
describe('SDMAP-5 锚点条目格式（批次1）', () => {
  const row = (cm: string) => ({ requirementId: 'REQ-001', description: 'd', designDoc: 'SD-2.1', codeModule: cm, acceptanceTest: 'UAT-001' });
  const fmt = (rows: unknown[]) => checkCodeModuleFormat(rows as never);

  it('合法：REQ 单条目带区间锚点', () => {
    expect(fmt([row('SD-2.1:src/auth/login.ts:L42-58')])).toEqual([]);
  });
  it('合法：REQ 逗号多值逐条目', () => {
    expect(fmt([row('SD-2.1:src/a.ts:L1, SD-2.1:src/b.ts:L5-9')])).toEqual([]);
  });
  it('合法：NFR 单锚点与整格横切', () => {
    expect(fmt([{ requirementId: 'NFR-001', codeModule: 'src/a.ts:L3' }])).toEqual([]);
    expect(fmt([{ requirementId: 'NFR-002', codeModule: '横切' }])).toEqual([]);
  });
  it('违规：REQ 条目缺锚点', () => {
    const v = fmt([row('SD-2.1:src/auth/login.ts')]);
    expect(v.length).toBe(1);
    expect(v[0]).toMatch(/codeModule 格式错误/);
  });
  it('违规：多值中混入缺锚点条目（逐条目报）', () => {
    const v = fmt([row('SD-2.1:src/a.ts:L1, SD-2.1:src/b.ts')]);
    expect(v.length).toBe(1);
    expect(v[0]).toContain('src/b.ts');
  });
  it('违规：NFR 双 L 区间与倒序区间', () => {
    expect(fmt([{ requirementId: 'NFR-003', codeModule: 'src/a.ts:L5-L9' }]).length).toBe(1);
    expect(fmt([{ requirementId: 'NFR-004', codeModule: 'src/a.ts:L9-5' }]).length).toBe(1);
  });
});
```

（文件顶部若无 `checkCodeModuleFormat` 导入则补：`import { checkCodeModuleFormat } from '../logic/gate-logic';`——该函数已 export，:251。）

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run w-model-dev/scripts/__tests__/gate-enhancement.test.ts --config config/vitest.config.ts`
预期：FAIL（旧正则 `^SD-[\d.]+:src/.+` 放行无锚点条目；双 L 区间未拒）

- [ ] **步骤 3：实现解析 helper + 升级 checkCodeModuleFormat**

在 gate-logic.ts `checkSdToCodeModuleMapping`（:205）之前新增：

```typescript
// ==================== SDMAP 锚点条目解析（批次1，规格 §4.1/§4.2）====================
export interface CodeModuleEntry {
  raw: string;
  /** REQ 条目的 SD 前缀 id（首个 ":" 前，id 本身不含冒号）；NFR/CON 条目为 null */
  sdId: string | null;
  srcPath: string | null;
  anchorStart: number | null;
  anchorEnd: number | null;
}

const CODE_MODULE_REQ_ENTRY = /^SD-([^:]+):(src\/[^:]+):L(\d+)(?:-(\d+))?$/;
const CODE_MODULE_NFR_ENTRY = /^(src\/[^:]+):L(\d+)(?:-(\d+))?$/;

/** 解析单格 codeModule（逗号多值逐条目）；无法解析的条目字段为 null（由 SDMAP-5 报格式） */
export function parseCodeModuleEntries(value: string): CodeModuleEntry[] {
  return value.split(',').map((part) => {
    const raw = part.trim();
    const req = CODE_MODULE_REQ_ENTRY.exec(raw);
    if (req) {
      return { raw, sdId: `SD-${req[1]}`, srcPath: req[2], anchorStart: Number(req[3]), anchorEnd: req[4] === undefined ? null : Number(req[4]) };
    }
    const nfr = CODE_MODULE_NFR_ENTRY.exec(raw);
    if (nfr) {
      return { raw, sdId: null, srcPath: nfr[1], anchorStart: Number(nfr[2]), anchorEnd: nfr[3] === undefined ? null : Number(nfr[3]) };
    }
    return { raw, sdId: null, srcPath: null, anchorStart: null, anchorEnd: null };
  });
}
```

`checkCodeModuleFormat`（:251-277）重写为（**保留「codeModule 格式错误」文案前缀**，self-test.ts:468 正则依赖）：

```typescript
export function checkCodeModuleFormat(rows: RTMRowShape[]): string[] {
  const violations: string[] = [];
  for (const row of rows) {
    if (!row || typeof row.codeModule !== 'string' || row.codeModule.trim() === '') continue;
    const id = row.requirementId;
    if (id.startsWith('NFR-') || id.startsWith('CON-')) {
      if (row.codeModule.trim() === '横切') continue;
      for (const e of parseCodeModuleEntries(row.codeModule)) {
        if (e.srcPath === null || e.anchorStart === null || (e.anchorEnd !== null && e.anchorEnd < e.anchorStart)) {
          violations.push(
            `codeModule 格式错误：${id.startsWith('NFR-') ? 'NFR' : 'CON'} 行 ${id} 的条目 "${e.raw}" 须匹配 src/<path>:L<start>[-<end>]（start≥1，end≥start；多条目逗号分隔；或整格"横切"）`,
          );
        }
      }
      continue;
    }
    if (!id.startsWith('REQ-')) continue;
    for (const e of parseCodeModuleEntries(row.codeModule)) {
      const ok = e.sdId !== null && e.srcPath !== null && e.anchorStart !== null && e.anchorStart >= 1
        && (e.anchorEnd === null || e.anchorEnd >= e.anchorStart);
      if (!ok) {
        violations.push(
          `codeModule 格式错误：REQ 行 ${id} 的条目 "${e.raw}" 须匹配 SD-<id>:src/<path>:L<start>[-<end>]（示例：SD-5.2.1:src/auth/login.ts:L42-58；多条目逗号分隔）`,
        );
      }
    }
  }
  return violations;
}
```

- [ ] **步骤 4：运行验证通过（先修本文件旧用例的预期）**

旧 P0-2 用例中断言旧格式（如 `SD-5.2.1:src/x.ts` 无锚点）为合法的，按新语法补锚点更新期望值；断言 `/codeModule 格式错误/` 的负向用例应仍通过。
运行：`npx vitest run w-model-dev/scripts/__tests__/gate-enhancement.test.ts --config config/vitest.config.ts` → PASS

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "feat(gate): SDMAP-5 锚点条目语法校验（逗号多值逐条目/横切特例/倒序与双L拒收）+ parseCodeModuleEntries（批次1 任务3）"
```

---

### 任务 4：checkSdToCodeModuleMapping 重写（SDMAP-1/2 + classification）

**文件：**
- 修改：`w-model-dev/scripts/logic/gate-logic.ts:199-243`（重写）与调用处 `:1680-1683`
- 测试：`__tests__/gate-enhancement.test.ts`（「SD 数字层级 id codeModule 前缀映射兜底」describe 邻域，:899-957）

- [ ] **步骤 1：编写失败的测试**

在 gate-enhancement.test.ts 追加（fixture 构造照 :900-956 先例——内联 RTMMatrixShape + GateGraph；`srcLineCounts` 参数本任务先以 undefined 语义测 SDMAP-1/2）：

```typescript
import { checkSdToCodeModuleMapping } from '../logic/gate-logic';

describe('SDMAP 双向精确对账（批次1）', () => {
  const rowsOf = (cm: string) => ([{ requirementId: 'REQ-001', description: 'd', designDoc: 'SD-2.1', codeModule: cm, unitTest: 'UT-001', acceptanceTest: 'UAT-001' }] as never);

  it('SDMAP-1：图节点无前缀精确匹配条目 → 违规（semantic）', () => {
    const graph = { nodes: [{ id: 'SD-2.2', type: 'SD' }] };
    const r = checkSdToCodeModuleMapping(graph, rowsOf('SD-2.1:src/a.ts:L1') as never);
    expect(r.violations.some((v: string) => v.includes('SD-2.2') && v.includes('SDMAP-1'))).toBe(true);
    expect(r.structured.find((s) => s.rule === 'SDMAP-1')?.classification).toBe('semantic');
  });
  it('词形 id 不再子串放行：SD-USER 不命中 SD-user_service 前缀条目', () => {
    const graph = { nodes: [{ id: 'SD-USER', type: 'SD' }] };
    const r = checkSdToCodeModuleMapping(graph, rowsOf('SD-USER-SVC:src/user_service.ts:L1') as never);
    expect(r.violations.some((v: string) => v.includes('SDMAP-1'))).toBe(true);
  });
  it('SDMAP-2：REQ 条目 SD 前缀不在图节点集（幽灵 SD）→ 违规', () => {
    const graph = { nodes: [{ id: 'SD-2.1', type: 'SD' }] };
    const r = checkSdToCodeModuleMapping(graph, rowsOf('SD-2.1:src/a.ts:L1, SD-9.9:src/b.ts:L2') as never);
    expect(r.violations.some((v: string) => v.includes('SD-9.9') && v.includes('SDMAP-2'))).toBe(true);
  });
  it('数字层级 id 前缀精确匹配仍通过（兼容 SD-5.2.1 形态）', () => {
    const graph = { nodes: [{ id: 'SD-5.2.1', type: 'SD' }] };
    const r = checkSdToCodeModuleMapping(graph, rowsOf('SD-5.2.1:src/auth/login.ts:L42-58') as never);
    expect(r.violations).toEqual([]);
    expect(r.skipped).toBe(true); // 未传 srcLineCounts → SDMAP-3/4 skipped
  });
});
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run w-model-dev/scripts/__tests__/gate-enhancement.test.ts --config config/vitest.config.ts`
预期：FAIL（现函数返回 string[]、无 structured/skipped；子串匹配行为相反）

- [ ] **步骤 3：重写函数与调用处**

`checkSdToCodeModuleMapping`（:205-243）整体替换为：

```typescript
export interface SdToCodeModuleResult {
  violations: string[];
  structured: StructuredViolation[];
  /** true = 注入面缺失（SDMAP-3/4 未执行；不冒充通过，CLI 生产路径恒注入） */
  skipped: boolean;
}

/**
 * SD→codeModule 双向精确对账（批次1 SDMAP；规格 §4.2）。
 * 废除拆段子串与 `${id}:` 数字特判，统一为 REQ 条目前缀与图节点 id 全等。
 */
export function checkSdToCodeModuleMapping(
  graph: GateGraph,
  rows: RTMRowShape[],
  srcLineCounts?: ReadonlyMap<string, number>,
): SdToCodeModuleResult {
  const violations: string[] = [];
  const structured: StructuredViolation[] = [];
  if (!graph || !Array.isArray(graph.nodes)) return { violations, structured, skipped: srcLineCounts === undefined };
  const sdNodes = graph.nodes.filter((n) => n && n.type === 'SD');
  if (sdNodes.length === 0) return { violations, structured, skipped: srcLineCounts === undefined };
  const sdNodeIds = new Set(sdNodes.map((n) => String(n.id ?? '')));

  const reqEntries: Array<{ rowId: string; entry: CodeModuleEntry }> = [];
  for (const row of rows) {
    if (!row || typeof row.codeModule !== 'string' || row.codeModule.trim() === '') continue;
    if (!String(row.requirementId ?? '').startsWith('REQ-')) continue;
    for (const entry of parseCodeModuleEntries(row.codeModule)) {
      if (entry.sdId !== null) reqEntries.push({ rowId: String(row.requirementId), entry });
    }
  }

  // 第一向：图→RTM（SDMAP-1）
  for (const id of sdNodeIds) {
    if (!reqEntries.some(({ entry }) => entry.sdId === id)) {
      const msg = `SDMAP-1 图→RTM 缺映射：SD 节点 ${id} 无任何前缀精确等于其 id 的 REQ codeModule 条目`;
      violations.push(msg);
      structured.push({ rule: 'SDMAP-1', field: `graph.SD[${id}]`, message: msg, classification: 'semantic' });
    }
  }
  // 第二向：RTM→图（SDMAP-2）
  for (const { rowId, entry } of reqEntries) {
    if (!sdNodeIds.has(entry.sdId!)) {
      const msg = `SDMAP-2 幽灵 SD 前缀：REQ 行 ${rowId} 条目 "${entry.raw}" 的 SD 前缀 ${entry.sdId} 不在图 SD 节点集`;
      violations.push(msg);
      structured.push({ rule: 'SDMAP-2', field: `rtm[${rowId}].codeModule`, message: msg, classification: 'semantic' });
    }
  }
  // 注入面：SDMAP-3/4（skipped 语义：未注入不判、不冒充通过）
  const injected = srcLineCounts !== undefined && srcLineCounts.size > 0;
  if (injected) {
    for (const { rowId, entry } of reqEntries) {
      if (entry.srcPath === null) continue; // 格式错由 SDMAP-5 报
      const count = srcLineCounts.get(entry.srcPath);
      if (count === undefined) {
        const msg = `SDMAP-3 路径不存在：REQ 行 ${rowId} 条目 "${entry.raw}" 的 ${entry.srcPath} 不在项目内`;
        violations.push(msg);
        structured.push({ rule: 'SDMAP-3', field: `rtm[${rowId}].codeModule`, message: msg, classification: 'evidence-only' });
        continue;
      }
      const s = entry.anchorStart ?? 0;
      const e = entry.anchorEnd;
      const bad = s < 1 || (e !== null && (e < s || e > count));
      if (bad) {
        const msg = `SDMAP-4 锚点行号非法：REQ 行 ${rowId} 条目 "${entry.raw}"（文件共 ${count} 行，须 1 ≤ start ≤ end ≤ 总行数）`;
        violations.push(msg);
        structured.push({ rule: 'SDMAP-4', field: `rtm[${rowId}].codeModule`, message: msg, classification: 'evidence-only' });
      }
    }
  }
  return { violations, structured, skipped: !injected };
}
```

（文件顶部补 `import type { StructuredViolation } from '../lib/types';`——若该文件已从 lib/types 引入则合并。）

调用处 `:1680-1683` 改为：

```typescript
if (options && options.graph && phase >= 5) {
  const sd = checkSdToCodeModuleMapping(options.graph, matrix.rows, options.srcLineCounts);
  for (const v of sd.violations) reasons.push(v);
}
```

`CheckArtifactGateOptions`（:178-197）追加字段（照 graph-logic.ts:249 `anchorLineCounts` 先例）：

```typescript
  /** 批次1 SDMAP-3/4 注入面：src 路径 → 文件总行数；未注入则该两子项 skipped（CLI 生产路径恒注入） */
  srcLineCounts?: ReadonlyMap<string, number>;
```

`ArtifactGateResult`（:78-90）追加两个透传字段：

```typescript
  sdAnchorCheck?: 'checked' | 'skipped' | null;
  sdmapViolations?: StructuredViolation[];
```

主函数在 phase>=5 且 options.graph 存在时填充：`result.sdAnchorCheck = sd.skipped ? 'skipped' : 'checked'; result.sdmapViolations = sd.structured;`（phase<5 或无 graph → 保持 undefined，由 CLI 归一为 null）。

- [ ] **步骤 4：修既有用例并验证通过**

`:899-957`「SD 数字层级 id codeModule 前缀映射兜底」describe：用例语义不变（SD-5.2.1 前缀兜底 → 前缀精确），fixture 的 codeModule 补锚点（`:L42` 类），断言保持 `result.reasons.some(r => r.includes('TLA+ 资产校验失败'))` **改为** `/SDMAP-1/`（新文案不再含「TLA+ 资产校验失败」——全局 grep 该串于 `__tests__/` 与 `self-test.ts`，凡指向 SD→codeModule 映射的断言一并改 `/SDMAP-1/`）。
运行：`npx vitest run w-model-dev/scripts/__tests__/gate-enhancement.test.ts w-model-dev/scripts/__tests__/gate-logic.test.ts --config config/vitest.config.ts` → PASS

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/gate-logic.ts w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "feat(gate)!: SD→codeModule 双向精确对账重写（SDMAP-1/2 语义+structured 分类；废除拆段子串与数字特判）+ srcLineCounts 注入面选项（批次1 任务4）"
```

---

### 任务 5：CLI 注入面接线 + GATE_JSON sdAnchorCheck/sdmapViolations

**文件：**
- 修改：`w-model-dev/scripts/cli/check-artifact-gate.ts`（读 rtm 之后 :489 邻域 + options 构造 :551-560 + GATE_JSON :757-776 + --json :653-683）
- 测试：`__tests__/gate-test-evidence.test.ts` 末尾新增（照 :546-600 子进程形态：mkdtemp + runSync tsx）

- [ ] **步骤 1：编写失败的 CLI 集成测试**

```typescript
describe('批次1 SDMAP 注入面（CLI 子进程）', () => {
  it('路径不存在 → SDMAP-3，exitCode=1，sdAnchorCheck=checked', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdmap3-'));
    await fs.mkdir(path.join(dir, '.w-model'), { recursive: true });
    await fs.writeFile(path.join(dir, '.w-model', 'rtm.json'), JSON.stringify({
      rows: [{ requirementId: 'REQ-001', description: 'd', designDoc: 'SD-2.1', codeModule: 'SD-2.1:src/nope.ts:L1', acceptanceTest: 'UAT-001' }],
      executionSummary: { layers: { unitTest: { total: 1, passed: 1 }, integrationTest: { total: 1, passed: 1 }, systemTest: { total: 1, passed: 1 }, acceptanceTest: { total: 1, passed: 1 } } },
      coverage: { requirementCoveragePercent: 100 },
    }));
    const r = runSync('npx', ['tsx', gateScript, dir, '--phase=5', '--json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('SDMAP-3');
    expect(r.stdout).toContain('"sdAnchorCheck":"checked"');
  });
  it('真实文件 + 越界行号 → SDMAP-4；真实文件 + 合法锚点 → 该子项通过', async () => {
    // 同上，dir 下写 src/real.ts（3 行），rtm 条目 SD-2.1:src/real.ts:L99 → SDMAP-4；
    // 第二个 REQ 行 SD-2.1:src/real.ts:L1-3 → 仅四层测试/覆盖率齐全时 overall 由其它项决定，
    // 断言 stdout 不含 SDMAP- 即锚点子项全过
  });
});
```

（`gateScript` 变量、runSync 导入照该文件 :546-600 既有代码；第二个用例的 rtm 需补齐 phase=5 必填字段——照同文件既有 fixture 的完整形态拷改，此处不重复列。）

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run w-model-dev/scripts/__tests__/gate-test-evidence.test.ts --config config/vitest.config.ts`
预期：FAIL（现 CLI 无注入表，GATE_JSON 无 sdAnchorCheck 键；旧逻辑下 `src/nope.ts` 无锚点也不报）

- [ ] **步骤 3：实现 CLI 注入与输出**

`check-artifact-gate.ts` 在 `readJsonClassified<RTMMatrixShape>(rtmFile)`（:489）成功后新增：

```typescript
// 批次1 SDMAP-3/4 注入面：按 codeModule 条目收集 src 路径，读盘统计总行数（语义同 check-requirement-graph.ts countContentLines；不存在则不入表 → SDMAP-3）
function countUtf8Lines(abs: string): number | null {
  try {
    return nodeFs.readFileSync(abs, 'utf8').split('\n').length;
  } catch {
    return null;
  }
}
const srcLineCounts = new Map<string, number>();
for (const row of matrix.rows) {
  if (!row || typeof row.codeModule !== 'string' || row.codeModule.trim() === '') continue;
  for (const part of row.codeModule.split(',')) {
    const m = /^\s*(?:SD-[^:]+:)?(src\/[^:]+):L/.exec(part);
    if (!m || srcLineCounts.has(m[1])) continue;
    const n = countUtf8Lines(path.resolve(projectDir, m[1]));
    if (n !== null) srcLineCounts.set(m[1], n);
  }
}
```

options 构造（:551-560）加 `srcLineCounts`；GATE_JSON 对象（:757-776）加两键（置于 `tickets` 后）：

```typescript
  sdAnchorCheck: result.sdAnchorCheck ?? null,
  sdmapViolations: result.sdmapViolations ?? [],
```

`--json` 分支（:653-683）的 JsonReport 同样补这两键。GATE_CASES 自测路径（self-test.ts runGateCases :3328-3345）**不传** srcLineCounts → `sdAnchorCheck:'skipped'`，不误红（纯函数上下文语义）。

- [ ] **步骤 4：运行验证通过**

运行：`npx vitest run w-model-dev/scripts/__tests__/gate-test-evidence.test.ts --config config/vitest.config.ts` → PASS

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/cli/check-artifact-gate.ts w-model-dev/scripts/__tests__/gate-test-evidence.test.ts
git commit -m "feat(cli): check-artifact-gate SDMAP 注入面接线（srcLineCounts 读盘构建）+ GATE_JSON sdAnchorCheck/sdmapViolations（批次1 任务5）"
```

---

### 任务 6：code-tla-logic D1 同步 + 四维度 classification + 零交集守卫

**文件：**
- 修改：`w-model-dev/scripts/logic/code-tla-logic.ts`（D1 :186-247；structuredViolations 填充点 :194/:202/:236/:247/:352/:366/:517/:608；主入口守卫 :645 邻域）
- 修改：`w-model-dev/scripts/samples/code-tla/valid.json`、`bad-sd-no-code-module.json`（命名 SD 补前缀锚点）
- 测试：`__tests__/code-tla-logic.test.ts`（:68 describe 扩展）

- [ ] **步骤 1：编写失败的测试**

```typescript
describe('批次1 D1 前缀精确 + 分类 + 零交集', () => {
  it('D1 前缀精确：SD-AUTH 条目须为 SD-AUTH:src/…（无前缀 src/auth.ts 不再通过）', () => {
    const r = checkCodeTlaConsistency(makeInput({ graph: sdGraph(['SD-AUTH']), rtm: rtmWith('src/auth.ts:L1-9') }));
    expect(r.dimensions[0]!.passed).toBe(false);
    expect(r.dimensions[0]!.structuredViolations?.some((v) => v.rule === 'SDMAP-1')).toBe(true);
  });
  it('D1 语义违规 classification=semantic', () => {
    const r = checkCodeTlaConsistency(makeInput({ graph: sdGraph(['SD-AUTH']), rtm: rtmWith('SD-BILLING:src/b.ts:L1') }));
    expect(r.dimensions[0]!.structuredViolations?.find((v) => v.rule === 'SDMAP-1')?.classification).toBe('semantic');
  });
  it('零交集守卫：图 SD 集与 REQ 条目 SD 集均非空且无交集 → cannot prove same system', () => {
    const r = checkCodeTlaConsistency(makeInput({ graph: sdGraph(['SD-A']), rtm: rtmWith('SD-B:src/b.ts:L1') }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some((s: string) => s.includes('cannot prove same system'))).toBe(true);
  });
});
```

（`makeInput`/`sdGraph`/`rtmWith` 为本 describe 内联 helper：按该文件既有用例（:69-118）的 manifest/graph/rtm 最小构造拷改；D1 文案保留「无对应 codeModule」子串以兼容 self-test CODE_TLA_CASES :1650 正则——新文案示例：`SD-AUTH 无对应 codeModule（SDMAP-1 前缀精确对账失败）`。）

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run w-model-dev/scripts/__tests__/code-tla-logic.test.ts --config config/vitest.config.ts`
预期：FAIL（现 D1 前缀+子串回退放行无前缀条目；无守卫）

- [ ] **步骤 3：实现 D1 重写 + 分类 + 守卫**

D1（:186-247）主体替换：复用 gate-logic 的 `parseCodeModuleEntries`（从 `'./gate-logic'` 导入——同目录 logic 层互相导入已有先例，若无则改为从 gate-logic import；**不复制第二份解析**）；主匹配 = REQ 条目 `sdId === 节点 id`；删除 :228-242 拆段子串回退；SDMAP-2 幽灵前缀同 gate-logic；violations 文案含 `SDMAP-1`/`SDMAP-2` + 保留「无对应 codeModule」子串。

structured classification 填充（不改现有 rule 名，只加字段）：D1 各点 + INPUT/SCHEMA → `'semantic'`；D2（:352/:366）与 D3（:517）→ `'topology'`；D4（:608）→ `'semantic'`。

主入口（:645）在 schema 前置校验后新增零交集守卫：

```typescript
// 批次1 A2：比对键零交集 fail-closed（规格 §5.3）——图 SD 集与 REQ 条目 SD 集均非空且零交集
const graphSdIds = new Set((input.graph?.nodes ?? []).filter((n) => n?.type === 'SD').map((n) => String(n.id ?? '')));
const rtmSdIds = new Set<string>();
for (const row of input.rtm?.rows ?? []) {
  if (typeof row?.codeModule === 'string' && String(row.requirementId ?? '').startsWith('REQ-')) {
    for (const e of parseCodeModuleEntries(row.codeModule)) if (e.sdId) rtmSdIds.add(e.sdId);
  }
}
if (graphSdIds.size > 0 && rtmSdIds.size > 0 && ![...graphSdIds].some((id) => rtmSdIds.has(id))) {
  violations.push('无共享设计 ID（cannot prove same system），不判一致：graph SD 集 与 rtm REQ 条目 SD 前缀集 零交集');
  structuredViolations.push({ rule: 'INPUT-NO-SHARED-SD', message: '无共享设计 ID（cannot prove same system）', classification: 'topology' });
}
```

（变量名 violations/structuredViolations 与该文件现有累积结构对齐；具体插入点随 :649-695 现有 INPUT/SCHEMA 校验的组织方式落位。）

同步 samples：`samples/code-tla/valid.json` 的 codeModule 从 `src/auth.ts` 改为 `SD-AUTH:src/auth.ts:L<n>-<m>`（n/m 按样本语义取 1-9 区间）；`bad-sd-no-code-module.json` 保持「缺映射」负向语义（其 graph SD 与条目按新前缀形态对齐，使失败仍由 SDMAP-1 触发、文案含「无对应 codeModule」）。

- [ ] **步骤 4：修既有用例并验证通过**

`code-tla-logic.test.ts:69`「SD 映射对」与 `:102`「包含匹配」两个依赖子串回退的用例：改写为前缀精确语义（:102 用例 `SD-Article-Service → article.controller.ts` 在新语义下是 SDMAP-1 失败——断言反转并改前缀形态为通过版本另立正例）。
运行：`npx vitest run w-model-dev/scripts/__tests__/code-tla-logic.test.ts w-model-dev/scripts/__tests__/check-code-tla-consistency.test.ts --config config/vitest.config.ts` → PASS

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/code-tla-logic.ts w-model-dev/scripts/__tests__/code-tla-logic.test.ts w-model-dev/scripts/samples/code-tla/
git commit -m "feat(tla)!: code-tla D1 前缀精确对账同步（与 gate-logic SDMAP 语义一致，废子串回退）+ 四维度 classification + 零交集守卫（批次1 任务6）"
```

---

### 任务 7：state-machine-logic differences + 零交集守卫

**文件：**
- 修改：`w-model-dev/scripts/logic/state-machine-logic.ts`（:24-51 结构 + 主函数）
- 测试：`__tests__/state-machine-logic.test.ts`（现有文件扩展）

- [ ] **步骤 1：编写失败的测试**

```typescript
describe('批次1 A2：分类差异 + 零交集守卫', () => {
  it('差异条目附 classification=topology', () => {
    const r = checkStateMachineConsistency({
      designStates: ['idle', 'running'], codeStates: ['idle'],
      designTransitions: [{ from: 'idle', to: 'running' }], codeTransitions: [],
    });
    expect(r.differences).toContainEqual(
      expect.objectContaining({ kind: 'transition', direction: 'missing-in-code', subject: 'idle→running', classification: 'topology' }),
    );
  });
  it('零交集：两侧非空且状态/转移均无交集 → cannot prove same system，passed=false', () => {
    const r = checkStateMachineConsistency({
      designStates: ['a'], codeStates: ['x'],
      designTransitions: [{ from: 'a', to: 'a' }], codeTransitions: [{ from: 'x', to: 'x' }],
    });
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('无共享状态与转移（cannot prove same system），不判一致');
  });
  it('部分交集不触发守卫（正常差异报告）', () => {
    const r = checkStateMachineConsistency({
      designStates: ['a', 'b'], codeStates: ['a'],
      designTransitions: [{ from: 'a', to: 'b' }], codeTransitions: [],
    });
    expect(r.reasons).not.toContain('无共享状态与转移（cannot prove same system），不判一致');
    expect(r.passed).toBe(false);
  });
});
```

- [ ] **步骤 2：运行验证失败**

运行：`npx vitest run w-model-dev/scripts/__tests__/state-machine-logic.test.ts --config config/vitest.config.ts`
预期：FAIL（无 differences 字段、无守卫）

- [ ] **步骤 3：实现**

`StateMachineConsistencyResult`（:24-35）追加：

```typescript
  /** 批次1 A2：分类差异清单（本比对器全部差异为 topology；供 R/reworkHints 统一消费） */
  differences?: Array<{
    kind: 'state' | 'transition';
    direction: 'missing-in-code' | 'extra-in-code';
    subject: string;
    classification: 'topology';
  }>;
```

主函数在既有差异计算（:56-77）后构建 differences（missing→`missing-in-code`、extra→`extra-in-code`，state 的 subject 为状态名、transition 的 subject 为 `transitionKey(t)`），并在零证据守卫（:48-51）之后追加零交集守卫：

```typescript
const designNonEmpty = designStates.length + designTransitions.length > 0;
const codeNonEmpty = codeStates.length + codeTransitions.length > 0;
const sharedState = designStates.some((s) => codeStateSet.has(s));
const sharedTransition = designTransitions.some((t) => codeTransitionKeys.has(transitionKey(t)));
if (designNonEmpty && codeNonEmpty && !sharedState && !sharedTransition) {
  reasons.push('无共享状态与转移（cannot prove same system），不判一致');
}
```

（`codeStateSet`/`codeTransitionKeys` 在 :53-67 已构建，守卫置于其后、差异报告前均可——注意 reasons 判空即 passed，守卫条目自然使 passed=false。）

- [ ] **步骤 4：运行验证通过**

运行：`npx vitest run w-model-dev/scripts/__tests__/state-machine-logic.test.ts --config config/vitest.config.ts` → PASS

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/logic/state-machine-logic.ts w-model-dev/scripts/__tests__/state-machine-logic.test.ts
git commit -m "feat(sm): state-machine 分类差异清单 + 零交集 fail-closed 守卫（批次1 任务7）"
```

---

### 任务 8：模板/指引/术语/B6 文档同步

**文件（全部修改，无新增文件）：**
- `w-model-dev/templates/rtm.md:15`、`w-model-dev/templates/coding.md:72-73`
- `w-model-dev/references/rtm-guide.md`（:160-172「codeModule 格式规范」节 + 正则表 :166-169；节首补完成判据）
- `w-model-dev/references/phase-5-coding.md:304`（「codeModule 格式规范」节）
- `w-model-dev/references/iceberg-sweep-guide.md`（§8 末尾新增 §8.7「一致性差异分类词汇」）
- `w-model-dev/references/root-cause-locator.md:246`（§4.4 第 4 条排序句）
- `w-model-dev/references/conventions.md`（§3 工程资产相关：更新 codeModule 条目 + 新增 2 术语）
- `w-model-dev/references/command-reference.md`（check-artifact-gate 条目 :398 起追加 bullet）
- `w-model-dev/references/operational-recovery.md:188`（B6）

- [ ] **步骤 1：逐文件修改**

1. `rtm.md:15` 示例行「代码模块」列：`{{userController.ts}}` → `{{SD-3.2.1:src/user/userController.ts:L42-58}}`；表下补一行说明「多条目逗号分隔；NFR/CON 允许整格 `横切`」。
2. `coding.md:72` DoD 行改为：「REQ 行 `codeModule` 已回填（条目格式 `SD-<id>:src/<path>:L<start>[-<end>]`，如 `SD-5.2.1:src/auth/login.ts:L42-58`，多个条目逗号分隔）」；`:73` NFR/CON 行补「条目带锚点或整格 `横切`」。
3. `rtm-guide.md`「codeModule 格式规范」节（:160-172）正则表（:166-169）替换为锚点正则（REQ `^SD-[^:]+:src\/[^:]+:L\d+(-\d+)?$` / NFR `^src\/[^:]+:L\d+(-\d+)?$` / `横切`）；节首补完成判据：「回填完成判据：每个 codeModule 断言有源证据锚点（path+行号区间落在真实文件内，门禁 SDMAP 校验）；**无数量目标**——不设锚点数/行数凑数指标。」
4. `phase-5-coding.md:304` 格式规范节同步同样正则与示例。
5. `iceberg-sweep-guide.md` §8.6（:247）后新增：

```markdown
### 8.7 一致性差异分类词汇（ChangeClassification）

R 定位冰山差异项时按三值分类（SSoT §10L.4 / 批次总纲 §4.1 唯一权威）：`semantic`（语义/映射/不变式）、`topology`（集合成员差异）、`evidence-only`（断言未变、仅证据位置失效）。R6/R7/R8 差异项的 reasons 池前缀不变；本表只作 R 分析与 reworkHints 排序词汇（semantic/topology 优先于 evidence-only），不改变阻断语义。
```

6. `root-cause-locator.md:246`「fixRecommendation 合并：按根因收敛度排序」追加「；消费一致性门禁差异时按 classification 排序（semantic/topology 优先于 evidence-only）」。
7. `conventions.md` §3：codeModule 条目的「规范定义」更新为锚点语法；新增两条目（照 :82-85 形态）：

```markdown
### 代码锚点
- **规范定义**：codeModule 条目携带的源证据定位 `src/<path>:L<start>[-<end>]`，行号区间须落在真实文件内（SDMAP-3/4 校验）。
- **_Avoid_**：codeAnchor/sourceRef/裸路径（无 :L 行号）。

### ChangeClassification
- **规范定义**：一致性差异三值分类 semantic / topology / evidence-only（SSoT §10L.4），仅供 R 定位与 reworkHints 排序，不改变阻断。
- **_Avoid_**：cosmetic/geometry（明确不引入）、blocking-level（分类≠阻断级）。
```

8. `command-reference.md` check-artifact-gate 条目（:398 起）追加 bullet：

```markdown
- **SDMAP 锚点对账（批次1）**：`codeModule` 条目格式 `SD-<id>:src/<path>:L<start>[-<end>]`（NFR/CON `src/...:L...`，`横切` 特例）；规则 SDMAP-1（图→RTM 缺映射）/SDMAP-2（幽灵 SD 前缀）/SDMAP-3（路径不存在，注入面）/SDMAP-4（行号越界，注入面）/SDMAP-5（格式）；`GATE_JSON.sdAnchorCheck` 三态（checked/skipped/null，skipped=注入面缺失不冒充通过）+ `sdmapViolations[]`（含 classification）。
```

9. `operational-recovery.md:188` B6：删除「（见 hard-constraints.md『错误聚集与超标丢弃』）」括注，改为「失败模块错误密度超阈值时（阈值与判定见本节引言）」——不关联 #47（语义张力，见计划头部偏差 3）。

- [ ] **步骤 2：验证 docs-consistency + prettier 面**

运行：`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` → exit 0
运行：`npx prettier --ignore-unknown --check w-model-dev/templates/rtm.md w-model-dev/templates/coding.md w-model-dev/references/rtm-guide.md w-model-dev/references/phase-5-coding.md w-model-dev/references/iceberg-sweep-guide.md w-model-dev/references/root-cause-locator.md w-model-dev/references/conventions.md w-model-dev/references/command-reference.md w-model-dev/references/operational-recovery.md`（不在 prettier 面内则跳过——以命令输出为准）

- [ ] **步骤 3：Commit**

```bash
git add w-model-dev/templates/ w-model-dev/references/
git commit -m "docs(assets): 锚点语法与 SDMAP 门禁口径全量同步（rtm/coding 模板、rtm-guide/phase-5 格式规范与完成判据、iceberg §8.7、R 消费排序、术语表 3 条、command-reference SDMAP 条目、B6 悬空引用修复）（批次1 任务8）"
```

---

### 任务 9：存量硬切补锚点（samples/`__tests__`/生成器）

**文件：**
- 修改：`w-model-dev/scripts/samples/gate/` 14 文件（21 处 codeModule 值）
- 修改：`w-model-dev/scripts/__tests__/` 5 文件（fixture 数据行：gate-enhancement.test.ts 5 处、wm-status-logic.test.ts 5 处、artifact-gate-external.test.ts 2 处、wm-status.test.ts 1 处、gate-test-evidence.test.ts 1 处）
- 修改：`eval/e2e/demo-assets/build_workspace.py` 5 处（:652/:655/:687/:763/:790）
- **不改**：`eval/e2e/demo/`（gitignored 瞬态）、`eval/e2e/demo-snapshots/`（历史快照保原貌）、`eval/e2e/2026-08-28-*.md`（历史记录）

- [ ] **步骤 1：samples/gate 14 文件逐值补锚点**

规则：`SD-2.1:src/middleware/rateLimit.ts` → `SD-2.1:src/middleware/rateLimit.ts:L1`（历史 fixture 无对应真实文件，锚点统一取 `:L1`——SDMAP-3/4 只在注入面存在时判，self-test 路径不注入故不误红；语义为「声明式锚点存在」）。逐文件清单（每文件命中数）：valid-rtm.json(3)、bad-rtm-status-mismatch.json(3)、bad-rtm-coverage-below-100.json(3)、bad-nfr-missing-dual-fields.json(2)、valid-test-evidence.json(1)、valid-test-evidence-legacy.json(1)、valid-sd-numeric-levels.json(1)、valid-phase6.json(1)、bad-test-evidence-unpaired-output.json(1)、bad-test-evidence-missing.json(1)、bad-test-evidence-hash-mismatch.json(1)、bad-test-evidence-exitcode-mismatch.json(1)、bad-phase6-pending-system.json(1)、bad-phase5-codemodule-format.json(1——**此为负向格式样本**：其 codeModule 保持非法形态（如缺锚点），期望仍是 `/codeModule 格式错误/`，不改)。
**注意**：`samples/gate/` 下 NFR/CON 行若为 `横切` 不动；`valid-sd-numeric-levels.json` 改后须仍通过（前缀精确兼容数字层级）。

- [ ] **步骤 2：`__tests__` fixture 数据行与 build_workspace.py 同步**

`__tests__` 5 文件的 fixture 数据 codeModule 值同步骤 1 规则补 `:L1`；`gate-enhancement.test.ts:900` 断言文案行随任务 4 已改，此处仅核对其余 5 处数据行。`build_workspace.py` 5 处 `'SD-001:src/counter.ts'` → `'SD-001:src/counter.ts:L1'`（与该生成器写入的 src 文件行数对齐——counter.ts 若 ≥1 行则 L1 合法；执行时按生成器实际产物行数取值）。

- [ ] **步骤 3：运行 self-test GATE_CASES + 全量 vitest 验证**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts` → exit 0（重点：valid-sd-numeric-levels / valid-rtm / valid-phase6 通过；bad-phase5-codemodule-format 仍按 `/codeModule 格式错误/` 失败）
运行：`npx vitest run --config config/vitest.config.ts` → 全绿（wm-status 族 fixture 补锚点后不破坏其断言——其断言不涉 codeModule 格式则天然兼容）

- [ ] **步骤 4：Commit**

```bash
git add w-model-dev/scripts/samples/gate/ w-model-dev/scripts/__tests__/ eval/e2e/demo-assets/build_workspace.py
git commit -m "feat(samples)!: 存量 codeModule 硬切补锚点（samples/gate 13 文件 + __tests__ fixture 14 处 + build_workspace.py 生成器 5 处；历史快照与 gitignored demo 不动）（批次1 任务9）"
```

---

### 任务 10：SDMAP 负向样本 + NEGATIVE-COVERAGE/README 登记 + 探针

**文件：**
- 新增：`w-model-dev/scripts/samples/gate/bad-sdmap-mapping.json`（触发 SDMAP-1/2/5）
- 新增：`w-model-dev/scripts/samples/gate/bad-sdmap-anchor.json`（触发 SDMAP-3/4，需注入表）
- 修改：`w-model-dev/scripts/cli/self-test.ts`（GateCase 增可选 `srcLineCounts`；GATE_CASES 增 2 用例）
- 修改：`w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`、`w-model-dev/scripts/samples/README.md`

- [ ] **步骤 1：编写 self-test 新用例（先写用例，fixture 尚不存在→悬空即失败）**

GateCase 接口（self-test.ts:143-170）追加：

```typescript
  /** 批次1 SDMAP-3/4：手写注入表（path→总行数）；缺省不注入 → sdAnchorCheck=skipped */
  srcLineCounts?: Record<string, number>;
```

runGateCases 构造 options 处（:3339 邻域）：`options.srcLineCounts = c.srcLineCounts ? new Map(Object.entries(c.srcLineCounts)) : undefined`。

GATE_CASES 追加：

```typescript
{
  file: 'bad-sdmap-mapping.json',
  expectedPassed: false,
  phaseOption: 5,
  graph: { nodes: [{ id: 'SD-2.2', type: 'SD' }] },
  expectedReasonPatterns: [/SDMAP-1/, /SDMAP-2/, /codeModule 格式错误/],
  description: '批次1：图→RTM 缺映射 + 幽灵 SD 前缀 + 格式不符',
},
{
  file: 'bad-sdmap-anchor.json',
  expectedPassed: false,
  phaseOption: 5,
  graph: { nodes: [{ id: 'SD-2.1', type: 'SD' }] },
  srcLineCounts: { 'src/real.ts': 3 },
  expectedReasonPatterns: [/SDMAP-3/, /SDMAP-4/],
  description: '批次1：路径不存在 + 锚点行号越界（注入面）',
},
```

- [ ] **步骤 2：运行验证失败（fixture 悬空）**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts`
预期：FAIL（两 fixture 不存在）

- [ ] **步骤 3：创建两个 fixture**

`bad-sdmap-mapping.json`：拷 `samples/gate/valid-rtm.json` 骨架（四层 executionSummary + coverage 100），改 rows 为两条：REQ-001 `codeModule: "SD-9.9:src/ghost.ts:L1"`（SD-9.9 幽灵 → SDMAP-2；graph 只给 SD-2.2 → 其缺映射 SDMAP-1）；REQ-002 `codeModule: "SD-2.2:src/bad.ts"`（缺锚点 → SDMAP-5「codeModule 格式错误」）。
`bad-sdmap-anchor.json`：同骨架，REQ-001 `codeModule: "SD-2.1:src/real.ts:L1-3, SD-2.1:src/nope.ts:L1, SD-2.1:src/real.ts:L99"`（real.ts 3 行：L1-3 合法、L99 → SDMAP-4；nope.ts 不在注入表 → SDMAP-3）；graph 给 SD-2.1。

- [ ] **步骤 4：运行 self-test 通过 + 登记 NEGATIVE-COVERAGE 与 README**

运行：`npx tsx w-model-dev/scripts/cli/self-test.ts` → exit 0。
`NEGATIVE-COVERAGE.md`：现行表为「每门禁恰一行」（:4 说明）——**不新增行**，将 check-artifact-gate 行（:48）的机制列扩写为涵盖 SDMAP：「…放宽覆盖率门禁…；SDMAP 前缀精确对账/锚点校验放宽将漏掉幽灵 SD 与无锚点映射（bad-sdmap-mapping / bad-sdmap-anchor）」；若 check-samples-coverage 实测要求新 fixture 独立登记（以 exit code 为准），按其报错指引在表内调整（保持每门禁一行约束）。
`samples/README.md`：gate 子目录矩阵行补登两个新 fixture。
运行：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` → exit 0（含真实 exit-2 探针，有界并发 4 路，零漂移）

- [ ] **步骤 5：Commit**

```bash
git add w-model-dev/scripts/samples/gate/bad-sdmap-mapping.json w-model-dev/scripts/samples/gate/bad-sdmap-anchor.json w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md w-model-dev/scripts/samples/README.md w-model-dev/scripts/cli/self-test.ts
git commit -m "test(samples): SDMAP 负向样本×2 + self-test 用例（含 srcLineCounts 注入）+ NEGATIVE-COVERAGE/README 登记 + exit-2 探针过（批次1 任务10）"
```

---

### 任务 11：eval 影响确认 + CHANGELOG/版本 + prepush 全量收口

**文件：**
- 修改：`CHANGELOG.md`、`package.json`（minor bump）
- 验证：eval 断言（零改动预期）

- [ ] **步骤 1：eval 影响确认（预期零改动）**

运行：`npm run eval`
预期：exit 0（采集已确认 mappings.json/runner.ts 对 check-artifact-gate 仅 fileExists 断言（id 8）、无输出形态/codeModule 断言；若意外失败，按失败条目最小同步 mappings/TSV 并在 CHANGELOG 注记）。

- [ ] **步骤 2：CHANGELOG + minor bump**

CHANGELOG.md 新版本节（版本号 = 当前 minor +1，如 42.6.0）：概述 SDMAP 双向精确对账/锚点语法/ChangeClassification/零交集守卫/B6；破坏性变更注明（硬切：存量 codeModule 须补锚点，子串匹配废除）。package.json version 同步。

- [ ] **步骤 3：prepush 全量收口**

运行：`npm run prepush`（Git Bash）
预期：19 项全绿（含 vitest 全量、coverage 门禁、docs-consistency、samples 覆盖矩阵、eval 语料断言、prettier、tsc）

- [ ] **步骤 4：Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore(release): 42.6.0 批次1 收口——设计↔代码一致性证据化对账（SDMAP/锚点语法/ChangeClassification/零交集守卫；prepush 19 项全绿）"
```

---

## 自检记录（计划编写者已执行）

1. **规格覆盖度**：A1 §4.1→任务 3；§4.2→任务 4/5；§4.3→任务 3/4/5；§4.4→任务 8；§4.5→任务 9/10；A2 §5.1→任务 2/6/7/8；§5.2→任务 2/6/7；§5.3→任务 6/7；§5.4→任务 8；B6→任务 8；SSoT 先行→任务 1；测试 §8→各任务步骤 + 任务 11。规格遗漏补齐：code-tla D1 同步（偏差 1）、schema description（任务 1 步骤 5）。
2. **占位符**：无「待定/TODO」；任务 5 步骤 1 第二用例与任务 6 步骤 1 的 helper 构造指明「照同文件既有 fixture 形态拷改」并给出字段级说明（既有形态在指明行号处，不复制全文是为避免与源漂移——执行者按行号取即得完整形态）。
3. **类型一致性**：`ChangeClassification`（任务 2 定义，4/6/7 消费）、`CodeModuleEntry`/`parseCodeModuleEntries`（任务 3 定义，4/6 消费）、`SdToCodeModuleResult{violations,structured,skipped}`（任务 4 定义，5 消费）、`sdAnchorCheck`/`sdmapViolations`（任务 2 定义，5 消费）、`differences`（任务 7 定义）——签名一致。
