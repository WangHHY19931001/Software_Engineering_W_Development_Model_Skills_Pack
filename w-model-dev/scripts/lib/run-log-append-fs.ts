/**
 * run-log 追加器的 fs 适配器（lib/run-log-append-fs.ts，D-5①/N-5 的 IO 段）
 *
 * 职责（读 / 组装 / 摘要三段 IO 适配，不做任何判定——判定在纯逻辑
 * `logic/run-log-append-logic.ts`，原子写在 `cli/wm-append-runlog.ts` 经
 * `logic/state-write-logic.ts` 的锁 + 备份 + tmp/rename + 回读机制执行）：
 *   1. `readRunLogFile`：读既有 run-log 文本并逐行解析（缺失视为空日志 = 首条记录自举）；
 *   2. `composeAppendedText`：**原文本逐字节保留** + 新行（LF 结尾）——历史行绝不经 JSON 再序列化，
 *      消除「重写历史行导致字节漂移」这一类回溯改写；
 *   3. `countRecordLines` / `digestOf`：写入行数与写入内容 SHA-256（`sha256:<64 位小写 hex>`，
 *      口径同 `code-health-evidence-store.ts` 的 scopeHash）。
 *
 * 为什么原子写不落在这里：`dependency-boundaries.test.ts` 禁止 `lib → logic` 的**运行时**依赖
 * （仅允许 `import type`），而原子写实现 `logic/state-write-logic.ts` 必须 value-import。
 * 因此写盘调用点与 `wm-write.ts` 一致放在 CLI 层，本模块只提供 IO 文本适配。
 *
 * @module
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';

import type { RunLogRecord } from '../logic/run-log-append-logic.js';

import { parseJsonSafe } from './safe-json.js';

/** 既有 run-log 文本与逐行解析结果 */
export interface RunLogFileContent {
  /** 文件是否存在：false = 尚无 run-log（等价空日志，追加即自举首条记录） */
  exists: boolean;
  /** 原文件文本（历史行按此文本逐字节复用） */
  text: string;
  /** 既有记录（按文件顺序，已忽略空白行） */
  entries: RunLogRecord[];
  /** 既有的非空原始行（与 `entries` 同序，逐字节保留原文） */
  rawLines: string[];
}

/** 读取结果：解析失败以 `ok:false` 返回（含行号），由 CLI 转 exit 2，不抛异常 */
export type RunLogFileReadResult =
  { ok: true; content: RunLogFileContent } | { ok: false; line: number; message: string };

/**
 * 读取 run-log 文件并逐行解析。
 *
 * - 文件不存在 → `{exists:false, text:'', entries:[], rawLines:[]}`（自举语义，不报错）；
 * - 其他读取错误（权限 / 目录等）向上抛，由 CLI `runMain` 统一转 UNEXPECTED；
 * - 某行不是合法 JSON、或不是 JSON 对象 → `ok:false` + 行号（调用方转 FILE_PARSE / STRUCTURE_INVALID）。
 */
export async function readRunLogFile(absPath: string): Promise<RunLogFileReadResult> {
  let text: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 目标路径来自 CLI 位置参数并用 path.resolve 归一（run-log 追加工具的目标即调用方指定文件）
    text = await fs.readFile(absPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: true, content: { exists: false, text: '', entries: [], rawLines: [] } };
    }
    throw error;
  }

  const entries: RunLogRecord[] = [];
  const rawLines: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    if (rawLine.trim() === '') continue;
    let parsed: unknown;
    try {
      parsed = parseJsonSafe(rawLine);
    } catch {
      return { ok: false, line: index + 1, message: '既有 run-log 行不是合法 JSON' };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, line: index + 1, message: '既有 run-log 行不是 JSON 对象' };
    }
    entries.push(parsed as RunLogRecord);
    rawLines.push(rawLine);
  }
  return { ok: true, content: { exists: true, text, entries, rawLines } };
}

/**
 * 组装追加后的完整文本：`existingText` 逐字节保留，其后以 LF 追加新记录行。
 * 既有文本末尾无换行符时先补一个 LF（只新增分隔符，不改动任何既有字节）。
 */
export function composeAppendedText(existingText: string, appended: readonly unknown[]): string {
  const appendedText = appended.map((record) => JSON.stringify(record)).join('\n');
  if (appendedText === '') return existingText;
  const separator = existingText === '' || existingText.endsWith('\n') ? '' : '\n';
  return `${existingText}${separator}${appendedText}\n`;
}

/** 文本内非空行数（追加后的记录行数，用于 stdout 摘要的 `lines`） */
export function countRecordLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim() !== '').length;
}

/** 写入内容摘要：`sha256:<64 位小写 hex>`（对写入文本的 UTF-8 字节取 SHA-256） */
export function digestOf(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}
