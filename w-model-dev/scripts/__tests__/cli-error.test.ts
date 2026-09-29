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
  it('含段行（5 态：file / detail / rule / rule+tail / file+detail）', () => {
    for (const [caseName, error, expected] of [
      ['带 file', NOT_FOUND, '✗ [FILE_NOT_FOUND] 文件不存在: C:\\proj\\.w-model\\project.json'],
      [
        '带 detail 无 file',
        { category: 'ARG_INVALID', message: '参数非法 --phase=99', exitCode: 2, detail: '须为 1-8 整数' },
        '✗ [ARG_INVALID] 参数非法 --phase=99: 须为 1-8 整数',
      ],
      [
        '附加 [rule=...] 段',
        { category: 'ARG_INVALID', message: 'm', exitCode: 2, rule: 'P0-1' },
        '✗ [ARG_INVALID] m [rule=P0-1]',
      ],
      [
        'rule 与 tail 组合',
        { category: 'FILE_NOT_FOUND', message: 'm', exitCode: 2, rule: 'P0-2', file: '/x/rtm.json' },
        '✗ [FILE_NOT_FOUND] m [rule=P0-2]: /x/rtm.json',
      ],
      [
        'file 与 detail 同有（F-G6-02：detail 附于括号不被 file 吞并）',
        {
          category: 'STRUCTURE_INVALID',
          message: 'ChangeScope 违反 change-scope.schema.json',
          exitCode: 2,
          file: '/x/scope.json',
          detail: '/changedFiles/0: must match pattern [pattern]',
        },
        '✗ [STRUCTURE_INVALID] ChangeScope 违反 change-scope.schema.json: /x/scope.json（/changedFiles/0: must match pattern [pattern]）',
      ],
    ] as const) {
      expect(formatCliError(error), `${caseName}: 模板输出`).toBe(expected);
    }
  });

  it('省略段行（无 file/detail → 省略冒号段）', () => {
    const e: CliError = { category: 'UNEXPECTED', message: '脚本异常', exitCode: 2 };
    expect(formatCliError(e), '无 file/detail: 省略冒号段').toBe('✗ [UNEXPECTED] 脚本异常');
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

  /** 捕获 printErrorJson 写到 stdout 的单行 ERROR_JSON（console.log spy，restore 后返回）。 */
  function captureErrorJsonLine(error: CliError): string {
    const calls: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((s: string) => {
      calls.push(s);
    });
    try {
      printErrorJson(error);
    } finally {
      spy.mockRestore();
    }
    return calls[0]!;
  }

  it('ERROR_JSON 含字段行（2 态：rule+field / detail）', () => {
    for (const { caseName, error, expectContains } of [
      {
        caseName: 'rule/field 字段',
        error: { category: 'ARG_INVALID', message: 'm', exitCode: 2, rule: 'P0-1', field: 'rtm[0].id' },
        expectContains: ['"rule":"P0-1"', '"field":"rtm[0].id"'],
      },
      {
        caseName: 'detail 字段（F-G6-02：schema 定位信息可机器读取）',
        error: {
          category: 'STRUCTURE_INVALID',
          message: 'ChangeScope 违反 change-scope.schema.json',
          exitCode: 2,
          file: '/x/scope.json',
          detail: '/changedFiles/0: must match pattern [pattern]',
        },
        expectContains: ['"detail":"/changedFiles/0: must match pattern [pattern]"'],
      },
    ] as const) {
      const line = captureErrorJsonLine(error);
      for (const frag of expectContains) {
        expect(line, `${caseName}: 应含 ${frag}`).toContain(frag);
      }
    }
  });

  it('ERROR_JSON 省略行（2 态：无 file 省略 / 缺省 rule·field·detail 省略）', () => {
    // 态 1：无 file → JSON 省略 file 字段
    const line1 = captureErrorJsonLine({ category: 'UNEXPECTED', message: '脚本异常', exitCode: 2 });
    const parsed1 = JSON.parse(line1.slice('ERROR_JSON '.length)) as Record<string, unknown>;
    expect(parsed1, '无 file: 基础字段保留').toMatchObject({
      category: 'UNEXPECTED',
      message: '脚本异常',
      exitCode: 2,
    });
    expect('file' in parsed1, '无 file: file 字段应省略').toBe(false);

    // 态 2：缺失 rule/field/detail 时省略
    const line2 = captureErrorJsonLine({ category: 'ARG_INVALID', message: 'm', exitCode: 2 });
    expect(line2, '缺省: 不应含 "rule"').not.toContain('"rule"');
    expect(line2, '缺省: 不应含 "field"').not.toContain('"field"');
    expect(line2, '缺省: 不应含 "detail"').not.toContain('"detail"');
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
