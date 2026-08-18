/**
 * 文档一致性纯逻辑（docs-consistency-logic.ts）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 * 纯逻辑无 IO；IO（读文件 / 数目录）由 check-docs-consistency.ts 承担。
 * 设计：docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md §4
 */
import * as path from 'node:path';

export interface DocCheckViolation {
  /** 检查项标识（如 schema-list / targetkind） */
  check: string;
  /** 人类可读描述 */
  message: string;
}

export interface DocConsistencyInput {
  /** schemas/ 目录 *.schema.json 文件名列表（含后缀） */
  schemaFiles: string[];
  /** subagent/ 目录 .md 人格文件数（实测；期望值由 README「N 个人格文件」表述声明） */
  personaCount: number;
  /** 实测可 exit 2 的 CLI 脚本数（26 个 check-*.ts 含自身 + 7 个工具 CLI（含 cli/plan-chunks.ts）= 33，全数位于 cli/；self-test.ts 非 exit-2 不计入） */
  exit2ScriptCount: number;
  /** references/ 目录 .md 文件数（实测；期望值由 SKILL.md「（N 个 .md）」表述声明） */
  referencesCount: number;
  dataModels: string;
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
  /** w-model-dev/references/operation-behaviors.md 原文（八条操作行为 + F1-F10） */
  operationBehaviors: string;
  /** w-model-dev/references/hard-constraints.md 原文（14 条硬约束完整版） */
  hardConstraints: string;
  /** 根 package.json 原文（version 一致性检查数据源） */
  pkgJson: string;
  /** w-model-dev/skill-metadata.json 原文（version 一致性检查数据源） */
  metaJson: string;
  /** docs/INSTALL.md 原文（version 一致性检查数据源） */
  installDoc: string;
  /** CHANGELOG.md 原文（version 一致性检查数据源：首个 `## [<ver>]` 头须 == 当前版本） */
  changelog: string;
  /** w-model-dev/references/dispatch-matrix.md 原文（script-registry 检查数据源：门禁脚本权威登记表） */
  dispatchMatrix: string;
  /** w-model-dev/scripts/cli/ 下全部 .ts 文件名（实测；script-registry 检查数据源） */
  cliScriptFiles: string[];
  /** docs/ 根 6 份设计文档（活体引用） */
  designDocs: Array<{ name: string; content: string }>;
  /** w-model-dev/scripts/__tests__/ 下 *.test.ts 文件数（实测；期望值由 README「N files」/ AGENTS「N 个 .test.ts」表述声明） */
  testFileCount: number;
  /** vitest run 实际运行输出的用例总数；-1 = 无法采集（vitest 不可用 / 输出不可解析，此时不校验用例总数） */
  vitestTestCount: number;
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
 * 文件计数类期望值（schema / references / persona / vitest 文件数 / exit-2 脚本数）与版本号
 * 一律从活体文档解析，不在此硬编码——消除「文件系统 ↔ 代码常量 ↔ 文档」三方同步。
 */
export const EXPECTED = {
  runLogActionCount: 27,
  maxAntiPattern: 48,
  prePushCount: 16,
  /** 硬约束条数（14 条） */
  hardConstraintCount: 14,
} as const;

const SCHEMA_TABLE_HEADING = '### Schema 清单（20 份）';
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

export function runDocConsistencyChecks(input: DocConsistencyInput): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  violations.push(...checkSchemaList(input.schemaFiles, input.dataModels));
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
  violations.push(...checkVitestFileCount(input.testFileCount, input.readme, input.agents));
  violations.push(
    ...checkVitestTestCount(input.vitestTestCount, input.testFileCount, input.readme, input.agents, input.prePush),
  );
  violations.push(
    ...checkVersionConsistency(
      input.pkgJson,
      input.metaJson,
      input.skill,
      input.readme,
      input.installDoc,
      input.changelog,
    ),
  );
  violations.push(...checkSsotHeadings(input.ssot));
  violations.push(...checkScriptRegistry(input.cliScriptFiles, input.dispatchMatrix, input.skill));
  violations.push(...checkBaselineSync(input.scriptsChanged, input.securityBaselineEntryCount));
  if (input.linkDocs !== undefined && input.linkExists !== undefined) {
    violations.push(...checkInternalLinks(input.linkDocs, input.linkExists));
  }
  if (input.skillPkgDocs !== undefined) {
    violations.push(...checkSkillOutboundLinks(input.skillPkgDocs));
  }
  return violations;
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
 * 版本号六处一致性校验（堵住 README/INSTALL/CHANGELOG 版本漂移盲区）：
 * CONTRIBUTING.md「数字一致性」约束的自动化落地——package.json 为版本唯一源，
 * skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例
 * / CHANGELOG.md 首个版本节头 五处声明必须全部等于 package.json 解析值。任一处缺失/不可解析/不一致
 * 即报违规（fail loud，不静默放行）。版本提升用 `npm run version:bump`（scripts/version-bump.cjs）一处改版，
 * 脚本同步五处文档 + 插 CHANGELOG 节头。注意：version 字段为字符串比较，不做 semver 归一化——任何细微差异
 * （如 41.5.0 写成 41.5.10）都会被捕获，符合「防漂移」定位。
 */
function checkVersionConsistency(
  pkgJson: string,
  metaJson: string,
  skill: string,
  readme: string,
  installDoc: string,
  changelog: string,
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
 * script-registry 检查：堵住「新增门禁脚本但漏登记导航表」——任何脚本改名 / 增删后，若
 * dispatch-matrix.md（权威登记表，阶段 × S 变体 × check 脚本总览，SKILL.md「完整逐文件表」）漏同步
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
        message: `dispatch-matrix.md 未登记脚本「${name}」（新增/改名门禁脚本须同步权威登记表）`,
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

function checkSchemaList(schemaFiles: string[], dataModels: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!dataModels.includes(SCHEMA_TABLE_HEADING)) {
    violations.push({
      check: 'schema-list',
      message: `data-models.md 应含「${SCHEMA_TABLE_HEADING}」标题（当前 ${schemaFiles.length} 个 schema 文件）`,
    });
  }
  for (const file of schemaFiles) {
    const key = file.replace(/\.schema\.json$/, '');
    if (!dataModels.includes(`\`${key}\``)) {
      violations.push({ check: 'schema-list', message: `data-models.md「Schema 清单」表未覆盖 ${file}` });
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
    const unionMatch = dataModels.match(/action:\s*'[^']+'(\s*\|\s*'[^']+')*;/);
    if (unionMatch) {
      const unionVals = Array.from(unionMatch[0].matchAll(/'([^']+)'/g), (m) => m[1] as string);
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
    if (!hardConstraints.includes(`## #${i} `)) {
      violations.push({
        check: 'hard-constraints',
        message: `hard-constraints.md 缺「## #${i}」标题（应有 ${EXPECTED.hardConstraintCount} 条）`,
      });
    }
  }
  if (hardConstraints.includes(`## #${EXPECTED.hardConstraintCount + 1} `)) {
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
          ? `anti-patterns.md 缺反模式清单表头「${ANTI_PATTERN_MAIN_TABLE_HEADER}」（主清单表最大编号应为 ${EXPECTED.maxAntiPattern}）`
          : `anti-patterns.md 反模式清单表内应含最大编号 ${EXPECTED.maxAntiPattern} 行（「| ${EXPECTED.maxAntiPattern} |」出现在主清单表区间之外不计数）`,
    });
  }
  if (!antiPatterns.includes(`#1~#${EXPECTED.maxAntiPattern}`)) {
    violations.push({
      check: 'anti-patterns',
      message: `anti-patterns.md 应含连续区间「#1~#${EXPECTED.maxAntiPattern}」`,
    });
  }
  for (const stale of STALE_RANGES) {
    if (antiPatterns.includes(stale)) {
      violations.push({ check: 'anti-patterns', message: `anti-patterns.md 仍含过时区间「${stale}」` });
    }
  }
  return violations;
}

/** exit-2 脚本数：期望值从 AGENTS.md「N 个脚本」表述解析，与实测（checkScriptCount + TOOL_CLI_EXIT2_COUNT = 26 + 7 = 33）比对。 */
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

/** vitest 测试文件数：期望值从 README「N files」/ AGENTS「N 个 .test.ts」表述解析，实测须命中声明集。 */
function checkVitestFileCount(testFileCount: number, readme: string, agents: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const readmeDeclared = [...readme.matchAll(/(\d+)\s*files/g)].map((m) => Number(m[1]));
  if (readmeDeclared.length === 0) {
    violations.push({ check: 'vitest-files', message: 'README 缺「N files」vitest 文件数表述' });
  } else if (!readmeDeclared.includes(testFileCount)) {
    violations.push({
      check: 'vitest-files',
      message: `README 声明 ${readmeDeclared.join('/')} files，实际 ${testFileCount}（新增测试文件须同步文档）`,
    });
  }
  const agentsDeclared = [...agents.matchAll(/(\d+)\s*个\s*\.test\.ts/g)].map((m) => Number(m[1]));
  if (agentsDeclared.length === 0) {
    violations.push({ check: 'vitest-files', message: 'AGENTS.md 缺「N 个 .test.ts」vitest 文件数表述' });
  } else if (!agentsDeclared.includes(testFileCount)) {
    violations.push({
      check: 'vitest-files',
      message: `AGENTS.md 声明 ${agentsDeclared.join('/')} 个 .test.ts，实际 ${testFileCount}（新增测试文件须同步文档）`,
    });
  }
  return violations;
}

/**
 * vitest 用例总数一致性校验（堵住 checkVitestFileCount 只查文件数不查用例总数的盲区）：
 * CLI 层从 `npx vitest run` 输出采集实测用例总数并注入，此处要求 README / AGENTS / pre-push
 * 三处活体文档文本均出现该总数（「N tests」或「N 条」），测试用例增删但文档未同步即触发违规。
 * 无法采集（vitest 不可用 / 输出不可解析，vitestTestCount < 0）时保守放行，不阻断门禁
 * （与 detectScriptsChanges 在 git 不可用时保守返回 false 的既有策略一致）。
 *
 * 过期计数检查（stale-count）：出现性检查只能保证实测总数「存在」于文档，无法拦截同一文档
 * 内并存的旧数字（如 README 一处写 686、另一处残留 663）。因此对 vitest 语境的两种计数
 * 格式逐处比对：文件数须等于 testFileCount、用例数须等于 vitestTestCount，任一不符即违规。
 */
function checkVitestTestCount(
  vitestTestCount: number,
  testFileCount: number,
  readme: string,
  agents: string,
  prePush: string,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (vitestTestCount < 0) return violations;
  const pattern = new RegExp(`\\b${vitestTestCount}\\s*(?:tests?\\b|条)`);
  const docs: Array<[string, string]> = [
    ['README.md', readme],
    ['AGENTS.md', agents],
    ['.githooks/pre-push', prePush],
  ];
  for (const [docName, content] of docs) {
    if (!pattern.test(content)) {
      violations.push({
        check: 'vitest-tests',
        message: `${docName} 应含 vitest 实测用例总数「${vitestTestCount} tests」或「${vitestTestCount} 条」（vitest run 实测 ${vitestTestCount} 条，测试用例增删须同步文档）`,
      });
    }
    const staleFormats: RegExp[] = [
      /(\d+)\s*files?\s*\/\s*(\d+)\s*tests?\b/g,
      /(\d+)\s*个\s*\.test\.ts\s*\/\s*(\d+)\s*(?:tests?|条)/g,
    ];
    for (const re of staleFormats) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const fileN = Number(m[1]);
        const testN = Number(m[2]);
        if (testN !== vitestTestCount || (testFileCount >= 0 && fileN !== testFileCount)) {
          violations.push({
            check: 'vitest-tests',
            message: `${docName} 存在过期 vitest 计数「${m[0]}」（实测 ${testFileCount} 个 .test.ts / ${vitestTestCount} 条），须同步`,
          });
        }
      }
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
