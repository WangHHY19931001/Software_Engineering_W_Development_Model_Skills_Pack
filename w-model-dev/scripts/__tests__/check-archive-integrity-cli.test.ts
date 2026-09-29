/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时归档树（join(root, ...) 路径由测试自生成） */
/**
 * check-archive-integrity-cli.test.ts —— 归档完整性 CLI 子进程端到端契约
 * （2026-09-21 最终评审 I-4：codingPlanSnapshot 显式入口 + 判定依据可见性）
 *
 * 覆盖（真实 `npx tsx check-archive-integrity.ts` 子进程，非纯逻辑直调）：
 *   1. `--change-id=<id>` 显式声明 + 归档根快照齐（`<changeId>.plan.md` + `progress.md` + `Task N: complete`
 *      三件套）→ exit 0，且 `snapshotSource` 明示「显式」（该项**已执行**，不是 no-op）
 *   2. `--change-id=<id>` 显式声明 + 快照缺失 → exit 1，`[codingPlanSnapshot]` 前缀具名缺失文件
 *   3. 子目录摆放（plan 快照在 `<changeId>/` 子目录而非归档根）：未传 flag 时按既有自动派生语义
 *      = 零匹配 → 本项不适用（输出**明示判定依据**，不静默）；传 flag 时不得静默放过（exit 1）
 *   4. 传错 changeId → exit 1（不得因为根上另有 *.plan.md 而放过）
 *   5. 参数错误三态：裸 `--change-id`（空格形态）/ `--change-id=`（空值）/ 重复 flag → exit 2 ARG_INVALID
 *   6. G3-14 归档清单绝对路径**非阻断诊断**（archive-manifest.json 的 files[] 含疑似本机绝对路径 →
 *      人类段「非阻断诊断」+ `--json` diagnostics 透传；0 命中 / 未提供清单不打；退出码语义不变）
 *
 * 全部经 runSync 包装（lib/run-sync.ts），不直接触碰 child_process。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ARCHIVE_INTEGRITY_CHECKLIST } from '../logic/archive-integrity-logic.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = resolve(fileURLToPath(import.meta.url), '..');
const CLI = resolve(TEST_DIR, '../cli/check-archive-integrity.ts');

const CHANGE_ID = 'phase5-demo';
const PLAN_SNAPSHOT = `${CHANGE_ID}.plan.md`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wm-archive-integrity-cli-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function runCli(args: string[]): {
  code: number | null;
  stdout: string;
  stderr: string;
} {
  const r = runSync(process.execPath, [tsxCli, CLI, ...args], {
    timeout: 30_000,
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function errorCategory(stdout: string): string | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('ERROR_JSON '));
  if (line === undefined) return null;
  try {
    return (JSON.parse(line.slice('ERROR_JSON '.length)) as { category?: string }).category ?? null;
  } catch {
    return null;
  }
}

/**
 * 物化「各阶段强制快照清单」全部条目（**直接读 ARCHIVE_INTEGRITY_CHECKLIST**，
 * 避免测试自带第二份清单而随门禁清单漂移）。
 */
function materializeChecklist(dir: string): void {
  for (const [phase, required] of Object.entries(ARCHIVE_INTEGRITY_CHECKLIST)) {
    if (phase === 'global') continue; // global 条目与阶段条目同形，阶段循环已覆盖
    for (const entry of required) {
      if (entry.endsWith('/')) {
        mkdirSync(join(dir, entry.slice(0, -1)), { recursive: true });
        writeFileSync(join(dir, entry.slice(0, -1), 'placeholder.md'), '# placeholder\n');
      } else if (entry.endsWith('-')) {
        writeFileSync(join(dir, `${entry}1.json`), '{}\n');
      } else {
        writeFileSync(join(dir, entry), '{}\n');
      }
    }
  }
  for (const entry of ARCHIVE_INTEGRITY_CHECKLIST.global ?? []) {
    if (entry.endsWith('/')) {
      mkdirSync(join(dir, entry.slice(0, -1)), { recursive: true });
      writeFileSync(join(dir, entry.slice(0, -1), 'placeholder.json'), '{}\n');
    } else if (entry.endsWith('-')) {
      writeFileSync(join(dir, `${entry}1.json`), '{}\n');
    } else {
      writeFileSync(join(dir, entry), '{}\n');
    }
  }
}

/** 铺一个「清单齐 + 快照齐」的归档根 */
function writeFullArchive(dir: string, changeId = CHANGE_ID): void {
  mkdirSync(dir, { recursive: true });
  materializeChecklist(dir);
  writeFileSync(join(dir, `${changeId}.plan.md`), '# plan snapshot\n\n## 目标\n\nx\n');
  writeFileSync(join(dir, 'progress.md'), '# SDD ledger — plan: docs/plans/x.plan.md\n\nTask 1: complete\n');
  writeFileSync(join(dir, 'task-1-brief.md'), '# brief\n');
  writeFileSync(join(dir, 'task-1-report.md'), '# report\n');
}

describe('check-archive-integrity CLI：codingPlanSnapshot 显式入口（I-4b）', () => {
  it('显式 --change-id + 快照齐 → exit 0，且判定依据明示「显式」（该项已执行，非 no-op）', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    const r = runCli([archive, `--change-id=${CHANGE_ID}`, '--json']);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.stdout) as {
      passed: boolean;
      reasons: string[];
      snapshotSource: string;
    };
    expect(report.passed).toBe(true);
    expect(report.reasons).toEqual([]);
    expect(report.snapshotSource).toContain(`显式 --change-id=${CHANGE_ID}`);
    expect(report.snapshotSource).toContain('无条件启用');
  });

  it('显式 --change-id + plan 快照缺失 → exit 1 且 [codingPlanSnapshot] 具名缺失文件', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    rmSync(join(archive, PLAN_SNAPSHOT), { force: true });
    const r = runCli([archive, `--change-id=${CHANGE_ID}`]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`[codingPlanSnapshot] ${PLAN_SNAPSHOT}`);
    expect(r.stdout).toContain('快照判定依据');
  });

  it('显式 --change-id + Task N: complete 三件套缺失 → exit 1（progress.md 内容被实读核验）', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    rmSync(join(archive, 'task-1-report.md'), { force: true });
    const r = runCli([archive, `--change-id=${CHANGE_ID}`, '--json']);
    expect(r.code).toBe(1);
    const report = JSON.parse(r.stdout) as { reasons: string[] };
    expect(report.reasons.some((m) => m.includes('[codingPlanSnapshot] task-1-report.md'))).toBe(true);
  });

  it('传错 changeId → exit 1（根上有别的 *.plan.md 也不放过）', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    const r = runCli([archive, '--change-id=phase5-other', '--json']);
    expect(r.code).toBe(1);
    const report = JSON.parse(r.stdout) as { reasons: string[] };
    expect(report.reasons).toContain('[codingPlanSnapshot] phase5-other.plan.md（归档计划快照缺失）');
  });

  it('子目录摆放：未传 flag 时明示「零匹配 → 本项不适用」（不静默），传 flag 时 exit 1', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    // 把 plan 快照挪进子目录（自动派生看不见它）
    const sub = join(archive, CHANGE_ID);
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, PLAN_SNAPSHOT), '# nested\n');
    rmSync(join(archive, PLAN_SNAPSHOT), { force: true });

    const auto = runCli([archive, '--json']);
    expect(auto.code).toBe(0); // 向后兼容：既有行为不变
    const autoReport = JSON.parse(auto.stdout) as { snapshotSource: string };
    expect(autoReport.snapshotSource).toContain('自动派生');
    expect(autoReport.snapshotSource).toContain('零匹配 → 本项不适用');

    const explicit = runCli([archive, `--change-id=${CHANGE_ID}`]);
    expect(explicit.code).toBe(1);
    expect(explicit.stdout).toContain(`[codingPlanSnapshot] ${PLAN_SNAPSHOT}`);
  });

  it('自动派生 + 恰一 *.plan.md → exit 0，判定依据明示「恰一 → changeId=<id>」', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    const r = runCli([archive, '--json']);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.stdout) as { snapshotSource: string };
    expect(report.snapshotSource).toContain(`恰一 → changeId=${CHANGE_ID}`);
  });

  it('自动派生 + 多个 *.plan.md → changeId 不猜、fail-closed（exit 1）', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    writeFileSync(join(archive, 'phase5-other.plan.md'), '# other\n');
    const r = runCli([archive, '--json']);
    expect(r.code).toBe(1);
    const report = JSON.parse(r.stdout) as {
      reasons: string[];
      snapshotSource: string;
    };
    expect(report.snapshotSource).toContain('多匹配 → changeId 不猜、fail-closed');
    expect(report.reasons.some((m) => m.includes('*.plan.md 多匹配'))).toBe(true);
  });
});

describe('check-archive-integrity CLI：--change-id 参数错误三态（exit 2 / ARG_INVALID）', () => {
  it('--change-id 参数错误四态（裸形态 / 空值 / 重复 / 缺目录）→ exit 2 ARG_INVALID', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    for (const [caseName, args, stderrMarker] of [
      ['裸 --change-id（空格形态）', [archive, '--change-id', CHANGE_ID], '等号形态'],
      ['--change-id=（空值）', [archive, '--change-id='], '不得为空'],
      ['重复 --change-id', [archive, '--change-id=a', '--change-id=b'], '重复'],
      ['缺 <archive-dir>', [`--change-id=${CHANGE_ID}`], null],
    ] as const) {
      const r = runCli([...args]);
      expect(r.code, `${caseName}: 应 exit 2`).toBe(2);
      expect(errorCategory(r.stdout), `${caseName}: ERROR_JSON category`).toBe('ARG_INVALID');
      if (stderrMarker !== null) {
        expect(r.stderr, `${caseName}: stderr 应含「${stderrMarker}」`).toContain(stderrMarker);
      }
    }
  });
});

// ==================== 归档前缀性（L4：--live-run-log） ====================
// 归档内 run-log.jsonl 快照必须是 live run-log 的记录边界前缀；未提供该参数时只出非阻断诊断，
// 退出码语义不变（向后兼容硬线）。

describe('check-archive-integrity CLI：归档前缀性（L4，--live-run-log）', () => {
  const ARCHIVED_TEXT = `${JSON.stringify({ runId: 'a', note: '放行' })}\n`;
  const LIVE_TEXT = `${ARCHIVED_TEXT}${JSON.stringify({ runId: 'b', note: '放行后新增' })}\n`;

  /** 铺归档根 + 写入归档快照 run-log.jsonl（覆盖 writeFullArchive 的占位内容）与 live run-log */
  function seedRunLogs(archiveText: string, liveText: string): { archive: string; live: string } {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    writeFileSync(join(archive, 'run-log.jsonl'), archiveText);
    const live = join(tmpDir, 'live-run-log.jsonl');
    writeFileSync(live, liveText);
    return { archive, live };
  }

  it('前缀性通过行（归档快照是 live 的记录边界前缀）→ exit 0，输出明示前缀性校验已执行', () => {
    const { archive, live } = seedRunLogs(ARCHIVED_TEXT, LIVE_TEXT);
    const r = runCli([archive, `--live-run-log=${live}`, '--json']);
    expect(r.code, '通过行: 应 exit 0').toBe(0);
    const report = JSON.parse(r.stdout) as { passed: boolean; reasons: string[]; runLogPrefix: string };
    expect(report.passed, '通过行: passed 应为 true').toBe(true);
    expect(report.reasons, '通过行: 应零 reasons').toEqual([]);
    expect(report.runLogPrefix, '通过行: 应明示「记录边界前缀」').toContain('记录边界前缀');
    expect(report.runLogPrefix, '通过行: 应明示「是 live」').toContain('是 live');
  });

  it('前缀性违规行（3 态：中途截断 / 空快照 / 非 live 前缀）→ exit 1 且 [runLogPrefix] 具名', () => {
    for (const [caseName, archivedText, liveText, expectMidRecord, expectEmpty, expectPassedFalse] of [
      [
        '第 N 行中途截断（是前缀但不在记录边界，A1 收紧前会假通过）',
        LIVE_TEXT.replace(/\n$/, ''),
        LIVE_TEXT,
        true,
        false,
        true,
      ],
      ['空归档快照（0 字节，A1 收紧不再假通过）', '', LIVE_TEXT, false, true, false],
      ['归档快照非 live 前缀（live 侧被截断/重排）', LIVE_TEXT, ARCHIVED_TEXT, false, false, true],
    ] as const) {
      const { archive, live } = seedRunLogs(archivedText, liveText);
      const human = runCli([archive, `--live-run-log=${live}`]);
      expect(human.code, `${caseName}: 应 exit 1`).toBe(1);
      expect(human.stdout, `${caseName}: 应含 [runLogPrefix]`).toContain('[runLogPrefix]');

      const json = runCli([archive, `--live-run-log=${live}`, '--json']);
      expect(json.code, `${caseName}: json 模式应 exit 1`).toBe(1);
      const report = JSON.parse(json.stdout) as { passed: boolean; reasons: string[] };
      expect(
        report.reasons.some((m) => m.includes('[runLogPrefix]')),
        `${caseName}: reasons 应含 [runLogPrefix]`,
      ).toBe(true);
      if (expectPassedFalse) {
        expect(report.passed, `${caseName}: passed 应为 false`).toBe(false);
      }
      if (expectMidRecord) {
        expect(
          report.reasons.some((m) => m.includes('记录中途')),
          `${caseName}: 应区分「记录中途」`,
        ).toBe(true);
        expect(
          report.reasons.some((m) => m.includes('不是 live run-log 的记录边界前缀')),
          `${caseName}: 不应出现笼统非前缀文案`,
        ).toBe(false);
      }
      if (expectEmpty) {
        expect(human.stdout, `${caseName}: 人类段应含「快照为空」`).toContain('快照为空');
        expect(
          report.reasons.some((m) => m.includes('快照为空')),
          `${caseName}: reasons 应含「快照为空」`,
        ).toBe(true);
      }
    }
  });

  it('未传 --live-run-log → exit 0 + 非阻断诊断（既有退出码语义不变）', () => {
    const { archive } = seedRunLogs(LIVE_TEXT, ARCHIVED_TEXT);
    const r = runCli([archive, '--json']);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.stdout) as { passed: boolean; runLogPrefix: string };
    expect(report.passed).toBe(true);
    expect(report.runLogPrefix).toContain('未提供 --live-run-log');
    expect(report.runLogPrefix).toContain('非阻断');
  });

  it('live run-log 文件不存在 → exit 2 FILE_NOT_FOUND（显式声明的输入不得静默降级）', () => {
    const { archive } = seedRunLogs(ARCHIVED_TEXT, LIVE_TEXT);
    const r = runCli([archive, `--live-run-log=${join(tmpDir, 'nope.jsonl')}`]);
    expect(r.code).toBe(2);
    expect(errorCategory(r.stdout)).toBe('FILE_NOT_FOUND');
  });

  it('--live-run-log 参数错误三态（空值 / 裸形态 / 重复）→ exit 2 ARG_INVALID', () => {
    const { archive, live } = seedRunLogs(ARCHIVED_TEXT, LIVE_TEXT);
    for (const args of [
      [archive, '--live-run-log='],
      [archive, '--live-run-log', live],
      [archive, `--live-run-log=${live}`, `--live-run-log=${live}`],
    ]) {
      const r = runCli(args);
      expect(r.code).toBe(2);
      expect(errorCategory(r.stdout)).toBe('ARG_INVALID');
      expect(r.stderr).toContain('--live-run-log');
    }
  });
});

// ==================== 归档清单绝对路径诊断（G3-14） ====================
// 归档根 `archive-manifest.json` 的 files[] 条目含疑似本机绝对路径时输出非阻断诊断（不改退出码）。
// 归档允许保留执行证据原貌，但交付/外发前必须经 wm-export-evidence 脱敏导出。

describe('check-archive-integrity CLI：归档清单绝对路径非阻断诊断（G3-14）', () => {
  /** 铺归档根（清单齐 + plan 快照齐）并写归档清单 archive-manifest.json */
  function seedArchiveManifest(files: unknown[]): string {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    writeFileSync(join(archive, 'archive-manifest.json'), JSON.stringify({ schemaVersion: '1.0', files }));
    return archive;
  }

  it('清单含本机绝对路径条目 → exit 0 + 人类段「非阻断诊断」+ --json diagnostics 透传', () => {
    const archive = seedArchiveManifest([
      { path: 'C:\\ws\\proj\\.w-model\\gate-logs\\phase-8.json', kind: 'gate-log' },
      { path: 'D:\\ws\\proj\\.w-model\\run-log.jsonl', kind: 'run-log' },
      { path: 'gate-logs/graph-gate.json', kind: 'gate-log' },
    ]);
    const human = runCli([archive, `--change-id=${CHANGE_ID}`]);
    expect(human.code).toBe(0); // 纯诊断：不阻断
    expect(human.stdout).toContain('非阻断诊断：');
    expect(human.stdout).toContain(
      '归档清单含 2 条疑似本机绝对路径条目——交付前须经 wm-export-evidence 脱敏导出（归档仅受控留档）',
    );

    const json = runCli([archive, `--change-id=${CHANGE_ID}`, '--json']);
    expect(json.code).toBe(0);
    const report = JSON.parse(json.stdout) as { passed: boolean; diagnostics?: string[] };
    expect(report.passed).toBe(true);
    expect(report.diagnostics).toEqual([
      '归档清单含 2 条疑似本机绝对路径条目——交付前须经 wm-export-evidence 脱敏导出（归档仅受控留档）',
    ]);
  });

  it('清单全为相对路径 → exit 0 且不打诊断（`diagnostics` 键不出现，0 命中不打）', () => {
    const archive = seedArchiveManifest(['requirements.md', { path: 'gate-logs/graph-gate.json' }]);
    const human = runCli([archive, `--change-id=${CHANGE_ID}`]);
    expect(human.code).toBe(0);
    expect(human.stdout).not.toContain('非阻断诊断：');

    const json = runCli([archive, `--change-id=${CHANGE_ID}`, '--json']);
    const report = JSON.parse(json.stdout) as { passed: boolean; diagnostics?: string[] };
    expect(report.passed).toBe(true);
    expect(report.diagnostics).toBeUndefined();
  });

  it('归档根无 archive-manifest.json（未提供清单）→ exit 0 且零诊断（退出码语义不变）', () => {
    const archive = join(tmpDir, 'archive');
    writeFullArchive(archive);
    const json = runCli([archive, `--change-id=${CHANGE_ID}`, '--json']);
    expect(json.code).toBe(0);
    const report = JSON.parse(json.stdout) as { passed: boolean; diagnostics?: string[] };
    expect(report.passed).toBe(true);
    expect(report.diagnostics).toBeUndefined();
  });

  it('诊断与既有失败路径并存：清单缺失（exit 1）时诊断照出但不改退出码', () => {
    const archive = seedArchiveManifest(['C:\\ws\\leak.json']);
    rmSync(join(archive, 'requirements.md'), { force: true }); // 既有 blocking 违规
    const json = runCli([archive, `--change-id=${CHANGE_ID}`, '--json']);
    expect(json.code).toBe(1); // 退出码仍由 missingFiles 决定
    const report = JSON.parse(json.stdout) as { passed: boolean; reasons: string[]; diagnostics?: string[] };
    expect(report.passed).toBe(false);
    expect(report.reasons.some((m) => m.includes('requirements.md'))).toBe(true);
    expect(report.diagnostics).toHaveLength(1);
  });
});
