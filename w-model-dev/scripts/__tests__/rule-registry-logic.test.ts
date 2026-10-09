/**
 * rule-registry-logic.ts 单元测试 —— M2 规则登记册校验（43.5.0 批次 10）
 *
 * 覆盖（任务 4 步骤 3 要求，7 用例）：
 *   - validateRuleRegistry 合法全量：64 条目（48 ap + 14 hc + C1/C2）通过
 *   - 缺 1 条 ap（47 → fail）
 *   - 多 1 条 ap（49 → fail）
 *   - status 非法（schema 前置拦截，[schema] 前缀 violations）
 *   - retired 缺 rationale（业务规则 fail）
 *   - crossCheckRegistryAgainstDocs 一致通过（双向精确相等）
 *   - crossCheck 主表缺一行 → fail（列差异）
 *
 * 测试用合成夹具（自包含，不读真实登记册/文档）——validateRuleRegistry 与
 * crossCheckRegistryAgainstDocs 均为纯函数，夹具与真实产物同构。
 */

import { describe, expect, it } from 'vitest';

import {
  crossCheckRegistryAgainstDocs,
  validateRuleRegistry,
  type RegistryEntry,
  type RuleRegistry,
} from '../logic/rule-registry-logic.js';

/** 构造合法全量登记册：48 ap + 14 hc + C1/C2（64 条，全部过 schema + 业务规则） */
function makeValidRegistry(): RuleRegistry {
  const rules: RegistryEntry[] = [];
  for (let n = 1; n <= 48; n++) {
    rules.push({
      id: `ap-${n}`,
      kind: 'anti-pattern',
      title: `反模式 ${n}`,
      status: 'active',
      boundScript: null,
      retiredIn: null,
      rationale: 'fixture',
    });
  }
  for (let n = 1; n <= 14; n++) {
    rules.push({
      id: `hc-${n}`,
      kind: 'hard-constraint',
      title: `硬约束 ${n}`,
      status: 'active',
      boundScript: null,
      retiredIn: null,
      rationale: 'fixture',
    });
  }
  rules.push({
    id: 'C1',
    kind: 'candidate',
    title: '候选一',
    status: 'candidate',
    boundScript: null,
    retiredIn: null,
    rationale: 'fixture',
  });
  rules.push({
    id: 'C2',
    kind: 'candidate',
    title: '候选二',
    status: 'candidate',
    boundScript: null,
    retiredIn: null,
    rationale: 'fixture',
  });
  return { schemaVersion: '1.0', rules };
}

/** 合成 hard-constraints.md 文本：14 个 ## #N 标题 + 主清单 48 行（与登记册同构） */
function makeValidDocsText(): string {
  let text = '';
  for (let n = 1; n <= 14; n++) {
    text += `## #${n} 硬约束 ${n}\n`;
  }
  text += '\n### 反模式清单\n\n| # | 反模式（不要做） | 危害 | 正确做法 |\n|---|---|---|---|\n';
  for (let n = 1; n <= 48; n++) {
    text += `| ${n} | 【通用】反模式 ${n} | 危害 ${n} | 正确做法 ${n} |\n`;
  }
  return text;
}

describe('validateRuleRegistry', () => {
  it('合法全量 64 条（48 ap + 14 hc + C1/C2）通过', () => {
    const result = validateRuleRegistry(makeValidRegistry());
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('缺 1 条 ap（47 → fail）', () => {
    const registry = makeValidRegistry();
    registry.rules = registry.rules.filter((r) => r.id !== 'ap-48');
    expect(registry.rules.length).toBe(63);
    const result = validateRuleRegistry(registry);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('active 反模式应为 48 条，实测 47 条'))).toBe(true);
  });

  it('多 1 条 ap（49 → fail）', () => {
    const registry = makeValidRegistry();
    registry.rules.push({
      id: 'ap-49',
      kind: 'anti-pattern',
      title: '反模式 49',
      status: 'active',
      boundScript: null,
      retiredIn: null,
      rationale: 'fixture',
    });
    expect(registry.rules.length).toBe(65);
    const result = validateRuleRegistry(registry);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('active 反模式应为 48 条，实测 49 条'))).toBe(true);
  });

  it('status 非法 → schema 前置拦截（[schema] 前缀）', () => {
    const registry = makeValidRegistry();
    registry.rules[0] = { ...registry.rules[0]!, status: '已激活' as RegistryEntry['status'] };
    const result = validateRuleRegistry(registry);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('retired 缺 rationale → 业务规则 fail（retiredIn 有值但理由为空串）', () => {
    const registry = makeValidRegistry();
    registry.rules[0] = {
      ...registry.rules[0]!,
      status: 'retired',
      retiredIn: '43.5.0',
      rationale: '',
    };
    const result = validateRuleRegistry(registry);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('ap-1 缺 rationale'))).toBe(true);
    // retiredIn 有值 → 不被业务规则拦截（schema 亦合法）
    expect(result.violations.some((v) => v.includes('缺 retiredIn'))).toBe(false);
  });
});

describe('crossCheckRegistryAgainstDocs', () => {
  it('登记册 ↔ 文档一致（active ap/hc 双向精确相等）→ passed', () => {
    const report = crossCheckRegistryAgainstDocs(makeValidRegistry(), makeValidDocsText());
    expect(report.passed).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.apOnlyInDocs).toEqual([]);
    expect(report.apOnlyInRegistry).toEqual([]);
    expect(report.hcOnlyInDocs).toEqual([]);
    expect(report.hcOnlyInRegistry).toEqual([]);
  });

  it('文档主表缺一行 → fail（列差异：登记册相对文档多余的 ap 非空）', () => {
    // 移除主清单第 47 行：登记册仍含 ap-47 而文档缺失 → 差异落在「登记册多余」（apOnlyInRegistry）
    const brokenText = makeValidDocsText().replace('| 47 | 【通用】反模式 47 |', 'REMOVED');
    const report = crossCheckRegistryAgainstDocs(makeValidRegistry(), brokenText);
    expect(report.passed).toBe(false);
    expect(report.apOnlyInDocs).toEqual([]);
    expect(report.apOnlyInRegistry).toEqual(['ap-47']);
    expect(report.violations.some((v) => v.includes('反模式集合不等'))).toBe(true);
  });
});
