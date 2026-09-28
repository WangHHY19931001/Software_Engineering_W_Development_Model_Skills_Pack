/**
 * CLI main 统一入口（lib/run-main.ts）
 *
 * 消除各 cli/*.ts 结尾重复的 main().catch(UNEXPECTED) 样板（审计修复 P9/P10）。
 * HandledCliError = exitWithError 已处理（输出 + exitCode 已设），静默返回交给 Node 自然退出。
 * DuplicateFlagError = 值 flag 重复出现（输入错误），统一转 ARG_INVALID / exit 2。
 */

import { exitWithError, HandledCliError } from './cli-error.js';
import { DuplicateFlagError } from './parse-args.js';

export function runMain(main: () => Promise<void>): void {
  // Wave 2 进程内调用层：vitest worker 内 import 时不自执行（helpers/cli-invoker.ts
  // 显式调用 main(argv)）；真实子进程（tsx 直跑）永不设置 VITEST。
  if (process.env.VITEST) return;
  main().catch((err: unknown) => {
    if (err instanceof HandledCliError) return;
    if (err instanceof DuplicateFlagError) {
      exitWithError({ category: 'ARG_INVALID', message: err.message, exitCode: 2 });
      return;
    }
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
