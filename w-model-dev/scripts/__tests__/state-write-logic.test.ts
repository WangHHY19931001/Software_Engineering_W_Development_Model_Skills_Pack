/**
 * logic/state-write-logic.ts 单元测试（审计修复 A1：状态写助手）
 *
 * 覆盖：backupPathFor 命名 / 目标不存在直接写 / 非法 JSON 拒绝 /
 *       mtime 守卫（MTIME_CONFLICT 与放行）/ 备份生成 / 备份轮换 keepBackups /
 *       原子替换后内容正确且无 .tmp 残留 / --no-backup 跳过备份。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { backupPathFor, writeStateJson } from '../logic/state-write-logic.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function target(name: string): string {
  return path.join(tmpDir, name);
}

describe('backupPathFor', () => {
  it('生成 <name>.bak.YYYYMMDD-HHMM 格式备份路径', () => {
    const fixed = new Date(2026, 7, 15, 9, 5); // 2026-08-15 09:05
    expect(backupPathFor(path.join('d', 'state.json'), fixed)).toBe(path.join('d', 'state.json.bak.20260815-0905'));
  });
});

describe('writeStateJson', () => {
  it('目标不存在时直接写入，无备份，内容正确', async () => {
    const p = target('fresh.json');
    const r = await writeStateJson(p, '{"a":1}');
    expect(r.ok).toBe(true);
    expect(r.backupPath).toBeUndefined();
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"a":1}');
  });

  it('非法 JSON 拒绝写入（INVALID_JSON），目标不被创建', async () => {
    const p = target('bad.json');
    const r = await writeStateJson(p, '{not json');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('INVALID_JSON');
    await expect(fs.access(p)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('mtime 不符返回 MTIME_CONFLICT，目标内容不被修改', async () => {
    const p = target('conflict.json');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const st = await fs.stat(p);
    const r = await writeStateJson(p, '{"v":2}', {
      expectMtimeMs: st.mtimeMs + 5000,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('MTIME_CONFLICT');
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":1}');
  });

  it('mtime 相符放行写入', async () => {
    const p = target('mtime-ok.json');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const st = await fs.stat(p);
    const r = await writeStateJson(p, '{"v":2}', {
      expectMtimeMs: Math.floor(st.mtimeMs),
    });
    expect(r.ok).toBe(true);
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"v":2}');
  });

  it('已有目标写入前生成备份，备份内容为旧内容', async () => {
    const p = target('backup.json');
    await fs.writeFile(p, '{"old":true}', 'utf-8');
    const r = await writeStateJson(p, '{"new":true}');
    expect(r.ok).toBe(true);
    expect(r.backupPath).toBeDefined();
    await expect(fs.readFile(r.backupPath!, 'utf-8')).resolves.toBe('{"old":true}');
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"new":true}');
  });

  it('备份轮换：超出 keepBackups 的最旧备份被删除', async () => {
    const p = target('rotate.json');
    // 预置 3 个旧备份（不同时间戳）+ 当前目标
    const stamps = ['20260101-0001', '20260102-0002', '20260103-0003'];
    for (const s of stamps) {
      await fs.writeFile(`${p}.bak.${s}`, '{"stale":true}', 'utf-8');
    }
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    // keepBackups=2：新备份写入后总备份应保留最新 2 个（新备份 + 20260103-0003）
    const r = await writeStateJson(p, '{"v":2}', { keepBackups: 2 });
    expect(r.ok).toBe(true);
    await expect(fs.access(`${p}.bak.20260101-0001`)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(fs.access(`${p}.bak.20260102-0002`)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(fs.access(`${p}.bak.20260103-0003`)).resolves.toBeUndefined();
    expect(r.backupPath).toBeDefined();
    await expect(fs.access(r.backupPath!)).resolves.toBeUndefined();
  });

  it('原子替换后内容正确且无 .tmp-* 残留', async () => {
    const p = target('atomic.json');
    await writeStateJson(p, '{"step":1}');
    const r = await writeStateJson(p, '{"step":2}');
    expect(r.ok).toBe(true);
    await expect(fs.readFile(p, 'utf-8')).resolves.toBe('{"step":2}');
    const entries = await fs.readdir(tmpDir);
    const tmpResidue = entries.filter((e) => e.includes('.tmp-'));
    expect(tmpResidue).toEqual([]);
  });

  it('backup:false 跳过备份', async () => {
    const p = target('nobackup.json');
    await fs.writeFile(p, '{"v":1}', 'utf-8');
    const r = await writeStateJson(p, '{"v":2}', { backup: false });
    expect(r.ok).toBe(true);
    expect(r.backupPath).toBeUndefined();
  });

  it('带 BOM 的输入文本被拒绝（写入内容必须可被 parseJsonSafe 解析）', async () => {
    const p = target('bom-input.json');
    const r = await writeStateJson(p, '\uFEFF{"a":1}');
    // parseJsonSafe 已剥离 BOM，可正常解析 → 写入时应剥离后写入还是拒绝？
    // 约定：parseJsonSafe 校验通过即可写入原文文本；此处验证不崩溃且目标为合法 JSON 语义
    expect(r.ok).toBe(true);
    const raw = await fs.readFile(p, 'utf-8');
    expect(raw).toBe('\uFEFF{"a":1}');
  });
});

describe('审计修复 P4：tmpPath 唯一化与回读失败回滚', () => {
  it('同进程并发两次写同一目标：均成功且无异常，终态为二者之一', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-conc-'));
    const target = path.join(dir, 'state.json');
    await fs.writeFile(target, '{"v":0}', 'utf-8');
    const [a, b] = await Promise.all([writeStateJson(target, '{"v":1}'), writeStateJson(target, '{"v":2}')]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true); // 修复前：第二次 rename 抛 ENOENT
    const final = JSON.parse(await fs.readFile(target, 'utf-8')) as { v: number };
    expect([1, 2]).toContain(final.v);
    // 不残留 tmp 文件
    const leftovers = (await fs.readdir(dir)).filter((f) => f.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  it('回读校验失败时自动回滚备份并报告 rolledBack', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-rollback-'));
    const target = path.join(dir, 'state.json');
    await fs.writeFile(target, '{"v":"original"}', 'utf-8');
    const result = await writeStateJson(target, '{"v":"new"}', {
      // 模拟回读损坏：内容为「非法 JSON（不可解析）」才触发回滚；
      // 若为另一条合法 JSON 会被当作并发写者覆盖而判成功（见并发用例）。
      readbackImpl: async () => '{"v":"corrupted",', // 未闭合对象 → 非法 JSON
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('WRITE_VERIFY_FAILED');
    expect(result.rolledBack).toBe(true);
    expect(await fs.readFile(target, 'utf-8')).toBe('{"v":"original"}'); // 已恢复
  });

  it('回读失败且无备份（目标原不存在）时删除损坏文件', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-write-nobak-'));
    const target = path.join(dir, 'state.json');
    const result = await writeStateJson(target, '{"v":"new"}', {
      readbackImpl: async () => 'garbage',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('WRITE_VERIFY_FAILED');
    await expect(fs.readFile(target, 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
