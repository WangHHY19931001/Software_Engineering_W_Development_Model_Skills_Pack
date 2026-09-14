/**
 * L0 载体定量预算断言（S30）。读取真实 `w-model-dev/` 技能包
 * （先例：l0-link-audit-logic.test.ts「audits the real skill package without hiding L0 boundaries」）。
 *
 * 权威阈值来源：references/asset-authoring.md §5「数字阈值」（:63-72）——本文件的 ASSET_BUDGET
 * 只是把该散文阈值变成确定性上限断言，不是第二权威；改阈值先改 asset-authoring.md §5
 * （单一权威位置），再带实测依据更新此处常量与注释，两处同一次提交完成。
 *
 * 这些断言的价值在「钉住上限防未来膨胀」：每个常量都显著高于当前实测值但紧到有意义，
 * 不是现状描述。注释写明「阈值来源 + 当前实测值」，rebaseline 注释风格照
 * helpers/l0-baseline.ts（增量来历 + 实测日期 + 影响到的字段）。
 *
 * 词数类阈值（asset-authoring.md §5 :70-72 的 <150/<200/<500 词）有意不断言：中文字数无
 * 可靠的确定性度量（P2-B 计划 §0.1.3 范围裁定，按 S04「不编码不可测物」精神）。
 *
 * 本测试纯 fs 读取、无子进程 → 落 vitest unit-parallel project，
 * 无需登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES（vitest-project-split 双向守护）。
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SKILL_ROOT = path.join(REPO_ROOT, 'w-model-dev');
const REFERENCES_DIR = path.join(SKILL_ROOT, 'references');
const SKILL_MD = path.join(SKILL_ROOT, 'SKILL.md');

/** 按行切分，去掉末尾单个空元素（与 wc -l 对以换行结尾的文件计数一致）。 */
function toLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/** 去掉 YAML frontmatter（首个 --- 界定块）后的正文行。无 frontmatter 时返回原行集。 */
function stripFrontmatter(lines: string[]): string[] {
  if (lines[0] !== '---') {
    return lines;
  }
  for (let i = 1; i < lines.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i is an integer index over the local frontmatter line array
    if (lines[i] === '---') {
      return lines.slice(i + 1);
    }
  }
  return lines;
}

interface FenceBlock {
  startLine: number;
  endLine: number;
  /** 含开口栏行与闭栏行（端点计入）——代表该代码块占用的完整上下文行数。 */
  lineCount: number;
}

/** 扫描围栏代码块（``` 或 ~~~，闭栏须与开栏同字符）。返回块列表与是否存在未闭合围栏。 */
function scanFenceBlocks(lines: string[]): { blocks: FenceBlock[]; unclosed: boolean } {
  const blocks: FenceBlock[] = [];
  let open: { char: string; start: number } | undefined;
  for (const [index, line] of lines.entries()) {
    const fence = line.match(/^\s{0,3}(```|~~~)/)?.[1];
    if (!fence) {
      continue;
    }
    if (!open) {
      open = { char: fence, start: index + 1 };
    } else if (fence === open.char) {
      blocks.push({ startLine: open.start, endLine: index + 1, lineCount: index + 1 - open.start + 1 });
      open = undefined;
    }
  }
  return { blocks, unclosed: open !== undefined };
}

/**
 * TOC 判定——仓内实测既有形态，不发明文件里没有的新形态：
 * 存在一个 ATX 二级标题「## 目录」节，节内含 ≥3 条 Markdown 列表项。
 * 列表项两种形态均为实测既有形态：
 *   - 纯文本标签（subagent-delegation.md:392 / data-models.md:53 / verifier-spec.md:55 /
 *     asset-authoring.md:9 的既有 TOC 全为此形态）；
 *   - 指向本文锚点的链接（tla-plus.md / bdd.md 按 P2-B Task 3 补入的标题链接列表形态，
 *     锚点链接先例见 tla-plus.md「13. 参考资料」节内表格与 bdd.md「下级内容节」行）。
 * 节在下一个 ATX 标题处结束。
 */
function hasTocSection(lines: string[]): boolean {
  const tocIndex = lines.findIndex((line) => /^## 目录\s*$/.test(line));
  if (tocIndex < 0) {
    return false;
  }
  let items = 0;
  for (const line of lines.slice(tocIndex + 1)) {
    if (/^#{1,6} /.test(line)) {
      break;
    }
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      items++;
    }
  }
  return items >= 3;
}

/**
 * L0 载体定量预算（全部为**上限**；rebaseline 注释风格照 helpers/l0-baseline.ts）。
 */
const ASSET_BUDGET = {
  // asset-authoring.md §5 :65「SKILL.md body < 500 行」→ 上限 499（正文不含 frontmatter）。
  // 当前实测 124 行（frontmatter :1-10、正文 :11-134；2026-09-15 P2-B Task 3 实测）。
  skillBodyMaxLines: 499,
  // asset-authoring.md §5 :67「代码 / 内容 < 50 行保持内联」→ SKILL.md 单个围栏代码块上限
  // 50 行（开口栏行到闭栏行端点计入）。当前实测围栏代码块 0 个（2026-09-15 实测；
  // 本预算为前瞻性上限——首个内联代码块出现时即受约束，防止编排主文件被代码淹没）。
  skillFenceMaxLines: 50,
  // asset-authoring.md §5 :66「100+ 行的重参考内容须落到独立文件」+ :69「> 100 行的参考文件
  // 在顶部加目录（TOC）」→ 每文件上限 2500。
  // 当前实测最大 tla-plus.md = 2295 行（2026-09-15 P2-B Task 3 实测，含该次补入的目录节）。
  referenceFileMaxLines: 2500,
  // references 文件数上限。当前实测 43 个 .md；预算 48 留 5 个新增余量（2026-09-15 实测）。
  referenceMaxFileCount: 48,
  // references 总行数上限。当前实测 16442 行（2026-09-15 P2-B Task 3 实测，含 Task 1 对
  // hard-constraints.md 的 S27 链接增行与 Task 3 补入的两个目录节）。
  referenceTotalMaxLines: 20000,
  // asset-authoring.md §5 :68「引用只允许一层深」的结构性表达：references 保持平坦无子目录。
  // 当前实测 0 个子目录（2026-09-15 实测）。
  referenceMaxSubdirectoryCount: 0,
  // asset-authoring.md §5 :69「> 100 行的参考文件在顶部加目录（TOC）」——按 P2-B 计划 §0.1.3
  // 范围裁定只对 >1000 行的文件断言。当前实测 5 个：tla-plus 2295 / bdd 1784 /
  // subagent-delegation 1617 / data-models 1042 / verifier-spec 1026（2026-09-15 实测）。
  tocRequiredAboveLines: 1000,
} as const;

describe('L0 载体定量预算（S30，真实包上限断言）', () => {
  it('SKILL.md 正文行数不超过预算上限', async () => {
    const content = await fs.readFile(SKILL_MD, 'utf8');
    const bodyLines = stripFrontmatter(toLines(content));

    expect(bodyLines.length).toBeLessThanOrEqual(ASSET_BUDGET.skillBodyMaxLines);
  });

  it('SKILL.md 单个围栏代码块不超过预算上限且无未闭合围栏', async () => {
    const content = await fs.readFile(SKILL_MD, 'utf8');
    const { blocks, unclosed } = scanFenceBlocks(toLines(content));

    // 当前实测 0 个围栏代码块：本断言的前瞻价值由一次性收紧验证覆盖（见任务报告）。
    for (const block of blocks) {
      expect(block.lineCount).toBeLessThanOrEqual(ASSET_BUDGET.skillFenceMaxLines);
    }
    expect(unclosed).toBe(false);
  });

  it('references 文件数、子目录数与总行数不超过预算上限', async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- REFERENCES_DIR is a module-level constant beneath the in-repo skill package
    const entries = await fs.readdir(REFERENCES_DIR, { withFileTypes: true });
    const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
    const subdirectories = entries.filter((entry) => entry.isDirectory());

    expect(markdownFiles.length).toBeLessThanOrEqual(ASSET_BUDGET.referenceMaxFileCount);
    expect(subdirectories.length).toBeLessThanOrEqual(ASSET_BUDGET.referenceMaxSubdirectoryCount);

    let totalLines = 0;
    for (const file of markdownFiles) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file.name comes from readdir of the constant REFERENCES_DIR
      const content = await fs.readFile(path.join(REFERENCES_DIR, file.name), 'utf8');
      totalLines += toLines(content).length;
    }

    expect(totalLines).toBeLessThanOrEqual(ASSET_BUDGET.referenceTotalMaxLines);
  });

  it('references 每个文件行数不超过预算上限', async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- REFERENCES_DIR is a module-level constant beneath the in-repo skill package
    const entries = await fs.readdir(REFERENCES_DIR, { withFileTypes: true });
    const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

    for (const file of markdownFiles) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file.name comes from readdir of the constant REFERENCES_DIR
      const content = await fs.readFile(path.join(REFERENCES_DIR, file.name), 'utf8');

      expect(toLines(content).length).toBeLessThanOrEqual(ASSET_BUDGET.referenceFileMaxLines);
    }
  });

  it('超过 1000 行的 references 须有目录（TOC）', async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- REFERENCES_DIR is a module-level constant beneath the in-repo skill package
    const entries = await fs.readdir(REFERENCES_DIR, { withFileTypes: true });
    const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
    const oversized: string[] = [];

    for (const file of markdownFiles) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file.name comes from readdir of the constant REFERENCES_DIR
      const content = await fs.readFile(path.join(REFERENCES_DIR, file.name), 'utf8');
      if (toLines(content).length > ASSET_BUDGET.tocRequiredAboveLines) {
        oversized.push(file.name);
        expect(hasTocSection(toLines(content))).toBe(true);
      }
    }

    // 守卫断言：阈值判定必须真的罩住当前 5 个大文件，防止阈值/口径漂移使本测试空转。
    expect(oversized.sort()).toEqual([
      'bdd.md',
      'data-models.md',
      'subagent-delegation.md',
      'tla-plus.md',
      'verifier-spec.md',
    ]);
  });
});
