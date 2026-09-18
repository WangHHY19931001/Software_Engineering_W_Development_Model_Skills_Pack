/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(tmpDir, ...) 路径由测试自生成，非用户输入） */
/**
 * check-samples-coverage.ts CLI 层单元测试（子进程 + 临时目录，F-G7-06/07，audit-fixes task 6）
 *
 * 覆盖 samples 覆盖门禁双向化的两个 RED 场景（负例全部在测试内临时目录构造，不动仓库 samples/）：
 *   - reference-dangling：self-test.ts 引用指向不存在的 fixture → exit 1（旧门禁单向放行 exit 0）
 *   - matrix-undeclared：README 正文提及目录名（反引号）但无矩阵表行 → exit 1（弱校验收紧为矩阵行解析）
 *   - 正例：引用在盘 + 矩阵行声明齐全 → exit 0
 *
 * 临时 self-test.ts 内容按 extractReferences 可解析形态构造（runXxxCases 函数 + *_CASES 数组配对）。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-samples-coverage.ts');

/** 构造可被 extractReferences 解析的 self-test.ts 内容（引用 samples/<subdir>/ 下文件） */
function fakeSelfTest(refs: Array<{ subdir: string; file: string }>): string {
  const subdirs = [...new Set(refs.map((r) => r.subdir))];
  const blocks = subdirs.map((subdir) => {
    const varName = `${subdir.replace(/[^a-z0-9]/gi, '')}_CASES`;
    const dirVar = `${subdir.replace(/[^a-z0-9]/gi, '')}SamplesDir`;
    const entries = refs
      .filter((r) => r.subdir === subdir)
      .map((r) => `{ file: '${r.file}' }`)
      .join(', ');
    // 形态须匹配 extractReferences：const <x>SamplesDir = path.join(samplesDir, '<subdir>')
    // + for (const c of <X>_CASES) + path.join(<x>SamplesDir, c.file)
    return `const ${varName}: Array<{ file: string }> = [${entries}];\nasync function run${varName.replace('_CASES', '')}Cases(): Promise<void> {\n  const ${dirVar} = path.join(samplesDir, '${subdir}');\n  for (const c of ${varName}) {\n    await run(path.join(${dirVar}, c.file));\n  }\n}`;
  });
  return blocks.join('\n');
}

/** samples/README.md：矩阵表行声明 dirs；prose 提及仅出现在正文（不算声明） */
function fakeReadme(matrixDirs: string[], proseMentions: string[] = []): string {
  const rows = matrixDirs.map((d) => `| \`${d}\` | check-x | CASES（1） | 用途 | 平铺 JSON |`);
  const prose = proseMentions.map((d) => `正文提到 \`${d}\` 但未在矩阵声明。`);
  return [
    '# samples/ 覆盖矩阵',
    '',
    '| 子目录 | 对应 check 脚本 | 用例数组 | 用途 | 嵌套结构 |',
    '|---|---|---|---|---|',
    ...rows,
    ...prose,
  ].join('\n');
}

/** NEGATIVE-COVERAGE.md：未登记的门禁由门禁脚本枚举 cli/*.ts（减 self-test.ts）得出 */
function fakeNegativeCoverage(rows: Array<{ name: string; mechanism: string; evidence: string }>): string {
  return [
    '# 负向覆盖登记册',
    '',
    '| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |',
    '| --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.name} | ${r.mechanism} | ${r.evidence} | 防某具体回归 |`),
  ].join('\n');
}

/**
 * 门禁 stub 的**真实 exit-2 契约**（第 5 条规则要求逐门禁真实探针）：
 * 收到基础探针参数 `--d4-invalid-argument` 时按 `lib/cli-error.ts` 的输出形态
 * （stderr 人类错误行 + stdout `ERROR_JSON`）以 exit 2 退出，且不写任何文件；
 * 其余参数以 exit 0 退出（用于验证「探针失败」这一负向分支）。
 */
function fakeGateScriptSource(options: { exitTwo?: boolean } = {}): string {
  if (options.exitTwo === false) {
    return '// 不实现 exit-2 契约的门禁 stub：探针必须因此失败\nprocess.exitCode = 0;\n';
  }
  return [
    "if (process.argv.slice(2).includes('--d4-invalid-argument')) {",
    "  process.stderr.write('✗ [ARG_INVALID] 未知或无值参数\\n');",
    '  process.stdout.write(\'ERROR_JSON {"category":"ARG_INVALID","message":"未知或无值参数","exitCode":2}\\n\');',
    '  process.exitCode = 2;',
    '} else {',
    '  process.exitCode = 0;',
    '}',
    '',
  ].join('\n');
}

/**
 * 在临时仓内造一个可被 invocation / mutated-copy 证据引用的文件（恰 3 行）。
 * 证据用**锚**寻址（`<文件>#<锚>`）：`// line 2` 恰命中一次（正例），`// line` 命中三次（多命中负例）。
 */
async function putEvidenceFile(relPath: string): Promise<void> {
  const absolute = path.join(tmpDir, relPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, ['// line 1', '// line 2', '// line 3'].join('\n'), 'utf-8');
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'samples-coverage-cli-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function setupRepo(opts: {
  refs: Array<{ subdir: string; file: string }>;
  onDisk: string[];
  readme: string;
  /** 额外 cli/*.ts（非 self-test）用于构成 exit-2 门禁集合 */
  cliScripts?: string[];
  /** 额外 cli/*.ts 是否实现 exit-2 契约（缺省实现；false 用于验证探针失败分支） */
  cliExitTwo?: boolean;
  /** NEGATIVE-COVERAGE.md 内容；缺省为空登记表 */
  negative?: string;
  /** 覆盖 self-test.ts 内容（缺省由 refs 生成；用于自建用例数组结构） */
  selfTestContent?: string;
}): Promise<void> {
  await fs.mkdir(path.join(tmpDir, 'w-model-dev/scripts/cli'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'w-model-dev/scripts/cli/self-test.ts'),
    opts.selfTestContent ?? fakeSelfTest(opts.refs),
    'utf-8',
  );
  for (const script of opts.cliScripts ?? []) {
    await fs.writeFile(
      path.join(tmpDir, 'w-model-dev/scripts/cli', script),
      fakeGateScriptSource({ exitTwo: opts.cliExitTwo ?? true }),
      'utf-8',
    );
  }
  for (const rel of opts.onDisk) {
    const p = path.join(tmpDir, 'w-model-dev/scripts/samples', rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, '{}', 'utf-8');
  }
  await fs.writeFile(path.join(tmpDir, 'w-model-dev/scripts/samples/README.md'), opts.readme, 'utf-8');
  await fs.writeFile(
    path.join(tmpDir, 'w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md'),
    opts.negative ?? fakeNegativeCoverage([]),
    'utf-8',
  );
}

function run(): { code: number | null; stdout: string; stderr: string } {
  // 第 5 条规则后门禁会真实 spawn exit-2 探针子进程（每门禁一次），单次调用明显超过 runSync 的
  // 15s 默认超时；显式放宽（而非吞掉 status=null），避免把「探针慢」误判成断言失败。
  const r = runSync(process.execPath, [tsxCli, SCRIPT, tmpDir], { timeout: 180_000 });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('check-samples-coverage 双向闭环（F-G7-06/07）', () => {
  it('正例：引用在盘 + 矩阵行声明齐全 → exit 0', async () => {
    await setupRepo({
      refs: [{ subdir: 'foo', file: 'a.json' }],
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
    });
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('SAMPLES_COVERAGE_JSON');
    expect(r.stdout).toContain('"danglingRefs":0');
  });

  it('RED（F-G7-06）：self-test 引用指向不存在的 fixture → exit 1 reference-dangling（旧门禁 exit 0 放行）', async () => {
    await setupRepo({
      refs: [
        { subdir: 'foo', file: 'exists.json' },
        { subdir: 'foo', file: 'ghost.json' },
      ],
      onDisk: ['foo/exists.json'],
      readme: fakeReadme(['foo']),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('reference-dangling');
    expect(r.stdout).toContain('samples/foo/ghost.json');
  });

  it('RED（F-G7-07）：README 正文提及目录名但无矩阵表行 → exit 1 matrix-undeclared（反引号出现 ≠ 声明）', async () => {
    await setupRepo({
      refs: [{ subdir: 'bar', file: 'b.json' }],
      onDisk: ['bar/b.json'],
      readme: fakeReadme([], ['bar']),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('matrix-undeclared');
    expect(r.stdout).toContain('samples/bar/');
  });

  it('sampleDir 目录引用悬空 → exit 1 reference-dangling（目录形态）', async () => {
    await fs.mkdir(path.join(tmpDir, 'w-model-dev/scripts/cli'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'w-model-dev/scripts/cli/self-test.ts'),
      "const X: Array<{ sampleDir: string }> = [{ sampleDir: 'opsx-artifacts/ghost-phase5' }];\nvoid X;",
      'utf-8',
    );
    await fs.mkdir(path.join(tmpDir, 'w-model-dev/scripts/samples'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'w-model-dev/scripts/samples/README.md'), fakeReadme([]), 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md'),
      fakeNegativeCoverage([]),
      'utf-8',
    );
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('reference-dangling');
    expect(r.stdout).toContain('opsx-artifacts/ghost-phase5');
  });

  // ==================== M07：配套产物文件（auxFiles）引用登记 ====================
  /** 构造含 auxFiles 数组字段的 gate 用例块（形态同 GATE_CASES + runGateCases） */
  function fakeGateSelfTest(auxFiles: string[]): string {
    const aux = auxFiles.map((f) => `'${f}'`).join(', ');
    return [
      `const GATE_CASES: Array<{ file: string; auxFiles?: string[] }> = [{ file: 'a.json', auxFiles: [${aux}] }];`,
      'async function runGateCases(): Promise<void> {',
      "  const gateSamplesDir = path.join(samplesDir, 'gate');",
      '  for (const c of GATE_CASES) {',
      '    await run(path.join(gateSamplesDir, c.file));',
      '  }',
      '}',
    ].join('\n');
  }

  async function setupGateRepo(auxFiles: string[], onDisk: string[]): Promise<void> {
    await fs.mkdir(path.join(tmpDir, 'w-model-dev/scripts/cli'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'w-model-dev/scripts/cli/self-test.ts'), fakeGateSelfTest(auxFiles), 'utf-8');
    for (const rel of onDisk) {
      const p = path.join(tmpDir, 'w-model-dev/scripts/samples', rel);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, 'x', 'utf-8');
    }
    await fs.writeFile(path.join(tmpDir, 'w-model-dev/scripts/samples/README.md'), fakeReadme(['gate']), 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md'),
      fakeNegativeCoverage([]),
      'utf-8',
    );
  }

  it('M07：auxFiles 数组声明的配套产物被登记引用 → exit 0（不再误报未覆盖 fixture）', async () => {
    await setupGateRepo(['test-evidence-output.txt'], ['gate/a.json', 'gate/test-evidence-output.txt']);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"unregistered":0');
  });

  it('M07 RED：配套产物未被任何用例字段登记 → exit 1（仅 file/manifestFile/ticketsFile/auxFiles 是登记途径，不得默认放行）', async () => {
    await setupGateRepo([], ['gate/a.json', 'gate/test-evidence-output.txt']);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('samples/gate/test-evidence-output.txt');
  });
});

describe('check-samples-coverage 负向覆盖不变量（M06 / S28）', () => {
  const EVIDENCE_FILE = 'w-model-dev/scripts/__tests__/fake.test.ts';

  /** 构造「一个 exit-2 门禁 + 给定登记行」的最小仓（逐项变异用） */
  async function setupSingleGateRepo(
    rows: Array<{ name: string; mechanism: string; evidence: string }>,
    options: { cliExitTwo?: boolean; negative?: string } = {},
  ): Promise<void> {
    await setupRepo({
      refs: [{ subdir: 'foo', file: 'a.json' }],
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
      cliScripts: ['check-foo.ts'],
      ...(options.cliExitTwo === undefined ? {} : { cliExitTwo: options.cliExitTwo }),
      negative: options.negative ?? fakeNegativeCoverage(rows),
    });
  }

  it('RED：清单缺一个 exit-2 门禁 → exit 1 negative-coverage-missing', async () => {
    await setupSingleGateRepo([]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-missing');
    expect(r.stdout).toContain('check-foo');
  });

  it('RED：fixture 机制行指向不存在的 fixture → exit 1 negative-coverage-dangling', async () => {
    await setupSingleGateRepo([
      {
        name: 'check-foo',
        mechanism: 'fixture',
        evidence: "`samples/foo/ghost.json`（self-test.ts#file: 'a.json'）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-dangling');
    expect(r.stdout).toContain('samples/foo/ghost.json');
  });

  it('RED：登记集合外的门禁基名 → exit 1 negative-coverage-unknown-gate', async () => {
    await setupSingleGateRepo([
      {
        name: 'check-ghost',
        mechanism: 'fixture',
        evidence: "`samples/foo/a.json`（self-test.ts#file: 'a.json'）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-unknown-gate');
    expect(r.stdout).toContain('check-ghost');
  });

  it('RED：同一门禁登记两行 → exit 1 negative-coverage-duplicate', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([
      { name: 'check-foo', mechanism: 'invocation', evidence: `${EVIDENCE_FILE}#// line 2` },
      {
        name: 'check-foo',
        mechanism: 'fixture',
        evidence: "`samples/foo/a.json`（self-test.ts#file: 'a.json'）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-duplicate');
    expect(r.stdout).toContain('check-foo');
  });

  it('RED：登记行缺列 → exit 1 negative-coverage-malformed（坏行不得被静默跳过）', async () => {
    await setupSingleGateRepo([], {
      negative: [
        '| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |',
        '| --- | --- | --- | --- |',
        '| check-foo | fixture | `samples/foo/a.json` |',
      ].join('\n'),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-malformed');
  });

  it('RED：负向机制不在三值内 → exit 1 negative-coverage-unknown-mechanism', async () => {
    await setupSingleGateRepo([{ name: 'check-foo', mechanism: 'whatever', evidence: '`samples/foo/a.json`' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-unknown-mechanism');
  });

  it('RED：invocation 证据只有文字（无「文件#锚」）→ exit 1 negative-coverage-evidence-invalid', async () => {
    await setupSingleGateRepo([{ name: 'check-foo', mechanism: 'invocation', evidence: '由某个任务提供' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-invalid');
  });

  // ==================== 锚寻址（取代「文件:行号」位置耦合，2026-09-18 任务 3.5） ====================
  it('RED：新锚语法（文件#唯一子串锚，登记册实写形态=行内代码）命中恰一次 → exit 0', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([
      { name: 'check-foo', mechanism: 'invocation', evidence: `\`${EVIDENCE_FILE}#// line 2\`` },
    ]);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"negativeCoverageProbeFailures":0');
  });

  it('RED：旧行号语法（文件后跟「:数字」）→ exit 1 negative-coverage-evidence-anchor（无双语法兼容）', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([{ name: 'check-foo', mechanism: 'invocation', evidence: `${EVIDENCE_FILE}:2` }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('行号语法已移除');
  });

  it('RED：锚零命中（子串不在引用文件内）→ exit 1 negative-coverage-evidence-anchor', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([
      { name: 'check-foo', mechanism: 'invocation', evidence: `${EVIDENCE_FILE}#不存在的子串` },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('零命中');
  });

  it('RED：锚不唯一（子串在文件内出现多处）→ exit 1 negative-coverage-evidence-anchor（锚不唯一具名）', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([{ name: 'check-foo', mechanism: 'invocation', evidence: `${EVIDENCE_FILE}#// line` }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('锚不唯一');
  });

  it('RED：fixture 行引用文件不存在 → exit 1 negative-coverage-evidence-anchor（锚无法解析）', async () => {
    await setupSingleGateRepo([
      {
        name: 'check-foo',
        mechanism: 'fixture',
        evidence: "`samples/foo/a.json`（ghost-references.ts#file: 'a.json'）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('引用文件不存在');
  });

  it('RED：fixture 行锚零命中 → exit 1 negative-coverage-evidence-anchor（fixture 行同一锚语义）', async () => {
    await setupSingleGateRepo([
      {
        name: 'check-foo',
        mechanism: 'fixture',
        evidence: "`samples/foo/a.json`（`self-test.ts#file: 'ghost.json'`）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('零命中');
  });

  it('RED：引用路径存在但不是普通文件（同名目录）→ exit 1 negative-coverage-evidence-anchor（isFile 判定）', async () => {
    const dirEvidence = 'w-model-dev/scripts/__tests__/weird-name.test.ts';
    await fs.mkdir(path.join(tmpDir, dirEvidence), { recursive: true });
    await setupSingleGateRepo([{ name: 'check-foo', mechanism: 'invocation', evidence: `${dirEvidence}#任意子串` }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('引用路径不是普通文件');
  });

  it('RED：锚为空（`#` 后只有空白）→ exit 1 negative-coverage-evidence-anchor（空锚不是证据）', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([{ name: 'check-foo', mechanism: 'invocation', evidence: `\`${EVIDENCE_FILE}#   \`` }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-anchor');
    expect(r.stdout).toContain('锚为空');
  });

  // ============ fixture 行锚相关度：锚须落在**登记该 fixture 的用例条目**内（2026-09-18 修复轮） ============
  /**
   * 「两个同名 fixture 分属两个用例数组」的自建 self-test：`samples/alpha/dupe.json` 与
   * `samples/beta/dupe.json` 基名相同（两条目的 `file:` 都是 'dupe.json'），条目里唯一可区分的是
   * marker / note 行——「条目内含 fixture 基名」这类粗相关度判据对这对 fixture 恒真，只有条目粒度
   * （锚落在哪条用例条目内 + 该条目登记了哪些 samples/ 引用）才能区分。
   */
  function fakeSameNameSelfTest(): string {
    return [
      'const ALPHA_CASES: Array<{ file: string; marker: string; note: string; auxFiles?: string[] }> = [',
      "  { file: 'dupe.json', marker: 'alpha-entry-marker', note: 'alpha-entry-note', auxFiles: ['extra.txt'] },",
      '];',
      'async function runAlphaCases(): Promise<void> {',
      "  const alphaSamplesDir = path.join(samplesDir, 'alpha');",
      '  for (const c of ALPHA_CASES) {',
      '    await run(path.join(alphaSamplesDir, c.file));',
      '  }',
      '}',
      'const BETA_CASES: Array<{ file: string; marker: string; note: string }> = [',
      "  { file: 'dupe.json', marker: 'beta-entry-marker', note: 'beta-entry-note' },",
      '];',
      'async function runBetaCases(): Promise<void> {',
      "  const betaSamplesDir = path.join(samplesDir, 'beta');",
      '  for (const c of BETA_CASES) {',
      '    await run(path.join(betaSamplesDir, c.file));',
      '  }',
      '}',
    ].join('\n');
  }

  /** 同名 fixture 自建仓：alpha / beta 两个用例数组 + 三个 fixture 在盘 + 两个 exit-2 门禁 stub */
  async function setupSameNameRepo(rows: Array<{ name: string; mechanism: string; evidence: string }>): Promise<void> {
    await setupRepo({
      refs: [],
      selfTestContent: fakeSameNameSelfTest(),
      onDisk: ['alpha/dupe.json', 'alpha/extra.txt', 'beta/dupe.json'],
      readme: fakeReadme(['alpha', 'beta']),
      cliScripts: ['check-alpha.ts', 'check-beta.ts'],
      negative: fakeNegativeCoverage(rows),
    });
  }

  it('正例：两个同名 fixture 各自锚到自己的用例条目 → exit 0（相关度判据不误伤正确登记）', async () => {
    await setupSameNameRepo([
      {
        name: 'check-alpha',
        mechanism: 'fixture',
        evidence: "`samples/alpha/dupe.json`（`self-test.ts#note: 'alpha-entry-note'`）",
      },
      {
        name: 'check-beta',
        mechanism: 'fixture',
        evidence: "`samples/beta/dupe.json`（`self-test.ts#marker: 'beta-entry-marker'`）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"negativeCoverageRows":2');
    expect(r.stdout).toContain('"negativeCoverageProbeFailures":0');
  });

  it('RED（P1）：锚落在**另一个同名 fixture 的用例条目**上 → exit 1 negative-coverage-evidence-relevance', async () => {
    await setupSameNameRepo([
      {
        name: 'check-alpha',
        mechanism: 'fixture',
        evidence: "`samples/alpha/dupe.json`（`self-test.ts#note: 'alpha-entry-note'`）",
      },
      {
        name: 'check-beta',
        mechanism: 'fixture',
        evidence: "`samples/beta/dupe.json`（`self-test.ts#marker: 'alpha-entry-marker'`）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-relevance');
    expect(r.stdout).toContain('锚落在用例条目 ALPHA_CASES 内');
    // 该锚未被第二条 fixture 行占用 → 共用锚判据拦不住，只有条目归属判据能拦（判据必须承重）
    expect(r.stdout).not.toContain('negative-coverage-evidence-shared-anchor');
  });

  it('RED（P2）：两个同名 fixture 互换锚 → exit 1（纯互换下每条锚仍各自唯一，只有条目归属能拦）', async () => {
    await setupSameNameRepo([
      {
        name: 'check-alpha',
        mechanism: 'fixture',
        evidence: "`samples/alpha/dupe.json`（`self-test.ts#marker: 'beta-entry-marker'`）",
      },
      {
        name: 'check-beta',
        mechanism: 'fixture',
        evidence: "`samples/beta/dupe.json`（`self-test.ts#marker: 'alpha-entry-marker'`）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-relevance');
    expect(r.stdout).toContain('锚落在用例条目 BETA_CASES 内');
    expect(r.stdout).toContain('锚落在用例条目 ALPHA_CASES 内');
    expect(r.stdout).not.toContain('negative-coverage-evidence-shared-anchor');
  });

  it('RED：同一 (引用文件, 锚) 被两条指向不同 fixture 的 fixture 行共用 → exit 1 evidence-shared-anchor', async () => {
    await setupSameNameRepo([
      {
        name: 'check-alpha',
        mechanism: 'fixture',
        evidence: "`samples/alpha/dupe.json`（`self-test.ts#marker: 'alpha-entry-marker'`）",
      },
      // 同一条目登记的 auxFiles（alpha/extra.txt）与主输入共用同一锚 → 两条行指向不同 fixture 却比同一锚
      {
        name: 'check-beta',
        mechanism: 'fixture',
        evidence: "`samples/alpha/extra.txt`（`self-test.ts#marker: 'alpha-entry-marker'`）",
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-shared-anchor');
    expect(r.stdout).toContain('alpha/extra.txt');
    expect(r.stdout).not.toContain('negative-coverage-evidence-relevance');
  });

  it('RED（相关度 fail-closed）：fixture 行的锚指向用例登记来源之外的文件 → exit 1 evidence-relevance', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo([
      {
        name: 'check-foo',
        mechanism: 'fixture',
        evidence: `\`samples/foo/a.json\`（\`${EVIDENCE_FILE}#// line 2\`）`,
      },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-evidence-relevance');
    expect(r.stdout).toContain('用例登记来源');
  });

  it('RED：门禁不实现 exit-2 契约 → exit 1 negative-coverage-probe-failed（探针是真执行，非纸面登记）', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupSingleGateRepo(
      [{ name: 'check-foo', mechanism: 'invocation', evidence: `${EVIDENCE_FILE}#// line 2` }],
      {
        cliExitTwo: false,
      },
    );
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-probe-failed');
    expect(r.stdout).toContain('exit code 应为 2');
  });

  it('正例：登记齐全、证据可解析、探针真实 exit 2 → exit 0（并报告探针数）', async () => {
    await putEvidenceFile(EVIDENCE_FILE);
    await setupRepo({
      refs: [{ subdir: 'foo', file: 'a.json' }],
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
      cliScripts: ['check-foo.ts', 'check-bar.ts'],
      negative: fakeNegativeCoverage([
        {
          name: 'check-foo',
          mechanism: 'fixture',
          evidence: "`samples/foo/a.json`（`self-test.ts#file: 'a.json'`）",
        },
        { name: 'check-bar', mechanism: 'invocation', evidence: `\`${EVIDENCE_FILE}#// line 2\`` },
      ]),
    });
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"negativeCoverageMissing":0');
    expect(r.stdout).toContain('"negativeCoverageDangling":0');
    expect(r.stdout).toContain('"negativeCoverageProbes":2');
    expect(r.stdout).toContain('"negativeCoverageProbeFailures":0');
  });

  it('缺 samples/NEGATIVE-COVERAGE.md → exit 2（与既有三必需文件同口径）', async () => {
    await setupRepo({
      refs: [{ subdir: 'foo', file: 'a.json' }],
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
    });
    await fs.rm(path.join(tmpDir, 'w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md'));
    const r = run();
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
    expect(r.stdout).toContain('NEGATIVE-COVERAGE.md');
  });
});
