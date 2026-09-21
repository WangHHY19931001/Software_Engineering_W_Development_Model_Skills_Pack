/**
 * 受控 CLI 探针（lib/cli-probe.ts）
 *
 * 单一派发实现：`cli/ensure-codegraph.ts`（阶段 5-8 依赖引导）与 `cli/doctor.ts`（环境自检）
 * 共用同一函数，避免同一依赖在两个消费者处结论相反。
 *
 * 2026-09-21 修复轮 1（评审裁定 2）：此前 doctor 用 `promisify(execFile)` 直投，Windows 下
 * npm 全局安装的 CLI 是 `.cmd` shim——无 shell 直投解析失败（ENOENT/EINVAL，CVE-2024-27980
 * 收紧后的行为），于是 `doctor --json` 报 `codegraph: warn 未安装或不在 PATH`，而同一台机器上
 * `ensure-codegraph.ts --mode light` 报 `codegraph CLI: ready`。两消费者对「同一依赖是否可用」
 * 给出相反结论，根因是派发实现分叉，故此处收敛为单点。
 *
 * 派发规则：win32 经 `cmd.exe /d /s /c`（借 PATHEXT 解析 `.cmd`/`.bat` shim），POSIX 直 spawn；
 * 实参一律为调用方受控字面量（无用户输入、无注入面）。底层用 `lib/run-sync.ts` 的 `runSync`
 * （spawnSync 薄封装）——**stdout 与 stderr 在成功与失败两条路径上都要拿得到**：`execFileSync`
 * 在退出码 0 时只回 stdout，而 `java -version` 这类工具把版本写在 stderr，用它会把「可用」判成
 * 「不可用」（本文件初版即踩此坑，doctor 的 java 项由可解析退化为「主版本 未知」）。
 *
 * @module
 */

import { runSync } from './run-sync.js';

/** 派发选项：timeoutMs 必填（调用方须给出有限上界；runSync 另有 15s 兜底默认） */
export interface CliProbeOptions {
  /** 子进程工作目录（探针默认继承当前进程 cwd） */
  cwd?: string;
  /** 超时毫秒；到期由 runSync 以 SIGKILL 终止 */
  timeoutMs: number;
}

/** 探针结果：ok=退出码 0；status=退出码（未能启动/超时被 SIGKILL 时为 null） */
export interface CliProbeResult {
  /** 子进程以退出码 0 结束（未启动、超时、非 0 一律 false） */
  ok: boolean;
  /** 退出码；未能启动（ENOENT 等）或超时被 SIGKILL 时为 null */
  status: number | null;
  /** 已解码 stdout（成功与失败路径都尽力给出） */
  stdout: string;
  /** 已解码 stderr；为空且未能启动时退化为 spawn 错误文本（供调用方记日志） */
  stderr: string;
}

/**
 * 执行受控 CLI 并归一化结果（不抛异常）。
 * 「探测即答案」的消费者（doctor 逐项环境检查、ensure 依赖处置）用它，避免在每个调用点重复
 * try/catch 与双流解码；调用方据 `ok` 决定记 ⚠ 还是转 checkpoint。
 */
export function probeCliCommand(file: string, args: string[], opts: CliProbeOptions): CliProbeResult {
  const result =
    process.platform === 'win32'
      ? runSync('cmd.exe', ['/d', '/s', '/c', file, ...args], { cwd: opts.cwd, timeout: opts.timeoutMs })
      : runSync(file, args, { cwd: opts.cwd, timeout: opts.timeoutMs });

  const status = typeof result.status === 'number' ? result.status : null;
  const stderr = result.stderr ?? '';
  const spawnError = result.error === undefined ? '' : String(result.error.message ?? result.error);
  return {
    ok: status === 0,
    status,
    stdout: result.stdout ?? '',
    stderr: stderr !== '' ? stderr : spawnError,
  };
}
