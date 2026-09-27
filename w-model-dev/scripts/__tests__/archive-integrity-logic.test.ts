import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  checkArchiveIntegrity,
  deriveArchiveIntegrityManifest,
  countArchiveManifestAbsolutePaths,
  ARCHIVE_INTEGRITY_CHECKLIST,
  type ArchiveIntegrityManifest,
} from '../logic/archive-integrity-logic.js';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples', 'archive-integrity');

function loadFileList(filename: string): Set<string> {
  const content = readFileSync(path.join(SAMPLES_DIR, filename), 'utf-8');
  return new Set(JSON.parse(content));
}

describe('archive-integrity-logic', () => {
  it('valid-full 通过', () => {
    const contents = loadFileList('valid-full.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
  });

  it('bad-missing-phase1-docs 失败', () => {
    const contents = loadFileList('bad-missing-phase1-docs.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('requirements.md'))).toBe(true);
  });

  it('bad-missing-signature-chain 失败', () => {
    const contents = loadFileList('bad-missing-signature-chain.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('signature-chain.jsonl'))).toBe(true);
  });

  it('bad-missing-gate-logs 失败', () => {
    const contents = loadFileList('bad-missing-gate-logs.json');
    const result = checkArchiveIntegrity(contents);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('gate-logs/'))).toBe(true);
  });

  it('ARCHIVE_INTEGRITY_CHECKLIST 完整性', () => {
    expect(ARCHIVE_INTEGRITY_CHECKLIST['1']).toContain('requirements.md');
    expect(ARCHIVE_INTEGRITY_CHECKLIST['8']).toContain('acceptance-test-report.json');
    expect(ARCHIVE_INTEGRITY_CHECKLIST.global).toContain('signature-chain.jsonl');
  });

  it('非归档根下同名文件不满足 verifier-output- 前缀匹配', () => {
    // 文件在非归档根子目录下，basename 不以 verifier-output- 开头
    const contents = new Set(['some/deep/path/other-verifier-output-1.json']);
    const result = checkArchiveIntegrity(contents, ['global']);
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('verifier-output-'))).toBe(true);
  });
});

// ==================== codingPlanSnapshot 清单项（并入自 check-openspec-archive 退役） ====================

/** valid-full 全集（既有 fixture 的基线清单，零改动复用） */
function loadFullContents(): Set<string> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- SAMPLES_DIR 为测试文件相对固定路径，仅读取仓内 fixture
  const content = readFileSync(path.join(SAMPLES_DIR, 'valid-full.json'), 'utf-8');
  return new Set(JSON.parse(content) as string[]);
}

/** 编码计划归档快照层：plan 快照 + 账本快照 + Task 1/2 三件套 */
function addCodingPlanSnapshot(contents: Set<string>): void {
  contents.add('phase5-demo.plan.md');
  contents.add('progress.md');
  contents.add('task-1-brief.md');
  contents.add('task-1-report.md');
  contents.add('task-2-brief.md');
  contents.add('task-2-report.md');
}

const VALID_PROGRESS_MD =
  '# SDD ledger — plan: docs/plans/phase5-demo.plan.md\n\nTask 1: complete (commit abc1234)\nTask 2: complete\n';

describe('archive-integrity-logic codingPlanSnapshot 清单项', () => {
  it('缺省（无 manifest / codingPlanSnapshot 缺省 false）→ 零行为变化（既有 fixture 硬判据）', () => {
    // valid-full 全集不含任何编码计划快照文件：缺省路径下不得新增任何违规
    const contents = loadFullContents();
    expect(checkArchiveIntegrity(contents).passed).toBe(true);
    expect(checkArchiveIntegrity(contents, undefined, {}).passed).toBe(true);
    expect(checkArchiveIntegrity(contents, undefined, { codingPlanSnapshot: false }).passed).toBe(true);
  });

  it('codingPlanSnapshot=true 且快照齐备 → 通过', () => {
    const contents = loadFullContents();
    addCodingPlanSnapshot(contents);
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      changeId: 'phase5-demo',
      progressMdContent: VALID_PROGRESS_MD,
    });
    expect(result.passed).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
  });

  it('缺 <changeId>.plan.md → fail-closed 且缺失条目具名到文件', () => {
    const contents = loadFullContents();
    contents.add('progress.md');
    contents.add('task-1-brief.md');
    contents.add('task-1-report.md');
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      changeId: 'phase5-demo',
      progressMdContent: 'Task 1: complete\n',
    });
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('phase5-demo.plan.md') && f.includes('归档计划快照缺失'))).toBe(
      true,
    );
  });

  it('缺 progress.md → fail-closed（归档账本快照缺失）', () => {
    const contents = loadFullContents();
    contents.add('phase5-demo.plan.md');
    contents.add('task-1-brief.md');
    contents.add('task-1-report.md');
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      changeId: 'phase5-demo',
    });
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('progress.md') && f.includes('归档账本快照缺失'))).toBe(true);
  });

  it('progress.md 在清单但未提供内容 → fail-closed（调用方契约，不得静默跳过三件套核对）', () => {
    const contents = loadFullContents();
    addCodingPlanSnapshot(contents);
    const result = checkArchiveIntegrity(contents, undefined, { codingPlanSnapshot: true, changeId: 'phase5-demo' });
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('progress.md') && f.includes('内容未提供'))).toBe(true);
  });

  it('每个 Task N: complete 行缺三件套 → 逐文件具名（brief/report 独立报缺）', () => {
    const contents = loadFullContents();
    contents.add('phase5-demo.plan.md');
    contents.add('progress.md');
    contents.add('task-1-brief.md');
    contents.add('task-1-report.md');
    // Task 2 声明 complete 但三件套双双缺失
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      changeId: 'phase5-demo',
      progressMdContent: VALID_PROGRESS_MD,
    });
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('task-2-brief.md'))).toBe(true);
    expect(result.missingFiles.some((f) => f.includes('task-2-report.md'))).toBe(true);
    expect(result.missingFiles.filter((f) => f.includes('task-2-'))).toHaveLength(2);
  });

  it('changeId 缺省时由归档根恰一 *.plan.md 推导', () => {
    const contents = loadFullContents();
    addCodingPlanSnapshot(contents);
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      progressMdContent: VALID_PROGRESS_MD,
    });
    expect(result.passed).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
  });

  it('changeId 缺省且归档根 *.plan.md 多匹配 → fail-closed（恰一语义，平移 check-coding-plan R6）', () => {
    const contents = loadFullContents();
    contents.add('phase5-demo.plan.md');
    contents.add('phase5-demo2.plan.md');
    contents.add('progress.md');
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      progressMdContent: VALID_PROGRESS_MD,
    });
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('多匹配') && f.includes('phase5-demo.plan.md'))).toBe(true);
  });

  it('changeId 缺省且归档根零 *.plan.md → fail-closed（归档计划快照缺失）', () => {
    const contents = loadFullContents();
    contents.add('progress.md');
    const result = checkArchiveIntegrity(contents, undefined, {
      codingPlanSnapshot: true,
      progressMdContent: VALID_PROGRESS_MD,
    });
    expect(result.passed).toBe(false);
    expect(result.missingFiles.some((f) => f.includes('.plan.md') && f.includes('归档计划快照缺失'))).toBe(true);
  });
});

describe('deriveArchiveIntegrityManifest（CLI 清单自动派生）', () => {
  it('归档根恰一 *.plan.md → codingPlanSnapshot=true + changeId 推导', () => {
    const manifest = deriveArchiveIntegrityManifest(new Set(['phase5-demo.plan.md', 'progress.md']));
    expect(manifest.codingPlanSnapshot).toBe(true);
    expect(manifest.changeId).toBe('phase5-demo');
  });

  it('归档根零 *.plan.md → codingPlanSnapshot=false（legacy 归档零行为变化）', () => {
    const manifest = deriveArchiveIntegrityManifest(new Set(['requirements.md', 'progress.md']));
    expect(manifest.codingPlanSnapshot).toBe(false);
    expect(manifest.changeId).toBeUndefined();
  });

  it('归档根多 *.plan.md → codingPlanSnapshot=true 且不猜 changeId（由清单校验侧多匹配 fail-closed 兜底）', () => {
    const manifest = deriveArchiveIntegrityManifest(
      new Set(['phase5-demo.plan.md', 'phase5-demo2.plan.md', 'progress.md']),
    );
    expect(manifest.codingPlanSnapshot).toBe(true);
    expect(manifest.changeId).toBeUndefined();
  });

  it('子目录下的 *.plan.md 不参与推导（快照须在归档根）', () => {
    const manifest = deriveArchiveIntegrityManifest(new Set(['nested/dir/phase5-demo.plan.md']));
    expect(manifest.codingPlanSnapshot).toBe(false);
  });

  it('推导结果直接喂给 checkArchiveIntegrity：齐备通过 / 残缺 fail-closed（端到端闭环）', () => {
    const full = loadFullContents();
    addCodingPlanSnapshot(full);
    const derived = deriveArchiveIntegrityManifest(full);
    expect(checkArchiveIntegrity(full, undefined, { ...derived, progressMdContent: VALID_PROGRESS_MD }).passed).toBe(
      true,
    );

    const broken = loadFullContents();
    broken.add('progress.md');
    const derivedBroken = deriveArchiveIntegrityManifest(broken);
    expect(derivedBroken.codingPlanSnapshot).toBe(false);
    expect(checkArchiveIntegrity(broken, undefined, derivedBroken).passed).toBe(true);
  });
});

// 类型层面守卫：manifest 三字段均可选（编译期断言，防止误改为必填破坏既有 fixture 形态）
const _manifestTypeProbe: ArchiveIntegrityManifest = {};
void _manifestTypeProbe;

// ==================== 归档前缀性（L4，D-3b：--live-run-log 注入文本） ====================
// 归档内 run-log.jsonl 快照必须是 live run-log 的**记录边界前缀**（A1 收紧）：
//   通过 ⇔ `archivedText === liveText`，或（liveText.startsWith(archivedText) 且 archivedText 非空且以 "\n" 结尾）。
// 只做逐字 startsWith 时「第 N 行中途被截断」与「0 字节空快照」都会假通过 → 现按三种形态具名拒绝：
// 非前缀 / 非记录边界（中途截断）/ 空快照。未提供 live 文本时零行为变化（非阻断）。

describe('archive-integrity-logic 归档前缀性（L4）', () => {
  it('归档快照非 live 前缀 → 违规（[runLogPrefix] 并入 missingFiles，passed=false）', () => {
    const r = checkArchiveIntegrity(new Set(['run-log.jsonl']), ['1'], undefined, {
      liveRunLogText: 'A\nB\nC\n',
      archivedRunLogText: 'A\nX\n',
    });
    expect(
      r.missingFiles.some((m) => m.includes('[runLogPrefix]') && m.includes('不是 live run-log 的记录边界前缀')),
    ).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('归档快照是 live 的记录边界前缀（以 \\n 结尾）→ 通过', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {
      liveRunLogText: 'A\nB\nC\n',
      archivedRunLogText: 'A\nB\n',
    });
    expect(r.missingFiles).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it('live == 归档（无新增记录）→ 通过', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {
      liveRunLogText: 'A\nB\n',
      archivedRunLogText: 'A\nB\n',
    });
    expect(r.passed).toBe(true);
  });

  it('第 N 行中途截断（是前缀但不在记录边界）→ 违规且文案区分「非记录边界」', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {
      liveRunLogText: 'A\nB\nC\n',
      archivedRunLogText: 'A\nB',
    });
    expect(r.passed).toBe(false);
    expect(r.missingFiles.some((m) => m.includes('[runLogPrefix]') && m.includes('记录中途'))).toBe(true);
    // 不得与「非前缀」形态混淆（两者根因与处置不同）
    expect(r.missingFiles.some((m) => m.includes('不是 live run-log 的记录边界前缀'))).toBe(false);
  });

  it('中间行中途截断（以多行形态截在行内）→ 违规且文案区分「非记录边界」', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {
      liveRunLogText: '{"runId":"a"}\n{"runId":"b"}\n{"runId":"c"}\n',
      archivedRunLogText: '{"runId":"a"}\n{"runI',
    });
    expect(r.passed).toBe(false);
    expect(r.missingFiles.some((m) => m.includes('[runLogPrefix]') && m.includes('记录中途'))).toBe(true);
  });

  it('空归档文本（0 字节）而 live 有内容 → 违规且文案区分「空快照」（A1 收紧：不再通过）', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {
      liveRunLogText: 'A\nB\n',
      archivedRunLogText: '',
    });
    expect(r.passed).toBe(false);
    expect(r.missingFiles.some((m) => m.includes('[runLogPrefix]') && m.includes('快照为空'))).toBe(true);
  });

  it('空 live + 空归档（两侧皆空）→ 通过（无记录可保护，不构成本项违规）', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {
      liveRunLogText: '',
      archivedRunLogText: '',
    });
    expect(r.passed).toBe(true);
  });

  it('未提供 live 文本 → 零行为变化（既有 3 参调用/缺省路径不新增违规）', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, {});
    expect(r.missingFiles).toEqual([]);
    expect(r.passed).toBe(true);
    expect(checkArchiveIntegrity(loadFullContents()).passed).toBe(true);
  });

  it('提供 live 但归档侧文本未提供 → fail-closed（无法证明前缀性不得静默放过）', () => {
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, { liveRunLogText: 'A\nB\n' });
    expect(r.missingFiles.some((m) => m.includes('[runLogPrefix]'))).toBe(true);
    expect(r.passed).toBe(false);
  });
});

// ==================== 归档清单绝对路径诊断（G3-14） ====================

/**
 * G3-14：归档清单（`archive-manifest.json`）`files[]` 条目中疑似本机绝对路径的**纯诊断**计数。
 * 语义边界：不进 missingFiles、不改 passed / 退出码；未提供清单文本或 0 命中时 `diagnostics` 为空。
 */
describe('archive-integrity-logic 归档清单绝对路径诊断（G3-14）', () => {
  it('countArchiveManifestAbsolutePaths：对象条目取 path（盘符 / POSIX 根 / 反斜杠三形态）各自命中', () => {
    const manifest = JSON.stringify({
      files: [
        { path: 'C:\\ws\\proj\\.w-model\\gate-logs\\phase-8.json', kind: 'gate-log' },
        { path: '/home/user/proj/.w-model/run-log.jsonl', kind: 'run-log' },
        { path: 'gate-logs\\graph-gate.json', kind: 'gate-log' },
        { path: 'gate-logs/graph-gate.json', kind: 'gate-log' }, // 相对 POSIX → 不命中
        { path: './run-log.jsonl', kind: 'run-log' }, // 相对（./ 前缀）→ 不命中
        { sha256: 'x' }, // 无 path → 不命中
      ],
    });
    expect(countArchiveManifestAbsolutePaths(manifest)).toBe(3);
  });

  it('countArchiveManifestAbsolutePaths：字符串条目取自身（装配器 archive-manifest.json 形态）', () => {
    const manifest = JSON.stringify({
      files: ['requirements.md', 'gate-logs/graph-gate.json', 'D:\\archive\\x.json', '\\server\\share'],
    });
    expect(countArchiveManifestAbsolutePaths(manifest)).toBe(2); // 盘符 + UNC 反斜杠
  });

  it('countArchiveManifestAbsolutePaths：非法 JSON / 无 files[] / 非数组条目 → 0（本诊断不做输入校验）', () => {
    expect(countArchiveManifestAbsolutePaths('not json')).toBe(0);
    expect(countArchiveManifestAbsolutePaths('{}')).toBe(0);
    expect(countArchiveManifestAbsolutePaths('{"files": "C:\\\\x"}')).toBe(0);
    expect(countArchiveManifestAbsolutePaths('{"files": [42, null, true]}')).toBe(0);
  });

  it('checkArchiveIntegrity 正例：清单含绝对路径条目 → 一条非阻断诊断，passed / missingFiles 不变', () => {
    const manifestText = JSON.stringify({
      files: [
        { path: 'C:\\ws\\.w-model\\gate-logs\\p8.json', kind: 'gate-log' },
        { path: 'gate-logs/p8.json', kind: 'gate-log' },
      ],
    });
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, undefined, {
      archiveManifestText: manifestText,
    });
    expect(r.diagnostics).toEqual([
      '归档清单含 1 条疑似本机绝对路径条目——交付前须经 wm-export-evidence 脱敏导出（归档仅受控留档）',
    ]);
    expect(r.missingFiles).toEqual([]);
    expect(r.passed).toBe(true); // 纯诊断：不阻断
  });

  it('checkArchiveIntegrity 反例：清单全为相对路径 → 零诊断（0 命中不打）', () => {
    const manifestText = JSON.stringify({ files: ['run-log.jsonl', { path: 'gate-logs/p8.json' }] });
    const r = checkArchiveIntegrity(loadFullContents(), undefined, undefined, undefined, {
      archiveManifestText: manifestText,
    });
    expect(r.diagnostics).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it('checkArchiveIntegrity：未提供清单文本 / 五参缺省 → diagnostics 为空（既有调用零回归）', () => {
    expect(checkArchiveIntegrity(loadFullContents()).diagnostics).toEqual([]);
    expect(checkArchiveIntegrity(loadFullContents(), undefined, undefined, undefined, {}).diagnostics).toEqual([]);
    // 清单文本在场但归档清单缺失违规并存时，诊断与违规互不影响（诊断不进 missingFiles）
    const r = checkArchiveIntegrity(new Set<string>(), undefined, undefined, undefined, {
      archiveManifestText: JSON.stringify({ files: ['C:\\x'] }),
    });
    expect(r.passed).toBe(false); // 清单缺失照常 blocking
    expect(r.diagnostics).toHaveLength(1); // 诊断照常输出
  });
});
