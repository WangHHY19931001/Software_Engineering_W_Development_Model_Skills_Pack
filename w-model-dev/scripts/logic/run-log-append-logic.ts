/**
 * run-log 追加器纯逻辑（logic/run-log-append-logic.ts，D-5①/N-5）
 *
 * 背景：技能包此前只有 `wm-write.ts`（整文件原子写，无追加语义），真实调测中每个项目各自
 * 手搓追加工具，出现「静默改写时间戳」一类回溯改写。本模块把「禁止回溯改写」变成**可执行契约**：
 * 追加记录的时间戳必须严格递增，任何偏离（显式注入 / 显式小步进 / now 派生步进）都必须在
 * 记录 `note` 或返回的 `diagnostics` 留可复核痕迹，绝不静默调整。
 *
 * 设计原则（与 run-log-logic.ts / budget-logic.ts 一致）：
 *   1. 纯函数：无 I/O、无副作用、零 `node:fs` / `node:path` 导入（真实 IO 在
 *      `lib/run-log-append-fs.ts` 与 `cli/wm-append-runlog.ts`，原子写复用
 *      `logic/state-write-logic.ts` 的锁 + 备份 + tmp/rename + 回读机制）；
 *   2. 单点事实：追加判定（时间戳单调性 / runId 身份 / 更正痕迹）只在本文件；
 *   3. 历史不可变：`entries` 中的历史行始终来自入参 `existing`，本模块不就地修改任何入参对象。
 *
 * 契约（裁定 A / 裁定 B，取值逐字固定）：
 *   - 显式时间戳（记录自带 `timestamp` 或 `--timestamp=<iso>`）≤ 末条时间 → 拒绝
 *     （violation 文案含「时间戳不递增」+ 末条时间 + 建议），除非显式给出
 *     `allowClockAdjust`（对应 `--allow-clock-adjust=<reason>`），此时步进到末条 +1ms
 *     并在记录 `note` 追加 `clock-adjust:<reason>`；
 *   - `--timestamp` 注入成功时在记录 `note` 追加 `clock-injected:<iso>`；
 *   - 无条件来源（无显式时间戳）用 `now` 派生，判据分三层（裁定 A + 控制者裁定 F）：
 *     ① `now` **早于**末条历史时间（时钟真倒退：曾注入未来时间戳 / NTP 回拨 / 跨机拷贝）→ 默认拒绝
 *        （TIMESTAMP_NOT_INCREASING，文案含末条时间 + 建议）；仅显式 `allowClockAdjust` 时步进到
 *        末条 +1ms 并留痕 `clock-adjust:auto+<N>ms:<reason>`；
 *     ② `now` 与末条**同毫秒**（良性）→ 步进末条 +1ms，`note` 追加 `clock-adjust:auto+<N>ms`；
 *     ③ 仅与**本次批内**已规划记录冲突 → 同样 +1ms 步进（不涉历史改写）；
 *     ②③ 均在 `diagnostics` 明示「时钟调整 +Nms」（与显式路径同口径：调整必留痕迹）；
 *   - 历史末条扫描用宽容口径 `Number.isFinite(Date.parse(v))`（schema 的 `format: date-time` 对大小写 /
 *     分隔符宽容，严格正则只用于新注入 / 新记录），避免历史行时间戳被跳过导致单调性下界失真；
 *   - `--correct=<runId>` 只**新增**一条更正记录（`note` 含 `correction-of:<runId>`），
 *     历史行不删不改；runId 不存在即拒绝（UNKNOWN_RUN_ID，调用方按输入错误 exit 2 处理）。
 *
 * @module
 */

/** run-log.jsonl 单条记录（形状由 `schemas/run-log.schema.json` 强制，本模块只关心追加相关字段） */
export interface RunLogRecord {
  /** 运行 ID（run-log 内唯一标识；追加时不得与既有 runId 重复） */
  runId?: string;
  /** 记录时间戳（ISO 8601），追加后必须严格大于末条时间戳 */
  timestamp?: string;
  /** 备注：时间戳痕迹（clock-injected / clock-adjust / correction-of）追加于此，不覆盖既有内容 */
  note?: string;
  /** 其余 RunLogEntry 字段原样透传（必填性由 CLI 侧逐行 schema 校验强制） */
  [key: string]: unknown;
}

/** 追加拒绝的机器码（调用方据此区分 exit 1 写入拒绝 / exit 2 输入错误） */
export type AppendViolationCode =
  | 'EMPTY_APPEND'
  | 'RECORD_INVALID'
  | 'TIMESTAMP_INVALID'
  | 'TIMESTAMP_CONFLICT'
  | 'TIMESTAMP_NOT_INCREASING'
  | 'DUPLICATE_RUN_ID'
  | 'UNKNOWN_RUN_ID'
  | 'NOTE_INVALID';

/** 追加计划（`accepted=false` 时 `entries` 只含历史行、`appended=0`，调用方不得写入） */
export interface AppendPlan {
  /** 是否可写入：无任何 violation 才为 true */
  accepted: boolean;
  /** 计划结果：`accepted=true` 时为「历史行 + 新记录」，`accepted=false` 时仅历史行（历史行逐字段不变） */
  entries: RunLogRecord[];
  /** 计划新增的记录条数（`accepted=false` 时恒为 0） */
  appended: number;
  /** 人类可读拒绝原因（`accepted=false` 时非空） */
  violations: string[];
  /** 与 `violations` 同索引的机器码 */
  violationCodes: AppendViolationCode[];
  /** 非阻断诊断（时钟调整 +Nms / 更正说明）；绝不静默调整的证据面 */
  diagnostics: string[];
}

/** 追加选项（`cli/wm-append-runlog.ts` 由 `--timestamp` / `--allow-clock-adjust` 接线） */
export interface AppendOptions {
  /** 当前时刻（ISO 8601，调用方注入 `new Date().toISOString()`） */
  now: string;
  /** `--timestamp=<iso>`：显式注入时间戳（记录 note 留 `clock-injected:<iso>`） */
  timestamp?: string;
  /** `--allow-clock-adjust=<reason>`：显式声明小步进（记录 note 留 `clock-adjust:<reason>`） */
  allowClockAdjust?: string;
}

// eslint-disable-next-line security/detect-unsafe-regex -- 全量限定符有界（\d{1,9} 与固定宽度段），无嵌套量词，无指数回溯风险
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** ISO 8601 date-time 判定：形状匹配且 `Date.parse` 可解析（拒 `not-a-date` 一类文本） */
export function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isPlainObject(value: unknown): value is RunLogRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 历史行的宽容时间戳解析（裁定：历史末条扫描用 `Number.isFinite(Date.parse())` 口径）。
 *
 * run-log schema 的 `format: date-time` 对大小写与分隔符宽容（`2026-01-02t10:00:00z`、
 * `2026-01-02 10:00:00Z` 均合法），历史行因此可能带非严格形态的时间戳。若历史扫描用严格正则，
 * 这类行会被当作「无时间戳」跳过 → 单调性下界失真。严格正则（`isIsoTimestamp`）只保留给
 * **新注入 / 新记录**（工具自己产出的时间戳必须规范）。
 */
function timestampMsOf(record: RunLogRecord): number | null {
  const value = record.timestamp;
  if (!isNonEmptyString(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** 末条有效时间戳（从尾部扫描；无有效时间戳返回 null） */
function lastTimestamp(entries: readonly RunLogRecord[]): { ms: number; text: string } | null {
  for (let index = entries.length - 1; index >= 0; index--) {
    // eslint-disable-next-line security/detect-object-injection -- index 为本地数组下界循环计数（非外部输入），数组为同函数内的记录列表
    const entry = entries[index]!;
    const ms = timestampMsOf(entry);
    if (ms !== null) return { ms, text: String(entry.timestamp) };
  }
  return null;
}

class PlanCollector {
  readonly violations: string[] = [];
  readonly violationCodes: AppendViolationCode[] = [];
  readonly diagnostics: string[] = [];

  violate(code: AppendViolationCode, message: string): void {
    this.violationCodes.push(code);
    this.violations.push(message);
  }
}

interface ResolvedTimestamp {
  ms: number;
  text: string;
  /** 写入记录 note 的时间戳痕迹（显式注入 / 显式小步进 / now 派生步进） */
  traces: string[];
}

/**
 * 解析单条记录的生效时间戳（严格递增契约的唯一实现点）。
 *
 * 严格递增下界 `floor` = 历史末条有效时间戳与本次已规划记录时间戳的较大者。两条判定分层：
 *   - 显式时间戳 ≤ **历史末条**时间 → 回溯改写历史，默认拒绝（仅 `allowClockAdjust` 放行并留痕）；
 *   - 显式时间戳仅与**本次批内**先前规划记录冲突 → 批内步进到 floor +1ms（不涉及历史改写），
 *     仍以 diagnostics + note 痕迹显式登记（绝不静默）；
 *   - 无显式时间戳（`now` 派生）→ 落在 floor 之后即直接用 `now`，否则步进 +1ms 并留痕。
 *
 * @returns 通过时为生效时间戳；拒绝时为 null（已向 collector 登记 violation）
 */
function resolveTimestamp(
  explicit: string | undefined,
  opts: AppendOptions,
  floor: { ms: number; text: string } | null,
  historyLast: { ms: number; text: string } | null,
  label: string,
  collector: PlanCollector,
): ResolvedTimestamp | null {
  const injectionTraces = opts.timestamp !== undefined ? [`clock-injected:${opts.timestamp}`] : [];
  if (explicit !== undefined) {
    if (!isIsoTimestamp(explicit)) {
      collector.violate('TIMESTAMP_INVALID', `${label}的 timestamp 不是合法 ISO 8601 date-time：${explicit}`);
      return null;
    }
    const ms = Date.parse(explicit);
    if (historyLast !== null && ms <= historyLast.ms) {
      const reason = opts.allowClockAdjust;
      if (isNonEmptyString(reason)) {
        const stepped = (floor?.ms ?? historyLast.ms) + 1;
        collector.diagnostics.push(
          `时钟调整 +${stepped - ms}ms（${label}的显式时间戳 ${explicit} 不递增且不晚于末条历史时间 ${historyLast.text}，` +
            `按 --allow-clock-adjust=${reason} 步进到末条 +1ms）`,
        );
        return {
          ms: stepped,
          text: new Date(stepped).toISOString(),
          traces: [...injectionTraces, `clock-adjust:${reason}`],
        };
      }
      collector.violate(
        'TIMESTAMP_NOT_INCREASING',
        `${label}的时间戳不递增：${explicit} ≤ 末条时间 ${historyLast.text}（append-only 禁止回溯改写）；` +
          '建议：改用晚于末条时间的 --timestamp=<iso>，或显式声明小步进 --allow-clock-adjust=<reason>',
      );
      return null;
    }
    if (floor !== null && ms <= floor.ms) {
      const stepped = floor.ms + 1;
      collector.diagnostics.push(
        `时钟调整 +${stepped - ms}ms（${label}的显式时间戳 ${explicit} 与本次批内已规划记录时间 ${floor.text} 冲突，按批内 +1ms 步进）`,
      );
      return {
        ms: stepped,
        text: new Date(stepped).toISOString(),
        traces: [...injectionTraces, `clock-adjust:auto+${stepped - ms}ms`],
      };
    }
    return { ms, text: explicit, traces: injectionTraces };
  }

  const nowMs = Date.parse(opts.now);
  // 裁定 A/F：系统时间**早于**末条历史时间 = 时钟真倒退（曾注入未来时间戳 / NTP 回拨 / 跨机拷贝）
  // → 默认拒绝；只有显式 --allow-clock-adjust=<reason> 才按末条 +1ms 步进并留痕（绝不静默抹平时间线）。
  // 同毫秒（nowMs === historyLast.ms）与**批内**重复属良性，走下面的有界 +1ms 步进。
  if (historyLast !== null && nowMs < historyLast.ms) {
    const reason = opts.allowClockAdjust;
    if (!isNonEmptyString(reason)) {
      collector.violate(
        'TIMESTAMP_NOT_INCREASING',
        `now=${opts.now} 早于末条时间 ${historyLast.text}（时钟倒退：append-only 禁止时间线回退）；` +
          '建议：校正系统时间后重试，或改用 --timestamp=<iso> 显式声明，或显式声明小步进 --allow-clock-adjust=<reason>',
      );
      return null;
    }
    const stepped = (floor?.ms ?? historyLast.ms) + 1;
    collector.diagnostics.push(
      `时钟调整 +${stepped - nowMs}ms（now=${opts.now} 早于末条时间 ${historyLast.text}，` +
        `按 --allow-clock-adjust=${reason} 步进到末条 +1ms）`,
    );
    return {
      ms: stepped,
      text: new Date(stepped).toISOString(),
      traces: [`clock-adjust:auto+${stepped - nowMs}ms:${reason}`],
    };
  }
  if (floor !== null && nowMs <= floor.ms) {
    const stepped = floor.ms + 1;
    collector.diagnostics.push(
      `时钟调整 +${stepped - nowMs}ms（now=${opts.now} ≤ 末条时间 ${floor.text}，按末条/批内 +1ms 步进）`,
    );
    return { ms: stepped, text: new Date(stepped).toISOString(), traces: [`clock-adjust:auto+${stepped - nowMs}ms`] };
  }
  return { ms: nowMs, text: new Date(nowMs).toISOString(), traces: [] };
}

/** 把痕迹追加到 note（不改动原对象；note 非字符串时拒绝，绝不静默丢弃） */
function withTraces(
  record: RunLogRecord,
  traces: readonly string[],
  label: string,
  collector: PlanCollector,
): RunLogRecord | null {
  if (traces.length === 0) return { ...record };
  const note = record.note;
  if (note !== undefined && typeof note !== 'string') {
    collector.violate('NOTE_INVALID', `${label}的 note 不是字符串，无法登记时间戳/更正痕迹`);
    return null;
  }
  const suffix = traces.join(' ');
  const merged = note === undefined || note.trim() === '' ? suffix : `${note} ${suffix}`;
  return { ...record, note: merged };
}

/** 追加计划核心（planAppend 与 planCorrection 共用；`extraTraces` 为更正痕迹一类额外 note 标记） */
function planIncoming(
  existing: readonly RunLogRecord[],
  incoming: readonly RunLogRecord[],
  opts: AppendOptions,
  extraTraces: readonly string[] = [],
  extraDiagnostics: readonly string[] = [],
): AppendPlan {
  const collector = new PlanCollector();
  collector.diagnostics.push(...extraDiagnostics);
  if (!isIsoTimestamp(opts.now)) {
    collector.violate('TIMESTAMP_INVALID', `now 不是合法 ISO 8601 date-time：${opts.now}`);
  }
  if (incoming.length === 0) {
    collector.violate('EMPTY_APPEND', '待追加记录为空（--from/--stdin 未提供任何记录）');
  }

  const history = [...existing];
  const planned: RunLogRecord[] = [];
  const seenRunIds = new Set(existing.map((entry) => entry.runId).filter(isNonEmptyString));
  const historyLast = lastTimestamp(existing);
  let floor = historyLast;

  for (const [index, record] of incoming.entries()) {
    const label = `第 ${index + 1} 条追加记录`;
    if (!isPlainObject(record)) {
      collector.violate('RECORD_INVALID', `${label}不是 JSON 对象`);
      continue;
    }
    const runId = record.runId;
    if (isNonEmptyString(runId)) {
      if (seenRunIds.has(runId)) {
        collector.violate(
          'DUPLICATE_RUN_ID',
          `${label}的 runId=${runId} 与既有记录重复（run-log 身份唯一，禁止以追加方式覆盖既有记录）`,
        );
        continue;
      }
      seenRunIds.add(runId);
    }

    const ownTimestamp = isNonEmptyString(record.timestamp) ? record.timestamp : undefined;
    if (opts.timestamp !== undefined && ownTimestamp !== undefined) {
      collector.violate(
        'TIMESTAMP_CONFLICT',
        `${label}同时给出记录内 timestamp=${ownTimestamp} 与 --timestamp=${opts.timestamp}（两个显式来源冲突，绝不静默覆盖）`,
      );
      continue;
    }

    const resolved = resolveTimestamp(opts.timestamp ?? ownTimestamp, opts, floor, historyLast, label, collector);
    if (resolved === null) continue;
    const stamped = withTraces(
      { ...record, timestamp: resolved.text },
      [...extraTraces, ...resolved.traces],
      label,
      collector,
    );
    if (stamped === null) continue;

    planned.push(stamped);
    floor = { ms: resolved.ms, text: resolved.text };
  }

  const accepted = collector.violations.length === 0;
  return {
    accepted,
    entries: accepted ? [...history, ...planned] : history,
    appended: accepted ? planned.length : 0,
    violations: collector.violations,
    violationCodes: collector.violationCodes,
    diagnostics: collector.diagnostics,
  };
}

/**
 * 规划一次追加：`existing` 为已有记录（历史行不可变），`incoming` 为待追加记录。
 * 返回计划；`accepted=false` 时不得写入任何内容。
 */
export function planAppend(
  existing: readonly RunLogRecord[],
  incoming: readonly RunLogRecord[],
  opts: AppendOptions,
): AppendPlan {
  return planIncoming(existing, incoming, opts);
}

/** 更正记录的新 runId：patch 显式给出则沿用（冲突由 DUPLICATE_RUN_ID 拦截），否则派生 `<被更正 runId>-corr-<k>` */
function deriveCorrectionRunId(existing: readonly RunLogRecord[], baseRunId: string): string {
  const used = new Set(existing.map((entry) => entry.runId).filter(isNonEmptyString));
  for (let index = 1; ; index++) {
    const candidate = `${baseRunId}-corr-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * 规划一次更正：为 `runId` 指向的记录**新增**一条更正记录（历史行不删不改）。
 *
 * 新记录 = 被更正记录的字段 + `patch` 覆盖，`runId` 重新分配（除非 patch 显式给出），
 * 时间戳按追加的同一条严格递增契约重新派生，`note` 追加 `correction-of:<runId>`。
 * `runId` 不存在时返回 `UNKNOWN_RUN_ID`（调用方按输入错误 exit 2 处理）。
 */
export function planCorrection(
  existing: readonly RunLogRecord[],
  runId: string,
  patch: RunLogRecord,
  opts: AppendOptions,
): AppendPlan {
  const base = existing.find((entry) => entry.runId === runId);
  if (base === undefined) {
    return {
      accepted: false,
      entries: [...existing],
      appended: 0,
      violations: [`--correct 引用的 runId=${runId} 不在 run-log 内（更正只能指向既有记录，属输入错误）`],
      violationCodes: ['UNKNOWN_RUN_ID'],
      diagnostics: [],
    };
  }
  const baseRunId = isNonEmptyString(base.runId) ? base.runId : runId;
  const baseRest: RunLogRecord = { ...base };
  delete baseRest.timestamp; // 被更正记录的时间戳不继承：由本次追加的严格递增契约重新派生
  const patched: RunLogRecord = { ...baseRest, ...patch };
  const newRunId = isNonEmptyString(patch.runId) ? patch.runId : deriveCorrectionRunId(existing, baseRunId);
  const correction: RunLogRecord = { ...patched, runId: newRunId };
  return planIncoming(
    existing,
    [correction],
    opts,
    [`correction-of:${baseRunId}`],
    [`更正记录：runId=${baseRunId} → 新增 runId=${newRunId}（历史行不删不改，仅追加）`],
  );
}
