/**
 * 归档完整性校验纯逻辑层（Archive Integrity Logic）
 *
 * 归档完整性强制快照清单（单点定义于本文件）。
 * 供 check-archive-integrity.ts（CLI）调用，校验归档目录是否包含各阶段强制快照文件。
 *
 * 自 check-openspec-archive 退役起（superpowers 替换批次 1），本层通过可选 manifest 条件项
 * `codingPlanSnapshot` 并入「编码计划归档快照」校验：`Task N: complete` 判定与 check-coding-plan
 * 同源（共享纯函数 `extractCompletedTaskNumbers`，import 自 `coding-plan-logic.ts`）；归档快照校验
 * 为其结构子集（仅查 plan / progress.md / 三件套存在），全量契约（review-*.diff 存在性与非空、
 * 账本首行身份）由 check-coding-plan R4/R6 承担。
 *
 * 单点事实源，不依赖任何 LLM。
 */

import { extractCompletedTaskNumbers } from './coding-plan-logic.js';

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

/**
 * 归档清单 manifest 条件项（全部可选；既有数组形态 fixture = 全缺省 = 零行为变化）。
 *
 * - `codingPlanSnapshot`：编码计划归档快照要求开关（缺省 false，不追加任何校验项）。
 * - `changeId`：变更标识；codingPlanSnapshot=true 时用于定位归档根 `<changeId>.plan.md`；
 *   缺省时由归档根恰一 `*.plan.md` 推导（多匹配 → fail-closed，平移 check-coding-plan R6 恰一语义）。
 * - `progressMdContent`：归档账本 `progress.md` 文本；codingPlanSnapshot=true 时供
 *   `Task N: complete` 提取与三件套核对（CLI 从归档目录实读；清单声明了 progress.md 却未提供
 *   内容 → fail-closed，不得静默跳过三件套核对）。
 */
export interface ArchiveIntegrityManifest {
  codingPlanSnapshot?: boolean;
  changeId?: string;
  progressMdContent?: string;
}

export interface ArchiveIntegrityCheckResult {
  passed: boolean;
  missingFiles: string[];
  presentFiles: string[];
  checkedPhases: string[];
}

/**
 * 归档前缀性注入选项（L4，D-3b；缺省 = 未启用，零行为变化）。
 *
 * 归档内 `run-log.jsonl` 快照必须是 **live** run-log 的**记录边界前缀**（非空、以换行结尾；判据见下方 `checkRunLogPrefix`）：
 * live 侧在归档后被截断/重排/改写，或归档快照被改写（两者不可同真）即刻不成立 → blocking。
 * 两侧文本由 CLI 层实读注入（logic 层零 `node:fs`，同 `progressMdContent` 先例）。
 *
 * 语义分派（fail-closed 方向）：
 *   - `liveRunLogText` 未提供 → 本项不适用（未启用，零行为变化）；
 *   - 提供 live 但 `archivedRunLogText` 未提供 → 归档侧快照不可读，**无法证明前缀性** →
 *     `[runLogPrefix]` fail-closed（调用方已显式要求校验，不得静默放过）。
 */
export interface ArchiveRunLogPrefixOptions {
  /** live run-log 文本（`--live-run-log=<path>` 实读） */
  liveRunLogText?: string;
  /** 归档快照 `run-log.jsonl` 文本（CLI 从归档根实读；缺失/不可读时不设） */
  archivedRunLogText?: string;
}

// ==================== 主校验函数 ====================

/** 归档根级 `*.plan.md` 快照（不含子目录）；localeCompare 排序保证违规条目顺序稳定 */
function rootPlanSnapshots(archiveDirContents: Set<string>): string[] {
  return Array.from(archiveDirContents)
    .filter((p) => !p.includes('/') && p.endsWith('.plan.md'))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 从归档目录内容集推导清单 manifest（CLI 自动派生入口，纯函数）。
 *
 * 归档根含**恰一** `*.plan.md` → 编码计划归档快照要求自动启用并推导 changeId；
 * 零匹配 → codingPlanSnapshot=false（legacy 归档零行为变化）；
 * 多匹配 → codingPlanSnapshot=true 且不猜 changeId（由 checkArchiveIntegrity 的多匹配
 * fail-closed 违规兜底，不静默任取其一）。
 */
export function deriveArchiveIntegrityManifest(archiveDirContents: Set<string>): ArchiveIntegrityManifest {
  const planSnapshots = rootPlanSnapshots(archiveDirContents);
  if (planSnapshots.length === 1) {
    const planFile = planSnapshots[0]!;
    return { codingPlanSnapshot: true, changeId: planFile.slice(0, -'.plan.md'.length) };
  }
  if (planSnapshots.length > 1) return { codingPlanSnapshot: true };
  return { codingPlanSnapshot: false };
}

/**
 * codingPlanSnapshot 清单项（并入自 check-openspec-archive 退役）：
 * 编码计划归档快照要求 = 归档根存在 `<changeId>.plan.md` + `progress.md`，且归档账本内每个
 * `Task N: complete` 行存在对应 `task-<N>-brief.md` / `task-<N>-report.md`
 * （`Task N: complete` 判定与 check-coding-plan 同源（共享纯函数）；归档快照校验为其结构子集——
 * 仅查存在性，全量契约由 check-coding-plan R4/R6 承担）。
 * 违规以 `[codingPlanSnapshot]` 前缀并入 missingFiles，fail-closed。
 */
function checkCodingPlanSnapshot(
  archiveDirContents: Set<string>,
  manifest: ArchiveIntegrityManifest,
  missingFiles: string[],
  presentFiles: string[],
): void {
  const planSnapshots = rootPlanSnapshots(archiveDirContents);
  let changeId = manifest.changeId;
  if (changeId === undefined || changeId === '') {
    if (planSnapshots.length === 1) {
      changeId = planSnapshots[0]!.slice(0, -'.plan.md'.length);
    } else if (planSnapshots.length === 0) {
      missingFiles.push('[codingPlanSnapshot] *.plan.md（归档计划快照缺失：归档根须含 <changeId>.plan.md）');
    } else {
      missingFiles.push(`[codingPlanSnapshot] 归档根 *.plan.md 多匹配（${planSnapshots.join(', ')}）——fail-closed`);
    }
  }
  if (changeId !== undefined && changeId !== '') {
    const planFile = `${changeId}.plan.md`;
    if (archiveDirContents.has(planFile)) {
      presentFiles.push(`[codingPlanSnapshot] ${planFile}`);
    } else {
      missingFiles.push(`[codingPlanSnapshot] ${planFile}（归档计划快照缺失）`);
    }
  }

  if (!archiveDirContents.has('progress.md')) {
    missingFiles.push('[codingPlanSnapshot] progress.md（归档账本快照缺失）');
  } else {
    presentFiles.push('[codingPlanSnapshot] progress.md');
    if (typeof manifest.progressMdContent === 'string') {
      const completed = Array.from(extractCompletedTaskNumbers(manifest.progressMdContent)).sort((a, b) => a - b);
      for (const n of completed) {
        for (const kind of ['brief', 'report'] as const) {
          const artifact = `task-${n}-${kind}.md`;
          if (archiveDirContents.has(artifact)) {
            presentFiles.push(`[codingPlanSnapshot] ${artifact}`);
          } else {
            missingFiles.push(`[codingPlanSnapshot] ${artifact}（Task ${n}: complete 的三件套缺失）`);
          }
        }
      }
    } else {
      missingFiles.push(
        '[codingPlanSnapshot] progress.md 内容未提供（codingPlanSnapshot=true 时调用方须提供归档账本文本以提取 Task N: complete）',
      );
    }
  }
}

/**
 * 归档 run-log 前缀性校验（L4，D-3b）：归档快照必须是 live run-log 的**记录边界前缀**。
 *
 * 通过判据（A1 收紧，审查裁定）：
 *   `archivedText === liveText`（无新增记录），
 *   或（`liveText.startsWith(archivedText)` 且 `archivedText.length > 0` 且 `archivedText.endsWith('\n')`）。
 *
 * 为什么必须收紧：只做逐字 `startsWith` 时「快照在第 N 行**中途被截断**」（末尾无换行）与「0 字节空快照」
 * 都会判通过——前者让「归档被截断」这一真实突变静默通过，后者让 L4 在归档快照缺失内容时形同虚设
 * （`ARCHIVE_INTEGRITY_CHECKLIST` 只查存在性，没有其它判据会拦）。
 *
 * 违规以 `[runLogPrefix]` 前缀并入 `missingFiles`（blocking），且**分类具名**三种形态：
 * 非前缀 / 非记录边界（中途截断）/ 空快照；未提供 live 文本时不产生任何条目（非阻断，退出码语义不变）。
 */
function checkRunLogPrefix(options: ArchiveRunLogPrefixOptions, missingFiles: string[], presentFiles: string[]): void {
  const liveText = options.liveRunLogText;
  if (liveText === undefined) return; // 未启用：零行为变化
  const archivedText = options.archivedRunLogText;
  if (archivedText === undefined) {
    missingFiles.push(
      '[runLogPrefix] 归档 run-log.jsonl 快照不可读（提供 --live-run-log 时前缀性校验 fail-closed：无法证明归档快照是 live 的记录边界前缀）',
    );
    return;
  }
  const isPrefix = liveText.startsWith(archivedText);
  const isIdentical = archivedText === liveText;
  const endsAtRecordBoundary = archivedText.length > 0 && archivedText.endsWith('\n');
  if (isPrefix && (isIdentical || endsAtRecordBoundary)) {
    presentFiles.push(
      `[runLogPrefix] 归档 run-log.jsonl 是 live 的记录边界前缀（归档 ${archivedText.length} 字节 / live ${liveText.length} 字节${
        isIdentical ? '，两者一致（归档后无新增记录）' : ''
      }）`,
    );
    return;
  }
  if (!isPrefix) {
    missingFiles.push(
      `[runLogPrefix] 归档 run-log.jsonl 不是 live run-log 的记录边界前缀（归档 ${archivedText.length} 字节 vs live ${liveText.length} 字节）：` +
        '两侧在前缀处不一致（live 侧被截断/重排/改写，或归档快照被改写——两者不可同真，须人工裁定证据归属）',
    );
    return;
  }
  if (archivedText.length === 0) {
    missingFiles.push(
      `[runLogPrefix] 归档 run-log.jsonl 快照为空（0 字节）而 live 有 ${liveText.length} 字节：空快照无法证明前缀性，不得据此放行（缺内容请补归档快照后重跑）`,
    );
    return;
  }
  missingFiles.push(
    `[runLogPrefix] 归档 run-log.jsonl 落在记录中途（非记录边界）：快照 ${archivedText.length} 字节未以换行结尾，而 live 为 ${liveText.length} 字节——` +
      '疑似归档写入途中崩溃或被截断（半行快照），不得据此放行；请补全归档快照后重跑',
  );
}

/**
 * 校验归档目录是否包含各阶段强制快照文件。
 *
 * @param archiveDirContents 归档目录下所有文件/子目录的相对路径集合
 * @param phasesToCheck 须校验的阶段列表（默认 1-8 + global）
 * @param manifest 归档清单条件项（缺省 undefined = 仅既有阶段清单，零行为变化）
 * @param runLogPrefix L4 归档前缀性注入选项（缺省 undefined = 未启用，零行为变化）
 */
export function checkArchiveIntegrity(
  archiveDirContents: Set<string>,
  phasesToCheck: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', 'global'],
  manifest?: ArchiveIntegrityManifest,
  runLogPrefix?: ArchiveRunLogPrefixOptions,
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

  // 编码计划归档快照条件项（缺省 false = 零行为变化，既有 fixture 硬判据）
  if (manifest?.codingPlanSnapshot === true) {
    checkCodingPlanSnapshot(archiveDirContents, manifest, missingFiles, presentFiles);
  }

  // L4 归档前缀性条件项（缺省 undefined = 未启用，零行为变化）
  if (runLogPrefix !== undefined) {
    checkRunLogPrefix(runLogPrefix, missingFiles, presentFiles);
  }

  return {
    passed: missingFiles.length === 0,
    missingFiles,
    presentFiles,
    checkedPhases,
  };
}
