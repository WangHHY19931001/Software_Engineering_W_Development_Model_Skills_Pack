/**
 * 统一 --phase 参数解析（lib/parse-phase.ts）
 *
 * 13 个 cli/*.ts 脚本（含 cli/plan-chunks.ts）的 --phase 解析/校验统一由本模块实现（spec §3.2）。
 * 支持三种形态：
 *   - `--phase=N`（等号内联）
 *   - `--phase N`（空格分离）
 *   - 位置参数（opts.positional 指定下标；目前仅测试使用，plan-chunks 为 --phase= 形态不启用）
 *
 * 语义：
 *   - 严格整数校验：字符串须全为数字（/^\d+$/）+ Number.isInteger + [min, max] 范围，拒绝
 *     "5abc" / "3.7" / "-1" / 空串 这类 parseInt 会部分解析或误接受的输入。
 *   - 默认 min=1, max=8；未传 --phase（或传入值非法）返回 undefined，由调用方决定
 *     是静默降级（如按 manifest.currentPhase / 终检 8）还是报错退出。
 *   - 顺序语义：从 argv[0] 起按出现顺序取第一个 --phase 相关参数，合法即返回，非法即
 *     undefined（先到先得，不继续向后找）。
 *
 * 纯函数：无 I/O、无 process 访问，可安全用于 lib 层与单测。
 */

export interface PhaseParseResult {
  /** 解析出的阶段号（已通过 min/max 校验） */
  phase: number;
  /** 原始字符串（如 "5"），供调用方错误消息/日志使用 */
  raw: string;
}

export interface ParsePhaseOptions {
  min?: number;
  max?: number;
  /** 位置参数下标（未启用 --phase 时从该下标取阶段值） */
  positional?: number;
}

export function parsePhaseArg(argv: string[], opts?: ParsePhaseOptions): PhaseParseResult | undefined {
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 8;

  const check = (s: string | undefined): PhaseParseResult | undefined => {
    if (s === undefined || !/^\d+$/.test(s)) return undefined;
    const val = Number(s);
    if (!Number.isInteger(val) || val < min || val > max) return undefined;
    return { phase: val, raw: s };
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '--phase') {
      return check(argv[i + 1]);
    }
    if (arg.startsWith('--phase=')) {
      return check(arg.slice('--phase='.length));
    }
  }

  if (opts?.positional !== undefined) {
    return check(argv[opts.positional]);
  }

  return undefined;
}
