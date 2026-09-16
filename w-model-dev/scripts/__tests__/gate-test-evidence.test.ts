/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(root, ...) 路径由测试自生成，非用户输入） */
/**
 * gate-test-evidence.test.ts —— M07 RTM 测试证据门禁规则（E1-E4 + cutoff 吸收）
 *
 * 覆盖计划 §0.1.2 四条确定性规则：
 *   E1 配对（rawOutputPath ↔ rawOutputSha256 要么都有要么都无）
 *   E2 哈希核验（相对项目根解析 / 禁越出根 / 文件须存在 / sha256 须相符）
 *   E3 结果一致性（failed=0&&pending=0 ⇒ exitCode=0；failed>0 ⇒ exitCode≥1；
 *      failed=0&&pending>0 不约束）
 *   E4 存在性 + cutoff（lastUpdated ≥ 2026-09-15T00:00:00Z 或缺失/不可解析 ⇒
 *      阶段内 total>0 的层必须带合法 evidence；早于 cutoff ⇒ 非阻断
 *      LEGACY_TEST_EVIDENCE 标注）
 *
 * 策略：纯逻辑内联 RTM 夹具（无 phaseOption 副作用），E2 用 os.tmpdir() 写真实产物
 * 文件并算真实 sha256。不写 .w-model/。
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import * as gateLogic from '../logic/gate-logic.js';

const AFTER_CUTOFF = '2026-09-15T10:00:00.000Z';
const BEFORE_CUTOFF = '2026-07-25T00:00:00.000Z';

interface Evidence {
  command: string;
  exitCode: number;
  observedAt: string;
  rawOutputPath?: string;
  rawOutputSha256?: string;
}
interface Summary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  coverage: number;
  evidence?: Evidence;
}
interface Row {
  requirementId: string;
  description: string;
  designDoc: string;
  codeModule: string;
  unitTest: string;
  integrationTest: string;
  systemTest: string;
  acceptanceTest: string;
  coverageStatus?: string;
}
interface Matrix {
  lastUpdated?: string;
  rows: Row[];
  executionSummary: {
    unitTest: Summary;
    integrationTest: Summary;
    systemTest: Summary;
    acceptanceTest: Summary;
  };
}

const tmpDirs: string[] = [];
function makeTmpDir(prefix = 'wmodel-m07-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 清理失败不影响断言
    }
  }
});

function makeEvidence(over: Partial<Evidence> = {}): Evidence {
  return { command: 'npx vitest run', exitCode: 0, observedAt: AFTER_CUTOFF, ...over };
}

/** 合法（全绿）测试摘要，默认携带合法 evidence。 */
function makeSummary(over: Partial<Summary> = {}): Summary {
  return { total: 2, passed: 2, failed: 0, pending: 0, coverage: 90, evidence: makeEvidence(), ...over };
}

/** 缺 evidence 的测试摘要（显式删除 evidence 键，模拟 cutoff 前旧 RTM）。 */
function makeSummaryNoEvidence(over: Partial<Summary> = {}): Summary {
  const s = makeSummary(over);
  delete s.evidence;
  return s;
}

const makeRow = (): Row => ({
  requirementId: 'REQ-001',
  description: '登录',
  designDoc: 'SD-1.1',
  codeModule: 'SD-1.1:src/a.ts',
  unitTest: 'UT-001',
  integrationTest: 'IT-001',
  systemTest: 'ST-001',
  acceptanceTest: 'UAT-001',
  coverageStatus: '100%',
});

interface MatrixOverrides {
  lastUpdated?: string;
  unitTest?: Summary;
  integrationTest?: Summary;
  systemTest?: Summary;
  acceptanceTest?: Summary;
}

/** 默认 lastUpdated ≥ cutoff（E4 生效域）；显式传 lastUpdated: undefined 模拟字段缺失。 */
function makeMatrix(over: MatrixOverrides = {}): Matrix {
  return {
    ...('lastUpdated' in over ? { lastUpdated: over.lastUpdated } : { lastUpdated: AFTER_CUTOFF }),
    rows: [makeRow()],
    executionSummary: {
      unitTest: over.unitTest ?? makeSummary(),
      integrationTest: over.integrationTest ?? makeSummary(),
      systemTest: over.systemTest ?? makeSummary(),
      acceptanceTest: over.acceptanceTest ?? makeSummary(),
    },
  };
}

function run(matrix: Matrix, options: Record<string, unknown> = {}) {
  return gateLogic.checkArtifactGate(matrix as never, { phaseOption: 8, ...options } as never);
}

describe('M07 测试证据门禁规则（E1-E4 + cutoff）', () => {
  it('常量 M07_TEST_EVIDENCE_CUTOFF = 2026-09-15T00:00:00Z', () => {
    expect(gateLogic.M07_TEST_EVIDENCE_CUTOFF).toBe('2026-09-15T00:00:00Z');
  });

  it('基线：全绿 + 合法 evidence + lastUpdated ≥ cutoff → passed', () => {
    const result = run(makeMatrix());
    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
  });

  // ==================== E1 配对 ====================
  it('E1: 只有 rawOutputPath（缺 rawOutputSha256）→ 红', () => {
    const result = run(
      makeMatrix({ unitTest: makeSummary({ evidence: makeEvidence({ rawOutputPath: 'artifacts/run.txt' }) }) }),
    );
    expect(result.passed).toBe(false);
    // 正则须锚定消息尾部的「当前只有 <缺失字段>」：只写 /E1…rawOutputPath…rawOutputSha256/
    // 会同时命中「必须成对出现」前缀里的两个字段名，对字段顺序/缺失方毫无鉴别力（任务 2 审查移交）。
    expect(result.reasons.join('\n')).toMatch(/E1[\s\S]*必须成对出现（当前只有 rawOutputPath）/);
    expect(result.reasons.join('\n')).not.toMatch(/当前只有 rawOutputSha256/);
  });

  it('E1: 只有 rawOutputSha256（缺 rawOutputPath）→ 红', () => {
    const result = run(
      makeMatrix({ unitTest: makeSummary({ evidence: makeEvidence({ rawOutputSha256: 'a'.repeat(64) }) }) }),
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E1[\s\S]*当前只有 rawOutputSha256/);
  });

  // ==================== E2 哈希核验 ====================
  it('E2: rawOutputPath + 相符 sha256 → 该层无 E1/E2 违规（全绿）', () => {
    const root = makeTmpDir();
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    const content = 'M07 test evidence fixture\n';
    writeFileSync(join(root, 'artifacts', 'run.txt'), content, 'utf-8');
    const sha = createHash('sha256').update(content).digest('hex');
    const withOutput = (): Summary =>
      makeSummary({ evidence: makeEvidence({ rawOutputPath: 'artifacts/run.txt', rawOutputSha256: sha }) });
    const result = run(
      makeMatrix({
        unitTest: withOutput(),
        integrationTest: withOutput(),
        systemTest: withOutput(),
        acceptanceTest: withOutput(),
      }),
      { projectRoot: root },
    );
    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('E2: sha256 与文件实际摘要不符 → 红', () => {
    const root = makeTmpDir();
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    writeFileSync(join(root, 'artifacts', 'run.txt'), 'real\n', 'utf-8');
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({ rawOutputPath: 'artifacts/run.txt', rawOutputSha256: 'b'.repeat(64) }),
        }),
      }),
      { projectRoot: root },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E2[\s\S]*SHA-256[\s\S]*不符/);
  });

  it('E2: rawOutputPath 指向的文件不存在 → 红', () => {
    const root = makeTmpDir();
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({ rawOutputPath: 'artifacts/missing.txt', rawOutputSha256: 'c'.repeat(64) }),
        }),
      }),
      { projectRoot: root },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E2[\s\S]*不存在/);
  });

  it('E2: 携 rawOutputPath + rawOutputSha256 但未提供 projectRoot → 红（fail-closed，无法核验不得放行）', () => {
    // 锁死 fail-closed 契约（任务 2 审查移交）：调用方漏传项目根时，E2 必须拒绝而非静默跳过——
    // 否则「声明了哈希」反而因无法核验被放行，E2 形同虚设。
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({ rawOutputPath: 'artifacts/run.txt', rawOutputSha256: 'd'.repeat(64) }),
        }),
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E2[\s\S]*未提供项目根[\s\S]*fail-closed/);
    expect(result.testEvidence?.e2).toBe(1);
  });

  it('E2: 路径越出项目根 → resolveTestEvidenceOutputPath 拒绝；根内相对路径接受', () => {
    const root = makeTmpDir();
    const resolve = gateLogic.resolveTestEvidenceOutputPath;
    expect(typeof resolve).toBe('function');
    // 越出根（lexical `..`）——即使 schema pattern 前置拦截，逻辑层仍须自证拒绝
    expect(resolve(root, '../outside.txt').ok).toBe(false);
    expect(resolve(root, 'a/../../b.txt').ok).toBe(false);
    // 绝对路径（POSIX / Windows 盘符）
    expect(resolve(root, '/etc/passwd').ok).toBe(false);
    expect(resolve(root, 'C:\\Windows\\system32\\x.txt').ok).toBe(false);
    // 反斜杠分隔（跨平台路径歧义）
    expect(resolve(root, 'artifacts\\run.txt').ok).toBe(false);
    // 根内合法相对路径
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    writeFileSync(join(root, 'artifacts', 'run.txt'), 'evidence\n', 'utf-8');
    const ok = resolve(root, 'artifacts/run.txt');
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.absPath.startsWith(root)).toBe(true);
  });

  // ==================== E3 结果一致性 ====================
  it('E3: failed>0（阶段外层）而 exitCode=0 → 红（有失败必来自非零退出）', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({ total: 1, passed: 1, coverage: 85 }),
        integrationTest: makeSummary({
          total: 3,
          passed: 0,
          failed: 3,
          pending: 0,
          coverage: 0,
          evidence: makeEvidence({ exitCode: 0 }),
        }),
        systemTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
        acceptanceTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
      }),
      { phaseOption: 5 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E3[\s\S]*failed=3[\s\S]*exitCode=0/);
  });

  it('E3: failed>0 而 exitCode=1 → 无 E3 违规（阶段外层因此全绿）', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({ total: 1, passed: 1, coverage: 85 }),
        integrationTest: makeSummary({
          total: 3,
          passed: 0,
          failed: 3,
          pending: 0,
          coverage: 0,
          evidence: makeEvidence({ exitCode: 1 }),
        }),
        systemTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
        acceptanceTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
      }),
      { phaseOption: 5 },
    );
    expect(result.reasons.join('\n')).not.toMatch(/E3/);
    expect(result.passed).toBe(true);
  });

  it('E3: failed=0 && pending=0 而 exitCode=1 → 红（全绿不可能来自非零退出）', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          total: 2,
          passed: 2,
          failed: 0,
          pending: 0,
          coverage: 85,
          evidence: makeEvidence({ exitCode: 1 }),
        }),
      }),
      { phaseOption: 5 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E3[\s\S]*exitCode=1/);
  });

  it('E3: failed=0 && pending>0 不约束（exitCode=1 不报 E3；阶段外层全绿）', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({ total: 1, passed: 1, coverage: 85 }),
        integrationTest: makeSummary({
          total: 3,
          passed: 1,
          failed: 0,
          pending: 2,
          coverage: 0,
          evidence: makeEvidence({ exitCode: 1 }),
        }),
        systemTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
        acceptanceTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
      }),
      { phaseOption: 5 },
    );
    expect(result.reasons.join('\n')).not.toMatch(/E3/);
    expect(result.passed).toBe(true);
  });

  // ==================== E4 存在性 + cutoff ====================
  it('E4: cutoff 后阶段内层 total>0 缺 evidence → 红', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummaryNoEvidence(),
        integrationTest: makeSummaryNoEvidence(),
      }),
      { phaseOption: 6 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E4[\s\S]*单元测试[\s\S]*缺 evidence/);
    expect(result.reasons.join('\n')).toMatch(/E4[\s\S]*集成测试/);
  });

  it('E4: lastUpdated 早于旧 cutoff 仍须阻断，时间戳不得作为 legacy 放行', () => {
    const result = run(
      makeMatrix({
        lastUpdated: BEFORE_CUTOFF,
        unitTest: makeSummaryNoEvidence(),
        integrationTest: makeSummaryNoEvidence(),
      }),
      { phaseOption: 6 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E4[\s\S]*单元测试[\s\S]*缺 evidence/);
    expect(result.legacy ?? []).toEqual([]);
  });

  it('E4: evidence.command 仅空白时须阻断，不能以对象存在替代可执行命令', () => {
    const result = run(makeMatrix({ unitTest: makeSummary({ evidence: makeEvidence({ command: '   ' }) }) }));
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E4[\s\S]*command/);
  });

  it('E4: lastUpdated 不可解析 → 红（保守按 cutoff 后处理，不吸收）', () => {
    const result = run(
      makeMatrix({
        lastUpdated: 'not-a-date',
        unitTest: makeSummaryNoEvidence(),
        integrationTest: makeSummaryNoEvidence(),
      }),
      { phaseOption: 6 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E4/);
    expect(result.legacy ?? []).toEqual([]);
  });

  it('E4: lastUpdated 缺失 → 红（保守按 cutoff 后处理，不吸收）', () => {
    const result = run(
      makeMatrix({
        lastUpdated: undefined,
        unitTest: makeSummaryNoEvidence(),
        integrationTest: makeSummaryNoEvidence(),
      }),
      { phaseOption: 6 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E4/);
  });

  it('E4: total=0 的层不要求 evidence（不产生 E4 违规；由既有「无用例」规则拦截）', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummaryNoEvidence({ total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 }),
        integrationTest: makeSummary(),
      }),
      { phaseOption: 6 },
    );
    expect(result.reasons.join('\n')).not.toMatch(/E4/);
  });

  it('E4: 阶段外层缺 evidence 不触发 E4（phase=5 只约束 unitTest）', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({ total: 1, passed: 1, coverage: 85 }),
        integrationTest: makeSummaryNoEvidence({ total: 3, passed: 3, pending: 0, coverage: 0 }),
        systemTest: makeSummaryNoEvidence({ total: 3, passed: 3, pending: 0, coverage: 0 }),
        acceptanceTest: makeSummaryNoEvidence({ total: 3, passed: 3, pending: 0, coverage: 0 }),
      }),
      { phaseOption: 5 },
    );
    expect(result.reasons.join('\n')).not.toMatch(/E4/);
    expect(result.passed).toBe(true);
  });

  it('计数：GATE_JSON e-rule 计数（e1/e2/e3/e4 + legacy/missing/checked）', () => {
    const after = run(makeMatrix({ unitTest: makeSummaryNoEvidence(), integrationTest: makeSummaryNoEvidence() }), {
      phaseOption: 6,
    });
    expect(after.testEvidence?.e4).toBe(2);
    expect(after.testEvidence?.missing).toBe(2);
    expect(after.testEvidence?.legacy).toBe(0);

    const before = run(
      makeMatrix({
        lastUpdated: BEFORE_CUTOFF,
        unitTest: makeSummaryNoEvidence(),
        integrationTest: makeSummaryNoEvidence(),
      }),
      { phaseOption: 6 },
    );
    expect(before.testEvidence?.legacy).toBe(0);
    expect(before.testEvidence?.e4).toBe(2);
  });
});
