#!/usr/bin/env tsx
/**
 * 安全扫描集成脚本（Security Scan）
 *
 * 借鉴 drawio-skill/.skillspector-baseline.json 设计：
 *   - 跑 eslint + eslint-plugin-security 扫描 w-model-dev/scripts/
 *   - 已知风险用 .eslintsecurity-baseline.json sha256 指纹豁免
 *   - 新增同规则不同内容的发现才失败
 *
 * 指纹算法（baseline v2，内容敏感）：sha256(file + ruleId + 归一化违规行内容)。
 * 不包含行号列号 —— 行号漂移（上方增删行）不改变指纹，避免基线因行号位移而陈旧。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/security-scan.ts            # 校验模式
 *   npx tsx w-model-dev/scripts/security-scan.ts --regenerate  # 按当前发现全量重生成 baseline v2
 *
 * 退出码：
 *   0  无新增风险（baseline 覆盖全部发现）或重生成成功
 *   1  有新增风险（需更新 baseline 或修复代码）
 *   2  输入错误（eslint 不可用 / baseline 文件损坏 / 旧版位置指纹格式需重生成）
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface EslintMessage {
  line: number;
  column: number;
  ruleId: string | null;
  message: string;
}
export interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
}

export interface BaselineEntry {
  hash: string;
  rule_id: string;
  file: string;
  line: number;
  reason: string;
}

const BASELINE_PATH = path.resolve(process.cwd(), '.eslintsecurity-baseline.json');

/**
 * 源行读取器：eslint 报告文件绝对路径 + 行号 → 该行文本。
 * 文件不可读（ENOENT/EISDIR 等）或行越界时返回 null（不抛异常、不中断扫描）。
 */
export type ResolveLine = (file: string, line: number) => string | null;

/**
 * 内容敏感指纹（baseline v2）：file + ruleId + 违规行内容（归一化后）。
 * 不包含 line/column —— 行号漂移（上方增删行）不影响指纹；
 * 内容变化（代码模式修改）产生新指纹，触发复审。
 */
export function computeFindingHash(file: string, ruleId: string, sourceLine: string): string {
  return createHash('sha256').update(`${file}\u0000${ruleId}\u0000${sourceLine}`).digest('hex');
}

/**
 * 行内容归一化：去除 CR、首尾空白（含缩进）→ 跨平台（CRLF/LF）与重缩进下指纹稳定。
 */
export function normalizeSourceLine(line: string): string {
  return line.replace(/\r/g, '').trim();
}

/** IO 版源行读取：基于 eslint 报告的文件路径 + 行号，不可读返回 null。 */
export function resolveSourceLine(file: string, line: number): string | null {
  try {
    const raw = readFileSync(file, 'utf-8');
    const content = raw.split(/\r?\n/)[line - 1];
    return content === undefined ? null : content;
  } catch {
    return null;
  }
}

export function diffFindings(
  findings: EslintResult[],
  baseline: BaselineEntry[],
  resolveLine: ResolveLine,
): { newFindings: BaselineEntry[]; baselineHits: number } {
  const baselineHashes = new Set(baseline.map((b) => b.hash));
  const newFindings: BaselineEntry[] = [];
  let baselineHits = 0;
  for (const f of findings) {
    for (const m of f.messages) {
      if (!m.ruleId) continue;
      const rel = path.relative(process.cwd(), f.filePath).split(path.sep).join('/');
      // 源行不可解析时按空内容参与比较（判为新增，不静默吞掉）
      const src = resolveLine(f.filePath, m.line) ?? '';
      const h = computeFindingHash(rel, m.ruleId, normalizeSourceLine(src));
      if (baselineHashes.has(h)) {
        baselineHits++;
      } else {
        newFindings.push({
          hash: h,
          rule_id: m.ruleId,
          file: rel,
          line: m.line,
          reason: 'New finding not in baseline',
        });
      }
    }
  }
  return { newFindings, baselineHits };
}

/** baseline v2 文件结构（内容敏感指纹） */
export interface BaselineFile {
  version: 2;
  algo: 'content-line';
  entries: BaselineEntry[];
}

/**
 * 由 eslint 发现集合构建 baseline entries（v2 重生成用）。
 * 按 hash 去重（同类合并豁免）；按 file:line 排序保证确定性；reason 取 eslint 消息文本。
 */
export function buildBaselineEntries(
  findings: EslintResult[],
  resolveLine: ResolveLine,
): BaselineEntry[] {
  const seen = new Set<string>();
  const entries: BaselineEntry[] = [];
  for (const f of findings) {
    for (const m of f.messages) {
      if (!m.ruleId) continue;
      const rel = path.relative(process.cwd(), f.filePath).split(path.sep).join('/');
      const src = resolveLine(f.filePath, m.line) ?? '';
      const h = computeFindingHash(rel, m.ruleId, normalizeSourceLine(src));
      if (seen.has(h)) continue;
      seen.add(h);
      entries.push({ hash: h, rule_id: m.ruleId, file: rel, line: m.line, reason: m.message });
    }
  }
  entries.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return entries;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const regenerate = args.includes('--regenerate');

  const r = spawnSync('npx', ['eslint', 'w-model-dev/scripts/', '--format', 'json'], {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0 && !r.stdout) {
    console.error(`✗ eslint 执行失败: ${r.stderr}`);
    process.exit(2);
  }
  let findings: EslintResult[];
  try {
    findings = JSON.parse(r.stdout || '[]') as EslintResult[];
  } catch {
    console.error(`✗ eslint 输出不是合法 JSON，无法解析（前 200 字符）: ${String(r.stdout).slice(0, 200)}`);
    process.exit(2);
  }

  // --regenerate：以当前发现全量重建 baseline v2（不依赖既有 baseline 文件）
  if (regenerate) {
    const entries = buildBaselineEntries(findings, resolveSourceLine);
    const file: BaselineFile = { version: 2, algo: 'content-line', entries };
    writeFileSync(BASELINE_PATH, JSON.stringify(file, null, 2) + '\n', 'utf-8');
    console.log('═'.repeat(60));
    console.log('Security Scan（baseline v2 重生成）');
    console.log('═'.repeat(60));
    console.log(`version  : 2（内容敏感指纹：file + ruleId + 违规行内容）`);
    console.log(`条目数   : ${entries.length}`);
    console.log(`已写入   : ${BASELINE_PATH}`);
    process.exit(0);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`✗ baseline 文件不存在: ${BASELINE_PATH}`);
    process.exit(2);
  }
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BaselineFile | BaselineEntry[];
  if (Array.isArray(parsed)) {
    console.error('✗ baseline 为旧版数组格式（位置指纹），与当前内容敏感指纹算法不兼容；请运行 --regenerate 重生成 v2');
    process.exit(2);
  }
  if (parsed.version !== 2 || parsed.algo !== 'content-line') {
    console.error(`✗ baseline version=${parsed.version} 不支持（当前仅支持 v2/content-line）；请运行 --regenerate 重生成`);
    process.exit(2);
  }
  const baseline: BaselineEntry[] = parsed.entries;

  const { newFindings, baselineHits } = diffFindings(findings, baseline, resolveSourceLine);

  console.log('═'.repeat(60));
  console.log('Security Scan（借鉴 drawio-skill skillspector-baseline）');
  console.log('═'.repeat(60));
  console.log(`baseline 指纹数 : ${baseline.length}`);
  console.log(`已豁免发现数   : ${baselineHits}`);
  console.log(`新增发现数     : ${newFindings.length}`);
  if (newFindings.length > 0) {
    console.log('\n新增风险详情：');
    for (const n of newFindings) {
      console.log(`  [${n.rule_id}] ${n.file}:${n.line} (${n.hash.slice(0, 8)})`);
    }
    console.log('\n修复方案：');
    console.log('  1. 修复代码消除风险');
    console.log('  2. 或运行 --regenerate 全量重生成 baseline 豁免');
    process.exit(1);
  }
  console.log('\n✓ 无新增安全风险');
  process.exit(0);
}

// Windows 兼容的 main 模块判断：
//   - import.meta.url 是 file:///D:/... URL 格式
//   - process.argv[1] 是 Windows 路径 D:\... 或 POSIX 路径
//   用 fileURLToPath + path.resolve 归一化两端再比较，避免斜杠方向 / 盘符大小写差异。
const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
