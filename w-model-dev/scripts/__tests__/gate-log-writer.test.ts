import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateBySchema } from '../logic/schema-loader.js';
import { writeGateLog } from '../lib/gate-log-writer.js';

const validPayload = {
  script: 'check-bdd-model.ts',
  exitCode: 0,
  passed: true,
  reasons: [],
  reportSummary: {
    phase: 1,
    checkedAt: '2026-08-19T00:00:00.000Z',
    summary: 'BDD model check passed (phase 1)',
    violationsCount: 0,
  },
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

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) throw new Error('expected successful writes');
      expect(first.path).toContain(
        '2026-08-19T12-34-56-789Z-11111111-1111-4111-8111-111111111111-check-bdd-model.ts.json',
      );
      expect(first.path).not.toBe(second.path);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(validateBySchema('gate-log', JSON.parse(await fs.readFile(first.path, 'utf-8'))).valid).toBe(true);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(JSON.parse(await fs.readFile(first.path, 'utf-8'))).toMatchObject({ reasons: ['first'] });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(JSON.parse(await fs.readFile(second.path, 'utf-8'))).toMatchObject({ reasons: ['second'] });

      const collisionIds = ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'];
      const collided = await writeGateLog({ ...validPayload, reasons: ['collision'] }, dir, {
        now,
        randomUUID: () => collisionIds.shift()!,
      });
      expect(collided.ok).toBe(true);
      if (!collided.ok) throw new Error('expected no-clobber retry');
      expect(collided.path).not.toBe(first.path);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(JSON.parse(await fs.readFile(first.path, 'utf-8'))).toMatchObject({ reasons: ['first'] });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- writer returns this mkdtemp-controlled path
      expect(JSON.parse(await fs.readFile(collided.path, 'utf-8'))).toMatchObject({ reasons: ['collision'] });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      expect(await fs.readdir(path.join(dir, '.w-model', 'gate-logs'))).toHaveLength(3);
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
      await expect(writeGateLog(validPayload, blocking)).resolves.toMatchObject({
        ok: false,
        error: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });

      for (const operation of ['write', 'link'] as const) {
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
            link:
              operation === 'link'
                ? async () => {
                    throw new Error('injected link failure');
                  }
                : realFs.link,
          },
        });

        expect(result).toEqual({
          ok: false,
          error: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
        });
        const logDir = path.join(dir, '.w-model', 'gate-logs');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
        expect((await fs.readdir(logDir)).filter((file) => file.startsWith('.tmp-'))).toEqual([]);
      }

      const cleanupFailure = await writeGateLog(validPayload, dir, {
        fs: {
          ...fs,
          writeFile: async () => {
            throw new Error('write failed at C:\\sensitive\\writer.tmp');
          },
          rm: async () => {
            throw new Error('cleanup failed at C:\\sensitive\\writer.tmp');
          },
        },
      });
      expect(cleanupFailure).toEqual({
        ok: false,
        error: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log', cleanupFailed: true },
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
