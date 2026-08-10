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
  /** .cursor/skills 目录数（期望 23） */
  cursorSkillCount: number;
  /** 实测可 exit 2 的 CLI 脚本数（25 个 check-*.ts 含自身 + 5 工具 = 30） */
  exit2ScriptCount: number;
  dataModels: string;
  verifierSpec: string;
  commandReference: string;
  agentPersonas: string;
  definitionOfDone: string;
  antiPatterns: string;
  glossary: string;
  runLogSchema: string;
  skill: string;
  readme: string;
  agents: string;
  ssot: string;
  prePush: string;
  /** docs/ 根 6 份设计文档（活体引用） */
  designDocs: Array<{ name: string; content: string }>;
  /** w-model-dev/scripts/__tests__/ 下 *.test.ts 文件数（期望 35） */
  testFileCount: number;
}

export const EXPECTED = {
  schemaCount: 20,
  personaCount: 28,
  cursorSkillCount: 23,
  vitestFileCount: 35,
  exit2ScriptCount: 30,
  runLogActionCount: 27,
  maxAntiPattern: 46,
  prePushCount: 14,
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
  '五维度标准',       // 表名（当前为七维度标准）
  '六维度标准',       // 标题/表名（当前为七维度标准）
  '五维度 → 六维度',  // 演变终点停在六维度
  '五维度扩展为六维度',
  '六维度（更新）',   // 章节标题
  '§10.6 六维度',     // 过时 SSoT 引用
  '§10.6 五维度',     // 过时 SSoT 引用
];
/** `targetKind`（…）括号枚举形式的废弃值检测（如 `targetKind`（`requirement` / `design` / `testcase` / `file`）） */
const TARGETKIND_ENUM_PATTERN = /`targetKind`\s*（[^）]*(?:testcase|file)[^）]*）/;

export function runDocConsistencyChecks(input: DocConsistencyInput): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  violations.push(...checkSchemaList(input.schemaFiles, input.dataModels));
  violations.push(...checkRunLogActionEnum(input.runLogSchema, input.dataModels));
  violations.push(...checkTargetKindLiveDocs(input.verifierSpec, input.commandReference, input.agentPersonas, input.ssot));
  violations.push(...checkDoDDimensions(input.definitionOfDone, input.readme, input.ssot));
  violations.push(...checkOperatingBehaviors(input.skill, input.readme, input.ssot));
  violations.push(...checkAntiPatterns(input.antiPatterns));
  violations.push(...checkExit2ScriptCount(input.exit2ScriptCount, input.agents));
  violations.push(...checkPrePushCount(input.prePush));
  violations.push(...checkGlossaryAction(input.glossary));
  violations.push(...checkAssetCounts(input.personaCount, input.cursorSkillCount));
  violations.push(...checkDesignDocs(input.designDocs));
  violations.push(...checkVitestFileCount(input.testFileCount, input.readme, input.agents));
  return violations;
}

function checkSchemaList(schemaFiles: string[], dataModels: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!dataModels.includes(SCHEMA_TABLE_HEADING)) {
    violations.push({ check: 'schema-list', message: `data-models.md 应含「${SCHEMA_TABLE_HEADING}」标题（当前 ${schemaFiles.length} 个 schema 文件）` });
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
    violations.push({ check: 'run-log-action', message: `run-log.schema.json action.enum 长度应为 ${EXPECTED.runLogActionCount}，实际 ${count}` });
  }
  if (!dataModels.includes(`action enum（${EXPECTED.runLogActionCount} 类）`)) {
    violations.push({ check: 'run-log-action', message: `data-models.md run-log 行应含「action enum（${EXPECTED.runLogActionCount} 类）」` });
  }
  return violations;
}

function checkTargetKindLiveDocs(verifierSpec: string, commandReference: string, agentPersonas: string, ssot: string): DocCheckViolation[] {
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
        violations.push({ check: 'targetkind', message: `${docName} 检测到废弃 targetKind 标记「${token}」（应为 code/test）` });
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

function checkOperatingBehaviors(skill: string, readme: string, ssot: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!skill.includes('### 七条操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'SKILL.md 应含「### 七条操作行为」' });
  }
  if (!readme.includes('7 条核心操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'README 应含「7 条核心操作行为」' });
  }
  if (readme.includes('6 条核心操作行为') || ssot.includes('6 条核心操作行为')) {
    violations.push({ check: 'operating-behaviors', message: 'README/SSoT 仍含过时「6 条核心操作行为」' });
  }
  return violations;
}

function checkAntiPatterns(antiPatterns: string): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (!antiPatterns.includes(`\n| ${EXPECTED.maxAntiPattern} |`)) {
    violations.push({ check: 'anti-patterns', message: `anti-patterns.md 反模式表最大编号应为 ${EXPECTED.maxAntiPattern}` });
  }
  if (!antiPatterns.includes(`#1~#${EXPECTED.maxAntiPattern}`)) {
    violations.push({ check: 'anti-patterns', message: `anti-patterns.md 应含连续区间「#1~#${EXPECTED.maxAntiPattern}」` });
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
    violations.push({ check: 'exit2-scripts', message: `实测 exit-2 脚本数应为 ${EXPECTED.exit2ScriptCount}，实际 ${count}` });
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
    violations.push({ check: 'pre-push', message: `pre-push 编号注释最大值应为 ${EXPECTED.prePushCount}，实际 ${max}` });
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

function checkAssetCounts(personaCount: number, cursorSkillCount: number): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  if (personaCount !== EXPECTED.personaCount) {
    violations.push({ check: 'asset-counts', message: `subagent/ 人格文件数应为 ${EXPECTED.personaCount}，实际 ${personaCount}` });
  }
  if (cursorSkillCount !== EXPECTED.cursorSkillCount) {
    violations.push({ check: 'asset-counts', message: `.cursor/skills 目录数应为 ${EXPECTED.cursorSkillCount}，实际 ${cursorSkillCount}` });
  }
  return violations;
}

function checkDesignDocs(designDocs: Array<{ name: string; content: string }>): DocCheckViolation[] {
  const violations: DocCheckViolation[] = [];
  for (const doc of designDocs) {
    for (const token of FORBIDDEN_TARGETKIND) {
      if (doc.content.includes(token)) {
        violations.push({ check: 'design-docs', message: `${doc.name} 检测到废弃 targetKind 标记「${token}」（应为 code/test）` });
      }
    }
    const enumMatch = doc.content.match(TARGETKIND_ENUM_PATTERN);
    if (enumMatch) {
      violations.push({ check: 'design-docs', message: `${doc.name} 的 targetKind 括号枚举仍含废弃值「${enumMatch[0]}」（应为 code/test）` });
    }
    for (const stale of STALE_DOD_DIMENSIONS) {
      if (doc.content.includes(stale)) {
        violations.push({ check: 'design-docs', message: `${doc.name} 仍含过时 DoD 维度表述「${stale}」（当前七维度）` });
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
    violations.push({ check: 'vitest-files', message: `实测 vitest 测试文件数应为 ${EXPECTED.vitestFileCount}，实际 ${testFileCount}（新增测试文件须同步文档与 EXPECTED）` });
  }
  if (!readme.includes(`${EXPECTED.vitestFileCount} files`)) {
    violations.push({ check: 'vitest-files', message: `README 应含「${EXPECTED.vitestFileCount} files」vitest 表述` });
  }
  if (!agents.includes(`${EXPECTED.vitestFileCount} 个 .test.ts`)) {
    violations.push({ check: 'vitest-files', message: `AGENTS.md 应含「${EXPECTED.vitestFileCount} 个 .test.ts」vitest 表述` });
  }
  return violations;
}
