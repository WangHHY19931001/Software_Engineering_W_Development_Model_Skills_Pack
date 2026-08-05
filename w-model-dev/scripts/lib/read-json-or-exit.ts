/**
 * CLI 脚本输入读取工具（Read JSON or Exit）
 *
 * 消除 check-*.ts 中重复的「readFile + ENOENT → exit(2) + JSON.parse → exit(2)」样板。
 * 可选输入变体（readJsonOptional / readJsonlOptional）：ENOENT 降级为 null/[]（不 exit），
 * 损坏文件仍按输入错误 exit 2（JSONL 坏行 warn+skip 不变）。
 * 仅用于 check-*.ts CLI 层；*-logic.ts 纯逻辑层不依赖本工具。
 *
 * 设计原则：
 *   - 行为与原样板完全一致（exit code 2 + 相同错误消息格式）
 *   - 不引入新依赖（仅 node:fs / node:path）
 *   - 泛型支持调用方指定返回类型
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseJsonSafe } from './safe-json.js';

/**
 * 读取并解析 JSON 文件。
 * - 文件不存在（ENOENT）→ console.error + process.exit(2)
 * - JSON 解析失败 → console.error + process.exit(2)
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
      console.error(`✗ [FILE_NOT_FOUND] 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }
  try {
    return parseJsonSafe<T>(raw);
  } catch {
    console.error(`✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }
}

/**
 * 读取 JSONL 文件（每行一个 JSON）。
 * - 文件不存在（ENOENT）→ console.error + process.exit(2)
 * - 空行跳过
 * - 单行非法 JSON → 跳过并 console.error 警告（不 exit，与原 run-log/checkpoint 行为一致）
 * - 其他读取异常 → rethrow
 *
 * @param file 文件路径（相对或绝对）
 * @param label 警告消息中的行类型描述（默认「行」），如「run-log」「checkpoint」
 * @returns 解析后的条目数组
 */
export async function readJsonlOrExit(
  file: string,
  label = '行',
): Promise<unknown[]> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ [FILE_NOT_FOUND] 文件不存在: ${abs}`);
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
 * 可选 JSON 输入：ENOENT→null（不 exit）；解析失败→exit 2（与 readJsonOrExit 一致）。
 * 用于「附属输入缺失时降级跳过、损坏时按输入错误拒绝」的调用点。
 *
 * @param file 文件路径（相对或绝对）
 * @returns 解析后的 JSON 对象；文件不存在返回 null
 */
export async function readJsonOptional<T = unknown>(file: string): Promise<T | null> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  try {
    return parseJsonSafe<T>(raw);
  } catch {
    console.error(`✗ [FILE_PARSE] 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }
}

/**
 * 可选 JSONL 输入：ENOENT→[]（不 exit）；其余同 readJsonlOrExit（坏行 warn+skip）。
 *
 * @param file 文件路径（相对或绝对）
 * @param label 警告消息中的行类型描述（默认「行」）
 * @returns 解析后的条目数组；文件不存在返回空数组
 */
export async function readJsonlOptional(
  file: string,
  label = '行',
): Promise<unknown[]> {
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
