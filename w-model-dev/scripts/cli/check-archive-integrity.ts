#!/usr/bin/env tsx
/**
 * 归档完整性校验脚本（Archive Integrity Checker）
 *
 * 归档完整性强制快照清单由本脚本校验（清单定义见 archive-integrity-logic.ts）。
 * 供阶段 8 归档时调用，校验归档目录是否包含各阶段强制快照文件。
 *
 * 自 check-openspec-archive 退役起（superpowers 替换批次 1），本脚本并入「归档后置校验」：
 * 归档根含恰一 `*.plan.md` 时自动启用 codingPlanSnapshot 清单项（manifest 由
 * deriveArchiveIntegrityManifest 从归档内容推导），校验编码计划归档快照
 * （`<changeId>.plan.md` + `progress.md` + `Task N: complete` 三件套；`Task N: complete` 判定与
 * check-coding-plan 同源（共享纯函数 extractCompletedTaskNumbers），归档快照校验为其结构子集，
 * 全量契约由 check-coding-plan R4/R6 承担）；legacy 归档（无 *.plan.md）零行为变化。
 *
 * 显式入口（2026-09-21 最终评审 I-4）：自动派生以「归档根恰一 *.plan.md」为判据，生产者把 plan
 * 快照摆到子目录即可把该项静默关成 no-op（fail-open）。`--change-id=<id>` 让调用方**显式声明**
 * 「本归档属于哪个 changeId」，从而不依赖生产者摆放：显式声明时无条件启用 codingPlanSnapshot 并
 * 锚定 `<changeId>.plan.md`（缺失即 exit 1）。未传时维持既有自动派生行为，并在输出注明判定依据。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts <archive-dir> [--change-id=<id>] [--live-run-log=<path>]
 *
 * 参数：
 *   archive-dir   归档目录路径
 *   --change-id=<id>  显式声明本归档目录所属 changeId（仅等号形态）；与自动派生互斥，显式优先
 *   --live-run-log=<path>  live run-log.jsonl 路径（仅等号形态，L4）：提供时校验归档快照
 *                      `run-log.jsonl` 是 live 的**记录边界前缀**，否则 `[runLogPrefix]` 并入 missingFiles
 *                      （blocking / exit 1）；**未提供时只输出非阻断诊断**（退出码语义不变）。
 *                      完整判据与违规分类见 `references/command-reference.md`「归档后置校验（阶段 8）」节「归档前缀性」条
 *   （隐式读取）归档根 `archive-manifest.json`：存在时其实读文本注入 logic 做 G3-14 绝对路径诊断；
 *                      缺失/不可读 = 未提供清单（本诊断零输出，不是门禁失败）
 *   --json        机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse，含 diagnostics 非阻断诊断键）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过
 *   1  完整性缺失（missingFiles 列出缺失文件；含 [runLogPrefix] 归档前缀性违规）
 *   2  输入错误（目录不存在 / --live-run-log 路径不存在或参数非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 非阻断诊断 + 收尾 ARCHIVE_INTEGRITY_JSON 摘要，便于 Agent 正则截取）
 *   非阻断诊断（G3-14）：归档根 `archive-manifest.json` 的 `files[]` 条目中含疑似本机绝对路径
 *   （含 `\`，或以盘符 / `/` 开头）的计数 >0 时，输出「归档清单含 N 条疑似本机绝对路径条目——交付前须经
 *   wm-export-evidence 脱敏导出（归档仅受控留档）」；`--json` 的 `diagnostics` 键透传（**仅在非空时出现**，
 *   同 check-maturity / check-budget 口径）。未提供清单（文件缺失/不可读）或 0 命中时不打印；
 *   纯诊断，不进 missingFiles、不改退出码。
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、<archive-dir>
 * 退出码：0=通过 / 1=校验失败（missingFiles）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs, type Dirent } from 'node:fs';
import * as path from 'node:path';

import { checkArchiveIntegrity, deriveArchiveIntegrityManifest } from '../logic/archive-integrity-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { parseFlagValue } from '../lib/parse-args.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

// ==================== 目录遍历 ====================

async function walkDir(dirAbs: string, baseDir: string): Promise<Set<string>> {
  const result = new Set<string>();
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const fullPath = path.join(dirAbs, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      result.add(relPath + '/');
      const subResults = await walkDir(fullPath, baseDir);
      for (const sub of subResults) {
        result.add(sub);
      }
    } else {
      result.add(relPath);
    }
  }
  return result;
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）；--json 不入位置参数
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const startTime = Date.now();
  const archiveDir = argv.find((a) => !a.startsWith('--'));
  if (!archiveDir) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <archive-dir>',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts <archive-dir> [--change-id=<id>] [--live-run-log=<path>] [--json]',
      exitCode: 2,
    });
    return;
  }

  // 裸 `--change-id`（空格形态）会让值被位置参数扫描吞掉（被当作 <archive-dir>），必须显式拒绝
  if (argv.includes('--change-id')) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--change-id 仅支持等号形态（--change-id=<id>）',
      detail: '空格形态会把值当作 <archive-dir> 位置参数，故拒绝；用法: --change-id=<changeId>',
      exitCode: 2,
    });
    return;
  }

  // L4 同款形态约束：裸 --live-run-log 的值会被位置参数扫描吞掉（被当作 <archive-dir>）
  if (argv.includes('--live-run-log')) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--live-run-log 仅支持等号形态（--live-run-log=<path>）',
      detail: '空格形态会把值当作 <archive-dir> 位置参数，故拒绝；用法: --live-run-log=<path>',
      exitCode: 2,
    });
    return;
  }

  // 显式 changeId（I-4）：不依赖生产者摆放，无条件启用 codingPlanSnapshot 并锚定 <changeId>.plan.md。
  // 值 flag 只允许等号形态；重复出现由 parseFlagValue 抛 DuplicateFlagError（runMain → ARG_INVALID / exit 2）。
  const explicitChangeId = parseFlagValue(argv, 'change-id');
  if (explicitChangeId !== undefined && explicitChangeId.trim() === '') {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--change-id 取值不得为空',
      detail: '用法: --change-id=<changeId>（如 --change-id=phase5-demo）',
      exitCode: 2,
    });
    return;
  }

  // L4：live run-log 路径（仅等号形态；重复出现由 parseFlagValue 抛 DuplicateFlagError → exit 2）
  const explicitLiveRunLog = parseFlagValue(argv, 'live-run-log');
  if (explicitLiveRunLog !== undefined && explicitLiveRunLog.trim() === '') {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--live-run-log 取值不得为空',
      detail: '用法: --live-run-log=<path>（如 --live-run-log=.w-model/run-log.jsonl）',
      exitCode: 2,
    });
    return;
  }

  const archiveAbs = path.resolve(archiveDir);
  try {
    await fs.access(archiveAbs);
  } catch {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '目录不存在',
      file: archiveAbs,
      exitCode: 2,
    });
    return;
  }

  const contents = await walkDir(archiveAbs, archiveAbs);

  // G3-14：归档清单（`archive-manifest.json`）实读——存在才注入 logic（zero-fs：文本注入，仿 liveRunLogText 先例）。
  // 缺失/不可读 = 未提供清单 → 本诊断零输出（非阻断；归档清单本身不是本门禁的强制快照项）。
  let archiveManifestText: string | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path 由受控 archiveAbs（main 入参 resolve 后）拼接的固定子路径
    archiveManifestText = await fs.readFile(path.join(archiveAbs, 'archive-manifest.json'), 'utf-8');
  } catch {
    // 未提供清单：不注入（零输出）
  }

  // 编码计划归档快照条件项：显式 --change-id 优先（无条件启用）；未传时按归档根恰一 *.plan.md 自动派生
  const manifest =
    explicitChangeId === undefined
      ? deriveArchiveIntegrityManifest(contents)
      : { codingPlanSnapshot: true, changeId: explicitChangeId };
  const snapshotSource =
    explicitChangeId === undefined
      ? `自动派生（归档根 *.plan.md ${
          manifest.codingPlanSnapshot === true
            ? manifest.changeId === undefined
              ? '多匹配 → changeId 不猜、fail-closed'
              : `恰一 → changeId=${manifest.changeId}`
            : '零匹配 → 本项不适用（legacy 归档零行为变化）'
        }）`
      : `显式 --change-id=${explicitChangeId}（无条件启用，不依赖生产者摆放）`;
  if (manifest.codingPlanSnapshot === true) {
    // 归档账本快照实读：Task N: complete 三件套核对的内容源；不可读即留空，由清单校验 fail-closed 报违规
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path 由受控 archiveAbs（main 入参 resolve 后）拼接的固定子路径
      manifest.progressMdContent = await fs.readFile(path.join(archiveAbs, 'progress.md'), 'utf-8');
    } catch {
      // progress.md 缺失或不可读 → 不设 progressMdContent，清单校验按缺失/未提供内容报违规
    }
  }
  // L4 归档前缀性：显式声明 --live-run-log 时实读**两侧**文本（logic 层零 fs → 文本注入）。
  // live 侧路径由调用方显式给出：不存在/不可读是**输入错误**（exit 2），不得静默降级为「未提供」；
  // 归档侧 run-log.jsonl 缺失/不可读则不设文本，由前缀性校验 fail-closed 报 [runLogPrefix]。
  let liveRunLogAbs: string | undefined;
  let runLogPrefix: { liveRunLogText: string; archivedRunLogText?: string } | undefined;
  if (explicitLiveRunLog !== undefined) {
    liveRunLogAbs = path.resolve(explicitLiveRunLog);
    let liveText: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- live 路径来自 CLI 显式参数并 path.resolve 归一（读取调用方显式声明的输入是本工具契约）
      liveText = await fs.readFile(liveRunLogAbs, 'utf-8');
    } catch {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: 'live run-log 文件不存在或不可读',
        file: liveRunLogAbs,
        exitCode: 2,
      });
      return;
    }
    let archivedText: string | undefined;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path 由受控 archiveAbs（main 入参 resolve 后）拼接的固定子路径
      archivedText = await fs.readFile(path.join(archiveAbs, 'run-log.jsonl'), 'utf-8');
    } catch {
      // 归档快照缺失/不可读 → 不设文本（fail-closed 由 [runLogPrefix] 承担）
    }
    runLogPrefix = {
      liveRunLogText: liveText,
      ...(archivedText !== undefined ? { archivedRunLogText: archivedText } : {}),
    };
  }
  const result = checkArchiveIntegrity(
    contents,
    undefined,
    manifest,
    runLogPrefix,
    archiveManifestText === undefined ? undefined : { archiveManifestText },
  );
  const prefixSource =
    liveRunLogAbs === undefined
      ? '未提供 --live-run-log（跳过归档 run-log 前缀性校验，非阻断）'
      : result.missingFiles.some((missing) => missing.includes('[runLogPrefix]'))
        ? `已校验（--live-run-log=${liveRunLogAbs}）：✗ 归档前缀性未通过（详见 missingFiles 的 [runLogPrefix] 条目）`
        : `已校验（--live-run-log=${liveRunLogAbs}）：归档 run-log.jsonl 是 live 的记录边界前缀`;
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  // diagnostics（G3-14 归档清单绝对路径披露计数）仅在非空时出现（同 check-maturity / check-budget 口径）
  if (jsonMode) {
    printJsonReport(
      {
        type: 'archive-integrity',
        passed: result.passed,
        reasons: result.missingFiles,
        violations: buildViolationDistribution(result.missingFiles.length),
        snapshotSource,
        runLogPrefix: prefixSource,
        ...(result.diagnostics.length > 0 ? { diagnostics: result.diagnostics } : {}),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('归档完整性校验（Archive Integrity Checker）');
  console.log('═'.repeat(60));
  console.log(`归档目录          : ${archiveAbs}`);
  console.log(`文件数            : ${contents.size}`);
  console.log(`校验阶段          : ${result.checkedPhases.join(', ')}`);
  console.log(`快照判定依据      : ${snapshotSource}`);
  console.log(`归档前缀性        : ${prefixSource}`);
  console.log(`校验结果          : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('归档完整性清单全部通过。');
  } else {
    console.log('缺失文件：');
    for (const missing of result.missingFiles) {
      console.log(`  - ${missing}`);
    }
    console.log('');
    console.log('O 子代理须按上述清单补齐缺失文件后重跑，详见：');
    console.log('  w-model-dev/references/hard-constraints.md（反模式节）#31');
  }

  // 非阻断诊断（G3-14 归档清单绝对路径披露计数）：不影响退出码，但须可见
  // （通过与否都打印——归档允许保留执行证据原貌，交付前须走脱敏导出链）
  if (result.diagnostics.length > 0) {
    console.log('非阻断诊断：');
    for (const d of result.diagnostics) {
      console.log(`  - ${d}`);
    }
  }

  printGateReport(
    'ARCHIVE_INTEGRITY',
    {
      type: 'archive-integrity',
      passed: result.passed,
      missingFiles: result.missingFiles,
      checkedPhases: result.checkedPhases,
      snapshotSource,
      ...(result.diagnostics.length > 0 ? { diagnostics: result.diagnostics } : {}),
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
