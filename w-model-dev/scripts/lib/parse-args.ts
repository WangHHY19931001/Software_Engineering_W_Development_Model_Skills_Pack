/**
 * CLI 通用参数解析（lib/parse-args.ts）
 *
 * 审计修复 P9：`--key=value` 解析与 `--flag` 检测此前在各 cli/*.ts 内复制十余份，统一抽取。
 */

/** 重复值 flag 输入错误（runMain 统一转 ARG_INVALID / exit 2） */
export class DuplicateFlagError extends Error {
  constructor(public readonly flag: string) {
    super(`重复的命令行参数 --${flag}（值 flag 只允许出现一次；旧「取第一个」语义已废除）`);
  }
}

/** 取 `--name=value` 形态的值；不存在返回 undefined（值可为空串）；重复出现抛 DuplicateFlagError */
export function parseFlagValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const hits = args.filter((a) => a.startsWith(prefix));
  if (hits.length > 1) throw new DuplicateFlagError(name);
  return hits.length === 0 ? undefined : hits[0]!.slice(prefix.length);
}

/** 检测 `--name` 布尔旗标存在性 */
export function hasFlag(args: readonly string[], name: string): boolean {
  return args.includes(`--${name}`);
}
