/**
 * reviewedArtifacts 读盘复核（R19，A2 反伪造——批次 6 任务 4）
 *
 * logic 层（verifier-logic.ts validateReviewedArtifacts）保持纯函数、零 node:fs：
 * 评审对象的存在性 / SHA-256 / 行数三重复核由本模块（CLI 侧共享库）读盘完成后，
 * 以 `{ lineCountsByPath }` deps 注入 logic（行号越界校验），违规 reasons 由调用方并入最终报告。
 *
 * 消费方：
 *   - cli/check-verifier-output.ts（生产入口）
 *   - cli/self-test.ts runVerifierCases（样本口径与 CLI 接线单点一致，照 check-budget/check-maturity 先例）
 *
 * 哈希与行数口径（批次 7 任务 2，43.1.0）：读盘字节先做 CRLF→LF 归一化（normalizeEol）再
 * 计算 SHA-256 与行数——登记哈希是「归一化内容（CRLF→LF）的 SHA-256」，对 checkout 行尾
 * 配置（core.autocrlf 等）免疫；行尾差异不构成内容漂移（不触发 `R19 评审对象哈希不符`），
 * 真实内容变化仍被捕获。环境侧兜底为 .gitattributes 强制 LF 落盘（43.0.1），两者独立生效。
 *
 * 路径解析口径（与 fixtures 约定一致，跨平台稳定）：
 *   1. 先按 VerifierOutput 文件所在目录（baseDir）解析——schema 契约「相对本文件所在目录」；
 *   2. 未命中再按 process.cwd() 解析——兼容仓内样例以仓库根为基准的 evidence 路径
 *     （如 samples/verifier/persona-*.json 引用 w-model-dev/... 仓内真实文件）。
 *   两处都未命中 → 记「评审对象文件不存在」违规（fail-closed）。
 *
 * @module
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

export interface ReviewedArtifactsCheck {
  /** R19 CLI 侧违规（文件不存在 / 哈希不符 / 不可读），由调用方并入最终 reasons（汇入 exit 1） */
  readonly reasons: string[];
  /** path -> 文件行数（归一化内容按 utf8 拆 \n 计），注入 logic VerifierDeps 供行号越界校验 */
  readonly lineCountsByPath: Map<string, number>;
}

/** CRLF→LF 行尾归一化：登记哈希与行数统计的唯一消费口径（批次 7 任务 2） */
const normalizeEol = (bytes: Buffer): Buffer => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');

/**
 * 对 VerifierOutput 的 reviewedArtifacts 清单做读盘三重复核（存在 → 哈希 → 行数）。
 * 登记项结构问题（缺字段 / `..` / 反斜杠 / 坏 sha256 格式）由 logic 层 R19 报告，此处跳过不重复报。
 * 纯读盘，无副作用、不写盘。
 */
export function verifyReviewedArtifacts(reviewed: unknown, baseDir: string): ReviewedArtifactsCheck {
  const reasons: string[] = [];
  const lineCountsByPath = new Map<string, number>();
  if (!Array.isArray(reviewed)) return { reasons, lineCountsByPath };

  for (const entry of reviewed) {
    const record = entry as Record<string, unknown> | null;
    const artifactPath = record && typeof record.path === 'string' ? record.path : '';
    // 结构非法（含 `..` / 反斜杠 / 空）不触盘：logic 层 R19 已报 VERIFIER-SCHEMA，避免重复归因
    if (artifactPath === '' || artifactPath.includes('..') || artifactPath.includes('\\')) continue;
    const resolved = resolveArtifactPath(artifactPath, baseDir);
    if (resolved === null) {
      reasons.push(`R19 评审对象文件不存在：${artifactPath}`);
      continue;
    }
    let bytes: Buffer;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 路径来自 VerifierOutput 登记项，仅只读；resolveArtifactPath 已拒绝 .. 穿越形态
      bytes = readFileSync(resolved);
    } catch {
      reasons.push(`R19 评审对象不可读：${artifactPath}`);
      continue;
    }
    const declared = record && typeof record.sha256 === 'string' ? record.sha256 : '';
    // 哈希与行数统计均消费 normalizeEol 结果（行尾差异不构成内容漂移，见模块注释口径节）
    const normalized = normalizeEol(bytes);
    const digest = createHash('sha256').update(normalized).digest('hex');
    if (declared !== '' && digest !== declared) {
      reasons.push(
        `R19 评审对象哈希不符：${artifactPath}（声明 ${declared.slice(0, 12)}… 实测 ${digest.slice(0, 12)}…）`,
      );
    }
    lineCountsByPath.set(artifactPath, normalized.toString('utf8').split('\n').length);
  }
  return { reasons, lineCountsByPath };
}

/** baseDir 优先、cwd 回退的候选解析；命中且为普通文件才返回绝对路径，否则 null */
function resolveArtifactPath(artifactPath: string, baseDir: string): string | null {
  const candidates = [path.resolve(baseDir, artifactPath), path.resolve(process.cwd(), artifactPath)];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- candidate 由登记项 path resolve 而来（已拒绝 ..），仅 stat 只读
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
      /* stat 失败按未命中继续 */
    }
  }
  return null;
}
