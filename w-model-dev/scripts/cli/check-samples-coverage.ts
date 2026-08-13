#!/usr/bin/env tsx
/**
 * samples 覆盖矩阵门禁（Samples Coverage Checker）
 *
 * 核对 w-model-dev/scripts/samples/ 下每个 fixture（文件 / 嵌套目录）都被 self-test.ts
 * 用例数组引用（file / sampleDir 字段），且每个子目录在 samples/README.md 覆盖矩阵中有声明——
 * 堵住「新增 fixture 后遗忘在 self-test.ts 登记」的缺口（未登记的 fixture 不参与任何检查，
 * self-test 基线依然全绿）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts [repo-root] [--json]
 *   （repo-root 默认 cwd；本仓库根目录）
 *
 * 参数：
 *   --json   机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  全部覆盖（无未登记 fixture，矩阵声明齐全）
 *   1  存在未登记 fixture / 矩阵声明缺失（violations 列出）
 *   2  输入错误（repo-root 缺必需文件）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 SAMPLES_COVERAGE_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * @module
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve as pathResolve } from 'node:path';

import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport } from '../lib/gate-report.js';

/**
 * 豁免子目录：不参与「fixture 被 self-test 引用」核对，仅要求 README 矩阵声明。
 * tla-e2e 为端到端 fixture（需 Java + tools/tla2tools.jar，SANY/TLC 全链路），
 * 手动 / CI 执行，不进 self-test 基线（见 samples/tla-e2e/README.md）。
 */
const EXEMPT_DIRS = ['tla-e2e'];

/** samples/ 扫描时排除的目录 / 文件（运行时产物与文档） */
const SKIP_NAMES = new Set(['.w-model', 'states', 'README.md', '.gitkeep']);

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

/** 核对每个顶层子目录在 samples/README.md 覆盖矩阵中有声明 */
function findUndeclaredDirs(samplesRoot: string, readmeContent: string): string[] {
  const undeclared: string[] = [];
  for (const entry of readdirSync(samplesRoot)) {
    if (entry.startsWith('.') || SKIP_NAMES.has(entry)) continue;
    if (!statSync(join(samplesRoot, entry)).isDirectory()) continue;
    if (!readmeContent.includes(`\`${entry}\``)) undeclared.push(entry);
  }
  return undeclared;
}

function main(): void {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const root = pathResolve(argv.filter((a) => a !== '--json')[0] ?? process.cwd());

  const samplesRoot = join(root, 'w-model-dev/scripts/samples');
  const selfTestPath = join(root, 'w-model-dev/scripts/cli/self-test.ts');
  const readmePath = join(samplesRoot, 'README.md');

  try {
    const refs = extractReferences(readFileSync(selfTestPath, 'utf-8'));
    const uncovered = findUncovered(samplesRoot, refs);
    const undeclared = findUndeclaredDirs(samplesRoot, readFileSync(readmePath, 'utf-8'));

    const violations: Array<{ check: string; message: string }> = [
      ...uncovered.map((rel) => ({ check: 'fixture-unregistered', message: `fixture 未被 self-test.ts 引用：samples/${rel}（新增样本须在 self-test.ts 用例数组登记）` })),
      ...undeclared.map((dir) => ({ check: 'matrix-undeclared', message: `samples/${dir}/ 未在 samples/README.md 覆盖矩阵声明` })),
    ];

    if (jsonMode) {
      const dist = new Map<string, number>();
      for (const v of violations) dist.set(v.check, (dist.get(v.check) ?? 0) + 1);
      printJsonReport(
        {
          type: 'samples-coverage',
          passed: violations.length === 0,
          reasons: violations.map((v) => `${v.check}: ${v.message}`),
          violations: [...dist.entries()].map(([rule, count]) => ({ rule, count })),
          durationMs: 0,
        },
        violations.length === 0 ? 0 : 1,
      );
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
        undeclaredDirs: undeclared.length,
      },
      violations.length === 0 ? 0 : 1,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    exitWithError({
      category: 'UNEXPECTED',
      message: 'samples 覆盖矩阵核对失败（repo-root 缺必需文件或读取异常）',
      exitCode: 2,
      detail,
    });
  }
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

main();
