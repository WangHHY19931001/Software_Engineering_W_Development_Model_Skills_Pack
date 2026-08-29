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
  /** w-model-dev/scripts/cli/ 下全部 .ts 文件名（实测；script-registry 检查数据源） */
  cliScriptFiles: string[];
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
}

/**
 * 语义性常量（低频变更，无法从活体文档解析或解析成本过高）。
 * 静态计数类期望值（schema / references / persona / exit-2 脚本数）与版本号
 * 一律从活体文档解析，不在此硬编码；Vitest 文件数/用例数属于受控动态 facts，不由文档声明。
 */
export const EXPECTED = {
  runLogActionCount: 27,
  maxAntiPattern: 48,
  prePushCount: 17,
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
  violations.push(...checkPrePushCount(input.prePush));
  violations.push(...checkGlossaryAction(input.glossary));
  violations.push(...checkAssetCounts(input.personaCount, input.readme));
  violations.push(...checkReferencesCount(input.referencesCount, input.skill));
  violations.push(...checkDesignDocs(input.designDocs));
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
    violations.push({ check: 'dod', message: 'definition-of-done.md 应含「## 七维度标准」标题' });
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
  for (let i = 1; i <= EXPECTED.hardConstraintCount; i++) {
    if (!new RegExp(`^## #${i} `, 'm').test(hardConstraints)) {
      violations.push({
        check: 'hard-constraints',
        message: `hard-constraints.md 缺「## #${i}」标题（应有 ${EXPECTED.hardConstraintCount} 条）`,
      });
    }
  }
  if (new RegExp(`^## #${EXPECTED.hardConstraintCount + 1} `, 'm').test(hardConstraints)) {
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

function checkPrePushCount(prePush: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  let max = 0;
  for (const m of prePush.matchAll(/^# (\d+)\./gm)) {
    max = Math.max(max, Number(m[1]));
  }
  if (max !== EXPECTED.prePushCount) {
    violations.push({
      check: 'pre-push',
      message: `pre-push 编号注释最大值应为 ${EXPECTED.prePushCount}，实际 ${max}`,
    });
  }
  if (!prePush.includes(`${EXPECTED.prePushCount} 项检查`)) {
    violations.push({ check: 'pre-push', message: `pre-push 注释应含「${EXPECTED.prePushCount} 项检查」` });
  }
  return violations;
}

function checkGlossaryAction(glossary: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const start = glossary.indexOf('### action（RunLogEntry）');
  const end = start >= 0 ? glossary.indexOf('### ', start + 1) : -1;
  const section = start < 0 ? '' : glossary.slice(start, end === -1 ? undefined : end);
  if (!section.includes('`review`')) {
    violations.push({ check: 'glossary-action', message: 'glossary.md action 枚举应含 `review`（V 评审）' });
  }
  if (section.includes('`verify`')) {
    violations.push({ check: 'glossary-action', message: 'glossary.md action 枚举不应含 `verify`' });
  }
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
