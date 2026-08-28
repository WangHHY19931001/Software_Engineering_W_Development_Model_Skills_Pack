# w-model-dev 三维度优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 [设计文档](../specs/2026-08-28-w-model-dev-3dim-optimization-design.md) 交付三批次串行优化：仓内评估资产与基线（有效性）→ 可靠性红灯清零 → SKILL.md 大幅精简重写 + 终值评估（易用性）。

**Architecture:** 三批次严格串行，每批次独立 worktree + 独立提交 + 用户审查点。批次 1 先建 `npm run eval` 断言资产并采集基线（基线先行归因）；批次 2 修 bash 解析根因使全量测试与 docs-consistency 转绿；批次 3 用评估资产作回归网执行 SKILL.md 重写与 references 合并，终值评估 ≥ 基线收口。

**Tech Stack:** Node ≥20 / TypeScript + tsx / Vitest（config/vitest.config.ts，仅收集 `w-model-dev/scripts/__tests__/**/*.test.ts`）/ PowerShell（Windows 主环境）。

---

## 0. 执行者必读：已验证事实清单（编写本计划时逐一核实）

| # | 事实 | 证据 |
|---|---|---|
| F1 | 当前 HEAD `main@57b399b` + 设计文档提交 `2737b15`；版本 41.19.0 | git log |
| F2 | `npm run self-test` 260/260 通过；`npm test` 28 失败（26 个在 platform-deps-hook.test.ts，127 退出码）；`check:docs-consistency` exit 1（动态门禁因 vitest 事实包不可信） | 2026-08-28 实测 |
| F3 | bash 失败根因：PATH 首位 `C:\Windows\System32\bash.exe`（WSL）优先于 Git Bash；WSL bash 无法读取 Windows 路径脚本 → 127 | `where.exe bash` 实测 |
| F4 | bash 裸调用点共 2 个测试文件：`platform-deps-hook.test.ts` L24-25（`execFileAsync('bash', ...)`，内层 `bash "$script"` 同样走 PATH）；`docs-consistency-logic.test.ts` L2572-2574（`execFile('bash', ['.githooks/pre-push', '--force'], ...)`） | grep 实测 |
| F5 | `MAX_GRAPH_ROUNDS = 5` 定义于 `w-model-dev/scripts/lib/constants.ts` L38-42；SKILL.md 表述为 `MAX_ROUNDS=5`（L132）；self-test fixture `bad-round-exceeded.json`（self-test.ts L419） | Read 实测 |
| F6 | `check-verifier-output.ts` 支持 `--self-as-verifier` + `--s-output`（L9-16、L51-56）；`cli/` 共 **37 个 .ts** | Glob 实测 |
| F7 | `checkScriptRegistry`（docs-consistency-logic.ts L1007-1032）：每个 cli 脚本名必须出现在 **dispatchMatrix 字符串**（CLI 层读 `references/dispatch-matrix.md`）中；SKILL.md 必须含 `N 个 .ts` 且计数与实测一致 | Read 实测 |
| F8 | `skill-metadata.test.ts` 断言 frontmatter name/version 与 skill-metadata.json/package.json/README/INSTALL 五处镜像一致 | Read 实测 |
| F9 | 版本升级：`node scripts/version-bump.cjs <new-version>` 一条命令同步 7 文件（CHANGELOG 自动插节头，正文手填）；改版后 `npm run check:docs-consistency` 自验证 | version-bump.cjs L17-19 |
| F10 | `.gitignore` 无 `eval/results.json`；worktree 目录约定 `.worktrees/` | Read 实测 |
| F11 | Java 17 可用（GraalVM 17.0.4）；maturity L2 只需 TLA+ L1（静态校验，无需 TLC/Java） | java -version 实测 |
| F12 | references 行数 top：subagent-delegation 996 / data-models 864 / verifier-spec 730 / anti-patterns 598 / tla-plus-patterns-examples 587 / tla-plus-guide 576 / bdd-guide 500 / bdd-patterns-examples 488 / agent-personas 396 / tla-plus-syntax-reference 356 / operational-recovery 333 / tla-plus-tlc-configuration 303 / dispatch-matrix 274 / bdd-syntax-reference 255 / bdd-review-checklist 153 | Get-Content 实测 |
| F13 | eval 评估锚点子串已验证存在：operational-recovery.md 含 `rtm.json`、`空格`；phase-8-acceptance-test.md 含 `reject`；phase-5-coding.md 含 `详细设计`；workflow.md 含 `CHECKPOINT`；verifier-spec.md 含 `R13`；bdd-guide.md 含 `Feature`；tla-plus-guide.md 含 `TLC`；iceberg-sweep-guide.md 含 `ICEBERG`；anti-patterns.md 含 `越权`（#10 编排者越权实施，L77-90）；command-reference.md 含 `result`；SKILL.md 含 `先询问` | Select-String 实测 |
| F14 | 测试文件名已验证存在：`__tests__/verifier-logic.test.ts`、`__tests__/cli-error.test.ts`、`__tests__/role-dispatch-logic.test.ts`；cli 下 `check-checkpoint.ts`、`wm-write.ts`、`check-artifact-gate.ts`、`check-tla-model.ts`、`check-bdd-model.ts` 均存在 | Glob 实测 |
| F15 | self-test.ts 源码含 fixtures：`valid-phase1.json`(L350)、`bad-coverage.json`(L273)、`bad-test-failed.json`(L297)；运行输出含 `preventive-review/bad-missing-evidence`、`iceberg/bad-round-out-of-range`、`opsx-artifacts/bad-missing-tickets`、`codegraph-queries/bad-missing-blastradius`、`run-log/bad-missing-G-role`、`uat-path-mapping` | Read/Grep 实测 |

**批次间用户审查点**：批次 1、2 完成后各暂停一次，向用户展示验收证据并获确认后才开下一批次（用户偏好：串行、完整闭环、禁止并行修改文档）。

---

## 批次 1：仓内评估资产与基线（有效性）

### Task 1.0：worktree 与分支

**Files:** 无（git 操作）

- [ ] **Step 1: 创建批次 1 worktree**

```powershell
git worktree add .worktrees/b1-3dim -b batch1-3dim main
cd .worktrees/b1-3dim
```

Expected: worktree 创建成功，分支 `batch1-3dim` 基于 main。

---

### Task 1.1：eval/mappings.json（25 条提示词 → 资产锚点映射表）

**Files:**
- Create: `eval/mappings.json`

- [ ] **Step 1: 写入完整映射表**

```json
{
  "version": 1,
  "description": "25 条评估提示词 → 技能资产锚点映射。断言三层：L1 触发词断言（id 1-7）、L2 机制存在性断言（id 8-25）、L3 行为证据映射（evidence 字段）。锚点在批次 3 重构后须同步更新（见 Task 3.5）。",
  "mappings": [
    { "id": 1, "scenario": "自然语言触发 W 模型开发", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "W 模型" },
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "CHECKPOINT · 项目初始化" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-checkpoint.ts" } },
    { "id": 2, "scenario": "/wm analyze 命令触发", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "/wm analyze" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "valid-phase1.json" } },
    { "id": 3, "scenario": "用户说完整流程但未提 W 模型（歧义先询问）", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "先询问" },
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "确认前不初始化" }
      ],
      "evidence": { "type": "assertion" } },
    { "id": 4, "scenario": "RTM 关键词触发", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "RTM" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-coverage.json" } },
    { "id": 5, "scenario": "英文 W-model / stage gates 触发", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "W-model" },
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "stage gates" }
      ],
      "evidence": { "type": "assertion" } },
    { "id": 6, "scenario": "普通开发任务不误触发", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "不启用" }
      ],
      "evidence": { "type": "assertion" } },
    { "id": 7, "scenario": "单纯技术解释类问题不误触发", "layer": "L1",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "不启用" }
      ],
      "evidence": { "type": "assertion" } },
    { "id": 8, "scenario": "无详细设计产物时拒绝直接编码", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "前置产物" },
        { "type": "contains", "target": "w-model-dev/references/phase-5-coding.md", "substring": "详细设计" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-artifact-gate.ts" } },
    { "id": 9, "scenario": "伪造测试通过被拒绝", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "真实测试输出" },
        { "type": "contains", "target": "w-model-dev/references/command-reference.md", "substring": "result" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-test-failed.json" } },
    { "id": 10, "scenario": "阶段门拒绝自动推进", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "CHECKPOINT · 阶段门放行" },
        { "type": "contains", "target": "w-model-dev/references/workflow.md", "substring": "CHECKPOINT" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-checkpoint.ts" } },
    { "id": 11, "scenario": "RTM JSON 损坏可恢复", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/operational-recovery.md", "substring": "rtm.json" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/wm-write.ts" } },
    { "id": 12, "scenario": "Windows 空格路径处理", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/operational-recovery.md", "substring": "空格" }
      ],
      "evidence": { "type": "assertion" } },
    { "id": 13, "scenario": "验收 reject 不归档", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/phase-8-acceptance-test.md", "substring": "reject" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "uat-path-mapping" } },
    { "id": 14, "scenario": "退出码 2 语义（输入错误不视为门禁失败）", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "退出码" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/__tests__/cli-error.test.ts" } },
    { "id": 15, "scenario": "Verifier 输出结构校验", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "check-verifier-output.ts" },
        { "type": "contains", "target": "w-model-dev/references/verifier-spec.md", "substring": "R13" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-verifier-output.ts" } },
    { "id": 16, "scenario": "R3 预防性审查缺失被拦截", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "R3" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-missing-evidence" } },
    { "id": 17, "scenario": "冰山扫掠缺口拦截", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/iceberg-sweep-guide.md", "substring": "ICEBERG" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-round-out-of-range" } },
    { "id": 18, "scenario": "TLA+ 规格与 TLC 校验", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/tla-plus-guide.md", "substring": "TLC" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-tla-model.ts" } },
    { "id": 19, "scenario": "BDD 场景头标注校验", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/bdd-guide.md", "substring": "Feature" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/cli/check-bdd-model.ts" } },
    { "id": 20, "scenario": "需求摄入轮次上限 5 轮", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/scripts/lib/constants.ts", "substring": "MAX_GRAPH_ROUNDS = 5" },
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "MAX_ROUNDS" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-round-exceeded" } },
    { "id": 21, "scenario": "opsx 三段式产物完整性", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "opsx" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-missing-tickets" } },
    { "id": 22, "scenario": "代码改动前 codegraph 影响分析", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "codegraph" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-missing-blastradius" } },
    { "id": 23, "scenario": "self-as-verifier 同路径自评拦截", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "self-as-verifier" },
        { "type": "contains", "target": "w-model-dev/scripts/cli/check-verifier-output.ts", "substring": "self-as-verifier" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/__tests__/verifier-logic.test.ts" } },
    { "id": 24, "scenario": "编排者越权实施（反模式 #10）", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/references/anti-patterns.md", "substring": "越权" }
      ],
      "evidence": { "type": "fileExists", "target": "w-model-dev/scripts/__tests__/role-dispatch-logic.test.ts" } },
    { "id": 25, "scenario": "gate-logs 与 run-log 交叉校验", "layer": "L2",
      "assertions": [
        { "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "交叉校验" }
      ],
      "evidence": { "type": "selfTestSource", "substring": "bad-missing-G-role" } }
  ]
}
```

- [ ] **Step 2: 校验 JSON 合法**

Run: `node -e "const m=require('./eval/mappings.json'); console.log(m.mappings.length)"`
Expected: `25`

---

### Task 1.2：eval/runner.ts（断言引擎）+ package.json / .gitignore

**Files:**
- Create: `eval/runner.ts`
- Modify: `package.json`（scripts 段加 `eval`）
- Modify: `.gitignore`（加 `eval/results.json`）

- [ ] **Step 1: 写入 runner.ts**

```ts
#!/usr/bin/env node
/**
 * 仓内评估断言 runner：验证「25 条评估提示词要求的技能行为支撑资产」是否完备。
 *
 * 三层断言（设计见 docs/superpowers/specs/2026-08-28-w-model-dev-3dim-optimization-design.md §2.2）：
 *   L1 触发词断言 —— 触发/歧义/反误触发契约在 SKILL.md 中可命中；
 *   L2 机制存在性断言 —— expected 引用的机制在「脚本 + 逻辑常量 + references 锚点」有实体；
 *   L3 行为证据映射 —— 每条 expected 映射到已存在的 self-test fixture / 测试文件 / eval 断言。
 *
 * 用法：
 *   npm run eval                          # 全量断言，写 eval/results.json，失败 exit 1
 *   npx tsx eval/runner.ts --self-check   # 引擎自检（已知真/假断言验证判定逻辑）
 *
 * 本脚本属于仓库评估资产（eval/），不属于技能包交付层，不调用 LLM。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

interface ContainsAssertion {
  type: 'contains';
  target: string;
  substring: string;
}
interface FileExistsAssertion {
  type: 'fileExists';
  target: string;
}
type Assertion = ContainsAssertion | FileExistsAssertion;

type Evidence =
  | { type: 'assertion' }
  | { type: 'fileExists'; target: string }
  | { type: 'selfTestSource'; substring: string };

interface Mapping {
  id: number;
  scenario: string;
  layer: 'L1' | 'L2';
  assertions: Assertion[];
  evidence: Evidence;
}

interface AssertionResult {
  id: number;
  layer: string;
  scenario: string;
  passed: boolean;
  failures: string[];
}

export interface FileSystemAdapter {
  read(p: string): string;
  exists(p: string): boolean;
}

function createRealFs(): FileSystemAdapter {
  return {
    read(p: string): string {
      return fs.readFileSync(path.join(repoRoot, p), 'utf-8');
    },
    exists(p: string): boolean {
      return fs.existsSync(path.join(repoRoot, p));
    },
  };
}

export function evaluateAssertion(a: Assertion, io: FileSystemAdapter): string | null {
  if (a.type === 'fileExists') {
    return io.exists(a.target) ? null : `文件不存在：${a.target}`;
  }
  try {
    return io.read(a.target).includes(a.substring) ? null : `${a.target} 未包含「${a.substring}」`;
  } catch {
    return `无法读取：${a.target}`;
  }
}

export function evaluateEvidence(e: Evidence, io: FileSystemAdapter): string | null {
  if (e.type === 'assertion') return null; // L3 由本映射自身的 L1/L2 断言覆盖
  if (e.type === 'fileExists') {
    return io.exists(e.target) ? null : `证据文件不存在：${e.target}`;
  }
  try {
    return io.read('w-model-dev/scripts/cli/self-test.ts').includes(e.substring)
      ? null
      : `self-test.ts 未包含 fixture「${e.substring}」`;
  } catch {
    return '无法读取 self-test.ts';
  }
}

export function evaluateMapping(m: Mapping, io: FileSystemAdapter): AssertionResult {
  const failures = [
    ...m.assertions.map((a) => evaluateAssertion(a, io)),
    evaluateEvidence(m.evidence, io),
  ].filter((x): x is string => x !== null);
  return { id: m.id, layer: m.layer, scenario: m.scenario, passed: failures.length === 0, failures };
}

export function crossCheckIds(mappings: Mapping[], promptIds: number[]): string[] {
  const problems: string[] = [];
  const mappingIds = new Set(mappings.map((m) => m.id));
  for (const id of promptIds) {
    if (!mappingIds.has(id)) problems.push(`提示词 id=${id} 缺少映射`);
  }
  for (const m of mappings) {
    if (!promptIds.includes(m.id)) problems.push(`映射 id=${m.id} 无对应提示词`);
  }
  return problems;
}

function selfCheck(io: FileSystemAdapter): boolean {
  const passCases: Assertion[] = [
    { type: 'fileExists', target: 'package.json' },
    { type: 'contains', target: 'package.json', substring: '"name"' },
  ];
  const failCases: Assertion[] = [
    { type: 'fileExists', target: '__no_such_file__.nomatch' },
    { type: 'contains', target: 'package.json', substring: '__no_such_substring__' },
  ];
  const ok =
    passCases.every((c) => evaluateAssertion(c, io) === null) &&
    failCases.every((c) => evaluateAssertion(c, io) !== null);
  console.log(JSON.stringify({ selfCheck: ok }));
  return ok;
}

function main(): void {
  const io = createRealFs();
  if (process.argv.includes('--self-check')) {
    process.exitCode = selfCheck(io) ? 0 : 1;
    return;
  }
  const mappings = JSON.parse(io.read('eval/mappings.json')) as { mappings: Mapping[] };
  const prompts = JSON.parse(io.read('eval/w-model-dev-test-prompts.json')) as Array<{ id: number }>;
  const problems = crossCheckIds(mappings.mappings, prompts.map((p) => p.id));
  const results = mappings.mappings.map((m) => evaluateMapping(m, io));
  const passed = results.filter((r) => r.passed).length;
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    coverageProblems: problems,
    results,
  };
  fs.writeFileSync(path.join(repoRoot, 'eval', 'results.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`eval: ${passed}/${results.length} 通过`);
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`  ✗ id=${r.id} [${r.layer}] ${r.scenario}`);
    for (const f of r.failures) console.log(`      - ${f}`);
  }
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = passed === results.length && problems.length === 0 ? 0 : 1;
}

main();
```

- [ ] **Step 2: package.json scripts 段增加 eval（放在 `"//2 测试类"` 组内 self-test 之后）**

```json
    "self-test": "tsx w-model-dev/scripts/cli/self-test.ts",
    "eval": "tsx eval/runner.ts",
```

- [ ] **Step 3: .gitignore 增加（`# 日志` 段之前）**

```
# 仓内评估 runner 的瞬态结果（TSV 为持久证据，results.json 每次运行变化）
eval/results.json
```

---

### Task 1.3：runner 引擎单元测试（TDD）

**Files:**
- Test: `w-model-dev/scripts/__tests__/eval-runner.test.ts`

- [ ] **Step 1: 写测试（引擎自检以子进程方式验证，符合仓库 CLI 测试惯例）**

```ts
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('eval runner 引擎自检', () => {
  it('--self-check 退出码 0 且报告 selfCheck=true', () => {
    const stdout = execSync(`npx tsx "${join(repoRoot, 'eval', 'runner.ts')}" --self-check`, {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(stdout).toContain('"selfCheck":true');
  });

  it('--self-check 输出为合法 JSON（可被脚本消费）', () => {
    const stdout = execSync(`npx tsx "${join(repoRoot, 'eval', 'runner.ts')}" --self-check`, {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(() => JSON.parse(stdout.trim().split('\n').pop()!)).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/eval-runner.test.ts`
Expected: 2 passed（runner 已在 Task 1.2 实现，此测试守护回归；若失败先修 runner 再继续）

- [ ] **Step 3: 提交批次 1 资产**

```powershell
git add eval/mappings.json eval/runner.ts package.json .gitignore w-model-dev/scripts/__tests__/eval-runner.test.ts
git commit -m "feat(eval): add in-repo evaluation assertion runner and 25-prompt mapping assets"
```

---

### Task 1.4：基线运行与 TSV 回填（dry_run 行）

**Files:**
- Modify: `eval/w-model-dev-results.tsv`（追加 1 行）

- [ ] **Step 1: 全量运行基线**

Run: `npm run eval`
Expected: `eval: 25/25 通过`，exit 0（所有锚点已逐一预验证，见 F13-F15；若个别失败，按输出的具体锚点证据核对——若是映射笔误则修 mappings.json 重跑，若是真实资产缺口则如实记录为缺口，不得改锚点凑绿）

- [ ] **Step 2: 追加 TSV 基线行（9 列，Tab 分隔；时间与 sha 用真实值）**

```
2026-08-28T<HH:mm:ss>+08:00	<git rev-parse --short HEAD>	w-model-dev	-	<实际通过率，如 100.0>	baseline	L1/L2/L3 仓内断言（npm run eval；25 提示词映射）	三维度优化批次1基线	dry_run
```

- [ ] **Step 3: 提交**

```powershell
git add eval/w-model-dev-results.tsv
git commit -m "docs(eval): record batch-1 baseline assertion score in TSV"
```

---

### Task 1.5：e2e demo 重建（固定规格）与 TSV 回填

> **主会话执行任务**：不派发实现子代理。由编排者（主会话 Agent）按 SKILL.md 执行工作流扮演 O，用 Task 工具分派 S/V/G/R 角色子代理（**非 self-as-verifier 模式**）走完整 8 阶段。

**Files:**
- Create: `eval/e2e/2026-08-28-baseline.md`（e2e 过程记录）
- Modify: `eval/w-model-dev-results.tsv`（追加 1 行）
- demo 项目目录：`<仓库同级>/wm-e2e-demo/`（仓库外，不污染技能仓库）

- [ ] **Step 1: 固定 demo 规格（两次 e2e 不得变更，原文抄入记录）**

```
项目：todo-rest-demo —— Node ≥20 内置 node:http + node:test，零 npm 依赖
功能需求（6 条）：
  R1 创建待办 POST /todos（title 必填 1-200 字符，成功 201 + id）
  R2 列出待办 GET /todos（支持 ?status= 过滤）
  R3 更新待办 PUT /todos/:id（不存在返回 404）
  R4 删除待办 DELETE /todos/:id（204 / 404）
  R5 用户隔离（X-User-Id 头，用户只见自己的待办）
  R6 输入校验错误统一 400 + JSON 错误体
非功能：R7 单请求延迟 <50ms（内存实现）；R8 错误响应结构一致
成熟度：L2（完整 8 阶段；TLA+ L1 + BDD L1 必跑，静态校验无需 Java）
模式：非 self-as-verifier（O 编排 + S/V/G/R 子代理分派）
通过判据：8 阶段全部 CHECKPOINT 放行；RTM coveragePercent=100；
         四级测试（单元/集成/系统/验收）真实执行且通过；全部门禁 exit 0
```

- [ ] **Step 2: 按 SKILL.md 执行工作流 12 步 × 8 阶段推进**

每阶段：O 路由 → 🔴 CHECKPOINT 进入确认 → S 产出（产物+同步测试设计+回填 RTM；阶段 1-4 另产出 TLA+ 规格与 BDD features）→ R3 预防性审查 → V 评审（VerifierOutput）→ G 门禁（check-verifier-output + 阶段 1-4 加 check-tla-model/check-bdd-model；阶段 5 加 check-code-tla-consistency）→ O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新状态。`/wm analyze` 首次执行含 🔴 项目初始化 CHECKPOINT。

- [ ] **Step 3: 记录过程指标（写入 eval/e2e/2026-08-28-baseline.md）**

```
# e2e 基线记录（2026-08-28，批次 1）
- commit：<sha>   耗时：<总时长>
- 分派次数：S=<n> V=<n> G=<n> R=<n>（合计 <n>）
- CHECKPOINT 次数：<n>（预期 10：1 初始化 + 8 阶段门 + 1 发布放行）
- 返工次数：<n>（触发 R 根因定位的次数）
- 门禁执行：<逐阶段 exit code 列表>
- 测试执行：单元 <n> 用例 / 集成 <n> / 系统 <n> / 验收 <n>，全部通过
- RTM：coveragePercent=100，coverageStatus=covered
- 卡点记录：<无 / 具体卡点与处理>（若中途卡死：记录卡点后终止，
  基线以 Task 1.4 仓内断言为准，e2e 行 status 填 blocked 并说明）
```

- [ ] **Step 4: 追加 TSV e2e 行**

```
2026-08-28T<HH:mm:ss>+08:00	<sha>	w-model-dev	-	<通过/指标摘要>	baseline	e2e 重建（Todo REST demo，L2，非 self-as-verifier；详见 eval/e2e/2026-08-28-baseline.md）	8 阶段全通过	e2e
```

- [ ] **Step 5: 提交**

```powershell
git add eval/e2e/2026-08-28-baseline.md eval/w-model-dev-results.tsv
git commit -m "docs(eval): record batch-1 e2e baseline rebuild (todo-rest-demo L2)"
```

---

### Task 1.6：批次 1 合并回 main + 用户审查点

- [ ] **Step 1: 验收自检**

Run（在 worktree 内）: `npm run eval; npm run self-test`
Expected: 均通过/exit 0

- [ ] **Step 2: 合并回 main**

```powershell
cd <主仓库目录>
git merge batch1-3dim --no-ff -m "merge batch1-3dim: eval assets + baseline (3dim optimization)"
git worktree remove .worktrees/b1-3dim
git branch -d batch1-3dim
```

- [ ] **Step 3: 向用户展示基线证据（TSV 两行 + e2e 指标），获确认后进入批次 2**

---

## 批次 2：可靠性红灯清零

### Task 2.0：worktree 与红灯盘点

- [ ] **Step 1: 创建批次 2 worktree**

```powershell
git worktree add .worktrees/b2-3dim -b batch2-3dim main
cd .worktrees/b2-3dim
```

- [ ] **Step 2: 盘点真实失败集（以运行时证据重定范围，设计 §3.2）**

Run: `npm test 2>&1 | Select-String -Pattern 'FAIL|Test Files|Tests ' | Select-Object -First 12`
Expected: 失败文件为 platform-deps-hook.test.ts（26 个，退出码 127）+ 1 个含 2 个失败的文件（预计 docs-consistency-logic.test.ts，见 F4）。记录实际清单；若出现清单外失败文件，逐个确认是否 bash 相关（`Select-String -Pattern "'bash'"` 于该文件），bash 相关纳入 Task 2.1，非 bash 相关单独分析后处理。

---

### Task 2.1：Git Bash 显式解析（根因修复，TDD）

**Files:**
- Create: `w-model-dev/scripts/__tests__/test-support/git-bash.ts`
- Modify: `w-model-dev/scripts/__tests__/platform-deps-hook.test.ts`（L1-43 区域）
- Modify: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（L2571-2583）

- [ ] **Step 1: 写共享解析 helper（含平台守卫：Linux 上 'bash' 本来就正确）**

`w-model-dev/scripts/__tests__/test-support/git-bash.ts`：

```ts
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 解析 Git Bash 可执行文件路径（Windows）。
 *
 * 背景：PATH 首位可能是 WSL bash（C:\Windows\System32\bash.exe），它无法读取
 * Windows 路径的 hook 脚本（bash 返回 127）。解析链（fail-closed，与仓库门禁哲学一致）：
 *   GIT_BASH 环境变量 → git --exec-path 推导 → 常见安装路径 → 抛结构化诊断错误。
 * Linux/非 Windows 平台返回 'bash'（POSIX bash 可直接执行）。
 */
export function resolveGitBash(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform !== 'win32') return 'bash';
  const candidates: string[] = [];
  if (env.GIT_BASH) candidates.push(env.GIT_BASH);
  try {
    const execPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
    candidates.push(path.resolve(execPath, '..', '..', 'bin', 'bash.exe'));
  } catch {
    // git 不可用时跳过该候选，进入常见路径探测
  }
  candidates.push('C:\\Program Files\\Git\\bin\\bash.exe');
  candidates.push('C:\\Program Files (x86)\\Git\\bin\\bash.exe');
  if (env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'));
  }
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `[GIT_BASH] 未找到 Git Bash（已尝试：${candidates.join('；')}）。` +
      '当前 PATH 首位 bash 可能是 WSL bash（System32\\bash.exe），无法执行 Windows hook 脚本（退出码 127）。' +
      '请安装 Git for Windows，或设置 GIT_BASH 环境变量指向 bash.exe。',
  );
}

/** 测试用 bash 命令：Windows 上为解析出的 Git Bash 绝对路径，其他平台为 'bash'。 */
export function bashCommand(): string {
  return resolveGitBash();
}
```

- [ ] **Step 2: platform-deps-hook.test.ts 接入（3 处编辑）**

编辑 1 —— import 区（L1-7 之后）加：

```ts
import { bashCommand, resolveGitBash } from './test-support/git-bash.js';
```

编辑 2 —— `run()` 的 execFileAsync 第一个参数与内层 bash 调用（L24-32）：

```ts
    const result = await execFileAsync(
      bashCommand(),
      [
        '-c',
        'source "$BASH_ENV"; export -f git node npm tar cp rm mv mkdir 2>/dev/null || true; script="$1"; shift; "$BASH" "$script" "$@"',
        '--',
        script,
        ...args,
      ],
      {
        cwd,
        env: { ...process.env, ...environment },
      },
    );
```

（`"$BASH"` 为运行中 bash 自身路径，消除对会话内 PATH 顺序的依赖。）

编辑 3 —— 文件末尾追加解析器单元测试：

```ts
describe('resolveGitBash', () => {
  it('GIT_BASH 环境变量优先', async () => {
    const dir = await makeTempDir('git-bash-fake-');
    const fake = path.join(dir, 'bash.exe');
    await fs.writeFile(fake, '', 'utf8');
    expect(resolveGitBash({ ...process.env, GIT_BASH: fake })).toBe(fake);
  });
  it('解析结果不得为 System32 的 WSL bash', () => {
    expect(resolveGitBash().toLowerCase()).not.toContain('system32');
  });
});
```

- [ ] **Step 3: docs-consistency-logic.test.ts 接入（L2572-2574）**

import 区加（跟随该文件既有 import 风格放置）：

```ts
import { bashCommand } from './test-support/git-bash.js';
```

L2572-2574 的 `execFile('bash', ...)` 改为：

```ts
      execFile(
        bashCommand(),
        ['.githooks/pre-push', '--force'],
```

- [ ] **Step 4: 运行两个此前失败的测试文件**

Run: `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
Expected: 0 failed（127 消失；Linux 平台守卫保证不影响 POSIX 环境）

- [ ] **Step 5: 全量验证**

Run: `npm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | Select-Object -Last 2`
Expected: `Test Files  X failed` → `0 failed`；`Tests  0 failed`

- [ ] **Step 6: 提交**

```powershell
git add w-model-dev/scripts/__tests__/test-support/git-bash.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "fix(tests): resolve Git Bash explicitly to bypass WSL bash in PATH (exit 127 root cause)"
```

---

### Task 2.2：EBUSY 条件修复（仅复现时执行）

- [ ] **Step 1: 复现判定**

Run: `for ($i=0; $i -lt 3; $i++) { npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts 2>&1 | Select-String 'Tests ' } `
Expected: 3 次全绿 → **本任务标记 N/A，跳到 Task 2.3**；任一次出现 EBUSY → 执行 Step 2

- [ ] **Step 2: afterEach 清理加 retry（platform-deps-hook.test.ts L111-113 替换）**

```ts
async function removeTempDir(dir: string, attempts = 3): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch {
      if (i === attempts - 1) return; // 尽力清理；断言不依赖临时目录删除成功
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
});
```

- [ ] **Step 3: 复跑 Step 1 验证 + 提交（若执行了 Step 2）**

```powershell
git add w-model-dev/scripts/__tests__/platform-deps-hook.test.ts
git commit -m "fix(tests): retry temp dir cleanup to absorb Windows EBUSY file locks"
```

---

### Task 2.3：docs-consistency 转绿

- [ ] **Step 1: 运行**

Run: `npm run check:docs-consistency; $LASTEXITCODE`
Expected: exit 0（静态违规今日实测已为 0，动态门禁依赖的 vitest 事实包随 Task 2.1 转绿）
若仍 exit 1：按输出 `DOCS_CONSISTENCY_JSON` 的 violations 逐条修复（已知候选：活体文档硬编码计数 55/1002 漂移 → 改为实测值；dispatch-matrix/SKILL.md 脚本登记缺失 → 补登记）。修复后重跑至 exit 0。

- [ ] **Step 2: 提交（若有修复）**

```powershell
git add -A
git commit -m "docs: align living-doc counts and script registry per docs-consistency output"
```

---

### Task 2.4：门禁矩阵证据补齐与验收记录

**Files:**
- Create: `docs/changes/2026-08-28-b2-reliability-acceptance.md`

- [ ] **Step 1: 在同一 HEAD 依次跑门禁矩阵（记录真实输出摘要）**

```powershell
npm test                                # 期望 0 failed
npm run self-test                       # 期望 260/260
npm run typecheck                       # 期望 exit 0
npm run lint:security                   # 期望 exit 0
npm run check:docs-consistency          # 期望 exit 0
npm run check:gate -- --validate-templates   # 期望 exit 0
npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts   # 期望 exit 0
npm run prepush                         # 期望 exit 0（Windows 下经 Task 2.1 同类 bash 问题时改用：& "C:\Program Files\Git\bin\bash.exe" .githooks/pre-push --force）
```

- [ ] **Step 2: Persona CLI smoke（4 个 persona fixture）**

Run: `Get-ChildItem w-model-dev\samples -Recurse -Filter *.json | Where-Object { $_.FullName -match 'persona' } | Select-Object -ExpandProperty FullName`
对每个 persona fixture：`npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<fixture路径>" --persona`（按 check-verifier-output.ts L9-16 的实际用法执行）
Expected: 4 个均按契约通过或给出预期 exit code。

- [ ] **Step 3: 写验收记录（沿用 C2 记录格式：变更范围 / 真实执行记录表（命令+退出码）/ commit 身份链 / Deferred concerns）**

内容必须包含：根因分析（F3/F4）、修复方式、门禁矩阵真实结果表、`npm run eval` 仍 25/25、遗留事项（如 42.1.0 待办）。

- [ ] **Step 4: 提交**

```powershell
git add docs/changes/2026-08-28-b2-reliability-acceptance.md
git commit -m "docs(changes): batch-2 reliability acceptance record (all gates green)"
```

---

### Task 2.5：批次 2 合并回 main + 用户审查点

- [ ] **Step 1: 合并**

```powershell
cd <主仓库目录>
git merge batch2-3dim --no-ff -m "merge batch2-3dim: reliability red-light cleanup (3dim optimization)"
git worktree remove .worktrees/b2-3dim
git branch -d batch2-3dim
```

- [ ] **Step 2: 向用户展示验收记录（全绿证据），获确认后进入批次 3**

---

## 批次 3：易用性大重构 + 终值评估

### Task 3.0：worktree 与引用图盘点

- [ ] **Step 1: 创建批次 3 worktree**

```powershell
git worktree add .worktrees/b3-3dim -b batch3-3dim main
cd .worktrees/b3-3dim
```

- [ ] **Step 2: 建立被合并文件的入链引用图（风险 #4 缓解）**

对以下 14 个将被合并/吞并的文件名逐一执行（替换 `<f>`）：

```powershell
Select-String -Path w-model-dev\SKILL.md, w-model-dev\references\*.md, docs\skill-design-document_SSoT.md, docs\INSTALL.md, README.md, AGENTS.md, w-model-dev\templates\*, w-model-dev\scripts\cli\*.ts, w-model-dev\scripts\logic\*.ts, w-model-dev\scripts\__tests__\*.ts -Pattern '<f>' -SimpleMatch | ForEach-Object { "$($_.Path):$($_.LineNumber)" }
```

清单：`tla-plus-guide.md`、`tla-plus-syntax-reference.md`、`tla-plus-patterns-examples.md`、`tla-plus-review-checklist.md`、`tla-plus-tlc-configuration.md`、`bdd-guide.md`、`bdd-syntax-reference.md`、`bdd-patterns-examples.md`、`bdd-review-checklist.md`、`anti-patterns.md`、`dispatch-matrix.md`、`subagent-persona-matrix.md`（+ wave-2 触发时的 9 个：`glossary.md`、`format-conventions.md`、`directory-conventions.md`、`design-patterns-catalog.md`、`refactoring-catalog.md`、`code-smells-checklist.md`、`definition-of-done.md`）。

把命中清单写入 `.w-model/codegraph-queries/2026-08-28-b3-merge-inventory.md`（本地工作笔记，gitignored）。Task 3.1/3.4 的每处链接重写以该清单为验收依据（清单中每条命中都要么已改指新文件、要么确认无需修改并注明理由）。

---

### Task 3.1：wave-1 文件合并（设计 §4.2 第一波）

**Files:**
- Create: `w-model-dev/references/tla-plus.md`、`w-model-dev/references/bdd.md`
- Modify: `w-model-dev/references/hard-constraints.md`（追加反模式节）、`w-model-dev/references/subagent-delegation.md`（顶部插入 dispatch-matrix 节）、`w-model-dev/references/agent-personas.md`（追加 persona 矩阵节）
- Modify: 10 个合并源文件 → 各改为 1-2 行重定向 stub
- Modify: 入链重写（按 Task 3.0 清单）

- [ ] **Step 1: TLA+ 五合一（tla-plus.md）**

结构：`tla-plus-guide.md` 全文为主体 → 追加 `## 语法速查`（原 tla-plus-syntax-reference.md 正文）→ `## 模式与示例`（原 patterns-examples）→ `## 评审清单`（原 review-checklist）→ `## TLC 配置`（原 tlc-configuration）。合并时原文件内的标题降一级（`##` → `###`），内部锚点链接 `tla-plus-guide.md#x` → `tla-plus.md#x`（五个源文件名同理）。

- [ ] **Step 2: BDD 四合一（bdd.md）** —— 同 Step 1 模式：guide 主体 + `## 语法速查` + `## 模式与示例` + `## 评审清单`。

- [ ] **Step 3: anti-patterns.md 并入 hard-constraints.md** —— hard-constraints.md 末尾追加 `## 反模式（48 条）` 节，原 anti-patterns.md 正文降级迁入；全文「反模式 #N」引用无需改号（编号保持）。

- [ ] **Step 4: 角色四收敛为二**
- `subagent-delegation.md` 顶部插入 `## dispatch-matrix（权威脚本登记表）` 节：dispatch-matrix.md 的登记表原文迁入（37 个 cli 脚本名必须全部保留——F7 门禁依赖）。
- `agent-personas.md` 末尾追加 `## Persona 矩阵` 节：subagent-persona-matrix.md 原文迁入。

- [ ] **Step 5: 10 个源文件改写为重定向 stub（模板）**

```markdown
<!-- 42.0.0 重构：本文件已合并至 <目标文件名>；本重定向指针将于 42.1.0 移除。 -->
本文件内容已合并至 [<目标文件名>](<目标文件名>.md)，请更新引用。
```

- [ ] **Step 6: 按 Task 3.0 清单重写全部入链**（含 SKILL.md、command-reference.md、各 phase-N、SSoT、templates 若有）。

- [ ] **Step 7: 中间验证 + 提交**

Run: `npm run check:docs-consistency; npm run eval; npm test 2>&1 | Select-String 'Test Files|Tests ' | Select-Object -Last 2`
Expected: docs-consistency 对 dispatch-matrix 读取仍指向旧文件——**本步允许暂红**（门禁契约同步在 Task 3.5 统一完成，单提交纪律）；eval 若因锚点文件仍在（stub 无内容）失败，同样留待 Task 3.5 更新 mappings。npm test 应保持 0 failed。

```powershell
git add -A
git commit -m "refactor(references): wave-1 merge (TLA+ 5->1, BDD 4->1, anti-patterns into hard-constraints, roles 4->2)"
```

---

### Task 3.2：SKILL.md 大幅精简重写（247 行 / 173 非空行 → <100 非空行）

**Files:**
- Modify: `w-model-dev/SKILL.md`（整文件替换）

**验收口径**：非空行数 <100。验证命令：
`(Get-Content w-model-dev\SKILL.md | Where-Object { $_.Trim() -ne '' } | Measure-Object).Count`

- [ ] **Step 1: 用以下内容整文件替换 SKILL.md（frontmatter 的 description 原样保留——触发契约；version 保持 41.19.0，由 Task 3.6 统一 bump）**

````markdown
---
name: w-model-dev
version: 41.19.0
description: >-
  Use when the user explicitly invokes /wm, mentions W-model, W 模型 or W 开发模型,
  requests requirements traceability (RTM), stage gates, quality gates, or development
  and testing in parallel. When the user only asks for an end-to-end or complete
  development process without these signals, ask whether to use the W-model first.
---

# W-Model Development

## 核心原则

W 模型将开发与测试设计同步推进：需求分析 ↔ 验收测试设计、系统设计 ↔ 系统测试设计、概要设计 ↔ 集成测试设计、详细设计 ↔ 单元测试设计。RTM 追踪需求、设计、代码和四级测试，阶段门阻止未经验证的推进。

技能只提供编排、参考、模板和确定性门禁脚本；LLM-as-a-Verifier 由外部 Agent 按提示词执行，技能脚本不调用 LLM。设计决策以 `docs/skill-design-document_SSoT.md` 为准。

**交付层**：L0「纯 skill」= `SKILL.md` + `references/` + `templates/` + `examples/` + `subagent/` + `schemas/`，拷贝即激活；L1「带门禁」= L0 + `scripts/` + `samples/` + `tools/`（需项目根 `npm install`）。5 分钟上手见 [references/quickstart.md](references/quickstart.md)；安装细节见 `docs/INSTALL.md` §2。

## 触发决策

| 用户信号 | 行为 |
| --- | --- |
| `/wm ...`、W-model、W 模型、W 开发模型 | 立即启用 |
| 明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用 |
| 只说"完整流程""从需求到交付""全生命周期开发" | 先询问"是否采用 W 模型（含并行测试设计、RTM 和阶段门）？"；确认前不初始化 |
| 普通需求、设计、编码、测试、修复或技术解释 | 不启用，按普通任务处理 |

## 任务规模适配

**轻量 = 降载门禁强度，不是跳过阶段**：阶段流程、RTM、CHECKPOINT 一律不变；禁止以「任务小」为由跳过 S→V→G 顺序、RTM 回填或用户确认（反模式 #10/#21）。

| 任务规模 | 适配形态 | 门禁强度 |
| --- | --- | --- |
| 极小任务（demo/教学） | L0 交付层 + self-as-verifier（仅限 demo，模式细则见 subagent-delegation.md） | TLA+/BDD 可选，其余照跑 |
| 生产小项目 | 完整 8 阶段 + maturity L2 | TLA+ L1 + BDD L1 必跑，其余照跑 |
| 常规生产功能 | 完整 8 阶段 + maturity L3 | 全必跑 |

成熟度分级细则见 [references/operational-recovery.md](references/operational-recovery.md)。

## 不可违反的约束（14 条硬红线）

命中即回退到当前阶段起点。**执行前必读** [references/hard-constraints.md](references/hard-constraints.md)（含违反回退动作、关联脚本与反模式全表）。

| # | 约束 | 一句话语义 |
| --- | --- | --- |
| 1 | 测试设计前置 | 阶段 1–4 产物完成后立即产出对应测试设计 |
| 2 | 阶段门放行 | 评审通过 + 🔴 CHECKPOINT 用户确认才推进 |
| 3 | RTM 为事实源 | `.w-model/rtm.json` 唯一事实源，coverageStatus 与 coveragePercent 强一致 |
| 4 | 真实执行 | 不得估算覆盖率/测试/门禁结果，必须真实执行并记录 |
| 5 | 失败即回退 | 评审 C/D、测试失败、门禁 exit 1/2 均不得放行 |
| 6 | 按需加载 | 只读当前命令和阶段需要的参考 |
| 7 | 如实状态 | 未完成/未评审/未确认不得标为完成 |
| 8 | 编排者最小化 | O 只编排；实施动作由子代理执行；每阶段 S/V/G 各 ≥1 + R ≥3 |
| 9 | 门禁退出码不可伪 | exitCode 与 process.exit 强一致；G 存档 stdout；run-log 交叉校验 |
| 10 | 系统层级树 + REQ 层级 | 7 层图谱；REQ level 1-4 必填、level≥2 须 reqGroup |
| 11 | 闭环机制 + R3 审查 | 5 脚本每阶段门 exitCode=0；S 产出后 R3 三报告强制 |
| 12 | 返工必经根因定位 | V/G 不通过先 R 报告 → V 复审 → G 门禁 → S-fix |
| 13 | 行为门禁按成熟度分级 | 阶段 1-4 TLA+ + BDD 按成熟度强制 |
| 14 | 代码改动前后门禁 | 修改前 codegraph 影响分析落盘 + 改动后回归测试 |

完整反模式（48 条）、检测信号和回退动作见 [references/hard-constraints.md](references/hard-constraints.md)「反模式」节。

## 编排者-子代理边界

编排者（O）只做路由、状态读写、CHECKPOINT 等待、分派子代理、持久化和只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行（越权命中反模式 #10，回退当前阶段起点）。

| 角色 | 职责 | 关键不变式 |
| --- | --- | --- |
| S 产出 | 阶段产物 + 同步测试设计 + 回填 RTM；F（修复）由 S 兼任 | 签名链 inputProvenance 来源证明 |
| V 评审 | 按 agent-personas.md + verifier-spec.md 产出 VerifierOutput | R1-R13；单轴下限 <0.70 判失败 |
| G 门禁 | 独立跑 check-* 门禁 + 回填 exitCode 证据 | run-log R6 用 gate-logs 交叉校验 |
| A 分析 | 阶段 1–4 分块分析、合并建图 | 只产出 ingestion 中间产物 |
| R 根因 | 定位根因产出 RootCauseReport；R3 预防性审查 | 只产出报告，不实施修复 |

每阶段时序：O 路由 → 🔴 CHECKPOINT 进入确认 → S 产出 → R3 预防性审查 → V 评审 → G 门禁 → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新状态。细则（S 拆分、self-as-verifier 模式、只读脚本例外、dispatch-matrix 总览）见 [references/subagent-delegation.md](references/subagent-delegation.md)。

## 执行工作流

1. **路由任务**（O）：识别命令、阶段和用户意图；歧义触发先确认。
2. **环境自检**（O）：首次启用或门禁报依赖错误时跑 `npx tsx w-model-dev/scripts/cli/doctor.ts [--with-tla]`。
3. **读取状态**（O）：读 `.w-model/project.json` 与 `rtm.json`；损坏先恢复（operational-recovery.md）。
4. **检查前置产物**（O）：缺上游产物拒绝跳阶段，指出应返回的命令。
5. **加载最小引用集**（O）：只加载 SKILL.md + 当前阶段 phase-N 摘要 + 状态文件。
6. **初始化确认**（O）：🔴 CHECKPOINT · 项目初始化（复述阶段/同步测试设计/预期产物）。
7. **产出**（O→S）：生成产物 + 同步测试设计 + 更新 RTM；阶段 1–4 额外产出 TLA+ 规格与 BDD features（按成熟度）；ingestion 子流程（plan-chunks → A-chunk/A-cross → check-requirement-graph，收敛循环 MAX_ROUNDS=5）见 ingestion-chunk.md。
8. **R3 预防性审查**（O→R）：S 产出后、V 评审前三阶段审查（completeness/reliability/security）。
9. **评审**（O→V）：按 targetKind 路由 Persona 产出 VerifierOutput。**编排者不得自评**。
10. **门禁**（O→G）：跑 check-verifier-output.ts；阶段 1–4 额外 check-tla-model.ts + check-bdd-model.ts；阶段 5 额外 check-code-tla-consistency.ts。
11. **验证与暂停**（O）：失败 → R 根因 → V 复审 → G 门禁 → S-fix → 重走 V→G（跳过 R 命中反模式 #18）；S-fix 后与放行前分派冰山扫掠（iceberg-sweep-guide.md）。
12. **持久化**（O）：用户放行后才更新 `project.status`；状态写入统一经 wm-write.ts（锁 + 备份 + 原子写）。

> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 的「质量等级 / 各子标准分 / reworkHints」，等待用户选择放行或返工。
> 🔴 **CHECKPOINT · 发布放行**：阶段 8 终检跑 check-artifact-gate.ts，退出码 0 后展示 RTM 覆盖率、四级测试结果，等待用户选择发布或回退。

完整阶段切换与回退流程见 [references/workflow.md](references/workflow.md)。

## 命令速查

| 命令 | 路由 | 分派 |
| --- | --- | --- |
| `/wm analyze <需求>` | 阶段 1（首次初始化 + 验收测试设计） | O→S→V→G |
| `/wm design type=<架构\|概要\|详细>` | 阶段 2/3/4（须有已放行上游产物） | O→S→V→G |
| `/wm code <功能>` | 阶段 5（须有已放行详细设计；真实执行单测） | O→S→V→G |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 阶段 5–8（result 必填且必须来自真实测试输出） | O→S→V→G |
| `/wm review <目标>` | 阶段门（外部 Agent 评审） | O→V→G |
| `/wm status` / `/wm help` / `/wm metrics` | 只读 | O 只读 |
| `/wm reset` / `/wm import <文件>` | 状态操作（🔴 CHECKPOINT 后执行） | O 执行 |
| `/wm export [目录]` / `/wm hill-climbing` | 导出 / 改进信号 | O 只读 / O 分析 |

每命令的输入、输出、失败动作见 [references/command-reference.md](references/command-reference.md)。门禁脚本 37 个 .ts，登记总览见 subagent-delegation.md「dispatch-matrix」节。

## 阶段路由

| # | 开发阶段 | 同步/执行测试 | 吸收标记 | 必读参考 |
| --- | --- | --- | --- | --- |
| 1 | 需求分析 | 验收测试设计 | User Stories | phase-1-requirements.md |
| 2 | 系统设计 | 系统测试设计 | seam | phase-2-system-design.md |
| 3 | 概要设计 | 集成测试设计 | Tracer-bullet+opsx | phase-3-outline-design.md |
| 4 | 详细设计 | 单元测试设计 | opsx 三段式 | phase-4-detailed-design.md |
| 5 | 编码实现 | 单元测试执行 | archive+opsx | phase-5-coding.md |
| 6 | 集成测试 | 集成测试执行 | — | phase-6-integration-test.md |
| 7 | 系统测试 | 系统测试执行 | — | phase-7-system-test.md |
| 8 | 验收测试 | 验收测试执行 | — | phase-8-acceptance-test.md |

所有阶段另读 rtm-guide.md；TLA+（阶段 1-4）→ tla-plus.md；BDD → bdd.md；评审 → verifier-spec.md；状态 Schema → data-models.md；异常恢复 → operational-recovery.md；分派 → subagent-delegation.md。按需加载契约见 [references/subagent-delegation.md](references/subagent-delegation.md) 与 [references/toolbox.md](references/toolbox.md)。

## 快速自检

推进或完成声明前按 [references/quick-self-check.md](references/quick-self-check.md) 逐项核验；交互样例按需读 [examples/](examples/)。
````

- [ ] **Step 2: 验证非空行数**

Run: `(Get-Content w-model-dev\SKILL.md | Where-Object { $_.Trim() -ne '' } | Measure-Object).Count`
Expected: <100

- [ ] **Step 3: 验证 25 个评估锚点中落在 SKILL.md 的子串仍全部命中（终值前置检查）**

Run: `npm run eval`（此时 mappings 尚未更新，tla-plus-guide 等锚点读的是 stub → 预期部分失败属正常，留给 Task 3.5；本步只确认失败项**不含** target 为 SKILL.md 的断言）

---

### Task 3.3：QUICKSTART 新增

**Files:**
- Create: `w-model-dev/references/quickstart.md`

- [ ] **Step 1: 写入**

````markdown
# 快速上手（5 分钟）

## 1. 前置检查

- Node ≥20：`node -v`
- Git（Windows 需 Git for Windows；若 PATH 首位是 WSL bash，设置 `GIT_BASH` 指向 `C:\Program Files\Git\bin\bash.exe`）

## 2. 安装（L1 带门禁）

```powershell
git clone <本仓库> && cd <仓库目录>
npm install          # 同时装配 git hooks（core.hooksPath .githooks）
```

只要纯提示词/模板（L0）？把 `w-model-dev/` 下 `SKILL.md` + `references/` + `templates/` + `examples/` + `subagent/` + `schemas/` 拷贝到宿主技能目录即可，无需 npm。

## 3. 验证安装

```powershell
npm run self-test    # 期望：260/260 通过
npx tsx w-model-dev/scripts/cli/doctor.ts   # 依赖体检（含 TLA 用 --with-tla）
```

## 4. 第一个命令：/wm analyze

对 Agent 说：

> /wm analyze 为在线书店开发用户注册与登录功能，要求邮箱验证、密码强度策略与连续失败锁定

Agent（编排者 O）会：确认技术栈 → 🔴 CHECKPOINT 项目初始化 → 分派 S 产出需求规格+验收测试设计+RTM → R3 预防性审查 → V 评审 → G 门禁 → 🔴 CHECKPOINT 阶段门放行。每个 🔴 处等你确认。

## 5. 下一步

- 全命令细节：`references/command-reference.md`
- 8 阶段全景与回退：`references/workflow.md`
- 硬红线与反模式：`references/hard-constraints.md`

## 常见问题

- **门禁脚本报依赖错误**：回 L1 安装；或按 `doctor.ts` 输出补依赖。
- **Windows 下 hook 退出码 127**：PATH 首位是 WSL bash，设 `GIT_BASH` 环境变量。
- **状态文件损坏**：按 `references/operational-recovery.md` 恢复（.w-model/*.bak）。
````

- [ ] **Step 2: 提交（与 Task 3.2 合并为一次提交，单提交纪律）**

```powershell
git add w-model-dev/SKILL.md w-model-dev/references/quickstart.md
git commit -m "refactor(skill): rewrite SKILL.md to <100 non-empty lines (3-question principle) and add quickstart"
```

---

### Task 3.4：wave-2 合并（条件触发：实质内容文件 >40）

**触发判定**：`(Get-ChildItem w-model-dev\references\*.md | Where-Object { (Get-Content $_ | Measure-Object -Line).Lines -gt 2 } | Measure-Object).Count`（>2 行 = 实质内容文件，排除 1-2 行 stub）

- [ ] **Step 1: 若计数 >40，执行三组合并（模式同 Task 3.1）**

| 新文件 | 吸收 | 净减 |
| --- | --- | --- |
| `conventions.md` | glossary.md + format-conventions.md + directory-conventions.md | -2 |
| `coding-quality.md` | design-patterns-catalog.md + refactoring-catalog.md + code-smells-checklist.md | -2 |
| `quick-self-check.md`（扩充） | definition-of-done.md 并入为「完成定义」节 | -1 |

每个源文件留重定向 stub；入链按 Task 3.0 清单（含 wave-2 的 7 个文件名）重写。

- [ ] **Step 2: 若计数 ≤40，本任务标记 N/A（wave-1 已达标 38±2）**

- [ ] **Step 3: 提交（若执行）**

```powershell
git add -A
git commit -m "refactor(references): wave-2 merge (conventions, coding-quality, quick-self-check+DoD)"
```

---

### Task 3.5：门禁契约与评估锚点同步（单提交内闭合，不留隔夜红灯）

**Files:**
- Modify: `w-model-dev/scripts/cli/check-docs-consistency.ts`（dispatchMatrix 数据源路径）
- Modify: `w-model-dev/scripts/logic/docs-consistency-logic.ts`（violation 文案 + 注释中的 dispatch-matrix.md 表述）
- Modify: `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（相关断言/fixture）
- Modify: `eval/mappings.json`（4 处 target 更新）
- Modify: `docs/skill-design-document_SSoT.md`（文件结构表 + dispatch-matrix 表述）
- Modify: `w-model-dev/references/command-reference.md`（guide 链接）
- Modify: `docs/INSTALL.md` / `README.md`（若 Task 3.0 清单命中）

- [ ] **Step 1: check-docs-consistency.ts 数据源切换** —— 定位读取 `references/dispatch-matrix.md` 的常量（`Get-ChildItem w-model-dev\scripts\cli\check-docs-consistency.ts | Select-String dispatch-matrix`），改为读取 `references/subagent-delegation.md`（变量名 `dispatchMatrix` 与下游 `buildDocConsistencyReport` 注入保持不变，只换文件路径）。

- [ ] **Step 2: docs-consistency-logic.ts L1002-1015 注释与 message 文案** —— `dispatch-matrix.md 未登记脚本「...」` → `subagent-delegation.md（dispatch-matrix 节）未登记脚本「...」`；函数头注释同步。`SKILL.md「N 个 .ts」` 计数断言无需改（新 SKILL.md 已含「37 个 .ts」）。

- [ ] **Step 3: docs-consistency-logic.test.ts** —— `Select-String -Pattern 'dispatch-matrix' w-model-dev\scripts\__tests__\docs-consistency-logic.test.ts` 定位全部命中：注入 fixture 的 dispatchMatrix 字符串改用 subagent-delegation.md 真实内容（或含全部 37 个脚本名的等价 fixture）；断言文案同步。

- [ ] **Step 4: eval/mappings.json 4 处 target 更新**
  - id 18：`w-model-dev/references/tla-plus-guide.md` → `w-model-dev/references/tla-plus.md`
  - id 19：`w-model-dev/references/bdd-guide.md` → `w-model-dev/references/bdd.md`
  - id 24：`w-model-dev/references/anti-patterns.md` → `w-model-dev/references/hard-constraints.md`（substring 仍为 `越权`）
  - id 23：`{ "type": "contains", "target": "w-model-dev/SKILL.md", "substring": "self-as-verifier" }` → target 改 `w-model-dev/references/subagent-delegation.md`（self-as-verifier 模式细则已下沉该文件；新 SKILL.md 规模适配表亦含该词，改 target 为下沉处保证长期稳定）

- [ ] **Step 5: SSoT / INSTALL / README / command-reference 按 Task 3.0 清单同步**

- [ ] **Step 6: 全量回归（三网齐验）**

```powershell
npm run eval                                            # 期望 25/25（终值）
npm test 2>&1 | Select-String 'Test Files|Tests ' | Select-Object -Last 2   # 期望 0 failed
npm run check:docs-consistency; $LASTEXITCODE           # 期望 0
npm run self-test                                       # 期望 260/260
```

- [ ] **Step 7: 提交**

```powershell
git add -A
git commit -m "refactor(gates): sync docs-consistency contract, eval anchors and cross-references to merged layout"
```

---

### Task 3.6：终值评估 + 版本 42.0.0

**Files:**
- Create: `eval/e2e/2026-08-28-final.md`
- Modify: `eval/w-model-dev-results.tsv`（追加 2 行）
- Modify: `eval/README.md`（§4 状态节）
- Modify: `package.json` 等 7 处版本镜像（经 version-bump）

- [ ] **Step 1: e2e 第二次执行（主会话执行任务，规格与 Task 1.5 Step 1 逐字一致，走新 SKILL.md 工作流）** —— 记录同款指标到 `eval/e2e/2026-08-28-final.md`，并与基线逐项对比（分派次数 / CHECKPOINT 次数 / 返工次数 / 耗时）。

- [ ] **Step 2: TSV 追加终值两行**

```
2026-08-28T<HH:mm:ss>+08:00	<sha>	w-model-dev	<基线分>	<终值分>	keep	L1/L2/L3 仓内断言（批次3重构后终值）	三维度优化终值；SKILL.md<100非空行	dry_run
2026-08-28T<HH:mm:ss>+08:00	<sha>	w-model-dev	-	<指标摘要>	keep	e2e 终值（同规格 demo；对比 eval/e2e/2026-08-28-baseline.md）	终值vs基线对比见记录	e2e
```

- [ ] **Step 3: eval/README.md §4 评估状态** —— 「评估暂停中」段改为：「评估已恢复（2026-08-28 起）：仓内断言 `npm run eval` + e2e 记录（eval/e2e/），TSV 持续追踪」。

- [ ] **Step 4: 版本 bump**

```powershell
node scripts/version-bump.cjs 42.0.0
```

然后在 CHANGELOG.md 新插入的 `## [42.0.0] - <date>` 节内填写正文（SKILL.md 大重写 / references 合并 / eval 资产 / 可靠性修复 / 验收数据），格式沿用现有 `### 修复（...）` 风格。

- [ ] **Step 5: bump 后自验证**

Run: `npm run check:docs-consistency; $LASTEXITCODE`
Expected: 0（七处版本镜像一致）

- [ ] **Step 6: 提交**

```powershell
git add -A
git commit -m "release: 42.0.0 - 3dim optimization (eval loop restored, reliability green, SKILL.md rewritten)"
```

---

### Task 3.7：批次 3 验收记录 + 合并回 main

**Files:**
- Create: `docs/changes/2026-08-28-b3-acceptance.md`

- [ ] **Step 1: 写验收记录** —— 必含：SKILL.md 非空行数实测、references 实质文件数实测（验收线 ≤40）、10 个重定向 stub 清单（42.1.0 清理待办）、eval 终值 vs 基线对比、e2e 两次指标对比、门禁矩阵全绿证据、commit 身份链。

- [ ] **Step 2: 合并回 main**

```powershell
cd <主仓库目录>
git merge batch3-3dim --no-ff -m "merge batch3-3dim: usability rewrite + final eval (3dim optimization complete)"
git worktree remove .worktrees/b3-3dim
git branch -d batch3-3dim
```

- [ ] **Step 3: 最终全量验收（主仓库 main 上）**

```powershell
npm run eval; npm test; npm run self-test; npm run check:docs-consistency
```

全部通过后向用户提交三批次总结（基线 vs 终值证据链）。

---

## 自审记录（writing-plans Self-Review）

1. **Spec coverage**：设计 §2（批次1）→ Task 1.1-1.5；§3（批次2）→ Task 2.0-2.4；§4.1-4.5（批次3）→ Task 3.2/3.1/3.3/3.4/3.5/3.6；§5 风险缓解内嵌（e2e 降级→Task 1.5 Step 3 卡点条款；EBUSY 复现后修→Task 2.2；锚点回归→Task 3.5 Step 6；引用图→Task 3.0；单提交→Task 3.1-3.5 结构）；§6 执行纪律（worktree/TDD/不伪造证据）贯穿；§8 验收总表逐项落在 Task 1.6/2.5/3.7。设计 §4.2「约 38 文件」为估算值，实际口径修正为「实质内容文件 ≤40（38±2）」并在 Task 3.4 设条件触发，已在验收记录模板中如实呈现。
2. **Placeholder scan**：无 TBD/TODO；e2e 指标与 TSV 行中的 `<n>`/`<sha>` 为运行时真实值的填位符（指令明确「用真实值」），非计划缺口。
3. **Type consistency**：`resolveGitBash(env?)`/`bashCommand()` 签名在 Task 2.1 三处使用一致；`evaluateAssertion/evaluateEvidence/evaluateMapping/crossCheckIds` 导出名在 Task 1.2 定义与 Task 1.3 测试引用一致（测试以子进程方式调用，无直接 import 依赖）；mappings.json 的 `type: contains|fileExists` 与 runner 的类型判别一致。
