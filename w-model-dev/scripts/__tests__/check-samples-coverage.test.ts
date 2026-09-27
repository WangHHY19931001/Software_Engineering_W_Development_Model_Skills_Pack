/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(tmpDir, ...) 路径由测试自生成，非用户输入） */
/**
 * check-samples-coverage.ts CLI 层单元测试（子进程 + 临时目录，F-G7-06/07，audit-fixes task 6）
 *
 * 覆盖 samples 覆盖门禁的各个 exit 1 场景（负例全部在测试内临时目录构造，不动仓库 samples/）：
 *   - reference-dangling：self-test.ts 引用指向不存在的 fixture → exit 1（旧门禁单向放行 exit 0）
 *   - matrix-undeclared：README 正文提及目录名（反引号）但无矩阵表行 → exit 1（弱校验收紧为矩阵行解析）
 *   - 正例：引用在盘 + 矩阵行声明齐全 → exit 0
 *
 * 负向覆盖登记册（4 列 `门禁 | fixture | 机制 | 所防回归`）自 2026-09-27 任务 1 / T1 起的判据：
 * 列数 / 空列 / `fixture` 机制行非 `samples/` 路径 → malformed；fixture 在盘（dangling）；fixture 被
 * self-test 引用**恰一处**（多义 → ambiguous-coverage）；覆盖条目须**期望失败**（非失败 → not-failing）；
 * 手写锚与多锚语法已整体移除，覆盖位置改由门禁**派生**输出（`derivedAnchors`，顺序 = 登记行序）。
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

/** 构造可被 extractReferences 解析的 self-test.ts 内容（引用 samples/<subdir>/ 下文件，期望失败） */
function fakeSelfTest(refs: Array<{ subdir: string; file: string }>): string {
  const subdirs = [...new Set(refs.map((r) => r.subdir))];
  const blocks = subdirs.map((subdir) => {
    const varName = `${subdir.replace(/[^a-z0-9]/gi, '')}_CASES`;
    const dirVar = `${subdir.replace(/[^a-z0-9]/gi, '')}SamplesDir`;
    const entries = refs
      .filter((r) => r.subdir === subdir)
      // expectedPassed: false 是负面登记行的前提（规则 4 收紧：非失败样本不得占行）
      .map((r) => `{ file: '${r.file}', expectedPassed: false }`)
      .join(', ');
    // 形态须匹配 extractReferences：const <x>SamplesDir = path.join(samplesDir, '<subdir>')
    // + for (const c of <X>_CASES) + path.join(<x>SamplesDir, c.file)
    return `const ${varName}: Array<{ file: string; expectedPassed: boolean }> = [${entries}];\nasync function run${varName.replace('_CASES', '')}Cases(): Promise<void> {\n  const ${dirVar} = path.join(samplesDir, '${subdir}');\n  for (const c of ${varName}) {\n    await run(path.join(${dirVar}, c.file));\n  }\n}`;
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

/** NEGATIVE-COVERAGE.md（4 列：门禁 | fixture | 机制 | 所防回归）；未登记的门禁由 cli/*.ts 减去 self-test.ts 枚举得出 */
function fakeNegativeCoverage(rows: Array<{ name: string; fixture: string; mechanism: string }>): string {
  return [
    '# 负向覆盖登记册',
    '',
    '| 门禁脚本 | fixture | 机制 | 所防回归（一句话） |',
    '| --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.name} | ${r.fixture} | ${r.mechanism} | 防某具体回归 |`),
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
 * 在临时仓内造一个 invocation / mutated-copy 行可引用的落点文件（恰 3 行）。
 * 第 2 列是**路径**（不再是手写 `文件#锚`）：门禁只核它在盘，锚由门禁自行派生（2026-09-27 任务 1 / T1）。
 */
async function putTargetFile(relPath: string): Promise<void> {
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
    rows: Array<{ name: string; fixture: string; mechanism: string }>,
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
    await setupSingleGateRepo([{ name: 'check-foo', fixture: '`samples/foo/ghost.json`', mechanism: 'fixture' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-dangling');
    expect(r.stdout).toContain('samples/foo/ghost.json');
  });

  it('RED：登记集合外的门禁基名 → exit 1 negative-coverage-unknown-gate', async () => {
    await setupSingleGateRepo([{ name: 'check-ghost', fixture: '`samples/foo/a.json`', mechanism: 'fixture' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-unknown-gate');
    expect(r.stdout).toContain('check-ghost');
  });

  it('RED：同一门禁登记两行 → exit 1 negative-coverage-duplicate', async () => {
    await putTargetFile(EVIDENCE_FILE);
    await setupSingleGateRepo([
      { name: 'check-foo', fixture: `\`${EVIDENCE_FILE}\``, mechanism: 'invocation' },
      { name: 'check-foo', fixture: '`samples/foo/a.json`', mechanism: 'fixture' },
    ]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-duplicate');
    expect(r.stdout).toContain('check-foo');
  });

  it('RED：负向机制不在三值内 → exit 1 negative-coverage-unknown-mechanism', async () => {
    await setupSingleGateRepo([{ name: 'check-foo', fixture: '`samples/foo/a.json`', mechanism: 'whatever' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-unknown-mechanism');
  });

  /** 自建 self-test（单数组 + 逐条目指定期望标记）：用于规则 4 收紧的两个负例 */
  function fakeSelfTestWithFlags(entryFlags: string[]): string {
    const entries = entryFlags.map((flag) => `{ file: 'a.json', ${flag} }`).join(', ');
    return [
      'const FOO_CASES: Array<{ file: string; expectedPassed: boolean }> = [',
      `  ${entries},`,
      '];',
      'async function runFooCases(): Promise<void> {',
      "  const fooSamplesDir = path.join(samplesDir, 'foo');",
      '  for (const c of FOO_CASES) {',
      '    await run(path.join(fooSamplesDir, c.file));',
      '  }',
      '}',
    ].join('\n');
  }

  // ==================== 4 列语法与 fixture 判据（2026-09-27 任务 1 / T1） ====================
  it('RED：登记行列数不是 4 → exit 1 negative-coverage-malformed（坏行不得被静默跳过）', async () => {
    await setupSingleGateRepo([], {
      negative: [
        '| 门禁脚本 | fixture | 机制 | 所防回归（一句话） |',
        '| --- | --- | --- | --- |',
        '| check-foo | `samples/foo/a.json` | fixture |',
      ].join('\n'),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-malformed');
    expect(r.stdout).toContain('列数为 3');
  });

  it('RED：fixture 列为空 → exit 1 negative-coverage-malformed（空列不是登记）', async () => {
    await setupSingleGateRepo([], {
      negative: [
        '| 门禁脚本 | fixture | 机制 | 所防回归（一句话） |',
        '| --- | --- | --- | --- |',
        '| check-foo |  | fixture | 防某具体回归 |',
      ].join('\n'),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-malformed');
    expect(r.stdout).toContain('存在空列');
  });

  it('RED：fixture 机制行的 fixture 列不是 samples/ 路径 → exit 1 negative-coverage-malformed', async () => {
    await setupSingleGateRepo([{ name: 'check-foo', fixture: `\`${EVIDENCE_FILE}\``, mechanism: 'fixture' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-malformed');
    expect(r.stdout).toContain('不是 samples/ 下的 fixture 路径');
  });

  it('RED：非失败样本（期望通过）占行 → exit 1 negative-coverage-not-failing（诊断型样本不得占行）', async () => {
    await setupRepo({
      refs: [],
      selfTestContent: fakeSelfTestWithFlags(['expectedPassed: true']),
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
      cliScripts: ['check-foo.ts'],
      negative: fakeNegativeCoverage([{ name: 'check-foo', fixture: '`samples/foo/a.json`', mechanism: 'fixture' }]),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-not-failing');
    expect(r.stdout).toContain('不是期望失败用例');
  });

  it('RED：fixture 被两个用例条目覆盖 → exit 1 negative-coverage-ambiguous-coverage（派生锚须唯一所指）', async () => {
    await setupRepo({
      refs: [],
      selfTestContent: fakeSelfTestWithFlags(['expectedPassed: false', 'expectedPassed: false']),
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
      cliScripts: ['check-foo.ts'],
      negative: fakeNegativeCoverage([{ name: 'check-foo', fixture: '`samples/foo/a.json`', mechanism: 'fixture' }]),
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-ambiguous-coverage');
    expect(r.stdout).toContain('被 2 个 self-test 用例条目覆盖');
  });

  it('RED：invocation 行的落点只写文字（不在盘）→ exit 1 negative-coverage-dangling（文字不是证据）', async () => {
    await setupSingleGateRepo([{ name: 'check-foo', fixture: '由某个任务提供', mechanism: 'invocation' }]);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-dangling');
    expect(r.stdout).toContain('由某个任务提供');
  });

  it('正例：derivedAnchors 与登记行序对齐（fixture 行派生 self-test 覆盖位置，invocation 行用自身落点）', async () => {
    await putTargetFile(EVIDENCE_FILE);
    await setupRepo({
      refs: [{ subdir: 'foo', file: 'a.json' }],
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
      cliScripts: ['check-foo.ts', 'check-bar.ts'],
      negative: fakeNegativeCoverage([
        { name: 'check-foo', fixture: '`samples/foo/a.json`', mechanism: 'fixture' },
        { name: 'check-bar', fixture: `\`${EVIDENCE_FILE}\``, mechanism: 'invocation' },
      ]),
    });
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(`[派生锚]`);
    expect(r.stdout).toContain(`check-foo → self-test.ts#file: 'a.json'`);
    expect(r.stdout).toContain(`check-bar → ${EVIDENCE_FILE}`);
    // 机器可读输出：数组顺序 = 登记行序（先 fixture 行，后 invocation 行）
    expect(r.stdout).toContain(`"derivedAnchors":["self-test.ts#file: 'a.json'","${EVIDENCE_FILE}"]`);
  });

  it('RED：门禁不实现 exit-2 契约 → exit 1 negative-coverage-probe-failed（探针是真执行，非纸面登记）', async () => {
    await putTargetFile(EVIDENCE_FILE);
    await setupSingleGateRepo([{ name: 'check-foo', fixture: `\`${EVIDENCE_FILE}\``, mechanism: 'invocation' }], {
      cliExitTwo: false,
    });
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('negative-coverage-probe-failed');
    expect(r.stdout).toContain('exit code 应为 2');
  });

  it('正例：登记齐全、fixture 期望失败、探针真实 exit 2 → exit 0（并报告探针数与派生锚）', async () => {
    await putTargetFile(EVIDENCE_FILE);
    await setupRepo({
      refs: [{ subdir: 'foo', file: 'a.json' }],
      onDisk: ['foo/a.json'],
      readme: fakeReadme(['foo']),
      cliScripts: ['check-foo.ts', 'check-bar.ts'],
      negative: fakeNegativeCoverage([
        { name: 'check-foo', fixture: '`samples/foo/a.json`', mechanism: 'fixture' },
        { name: 'check-bar', fixture: `\`${EVIDENCE_FILE}\``, mechanism: 'invocation' },
      ]),
    });
    const r = run();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('"negativeCoverageMissing":0');
    expect(r.stdout).toContain('"negativeCoverageDangling":0');
    expect(r.stdout).toContain('"negativeCoverageProbes":2');
    expect(r.stdout).toContain('"negativeCoverageProbeFailures":0');
    expect(r.stdout).toContain(`"derivedAnchors":["self-test.ts#file: 'a.json'","${EVIDENCE_FILE}"]`);
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
