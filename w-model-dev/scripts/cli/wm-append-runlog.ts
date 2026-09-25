#!/usr/bin/env node
/**
 * run-log 追加器（wm-append-runlog）—— O 侧唯一 run-log 追加入口（D-5①/N-5）
 *
 * 背景：技能包此前只有 `wm-write.ts`（整文件原子写，无追加语义），真实调测中每个项目各自手搓
 * 追加脚本，出现「静默改写时间戳」一类回溯改写。本脚本把「禁止回溯改写」变成可执行契约：
 *
 *   - 时间戳**严格递增**：显式时间戳（记录自带 `timestamp` 或 `--timestamp=<iso>`）≤ 末条时间
 *     → exit 1 写入拒绝（文案含「时间戳不递增」+ 末条时间 + 建议），目标文件不被修改；
 *   - 无条件来源（无显式时间戳）用当前时间派生；≤ 末条时间时步进到末条 +1ms，并在 `diagnostics`
 *     明示「时钟调整 +Nms」、在记录 `note` 追加 `clock-adjust:auto+<N>ms`（绝不静默调整）；
 *   - `--timestamp=<iso>` 注入成功 → 记录 `note` 追加 `clock-injected:<iso>`；
 *   - `--allow-clock-adjust=<reason>` 显式声明小步进 → 步进到末条 +1ms 且记录 `note` 追加
 *     `clock-adjust:<reason>`（非空理由，禁止静默）；
 *   - `--correct=<runId>` 只**新增**一条更正记录（`note` 含 `correction-of:<runId>`），历史行不删不改；
 *     runId 不存在 → exit 2 输入错误。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/wm-append-runlog.ts <run-log.jsonl> --stdin
 *   npx tsx w-model-dev/scripts/cli/wm-append-runlog.ts <run-log.jsonl> --from <src.json|src.jsonl>
 *   npx tsx w-model-dev/scripts/cli/wm-append-runlog.ts <run-log.jsonl> --stdin --correct=<runId>
 *     [--timestamp=<iso>] [--allow-clock-adjust=<reason>] [--lock-timeout=<ms>] [--json]
 *
 * 参数（值 flag 同时支持 `--flag <value>` 与 `--flag=<value>`；同一 flag 只允许出现一次）：
 *   run-log.jsonl                目标追加文件（缺失则视为空日志，首条记录自举创建）
 *   --stdin                       从 stdin 读载荷
 *   --from <src.json|src.jsonl>   从文件读载荷：JSON 记录 / JSON 数组 / JSONL 均可
 *   --correct=<runId>             更正既有记录：载荷为单条 patch（可省略，等价空 patch）
 *   --timestamp=<iso>             显式注入时间戳（记录 note 留 clock-injected 痕迹）
 *   --allow-clock-adjust=<reason> 显式声明小步进（记录 note 留 clock-adjust 痕迹）
 *   --lock-timeout=<ms>           跨进程锁等待超时（非负安全整数毫秒）
 *   --json                        追加成功后输出扩展摘要（diagnostics / writtenPath / backupPath）
 *   --help                        打印用法
 *
 * 写盘（复用 wm-write 同款机制，不另造）：`logic/state-write-logic.ts` 的 `<target>.lock` 跨进程锁 +
 * 备份 + tmp/rename + 回读；历史行按原文本**逐字节**保留（不经 JSON 再序列化），只追加新行。
 * 读取与写入之间用 `expectMtimeMs` 兜住「读后被他人追加」的并发窗口（MTIME_CONFLICT → exit 1，
 * 宁可拒绝不可丢记录）；残余窗口仅为「读取时目标不存在、写入前被他方创建」的创建竞争。
 * 目标为已注册状态路径（`.w-model/run-log.jsonl`）时，原子写会对**全文件**逐行重校 schema：
 * 历史行若不符当前 schema（如更早版本写入的 legacy 形状）→ exit 1 SCHEMA_INVALID（目标未修改）。
 *
 * 退出码：
 *   0  追加成功（stdout 单行 RUNLOG_APPEND_JSON {lines, appended, digest}；`--json` 附扩展键）
 *   1  写入拒绝（TIMESTAMP_NOT_INCREASING / LOCK_TIMEOUT / STALE_LOCK / MTIME_CONFLICT /
 *      WRITE_VERIFY_FAILED / SCHEMA_INVALID / UNREGISTERED_TARGET；stdout 单行
 *      RUNLOG_APPEND_JSON {ok:false,...}，stderr 人类可读；目标未被修改）
 *   2  输入错误（参数非法 / 载荷非 JSON 或非对象 / 记录不符 run-log schema / --correct 引用
 *      不存在的 runId；stderr 人类可读，stdout ERROR_JSON）
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { DuplicateFlagError } from '../lib/parse-args.js';
import { runMain } from '../lib/run-main.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { composeAppendedText, countRecordLines, digestOf, readRunLogFile } from '../lib/run-log-append-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import {
  planAppend,
  planCorrection,
  isIsoTimestamp,
  type AppendPlan,
  type AppendViolationCode,
  type RunLogRecord,
} from '../logic/run-log-append-logic.js';
import { writeStateJson } from '../logic/state-write-logic.js';

const USAGE =
  '用法: wm-append-runlog.ts <run-log.jsonl> [--from <src.json|src.jsonl> | --stdin] [--correct=<runId>] ' +
  '[--timestamp=<iso>] [--allow-clock-adjust=<reason>] [--lock-timeout=<ms>] [--json]';

/** 写盘拒绝原因 → 人类可读消息（Map 而非对象字面量：键为运行时字符串，避免 variable-key 索引） */
const REASON_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['MTIME_CONFLICT', '目标 mtime 在读取后发生变化（可能有并发追加），写入已拒绝；重读目标后重试（宁可拒绝不可丢记录）'],
  ['TARGET_MISSING_FOR_MTIME', '目标文件在读取后被删除，写入已拒绝；重读后重试'],
  ['LOCK_TIMEOUT', '等待 run-log 跨进程锁超时，写入已拒绝'],
  ['STALE_LOCK', '检测到陈旧 run-log 锁，写入已拒绝；可用 wm-write.ts 对同一目标的 --recover-stale-lock 显式恢复'],
  ['WRITE_VERIFY_FAILED', '写后回读校验失败（内容不一致），请检查磁盘/杀软拦截后重试'],
  ['SCHEMA_INVALID', '写入后文件不符 run-log schema（含历史行逐行重校；历史 legacy 行需先治理），写入已拒绝'],
  ['UNREGISTERED_TARGET', '目标 .w-model 状态路径未注册 Schema，写入已拒绝（run-log 应为 .w-model/run-log.jsonl）'],
]);

/** 输入错误类 violation 码 → exit 2 的错误类别（其余码一律 exit 1 写入拒绝） */
function inputErrorCategory(code: AppendViolationCode): 'ARG_INVALID' | 'STRUCTURE_INVALID' | undefined {
  switch (code) {
    case 'UNKNOWN_RUN_ID':
    case 'TIMESTAMP_CONFLICT':
      return 'ARG_INVALID';
    case 'EMPTY_APPEND':
    case 'DUPLICATE_RUN_ID':
    case 'TIMESTAMP_INVALID':
    case 'NOTE_INVALID':
    case 'RECORD_INVALID':
      return 'STRUCTURE_INVALID';
    default:
      return undefined;
  }
}

function exitArgInvalid(message: string, detail = USAGE): never {
  exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message, detail, exitCode: 2 });
  throw new HandledCliError();
}

interface CliArgs {
  targetArg?: string;
  useStdin: boolean;
  fromArg?: string;
  correctRunId?: string;
  timestamp?: string;
  allowClockAdjust?: string;
  lockTimeoutMs?: number;
  json: boolean;
}

/** 从 `--flag=value` / `--flag value` 两种形态解析值（值缺失或为空串 → ARG_INVALID） */
function takeValue(name: string, inlineValue: string | undefined, next: () => string | undefined): string {
  const value = inlineValue !== undefined ? inlineValue : next();
  if (value === undefined || value === '') exitArgInvalid(`--${name} 缺少值`);
  return value;
}

function parseArgs(args: readonly string[]): CliArgs {
  const parsed: CliArgs = { useStdin: false, json: false };
  const seenFlags = new Set<string>();
  const countFlag = (name: string): void => {
    if (seenFlags.has(name)) throw new DuplicateFlagError(name);
    seenFlags.add(name);
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args.at(index)!;
    if (!arg.startsWith('--')) {
      if (arg.startsWith('-')) exitArgInvalid(`未知选项: ${arg}`);
      if (parsed.targetArg !== undefined) exitArgInvalid(`未知额外位置参数: ${arg}`);
      parsed.targetArg = arg;
      continue;
    }
    const equalsAt = arg.indexOf('=');
    const name = equalsAt === -1 ? arg.slice(2) : arg.slice(2, equalsAt);
    const inlineValue = equalsAt === -1 ? undefined : arg.slice(equalsAt + 1);
    const next = (): string | undefined => args.at(++index);
    switch (name) {
      case 'stdin':
        countFlag('stdin');
        if (inlineValue !== undefined) exitArgInvalid('--stdin 不接受值');
        parsed.useStdin = true;
        break;
      case 'from':
        countFlag('from');
        parsed.fromArg = takeValue('from', inlineValue, next);
        break;
      case 'correct':
        countFlag('correct');
        parsed.correctRunId = takeValue('correct', inlineValue, next);
        break;
      case 'timestamp': {
        countFlag('timestamp');
        const value = takeValue('timestamp', inlineValue, next);
        if (!isIsoTimestamp(value)) exitArgInvalid('--timestamp 需为合法 ISO 8601 date-time', `收到: ${value}`);
        parsed.timestamp = value;
        break;
      }
      case 'allow-clock-adjust':
        countFlag('allow-clock-adjust');
        parsed.allowClockAdjust = takeValue('allow-clock-adjust', inlineValue, next);
        break;
      case 'lock-timeout': {
        countFlag('lock-timeout');
        const raw = inlineValue !== undefined ? inlineValue : next();
        const num = raw === undefined ? NaN : Number(raw);
        if (raw === undefined || !/^\d+$/.test(raw) || !Number.isSafeInteger(num) || num < 0) {
          exitArgInvalid('--lock-timeout 需为非负安全整数（毫秒）', raw === undefined ? '（缺少值）' : `收到: ${raw}`);
        }
        parsed.lockTimeoutMs = num;
        break;
      }
      case 'json':
        countFlag('json');
        if (inlineValue !== undefined) exitArgInvalid('--json 不接受值');
        parsed.json = true;
        break;
      default:
        exitArgInvalid(`未知选项: --${name}`);
    }
  }
  return parsed;
}

/** 解析载荷文本：整段 JSON 记录 / JSON 数组 / JSONL（逐行记录对象） */
function parsePayload(text: string, source: string): RunLogRecord[] {
  if (text.trim() === '') return [];
  try {
    const parsed = parseJsonSafe<unknown>(text.trim());
    if (Array.isArray(parsed)) return parsed as RunLogRecord[];
    if (typeof parsed === 'object' && parsed !== null) return [parsed as RunLogRecord];
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-3',
      message: '载荷 JSON 必须是记录对象或记录数组',
      file: source,
      exitCode: 2,
    });
    throw new HandledCliError();
  } catch (error) {
    if (error instanceof HandledCliError) throw error;
    // 非整段 JSON → 按 JSONL 逐行解析
  }
  const records: RunLogRecord[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    if (rawLine.trim() === '') continue;
    let value: unknown;
    try {
      value = parseJsonSafe(rawLine);
    } catch {
      exitWithError({
        category: 'FILE_PARSE',
        rule: 'P0-3',
        message: '载荷行不是合法 JSON',
        file: source,
        field: `第 ${index + 1} 行`,
        exitCode: 2,
      });
      throw new HandledCliError();
    }
    records.push(value as RunLogRecord);
  }
  return records;
}

/** 逐条 schema 校验记录：不符即 exit 2 输入错误（结构错误优先于时间戳/写入判定） */
function assertRecordsValid(records: readonly RunLogRecord[], source: string, label: string): void {
  for (const [index, record] of records.entries()) {
    const result = validateBySchema('run-log', record);
    if (result.valid) continue;
    const first = result.errors?.[0];
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-3',
      message: `${label}第 ${index + 1} 条记录不符 run-log schema`,
      file: source,
      field: `records[${index}]${first?.instancePath ?? ''}`,
      detail: `${first?.message ?? result.errorMessages[0] ?? '未知 schema 错误'} [${first?.keyword ?? 'schema'}]`,
      exitCode: 2,
    });
    throw new HandledCliError();
  }
}

/** 逐条 schema 校验**计划新增**的记录（含 --correct 合并后的记录）：不符即 exit 2 输入错误 */
function assertPlannedRecordsValid(plan: AppendPlan, source: string): void {
  assertRecordsValid(plan.entries.slice(plan.entries.length - plan.appended), source, '待追加的');
}

/**
 * 结构预校验副本：载荷记录可省略 `timestamp`（由本工具按严格递增契约填充），但 run-log schema
 * 把 timestamp 列为必填。为让「缺字段 / 类型错误」这类结构错误先于时间戳单调性判定暴露
 * （仓库口径：结构校验先于业务规则，见 `lib/load-and-validate.ts`），把工具会采用的生效来源
 * （`--timestamp` 或 `now`）填入**校验副本**——副本不写盘，真正写入的时间戳仍由 `planAppend` 决定。
 */
function structuralValidationCopies(records: readonly RunLogRecord[], fallbackTimestamp: string): RunLogRecord[] {
  return records.map((record) =>
    typeof record === 'object' && record !== null && !Array.isArray(record) && record.timestamp === undefined
      ? { ...record, timestamp: fallbackTimestamp }
      : record,
  );
}

function emitRejection(plan: AppendPlan, absTarget: string, existingLines: number): void {
  const inputCode = plan.violationCodes.find((code) => inputErrorCategory(code) !== undefined);
  if (inputCode !== undefined) {
    // 输入错误按仓库 exit-2 口径输出：stderr 人类可读 + stdout 单行 ERROR_JSON（不再叠加工具摘要行）
    exitWithError({
      category: inputErrorCategory(inputCode)!,
      rule: 'P0-3',
      message: plan.violations.join('；'),
      file: absTarget,
      exitCode: 2,
    });
    return;
  }
  console.log(
    'RUNLOG_APPEND_JSON ' +
      JSON.stringify({
        ok: false,
        reason: plan.violationCodes[0] ?? 'APPEND_REJECTED',
        lines: existingLines,
        appended: 0,
        violations: plan.violations,
        diagnostics: plan.diagnostics,
        writtenPath: absTarget,
      }),
  );
  console.error(`✗ [WRITE_REJECTED] ${plan.violations.join('；')}: ${absTarget}`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }

  const parsed = parseArgs(args);
  // 单点生效时刻：结构预校验副本与 planAppend 的 now 派生共用同一时刻，避免两次取时钟产生歧义
  const now = new Date().toISOString();
  if (parsed.targetArg === undefined) exitArgInvalid('缺少 <run-log.jsonl> 参数');
  const absTarget = path.resolve(parsed.targetArg);
  if (parsed.useStdin && parsed.fromArg !== undefined) exitArgInvalid('--stdin 与 --from 互斥');
  if (!parsed.useStdin && parsed.fromArg === undefined && parsed.correctRunId === undefined) {
    exitArgInvalid('必须指定内容来源：--stdin 或 --from <src.json|src.jsonl>（--correct 单独使用时可为空 patch）');
  }

  // 载荷：--correct 单独使用 → 空 patch；否则必须有内容来源
  let payloadText = '';
  let sourceLabel = '<stdin>';
  if (parsed.useStdin) {
    payloadText = readFileSync(0, 'utf-8');
  } else if (parsed.fromArg !== undefined) {
    const absFrom = path.resolve(parsed.fromArg);
    sourceLabel = absFrom;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 载荷源路径来自 CLI 参数并用 path.resolve 归一（读取调用方指定文件是工具契约）
      payloadText = await fs.readFile(absFrom, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          rule: 'P0-2',
          message: '源文件不存在',
          file: absFrom,
          exitCode: 2,
        });
        return;
      }
      throw error;
    }
  }

  const incoming = parsePayload(payloadText, sourceLabel);
  if (parsed.correctRunId !== undefined && incoming.length > 1) {
    exitArgInvalid('--correct 只接受单条 patch 记录', `收到 ${incoming.length} 条`);
  }
  if (parsed.correctRunId !== undefined && incoming[0] !== undefined) {
    const patch = incoming[0];
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
      exitArgInvalid('--correct 的 patch 须为 JSON 对象');
    }
  }
  // 普通追加：载荷必须是完整 run-log 记录 → 结构错误先于时间戳/写入判定（--correct 的 patch
  // 是局部覆盖，只能对「合并后的记录」校验，见 assertPlannedRecordsValid）
  if (parsed.correctRunId === undefined && incoming.length > 0) {
    assertRecordsValid(structuralValidationCopies(incoming, parsed.timestamp ?? now), sourceLabel, '载荷');
  }

  const read = await readRunLogFile(absTarget);
  if (!read.ok) {
    exitWithError({
      category: read.category,
      rule: 'P0-3',
      message: read.message,
      file: absTarget,
      field: `第 ${read.line} 行`,
      exitCode: 2,
    });
    return;
  }
  const { content } = read;

  const options = {
    now,
    ...(parsed.timestamp !== undefined ? { timestamp: parsed.timestamp } : {}),
    ...(parsed.allowClockAdjust !== undefined ? { allowClockAdjust: parsed.allowClockAdjust } : {}),
  };
  const plan =
    parsed.correctRunId !== undefined
      ? planCorrection(content.entries, parsed.correctRunId, incoming[0] ?? {}, options)
      : planAppend(content.entries, incoming, options);

  if (!plan.accepted) {
    emitRejection(plan, absTarget, content.entries.length);
    return;
  }

  assertPlannedRecordsValid(plan, sourceLabel);

  const appendedRecords = plan.entries.slice(plan.entries.length - plan.appended);
  const text = composeAppendedText(content.text, appendedRecords);
  const lines = countRecordLines(text);
  const digest = digestOf(text);

  // 读取与写入之间用 mtime 兜住并发追加窗口（读取时不存在则不做 mtime 校验）
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 目标路径来自 CLI 参数并用 path.resolve 归一（追加目标即调用方指定文件）
  const expectMtimeMs = content.exists ? (await fs.stat(absTarget)).mtimeMs : null;
  const result = await writeStateJson(absTarget, text, {
    backup: true,
    allowImplicitStaleRecovery: false,
    expectMtimeMs,
    ...(parsed.lockTimeoutMs !== undefined ? { lockTimeoutMs: parsed.lockTimeoutMs } : {}),
  });

  if (!result.ok) {
    const reason = result.reason ?? 'UNKNOWN';
    console.log(
      'RUNLOG_APPEND_JSON ' +
        JSON.stringify({
          ok: false,
          reason,
          lines: content.entries.length,
          appended: 0,
          violations: [REASON_MESSAGES.get(reason) ?? reason],
          diagnostics: plan.diagnostics,
          writtenPath: absTarget,
          ...(result.schemaInvalidLine !== undefined ? { schemaInvalidLine: result.schemaInvalidLine } : {}),
        }),
    );
    console.error(`✗ [WRITE_REJECTED] ${REASON_MESSAGES.get(reason) ?? reason}: ${absTarget}`);
    process.exitCode = 1;
    return;
  }

  const summary: Record<string, unknown> = { lines, appended: plan.appended, digest };
  if (parsed.json) {
    summary.ok = true;
    summary.writtenPath = absTarget;
    summary.diagnostics = plan.diagnostics;
    if (result.backupPath !== undefined) summary.backupPath = result.backupPath;
  }
  console.log('RUNLOG_APPEND_JSON ' + JSON.stringify(summary));
  for (const diagnostic of plan.diagnostics) console.error(`⚠ ${diagnostic}`);
}

runMain(main);
