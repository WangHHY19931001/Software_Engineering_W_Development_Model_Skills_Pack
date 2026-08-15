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
import { createRequire } from 'node:module';

import type AjvDefault from 'ajv';
import type { ErrorObject } from 'ajv';
import type addFormatsDefault from 'ajv-formats';

import { parseJsonSafe } from '../lib/safe-json.js';

const SCHEMAS_DIR = join(fileURLToPath(import.meta.url), '..', '..', '..', 'schemas');

/** 同步 require（ESM 下加载 CJS 依赖；保持 validateBySchema 同步语义，26 个 check 脚本调用链不变） */
const nodeRequire = createRequire(import.meta.url);

let ajv: AjvDefault | null = null;

/**
 * 依赖守卫（审计修复 B1a）：ajv / ajv-formats 未安装（用户尚未 npm install）时，
 * 输出统一错误结构 + 安装指引并 exit 2，替代 Node 原生 ERR_MODULE_NOT_FOUND 堆栈
 * （新用户首次启用时最常见故障：见 references/command-reference.md「doctor」节）。
 */
function loadAjvDepsOrExit(): { AjvCtor: typeof AjvDefault; addFormats: typeof addFormatsDefault } {
  try {
    return {
      AjvCtor: nodeRequire('ajv') as typeof AjvDefault,
      addFormats: nodeRequire('ajv-formats') as typeof addFormatsDefault,
    };
  } catch {
    console.error(
      '✗ [UNEXPECTED] 运行依赖缺失：ajv / ajv-formats 未安装。请先在仓库根目录执行 `npm install`（详见 docs/INSTALL.md），然后重试本命令；也可运行 `npx tsx w-model-dev/scripts/cli/doctor.ts` 做环境自检',
    );
    console.log(
      'ERROR_JSON {"category":"UNEXPECTED","message":"依赖缺失：ajv/ajv-formats 未安装，请先 npm install（docs/INSTALL.md）","exitCode":2}',
    );
    process.exit(2);
  }
}

function getAjv(): AjvDefault {
  if (ajv) return ajv;
  if (!existsSync(SCHEMAS_DIR)) {
    throw new Error(`schemas 目录不存在: ${SCHEMAS_DIR}`);
  }
  const { AjvCtor, addFormats } = loadAjvDepsOrExit();
  const newAjv = new AjvCtor({ allErrors: true, strict: true });
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
