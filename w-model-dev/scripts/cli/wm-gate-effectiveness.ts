#!/usr/bin/env tsx
/**
 * M3 门禁效能只读脚本（wm-gate-effectiveness.ts）
 *
 * 批次五五机制之三（43.5.0）：消费既有 `.w-model/gate-logs/*.json` 语料，按门禁聚合
 * 调用数（runs）/ 阻断数（blocked=exitCode 1）/ 错误数（errors=exitCode 2）/ 末次触发
 * （lastFired=文件名 ISO 段取 max 的原始串）/ 触发枚举（distinctTriggers，reportSummary
 * 可辨识键尽力而为）。只读既有数据、只报告不裁决（零阻断门禁标记为降级候选的判定由
 * M4 人类 CHECKPOINT 消费；本脚本不写任何文件、不调用任何 LLM）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/wm-gate-effectiveness.ts [root] [--gate-logs=<dir>] [--json]
 *   参数：
 *     root           可选，仓库根目录（含 w-model-dev/、README.md、AGENTS.md、docs/；
 *                    默认 = 本脚本所在仓库根）
 *     --gate-logs=   可选，gate-logs 目录；缺省 <root>/.w-model/gate-logs；目录不存在 →
 *                    stdout 单行 GATE_EFFECTIVENESS_JSON {"gates":[],"corpus":0,"note":"missing"}
 *                    仍 exit 0（只读诊断工具语义，同 wm-rule-lifecycle 的 corpus:"missing"）
 *     --json         只输出单行 GATE_EFFECTIVENESS_JSON（同字节确定、不含 generatedAt）
 *
 * 解析口径：
 *   - 只读 `*.json`（跳过 `.log`）；坏 JSON 计 `parseErrors` 并在输出标注（不静默）
 *   - 每文件先取 content `script` 字段（字符串非空）；缺失时回退文件名段——新式
 *     `<ISO>-<uuid>-<script>.json`（剥 ISO 前缀 + UUID 段后剩第三段）或旧式
 *     `<ISO>-<script>.json`（剥 ISO 前缀）；回退失败 → `formatFallback`（不计 runs，含已解析
 *     文件仍计入 corpus）
 *
 * 退出码：
 *   0  判定成功（stdout 单行 GATE_EFFECTIVENESS_JSON；exit 0/2 契约，无 exit 1）
 *   2  输入错误：未知/重复/缺值 flag → ARG_INVALID（stdout 单行 ERROR_JSON，stderr 人类可读）
 *
 * 设计：docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md §3（M3）
 * 聚合逻辑在 logic/gate-effectiveness-logic.ts（零 fs），I/O 采集在本文件（cli 层）。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import {
  computeGateEffectiveness,
  type GateEffectiveness,
  type GateLogEntry,
} from '../logic/gate-effectiveness-logic.js';

/** gate-log 文件名 `<ISO>` 段（如 2026-08-12T17-23-46-161Z），去掉结尾 `-` 即原始 ISO 串。 */
const GATE_LOG_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/;
/** gate-log 文件名可选 `<uuid>-` 段（新式 `<ISO>-<uuid>-<script>.json` 形态）。 */
const GATE_LOG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;

function defaultRoot(): string {
  // cli/ 的上一级 ×3 = 仓库根（含 w-model-dev/、README.md、AGENTS.md、docs/）
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

interface ParsedArgs {
  root: string;
  gateLogs: string | undefined;
  json: boolean;
}

function argInvalid(message: string, detail?: string): never {
  exitWithError({
    category: 'ARG_INVALID',
    rule: 'P0-1',
    message,
    exitCode: 2,
    detail,
  });
  throw new HandledCliError();
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  let gateLogs: string | undefined;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i 为受控循环下标（0..argv.length-1），非数字键注入
    const token = argv[i]!;
    // eslint-disable-next-line security/detect-possible-timing-attacks -- 与固定字面量 '--json' 的相等比较，非秘密比较（无时序侧信道）
    if (token === '--json') {
      if (json) argInvalid('重复的 flag', '--json');
      json = true;
      continue;
    }
    if (token.startsWith('--gate-logs=')) {
      if (gateLogs !== undefined) argInvalid('重复的 flag', '--gate-logs');
      const value = token.slice('--gate-logs='.length);
      if (value === '') argInvalid('flag --gate-logs 缺值');
      gateLogs = value;
      continue;
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks -- 与固定字面量 '--gate-logs' 的相等比较，非秘密比较（无时序侧信道）
    if (token === '--gate-logs') {
      if (gateLogs !== undefined) argInvalid('重复的 flag', '--gate-logs');
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) argInvalid('flag --gate-logs 缺值');
      gateLogs = value;
      continue;
    }
    if (token.startsWith('--')) argInvalid('未知 flag', token);
    positional.push(token);
  }
  if (positional.length > 1) argInvalid('多余的位置参数', positional.slice(1).join(' '));
  return { root: positional[0] ?? defaultRoot(), gateLogs, json };
}

/** 文件名 → ISO 段原始串（去掉结尾 `-`）；无 ISO 段返回 undefined。 */
function isoSegmentFromName(name: string): string | undefined {
  const m = GATE_LOG_ISO_RE.exec(name);
  return m === null ? undefined : m[0].slice(0, -1);
}

/**
 * 文件名 → script 段回退（content `script` 字段缺失时）：先剥 `<ISO>` 前缀，再剥可选
 * `<uuid>` 段（新式第三段），最后剥 `.json`；无法归一 → null（formatFallback，不计 runs）。
 */
function scriptSegmentFromName(name: string): string | null {
  let rest = name.endsWith('.json') ? name.slice(0, -'.json'.length) : name;
  const iso = GATE_LOG_ISO_RE.exec(rest)?.[0];
  if (iso === undefined) return null;
  rest = rest.slice(iso.length);
  const uuid = GATE_LOG_UUID_RE.exec(rest)?.[0];
  if (uuid !== undefined) rest = rest.slice(uuid.length);
  return rest === '' ? null : rest;
}

/** 采集 gate-logs（只读 `*.json`；目录缺失 → missing=true，仍 exit 0） */
function collectGateLogEntries(gateLogsDir: string): {
  entries: GateLogEntry[];
  corpus: number;
  parseErrors: number;
  formatFallback: number;
  missing: boolean;
} {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir 为调用方显式 --gate-logs 或根下固定 .w-model/gate-logs 路径，仅作存在性探测
  if (!existsSync(gateLogsDir)) {
    return {
      entries: [],
      corpus: 0,
      parseErrors: 0,
      formatFallback: 0,
      missing: true,
    };
  }
  let names: string[];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir 为调用方显式 --gate-logs 或根下固定 .w-model/gate-logs 路径
    names = readdirSync(gateLogsDir).sort();
  } catch {
    return {
      entries: [],
      corpus: 0,
      parseErrors: 0,
      formatFallback: 0,
      missing: true,
    };
  }
  const entries: GateLogEntry[] = [];
  let corpus = 0;
  let parseErrors = 0;
  let formatFallback = 0;
  for (const name of names) {
    if (!name.endsWith('.json')) continue; // 只读 *.json，跳过 .log 等
    let raw: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir 为调用方显式 --gate-logs 或根下固定 .w-model/gate-logs 路径
      raw = readFileSync(path.join(gateLogsDir, name), 'utf8');
    } catch {
      continue; // 单文件读取故障：只读工具容错跳过（不静默计入 corpus/parseErrors）
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      parseErrors += 1;
      continue;
    }
    corpus += 1;
    const obj = (typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}) as Record<
      string,
      unknown
    >;
    const scriptField = obj.script;
    let script: string | null;
    if (typeof scriptField === 'string' && scriptField !== '') {
      script = scriptField;
    } else {
      script = scriptSegmentFromName(name);
      if (script === null) {
        formatFallback += 1; // 回退失败：标注 formatFallback，不计 runs（该文件仍计入 corpus）
        continue;
      }
    }
    entries.push({
      script,
      exitCode: obj.exitCode,
      reportSummary: obj.reportSummary,
      iso: isoSegmentFromName(name),
    });
  }
  return { entries, corpus, parseErrors, formatFallback, missing: false };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);

  const gateLogsDir = args.gateLogs ?? path.join(args.root, '.w-model', 'gate-logs');
  const collected = collectGateLogEntries(gateLogsDir);
  const verdict = computeGateEffectiveness(collected.entries);

  const payload: {
    gates: GateEffectiveness[];
    corpus: number;
    parseErrors?: number;
    formatFallback?: number;
    note?: string;
  } = {
    gates: verdict.gates,
    corpus: collected.corpus,
  };
  if (collected.missing) {
    payload.note = 'missing'; // 目录缺失：corpus 0 + note "missing"，仍 exit 0（只读诊断语义）
  } else {
    payload.parseErrors = collected.parseErrors; // 坏 JSON 输出标注（含 0，不静默）
    if (collected.formatFallback > 0) payload.formatFallback = collected.formatFallback; // 回退失败标注（几乎不触发）
  }
  const jsonLine = `GATE_EFFECTIVENESS_JSON ${JSON.stringify(payload)}`;
  if (args.json) {
    console.log(jsonLine);
    process.exitCode = 0;
    return;
  }

  console.log('═'.repeat(60));
  console.log('M3 门禁效能报告（wm-gate-effectiveness）');
  console.log('═'.repeat(60));
  console.log(
    '裁判口径    : 聚合 .w-model/gate-logs/*.json——runs / blocked(exitCode=1) / errors(exitCode=2) / lastFired(文件名 ISO max) / distinctTriggers(reportSummary 尽力而为)',
  );
  console.log(`gate-logs   : ${gateLogsDir}`);
  if (collected.missing) {
    console.log('语料        : 目录缺失 → GATE_EFFECTIVENESS_JSON {"gates":[],"corpus":0,"note":"missing"}（exit 0）');
  } else {
    console.log(
      `语料        : ${collected.corpus} 个 json（坏 JSON ${collected.parseErrors}；formatFallback ${collected.formatFallback}）`,
    );
    if (verdict.gates.length === 0) {
      console.log('门禁        : 0（无已解析 gate-log）');
    } else {
      const rank = (index: number): string => `#${index + 1}`;
      verdict.gates.forEach((g, i) => {
        const triggers = g.distinctTriggers === undefined ? '-' : g.distinctTriggers.join('/');
        console.log(
          `门禁 ${rank(i)}     : ${g.script} runs=${g.runs} blocked=${g.blocked} errors=${g.errors} lastFired=${g.lastFired ?? '-'} triggers=${triggers}`,
        );
      });
    }
  }
  console.log('─'.repeat(60));
  console.log(jsonLine);
  process.exitCode = 0;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
