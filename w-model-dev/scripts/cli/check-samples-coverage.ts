#!/usr/bin/env tsx
/**
 * samples 覆盖矩阵门禁（Samples Coverage Checker）
 *
 * 核对 w-model-dev/scripts/samples/ 下每个 fixture（文件 / 嵌套目录）都被 self-test.ts
 * 用例数组引用（file / sampleDir 字段），且每个子目录在 samples/README.md 覆盖矩阵中有声明——
 * 堵住「新增 fixture 后遗忘在 self-test.ts 登记」的缺口（未登记的 fixture 不参与任何检查，
 * self-test 基线依然全绿）。双向闭环（F-G7-06/07，audit-fixes task 6）：
 *   - 引用 → 在盘：self-test.ts 引用的 file / sampleDir 路径必须真实存在（悬空 → reference-dangling / exit 1）；
 *   - 声明 → 矩阵行：README 覆盖矩阵按表行首列解析（正文反引号提及不算声明）。
 *
 * 第 4 条规则（M06 / S28，P2-A 任务 2）：负向覆盖不变量——`cli/*.ts` 减去 `self-test.ts` 的每个
 * exit-2 门禁必须在 samples/NEGATIVE-COVERAGE.md 登记一条会失败的负向案例（fixture / invocation /
 * mutated-copy）。门禁集合从既有事实源（cli 目录）推导，不另写硬编码清单：
 *   - 未登记 → negative-coverage-missing（exit 1）；
 *   - fixture 机制行的证据路径在盘不存在 → negative-coverage-dangling（exit 1）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts [repo-root] [--json]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 参数：
 *   --json   机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  全部覆盖（无未登记 fixture，矩阵声明齐全，引用无悬空，负向覆盖登记齐全）
 *   1  存在未登记 fixture / 引用悬空（dangling）/ 矩阵声明缺失 / 负向案例未登记或悬空（violations 列出）
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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve as pathResolve } from 'node:path';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { printGateReport, printJsonReport } from '../lib/gate-report.js';

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

/** NEGATIVE-COVERAGE.md 的一行登记 */
interface NegativeEntry {
  /** 门禁基名（cli/<name>.ts 去掉 .ts） */
  name: string;
  /** 负向机制：fixture / invocation / mutated-copy */
  mechanism: string;
  /** 证据位置：fixture 为 `samples/...`；invocation / mutated-copy 为 文件:行号 */
  evidence: string;
}

/** 从 self-test.ts 提取的引用集合 */
interface ReferenceSets {
  /** 精确文件引用：`<子目录>/<file>`（来自 file: 字段 + run 函数目录配对） */
  files: Set<string>;
  /** 目录引用：sampleDir: 字段值（覆盖该路径子树） */
  dirs: Set<string>;
}

/** 提取 self-test.ts 中所有用例数组对 samples/ 的引用（按行号区间切块，避免正则前瞻误吞） */
function extractReferences(selfTestContent: string): ReferenceSets {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const lines = selfTestContent.split('\n');

  // 1) run 函数 → 子目录映射：runXxxCases 函数体（行号区间）内
  //    path.join(<dirVar>, '<subdir>', <caseVar>.<field>) 与 for (const <v> of <CASES>) 配对，
  //    得到「用例数组 → file 型子目录」映射。
  //    兼容形态：三参 join（path.join(samplesDir, 'bdd', c.file)）、两参 join + 预定义目录变量
  //    （const bddSamplesDir = path.join(samplesDir, 'bdd')）、循环变量非 c（for (const tc of ...)）、
  //    bdd 用 manifestFile 字段。
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
    const dir = dirMatch;
    for (const m of block.matchAll(/for \(const \w+ of (\w+_CASES)\)/g)) {
      casesToDir.set(m[1]!, dir);
    }
  }

  // 2) 用例数组块（const <NAME>_CASES: ... 行号区间）→ file/manifestFile 字段值，
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
    for (const m of block.matchAll(/\b(?:file|manifestFile): '([^']+)'/g)) {
      files.add(`${dir}/${m[1]!}`);
    }
    // bdd 配套 .feature（featureFiles 数组字段，相对 samples/bdd/）
    for (const m of block.matchAll(/featureFiles: \[([^\]]*)\]/g)) {
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

/**
 * 解析 samples/NEGATIVE-COVERAGE.md 的表格行：首单元格 = 门禁基名，第 2 列 = 机制，第 3 列 = 证据。
 * 仅接受三值枚举机制且证据非空的行（表头 / 分隔行 / 空行跳过），避免「写了行但不构成负向案例」的假登记。
 */
function parseNegativeCoverage(content: string): NegativeEntry[] {
  const entries: NegativeEntry[] = [];
  for (const line of content.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line
      .replace(/^\s*\|/, '')
      .split('|')
      .map((c) => c.trim());
    const name = (cells[0] ?? '').replace(/^`/, '').replace(/`$/, '');
    if (name === '' || name === '门禁脚本' || /^-+$/.test(name)) continue;
    const mechanism = (cells[1] ?? '').replace(/^`/, '').replace(/`$/, '');
    const evidence = cells[2] ?? '';
    if (!NEGATIVE_MECHANISMS.has(mechanism) || evidence === '') continue;
    entries.push({ name, mechanism, evidence });
  }
  return entries;
}

/** fixture 机制行的证据路径（`samples/...`，相对 w-model-dev/scripts/）；无法解析返回 null */
function extractFixturePath(evidence: string): string | null {
  const backticked = evidence.match(/`([^`]+)`/);
  const raw = backticked !== null ? backticked[1] : evidence.split('（')[0];
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** 门禁集合口径：w-model-dev/scripts/cli/*.ts 减去 self-test.ts（与 check-docs-consistency 中心探针一致） */
function listGateNames(root: string): string[] {
  const cliDir = join(root, 'w-model-dev/scripts/cli');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控固定相对路径（repo-root 下 w-model-dev/scripts/cli），仅列目录条目名、不做任何写入
  return readdirSync(cliDir)
    .filter((f) => f.endsWith('.ts') && f !== 'self-test.ts')
    .map((f) => f.slice(0, -'.ts'.length))
    .sort();
}

/** 负向清单未登记的门禁（每个 exit-2 门禁须有会失败的负向案例） */
function findMissingNegativeGates(root: string, entries: NegativeEntry[]): string[] {
  const registered = new Set(entries.map((e) => e.name));
  return listGateNames(root).filter((name) => !registered.has(name));
}

/** fixture 机制行中证据路径在盘不存在（或无法解析）的条目 */
function findDanglingNegativeFixtures(root: string, entries: NegativeEntry[]): string[] {
  const dangling: string[] = [];
  for (const e of entries) {
    if (e.mechanism !== 'fixture') continue;
    const rel = extractFixturePath(e.evidence);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控清单条目（NEGATIVE-COVERAGE.md 内 samples/ 相对路径），仅作存在性探测
    if (rel === null || !existsSync(join(root, 'w-model-dev/scripts', rel))) dangling.push(rel ?? e.evidence);
  }
  return dangling;
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
  const refs = extractReferences(readFileSync(selfTestPath, 'utf-8'));
  const uncovered = findUncovered(samplesRoot, refs);
  const dangling = findDanglingRefs(samplesRoot, refs);
  const undeclared = findUndeclaredDirs(samplesRoot, readFileSync(readmePath, 'utf-8'));
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控固定文件名（repo-root 下 samples/NEGATIVE-COVERAGE.md），只读不写
  const negativeEntries = parseNegativeCoverage(readFileSync(negativePath, 'utf-8'));
  const missingNegative = findMissingNegativeGates(root, negativeEntries);
  const danglingNegative = findDanglingNegativeFixtures(root, negativeEntries);

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
    ...danglingNegative.map((rel) => ({
      check: 'negative-coverage-dangling',
      message: `负向案例指向不存在的 fixture：${rel}`,
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
  if (violations.length === 0) console.log('✓ 全部 fixture 已被 self-test.ts 引用，矩阵声明齐全');
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
      negativeCoverageDangling: danglingNegative.length,
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
