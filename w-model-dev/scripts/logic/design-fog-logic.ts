/**
 * 设计期迷雾登记册校验纯逻辑层（Design Fog Logic，批次 2 A3）
 *
 * 校验设计主文档（阶段 2-4）「迷雾登记册」节的结构与终结态，
 * 供 check-design-fog.ts（CLI）调用。纯函数层约束：不 import Node 内置 IO 模块，
 * 不触碰 process（见 __tests__/README.md「pure/IO 函数边界」）。
 */

export interface DesignFogStats {
  total: number;
  terminal: number;
  unresolved: number;
}

export interface DesignFogCheckResult {
  passed: boolean;
  violations: string[];
  fogStats: DesignFogStats;
}

const FOG_HEADING = /(^#{1,6}\s).*迷雾登记册/;
const MARKER = '本阶段无未终结迷雾项';
const TABLE_COLUMNS = ['迷雾项 ID', '模糊描述', '疑点', '疑似归属', '毕业方向', '毕业处置结果'];
const FOG_ID = (phase: number) => new RegExp(`^FOG-P${phase}-\\d{2,}$`);

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function checkDesignFog(input: { markdown: string; phase: number }): DesignFogCheckResult {
  const violations: string[] = [];
  const lines = input.markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((l) => FOG_HEADING.test(l.trim()));

  if (headingIndex < 0) {
    return {
      passed: false,
      violations: [
        'R1: 设计主文档缺少「迷雾登记册」节（fail-closed：无法区分「无雾」与「被删」；模板已含该节，正常态节必在）',
      ],
      fogStats: { total: 0, terminal: 0, unresolved: 0 },
    };
  }

  const headingLevel = (lines[headingIndex]!.trim().match(/^#+/) ?? ['#'])[0]!.length;
  const sectionLines: string[] = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const m = lines[i]!.trim().match(/^(#+)\s/);
    if (m && m[1]!.length <= headingLevel) break;
    sectionLines.push(lines[i]!);
  }

  const hasMarker = sectionLines.some((l) => l.includes(MARKER));
  const headerIndex = sectionLines.findIndex(
    (l) => l.trim().startsWith('|') && TABLE_COLUMNS.every((c) => l.includes(c)),
  );
  const dataRows: string[][] = [];
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < sectionLines.length; i++) {
      const line = sectionLines[i]!.trim();
      if (!line.startsWith('|')) continue;
      // 分隔行仅认表头紧邻一行（GFM 规范）：此后所有 | 开头行一律按数据行解析——
      // 否则全空（|  |…|）/占位横线（| - |…|）等合法数据行会被旧正则静默吞掉，
      // 不计入 total、不触发 R3/R4（fail-open 缺口；终审 Important 修复）。
      if (i === headerIndex + 1 && /^\|[\s:|-]+\|?$/.test(line)) continue;
      dataRows.push(splitRow(line));
    }
  }

  if (headerIndex < 0 && !hasMarker) {
    violations.push(
      'R2: 「迷雾登记册」节内既无六列登记表（迷雾项 ID/模糊描述/疑点/疑似归属/毕业方向/毕业处置结果）也无「本阶段无未终结迷雾项」标记',
    );
  }
  if (hasMarker && dataRows.length > 0) {
    violations.push(`R5: 「本阶段无未终结迷雾项」标记与 ${dataRows.length} 行数据并存（互斥）`);
  }

  let terminal = 0;
  dataRows.forEach((cells, i) => {
    const id = cells[0] ?? '';
    if (!FOG_ID(input.phase).test(id)) {
      violations.push(`R3: 第 ${i + 1} 行迷雾项 ID「${id}」不符合 FOG-P${input.phase}-NN 格式（两位起数字）`);
    }
    const result = (cells[5] ?? '').trim();
    if (result === '' || result.includes('待定')) {
      violations.push(
        `R4: 第 ${i + 1} 行（${id}）毕业处置结果未终结（空或含「待定」；CHECKPOINT 前每项须有三选一处置）`,
      );
    } else {
      terminal++;
    }
    const direction = (cells[4] ?? '').trim();
    const owner = (cells[3] ?? '').trim();
    if (direction.includes('设计项') && owner === '') {
      violations.push(`R6: 第 ${i + 1} 行（${id}）毕业方向为「设计项」但疑似归属为空（应填 SD/INTF/DD 候选 id）`);
    }
  });

  return {
    passed: violations.length === 0,
    violations,
    fogStats: { total: dataRows.length, terminal, unresolved: dataRows.length - terminal },
  };
}
