#!/usr/bin/env node
/**
 * 环境自检（doctor）
 *
 * 审计修复 B1b：一条命令回答「环境是否就绪、缺什么、怎么修」。
 * 新用户首次启用或门禁报依赖错误时运行（SKILL.md 步骤 1.5）。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/doctor.ts [--with-tla] [--json]
 *
 * 参数：
 *   --with-tla    TLA+ 相关项（java>=11 / tools/tla2tools.jar）按阻断级校验（默认提示级 warn）
 *   --json        机器可读输出：stdout 单行 DOCTOR_JSON {checks:[...],exitCode}
 *
 * 检查项：node>=18 / tsx / ajv+ajv-formats / java>=11（--with-tla 必需）/ tools/tla2tools.jar /
 *         codegraph / openspec（后两者可选，恒为提示级）
 *
 * 退出码：
 *   0  环境就绪（允许 warn 级提示项）
 *   1  存在阻断级缺失（fail）
 *   2  输入错误（未知参数）
 *
 * @module
 */
import { execFile as execFileCb } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { checkEnvironment, deriveDoctorExitCode, type EnvProbe } from '../logic/doctor-logic.js';

const execFile = promisify(execFileCb);
const nodeRequire = createRequire(import.meta.url);
const TOOLS_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'tools');

/** 真实环境探测：resolveModule 走 node_modules 解析；runCommand 用 execFile（字面量参数，无 shell 拼接） */
const realProbe: EnvProbe = {
  nodeVersion: process.version,
  resolveModule: (name: string) => {
    try {
      nodeRequire.resolve(`${name}/package.json`);
      return true;
    } catch {
      return false;
    }
  },
  fileExists: (rel: string) => existsSync(join(TOOLS_DIR, rel)),
  runCommand: async (cmd: string, args: string[]) => {
    try {
      const { stdout, stderr } = await execFile(cmd, args, { timeout: 15_000 });
      return { ok: true, output: `${stdout}${stderr}` };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: unknown };
      // java -version 输出在 stderr 且以退出码非 0 结束的情况不存在；ENOENT / 超时统一按不可用处理
      const partial = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      if (partial.includes('version "')) return { ok: true, output: partial };
      return { ok: false, output: partial };
    }
  },
};

const ICON: Record<string, string> = { ok: '✅', fail: '❌', warn: '⚠️' };

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== '--with-tla' && a !== '--json');
  if (unknown.length > 0) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `未知参数「${unknown[0]}」`,
      detail: '用法: doctor.ts [--with-tla] [--json]',
      exitCode: 2,
    });
    return;
  }
  const withTla = args.includes('--with-tla');
  const jsonMode = args.includes('--json');

  const results = await checkEnvironment(realProbe, { withTla });
  const exitCode = deriveDoctorExitCode(results);

  if (jsonMode) {
    console.log(`DOCTOR_JSON ${JSON.stringify({ script: 'doctor.ts', checks: results, exitCode })}`);
    process.exitCode = exitCode;
    return;
  }

  console.log('════════════════════════════════════════════');
  console.log(`W-Model 环境自检${withTla ? '（--with-tla：TLA+ 项为阻断级）' : ''}`);
  console.log('════════════════════════════════════════════');
  for (const r of results) {
    console.log(`${ICON[r.status]} ${r.name.padEnd(10)} ${r.detail}`);
    if (r.hint) console.log(`   ↳ ${r.hint}`);
  }
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  console.log('────────────────────────────────────────────');
  console.log(
    exitCode === 0
      ? `环境就绪（${failCount} 阻断 / ${warnCount} 提示）`
      : `存在 ${failCount} 项阻断级缺失（按上方 ↳ 指引修复后重跑）`,
  );
  process.exitCode = exitCode;
}

runMain(main);
