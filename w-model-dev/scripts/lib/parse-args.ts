/**
 * CLI 通用参数解析（lib/parse-args.ts）
 *
 * 审计修复 P9：`--key=value` 解析与 `--flag` 检测此前在各 cli/*.ts 内复制十余份，统一抽取。
 */

/** 取 `--name=value` 形态的值；不存在返回 undefined（值可为空串） */
export function parseFlagValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

/** 检测 `--name` 布尔旗标存在性 */
export function hasFlag(args: readonly string[], name: string): boolean {
  return args.includes(`--${name}`);
}