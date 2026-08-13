/**
 * CLI 脚本输入读取工具（Read JSON or Exit）
 *
 * 消除 check-*.ts 中重复的「readFile + ENOENT → exit(2) + JSON.parse → exit(2)」样板。
 * 可选输入变体（readJsonlOptional）：ENOENT 降级为 []（不 exit），
 * 损坏文件仍按输入错误 exit 2（JSONL 坏行 warn+skip 不变）。
 * 仅用于 check-*.ts CLI 层；*-logic.ts 纯逻辑层不依赖本工具。
 *
 * 设计原则：
 *   - 行为与原样板一致（exit code 2 + 相同错误消息格式；exit 2 路径统一经 exitWithError 输出 stderr 人类消息 + stdout ERROR_JSON）
 *   - 不引入新依赖（仅 node:fs / node:path）
 *   - 泛型支持调用方指定返回类型
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { parseJsonSafe } from './safe-json.js';
import { exitWithError } from './cli-error.js';

/**
 * 读取并解析 JSON 文件。
 * - 文件不存在（ENOENT）→ exitWithError(FILE_NOT_FOUND) 输出 ERROR_JSON + process.exit(2)
 * - JSON 解析失败 → exitWithError(FILE_PARSE) 输出 ERROR_JSON + process.exit(2)
 * - 其他读取异常 → rethrow
 *
 * @param file 文件路径（相对或绝对）
 * @returns 解析后的 JSON 对象
 */
export async function readJsonOrExit<T = unknown>(file: string): Promise<T> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2, rule: 'P0-2', file: abs });
      process.exit(2);
    }
    throw err;
  }
  try {
    return parseJsonSafe<T>(raw);
  } catch {
    exitWithError({ category: 'FILE_PARSE', message: '文件解析失败（非合法 JSON）', exitCode: 2, file: abs });
    process.exit(2);
  }
}

/**
 * 读取 JSONL 文件（每行一个 JSON）。
 * - 文件不存在（ENOENT）→ exitWithError(FILE_NOT_FOUND) 输出 ERROR_JSON + process.exit(2)
 * - 空行跳过
 * - 单行非法 JSON → 跳过并 console.error 警告（不 exit，与原 run-log/checkpoint 行为一致）
 * - 其他读取异常 → rethrow
 *
 * @param file 文件路径（相对或绝对）
 * @param label 警告消息中的行类型描述（默认「行」），如「run-log」「checkpoint」
 * @returns 解析后的条目数组
 */
export async function readJsonlOrExit(file: string, label = '行'): Promise<unknown[]> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2, rule: 'P0-2', file: abs });
      process.exit(2);
    }
    throw err;
  }
  return parseJsonlLines(raw, label, abs);
}

/** 逐行解析 JSONL 文本（空行跳过；单行非法 JSON → warn+skip）。readJsonlOrExit / readJsonlOptional 共用 */
function parseJsonlLines(raw: string, label: string, abs: string): unknown[] {
  const lines = raw.split(/\r?\n/);
  const entries: unknown[] = [];
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      entries.push(parseJsonSafe(trimmed));
    } catch {
      console.error(`⚠ [FILE_PARSE] ${label} 第 ${i + 1} 行非合法 JSON，已跳过: ${abs}`);
    }
  }
  return entries;
}

/**
 * 可选 JSONL 输入：ENOENT→[]（不 exit）；其余同 readJsonlOrExit（坏行 warn+skip）。
 *
 * @param file 文件路径（相对或绝对）
 * @param label 警告消息中的行类型描述（默认「行」）
 * @returns 解析后的条目数组；文件不存在返回空数组
 */
export async function readJsonlOptional(file: string, label = '行'): Promise<unknown[]> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return parseJsonlLines(raw, label, abs);
}

/**
 * 读取可选 JSON 附属输入，失败时按标准三分支分类并 exitWithError（stdout ERROR_JSON）。
 * check-requirement-coverage / check-requirement-graph 等「损坏→ERROR_JSON」调用点样板。
 * 三分支语义与调用点现状精确一致：
 *   - ENOENT → exitWithError(FILE_NOT_FOUND)（exit 2，不降级跳过）
 *   - SyntaxError → exitWithError(FILE_PARSE)（exit 2）
 *   - 其他读取错误 → exitWithError(FILE_READ)（exit 2）
 * 与 readJsonlOptional（ENOENT→[] 降级）不同：本函数所有错误路径均 exit 2，不返回 null。
 *
 * @param file 文件路径（相对或绝对）
 * @returns 解析后的 JSON 对象（错误路径已 exit，不会返回）
 */
export async function readJsonClassified<T = unknown>(file: string): Promise<T> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2, rule: 'P0-2', file: abs });
    } else {
      exitWithError({
        category: 'FILE_READ',
        message: '文件读取失败',
        exitCode: 2,
        file: abs,
        detail: e.code ?? '未知错误',
      });
    }
    throw new Error('readJsonClassified: 输入错误已通过 exitWithError 处理');
  }
  try {
    return parseJsonSafe<T>(raw);
  } catch {
    exitWithError({ category: 'FILE_PARSE', message: '文件解析失败（非合法 JSON）', exitCode: 2, file: abs });
    throw new Error('readJsonClassified: 输入错误已通过 exitWithError 处理');
  }
}
