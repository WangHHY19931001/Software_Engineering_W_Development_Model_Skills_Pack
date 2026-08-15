/**
 * 安全 JSON 解析工具（原型污染防御）
 *
 * 背景：JSON.parse 将 `__proto__` 创建为对象自有属性（不污染原型），但对象后续
 * 经 Object.assign / spread 复制时会触发原型污染。对不受信输入统一丢弃 `__proto__` 键。
 *
 * 决策（spec §2.1）：仅丢弃 `__proto__`；`constructor`/`prototype` 在 JSON.parse
 * 语义下无污染风险，不做处理（避免破坏合法字段）。
 *
 * 仅 node 内置，无新依赖。接入点见 2026-08-05-opt-batch-1-security-hardening-design.md §3.4。
 */
export function safeJsonReviver(key: string, value: unknown): unknown {
  return key === '__proto__' ? undefined : value;
}

export function parseJsonSafe<T = unknown>(text: string): T {
  // 剥离首部 UTF-8 BOM（Windows PowerShell Out-File/Set-Content 默认带 BOM；
  // 不剥离时 JSON.parse 报 Unexpected token '\uFEFF'，JSONL 首行会被静默丢弃）
  const stripped = text.startsWith('\uFEFF') ? text.slice(1) : text;
  return JSON.parse(stripped, safeJsonReviver) as T;
}
