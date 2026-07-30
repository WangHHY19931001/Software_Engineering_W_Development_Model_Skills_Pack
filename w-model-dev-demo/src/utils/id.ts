/**
 * ID 生成器
 * 使用时间戳 + 随机数生成唯一 ID
 */

let counter = 0;

export function generateId(prefix: string = 'id'): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const c = counter.toString(36);
  return `${prefix}_${ts}${c}${rand}`;
}

export function resetIdCounter(): void {
  counter = 0;
}
