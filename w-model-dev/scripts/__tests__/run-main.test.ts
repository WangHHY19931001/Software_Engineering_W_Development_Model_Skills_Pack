import { describe, expect, it, vi, afterEach, beforeEach, type MockInstance } from 'vitest';

import { HandledCliError, exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';

// runMain 返回 void（内部 main().catch），用一次宏任务 tick 等 catch 链完成
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('runMain（审计修复 P10：错误出口统一）', () => {
  // 本组用例进程内直调 runMain（非 spawn 子进程）。钩子摘除 VITEST 是为了模拟真实
  // 子进程语义（tsx 直跑时 VITEST 未设置，与 spawn 层 childProcessEnv 剥离同口径）；
  // C1 修复后 runMain 不再读取任何环境变量，此钩子仅为子进程语义保真。
  const prevVitest = process.env.VITEST;

  beforeEach(() => {
    delete process.env.VITEST;
  });

  afterEach(() => {
    if (prevVitest !== undefined) process.env.VITEST = prevVitest;
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('main 异常路径（3 态：正常完成 / HandledCliError / 普通异常）', async () => {
    const rows: Array<{
      name: string;
      main: () => Promise<undefined>;
      check: (spies: { errSpy: MockInstance; logSpy: MockInstance }) => void;
    }> = [
      {
        name: 'main 正常完成时不做任何事',
        main: async () => undefined,
        check: ({ errSpy }) => {
          expect(errSpy, '正常完成：不应有任何错误输出').not.toHaveBeenCalled();
          expect(process.exitCode, '正常完成：不应设置 exitCode').toBeUndefined();
        },
      },
      {
        name: 'main 抛 HandledCliError 时不重复输出（exitWithError 已处理）',
        main: async () => {
          exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2 });
          throw new HandledCliError();
        },
        check: ({ errSpy, logSpy }) => {
          expect(process.exitCode, 'HandledCliError：exitCode 应为 2').toBe(2);
          expect(errSpy, 'HandledCliError：仅 exitWithError 的一次错误输出').toHaveBeenCalledTimes(1);
          expect(logSpy, 'HandledCliError：仅一条 ERROR_JSON').toHaveBeenCalledTimes(1);
        },
      },
      {
        name: 'main 抛普通异常时输出 UNEXPECTED + exitCode 2',
        main: async () => {
          throw new Error('boom');
        },
        check: ({ logSpy }) => {
          expect(process.exitCode, '普通异常：exitCode 应为 2').toBe(2);
          expect(logSpy, '普通异常：应输出 UNEXPECTED ERROR_JSON').toHaveBeenCalledWith(
            expect.stringContaining('"UNEXPECTED"'),
          );
        },
      },
    ];
    for (const row of rows) {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        runMain(row.main);
        await flush();
        row.check({ errSpy, logSpy });
      } finally {
        // 每迭代自清理，等价原 beforeEach/afterEach 粒度（真实子进程语义不变）
        vi.restoreAllMocks();
        process.exitCode = undefined;
      }
    }
  });
});

/**
 * runMain 无环境旁路（C1，2026-10-04）
 *
 * 旧实现带 `if (process.env.VITEST) return;` 全局旁路——任何 CLI 在 VITEST 环境变量
 * 非空时被静默跳过（无输出 exit 0，门禁链旁路）。现已删除：vitest worker 内 import
 * 的自执行防护改由各 cli/*.ts 尾部 isDirectInvocation 守卫承担（见
 * __tests__/cli-entry-guard.test.ts），runMain 对环境变量零依赖。
 */
describe('runMain 无环境旁路（C1）', () => {
  it('vitest 环境下仍执行 main（不得以 VITEST 静默跳过）', async () => {
    const prev = process.env.VITEST;
    process.env.VITEST = '1';
    try {
      const main = vi.fn().mockResolvedValue(undefined);
      runMain(main);
      await vi.waitFor(() => expect(main).toHaveBeenCalledTimes(1));
    } finally {
      if (prev !== undefined) process.env.VITEST = prev;
      else delete process.env.VITEST;
    }
  });
});
