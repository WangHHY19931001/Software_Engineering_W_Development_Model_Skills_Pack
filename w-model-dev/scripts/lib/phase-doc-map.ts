/**
 * 阶段文档路径映射（lib/phase-doc-map.ts）
 *
 * directory-conventions.md §7 SSoT 的代码侧单点事实源。
 * 禁止在门禁脚本中硬编码 docs/uat-path-mapping.md 等路径，统一走 resolvePhaseDoc。
 */

/**
 * phase → 文档类型 → 相对项目根路径 映射表。
 * 键为阶段号 1-8（缺 5：阶段 5 无独立文档目录），值为该阶段各类文档的相对路径。
 */
export const PHASE_DOC_MAP: Record<number, Record<string, string>> = {
  1: {
    'requirement-spec': 'docs/phase1-requirements/requirement-spec.md',
    'acceptance-test-design': 'docs/phase1-requirements/acceptance-test-design.md',
    'uat-path-mapping': 'docs/uat-path-mapping.md',
  },
  2: {
    'system-design': 'docs/phase2-design/{module}-system-design.md',
    'system-test': 'docs/phase2-design/{module}-system-test.md',
  },
  3: {
    'interface-design': 'docs/phase3-outline/{module}-interface-design.md',
    'integration-test': 'docs/phase3-outline/{module}-integration-test.md',
  },
  4: {
    'detailed-design': 'docs/phase4-detailed/{module}-detailed-design.md',
    'unit-test': 'docs/phase4-detailed/{module}-unit-test.md',
  },
  6: { 'integration-test-phase6': 'docs/phase6-integration-test/integration-test.md' },
  7: { 'system-test-phase7': 'docs/phase7-system-test/system-test.md' },
  8: { 'acceptance-test-phase8': 'docs/phase8-acceptance-test/acceptance-test.md' },
};

/**
 * 阶段文档路径解析（directory-conventions.md §7 SSoT）。
 *
 * @param phase 阶段号 1-8
 * @param type  文档类型：'requirement-spec' | 'acceptance-test-design' | 'uat-path-mapping'
 *              | 'system-design' | 'system-test' | 'interface-design' | 'integration-test'
 *              | 'detailed-design' | 'unit-test' | 'integration-test-phase6'
 *              | 'system-test-phase7' | 'acceptance-test-phase8'
 * @returns 相对项目根的路径（如 'docs/phase1-requirements/requirement-spec.md'）
 * @throws 未支持的 phase / type 时抛错（消息含 directory-conventions.md §1 引用）
 */
export function resolvePhaseDoc(phase: number, type: string): string {
  const phaseMap = PHASE_DOC_MAP[phase];
  if (!phaseMap) {
    throw new Error(`resolvePhaseDoc: 未支持的 phase=${phase}（directory-conventions.md §1）`);
  }
  const docPath = phaseMap[type];
  if (!docPath) {
    throw new Error(`resolvePhaseDoc: phase=${phase} 无 type="${type}" 映射（directory-conventions.md §1）`);
  }
  return docPath;
}
