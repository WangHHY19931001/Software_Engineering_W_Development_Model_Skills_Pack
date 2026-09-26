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
 *     历史行不删不改；runId 不存在即拒绝（UNKNOWN_RUN_ID，调用方按输入错误 exit 2 处理）；
 *   - **记录哈希链（D-3a / 裁定 C）**：每条新记录的 `prevRecordHash` 取**文件内最后一条带哈希记录**
 *     的 `recordHash`（无则 `""`），`recordHash` 按定稿公式
 *     `sha256(prevRecordHash + "\n" + canonicalJson(record 去掉 recordHash 字段))` 计算
 *     （共享实现 `logic/run-log-logic.ts` 的 `computeRecordHash`，禁止各写一份）；载荷自带的链字段
 *     由追加器重算覆盖并在 `diagnostics` 留痕（哈希链只能由写入端计算）。历史行**不补哈希**（禁止
 *     回溯补链），`--correct` 生成的更正记录同样入链。
 *   - **checkpoint 放行锚（D-3b / 裁定 A+B）**：写 `action=checkpoint` 且 `outcome=success` 的记录时，
 *     按**写入前前缀**（历史行原文 + 本批已规划行落盘序列化中 `timestamp ≤` 本条时间戳者）自动填入
 *     `runLogAnchor {lines, sha256}`（共享实现 `computeRunLogAnchor`，禁止各写一份）；调用方**显式提供**
 *     的锚须与自算值一致，不一致 → `ANCHOR_MISMATCH`（调用方按输入错误 exit 2，不写盘）；历史行原文
 *     经可选 `historyRawLines` 注入（logic 层零 fs），不可得时自动填锚跳过并留非阻断诊断、显式提供的
 *     锚则按 `ANCHOR_UNVERIFIABLE` 拒绝。另：既有文件「哈希段之后仍有未入链尾行」时补非阻断诊断
 *     （告知该文件将被 `check-run-log` R7 判 blocking，消除 writer 比 checker 宽容且不告警的非对称）。
 *
 * @module
 */

import { computeRecordHash, computeRunLogAnchor, recordTimestampMs, type RunLogAnchor } from './run-log-logic.js';

/** run-log.jsonl 单条记录（形状由 `schemas/run-log.schema.json` 强制，本模块只关心追加相关字段） */
export interface RunLogRecord {
  /** 运行 ID（run-log 内唯一标识；追加时不得与既有 runId 重复） */
  runId?: string;
  /** 记录时间戳（ISO 8601），追加后必须严格大于末条时间戳 */
  timestamp?: string;
  /** 备注：时间戳痕迹（clock-injected / clock-adjust / correction-of）追加于此，不覆盖既有内容 */
  note?: string;
  /** 记录哈希链（D-3a）：本条记录的 prevRecordHash（前一条带哈希记录的 recordHash；无则 ""） */
  prevRecordHash?: string;
  /** 记录哈希链（D-3a）：本条记录的内容指纹（sha256 小写 hex，由追加器按定稿公式计算） */
  recordHash?: string;
  /** checkpoint 放行锚（D-3b）：放行时刻历史前缀的外部锚（追加器自动填入；显式提供时须与自算值一致） */
  runLogAnchor?: RunLogAnchor;
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
  | 'NOTE_INVALID'
  | 'ANCHOR_MISMATCH'
  | 'ANCHOR_UNVERIFIABLE';

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
  /**
   * 历史行的**原始字节**（与 `existing` 同序同长，行终止符已剥离；CLI 传 `readRunLogFile().rawLines`）。
   *
   * D-3b 放行锚的 `sha256` 定义在原始字节上，而本模块零 `node:fs`/`node:crypto` → 历史行原文只能
   * 由调用方注入（本批新规划行的原文 = 落盘 `JSON.stringify`，无需注入）。缺省/长度不匹配且前缀
   * 非空时锚不可计算：自动填锚跳过并留非阻断诊断；调用方显式提供的锚则按 `ANCHOR_UNVERIFIABLE`
   * 拒绝（不可验证的输入 fail-closed，绝不静默放行）。
   */
  historyRawLines?: readonly string[];
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
 *
 * A2：谓词实现与校验端**共用** `logic/run-log-logic.ts` 的 `recordTimestampMs`（单一真值）。
 * 两端各写一份时，数字时间戳行会被一端计入放行锚前缀、另一端不计入 → 追加器刚自动填好的锚
 * 立刻被判「与当前历史前缀不符」（误导性 blocking）。
 */
function timestampMsOf(record: RunLogRecord): number | null {
  return recordTimestampMs(record.timestamp);
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

/**
 * 文件内最后一条带哈希记录的 `recordHash`（无则 `""`）——D-3a 裁定 C：新记录 `prevRecordHash` 的
 * 唯一取值来源。历史无哈希段被完整跳过（不补链），故「历史段 + 新带链记录」形态的链首为 `""`。
 */
function lastRecordHash(entries: readonly RunLogRecord[]): string {
  for (let index = entries.length - 1; index >= 0; index--) {
    // eslint-disable-next-line security/detect-object-injection -- index 为本地数组下界循环计数（非外部输入），数组为同函数内的记录列表
    const candidate = entries[index]?.recordHash;
    if (isNonEmptyString(candidate)) return candidate;
  }
  return '';
}

/** 记录是否已入链（recordHash 为非空字符串） */
function isChained(record: RunLogRecord): boolean {
  return isNonEmptyString(record.recordHash);
}

/** 载荷是否显式提供放行锚（`--correct` 从被更正记录继承的锚已在 planCorrection 剔除） */
function hasAnchor(record: RunLogRecord): boolean {
  return record.runLogAnchor !== undefined;
}

/** 锚值比对：形状不符一律视为不一致（调用方须给出与自算值完全相同的 { lines, sha256 }） */
function sameAnchor(left: unknown, right: RunLogAnchor): boolean {
  if (typeof left !== 'object' || left === null || Array.isArray(left)) return false;
  const value = left as Record<string, unknown>;
  return value.lines === right.lines && value.sha256 === right.sha256;
}

/**
 * 放行锚前缀原始行（D-3b）：历史行取注入的原文（行终止符已剥离、不 trim），本批已规划行取
 * **最终落盘序列化**（`JSON.stringify`，与 `composeAppendedText` 逐字节一致）；`timestamp ≤
 * 本条时间戳`（时间戳不可解析的记录与锚自算同口径地排除）。
 */
function anchorPrefixRawLines(
  existing: readonly RunLogRecord[],
  existingRawLines: readonly string[],
  planned: readonly RunLogRecord[],
  recordMs: number,
): { ok: true; lines: string[] } | { ok: false; reason: string } {
  const lines: string[] = [];
  for (let index = 0; index < existing.length; index++) {
    // eslint-disable-next-line security/detect-object-injection -- index 为本地数组下界循环计数（非外部输入），数组为同函数入参（历史记录与同序同长的原始行）
    const ms = timestampMsOf(existing[index]!);
    if (ms === null || ms > recordMs) continue;
    // eslint-disable-next-line security/detect-object-injection -- 同上：数值下标，existingRawLines 与 existing 同序同长（调用方已断言对齐）
    const raw = existingRawLines[index];
    if (raw === undefined) return { ok: false, reason: `历史行第 ${index + 1} 条的原始文本缺失` };
    lines.push(raw);
  }
  for (const entry of planned) {
    const ms = timestampMsOf(entry);
    if (ms === null || ms > recordMs) continue;
    lines.push(JSON.stringify(entry));
  }
  return { ok: true, lines };
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
  // D-3a 裁定 C：链尾从**文件内**最后一条带哈希记录派生（历史行不补链，故无哈希历史段不参与）
  let chainPrev = lastRecordHash(existing);
  // D-3b：历史行原始字节（放行锚 sha256 的唯一来源）。长度不匹配视为不可用（绝不猜测历史行序列化）。
  const historyRawLines =
    Array.isArray(opts.historyRawLines) && opts.historyRawLines.length === existing.length
      ? opts.historyRawLines
      : undefined;
  // 裁定 D3：既有文件「哈希段之后仍有未入链尾行」时读侧 check-run-log 必判 blocking，而写入端此前
  // 完全沉默（writer 比 checker 宽容且不告警的非对称）→ 追加时补**非阻断**诊断（不改退出码）。
  const firstChainedIndex = existing.findIndex((entry) => isChained(entry));
  if (firstChainedIndex >= 0) {
    const unchainedTail = existing.slice(firstChainedIndex).filter((entry) => !isChained(entry)).length;
    if (unchainedTail > 0) {
      collector.diagnostics.push(
        `既有 run-log 哈希段之后存在未入链尾行 ${unchainedTail} 条（无 recordHash）：新记录仍按链尾续写，` +
          '但 check-run-log R7 会判该文件 blocking（哈希段之后不得出现未入链记录）；' +
          '禁止就地改写历史行，修订请用 --correct 追加更正记录',
      );
    }
  }

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

    // D-3b 放行锚（裁定 A/B）：checkpoint 放行自动填锚；调用方**显式提供**的锚须与自算值一致
    // （不一致 = 输入错误，绝不静默覆盖）。顺序硬约束：锚必须先写入记录，再计算 recordHash——
    // 否则锚字段不在哈希载荷内，改锚不断链（锚自身入链是「改锚即断链」的前提）。
    let anchored: RunLogRecord = stamped;
    const isRelease = record.action === 'checkpoint' && record.outcome === 'success';
    if (isRelease || hasAnchor(record)) {
      const prefix =
        historyRawLines === undefined && existing.length > 0
          ? ({ ok: false, reason: '未提供（或长度不匹配）historyRawLines，历史行原始字节不可得' } as const)
          : anchorPrefixRawLines(existing, historyRawLines ?? [], planned, resolved.ms);
      if (!prefix.ok) {
        if (hasAnchor(record)) {
          collector.violate(
            'ANCHOR_UNVERIFIABLE',
            `${label}自带放行锚但无法核验：${prefix.reason}（不可验证的输入 fail-closed，拒绝写入）`,
          );
          continue;
        }
        collector.diagnostics.push(`${label}为 checkpoint 放行但未能自动填入放行锚：${prefix.reason}`);
      } else {
        const anchor = computeRunLogAnchor(prefix.lines);
        if (hasAnchor(record) && !sameAnchor(record.runLogAnchor, anchor)) {
          const provided = record.runLogAnchor as { lines?: unknown; sha256?: unknown };
          collector.violate(
            'ANCHOR_MISMATCH',
            `${label}自带放行锚与写入前前缀自算值不一致（provided lines=${String(provided.lines)}/sha256=${String(
              provided.sha256,
            )} ≠ computed lines=${anchor.lines}/sha256=${anchor.sha256}；锚只能由写入端按前缀计算）`,
          );
          continue;
        }
        anchored = { ...stamped, runLogAnchor: anchor };
      }
    }

    // D-3a 裁定 C：新记录入链。prevRecordHash 取链尾（文件内最后一条带哈希记录）并**先写入记录**，
    // 再按定稿公式计算 recordHash——prevRecordHash 是记录字段，参与 canonicalJson 载荷（与
    // check-run-log R7 的复算口径逐字一致：`computeRecordHash(记录, 记录.prevRecordHash)`）。
    // 载荷自带链字段一律重算覆盖（哈希链只能由写入端计算），且以 diagnostic 明示，绝不静默沿用。
    if (record.recordHash !== undefined || record.prevRecordHash !== undefined) {
      collector.diagnostics.push(
        `${label}载荷自带链字段（recordHash/prevRecordHash）已由追加器按定稿公式重算覆盖（哈希链只能由写入端计算，载荷值不可信）`,
      );
    }
    const chained: RunLogRecord = { ...anchored, prevRecordHash: chainPrev };
    const recordHash = computeRecordHash(chained, chainPrev);
    chained.recordHash = recordHash;
    chainPrev = recordHash;

    planned.push(chained);
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
  // 链字段与放行锚均为**写入端计算**的字段（D-3a/D-3b）：继承值不构成「调用方真的传入」，
  // 必须剔除——否则每次更正都会误报「载荷自带链字段」诊断，或让继承的旧锚触发不符拒绝。
  // 更正记录若是放行动作（action=checkpoint & outcome=success 被继承），仍会被追加器按新前缀自动填锚。
  delete baseRest.recordHash;
  delete baseRest.prevRecordHash;
  delete baseRest.runLogAnchor;
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
