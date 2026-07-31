#!/usr/bin/env tsx
/**
 * 安全扫描集成脚本（Security Scan）
 *
 * 借鉴 drawio-skill/.skillspector-baseline.json 设计：
 *   - 跑 eslint + eslint-plugin-security 扫描 w-model-dev/scripts/
 *   - 已知风险用 .eslintsecurity-baseline.json sha256 指纹豁免
 *   - 新增同规则不同位置的发现才失败
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/security-scan.ts
 *
 * 退出码：
 *   0  无新增风险（baseline 覆盖全部发现）
 *   1  有新增风险（需更新 baseline 或修复代码）
 *   2  输入错误（eslint 不可用 / baseline 文件损坏）
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
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

function fingerprint(file: string, line: number, column: number, ruleId: string): string {
  return createHash('sha256').update(`${file}:${line}:${column}:${ruleId}`).digest('hex');
}

export function diffFindings(
  findings: EslintResult[],
  baseline: BaselineEntry[],
): { newFindings: BaselineEntry[]; baselineHits: number } {
  const baselineHashes = new Set(baseline.map((b) => b.hash));
  const newFindings: BaselineEntry[] = [];
  let baselineHits = 0;
  for (const f of findings) {
    for (const m of f.messages) {
      if (!m.ruleId) continue;
      const rel = path.relative(process.cwd(), f.filePath).split(path.sep).join('/');
      const h = fingerprint(rel, m.line, m.column, m.ruleId);
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

async function main(): Promise<void> {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`✗ baseline 文件不存在: ${BASELINE_PATH}`);
    process.exit(2);
  }
  const baseline: BaselineEntry[] = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));

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
  const { newFindings, baselineHits } = diffFindings(findings, baseline);

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
    console.log('  2. 或把新发现指纹追加到 .eslintsecurity-baseline.json 豁免');
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
