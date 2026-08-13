/**
 * 文档一致性纯逻辑（docs-consistency-logic.ts）
 *
 * 校验活体文档中的计数 / 枚举 / 清单与代码事实一致，防文档漂移。
 * 纯逻辑无 IO；IO（读文件 / 数目录）由 check-docs-consistency.ts 承担。
 * 设计：docs/superpowers/specs/2026-08-10-doc-consistency-correction-design.md §4
 */

export interface DocCheckViolation {
  /** 检查项标识（如 schema-list / targetkind） */
  check: string;
  /** 人类可读描述 */
  message: string;
}

export interface DocConsistencyInput {
  /** schemas/ 目录 *.schema.json 文件名列表（含后缀） */
  schemaFiles: string[];
  /** subagent/ 目录 .md 人格文件数（期望 28） */
  personaCount: number;
  /** 实测可 exit 2 的 CLI 脚本数（26 个 check-*.ts 含自身 + 4 工具 CLI + logic/plan-chunks.ts = 31；self-test.ts 非 exit-2 不计入） */
  exit2ScriptCount: number;
  /** references/ 目录 .md 文件数（期望 57） */
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
  /** w-model-dev/references/operation-behaviors.md 原文（八条操作行为 + F1-F10，第 44 轮自 SKILL.md 移出） */
  operationBehaviors: string;
  /** w-model-dev/references/hard-constraints.md 原文（14 条硬约束完整版，第 44 轮自 SKILL.md 移出） */
  hardConstraints: string;
  /** 根 package.json 原文（version 一致性检查数据源） */
  pkgJson: string;
  /** w-model-dev/skill-metadata.json 原文（version 一致性检查数据源） */
  metaJson: string;
  /** docs/INSTALL.md 原文（version 一致性检查数据源） */
  installDoc: string;
  /** docs/ 根 6 份设计文档（活体引用） */
  designDocs: Array<{ name: string; content: string }>;
  /** w-model-dev/scripts/__tests__/ 下 *.test.ts 文件数（期望 35） */
  testFileCount: number;
  /** vitest run 实际运行输出的用例总数；-1 = 无法采集（vitest 不可用 / 输出不可解析，此时不校验用例总数） */
  vitestTestCount: number;
  /** w-model-dev/scripts 目录下 .ts 文件是否有变更（git diff + porcelain 判定，由 CLI 层注入） */
  scriptsChanged: boolean;
  /** 根目录 .eslintsecurity-baseline.json 指纹条目数；-1 = 缺失/不可解析，0 = 空 */
  securityBaselineEntryCount: number;
}

export const EXPECTED = {
  schemaCount: 20,
  personaCount: 28,
  /** references/ 目录 .md 文件数（第 44 轮新建 4 篇后为 57；SKILL.md「Bundled Resources」表须同步） */
  referencesCount: 53,
  vitestFileCount: 35,
  exit2ScriptCount: 31,
  runLogActionCount: 27,
  maxAntiPattern: 47,
  prePushCount: 15,
  /** 硬约束条数（第 44 轮由 21 条重排合并为 14 条） */
  hardConstraintCount: 14,
  /** 当前版本号：五处声明（package.json / skill-metadata.json / SKILL.md frontmatter / README / docs/INSTALL.md）必须全部等于此值 */
  currentVersion: '41.7.0',
} as const;

const SCHEMA_TABLE_HEADING = '### Schema 清单（20 份）';
const DOD_README = '7 维度（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）';
const DOD_SSOT_TRACE = '每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）';
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
  violations.push(
    ...checkOperatingBehaviors(input.skill, input.readme, input.ssot, input.operationBehaviors),
  );
  violations.push(...checkHardConstraints(input.skill, input.hardConstraints));
  violations.push(...checkAntiPatterns(input.antiPatterns));
  violations.push(...checkExit2ScriptCount(input.exit2ScriptCount, input.agents));
  violations.push(...checkPrePushCount(input.prePush));
  violations.push(...checkGlossaryAction(input.glossary));
  violations.push(...checkAssetCounts(input.personaCount));
  violations.push(...checkReferencesCount(input.referencesCount, input.skill));
  violations.push(...checkDesignDocs(input.designDocs));
  violations.push(...checkVitestFileCount(input.testFileCount, input.readme, input.agents));
  violations.push(...checkVitestTestCount(input.vitestTestCount, input.readme, input.agents, input.prePush));
  violations.push(...checkVersionConsistency(input.pkgJson, input.metaJson, input.skill, input.readme, input.installDoc));
  violations.push(...checkBaselineSync(input.scriptsChanged, input.securityBaselineEntryCount));
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

/**
 * 版本号五处一致性校验（堵住 README/INSTALL 版本漂移盲区）：
 * CONTRIBUTING.md「数字一致性」约束的自动化落地——package.json / skill-metadata.json /
 * SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例五处版本声明必须全部
 * 等于 EXPECTED.currentVersion。任一处缺失/不可解析/不一致即报违规（fail loud，不静默放行）。
 * 注意：version 字段为字符串比较，不做 semver 归一化——任何细微差异（如 41.5.0 写成 41.5.10）
 * 都会被捕获，符合「防漂移」定位。
 */
function checkVersionConsistency(
  pkgJson: string,
  metaJson: string,
  skill: string,
  readme: string,
  installDoc: string,
): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  const sources: Array<[string, string | null]> = [
    ['package.json', extractJsonVersion(pkgJson)],
    ['skill-metadata.json', extractJsonVersion(metaJson)],
    ['SKILL.md frontmatter', extractYamlVersion(skill)],
    ['README「当前版本」', readme.match(new RegExp(`当前版本[^\\d]*(${VERSION_PATTERN.source})`))?.[1] ?? null],
    ['docs/INSTALL.md 激活示例', extractYamlVersion(installDoc)],
  ];
  for (const [docName, actual] of sources) {
    if (actual === null) {
      violations.push({
        check: 'version-consistency',
        message: `${docName} 无法解析版本号（应为 ${EXPECTED.currentVersion}）`,
      });
    } else if (actual !== EXPECTED.currentVersion) {
      violations.push({
        check: 'version-consistency',
        message: `${docName} 版本应为 ${EXPECTED.currentVersion}，实际 ${actual}`,
      });
    }
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
  try {
    const schema = JSON.parse(runLogSchema) as { properties?: { action?: { enum?: unknown[] } } };
    const actionEnum = schema.properties?.action?.enum;
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
 * 操作行为一致性（第 44 轮改为指针模式）：
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
      message: 'SKILL.md 不应再内联八条操作行为完整表（已移入 references/operation-behaviors.md，第 44 轮）',
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
 * 硬约束清单一致性（第 44 轮新增）：
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
  if (!antiPatterns.includes(`\n| ${EXPECTED.maxAntiPattern} |`)) {
    violations.push({
      check: 'anti-patterns',
      message: `anti-patterns.md 反模式表最大编号应为 ${EXPECTED.maxAntiPattern}`,
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

function checkExit2ScriptCount(count: number, agents: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (count !== EXPECTED.exit2ScriptCount) {
    violations.push({
      check: 'exit2-scripts',
      message: `实测 exit-2 脚本数应为 ${EXPECTED.exit2ScriptCount}，实际 ${count}`,
    });
  }
  if (!agents.includes(`${EXPECTED.exit2ScriptCount} 个脚本`)) {
    violations.push({ check: 'exit2-scripts', message: `AGENTS.md 应含「${EXPECTED.exit2ScriptCount} 个脚本」` });
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

function checkAssetCounts(personaCount: number): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (personaCount !== EXPECTED.personaCount) {
    violations.push({
      check: 'asset-counts',
      message: `subagent/ 人格文件数应为 ${EXPECTED.personaCount}，实际 ${personaCount}`,
    });
  }
  return violations;
}

/**
 * references/ 目录 .md 文件数一致性（41.4.0 新增）：
 * 实际文件数须等于 EXPECTED.referencesCount，且 SKILL.md「Bundled Resources」表须含
 * 「（N 个 .md）」计数表述（如 `` `references/`（57 个 .md） ``，资源名反引号格式可异）——
 * 新增 references/*.md 时强制同步 SKILL.md 与 EXPECTED，防再次漂移。
 */
function checkReferencesCount(referencesCount: number, skill: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (referencesCount !== EXPECTED.referencesCount) {
    violations.push({
      check: 'references-count',
      message: `references/ 目录 .md 文件数应为 ${EXPECTED.referencesCount}，实际 ${referencesCount}（新增文件须同步 SKILL.md 与 EXPECTED）`,
    });
  }
  if (!skill.includes(`（${EXPECTED.referencesCount} 个 .md）`)) {
    violations.push({
      check: 'references-count',
      message: `SKILL.md 应含「（${EXPECTED.referencesCount} 个 .md）」表述`,
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

function checkVitestFileCount(testFileCount: number, readme: string, agents: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (testFileCount !== EXPECTED.vitestFileCount) {
    violations.push({
      check: 'vitest-files',
      message: `实测 vitest 测试文件数应为 ${EXPECTED.vitestFileCount}，实际 ${testFileCount}（新增测试文件须同步文档与 EXPECTED）`,
    });
  }
  if (!readme.includes(`${EXPECTED.vitestFileCount} files`)) {
    violations.push({ check: 'vitest-files', message: `README 应含「${EXPECTED.vitestFileCount} files」vitest 表述` });
  }
  if (!agents.includes(`${EXPECTED.vitestFileCount} 个 .test.ts`)) {
    violations.push({
      check: 'vitest-files',
      message: `AGENTS.md 应含「${EXPECTED.vitestFileCount} 个 .test.ts」vitest 表述`,
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
 */
function checkVitestTestCount(
  vitestTestCount: number,
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
  }
  return violations;
}

/**
 * 安全 baseline 同步检查（spec §3 B3）：w-model-dev/scripts/** 下 .ts 文件有变更时，
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
