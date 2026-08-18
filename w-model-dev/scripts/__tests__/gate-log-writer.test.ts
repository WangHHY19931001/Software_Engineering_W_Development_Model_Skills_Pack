import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeGateLog } from '../lib/gate-log-writer.js';

describe('writeGateLog（lib/gate-log-writer.ts）', () => {
  it('写入 gate-logs/<timestamp>-<script>.json 且内容为 pretty JSON', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gatelog-'));
    await writeGateLog('demo-check', { exitCode: 0, passed: true }, dir);
    const files = await fs.readdir(path.join(dir, '.w-model', 'gate-logs'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-demo-check\.json$/);
    const content = JSON.parse(
      await fs.readFile(path.join(dir, '.w-model', 'gate-logs', files[0]!), 'utf-8'),
    ) as { exitCode: number; passed: boolean };
    expect(content).toEqual({ exitCode: 0, passed: true });
  });
  it('目录不可写时不抛异常', async () => {
    await expect(writeGateLog('x', {}, '/proc/definitely-not-writable')).resolves.toBeUndefined();
  });
});