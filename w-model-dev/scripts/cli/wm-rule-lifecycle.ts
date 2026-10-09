#!/usr/bin/env tsx
/**
 * M2 规则生命周期只读脚本（wm-rule-lifecycle.ts）
 *
 * 批次五五机制之二（43.5.0）：把登记册（w-model-dev/rule-registry.json）64 条规则的生命周期面
 * 量化为「退役候选」判定——三判据（① 活文档引用零命中 ② boundScript null 或 gate-logs 零出现
 * ③ 存续 ≥10 个 minor）全满足者列入 candidates。只读既有数据、只报告不裁决（不写登记册、
 * 不调用任何 LLM）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/wm-rule-lifecycle.ts [root] [--gate-logs=<dir>] [--json]
 *   参数：
 *     root           可选，仓库根目录（含 w-model-dev/、README.md、AGENTS.md、docs/；
 *                    默认 = 本脚本所在仓库根）
 *     --gate-logs=   可选，gate-logs 目录；缺省 <root>/.w-model/gate-logs；目录不存在 →
 *                    输出空语料诊断仍 exit 0，corpus 标注 "missing"
 *     --json         只输出单行 RULE_LIFECYCLE_JSON（同字节确定、不含 generatedAt）
 *
 * 活文档采集范围（缺项可容）：w-model-dev/references/*.md（排除定义文档 hard-constraints.md 自身）
 * + w-model-dev/SKILL.md + README.md + AGENTS.md + docs/*.md 顶层。
 *
 * 退出码：
 *   0  判定成功（stdout 单行 RULE_LIFECYCLE_JSON；exit 0/2 契约，无 exit 1）
 *   2  输入错误：未知/重复/缺值 flag → ARG_INVALID；登记册缺失 → FILE_NOT_FOUND；
 *       登记册坏 JSON → FILE_PARSE；登记册结构畸形 → STRUCTURE_INVALID
 *       （stdout 单行 ERROR_JSON，stderr 人类可读）
 *
 * 设计：docs/superpowers/specs/2026-10-09-metabolism-and-repair-design.md §3（M2）
 * 判定逻辑在 logic/rule-lifecycle-logic.ts（零 fs），I/O 采集在本文件（cli 层）。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import type { RegistryEntry } from '../logic/rule-registry-logic.js';
import { computeRuleLifecycle, isLiveReferenced } from '../logic/rule-lifecycle-logic.js';

/** gate-log 文件名前缀：`<ISO>`（如 2026-08-12T17-23-46-161Z-）。 */
const GATE_LOG_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/;
/** gate-log 文件名可选 `<uuid>-` 段（<ISO>-<uuid>-<script>.json 形态）。 */
const GATE_LOG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;

/** 登记册相对仓库根路径（任务 4 落地位置）。 */
const REGISTRY_REL = path.join('w-model-dev', 'rule-registry.json');

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

/** 读取登记册（缺失 → FILE_NOT_FOUND；坏 JSON → FILE_PARSE；结构与字段畸形 → STRUCTURE_INVALID） */
function loadRegistry(root: string): RegistryEntry[] {
  const registryPath = path.join(root, REGISTRY_REL);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- registryPath = root + 仓库固定相对路径常量 REGISTRY_REL，受控路径
  if (!existsSync(registryPath)) {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'M2-1',
      message: '规则登记册缺失',
      exitCode: 2,
      file: registryPath,
    });
    throw new HandledCliError();
  }
  let raw: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 登记册为仓库根固定相对路径（w-model-dev/rule-registry.json）
    raw = readFileSync(registryPath, 'utf8');
  } catch (err) {
    exitWithError({
      category: 'FILE_READ',
      rule: 'M2-1',
      message: '规则登记册读取失败',
      exitCode: 2,
      file: registryPath,
      detail: err instanceof Error ? err.message : String(err),
    });
    throw new HandledCliError();
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    exitWithError({
      category: 'FILE_PARSE',
      rule: 'M2-1',
      message: '规则登记册非合法 JSON',
      exitCode: 2,
      file: registryPath,
      detail: err instanceof Error ? err.message : String(err),
    });
    throw new HandledCliError();
  }
  const rules = (data as { rules?: unknown } | null)?.rules;
  if (!Array.isArray(rules)) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'M2-1',
      message: '规则登记册缺 rules 数组',
      exitCode: 2,
      file: registryPath,
    });
    throw new HandledCliError();
  }
  if (
    rules.some(
      (r) =>
        r === null ||
        typeof r !== 'object' ||
        typeof (r as RegistryEntry).id !== 'string' ||
        typeof (r as RegistryEntry).kind !== 'string' ||
        typeof (r as RegistryEntry).title !== 'string' ||
        typeof (r as RegistryEntry).status !== 'string' ||
        ((r as RegistryEntry).boundScript !== null && typeof (r as RegistryEntry).boundScript !== 'string'),
    )
  ) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'M2-1',
      message: '规则登记册条目字段畸形',
      exitCode: 2,
      file: registryPath,
    });
    throw new HandledCliError();
  }
  return rules as RegistryEntry[];
}

/** 读取单文件文本（读取失败容错：缺项可容，返回空串） */
function readTextSafe(file: string): string {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 采集路径为仓库内固定活文档清单（references/SKILL/README/AGENTS/docs），受控
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** 采集活文档正文（排除 hard-constraints.md 自身与登记册；缺项可容） */
function collectLiveDocs(root: string): string[] {
  const texts: string[] = [];
  const refsDir = path.join(root, 'w-model-dev', 'references');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- refsDir = root + 仓库固定相对路径字面量，受控路径
  if (existsSync(refsDir)) {
    let names: string[] = [];
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- refsDir 固定仓库相对路径
      names = readdirSync(refsDir);
    } catch {
      names = [];
    }
    for (const name of names.sort()) {
      if (!name.endsWith('.md') || name === 'hard-constraints.md') continue;
      const text = readTextSafe(path.join(refsDir, name));
      if (text !== '') texts.push(text);
    }
  }
  for (const rel of ['w-model-dev/SKILL.md', 'README.md', 'AGENTS.md']) {
    const file = path.join(root, rel);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- rel 取自本函数字面量白名单数组，受控路径
    if (existsSync(file)) {
      const text = readTextSafe(file);
      if (text !== '') texts.push(text);
    }
  }
  const docsDir = path.join(root, 'docs');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- docsDir = root + 仓库固定目录字面量，受控路径
  if (existsSync(docsDir)) {
    let names: string[] = [];
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- docsDir 固定仓库相对路径
      names = readdirSync(docsDir);
    } catch {
      names = [];
    }
    for (const name of names.sort()) {
      if (!name.endsWith('.md')) continue;
      const text = readTextSafe(path.join(docsDir, name));
      if (text !== '') texts.push(text);
    }
  }
  return texts;
}

/** 归一化 gate-log 文件名 → script 段（去 `<ISO>` 前缀与可选 `<uuid>` 段；无法归一 → null） */
function gateLogScriptSegment(name: string): string | null {
  let rest = name.endsWith('.json') ? name.slice(0, -'.json'.length) : name;
  if (!GATE_LOG_ISO_RE.test(rest)) return null;
  rest = rest.replace(GATE_LOG_ISO_RE, '');
  rest = rest.replace(GATE_LOG_UUID_RE, '');
  return rest === '' ? null : rest;
}

/** 采集 gate-logs（目录缺失 → corpusMissing=true，segments 为空，仍 exit 0） */
function collectGateLogs(gateLogsDir: string): {
  files: number;
  segments: string[];
  missing: boolean;
} {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir 为调用方显式 --gate-logs 或根下固定 .w-model/gate-logs 路径
  if (!existsSync(gateLogsDir)) {
    return { files: 0, segments: [], missing: true };
  }
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir 为调用方显式 --gate-logs 或根下固定 .w-model/gate-logs 路径
    const names = readdirSync(gateLogsDir);
    const segments: string[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const segment = gateLogScriptSegment(name);
      if (segment !== null) segments.push(segment);
    }
    return { files: names.length, segments, missing: false };
  } catch {
    return { files: 0, segments: [], missing: true };
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);

  const rules = loadRegistry(args.root);
  const liveDocsTexts = collectLiveDocs(args.root);
  const liveDocsText = liveDocsTexts.join('\n');

  const gateLogsDir = args.gateLogs ?? path.join(args.root, '.w-model', 'gate-logs');
  const gate = collectGateLogs(gateLogsDir);

  const verdict = computeRuleLifecycle({
    rules,
    liveDocsText,
    gateLogScripts: gate.segments,
  });

  const corpus: number | 'missing' = gate.missing ? 'missing' : gate.files;
  const payload = {
    candidates: verdict.candidates.map((c) => ({
      id: c.id,
      reasons: c.reasons,
    })),
    checked: rules.length,
    corpus,
  };
  const jsonLine = `RULE_LIFECYCLE_JSON ${JSON.stringify(payload)}`;
  if (args.json) {
    console.log(jsonLine);
    process.exitCode = 0;
    return;
  }

  const activeCount = rules.filter((r) => r.status === 'active').length;
  const candidateRules = rules.filter((r) => r.kind === 'candidate' || r.status === 'candidate');
  console.log('═'.repeat(60));
  console.log('M2 规则生命周期报告（wm-rule-lifecycle）');
  console.log('═'.repeat(60));
  console.log(
    '裁判口径    : 退役候选三判据（① 活文档引用零命中 ② boundScript null 或 gate-logs 零出现 ③ 存续 ≥10 minor）',
  );
  console.log(`登记册规则  : ${rules.length}（active ${activeCount} / candidate ${candidateRules.length}）`);
  console.log(`活文档采集  : ${liveDocsTexts.length} 个 .md（排除 hard-constraints.md 自身与登记册）`);
  if (gate.missing) {
    console.log(`gate-logs   : 目录缺失 → corpus "missing"（${gateLogsDir}）`);
  } else {
    console.log(`gate-logs   : ${gate.files} 个文件（含 ${gate.segments.length} 个 .json script 段）`);
  }
  if (verdict.candidates.length === 0) {
    console.log('退役候选    : 0（全部规则均被活文档引用或 boundScript 在 gate-logs 有出现）');
  } else {
    for (const c of verdict.candidates) {
      console.log(`退役候选    : ${c.id}`);
      for (const r of c.reasons) console.log(`    - ${r}`);
    }
  }
  // C1/C2 结论（候选状态规则：活文档有候选登记引用 → ① 命中 → 非候选，理由见 logic 判据锚节）
  for (const id of ['C1', 'C2']) {
    const rule = rules.find((r) => r.id === id && r.kind === 'candidate');
    if (rule === undefined) continue;
    const referenced = isLiveReferenced(rule, liveDocsText);
    console.log(
      `C1/C2 结论   : ${id} ${referenced ? '非退役候选——活文档有候选登记引用（candidateRegistrationAnchor 命中）' : '列入退役候选（活文档零引用）'}`,
    );
  }
  console.log('─'.repeat(60));
  console.log(jsonLine);
  process.exitCode = 0;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
