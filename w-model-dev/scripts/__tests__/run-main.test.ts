import { describe, expect, it, vi, afterEach } from 'vitest';
import { HandledCliError, exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';

// runMain 返回 void（内部 main().catch），用一次宏任务 tick 等 catch 链完成
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('runMain（审计修复 P10：错误出口统一）', () => {
  afterEach(() => {
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
