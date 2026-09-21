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
 *         codegraph / superpowers（后两者可选，恒为提示级）
 *
 * 退出码：
 *   0  环境就绪（允许 warn 级提示项）
 *   1  存在阻断级缺失（fail）
 *   2  输入错误（未知参数）
 *
 * @module
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { probeCliCommand } from '../lib/cli-probe.js';
import { exitWithError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { resolveVendoredAdoptionPath, scanHostSuperpowersSkills } from '../lib/superpowers-detect.js';
import { checkEnvironment, deriveDoctorExitCode, type EnvProbe } from '../logic/doctor-logic.js';

const nodeRequire = createRequire(import.meta.url);
// 审计修复 D1：import.meta.url 指向**文件本身**（…/scripts/cli/doctor.ts），
// join 前必须先 dirname() 取目录，否则解析成 …/scripts/tools/（把 cli/doctor.ts 当目录段）
// → tools/tla2tools.jar 在盘也恒报缺失（--with-tla 时误阻断）。
const CLI_DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(CLI_DIR, '..', '..', 'tools');
// superpowers L3 项目目录（doctor 运行于技能包所在仓库：cli/ → 上三级 = 仓库根）
const PROJECT_SUPERPOWERS_DIR = resolve(CLI_DIR, '..', '..', '..', 'docs', 'superpowers');

/** 真实环境探测：resolveModule 走 node_modules 解析；runCommand 经 lib/cli-probe 受控派发（字面量参数，无用户输入） */
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
    // 2026-09-21 修复轮 1（评审裁定 2）：改走与 ensure-codegraph.ts 同一派发实现——原 async
    // execFile 直投在 Windows 下解析不了 npm 全局 CLI 的 .cmd shim（ENOENT），doctor 报
    // 「未安装」而 ensure 报 ready。受控字面量即参数安全前提，超时由探针注入（15s，SIGKILL）。
    const result = probeCliCommand(cmd, args, { timeoutMs: 15_000 });
    const partial = `${result.stdout}${result.stderr}`;
    // java -version 输出在 stderr 且以退出码非 0 结束的情况不存在；ENOENT / 超时统一按不可用处理
    if (result.ok || partial.includes('version "')) return { ok: true, output: partial };
    return { ok: false, output: partial };
  },
  // superpowers 三层（与 ensure-codegraph.ts 同判据的轻量版）：宿主技能 / vendored 副本 / 项目目录
  superpowersProbe: () => ({
    hostSkillsFound: scanHostSuperpowersSkills(homedir()),
    vendoredAdoption: existsSync(resolveVendoredAdoptionPath(CLI_DIR)),
    projectDir: existsSync(PROJECT_SUPERPOWERS_DIR),
  }),
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
