#!/usr/bin/env tsx
/**
 * codegraph（CLI 依赖）+ superpowers 方法论三层检测与 codegraph 自动安装初始化脚本
 *
 * superpowers 替换批次 1（2026-09-21）：openspec 半边整体删除（opsx 由 superpowers 规格驱动
 * 工作流替代）；codegraph 依赖收敛为对其 CLI 的依赖——MCP 降级为可选加速（非依赖），
 * 不再自动注册、不参与就绪判定；新增 superpowers 方法论三层检测（只检测不安装）。
 *
 * 对应 SKILL.md「codegraph 修改前影响分析」机制（阶段 5-8）。
 * 三层检测（L1 CLI 与宿主技能 / L2 技能包资产 / L3 项目目录）+ codegraph 自动处置，仅自动失败时 CHECKPOINT。
 *
 * 实测（2026-09-21，codegraph CLI v1.5.0，`codegraph --help`）：`query [options] <search>` 为 CLI
 * 子命令（"Search for symbols in the codebase"），探针走 CLI 形态（`codegraph query main`），
 * 不依赖宿主 MCP 工具；`install` 子命令（注册 MCP 到宿主）保留为用户手动可选操作。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/ensure-codegraph.ts --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>
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

import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitWithError } from '../lib/cli-error.js';
// 受控 CLI 派发（win32 .cmd shim 经 cmd.exe）与 cli/doctor.ts 共用同一实现——两消费者对
// 「同一依赖是否可用」必须结论一致（2026-09-21 修复轮 1 评审裁定 2，见 lib/cli-probe.ts 头注）
import { probeCliCommand, type CliProbeResult } from '../lib/cli-probe.js';
import { runMain } from '../lib/run-main.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import { DuplicateFlagError } from '../lib/parse-args.js';
import {
  MIN_HOST_SUPERPOWERS_SKILLS,
  SUPERPOWERS_KEY_SKILLS,
  detectCodegraphMcpRegistration,
  resolveVendoredAdoptionPath,
  scanHostSuperpowersSkills,
} from '../lib/superpowers-detect.js';

type Mode = 'full' | 'quick' | 'light';

interface CheckResult {
  layer: string;
  item: string;
  status: 'ready' | 'installed' | 'checkpoint';
  detail: string;
}

/** 技能包内 vendored 方法论文件（脚本相对解析，模块级常量） */
const VENDORED_ADOPTION_PATH = resolveVendoredAdoptionPath(path.dirname(fileURLToPath(import.meta.url)));

/** 失败摘要：优先 stderr/spawn 错误文本，退化为退出码（保证 ⚠ 日志始终有可读原因） */
function probeFailureText(result: CliProbeResult): string {
  const text = result.stderr.trim();
  if (text !== '') return text;
  return result.status === null ? '进程未能启动或超时' : `退出码 ${result.status}`;
}

/**
 * 检测 CLI 是否可用（L1）
 */
function checkCli(name: string): boolean {
  const result = probeCliCommand(name, ['--version'], { timeoutMs: 10_000 });
  if (!result.ok) {
    console.error(`⚠ [ensure-codegraph] CLI 版本探测（${name}）失败: ${probeFailureText(result)}`);
  }
  return result.ok;
}

/**
 * npm 全局安装 CLI
 */
function installCli(packageName: string): boolean {
  const result = probeCliCommand('npm', ['i', '-g', packageName], { timeoutMs: 120_000 });
  if (!result.ok) {
    console.error(`⚠ [ensure-codegraph] npm 全局安装（${packageName}）失败: ${probeFailureText(result)}`);
  }
  return result.ok;
}

/**
 * codegraph CLI 探针查询（L3）
 * 实测 `query <search>` 为 codegraph CLI 子命令（见文件头），非宿主 MCP 工具调用。
 * 注意：探针须在 L3 codegraph init 之后执行，否则会出现"未初始化"假阴性
 */
function probeCliQuery(projectRoot: string): boolean {
  // query 是位置参数，非 --symbol 选项
  const result = probeCliCommand('codegraph', ['query', 'main'], { cwd: projectRoot, timeoutMs: 15_000 });
  if (!result.ok) {
    console.error(`⚠ [ensure-codegraph] codegraph 探针查询（CLI）失败: ${probeFailureText(result)}`);
  }
  return result.ok;
}

/**
 * codegraph 项目初始化（L3）
 */
function initCodegraph(projectRoot: string): boolean {
  const result = probeCliCommand('codegraph', ['init'], { cwd: projectRoot, timeoutMs: 300_000 });
  if (!result.ok) {
    console.error(`⚠ [ensure-codegraph] codegraph 项目初始化（init）失败: ${probeFailureText(result)}`);
  }
  return result.ok;
}

/**
 * 依赖检测纯逻辑（可被 self-test import）
 */
export function ensureDeps(_phase: number, projectRoot: string, mode: Mode): CheckResult[] {
  const results: CheckResult[] = [];
  const isFull = mode === 'full';

  // L1: codegraph CLI（唯一保留自动安装的依赖）
  if (checkCli('codegraph')) {
    results.push({ layer: 'L1', item: 'codegraph CLI', status: 'ready', detail: 'codegraph --version OK' });
  } else {
    if (installCli('@colbymchenry/codegraph') && checkCli('codegraph')) {
      results.push({
        layer: 'L1',
        item: 'codegraph CLI',
        status: 'installed',
        detail: 'npm i -g @colbymchenry/codegraph 成功',
      });
    } else {
      results.push({
        layer: 'L1',
        item: 'codegraph CLI',
        status: 'checkpoint',
        detail: '自动安装失败，需用户手动 npm i -g @colbymchenry/codegraph 或检查权限',
      });
    }
  }

  // L1: superpowers 宿主技能（只检测不安装）：~/.agents/skills 与 ~/.claude/skills 并集
  //     含 ≥3 个关键技能子目录（内含 SKILL.md 即算）
  const hostSkills = scanHostSuperpowersSkills(homedir());
  if (hostSkills.length >= MIN_HOST_SUPERPOWERS_SKILLS) {
    results.push({
      layer: 'L1',
      item: 'superpowers 宿主技能',
      status: 'ready',
      detail: `关键技能 ${hostSkills.length}/${SUPERPOWERS_KEY_SKILLS.length}：${hostSkills.join(' / ')}`,
    });
  } else {
    results.push({
      layer: 'L1',
      item: 'superpowers 宿主技能',
      status: 'checkpoint',
      detail: `宿主技能目录（~/.agents/skills、~/.claude/skills）仅发现 ${hostSkills.length}/${MIN_HOST_SUPERPOWERS_SKILLS} 个关键技能（${SUPERPOWERS_KEY_SKILLS.join(' / ')}）；只检测不安装，请按宿主技能安装流程手动补齐`,
    });
  }

  // light 模式到此为止
  if (mode === 'light') return results;

  // L2: codegraph MCP——已收敛为可选加速（非依赖）：不再自动注册（原 codegraph install 已删），
  //     恒不出 checkpoint；本行为说明性条目，仅 detail 文案随 best-effort 注册探测变化
  if (isFull) {
    const mcpRegistered = detectCodegraphMcpRegistration(homedir(), projectRoot);
    results.push({
      layer: 'L2',
      item: 'codegraph MCP（可选加速）',
      status: 'ready',
      detail: mcpRegistered
        ? '检测到宿主 MCP 配置含 codegraph；MCP 可选加速（非依赖），不再自动注册'
        : '未检测到宿主 MCP 注册——MCP 可选加速（非依赖），不影响就绪判定；如需加速可手动运行 codegraph install',
    });
  }

  // L2: superpowers vendor 文件（技能包资产；只检测不创建）
  if (isFull) {
    if (existsSync(VENDORED_ADOPTION_PATH)) {
      results.push({
        layer: 'L2',
        item: 'superpowers vendor 文件',
        status: 'ready',
        detail: 'references/superpowers-adoption.md 已 vendor',
      });
    } else {
      results.push({
        layer: 'L2',
        item: 'superpowers vendor 文件',
        status: 'checkpoint',
        detail:
          'references/superpowers-adoption.md 未 vendor（superpowers 替换批次 1 任务 6 落地前为预期 checkpoint 态）；只检测不自动创建',
      });
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
      results.push({
        layer: 'L3',
        item: '.codegraph/ 图谱',
        status: 'checkpoint',
        detail: 'codegraph init 失败，需用户手动执行',
      });
    }
  }

  // L3 探针查询：CLI 形态（`codegraph query main`），在 init 之后执行验证 CLI + 索引链路完整
  if (existsSync(codegraphDir)) {
    if (probeCliQuery(projectRoot)) {
      results.push({
        layer: 'L3',
        item: 'codegraph 探针查询',
        status: 'ready',
        detail: 'codegraph query main OK（CLI 形态），索引链路正常',
      });
    } else {
      results.push({
        layer: 'L3',
        item: 'codegraph 探针查询',
        status: 'checkpoint',
        detail: '探针查询失败，请确认 codegraph CLI 可用且索引已构建',
      });
    }
  }

  // L3: superpowers 项目目录（只检测不创建）
  const superpowersDir = path.join(projectRoot, 'docs', 'superpowers');
  if (existsSync(superpowersDir) && statSync(superpowersDir).isDirectory()) {
    results.push({ layer: 'L3', item: 'superpowers 项目目录', status: 'ready', detail: 'docs/superpowers/ 已存在' });
  } else {
    results.push({
      layer: 'L3',
      item: 'superpowers 项目目录',
      status: 'checkpoint',
      detail: 'docs/superpowers/ 目录缺失（superpowers 规格驱动工作流）；只检测不自动创建',
    });
  }

  return results;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // D3/I-3：--name=<v> 与 --name <v> 两形态均支持（docs/INSTALL.md 契约），但单值 flag
  // 只允许出现一次——重复即抛 DuplicateFlagError（runMain 统一转 ARG_INVALID / exit 2），
  // 杜绝旧 getArg 的 last-wins。
  const getArg = (name: string): string | undefined => {
    const prefix = `--${name}`;
    const eqArgs = args.filter((a) => a.startsWith(`${prefix}=`));
    const spaceArgs = args.filter((a) => a === prefix);
    const occurrences = eqArgs.length + spaceArgs.length;
    if (occurrences > 1) throw new DuplicateFlagError(name);
    if (eqArgs.length === 1) return eqArgs[0]!.slice(prefix.length + 1);
    return spaceArgs.length === 1 ? args[args.indexOf(prefix) + 1] : undefined;
  };

  const phaseStr = getArg('phase');
  const projectRoot = getArg('project-root');
  const modeStr = getArg('mode') as Mode | undefined;

  if (!phaseStr || !projectRoot || !modeStr) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 --phase/--project-root/--mode',
      detail: '用法: npx tsx ensure-codegraph.ts --phase <5|6|7|8> --project-root <path> --mode <full|quick|light>',
      exitCode: 2,
    });
    return;
  }

  // 统一 --phase 校验（lib/parse-phase.ts，5-8）：值与重复检测同源（--phase=N / --phase N）
  const phaseParsed = parsePhaseArg(process.argv, { min: 5, max: 8 });
  if (phaseParsed === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
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
      rule: 'P0-1',
      message: 'mode 必须为 full/quick/light',
      detail: `收到 ${modeStr}`,
      exitCode: 2,
    });
    return;
  }

  const absRoot = path.resolve(projectRoot);
  // 项目根不存在 → FILE_NOT_FOUND（exit 2 输入错误守卫，非 violation 语义）
  // light 模式仅做 L1 CLI/宿主技能检查、不触碰 projectRoot，跳过项目根存在性检查（保持旧行为）
  if (modeStr !== 'light') {
    if (!existsSync(absRoot) || !statSync(absRoot).isDirectory()) {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '项目根路径不存在或不是目录',
        file: absRoot,
        exitCode: 2,
      });
      return;
    }
  }
  const results = ensureDeps(phase, absRoot, modeStr);
  const hasCheckpoint = results.some((r) => r.status === 'checkpoint');

  console.log('═'.repeat(60));
  console.log('codegraph（CLI 依赖）+ superpowers 方法论检测');
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
  console.log(
    'ENSURE_DEPS_JSON ' +
      JSON.stringify({
        type: 'ensure-deps',
        phase,
        mode: modeStr,
        passed: !hasCheckpoint,
        exitCode,
        results,
      }),
  );

  process.exitCode = exitCode;
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
