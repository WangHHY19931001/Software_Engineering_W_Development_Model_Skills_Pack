/**
 * CLI 进程内调用层（Wave 2 试点起用）
 *
 * 前提：lib/run-main.ts 的 VITEST 守卫阻止 import 时自执行；CLI 均以
 * process.exitCode 赋值收尾（lib/cli-error.ts exitWithError 同款），不调
 * process.exit——本 helper 仅保存/恢复 exitCode 并捕获 console 输出。
 * 真实子进程保真面由 __tests__/cli-subprocess-smoke.test.ts（每 CLI 一条）
 * 与 48 条 exit-2 探针独立承载，不因进程内化归零。
 * 不适用面：CLI 自身再 spawn 子进程 / 依赖真实 stdin / 依赖进程 cwd 的用例
 * ——留在子进程形态（规格 §4.2）。
 */
import { format } from 'node:util';

import { vi } from 'vitest';

export interface InvokeCliResult {
  exitCode: number | undefined;
  stdout: string;
  stderr: string;
}

export async function invokeCli(cliModule: string, argv: string[]): Promise<InvokeCliResult> {
  const prevExitCode = process.exitCode;
  const out: string[] = [];
  const err: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    out.push(format(...a) + '\n');
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    err.push(format(...a) + '\n');
  });
  try {
    process.exitCode = undefined;
    vi.resetModules();
    const mod = (await import(cliModule)) as { main(argv: string[]): Promise<void> };
    await mod.main(argv);
  } finally {
    logSpy.mockRestore();
    errSpy.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = prevExitCode;
  return { exitCode, stdout: out.join(''), stderr: err.join('') };
}
