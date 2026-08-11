#!/usr/bin/env tsx
/**
 * 代码-TLA+ 一致性校验脚本（Code-TLA Consistency Checker）
 *
 * 对应 docs/superpowers/specs/2026-07-24-tla-plus-and-orchestration-fix-design.md §3.4.3。
 * 供 G 子代理在阶段5 编码后调用，校验代码与 TLA+ 资产的四维度一致性：
 *   1. SD→codeModule 映射完整性（graph SD 节点 ←→ rtm.codeModule 字段）
 *   2. 代码状态转移抽取（TypeScript AST 抽取赋值/条件分支）
 *   3. Next 分支对应（TLA+ Next == \/ Act1 \/ Act2 ←→ 代码函数名）
 *   4. 断言覆盖不变式（TLA+ BusinessInvariant 子不变式 ←→ 代码 assert/invariant/require）
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts \
 *     --manifest=.w-model/tla-manifest.json \
 *     --graph=.w-model/ingestion/graph.json \
 *     --rtm=.w-model/rtm.json \
 *     --src=src/
 *
 * 参数：
 *   --manifest=<path>  tla-manifest.json 文件路径（必填）
 *   --graph=<path>     graph.json 文件路径（必填）
 *   --rtm=<path>       rtm.json 文件路径（必填）
 *   --src=<path>       源代码目录（必填，递归扫描 .ts 文件）
 *   --json             机器可读输出模式：stdout 仅输出单行纯 JSON（可整体 JSON.parse）
 *
 * 退出码：
 *   0  校验通过（四维度全部通过）
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数缺失）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 CODE_TLA_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--manifest=、--graph=、--rtm=、--src=
 * 退出码：0=通过 / 1=校验失败（violations）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type * as TsType from 'typescript';
import {
  checkCodeTlaConsistency,
  extractCodeStateTransfers,
  type CodeFile,
  type CodeTlaConsistencyInput,
  type Graph,
  type Rtm,
  type TlaManifest,
  type TlaSpec,
} from '../logic/code-tla-logic.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { exitWithError } from '../lib/cli-error.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

const ts = createRequire(import.meta.url)('typescript') as typeof TsType;

// ==================== 参数解析 ====================

interface ParsedArgs {
  manifestFile: string | undefined;
  graphFile: string | undefined;
  rtmFile: string | undefined;
  srcDir: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const get = (key: string): string | undefined => {
    const a = args.find(x => x.startsWith(`--${key}=`));
    return a ? a.split('=').slice(1).join('=') : undefined;
  };
  return {
    manifestFile: get('manifest'),
    graphFile: get('graph'),
    rtmFile: get('rtm'),
    srcDir: get('src'),
  };
}

// ==================== 源代码扫描 ====================

/**
 * 递归扫描目录下所有 .ts 文件，排除 .test.ts、.spec.ts 和 node_modules。
 */
async function collectSourceFiles(srcDir: string): Promise<string[]> {
  const abs = path.resolve(srcDir);
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // 排除 .test.ts / .spec.ts / .d.ts
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts') || entry.name.endsWith('.d.ts')) {
          continue;
        }
        results.push(full);
      }
    }
  }

  await walk(abs);
  return results;
}

/**
 * 加载源代码文件并抽取 AST 节点（赋值/条件分支/断言）。
 */
async function loadCodeFiles(srcDir: string): Promise<CodeFile[]> {
  const files = await collectSourceFiles(srcDir);
  const codeFiles: CodeFile[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = await fs.readFile(file, 'utf-8');
    } catch {
      continue;
    }
    const ast = ts.createSourceFile(file, content, ts.ScriptTarget.ES2022, true);
    const extracted = extractCodeStateTransfers(ast, file);
    codeFiles.push(extracted);
  }
  return codeFiles;
}

// ==================== TLA+ 内容读取 ====================

/**
 * 读取 manifest 中每个 L2/L3 spec 的 .tla 文件内容，注入 spec.tlaContent。
 * tlaPath 相对 manifest 文件所在目录解析。
 */
async function loadTlaContents(manifest: TlaManifest, manifestFile: string): Promise<void> {
  const manifestDir = path.dirname(path.resolve(manifestFile));
  if (!Array.isArray(manifest.specs)) return;
  for (const spec of manifest.specs as TlaSpec[]) {
    if (!spec || spec.level !== 'L2' && spec.level !== 'L3') continue;
    if (typeof spec.tlaPath !== 'string' || spec.tlaPath.trim() === '') continue;
    const tlaAbs = path.resolve(manifestDir, spec.tlaPath);
    try {
      spec.tlaContent = await fs.readFile(tlaAbs, 'utf-8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        // .tla 文件不存在时记录空字符串，校验逻辑会按"无 tlaContent"处理
        spec.tlaContent = '';
      } else {
        spec.tlaContent = '';
      }
    }
  }
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  // B4 --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = process.argv.slice(2).includes('--json');
  const startTime = Date.now();
  const { manifestFile, graphFile, rtmFile, srcDir } = parseArgs(process.argv);

  if (!manifestFile || !graphFile || !rtmFile || !srcDir) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 --manifest/--graph/--rtm/--src',
      detail: '用法: npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>',
      exitCode: 2,
    });
    return;
  }

  // 读取 JSON 文件
  const manifest = await readJsonOrExit<TlaManifest>(manifestFile);
  const graph = await readJsonOrExit<Graph>(graphFile);
  const rtm = await readJsonOrExit<Rtm>(rtmFile);

  // 读取 L2/L3 spec 的 .tla 内容
  await loadTlaContents(manifest, manifestFile);

  // 加载源代码文件
  const codeFiles = await loadCodeFiles(srcDir);

  // 调用纯逻辑校验
  const input: CodeTlaConsistencyInput = {
    manifest,
    graph,
    rtm,
    codeFiles,
  };
  const result = checkCodeTlaConsistency(input);
  const exitCode = result.passed ? 0 : 1;

  // B4 --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    // A2b 双轨过渡：reasons 优先 structuredViolations 的 message，violations 分布按 rule 聚合
    printJsonReport({
      type: 'code-tla-consistency',
      passed: result.passed,
      reasons: result.structuredViolations?.length
        ? result.structuredViolations.map(v => v.message)
        : result.violations.map(v => `[${v.dimension}] ${v.message}`),
      violations: buildViolationDistribution(result.violations.length, result.structuredViolations),
      durationMs: Date.now() - startTime,
    }, exitCode);
    process.exitCode = exitCode;
    return;
  }

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('代码-TLA+ 一致性校验（Code-TLA Consistency Checker）');
  console.log('═'.repeat(60));
  console.log(`manifest      : ${path.resolve(manifestFile)}`);
  console.log(`graph         : ${path.resolve(graphFile)}`);
  console.log(`rtm           : ${path.resolve(rtmFile)}`);
  console.log(`src           : ${path.resolve(srcDir)}`);
  console.log(`代码文件数    : ${codeFiles.length}`);
  console.log('─'.repeat(60));
  console.log('维度校验结果：');
  console.log(
    `  维度1 SD→codeModule   : ${result.dimensions.sdToCodeModule.passed ? '✓ 通过' : '✗ 未通过'}（${result.dimensions.sdToCodeModule.checked} 项）`,
  );
  console.log(
    `  维度2 代码状态转移    : ${result.dimensions.codeStateTransfer.passed ? '✓ 通过' : '✗ 未通过'}（${result.dimensions.codeStateTransfer.checked} 项）`,
  );
  console.log(
    `  维度3 Next 分支对应   : ${result.dimensions.nextBranchCoverage.passed ? '✓ 通过' : '✗ 未通过'}（${result.dimensions.nextBranchCoverage.checked} 项）`,
  );
  console.log(
    `  维度4 断言覆盖不变式  : ${result.dimensions.invariantCoverage.passed ? '✓ 通过' : '✗ 未通过'}（${result.dimensions.invariantCoverage.checked} 项）`,
  );
  console.log('─'.repeat(60));
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);

  if (!result.passed) {
    console.log('未通过原因：');
    // A2b 双轨过渡：优先读 structuredViolations（含 rule/field 增强展示），降级读 violations
    if (result.structuredViolations && result.structuredViolations.length > 0) {
      for (const v of result.structuredViolations) {
        const loc = v.field ? ` ${v.field}` : '';
        console.log(`  - [${v.rule}${loc}] ${v.message}`);
      }
    } else {
      for (const v of result.violations) {
        console.log(`  - [${v.dimension}] ${v.message}`);
      }
    }
    console.log('');
    console.log('S 子代理须按上述原因修正（补充 codeModule 映射 / 实现 Next 分支 / 添加断言覆盖不变式）');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  printGateReport('CODE_TLA', {
    type: 'code-tla-consistency',
    passed: result.passed,
    dimensions: {
      sdToCodeModule: {
        passed: result.dimensions.sdToCodeModule.passed,
        checked: result.dimensions.sdToCodeModule.checked,
        violations: result.dimensions.sdToCodeModule.violations,
      },
      codeStateTransfer: {
        passed: result.dimensions.codeStateTransfer.passed,
        checked: result.dimensions.codeStateTransfer.checked,
        violations: result.dimensions.codeStateTransfer.violations,
      },
      nextBranchCoverage: {
        passed: result.dimensions.nextBranchCoverage.passed,
        checked: result.dimensions.nextBranchCoverage.checked,
        violations: result.dimensions.nextBranchCoverage.violations,
      },
      invariantCoverage: {
        passed: result.dimensions.invariantCoverage.passed,
        checked: result.dimensions.invariantCoverage.checked,
        violations: result.dimensions.invariantCoverage.violations,
      },
    },
    violations: result.violations,
    codeFileCount: codeFiles.length,
    converged: result.passed,
  }, exitCode);
}

main().catch(err => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
