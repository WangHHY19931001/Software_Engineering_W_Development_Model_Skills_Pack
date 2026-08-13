/**
 * 门禁脚本统一收尾报告（Gate Report）
 *
 * check-*.ts 的「分隔线 + XXX_JSON 摘要 + exit」样板（§3.1）。
 * 输出格式：
 *   - 第一行：'─'.repeat(60) 分隔线
 *   - 第二行：`<LABEL>_JSON <json>`（空格分隔，供 Agent 正则截取）
 *   - exitCode 键追加在 JSON 末尾（`{ ...summary, exitCode }`，值来自参数）
 *   - 末尾 process.exit(exitCode)
 *
 * 仅用于 check-*.ts CLI 层；*-logic.ts 纯逻辑层不依赖本工具。
 * 调用方须保证 summary 除 exitCode 外的键与顺序与替换前一致。
 */

import type { JsonReport } from './types.js';

/**
 * 打印门禁收尾报告并退出。
 * @param label     JSON 摘要行首标记（如 'MATURITY' → `MATURITY_JSON ...`）
 * @param summary   摘要字段（不含 exitCode；exitCode 由本函数追加到末尾）
 * @param exitCode  进程退出码（0/1/2）
 * @returns never（内部 process.exit）
 */
export function printGateReport(label: string, summary: Record<string, unknown>, exitCode: number): never {
  console.log('─'.repeat(60));
  console.log(`${label}_JSON ` + JSON.stringify({ ...summary, exitCode }));
  process.exit(exitCode);
}

/**
 * 输出机器可读 JSON 报告（check-*.ts --json 选项用）。
 * 与 printGateReport 的区别：
 *   - 不打印分隔线，stdout 仅输出单行 JSON（可整体 JSON.parse）
 *   - 不调用 process.exit，进程退出码由调用方处理（设置 process.exitCode 后 return）
 * @param report   JsonReport（type/passed/reasons/violations 分布/durationMs）
 * @param exitCode 追加到 JSON 末尾的退出码字段（0=通过 / 1=校验失败 / 2=输入错误）
 */
export function printJsonReport(report: JsonReport, exitCode: number): void {
  console.log(JSON.stringify({ ...report, exitCode }));
}

/**
 * 聚合违规类型分布（--json 的 violations 字段）：
 * 优先按 structuredViolations 的 rule 聚合（A2b 双轨过渡的结构化形态）；
 * 无结构化违规时降级固定 'violation' 规则（count = violations.length）。
 * @param violationsCount      违规总数（降级分支的 count）
 * @param structuredViolations 可选的结构化违规数组（按 rule 聚合优先）
 */
export function buildViolationDistribution(
  violationsCount: number,
  // 放宽为兼容 StructuredViolation 的形状（rule/field/message 全可选），
  // 使调用方可直接透传 structuredViolations 或带 message/field 的对象字面量
  structuredViolations?: ReadonlyArray<{ rule: string; message?: string; field?: string }>,
): { rule: string; count: number }[] {
  if (structuredViolations !== undefined && structuredViolations.length > 0) {
    const counts = new Map<string, number>();
    for (const v of structuredViolations) {
      counts.set(v.rule, (counts.get(v.rule) ?? 0) + 1);
    }
    return [...counts.entries()].map(([rule, count]) => ({ rule, count }));
  }
  return violationsCount > 0 ? [{ rule: 'violation', count: violationsCount }] : [];
}
