import { createHash } from 'node:crypto';
import * as nodeFs from 'node:fs';
import * as path from 'node:path';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import { RTM_FIELDS } from '../lib/constants.js';

export interface RTMRowShape {
  requirementId: string;
  description: string;
  designDoc: string;
  codeModule: string;
  unitTest: string;
  integrationTest: string;
  systemTest: string;
  acceptanceTest: string;
  coverageStatus?: '100%' | '部分' | '待覆盖';
  targetValue?: string;
  testThreshold?: string;
}

export interface RTMMatrixShape {
  /** RTM 最后更新时间（ISO 8601）；M07 E4 用它判定是否在测试证据 cutoff 之后 */
  lastUpdated?: string;
  rows: RTMRowShape[];
  executionSummary: {
    unitTest: TestSummaryShape;
    integrationTest: TestSummaryShape;
    systemTest: TestSummaryShape;
    acceptanceTest: TestSummaryShape;
  };
}

/**
 * 单级测试摘要的真实运行证据（M07，rtm.schema.json definitions.testSummary.evidence）。
 * command/exitCode/observedAt 为必填锚点；rawOutputPath 与 rawOutputSha256 成对可选。
 */
export interface TestEvidenceShape {
  command: string;
  exitCode: number;
  observedAt: string;
  rawOutputPath?: string;
  rawOutputSha256?: string;
}

export interface TestSummaryShape {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  coverage: number;
  evidence?: TestEvidenceShape;
}

/** M07 测试证据维度计数（GATE_JSON e-rule 计数）。missing === e4（同义，保留 run-log r10 的 checked/missing/legacy 形态）。 */
export interface ArtifactGateTestEvidenceSummary {
  /** 阶段范围内且 total>0、进入 E4 存在性判定的层数 */
  checked: number;
  /** checked 中携带 evidence 对象的层数 */
  withEvidence: number;
  /** checked 中 cutoff 后（含缺失/不可解析）缺 evidence 的层数（= e4 违规） */
  missing: number;
  /** checked 中 lastUpdated 早于 cutoff、被非阻断吸收的层数 */
  legacy: number;
  /** E1 配对违规计数 */
  e1: number;
  /** E2 哈希核验违规计数 */
  e2: number;
  /** E3 结果一致性违规计数 */
  e3: number;
  /** E4 存在性违规计数（=== missing） */
  e4: number;
}

export interface ArtifactGateResult {
  passed: boolean;
  reasons: string[];
  coveragePercent: number;
  missingItems: Array<{ requirementId: string; fields: string[] }>;
  unitCoveragePercent: number;
  /** 非阻断 legacy 诊断（M07：cutoff 前旧 RTM 缺 evidence）；结构照 run-log diagnostics 先例，非空才出现 */
  legacy?: string[];
  /** M07 测试证据维度计数；结构失败早退路径不产出 */
  testEvidence?: ArtifactGateTestEvidenceSummary;
  /** S18 票据内容校验计数；未给定票据文本（`options.ticketsText` 缺省）或结构失败早退时不产出 */
  tickets?: TicketContentSummary;
}

/**
 * M07 RTM 测试证据绑定（D-2 批准单元）引入时刻。
 *
 * 依据：`docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md` 的 D-2
 * 于 **2026-09-15** 单独批准（「只能是新增可选字段；不得改动 RTM 实体、关系、覆盖率语义」），
 * 本常量取批准日零点（UTC）。此后写入的 RTM，其阶段范围内 total>0 的测试层必须携带
 * 合法 `testSummary.evidence` 才可进入门禁放行（E4）；此前写入的旧 RTM 按
 * `LEGACY_TEST_EVIDENCE` 非阻断诊断吸收（方向与 run-log `LEGACY_REVERT_EVIDENCE` 一致）。
 */
export const M07_TEST_EVIDENCE_CUTOFF = '2026-09-15T00:00:00Z';

/** E2 相对路径解析结果；ok=false 时 reason 为人类可读拒绝原因。 */
export type EvidencePathResolution = { ok: true; absPath: string } | { ok: false; reason: string };

/**
 * E2 路径解析：以项目根解析相对路径，拒绝绝对路径 / 盘符路径 / 反斜杠分隔 / NUL，
 * 并做根内包含性检查（lexical，`..` 归一化后仍须落在根内）。
 *
 * 说明：rtm.schema.json 的 `rawOutputPath.pattern` 已在前置 schema 校验拦截
 * `..` / 绝对路径 / 反斜杠；本函数是逻辑层的第二道防线（schema 被绕过或未来放宽时仍拒）。
 */
export function resolveTestEvidenceOutputPath(projectRoot: string, rawOutputPath: string): EvidencePathResolution {
  if (typeof rawOutputPath !== 'string' || rawOutputPath.trim() === '') {
    return { ok: false, reason: '路径为空' };
  }
  const rel = rawOutputPath.trim();
  if (rel.includes('\u0000')) return { ok: false, reason: '路径含 NUL' };
  if (path.isAbsolute(rel) || /^[A-Za-z]:[\\/]/.test(rel) || rel.includes('\\')) {
    return { ok: false, reason: '须为相对路径（不得为绝对路径 / 盘符 / 反斜杠分隔）' };
  }
  const root = path.resolve(projectRoot);
  const abs = path.resolve(root, rel);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(prefix)) {
    return { ok: false, reason: '越出项目根' };
  }
  return { ok: true, absPath: abs };
}

/** 计算文件 SHA-256（十六进制小写）；读取失败返回 undefined。 */
function sha256OfFile(absPath: string): string | undefined {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absPath 由 resolveTestEvidenceOutputPath 校验（相对项目根、禁越出根）后传入
    const buf = nodeFs.readFileSync(absPath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return undefined;
  }
}

// RTM 追溯字段单点事实源：lib/constants.ts（RTM_FIELDS），此处仅保持名称与类型不变
const REQUIRED_TRACE_FIELDS: Array<keyof RTMRowShape> = [...RTM_FIELDS];

// ==================== 阶段级校验（P1.1） ====================
/**
 * 阶段级校验选项。
 * - phase 1-4：跳过测试汇总校验（设计阶段，pending 合理）
 * - phase 5：校验 unitTest；跳过 integration/system/acceptance
 * - phase 6：phase 5 + integrationTest
 * - phase 7：phase 6 + systemTest
 * - phase 8：全部 + acceptanceTest（默认，向后兼容）
 */
export type PhaseOption = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 各阶段须校验的测试汇总层（未到的层跳过 pending/failed 校验）。 */
const PHASE_TEST_LAYERS: Record<number, readonly string[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: ['unitTest'],
  6: ['unitTest', 'integrationTest'],
  7: ['unitTest', 'integrationTest', 'systemTest'],
  8: ['unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};

/**
 * 各阶段须校验的 RTM 追溯字段（含 description，保持与终检一致）。
 * phase=8 与 REQUIRED_TRACE_FIELDS 完全一致（向后兼容）。
 */
const PHASE_TRACE_FIELDS: Record<number, readonly (keyof RTMRowShape)[]> = {
  1: ['description', 'designDoc', 'acceptanceTest'],
  2: ['description', 'designDoc', 'acceptanceTest'],
  3: ['description', 'designDoc', 'acceptanceTest'],
  4: ['description', 'designDoc', 'acceptanceTest'],
  5: ['description', 'designDoc', 'codeModule', 'unitTest', 'acceptanceTest'],
  6: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'acceptanceTest'],
  7: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
  8: ['description', 'designDoc', 'codeModule', 'unitTest', 'integrationTest', 'systemTest', 'acceptanceTest'],
};

/**
 * 终检强化（spec §3.4.4）可选入参类型。
 */
export interface GateGraphNode {
  id: string;
  type: string;
}

export interface GateGraph {
  nodes: GateGraphNode[];
}

export interface CheckArtifactGateOptions {
  graph?: GateGraph;
  manifestExists?: boolean;
  /** 阶段级校验选项（P1.1）：1-8，默认 8（终检，向后兼容）。 */
  phaseOption?: PhaseOption;
  /** phase=1 需求规格独立产物目录（docs/phase1-requirements/），提供时做结构校验。 */
  specDir?: string;
  /**
   * 项目根目录（M07 E2 解析 evidence.rawOutputPath 用）。
   * 未提供且某层携带 rawOutputPath+rawOutputSha256 时 E2 fail-closed（无法核验）；
   * check-artifact-gate.ts 始终传 project-dir。
   */
  projectRoot?: string;
  /**
   * S18 票据文本（`--tickets=<path>` 读取的 `tickets.md` 内容）。
   * **缺省时不触发任何票据校验**（既有调用方零影响）；仅当 CLI 侧确认 phase>=5 且文件存在时传入。
   * 纯函数不读盘：文件不存在 / 参数非法的 exit 2 判定由 CLI 层负责。
   */
  ticketsText?: string;
}

/**
 * SD→codeModule 映射校验（spec §3.4.4 第2项，逻辑同 code-tla-logic.ts 维度1）。
 *
 * 校验：每个 SD 节点须有至少一个 codeModule 映射。
 * 映射判定：SD id 去 "SD-" 前缀，按 -/_/. 拆段（长度 >= 2），任一段在 codeModule 路径中出现。
 */
function checkSdToCodeModuleMapping(graph: GateGraph, rows: RTMRowShape[]): string[] {
  const violations: string[] = [];
  if (!graph || !Array.isArray(graph.nodes)) return violations;
  const sdNodes = graph.nodes.filter((n) => n && n.type === 'SD');
  if (sdNodes.length === 0) return violations;

  const codeModules: string[] = [];
  for (const row of rows) {
    if (row && typeof row.codeModule === 'string' && row.codeModule.trim() !== '') {
      codeModules.push(row.codeModule);
    }
  }

  for (const sd of sdNodes) {
    const id = String(sd.id ?? '');
    const stripped = id.replace(/^SD-/, '');
    const segments = stripped
      .split(/[-_.]+/)
      .map((s) => s.toLowerCase())
      .filter((s) => s.length >= 2);
    if (id !== '' && segments.length === 0 && codeModules.some((m: string) => m.includes(`${id}:`))) {
      continue; // 数字层级 id（如 SD-5.2.1）命中 codeModule 前缀映射
    }
    if (segments.length === 0) {
      violations.push(`TLA+ 资产校验失败：SD 节点 id 为空或无可识别段，无法映射 codeModule: ${id}`);
      continue;
    }
    const matched = codeModules.some((cm) => {
      const cmLower = cm.toLowerCase();
      return segments.some((seg) => cmLower.includes(seg));
    });
    if (!matched) {
      violations.push(
        `TLA+ 资产校验失败：SD 节点 ${id} 无对应 codeModule（期望 codeModule 路径包含以下任一段: ${segments.join(', ')}）`,
      );
    }
  }
  return violations;
}

// ==================== codeModule 格式校验（P0-2） ====================
/**
 * codeModule 格式校验（按行类型分支）。
 * - REQ 行：^SD-[\d.]+:src/.+
 * - NFR/CON 行：^src/.+ 或 === "横切"
 */
export function checkCodeModuleFormat(rows: RTMRowShape[]): string[] {
  const violations: string[] = [];
  const reqPattern = /^SD-[\d.]+:src\/.+/;
  const nfrPattern = /^src\/.+/;

  for (const row of rows) {
    if (!row || typeof row.codeModule !== 'string' || row.codeModule.trim() === '') continue;

    const id = row.requirementId;
    const cm = row.codeModule.trim();

    if (id.startsWith('REQ-')) {
      if (!reqPattern.test(cm)) {
        violations.push(
          `codeModule 格式错误：REQ 行 ${id} 的 codeModule "${cm}" 须匹配 ^SD-[\\d.]+:src/.+（示例：SD-5.2.1:src/auth/login.ts）`,
        );
      }
    } else if (id.startsWith('NFR-') || id.startsWith('CON-')) {
      if (cm !== '横切' && !nfrPattern.test(cm)) {
        violations.push(
          `codeModule 格式错误：${id.startsWith('NFR-') ? 'NFR' : 'CON'} 行 ${id} 的 codeModule "${cm}" 须匹配 ^src/.+ 或 === "横切"`,
        );
      }
    }
  }
  return violations;
}

// ==================== S18 票据内容校验（No Placeholders 黑名单 + Buildability） ====================
/**
 * S18 票据内容门禁计数（GATE_JSON `tickets` 键；结构照 M07 `testEvidence` 先例）。
 * - `checked`：识别到的票据块数（`# <NN> — <标题>`）
 * - `criticalMissing`：六条黑名单命中数
 * - `buildabilityMissing`：Buildability 负面判据命中数
 */
export interface TicketContentSummary {
  checked: number;
  criticalMissing: number;
  buildabilityMissing: number;
}

export interface TicketContentResult {
  passed: boolean;
  violations: string[];
  summary: TicketContentSummary;
}

/**
 * 票据式标题（修复轮 1 ④：收紧边界识别，避免把 `### 1. 步骤一` 这类分节标题虚增为票据）：
 * - 模板形态：`# <NN> — <标题>`（`phase-5-coding.md` 票据内容契约的实际形态，分隔符限破折号族）；
 * - 关键词形态：`# 票据 N …` / `# Ticket N …` / `# 任务 N …`（大小写不敏感）。
 * 纯「`#` + 数字 + 点号」的分节标题（`### 1. 步骤一`）**不再**被当作票据边界。
 */
const TICKET_HEADING_NUM_RE = /^#{1,3}\s+(\d{1,4})\s*[—–-]\s*(.*)$/;
const TICKET_HEADING_KEYWORD_RE = /^#{1,3}\s+(?:票据|ticket|任务|task)\s*(\d{1,4})\b\s*[—–\-:：.]?\s*(.*)$/i;

/**
 * 黑名单第 1 条（台账 `sources/2026-09-14-superpowers-adopted-excerpts.md:696`）：
 * 禁止占位短语。ASCII 词表与 `logic/code-health-ledger-logic.ts` 的 PLACEHOLDER 正则**术语对齐**
 * （`tbd|todo|…|待定|待补`），但不复用其函数——两者域不同（code-health 候选 ledger vs 阶段 5 票据）。
 */
const TICKET_PLACEHOLDER_ASCII_RE = /\b(tbd|todo|implement later|fill in details)\b/i;
const TICKET_PLACEHOLDER_CJK = ['待补建', '待补', '待定', '稍后实现', '填充细节'];

/** 黑名单第 2 条（台账 :697）：无具体动作的祈使（只与「行内无符号引用」同时成立才命中） */
const TICKET_VAGUE_IMPERATIVES = [
  '加适当的错误处理',
  '添加适当的错误处理',
  '加合适的错误处理',
  '加校验',
  '添加校验',
  '加验证',
  '添加验证',
  '处理边界情况',
  '处理边界条件',
  '处理各种边界情况',
  'add appropriate error handling',
  'add proper error handling',
  'add validation',
  'handle edge cases',
];

/** 黑名单第 3 条（台账 :698）：要求写测试但未给出测试符号或用例名 */
const TICKET_TEST_WITHOUT_SIGNATURE = [
  '为上述写测试',
  '写测试',
  '补测试',
  '添加测试',
  'write tests for the above',
  'write tests',
  'add tests',
  'add unit tests',
];

/** 黑名单第 4 条（台账 :699）：以「类似任务 N」指代其他票据而未重复符号级说明 */
const TICKET_SIMILAR_TO_TASK_RE =
  /(?:similar to|same as)\s+(?:task|ticket)\s*\d+|(?:与|类似|如同|参照)[^。\n]{0,12}?(?:任务|票据)\s*\d+/i;

/**
 * 契约标记词（修复轮 1 ①②：由「13 个散文短语」收紧为**专指契约**的词，剔除通用词
 * `返回` / `参数` / `签名` / `signature` / `returns`——通用词会让「加两个字即放行」成为旁路）。
 * 修复轮 3：标记词须与 span **声明式邻接**才算契约声明（见 `hasAdjacentContractMarker()`），
 * 不再用「行内任意位置含标记词」——否则否定/旁述语义（如「无接口签名要求，调用 X()」）会误判为声明。
 */
const TICKET_CONTRACT_MARKERS = ['接口签名', '类型约束', '状态转移', '符号契约', '契约', '定义', '入参', '出参'];

/** `What to build` 字段行（`phase-5-coding.md:149` 票据内容契约的字段名） */
const TICKET_CONTRACT_FIELD_RE = /^\s*(?:\*\*)?\s*what to build\s*(?:\*\*)?\s*[:：]/i;

/** 声明式邻接允许的间隔符（空白 / 冒号 / 顿号逗号分号 / 星号 / 各类引号与括号） */
const DECLARATIVE_SEPARATOR_RE = /[\s:：、,，;；*`'"“”‘’「」『』（）()[\]【】]+$/;

/** 标记词是否紧邻该 span 之前（`接口签名 \`A.b(x)\``、`本票契约：\`A.b(x)\`` 的声明式形态） */
function hasAdjacentContractMarker(line: string, span: string): boolean {
  let from = 0;
  for (;;) {
    const idx = line.indexOf(span, from);
    if (idx === -1) return false;
    const before = line.slice(0, idx).replace(DECLARATIVE_SEPARATOR_RE, '');
    if (TICKET_CONTRACT_MARKERS.some((k) => before.endsWith(k))) return true;
    from = idx + 1;
  }
}

function isContractFieldLine(line: string): boolean {
  return TICKET_CONTRACT_FIELD_RE.test(line);
}

/** 语言字面量 / 关键字（不作为符号引用比对，避免 `false` / `void` 之类被误报为未定义符号） */
const TICKET_SYMBOL_STOPWORDS = new Set(['true', 'false', 'null', 'undefined', 'void', 'this']);

/** 票据内的文件路径（Buildability ③；与 `phase-5-coding.md:162`「禁止具体文件路径」同向）
 *  两个分支均为顺序量词（无嵌套重复），避免 `security/detect-unsafe-regex` 击穿。 */
const TICKET_FILE_PATH_RE =
  /[A-Za-z0-9_.-]+[\\/][A-Za-z0-9_.\\/-]+|\b[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|py|go|java|rb|rs|sql|html|css|sh|feature|tla|cfg)\b/gi;

/**
 * 第 5 条的**替代形态**（§0.1.3「须点名接口签名/类型约束/状态转移**或**可执行步骤的具体动作与产出物」）：
 * 非代码票据（文档 / 手册 / 流程）无法给出符号契约时，可用显式「具体动作 / 产出物」行表达「怎么做」。
 * 判定：该行出现标记词，且标记词之后仍有实质内容（≥2 个非空白非标点字符）。
 */
const TICKET_CONCRETE_DELIVERABLE_MARKERS = ['产出物', '交付物', '具体动作', 'deliverable', 'concrete steps'];

function hasConcreteDeliverable(lines: string[]): boolean {
  return lines.some((line) => {
    const lower = line.toLowerCase();
    return TICKET_CONCRETE_DELIVERABLE_MARKERS.some((k) => {
      const idx = lower.indexOf(k);
      if (idx === -1) return false;
      const tail = line.slice(idx + k.length).replace(/[\s:：*_\u002d\u2014、,，]+/g, '');
      return tail.length >= 2;
    });
  });
}

/** 反引号 span（票据内单行内联标记） */
const BACKTICK_SPAN_RE = /`([^`\n]+)`/g;

/** 符号 span 头部标识符：标识符 / 点分标识符（如 `A`、`A.b`） */
const IDENT_HEAD_RE = /^[A-Za-z_$][\w$.]*/;

/** 符号 span 可选后缀：类型注解或状态转移（`: T` / `→ T` / `-> T`） */
const SYMBOL_SUFFIX_RE = /^\s*(?::|→|->)\s*\S[\s\S]*$/;

/**
 * 符号 span 拆为「头 + 尾」（顺序量词 + 括号手工配对，避免嵌套重复的 unsafe-regex）：
 * 头 = 标识符 / 点分标识符（可带调用）；尾 = 其余（类型注解 / 状态转移等）。
 */
function splitSymbolSpan(span: string): { head: string; tail: string } {
  const id = IDENT_HEAD_RE.exec(span)?.[0] ?? '';
  if (id === '') return { head: '', tail: span };
  let head = id;
  // 可选调用：标识符后紧跟 `(` 且存在配对 `)` 时，把头扩到 `)` 为止（含参数）
  if (span[id.length] === '(') {
    const close = span.indexOf(')', id.length + 1);
    if (close !== -1) head = span.slice(0, close + 1);
  }
  return { head, tail: span.slice(head.length) };
}

/** 符号 span 判定：整个 span 为「标识符 / 点分标识符（可带调用）」，其后可跟类型注解或状态转移。 */
function isSymbolSpan(span: string): boolean {
  const { head, tail } = splitSymbolSpan(span);
  return head !== '' && (tail === '' || SYMBOL_SUFFIX_RE.test(tail));
}

/** 调用式 span 是否为「带参调用」（`A.b(x)`）；空括号 `A.b()` 不算声明形态——防「只调用不声明」旁路 */
function hasCallArguments(head: string): boolean {
  const open = head.indexOf('(');
  if (open === -1) return false;
  return head.slice(open + 1, -1).trim() !== '';
}

/**
 * 定义判定（修复轮 2 B 复位 + 修复轮 3 收紧二级判定）：
 * 1. span 自身带**契约标注**（`: T` / `→ b` / `-> T`）→ 视为定义（任意行，与 B① 的 `接口签名(...): T` 同口径）；
 * 2. **声明式邻接**：专指契约标记词紧邻该 span 之前（仅允许空白/冒号/顿号/引号/括号等间隔符，
 *    形如 `接口签名 \`A.b(x)\``、`本票契约：\`A.b(x)\``）→ 视为定义。该分支对**裸符号与调用式一律**成立
 *    （含空括号调用：声明式形态已明确「这是签名」）。
 *    修复轮 3：不再用「行内任意位置含标记词」——`无接口签名要求，调用 \`Ghost.do()\`` /
 *    `沿用现有契约，调用 \`Ghost.do()\`` / `调用 \`X.render()\`，不定义新类型` 这类**否定 / 旁述**
 *    语义不得被当作契约声明；
 * 3. **`What to build` 字段行**（无声明式邻接）→ 裸符号（点名符号，`phase-5-coding.md:149/168-173` 的写法）
 *    与**带参调用式**（`A.b(x)`，形如签名）视为定义；
 *    **空括号调用式**（`A.b()`）**不**视为定义——保住修复轮 1 finding #2
 *    （`调用 \`Ghost.do()\`，返回值忽略` 必须仍被第 6 条拦下）；
 * 4. 其余行（说明 / 散文行）→ 只有情形 1 算定义；**通用散文词**（`返回`/`参数`/`签名`/`signature`/`returns`）
 *    不参与判定，避免「加两个字即放行」。
 */
function isDefinitionSpanInLine(span: string, line: string): boolean {
  const { head, tail } = splitSymbolSpan(span);
  if (head === '') return false;
  if (tail !== '' && SYMBOL_SUFFIX_RE.test(tail)) return true;
  if (hasAdjacentContractMarker(line, span)) return true;
  if (!isContractFieldLine(line)) return false;
  const isCall = head.includes('(');
  return !isCall || hasCallArguments(head);
}

/** 标识符 token（用于定义词汇表；`` `describe('A.b')` `` 可抽出 `describe` 与 `A.b`） */
const IDENT_TOKEN_RE = /[A-Za-z_$][\w$.]*/g;

/** 源码类文件后缀：命中即视为路径（避免把 `Foo.bar` 误判为路径） */
const FILE_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|py|go|java|rb|rs|sql|html|css|sh|feature|tla|cfg)$/i;

/** 接口签名 span（Buildability ①：`name(...)` 形态） */
const SIGNATURE_SPAN_RE = /^[A-Za-z_$][\w$.]*\([^)]*\)/;

/** 验收标准行（`- [ ] …`） */
const ACCEPTANCE_CRITERION_RE = /^\s*-\s*\[[ xX]\]/;

function isPathLikeSpan(span: string): boolean {
  return /[/\\]/.test(span) || FILE_EXT_RE.test(span);
}

/** 取一行内全部反引号 span，过滤出符号 span（排除路径 / JSON 字面量 / 语言字面量等） */
function symbolSpansOfLine(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(BACKTICK_SPAN_RE)) {
    const s = (m[1] ?? '').trim();
    if (s === '' || isPathLikeSpan(s) || TICKET_SYMBOL_STOPWORDS.has(s.toLowerCase())) continue;
    if (isSymbolSpan(s)) out.push(s);
  }
  return out;
}

/** 取字符串内全部标识符 token（含点分） */
function identTokens(text: string): string[] {
  return [...text.matchAll(IDENT_TOKEN_RE)].map((m) => m[0]);
}

interface TicketBlock {
  id: string;
  title: string;
  lines: string[];
}

/**
 * 按票据式标题切分票据块（标题前的内容视为文档前言，不参与校验）。
 * 边界识别见 `TICKET_HEADING_NUM_RE` / `TICKET_HEADING_KEYWORD_RE`（修复轮 1 ④：分节标题不虚增）。
 */
function splitTicketBlocks(text: string): TicketBlock[] {
  const blocks: TicketBlock[] = [];
  let current: TicketBlock | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = TICKET_HEADING_NUM_RE.exec(line) ?? TICKET_HEADING_KEYWORD_RE.exec(line);
    if (m) {
      if (current) blocks.push(current);
      current = { id: m[1] ?? '', title: (m[2] ?? '').trim() || '（无标题）', lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

/**
 * S18 票据内容校验（纯函数，不读盘）。
 *
 * 判据集 = 六条黑名单 + Buildability 三条负面判据；逐条出处见计划
 * `docs/superpowers/plans/2026-09-15-p4-test-quality-and-design-rules.md` §0.1.3/§0.1.5，
 * 黑名单行号对应台账 `docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md:696-701`。
 *
 * **符号类改写（本仓库对源文的适配，非源文原义）**：台账标题写「七条」而原文块实测 6 条 bullet，
 * 且原文块含 `（略）` 截断（源仓库不在本仓，路径类原文**未见、未核实**）。规格 §11 :304 的硬约束是
 * 「S18 路径类黑名单换符号类」，本仓既有票据契约（`phase-5-coding.md:162` 禁止具体文件路径与代码片段；
 * `:168-173` 票据主体=符号级契约）与之同向。故第 5 条（源文附「code blocks required」）与第 1/2/3 条中
 * 「怎么写」的部分一律落为**符号级要求**：票据须点名接口签名 / 类型约束 / 状态转移，或可执行步骤的
 * **具体动作与产出物**——**不要求写文件路径，也不要求内联代码块**。
 *
 * 判据分工（避免同一断言重复触发）：
 * - 第 6 条只审**非验收标准行**的未定义符号引用；Buildability ② 只审**验收标准行**的未定义符号引用；
 * - 第 5 条只在「无符号且无路径且未给显式产出物行」时命中；Buildability ③ 只在「无符号但有路径」时命中；
 * - 第 5 条命中时 Buildability ①（缺签名且缺验收标准）**不再重复计数**（同一根因，§0.1.5 不重复断言）。
 *
 * **符号「已定义」的结构性判定**（修复轮 1 ①②、修复轮 2 B、修复轮 3 口径）：span 自身带契约标注（`: T` / `→ b` / `-> T`）
 * 任意行成立；**声明式邻接**（契约标记词 `接口签名`/`类型约束`/`状态转移`/`符号契约`/`契约`/`定义`/`入参`/`出参`
 * **紧邻 span 之前，中间仅隔空白/冒号/顿号/引号/括号等间隔符**）上裸符号与调用式**一律**算定义；
 * **标记词的否定/旁述出现**（如「无接口签名要求，调用 …」「沿用现有契约，调用 …」）**不算**声明式邻接
 * ——修复轮 3 起不再用「行内任意位置含标记词」的全行匹配口径（见 `isDefinitionSpanInLine` JSDoc）。
 * **`What to build` 字段行**（无声明式邻接）上裸符号与**带参**调用式算定义，**空括号**调用式（`A.b()`）不算。
 * 通用散文词（`返回` / `参数` / `签名` / `signature` / `returns`）**不**参与判定
 * ——既避免「加两个字即放行」的旁路，也避免把「无返回标注的调用式签名」（如 `接口签名 \`A.b(x)\``）误报为未定义。
 */
export function checkTicketContent(ticketsText: string): TicketContentResult {
  const violations: string[] = [];
  const blocks = splitTicketBlocks(typeof ticketsText === 'string' ? ticketsText : '');
  if (blocks.length === 0) {
    return {
      passed: false,
      violations: ['票据内容校验失败：未发现任何票据（期望 `# <NN> — <标题>` 形式的票据块；S18 票据内容契约）'],
      summary: { checked: 0, criticalMissing: 1, buildabilityMissing: 0 },
    };
  }

  // 跨票据符号定义词汇表：任一票据的**契约行**上按定义形态出现的符号即视为已定义
  // （修复轮 1 ①②：定义判定与 B① 的签名识别同源，不再由通用散文词触发）
  const definedSymbols = new Set<string>();
  for (const b of blocks) {
    for (const line of b.lines) {
      for (const span of symbolSpansOfLine(line)) {
        if (!isDefinitionSpanInLine(span, line)) continue;
        for (const tok of identTokens(span)) definedSymbols.add(tok);
      }
    }
  }
  const isDefinedSpan = (span: string): boolean => identTokens(span).some((t) => definedSymbols.has(t));

  let criticalMissing = 0;
  let buildabilityMissing = 0;

  for (const block of blocks) {
    const where = `票据 ${block.id}「${block.title}」`;
    const text = block.lines.join('\n');
    const criterionLines = block.lines.filter((l) => ACCEPTANCE_CRITERION_RE.test(l));
    const bodyLines = block.lines.filter((l) => !ACCEPTANCE_CRITERION_RE.test(l));
    const bodySymbols = bodyLines.flatMap((l) => symbolSpansOfLine(l));
    const criterionSymbols = criterionLines.flatMap((l) => symbolSpansOfLine(l));
    const allSymbols = [...bodySymbols, ...criterionSymbols];
    const paths = text.match(TICKET_FILE_PATH_RE) ?? [];
    const lineHasSymbol = (l: string): boolean => symbolSpansOfLine(l).length > 0;

    // ---- 第 1 条：禁止占位短语 ----
    const asciiHit = TICKET_PLACEHOLDER_ASCII_RE.exec(text)?.[1];
    const cjkHit = TICKET_PLACEHOLDER_CJK.find((t) => text.includes(t));
    if (asciiHit !== undefined || cjkHit !== undefined) {
      criticalMissing++;
      violations.push(
        `票据内容校验失败：${where}placeholder "${asciiHit ?? cjkHit}"（S18 黑名单第 1 条：禁止占位短语；台账 :696）`,
      );
    }

    // ---- 第 2 条：无具体动作的祈使（须行内无符号引用） ----
    const vagueHit = block.lines.find(
      (l) => !lineHasSymbol(l) && TICKET_VAGUE_IMPERATIVES.some((p) => l.toLowerCase().includes(p)),
    );
    if (vagueHit !== undefined) {
      criticalMissing++;
      violations.push(
        `票据内容校验失败：${where}vague-imperative（S18 黑名单第 2 条：无具体动作的祈使；台账 :697；符号级改写——须点名符号或给出具体动作与产出物）`,
      );
    }

    // ---- 第 3 条：要求写测试但无测试符号 / 用例名 ----
    const testHit = block.lines.find(
      (l) => !lineHasSymbol(l) && TICKET_TEST_WITHOUT_SIGNATURE.some((p) => l.toLowerCase().includes(p)),
    );
    if (testHit !== undefined) {
      criticalMissing++;
      violations.push(
        `票据内容校验失败：${where}test-without-signature（S18 黑名单第 3 条：要求写测试但未给出测试符号或用例名；台账 :698）`,
      );
    }

    // ---- 第 4 条：类似任务 N 而无符号级重复说明 ----
    const similarHit = block.lines.find((l) => !lineHasSymbol(l) && TICKET_SIMILAR_TO_TASK_RE.test(l));
    if (similarHit !== undefined) {
      criticalMissing++;
      violations.push(
        `票据内容校验失败：${where}similar-to-task（S18 黑名单第 4 条：以「类似任务 N」指代而未重复符号级说明；台账 :699）`,
      );
    }

    // ---- 第 5 条：只说要做什么不说怎么做（符号级改写）----
    // 无符号且无路径 → 违反；例外：非代码票据给出显式「具体动作 / 产出物」行（§0.1.3 的「或」分支）
    let noSymbolContract = false;
    if (allSymbols.length === 0 && paths.length === 0 && !hasConcreteDeliverable(block.lines)) {
      noSymbolContract = true;
      criticalMissing++;
      violations.push(
        `票据内容校验失败：${where}no-symbol-contract（S18 黑名单第 5 条：只说要做什么不说怎么做；台账 :700；` +
          `本仓库适配，非源文原义——须点名接口签名/类型约束/状态转移，或给出具体动作与产出物；不要求文件路径或内联代码块。` +
          `同根因的 Buildability 缺签名已并入本条，不重复计数——§0.1.5 不重复断言）`,
      );
    }

    // ---- 第 6 条：引用任何任务中都未定义的符号（只审非验收标准行） ----
    const undefinedBody = [...new Set(bodySymbols.filter((s) => !isDefinedSpan(s)))];
    for (const sym of undefinedBody) {
      criticalMissing++;
      violations.push(
        `票据内容校验失败：${where}undefined-symbol \`${sym}\`（S18 黑名单第 6 条：引用任何任务中都未定义的 type/function/method；台账 :701）`,
      );
    }

    // ---- Buildability ①：缺接口签名且缺验收标准 ----
    // 修复轮 1 ③：与第 5 条**同根因**（本票既无符号级契约又无验收标准）时只计一处——⑤ 优先，
    // 本条不再重复断言（§0.1.5 要求 B 的负面判据与 ⑤/⑥ 不重复）。
    const hasSignature = text.includes('接口签名') || allSymbols.some((s) => SIGNATURE_SPAN_RE.test(s));
    if (!hasSignature && criterionLines.length === 0 && !noSymbolContract) {
      buildabilityMissing++;
      violations.push(
        `票据内容校验失败：${where}Buildability：缺接口签名且缺验收标准（S18 Buildability 判据，§0.1.5②）`,
      );
    }

    // ---- Buildability ②：验收标准引用未定义符号（只审验收标准行） ----
    const undefinedCriteria = [...new Set(criterionSymbols.filter((s) => !isDefinedSpan(s)))];
    for (const sym of undefinedCriteria) {
      buildabilityMissing++;
      violations.push(
        `票据内容校验失败：${where}Buildability：验收标准引用未定义符号 \`${sym}\`（S18 Buildability 判据，§0.1.5②）`,
      );
    }

    // ---- Buildability ③：只给路径不给符号 ----
    if (allSymbols.length === 0 && paths.length > 0) {
      buildabilityMissing++;
      violations.push(
        `票据内容校验失败：${where}Buildability：只给路径 \`${paths[0]}\` 不给符号（S18 Buildability 判据；` +
          `路径不是定位手段，位置交给 codegraph_explore，phase-5-coding.md 票据内容 durability）`,
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    summary: { checked: blocks.length, criticalMissing, buildabilityMissing },
  };
}

// ==================== uat-path-mapping 回填校验（P0-1） ====================
export interface UatPathMappingRow {
  uatId: string;
  actualPath: string;
  mappingType: string;
}

/**
 * uat-path-mapping 回填校验。
 * - 每条 UAT-NNN 的 actualPath 非 "_待阶段5回填_"
 * - mappingType ∈ ["直接", "等价", "替代"]
 */
export function checkUatPathMappingBackfill(mappings: UatPathMappingRow[]): string[] {
  const violations: string[] = [];
  const validMappingTypes = ['直接', '等价', '替代'];

  for (const m of mappings) {
    if (!m || typeof m.uatId !== 'string') continue;
    if (typeof m.actualPath !== 'string' || typeof m.mappingType !== 'string') {
      violations.push(`uat-path-mapping 字段类型非法：${m.uatId} 的 actualPath/mappingType 必须为字符串`);
      continue;
    }
    if (m.actualPath.includes('_待阶段5回填_') || m.actualPath.trim() === '') {
      violations.push(`uat-path-mapping 未回填：${m.uatId} 的实际路径仍为 "_待阶段5回填_" 或为空`);
    }
    if (!validMappingTypes.includes(m.mappingType)) {
      violations.push(
        `uat-path-mapping mappingType 非法：${m.uatId} 的 mappingType "${m.mappingType}" 须 ∈ ["直接", "等价", "替代"]`,
      );
    }
  }
  return violations;
}

// ==================== Phase 1 需求规格结构校验 ====================
export interface RequirementSpecStructureViolations {
  refs: string[];
  ssot: string[];
  dod: string[];
}

/** 真实 node:fs 适配（readFileSync 显式 utf-8 以满足 string 返回类型）。 */
const nodeFsAdapter: {
  readFileSync(p: string): string;
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
} = {
  readFileSync: (p: string) => nodeFs.readFileSync(p, 'utf-8'),
  existsSync: (p: string) => nodeFs.existsSync(p),
  readdirSync: (p: string) => nodeFs.readdirSync(p),
};

/** Phase 1 需求规格结构校验：引用块完整性 + §0 SSOT 头 + DoD 清单
 *  @param specDir  docs/phase1-requirements/ 目录（含 requirement-spec.md + 6 独立产物）
 *  @param fs       文件系统注入 { readFileSync(p): string; existsSync(p): boolean }，便于单测 mock
 */
export function checkRequirementSpecStructure(
  specDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean },
): RequirementSpecStructureViolations {
  const v: RequirementSpecStructureViolations = { refs: [], ssot: [], dod: [] };
  const specPath = path.join(specDir, 'requirement-spec.md');
  if (!fs.existsSync(specPath)) {
    v.refs.push('structure: requirement-spec.md 不存在');
    return v;
  }
  // 引用块完整性：6 个独立文件（主规格引用块 `> xxx详见 [name](./name.md)`）
  // String() 兼容注入 fs 返回 Buffer 的场景（真实 node:fs 无编码 readFileSync 返回 Buffer）
  const spec = String(fs.readFileSync(specPath));
  const requiredRefs = [
    'system-context.md',
    'glossary.md',
    'traceability-matrix.md',
    'behavior-spec.md',
    'discipline-dod.md',
    'uml-modeling.md',
  ];
  for (const ref of requiredRefs) {
    if (!spec.includes(`](./${ref})`)) v.refs.push(`structure: 主规格缺引用块 → ${ref}`);
    if (!fs.existsSync(path.join(specDir, ref))) v.refs.push(`structure: 引用文件不存在 ${ref}`);
  }
  // §0 SSOT 头四项声明
  for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
    if (!spec.includes(key)) v.ssot.push(`structure: §0 SSOT 头缺「${key}」`);
  }
  // DoD 清单：discipline-dod.md - [ ] 项 ≥ 8
  const dodPath = path.join(specDir, 'discipline-dod.md');
  if (!fs.existsSync(dodPath)) {
    v.dod.push('structure: discipline-dod.md 不存在');
  } else {
    const dod = String(fs.readFileSync(dodPath));
    const checks = (dod.match(/- \[ \]/g) ?? []).length;
    if (checks < 8) v.dod.push(`structure: discipline-dod.md DoD 清单仅 ${checks} 项（须 ≥ 8）`);
  }
  return v;
}

/** 各阶段独立产物布局（主文档后缀 + 6 独立文件）
 *  phase=1: requirement-spec.md 主文档 + 6 子文件（无前缀）
 *  phase=2: {module}-system-design.md 主文档 + 6 子文件（带 {module}- 前缀）
 */
const PHASE_SPEC_LAYOUT: Record<number, { mainSuffix: string; refs: string[] }> = {
  1: {
    mainSuffix: 'requirement-spec.md',
    refs: [
      'system-context.md',
      'glossary.md',
      'traceability-matrix.md',
      'behavior-spec.md',
      'discipline-dod.md',
      'uml-modeling.md',
    ],
  },
  2: {
    mainSuffix: '-system-design.md',
    refs: ['system-architecture', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
  3: {
    mainSuffix: '-interface-design.md',
    refs: ['interface-contract', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'],
  },
  4: {
    mainSuffix: '-detailed-design.md',
    refs: ['class-design', 'data-model', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod'],
  },
};

/** Phase N 设计/规格结构校验：引用块完整性 + §0 SSOT 头 + DoD 清单
 *  @param phase  1/2/3/4
 *  @param specDir  docs/phase{N}-{name}/ 目录
 *  @param fs       文件系统注入 { readFileSync; existsSync; readdirSync }，便于单测 mock
 */
export function checkPhaseSpecStructure(
  phase: number,
  specDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean; readdirSync(p: string): string[] },
): RequirementSpecStructureViolations {
  const v: RequirementSpecStructureViolations = { refs: [], ssot: [], dod: [] };
  const layout = PHASE_SPEC_LAYOUT[phase];
  if (!layout) {
    v.refs.push(`structure: 不支持的 phase=${phase}（当前支持 1/2/3/4）`);
    return v;
  }
  // 主文档定位：phase=1 固定文件名；phase≥2 按 *{mainSuffix} glob
  let mainPath: string | undefined;
  if (phase === 1) {
    mainPath = path.join(specDir, layout.mainSuffix);
  } else {
    const mains = fs.readdirSync(specDir).filter((f) => f.endsWith(layout.mainSuffix));
    if (mains.length !== 1) {
      v.refs.push(`structure: 主文档 glob *${layout.mainSuffix} 匹配 ${mains.length} 个（须恰 1 个）`);
      return v;
    }
    mainPath = path.join(specDir, mains[0]!);
  }
  if (!fs.existsSync(mainPath)) {
    v.refs.push(`structure: 主文档 ${layout.mainSuffix} 不存在`);
    return v;
  }
  const spec = String(fs.readFileSync(mainPath));
  // module 前缀提取（phase≥2 时用于引用文件名校对，通用去掉主文档后缀）
  const modulePrefix = phase === 1 ? '' : path.basename(mainPath).slice(0, -layout.mainSuffix.length);
  for (const ref of layout.refs) {
    const refName = phase === 1 ? ref : `${modulePrefix}-${ref}.md`;
    if (!spec.includes(`](./${refName})`)) v.refs.push(`structure: 主文档缺引用块 → ${refName}`);
    if (!fs.existsSync(path.join(specDir, refName))) v.refs.push(`structure: 引用文件不存在 ${refName}`);
  }
  // §0 SSOT 头四项声明
  for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
    if (!spec.includes(key)) v.ssot.push(`structure: §0 SSOT 头缺「${key}」`);
  }
  // DoD 清单：discipline-dod.md - [ ] 项 ≥ 8
  const dodName = phase === 1 ? 'discipline-dod.md' : `${modulePrefix}-discipline-dod.md`;
  const dodPath = path.join(specDir, dodName);
  if (!fs.existsSync(dodPath)) {
    v.dod.push(`structure: ${dodName} 不存在`);
  } else {
    const dod = String(fs.readFileSync(dodPath));
    const checks = (dod.match(/- \[ \]/g) ?? []).length;
    if (checks < 8) v.dod.push(`structure: ${dodName} DoD 清单仅 ${checks} 项（须 ≥ 8）`);
  }
  return v;
}

/** 技能包 templates/ 各阶段目录映射（主模板文件名 + 子模板目录名） */
const TEMPLATES_PHASE_DIR: Record<number, { main: string; dir: string }> = {
  1: { main: 'requirement-spec.md', dir: 'requirement-spec' },
  2: { main: 'system-design.md', dir: 'system-design' },
  3: { main: 'interface-design.md', dir: 'interface-design' },
  4: { main: 'detailed-design.md', dir: 'detailed-design' },
};

/**
 * 模板漂移校验（--validate-templates 模式，C9）：按 PHASE_SPEC_LAYOUT 校验技能包
 * templates/ 资产含必需结构标记（引用块 / §0 SSOT 头 / DoD 清单），模板漂移可检出。
 *
 * 与 checkPhaseSpecStructure 的差异（模板 vs 项目产物）：
 *   - 主模板固定文件名（phase≥2 无 {module} 前缀，引用块用 {{module}} 占位符）
 *   - 子模板位于同名子目录（templates/requirement-spec/system-context.md 等，无前缀）
 *
 * @param templatesDir  技能包 templates/ 目录
 * @param fs            文件系统注入（同 checkPhaseSpecStructure，便于单测 mock）
 * @returns violations 列表（空数组 = 全部通过）
 */
export function checkTemplatesStructure(
  templatesDir: string,
  fs: { readFileSync(p: string): string; existsSync(p: string): boolean },
): string[] {
  const violations: string[] = [];
  for (const phase of [1, 2, 3, 4] as const) {
    const layout = PHASE_SPEC_LAYOUT[phase]!;
    const tdir = TEMPLATES_PHASE_DIR[phase]!;
    const prefix = 'templates:';

    // 1. 主模板存在
    const mainPath = path.join(templatesDir, tdir.main);
    if (!fs.existsSync(mainPath)) {
      violations.push(`${prefix} 阶段 ${phase} 主模板缺失 ${tdir.main}`);
      continue;
    }
    const main = String(fs.readFileSync(mainPath));

    for (const ref of layout.refs) {
      const refFile = ref.endsWith('.md') ? ref : `${ref}.md`;
      // 2. 引用块存在（phase=1 指向 requirement-spec/ 子目录；phase≥2 使用 {{module}} 占位符）
      const refLink = phase === 1 ? `](./requirement-spec/${refFile})` : `](./{{module}}-${refFile})`;
      if (!main.includes(refLink)) {
        violations.push(`${prefix} 阶段 ${phase} 主模板 ${tdir.main} 缺引用块 → ${refLink}`);
      }
      // 3. 子模板存在（子目录内，无前缀）
      if (!fs.existsSync(path.join(templatesDir, tdir.dir, refFile))) {
        violations.push(`${prefix} 阶段 ${phase} 子模板缺失 ${tdir.dir}/${refFile}`);
      }
    }

    // 4. §0 SSOT 头四项声明
    for (const key of ['文档版本', 'SSOT 声明', '自身校验', '禁止占位词']) {
      if (!main.includes(key)) violations.push(`${prefix} 阶段 ${phase} 主模板 §0 SSOT 头缺「${key}」`);
    }

    // 5. DoD 清单：discipline-dod 子模板 - [ ] 项 ≥ 8
    const dodPath = path.join(templatesDir, tdir.dir, 'discipline-dod.md');
    if (!fs.existsSync(dodPath)) {
      violations.push(`${prefix} 阶段 ${phase} DoD 子模板缺失 ${tdir.dir}/discipline-dod.md`);
    } else {
      const dod = String(fs.readFileSync(dodPath));
      const checks = (dod.match(/- \[ \]/g) ?? []).length;
      if (checks < 8) violations.push(`${prefix} 阶段 ${phase} DoD 清单仅 ${checks} 项（须 ≥ 8）`);
    }
  }
  return violations;
}

function failureResult(reasons: string[], coveragePercent = 0): ArtifactGateResult {
  return { passed: false, reasons, coveragePercent, missingItems: [], unitCoveragePercent: 0 };
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

export function checkArtifactGate(
  matrix: RTMMatrixShape | null | undefined,
  options?: CheckArtifactGateOptions,
): ArtifactGateResult {
  if (!matrix) return failureResult(['RTM 未初始化']);

  // === Schema 前置校验 ===
  // 结构性约束（additionalProperties / required / type）由 schema 拦截，
  // 通过后才进入下方业务规则校验（覆盖率 / 阶段级字段 / TLA+ 资产等）。
  const schemaResult = validateBySchema('rtm', matrix);
  if (!schemaResult.valid) {
    return {
      passed: false,
      reasons: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      coveragePercent: 0,
      missingItems: [],
      unitCoveragePercent: 0,
    };
  }

  // P1.1 阶段级校验：默认 phase=8（终检，向后兼容）
  const phase: PhaseOption = options?.phaseOption ?? 8;
  const phaseFields = PHASE_TRACE_FIELDS[phase] ?? REQUIRED_TRACE_FIELDS;
  const phaseLayers = PHASE_TEST_LAYERS[phase] ?? [];

  const reasons: string[] = [];

  if (!Array.isArray(matrix.rows)) reasons.push('RTM 结构错误：rows 字段缺失或非数组');
  if (!matrix.executionSummary || typeof matrix.executionSummary !== 'object') {
    reasons.push('RTM 结构错误：executionSummary 字段缺失或非对象');
  }
  if (reasons.length > 0) return failureResult(reasons);

  // phase=1/2/3/4 且提供 specDir 时做规格/设计结构校验
  // （置于 RTM 早退检查后：RTM 结构损坏时直接失败，不叠加 spec 校验；spec 违反仅进 reasons，不影响覆盖率计算）
  let specStructureViolations: RequirementSpecStructureViolations | undefined;
  if ((phase === 1 || phase === 2 || phase === 3 || phase === 4) && options?.specDir) {
    specStructureViolations = checkPhaseSpecStructure(phase, options.specDir, nodeFsAdapter);
    for (const m of [
      ...specStructureViolations.refs,
      ...specStructureViolations.ssot,
      ...specStructureViolations.dod,
    ]) {
      reasons.push(m);
    }
  }

  const requiredTestTypes: Array<{ key: keyof RTMMatrixShape['executionSummary']; name: string; layer: string }> = [
    { key: 'unitTest', name: '单元测试', layer: 'unitTest' },
    { key: 'integrationTest', name: '集成测试', layer: 'integrationTest' },
    { key: 'systemTest', name: '系统测试', layer: 'systemTest' },
    { key: 'acceptanceTest', name: '验收测试', layer: 'acceptanceTest' },
  ];
  const summaries: Array<{ name: string; layer: string; summary: TestSummaryShape | undefined }> = [];

  for (const { key, name, layer } of requiredTestTypes) {
    const summary = matrix.executionSummary[key];
    if (!summary || typeof summary !== 'object') {
      // 仅当该层属于当前阶段校验范围时才报结构错误（未到的层允许缺失）
      if (phaseLayers.includes(layer)) {
        reasons.push(`RTM 结构错误：executionSummary.${key}（${name}汇总）缺失或非对象`);
      }
    }
    summaries.push({ name, layer, summary });
  }

  const missingItems: Array<{ requirementId: string; fields: string[] }> = [];
  const ids = new Set<string>();
  for (let index = 0; index < matrix.rows.length; index++) {
    const row = matrix.rows[index];
    if (!row || typeof row !== 'object') {
      reasons.push(`RTM 结构错误：rows[${index}] 非对象`);
      continue;
    }
    if (typeof row.requirementId !== 'string' || row.requirementId.trim() === '') {
      reasons.push(`RTM 结构错误：rows[${index}].requirementId 必须为非空字符串`);
      continue;
    }
    if (ids.has(row.requirementId)) {
      reasons.push(`RTM 结构错误：需求 ID 重复（${row.requirementId}）`);
    }
    ids.add(row.requirementId);
    // P1.2 横切治理：NFR/CON 行只校验 designDoc（phase<5）或 designDoc+codeModule（phase>=5），
    // 不强制要求 test 字段（横切测试通过 REQ 行的测试用例覆盖）
    const isCrossCutting = row.requirementId.startsWith('NFR') || row.requirementId.startsWith('CON');
    const fieldsToCheck = isCrossCutting
      ? phase >= 5
        ? (['description', 'designDoc', 'codeModule'] as const)
        : (['description', 'designDoc'] as const)
      : phaseFields;
    const missing = fieldsToCheck.filter(
      (field) => typeof row[field] !== 'string' || (row[field] as string).trim() === '',
    );
    if (missing.length > 0) missingItems.push({ requirementId: row.requirementId, fields: missing });
  }

  for (const item of missingItems) {
    reasons.push(`RTM 追溯不完整：${item.requirementId} 缺少 ${item.fields.join('、')}`);
  }

  const totalRows = matrix.rows.length;
  const coveredRows = totalRows - missingItems.length;
  let coveragePercent = totalRows > 0 ? Math.round((coveredRows / totalRows) * 100) : 0;
  // coveragePercent 与 missingItems 联动（约束 #3）：存在追溯缺失项时覆盖率强制 < 100，
  // 防止 (total-1)/total 舍入边界（如 199/200=99.5→100）掩盖缺失
  if (missingItems.length > 0 && coveragePercent >= 100) coveragePercent = 99;
  if (coveragePercent < 100) reasons.push(`RTM 覆盖率未达 100%（当前 ${coveragePercent}%）`);
  if (totalRows === 0) reasons.push('RTM 无需求行');

  // ==================== coverageStatus 字段一致性校验（P0，行级） ====================
  // 约束 #3：coverageStatus 须与该行自身完整性一致，不再与矩阵全局 coveragePercent 比较
  //   "100%" → 该行所需 RTM 字段齐全；"部分" → 该行存在追溯缺失；"待覆盖" → 违反
  //   （"完整" 等历史兼容值与非标准值不参与一致性判定，由 missingItems 覆盖检查兜底）
  const missingReqIds = new Set(missingItems.map((item) => item.requirementId));
  const missingFieldsByReqId = new Map<string, string[]>(missingItems.map((item) => [item.requirementId, item.fields]));
  for (const row of matrix.rows) {
    if (!row || typeof row.coverageStatus !== 'string') continue;
    const status = row.coverageStatus.trim();
    if (status === '待覆盖') {
      reasons.push(`RTM coverageStatus="待覆盖" 不允许（须回退重做，约束 #3）`);
      continue;
    }
    const rowComplete = !missingReqIds.has(row.requirementId);
    if (status === '100%' && !rowComplete) {
      const fields = missingFieldsByReqId.get(row.requirementId) ?? [];
      reasons.push(
        `RTM coverageStatus="100%" 但该行追溯不完整（缺少 ${fields.join('、')}），coverageStatus 与行级完整性不一致`,
      );
    } else if (status === '部分' && rowComplete) {
      reasons.push(`RTM coverageStatus="部分" 但该行追溯完整，coverageStatus 与行级完整性不一致`);
    }
  }

  // ==================== NFR 双值字段校验（P2） ====================
  // 问题 4：性能基线须区分生产目标值与测试环境基线
  // 仅对 NFR 类型行校验（requirementId 以 NFR 开头）；非 NFR 行跳过
  // 双字段都缺失才 fail，单字段缺失不 fail
  for (const row of matrix.rows) {
    if (!row || typeof row.requirementId !== 'string') continue;
    if (!row.requirementId.startsWith('NFR')) continue;
    const hasTarget = 'targetValue' in row && typeof row.targetValue === 'string' && row.targetValue.trim() !== '';
    const hasThreshold =
      'testThreshold' in row && typeof row.testThreshold === 'string' && row.testThreshold.trim() !== '';
    if (!hasTarget && !hasThreshold) {
      reasons.push(
        `NFR 行 ${row.requirementId} 缺 targetValue 与 testThreshold 双字段（性能基线须区分生产目标值与测试环境基线）`,
      );
    }
  }

  let unitCoveragePercent = 0;
  for (const { name, layer, summary } of summaries) {
    // P1.1 阶段分层：未到的测试层跳过 pending/failed 校验（pending 合理）
    if (!phaseLayers.includes(layer)) continue;
    if (!summary || typeof summary !== 'object') continue;
    const values = [summary.total, summary.passed, summary.failed, summary.pending];
    if (!values.every(isFiniteNonNegativeInteger)) {
      reasons.push(`${name}: total/passed/failed/pending 必须为非负整数`);
      continue;
    }
    if (summary.passed + summary.failed + summary.pending !== summary.total) {
      reasons.push(`${name}: passed + failed + pending 必须等于 total`);
    }
    if (summary.total === 0) reasons.push(`${name}: 无用例`);
    if (summary.failed > 0) reasons.push(`${name}: ${summary.failed} 个失败`);
    if (summary.pending > 0) reasons.push(`${name}: ${summary.pending} 个待执行`);
    if (
      typeof summary.coverage !== 'number' ||
      !Number.isFinite(summary.coverage) ||
      summary.coverage < 0 ||
      summary.coverage > 100
    ) {
      reasons.push(`${name}: coverage 必须为 [0,100] 范围内的有限数字`);
    }
    if (name === '单元测试' && typeof summary.coverage === 'number' && Number.isFinite(summary.coverage)) {
      unitCoveragePercent = summary.coverage;
      if (summary.coverage < 80) reasons.push(`单元测试代码覆盖率未达 80%（当前 ${summary.coverage}%）`);
    }
  }

  // ==================== M07 测试证据绑定（E1-E4 + cutoff 吸收） ====================
  // D-2 批准单元（2026-09-15）：阶段范围内 total>0 的测试层必须把摘要数字绑定到真实运行
  // （command + exitCode + observedAt，可选 rawOutputPath + rawOutputSha256）。四条规则：
  //   E1 配对：rawOutputPath 与 rawOutputSha256 要么都无、要么都有。
  //   E2 哈希核验（二者齐备）：以项目根解析（禁越出根）、文件须存在、sha256 须相符。
  //   E3 结果一致性：failed=0&&pending=0 ⇒ exitCode=0；failed>0 ⇒ exitCode≥1；
  //      failed=0&&pending>0 不约束（部分执行两种退出码都合理，如实不编码）。
  //   E4 存在性 + cutoff：lastUpdated ≥ M07_TEST_EVIDENCE_CUTOFF（或缺失/不可解析，保守不吸收）
  //      时，阶段范围内（PHASE_TEST_LAYERS）total>0 的层缺 evidence → 违规；早于 cutoff →
  //      非阻断 LEGACY_TEST_EVIDENCE 诊断（结构照 run-log LEGACY_REVERT_EVIDENCE 先例）。
  const testEvidenceCounts: ArtifactGateTestEvidenceSummary = {
    checked: 0,
    withEvidence: 0,
    missing: 0,
    legacy: 0,
    e1: 0,
    e2: 0,
    e3: 0,
    e4: 0,
  };
  const legacyDiagnostics: string[] = [];
  const cutoffMs = Date.parse(M07_TEST_EVIDENCE_CUTOFF);
  // 仅当 lastUpdated 可解析且严格早于 cutoff 才吸收；缺失/不可解析一律按 cutoff 后处理
  // （保守不吸收，与 run-log R10 timestamp 方向一致）。
  const legacyTimestamp =
    typeof matrix.lastUpdated === 'string' &&
    Number.isFinite(Date.parse(matrix.lastUpdated)) &&
    Date.parse(matrix.lastUpdated) < cutoffMs;
  const evidenceProjectRoot = options?.projectRoot;
  for (const { name, layer, summary } of summaries) {
    if (!summary || typeof summary !== 'object') continue;
    const evidence = summary.evidence;
    const hasEvidence = evidence !== null && typeof evidence === 'object';
    const countsValid = [summary.total, summary.passed, summary.failed, summary.pending].every(
      isFiniteNonNegativeInteger,
    );
    // ---- E4 存在性 + cutoff（阶段范围内、total>0 的层）----
    if (phaseLayers.includes(layer) && isFiniteNonNegativeInteger(summary.total) && summary.total > 0) {
      testEvidenceCounts.checked++;
      if (hasEvidence) {
        testEvidenceCounts.withEvidence++;
      } else if (legacyTimestamp) {
        testEvidenceCounts.legacy++;
        legacyDiagnostics.push(
          `LEGACY_TEST_EVIDENCE: ${name} total=${summary.total}>0 缺 evidence，但 lastUpdated=${matrix.lastUpdated} 早于 ${M07_TEST_EVIDENCE_CUTOFF}（M07/D-2 生效前旧 RTM）; deferred`,
        );
      } else {
        testEvidenceCounts.missing++;
        testEvidenceCounts.e4++;
        reasons.push(
          `RTM 测试证据 E4: ${name} total=${summary.total}>0 但缺 evidence（lastUpdated ${typeof matrix.lastUpdated === 'string' ? `=${matrix.lastUpdated}` : '缺失或不可解析'}，M07/D-2 生效后必须绑定真实运行证据 command/exitCode/observedAt）`,
        );
      }
    }
    // E1-E3 仅在有 evidence 时强制（与阶段是否到该层无关：证据只要出现就必须自洽）
    if (!hasEvidence) continue;
    const ev = evidence as TestEvidenceShape;
    const rawOutputPath = typeof ev.rawOutputPath === 'string' ? ev.rawOutputPath.trim() : '';
    const rawOutputSha256 = typeof ev.rawOutputSha256 === 'string' ? ev.rawOutputSha256.trim() : '';
    const hasPath = rawOutputPath !== '';
    const hasSha = rawOutputSha256 !== '';
    // ---- E1 配对 ----
    if (hasPath !== hasSha) {
      testEvidenceCounts.e1++;
      reasons.push(
        `RTM 测试证据 E1: ${name} evidence.rawOutputPath 与 evidence.rawOutputSha256 必须成对出现（当前只有 ${hasPath ? 'rawOutputPath' : 'rawOutputSha256'}）`,
      );
    }
    // ---- E2 哈希核验（其余二者齐备）----
    if (hasPath && hasSha) {
      if (typeof evidenceProjectRoot !== 'string' || evidenceProjectRoot.trim() === '') {
        testEvidenceCounts.e2++;
        reasons.push(`RTM 测试证据 E2: ${name} 无法核验 evidence.rawOutputPath（未提供项目根，fail-closed）`);
      } else {
        const resolved = resolveTestEvidenceOutputPath(evidenceProjectRoot, rawOutputPath);
        if (!resolved.ok) {
          testEvidenceCounts.e2++;
          reasons.push(
            `RTM 测试证据 E2: ${name} evidence.rawOutputPath 非法（${resolved.reason}；须相对项目根且不得越出根）`,
          );
        } else {
          const actual = sha256OfFile(resolved.absPath);
          if (actual === undefined) {
            testEvidenceCounts.e2++;
            reasons.push(
              `RTM 测试证据 E2: ${name} evidence.rawOutputPath 指向的原始输出文件不存在或不可读（${rawOutputPath}）`,
            );
          } else if (actual !== rawOutputSha256.toLowerCase()) {
            testEvidenceCounts.e2++;
            reasons.push(
              `RTM 测试证据 E2: ${name} evidence.rawOutputSha256 与文件实际 SHA-256 不符（声明 ${rawOutputSha256.toLowerCase()}，实际 ${actual}）`,
            );
          }
        }
      }
    }
    // ---- E3 结果一致性 ----
    if (countsValid && isFiniteNonNegativeInteger(ev.exitCode)) {
      if (summary.failed === 0 && summary.pending === 0 && ev.exitCode !== 0) {
        testEvidenceCounts.e3++;
        reasons.push(`RTM 测试证据 E3: ${name} failed=0/pending=0（全绿）但 evidence.exitCode=${ev.exitCode}，须为 0`);
      } else if (summary.failed > 0 && ev.exitCode === 0) {
        testEvidenceCounts.e3++;
        reasons.push(
          `RTM 测试证据 E3: ${name} 记录 failed=${summary.failed} 但 evidence.exitCode=0（有失败必须来自非零退出码）`,
        );
      }
    }
  }

  // ==================== TLA+ 资产校验（spec §3.4.4，追加项） ====================
  // 1. TLA+ 资产存在性：manifestExists 显式为 false 时追加违反（未传时跳过，保持向后兼容）
  if (options && options.manifestExists === false) {
    reasons.push('TLA+ 资产校验失败：tla-manifest.json 不存在或 specs 为空');
  }
  // 2. SD→codeModule 映射：graph 提供时执行（仅 phase >= 5 时校验，因为 codeModule 在 phase 5 才进入 RTM 追溯字段）
  if (options && options.graph && phase >= 5) {
    const sdViolations = checkSdToCodeModuleMapping(options.graph, matrix.rows);
    for (const v of sdViolations) reasons.push(v);
  }

  // ==================== codeModule 格式校验（P0-2，仅 phase >= 5） ====================
  if (phase >= 5) {
    const formatViolations = checkCodeModuleFormat(matrix.rows);
    for (const v of formatViolations) reasons.push(v);
  }

  // ==================== S18 票据内容校验（给定票据文本时） ====================
  // 参数契约（计划 §0.1.4）：`--tickets` 缺省时**不触发**（既有调用方零影响）；
  // phase<5 给定 `--tickets`、以及文件不存在，均由 CLI 层在调用前判定为 exit 2，纯函数不读盘。
  let tickets: TicketContentSummary | undefined;
  if (typeof options?.ticketsText === 'string') {
    const ticketResult = checkTicketContent(options.ticketsText);
    for (const v of ticketResult.violations) reasons.push(v);
    tickets = ticketResult.summary;
  }

  return {
    passed: reasons.length === 0,
    reasons,
    coveragePercent,
    missingItems,
    unitCoveragePercent,
    ...(legacyDiagnostics.length > 0 ? { legacy: legacyDiagnostics } : {}),
    testEvidence: testEvidenceCounts,
    ...(tickets !== undefined ? { tickets } : {}),
  };
}
