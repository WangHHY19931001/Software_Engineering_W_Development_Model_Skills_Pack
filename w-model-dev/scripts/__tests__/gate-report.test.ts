/**
 * lib/gate-report.ts 单元测试
 *
 * 覆盖：
 *   - 分隔线 '─'.repeat(60)
 *   - `${label}_JSON ` 行首标记（空格分隔，供 Agent 正则截取）
 *   - JSON 摘要含全部 summary 键 + exitCode 键（追加在末尾，与历史契约一致）
 *   - process.exit 收到正确 exit code
 *
 * process.exit 测试策略：spyOn + mockImplementation 抛错拦截，避免真实退出。
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { printGateReport } from '../lib/gate-report.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('printGateReport', () => {
  it('输出分隔线 + `${label}_JSON ` 前缀 + 摘要含 exitCode 键，并携带正确 exit code 调用 process.exit', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() =>
      printGateReport('MATURITY', { type: 'maturity', passed: true, violations: [] }, 0),
    ).toThrow('exit:0');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, '─'.repeat(60));
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      'MATURITY_JSON ' + JSON.stringify({ type: 'maturity', passed: true, violations: [], exitCode: 0 }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exitCode 键追加在 JSON 末尾（summary 展开之后），原 summary 键顺序不变', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = { type: 'run-log', passed: false, violations: ['v1'] };
    expect(() => printGateReport('RUN_LOG', summary, 1)).toThrow('exit:1');

    const jsonLine = logSpy.mock.calls[1]![0] as string;
    expect(jsonLine.startsWith('RUN_LOG_JSON ')).toBe(true);
    expect(jsonLine).toBe('RUN_LOG_JSON ' + JSON.stringify({ ...summary, exitCode: 1 }));
    expect(jsonLine.endsWith('"exitCode":1}')).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('非 0/1 exit code（如错误路径 2）原样透传', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => printGateReport('CONTRACT', { passed: false }, 2)).toThrow('exit:2');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'CONTRACT_JSON ' + JSON.stringify({ passed: false, exitCode: 2 }));
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('summary 自带 exitCode 键时被末位实参覆盖（值与位置以函数签名参数为准）', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => printGateReport('GATE', { passed: true, exitCode: 9 }, 0)).toThrow('exit:0');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'GATE_JSON ' + JSON.stringify({ passed: true, exitCode: 0 }));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
