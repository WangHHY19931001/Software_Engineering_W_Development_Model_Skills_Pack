import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateBySchema } from '../logic/schema-loader.js';
import { writeGateLog } from '../lib/gate-log-writer.js';

const validPayload = {
  script: 'check-example.ts',
  exitCode: 0,
  passed: true,
  reasons: [],
  reportSummary: {},
};

describe('writeGateLog（lib/gate-log-writer.ts）', () => {
  it('验证合法 payload，以 timestamp-UUID 原子追加，并保留同一时刻的独立内容', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gatelog-'));
    try {
      const now = () => new Date('2026-08-19T12:34:56.789Z');
      const first = await writeGateLog({ ...validPayload, reasons: ['first'] }, dir, {
        now,
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
      });
      const second = await writeGateLog({ ...validPayload, reasons: ['second'] }, dir, {
        now,
        randomUUID: () => '22222222-2222-4222-8222-222222222222',
      });

      expect(first).toEqual({
        ok: true,
        path: path.join(
          dir,
          '.w-model',
          'gate-logs',
          '2026-08-19T12-34-56-789Z-11111111-1111-4111-8111-111111111111-check-example.ts.json',
        ),
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) throw new Error('expected successful writes');
      expect(first.path).not.toBe(second.path);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(validateBySchema('gate-log', JSON.parse(await fs.readFile(first.path, 'utf-8'))).valid).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(JSON.parse(await fs.readFile(first.path, 'utf-8'))).toMatchObject({ reasons: ['first'] });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(JSON.parse(await fs.readFile(second.path, 'utf-8'))).toMatchObject({ reasons: ['second'] });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      expect(await fs.readdir(path.join(dir, '.w-model', 'gate-logs'))).toHaveLength(2);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('拒绝无效载荷，并在不可写、临时写入或 rename 失败时返回错误且清理临时文件', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gatelog-'));
    try {
      for (const payload of [
        { ...validPayload, script: '' },
        { ...validPayload, exitCode: 3 },
        { ...validPayload, unexpected: true },
      ] as unknown[]) {
        const result = await writeGateLog(payload, dir);
        expect(result.ok).toBe(false);
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      expect(await fs.stat(path.join(dir, '.w-model', 'gate-logs')).catch(() => null)).toBeNull();

      const blocking = path.join(dir, 'blocked');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      await fs.writeFile(blocking, 'x');
      await expect(writeGateLog(validPayload, blocking)).resolves.toMatchObject({ ok: false, error: expect.any(String) });

      for (const operation of ['write', 'rename'] as const) {
        const realFs = fs;
        const result = await writeGateLog(validPayload, dir, {
          fs: {
            ...realFs,
            writeFile:
              operation === 'write'
                ? async (file, data, options) => {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer-generated temporary test path
                    await realFs.writeFile(file, data, options);
                    throw new Error('injected write failure');
                  }
                : realFs.writeFile,
            rename:
              operation === 'rename'
                ? async () => {
                    throw new Error('injected rename failure');
                  }
                : realFs.rename,
          },
        });

        expect(result).toMatchObject({ ok: false, error: expect.stringContaining(`injected ${operation} failure`) });
        const logDir = path.join(dir, '.w-model', 'gate-logs');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
        expect((await fs.readdir(logDir)).filter((file) => file.startsWith('.tmp-'))).toEqual([]);
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
