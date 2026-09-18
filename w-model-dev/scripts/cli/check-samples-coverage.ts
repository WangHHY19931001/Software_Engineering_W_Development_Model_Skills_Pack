#!/usr/bin/env tsx
/**
 * samples 覆盖矩阵门禁（Samples Coverage Checker）
 *
 * 核对 w-model-dev/scripts/samples/ 下每个 fixture（文件 / 嵌套目录）都被 self-test.ts
 * 用例数组引用（file / manifestFile / ticketsFile / auxFiles / sampleDir 字段），且每个子目录在 samples/README.md 覆盖矩阵中有声明——
 * 堵住「新增 fixture 后遗忘在 self-test.ts 登记」的缺口（未登记的 fixture 不参与任何检查，
 * self-test 基线依然全绿）。双向闭环（F-G7-06/07，audit-fixes task 6）：
 *   - 引用 → 在盘：self-test.ts 引用的 file / sampleDir 路径必须真实存在（悬空 → reference-dangling / exit 1）；
 *   - 声明 → 矩阵行：README 覆盖矩阵按表行首列解析（正文反引号提及不算声明）。
 *
 * 第 4 条规则（M06 / S28，P2-A 任务 2）：负向覆盖不变量——`cli/ 下的 *.ts` 减去 `self-test.ts` 的每个
 * exit-2 门禁必须在 samples/NEGATIVE-COVERAGE.md 登记一条会失败的负向案例（fixture / invocation /
 * mutated-copy）。门禁集合从既有事实源（cli 目录）推导，不另写硬编码清单：
 *   - 未登记 → negative-coverage-missing（exit 1）。
 *
 * 第 5 条规则（M06 / S28 强化，本轮）：登记册必须**严格且可执行**——
 *   - 语法严格：每行恰四列（门禁名 / 机制 / 证据 / 所防回归），缺列 / 空格 / 未知机制 / 未知门禁 /
 *     重复门禁 / 空证据各自产出**具名** blocking 违规（旧实现静默跳过坏行，等于把「写坏」当「写全」）；
 *   - 证据可解析：`fixture` 证据必须是项目内真实路径；`invocation` / `mutated-copy` 与 fixture 行的
 *     引用位置一律用**锚寻址** `文件#唯一子串锚`（锚在被引文件内恰出现一次；2026-09-18 任务 3.5 取代
 *     「文件:行号」——行号是位置，上方插行即整表漂移，见 validateAnchorEvidence）。
 *     旧行号语法一律判违规（不自留双语法兼容）；正文里只写一句「由某任务提供」不算证据；
 *   - fixture 行相关度（2026-09-18 修复轮补回）：锚唯一只保证「在该文件内唯一」，**不**保证「与本条
 *     fixture 相关」——故 fixture 行的锚必须落在 self-test.ts 内**登记该 fixture 的用例条目**上（条目 =
 *     `_CASES` 数组内的对象字面量；`budget` 与 `maturity` 的同名 `bad-stale.json` 分属不同条目，故可
 *     区分），且同一 `引用文件#锚` 不得被两条指向不同 fixture 的 fixture 行共用
 *     （negative-coverage-evidence-relevance / negative-coverage-evidence-shared-anchor）；
 *   - 真实 exit-2 探针：逐门禁**串行**执行 `lib/exit2-probe-registry.ts`（与 check-docs-consistency
 *     中心探针同源）中的负向调用，断言 exit code = 2、stdout 含可解析的 `ERROR_JSON`（exitCode=2 且
 *     category 属 exit-2 类别）、stderr 含同名类别的人类错误行，且隔离探针根在调用前后**逐项不变**
 *     （门禁失败不得留下半成品）。探针异常即 negative-coverage-probe-failed（exit 1）——
 *     探针不可用（tsx 无法解析）按失败处理，绝不静默跳过。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts [repo-root] [--json]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 参数：
 *   --json   机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  全部覆盖（无未登记 fixture，矩阵声明齐全，引用无悬空，负向覆盖登记齐全且探针全部 exit 2）
 *   1  存在未登记 fixture / 引用悬空（dangling）/ 矩阵声明缺失 / 负向登记册违规或探针失败（violations 列出）
 *   2  输入错误（repo-root 缺必需文件，含 samples/NEGATIVE-COVERAGE.md）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 SAMPLES_COVERAGE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve as pathResolve } from 'node:path';
import { promisify } from 'node:util';

import { exitWithError } from '../lib/cli-error.js';
import { buildExit2Probes, EXIT2_ERROR_CATEGORIES, listGateScripts } from '../lib/exit2-probe-registry.js';
import { printGateReport, printJsonReport } from '../lib/gate-report.js';
import { runMain } from '../lib/run-main.js';
import { parseJsonSafe } from '../lib/safe-json.js';

/**
 * 豁免子目录：不参与「fixture 被 self-test 引用」核对，仅要求 README 矩阵声明。
 * tla-e2e 为端到端 fixture（需 Java + tools/tla2tools.jar，SANY/TLC 全链路），
 * 手动 / CI 执行，不进 self-test 基线（见 samples/tla-e2e/README.md）。
 *
 * verifier-calibration 为 A-3f 校准集，**明确非门禁**：锚定正解由人工标注，且校准需真实跑 LLM
 * （由外部 Agent 执行），两者都不符合「确定性门禁」定义，故其样本**不得**登记进 self-test 基线
 * （登记即等于把它变成门禁）。豁免仅指「不要求 self-test 引用」；矩阵声明仍强制
 * （见该目录 README 首段与 verifier-spec.md §14.4）。
 */
const EXEMPT_DIRS = ['tla-e2e', 'verifier-calibration'];

/** samples/ 扫描时排除的目录 / 文件（运行时产物与文档；NEGATIVE-COVERAGE.md 为声明式清单，非 fixture） */
const SKIP_NAMES = new Set(['.w-model', 'states', 'README.md', 'NEGATIVE-COVERAGE.md', '.gitkeep']);

/** 负向案例机制（NEGATIVE-COVERAGE.md 第 2 列，只允许这三值） */
const NEGATIVE_MECHANISMS = new Set(['fixture', 'invocation', 'mutated-copy']);

/** 登记册表格列数（门禁脚本 / 负向机制 / 负向案例·证据位置 / 所防回归） */
const NEGATIVE_COLUMNS = 4;

/** 用例登记来源文件（rule 1 的引用事实源）：fixture 行的锚必须落在该文件的用例条目内 */
const CASE_SOURCE_REL = 'w-model-dev/scripts/cli/self-test.ts';

/** 单次 exit-2 探针的子进程超时（与中心探针同量级；超时按探针失败处理） */
const PROBE_TIMEOUT_MS = 60_000;

/** NEGATIVE-COVERAGE.md 的一行登记 */
interface NegativeEntry {
  /** 门禁基名（cli/<name>.ts 去掉 .ts） */
  name: string;
  /** 负向机制：fixture / invocation / mutated-copy */
  mechanism: string;
  /** 证据位置：fixture 为 `samples/...`（可附 `（self-test.ts#锚）` 引用）；invocation / mutated-copy 为 `文件#唯一子串锚` */
  evidence: string;
  /** 所防回归（第 4 列，必填非空） */
  regression: string;
  /** 登记行在 NEGATIVE-COVERAGE.md 内的 1-based 行号（违规定位用） */
  line: number;
}

/** 登记册解析结果：合法行 + 语法坏行（坏行不得被静默丢弃） */
interface NegativeParse {
  entries: NegativeEntry[];
  /** 语法坏行：`<描述>`（含行号），逐条转成 negative-coverage-malformed 违规 */
  malformed: string[];
}

/** 单条登记的证据校验结果 */
interface EvidenceIssue {
  code: string;
  message: string;
}

/** 一次 exit-2 探针的执行结果 */
interface ProbeOutcome {
  probeId: string;
  gate: string;
  status: number;
  /** stdout 存在可解析 ERROR_JSON 且 exitCode=2、category 属 exit-2 类别 */
  errorJsonOk: boolean;
  /** stderr 存在与 ERROR_JSON 同类别的人类错误行 */
  humanErrorOk: boolean;
  /** 探针根在调用前后逐项相等的违反描述（为空表示未新增/未删除任何条目） */
  treeDrift: string[];
  /** 失败原因（为空表示该探针通过） */
  reasons: string[];
}

/** 从 self-test.ts 提取的引用集合 */
interface ReferenceSets {
  /** 精确文件引用：`<子目录>/<file>`（来自 file: 字段 + run 函数目录配对） */
  files: Set<string>;
  /** 目录引用：sampleDir: 字段值（覆盖该路径子树） */
  dirs: Set<string>;
}

/** self-test.ts 内的一个用例条目（`_CASES` 数组内的对象字面量）及其登记的 samples/ 引用 */
interface CaseEntry {
  /** 所属用例数组名（诊断用，如 `BUDGET_CASES`） */
  array: string;
  /** 条目在 self-test.ts 源文本内的字符区间起始（含 `{`） */
  start: number;
  /** 条目在 self-test.ts 源文本内的字符区间结束（`}` 之后，不含） */
  end: number;
  /** 条目登记的 samples/ 相对引用（file / manifestFile / ticketsFile / featureFiles / auxFiles / sampleDir） */
  refs: Set<string>;
}

/**
 * 用例数组 → 子目录映射：runXxxCases 函数体（行号区间）内
 * path.join(<dirVar>, '<subdir>', <caseVar>.<field>) 与 for (const <v> of <CASES>) 配对，
 * 得到「用例数组 → file 型子目录」映射。
 * 兼容形态：三参 join（path.join(samplesDir, 'bdd', c.file)）、两参 join + 预定义目录变量
 * （const bddSamplesDir = path.join(samplesDir, 'bdd')）、循环变量非 c（for (const tc of ...)）、
 * bdd 用 manifestFile 字段。
 */
function mapCaseArraysToDirs(lines: readonly string[]): Map<string, string> {
  const runStarts: Array<{ name: string; start: number }> = [];
  lines.forEach((l, i) => {
    const m = l.match(/async function (run\w+Cases)\(/);
    if (m !== null) runStarts.push({ name: m[1]!, start: i });
  });
  const casesToDir = new Map<string, string>();
  for (let i = 0; i < runStarts.length; i++) {
    const end = i + 1 < runStarts.length ? runStarts[i + 1]!.start : lines.length;
    const block = lines.slice(runStarts[i]!.start, end).join('\n');
    const dirVarMatch = block.match(/const (\w+SamplesDir) = path\.join\(samplesDir, '([^']+)'\)/);
    const dirMatch =
      dirVarMatch !== null ? dirVarMatch[2]! : block.match(/path\.join\(samplesDir, '([^']+)', \w+\.\w+\)/)?.[1];
    if (dirMatch === undefined) continue;
    for (const m of block.matchAll(/for \(const \w+ of (\w+_CASES)\)/g)) {
      casesToDir.set(m[1]!, dirMatch);
    }
  }
  return casesToDir;
}

/** 跳过 `from` 处的引号字面量，返回闭合引号之后的下标（未闭合则返回源文本末尾） */
function skipQuotedLiteral(source: string, from: number, quote: string): number {
  let i = from + 1;
  while (i < source.length) {
    // eslint-disable-next-line security/detect-object-injection -- i 为本函数内受控字符游标（from+1 .. source.length-1），只读源码文本字符做转义判定，非外部键注入
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    // eslint-disable-next-line security/detect-object-injection -- i 为同一受控字符游标，只读源码文本字符与闭合引号比较，非外部键注入
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  return source.length;
}

/** `index` 处的 `/` 是否开启正则字面量（依据前一个有效字符；`return /re/` 形态单独放行） */
function startsRegexLiteral(source: string, index: number): boolean {
  let j = index - 1;
  // eslint-disable-next-line security/detect-object-injection -- j 为受控字符游标（index-1 向前跳过空白），只读源码文本字符，非外部键注入
  while (j >= 0 && /\s/.test(source[j]!)) j -= 1;
  if (j < 0) return true;
  // eslint-disable-next-line security/detect-object-injection -- j 同上受控游标，source[j] 只与字面量字符集比较，非外部键注入
  if ('([{,;:=!&|?+-*<>'.includes(source[j]!)) return true;
  return /\breturn\s*$/.test(source.slice(Math.max(0, index - 12), index));
}

/** 跳过 `from` 处的正则字面量，返回其后下标（未闭合 / 遇换行按普通字符处理，返回 from） */
function skipRegexLiteral(source: string, from: number): number {
  let i = from + 1;
  let inClass = false;
  while (i < source.length) {
    // eslint-disable-next-line security/detect-object-injection -- i 为本函数内受控字符游标，只读正则字面量文本（字符类状态扫描），非外部键注入
    const ch = source[i]!;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '\n') return from;
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
    i += 1;
  }
  return from;
}

/**
 * 返回 `from` 起第一个**代码字符**（不在注释 / 字符串 / 模板 / 正则字面量内）的下标，无则 -1。
 * 只服务于用例数组的结构扫描（括号配平），不追求完整 TS 语法；跳过字面量是必要的——
 * 用例里的 `expectedReasonPatterns: [/\[schema\].*level/]` 正则含 `[`/`]`，按裸字符配平会错位。
 */
function nextCodeIndex(source: string, from: number): number {
  let i = from;
  while (i < source.length) {
    // eslint-disable-next-line security/detect-object-injection -- i 为本函数内受控字符游标，只读源码文本字符做结构扫描，非外部键注入
    const ch = source[i]!;
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? source.length : close + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuotedLiteral(source, i, ch);
      continue;
    }
    if (ch === '/' && startsRegexLiteral(source, i)) {
      const next = skipRegexLiteral(source, i);
      if (next > i) {
        i = next;
        continue;
      }
    }
    return i;
  }
  return -1;
}

/** 从条目文本按 extractReferences 的同字段口径抽取 samples/ 引用，构造 CaseEntry */
function makeCaseEntry(array: string, dir: string | undefined, text: string, start: number, end: number): CaseEntry {
  const refs = new Set<string>();
  if (dir !== undefined) {
    for (const m of text.matchAll(/\b(?:file|manifestFile|ticketsFile): '([^']+)'/g)) refs.add(`${dir}/${m[1]!}`);
    for (const m of text.matchAll(/(?:featureFiles|auxFiles): \[([^\]]*)\]/g)) {
      for (const ff of m[1]!.matchAll(/'([^']+)'/g)) refs.add(`${dir}/${ff[1]!}`);
    }
  }
  for (const m of text.matchAll(/sampleDir: '([^']+)'/g)) refs.add(m[1]!);
  return { array, start, end, refs };
}

/**
 * 采集 self-test.ts 的**用例条目**（`const <NAME>_CASES: T[] = [ {...}, ... ]` 数组内的对象字面量）：
 * 每个条目给出源文本字符区间与它登记的 samples/ 引用（字段口径与 extractReferences 一致）。
 *
 * 用途（rule 5 的 fixture 行相关度判据，2026-09-18 修复轮补回）：fixture 行的锚必须落在**登记该
 * fixture 的条目**内。只断言「锚在文件内唯一」不足以拦假证据——锚指到别的 fixture 的用例条目上
 * 照样 exit 0；且同名 fixture 使「条目内含基名」这种粗判据对
 * `samples/budget/bad-stale.json` / `samples/maturity/bad-stale.json` 恒真，必须落到条目粒度才能区分。
 */
function collectCaseEntries(selfTestContent: string): CaseEntry[] {
  const lines = selfTestContent.split('\n');
  const lineOffsets: number[] = [0];
  for (let i = 0; i < selfTestContent.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i 为 for 循环受控游标（0 .. selfTestContent.length-1），只读源码文本字符，非外部键注入
    if (selfTestContent[i] === '\n') lineOffsets.push(i + 1);
  }
  const casesToDir = mapCaseArraysToDirs(lines);
  const entries: CaseEntry[] = [];
  lines.forEach((line, index) => {
    const decl = line.match(/const (\w+_CASES):/);
    if (decl === null) return;
    // eslint-disable-next-line security/detect-object-injection -- index 为 lines.forEach 的受控下标，lineOffsets 由本函数按同一文本构建（长度覆盖全部行首），非外部键注入
    const arrayBracket = selfTestContent.indexOf('= [', lineOffsets[index]!);
    if (arrayBracket === -1) return; // 声明行无数组字面量（理论上不存在）
    const dir = casesToDir.get(decl[1]!);
    let depth = 0;
    let entryStart = -1;
    for (
      let i = nextCodeIndex(selfTestContent, arrayBracket + 3);
      i !== -1;
      i = nextCodeIndex(selfTestContent, i + 1)
    ) {
      // eslint-disable-next-line security/detect-object-injection -- i 为 nextCodeIndex 返回的受控字符下标（源码文本内位置），非外部键注入
      const ch = selfTestContent[i]!;
      if (ch === '[' || ch === '{' || ch === '(') {
        depth += 1;
        if (depth === 1 && ch === '{') entryStart = i;
        continue;
      }
      if (ch !== ']' && ch !== '}' && ch !== ')') continue;
      // 数组字面量在本层闭合（`depth === 0`）→ 该用例数组扫描结束
      if (depth === 0) return;
      depth -= 1;
      if (depth === 0 && ch === '}' && entryStart !== -1) {
        entries.push(makeCaseEntry(decl[1]!, dir, selfTestContent.slice(entryStart, i + 1), entryStart, i + 1));
        entryStart = -1;
      }
    }
  });
  return entries;
}

/**
 * 条目登记的引用是否覆盖该 fixture：精确命中，或被条目声明的 `sampleDir` 子树覆盖
 * （与 findUncovered 的 isCovered 同口径，避免「fixture 由目录引用登记」的行被误判为不相关）。
 */
function entryCoversFixture(entry: CaseEntry, fixtureRel: string): boolean {
  for (const ref of entry.refs) {
    if (ref === fixtureRel || fixtureRel.startsWith(`${ref}/`)) return true;
  }
  return false;
}

/** 提取 self-test.ts 中所有用例数组对 samples/ 的引用（按行号区间切块，避免正则前瞻误吞） */
function extractReferences(selfTestContent: string): ReferenceSets {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const lines = selfTestContent.split('\n');

  // 1) 用例数组 → 子目录映射（与用例条目级校验共用同一口径，见 mapCaseArraysToDirs）
  const casesToDir = mapCaseArraysToDirs(lines);

  // 2) 用例数组块（const <NAME>_CASES: ... 行号区间）→ file/manifestFile/ticketsFile 字段值，
  //    组合为 `<子目录>/<file>` 精确引用
  const caseStarts: Array<{ name: string; start: number }> = [];
  lines.forEach((l, i) => {
    const m = l.match(/const (\w+_CASES):/);
    if (m !== null) caseStarts.push({ name: m[1]!, start: i });
  });
  for (let i = 0; i < caseStarts.length; i++) {
    const name = caseStarts[i]!.name;
    const dir = casesToDir.get(name);
    if (dir === undefined) continue; // 无 run 函数配对的数组（理论上不存在）
    const end = i + 1 < caseStarts.length ? caseStarts[i + 1]!.start : lines.length;
    const block = lines.slice(caseStarts[i]!.start, end).join('\n');
    // 精确文件引用字段：file（主输入）/ manifestFile（bdd）/ ticketsFile（S18 票据内容 fixture）
    for (const m of block.matchAll(/\b(?:file|manifestFile|ticketsFile): '([^']+)'/g)) {
      files.add(`${dir}/${m[1]!}`);
    }
    // 配套产物文件数组字段（相对 samples/<子目录>/）：
    //   bdd 配套 .feature（featureFiles）、gate 配套 M07 E2 原始输出产物（auxFiles）
    for (const m of block.matchAll(/(?:featureFiles|auxFiles): \[([^\]]*)\]/g)) {
      for (const ff of m[1]!.matchAll(/'([^']+)'/g)) {
        files.add(`${dir}/${ff[1]!}`);
      }
    }
  }

  // 3) sampleDir: 目录引用（覆盖子树，如 opsx-artifacts/valid-phase5）
  for (const m of selfTestContent.matchAll(/sampleDir: '([^']+)'/g)) {
    dirs.add(m[1]!);
  }

  return { files, dirs };
}

/** 递归扫描 samples/ 树，返回未覆盖条目（相对路径，正斜杠分隔） */
function findUncovered(samplesRoot: string, refs: ReferenceSets): string[] {
  const uncovered: string[] = [];
  const isExempt = (rel: string): boolean => EXEMPT_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`));
  const isCovered = (rel: string): boolean =>
    refs.files.has(rel) || [...refs.dirs].some((d) => rel === d || rel.startsWith(`${d}/`));

  const walk = (rel: string): boolean => {
    // Windows 下 path.join 生成 `\` 分隔符，统一为 `/` 再与提取引用比对
    const relNorm = rel.split(/[\\/]/).join('/');
    const abs = join(samplesRoot, rel);
    const name = relNorm.split('/').pop() ?? '';
    if (name.startsWith('.') || SKIP_NAMES.has(name)) return false; // 隐藏 / 运行时产物 / 文档
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (isExempt(relNorm)) return true; // 豁免目录：矩阵声明由 README 检查兜底
      if (refs.dirs.has(relNorm)) return true; // 引用目录：子树整体已覆盖
      let covered = false;
      for (const child of readdirSync(abs)) {
        if (walk(join(rel, child))) covered = true;
      }
      if (!covered) uncovered.push(relNorm);
      return covered;
    }
    const covered = isCovered(relNorm);
    if (!covered) uncovered.push(relNorm);
    return covered;
  };

  for (const entry of readdirSync(samplesRoot)) {
    walk(entry);
  }
  return uncovered;
}

/**
 * 反向校验（F-G7-06，audit-fixes task 6）：self-test.ts 引用的 fixture 路径（file / sampleDir）
 * 必须真实存在于盘——引用指向缺失文件（dangling）时旧门禁单向放行 exit 0，self-test 运行期才爆。
 * 返回悬空引用列表（相对 samples/ 的 POSIX 路径）。
 */
function findDanglingRefs(samplesRoot: string, refs: ReferenceSets): string[] {
  const dangling: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控仓库相对路径（samplesRoot 下引用条目），仅作存在性探测
  const exists = (rel: string): boolean => existsSync(join(samplesRoot, rel));
  for (const f of refs.files) {
    if (!exists(f)) dangling.push(f);
  }
  for (const d of refs.dirs) {
    if (!exists(d)) dangling.push(d);
  }
  return dangling.sort();
}

/**
 * 核对每个顶层子目录在 samples/README.md 覆盖矩阵中有声明（F-G7-07，audit-fixes task 6）：
 * 判据为「矩阵表行首列出现 `<dir>`」——解析 README 表格行（`^\s*\|` 开头）取首列并剥反引号，
 * 替代旧的「README 全文 includes(`dir`)」弱校验（正文提及/排除项提及即绕过）。
 */
function findUndeclaredDirs(samplesRoot: string, readmeContent: string): string[] {
  const declared = new Set<string>();
  for (const line of readmeContent.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const firstCell = line
      .slice(line.indexOf('|') + 1)
      .split('|')[0]
      ?.trim();
    if (firstCell === undefined || firstCell === '') continue;
    declared.add(firstCell.replace(/^`/, '').replace(/`$/, ''));
  }
  const undeclared: string[] = [];
  for (const entry of readdirSync(samplesRoot)) {
    if (entry.startsWith('.') || SKIP_NAMES.has(entry)) continue;
    if (!statSync(join(samplesRoot, entry)).isDirectory()) continue;
    if (!declared.has(entry)) undeclared.push(entry);
  }
  return undeclared;
}

/** 剥离单元格首尾反引号 */
function stripBackticks(cell: string): string {
  return cell.replace(/^`/, '').replace(/`$/, '');
}

/**
 * 解析 samples/NEGATIVE-COVERAGE.md 的表格行（第 5 条规则，语法严格）：
 * 每行恰 `NEGATIVE_COLUMNS` 列且四列均非空；表头（首列「门禁脚本」）/ 分隔行 / 非表行跳过。
 * 列数不符或存在空列的行**不丢弃**，而是作为 malformed 记录（旧实现在此处 `continue`，
 * 于是一行写坏的登记会被当作「没写」→ 只在门禁恰好也漏登记时才暴露，掩盖真实缺陷）。
 */
function parseNegativeCoverage(content: string): NegativeParse {
  const entries: NegativeEntry[] = [];
  const malformed: string[] = [];
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index++) {
    // eslint-disable-next-line security/detect-object-injection -- 受控数组下标（0..lines.length-1），读的是本函数自己 split 出的登记册行
    const raw = lines[index]!;
    if (!/^\s*\|/.test(raw)) continue;
    const lineNumber = index + 1;
    const cells = raw
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim());
    const name = stripBackticks(cells[0] ?? '');
    if (name === '' || name === '门禁脚本' || /^-+$/.test(name)) continue; // 表头 / 分隔行
    if (cells.length !== NEGATIVE_COLUMNS) {
      malformed.push(`第 ${lineNumber} 行「${name}」列数为 ${cells.length}，应为 ${NEGATIVE_COLUMNS} 列`);
      continue;
    }
    const mechanism = stripBackticks(cells[1] ?? '');
    const evidence = cells[2] ?? '';
    const regression = cells[3] ?? '';
    if (mechanism === '' || evidence === '' || regression === '') {
      malformed.push(
        `第 ${lineNumber} 行「${name}」存在空列（机制=${mechanism === '' ? '空' : mechanism}，证据=${evidence === '' ? '空' : '有'}，所防回归=${regression === '' ? '空' : '有'}）`,
      );
      continue;
    }
    entries.push({ name, mechanism, evidence, regression, line: lineNumber });
  }
  return { entries, malformed };
}

/**
 * 门禁集合口径：`cli/ 下的 *.ts` 减去 `self-test.ts`（与中心探针、exit2-failure-atomicity 同一口径，
 * 由共享注册表 `lib/exit2-probe-registry.ts` 的 `listGateScripts` 定义）。
 * 返回**基名**（去掉 `.ts`）——与 NEGATIVE-COVERAGE.md 第 1 列同口径；探针注册表用文件名，二者在
 * 调用探针时按 `<基名>.ts` 映射。
 */
function listGateBaseNames(cliScriptFiles: readonly string[]): string[] {
  return listGateScripts(cliScriptFiles).map((file) => file.slice(0, -'.ts'.length));
}

/** cli/ 下的脚本文件名列表（含 `.ts`；探针注册表口径） */
function listCliScriptFiles(root: string): string[] {
  const cliDir = join(root, 'w-model-dev/scripts/cli');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控固定相对路径（repo-root 下 w-model-dev/scripts/cli），仅列目录条目名、不做任何写入
  return readdirSync(cliDir).filter((f) => f.endsWith('.ts'));
}

/**
 * 证据引用形态：`<文件>#<锚>`（内容寻址，2026-09-18 任务 3.5 取代 `文件:行号`）。
 * 锚 = 被引行在**该文件内恰好出现一次**的特征子串；锚内不得含分隔字符（全角逗号 / 全角括号 /
 * 全角分号 / `#` / 反引号），这些字符标志锚结束，其后的文字为描述性备注（不参与校验）。
 * 登记册里整条引用写作 Markdown 行内代码（反引号包裹）——`w-model-dev/scripts/__tests__/...`
 * 这类路径含 `__`，不裹代码会被 Markdown 渲染成强调（prettier 重排时实测被改写为 `**tests**`）。
 */
const ANCHOR_CITATION_PATTERN =
  /([A-Za-z0-9._@/-]+\.(?:ts|tsx|mts|cts|js|mjs|cjs|json|jsonl|md|sh))#([^，（）；#`\n]+)/;

/** 迁移前的行号引用形态（`<文件>:<行号>`）：仅供违规检测，用于强制一次性迁移，不做双语法兼容 */
const LEGACY_LINE_CITATION_PATTERN = /([A-Za-z0-9._@/-]+\.(?:ts|tsx|mts|cts|js|mjs|cjs|json|jsonl|md|sh)):(\d+)/;

/** fixture 机制行的证据路径（`samples/...`，相对 w-model-dev/scripts/）；无法解析返回 null */
function extractFixturePath(evidence: string): string | null {
  const backticked = evidence.match(/`([^`]+)`/);
  const raw = backticked !== null ? backticked[1] : evidence.split('（')[0];
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 锚式证据校验（2026-09-18 任务 3.5，取代 `validateFileLineEvidence` / `validateFixtureCitationAnchor`）。
 *
 * 记法：`<文件>#<锚>`——文件相对 repo-root（fixture 行的 `self-test.ts` 等裸名解析为
 * `w-model-dev/scripts/cli/<裸名>`，与旧实现同口径）；锚是该文件内**恰出现一次**的特征子串，
 * 登记册中整条引用写作行内代码（`` `文件#锚` ``），锚后可用全角标点接描述性备注。
 *
 * 为什么放弃行号：行号是**位置**，而校验真正依赖的是**内容**。被引文件上方插入任意行即整表漂移
 * （本仓 2026-09-17 / 09-18 实测三次回填），行号本身并不提供额外防伪力；锚是内容寻址，插行不漂移，
 * 被指内容改写或搬走则立即「零命中」失败。锚的选取约定见 samples/NEGATIVE-COVERAGE.md 头注。
 *
 * 校验顺序（消息文本区分，违规码统一 `negative-coverage-evidence-anchor`）：
 *   1. 旧行号语法 → 判违规（要求迁移到锚语法）；
 *   2. 未解析出锚式引用 → `negative-coverage-evidence-invalid`（正文里只写「由某任务提供」不算证据）；
 *   3. 引用文件须存在且为普通文件；
 *   4. 锚非空，且在文件全文出现次数恰为 1（0 次 = 锚零命中，>1 次 = 锚不唯一）。
 * 传 `relevance`（fixture 行）时另加第 5 步（违规码 `negative-coverage-evidence-relevance`）：
 *   5. 引用文件须为用例登记来源（self-test.ts），且锚须落在**登记该 fixture 的用例条目**内
 *      ——「锚唯一」只约束文件内唯一，不约束与本条 fixture 的相关性（修复轮补回被删掉的相关度判据）。
 */
function validateAnchorEvidence(
  root: string,
  evidence: string,
  relevance?: { fixtureRel: string; caseEntries: readonly CaseEntry[] },
): EvidenceIssue | null {
  const legacy = evidence.match(LEGACY_LINE_CITATION_PATTERN);
  if (legacy !== null) {
    return {
      code: 'negative-coverage-evidence-anchor',
      message:
        `证据仍是行号寻址（${legacy[1]} 后的冒号加数字）：行号是位置而非内容，` +
        '行号语法已移除，改用「文件#唯一子串锚」（锚取被指行在该文件内恰好出现一次的特征子串）',
    };
  }
  const citation = evidence.match(ANCHOR_CITATION_PATTERN);
  if (citation === null) {
    return {
      code: 'negative-coverage-evidence-invalid',
      message: `证据未解析出「文件#唯一子串锚」：${evidence}（invocation / mutated-copy 必须指向真实测试文件内的唯一子串）`,
    };
  }
  const rawFile = citation[1]!;
  const anchor = citation[2]!.trim();
  const relFile = citationFileRel(rawFile);
  const absolute = isAbsolute(relFile) ? relFile : join(root, relFile);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 登记册声明的受控引用文件，仅作存在性探测
  if (!existsSync(absolute)) {
    return { code: 'negative-coverage-evidence-anchor', message: `引用文件不存在：${relFile}（相对 repo-root 解析）` };
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，只读校验锚是否唯一命中
  if (!statSync(absolute).isFile()) {
    return { code: 'negative-coverage-evidence-anchor', message: `引用路径不是普通文件：${relFile}` };
  }
  if (anchor === '') {
    return { code: 'negative-coverage-evidence-anchor', message: `锚为空：${relFile}# 后须给出唯一子串` };
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，只读全文以统计锚命中次数
  const content = readFileSync(absolute, 'utf-8');
  const hits = content.split(anchor).length - 1;
  if (hits === 0) {
    return {
      code: 'negative-coverage-evidence-anchor',
      message: `锚零命中：${relFile}#${anchor}（该子串不在引用文件内；锚须取自被指行的真实内容，改内容即需换锚）`,
    };
  }
  if (hits > 1) {
    return {
      code: 'negative-coverage-evidence-anchor',
      message: `锚不唯一：${relFile}#${anchor}（该子串在文件内出现 ${hits} 次；锚须唯一，可加长到足以区分）`,
    };
  }
  if (relevance !== undefined) {
    if (relFile !== CASE_SOURCE_REL) {
      return {
        code: 'negative-coverage-evidence-relevance',
        message:
          `fixture 行的锚须指向用例登记来源 ${CASE_SOURCE_REL}，当前指向 ${relFile}：` +
          '锚唯一只保证「在该文件内唯一」，不能证明与本条 fixture 相关',
      };
    }
    const offset = content.indexOf(anchor);
    const entry = relevance.caseEntries.find((e) => offset >= e.start && offset < e.end);
    if (entry === undefined) {
      return {
        code: 'negative-coverage-evidence-relevance',
        message: `锚未落在任何用例条目内：${relFile}#${anchor}（fixture 行的锚须取自登记该 fixture 的用例条目）`,
      };
    }
    if (!entryCoversFixture(entry, relevance.fixtureRel)) {
      return {
        code: 'negative-coverage-evidence-relevance',
        message:
          `锚落在用例条目 ${entry.array} 内，但该条目未登记本条 fixture ${relevance.fixtureRel}` +
          `（该条目登记的引用为 [${[...entry.refs].join(', ')}]）：锚指到了别的 fixture 的用例条目`,
      };
    }
  }
  return null;
}

/** 引用文件写成 repo-root 相对路径（fixture 行的引用写作裸名 `self-test.ts#...`，相对 cli/） */
function citationFileRel(rawFile: string): string {
  return rawFile.includes('/') ? rawFile : `w-model-dev/scripts/cli/${rawFile}`;
}

/** 逐条登记的证据校验（机制枚举 / 证据可解析 / fixture 在盘 / fixture 行锚相关度） */
function validateEntries(
  root: string,
  entries: readonly NegativeEntry[],
  caseEntries: readonly CaseEntry[],
): Array<{ check: string; message: string }> {
  const violations: Array<{ check: string; message: string }> = [];
  /** `<引用文件>#<锚>` → 首个占用它的 fixture 行所指向的 fixture（fixtureRel），用于共用锚判据 */
  const fixtureAnchorOwners = new Map<string, string>();
  for (const entry of entries) {
    if (!NEGATIVE_MECHANISMS.has(entry.mechanism)) {
      violations.push({
        check: 'negative-coverage-unknown-mechanism',
        message: `「${entry.name}」的负向机制不在 fixture/invocation/mutated-copy 内：${entry.mechanism}（第 ${entry.line} 行）`,
      });
      continue;
    }
    if (entry.mechanism === 'fixture') {
      const rel = extractFixturePath(entry.evidence);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控清单条目（NEGATIVE-COVERAGE.md 内 samples/ 相对路径），仅作存在性探测
      const onDisk = rel !== null && existsSync(join(root, 'w-model-dev/scripts', rel));
      if (!onDisk) {
        violations.push({
          check: 'negative-coverage-dangling',
          message: `负向案例指向不存在的 fixture：${rel ?? entry.evidence}（第 ${entry.line} 行）`,
        });
      }
      // fixture 行的引用位置 = `<fixture 路径>`（`self-test.ts#锚`）：锚须落在**登记该 fixture 的用例
      // 条目**内；同一 `引用文件#锚` 不得被两条指向不同 fixture 的 fixture 行共用（共用即至少一条指到
      // 别的 fixture 的条目上——锚唯一只约束文件内唯一，同名 fixture 下无法据此判断相关性）。
      const fixtureRel = rel === null ? entry.evidence : rel.replace(/^samples\//, '');
      const citation = entry.evidence.match(ANCHOR_CITATION_PATTERN);
      if (rel !== null && citation !== null) {
        const key = `${citationFileRel(citation[1]!)}#${citation[2]!.trim()}`;
        const owner = fixtureAnchorOwners.get(key);
        if (owner !== undefined && owner !== fixtureRel) {
          violations.push({
            check: 'negative-coverage-evidence-shared-anchor',
            message:
              `两条 fixture 行共用同一锚：${key} 已被指向 ${owner} 的登记行占用，本条指向 ${fixtureRel}` +
              `（第 ${entry.line} 行）；同名 fixture 必须各自锚到自己的用例条目`,
          });
        } else if (owner === undefined) {
          fixtureAnchorOwners.set(key, fixtureRel);
        }
      }
      const anchorIssue = validateAnchorEvidence(root, entry.evidence, { fixtureRel, caseEntries });
      if (anchorIssue !== null) {
        violations.push({
          check: anchorIssue.code,
          message: `${anchorIssue.message}（第 ${entry.line} 行）`,
        });
      }
      continue;
    }
    const issue = validateAnchorEvidence(root, entry.evidence);
    if (issue !== null) {
      violations.push({ check: issue.code, message: `${issue.message}（第 ${entry.line} 行）` });
    }
  }
  return violations;
}

/** 递归列举探针根下的相对条目（目录带尾斜杠），排序后用于前后逐项比对 */
function listProbeTree(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string, prefix: string): void => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 进程内 mkdtemp 探针根下的受控遍历，只读
    const dirents = readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const dirent of dirents) {
      const child = prefix === '' ? dirent.name : `${prefix}/${dirent.name}`;
      if (dirent.isDirectory()) {
        found.push(`${child}/`);
        walk(join(directory, dirent.name), child);
      } else {
        found.push(child);
      }
    }
  };
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上
  if (!existsSync(root)) return found;
  walk(root, '');
  return found.sort();
}

/**
 * 单探针并发度。每个探针各有**独立隔离根**（见 runExit2Probes），彼此不共享任何可观测状态，
 * 因此并发不引入互相干扰；取 4 是在 Windows 进程启动开销（每次 spawn ≈1.5–2s）与 CPU 争用之间的折中。
 * 实测：48 个探针串行 71s → 4 路并发约 25s（每个探针的 exit-2/ERROR_JSON/人类错误/零漂移断言不变）。
 */
const PROBE_CONCURRENCY = 4;

/**
 * 执行**单个** exit-2 探针（第 5 条规则），并在它自己的隔离探针根内做前后快照比对：
 * 每次调用前先 `mkdtemp` 一个只属于本次调用的根、在其中物化该门禁的专用 fixture，
 * 调用前后比对**该根**的条目集合，断言 exit 2 + ERROR_JSON + 同类别人类错误 + 无半成品。
 *
 * 为什么每个探针一个根（而不是与 check-docs-consistency 中心探针共用一个大根）：共享根下的漂移
 * 只能做「本探针有没有动到别的探针已建的条目」这种弱归因，且天然排除了并发；独立根把不变量加强为
 * 「本探针在自己根内不留任何半成品」，同时允许有界并发（`PROBE_CONCURRENCY`）。
 */
async function runSingleProbe(options: {
  root: string;
  tsxCli: string;
  cliScriptFiles: readonly string[];
  gateBase: string;
  probeId: string;
}): Promise<ProbeOutcome> {
  const { root, tsxCli, cliScriptFiles, gateBase, probeId } = options;
  const execFileAsync = promisify(execFile);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 本进程拥有的 OS 临时探针根（每探针一个）
  const probeRoot = mkdtempSync(join(tmpdir(), 'samples-coverage-probe-'));
  try {
    const probe = buildExit2Probes({ cliScriptFiles, workRoot: probeRoot }).get(probeId);
    if (probe === undefined) {
      return {
        probeId,
        gate: gateBase,
        status: -1,
        errorJsonOk: false,
        humanErrorOk: false,
        treeDrift: [],
        reasons: ['探针注册表未返回该 probeId 的定义（注册表与调用方漂移）'],
      };
    }
    const before = listProbeTree(probeRoot);
    let status = 0;
    let stdout = '';
    let stderr = '';
    try {
      const result = await execFileAsync(
        process.execPath,
        [tsxCli, join(root, 'w-model-dev/scripts/cli', probe.script), ...probe.args],
        {
          cwd: probe.cwd ?? probeRoot,
          ...(probe.env === undefined ? {} : { env: probe.env }),
          encoding: 'utf8',
          timeout: PROBE_TIMEOUT_MS,
          maxBuffer: 64 * 1024 * 1024,
        },
      );
      stdout = String(result.stdout ?? '');
      stderr = String(result.stderr ?? '');
    } catch (error) {
      const childError = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };
      stdout = String(childError.stdout ?? '');
      stderr = String(childError.stderr ?? '');
      status = typeof childError.code === 'number' ? childError.code : -1;
    }
    const after = listProbeTree(probeRoot);
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    const treeDrift = [
      ...after.filter((p) => !beforeSet.has(p)).map((p) => `新增 ${p}`),
      ...before.filter((p) => !afterSet.has(p)).map((p) => `丢失 ${p}`),
    ];

    const jsonLine = stdout.split(/\r?\n/).find((line) => line.startsWith('ERROR_JSON '));
    let category: string | null = null;
    let errorExitCode: number | null = null;
    if (jsonLine !== undefined) {
      const parsed = parseJsonSafe(jsonLine.slice('ERROR_JSON '.length)) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        category = typeof record.category === 'string' ? record.category : null;
        errorExitCode = typeof record.exitCode === 'number' ? record.exitCode : null;
      }
    }
    const errorJsonOk =
      jsonLine !== undefined &&
      errorExitCode === 2 &&
      category !== null &&
      (EXIT2_ERROR_CATEGORIES as readonly string[]).includes(category);
    const humanErrorOk = category !== null && stderr.includes(`✗ [${category}]`);

    const reasons: string[] = [];
    if (status !== 2) reasons.push(`exit code 应为 2，实际 ${status}`);
    if (!errorJsonOk) {
      reasons.push(
        jsonLine === undefined
          ? 'stdout 缺少 ERROR_JSON 单行'
          : `ERROR_JSON 不合规（exitCode=${String(errorExitCode)}，category=${String(category)}）`,
      );
    }
    if (!humanErrorOk) reasons.push(`stderr 缺少与 ERROR_JSON 同类别的人类错误行（${String(category)}）`);
    if (treeDrift.length > 0) reasons.push(`隔离探针根被改动：${treeDrift.join('，')}`);
    return { probeId, gate: gateBase, status, errorJsonOk, humanErrorOk, treeDrift, reasons };
  } finally {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 本进程拥有的 OS 临时探针根（每探针一个）
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

/**
 * 执行全部注册探针（有界并发，`PROBE_CONCURRENCY`），结果顺序固定为「门禁顺序 → 门禁内探针顺序」，
 * 与串行实现逐项一致（同输入同输出，便于比对与审计）。调用方把 `reasons` 非空的结果转成
 * negative-coverage-probe-failed。
 */
async function runExit2Probes(
  root: string,
  gateBaseNames: readonly string[],
  cliScriptFiles: readonly string[],
): Promise<{ outcomes: ProbeOutcome[]; setupFailure: string | null }> {
  const require = createRequire(import.meta.url);
  let tsxCli: string;
  try {
    tsxCli = require.resolve('tsx/cli');
  } catch (error) {
    // fail-closed：探针不可用不得退化成「没有失败」
    return { outcomes: [], setupFailure: `tsx 不可用，无法执行 exit-2 探针：${(error as Error).message}` };
  }
  // 先枚举「门禁 → 探针 id」清单（用一次性列出根），再为每个探针各自建根执行。
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 本进程拥有的 OS 临时探针根（仅用于枚举）
  const listingRoot = mkdtempSync(join(tmpdir(), 'samples-coverage-probe-list-'));
  let probeIdsByGate: Map<string, string[]>;
  try {
    const listing = buildExit2Probes({ cliScriptFiles, workRoot: listingRoot });
    probeIdsByGate = new Map<string, string[]>();
    for (const [probeId, probe] of listing) {
      const list = probeIdsByGate.get(probe.script) ?? [];
      list.push(probeId);
      probeIdsByGate.set(probe.script, list);
    }
  } finally {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 本进程拥有的 OS 临时探针根（仅用于枚举）
    rmSync(listingRoot, { recursive: true, force: true });
  }

  const tasks: Array<() => Promise<ProbeOutcome>> = [];
  for (const gateBase of gateBaseNames) {
    const probeIds = probeIdsByGate.get(`${gateBase}.ts`) ?? [];
    if (probeIds.length === 0) {
      tasks.push(async () => ({
        probeId: `${gateBase}#<registry-missing>`,
        gate: gateBase,
        status: -1,
        errorJsonOk: false,
        humanErrorOk: false,
        treeDrift: [],
        reasons: ['探针注册表中没有该门禁的负向调用定义（lib/exit2-probe-registry.ts）'],
      }));
      continue;
    }
    for (const probeId of probeIds) {
      tasks.push(() => runSingleProbe({ root, tsxCli, cliScriptFiles, gateBase, probeId }));
    }
  }

  const outcomes: ProbeOutcome[] = new Array<ProbeOutcome>(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(PROBE_CONCURRENCY, tasks.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      // eslint-disable-next-line security/detect-object-injection -- index 是本函数内自增游标（0 ≤ index < tasks.length），下标与数组均由本函数自身构造，无外部键
      outcomes[index] = await tasks[index]!();
    }
  });
  await Promise.all(workers);
  return { outcomes, setupFailure: null };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const root = pathResolve(argv.filter((a) => a !== '--json')[0] ?? process.cwd());

  const samplesRoot = join(root, 'w-model-dev/scripts/samples');
  const selfTestPath = join(root, 'w-model-dev/scripts/cli/self-test.ts');
  const readmePath = join(samplesRoot, 'README.md');
  const negativePath = join(samplesRoot, 'NEGATIVE-COVERAGE.md');

  // S20：repo-root 缺必需文件属输入错误（ARG_INVALID / exit 2，与 check-docs-consistency 同口径）；
  // 其余读取异常冒泡交由 runMain 的 UNEXPECTED 兜底（ERROR_JSON + exit 2），不再自吞堆栈
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控仓库相对路径（repo-root 下 samples/ 与 self-test.ts），仅作存在性探测
  const missingRequired = [samplesRoot, selfTestPath, readmePath, negativePath].filter((p) => !existsSync(p));
  if (missingRequired.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: 'repo-root 缺少必需文件',
      detail: `[${missingRequired.join(', ')}]（用法: check-samples-coverage.ts [repo-root] [--json]）`,
      exitCode: 2,
    });
    return;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- selfTestPath 为 repo-root 拼装的受控固定相对路径（'w-model-dev/scripts/cli/self-test.ts'），上方 existsSync 必需文件校验已通过，只读
  const selfTestContent = readFileSync(selfTestPath, 'utf-8');
  const refs = extractReferences(selfTestContent);
  const uncovered = findUncovered(samplesRoot, refs);
  const dangling = findDanglingRefs(samplesRoot, refs);
  const undeclared = findUndeclaredDirs(samplesRoot, readFileSync(readmePath, 'utf-8'));
  // fixture 行锚相关度判据的事实源：self-test.ts 的用例条目（数组内对象字面量）及其登记的 samples/ 引用
  const caseEntries = collectCaseEntries(selfTestContent);

  // 第 4 / 5 条规则：负向覆盖登记册（严格语法 + 证据可解析 + 真实 exit-2 探针）
  const cliScriptFiles = listCliScriptFiles(root);
  const gateBaseNames = listGateBaseNames(cliScriptFiles);
  const gateBaseNameSet = new Set(gateBaseNames);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控固定文件名（repo-root 下 samples/NEGATIVE-COVERAGE.md），只读不写
  const negativeParse = parseNegativeCoverage(readFileSync(negativePath, 'utf-8'));
  const registeredNames = new Set<string>();
  const duplicateViolations: Array<{ check: string; message: string }> = [];
  const unknownGateViolations: Array<{ check: string; message: string }> = [];
  const firstSeenLine = new Map<string, number>();
  for (const entry of negativeParse.entries) {
    const previousLine = firstSeenLine.get(entry.name);
    if (previousLine !== undefined) {
      duplicateViolations.push({
        check: 'negative-coverage-duplicate',
        message: `门禁「${entry.name}」登记了多行（第 ${previousLine} 行与第 ${entry.line} 行）；每个 exit-2 门禁恰一行`,
      });
      continue;
    }
    firstSeenLine.set(entry.name, entry.line);
    registeredNames.add(entry.name);
    if (!gateBaseNameSet.has(entry.name)) {
      unknownGateViolations.push({
        check: 'negative-coverage-unknown-gate',
        message: `登记的门禁「${entry.name}」不在 exit-2 门禁集合内（cli/ 下的 *.ts 减去 self-test.ts，第 ${entry.line} 行）`,
      });
    }
  }
  const missingNegative = gateBaseNames.filter((name) => !registeredNames.has(name));
  const evidenceViolations = validateEntries(root, negativeParse.entries, caseEntries);

  const probeGateBaseNames = gateBaseNames.filter((name) => registeredNames.has(name));
  const probeRun = await runExit2Probes(root, probeGateBaseNames, cliScriptFiles);
  const probeFailures =
    probeRun.setupFailure === null
      ? probeRun.outcomes.filter((o) => o.reasons.length > 0)
      : [{ probeId: '<setup>', gate: '<all>', status: -1, reasons: [probeRun.setupFailure] }];

  const violations: Array<{ check: string; message: string }> = [
    ...uncovered.map((rel) => ({
      check: 'fixture-unregistered',
      message: `fixture 未被 self-test.ts 引用：samples/${rel}（新增样本须在 self-test.ts 用例数组登记）`,
    })),
    ...dangling.map((rel) => ({
      check: 'reference-dangling',
      message: `self-test.ts 引用指向不存在的 fixture：samples/${rel}（引用与在盘文件必须双向闭环，F-G7-06）`,
    })),
    ...undeclared.map((dir) => ({
      check: 'matrix-undeclared',
      message: `samples/${dir}/ 未在 samples/README.md 覆盖矩阵声明`,
    })),
    ...missingNegative.map((name) => ({
      check: 'negative-coverage-missing',
      message: `samples/NEGATIVE-COVERAGE.md 未登记负向案例：${name}（每个 exit-2 门禁须有会失败的负向案例）`,
    })),
    ...negativeParse.malformed.map((detail) => ({
      check: 'negative-coverage-malformed',
      message: `负向覆盖登记行不合法：${detail}`,
    })),
    ...duplicateViolations,
    ...unknownGateViolations,
    ...evidenceViolations,
    ...probeFailures.map((outcome) => ({
      check: 'negative-coverage-probe-failed',
      message: `exit-2 探针未通过：${outcome.probeId}（${outcome.reasons.join('；')}）`,
    })),
  ];

  if (jsonMode) {
    const dist = new Map<string, number>();
    for (const v of violations) dist.set(v.check, (dist.get(v.check) ?? 0) + 1);
    const exitCode = violations.length === 0 ? 0 : 1;
    printJsonReport(
      {
        type: 'samples-coverage',
        passed: violations.length === 0,
        reasons: violations.map((v) => `${v.check}: ${v.message}`),
        violations: [...dist.entries()].map(([rule, count]) => ({ rule, count })),
        durationMs: 0,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }
  console.log('─'.repeat(60));
  console.log('Samples Coverage Checker');
  console.log('─'.repeat(60));
  for (const v of violations) console.log(`✗ [${v.check}] ${v.message}`);
  if (violations.length === 0)
    console.log('✓ 全部 fixture 已被 self-test.ts 引用，矩阵声明齐全，负向登记册与 exit-2 探针一致');
  printGateReport(
    'SAMPLES_COVERAGE',
    {
      fixtureCount: countFixtures(samplesRoot),
      referencedFiles: refs.files.size,
      referencedDirs: refs.dirs.size,
      unregistered: uncovered.length,
      danglingRefs: dangling.length,
      undeclaredDirs: undeclared.length,
      negativeCoverageMissing: missingNegative.length,
      negativeCoverageDangling: evidenceViolations.filter((v) => v.check === 'negative-coverage-dangling').length,
      negativeCoverageRows: negativeParse.entries.length,
      negativeCoverageProbes: probeRun.outcomes.length,
      negativeCoverageProbeFailures: probeFailures.length,
    },
    violations.length === 0 ? 0 : 1,
  );
  process.exitCode = violations.length === 0 ? 0 : 1;
}

/** 统计 samples/ 下可核对条目数（排除隐藏 / 运行时产物 / 文档） */
function countFixtures(samplesRoot: string): number {
  let count = 0;
  const walk = (rel: string): void => {
    const abs = join(samplesRoot, rel);
    const name = rel.split(/[\\/]/).pop() ?? '';
    if (name.startsWith('.') || SKIP_NAMES.has(name)) return;
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      for (const child of readdirSync(abs)) walk(join(rel, child));
    } else {
      count++;
    }
  };
  for (const entry of readdirSync(samplesRoot)) walk(entry);
  return count;
}

// 统一入口（lib/run-main.ts）：main() 异常统一为 UNEXPECTED + ERROR_JSON + exit 2（S20 兜底）
runMain(main);
