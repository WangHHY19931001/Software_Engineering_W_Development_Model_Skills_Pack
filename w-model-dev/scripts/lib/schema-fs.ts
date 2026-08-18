/**
 * Schema 文件系统读取（lib/schema-fs.ts）
 *
 * 审计修复 P5：schema 文件的磁盘 IO 从 logic/schema-loader.ts 下沉到本 lib 层，
 * logic 层恢复纯函数（不做 fs / 不 process.exit）。本模块是全脚本唯一的 schema 目录 IO 宿主：
 *   - readSchemasDir：异步读取目录下全部 .schema.json，返回 { basename: parsedSchema }
 *   - readSchemasDirSync：同步变体，供 logic/schema-loader 的 validateBySchema 首次调用
 *     以同步惰性构建 Ajv 单例（26 个 check 脚本同步调用链不变，不改变签名与行为）。
 */

import * as fsSync from 'node:fs';
import * as path from 'node:path';

import { parseJsonSafe } from './safe-json.js';

/** 读取目录下全部 .schema.json 文件，返回 { basename: parsedSchema }；目录不可读抛原始错误 */
export async function readSchemasDir(dir: string): Promise<Record<string, unknown>> {
  const map = readSchemasDirSync(dir);
  // 转置为 Promise 语义：真实 IO 已在同步体内完成，此处直接返回解析结果。
  return Promise.resolve(map);
}

/** 同步读取目录下全部 .schema.json 文件，返回 { basename: parsedSchema }（logic 惰性 Ajv 初始化用） */
export function readSchemasDirSync(dir: string): Record<string, unknown> {
  const files = fsSync
    .readdirSync(dir)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();
  const map: Record<string, unknown> = {};
  for (const f of files) {
    map[f] = parseJsonSafe<unknown>(fsSync.readFileSync(path.join(dir, f), 'utf-8'));
  }
  return map;
}
