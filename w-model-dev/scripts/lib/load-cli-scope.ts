/**
 * CLI ChangeScope 装载共享 helper（lib/load-cli-scope.ts）
 *
 * 消除三个 checker（check-codegraph-queries.ts / check-opsx-artifacts.ts /
 * check-openspec-archive.ts）main() 中复制的 resolveCliScope 装载样板：
 * CLI 参数（--scope / --change/--base/--head）→ resolveCliScope → 三态处理：
 *   - kind='invalid'（文件/JSON/schema/参数冲突）→ exitWithError(exit 2) 输出
 *     stderr 人类消息 + stdout ERROR_JSON，随后抛 HandledCliError 中断调用链
 *     （runMain 识别后静默退出，行为与调用方自行 `exitWithError; return` 一致）；
 *   - kind='missing' → 原样透传 reasons（调用方按校验失败 exit 1 处理）；
 *   - kind='violations' → 原样透传 violations（exit 1）；
 *   - kind='ok' → 透传 scope 并预组装 scopeLabel（三者相同的展示串）。
 *
 * 调用方无需自行 import parseFlagValue / gitRunnerFor / exitWithError；
 * invalid 分支已处理完毕，helper 只会返回 missing / violations / ok 三态。
 */

import { exitWithError, HandledCliError } from './cli-error.js';
import { gitRunnerFor, resolveCliScope, type ChangeScope } from './change-scope.js';
import { parseFlagValue } from './parse-args.js';

/** helper 返回三态（invalid 已内部 exitWithError 处理，不会以该 kind 返回） */
export type LoadedCliScope =
  | { kind: 'ok'; scope: ChangeScope; scopeLabel: string }
  | { kind: 'missing'; reasons: string[] }
  | { kind: 'violations'; violations: string[] };

/**
 * 从 CLI 参数装载 ChangeScope（三 checker 共享）。
 *
 * @param argv        进程参数（process.argv）；--scope / --change / --base / --head 由此解析
 * @param projectRoot 项目根绝对路径（已由调用方校验存在且为目录）
 * @param phase       CLI 校验阶段（5-8）
 * @throws HandledCliError 当 resolveCliScope 返回 invalid（错误已输出、exitCode 已设 2）
 */
export function loadCliScope(argv: readonly string[], projectRoot: string, phase: number): LoadedCliScope {
  const resolved = resolveCliScope({
    projectRoot,
    phase,
    scopePath: parseFlagValue(argv, 'scope'),
    changeArg: parseFlagValue(argv, 'change'),
    baseArg: parseFlagValue(argv, 'base'),
    headArg: parseFlagValue(argv, 'head'),
    git: gitRunnerFor(projectRoot),
  });
  if (resolved.kind === 'invalid') {
    exitWithError({
      category: resolved.category,
      rule: 'P0-1',
      message: resolved.message,
      detail: resolved.detail,
      file: resolved.file,
      exitCode: 2,
    });
    throw new HandledCliError();
  }
  if (resolved.kind === 'missing') return { kind: 'missing', reasons: resolved.reasons };
  if (resolved.kind === 'violations') return { kind: 'violations', violations: resolved.violations };
  const scopeLabel = `${resolved.scope.changeId}（base=${resolved.scope.baseRef}..head=${resolved.scope.headRef}，声明 ${resolved.scope.changedFiles.length} 个变更文件）`;
  return { kind: 'ok', scope: resolved.scope, scopeLabel };
}
