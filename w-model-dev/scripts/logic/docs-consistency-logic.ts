/**
 * 文档一致性纯逻辑（docs-consistency-logic.ts）
 *
 * 校验活体文档中的静态计数 / 枚举 / 清单与代码事实一致，并校验动态 facts 的完整性，防文档漂移。
 * 纯逻辑无 IO；IO（读文件 / 数目录）由 check-docs-consistency.ts 承担。
 * 设计：docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md §4
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';

import type * as TsType from 'typescript';

const ts = createRequire(import.meta.url)('typescript') as typeof TsType;

export interface DocCheckViolation {
  /** 检查项标识（如 schema-list / targetkind） */
  check: string;
  /** 人类可读描述 */
  message: string;
}

/** A4 状态锁 / 平台修复 / batch B 边界的逐文档输入，由 CLI 读取活体文档后注入。 */
/**
 * A4 的确定性文档矛盾契约。它们只拒绝逐条列明的、位于 pre-push / 平台检查 /
 * 平台依赖修复语境中的自动安装主张；不声称理解所有自然语言语义，清单外复杂
 * 语义必须由 V review 判断。
 */
export const A4_FORBIDDEN_AUTOMATIC_INSTALL_PATTERNS: ReadonlyArray<{
  description: string;
  pattern: RegExp;
}> = [
  { description: 'pre-push 自动 npm install', pattern: /pre-push\s*自动(?:执行)?\s*npm\s+install/i },
  { description: 'pre-push 会自动 npm install', pattern: /pre-push\s*会自动(?:执行)?\s*npm\s+install/i },
  { description: 'pre-push 将自动 npm install', pattern: /pre-push\s*将自动(?:执行)?\s*npm\s+install/i },
  { description: 'pre-push 自动安装依赖', pattern: /pre-push\s*自动安装依赖/i },
  { description: 'pre-push 会自动安装依赖', pattern: /pre-push\s*会自动安装依赖/i },
  { description: '平台检查自动安装依赖', pattern: /平台检查\s*自动安装依赖/i },
  { description: '缺少依赖时自动安装', pattern: /缺少依赖时\s*自动安装/i },
  { description: '自动补装平台依赖', pattern: /自动补装平台依赖/i },
  { description: '自动平台修复', pattern: /自动平台修复/i },
];

/**
 * A4 的确定性 mtime 错误安全主张契约。每一条都是已审计的不实断言；
 * “mtime 仅锁内版本检测、不能单独保证并发安全”等限定说明不在此列表中。
 */
export const A4_FORBIDDEN_MTIME_SAFETY_CLAIM_PATTERNS: ReadonlyArray<{
  description: string;
  pattern: RegExp;
}> = [
  { description: 'mtime 乐观锁足以保证并发安全', pattern: /mtime\s*乐观锁\s*足以保证并发安全/i },
  {
    description: 'mtime 乐观锁足以保证并发写入安全',
    pattern: /mtime\s*乐观锁\s*足以保证并发写入安全/i,
  },
  { description: 'mtime 乐观锁足以处理竞争写', pattern: /mtime\s*乐观锁\s*足以处理竞争写/i },
  { description: 'mtime 乐观锁足以保证并发处理', pattern: /mtime\s*乐观锁\s*足以保证并发处理/i },
  { description: 'mtime 乐观锁能够保证并发安全', pattern: /mtime\s*乐观锁\s*能够保证并发安全/i },
  { description: 'mtime 乐观锁可以确保并发安全', pattern: /mtime\s*乐观锁\s*可以确保并发安全/i },
  { description: 'mtime 乐观锁可防止竞争写', pattern: /mtime\s*乐观锁\s*可防止竞争写/i },
  {
    description: 'mtime 乐观锁确保竞争 writer 不会双成功',
    pattern: /mtime\s*乐观锁\s*确保竞争\s*writer\s*不会双成功/i,
  },
  { description: 'mtime 乐观锁是并发安全保证', pattern: /mtime\s*乐观锁\s*是并发安全保证/i },
];

export interface A4DocumentationInput {
  ssot: string;
  skill: string;
  dispatchMatrix: string;
  operationalRecovery: string;
  dataModels: string;
  commandReference: string;
  readme: string;
  install: string;
  agents: string;
  contributing: string;
  troubleshooting: string;
  changelog: string;
}

export interface Exit2RawErrorJson {
  exitCode?: unknown;
  category?: unknown;
  rule?: unknown;
  [key: string]: unknown;
}

export interface DocConsistencyInput {
  /** schemas/ 目录 *.schema.json 文件名列表（含后缀） */
  schemaFiles: string[];
  /** subagent/ 目录 .md 人格文件数（实测；期望值由 README「N 个人格文件」表述声明） */
  personaCount: number;
  /** 实测可 exit 2 的 CLI 脚本数（由每个候选 CLI 的真实无副作用输入错误探针统计；self-test.ts 非 exit-2 不计入） */
  exit2ScriptCount: number;
  /** references/ 目录 .md 文件数（实测；期望值由 SKILL.md「（N 个 .md）」表述声明） */
  referencesCount: number;
  dataModels: string;
  /** 活体 Schema 数量权威声明；每项必须声明 schemas/ 目录实测总数，缺失或漂移即违规。 */
  schemaInventoryDocs?: Array<{ name: string; content: string }>;
  verifierSpec: string;
  commandReference: string;
  agentPersonas: string;
  definitionOfDone: string;
  antiPatterns: string;
  glossary: string;
  runLogSchema: string;
  /** w-model-dev/SKILL.md 原文（version 一致性 + 操作行为/硬约束指针检查数据源） */
  skill: string;
  readme: string;
  agents: string;
  ssot: string;
  prePush: string;
  /** 旧调用方兼容输入：Vitest 动态计数不再从文档文本校验，此字段不会被消费。 */
  vitestExtraDocs?: Array<{ name: string; content: string }>;
  /** .github/PULL_REQUEST_TEMPLATE.md 原文（可选——缺省时跳过 PR 模板门禁项数检查） */
  prTemplate?: string;
  /** 门禁项数引用的活体文档白名单（name + 原文）；缺省时跳过 gate-count-docs 检查（fixture 兼容）。 */
  gateCountDocs?: Array<{ name: string; content: string }>;
  /** w-model-dev/references/operation-behaviors.md 原文（八条操作行为 + F1-F10） */
  operationBehaviors: string;
  /** w-model-dev/references/hard-constraints.md 原文（14 条硬约束完整版） */
  hardConstraints: string;
  /** R10 authority spec 原文（独立于其他契约来源注入，禁止仅靠关键词计数） */
  rootCauseAuthoritySpec: string;
  /** R10 rootcause-report schema 原文（独立来源） */
  rootCauseSchema: string;
  /** R10 checker source/JSDoc 原文（独立来源） */
  rootCauseCheckerSource: string;
  /** R10 SSoT 原文（独立来源，虽与 ssot 同文件仍单独登记） */
  rootCauseSsot: string;
  /** R10 根因定位指南原文（独立来源） */
  rootCauseLocator: string;
  /** R10 verifier spec 原文（独立来源，虽与 verifierSpec 同文件仍单独登记） */
  rootCauseVerifierSpec: string;
  /** R10 command reference 原文（独立来源，虽与 commandReference 同文件仍单独登记） */
  rootCauseCommandReference: string;
  /**
   * subagent/ 人格文件清单（name + 原文，按文件名排序）。
   * 数据源：能力声明四字段检查 + R-persona 矩阵 persona 存在性检查。
   * 可选——缺省时跳过这两项（旧调用方/fixture 兼容）。
   */
  personaFiles?: Array<{ name: string; content: string }>;
  /** 根 package.json 原文（version 一致性检查数据源） */
  pkgJson: string;
  /** w-model-dev/skill-metadata.json 原文（version 一致性检查数据源） */
  metaJson: string;
  /** docs/INSTALL.md 原文（version 一致性检查数据源） */
  installDoc: string;
  /** CHANGELOG.md 原文（version 一致性检查数据源：首个 `## [<ver>]` 头须 == 当前版本） */
  changelog: string;
  /** package-lock.json 原文（version 一致性检查数据源：顶层「根 version」；可选——缺省跳过 lock 版本检查；CLI 层注入） */
  lockJson?: string;
  /** w-model-dev/references/subagent-delegation.md 原文（script-registry 检查数据源：门禁脚本权威登记表，dispatch-matrix 节） */
  dispatchMatrix: string;
  /** schemas/*.schema.json 解析后的对象表（键=文件名；F-G4-08 属性级 description 全覆盖检查数据源；可选——缺省时跳过） */
  schemas?: Record<string, unknown>;
  /** w-model-dev/scripts/cli/ 下全部 .ts 文件名（实测；script-registry 检查数据源） */
  cliScriptFiles: string[];
  /**
   * w-model-dev/scripts/__tests__/README.md 覆盖矩阵原文（缺失时为 null）+ 在盘 *.test.ts 文件名清单。
   * tests-matrix 检查数据源；缺省（fixture 未注入）时跳过检查。
   */
  testsMatrix?: { readme: string | null; testFiles: string[] };
  /** 本地生成物与证据导出契约的逐文档输入；缺省时跳过，以保持旧调用方与 fixture 兼容。 */
  localEvidenceDocs?: Array<{ name: string; content: string }>;
  /** docs/ 根 6 份设计文档（活体引用） */
  designDocs: Array<{ name: string; content: string }>;
  /** w-model-dev/scripts/__tests__/ 下 *.test.ts 文件数；仅来自受控 Vitest facts，进入 dynamicMeasurements，不从文档反推。 */
  testFileCount: number;
  /** Vitest facts 实际运行输出的用例总数；-1 = 无法采集，动态检查 fail-closed。 */
  vitestTestCount: number;
  /** 同一份 Vitest JSON 测量的运行结果完整性；false 时不可用动态计数支撑通过结论。 */
  vitestMeasurementsValid?: boolean;
  /** Vitest JSON 缺字段、失败或状态不一致时的确定性原因。 */
  vitestMeasurementsReason?: string;
  /** 同一 Vitest JSON 的完整通过/失败状态，供输出审计。 */
  vitestPassedCount?: number;
  vitestFailedCount?: number;
  vitestSuccess?: boolean;
  /** 目录枚举仅为库存诊断，不能代替 JSON 的 testResults.length。 */
  testDirectoryInventoryCount?: number;
  /** 同次成功 artifact 的机器可验证身份与内容哈希。 */
  vitestRunId?: string;
  vitestArtifactId?: string;
  vitestArtifactSha256?: string;
  vitestCommitSha?: string;
  /** 真实 exit-2 探针逐候选结果。 */
  exit2ProbeResults?: Array<{
    probeId: string;
    script: string;
    args: string[];
    cwd: string;
    status: number;
    errorExitCode: number | null;
    category: string | null;
    rule: string | null;
    rawErrorJson?: Exit2RawErrorJson | null;
    outputExistsAfter?: boolean;
    emittedEvidenceExport?: boolean;
  }>;
  /** A4 状态锁 / 平台修复 / batch B 边界的逐文档文本；缺省时跳过（fixture 兼容）。 */
  a4Docs?: A4DocumentationInput;
  /** w-model-dev/scripts 目录下 .ts 文件是否有变更（git diff + porcelain 判定，由 CLI 层注入） */
  scriptsChanged: boolean;
  /** 根目录 .eslintsecurity-baseline.json 指纹条目数；-1 = 缺失/不可解析，0 = 空 */
  securityBaselineEntryCount: number;
  /**
   * 内链存在性检查数据源（C3）：文档名 + 原文 + 所在目录（相对 repo-root，POSIX 风格）。
   * 可选——缺省（fixture 未注入）时跳过内链检查，与 cliScriptFiles 空守卫策略一致。
   */
  linkDocs?: Array<{ name: string; content: string; baseDir: string }>;
  /** 内链存在性判定（相对 repo-root 的 resolve 后路径 → 是否存在；CLI 层注入 existsSync 包装） */
  linkExists?: (relPath: string) => boolean;
  /**
   * 技能包出站链接检查数据源：w-model-dev/ 包内全部 .md 文档。
   * name = 相对 repo-root 路径（如 w-model-dev/references/verifier-spec.md）；
   * baseDir = 相对技能包根 w-model-dev/ 的所在目录（如 references；包根文件为 '.'）。
   * 可选——缺省（fixture 未注入）时跳过出站链接检查。
   */
  skillPkgDocs?: Array<{ name: string; content: string; baseDir: string }>;
  /**
   * S31 orphan-reference 完整性审计数据源：SKILL.md + references/*.md（declared-list 计数
   * 之外的互补维度——计数相等不代表每份载体都被导航覆盖）。
   * name = 相对技能包根 w-model-dev/ 的 POSIX 路径（'SKILL.md' / 'references/<f>'）；
   * baseDir = name 所在目录（'.' / 'references'）；相对 .md 链接按 baseDir 解析为包内路径。
   * 目标集 = baseDir==='references' 的条目；入链来源 = SKILL.md 条目 + 全部 references 条目。
   * 可选——缺省（fixture 未注入）时跳过孤儿检查。
   */
  orphanAuditDocs?: Array<{ name: string; content: string; baseDir: string }>;
  /**
   * S31 agents-nav-missing 检查数据源：AGENTS.md 原文 + scripts/cli/ 实测 .ts 清单。
   * 每个 cli 基名（去 .ts 后缀）须以子串出现在 AGENTS.md（§8 脚本导航表漂移即违规）。
   * 可选——缺省（fixture 未注入）时跳过该检查，与 cliScriptFiles 空守卫策略互补。
   */
  agentsNav?: { agents: string; cliScriptFiles: string[] };
}

/**
 * 语义性常量（低频变更，无法从活体文档解析或解析成本过高）。
 * 静态计数类期望值（schema / references / persona / exit-2 脚本数）与版本号
 * 一律从活体文档解析，不在此硬编码；Vitest 文件数/用例数属于受控动态 facts，不由文档声明。
 */
export const EXPECTED = {
  runLogActionCount: 27,
  maxAntiPattern: 48,
  prePushCount: 19,
  /** 硬约束条数（14 条） */
  hardConstraintCount: 14,
} as const;

const DOD_README = '7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）';
const DOD_SSOT_TRACE = '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）';
/**
 * 反模式主清单表头（checkAntiPatterns 区间定位锚点）。
 * `| <max> |` 行必须落在该表头与其后首个标题（如「### 命中高发阶段」）之间——
 * 仅「存在」不够：若 #48 被错放其他表（阶段表 / 检测信号表等）同样判定违规。
 */
const ANTI_PATTERN_MAIN_TABLE_HEADER = '| # | 反模式（不要做） | 危害 | 正确做法 |';
const FORBIDDEN_TARGETKIND = [
  'targetKind=file',
  'targetKind=testcase',
  'targetKind = `file`',
  'targetKind = `testcase`',
  'targetKind：`file`',
  'targetKind：`testcase`',
  '"targetKind": "file"',
  '"targetKind": "testcase"',
];
const STALE_RANGES = ['#1~#29', '#1~#19', '#1～#29', '#1～#19'];
const STALE_EXIT2 = ['29 个脚本', '27 个脚本'];
/**
 * 过时 DoD 维度表述（用于 design-docs 检查）。
 * 注意：不用字面「五维度」——设计文档保留历史演变描述（如「五维度扩展为七维度」
 * 「新增第六维度」），仅当表述把当前标准说成五/六维度时才视为过时。
 */
const STALE_DOD_DIMENSIONS = [
  '五维度标准', // 表名（当前为七维度标准）
  '六维度标准', // 标题/表名（当前为七维度标准）
  '五维度 → 六维度', // 演变终点停在六维度
  '五维度扩展为六维度',
  '六维度（更新）', // 章节标题
  '§10.6 六维度', // 过时 SSoT 引用
  '§10.6 五维度', // 过时 SSoT 引用
];
/** `targetKind`（…）括号枚举形式的废弃值检测（如 `targetKind`（`requirement` / `design` / `testcase` / `file`）） */
const TARGETKIND_ENUM_PATTERN = /`targetKind`\s*（[^）]*(?:testcase|file)[^）]*）/;

export interface DocConsistencyReport {
  /** 兼容既有 gate consumers 的全量违规字段。 */
  violations: DocCheckViolation[];
  /** 静态规范违规：登记、文档契约、结构和语义规则。 */
  staticViolations: DocCheckViolation[];
  /** 动态事实违规：由当前文件系统或真实 Vitest JSON 测量得到的计数漂移。 */
  dynamicViolations: DocCheckViolation[];
  /** 当前运行的实测元数据，不是硬编码规范。 */
  dynamicMeasurements: {
    schemaCount: number;
    cliScriptCount: number;
    exit2ScriptCount?: number;
    testFileCount: number;
    vitestTestCount: number;
    vitestArtifactId?: string;
    vitestRunId?: string;
    vitestArtifactSha256?: string;
    exit2ProbeResults?: Array<{
      probeId: string;
      script: string;
      args: string[];
      cwd: string;
      status: number;
      errorExitCode: number | null;
      category: string | null;
      rule: string | null;
      rawErrorJson?: Exit2RawErrorJson | null;
      outputExistsAfter?: boolean;
      emittedEvidenceExport?: boolean;
    }>;
    [key: string]: unknown;
  };
}

const DYNAMIC_CHECKS = new Set([
  'exit2-scripts',
  'exit2-probe',
  'references-count',
  'asset-counts',
  'vitest-results',
  'vitest-tests',
]);

const EXIT2_CATEGORIES = new Set([
  'ARG_INVALID',
  'FILE_NOT_FOUND',
  'FILE_PARSE',
  'FILE_READ',
  'STRUCTURE_INVALID',
  'UNEXPECTED',
]);
const EXIT2_RULE_PATTERN = /^P0-[1-9][0-9]*$/;

type Exit2ProbeRecord = NonNullable<DocConsistencyInput['exit2ProbeResults']>[number];

/** Exit-2 事实包的运行时类型与 ERROR_JSON 规则合同。无效记录不得进入 exit2ScriptCount。 */
export function isValidExit2ProbeResult(probe: unknown): probe is Exit2ProbeRecord {
  if (probe === null || typeof probe !== 'object') return false;
  const record = probe as Record<string, unknown>;
  return (
    typeof record.probeId === 'string' &&
    record.probeId.trim() !== '' &&
    typeof record.script === 'string' &&
    record.script.trim() !== '' &&
    Array.isArray(record.args) &&
    record.args.every((arg) => typeof arg === 'string' && arg.trim() !== '') &&
    typeof record.cwd === 'string' &&
    record.cwd.trim() !== '' &&
    typeof record.status === 'number' &&
    Number.isInteger(record.status) &&
    typeof record.errorExitCode === 'number' &&
    Number.isInteger(record.errorExitCode) &&
    typeof record.category === 'string' &&
    record.category.trim() !== '' &&
    EXIT2_CATEGORIES.has(record.category) &&
    typeof record.rule === 'string' &&
    record.rule.trim() !== '' &&
    EXIT2_RULE_PATTERN.test(record.rule) &&
    isMatchingRawErrorJson(record)
  );
}

function isMatchingRawErrorJson(record: Record<string, unknown>): boolean {
  const raw = record.rawErrorJson;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const payload = raw as Record<string, unknown>;
  return (
    payload.exitCode === record.errorExitCode && payload.category === record.category && payload.rule === record.rule
  );
}

/** 只统计完整且确实返回 exit=2 的探针；缺 rule/category 的事实包不计入脚本数。 */
export function countValidExit2Scripts(probes: readonly unknown[]): number {
  return new Set(
    probes
      .filter(
        (probe): probe is Exit2ProbeRecord =>
          isValidExit2ProbeResult(probe) && probe.status === 2 && probe.errorExitCode === 2,
      )
      .map((probe) => probe.script.replace(/#.*$/, '')),
  ).size;
}

type ProbePathKind = 'sentinel' | 'windows-drive' | 'unc' | 'posix' | 'literal';

type CanonicalProbePath = { value: string; kind: ProbePathKind };

function canonicalizeProbePath(value: string): CanonicalProbePath {
  const isUnc = /^\\\\|^\/\//.test(value);
  const normalized = value.replace(/\\/g, '/').replace(/\/+/g, '/');
  const drive = normalized.match(/^([A-Za-z]):(?:\/|$)/);
  const kind: ProbePathKind = drive !== null ? 'windows-drive' : isUnc ? 'unc' : 'posix';
  if (drive !== null) {
    const rest = normalized.slice(2).replace(/^\/+/, '');
    const segments: string[] = [];
    for (const segment of rest.split('/')) {
      if (segment === '' || segment === '.') continue;
      if (segment === '..') segments.pop();
      else segments.push(segment);
    }
    return { value: `${drive[1]!.toLowerCase()}:/${segments.join('/')}`.replace(/\/$/, ''), kind };
  }
  const segments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return { value: `/${segments.join('/')}`.replace(/\/$/, '') || '/', kind };
}

export function canonicalizeExit2ProbeIdentity(probe: Pick<Exit2ProbeRecord, 'args' | 'cwd'>): {
  args: string[];
  cwd: string;
  argsPathKinds: ProbePathKind[];
  cwdPathKind: ProbePathKind;
} {
  const canonicalizeArg = (arg: string): CanonicalProbePath => {
    if (/^<[^>]+>$/.test(arg)) return { value: arg, kind: 'sentinel' };
    if (/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(arg)) return canonicalizeProbePath(arg);
    return { value: arg, kind: 'literal' };
  };
  const canonicalArgs = probe.args.map(canonicalizeArg);
  const canonicalCwd = /^<[^>]+>$/.test(probe.cwd)
    ? { value: probe.cwd, kind: 'sentinel' as const }
    : canonicalizeProbePath(probe.cwd);
  return {
    args: canonicalArgs.map(({ value }) => value),
    cwd: canonicalCwd.value,
    argsPathKinds: canonicalArgs.map(({ kind }) => kind),
    cwdPathKind: canonicalCwd.kind,
  };
}

function checkExit2ProbeResults(probes: DocConsistencyInput['exit2ProbeResults']): DocCheckViolation[] {
  if (probes === undefined) return [];
  const violations: DocCheckViolation[] = [];
  const probeIds = new Set<string>();
  for (const probe of probes) {
    const probeId = typeof probe?.probeId === 'string' ? probe.probeId : '<missing-probeId>';
    if (probeIds.has(probeId)) {
      violations.push({ check: 'exit2-probe', message: `probeId=${probeId} 重复，探针身份必须稳定且唯一` });
    }
    probeIds.add(probeId);
    if (!isValidExit2ProbeResult(probe)) {
      violations.push({
        check: 'exit2-probe',
        message: `${probeId} 的 Exit2ProbeResult 字段必须完整且类型正确，并与原始 ERROR_JSON 逐字段一致（probeId/script/args/cwd/status/errorExitCode/category/rule/rawErrorJson；category 为已知 ERROR_JSON 类别，rule 符合 P0-N）`,
      });
      continue;
    }
    const metricsContractViolation =
      probe.probeId === 'metrics-report.ts#invalid-phase' &&
      (probe.category !== 'ARG_INVALID' || probe.rule !== 'P0-1');
    if (probe.status !== 2 || probe.errorExitCode !== 2 || metricsContractViolation) {
      violations.push({
        check: 'exit2-probe',
        message: `${probe.probeId} 应以 status=2、ERROR_JSON.exitCode=2、category/rule 稳定存在${
          probe.probeId === 'metrics-report.ts#invalid-phase' ? ' 且 category=ARG_INVALID、rule=P0-1' : ''
        }结束（实际 status=${probe.status}, errorCode=${String(probe.errorExitCode)}, category=${String(probe.category)}, rule=${String(probe.rule)}）`,
      });
    }
    if (probe.script === 'wm-export-evidence.ts') {
      if (probe.outputExistsAfter !== false) {
        violations.push({
          check: 'exit2-probe',
          message: `${probe.probeId} 失败后不得保留输出目录（outputExistsAfter 应为 false）`,
        });
      }
      if (probe.emittedEvidenceExport !== false) {
        violations.push({
          check: 'exit2-probe',
          message: `${probe.probeId} 失败时不得发出 EVIDENCE_EXPORT_JSON（emittedEvidenceExport 应为 false）`,
        });
      }
    }
  }
  return violations;
}

function checkSchemaLoaderPaths(docs: Array<{ name: string; content: string }> | undefined): DocCheckViolation[] {
  if (docs === undefined) return [];
  const violations: DocCheckViolation[] = [];
  for (const doc of docs) {
    if (doc.content.includes('scripts/logic/schema-loader.ts')) {
      violations.push({
        check: 'schema-loader-path',
        message: `${doc.name} 仍引用旧路径 scripts/logic/schema-loader.ts，应改为 scripts/infrastructure/schema-loader.ts`,
      });
    }
  }
  return violations;
}

function isDynamicViolation(violation: DocCheckViolation): boolean {
  if (DYNAMIC_CHECKS.has(violation.check)) return true;
  if (violation.check === 'schema-list') {
    return /应含「### Schema 清单（\d+ 份）」|声明 \d+ 份 Schema，实际 \d+/.test(violation.message);
  }
  if (violation.check === 'script-registry') {
    return /SKILL\.md 声明 \d+ 个 \.ts，实际 \d+/.test(violation.message);
  }
  return false;
}

export interface RootCauseR10ContractSources {
  authoritySpec: string;
  schema: string;
  checkerSource: string;
  ssot: string;
  locator: string;
  verifierSpec: string;
  commandReference: string;
}

const R10_CONTRACT_CHECK = 'rootcause-r10-contract';
type R10ClauseId =
  | 'canonical-name'
  | 'threshold'
  | 'legacy-fallback'
  | 'same-artifact-dedupe'
  | 'cross-artifact-conflict'
  | 'canonical-duplicate'
  | 'legacy-duplicate';
type R10Relation = Record<string, string | number | boolean>;
type R10Clause = {
  id: R10ClauseId;
  marker: string;
  prose: string;
  relation: R10Relation;
};

// R10-CONTRACT-MARKER R10-C1 {"id":"canonical-name","canonicalPersona":"testing-reality-checker"}
// R10-CONTRACT-MARKER R10-C2 {"id":"threshold","canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}
// R10-CONTRACT-MARKER R10-C3 {"id":"legacy-fallback","legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}
// R10-CONTRACT-MARKER R10-C4 {"id":"same-artifact-dedupe","artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}
// R10-CONTRACT-MARKER R10-C5 {"id":"cross-artifact-conflict","artifactRelation":"different","conflict":"fail-closed"}
// R10-CONTRACT-MARKER R10-C6 {"id":"canonical-duplicate","persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}
// R10-CONTRACT-MARKER R10-C7 {"id":"legacy-duplicate","persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}
const R10_CLAUSES: ReadonlyArray<R10Clause> = [
  {
    id: 'canonical-name',
    marker: 'R10-C1',
    prose: 'canonical persona is testing-reality-checker',
    relation: { canonicalPersona: 'testing-reality-checker' },
  },
  {
    id: 'threshold',
    marker: 'R10-C2',
    prose: 'testing-reality-checker confidence >= 0.5',
    relation: { canonicalPersona: 'testing-reality-checker', confidenceMinimum: 0.5 },
  },
  {
    id: 'legacy-fallback',
    marker: 'R10-C3',
    prose: 'legacy reality-checker is fallback only when canonical is absent',
    relation: { legacyPersona: 'reality-checker', fallbackWhen: 'canonical-absent' },
  },
  {
    id: 'same-artifact-dedupe',
    marker: 'R10-C4',
    prose: 'same artifact canonical-first and not counted twice',
    relation: { artifactRelation: 'same', precedence: 'canonical-first', duplicateCount: 'once' },
  },
  {
    id: 'cross-artifact-conflict',
    marker: 'R10-C5',
    prose: 'different artifact conflict is fail-closed',
    relation: { artifactRelation: 'different', conflict: 'fail-closed' },
  },
  {
    id: 'canonical-duplicate',
    marker: 'R10-C6',
    prose: 'canonical > 1 duplicate is fail-closed',
    relation: { persona: 'canonical', duplicateThreshold: 1, duplicatePolicy: 'fail-closed' },
  },
  {
    id: 'legacy-duplicate',
    marker: 'R10-C7',
    prose: 'legacy > 1 duplicate is fail-closed',
    relation: { persona: 'legacy', duplicateThreshold: 1, duplicatePolicy: 'fail-closed' },
  },
];

type R10Node = { id: string; relation: R10Relation; prose: string };
const R10_NODE_IDS = new Set(R10_CLAUSES.map((clause) => clause.id));
const R10_TAG_PATTERN = /^<r10-contract id="([a-z-]+)" relation='(\{.*\})'>([^<\r\n]+)<\/r10-contract>$/;
const R10_LEGACY_TOKEN_PATTERN = /R10-(?:CONTRACT-MARKER|C[1-7])\b/;

function stableR10Relation(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

function isR10Record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseR10NodeValue(value: unknown): R10Node | null {
  if (
    !isR10Record(value) ||
    typeof value.id !== 'string' ||
    typeof value.prose !== 'string' ||
    !isR10Record(value.relation)
  )
    return null;
  const id = value.id as string;
  if (!R10_NODE_IDS.has(id as R10ClauseId)) return null;
  return { id, prose: value.prose as string, relation: value.relation as R10Relation };
}

function parseR10JsonNodes(content: string): R10Node[] | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isR10Record(parsed)) return null;
    let contract: unknown = parsed['x-r10-contract'];
    if (typeof parsed.$comment === 'string') {
      const start = parsed.$comment.indexOf('{');
      if (start >= 0) {
        try {
          contract = (JSON.parse(parsed.$comment.slice(start)) as Record<string, unknown>)['r10-contract'];
        } catch {
          return null;
        }
      }
    }
    if (!Array.isArray(contract)) return null;
    const nodes = contract.map(parseR10NodeValue);
    return nodes.every((node): node is R10Node => node !== null) ? nodes : null;
  } catch {
    return null;
  }
}

function readR10TsValue(node: TsType.Node): unknown {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return readR10TsValue(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(readR10TsValue);
  if (ts.isObjectLiteralExpression(node)) {
    const entries: Array<[string, unknown]> = [];
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) return undefined;
      const name = property.name;
      const key = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
      if (key === undefined) return undefined;
      const value = readR10TsValue(property.initializer);
      if (value === undefined) return undefined;
      entries.push([key, value]);
    }
    return Object.fromEntries(entries);
  }
  return undefined;
}

function parseR10TypeScriptNodes(content: string): R10Node[] | null {
  const sourceFile = ts.createSourceFile('r10-contract.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations: TsType.VariableDeclaration[] = [];
  const visit = (node: TsType.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'R10_CONTRACT_NODES')
      declarations.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (declarations.length !== 1 || declarations[0]!.initializer === undefined) return null;
  const value = readR10TsValue(declarations[0]!.initializer);
  if (!Array.isArray(value)) return null;
  const nodes = value.map(parseR10NodeValue);
  return nodes.every((node): node is R10Node => node !== null) ? nodes : null;
}

function parseR10MarkdownNodes(content: string): R10Node[] | null {
  const nodes: R10Node[] = [];
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      if (line.includes('<r10-contract') || R10_LEGACY_TOKEN_PATTERN.test(line)) return null;
      continue;
    }
    if (line.includes('<r10-contract')) {
      if (!R10_TAG_PATTERN.test(line)) return null;
      const match = line.match(R10_TAG_PATTERN);
      if (match === null) return null;
      let relation: unknown;
      try {
        relation = JSON.parse(match[2]!);
      } catch {
        return null;
      }
      if (!isR10Record(relation)) return null;
      const node = parseR10NodeValue({ id: match[1], relation, prose: match[3] });
      if (node === null) return null;
      nodes.push(node);
      continue;
    }
    if (R10_LEGACY_TOKEN_PATTERN.test(line)) return null;
  }
  return inFence ? null : nodes;
}

function parseR10SourceNodes(sourceName: string, content: string): R10Node[] | null {
  if (content.trimStart().startsWith('<r10-contract')) return parseR10MarkdownNodes(content);
  if (sourceName === 'rootcause-schema') return parseR10JsonNodes(content);
  if (sourceName === 'rootcause-checker') return parseR10TypeScriptNodes(content);
  return parseR10MarkdownNodes(content);
}

function parseR10Clause(sourceName: string, content: string, clause: R10Clause): R10Relation | null {
  const nodes = parseR10SourceNodes(sourceName, content);
  if (nodes === null) return null;
  const matches = nodes.filter((node) => node.id === clause.id);
  if (matches.length !== 1) return null;
  const node = matches[0]!;
  return normalizeR10Prose(node.prose) === normalizeR10Prose(clause.prose) &&
    stableR10Relation(node.relation) === stableR10Relation(clause.relation)
    ? clause.relation
    : null;
}

function normalizeR10Prose(value: string): string {
  return value
    .replace(/[`'"。.!?,，；;：:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * R10 维护契约的唯一 checker。每个权威来源必须独立包含七个结构化关系 clause；
 * 节点必须由对应宿主语法解析，quoted/comment/fenced/example/未知上下文均 fail-closed。
 */
export function checkRootCauseR10Contract(sources: RootCauseR10ContractSources): DocCheckViolation[] {
  const namedSources: Array<[string, string]> = [
    ['authority-spec', sources.authoritySpec],
    ['rootcause-schema', sources.schema],
    ['rootcause-checker', sources.checkerSource],
    ['SSoT', sources.ssot],
    ['root-cause-locator', sources.locator],
    ['verifier-spec', sources.verifierSpec],
    ['command-reference', sources.commandReference],
  ];
  const violations: DocCheckViolation[] = [];
  for (const [sourceName, content] of namedSources) {
    if (typeof content !== 'string' || content.trim() === '') {
      violations.push({
        check: R10_CONTRACT_CHECK,
        message: `${sourceName} 未被独立读取（R10 source 缺失，fail-closed）`,
      });
      continue;
    }
    for (const clause of R10_CLAUSES) {
      if (parseR10Clause(sourceName, content, clause) === null) {
        violations.push({
          check: R10_CONTRACT_CHECK,
          message: `${sourceName} 缺少 R10 clause ${clause.id} 的正向结构化语义关系（source×clause fail-closed）`,
        });
      }
    }
  }
  return violations;
}

/**
 * persona 能力声明四字段（agent-personas.md「Persona 矩阵」§1.5 契约，门禁强制面）。
 *
 * 契约：每个 `subagent/*.md` 的 YAML frontmatter 必须含四项单行非空字段
 * `capabilities` / `inputs` / `outputs` / `boundaries`，供 R-lead / V-lead 在
 * 分派时刻判断「何时适用、何时换人」——没有这四项，人格选择只能照抄矩阵，
 * 「按需加载」退化为纪律而非可回归不变量。
 */
const PERSONA_DECLARATION_FIELDS = [
  { key: 'capabilities', pattern: /^capabilities:[ \t]*\S/m },
  { key: 'inputs', pattern: /^inputs:[ \t]*\S/m },
  { key: 'outputs', pattern: /^outputs:[ \t]*\S/m },
  { key: 'boundaries', pattern: /^boundaries:[ \t]*\S/m },
] as const;
const PERSONA_DECLARATION_CHECK = 'persona-capability-declarations';

export function checkPersonaCapabilityDeclarations(
  personaFiles: Array<{ name: string; content: string }>,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (personaFiles.length === 0) {
    violations.push({
      check: PERSONA_DECLARATION_CHECK,
      message: 'subagent/ 人格文件清单为空（能力声明检查 fail-closed）',
    });
    return violations;
  }
  for (const file of personaFiles) {
    const frontmatter = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatter === null) {
      violations.push({
        check: PERSONA_DECLARATION_CHECK,
        message: `${file.name} 缺 YAML frontmatter（能力声明四字段无宿主）`,
      });
      continue;
    }
    const body = frontmatter[1] ?? '';
    for (const field of PERSONA_DECLARATION_FIELDS) {
      if (!field.pattern.test(body)) {
        violations.push({
          check: PERSONA_DECLARATION_CHECK,
          message: `${file.name} frontmatter 缺非空「${field.key}」字段（能力声明契约见 agent-personas.md §1.5）`,
        });
      }
    }
  }
  return violations;
}

export interface RootCausePersonaMatrixSources {
  /** root-cause-logic.ts 原文（独立解析，禁止 import 被检查模块） */
  checkerSource: string;
  /** agent-personas.md 原文（R-persona 选择矩阵人类视图） */
  authoritySpec: string;
  /** subagent/ 人格文件清单（persona 存在性判据） */
  personaFiles: Array<{ name: string; content: string }>;
}

const PERSONA_MATRIX_CHECK = 'rootcause-persona-matrix';

interface PersonaMatrixSnapshot {
  categories: Map<string, string[]>;
  signals: Array<{ signal: string; personas: string[] }>;
}

/** 从 checker 源码文本独立求值两个矩阵常量（不 import 被检查模块）。 */
function parsePersonaMatrixFromChecker(content: string): PersonaMatrixSnapshot | null {
  const sourceFile = ts.createSourceFile('persona-matrix.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = new Map<string, unknown>();
  const visit = (node: TsType.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'R_PERSONA_MATRIX' || node.name.text === 'R_PERSONA_SIGNAL_MATRIX') &&
      node.initializer !== undefined
    ) {
      values.set(node.name.text, readR10TsValue(node.initializer));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const matrix = values.get('R_PERSONA_MATRIX');
  const signals = values.get('R_PERSONA_SIGNAL_MATRIX');
  if (!isR10Record(matrix) || !Array.isArray(signals)) return null;

  const categories = new Map<string, string[]>();
  for (const [key, value] of Object.entries(matrix)) {
    if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) return null;
    categories.set(key, value);
  }
  const signalRows: Array<{ signal: string; personas: string[] }> = [];
  for (const row of signals) {
    if (!isR10Record(row)) return null;
    const signal = row['signal'];
    const personas = row['personas'];
    if (typeof signal !== 'string' || !Array.isArray(personas)) return null;
    if (!personas.every((p): p is string => typeof p === 'string')) return null;
    signalRows.push({ signal, personas });
  }
  return categories.size === 0 ? null : { categories, signals: signalRows };
}

/** 从 agent-personas.md §2 表格解析每个 matrix 行的 (key, persona 集合)。 */
function parsePersonaMatrixFromMarkdown(content: string): PersonaMatrixSnapshot | null {
  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith('### 2. R-persona 选择矩阵'));
  if (headerIndex < 0) return null;
  const categories = new Map<string, string[]>();
  const signals: Array<{ signal: string; personas: string[] }> = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines.at(i);
    if (line === undefined) break;
    if (line.startsWith('#') || line.startsWith('---')) break;
    if (!line.startsWith('|')) continue;
    // 表头行不是数据行：markdown 表格的表头下一行是分隔行（|---|---|），据此识别并跳过，
    // 避免把两张表的表头（`rootCause.category 候选` / `信号`）当成矩阵行。
    if (/^\|[\s|:-]+\|$/.test(lines.at(i + 1) ?? '')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    const rawKey = cells[0]!;
    if (/^-+$/.test(rawKey.replace(/[\s|]/g, ''))) continue;
    const isCategoryRow = rawKey.includes('`');
    const key = rawKey.replace(/`/g, '').trim();
    if (key === '') continue;
    // 只取人格库命名约定内的 slug（5 类前缀 + 小写连字符）：
    // 单元格内若混入散文（如「Schema 校验缺口」「capabilities」），旧写法会把
    // `chema` / `capabilities` 误当成候选人格（2026-09-17 审查后由 docs 编辑触发实测）。
    const personas = (cells[2]!.match(/[a-z][a-z0-9-]*/g) ?? []).filter((t) =>
      /^(?:engineering|testing|design|product|project)-/.test(t),
    );
    if (isCategoryRow) categories.set(key, personas);
    else signals.push({ signal: key, personas });
  }
  return categories.size === 0 ? null : { categories, signals };
}

function samePersonaSet(a: readonly string[], b: readonly string[]): boolean {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((v, i) => v === right.at(i));
}

/**
 * R-persona 矩阵一致性（R11 判据源的三方对账）：
 *   1. root-cause-logic.ts 的两个矩阵常量与 agent-personas.md §2 表格逐行一致（键与候选集）；
 *   2. 矩阵引用的每个 persona 必须存在于 `subagent/<name>.md`。
 * 任一不成立即 exit 1，防止「门禁按代码里的矩阵判、文档里写的却是别的人格」。
 */
export function checkRootCausePersonaMatrix(sources: RootCausePersonaMatrixSources): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const code = parsePersonaMatrixFromChecker(sources.checkerSource);
  const doc = parsePersonaMatrixFromMarkdown(sources.authoritySpec);
  if (code === null) {
    violations.push({
      check: PERSONA_MATRIX_CHECK,
      message: 'root-cause-logic.ts 未能独立解析出 R_PERSONA_MATRIX / R_PERSONA_SIGNAL_MATRIX（fail-closed）',
    });
    return violations;
  }
  if (doc === null) {
    violations.push({
      check: PERSONA_MATRIX_CHECK,
      message: 'agent-personas.md §2「R-persona 选择矩阵」表格未能解析（fail-closed）',
    });
    return violations;
  }

  for (const [category, personas] of code.categories) {
    const docPersonas = doc.categories.get(category);
    if (docPersonas === undefined) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `agent-personas.md §2 缺 rootCause.category=${category} 行（代码矩阵有、文档无）`,
      });
    } else if (!samePersonaSet(personas, docPersonas)) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `rootCause.category=${category} 行候选集不一致：代码 [${personas.join(', ')}] vs 文档 [${docPersonas.join(', ')}]`,
      });
    }
  }
  for (const category of doc.categories.keys()) {
    if (!code.categories.has(category)) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `agent-personas.md §2 多出 rootCause.category=${category} 行（文档有、代码矩阵无）`,
      });
    }
  }

  const docSignalByKey = new Map(doc.signals.map((row) => [row.signal, row]));
  for (const row of code.signals) {
    const docRow = docSignalByKey.get(row.signal);
    if (docRow === undefined) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `agent-personas.md §2「第二键」缺信号行「${row.signal}」（代码矩阵有、文档无）`,
      });
    } else if (!samePersonaSet(row.personas, docRow.personas)) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `第二键信号「${row.signal}」候选集不一致：代码 [${row.personas.join(', ')}] vs 文档 [${docRow.personas.join(', ')}]`,
      });
    }
  }
  for (const row of doc.signals) {
    if (!code.signals.some((codeRow) => codeRow.signal === row.signal)) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `agent-personas.md §2「第二键」多出信号行「${row.signal}」（文档有、代码矩阵无）`,
      });
    }
  }

  const knownFiles = new Set(sources.personaFiles.map((f) => f.name.replace(/\.md$/, '')));
  // 注意：code.categories 是 Map，必须取其 values()——Object.values(Map) 恒为空数组，
  // 会把「persona 存在性」检查静默缩窄到只剩信号行（负向对照实测抓到的缺陷）。
  const referenced = new Set<string>([
    ...[...code.categories.values()].flat(),
    ...code.signals.flatMap((row) => row.personas),
  ]);
  for (const persona of [...referenced].sort()) {
    if (!knownFiles.has(persona)) {
      violations.push({
        check: PERSONA_MATRIX_CHECK,
        message: `R-persona 矩阵引用了不存在的 persona「${persona}」（subagent/${persona}.md 不存在）`,
      });
    }
  }
  return violations;
}

export function buildDocConsistencyReport(input: DocConsistencyInput): DocConsistencyReport {
  const violations: DocCheckViolation[] = [];
  violations.push(...checkSchemaList(input.schemaFiles, input.dataModels, input.schemaInventoryDocs));
  violations.push(...checkRunLogActionEnum(input.runLogSchema, input.dataModels));
  violations.push(
    ...checkTargetKindLiveDocs(input.verifierSpec, input.commandReference, input.agentPersonas, input.ssot),
  );
  violations.push(...checkDoDDimensions(input.definitionOfDone, input.readme, input.ssot));
  violations.push(...checkOperatingBehaviors(input.skill, input.readme, input.ssot, input.operationBehaviors));
  violations.push(...checkHardConstraints(input.skill, input.hardConstraints));
  violations.push(...checkAntiPatterns(input.antiPatterns));
  violations.push(...checkExit2ScriptCount(input.exit2ScriptCount, input.agents));
  violations.push(...checkConventionsExit2Count(input.glossary, input.exit2ScriptCount));
  violations.push(...checkPrePushCount(input.prePush));
  violations.push(...checkGlossaryAction(input.glossary, input.runLogSchema));
  violations.push(...checkAssetCounts(input.personaCount, input.readme));
  violations.push(...checkReferencesCount(input.referencesCount, input.skill));
  violations.push(...checkDesignDocs(input.designDocs));
  if (input.schemas !== undefined) {
    violations.push(...checkSchemaFieldDescriptions(input.schemas));
  }
  // Vitest 文件数与用例总数只作为受控事实包的动态测量输出，不再要求复制到活体文档。
  // 仍校验 facts/provenance 的完整性、身份、hash 与成功状态，缺失或不可信时 fail-closed。
  violations.push(
    ...checkVitestMeasurements(
      input.vitestTestCount,
      input.vitestMeasurementsValid,
      input.vitestMeasurementsReason,
      input.vitestRunId,
      input.vitestArtifactId,
      input.vitestArtifactSha256,
      input.vitestCommitSha,
    ),
  );
  violations.push(...checkPrTemplatePrePushCount(input.prTemplate));
  violations.push(...checkGateCountLiveDocs(input.gateCountDocs));
  if (input.a4Docs !== undefined) {
    violations.push(...checkA4DocumentationContracts(input.a4Docs));
  }
  violations.push(
    ...checkVersionConsistency(
      input.pkgJson,
      input.metaJson,
      input.skill,
      input.readme,
      input.installDoc,
      input.changelog,
      input.lockJson,
    ),
  );
  violations.push(...checkSsotArchitectureBoundaries(input.ssot));
  violations.push(...checkSsotHeadings(input.ssot));
  violations.push(...checkScriptRegistry(input.cliScriptFiles, input.dispatchMatrix, input.skill));
  if (input.localEvidenceDocs !== undefined) {
    violations.push(...checkLocalEvidenceArtifacts(input.localEvidenceDocs));
  }
  violations.push(...checkBaselineSync(input.scriptsChanged, input.securityBaselineEntryCount));
  if (input.linkDocs !== undefined && input.linkExists !== undefined) {
    violations.push(...checkInternalLinks(input.linkDocs, input.linkExists));
  }
  if (input.skillPkgDocs !== undefined) {
    violations.push(...checkSkillOutboundLinks(input.skillPkgDocs));
    violations.push(...checkSchemaLoaderPaths(input.skillPkgDocs));
  }
  violations.push(...checkOrphanReferences(input.orphanAuditDocs));
  violations.push(...checkAgentsNavCoverage(input.agentsNav));
  violations.push(...checkTestsMatrixCoverage(input.testsMatrix));
  violations.push(...checkExit2ProbeResults(input.exit2ProbeResults));
  violations.push(
    ...checkRootCauseR10Contract({
      authoritySpec: input.rootCauseAuthoritySpec,
      schema: input.rootCauseSchema,
      checkerSource: input.rootCauseCheckerSource,
      ssot: input.rootCauseSsot,
      locator: input.rootCauseLocator,
      verifierSpec: input.rootCauseVerifierSpec,
      commandReference: input.rootCauseCommandReference,
    }),
  );
  if (input.personaFiles !== undefined) {
    violations.push(...checkPersonaCapabilityDeclarations(input.personaFiles));
    violations.push(
      ...checkRootCausePersonaMatrix({
        checkerSource: input.rootCauseCheckerSource,
        authoritySpec: input.rootCauseAuthoritySpec,
        personaFiles: input.personaFiles,
      }),
    );
  }
  return {
    violations,
    staticViolations: violations.filter((v) => !isDynamicViolation(v)),
    dynamicViolations: violations.filter(isDynamicViolation),
    dynamicMeasurements: {
      schemaCount: input.schemaFiles.length,
      cliScriptCount: input.cliScriptFiles.length,
      exit2ScriptCount: input.exit2ScriptCount,
      testFileCount: input.testFileCount,
      vitestTestCount: input.vitestTestCount,
      ...(input.testDirectoryInventoryCount === undefined
        ? {}
        : { testDirectoryInventoryCount: input.testDirectoryInventoryCount }),
      ...(input.vitestPassedCount === undefined ? {} : { numPassedTests: input.vitestPassedCount }),
      ...(input.vitestFailedCount === undefined ? {} : { numFailedTests: input.vitestFailedCount }),
      ...(input.vitestSuccess === undefined ? {} : { success: input.vitestSuccess }),
      ...(input.vitestRunId === undefined ? {} : { vitestRunId: input.vitestRunId }),
      ...(input.vitestArtifactId === undefined ? {} : { vitestArtifactId: input.vitestArtifactId }),
      ...(input.vitestArtifactSha256 === undefined ? {} : { vitestArtifactSha256: input.vitestArtifactSha256 }),
      ...(input.vitestCommitSha === undefined ? {} : { vitestCommitSha: input.vitestCommitSha }),
      ...(input.exit2ProbeResults === undefined ? {} : { exit2ProbeResults: input.exit2ProbeResults }),
    },
  };
}

/** 兼容既有调用方：仍返回未分组的全量违规数组。 */
export function runDocConsistencyChecks(input: DocConsistencyInput): DocCheckViolation[] {
  return buildDocConsistencyReport(input).violations;
}

const VERSION_PATTERN = /\d+\.\d+\.\d+/;

/** 从 YAML frontmatter（SKILL.md 头部）或 YAML 块（INSTALL.md §5 激活机制）中提取 version 行 */
function extractYamlVersion(content: string): string | null {
  const block = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const yaml = block ? block[1]! : content;
  const line = yaml.split(/\r?\n/).find((l) => /^version:\s*/.test(l));
  return line ? (line.match(VERSION_PATTERN)?.[0] ?? null) : null;
}

function extractJsonVersion(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as { version?: unknown } | null;
    return parsed !== null && typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/** 从 CHANGELOG.md 首个 `## [<ver>]` 标题提取版本（Keep-a-Changelog 约定） */
function extractChangelogVersion(changelog: string): string | null {
  const m = changelog.match(/^##\s*\[([^\]]+)\]/m);
  return m !== null ? (m[1]!.match(VERSION_PATTERN)?.[0] ?? null) : null;
}

/**
 * 版本号七处一致性校验（含 package-lock.json 根 version）（堵住 README/INSTALL/CHANGELOG 版本漂移盲区）：
 * CONTRIBUTING.md「数字一致性」约束的自动化落地——package.json 为版本唯一源，
 * skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例
 * / CHANGELOG.md 首个版本节头 / package-lock.json 根 version 六处声明必须全部等于 package.json 解析值。
 * 任一处缺失/不可解析/不一致即报违规（fail loud，不静默放行）。版本提升用 `npm run version:bump`
 * （scripts/version-bump.cjs）一处改版，脚本同步六处文档 + 插 CHANGELOG 节头。注意：version 字段为
 * 字符串比较，不做 semver 归一化——任何细微差异（如 41.5.0 写成 41.5.10）都会被捕获，符合「防漂移」定位。
 */
function checkVersionConsistency(
  pkgJson: string,
  metaJson: string,
  skill: string,
  readme: string,
  installDoc: string,
  changelog: string,
  lockJson?: string,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const expected = extractJsonVersion(pkgJson);
  if (expected === null) {
    violations.push({
      check: 'version-consistency',
      message: 'package.json 无法解析版本号（fail loud）',
    });
    return violations;
  }
  const sources: Array<[string, string | null]> = [
    ['skill-metadata.json', extractJsonVersion(metaJson)],
    ['SKILL.md frontmatter', extractYamlVersion(skill)],
    ['README「当前版本」', readme.match(new RegExp(`当前版本[^\\d]*(${VERSION_PATTERN.source})`))?.[1] ?? null],
    ['docs/INSTALL.md 激活示例', extractYamlVersion(installDoc)],
    ['CHANGELOG.md 首个版本节头', extractChangelogVersion(changelog)],
  ];
  if (lockJson !== undefined) {
    sources.push(['package-lock.json 根 version', extractJsonVersion(lockJson)]);
  }
  for (const [docName, actual] of sources) {
    if (actual === null) {
      violations.push({
        check: 'version-consistency',
        message: `${docName} 无法解析版本号（应为 ${expected}）`,
      });
    } else if (actual !== expected) {
      violations.push({
        check: 'version-consistency',
        message: `${docName} 版本应为 ${expected}，实际 ${actual}`,
      });
    }
  }
  return violations;
}

/**
 * SSoT 顶层章节号连续性与未决占位标题检查（元门禁盲点补充，防章节残骸回归）。
 *  Rule A：解析 SSoT 全部 `## <N>[字母]?. ` 顶层标题，剥离尾部字母得基础号集合，断言 = 1..max 无缺。
 *    字母后缀章（4A / 10A / 10C~10J / 11A 等）归并到基础数字，不新增基础号；只查连续性、不查字母序
 *    （10A 排于 10J 之后为可读性选择，不视为违规）。
 *  Rule B：`^#{2,4} <数字片段>[xX]` 标题视为未决占位（如 `3.3.x`），一律 flag。
 * 守卫：SSoT 无任何 `## N.` 顶层编号标题时返回空（不误伤空 fixture / 未用编号的输入）。
 */
function checkSsotHeadings(ssot: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const lines = ssot.split(/\r?\n/);
  const chapters: number[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(\d+)([A-Z])?\.\s/);
    if (m === null) continue;
    const base = Number(m[1]);
    if (!chapters.includes(base)) chapters.push(base);
  }
  for (const line of lines) {
    // Rule B：标题数字序头（点分段）末段为字面 x/X → 未决占位（如 `3.3.x`）。
    // \d[\d.]* 贪婪吃数字与点，`[xX]` 落在末段；`(?:\s|$)` 保证 x 是标题号末尾而非词中。
    // 与 Rule A 的 `## <N>[字母]?. ` 区分：后者捕捉 4A / 10C 等法定字母章（归并入基础号）。
    if (/^#{2,4}\s+\d[\d.]*[xX](?:\s|$)/.test(line)) {
      violations.push({
        check: 'ssot-headings',
        message: `SSoT 含未决占位标题「${line.trim().slice(0, 60)}」（应改为具体编号）`,
      });
    }
  }
  if (chapters.length === 0) return violations; // 守卫：无编号顶层章，跳过连续性校验
  chapters.sort((a, b) => a - b);
  const max = chapters[chapters.length - 1] ?? 0; // 守卫：chapters 非空已保证，?? 0 满足 noUncheckedIndexedAccess
  const baseSet = new Set(chapters);
  for (let i = 1; i <= max; i++) {
    if (!baseSet.has(i)) {
      violations.push({
        check: 'ssot-headings',
        message: `SSoT 顶层章节号缺 ${i}（当前基础号集合 [${chapters.join(', ')}]）`,
      });
    }
  }
  return violations;
}

/**
 * SSoT 三边界架构图契约：3.1 必须保留 SkillPackage / Host / Tools 三个 Mermaid
 * 边界及宿主到技能包、外部工具的关系；图下文字必须明确交付边界，避免回到内置
 * AI 引擎 / LLM SDK 的旧架构叙述。只检查 SSoT，不把 README 或历史计划当作事实源。
 */
function checkSsotArchitectureBoundaries(ssot: string): DocCheckViolation[] {
  const heading = '### 3.1 整体架构';
  const start = ssot.indexOf(heading);
  const end = start < 0 ? -1 : ssot.indexOf('\n### ', start + heading.length);
  const section = start < 0 ? '' : ssot.slice(start, end < 0 ? undefined : end);
  const requiredTokens = [
    heading,
    'graph LR',
    'subgraph SkillPackage',
    'subgraph Host',
    'subgraph Tools',
    'Host -. 使用技能包规则并执行 .-> SkillPackage',
    'Host -. 可选调用 .-> Tools',
    '图中的边界是交付契约',
    '不属于技能包交付物',
  ];
  const missing = requiredTokens.filter((token) => !section.includes(token));
  if (missing.length === 0) return [];
  return [
    {
      check: 'architecture-boundaries',
      message: `SSoT 三边界架构契约缺失：${missing.join('、')}`,
    },
  ];
}

/**
 * script-registry 检查：堵住「新增门禁脚本但漏登记导航表」——任何脚本改名 / 增删后，若
 * subagent-delegation.md（dispatch-matrix 节，权威登记表，阶段 × S 变体 × check 脚本总览，SKILL.md「完整逐文件表」）漏同步
 * 即报违规。SKILL.md「N 个 .ts」计数表述也须与实测一致（计数动态化：期望值从 SKILL.md 文本解析，
 * 不硬编码）。守卫：cliScriptFiles 为空时返回空（目录不可读 / fixture 未注入时不误报）。
 */
function checkScriptRegistry(cliScriptFiles: string[], dispatchMatrix: string, skill: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (cliScriptFiles.length === 0) return violations;
  for (const file of cliScriptFiles) {
    const name = file.replace(/\.ts$/, '');
    if (!dispatchMatrix.includes(name)) {
      violations.push({
        check: 'script-registry',
        message: `subagent-delegation.md（dispatch-matrix 节）未登记脚本「${name}」（新增/改名门禁脚本须同步权威登记表）`,
      });
    }
  }
  const declared = skill.match(/(\d+)\s*个\s*\.ts/);
  if (declared === null) {
    violations.push({
      check: 'script-registry',
      message: `SKILL.md 缺「N 个 .ts」脚本计数表述（实测 ${cliScriptFiles.length} 个）`,
    });
  } else if (Number(declared[1]) !== cliScriptFiles.length) {
    violations.push({
      check: 'script-registry',
      message: `SKILL.md 声明 ${declared[1]} 个 .ts，实际 ${cliScriptFiles.length}`,
    });
  }
  return violations;
}

/**
 * 本地运行期生成物与审计证据交付边界：覆盖率、宿主状态和 Agent 运行目录必须
 * 逐文档说明为 Git 忽略的本地生成物；审计交付必须显式使用脱敏 SHA-256 manifest
 * 导出命令，且 archive 不能被误表述为这类本地状态目录。
 */
function checkLocalEvidenceArtifacts(docs: Array<{ name: string; content: string }>): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const clauses: Array<[string, string[]]> = [
    ['本地生成物', ['coverage/', '.zcode/', '.w-model/']],
    ['默认不交付', ['Git 忽略', '默认不随 Git 交付']],
    ['显式导出命令', ['npm run wm:export-evidence -- <project-dir> <output-dir>']],
    ['脱敏与哈希', ['脱敏', 'SHA-256']],
    ['安全审阅', ['安全策略审阅']],
    ['自动发布边界', ['不会自动提交或发布']],
    ['归档边界', ['docs/changes/archive/', '.w-model/']],
  ];
  for (const doc of docs) {
    for (const [clause, tokens] of clauses) {
      const missing = tokens.filter((token) => !doc.content.includes(token));
      if (missing.length > 0) {
        violations.push({
          check: 'local-evidence-artifacts',
          message: `${doc.name} 缺本地证据契约「${clause}: ${missing.join('、')}」`,
        });
      }
    }
  }
  return violations;
}

function checkSchemaList(
  schemaFiles: string[],
  dataModels: string,
  schemaInventoryDocs?: Array<{ name: string; content: string }>,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const expectedCount = schemaFiles.length;
  const expectedHeading = `### Schema 清单（${expectedCount} 份）`;
  if (!dataModels.includes(expectedHeading)) {
    violations.push({
      check: 'schema-list',
      message: `data-models.md 应含「${expectedHeading}」标题（当前 ${expectedCount} 个 schema 文件）`,
    });
  }
  for (const file of schemaFiles) {
    const key = file.replace(/\.schema\.json$/, '');
    if (!dataModels.includes(`\`${key}\``)) {
      violations.push({ check: 'schema-list', message: `data-models.md「Schema 清单」表未覆盖 ${file}` });
    }
  }
  for (const doc of schemaInventoryDocs ?? []) {
    const declaredCounts = [
      ...Array.from(
        doc.content.matchAll(
          /(?:JSON\s*Schema|Schema\s*清单|schema\s*清单|schemas\/`|schema)[^\n]{0,80}?[（(]?\s*(\d+)\s*份/gi,
        ),
        (match) => Number(match[1]),
      ),
      ...Array.from(doc.content.matchAll(/(\d+)\s*份[^\n]{0,80}?(?:JSON\s*Schema|Schema|schema)/gi), (match) =>
        Number(match[1]),
      ),
    ];
    if (declaredCounts.length === 0) {
      violations.push({
        check: 'schema-list',
        message: `${doc.name} 缺 Schema 总数权威声明（应为 ${expectedCount} 份）`,
      });
      continue;
    }
    for (const declaredCount of declaredCounts) {
      if (declaredCount !== expectedCount) {
        violations.push({
          check: 'schema-list',
          message: `${doc.name} 声明 ${declaredCount} 份 Schema，实际 ${expectedCount} 份`,
        });
      }
    }
  }
  return violations;
}

function checkRunLogActionEnum(runLogSchema: string, dataModels: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  let count = 0;
  let parseFailed = false;
  let actionEnum: unknown[] | undefined;
  try {
    const schema = JSON.parse(runLogSchema) as { properties?: { action?: { enum?: unknown[] } } };
    actionEnum = schema.properties?.action?.enum;
    count = Array.isArray(actionEnum) ? actionEnum.length : 0;
  } catch {
    parseFailed = true;
  }
  if (parseFailed) {
    violations.push({ check: 'run-log-action', message: 'run-log.schema.json 解析失败' });
  } else if (count !== EXPECTED.runLogActionCount) {
    violations.push({
      check: 'run-log-action',
      message: `run-log.schema.json action.enum 长度应为 ${EXPECTED.runLogActionCount}，实际 ${count}`,
    });
  }
  if (!dataModels.includes(`action enum（${EXPECTED.runLogActionCount} 类）`)) {
    violations.push({
      check: 'run-log-action',
      message: `data-models.md run-log 行应含「action enum（${EXPECTED.runLogActionCount} 类）」`,
    });
  }
  // 语义级同步：data-models.md RunLogEntry interface 的 action 联合类型须与 schema enum 完全一致
  // （审计修复 P2：此前仅查计数文本，interface 漂移 12 值未被捕获）
  if (Array.isArray(actionEnum) && actionEnum.every((v) => typeof v === 'string')) {
    const actionStart = dataModels.indexOf('  action:');
    const actionEnd = actionStart >= 0 ? dataModels.indexOf(';', actionStart) : -1;
    if (actionStart >= 0 && actionEnd > actionStart) {
      const unionBody = dataModels.slice(actionStart, actionEnd).slice('  action:'.length).trim();
      const unionVals = unionBody
        .split('|')
        .map((value) => value.trim())
        .filter((value) => value.length >= 2 && value.startsWith("'") && value.endsWith("'"))
        .map((value) => value.slice(1, -1));
      const missing = (actionEnum as string[]).filter((v) => !unionVals.includes(v));
      const extra = unionVals.filter((v) => !(actionEnum as string[]).includes(v));
      if (missing.length > 0 || extra.length > 0) {
        violations.push({
          check: 'run-log-action',
          message: `data-models.md RunLogEntry.action 联合类型与 run-log.schema.json enum 漂移（缺 ${missing.join(',')}；多 ${extra.join(',')}）`,
        });
      }
    } else {
      violations.push({
        check: 'run-log-action',
        message: 'data-models.md 未找到 RunLogEntry.action 联合类型声明（应为 action: ... | ... ; 形式）',
      });
    }
  }
  return violations;
}

function checkTargetKindLiveDocs(
  verifierSpec: string,
  commandReference: string,
  agentPersonas: string,
  ssot: string,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const docs: Array<[string, string]> = [
    ['verifier-spec', verifierSpec],
    ['command-reference', commandReference],
    ['agent-personas', agentPersonas],
    ['SSoT', ssot],
  ];
  for (const [docName, content] of docs) {
    for (const token of FORBIDDEN_TARGETKIND) {
      if (content.includes(token)) {
        violations.push({
          check: 'targetkind',
          message: `${docName} 检测到废弃 targetKind 标记「${token}」（应为 code/test）`,
        });
      }
    }
  }
  return violations;
}

function checkDoDDimensions(definitionOfDone: string, readme: string, ssot: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!definitionOfDone.includes('## 七维度标准')) {
    violations.push({ check: 'dod', message: 'quick-self-check.md（完成定义（DoD）节）应含「## 七维度标准」标题' });
  }
  if (!readme.includes(DOD_README)) {
    violations.push({ check: 'dod', message: 'README 应含 7 维度 DoD 表述' });
  }
  if (readme.includes('5 维度（功能')) {
    violations.push({ check: 'dod', message: 'README 仍含过时「5 维度（功能 / 质量 / 测试 / 文档 / 部署）」' });
  }
  if (!ssot.includes(DOD_SSOT_TRACE) || !ssot.includes('| **签名链完整性** |')) {
    violations.push({ check: 'dod', message: 'SSoT DoD 表述（§10.6 表 / §10A 追溯）应含第七维度「签名链完整性」' });
  }
  return violations;
}

/**
 * 操作行为一致性（指针模式）：
 * 八条操作行为完整表已移入 references/operation-behaviors.md；SKILL.md 只保留「核心操作行为」节指针。
 * 要求：operation-behavives.md 含完整表（含第 8 条 Structure Over Persuasion）；SKILL.md 含指针且不再内联完整表；
 * README / SSoT 表述不变（仍要求「8 条核心操作行为」与 §4A.1 权威标题）。
 */
function checkOperatingBehaviors(
  skill: string,
  readme: string,
  ssot: string,
  operationBehaviors: string,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!operationBehaviors.includes('## 八条操作行为')) {
    violations.push({
      check: 'operating-behaviors',
      message: 'operation-behaviors.md 应含「## 八条操作行为」标题',
    });
  }
  if (!operationBehaviors.includes('Structure Over Persuasion')) {
    violations.push({
      check: 'operating-behaviors',
      message: 'operation-behaviors.md 操作行为表应含第 8 条 Structure Over Persuasion',
    });
  }
  if (!skill.includes('operation-behaviors.md')) {
    violations.push({
      check: 'operating-behaviors',
      message: 'SKILL.md 应含「核心操作行为」指针（指向 references/operation-behaviors.md）',
    });
  }
  if (skill.includes('| 8 | **Structure Over Persuasion**')) {
    violations.push({
      check: 'operating-behaviors',
      message: 'SKILL.md 不应再内联八条操作行为完整表（已移入 references/operation-behaviors.md）',
    });
  }
  if (!readme.includes('8 条核心操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'README 应含「8 条核心操作行为」' });
  }
  if (!ssot.includes('### 4A.1 八条核心操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'SSoT §4A.1 应含「### 4A.1 八条核心操作行为」权威标题' });
  }
  const outdated = ['6 条核心操作行为', '七条核心操作行为', '7 条核心操作行为', '七条操作行为'];
  for (const token of outdated) {
    if (readme.includes(token) || ssot.includes(token)) {
      violations.push({ check: 'operating-behaviors', message: `README/SSoT 仍含过时「${token}」` });
    }
  }
  return violations;
}

/**
 * 硬约束清单一致性：
 * 14 条硬约束完整版在 references/hard-constraints.md；SKILL.md 只保留单行摘要 + 指针。
 * 要求：SKILL.md 含指针；hard-constraints.md 含 ## #1 ~ ## #N（N=EXPECTED.hardConstraintCount）连续标题。
 */
function checkHardConstraints(skill: string, hardConstraints: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!skill.includes('hard-constraints.md')) {
    violations.push({
      check: 'hard-constraints',
      message: 'SKILL.md 应含「不可违反的约束」指针（指向 references/hard-constraints.md）',
    });
  }
  const headingLines = hardConstraints.split('\n').filter((l) => l.startsWith('## #'));
  for (let i = 1; i <= EXPECTED.hardConstraintCount; i++) {
    if (!headingLines.some((l) => l.startsWith(`## #${i} `))) {
      violations.push({
        check: 'hard-constraints',
        message: `hard-constraints.md 缺「## #${i}」标题（应有 ${EXPECTED.hardConstraintCount} 条）`,
      });
    }
  }
  if (headingLines.some((l) => l.startsWith(`## #${EXPECTED.hardConstraintCount + 1} `))) {
    violations.push({
      check: 'hard-constraints',
      message: `hard-constraints.md 出现超出 ${EXPECTED.hardConstraintCount} 条的「## #${EXPECTED.hardConstraintCount + 1}」标题`,
    });
  }
  return violations;
}

function checkAntiPatterns(antiPatterns: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const headerIdx = antiPatterns.indexOf(ANTI_PATTERN_MAIN_TABLE_HEADER);
  // 主清单表区间：表头行 → 其后首个标题行（真实文档为「### 命中高发阶段」）。
  // 仅断言「| 48 | 行存在」无法判定其归属（阶段表 / 检测信号表同样含 # 行）——
  // #48 必须落在主清单表区间内，否则即使其他表出现 `| 48 |` 也判定违规（终审盲区修复）。
  let mainTable = '';
  if (headerIdx >= 0) {
    const tail = antiPatterns.slice(headerIdx);
    const nextHeading = tail.search(/\r?\n#{1,6} /);
    mainTable = nextHeading < 0 ? tail : tail.slice(0, nextHeading);
  }
  if (!mainTable.includes(`\n| ${EXPECTED.maxAntiPattern} |`)) {
    violations.push({
      check: 'anti-patterns',
      message:
        headerIdx < 0
          ? `hard-constraints.md（反模式节）缺反模式清单表头「${ANTI_PATTERN_MAIN_TABLE_HEADER}」（主清单表最大编号应为 ${EXPECTED.maxAntiPattern}）`
          : `hard-constraints.md（反模式节）反模式清单表内应含最大编号 ${EXPECTED.maxAntiPattern} 行（「| ${EXPECTED.maxAntiPattern} |」出现在主清单表区间之外不计数）`,
    });
  }
  if (!antiPatterns.includes(`#1~#${EXPECTED.maxAntiPattern}`)) {
    violations.push({
      check: 'anti-patterns',
      message: `hard-constraints.md（反模式节）应含连续区间「#1~#${EXPECTED.maxAntiPattern}」`,
    });
  }
  for (const stale of STALE_RANGES) {
    if (antiPatterns.includes(stale)) {
      violations.push({ check: 'anti-patterns', message: `hard-constraints.md（反模式节）仍含过时区间「${stale}」` });
    }
  }
  return violations;
}

/** exit-2 脚本数：期望值从 AGENTS.md「N 个脚本」表述解析，与真实 CLI 输入错误契约探针结果比对。 */
function checkExit2ScriptCount(count: number, agents: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const match = agents.match(/(\d+) 个脚本/);
  if (match === null) {
    violations.push({
      check: 'exit2-scripts',
      message: `AGENTS.md 缺「N 个脚本」exit-2 脚本数表述（实测 ${count}）`,
    });
  } else {
    const declared = Number(match[1]);
    if (declared !== count) {
      violations.push({
        check: 'exit2-scripts',
        message: `AGENTS.md 声明 ${declared} 个脚本，实际 ${count}`,
      });
    }
  }
  for (const stale of STALE_EXIT2) {
    if (agents.includes(stale)) {
      violations.push({ check: 'exit2-scripts', message: `AGENTS.md 仍含过时「${stale}」` });
    }
  }
  return violations;
}

/**
 * pre-push 19 项强校验（F-G7-08，audit-fixes task 6）：解析真实编号检查块并断言连续
 * #1..#19 且恰 19 块——旧实现仅取「最大编号」+「N 项检查」声明文本（N 为当时 prePushCount），伪造 3 块检查的
 * pre-push（`# 1.` `# 2.` `# 19.`）可全绿；重写后中间删除任一块（编号断档）或减少
 * 块数均触发违规，再叠加「19 项检查」声明文本兜底。
 */
export function checkPrePushCount(prePush: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const ids = Array.from(prePush.matchAll(/^# (\d+)\./gm), (m) => Number(m[1]));
  const expected = Array.from({ length: EXPECTED.prePushCount }, (_, i) => i + 1);
  // eslint-disable-next-line security/detect-object-injection -- i 为本地数组的整数下标（examples-contract.test.ts 同型先例），两侧均为本地派生数据
  if (ids.length !== expected.length || !ids.every((n, i) => n === expected[i])) {
    violations.push({
      check: 'pre-push',
      message: `pre-push 检查块须连续 #1..#${EXPECTED.prePushCount} 且恰 ${EXPECTED.prePushCount} 块，实测 ${ids.length} 块 [${ids.join(',')}]`,
    });
  }
  if (!prePush.includes(`${EXPECTED.prePushCount} 项检查`)) {
    violations.push({
      check: 'pre-push',
      message: `pre-push 注释应含「${EXPECTED.prePushCount} 项检查」声明文本`,
    });
  }
  return violations;
}

function checkGlossaryAction(glossary: string, runLogSchema?: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const start = glossary.indexOf('### action（RunLogEntry）');
  const end = start >= 0 ? glossary.indexOf('### ', start + 1) : -1;
  const section = start < 0 ? '' : glossary.slice(start, end === -1 ? undefined : end);
  if (!section.includes('`review`')) {
    violations.push({ check: 'glossary-action', message: 'conventions.md 术语表 action 枚举应含 `review`（V 评审）' });
  }
  if (section.includes('`verify`')) {
    violations.push({ check: 'glossary-action', message: 'conventions.md 术语表 action 枚举不应含 `verify`' });
  }
  // F-G7-05（audit-fixes task 6）：逐值断言——conventions.md 规范定义行的 action 列表
  // 必须与 run-log.schema.json action.enum 完全一致（缺值 / 多值均违规），堵住
  // 「schema 演进时术语表静默漂移」缺口（旧实现仅两点 review/verify 探针）。
  if (runLogSchema !== undefined) {
    let actionEnum: unknown[] | undefined;
    try {
      const schema = JSON.parse(runLogSchema) as { properties?: { action?: { enum?: unknown[] } } };
      actionEnum = schema.properties?.action?.enum;
    } catch {
      violations.push({
        check: 'glossary-action',
        message: 'run-log.schema.json 解析失败（glossary action 逐值断言无法执行）',
      });
    }
    if (Array.isArray(actionEnum) && actionEnum.every((v) => typeof v === 'string')) {
      // 按 /\r?\n/ 切行（CRLF 文件中 \r 为行终止符，行内 $ 锚点会失配）
      const defLine = section.split(/\r?\n/).find((l) => l.includes('规范定义') && l.includes('run-log 动作类型枚举'));
      const afterColon = defLine?.match(/为准）[：:]\s*(.*)/)?.[1];
      if (defLine === undefined || afterColon === undefined) {
        violations.push({
          check: 'glossary-action',
          message:
            'conventions.md 术语表 action 节缺「规范定义：run-log 动作类型枚举（共 N 值，以 `run-log.schema.json` 为准）：`值` / …」逐值列表行',
        });
      } else {
        const declared = Array.from(afterColon.matchAll(/`([^`]+)`/g), (m) => m[1]!);
        const enumVals = actionEnum as string[];
        const missing = enumVals.filter((v) => !declared.includes(v));
        const extra = declared.filter((v) => !enumVals.includes(v));
        if (missing.length > 0 || extra.length > 0) {
          violations.push({
            check: 'glossary-action',
            message: `conventions.md action 列表与 run-log.schema.json action.enum 漂移（缺 ${missing.join(',')}；多 ${extra.join(',')}）`,
          });
        }
      }
    }
  }
  return violations;
}

/**
 * conventions.md exit-2 脚本计数句检查（F-G7-04，audit-fixes task 6）：
 * 「= N（N 个 check-* + N 个工具 CLI，不含 self-test）」声明须算术自洽且等于
 * 真实输入错误契约探针实测数——conventions.md 不在旧 checkExit2ScriptCount 的
 * AGENTS.md 检查源内，计数漂移此前在门禁上不可见。
 */
export function checkConventionsExit2Count(conventions: string, actualCount: number): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const m = conventions.match(/=\s*(\d+)（(\d+)\s*个 check-\*\s*\+\s*(\d+)\s*个工具 CLI/);
  if (m === null) {
    violations.push({
      check: 'exit2-scripts',
      message: `conventions.md 缺「= N（N 个 check-* + N 个工具 CLI，不含 self-test）」exit-2 计数句（实测 ${actualCount} 个）`,
    });
    return violations;
  }
  const total = Number(m[1]);
  const checks = Number(m[2]);
  const tools = Number(m[3]);
  if (checks + tools !== total) {
    violations.push({
      check: 'exit2-scripts',
      message: `conventions.md exit-2 计数算术不符：${checks} 个 check-* + ${tools} 个工具 CLI ≠ ${total}`,
    });
  }
  if (total !== actualCount) {
    violations.push({
      check: 'exit2-scripts',
      message: `conventions.md 声明 exit-2 脚本 ${total} 个，实际 ${actualCount} 个`,
    });
  }
  if (!/不含\s*self-test/.test(conventions)) {
    violations.push({
      check: 'exit2-scripts',
      message: 'conventions.md exit-2 计数句须注明「不含 self-test」（回归基线 exit 0/1，非 exit-2 脚本）',
    });
  }
  return violations;
}

/**
 * schema 属性级 description 全覆盖检查（F-G4-08，audit-fixes task 6）：
 * 任何含 properties 的 schema 节点（根 / 嵌套对象 / definitions|$defs / 数组 items）
 * 必须自带 description，使 AGENTS.md「25 份全字段 description 自描述」声明受门禁强制。
 * 遍历覆盖 properties 子节点、definitions（含 draft-2019-09+ 的 $defs 兼容）与 items
 * （数组形态逐项、单例形态整体）；标量属性节点由其所在 properties 持有者的子节点遍历到达。
 */
export function checkSchemaFieldDescriptions(schemas: Record<string, unknown>): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const visit = (node: unknown, path: string, file: string): void => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as Record<string, unknown>;
    if (n.properties !== undefined && n.description === undefined) {
      violations.push({
        check: 'schema-descriptions',
        message: `${file}: ${path} 缺 description（AGENTS.md「全字段 description 自描述」契约）`,
      });
    }
    for (const [k, v] of Object.entries(n.properties ?? {})) visit(v, `${path}/properties/${k}`, file);
    const defs = (n.definitions ?? n.$defs) as Record<string, unknown> | undefined;
    for (const [k, v] of Object.entries(defs ?? {})) visit(v, `${path}/definitions/${k}`, file);
    if (Array.isArray(n.items)) (n.items as unknown[]).forEach((v, i) => visit(v, `${path}/items/${i}`, file));
    else visit(n.items, `${path}/items`, file);
  };
  for (const [file, schema] of Object.entries(schemas)) visit(schema, '#', file);
  return violations;
}

/** subagent/ 人格文件数：期望值从 README「N 个人格文件」表述解析，与实测比对。 */
function checkAssetCounts(personaCount: number, readme: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const match = readme.match(/(\d+) 个人格文件/);
  if (match === null) {
    violations.push({
      check: 'asset-counts',
      message: `README 缺「N 个人格文件」计数表述（实测 ${personaCount} 个）`,
    });
  } else {
    const declared = Number(match[1]);
    if (declared !== personaCount) {
      violations.push({
        check: 'asset-counts',
        message: `README 声明 ${declared} 个人格文件，实际 ${personaCount}`,
      });
    }
  }
  return violations;
}

/**
 * references/ 目录 .md 文件数一致性：
 * 期望值从 SKILL.md「Bundled Resources」表「（N 个 .md）」计数表述解析
 * （如 `` `references/`（57 个 .md） ``，资源名反引号格式可异），与实测比对——
 * 新增 references/*.md 时只需同步 SKILL.md，门禁自动校验一致性，防再次漂移。
 */
function checkReferencesCount(referencesCount: number, skill: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const match = skill.match(/（(\d+) 个 \.md）/);
  if (match === null) {
    violations.push({
      check: 'references-count',
      message: `SKILL.md 缺「（N 个 .md）」计数表述（实测 ${referencesCount} 个 .md，新增文件须同步 SKILL.md）`,
    });
    return violations;
  }
  const declared = Number(match[1]);
  if (declared !== referencesCount) {
    violations.push({
      check: 'references-count',
      message: `SKILL.md 声明 ${declared} 个 .md，实际 ${referencesCount}（新增文件须同步 SKILL.md）`,
    });
  }
  return violations;
}

function checkDesignDocs(designDocs: Array<{ name: string; content: string }>): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  for (const doc of designDocs) {
    for (const token of FORBIDDEN_TARGETKIND) {
      if (doc.content.includes(token)) {
        violations.push({
          check: 'design-docs',
          message: `${doc.name} 检测到废弃 targetKind 标记「${token}」（应为 code/test）`,
        });
      }
    }
    const enumMatch = doc.content.match(TARGETKIND_ENUM_PATTERN);
    if (enumMatch) {
      violations.push({
        check: 'design-docs',
        message: `${doc.name} 的 targetKind 括号枚举仍含废弃值「${enumMatch[0]}」（应为 code/test）`,
      });
    }
    for (const stale of STALE_DOD_DIMENSIONS) {
      if (doc.content.includes(stale)) {
        violations.push({
          check: 'design-docs',
          message: `${doc.name} 仍含过时 DoD 维度表述「${stale}」（当前七维度）`,
        });
      }
    }
    for (const stale of STALE_RANGES) {
      if (doc.content.includes(stale)) {
        violations.push({ check: 'design-docs', message: `${doc.name} 仍含过时反模式区间「${stale}」` });
      }
    }
  }
  return violations;
}

/**
 * Vitest 动态事实包完整性校验。
 * 文件数和用例数只进入 dynamicMeasurements，不再从 README/AGENTS/pre-push 等文档反推或要求复制。
 * 缺失/损坏 facts、身份、artifact 路径、hash 或 commit 绑定时保持 fail-closed。
 */
function checkVitestMeasurements(
  vitestTestCount: number,
  vitestMeasurementsValid?: boolean,
  vitestMeasurementsReason?: string,
  vitestRunId?: string,
  vitestArtifactId?: string,
  vitestArtifactSha256?: string,
  vitestCommitSha?: string,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (vitestMeasurementsValid !== true) {
    violations.push({
      check: 'vitest-results',
      message: `Vitest JSON 运行结果不可采信：${vitestMeasurementsReason ?? '缺失完整成功状态'}（fail-closed）`,
    });
  }
  if (vitestTestCount < 0) {
    violations.push({
      check: 'vitest-tests',
      message: 'Vitest 实测用例总数无法采集（Vitest 启动、JSON 或文本解析失败；fail-closed）',
    });
  }
  if (vitestMeasurementsValid === true) {
    const validArtifactId =
      typeof vitestArtifactId === 'string' &&
      vitestArtifactId.startsWith('vitest/') &&
      vitestArtifactId.endsWith('.json') &&
      vitestArtifactId
        .split('/')
        .every(
          (segment) => segment.length > 0 && segment !== '.' && segment !== '..' && /^[A-Za-z0-9._-]+$/.test(segment),
        );
    const validArtifact =
      typeof vitestRunId === 'string' &&
      /^[0-9a-f]{16}$/i.test(vitestRunId) &&
      validArtifactId &&
      typeof vitestArtifactSha256 === 'string' &&
      /^[0-9a-f]{64}$/i.test(vitestArtifactSha256) &&
      typeof vitestCommitSha === 'string' &&
      /^[0-9a-f]{40}$/i.test(vitestCommitSha);
    if (!validArtifact) {
      violations.push({
        check: 'vitest-results',
        message: '成功 Vitest artifact 缺少有效 runId、相对 artifactId、commit SHA 或内容 SHA-256（fail-closed）',
      });
    }
  }
  return violations;
}

/**
 * A4 文档契约：将状态锁、显式平台修复和 batch B 未完成边界接入真正的 docs-consistency
 * 门禁。每项按文档职责逐一验证，禁止以多份文档拼接后「任一字符串存在」的方式放行。
 */
function checkA4DocumentationContracts(docs: A4DocumentationInput): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const stateLockDocs: Array<[string, string]> = [
    ['SSoT', docs.ssot],
    ['SKILL.md', docs.skill],
    ['subagent-delegation.md（dispatch-matrix 节）', docs.dispatchMatrix],
    ['operational-recovery.md', docs.operationalRecovery],
    ['data-models.md', docs.dataModels],
    ['command-reference.md', docs.commandReference],
  ];
  for (const [name, content] of stateLockDocs) {
    if (!content.includes('<target>.lock') || !content.includes('owner')) {
      violations.push({
        check: 'a4-state-lock',
        message: `${name} 应逐文档声明 <target>.lock 持久目录与 owner 跨进程锁协议`,
      });
    }
    for (const { description, pattern } of A4_FORBIDDEN_MTIME_SAFETY_CLAIM_PATTERNS) {
      if (pattern.test(content)) {
        violations.push({
          check: 'a4-state-lock',
          message: `${name} 不得包含 mtime 错误安全主张「${description}」`,
        });
      }
    }
  }
  for (const [name, content] of stateLockDocs) {
    if (!content.includes('--lock-timeout') || !content.includes('--recover-stale-lock')) {
      violations.push({
        check: 'a4-state-lock',
        message: `${name} 应声明 --lock-timeout 与显式 --recover-stale-lock 边界`,
      });
    }
  }

  const platformDocs: Array<[string, string]> = [
    ['README.md', docs.readme],
    ['docs/INSTALL.md', docs.install],
    ['AGENTS.md', docs.agents],
    ['CONTRIBUTING.md', docs.contributing],
    ['docs/troubleshooting.md', docs.troubleshooting],
  ];
  for (const [name, content] of platformDocs) {
    if (!content.includes('platform-deps:check') || !content.includes('platform-deps:install')) {
      violations.push({
        check: 'a4-platform-repair',
        message: `${name} 应声明 platform-deps:check 与 platform-deps:install 为显式入口`,
      });
    }
    if (!/不自动|不会自动|绝不自动/.test(content)) {
      violations.push({
        check: 'a4-platform-repair',
        message: `${name} 应明确 pre-push/平台检查不自动安装或修复`,
      });
    }
    for (const { description, pattern } of A4_FORBIDDEN_AUTOMATIC_INSTALL_PATTERNS) {
      if (pattern.test(content)) {
        violations.push({
          check: 'a4-platform-repair',
          message: `${name} 仍含自动安装/补装/平台修复禁止句式「${description}」`,
        });
      }
    }
  }

  return violations;
}

/** pre-push 门禁项数引用的活体文档白名单（gate-count-docs，F1 反哺）：
 * 仅扫承载「N 项门禁/检查」计数引用的四份活体文档。SSoT 用「第 N 项门禁」下标形式且含日期
 * 陈述（下标不随总数必变），CHANGELOG.md / CHANGELOG-archive.md / docs/changes/**（历史不可改）
 * 与 docs/superpowers/**（内部规划）不入白名单——靠白名单而非全仓扫描规避假阳性。 */
const GATE_COUNT_DOC_NAMES = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/troubleshooting.md'];

/**
 * 活体文档门禁项数引用扫描（gate-count-docs）：泛化自 checkPrTemplatePrePushCount（先例 :1724）。
 * 行含「门禁/检查」标记时，全部「N 项」计数引用须 == EXPECTED.prePushCount，防止门禁项数
 * N→N+1 后未测试 docs 文件（如 docs/troubleshooting.md）漏改。逐行 fresh 正则（无共享 lastIndex）：
 * 前缀捕获组 `((?:第)?\s*)`（m[1] 恒有值，裸「17 项」为 ''）——m[1] 含「第」即「第 N 项」序数
 * 引用（带/不带空格均覆盖，如「第 14 项 npm audit」）跳过，m[2] 为计数值；`(?!目)` 排除
 * 「N 项目」误匹配；仅 ASCII 数字（中文数字如「五项校验」天然不命中）。gateCountDocs 未注入
 * （缺省）时跳过。
 */
export function checkGateCountLiveDocs(
  docs: Array<{ name: string; content: string }> | undefined,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (docs === undefined) return violations;
  for (const doc of docs) {
    if (!GATE_COUNT_DOC_NAMES.includes(doc.name)) continue;
    const lines = doc.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- i 为本地数组的整数下标（docs-consistency-logic.ts:1377 同型先例），两侧均为本地派生数据
      const line = lines[i]!;
      if (!line.includes('门禁') && !line.includes('检查')) continue;
      for (const m of line.matchAll(/((?:第)?\s*)(\d+)\s*项(?!目)/g)) {
        if (m[1]!.includes('第')) continue; // 「第 N 项」序数引用，跳过
        if (Number(m[2]!) !== EXPECTED.prePushCount) {
          violations.push({
            check: 'gate-count-docs',
            message: `${doc.name}:${i + 1} 存在过期门禁项数「${m[0]}」（当前 ${EXPECTED.prePushCount} 项），须同步`,
          });
        }
      }
    }
  }
  return violations;
}

/**
 * PR 模板 pre-push 项数同步检查（P1-1 反哺）：模板内全部「N 项」表述须与
 * EXPECTED.prePushCount 一致。历史盲区：PR 模板曾长期停留「14 项通过」。
 * prTemplate 未注入（缺省）时跳过。字面量正则 → 不触发 detect-non-literal-regexp。
 */
function checkPrTemplatePrePushCount(prTemplate: string | undefined): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (prTemplate === undefined) return violations;
  const re = /(\d+)\s*项/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prTemplate)) !== null) {
    if (Number(m[1]) !== EXPECTED.prePushCount) {
      violations.push({
        check: 'pre-push',
        message: `.github/PULL_REQUEST_TEMPLATE.md 存在过期门禁项数「${m[0]}」（当前 ${EXPECTED.prePushCount} 项），须同步`,
      });
    }
  }
  return violations;
}

/**
 * 安全 baseline 同步检查（spec §3）：w-model-dev/scripts/** 下 .ts 文件有变更时，
 * 根目录 .eslintsecurity-baseline.json 必须存在且非空（sha256 指纹文件），否则 security-scan
 * 无法豁免既有风险，属文档/门禁漂移。
 */
function checkBaselineSync(scriptsChanged: boolean, baselineEntryCount: number): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!scriptsChanged) return violations;
  if (baselineEntryCount < 0) {
    violations.push({
      check: 'baseline-sync',
      message:
        'w-model-dev/scripts/** 有变更，但根目录 .eslintsecurity-baseline.json 缺失或不可解析（须运行 npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate 同步 baseline）',
    });
  } else if (baselineEntryCount === 0) {
    violations.push({
      check: 'baseline-sync',
      message:
        'w-model-dev/scripts/** 有变更，但 .eslintsecurity-baseline.json 指纹条目为空（须运行 npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate 同步 baseline）',
    });
  }
  return violations;
}

// ==================== 内链存在性检查（C3） ====================

/**
 * 剥离围栏代码块（``` / ~~~）与行内 code span（`...`）后的可渲染文本。
 * 围栏内的 `[x](y)` 是代码示例（命令用法 / 正则演示），不参与链接提取；
 * 行内 code span 同理（渲染器不解析其中的链接语法）。
 */
export function stripMarkdownCode(content: string): string {
  let inFence = false;
  const lines = content.split(/\r?\n/).filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return false; // 围栏边界行本身也剔除
    }
    return !inFence;
  });
  return lines.join('\n').replace(/`[^`\n]*`/g, '');
}

/**
 * 提取 Markdown 相对链接目标（文档级导航链接存在性检查数据源）。
 * 规则（与设计文档 C3 对齐）：
 *   - 匹配 `[text](target)`（含图片 `![alt](src)` 的内层——资源缺失同属漂移）；
 *   - 跳过绝对 URL（http:/https:/mailto:/data:）与纯锚点（#xxx）；
 *   - 剥离锚点（foo.md#sec → foo.md）与 query（foo.md?q=1 → foo.md）；
 *   - 剥离后为空的目标跳过；
 *   - 只处理剥离代码块后的文本（见 stripMarkdownCode）。
 */
export function extractMarkdownRelLinks(content: string): string[] {
  const text = stripMarkdownCode(content);
  const out: string[] = [];
  for (const m of text.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]*)>?[^)]*\)/g)) {
    const raw = m[1];
    if (raw === undefined || raw === '') continue;
    if (/^(https?:|mailto:|data:|file:)/i.test(raw)) continue; // 外部/协议 URL
    if (raw.startsWith('#')) continue; // 纯锚点
    const target = raw.split('#')[0]!.split('?')[0]!;
    if (target === '') continue; // 剥离后为空（纯锚点/纯 query 变体）
    out.push(target);
  }
  return out;
}

/**
 * 文档内链存在性检查（C3）：提取各文档相对链接 → 相对文档所在目录拼接归一化
 * （保持「相对 repo-root 的 POSIX 路径」语义，与 baseDir 一致；不用 path.resolve——
 * 它会基于 process.cwd() 产出绝对路径，破坏 CLI 层 join(root, relPath) 注入约定）
 * → linkExists 判定。断链（文件改名/删除/路径笔误后文档未同步）即报违规；
 * 同一断链目标在多文档出现会逐条报（每条带文档名定位，便于修复）。
 * 守卫：linkDocs/linkExists 缺省时不检查（fixture 兼容）。
 */
function checkInternalLinks(
  linkDocs: Array<{ name: string; content: string; baseDir: string }>,
  linkExists: (relPath: string) => boolean,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  for (const doc of linkDocs) {
    for (const target of extractMarkdownRelLinks(doc.content)) {
      const resolved = path.posix.normalize(path.posix.join(doc.baseDir, target));
      if (!linkExists(resolved)) {
        violations.push({
          check: 'internal-links',
          message: `${doc.name} 内链断链：${target}（resolve → ${resolved}，目标文件不存在；改名/移动文件后须同步引用处）`,
        });
      }
    }
  }
  return violations;
}

/**
 * 技能包出站链接检查（skill-outbound-links）：w-model-dev/ 是可整体拷贝分发的自包含技能包，
 * 包内任何 .md 的相对链接解析后不得逃逸包根（如 references/ 下用 ../../docs/ 指向仓库根资产）。
 * 逃逸链接在独立安装（拷贝 w-model-dev/ 至用户项目）后必断；C3 内链检查按 repo-root 存在性
 * 放行，无法发现「仓库内存在、包外失效」的链接，故需本规则独立拦截。
 * 修法：改包内相对路径，或转纯文本引用（如「SSoT §10.6（`docs/skill-design-document_SSoT.md`）」）。
 */
export function checkSkillOutboundLinks(
  skillPkgDocs: Array<{ name: string; content: string; baseDir: string }>,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  for (const doc of skillPkgDocs) {
    for (const target of extractMarkdownRelLinks(doc.content)) {
      const resolved = path.posix.normalize(path.posix.join(doc.baseDir, target));
      if (resolved === '..' || resolved.startsWith('../')) {
        violations.push({
          check: 'skill-outbound-links',
          message: `${doc.name} 链接逃逸技能包根：${target}（resolve → ${resolved}，超出 w-model-dev/）；技能包须自包含，改包内相对路径或纯文本引用（如「见仓库 docs/xxx.md」）`,
        });
      }
    }
  }
  return violations;
}

// ==================== S31 完整性审计双维度（orphan-reference / agents-nav-missing） ====================

/**
 * S31 orphan-reference 豁免清单（条目 = references/ 下文件名，如 'draft-appendix.md'）。
 * 当前为空数组：实测 43 个 references/*.md 全部有 ≥1 条来自 SKILL.md 或其它 references/*.md
 * 的相对入链，门禁先天严格。未来出现合法孤儿载体（如纯附录页）时登记到此处并注明理由；
 * 清单外文件一律强制入链——豁免是显式登记，不是缺省放行。
 */
export const ORPHAN_REFERENCE_EXEMPTIONS: ReadonlyArray<string> = [];

/**
 * S31 orphan-reference：每个 references/*.md 须有 ≥1 条来自 SKILL.md 或「其它」references/*.md
 * 的相对 .md 入链（自链接不计——自我引用不构成导航）。与 references-count「计数相等」正交互补：
 * 计数相等只保证清单完整，不保证每份载体都被 SKILL/references 导航网覆盖（孤儿 = 死文档前兆）。
 * 链接提取复用 extractMarkdownRelLinks（围栏/行内 code span 剥离、锚点/query 剥离、外部 URL 跳过），
 * 按 baseDir 做 POSIX 归一化解析到包内路径后与目标名比对。
 * fail-closed：docs 注入但缺 SKILL.md 条目（name==='SKILL.md' 且 baseDir==='.'）→ 单条违规，
 * 不在来源不完整时对目标集静默放行。豁免经 ORPHAN_REFERENCE_EXEMPTIONS（exemptions 参数注入，
 * 生产挂载用默认常量）。守卫：docs 缺省时跳过（fixture 兼容，与 linkDocs/skillPkgDocs 一致）。
 */
export function checkOrphanReferences(
  docs: Array<{ name: string; content: string; baseDir: string }> | undefined,
  exemptions: ReadonlyArray<string> = ORPHAN_REFERENCE_EXEMPTIONS,
): DocCheckViolation[] {
  if (docs === undefined) return [];
  const hasSkillDoc = docs.some((d) => d.name === 'SKILL.md' && d.baseDir === '.');
  if (!hasSkillDoc) {
    return [
      {
        check: 'orphan-reference',
        message:
          'orphanAuditDocs 未注入 SKILL.md 条目（name=SKILL.md、baseDir=.），入链来源不完整，fail-closed（CLI 须注入 SKILL.md + references/*.md 全量）',
      },
    ];
  }
  const targets = docs.filter((d) => d.baseDir === 'references' && d.name.endsWith('.md'));
  // 每个入链来源的解析目标集（包内相对路径）；自链接不作为自身目标的入链来源（「其它 references」语义）
  const sourceLinks = docs.map((doc) => ({
    name: doc.name,
    targets: new Set(
      extractMarkdownRelLinks(doc.content).map((link) => path.posix.normalize(path.posix.join(doc.baseDir, link))),
    ),
  }));
  const violations: DocCheckViolation[] = [];
  for (const target of targets) {
    const basename = target.name.slice(target.name.lastIndexOf('/') + 1);
    if (exemptions.includes(basename)) continue;
    const linked = sourceLinks.some((source) => source.name !== target.name && source.targets.has(target.name));
    if (!linked) {
      violations.push({
        check: 'orphan-reference',
        message: `${target.name} 无任何来自 SKILL.md 或其它 references/*.md 的相对入链（孤儿载体）；补导航链接，或按豁免流程登记 ORPHAN_REFERENCE_EXEMPTIONS（须注明理由）`,
      });
    }
  }
  return violations;
}

/**
 * 解析 AGENTS.md **§8 脚本导航表**的行首单元格（脚本名），返回精确名集合。
 * 只扫描 `## 8.` 标题到下一个 H2 之间的 Markdown 表格行；表头 / 分隔行 / 其余章节正文与代码块
 * 一律不参与——「表里没有这一行」必须能被测到（旧实现用全文子串，等价于从没检查过 §8 表）。
 */
function parseAgentsNavRows(agents: string): Set<string> {
  const declared = new Set<string>();
  let inSection = false;
  for (const line of agents.split('\n')) {
    if (/^##\s*8\./.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break; // 进入下一章即离开 §8
    if (!inSection || !/^\s*\|/.test(line)) continue;
    const firstCell = line
      .slice(line.indexOf('|') + 1)
      .split('|')[0]
      ?.trim();
    if (firstCell === undefined || firstCell === '' || firstCell === '脚本名' || /^-+$/.test(firstCell)) continue;
    declared.add(firstCell.replace(/^`/, '').replace(/`$/, ''));
  }
  return declared;
}

/**
 * tests-matrix：`w-model-dev/scripts/__tests__/README.md` 覆盖矩阵首列集合必须与在盘 `*.test.ts`
 * 集合**双向相等**（任务 7）。旧状态只有 AGENTS.md 的「N 个测试文件」动态计数，它证明不了
 * 「新增测试文件是否被登记进矩阵」——漏登的新文件不参与任何检查却照样让计数通过。
 * 违规码：`tests-matrix-missing`（在盘未登记，或 README 整体缺失）/ `tests-matrix-orphan`
 * （登记了在盘不存在的文件）/ `tests-matrix-duplicate`（同一文件多行）。
 * 守卫：testsMatrix 缺省时跳过（fixture 未注入时不误报）。
 */
export function checkTestsMatrixCoverage(
  matrix: { readme: string | null; testFiles: string[] } | undefined,
): DocCheckViolation[] {
  if (matrix === undefined) return [];
  if (matrix.readme === null) {
    return [
      {
        check: 'tests-matrix-missing',
        message: 'w-model-dev/scripts/__tests__/README.md 缺失：测试覆盖矩阵无法核对（漏登检测失效）',
      },
    ];
  }
  const declared = new Map<string, number>();
  for (const line of matrix.readme.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const firstCell = line
      .slice(line.indexOf('|') + 1)
      .split('|')[0]
      ?.trim();
    if (firstCell === undefined || firstCell === '' || firstCell === 'File' || /^-+$/.test(firstCell)) continue;
    const name = firstCell.replace(/^`/, '').replace(/`$/, '');
    declared.set(name, (declared.get(name) ?? 0) + 1);
  }
  const onDisk = new Set(matrix.testFiles);
  const violations: DocCheckViolation[] = [];
  for (const [name, count] of declared) {
    if (!onDisk.has(name)) {
      violations.push({
        check: 'tests-matrix-orphan',
        message: `测试覆盖矩阵登记了在盘不存在的测试文件：${name}（README 表格行与 __tests__/*.test.ts 必须双向相等）`,
      });
    }
    if (count > 1) {
      violations.push({
        check: 'tests-matrix-duplicate',
        message: `测试覆盖矩阵同一文件登记了 ${count} 行：${name}（每文件恰一行）`,
      });
    }
  }
  for (const file of matrix.testFiles) {
    if (!declared.has(file)) {
      violations.push({
        check: 'tests-matrix-missing',
        message: `测试文件未登记进 w-model-dev/scripts/__tests__/README.md 覆盖矩阵：${file}（新增测试文件须同步登记首列）`,
      });
    }
  }
  return violations;
}

/**
 * S31 agents-nav-missing：每个 w-model-dev/scripts/cli/*.ts 基名须在 AGENTS.md **§8 脚本导航表的
 * 脚本名单元格**里精确登记，把「§8 表漂移」从散文债变成门禁强制。
 *
 * 判据为**§8 表格行首单元格的精确名**（`<基名>.ts` 或 `<基名>`），不是全文子串（任务 7 收紧）：
 * 子串语义会同时被 §8 之外的正文、代码块、相似前缀（`check-foo` 命中 `check-foo-bar`）以及
 * §3 的 npm 别名满足——于是把 §8 整行删掉、只在正文里留一句提及，门禁照样全绿，而它声称防的
 * 恰恰是 §8 表漂移。收紧后：正文提及不算登记，相似前缀不算登记，表格里没有该行即红。
 * 守卫：agentsNav 缺省时跳过（fixture 兼容；实测量来自 cli readdir + AGENTS.md 读取，零新增 spawn）。
 */
export function checkAgentsNavCoverage(
  nav: { agents: string; cliScriptFiles: string[] } | undefined,
): DocCheckViolation[] {
  if (nav === undefined) return [];
  const declared = parseAgentsNavRows(nav.agents);
  const violations: DocCheckViolation[] = [];
  for (const file of nav.cliScriptFiles) {
    const basename = file.replace(/\.ts$/, '');
    if (!declared.has(`${basename}.ts`) && !declared.has(basename)) {
      violations.push({
        check: 'agents-nav-missing',
        message: `AGENTS.md §8 脚本导航表没有「${basename}.ts」行（§8 表漂移；新增 cli 脚本须同步登记 §8 表格行，仅在正文提及不算登记）`,
      });
    }
  }
  return violations;
}
