/**
 * JSON Schema 校验工具（Schema Loader）
 *
 * 借鉴 drawio-skill/styles/schema.json 设计：所有 .w-model/*.json 必须先过 schema 校验，
 * 才进入业务规则校验。schema 用 draft-07 + additionalProperties:false 防字段漂移。
 *
 * 设计：
 *   - 单例 Ajv 实例（lazy init），编译后缓存
 *   - schemas/ 目录下 *.schema.json 自动加载，按 $id 或文件名注册
 *   - 校验失败返回结构化 errors（含关键字段路径 + keyword），便于 Agent 修正
 *
 * 不引入运行时依赖到分发产物：本模块 import 'ajv'，但 ajv 仅作为 devDependency，
 * 因为 scripts/ 不打入 bundle，由 tsx 直接执行；技能包分发不含 node_modules。
 *
 * // 审计修复 P5：磁盘 IO 经 lib/schema-fs.ts（readSchemasDirSync）；错误经抛异常上抛，
 *    由 CLI 层 runMain 统一格式化（不直接退出进程、不手拼错误 JSON）。
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import type AjvDefault from 'ajv';
import type { ErrorObject } from 'ajv';
import type addFormatsDefault from 'ajv-formats';

import { readSchemasDirSync } from '../lib/schema-fs.js';

const SCHEMAS_DIR = join(fileURLToPath(import.meta.url), '..', '..', '..', 'schemas');

/** 同步 require（ESM 下加载 CJS 依赖；保持 validateBySchema 同步语义，26 个 check 脚本调用链不变） */
const nodeRequire = createRequire(import.meta.url);

let ajv: AjvDefault | null = null;

/**
 * 依赖守卫（审计修复 B1a）：ajv / ajv-formats 未安装（用户尚未 npm install）时，
 * 不再 console.error + 输出错误 JSON + 直接退出进程(2)，改为抛异常上抛，
 * 由 CLI 层 runMain 统一格式化（审计修复 P5 去 exit）。
 */
function loadAjvDeps(): { AjvCtor: typeof AjvDefault; addFormats: typeof addFormatsDefault } {
  try {
    return {
      AjvCtor: nodeRequire('ajv') as typeof AjvDefault,
      addFormats: nodeRequire('ajv-formats') as typeof addFormatsDefault,
    };
  } catch {
    throw new Error('缺少 devDependencies ajv/ajv-formats：请在仓库根 npm install 后重试');
  }
}

/** 由预加载的 schemas（basename → parsed schema）构建 Ajv 单例：无 fs / 无直接退出进程 / 无手拼错误 JSON */
function buildAjv(schemas: Record<string, unknown>): AjvDefault {
  const { AjvCtor, addFormats } = loadAjvDeps();
  const newAjv = new AjvCtor({ allErrors: true, strict: true });
  addFormats(newAjv);
  for (const [basename, schema] of Object.entries(schemas)) {
    const name = basename.endsWith('.schema.json') ? basename.slice(0, -'.schema.json'.length) : basename;
    newAjv.addSchema(schema as object, name);
  }
  return newAjv;
}

function getAjv(): AjvDefault {
  if (ajv) return ajv;
  // 磁盘 IO 经 lib/schema-fs.ts（审计修复 P5，logic 层不直接 fs）
  ajv = buildAjv(readSchemasDirSync(SCHEMAS_DIR));
  return ajv;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
  errorMessages: string[];
}

export function validateBySchema(name: string, data: unknown): SchemaValidationResult {
  const v = getAjv();
  const validate = v.getSchema(name);
  if (!validate) {
    return {
      valid: false,
      errors: null,
      errorMessages: [`schema 未注册: ${name}`],
    };
  }
  const valid = validate(data) as boolean;
  const errors = validate.errors ?? null;
  return {
    valid,
    errors,
    errorMessages: valid
      ? []
      : (errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message ?? ''} [${e.keyword}]`),
  };
}
