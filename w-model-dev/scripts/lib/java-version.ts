/**
 * Java 主版本解析（lib/java-version.ts）
 *
 * 审计修复 P15：此前 check-tla-model.ts（CLI 层）与 doctor-logic.ts 各有一份解析实现，
 * 统一抽到 lib 单点维护。
 */

/**
 * 由 `java -version` 的输出（stdout+stderr 拼接）解析 Java 主版本号。
 * 兼容 Java 8（"1.8.0_xxx" → 8）与 Java 11+（"11.0.x" → 11）。
 */
export function parseJavaMajor(versionOutput: string): number | null {
  const m = versionOutput.match(/version\s+"([0-9._]+)"/i);
  if (!m || m[1] === undefined) return null;
  const parts = m[1].split(/[._]/);
  const firstStr = parts[0];
  if (firstStr === undefined) return null;
  const first = Number.parseInt(firstStr, 10);
  if (Number.isNaN(first)) return null;
  if (first === 1 && parts.length > 1) {
    const secondStr = parts[1];
    if (secondStr === undefined) return null;
    const second = Number.parseInt(secondStr, 10);
    return Number.isNaN(second) ? null : second;
  }
  return first;
}
