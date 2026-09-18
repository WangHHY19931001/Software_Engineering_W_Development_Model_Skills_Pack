// w-model-dev/scripts/__tests__/helpers/strip-rule.ts
/**
 * 通用规则剥离器（O）：对 w-model-dev/scripts/logic/<rel> 的源码文本，
 * 按「唯一锚点 → 语句块整块删除（大括号配平扫描）」产出剥离副本到 os.tmpdir()，
 * 并把副本的静态相对 import 说明符重写为指向原目录的绝对 file:// URL（tmpdir 副本否则断链；
 * 说明符以 .js 结尾时优先解析为同名 .ts——仓内 NodeNext 惯例）。
 *
 * ## 锚点契约（anchor contract，消费方必读）
 *
 * 前置条件：锚点必须**从 `//` 行注释起始（含 `//`，trim 后整行）或从某个代码字符起始**；
 * 锚点内部的字符串/注释内容不参与结构判定，锚点落在字面量或注释中间属契约误用（见下方反例）。
 * 另：源码多为 CRLF 行长，锚点一律取**单行**文本（跨行锚的换行字节不可移植）。
 *
 * 锚点 = **紧邻待剥块之前**的唯一子串；锚点之后第一个「有效 `{`」即待剥块的起始。识别规则：
 *
 *   1. 注释 / 单双引号字符串 / 模板字面量（含 `${…}` 插值）/ 正则字面量内部的字符**不参与**结构判定；
 *      注释或字面量未闭合 → 抛错（不猜边界）。正则字面量判据用「上一个**代码**字符」（跳过注释与字面量
 *      后维护），故 `…], // 注释` 换行后的 `/re/` 不会被误判为除法。
 *   2. 「有效 `{`」= 锚点之后第一个**圆括号 `()` 与方括号 `[]` 深度均为 0** 的 `{`。因此形参里的
 *      对象类型 / 解构（`options?: { … }`）、数组里的对象字面量都不会被误认成块起始。
 *   3. 候选 `{…}` 组配平后看组尾（同行续接判据）：
 *      - 组尾紧跟 `{`（跨行也算）或同行续接记号 `| & > < = : , [` → 该候选是**类型字面量 / 表达式片段**，
 *        继续向后找下一个候选（例：`: { ok: boolean } { … }`、`: { count: number }[] { … }`、
 *        `Array<{ a: 1 }> { … }`、`Map<{ a: 1 }, string> { … }`）；
 *      - 组尾同行紧跟类型断言 `as <T>` / `satisfies <T>` → 断言并入被剥区域（`export const T = { … } as const;`
 *        整条声明被剥，终止符 `;` 留给剩余文本）；断言未在同行终止（ASI 换行）→ 抛错；
 *      - 组尾为文件结束 / 换行 / 同行 `;` `)` `]` `}` → 该组即块，返回组尾；
 *      - 组尾同行出现其它记号（如 `} else {`、`} catch {` 的标识符）→ 抛错（无法无歧义地确定块尾）。
 *   4. 剥离后对**剩余文本**复扫一遍括号深度：出现负深度或最终不归零 → 抛错。这是「块定位错误」的
 *      **部分**兜底（v1 的参数类型误剥会留下悬空 `, ): T { … }`，在此被拦下）。注意其能力边界：
 *      它只拦**括号失衡**形态，已知拦不住两类「平衡但语义错割」——① `}` / `else` **分行**形态
 *      （剥离 if 块后残留下一行 `else { … }`，剩余文本括号仍平衡；`logic/` 实测 0 例）；
 *      ② 多声明符 `as const,` 形态（`consumeTypeAssertion` 越过 0 层 `,` 继续吞到 `;`，
 *      过度删除但括号平衡；`logic/` 实测 0 例）。此类形态语法上大多非法、import 时会暴露，
 *      但本助手无法在产出副本前判定——调用方仍须按契约选锚（紧邻、代码字符起始）。
 *
 * 正例 / 反例：
 *
 *   ✓ `stripRuleToCopyUrl('budget-logic.ts', 'export function checkBudget(')`
 *      —— 形参含对象类型 `{`（`options?: { projectUpdatedAt?: string; … }`），有效 `{` 落在 `)` 之后 → 函数体整块剥离。
 *   ✓ `stripRuleToCopyUrl('budget-logic.ts', '// R1 时效性：…')`
 *      —— 注释锚，块 = 紧随其后的 `if (…) { … }`；剔除后函数保留，仅该规则失效。
 *   ✗ v1 失效形态（旧实现被修正的正是此形态）：旧实现取「锚点后第一个 `{`」而不看括号深度，
 *      对同一锚点 `export function checkBudget(` 命中的是**形参类型**里的 `{`，只删掉签名头 + 形参类型声明，
 *      副本留下悬空 `, ): BudgetCheckResult { … }`，直到 import 时才以 esbuild 语法错误暴露。
 *      v2 由规则 2 排除该 `{`、由规则 4 兜底拦错。
 *   ✗ 契约误用：锚点落在**某个已闭合的 `()` / `[]` 组内部**（如把违规文案字面量当锚点），
 *      剥离必然截断调用表达式 → 由规则 4 的负深度拦下；锚点位于块内部而指向**后续块**时，剩余文本的括号
 *      通常随之失衡（同被规则 4 拦下），但若恰好仍平衡则属语义错位（语法合法）——本助手无从判定，
 *      调用方须保证锚点**紧邻**待剥块。
 *   ✗ 契约误用：锚点位于**部分声明**中间（如 `// …\n const x = ` 而非声明头），剥离会截断该声明。
 *      规则 4 只能识别括号失衡形态，此类错位需调用方按契约选锚。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LOGIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logic');

/** 失败即抛错（fail-loud）：块边界不确定时宁可失败，也不产出坏副本。 */
function stripFail(message: string): never {
  throw new Error(`strip 失败：${message}`);
}

function requireUniqueAnchor(source: string, anchor: string): number {
  const first = source.indexOf(anchor);
  if (first < 0) throw new Error(`strip 定位失败：锚点未命中 → ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + 1) >= 0) throw new Error(`strip 定位失败：锚点不唯一 → ${JSON.stringify(anchor)}`);
  return first;
}

/**
 * 扫描状态：`lastCode` 记录上一个**代码字符**（跳过空白、注释整体、字面量整体）。
 * 注释不改变 `lastCode`（注释不产生值）；字符串 / 模板 / 正则字面量把它置为「值哨兵」`LITERAL_SENTINEL`，
 * 使紧随其后的 `/` 判为除法而非正则。
 */
interface ScanState {
  lastCode: string;
}

/** 值哨兵：字面量整体被跳过后 `lastCode` 的取值（`)` 不在正则前缀字符集内 → 后续 `/` 判为除法） */
const LITERAL_SENTINEL = ')';

/** 可开启正则字面量的前一代码字符 */
const REGEX_PREFIX_CHARS = '([{,;:=!&|?+-*<>';

/** 组尾同行的「类型续接记号」：说明候选组是类型 / 表达式片段，真正的块在其后（`[` 见 `: {…}[] {`） */
const TYPE_CONTINUATION_CHARS = '|&><=:,[';

/** 组尾同行的「声明终止记号」：候选组即块（`;` 见 `() => {…};`） */
const DECLARATION_END_CHARS = ';)]}';

/** 组尾同行紧跟的类型断言关键字：连同断言一起并入被剥区域（`… } as const;` 形态） */
const TYPE_ASSERTION_KEYWORDS = ['as', 'satisfies'];

/** `index` 处的 `/` 是否开启正则字面量（依据上一代码字符 + `return /re/` 前瞻） */
function startsRegexLiteral(lastCode: string, source: string, index: number): boolean {
  if (lastCode === '') return true; // 文件/锚点起点
  if (REGEX_PREFIX_CHARS.includes(lastCode)) return true;
  return /\breturn\s*$/.test(source.slice(Math.max(0, index - 12), index));
}

/** 跳过单双引号字符串（单行），返回闭合引号之后的下标；未闭合 → 抛错。 */
function skipQuotedLiteral(source: string, from: number, quote: string): number {
  let i = from + 1;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n') break; // 字符串字面量不得跨裸换行 → 视为未闭合
    i += 1;
  }
  return stripFail(`字符串字面量未闭合（下标 ${from}）——无法确定块边界`);
}

/** 从 `${` 之后起跳过插值表达式，返回其匹配 `}` 之后的下标；未闭合 → 抛错。 */
function skipInterpolation(source: string, from: number, state: ScanState): number {
  // `${` 已被消费，故起始深度为 1（等待与它配对的 `}`）
  let depth = 1;
  let i = from;
  while (i < source.length) {
    const { next, ch } = step(source, i, state);
    if (ch === null) {
      i = next;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i = next;
  }
  return stripFail('模板插值 ${…} 未闭合——无法确定块边界');
}

/** 跳过模板字面量（含 `${…}` 插值嵌套），返回闭合反引号之后的下标；未闭合 → 抛错。 */
function skipTemplateLiteral(source: string, from: number, state: ScanState): number {
  let i = from + 1;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') return i + 1;
    if (ch === '$' && source.charAt(i + 1) === '{') {
      i = skipInterpolation(source, i + 2, state);
      continue;
    }
    i += 1;
  }
  return stripFail(`模板字面量未闭合（下标 ${from}）——无法确定块边界`);
}

/** 跳过正则字面量（字符类内 `/` 不结束；跨裸换行视为未闭合），返回其后下标；未闭合 → 抛错。 */
function skipRegexLiteral(source: string, from: number): number {
  let i = from + 1;
  let inClass = false;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '\n') break;
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
    i += 1;
  }
  return stripFail(`正则字面量未闭合（下标 ${from}）——无法确定块边界`);
}

/**
 * `i` 处若为注释 / 字符串 / 模板 / 正则字面量起始 → 返回其**之后**的下标（整段跳过，并更新
 * `state.lastCode`：注释保持、字面量置值哨兵）；否则返回 -1（该处按普通代码字符处理）。
 * 未闭合一律抛错。
 */
function skipLiteralOrComment(source: string, i: number, state: ScanState): number {
  const ch = source.charAt(i);
  const next = source.charAt(i + 1);
  if (ch === '/' && next === '/') {
    const nl = source.indexOf('\n', i);
    return nl === -1 ? source.length : nl + 1;
  }
  if (ch === '/' && next === '*') {
    const close = source.indexOf('*/', i + 2);
    if (close === -1) return stripFail(`块注释未闭合（下标 ${i}）——无法确定块边界`);
    return close + 2;
  }
  if (ch === "'" || ch === '"') {
    const after = skipQuotedLiteral(source, i, ch);
    state.lastCode = LITERAL_SENTINEL;
    return after;
  }
  if (ch === '`') {
    const after = skipTemplateLiteral(source, i, state);
    state.lastCode = LITERAL_SENTINEL;
    return after;
  }
  if (ch === '/' && startsRegexLiteral(state.lastCode, source, i)) {
    const after = skipRegexLiteral(source, i);
    state.lastCode = LITERAL_SENTINEL;
    return after;
  }
  return -1;
}

/** 空白字符不更新 `lastCode`（它们不是代码字符） */
function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

/**
 * 前进一格（所有结构扫描循环共用的唯一推进原语，避免各循环各自维护 `lastCode` 时口径漂移）：
 * - `i` 处是注释 / 字符串 / 模板 / 正则字面量起始 → `ch = null`，`next` = 该段之后的下标；
 * - 否则 `ch` = 该处字符（空白也算，但空白不更新 `state.lastCode`），`next = i + 1`。
 * 未闭合的字面量 / 注释在 `skipLiteralOrComment` 内抛错。
 */
function step(source: string, i: number, state: ScanState): { next: number; ch: string | null } {
  const skipped = skipLiteralOrComment(source, i, state);
  if (skipped !== -1) return { next: skipped, ch: null };
  const ch = source.charAt(i);
  if (!isWhitespace(ch)) state.lastCode = ch;
  return { next: i + 1, ch };
}

/** 返回 `from` 起第一个**代码字符**下标（跳过空白 / 注释 / 字符串 / 模板 / 正则），无则 -1。 */
function nextCodeIndex(source: string, from: number, state: ScanState): number {
  let i = from;
  while (i < source.length) {
    const { next, ch } = step(source, i, state);
    if (ch === null || isWhitespace(ch)) {
      i = next;
      continue;
    }
    return i;
  }
  return -1;
}

/**
 * 阶段 1：锚点后第一个「有效 `{`」（圆括号与方括号深度均为 0）的下标。抛错条件：
 * 深度转负（锚点落在已闭合的 `()` / `[]` 组内部）、顶层 `;` 先于 `{`（锚点所在声明无 `{…}` 块）、
 * 顶层 `=` 之后的 `[`（初始化器是数组字面量，块不是 `{…}` 组）、扫描到 EOF。
 */
function findCandidateOpen(source: string, from: number, state: ScanState): number {
  let paren = 0;
  let bracket = 0;
  let sawTopLevelAssign = false;
  let i = from;
  while (i < source.length) {
    const { next, ch } = step(source, i, state);
    if (ch === null) {
      i = next;
      continue;
    }
    if (ch === '(') paren += 1;
    else if (ch === ')') {
      paren -= 1;
      if (paren < 0) return stripFail(`锚点后出现多余的 ')'（下标 ${i}）——锚点似落在已闭合的 '(' 组内部`);
    } else if (ch === '[') {
      if (paren === 0 && bracket === 0 && sawTopLevelAssign) {
        return stripFail('锚点后的顶层平衡组是 `[…]`（数组字面量）——块须为 `{…}` 组，无法定位其边界');
      }
      bracket += 1;
    } else if (ch === ']') {
      bracket -= 1;
      if (bracket < 0) return stripFail(`锚点后出现多余的 ']'（下标 ${i}）——锚点似落在已闭合的 '[' 组内部`);
    } else if (ch === ';' && paren === 0 && bracket === 0) {
      return stripFail('锚点所在声明在出现 `{` 之前已结束（顶层 `;`）——该锚点后没有可剥的 `{…}` 块');
    } else if (ch === '=' && paren === 0 && bracket === 0) {
      sawTopLevelAssign = true;
    } else if (ch === '{' && paren === 0 && bracket === 0) {
      return i;
    }
    i = next;
  }
  return stripFail('锚点后未找到块起始 `{`（锚点契约：锚点须紧邻待剥块之前）');
}

/** 阶段 2：自 `{` 起配平（字面量 / 注释整体跳过），返回闭合 `}` 之后的下标；未配平 → 抛错。 */
function matchBraceGroup(source: string, open: number, state: ScanState): number {
  let depth = 0;
  let i = open;
  while (i < source.length) {
    const { next, ch } = step(source, i, state);
    if (ch === null) {
      i = next;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i = next;
  }
  return stripFail('大括号不配平（块扫描到 EOF）');
}

/** 读取 `i` 处的标识符（`[A-Za-z_$]` 起头的连续段），用于识别 `as` / `satisfies` / `else` 等关键字。 */
function readIdentifier(source: string, i: number): string {
  let j = i;
  while (j < source.length && /[A-Za-z_$]/.test(source.charAt(j))) j += 1;
  return source.slice(i, j);
}

/**
 * 组尾同行紧跟类型断言（`as <T>` / `satisfies <T>`）→ 连同该断言并入被剥区域：
 * 返回断言所在语句终止符下标（`;` / `)` / `]` / `}`，终止符本身留给剩余文本）。
 * 同行找不到终止符（含 ASI 换行形态）或断言括号不平衡 → 抛错，绝不越行吞噬后续语句。
 */
function consumeTypeAssertion(source: string, from: number, keyword: string, state: ScanState): number {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let i = from;
  while (i < source.length) {
    const { next, ch } = step(source, i, state);
    if (ch === null) {
      i = next;
      continue;
    }
    if (ch === '\n') {
      return stripFail(`类型断言 \`${keyword}\` 未在同行终止（ASI 换行形态）——无法确定块尾`);
    }
    if (ch === '(') paren += 1;
    else if (ch === ')') {
      if (paren === 0) return i;
      paren -= 1;
    } else if (ch === '[') bracket += 1;
    else if (ch === ']') {
      if (bracket === 0) return i;
      bracket -= 1;
    } else if (ch === '{') brace += 1;
    else if (ch === '}') {
      if (brace === 0) return i;
      brace -= 1;
    } else if (ch === ';' && paren === 0 && bracket === 0 && brace === 0) return i;
    i = next;
  }
  return stripFail(`类型断言 \`${keyword}\` 未终止（扫描到 EOF）——无法确定块尾`);
}

/**
 * 定位锚点之后的待剥块：候选定位（阶段 1）+ 配平（阶段 2）+ 组尾续接判据（契约规则 3）。
 * 组尾表明候选是类型 / 表达式片段时继续向后找下一个候选；无法无歧义判定 → 抛错。
 */
function findBlockEnd(source: string, anchorStart: number): number {
  const state: ScanState = { lastCode: '' };
  let cursor = anchorStart;
  for (;;) {
    const open = findCandidateOpen(source, cursor, state);
    const end = matchBraceGroup(source, open, state);
    const next = nextCodeIndex(source, end, state);
    if (next === -1) return end; // 文件结束 → 声明到头
    const ch = source.charAt(next);
    if (ch === '{') {
      cursor = next; // 组后紧跟另一个 `{`：前一组是类型字面量 / 表达式片段
      continue;
    }
    const sameLine = !source.slice(end, next).includes('\n');
    if (!sameLine || DECLARATION_END_CHARS.includes(ch)) return end; // 声明就此结束 → 块尾
    if (TYPE_CONTINUATION_CHARS.includes(ch)) {
      cursor = next; // 类型续接（`|` `&` `=>` `>` `<` `=` `:` `,`）→ 继续找下一个候选
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const word = readIdentifier(source, next);
      if (TYPE_ASSERTION_KEYWORDS.includes(word)) return consumeTypeAssertion(source, next, word, state);
      return stripFail(
        `候选块闭合后同行紧跟标识符 ${JSON.stringify(word)}（下标 ${next}）——无法无歧义地确定块尾` +
          '（如 `else` / `catch` 分支，请改用紧邻块体的锚点）',
      );
    }
    return stripFail(`候选块闭合后同行出现记号 ${JSON.stringify(ch)}（下标 ${next}）——无法无歧义地确定块尾`);
  }
}

/**
 * 契约规则 4：剩余文本的括号深度必须永不为负且最终归零，否则块定位必错（不产出坏副本）。
 */
function assertResidueBalanced(residue: string): void {
  const state: ScanState = { lastCode: '' };
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let i = 0;
  while (i < residue.length) {
    const { next, ch } = step(residue, i, state);
    if (ch === null) {
      i = next;
      continue;
    }
    if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;
    else if (ch === '[') bracket += 1;
    else if (ch === ']') bracket -= 1;
    else if (ch === '{') brace += 1;
    else if (ch === '}') brace -= 1;
    if (paren < 0 || bracket < 0 || brace < 0) {
      return stripFail(`剥离后剩余文本出现负深度（下标 ${i}，字符 ${JSON.stringify(ch)}）——块定位错误，拒绝产出坏副本`);
    }
    i = next;
  }
  if (paren !== 0 || bracket !== 0 || brace !== 0) {
    return stripFail(`剥离后剩余文本括号不配平（()=${paren} []=${bracket} {}=${brace}）——块定位错误，拒绝产出坏副本`);
  }
}

function rewriteRelativeImports(source: string, originalFile: string): string {
  const fromRe = /^(\s*(?:import|export)\b[^'"]*?from\s*['"])([^'"]+)(['"])/gm;
  const sideEffectRe = /^(\s*import\s*['"])([^'"]+)(['"])/gm;
  const rewrite = (whole: string, head: string, spec: string, tail: string): string => {
    if (!spec.startsWith('.')) return whole;
    const abs = path.resolve(path.dirname(originalFile), spec);
    const asTs = abs.endsWith('.js') ? abs.slice(0, -3) + '.ts' : abs;
    let target = abs;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- asTs 由本 helper 自身位置 + 源内静态相对说明符拼出，仅做存在性探测（测试辅助，非生产路径）
      readFileSync(asTs); // 仅探测存在性
      target = asTs;
    } catch {
      /* 保留 .js 解析 */
    }
    return head + pathToFileURL(target).href + tail;
  };
  return source.replace(fromRe, rewrite).replace(sideEffectRe, rewrite);
}

/** 返回剥离副本的 file:// URL（供动态 import）；副本随 os.tmpdir() 生命周期清理。 */
export function stripRuleToCopyUrl(relLogicPath: string, anchor: string): string {
  const originalFile = path.join(LOGIC_DIR, relLogicPath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 路径由本 helper 自身位置拼装，指向本技能包 logic 源
  const source = readFileSync(originalFile, 'utf8');
  const anchorStart = requireUniqueAnchor(source, anchor);
  const end = findBlockEnd(source, anchorStart);
  const stripped = (source.slice(0, anchorStart) + source.slice(end)).trimStart();
  assertResidueBalanced(stripped);
  const rewritten = rewriteRelativeImports(stripped, originalFile);
  const copy = path.join(
    os.tmpdir(),
    `stripped-${path.basename(relLogicPath, '.ts')}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- copy 为 os.tmpdir() 下本 helper 自建的临时剥离副本（文件名含时间戳 + 随机后缀），测试辅助产物
  writeFileSync(copy, rewritten, 'utf8');
  return pathToFileURL(copy).href;
}
