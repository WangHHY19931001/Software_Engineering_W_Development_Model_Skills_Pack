/**
 * CLI 脚本输入读取工具（Read JSON or Exit）
 *
 * 消除 check-*.ts 中重复的「readFile + ENOENT → exit(2) + JSON.parse → exit(2)」样板。
 * 仅用于 check-*.ts CLI 层；*-logic.ts 纯逻辑层不依赖本工具。
 *
 * 设计原则：
 *   - 行为与原样板完全一致（exit code 2 + 相同错误消息格式）
 *   - 不引入新依赖（仅 node:fs / node:path）
 *   - 泛型支持调用方指定返回类型
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

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
    return JSON.parse(raw) as T;
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
  const lines = raw.split(/\r?\n/);
  const entries: unknown[] = [];
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      console.error(`⚠ [FILE_PARSE] ${label} 第 ${i + 1} 行非合法 JSON，已跳过: ${abs}`);
    }
  }
  return entries;
}
