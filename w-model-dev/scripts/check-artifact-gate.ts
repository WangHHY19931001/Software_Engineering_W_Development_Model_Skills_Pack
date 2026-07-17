#!/usr/bin/env tsx
/**
 * 工件质量门校验脚本（Artifact Gate Checker）
 *
 * 对应 SSoT §10.5「工件质量门」。供 AI Agent 在验收测试阶段直接调用，
 * 判定 W 模型产出物是否满足放行条件。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
 *
 * 参数：
 *   project-dir  项目根目录（默认：当前工作目录）
 *
 * 读取：
 *   <project-dir>/.w-model/rtm.json   （由 Agent 在执行 /wm 命令时维护）
 *
 * 退出码：
 *   0  质量门通过（覆盖率 100% 且四级测试全部通过）
 *   1  质量门未通过（reasons 列出具体原因）
 *   2  输入错误（RTM 文件不存在 / 格式非法）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  checkArtifactGate,
  type RTMMatrixShape,
} from './gate-logic.js';

const RTM_RELATIVE_PATH = path.join('.w-model', 'rtm.json');

async function main(): Promise<void> {
  const projectDir = process.argv[2] ?? process.cwd();
  const rtmFile = path.resolve(projectDir, RTM_RELATIVE_PATH);

  let raw: string;
  try {
    raw = await fs.readFile(rtmFile, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ RTM 文件不存在: ${rtmFile}`);
      console.error('  请先在项目内执行 /wm 命令走完 W 模型阶段以生成 .w-model/rtm.json');
      process.exit(2);
    }
    throw err;
  }

  let matrix: RTMMatrixShape;
  try {
    matrix = JSON.parse(raw) as RTMMatrixShape;
  } catch {
    console.error(`✗ RTM 文件解析失败（非合法 JSON）: ${rtmFile}`);
    process.exit(2);
  }

  const result = checkArtifactGate(matrix);

  // 人类可读报告
  console.log('═'.repeat(60));
  console.log('工件质量门校验（Artifact Gate）');
  console.log('═'.repeat(60));
  console.log(`项目目录      : ${projectDir}`);
  console.log(`RTM 文件      : ${rtmFile}`);
  console.log(`RTM 覆盖率    : ${result.coveragePercent}%`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('所有放行条件均满足：覆盖率 100% 且四级测试全部通过。');
  } else {
    console.log('未通过原因：');
    for (const r of result.reasons) {
      console.log(`  - ${r}`);
    }
  }

  // 末尾 JSON 摘要（供 Agent 程序解析；行首标记便于正则截取）
  console.log('─'.repeat(60));
  console.log('GATE_JSON ' + JSON.stringify({
    type: 'artifact',
    passed: result.passed,
    coveragePercent: result.coveragePercent,
    reasons: result.reasons,
  }));

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error('门禁校验脚本异常:', err);
  process.exit(2);
});
