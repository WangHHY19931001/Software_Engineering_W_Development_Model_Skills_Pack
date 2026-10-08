/**
 * verifier 期望数据单源（D3-I，43.3.0）
 *
 * `samples/verifier/` 下全部 fixture 的期望判定数据（expectedPassed / expectedReasonPatterns / description）。
 * 单一事实来源：self-test.ts 的 VERIFIER_CASES 由本表派生（保留 per-case 的 CLI 专属附加字段如需要），
 * vitest 侧（verifier-logic.test.ts 等）由同一表消费——消除双声明漂移（D3 减轨 I）。
 *
 * 脚本自包含约束：本模块只承装**纯数据 / 纯函数**，不 import 任何业务逻辑；
 * 期望与正则字面量以 43.3.0 前 self-test.ts VERIFIER_CASES（L186-385）**逐项原样保留**，
 * 断言集合与行为不变——回归锁定由 `__tests__/verifier-expectations.test.ts` 的等价断言测试证明
 * （对 samples/verifier 每一个 fixture 的 expectedPassed 与 reasonPatterns 逐项一致）。
 */

export interface VerifierExpectation {
  /** 样本文件名（相对 samples/verifier/） */
  file: string;
  /** 期望校验是否通过 */
  expectedPassed: boolean;
  /** 期望 reasons 中至少一条匹配以下每个正则（全部匹配才算通过） */
  expectedReasonPatterns?: RegExp[];
  /** 用例说明 */
  description: string;
}

/**
 * samples/verifier/ 全部 fixture 的期望数据（fixture 名 → 期望，`file` 域即主键，防重名漂移）。
 * 供 self-test（VERIFIER_CASES 派生）与 vitest（verifier-logic.test.ts 等）同源消费。
 */
export const VERIFIER_EXPECTATIONS: readonly VerifierExpectation[] = [
  {
    file: 'valid.json',
    expectedPassed: true,
    description: '完整、合规的 VerifierOutput，应通过所有校验',
  },
  {
    file: 'persona-code-reviewer.json',
    expectedPassed: true,
    description: 'code-reviewer Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'persona-test-engineer.json',
    expectedPassed: true,
    description: 'test-engineer Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'persona-security-auditor.json',
    expectedPassed: true,
    description: 'security-auditor Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'persona-performance-auditor.json',
    expectedPassed: true,
    description: 'performance-auditor Persona 的当前 Schema 可执行样例，应通过全部校验',
  },
  {
    file: 'bad-ranking-k.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*ranking/],
    description: 'ranking.k=2.5 非整数，应被 schema type:integer 前置校验拦截',
  },
  {
    file: 'bad-composite-score.json',
    expectedPassed: false,
    expectedReasonPatterns: [/compositeScore.*Σ\(score\*weight\)/],
    description: 'compositeScore 与 Σ(score*weight) 不一致，应被防漂移校验拦截',
  },
  {
    file: 'bad-quality-level.json',
    expectedPassed: false,
    expectedReasonPatterns: [/qualityLevel.*应映射为/],
    description: 'qualityLevel=C 与综合分数 0.8735（应映射为 A）不一致',
  },
  {
    file: 'bad-variance-threshold.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*varianceThreshold/],
    description: 'meta.varianceThreshold 缺失，应被 schema required 前置校验拦截',
  },
  {
    file: 'bad-variance-drift.json',
    expectedPassed: false,
    expectedReasonPatterns: [/variance.*重算的方差/],
    description: 'variance=0 与 rawScores 重算方差不一致，应被防谎报校验拦截',
  },
  {
    file: 'bad-passed-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/passed.*与 qualityLevel.*不一致/],
    description: 'passed=false 与 qualityLevel=B 不一致（B 级应 passed=true）',
  },
  {
    file: 'bad-reviewed-at.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*reviewedAt/],
    description: 'reviewedAt 不是有效时间，应被 schema format:date-time 前置校验拦截',
  },
  {
    file: 'bad-variance-threshold-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/varianceThreshold 必须在 \[0,0\.1\]/],
    description: '方差阈值被放宽到 0.50，应被拒绝',
  },
  {
    file: 'bad-ranking-ordered.json',
    expectedPassed: false,
    expectedReasonPatterns: [/ranking\.ordered 不得包含重复候选项/],
    description: '排序结果包含重复候选项，应被拒绝',
  },
  {
    file: 'bad-rawscores-all-same.json',
    expectedPassed: false,
    expectedReasonPatterns: [/rawScores 全同/],
    description: 'completeness 维度 rawScores 全同 [0.95,0.95,0.95]，应被防漂移规则 1 拦截',
  },
  {
    file: 'bad-variance-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/variance.*≠.*重算的方差/],
    description: 'completeness variance=0.001 与重算方差 0.000267 不一致，应被防谎报校验拦截',
  },
  {
    file: 'bad-perturbation-out-of-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/扰动.*> 0\.10/],
    description: 'text-parse 扰动范围 0.45 > 0.10，应被防漂移规则 3 拦截',
  },
  {
    // -------------------- P2.4/P2.5/P3.10 verifier 标准化校验 --------------------
    file: 'bad-targetkind.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*targetKind/],
    description: 'P2.5 targetKind=testcase 已废弃，应被 schema enum 前置校验拦截',
  },
  {
    file: 'bad-subcriteria-name.json',
    expectedPassed: false,
    expectedReasonPatterns: [/应为.*fake-criterion/],
    description: 'P2.4 subCriteria 名称 fake-criterion 不在 test 标准集合内，应被命名校验拦截',
  },
  {
    file: 'bad-rawscores-constant.json',
    expectedPassed: false,
    expectedReasonPatterns: [/rawScores 全同/],
    description: 'P3.10 coverage 维度 rawScores 全同 [0.90,0.90,0.90]，应被防漂移规则 1 拦截',
  },
  {
    file: 'bad-summary-too-short.json',
    expectedPassed: false,
    expectedReasonPatterns: [/\[schema\].*summary/],
    description: 'summary 长度 < 50 字符，应被 schema minLength:50 前置校验拦截',
  },
  {
    file: 'bad-evidence-empty.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence.*缺具体引用.*R12/],
    description: 'evidence 缺具体引用，应被 R12 校验拦截（sig-002）',
  },
  {
    file: 'bad-single-axis-low.json',
    expectedPassed: false,
    expectedReasonPatterns: [/completeness.*0\.65.*0\.7(?!\d).*单轴下限/],
    description:
      'R13 单轴下限：completeness=0.65<0.70 加权平均达 A 级（0.86）但单轴失败，应 passed=false（反模式 #41）',
  },
  {
    // -------------------- D-10：V 产物形态负样本 --------------------
    file: 'bad-arithmetic-sequence.json',
    expectedPassed: false,
    expectedReasonPatterns: [/完美等差.*公差 0\.01/, /真实离散/],
    description:
      'D-10① text-parse 下 completeness rawScores [0.97,0.96,0.98] 为 0.01 完美等差，文案须含真实离散改进指引',
  },
  {
    file: 'bad-resolution-floor.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R18.*completeness.*分布坍缩/],
    description:
      'D-10③ completeness rawScores [0.9001,0.9002,0.9] 非全等但方差 6.67e-9 < 1e-6，应被 R18 分辨力下限拦截',
  },
  {
    file: 'bad-evidence-double-l.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence 格式不符.*双 L 非法/, /L51-L53=/],
    description:
      'D-10② evidence 逐条为双 L 区间形态（path:L51-L53=…），须报「格式不符（须 path:Lnn=stmt 或 path:§sec=stmt；行号区间合法写法 path:L51-53=stmt，双 L 非法）」而非「空泛声明，O3 命中」',
  },
  {
    // -------------------- rootcause targetKind（§7.5） --------------------
    file: 'valid-rootcause.json',
    expectedPassed: true,
    description: 'targetKind=rootcause 合法 VerifierOutput（§7.5 子标准集合 + 权重），应通过全部校验',
  },
  {
    file: 'valid-windows-evidence.json',
    expectedPassed: true,
    description:
      'C11 Windows 路径 evidence 正例（反斜杠 src\\mod\\a.ts:L3= + 盘符前缀 D:\\proj\\rootcause.json:L1-5=，子标准集合同 valid-rootcause），应通过 evidence 格式与 R12 校验',
  },
  {
    file: 'bad-rootcause-subcriteria.json',
    expectedPassed: false,
    expectedReasonPatterns: [/subCriteria.*name 应为/],
    description: 'targetKind=rootcause 但误用 test 集合子标准，应被 §7.5 子标准集合校验拦截',
  },
  {
    // -------------------- A2 R19：reviewedArtifacts 评审对象绑定（批次 6 任务 4） --------------------
    file: 'bad-r19-evidence-not-registered.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R19 evidence 引用未在 reviewedArtifacts 登记/],
    description:
      'A2 R19：分数自洽 + evidence 格式合法的 VerifierOutput 引用未登记产物路径（伪造 V 产物与 S 产物零绑定穿透面），应被 R19 唯一拦截',
  },
  {
    file: 'bad-r19-artifact-hash-mismatch.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R19 评审对象哈希不符/],
    description:
      'A2 R19：登记项 sha256 首字符被篡改（仍 64 位十六进制，logic 格式过），CLI 读盘哈希复核应唯一拦截（产物已变，旧评审不成立）',
  },
  {
    file: 'bad-r19-line-out-of-range.json',
    expectedPassed: false,
    expectedReasonPatterns: [/R19 evidence 行号越界/],
    description:
      'A2 R19：evidence 引用已登记产物但行号 99999 越界（行数表由 lib/reviewed-artifacts 读盘注入 VerifierDeps），应被 R19 唯一拦截',
  },
];

/** 按文件名查期望（未命中返回 undefined） */
export function getVerifierExpectation(file: string): VerifierExpectation | undefined {
  return VERIFIER_EXPECTATIONS.find((e) => e.file === file);
}
