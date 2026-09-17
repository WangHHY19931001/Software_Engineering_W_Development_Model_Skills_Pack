/**
 * exit-2 探针注册表（唯一事实源，S28 / M06）
 *
 * 「某个门禁能否以 exit 2 拒绝非法输入」此前有两份独立实现：`cli/check-docs-consistency.ts`
 * 的中心探针（统计 `exit2ScriptCount`）与 `__tests__/exit2-failure-atomicity.test.ts` 的
 * `negativeProbeFor()`。两份实现用「同源」注释互相指认，却没有任何机制防止漂移：探针参数一旦
 * 只改一处，另一处会继续用旧参数通过（假绿）。
 *
 * 本模块是唯一登记处：消费者只声明自己的探针工作根（`workRoot`），探针定义、探针 id、专用 fixture
 * 全部由此处产出。`check-docs-consistency.ts`（中心探针）与 `cli/check-samples-coverage.ts`
 * （负向覆盖登记册的真实 exit-2 探测）共用同一份定义。
 *
 * 约定：
 *   - 门禁集合口径 = `cli/*.ts` 减去 `self-test.ts`（聚合器，非 exit-2 门禁），由调用方传入文件列表；
 *   - 基础探针 = `--d4-invalid-argument`（未知 flag → ARG_INVALID / exit 2）；
 *   - 4 个门禁需要专用探针参数（见 `SPECIAL_PROBE_SCRIPTS`），其 fixture 建在调用方的 `workRoot` 下；
 *   - 探针必须无副作用：只读输入、失败前不写出任何产物（由 `exit2-failure-atomicity.test.ts` 逐门禁断言）。
 *
 * @module
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ErrorCategory } from './cli-error.js';

/** 一次 exit-2 负向调用（无副作用非法输入） */
export interface Exit2Probe {
  /** 门禁脚本文件名（`cli/<script>`） */
  script: string;
  /** 命令行参数（不含 node/tsx 与脚本路径） */
  args: string[];
  /** 工作目录；缺省由调用方决定（中心探针为仓库根，负向登记册为隔离探针根） */
  cwd?: string;
  /** 环境变量；缺省继承父进程 */
  env?: NodeJS.ProcessEnv;
  /** 期望**不被创建**的输出路径（失败原子性断言用） */
  outputPath?: string;
}

/** 需要专用探针参数的门禁（其余一律用基础探针 `--d4-invalid-argument`） */
export const SPECIAL_PROBE_SCRIPTS: readonly string[] = [
  'metrics-report.ts',
  'security-scan.ts',
  'wm-export-evidence.ts',
  'wm-status.ts',
];

/**
 * exit-2 允许的错误类别：`lib/cli-error.ts` 的 `ErrorCategory` 减去 `UNEXPECTED`。
 * 崩溃（UNEXPECTED）不是「输入错误被拒绝」，不得计入 exit-2 事实。
 */
export const EXIT2_ERROR_CATEGORIES: readonly ErrorCategory[] = [
  'ARG_INVALID',
  'FILE_NOT_FOUND',
  'FILE_PARSE',
  'FILE_READ',
  'STRUCTURE_INVALID',
];

/** 门禁集合口径：`cli/*.ts` 减去 `self-test.ts`。排序保证探针顺序稳定（与调用方 readdir+sort 同序）。 */
export function listGateScripts(cliScriptFiles: readonly string[]): string[] {
  return cliScriptFiles.filter((file) => file !== 'self-test.ts').sort();
}

/**
 * 构造门禁 → 探针映射（探针 id 形如 `<script>#<variant>`）。
 * 副作用仅限在 `workRoot` 下建立探针 fixture（调用方拥有该目录，负责清理）。
 */
export function buildExit2Probes(options: {
  cliScriptFiles: readonly string[];
  /** 调用方拥有的探针工作根（通常是进程内 mktemp 目录）；专用探针 fixture 建在其下 */
  workRoot: string;
}): Map<string, Exit2Probe> {
  const { cliScriptFiles, workRoot } = options;
  const invalidStatusProject = join(workRoot, 'invalid-status-project');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe fixture path（调用方传入的探针根下固定子目录）
  mkdirSync(join(invalidStatusProject, '.w-model'), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe fixture path
  writeFileSync(join(invalidStatusProject, '.w-model', 'project.json'), '{', 'utf-8');

  const probes = new Map<string, Exit2Probe>();
  for (const file of listGateScripts(cliScriptFiles)) {
    if (SPECIAL_PROBE_SCRIPTS.includes(file)) continue;
    probes.set(`${file}#invalid-argument`, { script: file, args: ['--d4-invalid-argument'] });
  }
  // 清空 PATH：eslint 不可用 → 输入错误 exit 2
  probes.set('security-scan.ts#missing-path', {
    script: 'security-scan.ts',
    args: [],
    env: { ...process.env, PATH: '', Path: '' },
  });
  // 非法 --phase=0，cwd 为探针根；project 路径故意不存在（不 mkdir，保证走 FILE_NOT_FOUND）
  probes.set('metrics-report.ts#invalid-phase', {
    script: 'metrics-report.ts',
    args: [join(workRoot, 'probe-project'), '--phase=0', '--json'],
    cwd: workRoot,
  });
  const exportProbeRoot = join(workRoot, 'export-probes');
  const exportProject = join(exportProbeRoot, 'project');
  const exportOutput = join(exportProbeRoot, 'output');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- mktemp-owned probe fixture path
  mkdirSync(join(exportProject, '.w-model'), { recursive: true });
  probes.set('wm-export-evidence.ts#no-args', {
    script: 'wm-export-evidence.ts',
    args: [],
    outputPath: exportOutput,
  });
  probes.set('wm-export-evidence.ts#unknown-option', {
    script: 'wm-export-evidence.ts',
    args: ['--d4-invalid-argument'],
    outputPath: exportOutput,
  });
  probes.set('wm-export-evidence.ts#verify-missing-path', {
    script: 'wm-export-evidence.ts',
    args: ['--verify'],
    outputPath: exportOutput,
  });
  // 损坏 project.json 的探针项目
  probes.set('wm-status.ts#invalid-project', { script: 'wm-status.ts', args: [invalidStatusProject] });
  return probes;
}
