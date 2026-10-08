/**
 * gate-expectations.test.ts —— 共享期望表与 43.3.0 前 self-test GATE_CASES 的**等价断言测试**（D3-II）。
 *
 * 本文件把抽表**之前**的 GATE_CASES（self-test.ts L196-442，43.3.0）固化为冻结黄金快照（GOLDEN），
 * 断言共享表 `samples/expectations/gate.ts` 的 GATE_EXPECTATIONS 与之逐项一致：
 *   - 用例集合等价：表内主输入 fixture 集（`file:`）与 GOLDEN 一一对应（无增删，key 无重名）；
 *   - 行为逐项等价：每条用例的 expectedPassed 不变、expectedReasonPatterns 的源文本逐条不变、
 *     description 不变——同 key 逐项比对；
 *   - 在盘锚定：表引用的每条路径（file / ticketsFile / maturityFile / signatureChainFile /
 *     auxFiles）都指向 samples/gate/ 在盘存在的 fixture（防抽表引入悬空引用）。
 * 黄金快照是**一次性表征（characterization）**而非活声明——vitest 运行只消费共享表本身，
 * 后续任何「表与基准行为漂移」（改 passed、改正则、增删用例）都会在此红灯。
 *
 * 说明：与 verifier 区（fixture 名唯一）不同，gate 区同一 fixture 可被多条用例以不同
 * phaseOption / ticketsFile 消费（valid-rtm.json ×3、valid-phase6.json ×3、
 * bad-phase5-missing-codemodule.json ×2），故 key 取复合三元组（file|显式 phaseOption|ticketsFile）——
 * 显式 `phaseOption: 8` 与「未传（运行期默认 8）」是两条不同用例（valid-phase6 双形态），
 * 空位与字面值必须区分，key 才唯一。
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GATE_EXPECTATIONS } from '../samples/expectations/gate.js';

/** 冻结黄金快照：抽表前 self-test GATE_CASES（43.3.0）逐条抄录（复合 key → expectedPassed + 正则源文本 + description） */
const GOLDEN: Record<
  string,
  {
    expectedPassed: boolean;
    reasonPatterns: readonly string[];
    description: string;
  }
> = {
  'valid-rtm.json||': {
    expectedPassed: true,
    reasonPatterns: [],
    description: 'RTM 覆盖率 100% 且四级测试全部通过',
  },
  'bad-coverage.json||': {
    expectedPassed: false,
    reasonPatterns: ['覆盖率未达 100%'],
    description: 'RTM 存在不完整追溯行，应被覆盖率门禁拦截',
  },
  'bad-count-invariant.json||': {
    expectedPassed: false,
    reasonPatterns: ['passed \\+ failed \\+ pending 必须等于 total'],
    description: '测试汇总计数不守恒，应阻止假通过',
  },
  'bad-unit-coverage.json||': {
    expectedPassed: false,
    reasonPatterns: ['单元测试代码覆盖率未达 80%'],
    description: '单元测试代码覆盖率低于 80%，应阻止放行',
  },
  'bad-duplicate-id.json||': {
    expectedPassed: false,
    reasonPatterns: ['需求 ID 重复'],
    description: 'RTM 存在重复需求 ID，应被结构校验拦截',
  },
  'bad-test-failed.json||': {
    expectedPassed: false,
    reasonPatterns: ['单元测试: 1 个失败'],
    description: '单元测试 failed>0，应被四级测试门禁拦截',
  },
  'bad-structure.json||': {
    expectedPassed: false,
    reasonPatterns: ['\\[schema\\].*executionSummary'],
    description: 'RTM 缺 executionSummary，应被 schema required 前置校验拦截（[schema] 前缀）',
  },
  'valid-phase6.json|6|': {
    expectedPassed: true,
    reasonPatterns: [],
    description: 'P1.1 phase=6 合法：unit+integration 通过，system/acceptance pending 合理跳过',
  },
  'bad-phase6-pending-system.json|6|': {
    expectedPassed: false,
    reasonPatterns: ['REQ-001.*integrationTest'],
    description: 'P1.1 phase=6 REQ 缺 integrationTest 字段应失败',
  },
  'bad-phase5-missing-codemodule.json|5|': {
    expectedPassed: false,
    reasonPatterns: ['REQ-001.*codeModule'],
    description: 'P1.1 phase=5 REQ 缺 codeModule 应失败',
  },
  'bad-phase5-missing-codemodule.json|8|': {
    expectedPassed: false,
    reasonPatterns: ['REQ-001.*codeModule'],
    description: 'P1.1 phase=5 bad 样本在 phase=8 终检也应失败',
  },
  'valid-phase6.json|8|': {
    expectedPassed: false,
    reasonPatterns: ['待执行'],
    description: 'P1.1 phase=6 合法场景在 phase=8 终检应失败（system/acceptance pending）',
  },
  'valid-phase6.json||': {
    expectedPassed: false,
    reasonPatterns: ['系统测试: 8 个待执行', '验收测试: 6 个待执行'],
    description: 'P1.1 未传 phaseOption 默认 phase=8（向后兼容，valid-phase6 应因 pending 失败）',
  },
  'valid-phase1.json|1|': {
    expectedPassed: true,
    reasonPatterns: [],
    description: '§10J phase=1 REQ 行 acceptanceTest 非空 + NFR 行豁免，应通过',
  },
  'bad-phase1-missing-acceptance-test.json|1|': {
    expectedPassed: false,
    reasonPatterns: ['REQ-001.*acceptanceTest'],
    description: '§10J phase=1 REQ 行 acceptanceTest 为空，应被增量校验拦截',
  },
  'valid-maturity-waiver-with-approval/rtm.json|1|': {
    expectedPassed: true,
    reasonPatterns: [],
    description:
      'A4 L1 + 合法 human 审批链（role=human / targetKind=maturity / v3 重算一致 / 绑定 maturity.json / 不早于末次变更）→ TLA+/BDD 豁免生效（tlaBddWaived=true），其余门禁照跑全绿',
  },
  'bad-maturity-waiver-missing-approval/rtm.json|1|': {
    expectedPassed: false,
    reasonPatterns: ['maturity 豁免被拒绝：缺少 role=human \\/ targetKind=maturity 的审批条目'],
    description:
      'A4 L1 审批条目缺 human role（role=S 伪装、v3 签名合法）→ 豁免被拒绝（fail-closed）， maturity.level 自写不再关门禁',
  },
  'bad-rtm-coverage-below-100.json||': {
    expectedPassed: false,
    reasonPatterns: ['覆盖率未达 100'],
    description: 'RTM coveragePercent=66% < 100%，应被覆盖率门禁拦截（约束 #3）',
  },
  'bad-rtm-status-mismatch.json||': {
    expectedPassed: false,
    reasonPatterns: ['coverageStatus.*不一致'],
    description: 'RTM coverageStatus="100%" 但 coveragePercent=66%，应被 coverageStatus 一致性校验拦截',
  },
  'bad-nfr-missing-dual-fields.json||': {
    expectedPassed: false,
    reasonPatterns: ['NFR 行 NFR-001 缺 targetValue 与 testThreshold'],
    description: 'NFR-001 行缺 targetValue + testThreshold 双字段，应被 NFR 双值校验拦截',
  },
  'valid-sd-numeric-levels.json|5|': {
    expectedPassed: true,
    reasonPatterns: [],
    description:
      'SD 数字层级 id（SD-5.2.1）经 checkSdToCodeModuleMapping 识别为数字层级，命中 codeModule 前缀映射应通过',
  },
  'bad-sdmap-mapping.json|5|': {
    expectedPassed: false,
    reasonPatterns: ['SDMAP-1', 'SDMAP-2', 'codeModule 格式错误'],
    description: '批次1：图→RTM 缺映射 + 幽灵 SD 前缀 + 格式不符',
  },
  'bad-sdmap-anchor.json|5|': {
    expectedPassed: false,
    reasonPatterns: ['SDMAP-3', 'SDMAP-4'],
    description: '批次1：路径不存在 + 锚点行号越界（注入面）',
  },
  'bad-phase5-codemodule-format.json|5|': {
    expectedPassed: false,
    reasonPatterns: ['codeModule 格式错误'],
    description: 'phase5 终检：REQ 行 codeModule 缺 SD 前缀（"src/auth/login.ts"），应被 SD→codeModule 格式校验拦截',
  },
  'valid-test-evidence.json|6|': {
    expectedPassed: true,
    reasonPatterns: [],
    description: 'M07 E2 端到端：四级全绿 + 各层 evidence，unitTest 携 rawOutput 对（真实 sha256）→ 通过',
  },
  'bad-test-evidence-hash-mismatch.json|6|': {
    expectedPassed: false,
    reasonPatterns: ['E2[\\s\\S]*SHA-256[\\s\\S]*不符'],
    description: 'M07 E2：声明 rawOutputSha256 与产物实际 SHA-256 不符，应被哈希核验拦截',
  },
  'bad-test-evidence-exitcode-mismatch.json|6|': {
    expectedPassed: false,
    reasonPatterns: ['E3[\\s\\S]*记录 failed=1[\\s\\S]*exitCode=0'],
    description: 'M07 E3 RED 绑定：failed=1 却记 exitCode=0（有失败必来自非零退出），应被结果一致性拦截',
  },
  'bad-test-evidence-unpaired-output.json|6|': {
    expectedPassed: false,
    reasonPatterns: ['E1[\\s\\S]*必须成对出现（当前只有 rawOutputPath）'],
    description: 'M07 E1 配对：只有 rawOutputPath 缺 rawOutputSha256，应被配对校验拦截',
  },
  'bad-test-evidence-missing.json|6|': {
    expectedPassed: false,
    reasonPatterns: ['E4[\\s\\S]*单元测试[\\s\\S]*缺 evidence'],
    description: 'M07 E4：lastUpdated 缺失（保守按 cutoff 后）且单元测试层 total>0 无 evidence，应被存在性校验拦截',
  },
  'valid-test-evidence-legacy.json|6|': {
    expectedPassed: true,
    reasonPatterns: [],
    description: 'M07 E4 legacy 吸收：lastUpdated 早于 cutoff 且阶段内层无 evidence → 非阻断通过（legacy 标注）',
  },
  'valid-rtm.json||tickets-valid.md': {
    expectedPassed: true,
    reasonPatterns: [],
    description:
      'S18 正例：票据含符号级契约（接口签名 / 状态转移）与验收标准、零占位符 → --tickets 不引入任何阻断（tickets 计数全 0）',
  },
  'valid-rtm.json||tickets-bad-content.md': {
    expectedPassed: false,
    reasonPatterns: [
      '票据内容校验失败：票据 01「待补登录」placeholder "TODO"',
      '票据 01「待补登录」vague-imperative',
      '票据 01「待补登录」test-without-signature',
      '票据 01「待补登录」undefined-symbol `AuditLogWriter\\.write`',
      '票据 02「与任务 01 类似」similar-to-task',
      '票据 02「与任务 01 类似」Buildability：只给路径',
    ],
    description:
      'S18 反例：占位短语 TODO / 无具体动作祈使 / 要求写测试无符号 / 类似任务 N / 引用未定义符号 / 只给路径不给符号 → 逐条被黑名单与 Buildability 拦截',
  },
};

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const GATE_FIXTURES_DIR = resolve(TEST_DIR, '../samples/gate');

/** 表内用例身份：同 GOLDEN 的复合三元组（file|显式 phaseOption|ticketsFile；未传 phaseOption 以空位区分于字面 8） */
function caseKey(e: { file: string; phaseOption?: number; ticketsFile?: string }): string {
  return `${e.file}|${e.phaseOption === undefined ? '' : e.phaseOption}|${e.ticketsFile ?? ''}`;
}

describe('gate 期望表单源 —— 与旧声明等价（D3-II）', () => {
  it('表内用例集合与 43.3.0 GOLDEN 一一对应，且每条引用在盘存在（无增删、无重名、无悬空）', () => {
    const tableKeys = GATE_EXPECTATIONS.map(caseKey);
    const goldenKeys = Object.keys(GOLDEN);
    expect(tableKeys, '表内用例 key 集合应与 GOLDEN 一致（无增删）').toEqual(goldenKeys);
    expect(new Set(tableKeys).size, '表内用例 key 不得重名').toBe(tableKeys.length);

    // 防抽表引入悬空引用：file / ticketsFile / maturityFile / signatureChainFile / auxFiles 指向
    // samples/gate/ 在盘存在的 fixture（目录组合形态也逐项在盘）
    for (const e of GATE_EXPECTATIONS) {
      const refs = [e.file, e.ticketsFile, e.maturityFile, e.signatureChainFile, ...(e.auxFiles ?? [])].filter(
        (r): r is string => typeof r === 'string' && r !== '',
      );
      expect(refs.length, `${caseKey(e)} 至少应含主输入 file`).toBeGreaterThan(0);
      for (const ref of refs) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- 受控仓库固定路径（samples/gate/ 下由共享期望表声明的 fixture），仅校验存在性、只读
        expect(existsSync(resolve(GATE_FIXTURES_DIR, ref)), `${caseKey(e)} 引用不在盘：${ref}`).toBe(true);
      }
    }
  });

  it('每条用例的 expectedPassed / reasonPatterns / description 与黄金快照逐项一致', () => {
    expect(GATE_EXPECTATIONS.length).toBe(Object.keys(GOLDEN).length);
    for (const e of GATE_EXPECTATIONS) {
      const key = caseKey(e);
      // eslint-disable-next-line security/detect-object-injection -- key 为本表用例身份（file|phaseOption|ticketsFile，常量派生），GOLDEN 为该 key 的同构字典，键由本文件内 caseKey 生成、非外部输入
      const g = GOLDEN[key]!;
      expect(g, `表外用例（key 不在 GOLDEN）：${key}`).toBeDefined();
      expect(e.expectedPassed, `${key}.expectedPassed`).toBe(g.expectedPassed);
      const pats = (e.expectedReasonPatterns ?? []).map((p) => p.source);
      expect(pats, `${key}.reasonPatterns 源文本`).toEqual(g.reasonPatterns);
      expect(e.description, `${key}.description`).toBe(g.description);
    }
  });
});
