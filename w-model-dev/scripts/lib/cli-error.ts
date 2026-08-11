/**
 * CLI 脚本错误结构工具（lib/cli-error.ts）
 *
 * 统一全仓脚本 exit 2 输入错误的输出：
 *   - 人类可读消息 → stderr（`✗ [CATEGORY] <message>: <file|detail>`）
 *   - 机器可读摘要 → stdout（`ERROR_JSON {category,message,exitCode,file,rule,field}`）
 * 遵循 SSoT §10E E.1「JSON 摘要含 exitCode 字段且输出到 stdout」约定。
 * 设计：docs/superpowers/specs/2026-08-05-round32-error-structure-normalization-design.md §3.1
 */

/** 错误类别（exit 1 校验失败走 violations + XXX_JSON，不使用本表） */
export type ErrorCategory =
  'ARG_INVALID' | 'FILE_NOT_FOUND' | 'FILE_PARSE' | 'FILE_READ' | 'STRUCTURE_INVALID' | 'UNEXPECTED';

export interface CliError {
  category: ErrorCategory;
  /** 人类可读描述（不含 ✗ 前缀与路径后缀；由 formatCliError 组装） */
  message: string;
  /** 退出码：当前均为 2（输入错误） */
  exitCode: 0 | 1 | 2;
  /** 相关文件绝对路径（可选） */
  file?: string;
  /** 违规规则链（可选），如 'P0-1' / 'R1-R5' / 'D7' */
  rule?: string;
  /** 具体字段位置（可选），如 'requirements[3].id' */
  field?: string;
  /** 补充详情（如收到的参数值 / 底层错误码） */
  detail?: string;
}

/** 组装人类可读消息：`✗ [CATEGORY] <message> [rule=...]: <file|detail>`（file 优先，其次 detail，均无则省略冒号段；rule 可选） */
export function formatCliError(e: CliError): string {
  const head = `✗ [${e.category}] ${e.message}`;
  const rule = e.rule ? ` [rule=${e.rule}]` : '';
  const tail = e.file || e.detail;
  return tail ? `${head}${rule}: ${tail}` : `${head}${rule}`;
}

/** stderr 输出人类可读错误消息 */
export function printError(e: CliError): void {
  console.error(formatCliError(e));
}

/** stdout 输出结构化错误摘要（ERROR_JSON 前缀 + JSON，遵循 §10E E.1；file/rule/field 仅在有值时输出，向后兼容） */
export function printErrorJson(e: CliError): void {
  const json: Record<string, unknown> = { category: e.category, message: e.message, exitCode: e.exitCode };
  if (e.file !== undefined) json.file = e.file;
  if (e.rule !== undefined) json.rule = e.rule;
  if (e.field !== undefined) json.field = e.field;
  console.log(`ERROR_JSON ${JSON.stringify(json)}`);
}

/** printError + printErrorJson + 设置 process.exitCode（返回后由 Node 自然退出，stdout 先 flush 再退出，避免 process.exit() 截断 ERROR_JSON） */
export function exitWithError(e: CliError): void {
  printError(e);
  printErrorJson(e);
  process.exitCode = e.exitCode;
}
