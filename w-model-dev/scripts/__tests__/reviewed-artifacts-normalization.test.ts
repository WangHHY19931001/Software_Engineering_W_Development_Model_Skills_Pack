/**
 * reviewed-artifacts-normalization.test.ts —— R19 归一化哈希口径（批次 7 任务 2，43.1.0）
 *
 * 背景：43.0.1 已用 .gitattributes 强制仓内 LF 落盘（环境侧）；本测试锁定机制侧兜底——
 * lib/reviewed-artifacts.ts 在哈希与行数统计前做 CRLF→LF 归一化，使 reviewedArtifacts
 * 登记哈希对任意 checkout 行尾配置（core.autocrlf 等）免疫。
 *
 * 判据（简报步骤 1）：
 *   - valid.json 的登记哈希不变（LF 口径），将其与 samples/verifier/README.md 的 CRLF 副本
 *     （同内容、\r\n 行尾）置于同一临时目录后经 CLI 校验仍须 exit 0——归一化前该形态会因
 *     raw 字节哈希失配报 `R19 评审对象哈希不符` exit 1。
 *   - 反向守卫：CRLF 副本叠加真实内容漂移（追加字节）仍须 exit 1——归一化只中和行尾差异，
 *     不豁免内容变化（bad-r19-artifact-hash-mismatch.json 的负样本判据不失效）。
 *
 * CLI 层用例为进程内模式：经 helpers/cli-invoker.ts 调用导出的 main(argv)（对齐
 * verifier-logic.test.ts 既有形态；真实子进程保真由 cli-subprocess-smoke.test.ts 承载）。
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { invokeCli } from './helpers/cli-invoker.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SAMPLES = resolve(TEST_DIR, '../samples/verifier');

describe('R19 归一化哈希（CRLF→LF）：登记哈希对 checkout 行尾配置免疫', () => {
  it('登记哈希不变（LF 口径）+ 登记文件 CRLF 副本 → CLI 仍 exit 0', async () => {
    const fixture = JSON.parse(await readFile(resolve(SAMPLES, 'valid.json'), 'utf-8')) as Record<string, unknown>;
    const readmeLf = await readFile(resolve(SAMPLES, 'README.md'), 'utf-8');
    const readmeCrlf = readmeLf.replace(/\n/g, '\r\n');
    expect(readmeCrlf).not.toBe(readmeLf);
    expect(readmeCrlf.includes('\r\n')).toBe(true);

    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-eol-'));
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(resolve(tempDir, 'README.md'), readmeCrlf, 'utf-8');
      const fixturePath = resolve(tempDir, 'valid.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(fixturePath, JSON.stringify(fixture), 'utf-8');
      const r = await invokeCli('../../cli/check-verifier-output.js', ['--json', fixturePath]);
      expect(r.exitCode, `CRLF 副本应放行，reasons=${r.stdout}`).toBe(0);
      const report = JSON.parse(r.stdout) as { passed: boolean; reasons: string[] };
      expect(report.passed).toBe(true);
      expect(report.reasons).toEqual([]);
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('CRLF 副本叠加真实内容漂移仍 exit 1（归一化不豁免内容变化）', async () => {
    const fixture = JSON.parse(await readFile(resolve(SAMPLES, 'valid.json'), 'utf-8')) as Record<string, unknown>;
    const readmeLf = await readFile(resolve(SAMPLES, 'README.md'), 'utf-8');
    const drifted = readmeLf.replace(/\n/g, '\r\n') + '\n追加上下文漂移\n';

    const tempDir = await mkdtemp(resolve(tmpdir(), 'verifier-eol-drift-'));
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(resolve(tempDir, 'README.md'), drifted, 'utf-8');
      const fixturePath = resolve(tempDir, 'valid.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary fixture path
      await writeFile(fixturePath, JSON.stringify(fixture), 'utf-8');
      const r = await invokeCli('../../cli/check-verifier-output.js', ['--json', fixturePath]);
      expect(r.exitCode).toBe(1);
      const report = JSON.parse(r.stdout) as { reasons: string[] };
      expect(report.reasons.some((m) => m.includes('R19') && m.includes('哈希不符'))).toBe(true);
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temporary directory
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
