#!/usr/bin/env tsx
/**
 * codegraph + OpenSpec 依赖检测与自动安装初始化脚本
 *
 * 对应 SSoT §3.4.21：阶段 5-8 引入 codegraph（修改前影响分析）+ OpenSpec opsx（任务规划层）。
 * 三层检测（L1 CLI / L2 MCP 注册 / L3 项目目录）+ 自动处置，仅自动失败时 CHECKPOINT。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/ensure-codegraph-opsx.ts --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>
 *
 * 模式：
 *   full   = L1→L2→L3 全量检测+自动处置（阶段 5 首次进入）
 *   quick  = L1+L3 快速复检（阶段 6-8 进入）
 *   light  = 仅 L1 轻检（技能启动健康检查）
 *
 * 退出码：
 *   0  全部 ready 或 installed
 *   1  有 CHECKPOINT 项（需人工介入）
 *   2  输入错误（参数缺失/非法）
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitWithError } from '../lib/cli-error.js';
import { parsePhaseArg } from '../lib/parse-phase.js';

type Mode = 'full' | 'quick' | 'light';

interface CheckResult {
  layer: string;
  item: string;
  status: 'ready' | 'installed' | 'checkpoint';
  detail: string;
}

/**
 * 检测 CLI 是否可用（L1）
 */
function checkCli(name: string): boolean {
  try {
    execFileSync(name, ['--version'], { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * npm 全局安装 CLI
 */
function installCli(packageName: string): boolean {
  try {
    execFileSync('npm', ['i', '-g', packageName], { stdio: 'pipe', timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检测 codegraph_explore MCP 工具可调用性
 * 通过尝试执行 codegraph 查询探针判断 MCP 是否注册
 * 注意：探针须在 L3 codegraph init 之后执行，否则会出现"未初始化"假阴性
 */
function checkMcpCodegraph(projectRoot: string): boolean {
  try {
    // query 是位置参数，非 --symbol 选项
    execFileSync('codegraph', ['query', 'main'], {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 注册 codegraph MCP 到 Agent（L2 自动处置）
 */
function registerMcpCodegraph(): boolean {
  try {
    // 禁止 --yes：不得自动改写全局 opencode 配置
    execFileSync('codegraph', ['install'], { stdio: 'pipe', timeout: 60000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * codegraph 项目初始化（L3）
 */
function initCodegraph(projectRoot: string): boolean {
  try {
    execFileSync('codegraph', ['init'], { cwd: projectRoot, stdio: 'pipe', timeout: 300000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * openspec 项目初始化（L3）
 */
function initOpenspec(projectRoot: string): boolean {
  try {
    execFileSync('openspec', ['init'], { cwd: projectRoot, stdio: 'pipe', timeout: 60000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 依赖检测纯逻辑（可被 self-test import）
 */
export function ensureDeps(_phase: number, projectRoot: string, mode: Mode): CheckResult[] {
  const results: CheckResult[] = [];
  const isFull = mode === 'full';

  // L1: codegraph CLI
  if (checkCli('codegraph')) {
    results.push({ layer: 'L1', item: 'codegraph CLI', status: 'ready', detail: 'codegraph --version OK' });
  } else {
    if (installCli('@colbymchenry/codegraph') && checkCli('codegraph')) {
      results.push({ layer: 'L1', item: 'codegraph CLI', status: 'installed', detail: 'npm i -g @colbymchenry/codegraph 成功' });
    } else {
      results.push({ layer: 'L1', item: 'codegraph CLI', status: 'checkpoint', detail: '自动安装失败，需用户手动 npm i -g @colbymchenry/codegraph 或检查权限' });
    }
  }

  // L1: openspec CLI
  if (checkCli('openspec')) {
    results.push({ layer: 'L1', item: 'openspec CLI', status: 'ready', detail: 'openspec --version OK' });
  } else {
    if (installCli('@fission-ai/openspec@latest') && checkCli('openspec')) {
      results.push({ layer: 'L1', item: 'openspec CLI', status: 'installed', detail: 'npm i -g @fission-ai/openspec@latest 成功' });
    } else {
      results.push({ layer: 'L1', item: 'openspec CLI', status: 'checkpoint', detail: '自动安装失败，需用户手动 npm i -g @fission-ai/openspec@latest' });
    }
  }

  // light 模式到此为止
  if (mode === 'light') return results;

  // L2: codegraph MCP 注册（仅 full 模式；不在此处做 query 探针，避免 init 前假阴性）
  if (isFull) {
    if (registerMcpCodegraph()) {
      results.push({ layer: 'L2', item: 'codegraph_explore MCP', status: 'installed', detail: 'codegraph install 执行成功' });
    } else {
      results.push({ layer: 'L2', item: 'codegraph_explore MCP', status: 'checkpoint', detail: '需用户手动运行交互式 codegraph install（不使用 --yes 自动改写全局配置）' });
    }
  }

  // L3: codegraph 图谱目录
  const codegraphDir = path.join(projectRoot, '.codegraph');
  if (existsSync(codegraphDir)) {
    results.push({ layer: 'L3', item: '.codegraph/ 图谱', status: 'ready', detail: '目录已存在' });
  } else {
    if (initCodegraph(projectRoot) && existsSync(codegraphDir)) {
      results.push({ layer: 'L3', item: '.codegraph/ 图谱', status: 'installed', detail: 'codegraph init 成功' });
    } else {
      results.push({ layer: 'L3', item: '.codegraph/ 图谱', status: 'checkpoint', detail: 'codegraph init 失败，需用户手动执行' });
    }
  }

  // L3 探针查询：在 init 之后执行，验证 MCP 链路完整
  if (existsSync(codegraphDir)) {
    if (checkMcpCodegraph(projectRoot)) {
      results.push({ layer: 'L3', item: 'codegraph 探针查询', status: 'ready', detail: 'codegraph query main OK，MCP 链路正常' });
    } else {
      results.push({ layer: 'L3', item: 'codegraph 探针查询', status: 'checkpoint', detail: '探针查询失败，请确认 MCP 已注册且索引已构建' });
    }
  }

  // L3: openspec 工作区目录
  const openspecDir = path.join(projectRoot, 'openspec');
  if (existsSync(openspecDir)) {
    results.push({ layer: 'L3', item: 'openspec/ 工作区', status: 'ready', detail: '目录已存在' });
  } else {
    if (initOpenspec(projectRoot) && existsSync(openspecDir)) {
      results.push({ layer: 'L3', item: 'openspec/ 工作区', status: 'installed', detail: 'openspec init 成功' });
    } else {
      results.push({ layer: 'L3', item: 'openspec/ 工作区', status: 'checkpoint', detail: 'openspec init 失败，需用户手动执行' });
    }
  }

  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const prefix = `--${name}`;
    const eqArg = args.find(a => a.startsWith(`${prefix}=`));
    if (eqArg) return eqArg.slice(prefix.length + 1);
    const i = args.indexOf(prefix);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const phaseStr = getArg('phase');
  const projectRoot = getArg('project-root');
  const modeStr = getArg('mode') as Mode | undefined;

  if (!phaseStr || !projectRoot || !modeStr) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失 --phase/--project-root/--mode',
      detail: '用法: npx tsx ensure-codegraph-opsx.ts --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>',
      exitCode: 2,
    });
    return;
  }

  // 统一 --phase 校验（lib/parse-phase.ts，5-8）：getArg 保留 argv 循环外壳，仅校验逻辑收敛
  const phaseParsed = parsePhaseArg([`--phase=${phaseStr}`], { min: 5, max: 8 });
  if (phaseParsed === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      message: 'phase 必须为 5-8 整数',
      detail: `收到 ${phaseStr}`,
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  if (!['full', 'quick', 'light'].includes(modeStr)) {
    exitWithError({
      category: 'ARG_INVALID',
      message: 'mode 必须为 full/quick/light',
      detail: `收到 ${modeStr}`,
      exitCode: 2,
    });
    return;
  }

  const absRoot = path.resolve(projectRoot);
  // 项目根不存在 → FILE_NOT_FOUND（exit 2 输入错误守卫；非 opsx/openspec 那类 violation 语义）
  // light 模式仅做 L1 CLI 检查、不触碰 projectRoot，跳过项目根存在性检查（保持旧行为）
  if (modeStr !== 'light') {
    if (!existsSync(absRoot) || !statSync(absRoot).isDirectory()) {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        message: '项目根路径不存在或不是目录',
        file: absRoot,
        exitCode: 2,
      });
      return;
    }
  }
  const results = ensureDeps(phase, absRoot, modeStr);
  const hasCheckpoint = results.some(r => r.status === 'checkpoint');

  console.log('═'.repeat(60));
  console.log('codegraph + OpenSpec 依赖检测');
  console.log('═'.repeat(60));
  console.log(`阶段          : ${phase}`);
  console.log(`项目根        : ${absRoot}`);
  console.log(`模式          : ${modeStr}`);
  console.log(`校验结果      : ${hasCheckpoint ? '✗ 有 CHECKPOINT' : '✓ 就绪'}`);
  console.log('─'.repeat(60));

  for (const r of results) {
    const icon = r.status === 'ready' ? '✓' : r.status === 'installed' ? '+' : '✗';
    console.log(`  ${icon} [${r.layer}] ${r.item}: ${r.status} — ${r.detail}`);
  }

  const exitCode = hasCheckpoint ? 1 : 0;
  console.log('─'.repeat(60));
  console.log('ENSURE_DEPS_JSON ' + JSON.stringify({
    type: 'ensure-deps',
    phase,
    mode: modeStr,
    passed: !hasCheckpoint,
    exitCode,
    results,
  }));

  process.exit(exitCode);
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((err) => {
    exitWithError({
      category: 'UNEXPECTED',
      message: '脚本异常',
      detail: err instanceof Error ? err.message : String(err),
      exitCode: 2,
    });
  });
}
