// w-model-dev/scripts/lib/complexity-collect.ts
/**
 * M1 复杂度度量的共享采集器（控制者裁定 FC-6：放 lib/ 不放 cli/）。
 *
 * 逻辑层（logic/complexity-logic.ts）零 fs；本模块是唯一做 I/O 的采集面，
 * 供 wm-complexity-report.ts（任务 2）与 check-complexity-budget.ts（任务 3）两个 CLI 复用。
 * 放在 lib/ 而非 cli/ 的原因：cli/ 目录的「全入口态」会被 listGateScripts /
 * checkScriptRegistry / NEGATIVE-COVERAGE 当作门禁处理，计数污染成 53；lib/ 不被门禁扫描。
 *
 * 采集口径（与任务简报 / M1 设计一致）：
 *   - referencesFiles = w-model-dev/references/*.md（顶层 .md，path 显示为 references/<name>）；
 *   - scriptFiles     = w-model-dev/scripts/{cli,logic,lib,application,infrastructure}/*.ts
 *     （不含 __tests__，path 显示为 scripts/<layer>/<name>）；
 *   - 行数            = 按 `\n` 切分的段数（split('\n').length）；
 *   - antiPatternCount/hardConstraintCount 先按 hard-constraints.md 主表 / `## #N` 标题数
 *     （任务 4 落地登记册后改读登记册，本任务先实现正确采集）；
 *   - personaAdaptedCount = w-model-dev/subagent/*.md 正文命中 PERSONA_ADAPTION_MARKERS ≥2 项的人格数；
 *   - sedimentCount   = references/*.md 中含「已删除|已退役|审查更正」的行数；
 *   - 输出确定性：文件列表按 path 升序排序（localeCompare），同输入同字节。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import type { ComplexityMeasurement, FileLines } from '../logic/complexity-logic.js';

/** references/*.md 内联修订沉积标记（行级正则） */
const SEDIMENT_PATTERN = /已删除|已退役|审查更正/;

/** scripts/ 下纳入度量的功能层（__tests__ / samples 不在其中，天然排除） */
const SCRIPT_LAYERS = ['cli', 'logic', 'lib', 'application', 'infrastructure'] as const;

/** 人格「已适配」的 marker 命中下限 */
const ADAPTION_THRESHOLD = 2;

/**
 * 人格适配词表：正文含 W 模型制品词汇的 grep 信号（countPersonaAdaption 的命中集合）。
 * 本函数为采集/消费共享面，由 logic/complexity-logic.ts 再导出（lib→logic 运行时导入被
 * dependency-boundaries 禁止，logic→lib 允许，见 code-health-contract.ts 再导出范式）。
 */
export const PERSONA_ADAPTION_MARKERS: readonly string[] = [
  '.w-model',
  'run-log',
  'verifier-output',
  'phase-analyses',
  'RTM',
];

/** 统计正文命中的人格适配 marker 数（每个 marker 至多计一次；命中 ≥2 即视为已适配） */
export function countPersonaAdaption(bodyText: string): number {
  return PERSONA_ADAPTION_MARKERS.filter((marker) => bodyText.includes(marker)).length;
}

const HARD_CONSTRAINT_HEADING = /^##\s*#\d+/;
const ANTI_PATTERN_SECTION = /^###\s*反模式清单/;
const TABLE_ROW = /^\|\s*\d+\s*\|/;

/** 采集失败（输入坏 / 结构缺失），由 CLI 映射为 exit 2（FILE_NOT_FOUND / FILE_READ / STRUCTURE_INVALID） */
export class ComplexityCollectError extends Error {
  constructor(
    readonly category: 'FILE_NOT_FOUND' | 'FILE_READ' | 'STRUCTURE_INVALID',
    detail: string,
  ) {
    super(detail);
    this.name = 'ComplexityCollectError';
  }
}

function readDirOrThrow(dir: string, missingCategory: ComplexityCollectError['category']): string[] {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 采集目标是调用方传入的 w-model-dev 根下受检子目录（存在性由本函数 fail-closed）
    return readdirSync(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new ComplexityCollectError(
      e.code === 'ENOENT' ? missingCategory : 'FILE_READ',
      `${e.code === 'ENOENT' ? '目录不存在' : '目录不可读'}：${dir}（${e.code ?? '未知错误'}）`,
    );
  }
}

function readTextOrThrow(file: string): string {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 采集目标是 w-model-dev 根下枚举到的受控文件（readdir 检出后只读打开）
    return readFileSync(file, 'utf8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new ComplexityCollectError('FILE_READ', `文件不可读：${file}（${e.code ?? '未知错误'}）`);
  }
}

/** 行数口径 = 按 `\n` 切分的段数（与任务简报一致） */
export function countLines(text: string): number {
  return text.split('\n').length;
}

/**
 * 统计 hard-constraints.md 反模式清单主表行数（任务 4 登记册落地前 = antiPatternCount 口径）。
 * 仅在「### 反模式清单」节内计数 `| N |` 行主干（防其它表格未来出现数字行污染计数），
 * 主表头缺失 → fail-closed STRUCTURE_INVALID。
 */
export function countAntiPatternTableRows(hardConstraintsText: string): number {
  const lines = hardConstraintsText.split('\n');
  let inSection = false;
  let headerSeen = false;
  let count = 0;
  for (const line of lines) {
    if (ANTI_PATTERN_SECTION.test(line)) {
      inSection = true;
      headerSeen = true;
      continue;
    }
    if (inSection && /^#{2,3}\s/.test(line) && !ANTI_PATTERN_SECTION.test(line)) {
      inSection = false;
      continue;
    }
    if (inSection && TABLE_ROW.test(line)) count += 1;
  }
  if (!headerSeen)
    throw new ComplexityCollectError('STRUCTURE_INVALID', 'hard-constraints.md 缺「### 反模式清单」主表头');
  return count;
}

/** 硬约束数 = hard-constraints.md 的 `## #N` 标题条数（不含 `### 约束 #N-*` 子节） */
export function countHardConstraintHeadings(hardConstraintsText: string): number {
  return hardConstraintsText.split('\n').filter((line) => HARD_CONSTRAINT_HEADING.test(line)).length;
}

function measureFiles(
  root: string,
  subPath: string,
  displayPrefix: string,
  filter: (name: string) => boolean,
  optional: boolean,
): FileLines[] {
  const dir = path.join(root, subPath);
  let names: string[];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 采集目标是调用方传入的 w-model-dev 根下受检子目录（存在性由本函数 fail-closed）
    names = readdirSync(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (optional && e.code === 'ENOENT') return [];
    throw new ComplexityCollectError(
      e.code === 'ENOENT' ? 'STRUCTURE_INVALID' : 'FILE_READ',
      `${e.code === 'ENOENT' ? '目录不存在' : '目录不可读'}：${dir}（${e.code ?? '未知错误'}）`,
    );
  }
  return names
    .filter(filter)
    .map((name) => ({ path: `${displayPrefix}/${name}`, lines: countLines(readTextOrThrow(path.join(dir, name))) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * 采集一次完整复杂度度量。
 * @param wModelRoot w-model-dev 技能根目录（不存在 → FILE_NOT_FOUND；缺 references/scripts/subagent → STRUCTURE_INVALID）
 */
export function collectComplexityMeasurement(wModelRoot: string): ComplexityMeasurement {
  if (!existsSync(wModelRoot)) {
    throw new ComplexityCollectError('FILE_NOT_FOUND', `w-model-dev 根目录不存在：${wModelRoot}`);
  }

  const referencesFiles = measureFiles(wModelRoot, 'references', 'references', (n) => n.endsWith('.md'), false);

  const scriptFiles: FileLines[] = [];
  for (const layer of SCRIPT_LAYERS) {
    // 功能层子目录为可选：缺层按空目录度量（避免未来层更名让工具直接罢工），scripts/ 整体缺失仍 STRUCTURE_INVALID
    scriptFiles.push(
      ...measureFiles(wModelRoot, path.join('scripts', layer), `scripts/${layer}`, (n) => n.endsWith('.ts'), true),
    );
  }
  scriptFiles.sort((a, b) => a.path.localeCompare(b.path));

  const hardConstraintsPath = path.join(wModelRoot, 'references', 'hard-constraints.md');
  const hardConstraintsText = readTextOrThrow(hardConstraintsPath);
  const hardConstraintCount = countHardConstraintHeadings(hardConstraintsText);
  const antiPatternCount = countAntiPatternTableRows(hardConstraintsText);

  const subagentDir = path.join(wModelRoot, 'subagent');
  const personaFiles = readDirOrThrow(subagentDir, 'STRUCTURE_INVALID')
    .filter((n) => n.endsWith('.md'))
    .sort();
  const personaTotal = personaFiles.length;
  let personaAdaptedCount = 0;
  let sedimentCount = 0;
  for (const name of personaFiles) {
    if (countPersonaAdaption(readTextOrThrow(path.join(subagentDir, name))) >= ADAPTION_THRESHOLD) {
      personaAdaptedCount += 1;
    }
  }
  for (const f of referencesFiles) {
    // f.path 显示为 references/<name>，path.join 兼容正/反斜杠
    const text = readTextOrThrow(path.join(wModelRoot, f.path));
    for (const line of text.split('\n')) {
      if (SEDIMENT_PATTERN.test(line)) sedimentCount += 1;
    }
  }

  return {
    referencesFiles,
    scriptFiles,
    antiPatternCount,
    hardConstraintCount,
    personaAdaptedCount,
    personaTotal,
    sedimentCount,
  };
}
