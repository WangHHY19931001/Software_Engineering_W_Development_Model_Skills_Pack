#!/usr/bin/env tsx
/**
 * TLA+ 模型校验脚本（TLA Model Checker）
 *
 * 对应 docs/tla-plus-modeling-design.md TLA+ 层次化建模与门禁设计。
 * 供 G 子代理在阶段 1–4 收敛循环中调用，校验 tla-manifest.json 的：
 *   文件头字段一致性 + 层次一致性 + 拆解决策 + SANY 语法 + TLC 模型检查
 *   （死锁 / 不变式违反 / 状态爆炸）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-tla-model.ts <tla-manifest.json> [--phase=N] [--spec=<id>] [--graph=<graph.json>] [--keep-states]
 *
 * 参数：
 *   tla-manifest.json   manifest 文件路径
 *   --phase=N            只校验 spec.phase ≤ N 的规格（1-8），默认从 manifest.currentPhase 读取
 *   --spec=<id>          仅对该规格执行 SANY/TLC（调试用；结构/层次校验仍覆盖全部 phase 内规格）
 *   --graph=<graph.json> 提供图谱文件，提取 type=SD 节点 ID 供 SD 覆盖率校验（§10）
 *                        phase>=2 时强制必填，缺失 → exitCode=2 ARG_INVALID
 *   --keep-states / -k   P3.8：保留 TLC states 目录用于调试（默认校验后自动清理）
 *   --json               机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  校验通过（环境就绪 + 头部一致 + 层次一致 + 拆解合规 + SANY 通过 + TLC 零违反）
 *   1  校验失败（违反列出具体原因，S 子代理按原因修正规格 / 拆解 / 回退需求设计）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 TLA_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--phase=N、--spec=、--graph=、--keep-states/-k
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * 注意：本脚本不调用任何 LLM。SANY/TLC 为确定性工具（Java + tla2tools.jar）。
 *
 * @module
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkTlaModel, parseTlaHeader, validateHeader, type TlaManifest, type TlaSpec } from '../logic/tla-logic.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { PHASES, type Phase } from '../lib/constants.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';

// ==================== 参数解析 ====================

interface ParsedArgs {
  manifestFile: string | undefined;
  phase: number | undefined;
  specId: string | undefined;
  graphFile: string | undefined;
  /** P3.8（第 9 轮）--keep-states：保留 states 目录用于调试 */
  keepStates: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const manifestFile = args.find((a) => !a.startsWith('--'));
  const phaseArg = args.find((a) => a.startsWith('--phase='));
  const specArg = args.find((a) => a.startsWith('--spec='));
  // P3.8（第 9 轮）--keep-states / -k：调试模式下保留 TLC 产物
  const keepStates = args.includes('--keep-states') || args.includes('-k');
  const graphArg = args.find((a) => a.startsWith('--graph='));

  let phase: number | undefined;
  if (phaseArg) {
    // 统一 --phase 校验（lib/parse-phase.ts，1-8）；非法时回退原 parseInt 语义，
    // 由 main 的 [1-8] 检查统一拦截（行为等价：非法值原样走 '无法确定 phase' 退出）
    const parsed = parsePhaseArg(argv, { min: 1, max: 8 });
    if (parsed !== undefined) {
      phase = parsed.phase;
    } else {
      const phaseStr = phaseArg.split('=')[1];
      phase = phaseStr !== undefined ? Number.parseInt(phaseStr, 10) : undefined;
    }
  }

  let specId: string | undefined;
  if (specArg) {
    specId = specArg.split('=')[1];
  }

  const graphFile = graphArg ? graphArg.split('=')[1] : undefined;

  return { manifestFile, phase, specId, graphFile, keepStates };
}

// ==================== 环境检查 ====================

/**
 * 由 `java -version` 的 stderr 输出解析 Java 主版本号。
 * 兼容 Java 8（"1.8.0_xxx" → 8）与 Java 11+（"11.0.x" → 11）。
 */
function parseJavaMajorVersion(stderr: string): number | null {
  const m = stderr.match(/version\s+"([0-9._]+)"/i);
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

interface EnvironmentStatus {
  ok: boolean;
  errors: string[];
  javaVersion: number | null;
}

/**
 * 环境检查（设计文档 §3.1 步骤 1）：
 *   - java -version 可执行且主版本 ≥ javaMinVersion
 *   - tla2tools.jar 文件存在（jarAbs 为按 basePath 基准解析后的绝对路径）
 */
async function checkEnvironment(jarAbs: string, javaMinVersion: number): Promise<EnvironmentStatus> {
  const errors: string[] = [];
  let javaVersion: number | null = null;

  // java -version（输出在 stderr；用 spawnSync 同时捕获 stdout/stderr，不抛异常）
  let javaStderr = '';
  try {
    const res = spawnSync('java', ['-version'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    javaStderr = (res.stderr ?? '') + (res.stdout ?? '');
    if (res.error) {
      errors.push(`未找到 java 可执行文件（${res.error.message}）`);
    } else if (res.status !== 0) {
      errors.push(`java -version 退出码 ${res.status}：${javaStderr.trim()}`);
    }
  } catch (err) {
    errors.push(`java -version 执行失败：${(err as Error).message}`);
  }

  if (errors.length === 0) {
    javaVersion = parseJavaMajorVersion(javaStderr);
    if (javaVersion == null) {
      errors.push(`无法从 java -version 输出解析版本号：${javaStderr.trim()}`);
    } else if (javaVersion < javaMinVersion) {
      errors.push(`Java 版本 ${javaVersion} < 要求 ${javaMinVersion}`);
    }
  }

  // jar 文件存在（jarAbs 已由调用方按 basePath 基准解析为绝对路径）
  try {
    const stat = await fs.stat(jarAbs);
    if (!stat.isFile()) {
      errors.push(`tla2tools.jar 路径非文件: ${jarAbs}`);
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      errors.push(`tla2tools.jar 不存在: ${jarAbs}`);
    } else {
      errors.push(`tla2tools.jar 访问失败: ${e.message}`);
    }
  }

  return { ok: errors.length === 0, errors, javaVersion };
}

// ==================== 轨迹文件清理 ====================

// TLC 产物特征：states/<时间戳子目录>，形如 2026-08-05-10-30-00（YY-MM-DD-HH-MM-SS）
// 第 35 轮调测发现：TLC 2.19 实际产出 2 位年份（26-08-05-10-30-00），原 \d{4} 不匹配导致清理静默跳过（P3 bug），改为兼容 2/4 位年份
const TLC_TIMESTAMP_DIR = /^\d{2,4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

/**
 * 清理 TLC 轨迹文件（设计文档 §3.1 步骤 5 / §3.4）：
 * 删除 .tla 同目录下的 states/ 目录（含时间戳子目录里的 .st/.fp 文件）
 * 以及 *.dump / *.out 残留文件，避免历史轨迹干扰本轮校验。
 *
 * 实测 TLC 2.19 产物（2026-07-23）：states/<YY-MM-DD-HH-MM-SS>/ 下含
 *   <Module>.st / <Module>-0.st（状态文件）+ <Module>_0.fp / <Module>_1.fp（指纹文件）。
 * 默认不产生 .dump/.out（特定 flag 才产生），但保留清理作为预防。
 *
 * 安全加固（批次 1 §3.2）：dir 来自 manifest spec.tlaPath（Agent 可写），
 * 守卫 1：仅当目录内含 .tla 规格文件才执行清理，防止误删仓库根 / 业务目录；
 * 守卫 2：states/ 目录需满足 isTlcStatesDir（TLC 产物特征），否则跳过，防误删同名业务 states/。
 */
export async function cleanTraceFiles(dir: string): Promise<string[]> {
  const deleted: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return deleted;
  }
  // 守卫 1：TLC 产物只产生于含 .tla 规格文件的目录；无 .tla 则跳过整个清理
  if (!entries.some((name) => name.endsWith('.tla'))) {
    return deleted;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    if (name.endsWith('.dump') || name.endsWith('.out')) {
      try {
        await fs.rm(full, { force: true });
        deleted.push(full);
      } catch {
        /* 忽略单个文件清理失败 */
      }
    }
    if (name === 'states') {
      // 守卫 2：states/ 必须是 TLC 产物（时间戳子目录或含 .st/.fp 指纹），否则跳过
      if (await isTlcStatesDir(full)) {
        try {
          await fs.rm(full, { recursive: true, force: true });
          deleted.push(full);
        } catch {
          /* 忽略 states 目录清理失败 */
        }
      }
    }
  }
  return deleted;
}

/**
 * 判定目录是否为 TLC 产物目录：含时间戳子目录，或直接含 .st/.fp/.dump/.out 文件。
 * 批次 1 安全加固：防误删与 .tla 同级的同名业务 states/ 目录。
 */
export async function isTlcStatesDir(dir: string): Promise<boolean> {
  let children: string[];
  try {
    children = await fs.readdir(dir);
  } catch {
    return false;
  }
  for (const c of children) {
    if (TLC_TIMESTAMP_DIR.test(c)) return true;
    if (c.endsWith('.st') || c.endsWith('.fp') || c.endsWith('.dump') || c.endsWith('.out')) return true;
  }
  return false;
}

// ==================== SANY / TLC 执行 ====================

interface ToolRunResult {
  syntaxOk: boolean;
  syntaxOutput: string;
  tlcRan: boolean;
  tlcOutput: string;
  deadlock: boolean;
  invariantViolated: boolean;
  stateExplosion: boolean;
  tlcNoError: boolean;
}

/**
 * 对单个规格执行 SANY 语法检查与 TLC 模型检查。
 *
 * 顺序硬约束（反模式 #14）：先 SANY，通过后才允许跑 TLC。
 */
function runTools(jarAbs: string, tlaAbs: string, cfgAbs: string): ToolRunResult {
  const tlaDir = path.dirname(tlaAbs);
  const moduleName = path.basename(tlaAbs, '.tla');
  const out: ToolRunResult = {
    syntaxOk: false,
    syntaxOutput: '',
    tlcRan: false,
    tlcOutput: '',
    deadlock: false,
    invariantViolated: false,
    stateExplosion: false,
    tlcNoError: false,
  };

  // SANY 语法检查
  // 实测：SANY 退出码 0=成功 / 11=语法错误；输出走 stdout（含错误消息）
  try {
    const stdout = execFileSync('java', ['-cp', jarAbs, 'tla2sany.SANY', tlaAbs], {
      encoding: 'utf-8',
      cwd: tlaDir,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    out.syntaxOk = true;
    out.syntaxOutput = stdout;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; status?: number };
    out.syntaxOk = false;
    // SANY 错误输出在 stdout（含 "Fatal errors while parsing" / "Could not parse module"）
    out.syntaxOutput = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim() || (e.message ?? 'SANY 执行失败');
    return out; // 语法未通过 → 不跑 TLC（反模式 #14 守护）
  }

  // TLC 模型检查（cwd 置为 .tla 所在目录，TLC 据此查找模块文件）
  // 实测退出码：0=成功 / 11=死锁 / 12=不变式违反 / 其他=内存或配置错误
  // -nowarning：抑制 GC 建议警告（实测有效，输出更干净）
  // -cleanup：运行前自动清理 states/ 目录（与 cleanTraceFiles 互补，双保险）
  out.tlcRan = true;
  try {
    const stdout = execFileSync(
      'java',
      ['-cp', jarAbs, 'tlc2.TLC', '-nowarning', '-cleanup', '-config', cfgAbs, moduleName],
      {
        encoding: 'utf-8',
        cwd: tlaDir,
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    out.tlcOutput = stdout;
  } catch (err) {
    // TLC 发现违反时退出码非 0（11=死锁 / 12=不变式违反），输出仍在 stdout
    const e = err as { stdout?: string; stderr?: string; status?: number };
    out.tlcOutput = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
  }

  // 实测 TLC 输出模式（2026-07-23 tla2tools.jar TLC2 2.19 实测确认）：
  //   成功      : "Model checking completed. No error has been found."
  //   死锁      : "Error: Deadlock reached."
  //   不变式违反: "Error: Invariant <Inv> is violated."
  //   状态爆炸  : "Error: Out of memory" / "exceeded" + "states"
  out.deadlock = /Deadlock reached/i.test(out.tlcOutput);
  out.invariantViolated = /Invariant\b.*\bviolated/i.test(out.tlcOutput);
  out.stateExplosion =
    /out of memory/i.test(out.tlcOutput) || /states?.*(exceeds|exceeded|too many)/i.test(out.tlcOutput);
  out.tlcNoError = /Model checking completed\.?\s*No error/i.test(out.tlcOutput);

  return out;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const { manifestFile, phase: phaseArg, specId, graphFile, keepStates } = parseArgs(process.argv);

  if (!manifestFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <tla-manifest.json>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4|5|6|7|8] [--spec=<id>] [--graph=<graph.json>（phase>=2 强制）] [--keep-states]',
      exitCode: 2,
    });
    return;
  }

  const abs = path.resolve(manifestFile);
  const parsed = await readJsonOrExit<unknown>(manifestFile);

  const manifest = parsed as Partial<TlaManifest>;

  // 确定 phase
  let phase = phaseArg;
  if (phase === undefined) {
    phase = manifest.currentPhase;
  }
  if (phase === undefined || typeof phase !== 'number' || !PHASES.includes(phase as Phase)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '无法确定 phase',
      detail: `未传 --phase 且 manifest.currentPhase=${JSON.stringify(manifest.currentPhase)} 无效（须为 1-8）`,
      exitCode: 2,
    });
    return;
  }

  // --graph phase>=2 强制（设计文档 §3.3.6）
  if (phase >= 2 && !graphFile) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 --graph=<graph.json>（phase>=2 强制）',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-tla-model.ts <tla-manifest.json> --phase=N --graph=.w-model/ingestion/graph.json',
      exitCode: 2,
    });
    return;
  }

  // manifest.tools 前置检查（环境检查需要 jarPath）
  const tools = manifest.tools;
  if (!tools || typeof tools.jarPath !== 'string' || typeof tools.javaMinVersion !== 'number') {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-3',
      message: '结构不符（manifest.tools 须含 jarPath 与 javaMinVersion）',
      file: abs,
      exitCode: 2,
    });
    return;
  }

  // P1.1: 路径解析统一基准 —— basePath（相对 manifest 文件所在目录）。
  // 缺省回退 '.'（与 manifest 目录同级），但纯逻辑已对缺失 basePath 报违反。
  const basePath = manifest.basePath || '.';
  const manifestDir = path.dirname(abs);
  const baseAbs = path.resolve(manifestDir, basePath);

  // 环境检查
  const jarAbs = path.resolve(baseAbs, tools.jarPath);
  const env = await checkEnvironment(jarAbs, tools.javaMinVersion);

  // 提取 graph SD 节点（供 checkCoverage 校验 TLA+ 子系统覆盖率，§10）
  let graphSdNodes: string[] | undefined;
  if (graphFile) {
    const g = await readJsonOrExit<{ nodes?: Array<{ id: string; type: string }> }>(graphFile);
    if (Array.isArray(g.nodes)) {
      graphSdNodes = g.nodes.filter((n) => n.type === 'SD').map((n) => n.id);
    }
  }

  // 收集 headerViolations（需读 .tla 文件 + parseTlaHeader + validateHeader）
  const headerViolations: string[] = [];
  const specs: TlaSpec[] = Array.isArray(manifest.specs) ? (manifest.specs as TlaSpec[]) : [];

  // 仅当环境就绪时执行 SANY/TLC；否则保留 manifest 声明标志（环境错误已致失败）
  if (env.ok && Array.isArray(manifest.specs)) {
    for (const spec of specs) {
      if (!spec || typeof spec !== 'object' || typeof spec.id !== 'string') continue;
      if (typeof spec.phase === 'number' && spec.phase > phase) continue;
      if (specId !== undefined && spec.id !== specId) continue;

      const tlaAbs = path.resolve(baseAbs, spec.tlaPath);
      const cfgAbs = path.resolve(baseAbs, spec.cfgPath);
      const tlaDir = path.dirname(tlaAbs);

      // 读 .tla 文件 + 解析头部 + 校验头部
      let content: string;
      try {
        content = await fs.readFile(tlaAbs, 'utf-8');
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'ENOENT') {
          headerViolations.push(`规格 ${spec.id} 的 .tla 文件不存在: ${tlaAbs}`);
        } else {
          headerViolations.push(`规格 ${spec.id} 的 .tla 文件读取失败: ${e.message}`);
        }
        spec.syntaxChecked = false; // 标记未通过，供纯逻辑捕获
        continue;
      }
      spec.tlaContent = content; // 供 checkCfgInvariantsConsistency 使用（§11）
      const header = parseTlaHeader(content);
      headerViolations.push(...validateHeader(header, spec));

      // 清理轨迹文件（每轮 TLC 运行前硬约束）
      await cleanTraceFiles(tlaDir);

      // 读 .cfg 内容（TLC 需要 + 新增供 checkCfgInvariantsConsistency/checkCfgStructure 使用，§11/§12）
      try {
        const cfgContent = await fs.readFile(cfgAbs, 'utf-8');
        spec.cfgContent = cfgContent;
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'ENOENT') {
          headerViolations.push(`规格 ${spec.id} 的 .cfg 文件不存在: ${cfgAbs}`);
        } else {
          headerViolations.push(`规格 ${spec.id} 的 .cfg 文件读取失败: ${e.message}`);
        }
      }

      // SANY + TLC
      const run = runTools(jarAbs, tlaAbs, cfgAbs);
      spec.syntaxChecked = run.syntaxOk;
      if (!run.syntaxOk) {
        headerViolations.push(
          `规格 ${spec.id} SANY 语法检查失败：${run.syntaxOutput.split('\n').slice(0, 3).join(' | ')}`,
        );
      }
      if (run.tlcRan) {
        spec.tlcChecked = true;
        spec.deadlockFree = !run.deadlock;
        spec.invariantsHold = !run.invariantViolated;
        spec.stateExplosion = run.stateExplosion;
        spec.lastCheckTimestamp = new Date().toISOString();
      }
    }
  }

  // 填入 graphSdNodes 供 checkCoverage 使用（§10）
  if (graphSdNodes !== undefined) {
    (parsed as Partial<TlaManifest>).graphSdNodes = graphSdNodes;
  }

  // 调用纯逻辑校验（manifest 已被本脚本按实际工具结果回填标志 + tlaContent/cfgContent/graphSdNodes）
  const result = checkTlaModel(parsed, phase);

  // 回填纯逻辑无法判定的部分：headerViolations + 环境
  result.headerViolations = headerViolations;
  result.environmentOk = env.ok;
  result.environmentErrors = env.errors;
  for (const hv of headerViolations) result.violations.push(hv);
  for (const ee of env.errors) result.violations.push(`环境错误：${ee}`);
  result.passed = result.environmentOk && result.violations.length === 0;
  const exitCode = result.passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'tla-model',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  // ==================== P3.8（第 9 轮）states 自动清理（校验后） ====================
  // 默认在 TLC 校验完成后自动清理 states/ 目录，避免状态文件残留污染仓库。
  // --keep-states / -k：调试模式下保留 states 用于排查。
  if (!keepStates) {
    let cleanedCount = 0;
    for (const spec of specs) {
      if (!spec || typeof spec !== 'object' || typeof spec.id !== 'string') continue;
      if (typeof spec.phase === 'number' && spec.phase > phase) continue;
      if (specId !== undefined && spec.id !== specId) continue;
      const tlaAbs = path.resolve(baseAbs, spec.tlaPath);
      const tlaDir = path.dirname(tlaAbs);
      const deleted = await cleanTraceFiles(tlaDir);
      if (deleted.length > 0) cleanedCount++;
    }
    if (cleanedCount > 0) {
      console.log(`✓ P3.8 已清理 TLA+ states 目录（${cleanedCount} 个 spec 目录）`);
    }
  } else {
    console.log('⚠ --keep-states 已启用，未清理 states 目录（调试模式）');
  }

  // ==================== 报告输出 ====================
  console.log('═'.repeat(60));
  console.log('TLA+ 模型校验（TLA Model Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`校验阶段      : ${result.phase}`);
  console.log(`规格总数      : ${result.totalSpecs}`);
  console.log(`受检规格数    : ${result.checkedSpecs}`);
  console.log(
    `环境状态      : ${result.environmentOk ? '✓ 就绪' : '✗ 未就绪'}（Java ${env.javaVersion ?? 'N/A'}，jar ${jarAbs}）`,
  );
  if (specId !== undefined) console.log(`--spec 过滤   : ${specId}`);
  console.log(
    `头部违反      : ${result.headerViolations.length === 0 ? '无' : `${result.headerViolations.length} 条`}`,
  );
  console.log(
    `层次违反      : ${result.hierarchyViolations.length === 0 ? '无' : `${result.hierarchyViolations.length} 条`}`,
  );
  console.log(
    `拆解违反      : ${result.decompositionViolations.length === 0 ? '无' : `${result.decompositionViolations.length} 条`}`,
  );
  console.log(`语法错误      : ${result.syntaxErrors.length === 0 ? '无' : `${result.syntaxErrors.length} 条`}`);
  console.log(
    `死锁违反      : ${result.deadlockViolations.length === 0 ? '无' : `${result.deadlockViolations.length} 条`}`,
  );
  console.log(
    `不变式违反    : ${result.invariantViolations.length === 0 ? '无' : `${result.invariantViolations.length} 条`}`,
  );
  console.log(
    `状态爆炸规格  : ${result.stateExplosionSpecs.length === 0 ? '无' : result.stateExplosionSpecs.join(', ')}`,
  );
  console.log(
    `覆盖率违反    : ${result.coverageViolations.length === 0 ? '无' : `${result.coverageViolations.length} 条`}`,
  );
  console.log(
    `CFG 一致性    : ${result.cfgConsistencyViolations.length === 0 ? '无' : `${result.cfgConsistencyViolations.length} 条`}`,
  );
  console.log(
    `CFG 结构      : ${result.cfgStructureViolations.length === 0 ? '无' : `${result.cfgStructureViolations.length} 条`}`,
  );
  console.log(
    `checkRounds   : ${result.checkRoundsViolations.length === 0 ? '无' : `${result.checkRoundsViolations.length} 条`}`,
  );
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log(
      'TLA+ 模型符合 docs/tla-plus-modeling-design.md：头部一致 + 层次一致 + 拆解合规 + SANY 通过 + TLC 零违反。',
    );
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log('S 子代理须按上述原因修正（修正规格 / 拆解降低 variableCombination / 回退需求或设计），详见：');
    console.log('  docs/tla-plus-modeling-design.md §5（建模与需求/设计的一致性）');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  // exitCode 与 process.exit() 实参一致（门禁防伪造三层机制之一）
  printGateReport(
    'TLA',
    {
      type: 'tla-model',
      passed: result.passed,
      phase: result.phase,
      totalSpecs: result.totalSpecs,
      checkedSpecs: result.checkedSpecs,
      headerViolations: result.headerViolations,
      hierarchyViolations: result.hierarchyViolations,
      decompositionViolations: result.decompositionViolations,
      syntaxErrors: result.syntaxErrors,
      deadlockViolations: result.deadlockViolations,
      invariantViolations: result.invariantViolations,
      stateExplosionSpecs: result.stateExplosionSpecs,
      coverageViolations: result.coverageViolations,
      cfgConsistencyViolations: result.cfgConsistencyViolations,
      cfgStructureViolations: result.cfgStructureViolations,
      checkRoundsViolations: result.checkRoundsViolations,
      environmentOk: result.environmentOk,
      environmentErrors: result.environmentErrors,
      violations: result.violations,
      converged: result.passed,
    },
    exitCode,
  );
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
