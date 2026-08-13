/**
 * 归档完整性校验纯逻辑层（Archive Integrity Logic）
 *
 * 归档完整性强制快照清单（单点定义于本文件）。
 * 供 check-archive-integrity.ts（CLI）调用，校验归档目录是否包含各阶段强制快照文件。
 *
 * 单点事实源，不依赖任何 LLM。
 */

// ==================== 归档完整性清单 ====================

export const ARCHIVE_INTEGRITY_CHECKLIST: Record<string, string[]> = {
  '1': [
    'requirements.md',
    'risk-assessment.md',
    'uat-path-mapping.md',
    'coverage.json',
    'graph.json',
    'tla-manifest.json',
    'bdd-manifest.json',
  ],
  '2': ['system-design.md', 'system-test-design.md', 'graph.json', 'tla-manifest.json', 'bdd-manifest.json'],
  '3': ['outline-design.md', 'integration-test-design.md', 'graph.json', 'tla-manifest.json', 'bdd-manifest.json'],
  '4': ['detailed-design.md', 'unit-test-design.md', 'graph.json', 'tla-manifest.json', 'bdd-manifest.json'],
  '5': ['src/', 'unit-test-report.json', 'rtm.json', 'run-log.jsonl', 'checkpoint-log.jsonl', 'signature-chain.jsonl'],
  '6': ['integration-test-report.json', 'rtm.json', 'run-log.jsonl', 'checkpoint-log.jsonl', 'signature-chain.jsonl'],
  '7': ['system-test-report.json', 'rtm.json', 'run-log.jsonl', 'checkpoint-log.jsonl', 'signature-chain.jsonl'],
  '8': ['acceptance-test-report.json', 'rtm.json', 'run-log.jsonl', 'checkpoint-log.jsonl', 'signature-chain.jsonl'],
  global: ['signature-chain.jsonl', 'verifier-output-', 'gate-logs/'],
};

// ==================== 类型定义 ====================

export interface ArchiveIntegrityCheckResult {
  passed: boolean;
  missingFiles: string[];
  presentFiles: string[];
  checkedPhases: string[];
}

// ==================== 主校验函数 ====================

/**
 * 校验归档目录是否包含各阶段强制快照文件。
 *
 * @param archiveDirContents 归档目录下所有文件/子目录的相对路径集合
 * @param phasesToCheck 须校验的阶段列表（默认 1-8 + global）
 */
export function checkArchiveIntegrity(
  archiveDirContents: Set<string>,
  phasesToCheck: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', 'global'],
): ArchiveIntegrityCheckResult {
  const missingFiles: string[] = [];
  const presentFiles: string[] = [];
  const checkedPhases: string[] = [];

  for (const phase of phasesToCheck) {
    checkedPhases.push(phase);
    const checklist = ARCHIVE_INTEGRITY_CHECKLIST[phase] ?? [];
    for (const requiredFile of checklist) {
      // 处理目录（以 / 结尾）和前缀匹配（如 verifier-output-）
      if (requiredFile.endsWith('/')) {
        // 目录：检查是否有任何路径以此前缀开头
        const prefix = requiredFile.slice(0, -1);
        const found = Array.from(archiveDirContents).some((p) => p.startsWith(prefix + '/') || p === prefix);
        if (!found) {
          missingFiles.push(`[phase=${phase}] ${requiredFile}（目录缺失）`);
        } else {
          presentFiles.push(`[phase=${phase}] ${requiredFile}`);
        }
      } else if (requiredFile.endsWith('-')) {
        // 前缀匹配（如 verifier-output-），按归档根下 basename 精确前缀匹配
        const found = Array.from(archiveDirContents).some((p) => {
          const base = p.split('/').pop() ?? '';
          return base.startsWith(requiredFile);
        });
        if (!found) {
          missingFiles.push(`[phase=${phase}] ${requiredFile}*（前缀匹配失败）`);
        } else {
          presentFiles.push(`[phase=${phase}] ${requiredFile}*`);
        }
      } else {
        // 精确匹配
        if (!archiveDirContents.has(requiredFile)) {
          missingFiles.push(`[phase=${phase}] ${requiredFile}`);
        } else {
          presentFiles.push(`[phase=${phase}] ${requiredFile}`);
        }
      }
    }
  }

  return {
    passed: missingFiles.length === 0,
    missingFiles,
    presentFiles,
    checkedPhases,
  };
}
