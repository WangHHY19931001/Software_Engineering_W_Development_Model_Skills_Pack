/**
 * gate 期望数据单源（D3-II，43.3.0）
 *
 * `samples/gate/` 下全部门禁 fixture 用例的期望与运行数据（file / expectedPassed /
 * expectedReasonPatterns / description + per-case 的 CLI 专属运行字段：phaseOption / graph /
 * srcLineCounts / auxFiles / ticketsFile / maturityFile / signatureChainFile）。
 * 单一事实来源：self-test.ts 的 GATE_CASES 由本表派生（直接透传展开），
 * vitest 侧（gate-logic.test.ts 等）由同一表消费——消除双声明漂移（D3 减轨 II）。
 *
 * 脚本自包含约束：本模块只承装**纯数据 / 纯函数**，不 import 任何业务逻辑；
 * 期望与正则字面量以 43.3.0 前 self-test.ts GATE_CASES（L196-442）**逐项原样保留**，
 * 断言集合与行为不变——回归锁定由 `__tests__/gate-expectations.test.ts` 的等价断言测试证明
 * （对抽表前 GATE_CASES 每一条用例的 expectedPassed / expectedReasonPatterns / description 逐项一致，
 * 且每条 file / ticketsFile / maturityFile / signatureChainFile / auxFiles 引用在盘存在）。
 *
 * 与 verifier 表的差异说明：gate 区同一 fixture 可被多条用例以不同 phaseOption / ticketsFile
 * 消费（valid-rtm.json ×3、valid-phase6.json ×3、bad-phase5-missing-codemodule.json ×2），
 * 故本表不设 `file` 唯一主键；用例身份由复合三元组（file | 显式 phaseOption | ticketsFile）界定，
 * 对账断言测试据此逐条等价（表内用例集合 ↔ 黄金快照无增删、无重名）。
 */

/** per-case 注入的最小图形状（与 logic/gate-logic.ts 的 GateGraph 结构同型，纯数据不 import 业务类型） */
export interface GateExpectationGraph {
  nodes: Array<{ id: string; type: string }>;
}

export interface GateExpectation {
  /** 样本文件或目录组合主输入路径（相对 samples/gate/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
  /** P1.1 阶段级校验选项：传入时按对应 phase 校验，未传时默认 phase=8（终检） */
  phaseOption?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** SD→codeModule 映射校验（phase >= 5 + graph 存在时触发 checkSdToCodeModuleMapping） */
  graph?: GateExpectationGraph;
  /** 批次1 SDMAP-3/4：手写注入表（path→总行数）；缺省不注入 → sdAnchorCheck=skipped */
  srcLineCounts?: Record<string, number>;
  /**
   * 配套产物文件（相对 samples/gate/），仅供 check-samples-coverage 引用登记（未被引用即在盘悬空 → exit 1）；
   * 不作为门禁运行输入。当前用于 M07 E2 的原始测试输出产物 test-evidence-output.txt 与
   * A4 maturity 目录组合的 maturity.json + signature-chain.jsonl。
   */
  auxFiles?: string[];
  /** S18 票据内容 fixture（相对 samples/gate/，`.md`）。runGateCases 读取其文本作为 ticketsText 输入 */
  ticketsFile?: string;
  /** A4（43.0.0）：配套 maturity.json（相对 samples/gate/，目录组合 fixture） */
  maturityFile?: string;
  /** A4（43.0.0）：配套 signature-chain.jsonl（相对 samples/gate/）；缺省 → 空链（不豁免形态） */
  signatureChainFile?: string;
}

/**
 * samples/gate/ 全部门禁用例的期望数据与运行字段（self-test GATE_CASES 派生源；
 * 用例身份 = file | 显式 phaseOption | ticketsFile，防重名漂移）。
 * 供 self-test（GATE_CASES 派生）与 vitest（gate-logic.test.ts 等）同源消费。
 */
export const GATE_EXPECTATIONS: readonly GateExpectation[] = [
  {
    file: 'valid-rtm.json',
    expectedPassed: true,
    description: 'RTM 覆盖率 100% 且四级测试全部通过',
  },
  {
    file: 'bad-coverage.json',
    expectedPassed: false,
    expectedReasonPatterns: [/覆盖率未达 100%/],
    description: 'RTM 存在不完整追溯行，应被覆盖率门禁拦截',
  },
  {
    file: 'bad-count-invariant.json',
    expectedPassed: false,
    expectedReasonPatterns: [/passed \+ failed \+ pending 必须等于 total/],
    description: '测试汇总计数不守恒，应阻止假通过',
  },
  {
    file: 'bad-unit-coverage.json',
    expectedPassed: false,
    expectedReasonPatterns: [/单元测试代码覆盖率未达 80%/],
    description: '单元测试代码覆盖率低于 80%，应阻止放行',
  },
  {
    file: 'bad-duplicate-id.json',
    expectedPassed: false,
    expectedReasonPatterns: [/需求 ID 重复/],
    description: 'RTM 存在重复需求 ID，应被结构校验拦截',
  },
  {
    file: 'bad-test-failed.json',
    expectedPassed: false,
    expectedReasonPatterns: [/单元测试: 1 个失败/],
    description: '单元测试 failed>0，应被四级测试门禁拦截',
  },
  {
    file: 'bad-structure.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*executionSummary/],
    description: 'RTM 缺 executionSummary，应被 schema required 前置校验拦截（[schema] 前缀）',
  },
  // -------------------- P1.1 阶段级校验 --------------------
  {
    file: 'valid-phase6.json',
    expectedPassed: true,
    phaseOption: 6,
    description: 'P1.1 phase=6 合法：unit+integration 通过，system/acceptance pending 合理跳过',
  },
  {
    file: 'bad-phase6-pending-system.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/REQ-001.*integrationTest/],
    description: 'P1.1 phase=6 REQ 缺 integrationTest 字段应失败',
  },
  {
    file: 'bad-phase5-missing-codemodule.json',
    expectedPassed: false,
    phaseOption: 5,
    expectedReasonPatterns: [/REQ-001.*codeModule/],
    description: 'P1.1 phase=5 REQ 缺 codeModule 应失败',
  },
  {
    file: 'bad-phase5-missing-codemodule.json',
    expectedPassed: false,
    phaseOption: 8,
    expectedReasonPatterns: [/REQ-001.*codeModule/],
    description: 'P1.1 phase=5 bad 样本在 phase=8 终检也应失败',
  },
  {
    file: 'valid-phase6.json',
    expectedPassed: false,
    phaseOption: 8,
    expectedReasonPatterns: [/待执行/],
    description: 'P1.1 phase=6 合法场景在 phase=8 终检应失败（system/acceptance pending）',
  },
  {
    file: 'valid-phase6.json',
    expectedPassed: false,
    expectedReasonPatterns: [/系统测试: 8 个待执行/, /验收测试: 6 个待执行/],
    description: 'P1.1 未传 phaseOption 默认 phase=8（向后兼容，valid-phase6 应因 pending 失败）',
  },
  // -------------------- §10J RTM 增量校验修正 --------------------
  {
    file: 'valid-phase1.json',
    expectedPassed: true,
    phaseOption: 1,
    description: '§10J phase=1 REQ 行 acceptanceTest 非空 + NFR 行豁免，应通过',
  },
  {
    file: 'bad-phase1-missing-acceptance-test.json',
    expectedPassed: false,
    phaseOption: 1,
    expectedReasonPatterns: [/REQ-001.*acceptanceTest/],
    description: '§10J phase=1 REQ 行 acceptanceTest 为空，应被增量校验拦截',
  },
  // -------------------- A4 maturity 豁免收紧（43.0.0，批次 6 任务 8） --------------------
  {
    file: 'valid-maturity-waiver-with-approval/rtm.json',
    expectedPassed: true,
    phaseOption: 1,
    maturityFile: 'valid-maturity-waiver-with-approval/maturity.json',
    signatureChainFile: 'valid-maturity-waiver-with-approval/signature-chain.jsonl',
    auxFiles: [
      'valid-maturity-waiver-with-approval/maturity.json',
      'valid-maturity-waiver-with-approval/signature-chain.jsonl',
    ],
    description:
      'A4 L1 + 合法 human 审批链（role=human / targetKind=maturity / v3 重算一致 / 绑定 maturity.json / 不早于末次变更）→ TLA+/BDD 豁免生效（tlaBddWaived=true），其余门禁照跑全绿',
  },
  {
    file: 'bad-maturity-waiver-missing-approval/rtm.json',
    expectedPassed: false,
    phaseOption: 1,
    maturityFile: 'bad-maturity-waiver-missing-approval/maturity.json',
    signatureChainFile: 'bad-maturity-waiver-missing-approval/signature-chain.jsonl',
    auxFiles: [
      'bad-maturity-waiver-missing-approval/maturity.json',
      'bad-maturity-waiver-missing-approval/signature-chain.jsonl',
    ],
    expectedReasonPatterns: [/maturity 豁免被拒绝：缺少 role=human \/ targetKind=maturity 的审批条目/],
    description:
      'A4 L1 审批条目缺 human role（role=S 伪装、v3 签名合法）→ 豁免被拒绝（fail-closed）， maturity.level 自写不再关门禁',
  },
  // -------------------- P0 RTM coverageStatus 校验 --------------------
  {
    file: 'bad-rtm-coverage-below-100.json',
    expectedPassed: false,
    expectedReasonPatterns: [/覆盖率未达 100/],
    description: 'RTM coveragePercent=66% < 100%，应被覆盖率门禁拦截（约束 #3）',
  },
  {
    file: 'bad-rtm-status-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/coverageStatus.*不一致/],
    description: 'RTM coverageStatus="100%" 但 coveragePercent=66%，应被 coverageStatus 一致性校验拦截',
  },
  // -------------------- P2 NFR 双值校验 --------------------
  {
    file: 'bad-nfr-missing-dual-fields.json',
    expectedPassed: false,
    expectedReasonPatterns: [/NFR 行 NFR-001 缺 targetValue 与 testThreshold/],
    description: 'NFR-001 行缺 targetValue + testThreshold 双字段，应被 NFR 双值校验拦截',
  },
  // -------------------- G-B SD 数字层级映射 --------------------
  {
    file: 'valid-sd-numeric-levels.json',
    expectedPassed: true,
    phaseOption: 5,
    graph: { nodes: [{ id: 'SD-5.2.1', type: 'SD' }] },
    description:
      'SD 数字层级 id（SD-5.2.1）经 checkSdToCodeModuleMapping 识别为数字层级，命中 codeModule 前缀映射应通过',
  },
  // -------------------- 批次1 SDMAP 负向样本（SDMAP-1/2/5 与 SDMAP-3/4 注入面） --------------------
  {
    file: 'bad-sdmap-mapping.json',
    expectedPassed: false,
    phaseOption: 5,
    graph: { nodes: [{ id: 'SD-2.2', type: 'SD' }] },
    expectedReasonPatterns: [/SDMAP-1/, /SDMAP-2/, /codeModule 格式错误/],
    description: '批次1：图→RTM 缺映射 + 幽灵 SD 前缀 + 格式不符',
  },
  {
    file: 'bad-sdmap-anchor.json',
    expectedPassed: false,
    phaseOption: 5,
    graph: { nodes: [{ id: 'SD-2.1', type: 'SD' }] },
    srcLineCounts: { 'src/real.ts': 3 },
    expectedReasonPatterns: [/SDMAP-3/, /SDMAP-4/],
    description: '批次1：路径不存在 + 锚点行号越界（注入面）',
  },
  // -------------------- 孤儿样本（check-samples-coverage 引用登记） --------------------
  {
    file: 'bad-phase5-codemodule-format.json',
    expectedPassed: false,
    phaseOption: 5,
    expectedReasonPatterns: [/codeModule 格式错误/],
    description: 'phase5 终检：REQ 行 codeModule 缺 SD 前缀（"src/auth/login.ts"），应被 SD→codeModule 格式校验拦截',
  },
  // -------------------- M07 测试证据（E1-E4 样本级正反夹具，D-2 批准单元） --------------------
  // 正例带 rawOutputPath + 真实 rawOutputSha256（指向同目录 test-evidence-output.txt），
  // 由 runGateCases 透传 projectRoot（samples/gate/）走通 E2 哈希核验端到端。
  {
    file: 'valid-test-evidence.json',
    expectedPassed: true,
    phaseOption: 6,
    auxFiles: ['test-evidence-output.txt'],
    description: 'M07 E2 端到端：四级全绿 + 各层 evidence，unitTest 携 rawOutput 对（真实 sha256）→ 通过',
  },
  {
    file: 'bad-test-evidence-hash-mismatch.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E2[\s\S]*SHA-256[\s\S]*不符/],
    description: 'M07 E2：声明 rawOutputSha256 与产物实际 SHA-256 不符，应被哈希核验拦截',
  },
  {
    file: 'bad-test-evidence-exitcode-mismatch.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E3[\s\S]*记录 failed=1[\s\S]*exitCode=0/],
    description: 'M07 E3 RED 绑定：failed=1 却记 exitCode=0（有失败必来自非零退出），应被结果一致性拦截',
  },
  {
    file: 'bad-test-evidence-unpaired-output.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E1[\s\S]*必须成对出现（当前只有 rawOutputPath）/],
    description: 'M07 E1 配对：只有 rawOutputPath 缺 rawOutputSha256，应被配对校验拦截',
  },
  {
    file: 'bad-test-evidence-missing.json',
    expectedPassed: false,
    phaseOption: 6,
    expectedReasonPatterns: [/E4[\s\S]*单元测试[\s\S]*缺 evidence/],
    description: 'M07 E4：lastUpdated 缺失（保守按 cutoff 后）且单元测试层 total>0 无 evidence，应被存在性校验拦截',
  },
  {
    file: 'valid-test-evidence-legacy.json',
    expectedPassed: true,
    phaseOption: 6,
    description: 'M07 E4 legacy 吸收：lastUpdated 早于 cutoff 且阶段内层无 evidence → 非阻断通过（legacy 标注）',
  },
  {
    file: 'valid-rtm.json',
    ticketsFile: 'tickets-valid.md',
    expectedPassed: true,
    description:
      'S18 正例：票据含符号级契约（接口签名 / 状态转移）与验收标准、零占位符 → --tickets 不引入任何阻断（tickets 计数全 0）',
  },
  {
    file: 'valid-rtm.json',
    ticketsFile: 'tickets-bad-content.md',
    expectedPassed: false,
    expectedReasonPatterns: [
      /票据内容校验失败：票据 01「待补登录」placeholder "TODO"/,
      /票据 01「待补登录」vague-imperative/,
      /票据 01「待补登录」test-without-signature/,
      /票据 01「待补登录」undefined-symbol `AuditLogWriter\.write`/,
      /票据 02「与任务 01 类似」similar-to-task/,
      /票据 02「与任务 01 类似」Buildability：只给路径/,
    ],
    description:
      'S18 反例：占位短语 TODO / 无具体动作祈使 / 要求写测试无符号 / 类似任务 N / 引用未定义符号 / 只给路径不给符号 → 逐条被黑名单与 Buildability 拦截',
  },
];

/** 按用例身份（file + 可选 phaseOption + 可选 ticketsFile）查期望；未命中返回 undefined */
export function getGateExpectation(
  file: string,
  opts?: { phaseOption?: number; ticketsFile?: string },
): GateExpectation | undefined {
  return GATE_EXPECTATIONS.find((e) => {
    if (e.file !== file) return false;
    if (opts?.phaseOption !== undefined && (e.phaseOption ?? 8) !== opts.phaseOption) return false;
    if (opts?.ticketsFile !== undefined) return e.ticketsFile === opts.ticketsFile;
    return true;
  });
}
