/**
 * CLI 进程内调用层（Wave 2 试点起用）
 *
 * 前提：lib/run-main.ts 的 VITEST 守卫阻止 import 时自执行；CLI 均以
 * process.exitCode 赋值收尾（lib/cli-error.ts exitWithError 同款），不调
 * process.exit——本 helper 仅保存/恢复 exitCode 并捕获 console 输出
 * （log→stdout；error/warn→stderr 同池——Node 中 warn 与 error 均写 stderr，语义一致）。
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

/** 3 个 console 通道（log→stdout；error/warn→stderr）+ 2 个直写流通道的 spy 组合 */
interface CapturedStreams {
  out: string[];
  err: string[];
  spies: Array<{ mockRestore: () => void }>;
}

/** 直写流 chunk 统一转字符串（string 直取；Buffer/TypedArray 按 utf8 解码） */
function chunkToString(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString('utf8');
  return String(chunk);
}

/** 捕获 process.stdout/stderr.write（Wave 2 推广发现：check-coding-plan 等 CLI 的「○ 诊断」走 process.stderr.write 而非 console.error，试点期仅 mock console 会漏捕获） */
function captureProcessStreams(sink: CapturedStreams): void {
  const stdoutWrite = vi.spyOn(process.stdout, 'write');
  stdoutWrite.mockImplementation(((chunk: unknown) => {
    sink.out.push(chunkToString(chunk));
    return true;
  }) as typeof process.stdout.write);
  sink.spies.push(stdoutWrite);
  const stderrWrite = vi.spyOn(process.stderr, 'write');
  stderrWrite.mockImplementation(((chunk: unknown) => {
    sink.err.push(chunkToString(chunk));
    return true;
  }) as typeof process.stderr.write);
  sink.spies.push(stderrWrite);
}

export async function invokeCli(cliModule: string, argv: string[]): Promise<InvokeCliResult> {
  const prevExitCode = process.exitCode;
  const out: string[] = [];
  const err: string[] = [];
  const spies: Array<{ mockRestore: () => void }> = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    out.push(format(...a) + '\n');
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    err.push(format(...a) + '\n');
  });
  // warn 并入 err 池：Node 中 warn 与 error 同走 stderr（审查修复轮 1 发现 2）
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => {
    err.push(format(...a) + '\n');
  });
  spies.push(logSpy, errSpy, warnSpy);
  captureProcessStreams({ out, err, spies });
  let exitCode: number | undefined;
  try {
    process.exitCode = undefined;
    vi.resetModules();
    const mod = (await import(cliModule)) as { main(argv: string[]): Promise<void> };
    await mod.main(argv);
    exitCode = process.exitCode;
  } finally {
    for (const spy of spies) spy.mockRestore();
    // 恢复必须在 finally（审查修复轮 1 发现 1）：import/main 抛错时也恢复，
    // 否则泄漏值残留且后续调用把泄漏值当 prevExitCode 存回（连锁污染）。
    process.exitCode = prevExitCode;
  }
  return { exitCode, stdout: out.join(''), stderr: err.join('') };
}
