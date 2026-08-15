#!/usr/bin/env node
/**
 * 状态文件安全写助手（wm-write）
 *
 * 审计修复 A1：SKILL/参考文档承诺的「.bak 备份 + mtime 乐观锁 + 原子替换 + 回读校验」
 * 此前无实现，Agent 只能手写易错版本；本脚本将 logic/state-write-logic.ts 固化为唯一写入口。
 *
 * 用法：
 *   echo '{"k":1}' | npx tsx w-model-dev/scripts/cli/wm-write.ts <target.json> --stdin
 *   npx tsx w-model-dev/scripts/cli/wm-write.ts <target.json> --from <src.json> [--expect-mtime <ms>] [--no-backup]
 *
 * 参数：
 *   target.json           目标状态文件路径（不存在则直接创建）
 *   --stdin               从 stdin 读入完整 JSON 文本
 *   --from <src.json>     从源文件读入 JSON 文本
 *   --expect-mtime <ms>   乐观锁：期望目标当前 mtimeMs（不符则拒绝写入）
 *   --no-backup           跳过 .bak 备份（默认生成 <name>.bak.YYYYMMDD-HHMM，保留 5 份）
 *   --help                打印用法
 *
 * 退出码：
 *   0  写入成功（stdout 单行 WMWRITE_JSON {ok:true,...}）
 *   1  写入拒绝（INVALID_JSON / MTIME_CONFLICT / TARGET_MISSING_FOR_MTIME / WRITE_VERIFY_FAILED；
 *      stdout 单行 WMWRITE_JSON {ok:false,reason,...}，stderr 人类可读消息；目标未被修改）
 *   2  输入错误（参数非法 / 源文件不存在 / IO 异常；stderr 人类可读，stdout ERROR_JSON）
 *
 * @module
 */
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { exitWithError } from '../lib/cli-error.js';
import { writeStateJson } from '../logic/state-write-logic.js';

const USAGE = '用法: wm-write.ts <target.json> (--stdin | --from <src.json>) [--expect-mtime <ms>] [--no-backup]';

const REASON_MESSAGES: Record<string, string> = {
  INVALID_JSON: '写入内容不是合法 JSON，已拒绝（目标未修改）',
  MTIME_CONFLICT: '目标 mtime 与 --expect-mtime 不符（可能被并发修改），写入已拒绝；重读目标后按最新 mtime 重试',
  TARGET_MISSING_FOR_MTIME: '指定了 --expect-mtime 但目标文件不存在',
  WRITE_VERIFY_FAILED: '写后回读校验失败（内容不一致），请检查磁盘/杀软拦截后重试',
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  const targetArg = args.find((a) => !a.startsWith('--'));
  if (!targetArg) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '缺少 <target.json> 参数',
      detail: USAGE,
      exitCode: 2,
    });
    return;
  }
  const absTarget = path.resolve(targetArg);

  const useStdin = args.includes('--stdin');
  const fromIdx = args.indexOf('--from');
  const fromArg = fromIdx >= 0 ? args[fromIdx + 1] : undefined;
  if (useStdin && fromArg) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--stdin 与 --from 互斥',
      detail: USAGE,
      exitCode: 2,
    });
    return;
  }
  if (!useStdin && !fromArg) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '必须指定内容来源：--stdin 或 --from <src.json>',
      detail: USAGE,
      exitCode: 2,
    });
    return;
  }

  // 读取待写文本（保留原文写入；合法性校验在 logic 层经 parseJsonSafe 完成）
  let jsonText: string;
  if (useStdin) {
    jsonText = readFileSync(0, 'utf-8'); // fd 0 = stdin
  } else {
    const absFrom = path.resolve(fromArg!);
    try {
      jsonText = await fs.readFile(absFrom, 'utf-8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          rule: 'P0-2',
          message: '源文件不存在',
          file: absFrom,
          exitCode: 2,
        });
        return;
      }
      throw err;
    }
  }

  // --expect-mtime <ms>：可选整数
  const mtimeIdx = args.indexOf('--expect-mtime');
  let expectMtimeMs: number | null = null;
  if (mtimeIdx >= 0) {
    const raw = args[mtimeIdx + 1];
    const parsed = raw !== undefined ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed < 0) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '--expect-mtime 需为非负整数（毫秒时间戳）',
        detail: raw === undefined ? '（缺少值）' : `收到: ${raw}`,
        exitCode: 2,
      });
      return;
    }
    expectMtimeMs = Math.floor(parsed);
  }

  const result = await writeStateJson(absTarget, jsonText, {
    backup: !args.includes('--no-backup'),
    expectMtimeMs,
  });

  const summary = {
    script: 'wm-write.ts',
    ok: result.ok,
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
    writtenPath: result.writtenPath,
    ...(result.backupPath !== undefined ? { backupPath: result.backupPath } : {}),
  };
  console.log('WMWRITE_JSON ' + JSON.stringify(summary));

  if (!result.ok) {
    const reason = result.reason ?? 'UNKNOWN';
    console.error(`✗ [WRITE_REJECTED] ${REASON_MESSAGES[reason] ?? reason}: ${absTarget}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
