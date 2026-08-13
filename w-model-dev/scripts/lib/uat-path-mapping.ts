/**
 * uat-path-mapping.md 解析与校验（UAT Path Mapping）
 *
 * 自 check-artifact-gate.ts 拆分的 uat-path-mapping 相关逻辑（Task A1）：
 * - parseUatPathMappingFromContent：严格解析（B4，round28 G-B）
 * - checkUatPathMappingContent：综合校验（B4 严格解析 + B5 回填校验）
 * - collectUatMappingViolations：阶段 1 存在性 + 阶段 5/终检回填的文件级汇总
 *
 * 供 check-artifact-gate CLI 阶段 5 / 终检与 self-test 共用。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { checkUatPathMappingBackfill, type PhaseOption, type UatPathMappingRow } from '../logic/gate-logic.js';
import { parseUatPathMappingContent } from '../logic/design-contract-logic.js';
import { resolvePhaseDoc } from '../lib/phase-doc-map.js';

/**
 * 从 uat-path-mapping.md 内容解析映射行（round28 G-B B4：严格解析）。
 * 格式：| UAT-001 | POST /api/posts | POST /api/posts | 直接 | ... |
 *
 * 严格化规则：
 * - 表头校验：数据行首列必须为 `UAT-` 前缀（`UAT-\d+`）；表头行 / 分隔行 / 其它表格行一律忽略。
 * - 数据行格式不符（单元格数 < 4 或前 4 列含空单元格）→ 记录 violation，不静默跳行。
 * - 文件非空但解析不出任何映射行 → violation「uat-path-mapping 无有效映射行」。
 *
 * 实现收敛（批次3 Task7）：统一复用 design-contract-logic.parseUatPathMappingContent（strict=true），
 * 字段映射到 uatId/actualPath/mappingType；violation 文案与行号格式与历史严格版逐字节一致。
 */
export interface UatPathMappingParseResult {
  rows: UatPathMappingRow[];
  violations: string[];
}

export function parseUatPathMappingFromContent(content: string): UatPathMappingParseResult {
  const parsed = parseUatPathMappingContent(content, { strict: true });
  const rows: UatPathMappingRow[] = parsed.rows.map((row) => ({
    uatId: row.uatId,
    actualPath: row.cells[2] ?? '',
    mappingType: row.cells[3] ?? '',
  }));
  return { rows, violations: parsed.violations };
}

/**
 * uat-path-mapping 内容综合校验（B4 严格解析 + 回填校验）。
 * 供 check-artifact-gate CLI 阶段 5 / 终检与 self-test 共用。
 */
export function checkUatPathMappingContent(content: string): string[] {
  const { rows, violations } = parseUatPathMappingFromContent(content);
  return [...violations, ...checkUatPathMappingBackfill(rows)];
}

/**
 * 汇总 uat-path-mapping 校验违反（计入终检结果，B4/B5：解析严格化 + 阶段5/终检均校验）：
 * - phase=1：校验 docs/uat-path-mapping.md 存在性（P0-1）；
 * - phase=5 / 终检（B5：无 --phase 终检默认 phase 8 也校验）：读取并回填校验。
 */
export async function collectUatMappingViolations(
  projectDir: string,
  phaseOption: PhaseOption | undefined,
): Promise<string[]> {
  const uatMappingViolations: string[] = [];

  const uatMappingRel = resolvePhaseDoc(1, 'uat-path-mapping');
  // P0-1: phase=1 校验 uat-path-mapping 存在性
  if (phaseOption === 1) {
    const uatMappingPath = path.resolve(projectDir, uatMappingRel);
    try {
      await fs.access(uatMappingPath);
    } catch {
      uatMappingViolations.push(
        'P0-1 校验失败：docs/uat-path-mapping.md 不存在，阶段1须产出该文件（见 phase-1-requirements.md §输出）',
      );
    }
  }

  // P0-1: phase=5 / 终检（B5：无 --phase 终检默认 phase 8 也校验）校验 uat-path-mapping 回填
  if (phaseOption === 5 || phaseOption === undefined) {
    const uatMappingPath = path.resolve(projectDir, uatMappingRel);
    try {
      const content = await fs.readFile(uatMappingPath, 'utf-8');
      uatMappingViolations.push(...checkUatPathMappingContent(content));
    } catch {
      uatMappingViolations.push('P0-1 校验失败：docs/uat-path-mapping.md 不存在或无法读取');
    }
  }

  return uatMappingViolations;
}
