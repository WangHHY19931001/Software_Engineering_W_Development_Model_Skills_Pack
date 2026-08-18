/**
 * CLI main 统一入口（lib/run-main.ts）
 *
 * 消除各 cli/*.ts 结尾重复的 main().catch(UNEXPECTED) 样板（审计修复 P9/P10）。
 * HandledCliError = exitWithError 已处理（输出 + exitCode 已设），静默返回交给 Node 自然退出。
 */

import { exitWithError, HandledCliError } from './cli-error.js';

export function runMain(main: () => Promise<void>): void {
  main().catch((err: unknown) => {
    if (err instanceof HandledCliError) return;
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
