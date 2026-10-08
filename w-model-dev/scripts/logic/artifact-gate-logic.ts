/**
 * 工件质量门门禁输入读取（D6：CLI gate-log 读取下沉 logic，43.3.0）
 *
 * 纯函数：文件读取经注入 fs 适配器（`readFile` 依赖注入，与 gate-logic.ts 的
 * checkTemplatesStructure 注入形态同款），本模块**不直接 import node:* 模块**——
 * 真实适配器由 CLI 传入（`node:fs/promises.readFile` 的薄封装），CLI 只传路径 + 适配器。
 *
 * 语义与 check-artifact-gate.ts 历史实现逐字等价（只搬不移，行为保持）：
 *   - `readMaturityFile`：文件缺失 / JSON 解析失败 / level 非法 → undefined（**不豁免**，
 *     暴露为 catch 收敛；豁免必须有显式声明）；
 *   - `loadSignatureChainFile`：文件不存在 → []；逐行 JSON 解析失败 / 非对象行跳过
 *     （无法通过 verifyMaturityApproval 的 v3 重算，天然不构成合法审批）；
 *     整文件读取失败 → []。三形态（无链 / 坏链 / 缺文件）最终都收敛为「不豁免」
 *     （fail-closed），与 check-maturity 同口径。
 */

import type { MaturityApprovalInput, SignatureChainEntry } from './signature-chain-logic.js';

/** 注入的异步 fs 适配器（真实形态 = `node:fs/promises.readFile(filePath, 'utf-8')`；读取失败 reject）。 */
export interface ArtifactGateReadFs {
  readFile(filePath: string): Promise<string>;
}

/**
 * 读取 `.w-model/maturity.json` 的 level + history（成熟度分级，operational-recovery.md；
 * A4 豁免判定输入）。文件缺失 / 解析失败 / level 非法 → undefined（**不豁免**，保持严格）。
 *
 * @param fs           注入的异步 fs 适配器
 * @param maturityFile `.w-model/maturity.json` 的绝对路径（由 CLI 解析）
 */
export async function readMaturityFile(
  fs: ArtifactGateReadFs,
  maturityFile: string,
): Promise<MaturityApprovalInput | undefined> {
  try {
    const raw = await fs.readFile(maturityFile);
    const parsed = JSON.parse(raw) as { level?: unknown; history?: unknown };
    if (typeof parsed.level !== 'string') return undefined;
    const history: MaturityApprovalInput['history'] = Array.isArray(parsed.history)
      ? parsed.history
          .filter((h): h is { to?: unknown; at?: unknown } => h !== null && typeof h === 'object')
          .map((h) => ({
            to: typeof h.to === 'string' ? h.to : '',
            at: typeof h.at === 'string' ? h.at : undefined,
          }))
      : [];
    return { level: parsed.level, history };
  } catch {
    return undefined;
  }
}

/**
 * 装载 `.w-model/signature-chain.jsonl`（A4 成熟度豁免审批链；容错读取）：
 * 文件不存在 → 空数组；逐行 JSON 解析失败的坏行跳过（坏行无法通过 v3 重算，天然不构成合法审批）；
 * 合法 JSON 但非对象的整行（`null` / 数组 / 标量）同样跳过——放行会推进到 `[UNEXPECTED]` exit 2
 * （批次 7 任务 11 修复轮 1 审查实跑复现，与 check-maturity 同口径）；
 * 整文件读取失败 → 空数组。三形态（无链 / 坏链 / 缺文件）最终都收敛为「不豁免」（fail-closed）。
 *
 * @param fs        注入的异步 fs 适配器
 * @param chainFile `.w-model/signature-chain.jsonl` 的绝对路径（由 CLI 解析）
 */
export async function loadSignatureChainFile(
  fs: ArtifactGateReadFs,
  chainFile: string,
): Promise<SignatureChainEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(chainFile);
  } catch {
    return [];
  }
  const entries: SignatureChainEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      // 非对象行（null / 数组 / 标量）跳过：无法通过 verifyMaturityApproval 的字段判定
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      entries.push(parsed as SignatureChainEntry);
    } catch {
      /* 坏行不构成审批（fail-closed）：JSON 不完整即无法通过 verifyMaturityApproval 的 v3 重算 */
    }
  }
  return entries;
}
