import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { HandledCliError, exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';

// runMain 返回 void（内部 main().catch），用一次宏任务 tick 等 catch 链完成
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('runMain（审计修复 P10：错误出口统一）', () => {
  // Wave 2 起 runMain 带 VITEST 自执行守卫（见下方「runMain VITEST 守卫」describe）。
  // 本组用例进程内直调 runMain（非 spawn 子进程），spawn 层的 childProcessEnv 剥离
  // 帮不了这里——钩子摘除 VITEST 是正确适配：模拟真实子进程语义（tsx 直跑时 VITEST
  // 未设置），断言口径与守卫落地前完全一致。
  const prevVitest = process.env.VITEST;

  beforeEach(() => {
    delete process.env.VITEST;
  });

  afterEach(() => {
    if (prevVitest !== undefined) process.env.VITEST = prevVitest;
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('main 正常完成时不做任何事', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runMain(async () => undefined);
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('main 抛 HandledCliError 时不重复输出（exitWithError 已处理）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runMain(async () => {
      exitWithError({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2 });
      throw new HandledCliError();
    });
    await flush();
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledTimes(1); // 仅 exitWithError 的一次
    expect(logSpy).toHaveBeenCalledTimes(1); // 仅一条 ERROR_JSON
  });

  it('main 抛普通异常时输出 UNEXPECTED + exitCode 2', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    runMain(async () => {
      throw new Error('boom');
    });
    await flush();
    expect(process.exitCode).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"UNEXPECTED"'));
  });
});

/**
 * runMain VITEST 守卫（Wave 2 进程内调用层前提）
 *
 * vitest 进程内动态 import CLI 模块时，模块底部的 runMain(main) 不得自执行——
 * 否则 import 即触发真实 CLI 运行。守卫条件 process.env.VITEST 仅在 vitest
 * worker 内为真；真实子进程（tsx 直跑）永不设置。
 */
describe('runMain VITEST 守卫', () => {
  it('vitest 环境下不自执行 main（进程内调用层前提）', () => {
    const main = vi.fn().mockResolvedValue(undefined);
    runMain(main);
    expect(main).not.toHaveBeenCalled();
  });

  it('非 vitest 环境自执行 main（临时删除 VITEST 后恢复）', async () => {
    const prev = process.env.VITEST;
    delete process.env.VITEST;
    try {
      const main = vi.fn().mockResolvedValue(undefined);
      runMain(main);
      await vi.waitFor(() => expect(main).toHaveBeenCalledTimes(1));
    } finally {
      if (prev !== undefined) process.env.VITEST = prev;
    }
  });
});
