/* eslint-disable security/detect-object-injection -- ICEBERG_VIEW_PRESENCE 为代码常量表，按 for 循环数字下标 1..8 访问，非外部键 */
import { describe, it, expect } from 'vitest';

import {
  checkIcebergSweep,
  deriveViewSets,
  ICEBERG_VIEW_PRESENCE,
  type IcebergSweepReport,
} from '../logic/iceberg-sweep-logic.js';

function validReport(overrides: Partial<IcebergSweepReport> = {}): IcebergSweepReport {
  return {
    reportId: 'IS-phase3-1-01',
    phase: 'phase3-outline',
    triggerType: 'ICEBERG-A',
    icebergRound: 1,
    sweptAt: '2026-08-08T10:00:00Z',
    sweptBy: 'R-iceberg',
    线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: [] },
    newFindings: [],
    sweepCoverage: {
      sweptArtifacts: ['docs/phase3-outline/blog-system-outline-design.md'],
      sweptDimensions: ['completeness', 'reliability', 'security'],
    },
    summary:
      '本次扫掠覆盖 completeness/reliability/security 三维度共 1 份产物，以本轮已修复问题为线索深挖，未发现新的隐藏问题，满足终止条件建议放行。',
    passed: true,
    ...overrides,
  };
}

describe('checkIcebergSweep', () => {
  it('合法报告且无新发现 → passed=true', () => {
    const r = checkIcebergSweep(validReport());
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it('icebergRound 越界 → passed=false（R2，2 态：round=0 / round=6）', () => {
    for (const round of [0, 6]) {
      const r = checkIcebergSweep(validReport({ icebergRound: round }));
      expect(r.passed, `round=${round}: 应拒绝`).toBe(false);
      expect(
        r.reasons.some((m) => m.includes('icebergRound')),
        `round=${round}: 应点名 icebergRound`,
      ).toBe(true);
    }
  });

  it('R3 findingId 重复 → passed=false（2 态：对 previous / 内部重复）', () => {
    const dupFinding = {
      findingId: 'IF-phase3-1-09',
      severity: 'Required' as const,
      category: 'same-defect-class' as const,
      location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
      description: '同 ID 两条发现（内部重复）',
      evidence: '状态机图 §3.2 缺 archived 守卫',
      hypothesis: '若补齐守卫，archived 状态不可发布',
      relatedFixedPoint: 'IS-phase3-1-01',
    };
    const prevDupReport = validReport({
      线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: ['IF-phase3-1-01'] },
      newFindings: [
        {
          findingId: 'IF-phase3-1-01',
          severity: 'Required',
          category: 'same-defect-class',
          location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
          description: '重复发现的转移守卫缺陷',
          evidence: '状态机图 §3.2 缺 archived 守卫',
          hypothesis: '若补齐守卫，archived 状态不可发布',
          relatedFixedPoint: 'IS-phase3-1-01',
        },
      ],
      passed: false,
    });
    const internalDupReport = validReport({
      线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: [] },
      newFindings: [dupFinding, { ...dupFinding, location: '...:L99' }],
      passed: false,
    });
    for (const [场景, report, markers] of [
      ['findingId 与 previousFindings 重复（R3）', prevDupReport, ['已在上一轮发现']],
      [
        'findingId 在 newFindings 内部重复（两条同名，r2 ice-internal-dup 形态）',
        internalDupReport,
        ['IF-phase3-1-09', '在 newFindings 内部重复'],
      ],
    ] as const) {
      const r = checkIcebergSweep(report);
      expect(r.passed, `${场景}: 应拒绝`).toBe(false);
      expect(
        r.reasons.some((m) => markers.every((k) => m.includes(k))),
        `${场景}: 应含具名标记 ${markers.join(' + ')}`,
      ).toBe(true);
    }
  });

  it('newFindings 内部重复且与 previousFindings 重复同时报（两条独立 violation）', () => {
    const dupFinding = {
      findingId: 'IF-phase3-1-09',
      severity: 'Required' as const,
      category: 'coverage-gap' as const,
      location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
      description: '同时命中内部重复与上一轮重复',
      evidence: 'evidence',
      hypothesis: 'hypothesis',
      relatedFixedPoint: 'IS-phase3-1-01',
    };
    const r = checkIcebergSweep(
      validReport({
        线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: ['IF-phase3-1-09'] },
        newFindings: [dupFinding, dupFinding],
        passed: false,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('在 newFindings 内部重复'))).toBe(true);
    expect(r.reasons.some((m) => m.includes('已在上一轮发现'))).toBe(true);
  });

  it('finding 缺 hypothesis 或 evidence → passed=false（R4）', () => {
    const r = checkIcebergSweep(
      validReport({
        newFindings: [
          {
            findingId: 'IF-phase3-1-02',
            severity: 'Required',
            category: 'coverage-gap',
            location: 'docs/phase3-outline/blog-system-outline-design.md:L50',
            description: 'SD-007 未建模',
            evidence: 'graph.json type=SD 节点全集含 SD-007',
            hypothesis: '',
            relatedFixedPoint: 'IS-phase3-1-01',
          },
        ],
        passed: false,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('hypothesis'))).toBe(true);
  });

  it('passed 与 newFindings 不一致 → passed=false（R5）', () => {
    const r = checkIcebergSweep(
      validReport({
        newFindings: [
          {
            findingId: 'IF-phase3-1-03',
            severity: 'Required',
            category: 'adjacent-logic',
            location: 'docs/phase3-outline/blog-system-outline-design.md:L60',
            description: 'UnpublishArticle 未校验 archived',
            evidence: '状态机图 §3.2 Unpublish 转移',
            hypothesis: '若补齐守卫，archived 文章不可下架',
            relatedFixedPoint: 'IS-phase3-1-01',
          },
        ],
        passed: true,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('passed 不一致'))).toBe(true);
  });

  it('schema 违规（缺 required 字段 sweptBy）→ passed=false（R1）', () => {
    const { sweptBy, ...rest } = validReport();
    const r = checkIcebergSweep(rest as IcebergSweepReport);
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.startsWith('[schema]'))).toBe(true);
  });

  it('sweptArtifacts 为空数组 → passed=false（schema minItems=1，空声明使零发现不可对账）', () => {
    const r = checkIcebergSweep(
      validReport({
        sweepCoverage: { sweptArtifacts: [], sweptDimensions: ['completeness', 'reliability', 'security'] },
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('sweptArtifacts') && m.includes('minItems'))).toBe(true);
  });
});

describe('A-3b 三视角对账', () => {
  it('R6 对账（2 态：有差异 / 一致）', () => {
    const converged = ['docs/phase3-outline/blog-system-outline-design.md'];
    for (const [场景, viewSets, 差异项] of [
      [
        '两视角应扫集合存在差异（R6）',
        { graph: ['SD-001', 'SD-002'], tla: ['SD-001'], rtm: ['SD-001', 'SD-002'] },
        'SD-002',
      ],
      ['三视角完全一致 → 无 R6 violation', { graph: converged, tla: converged, rtm: converged }, null],
    ] as const) {
      const r = checkIcebergSweep(validReport(), { viewSets });
      if (差异项 === null) {
        expect(
          r.reasons.some((m) => m.includes('R6')),
          `${场景}: 不应有 R6 violation`,
        ).toBe(false);
        expect(r.passed, `${场景}: 应通过`).toBe(true);
      } else {
        expect(r.passed, `${场景}: 应拒绝`).toBe(false);
        expect(
          r.reasons.some((m) => m.includes('R6') && m.includes('视角间存在未对账差异')),
          `${场景}: 应报 R6 未对账差异`,
        ).toBe(true);
        // 差异项须被逐条列出（不归一化、不取并集后放行）
        expect(
          r.reasons.some((m) => m.includes(差异项)),
          `${场景}: 差异项 ${差异项} 须被逐条列出`,
        ).toBe(true);
      }
    }
  });

  it('R7 视角缺席（2 态：未声明 / 已声明）', () => {
    const converged = ['docs/phase3-outline/blog-system-outline-design.md'];
    for (const [场景, report, viewSets, 声明了缺席] of [
      // 阶段 3 的在场表为 graph/tla/rtm；只提供 graph/tla → rtm 缺席且未声明
      [
        '视角缺席但未在 sweepCoverage.absentViews 声明（R7，禁止静默跳过）',
        validReport(),
        { graph: ['SD-001'], tla: ['SD-001'] },
        false,
      ],
      [
        '视角缺席但已在 absentViews 显式声明 → 无 R7 violation',
        validReport({
          sweepCoverage: {
            sweptArtifacts: converged,
            sweptDimensions: ['completeness', 'reliability', 'security'],
            absentViews: ['rtm'],
          },
        }),
        { graph: converged, tla: converged },
        true,
      ],
    ] as const) {
      const r = checkIcebergSweep(report, { viewSets });
      expect(
        r.reasons.some((m) => m.includes('R7')),
        `${场景}: R7 判定应符合`,
      ).toBe(!声明了缺席);
      if (!声明了缺席) {
        expect(r.passed, `${场景}: 应拒绝`).toBe(false);
        expect(
          r.reasons.some((m) => m.includes('R7') && m.includes('rtm')),
          `${场景}: 应点名缺席视角 rtm`,
        ).toBe(true);
      } else {
        expect(r.passed, `${场景}: 应通过`).toBe(true);
      }
    }
  });

  it('R8 违规行（2 态：收敛集合为空 / 分母未覆盖）', () => {
    for (const [场景, report, viewSets, 文案] of [
      [
        '零发现但收敛集合为空 → violation（R8，无法证明扫掠发生）',
        validReport(),
        { graph: [], tla: [], rtm: [] },
        '零发现但收敛集合为空',
      ],
      [
        'sweptArtifacts 未覆盖收敛集合 → violation（R8 分母未覆盖）',
        validReport({
          sweepCoverage: {
            sweptArtifacts: ['docs/phase3-outline/other.md'],
            sweptDimensions: ['completeness', 'reliability', 'security'],
          },
        }),
        {
          graph: ['docs/phase3-outline/blog-system-outline-design.md'],
          tla: ['docs/phase3-outline/blog-system-outline-design.md'],
          rtm: ['docs/phase3-outline/blog-system-outline-design.md'],
        },
        '未覆盖',
      ],
    ] as const) {
      const r = checkIcebergSweep(report, { viewSets });
      expect(r.passed, `${场景}: 应拒绝`).toBe(false);
      expect(
        r.reasons.some((m) => m.includes('R8') && m.includes(文案)),
        `${场景}: 应报 ${文案}`,
      ).toBe(true);
    }
  });

  it('R8 通过行：零发现且收敛集合非空且 sweptArtifacts 已覆盖 → 无 R8 violation', () => {
    const converged = ['docs/phase3-outline/blog-system-outline-design.md'];
    const r = checkIcebergSweep(validReport(), { viewSets: { graph: converged, tla: converged, rtm: converged } });
    expect(r.reasons.some((m) => m.includes('R8'))).toBe(false);
  });

  it('未注入 viewSets（纯逻辑层调用）→ 跳过 R6/R7/R8，不误红（规格 §5：早期阶段/无上游产物时不得假红）', () => {
    const r = checkIcebergSweep(validReport());
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it('无法从 report.phase 解析阶段号 → 报错而非静默按 0 处理', () => {
    const r = checkIcebergSweep(validReport({ phase: 'phase9-whatever' }), {
      viewSets: { graph: ['SD-001'], tla: ['SD-001'], rtm: ['SD-001'] },
    });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('phase') && m.includes('解析'))).toBe(true);
  });

  it('ICEBERG_VIEW_PRESENCE 为代码常量：1-8 阶段全覆盖且取值非空', () => {
    for (let p = 1; p <= 8; p++) {
      expect(ICEBERG_VIEW_PRESENCE[p]).toBeDefined();
      expect(ICEBERG_VIEW_PRESENCE[p]!.length).toBeGreaterThan(0);
    }
  });

  it('graph 在阶段 2-8 全部在场：阶段 5-8 亦消费 graph.json（D8 SD Coverage），遗漏即盲区', () => {
    // 阶段 2-4 缺 --graph 为 ARG_INVALID/exit 2（graph 是 D8 数据源）；
    // 阶段 5-8 以 --graph=.w-model/ingestion/graph.json 校验 D8。故 2-8 均须含 graph。
    for (let p = 2; p <= 8; p++) {
      expect(ICEBERG_VIEW_PRESENCE[p]).toContain('graph');
    }
  });

  it('同一产物集在阶段 4 与阶段 5 派生出相同的 graph 视角（防 5-8 回归为盲区）', () => {
    const artifacts = {
      graph: { nodes: [{ id: 'SD-001' }, { id: 'SD-002' }] },
      tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
      rtm: { rows: [{ designDoc: 'SD-001' }] },
      changeScope: {},
    };
    const atPhase4 = deriveViewSets(4, artifacts);
    const atPhase5 = deriveViewSets(5, artifacts);
    expect(atPhase5.graph).toEqual(atPhase4.graph);
    expect(atPhase5.graph).toEqual(['SD-001', 'SD-002']);
  });
});

describe('deriveViewSets（CLI 侧上游产物 → 各视角应扫集合）', () => {
  it('在场表派生·正常派生行（4 态：阶段 3 三份 / 阶段 3 缺 tla / 阶段 1 不在场 / 阶段 5 scope）', () => {
    const fullArtifacts = {
      graph: { nodes: [{ id: 'SD-001' }, { id: 'REQ-001' }, { id: 'INTF-002' }] },
      tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
      rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
    };
    for (const [场景, phase, artifacts, 期望键值, 期望键检查] of [
      [
        '阶段 3 存在 graph/tla/rtm 三份产物 → 三视角均派生，且只取设计 ID 命名空间',
        3,
        fullArtifacts,
        { graph: ['SD-001', 'INTF-002'], tla: ['SD-001'], rtm: ['SD-001'] },
        {},
      ],
      [
        '阶段 3 缺 tla-manifest → tla 键缺席（不合成空集合，交由 R7 要求显式声明）',
        3,
        {
          graph: { nodes: [{ id: 'SD-001' }] },
          rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
        },
        { tla: undefined },
        { notContains: 'tla' },
      ],
      [
        '阶段 1 的在场表为 graph/rtm → 不派生 tla/scope（即使在盘也不在场）',
        1,
        fullArtifacts,
        {},
        { exact: ['graph', 'rtm'] },
      ],
      [
        '阶段 5 的在场表为 tla/rtm/scope → scope 从 change-scope.changedFiles 派生',
        5,
        {
          changeScope: { changedFiles: ['src/a.ts', 'src/b.ts'] },
          tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
          rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
        },
        { scope: ['src/a.ts', 'src/b.ts'], graph: undefined },
        {},
      ],
    ] as const) {
      const sets = deriveViewSets(phase, artifacts);
      for (const [view, val] of Object.entries(期望键值)) {
        if (val === undefined) {
          expect(sets[view as keyof typeof sets], `${场景}: ${view} 应缺席`).toBeUndefined();
        } else {
          expect(sets[view as keyof typeof sets], `${场景}: ${view} 派生值`).toEqual(val);
        }
      }
      if ('exact' in 期望键检查) {
        expect(Object.keys(sets).sort(), `${场景}: 键集合精确为 ${期望键检查.exact?.join('/')}`).toEqual(
          期望键检查.exact,
        );
      }
      if ('notContains' in 期望键检查) {
        expect(Object.keys(sets), `${场景}: 键集合不应含 ${期望键检查.notContains}`).not.toContain(
          期望键检查.notContains,
        );
      }
    }
  });

  it('上游产物形状非法（非数组）→ 相应视角键缺席而非抛错（1 态）', () => {
    const sets = deriveViewSets(3, { graph: { nodes: 'not-an-array' }, tlaManifest: {}, rtm: {} });
    expect(Object.keys(sets)).toHaveLength(0);
  });
});

describe('R6 命名空间分池', () => {
  // 视角命名空间不同宽：graph/rtm 抽 SD/DD/INTF 全量（design-wide），tla 只有 SD（design-sd，
  // sdCoverage.coveredSdNodes），scope 是文件路径（path）。同池两两精确比对会把命名空间结构性
  // 噪声报成缺口（D-1/N-1），故分池：宽池精确相等、窄池对 SD 切片相等、path 不参与集合比对。
  it('分池对账矩阵·通过行（3 态：宽池全等 / 窄池子集 / scope 不参与）', () => {
    for (const [场景, sets, check] of [
      [
        'graph 与 rtm 在设计 ID 全宽上精确相等（含 DD/INTF）→ 通过',
        { graph: ['SD-001', 'INTF-002', 'DD-003'], rtm: ['SD-001', 'INTF-002', 'DD-003'], tla: ['SD-001'] },
        'R6',
      ],
      [
        'tla 落在 SD 子集内 → 通过（宽视角含 INTF/DD 不构成差异）',
        { graph: ['SD-001', 'INTF-002'], rtm: ['SD-001', 'INTF-002'], tla: ['SD-001'] },
        'R6',
      ],
      [
        'scope（文件路径命名空间）不参与 R6 与 R8 收敛集',
        { graph: ['SD-001'], rtm: ['SD-001'], tla: ['SD-001'], scope: ['src/counter.ts'] },
        'R6+R8',
      ],
    ] as const) {
      const r = checkIcebergSweep(
        check === 'R6'
          ? validReport()
          : validReport({
              reportId: 'IS-phase5-1-01',
              phase: 'phase5-coding',
              sweepCoverage: {
                sweptArtifacts: ['SD-001'],
                sweptDimensions: ['completeness', 'reliability', 'security'],
              },
            }),
        { viewSets: sets },
      );
      expect(
        r.reasons.filter((v) => v.includes('R6') || (check === 'R6+R8' && v.includes('R8'))),
        `${场景}: 应无违规`,
      ).toEqual([]);
    }
  });

  it('分池对账矩阵·违规行（4 态：DD 漂移 / 窄池越界 / 漏 SD / 重复 ID 去重）', () => {
    for (const [场景, sets, id, markers, narrowPool, dedup] of [
      [
        'graph 与 rtm 的 DD 漂移仍被检出 → 违规',
        { graph: ['SD-001', 'DD-003'], rtm: ['SD-001'], tla: ['SD-001'] },
        'DD-003',
        ['graph↔rtm'],
        false,
        false,
      ],
      [
        'tla 含 graph 之外的 SD → 违规（子集方向仍有牙）',
        { graph: ['SD-001'], rtm: ['SD-001'], tla: ['SD-001', 'SD-009'] },
        'SD-009',
        [],
        true,
        false,
      ],
      [
        '宽视角 SD 项未进入 tla（tla 漏 SD）→ 仍违规（SD 命名空间内差异不得被分池豁免）',
        { graph: ['SD-001', 'SD-002'], rtm: ['SD-001', 'SD-002'], tla: ['SD-001'] },
        'SD-002',
        [],
        true,
        false,
      ],
      [
        'tla 含重复 ID → 违规文案去重（同一 ID 只列一次）',
        { graph: ['SD-001'], rtm: ['SD-001'], tla: ['SD-001', 'SD-009', 'SD-009'] },
        'SD-009',
        [],
        true,
        true,
      ],
    ] as const) {
      const v = checkIcebergSweep(validReport(), { viewSets: sets }).reasons;
      if (dedup) {
        // 池标签须可锁定（design-sd 窄池侧不可缺）
        const r6 = v.filter((x) => x.includes('R6[design-sd]')).join('');
        // eslint-disable-next-line security/detect-non-literal-regexp -- id 为用例内字面量行表条目（设计 ID），聚合用例常量表驱动 RegExp，模式非用户输入
        expect(r6.match(new RegExp(id, 'g'))?.length, `${场景}: ${id} 只列一次`).toBe(1);
      } else {
        expect(
          v.some((x) => x.includes('R6') && markers.every((k) => x.includes(k)) && x.includes(id)),
          `${场景}: 应报 R6 并点名 ${[...markers, id].join(' + ')}`,
        ).toBe(true);
        if (narrowPool) {
          expect(
            v.some((x) => x.includes('R6[design-sd]') && x.includes(id)),
            `${场景}: 池标签 R6[design-sd] 须可锁定并点名 ${id}`,
          ).toBe(true);
        }
      }
    }
  });

  it('宽视角全缺 + tla 在盘 → 窄池跳过比对 + 诊断（无基准无从比对，G2-6）', () => {
    // 阶段 5 在场四视角（graph/tla/rtm/scope）全部在盘（空数组亦计「在盘」→ 无 R7），
    // 但宽视角（graph/rtm）的**基线集为空**：窄池（tla）既谈不上「超出」也谈不上「漏」。
    // 现状（logic/iceberg-sweep-logic.ts:317-333）把 tla 的全部 ID 报为 R6[design-sd] 超出 → 本用例红；
    // G3-3 守卫实施后跳过窄池比对并记非阻断诊断 → 本断言翻绿。
    // 翻转条件提示：本 sets 的 graph/rtm 在场但为空数组（wide.length=2）——守卫须判「宽视角基线集为空」，
    // 仅判「宽视角键缺席（wide.length===0）」不会命中本退化形态。
    const sets = { graph: [], rtm: [], tla: ['SD-001'], scope: [] };
    const r = checkIcebergSweep(
      validReport({
        reportId: 'IS-phase5-1-01',
        phase: 'phase5-coding',
        sweepCoverage: { sweptArtifacts: ['SD-001'], sweptDimensions: ['completeness', 'reliability', 'security'] },
      }),
      { viewSets: sets },
    );
    expect(r.reasons.filter((v) => v.includes('R6'))).toEqual([]);
  });

  it('窄池跳过的非阻断诊断进 diagnostics（不进 reasons、不改 passed；G3-3 通道）', () => {
    // 同一退化形态（宽视角基线集为空）另锁诊断通道：诊断须可见、且与阻断面（reasons）解耦；
    // R8 分支在此形态下良性——收敛集含 tla 的 SD-001，sweptArtifacts 已覆盖，零发现可对账。
    const sets = { graph: [], rtm: [], tla: ['SD-001'], scope: [] };
    const r = checkIcebergSweep(
      validReport({
        reportId: 'IS-phase5-1-01',
        phase: 'phase5-coding',
        sweepCoverage: { sweptArtifacts: ['SD-001'], sweptDimensions: ['completeness', 'reliability', 'security'] },
      }),
      { viewSets: sets },
    );
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.diagnostics).toEqual(['R6[design-sd] 宽视角设计 ID 集为空，窄池对账跳过（无基准）']);
  });

  it('无退化形态时 diagnostics 键缺席（非空才出现，非阻断通道不污染既有结构）', () => {
    const converged = ['SD-001'];
    const r = checkIcebergSweep(validReport(), { viewSets: { graph: converged, rtm: converged, tla: converged } });
    expect(r.diagnostics).toBeUndefined();
    expect(Object.keys(r).includes('diagnostics')).toBe(false);
  });
});
