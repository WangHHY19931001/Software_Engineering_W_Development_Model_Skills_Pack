#!/usr/bin/env tsx
/**
 * 编码计划制品门（Coding Plan Checker）
 *
 * 校验 superpowers 编码链（writing-plans → SDD → TDD → code-review）的「编码计划制品契约」
 * （superpowers 替换 opsx 批次 1；对应反模式 #39 谱系的编码链形态：跳过编码计划/账本/评审产物）。
 * 校验：R1 plan 存在+前缀 → R2 任务节与验证命令行 → R3 账本身份与 complete 覆盖 →
 * R4 任务三件套非空+review diff → R5 R3×9+V×3（stage=plan/execute/finalize）→ R6 归档态快照回退。
 * 纯校验逻辑在 `logic/coding-plan-logic.ts`（本 CLI 为壳：参数解析 + scope 装载 + 报告输出）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-coding-plan.ts <project-root> --phase <5|6|7|8> \
 *       --scope=<change-scope.json> [--json]
 *   npx tsx w-model-dev/scripts/cli/check-coding-plan.ts <project-root> --phase <5|6|7|8> \
 *       --scope=<change-scope.json> --preflight
 *
 * 参数：
 *   project-root   项目根目录
 *   --phase        校验阶段 5|6|7|8（支持 --phase N 与 --phase=N）
 *   --scope=FILE   变更上下文 manifest（schemas/change-scope.schema.json）；与
 *                  --change/--base/--head 互斥；阶段 5-8 必选（缺失 → exit 1）。
 *                  strict 模式只校验 scope.changeId 对应的编码计划制品：
 *                  活动位 docs/plans/<changeId>.plan.md 优先，活动位缺失时回退归档位
 *                  docs/changes/archive/<changeId>/ 或 <YYYY-MM-DD>-<changeId>/（**锚定匹配** + 日期
 *                  前缀日历回读校验；恰一匹配才继续；多匹配 fail-closed；非法日历日独立成态），
 *                  归档态按同契约校验 plan/账本快照（fail-closed）
 *   --change/--base/--head  薄封装：以实际 Git 变更集合生成等价 scope（免维护 manifest）
 *   --preflight    只读电池前自检（N-2）：只打印单行
 *                  `CODING_PLAN_PREFLIGHT_JSON {required, missing, invalid, artifacts}`——
 *                  required 恒为固定 14 项（9 R3 + 3 V + plan + 账本），任务三件套/review diff 为变长
 *                  `artifacts` 只列出；退出码 = missing + invalid 为 0 时 0，否则 1。
 *                  该分支**不**执行 R1-R6 判据、不改非 preflight 路径的任何语义；
 *                  changeId 取 scope.ok 或「scope 被拒时的 attemptedChangeId」（预检不判 scope 的
 *                  git 绑定有效性，绑定有效性仍由主门判；取自被拒 scope 时向 stderr 打一行诊断）。
 *   --json         机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  编码计划制品齐全（--preflight：固定必需项无 missing/invalid）
 *   1  缺失制品或审查（R1-R6 任一违规；--preflight：存在 missing 或 invalid）
 *   2  输入错误（stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 收尾 CODING_PLAN_JSON 摘要，便于 Agent 正则截取）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field/detail 仅在有值时输出进 ERROR_JSON）
 *
 * R5 非阻断诊断（裁定 A，非 preflight 路径）：审查产物「在盘且非空但无行级证据锚」时向 **stderr**
 *   打一行 `○ R5 诊断：…`；不改退出码、不进 CODING_PLAN_JSON / GATE_JSON / artifact-gate 聚合。
 *
 * @module
 */

import * as path from 'node:path';

import { exitWithError } from '../lib/cli-error.js';
import { nodeCodingPlanFs } from '../lib/coding-plan-fs.js';
import { isDirectInvocation } from '../lib/is-main.js';
import { runMain } from '../lib/run-main.js';
import { hasFlag } from '../lib/parse-args.js';
import { loadCliScope } from '../lib/load-cli-scope.js';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import {
  checkCodingPlan,
  collectMissingAnchorReviews,
  preflightCodingPlan,
  type CodingPlanCheckResult,
} from '../logic/coding-plan-logic.js';

const EMPTY_RESULT: CodingPlanCheckResult = {
  passed: false,
  violations: [],
  planPath: null,
  ledgerPath: null,
  tasksTotal: 0,
  tasksCompleted: 0,
  artifactsFound: [],
  reviewsFound: [],
};

async function main(): Promise<void> {
  const startTime = Date.now();
  // --json：机器可读报告模式（不打印人类可读分隔线与统计）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  // --preflight：只读电池前自检（N-2）；命中即走独立分支，不执行 R1-R6
  const preflightMode = hasFlag(process.argv.slice(2), 'preflight');
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  // 统一 --phase 校验（lib/parse-phase.ts，5-8；支持 --phase N 与 --phase=N）
  const hasPhaseFlag = process.argv.includes('--phase') || process.argv.some((a) => a.startsWith('--phase='));
  const phaseParsed = parsePhaseArg(process.argv, { min: 5, max: 8 });

  if (!file || !hasPhaseFlag) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-coding-plan.ts <project-root> --phase <5|6|7|8> --scope=<file>',
      exitCode: 2,
    });
    return;
  }
  if (phaseParsed === undefined) {
    // 沿用已退役 check-opsx-artifacts 的分支语义（该脚本退出码契约由本脚本承接）：空格形态数字越界 → '参数非法 --phase=N'；非数字 / 缺值 / 等号形态 → '参数缺失'
    const phaseIdx = args.indexOf('--phase');
    const phaseRaw = phaseIdx >= 0 ? args[phaseIdx + 1] : undefined;
    if (phaseRaw !== undefined && /^\d+$/.test(phaseRaw)) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: `参数非法 --phase=${phaseRaw}`,
        detail: '须为 5-8 的整数',
        exitCode: 2,
      });
      return;
    }
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失 <project-root> 或 --phase',
      detail: '用法: npx tsx check-coding-plan.ts <project-root> --phase <5|6|7|8> --scope=<file>',
      exitCode: 2,
    });
    return;
  }
  const phase = phaseParsed.phase;

  const abs = path.resolve(file);

  // ==================== ChangeScope 装载（strict changeId 绑定；阶段 5-8 必选） ====================
  const loaded = loadCliScope(process.argv, abs, phase);

  // ==================== --preflight 只读电池前自检（N-2：新增分支，不改非 preflight 任何语义） ====================
  if (preflightMode) {
    // changeId 取 ok 或「scope 被拒时的 attemptedChangeId」：预检只判产物在盘与否，
    // 不判 scope 的 git 绑定有效性（headRef 过期等由主门判，预检阶段 scope 未必已同步）
    const preflightChangeId =
      loaded.kind === 'ok' ? loaded.scope.changeId : loaded.kind === 'violations' ? loaded.attemptedChangeId : null;
    if (preflightChangeId === null) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '--preflight 须提供 --scope=<file>（或 --change/--base/--head）以解析 changeId',
        detail:
          '用法: npx tsx check-coding-plan.ts <project-root> --phase=<5|6|7|8> --scope=<change-scope.json> --preflight',
        exitCode: 2,
      });
      return;
    }
    if (loaded.kind === 'violations') {
      process.stderr.write(
        `○ --preflight 诊断：scope 未通过校验，按 scope.changeId=${preflightChangeId} 出清单（清单只判产物在盘与否，与 scope 有效性无关；${loaded.violations.join('；')}）\n`,
      );
    }
    const preflight = preflightCodingPlan(abs, phase, preflightChangeId, nodeCodingPlanFs);
    console.log(`CODING_PLAN_PREFLIGHT_JSON ${JSON.stringify(preflight)}`);
    process.exitCode = preflight.missing.length + preflight.invalid.length === 0 ? 0 : 1;
    return;
  }

  // R5 非阻断诊断（裁定 A）：在盘非空但无行级证据锚的审查产物 → stderr 一行提示，
  // 不改退出码、不进 CODING_PLAN_JSON / GATE_JSON / artifact-gate 聚合
  const anchorGaps = collectMissingAnchorReviews(abs, phase, nodeCodingPlanFs);
  if (anchorGaps.length > 0) {
    process.stderr.write(
      `○ R5 诊断：${anchorGaps.length} 份审查产物未含行级证据锚（建议 path:Lnn=… 或 path:§sec=…）：${anchorGaps.join(', ')}\n`,
    );
  }

  let result: CodingPlanCheckResult;
  let scopeLabel = '（未提供）';
  let changeId: string | undefined;
  if (loaded.kind === 'missing') {
    result = { ...EMPTY_RESULT, violations: loaded.reasons };
  } else if (loaded.kind === 'violations') {
    result = { ...EMPTY_RESULT, violations: loaded.violations };
  } else {
    scopeLabel = loaded.scopeLabel;
    changeId = loaded.scope.changeId;
    result = checkCodingPlan(abs, phase, loaded.scope.changeId, nodeCodingPlanFs);
  }
  const exitCode = result.passed ? 0 : 1;

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'coding-plan',
        passed: result.passed,
        reasons: result.violations,
        violations: buildViolationDistribution(result.violations.length),
        durationMs: Date.now() - startTime,
      },
      exitCode,
    );
    process.exitCode = exitCode;
    return;
  }

  console.log('═'.repeat(60));
  console.log('编码计划制品校验（Coding Plan Checker，strict changeId 绑定）');
  console.log('═'.repeat(60));
  console.log(`项目根        : ${abs}`);
  console.log(`阶段          : ${phase}`);
  console.log(`变更上下文    : ${scopeLabel}`);
  console.log(`编码计划      : ${result.planPath ?? '（未找到）'}`);
  console.log(`执行账本      : ${result.ledgerPath ?? '（未找到）'}`);
  console.log(`任务覆盖      : ${result.tasksCompleted}/${result.tasksTotal}`);
  console.log(`三件套/评审包 : ${result.artifactsFound.join(', ') || '（无）'}`);
  console.log(`审查产物      : ${result.reviewsFound.join(', ') || '（无）'}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (!result.passed) {
    console.log('未通过原因：');
    for (const v of result.violations) {
      console.log(`  - ${v}`);
    }
  }

  printGateReport(
    'CODING_PLAN',
    {
      type: 'coding-plan',
      passed: result.passed,
      phase,
      changeId,
      planPath: result.planPath,
      ledgerPath: result.ledgerPath,
      tasksTotal: result.tasksTotal,
      tasksCompleted: result.tasksCompleted,
      artifactsFound: result.artifactsFound,
      reviewsFound: result.reviewsFound,
      violations: result.violations,
    },
    exitCode,
  );
  process.exitCode = exitCode;
  return;
}

// 入口守卫（lib/is-main.ts，双侧 realpath 加固）：仅直接执行时运行 main
if (isDirectInvocation(import.meta.url)) {
  runMain(main);
}
