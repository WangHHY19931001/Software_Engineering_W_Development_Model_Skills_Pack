/**
 * 统一「读取 → JSON 解析 → schema 校验」工具（lib/load-and-validate.ts）
 *
 * 收敛 check-*.ts CLI 层重复的「readFileSync + JSON.parse + AJV 校验」样板：
 * 一次调用完成读取 → 解析 → schema 校验，错误统一分类并经 exitWithError 输出
 * （stderr 人类消息 `✗ [CATEGORY] ...` + stdout `ERROR_JSON {...}`），
 * 返回类型由调用方指定（泛型）。
 *
 * 设计（docs/superpowers/specs/2026-08-11-p0-p2-fixes-design.md §4 C1）：
 *   - 复用 logic/schema-loader.ts 的 Ajv 单例与 schemas/ 自动加载机制
 *     （validateBySchema → getAjv() 单例 + 编译缓存），不 new Ajv 重新编译。
 *   - schemaKey 即 schema-loader 注册名（= schemas/<schemaKey>.schema.json 的 basename），
 *     无需在本模块内自行定位 schema 文件。
 *   - 错误分类（与 lib/read-json-or-exit.ts readJsonClassified 同构）：
 *       ENOENT           → FILE_NOT_FOUND（rule P0-2）
 *       其他读取错误      → FILE_READ
 *       JSON 解析失败     → FILE_PARSE
 *       schema 校验失败   → STRUCTURE_INVALID（rule P0-3，field=首个错误的 instancePath，
 *                          detail=首个错误消息）
 *   - 错误路径 exitWithError 后抛哨兵 Error（与 readJsonClassified 同构），
 *     防止调用方继续执行产生「ERROR_JSON + 正常报告」混合输出；调用方 catch 后 return 2。
 *   - 仅用于 check-*.ts CLI 层；*-logic.ts 纯逻辑层不依赖本工具。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseJsonSafe } from './safe-json.js';
import { exitWithError } from './cli-error.js';
import { validateBySchema } from '../logic/schema-loader.js';

/**
 * 读取并解析 JSON 文件，然后按 schemaKey 校验（失败均 exit 2 + ERROR_JSON）。
 *
 * @param filePath 文件路径（相对或绝对）
 * @param schemaKey schema 注册名（schemas/<schemaKey>.schema.json 的 basename）
 * @returns 通过 schema 校验的解析后对象（错误路径已 exitWithError + 抛哨兵 Error，不会返回）
 */
export async function loadAndValidate<T = unknown>(filePath: string, schemaKey: string): Promise<T> {
  const abs = path.resolve(filePath);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2, rule: 'P0-2', file: abs });
    } else {
      exitWithError({ category: 'FILE_READ', message: '文件读取失败', exitCode: 2, file: abs, detail: e.code ?? '未知错误' });
    }
    throw new Error('loadAndValidate: 输入错误已通过 exitWithError 处理');
  }
  let parsed: T;
  try {
    parsed = parseJsonSafe<T>(raw);
  } catch {
    exitWithError({ category: 'FILE_PARSE', message: '文件解析失败（非合法 JSON）', exitCode: 2, file: abs });
    throw new Error('loadAndValidate: 输入错误已通过 exitWithError 处理');
  }
  const schemaResult = validateBySchema(schemaKey, parsed);
  if (!schemaResult.valid) {
    const first = schemaResult.errors?.[0];
    exitWithError({
      category: 'STRUCTURE_INVALID',
      message: '文件结构不符',
      exitCode: 2,
      rule: 'P0-3',
      file: abs,
      field: first?.instancePath || '/',
      detail: first?.message ?? schemaResult.errorMessages[0],
    });
    throw new Error('loadAndValidate: 输入错误已通过 exitWithError 处理');
  }
  return parsed;
}
