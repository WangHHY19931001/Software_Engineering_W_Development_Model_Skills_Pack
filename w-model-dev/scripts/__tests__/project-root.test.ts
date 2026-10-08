/* eslint-disable security/detect-non-literal-fs-filename -- 全部路径由 mkdtemp 测试夹具生成 */
/**
 * lib/project-root.ts（D5 统一项目根解析）公开契约：
 * 默认最严判据（graph）/ looseWModel（iceberg）/ requireProjectFile+maxDepth（signature-chain）
 * 三态 + 上溯层数上限 + 选项互斥 guard。等价映射（新旧逐位一致）由批次 9 差分探针实证，
 * 本文件锁行为面。层数语义：maxDepth 次迭代覆盖 startDir 至其 (maxDepth-1) 层父级。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveProjectRoot } from '../lib/project-root.js';

const dirs: string[] = [];

function makeTree(prefix = 'wmodel-project-root-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

/** 创建相对目录（recursive）并返回绝对路径 */
function mkdir(dir: string, rel: string): string {
  const abs = join(dir, rel);
  mkdirSync(abs, { recursive: true });
  return abs;
}

function writeFile(abs: string, content = ''): void {
  writeFileSync(abs, content, 'utf-8');
}

/** startDir = root 之下 N 层（root/s0/.../sN-1），用于把「标记在 root」置于不同父级距离 */
function nestedStart(root: string, depth: number): string {
  return mkdir(root, Array.from({ length: depth }, (_, i) => `s${i}`).join('/'));
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('resolveProjectRoot 默认判据（graph 最严：.git 或 .w-model 含≥1常规文件）', () => {
  it('.git 命中', () => {
    const root = makeTree();
    mkdir(root, '.git');
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it('.git 为文件（非目录）也命中（existsSync 类型无关）', () => {
    const root = makeTree();
    writeFile(join(root, '.git'));
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it('.w-model 含常规文件（project.json）命中', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model'), 'project.json'));
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it('.w-model 只含子目录（gate-logs 残留）不命中 → 返回 null', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model/gate-logs'), 'x.log'));
    expect(resolveProjectRoot(root)).toBeNull();
  });

  it('残留 .w-model 近层不命中，向上穿透到真实项目（.w-model 含文件）', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, 'a/.w-model/gate-logs'), 'x.log')); // 残留（只目录）
    writeFile(join(mkdir(root, '.w-model'), 'project.json')); // 真实状态（树根）
    const start = mkdir(root, 'a/s0'); // 位于残留之下
    expect(resolveProjectRoot(start)).toBe(root);
  });

  it('嵌套外部 git 仓内真实项目：就近命中项目层而非外层 .git', () => {
    const root = makeTree();
    mkdir(root, '.git');
    writeFile(join(mkdir(root, 'a/b/.w-model'), 'project.json'));
    const start = mkdir(root, 'a/b/s0');
    expect(resolveProjectRoot(start)).toBe(join(root, 'a', 'b'));
  });

  it('8 层上限：标记（.git@root）在第 7 父级命中、第 8 父级不命中 → null', () => {
    const root = makeTree();
    mkdir(root, '.git');
    expect(resolveProjectRoot(nestedStart(root, 7))).toBe(root); // root = 第 7 父级（i=7，第 8 迭代）
    expect(resolveProjectRoot(nestedStart(root, 8))).toBeNull(); // root = 第 8 父级，超出 8 迭代
  });
});

describe('resolveProjectRoot looseWModel（iceberg 判据：裸 .w-model 或 .git）', () => {
  it('残留 .w-model（只含子目录）在宽松判据下命中；默认最严不命中（判据差异保持）', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model/gate-logs'), 'x.log'));
    expect(resolveProjectRoot(root, { looseWModel: true })).toBe(root);
    expect(resolveProjectRoot(root)).toBeNull();
  });

  it('对照：残留近层宽松判据停下，最严判据穿透到真实项目（行为差异按各原判据保持）', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, 'a/.w-model/gate-logs'), 'x.log')); // 残留
    writeFile(join(mkdir(root, '.w-model'), 'project.json')); // 真实状态
    const start = mkdir(root, 'a/s0');
    expect(resolveProjectRoot(start, { looseWModel: true })).toBe(join(root, 'a'));
    expect(resolveProjectRoot(start)).toBe(root);
  });

  it('.git 命中（OR 语义）', () => {
    const root = makeTree();
    mkdir(root, '.git');
    expect(resolveProjectRoot(root, { looseWModel: true })).toBe(root);
  });
});

describe('resolveProjectRoot requireProjectFile（signature-chain 判据：.w-model/project.json，不查 .git）', () => {
  it('.w-model/project.json 存在即命中；仅 .git 不命中', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model'), 'project.json'));
    expect(resolveProjectRoot(root, { requireProjectFile: true })).toBe(root);
    const gitOnly = makeTree();
    mkdir(gitOnly, '.git');
    expect(resolveProjectRoot(gitOnly, { requireProjectFile: true })).toBeNull();
  });

  it('project.json 为目录也命中（存在性判据类型无关，与原 accessSync F_OK 等价）', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model/project.json'), 'x'));
    expect(resolveProjectRoot(root, { requireProjectFile: true })).toBe(root);
  });

  it('仅含 gate-logs 残留的 .w-model 不命中', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model/gate-logs'), 'x.log'));
    expect(resolveProjectRoot(root, { requireProjectFile: true })).toBeNull();
  });

  it('maxDepth=5：标记（project.json@root）在第 4 父级命中、第 5 父级不命中 → null', () => {
    const root = makeTree();
    writeFile(join(mkdir(root, '.w-model'), 'project.json'));
    expect(resolveProjectRoot(nestedStart(root, 4), { requireProjectFile: true, maxDepth: 5 })).toBe(root);
    expect(resolveProjectRoot(nestedStart(root, 5), { requireProjectFile: true, maxDepth: 5 })).toBeNull();
  });

  it('起始目录自身命中（链文件位于 <root>/.w-model/ 时 start=<root>/.w-model，向上即项目根）', () => {
    const root = makeTree();
    const chainDir = mkdir(root, '.w-model'); // 与真实形态一致：链文件在项目 .w-model/ 下
    writeFile(join(root, '.w-model', 'project.json'));
    expect(resolveProjectRoot(chainDir, { requireProjectFile: true, maxDepth: 5 })).toBe(root);
  });
});

describe('resolveProjectRoot 选项互斥与默认', () => {
  it('requireProjectFile 与 looseWModel 同置抛 TypeError（防静默歧义）', () => {
    const root = makeTree();
    expect(() => resolveProjectRoot(root, { requireProjectFile: true, looseWModel: true })).toThrow(TypeError);
  });

  it('显式 maxDepth=8 与默认行为一致', () => {
    const root = makeTree();
    mkdir(root, '.git');
    expect(resolveProjectRoot(nestedStart(root, 7), { maxDepth: 8 })).toBe(root);
  });

  it('未命中返回 null（不抛、不回退）', () => {
    const root = makeTree();
    expect(resolveProjectRoot(root)).toBeNull();
  });
});
