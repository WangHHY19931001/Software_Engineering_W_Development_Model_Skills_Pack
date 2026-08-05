/**
 * lib/cli-error.ts 单元测试
 *
 * 覆盖：formatCliError 三类模板（file / detail / 均无）/ printError 走 stderr /
 *       printErrorJson 走 stdout 且含 exitCode / exitWithError 调 process.exit(2)。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCliError,
  printError,
  printErrorJson,
  exitWithError,
  type CliError,
} from '../lib/cli-error.js';

const NOT_FOUND: CliError = {
  category: 'FILE_NOT_FOUND',
  message: '文件不存在',
  exitCode: 2,
  file: 'C:\\proj\\.w-model\\project.json',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatCliError', () => {
  it('带 file → `✗ [CATEGORY] message: file`', () => {
    expect(formatCliError(NOT_FOUND)).toBe(
      '✗ [FILE_NOT_FOUND] 文件不存在: C:\\proj\\.w-model\\project.json',
    );
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
});

describe('exitWithError', () => {
  it('调用 process.exit(2)（消息与 JSON 均已输出）', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => exitWithError(NOT_FOUND)).toThrow('exit:2');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
