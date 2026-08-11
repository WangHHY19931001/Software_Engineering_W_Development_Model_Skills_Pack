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
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import addFormats from 'ajv-formats';
import Ajv, { type ErrorObject } from 'ajv';

import { parseJsonSafe } from '../lib/safe-json.js';

const SCHEMAS_DIR = join(fileURLToPath(import.meta.url), '..', '..', '..', 'schemas');

let ajv: Ajv | null = null;

function getAjv(): Ajv {
  if (ajv) return ajv;
  if (!existsSync(SCHEMAS_DIR)) {
    throw new Error(`schemas 目录不存在: ${SCHEMAS_DIR}`);
  }
  const newAjv = new Ajv({ allErrors: true, strict: true });
  addFormats(newAjv);
  try {
    for (const f of readdirSync(SCHEMAS_DIR)) {
      if (!f.endsWith('.schema.json')) continue;
      const name = basename(f, '.schema.json');
      const schema = parseJsonSafe<object>(readFileSync(join(SCHEMAS_DIR, f), 'utf-8'));
      newAjv.addSchema(schema, name);
    }
  } catch (err) {
    throw new Error(`schema 加载失败（${SCHEMAS_DIR}）：${err instanceof Error ? err.message : String(err)}`);
  }
  ajv = newAjv;
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
