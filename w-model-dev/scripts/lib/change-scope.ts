/**
 * 变更上下文模块（lib/change-scope.ts）
 *
 * 2026-09-04 audit-gate-closure（task 1，Slice A）：把 codegraph / opsx / archive
 * 三个 checker 与实际变更绑定。ChangeScope manifest（schemas/change-scope.schema.json）
 * 声明 changeId/phase/refs/scopeCreatedAt/changedFiles；本模块提供：
 *
 *   - validateChangeScope：schema 前置校验（structural-first，约束 #28 风格）
 *   - changedFilePathViolation / isIsoDateTimeString：字段级规则（正斜杠相对路径、
 *     非绝对、不含 `..`/空段/反斜杠；ISO date-time）
 *   - isCodeOrTestFile：文件分类纯函数（哪些变更文件须 codegraph 覆盖）
 *   - gitObjectExists / currentHeadSha / computeGitChangedFiles / verifyScopeGitBinding：
 *     与实际 Git 变更集合精确比对（headRef 必须等于当前 HEAD；Git 不可用/命令失败
 *     /范围不一致一律 fail-closed，不是警告跳过）
 *   - resolveCliScope：CLI 参数 → scope（--scope=<file> 或 --change/--base/--head 薄封装；
 *     两者同给 ARG_INVALID；缺失 → missing（调用方按 exit 1 violations 处理））
 *
 * 纪律：本文件（lib 层）不直接 child_process——真实 Git 经 lib/run-sync.ts runSync
 * 包装（gitRunnerFor）；逻辑全部接受注入的 GitRunner 以便单测。
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { validateBySchema } from '../infrastructure/schema-loader.js';

import type { ErrorCategory } from './cli-error.js';
import { runSync } from './run-sync.js';
import { parseJsonSafe } from './safe-json.js';

// ==================== 类型 ====================

/** ChangeScope manifest 形状（与 schemas/change-scope.schema.json 一致；运行时对象由 schema 把关） */
export interface ChangeScope {
  /** 变更唯一标识（须含 phaseN- 前缀，如 phase5-demo） */
  changeId: string;
  /** 当前校验阶段 1-8 */
  phase: number;
  /** 变更基线 Git 引用（须可解析为 Git 对象） */
  baseRef: string;
  /** 变更末端 Git 引用（必须等于当前 HEAD，过期 fail-closed） */
  headRef: string;
  /** scope 创建时刻（ISO date-time） */
  scopeCreatedAt: string;
  /** 声明变更文件：项目根相对 / 正斜杠 / 非绝对 / 不含 `..`、`.`、空段、反斜杠 */
  changedFiles: string[];
}

/** Git 命令结果（ok=false 覆盖 status!==0 与 spawn 失败两种情形） */
export interface GitOutcome {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** 只读 Git 命令执行器（注入式；cwd=项目根） */
export type GitRunner = (args: readonly string[], cwd: string) => GitOutcome;

// ==================== Git runner（唯一真实执行点） ====================

/**
 * 真实 Git runner（CLI 默认）：经 lib/run-sync.ts 包装，Windows/Linux 兼容，
 * 30s 超时 + SIGKILL，UTF-8 解码。spawn 失败（git 不在 PATH 等）→ { ok:false }。
 */
export function gitRunnerFor(projectRoot: string): GitRunner {
  return (args) => {
    const r = runSync('git', [...args], { cwd: projectRoot, timeout: 30_000 });
    if (r.status === null) {
      return { ok: false, stdout: '', stderr: r.error?.message ?? 'git 命令执行失败' };
    }
    return { ok: r.status === 0, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
  };
}

// ==================== 字段级规则 ====================

// 两条平铺正则（无嵌套量词，规避 security/detect-unsafe-regex 对 (\.\d+)? 的误报）：
// 整数秒（Z/±hh:mm）与带小数秒两种合法 ISO date-time 形态
const ISO_DATE_TIME_SEC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_TIME_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+(?:Z|[+-]\d{2}:\d{2})$/;

/** ISO date-time 判定（regex + Date.parse 语义双保险，拒绝 2026-09-04 / 25:00 等） */
export function isIsoDateTimeString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!ISO_DATE_TIME_SEC_RE.test(value) && !ISO_DATE_TIME_MS_RE.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * 变更文件路径单条规则：项目根相对、正斜杠、非绝对路径、不含 `..`/`.`/空段/反斜杠。
 * 合法返回 null；违规返回人类可读原因（violations 组装用）。
 * 同时供 scope.changedFiles 与查询 targetFiles 复用（规则集中、可测）。
 */
export function changedFilePathViolation(value: unknown): string | null {
  if (typeof value !== 'string') return '非字符串（须为项目根相对路径字符串）';
  if (value.trim() === '') return '为空（须为项目根相对路径）';
  const isAbsolute =
    path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.startsWith('\\');
  if (isAbsolute) return '绝对路径不被允许（须为项目根相对路径）';
  if (value.includes('\\')) return '含反斜杠（须用正斜杠分隔）';
  const segments = value.split('/');
  if (segments.some((s) => s === '' || s === '..' || s === '.')) {
    return '含空段、`.` 段或 `..` 段（路径未规范化，不允许越出项目根）';
  }
  return null;
}

/** scope schema 前置校验（structural-first + 跨字段）：违规返回 '[schema] ...' 消息列表 */
export function validateChangeScope(scope: unknown): string[] {
  const result = validateBySchema('change-scope', scope);
  if (!result.valid) return result.errorMessages.map((m) => `[schema] ${m}`);
  // 跨字段一致性：changeId 须含 scope.phase 对应前缀 phase<N>-（与 opsx 变更目录/查询文件前缀同一约定）
  const s = scope as ChangeScope;
  const expectedPrefix = `phase${s.phase}-`;
  if (!s.changeId.startsWith(expectedPrefix)) {
    return [
      `[schema] changeId='${s.changeId}' 须含 scope.phase=${s.phase} 对应前缀 ${expectedPrefix}（scope.changeId 与 scope.phase 不符）`,
    ];
  }
  return [];
}

// ==================== 文件分类（须 codegraph 覆盖判定） ====================

/** 非强制目录（文档/资产/配置/运行时生成物）：docs schemas config eval coverage .w-model openspec .zcode node_modules .git */
const EXCLUDED_ROOT_SEGMENTS = new Set([
  'docs',
  'schemas',
  'config',
  'eval',
  'coverage',
  '.w-model',
  'openspec',
  '.zcode',
  'node_modules',
  '.git',
]);

/** 工程源码/测试扩展名（*.ts|*.js|*.py|*.java 与 *.sh|*.ps1|*.bat|*.cmd 脚本等） */
const ENGINEERING_CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'java',
  'go',
  'rs',
  'rb',
  'php',
  'cs',
  'c',
  'cc',
  'cpp',
  'h',
  'hpp',
  'swift',
  'kt',
  // shell/PowerShell/批处理脚本同为可执行工程文件，改动须 codegraph 覆盖
  'sh',
  'ps1',
  'bat',
  'cmd',
  // .sql/.tla/.feature 刻意不纳入：分别由数据迁移审查 / TLA+ 行为门禁 / BDD 门禁兜底，
  // 纳入会迫使 S-coding 对模型与规格文件补无意义的符号查询
]);

/**
 * 文件分类纯函数：某 changed file 是否须 codegraph 覆盖的 code/test 文件。
 * 规则（集中于此，正反例见 change-scope.test.ts）：
 *   1. 顶层段 ∈ EXCLUDED_ROOT_SEGMENTS（docs/ schemas/ config/ eval/ .w-model/ openspec/ 等）→ false
 *   2. dotfile（.eslintrc.cjs 等配置）/ *.md / *.markdown → false（文档与配置类不强制）
 *   3. 其余按扩展名 ∈ ENGINEERING_CODE_EXTENSIONS → true
 * 注意：tests/__tests__ 内的测试文件本身是 .ts/.py 等代码扩展名，已被规则 3 覆盖；
 * 测试目录里的 fixture（.json/.md/.txt）不视为代码，不强制（与测试隔离纪律一致）。
 */
export function isCodeOrTestFile(relPath: string): boolean {
  const first = relPath.split('/')[0] ?? '';
  if (EXCLUDED_ROOT_SEGMENTS.has(first)) return false;
  const base = relPath.split('/').pop() ?? '';
  if (base.startsWith('.')) return false;
  if (/\.md$/i.test(base) || /\.markdown$/i.test(base)) return false;
  const ext = base.includes('.') ? (base.slice(base.lastIndexOf('.') + 1).toLowerCase() ?? '') : '';
  return ENGINEERING_CODE_EXTENSIONS.has(ext);
}

// ==================== Git 事实查询（只读） ====================

/** ref 可解析为 Git 对象？（rev-parse --verify --quiet） */
export function gitObjectExists(runner: GitRunner, projectRoot: string, ref: string): boolean {
  return resolveGitObject(runner, projectRoot, ref) !== null;
}

/** ref → commit sha（不可解析返回 null） */
export function resolveGitObject(runner: GitRunner, projectRoot: string, ref: string): string | null {
  if (typeof ref !== 'string' || ref.trim() === '') return null;
  const r = runner(['rev-parse', '--verify', '--quiet', ref], projectRoot);
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  return sha === '' ? null : sha;
}

/** 当前 HEAD sha（git 不可用/不在仓库 → null） */
export function currentHeadSha(runner: GitRunner, projectRoot: string): string | null {
  const r = runner(['rev-parse', 'HEAD'], projectRoot);
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  return sha === '' ? null : sha;
}

/**
 * 实际变更集合重算：`git diff --name-only base..head`（tracked）
 * + staged（--cached）+ unstaged + untracked（ls-files --others --exclude-standard），
 * 去重排序。任一 git 命令失败 → { ok:false, error }（调用方 fail-closed）。
 * 所有命令统一前插 `-c core.quotePath=false`：非 ASCII 文件名（如 docs/设计文档.md）
 * 按字面 UTF-8 收集而非八进制转义（quotePath 默认 true 会破坏与 changedFiles 的精确集合比对）。
 */
export function computeGitChangedFiles(
  runner: GitRunner,
  projectRoot: string,
  baseRef: string,
  headRef: string,
): { ok: boolean; files: string[]; error: string | null } {
  const quotePathArg = ['-c', 'core.quotePath=false'] as const;
  const commands: Array<{ args: string[]; label: string }> = [
    {
      args: [...quotePathArg, 'diff', '--name-only', `${baseRef}..${headRef}`],
      label: `git diff --name-only ${baseRef}..${headRef}`,
    },
    { args: [...quotePathArg, 'diff', '--cached', '--name-only'], label: 'git diff --cached --name-only' },
    { args: [...quotePathArg, 'diff', '--name-only'], label: 'git diff --name-only' },
    {
      args: [...quotePathArg, 'ls-files', '--others', '--exclude-standard'],
      label: 'git ls-files --others --exclude-standard',
    },
  ];
  const names = new Set<string>();
  for (const { args, label } of commands) {
    const r = runner(args, projectRoot);
    if (!r.ok) {
      return { ok: false, files: [], error: `${label} 失败：${r.stderr || '未知错误'}` };
    }
    for (const line of r.stdout.split('\n')) {
      const f = line.trim();
      if (f !== '') names.add(f);
    }
  }
  return { ok: true, files: [...names].sort(), error: null };
}

/**
 * scope 与实际 Git 状态绑定校验（fail-closed）：
 *   - 当前 HEAD 不可读（git 不可用/非仓库）→ 失败
 *   - baseRef/headRef 必须可解析为 Git 对象
 *   - headRef 解析 sha 必须等于当前 HEAD（过期 scope 失败）
 *   - 实际变更集合（base..head + worktree）与 scope.changedFiles 精确集合相等
 * 任一步失败 → passed=false（调用方据此拒绝放行，不是警告跳过）。
 */
export function verifyScopeGitBinding(
  scope: ChangeScope,
  runner: GitRunner,
  projectRoot: string,
): { passed: boolean; violations: string[]; actualChangedFiles: string[] | null } {
  const violations: string[] = [];
  const head = currentHeadSha(runner, projectRoot);
  if (head === null) {
    violations.push('无法读取当前 HEAD（git 不可用或项目根不在 Git 仓库内）：scope 与实际变更绑定 fail-closed');
    return { passed: false, violations, actualChangedFiles: null };
  }
  const baseSha = resolveGitObject(runner, projectRoot, scope.baseRef);
  if (baseSha === null) {
    violations.push(`baseRef 无法解析为 Git 对象（baseRef=${scope.baseRef}）`);
  }
  const headSha = resolveGitObject(runner, projectRoot, scope.headRef);
  if (headSha === null) {
    violations.push(`headRef 无法解析为 Git 对象（headRef=${scope.headRef}）`);
  } else if (headSha !== head) {
    violations.push(
      `headRef 过期：scope.headRef=${scope.headRef} 不等于当前 HEAD=${head}（scope 须与实际变更同步创建/更新）`,
    );
  }
  if (violations.length > 0) return { passed: false, violations, actualChangedFiles: null };

  const computed = computeGitChangedFiles(runner, projectRoot, scope.baseRef, scope.headRef);
  if (!computed.ok) {
    violations.push(`实际变更集合无法计算（fail-closed）：${computed.error}`);
    return { passed: false, violations, actualChangedFiles: null };
  }
  const declared = new Set(scope.changedFiles);
  const actual = new Set(computed.files);
  for (const f of computed.files) {
    if (!declared.has(f)) violations.push(`实际变更未在 changedFiles 声明：${f}`);
  }
  for (const f of scope.changedFiles) {
    if (!actual.has(f)) violations.push(`changedFiles 声明了非实际变更文件：${f}`);
  }
  return { passed: violations.length === 0, violations, actualChangedFiles: computed.files };
}

// ==================== CLI scope 装载 ====================

export type ResolvedCliScope =
  | { kind: 'ok'; scope: ChangeScope }
  /** 未提供任何 scope 来源：调用方按校验失败（exit 1）处理，violations 说明变更上下文缺失 */
  | { kind: 'missing'; reasons: string[] }
  /**
   * scope 语义/绑定失败（phase 不一致、refs/HEAD/变更集合不符、git 失败）：exit 1。
   * attemptedChangeId = 尝试绑定的 changeId（manifest 模式=scope.changeId；薄封装=--change 值），
   * 供调用方在 summary 标注「已提供但 Git 绑定失败」而非「未提供」。
   */
  | { kind: 'violations'; violations: string[]; attemptedChangeId: string | null }
  /** 输入错误（文件/JSON/schema/参数冲突）：exit 2（category 供 ERROR_JSON 使用） */
  | { kind: 'invalid'; category: ErrorCategory; message: string; detail?: string; file?: string };

export interface ResolveCliScopeArgs {
  projectRoot: string;
  /** CLI 校验阶段（5-8；须与 scope.phase 一致） */
  phase: number;
  /** --scope=<file> 值（相对项目根或绝对路径） */
  scopePath?: string;
  /** 薄封装 --change=<id> */
  changeArg?: string;
  /** 薄封装 --base=<ref> */
  baseArg?: string;
  /** 薄封装 --head=<ref> */
  headArg?: string;
  /** Git 执行器（CLI 传 gitRunnerFor(projectRoot)） */
  git: GitRunner;
}

const MISSING_SCOPE_REASON = (phase: number): string =>
  `阶段 ${phase}：未提供 --scope=<change-scope.json> 或 --change=<id> --base=<ref> --head=<ref>，无法绑定变更上下文（无变更上下文的相关查询/制品不得放行）`;

/**
 * CLI 参数 → ChangeScope。--scope=<file>：schema + 语义 + Git 绑定全链路校验；
 * --change/--base/--head 薄封装：以实际 Git 变更集合为 changedFiles 生成等价 scope
 * （省去维护 manifest，覆盖判定仍按实际变更 fail-closed）。
 */
export function resolveCliScope(args: ResolveCliScopeArgs): ResolvedCliScope {
  const { projectRoot, phase, git } = args;
  const thinProvided = args.changeArg !== undefined || args.baseArg !== undefined || args.headArg !== undefined;

  if (args.scopePath !== undefined && thinProvided) {
    return {
      kind: 'invalid',
      category: 'ARG_INVALID',
      message: '--scope 与 --change/--base/--head 不能同时给出',
      detail: '二者互斥：--scope=<change-scope.json> 为 manifest 模式；--change/--base/--head 为薄封装模式',
    };
  }
  if (thinProvided && (args.changeArg === undefined || args.baseArg === undefined || args.headArg === undefined)) {
    return {
      kind: 'invalid',
      category: 'ARG_INVALID',
      message: '--change/--base/--head 薄封装须三者同时给出',
      detail: '用法: --change=<changeId> --base=<ref> --head=<ref>',
    };
  }

  // ---- manifest 模式 ----
  if (args.scopePath !== undefined) {
    const abs = path.resolve(projectRoot, args.scopePath);
    let raw: string;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- ChangeScope manifest 路径来自 CLI --scope 参数（相对项目根解析，受控路径）
      raw = readFileSync(abs, 'utf-8');
    } catch (err) {
      return {
        kind: 'invalid',
        category: 'FILE_NOT_FOUND',
        message: 'ChangeScope 文件不存在或不可读',
        file: abs,
        detail: err instanceof Error ? err.message : undefined,
      };
    }
    let parsed: unknown;
    try {
      parsed = parseJsonSafe(raw);
    } catch {
      return { kind: 'invalid', category: 'FILE_PARSE', message: 'ChangeScope 文件非合法 JSON', file: abs };
    }
    const schemaViolations = validateChangeScope(parsed);
    if (schemaViolations.length > 0) {
      return {
        kind: 'invalid',
        category: 'STRUCTURE_INVALID',
        message: 'ChangeScope 违反 change-scope.schema.json',
        file: abs,
        detail: schemaViolations.slice(0, 5).join('；'),
      };
    }
    const scope = parsed as ChangeScope;
    const violations: string[] = [];
    if (scope.phase !== phase) {
      violations.push(`scope.phase=${scope.phase} 与 CLI --phase=${phase} 不一致（变更上下文须与当前校验阶段一致）`);
    }
    const binding = verifyScopeGitBinding(scope, git, projectRoot);
    violations.push(...binding.violations);
    if (violations.length > 0) return { kind: 'violations', violations, attemptedChangeId: scope.changeId };
    return { kind: 'ok', scope };
  }

  // ---- 薄封装模式 ----
  if (thinProvided) {
    // changeId 非空校验前置：空串/全空白属输入错误（exit 2 语义），
    // 不在下游 opsx/archive 前缀检查 fail-closed 兜底——显式拒绝更快且语义更准。
    if (typeof args.changeArg === 'string' && args.changeArg.trim() === '') {
      return {
        kind: 'invalid',
        category: 'ARG_INVALID',
        message: '--change=<changeId> 不得为空串或全空白（薄封装须声明非空 changeId）',
        detail: 'changeId 须与下游 opsx/archive 变更目录精确绑定，空值属输入错误（exit 2），显式拒绝',
      };
    }
    // changeId 阶段前缀前置校验：须含 phase<phase>-（与 manifest 模式 validateChangeScope 同一约定）
    if (typeof args.changeArg === 'string' && !args.changeArg.startsWith(`phase${phase}-`)) {
      return {
        kind: 'invalid',
        category: 'ARG_INVALID',
        message: `--change=${args.changeArg} 缺当前阶段前缀 phase${phase}-（薄封装 changeId 与 CLI --phase 不符）`,
        detail: `changeId 须为 phase${phase}-<名称> 形态（跨阶段/无前缀 changeId 属输入错误，exit 2）`,
      };
    }
    const violations: string[] = [];
    const head = currentHeadSha(git, projectRoot);
    if (head === null) {
      violations.push('无法读取当前 HEAD（git 不可用或项目根不在 Git 仓库内）：薄封装 scope fail-closed');
      return { kind: 'violations', violations, attemptedChangeId: args.changeArg as string };
    }
    const baseSha = resolveGitObject(git, projectRoot, args.baseArg as string);
    if (baseSha === null) violations.push(`baseRef 无法解析为 Git 对象（baseRef=${args.baseArg}）`);
    const headSha = resolveGitObject(git, projectRoot, args.headArg as string);
    if (headSha === null) {
      violations.push(`headRef 无法解析为 Git 对象（headRef=${args.headArg}）`);
    } else if (headSha !== head) {
      violations.push(`headRef 过期：headRef=${args.headArg} 不等于当前 HEAD=${head}`);
    }
    if (violations.length > 0) return { kind: 'violations', violations, attemptedChangeId: args.changeArg as string };
    const computed = computeGitChangedFiles(git, projectRoot, args.baseArg as string, args.headArg as string);
    if (!computed.ok) {
      return {
        kind: 'violations',
        violations: [`实际变更集合无法计算（fail-closed）：${computed.error}`],
        attemptedChangeId: args.changeArg as string,
      };
    }
    const scope: ChangeScope = {
      changeId: args.changeArg as string,
      phase,
      baseRef: args.baseArg as string,
      headRef: args.headArg as string,
      scopeCreatedAt: new Date().toISOString(),
      changedFiles: computed.files,
    };
    return { kind: 'ok', scope };
  }

  // ---- 缺失 ----
  return { kind: 'missing', reasons: [MISSING_SCOPE_REASON(phase)] };
}
