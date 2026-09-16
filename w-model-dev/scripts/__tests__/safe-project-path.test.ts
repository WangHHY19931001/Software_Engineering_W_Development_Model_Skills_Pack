/* eslint-disable security/detect-non-literal-fs-filename -- 全部路径由 mkdtemp 测试夹具生成 */
/**
 * M07 原始测试产物路径的安全边界。
 *
 * 这些断言目前经已有的 resolveTestEvidenceOutputPath 入口登记；待安全路径 helper
 * 落地后可迁移到它，但本文件不 import 尚不存在的生产符号。
 */

import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveTestEvidenceOutputPath } from '../logic/gate-logic.js';

const dirs: string[] = [];

function makeProject(): string {
  const project = mkdtempSync(join(tmpdir(), 'wmodel-safe-project-path-'));
  dirs.push(project);
  return project;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('M07 safe project evidence paths', () => {
  it.each(['C:\\outside.txt', '\\\\server\\share\\x', '/tmp/x', '../outside', 'a\\b', 'nul\u0000path'])(
    '拒绝非项目相对安全路径 %j',
    (candidate) => {
      const result = resolveTestEvidenceOutputPath(makeProject(), candidate);
      expect(result.ok).toBe(false);
    },
  );

  it('只接受项目内普通文件并返回规范绝对路径', () => {
    const project = makeProject();
    mkdirSync(join(project, 'evidence'));
    writeFileSync(join(project, 'evidence', 'result.json'), '{}\n', 'utf8');

    const result = resolveTestEvidenceOutputPath(project, 'evidence/result.json');

    expect(result).toEqual({ ok: true, absPath: resolve(project, 'evidence', 'result.json') });
  });

  it('拒绝项目内目录和指向项目外的 symlink，不能以词法根内替代真实路径检查', () => {
    const project = makeProject();
    const outside = makeProject();
    mkdirSync(join(project, 'directory'));
    writeFileSync(join(outside, 'outside.txt'), 'outside\n', 'utf8');
    symlinkSync(join(outside, 'outside.txt'), join(project, 'outside-link.txt'), 'file');

    expect(resolveTestEvidenceOutputPath(project, 'directory').ok).toBe(false);
    expect(resolveTestEvidenceOutputPath(project, 'outside-link.txt').ok).toBe(false);
  });
});
