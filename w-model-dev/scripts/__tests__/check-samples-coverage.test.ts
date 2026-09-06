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
}): Promise<void> {
  await fs.mkdir(path.join(tmpDir, 'w-model-dev/scripts/cli'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'w-model-dev/scripts/cli/self-test.ts'), fakeSelfTest(opts.refs), 'utf-8');
  for (const rel of opts.onDisk) {
    const p = path.join(tmpDir, 'w-model-dev/scripts/samples', rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, '{}', 'utf-8');
  }
  await fs.writeFile(path.join(tmpDir, 'w-model-dev/scripts/samples/README.md'), opts.readme, 'utf-8');
}

function run(): { code: number | null; stdout: string; stderr: string } {
  const r = runSync(process.execPath, [tsxCli, SCRIPT, tmpDir]);
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
    const r = run();
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('reference-dangling');
    expect(r.stdout).toContain('opsx-artifacts/ghost-phase5');
  });
});
