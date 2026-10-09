/**
 * 规则登记册校验纯逻辑（Rule Registry Logic）—— 反模式与硬约束生命周期登记册的单一事实源校验
 *
 * 对应 w-model-dev/rule-registry.json（schema：w-model-dev/schemas/rule-registry.schema.json，43.5.0 批次 10 引入）。
 * 登记册承载：49 条 active 反模式（ap-1..ap-49）+ 14 条 active 硬约束（hc-1..hc-14）+ 候选 C1。
 *
 * 校验：
 *   - validateRuleRegistry：入口经 validateBySchema('rule-registry', data) 前置拦截（schema 不符即返回
 *     `[schema]` 前缀 violations，仿 budget-logic 范式，零 fs——logic 层经 infrastructure 做 schema 校验）；
 *     通过后再做业务校验：id 唯一 / active ap 恰 49 条 / active hc 恰 14 条 / status=retired 条目
 *     必有非空 retiredIn + rationale（防「无理由退役」进入生命周期）。
 *   - crossCheckRegistryAgainstDocs：登记册 active 反模式 id 集合 ↔ hard-constraints.md 主清单
 *     「### 反模式清单」表 `| N |` 行集合双向精确相等；active 硬约束 id 集合 ↔ `## #N` 标题集合
 *     双向精确相等；任一不等即列差异（只读文本解析，纯函数，供任务 5 的 checkRuleRegistry 接线消费）。
 *
 * 解析锚（与 docs-consistency-logic 的 checkHardConstraints / checkAntiPatterns 同源同式）：
 *   - 反模式主清单行 = `| N | 【...`（【 前缀为主清单表行独有，阶段表 / 检测信号表用 #N 短名，不误配）
 *   - 硬约束标题 = `## #N `（恰两井号 + 空格 + #N，#11-a 等 `## 约束 #11-a` 与 `### #5` 强化节不匹配）
 *
 * 设计原则（与 budget-logic.ts / graph-logic.ts 一致）：
 *   1. 纯函数：无 I/O、无副作用，仅依赖传入的 registry 对象与 hardConstraintsText 文本
 *   2. 单点事实：所有「登记册是否符合规范 / 与文档是否一致」的判定均委托至此
 */

import { validateBySchema } from '../infrastructure/schema-loader.js';

// ==================== 期望常量（与 hard-constraints.md 现状一致的强制计数） ====================

/** active 反模式条目数（= hard-constraints.md「反模式（49 条）」主清单行数） */
export const EXPECTED_ACTIVE_AP = 49;
/** active 硬约束条目数（= hard-constraints.md `## #N` 标题数） */
export const EXPECTED_ACTIVE_HC = 14;

// ==================== 自包含类型形状 ====================

export type RuleKind = 'anti-pattern' | 'hard-constraint' | 'candidate';
export type RuleStatus = 'active' | 'candidate' | 'retired';

/** 单条登记册条目（与 rule-registry.schema.json definitions.ruleEntry 对齐） */
export interface RegistryEntry {
  id: string;
  kind: RuleKind;
  title: string;
  status: RuleStatus;
  boundScript: string | null;
  retiredIn: string | null;
  rationale: string;
}

/** 登记册顶层结构（与 rule-registry.schema.json 对齐） */
export interface RuleRegistry {
  schemaVersion: '1.0';
  rules: RegistryEntry[];
}

export interface RegistryReport {
  passed: boolean;
  violations: string[];
}

/**
 * 登记册 ↔ hard-constraints.md 交叉核对报告
 *
 * - passed：active ap / active hc 集合双向一致时为 true
 * - violations：人类可读差异（任一集合非空即列出）
 * - 差异明细四数组：`*OnlyInDocs` = 文档有而登记册缺（文档漂移或登记册遗漏）；
 *   `*OnlyInRegistry` = 登记册有而文档缺（登记册漂移或文档删除）
 */
export interface CrossCheckReport {
  passed: boolean;
  violations: string[];
  apOnlyInDocs: string[];
  apOnlyInRegistry: string[];
  hcOnlyInDocs: string[];
  hcOnlyInRegistry: string[];
}

// ==================== 校验入口 ====================

/**
 * 登记册校验入口（纯函数）
 *
 * @param data rule-registry.json 的解析结果；先经 schema 前置校验，不符即返回 `[schema]` 前缀 violations
 * @returns RegistryReport —— 业务规则：id 唯一 / active ap 恰 49 / active hc 恰 14 /
 *          retired 条目必有非空 retiredIn + rationale
 */
export function validateRuleRegistry(data: unknown): RegistryReport {
  // === Schema 前置校验（仿 budget-logic.ts:142 范式，失败以 [schema] 前缀返回） ===
  const schemaResult = validateBySchema('rule-registry', data);
  if (!schemaResult.valid) {
    return {
      passed: false,
      violations: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
    };
  }

  const violations: string[] = [];
  const registry = data as RuleRegistry;
  const rules = registry.rules;

  // R1：id 唯一（重复 id 使生命周期回写与交叉核对失去可定位性）
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      violations.push(`登记册 id 重复：${rule.id}`);
    }
    seen.add(rule.id);
  }

  // R2：active 反模式恰 49 条（与 hard-constraints.md 主清单行数一致）
  const activeAp = rules.filter((r) => r.kind === 'anti-pattern' && r.status === 'active');
  if (activeAp.length !== EXPECTED_ACTIVE_AP) {
    violations.push(`active 反模式应为 ${EXPECTED_ACTIVE_AP} 条，实测 ${activeAp.length} 条`);
  }

  // R3：active 硬约束恰 14 条（与 `## #N` 标题数一致）
  const activeHc = rules.filter((r) => r.kind === 'hard-constraint' && r.status === 'active');
  if (activeHc.length !== EXPECTED_ACTIVE_HC) {
    violations.push(`active 硬约束应为 ${EXPECTED_ACTIVE_HC} 条，实测 ${activeHc.length} 条`);
  }

  // R4：retired 条目必须留有退役版本与理由（防「无理由退役」；schema 允许空串/null，
  // 退役语义由本业务规则强制非空）
  for (const rule of rules) {
    if (rule.status === 'retired') {
      if (typeof rule.retiredIn !== 'string' || rule.retiredIn.trim() === '') {
        violations.push(`retired 条目 ${rule.id} 缺 retiredIn（退役版本号必填）`);
      }
      if (typeof rule.rationale !== 'string' || rule.rationale.trim() === '') {
        violations.push(`retired 条目 ${rule.id} 缺 rationale（退役理由必填）`);
      }
    }
  }

  return { passed: violations.length === 0, violations };
}

// ==================== 交叉核对（登记册 ↔ hard-constraints.md 文本） ====================

/**
 * 反模式主清单行解析：`| N | 【...` 行（【 前缀为「### 反模式清单」表行独有形态）。
 * 阶段表 / 检测信号表用 #N 短名，不产生误配；返回升序去重编号。
 */
function extractDocApNumbers(text: string): number[] {
  const ids = new Set<number>();
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(\d{1,2})\s*\|\s*【/);
    if (m) ids.add(Number(m[1]));
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * 硬约束标题解析：`## #N ` 行（恰两井号 + 空格 + #N）。
 * `### #5 一次性载入全部 references（强化）`、`## 约束 #11-a …` 等不匹配——
 * 前者三井号、后者约束标题前无 #N（#11-a 是子节不是第 12 条硬约束）。
 */
function extractDocHcNumbers(text: string): number[] {
  const ids = new Set<number>();
  for (const line of text.split('\n')) {
    const m = line.match(/^## #(\d+) /);
    if (m) ids.add(Number(m[1]));
  }
  return [...ids].sort((a, b) => a - b);
}

/** 登记册 active id → 文档编号 偏移：`ap-N` → N；非 ap/hc 形态返回 null */
function registryNumToDocNum(id: string): number | null {
  const m = id.match(/^(?:ap|hc)-(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * 登记册 ↔ hard-constraints.md 交叉核对（纯函数，只读文本解析）
 *
 * @param registry            已通过 validateRuleRegistry 的登记册对象
 * @param hardConstraintsText hard-constraints.md 全文（调用方读盘注入，logic 层不 fs）
 * @returns CrossCheckReport —— active ap 集合 ↔ 主清单 `| N |` 行集合、active hc 集合 ↔
 *          `## #N` 标题集合双向精确相等；任一不等即列差异（violations + 四明细数组）
 */
export function crossCheckRegistryAgainstDocs(registry: RuleRegistry, hardConstraintsText: string): CrossCheckReport {
  const violations: string[] = [];

  const registryAp = new Set(
    registry.rules
      .filter((r) => r.kind === 'anti-pattern' && r.status === 'active')
      .map((r) => registryNumToDocNum(r.id))
      .filter((n): n is number => n !== null),
  );
  const registryHc = new Set(
    registry.rules
      .filter((r) => r.kind === 'hard-constraint' && r.status === 'active')
      .map((r) => registryNumToDocNum(r.id))
      .filter((n): n is number => n !== null),
  );
  const docAp = new Set(extractDocApNumbers(hardConstraintsText));
  const docHc = new Set(extractDocHcNumbers(hardConstraintsText));

  const apOnlyInRegistry = [...registryAp].filter((n) => !docAp.has(n)).map((n) => `ap-${n}`);
  const apOnlyInDocs = [...docAp].filter((n) => !registryAp.has(n)).map((n) => `ap-${n}`);
  const hcOnlyInRegistry = [...registryHc].filter((n) => !docHc.has(n)).map((n) => `hc-${n}`);
  const hcOnlyInDocs = [...docHc].filter((n) => !registryHc.has(n)).map((n) => `hc-${n}`);

  if (apOnlyInDocs.length > 0 || apOnlyInRegistry.length > 0) {
    violations.push(`反模式集合不等：登记册缺 [${apOnlyInDocs.join(',')}]；登记册多余 [${apOnlyInRegistry.join(',')}]`);
  }
  if (hcOnlyInDocs.length > 0 || hcOnlyInRegistry.length > 0) {
    violations.push(`硬约束集合不等：登记册缺 [${hcOnlyInDocs.join(',')}]；登记册多余 [${hcOnlyInRegistry.join(',')}]`);
  }

  return {
    passed: violations.length === 0,
    violations,
    apOnlyInDocs,
    apOnlyInRegistry,
    hcOnlyInDocs,
    hcOnlyInRegistry,
  };
}
