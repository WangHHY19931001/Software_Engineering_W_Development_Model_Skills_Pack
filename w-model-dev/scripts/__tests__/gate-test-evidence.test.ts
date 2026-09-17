/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(root, ...) 路径由测试自生成，非用户输入） */
/**
 * gate-test-evidence.test.ts —— M07 RTM 测试证据门禁规则（E1-E4，严格证据模式）
 *
 * 覆盖计划 §0.1.2 四条确定性规则：
 *   E1 配对（rawOutputPath ↔ rawOutputSha256 要么都有要么都无）
 *   E2 哈希核验（相对项目根解析 / 禁越出根 / 文件须存在 / sha256 须相符）
 *   E3 结果一致性（failed=0&&pending=0 ⇒ exitCode=0；failed>0 ⇒ exitCode≥1；
 *      failed=0&&pending>0 不约束）
 *   E4 存在性（阶段 5-8 当前层 total>0 时必须带合法 evidence；lastUpdated 仅为元数据，
 *      不参与证据信任判定）
 *
 * 策略：纯逻辑内联 RTM 夹具（无 phaseOption 副作用），E2 用 os.tmpdir() 写真实产物
 * 文件并算真实 sha256。不写 .w-model/。
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';
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
  return {
    command: 'npx vitest run',
    exitCode: 0,
    observedAt: AFTER_CUTOFF,
    ...over,
  };
}

/** 合法（全绿）测试摘要，默认携带合法 evidence。 */
function makeSummary(over: Partial<Summary> = {}): Summary {
  return {
    total: 2,
    passed: 2,
    failed: 0,
    pending: 0,
    coverage: 90,
    evidence: makeEvidence(),
    ...over,
  };
}

/** 缺 evidence 的测试摘要（显式删除 evidence 键）。 */
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

/** 默认使用现代 lastUpdated；显式传 lastUpdated: undefined 模拟字段缺失。 */
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

describe('M07 测试证据门禁规则（E1-E4，严格证据模式）', () => {
  it('基线：全绿 + 合法 evidence → passed', () => {
    const result = run(makeMatrix());
    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
  });

  // ==================== E1 配对 ====================
  it('E1: 只有 rawOutputPath（缺 rawOutputSha256）→ 红', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({ rawOutputPath: 'artifacts/run.txt' }),
        }),
      }),
    );
    expect(result.passed).toBe(false);
    // 正则须锚定消息尾部的「当前只有 <缺失字段>」：只写 /E1…rawOutputPath…rawOutputSha256/
    // 会同时命中「必须成对出现」前缀里的两个字段名，对字段顺序/缺失方毫无鉴别力（任务 2 审查移交）。
    expect(result.reasons.join('\n')).toMatch(/E1[\s\S]*必须成对出现（当前只有 rawOutputPath）/);
    expect(result.reasons.join('\n')).not.toMatch(/当前只有 rawOutputSha256/);
  });

  it('E1: 只有 rawOutputSha256（缺 rawOutputPath）→ 红', () => {
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({ rawOutputSha256: 'a'.repeat(64) }),
        }),
      }),
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
      makeSummary({
        evidence: makeEvidence({
          rawOutputPath: 'artifacts/run.txt',
          rawOutputSha256: sha,
        }),
      });
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
          evidence: makeEvidence({
            rawOutputPath: 'artifacts/run.txt',
            rawOutputSha256: 'b'.repeat(64),
          }),
        }),
      }),
      { projectRoot: root },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/E2[\s\S]*SHA-256[\s\S]*不符/);
  });

  it('E2: 项目内 evidence output 指向项目外 symlink → checkArtifactGate fail-closed 且可观察 e2', () => {
    const root = makeTmpDir();
    const outside = makeTmpDir();
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    const content = 'outside evidence\n';
    writeFileSync(join(outside, 'run.txt'), content, 'utf-8');
    symlinkSync(join(outside, 'run.txt'), join(root, 'artifacts', 'run-link.txt'), 'file');
    const sha = createHash('sha256').update(content).digest('hex');

    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({
            rawOutputPath: 'artifacts/run-link.txt',
            rawOutputSha256: sha,
          }),
        }),
      }),
      { projectRoot: root },
    );

    expect(result.passed).toBe(false);
    expect(result.testEvidence?.e2).toBe(1);
    expect(result.reasons.join('\n')).toMatch(/E2[\s\S]*单元测试[\s\S]*非法[\s\S]*link/);
  });

  it('E2: rawOutputPath 指向的文件不存在 → 红', () => {
    const root = makeTmpDir();
    const result = run(
      makeMatrix({
        unitTest: makeSummary({
          evidence: makeEvidence({
            rawOutputPath: 'artifacts/missing.txt',
            rawOutputSha256: 'c'.repeat(64),
          }),
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
          evidence: makeEvidence({
            rawOutputPath: 'artifacts/run.txt',
            rawOutputSha256: 'd'.repeat(64),
          }),
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
        systemTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
        acceptanceTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
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
        systemTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
        acceptanceTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
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
        systemTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
        acceptanceTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
      }),
      { phaseOption: 5 },
    );
    expect(result.reasons.join('\n')).not.toMatch(/E3/);
    expect(result.passed).toBe(true);
  });

  // ==================== E4 存在性 ====================
  it('E4: 阶段内层 total>0 缺 evidence → 红', () => {
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
    const result = run(
      makeMatrix({
        unitTest: makeSummary({ evidence: makeEvidence({ command: '   ' }) }),
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.reasons.join('\n')).toMatch(/\[schema\][\s\S]*command/);
    expect(result.reasons.join('\n')).toMatch(/E4[\s\S]*单元测试[\s\S]*无效/);
    expect(result.testEvidence).toMatchObject({
      checked: 4,
      withEvidence: 3,
      missing: 1,
      e4: 1,
      legacy: 0,
    });
    expect(result.legacy ?? []).toEqual([]);
  });

  it('E4: lastUpdated 不可解析 → 红（时间戳不参与放行）', () => {
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

  it('E4: lastUpdated 缺失 → 红（时间戳不参与放行）', () => {
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
        unitTest: makeSummaryNoEvidence({
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          coverage: 0,
        }),
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
        integrationTest: makeSummaryNoEvidence({
          total: 3,
          passed: 3,
          pending: 0,
          coverage: 0,
        }),
        systemTest: makeSummaryNoEvidence({
          total: 3,
          passed: 3,
          pending: 0,
          coverage: 0,
        }),
        acceptanceTest: makeSummaryNoEvidence({
          total: 3,
          passed: 3,
          pending: 0,
          coverage: 0,
        }),
      }),
      { phaseOption: 5 },
    );
    expect(result.reasons.join('\n')).not.toMatch(/E4/);
    expect(result.passed).toBe(true);
  });

  it('计数：GATE_JSON e-rule 计数（e1/e2/e3/e4 + legacy/missing/checked）', () => {
    const after = run(
      makeMatrix({
        unitTest: makeSummaryNoEvidence(),
        integrationTest: makeSummaryNoEvidence(),
      }),
      {
        phaseOption: 6,
      },
    );
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

// ==================== CLI 三态链路（真实 check-artifact-gate.ts 子进程，任务 7 步骤 4） ====================

/**
 * 纯函数覆盖证明「规则算得对」，但不证明「CLI 把它接到了 stdout/退出码上」。
 * 本组用真实子进程钉住可达到的两态（业务违规 exit 1 / 输入错误 exit 2）——
 * exit 0 态需要一份能通过阶段 8 全部外检的完整项目（bdd-manifest、cucumber 报告、
 * codegraph scope、opsx 制品…），仓库内不存在该 fixture，故未在此断言（见任务报告「未完成项」）。
 */
describe('M07 CLI 三态链路（真实子进程）', () => {
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  const gateScript = join(import.meta.dirname, '../cli/check-artifact-gate.ts');
  const validRtmSource = readFileSync(join(import.meta.dirname, '../samples/gate/valid-rtm.json'), 'utf-8');

  function makeProject(mutate?: (rtm: Record<string, unknown>) => void): string {
    const dir = mkdtempSync(join(tmpdir(), 'wm-m07-cli-'));
    mkdirSync(join(dir, '.w-model'), { recursive: true });
    const rtm = JSON.parse(validRtmSource) as Record<string, unknown>;
    if (mutate !== undefined) mutate(rtm);
    writeFileSync(join(dir, '.w-model', 'rtm.json'), JSON.stringify(rtm), 'utf-8');
    return dir;
  }

  function runGate(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
    const result = runSync(process.execPath, [tsxCli, gateScript, ...args, '--json'], { timeout: 120_000 });
    return { status: result.status, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') };
  }

  it('业务违规：阶段层 total>0 缺 evidence → exit 1，GATE_JSON reasons 含 M07 E4', () => {
    const dir = makeProject((rtm) => {
      const summary = rtm.executionSummary as Record<string, Record<string, unknown>>;
      delete summary.systemTest!.evidence;
    });
    try {
      const result = runGate([dir, '--phase=8']);
      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as { passed: boolean; reasons: string[] };
      expect(report.passed).toBe(false);
      expect(report.reasons.join('\n')).toMatch(/RTM 测试证据 E4/);
      // 违规文案用层的显示名（阶段层键 systemTest → 「系统测试」），并带上 total 与「缺 evidence」事实
      expect(report.reasons.join('\n')).toContain('系统测试 total=12>0 但缺 evidence');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('输入错误：项目目录不存在 → exit 2 且 stdout 为 ERROR_JSON（不产出 GATE_JSON）', () => {
    const missing = join(tmpdir(), `wm-m07-missing-${String(Date.now())}`);
    const result = runGate([missing, '--phase=8']);
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('ERROR_JSON');
    expect(result.stdout).not.toContain('"type":"artifact"');
    expect(result.stderr).toMatch(/✗ \[/);
  }, 120_000);
});
