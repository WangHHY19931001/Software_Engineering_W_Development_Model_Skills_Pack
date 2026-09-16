#!/usr/bin/env tsx
/**
 * 污染源定位脚本（Pollution Locator，S24）—— 二分定位工作区内的测试污染残留
 *
 * 对应 w-model-dev/references/root-cause-locator.md（污染源二分定位）与 SSoT §10.5
 * 「污染源定位（S24，按需工具）」行。
 *
 * ⚠️ 按需工具声明：本脚本**只作按需工具，不得当门禁**（规格 :187/:305）——
 * 不进 pre-push 18 项（`prePushCount: 18` 不变）、不进任何阶段门；
 * exit 1 = 发现污染源，仅供人工二分定位参考，不是放行/拒绝依据。
 *
 * 「吞掉测试失败只看产物」语义（规格 :206，显式注释）：
 * 本工具逐文件检查「存在测试失败痕迹但产物却被判通过」的形态。残留即痕迹：
 * `.w-model/*.lock` 是 wm-write 持久锁残留、`coverage/` 是覆盖率工具运行痕迹、
 * vitest `--outputFile` JSON 是测试结果产物——它们存在而产物被判通过，
 * 说明失败信号被吞掉、只留下了产物。本工具列出这些痕迹，供污染源二分定位；
 * 判据纯函数见 logic/pollution-logic.ts。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-pollution.ts [--project=<dir>]
 *
 * 参数：
 *   --project   待检查的项目目录（仅等号形态 --project=<dir>；缺省取 cwd）
 *
 * 退出码：
 *   0  干净（stdout 单行 `POLLUTION_JSON` 摘要，passed=true）
 *   1  发现污染源（逐项列出 ✗ 行 + `POLLUTION_JSON` 摘要，passed=false）
 *   2  输入错误（未知/重复 flag、`--project` 不存在或非目录；ERROR_JSON，零副作用）
 *
 * 输出：stdout 单行 `POLLUTION_JSON {type,passed,project,findings,findingCount,exitCode}`；
 * 本脚本只读（零写入），扫描剪除 `node_modules/` 与 `.git/`。
 */

import { promises as fs, type Dirent } from 'node:fs';
import * as path from 'node:path';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { parseFlagValue } from '../lib/parse-args.js';
import { classifyRelativeEntry, shouldPruneDir, type PollutionFinding } from '../logic/pollution-logic.js';

/** 递归扫描项目目录（只读；覆盖目录整体单条列出、锁目录不再下钻、剪除 node_modules/.git） */
async function scanProject(root: string): Promise<PollutionFinding[]> {
  const findings: PollutionFinding[] = [];
  async function walk(absDir: string, relPrefix: string): Promise<void> {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absDir 为只读扫描根（--project 校验后）的受控递归，剪除 node_modules/.git，全程零写入
    const entries: Dirent[] = await fs.readdir(absDir, { withFileTypes: true });
    // 排序保证发现顺序确定（同输入同输出，可复现二分）
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (shouldPruneDir(entry.name)) continue;
        const classified = classifyRelativeEntry(rel);
        if (classified !== null) {
          // 目录级残留（coverage/ 或 *.lock 锁目录）：单条列出后不再下钻（内容细节对二分无益）
          findings.push(classified);
          continue;
        }
        await walk(path.join(absDir, entry.name), rel);
        continue;
      }
      // 文件 / 符号链接：逐文件分类（「吞掉测试失败只看产物」的逐文件语义）
      const classified = classifyRelativeEntry(rel);
      if (classified !== null) findings.push(classified);
    }
  }
  await walk(root, '');
  return findings;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // 值 flag 统一 parseFlagValue（等号形态；重复 → DuplicateFlagError → runMain ARG_INVALID）
  const projectStr: string | undefined = parseFlagValue(args, 'project');

  // 输入校验先于任何扫描（零副作用；本工具本身也只读）
  const unknownFlags = args.filter((a) => a.startsWith('--') && !a.startsWith('--project='));
  if (unknownFlags.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `未知参数 ${unknownFlags.join(' ')}`,
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-pollution.ts [--project=<dir>]（--project 仅支持等号形态）',
      exitCode: 2,
    });
    return;
  }
  const positionals = args.filter((a) => !a.startsWith('--'));
  if (positionals.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `多余的位置参数 ${positionals.join(' ')}`,
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-pollution.ts [--project=<dir>]（本脚本只接受 flag 形态）',
      exitCode: 2,
    });
    return;
  }
  if (projectStr !== undefined && projectStr.trim() === '') {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--project 不能为空',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-pollution.ts [--project=<dir>]',
      exitCode: 2,
    });
    return;
  }

  const projectDir = projectStr === undefined ? process.cwd() : path.resolve(projectStr);
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- projectDir 为 --project 显式参数或 cwd（输入错误已在上方 exit 2 拒绝），仅作存在性探测
    const stat = await fs.stat(projectDir);
    if (!stat.isDirectory()) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '--project 不是目录',
        file: projectDir,
        detail: projectStr ?? '',
        exitCode: 2,
      });
      return;
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    exitWithError({
      category: e.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ',
      rule: e.code === 'ENOENT' ? 'P0-2' : 'P0-3',
      message: e.code === 'ENOENT' ? '--project 目录不存在' : '--project 目录读取失败',
      file: projectDir,
      detail: e.code ?? '未知错误',
      exitCode: 2,
    });
    return;
  }

  const findings = await scanProject(projectDir);
  const exitCode = findings.length === 0 ? 0 : 1;

  // 逐项列出（人类可读，✗ 前缀；干净时不输出任何 ✗ 行）
  for (const f of findings) {
    console.log(`✗ [${f.kind}] ${f.path} — ${f.reason}`);
  }

  // 单行 JSON 摘要（0/1 两态同形；exitCode 恒等于 process.exitCode，§10E E.1）
  console.log(
    `POLLUTION_JSON ${JSON.stringify({
      type: 'pollution',
      passed: findings.length === 0,
      project: projectDir,
      findings,
      findingCount: findings.length,
      exitCode,
    })}`,
  );
  process.exitCode = exitCode;
}

// 统一入口（lib/run-main.ts）：main().catch 统一为 UNEXPECTED + exit 2；exitWithError 已完成输出则静默退出
runMain(main);
