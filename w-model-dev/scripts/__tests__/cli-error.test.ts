/**
 * lib/cli-error.ts 单元测试
 *
 * 覆盖：formatCliError 三类模板（file / detail / 均无）/ printError 走 stderr /
 *       printErrorJson 走 stdout 且含 exitCode、无 file 时省略 / exitWithError 设置 process.exitCode。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatCliError, printError, printErrorJson, exitWithError, type CliError } from '../lib/cli-error.js';

const NOT_FOUND: CliError = {
  category: 'FILE_NOT_FOUND',
  message: '文件不存在',
  exitCode: 2,
  file: 'C:\\proj\\.w-model\\project.json',
};

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});

describe('formatCliError', () => {
  it('带 file → `✗ [CATEGORY] message: file`', () => {
    expect(formatCliError(NOT_FOUND)).toBe('✗ [FILE_NOT_FOUND] 文件不存在: C:\\proj\\.w-model\\project.json');
  });

  it('带 detail 无 file → `✗ [CATEGORY] message: detail`', () => {
    const e: CliError = {
      category: 'ARG_INVALID',
      message: '参数非法 --phase=99',
      exitCode: 2,
      detail: '须为 1-8 整数',
    };
    expect(formatCliError(e)).toBe('✗ [ARG_INVALID] 参数非法 --phase=99: 须为 1-8 整数');
  });

  it('无 file/detail → 省略冒号段', () => {
    const e: CliError = { category: 'UNEXPECTED', message: '脚本异常', exitCode: 2 };
    expect(formatCliError(e)).toBe('✗ [UNEXPECTED] 脚本异常');
  });

  it('formatCliError 附加 [rule=...] 段', () => {
    expect(formatCliError({ category: 'ARG_INVALID', message: 'm', exitCode: 2, rule: 'P0-1' })).toBe(
      '✗ [ARG_INVALID] m [rule=P0-1]',
    );
  });

  it('formatCliError rule 与 tail 组合输出', () => {
    expect(
      formatCliError({ category: 'FILE_NOT_FOUND', message: 'm', exitCode: 2, rule: 'P0-2', file: '/x/rtm.json' }),
    ).toBe('✗ [FILE_NOT_FOUND] m [rule=P0-2]: /x/rtm.json');
  });
});

describe('printError / printErrorJson', () => {
  it('printError 输出人类消息到 stderr（console.error）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printError(NOT_FOUND);
    expect(spy).toHaveBeenCalledWith('✗ [FILE_NOT_FOUND] 文件不存在: C:\\proj\\.w-model\\project.json');
  });

  it('printErrorJson 输出 ERROR_JSON 到 stdout（console.log）且含 exitCode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printErrorJson(NOT_FOUND);
    const out = spy.mock.calls[0]![0] as string;
    expect(out.startsWith('ERROR_JSON ')).toBe(true);
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as {
      category: string;
      message: string;
      exitCode: number;
    };
    expect(parsed).toMatchObject({ category: 'FILE_NOT_FOUND', message: '文件不存在', exitCode: 2 });
  });

  it('printErrorJson 无 file → JSON 省略 file 字段', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printErrorJson({ category: 'UNEXPECTED', message: '脚本异常', exitCode: 2 });
    const out = spy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as Record<string, unknown>;
    expect(parsed).toMatchObject({ category: 'UNEXPECTED', message: '脚本异常', exitCode: 2 });
    expect('file' in parsed).toBe(false);
  });

  it('ERROR_JSON 含 rule/field 字段', () => {
    const calls: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((s: string) => {
      calls.push(s);
    });
    printErrorJson({ category: 'ARG_INVALID', message: 'm', exitCode: 2, rule: 'P0-1', field: 'rtm[0].id' });
    spy.mockRestore();
    expect(calls[0]).toContain('"rule":"P0-1"');
    expect(calls[0]).toContain('"field":"rtm[0].id"');
  });

  it('缺失 rule/field 时 ERROR_JSON 省略', () => {
    const calls: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((s: string) => {
      calls.push(s);
    });
    printErrorJson({ category: 'ARG_INVALID', message: 'm', exitCode: 2 });
    spy.mockRestore();
    expect(calls[0]).not.toContain('"rule"');
    expect(calls[0]).not.toContain('"field"');
  });
});

describe('exitWithError', () => {
  it('设置 process.exitCode=2 且正常返回（stdout 先 flush）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => exitWithError(NOT_FOUND)).not.toThrow();
    expect(process.exitCode).toBe(2);
  });
});
