#!/usr/bin/env node
/**
 * 状态文件安全写助手（wm-write）
 *
 * 审计修复 A1：SKILL/参考文档承诺的「.bak 备份 + mtime 乐观锁 + 原子替换 + 回读校验」
 * 此前无实现，Agent 只能手写易错版本；本脚本将 logic/state-write-logic.ts 固化为唯一写入口。
 *
 * 用法：
 *   echo '{"k":1}' | npx tsx w-model-dev/scripts/cli/wm-write.ts <target.json> --stdin
 *   npx tsx w-model-dev/scripts/cli/wm-write.ts <target.json> --from <src.json> [--expect-mtime <ms>] [--no-backup] [--lock-timeout <ms>] [--recover-stale-lock]
 *
 * 参数：
 *   target.json             目标状态文件路径（不存在则直接创建）
 *   --stdin                 从 stdin 读入完整 JSON 文本
 *   --from <src.json>       从源文件读入 JSON 文本
 *   --expect-mtime <ms>     乐观锁：期望目标当前 mtimeMs（不符则拒绝写入）
 *   --no-backup             跳过 .bak 备份（默认生成 <name>.bak.YYYYMMDD-HHMM，保留 5 份）
 *   --lock-timeout <ms>     跨进程锁等待超时（非负整数毫秒）
 *   --recover-stale-lock    显式恢复陈旧锁
 *   --help                  打印用法
 *
 * 退出码：
 *   0  写入成功（stdout 单行 WMWRITE_JSON {ok:true,...}）
 *   1  写入拒绝（INVALID_JSON / MTIME_CONFLICT / TARGET_MISSING_FOR_MTIME / WRITE_VERIFY_FAILED / LOCK_TIMEOUT / STALE_LOCK；
 *      stdout 单行 WMWRITE_JSON {ok:false,reason,...}，stderr 人类可读消息；目标未被修改）
 *   2  输入错误（参数非法 / 源文件不存在 / IO 异常；stderr 人类可读，stdout ERROR_JSON）
 *
 * @module
 */
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { writeStateJson } from '../logic/state-write-logic.js';

const USAGE =
  '用法: wm-write.ts <target.json> (--stdin | --from <src.json>) [--expect-mtime <ms>] [--no-backup] [--lock-timeout <ms>] [--recover-stale-lock]';

const REASON_MESSAGES: Record<string, string> = {
  INVALID_JSON: '写入内容不是合法 JSON，已拒绝（目标未修改）',
  MTIME_CONFLICT: '目标 mtime 与 --expect-mtime 不符（可能被并发修改），写入已拒绝；重读目标后按最新 mtime 重试',
  TARGET_MISSING_FOR_MTIME: '指定了 --expect-mtime 但目标文件不存在',
  WRITE_VERIFY_FAILED: '写后回读校验失败（内容不一致），请检查磁盘/杀软拦截后重试',
  LOCK_TIMEOUT: '等待状态文件跨进程锁超时，写入已拒绝',
  STALE_LOCK: '检测到陈旧状态文件锁，写入已拒绝；可使用 --recover-stale-lock 显式恢复',
};

function exitArgInvalid(message: string, detail = USAGE): never {
  exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message, detail, exitCode: 2 });
  throw new HandledCliError();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  let targetArg: string | undefined;
  let useStdin = false;
  let fromArg: string | undefined;
  let expectMtimeMs: number | null = null;
  let lockTimeoutMs: number | undefined;
  let recoverStaleLock = false;
  let backup = true;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    switch (arg) {
      case '--stdin':
        useStdin = true;
        break;
      case '--from':
        fromArg = args[++index];
        if (fromArg === undefined) exitArgInvalid('--from 缺少 <src.json>');
        break;
      case '--expect-mtime': {
        const raw = args[++index];
        const parsed = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          exitArgInvalid(
            '--expect-mtime 需为有限非负数（毫秒时间戳）',
            raw === undefined ? '（缺少值）' : `收到: ${raw}`,
          );
        }
        expectMtimeMs = Math.floor(parsed);
        break;
      }
      case '--lock-timeout': {
        const raw = args[++index];
        const parsed = raw === undefined ? NaN : Number(raw);
        if (raw === undefined || !/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed < 0) {
          exitArgInvalid('--lock-timeout 需为非负安全整数（毫秒）', raw === undefined ? '（缺少值）' : `收到: ${raw}`);
        }
        lockTimeoutMs = parsed;
        break;
      }
      case '--recover-stale-lock':
        recoverStaleLock = true;
        break;
      case '--no-backup':
        backup = false;
        break;
      default:
        if (arg.startsWith('--')) exitArgInvalid(`未知选项: ${arg}`);
        if (targetArg !== undefined) exitArgInvalid(`未知额外位置参数: ${arg}`);
        targetArg = arg;
        break;
    }
  }

  if (targetArg === undefined) exitArgInvalid('缺少 <target.json> 参数');
  const absTarget = path.resolve(targetArg);
  if (useStdin && fromArg !== undefined) exitArgInvalid('--stdin 与 --from 互斥');
  if (!useStdin && fromArg === undefined) exitArgInvalid('必须指定内容来源：--stdin 或 --from <src.json>');

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

  const result = await writeStateJson(absTarget, jsonText, {
    backup,
    expectMtimeMs,
    allowImplicitStaleRecovery: false,
    ...(lockTimeoutMs !== undefined ? { lockTimeoutMs } : {}),
    ...(recoverStaleLock ? { recoverStaleLock: true } : {}),
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

runMain(main);
