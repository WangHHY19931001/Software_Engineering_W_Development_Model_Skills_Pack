/* eslint-disable security/detect-non-literal-fs-filename -- 全部路径由 mkdtemp 测试夹具生成 */
/** 安全项目路径 helper 的公开契约：拒绝穿越、链接和非普通文件。 */

import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveProjectRelativeRegularFile, SafeProjectPathError } from '../lib/safe-project-path.js';

const dirs: string[] = [];

function makeDir(prefix = 'wmodel-safe-project-path-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function expectRejected(project: string, candidate: string, reason: SafeProjectPathError['reason']): void {
  try {
    resolveProjectRelativeRegularFile(project, candidate);
    throw new Error(`expected ${JSON.stringify(candidate)} to be rejected`);
  } catch (error) {
    expect(error).toBeInstanceOf(SafeProjectPathError);
    expect((error as SafeProjectPathError).reason).toBe(reason);
  }
}

function junctionSupport(): string | undefined {
  const project = makeDir('wmodel-junction-probe-project-');
  const target = makeDir('wmodel-junction-probe-target-');
  try {
    symlinkSync(target, join(project, 'probe-junction'), 'junction');
    return undefined;
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as NodeJS.ErrnoException).code) : 'unknown';
    return `junction unavailable on this platform (${code})`;
  }
}

const junctionUnavailable = junctionSupport();

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('resolveProjectRelativeRegularFile', () => {
  it.each([
    ['C:\\outside.txt', 'absolute'],
    ['\\\\server\\share\\x', 'absolute'],
    ['/tmp/x', 'absolute'],
    ['../outside', 'invalid-segment'],
    ['a\\b', 'invalid-segment'],
    ['nul\u0000path', 'invalid-segment'],
  ] as const)('拒绝 %j 并保留结构化原因 %s', (candidate, reason) => {
    expectRejected(makeDir(), candidate, reason);
  });

  it('项目内普通文件返回规范绝对路径', () => {
    const project = makeDir();
    mkdirSync(join(project, 'evidence'));
    writeFileSync(join(project, 'evidence', 'result.json'), '{}\n', 'utf8');

    expect(resolveProjectRelativeRegularFile(project, 'evidence/result.json')).toBe(
      resolve(project, 'evidence', 'result.json'),
    );
  });

  it('目录以 not-file 拒绝，普通文件的项目外 symlink 以 link 拒绝', () => {
    const project = makeDir();
    const outside = makeDir();
    mkdirSync(join(project, 'directory'));
    writeFileSync(join(outside, 'outside.txt'), 'outside\n', 'utf8');
    symlinkSync(join(outside, 'outside.txt'), join(project, 'outside-link.txt'), 'file');

    expectRejected(project, 'directory', 'not-file');
    expectRejected(project, 'outside-link.txt', 'link');
  });

  it.runIf(junctionUnavailable === undefined)(
    '项目外 junction 以 link 拒绝（当前平台不支持时跳过：junction unavailable）',
    () => {
      const project = makeDir();
      const outside = makeDir();
      writeFileSync(join(outside, 'outside.txt'), 'outside\n', 'utf8');
      symlinkSync(outside, join(project, 'outside-junction'), 'junction');

      expectRejected(project, 'outside-junction/outside.txt', 'link');
    },
  );
});
