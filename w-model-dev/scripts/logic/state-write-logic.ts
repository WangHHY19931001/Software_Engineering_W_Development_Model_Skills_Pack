/**
 * 状态文件安全写逻辑（logic/state-write-logic.ts）
 *
 * 审计修复 A1：把「.bak 备份 + mtime 乐观锁 + 原子替换 + 回读校验」承诺固化为可复用助手，
 * 消除 SKILL/参考文档承诺与 Agent 手写实现之间的漂移（此前承诺未实现）。
 *
 * 流程：parse 校验（经 parseJsonSafe）→ mtime 守卫（不符→MTIME_CONFLICT）→
 *       备份现有文件（复制 + 按 keepBackups 轮换）→ 写 <abs>.tmp-<pid> → fs.rename 原子替换 →
 *       回读校验（不符→WRITE_VERIFY_FAILED）。
 *
 * 退出语义由 CLI 层（cli/wm-write.ts）映射：ok=true→exit 0；reason 非空→exit 1；输入错误→exit 2。
 * 设计：docs/superpowers/specs/2026-08-15-skill-opt-audit-21fixes-design.md §A1
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { parseJsonSafe } from '../lib/safe-json.js';

export interface StateWriteOptions {
  /** 写前备份现有目标（默认 true） */
  backup?: boolean;
  /** 保留的备份份数，超出按时间戳从旧到新删除（默认 5） */
  keepBackups?: number;
  /** 乐观锁：期望的目标当前 mtimeMs；null/undefined 表示不校验（默认 null） */
  expectMtimeMs?: number | null;
}

export interface StateWriteResult {
  ok: boolean;
  /** 目标绝对路径（失败时也返回，便于错误消息定位） */
  writtenPath: string;
  /** 实际生成的备份路径（仅 ok=true 且发生备份时存在） */
  backupPath?: string;
  /** 失败原因：INVALID_JSON / MTIME_CONFLICT / TARGET_MISSING_FOR_MTIME / WRITE_VERIFY_FAILED */
  reason?: string;
}

/** 备份命名：<absPath>.bak.YYYYMMDD-HHMM（同分钟重复写覆盖同一备份，视为同一版本链） */
export function backupPathFor(absPath: string, now?: Date): string {
  const d = now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${absPath}.bak.${stamp}`;
}

/** 枚举目标同目录下同基名的备份文件，按文件名（=时间戳）升序；超出 keep 份的从最旧删除 */
async function rotateBackups(absPath: string, keep: number): Promise<void> {
  const dir = path.dirname(absPath);
  const base = path.basename(absPath);
  const prefix = `${base}.bak.`;
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return; // 目录不可读时跳过轮换（不阻塞主流程）
  }
  const backups = entries.filter((e) => e.startsWith(prefix)).sort();
  const excess = backups.length - keep;
  for (let i = 0; i < excess; i++) {
    try {
      await fs.unlink(path.join(dir, backups[i]!));
    } catch {
      // 单个旧备份删除失败不阻塞（下次写入继续轮换）
    }
  }
}

/**
 * 安全覆盖写一个状态 JSON 文件。
 *
 * 步骤与失败原因：
 *   1. parseJsonSafe(jsonText) 校验失败 → { ok:false, reason:'INVALID_JSON' }（目标不动）
 *   2. expectMtimeMs 给定且与目标当前 mtime 不符 → { ok:false, reason:'MTIME_CONFLICT' }（目标不动）
 *      （expectMtimeMs 给定但目标不存在 → reason:'TARGET_MISSING_FOR_MTIME'）
 *   3. backup!==false 且目标存在 → copyFile 生成 <abs>.bak.<stamp>，按 keepBackups 轮换
 *   4. 写 <abs>.tmp-<pid> → fs.rename 原子替换（崩溃时目标要么旧要么新，不会半截）
 *   5. 回读与 jsonText 不一致 → { ok:false, reason:'WRITE_VERIFY_FAILED' }
 */
export async function writeStateJson(
  absPath: string,
  jsonText: string,
  opts: StateWriteOptions = {},
): Promise<StateWriteResult> {
  // 1. 内容必须是合法 JSON（经 safe-json，含原型污染防护语义）
  try {
    parseJsonSafe(jsonText);
  } catch {
    return { ok: false, writtenPath: absPath, reason: 'INVALID_JSON' };
  }

  // 2. mtime 乐观锁守卫
  if (opts.expectMtimeMs != null) {
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(absPath);
    } catch {
      return { ok: false, writtenPath: absPath, reason: 'TARGET_MISSING_FOR_MTIME' };
    }
    if (Math.floor(st.mtimeMs) !== Math.floor(opts.expectMtimeMs)) {
      return { ok: false, writtenPath: absPath, reason: 'MTIME_CONFLICT' };
    }
  }

  // 3. 备份现有目标（不存在则跳过）
  let backupPath: string | undefined;
  if (opts.backup !== false) {
    try {
      const st = await fs.stat(absPath);
      if (st.isFile()) {
        backupPath = backupPathFor(absPath);
        await fs.copyFile(absPath, backupPath);
        await rotateBackups(absPath, opts.keepBackups ?? 5);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // 目标不存在，无需备份
      } else {
        throw err; // 权限/磁盘等真实 IO 错误上抛（CLI 层归为 UNEXPECTED exit 2）
      }
    }
  }

  // 4. 原子替换：tmp-<pid> 唯一命名避免并发写互踩，rename 在同目录下原子
  const tmpPath = `${absPath}.tmp-${process.pid}`;
  await fs.writeFile(tmpPath, jsonText, 'utf-8');
  await fs.rename(tmpPath, absPath);

  // 5. 回读校验
  const readBack = await fs.readFile(absPath, 'utf-8');
  if (readBack !== jsonText) {
    return { ok: false, writtenPath: absPath, reason: 'WRITE_VERIFY_FAILED' };
  }
  return { ok: true, writtenPath: absPath, backupPath };
}
