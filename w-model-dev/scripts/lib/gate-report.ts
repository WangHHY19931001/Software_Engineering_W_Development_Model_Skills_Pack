/**
 * 门禁脚本统一收尾报告（Gate Report）
 *
 * 收敛 check-*.ts 的「分隔线 + XXX_JSON 摘要 + exit」样板（批次 3 §3.1）。
 * 输出格式与历史一致：
 *   - 第一行：'─'.repeat(60) 分隔线
 *   - 第二行：`<LABEL>_JSON <json>`（空格分隔，供 Agent 正则截取）
 *   - exitCode 键追加在 JSON 末尾（`{ ...summary, exitCode }`，值来自参数）
 *   - 末尾 process.exit(exitCode)
 *
 * 仅用于 check-*.ts CLI 层；*-logic.ts 纯逻辑层不依赖本工具。
 * 调用方须保证 summary 除 exitCode 外的键与顺序与替换前一致。
 */

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
