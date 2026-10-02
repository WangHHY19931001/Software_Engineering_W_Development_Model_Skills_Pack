/* eslint-disable security/detect-non-literal-fs-filename -- fixture 均建于测试自有的 mkdtemp 临时目录，路径为运行期非字面量 */
/**
 * check-design-fog CLI 三态契约测试（批次 2 任务 2，设计期迷雾登记册 A3）。
 *
 * 覆盖：
 *   - exit 0：合法无雾标记文档 → stdout 单行 `FOG_JSON`（type/passed/fogStats/phase 形状）；
 *   - exit 1：未终结迷雾项（处置结果空）→ FOG_JSON.passed=false 且 violations 规则计数
 *     分布恰为 [{rule:'R4',count:1}]；
 *   - exit 2：缺参 / 坏 phase / 文件不存在 / 未知 flag（--d4-invalid-argument 与中心
 *     exit-2 探针同款）/ 重复值 flag → ARG_INVALID|FILE_NOT_FOUND，
 *     stdout ERROR_JSON + stderr `✗ [`（零副作用）。
 *
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。runSync 强制 timeout/SIGKILL；60s 理由同
 * check-coverage-scope.test.ts（tsx 冷启动在满载下可超 runSync 缺省 15s）。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLI = path.join(REPO_ROOT, 'w-model-dev/scripts/cli/check-design-fog.ts');

const GOOD = `# 文档\n\n## 10. 设计边界与非目标\n\n### 迷雾登记册\n\n本阶段无未终结迷雾项\n`;
const BAD = `# 文档\n\n## 迷雾登记册\n\n| 迷雾项 ID | 模糊描述 | 疑点（无法精确陈述的部分） | 疑似归属（SD 候选） | 毕业方向（设计项 / 非目标 / 需求级回退） | 毕业处置结果 |\n|---|---|---|---|---|---|\n| FOG-P2-01 | 描述 | 依赖未定 | SD-001 | 设计项 |  |\n`;

interface RunResult {
  code: number;
  jsonLine: string | undefined;
  stderr: string;
  dir: string;
}

function run(args: string[], doc?: string, content?: string): RunResult {
  const dir = mkdtempSync(path.join(tmpdir(), 'design-fog-'));
  if (doc && content !== undefined) writeFileSync(path.join(dir, doc), content, 'utf8');
  // 占位符 __DOC__ 于 token 内替换为临时文档绝对路径（`--doc=__DOC__` → `--doc=<tmpdir>/design.md`）
  const resolved = args.map((a) => a.replace('__DOC__', path.join(dir, doc ?? '')));
  const r = runSync(process.execPath, [tsxCli, CLI, ...resolved], {
    cwd: REPO_ROOT,
    timeout: 60_000,
  });
  const jsonLine = (r.stdout ?? '')
    .split(/\r?\n/)
    .find((l) => l.startsWith('FOG_JSON ') || l.startsWith('ERROR_JSON '));
  return { code: r.status ?? -1, jsonLine, stderr: r.stderr ?? '', dir };
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe('check-design-fog CLI 三态', () => {
  it('exit 0：合法无雾标记（--doc --phase=2）且 FOG_JSON 形状正确', () => {
    const { code, jsonLine, dir } = run(['--doc=__DOC__', '--phase=2'], 'design.md', GOOD);
    expect(code).toBe(0);
    const payload = JSON.parse(jsonLine!.slice('FOG_JSON '.length)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: 'design-fog',
      passed: true,
      fogStats: { total: 0, terminal: 0, unresolved: 0 },
      phase: 2,
    });
    cleanup(dir);
  });

  it('exit 1：未终结迷雾项 → FOG_JSON.passed=false 且 violations 规则计数含 R4', () => {
    const { code, jsonLine, dir } = run(['--doc=__DOC__', '--phase=2'], 'design.md', BAD);
    expect(code).toBe(1);
    const payload = JSON.parse(jsonLine!.slice('FOG_JSON '.length)) as {
      passed: boolean;
      violations: Array<{ rule: string; count: number }>;
    };
    expect(payload.passed).toBe(false);
    expect(payload.violations).toEqual([{ rule: 'R4', count: 1 }]);
    cleanup(dir);
  });

  it('exit 2：缺参 / 坏 phase / 文件不存在 / 未知 flag / 重复值 flag → ERROR_JSON + ✗ [', () => {
    for (const args of [['--phase=2'], ['--doc=__DOC__'], ['--doc=__DOC__', '--phase=9'], ['--d4-invalid-argument']]) {
      const { code, jsonLine, stderr, dir } = run(args, 'design.md', GOOD);
      expect(code, args.join(' ')).toBe(2);
      expect(jsonLine).toMatch(/^ERROR_JSON /);
      expect(stderr).toContain('✗ [');
      cleanup(dir);
    }
    const missing = run(['--doc=__DOC__', '--phase=2'], 'nope.md', undefined);
    expect(missing.code).toBe(2);
    expect(missing.jsonLine).toContain('FILE_NOT_FOUND');
    cleanup(missing.dir);
    const dup = run(['--doc=__DOC__', '--doc=__DOC__', '--phase=2'], 'design.md', GOOD);
    expect(dup.code).toBe(2);
    expect(dup.jsonLine).toContain('ARG_INVALID');
    cleanup(dup.dir);
  });
});
