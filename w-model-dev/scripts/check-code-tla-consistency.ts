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
 *   npx tsx w-model-dev/scripts/check-code-tla-consistency.ts \
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
 *
 * 退出码：
 *   0  校验通过（四维度全部通过）
 *   1  校验失败（violations 列出具体原因）
 *   2  输入错误（文件不存在 / 非法 JSON / 参数缺失）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import {
  checkCodeTlaConsistency,
  extractCodeStateTransfers,
  type CodeFile,
  type CodeTlaConsistencyInput,
  type Graph,
  type Rtm,
  type TlaManifest,
  type TlaSpec,
} from './code-tla-logic.js';

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

// ==================== JSON 文件读取 ====================

async function readJson<T>(file: string, label: string): Promise<T> {
  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ ${label} 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error(`✗ ${label} 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }
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
  const { manifestFile, graphFile, rtmFile, srcDir } = parseArgs(process.argv);

  if (!manifestFile || !graphFile || !rtmFile || !srcDir) {
    console.error(
      '用法: npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>',
    );
    process.exit(2);
  }

  // 读取 JSON 文件
  const manifest = await readJson<TlaManifest>(manifestFile, 'manifest');
  const graph = await readJson<Graph>(graphFile, 'graph');
  const rtm = await readJson<Rtm>(rtmFile, 'rtm');

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
    for (const v of result.violations) {
      console.log(`  - [${v.dimension}] ${v.message}`);
    }
    console.log('');
    console.log('S 子代理须按上述原因修正（补充 codeModule 映射 / 实现 Next 分支 / 添加断言覆盖不变式）');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  const exitCode = result.passed ? 0 : 1;
  console.log('─'.repeat(60));
  console.log(
    'CODE_TLA_JSON ' +
      JSON.stringify({
        type: 'code-tla-consistency',
        passed: result.passed,
        exitCode,
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
      }),
  );

  process.exit(exitCode);
}

main().catch(err => {
  console.error('代码-TLA+ 一致性校验脚本异常:', err);
  process.exit(2);
});
