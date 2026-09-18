/**
 * logic/doctor-logic.ts 单元测试（审计修复 B1b：环境自检）
 *
 * 覆盖：node 版本门 / tsx / ajv / java 版本解析（--with-tla 必需 vs 默认提示级）/
 *       tla2tools.jar 存在性 / codegraph+openspec 可选提示 / 汇总退出码派生。
 * 环境探测经 EnvProbe 注入（logic 级用例无真实 execFile 调用）；
 * 末段另有**真实 CLI 子进程 + 真实文件系统**用例锁 TOOLS_DIR 路径解析（D1 回归）——
 * 注入桩会让路径缺陷隐形，故该维度只能走真实解析路径。
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkEnvironment, deriveDoctorExitCode, type EnvProbe } from '../logic/doctor-logic.js';
import { parseJavaMajor } from '../lib/java-version.js'; // 审计修复 P15：Java 版本解析单源化（自 lib 导入）
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
/** 技能包根（本文件位于 w-model-dev/scripts/__tests__/） */
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCTOR_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'cli', 'doctor.ts');
const TLA_JAR = path.join(SKILL_ROOT, 'tools', 'tla2tools.jar');

/** 全绿探测桩：node 20 / 依赖全装 / java 11 / jar 存在 / codegraph+openspec 可用 */
function greenProbe(): EnvProbe {
  return {
    nodeVersion: 'v20.11.0',
    resolveModule: () => true,
    fileExists: () => true,
    runCommand: (cmd: string) =>
      cmd === 'java'
        ? Promise.resolve({ ok: true, output: 'openjdk version "11.0.21" 2023-10-17' })
        : Promise.resolve({ ok: true, output: '1.2.3' }),
  };
}

describe('parseJavaMajor', () => {
  it('解析 openjdk version "11.0.21" → 11', () => {
    expect(parseJavaMajor('openjdk version "11.0.21" 2023-10-17')).toBe(11);
  });
  it('解析 17 / 21 主版本', () => {
    expect(parseJavaMajor('openjdk version "17.0.8"')).toBe(17);
    expect(parseJavaMajor('openjdk version "21" 2023-09-19')).toBe(21);
  });
  it('无法解析返回 null', () => {
    expect(parseJavaMajor('java version "1.8.0_392"')).toBe(8); // 旧式 1.x 命名取次版本号
    expect(parseJavaMajor('not a version string')).toBeNull();
    expect(parseJavaMajor('')).toBeNull();
  });
});

describe('checkEnvironment', () => {
  it('全绿环境：所有必需项 ok，exit 0', async () => {
    const results = await checkEnvironment(greenProbe(), { withTla: false });
    const node = results.find((r) => r.name === 'node')!;
    const tsx = results.find((r) => r.name === 'tsx')!;
    const ajv = results.find((r) => r.name === 'ajv')!;
    expect(node.status).toBe('ok');
    expect(tsx.status).toBe('ok');
    expect(ajv.status).toBe('ok');
    expect(deriveDoctorExitCode(results)).toBe(0);
  });

  it('node 16 < 18 → fail + 升级指引', async () => {
    const probe = { ...greenProbe(), nodeVersion: 'v16.20.2' };
    const results = await checkEnvironment(probe, { withTla: false });
    const node = results.find((r) => r.name === 'node')!;
    expect(node.status).toBe('fail');
    expect(node.hint).toContain('18');
    expect(deriveDoctorExitCode(results)).toBe(1);
  });

  it('tsx 未安装 → fail + npm install 指引', async () => {
    const probe = { ...greenProbe(), resolveModule: (name: string) => name !== 'tsx' };
    const results = await checkEnvironment(probe, { withTla: false });
    const tsx = results.find((r) => r.name === 'tsx')!;
    expect(tsx.status).toBe('fail');
    expect(tsx.hint).toContain('npm install');
  });

  it('java 缺失：默认提示级（warn），--with-tla 升级为 fail', async () => {
    const probe: EnvProbe = {
      ...greenProbe(),
      runCommand: (cmd: string) =>
        cmd === 'java'
          ? Promise.resolve({ ok: false, output: 'command not found' })
          : Promise.resolve({ ok: true, output: '1.2.3' }),
    };
    const defaultResults = await checkEnvironment(probe, { withTla: false });
    const javaDefault = defaultResults.find((r) => r.name === 'java')!;
    expect(javaDefault.status).toBe('warn');
    expect(deriveDoctorExitCode(defaultResults)).toBe(0); // warn 不阻断

    const tlaResults = await checkEnvironment(probe, { withTla: true });
    const javaTla = tlaResults.find((r) => r.name === 'java')!;
    expect(javaTla.status).toBe('fail');
    expect(deriveDoctorExitCode(tlaResults)).toBe(1);
  });

  it('java 版本低于 11 → fail（--with-tla）', async () => {
    const probe: EnvProbe = {
      ...greenProbe(),
      runCommand: (cmd: string) =>
        cmd === 'java'
          ? Promise.resolve({ ok: true, output: 'openjdk version "1.8.0_392"' })
          : Promise.resolve({ ok: true, output: '1.2.3' }),
    };
    const results = await checkEnvironment(probe, { withTla: true });
    const java = results.find((r) => r.name === 'java')!;
    expect(java.status).toBe('fail');
  });

  it('tla2tools.jar 缺失：默认 warn，--with-tla fail', async () => {
    const probe = { ...greenProbe(), fileExists: () => false };
    const r1 = await checkEnvironment(probe, { withTla: false });
    expect(r1.find((r) => r.name === 'tla2tools')!.status).toBe('warn');
    const r2 = await checkEnvironment(probe, { withTla: true });
    expect(r2.find((r) => r.name === 'tla2tools')!.status).toBe('fail');
  });

  it('codegraph / openspec 缺失 → warn（可选依赖，不阻断）', async () => {
    const probe: EnvProbe = {
      ...greenProbe(),
      runCommand: () => Promise.resolve({ ok: false, output: 'not found' }),
    };
    const results = await checkEnvironment(probe, { withTla: false });
    expect(results.find((r) => r.name === 'codegraph')!.status).toBe('warn');
    expect(results.find((r) => r.name === 'openspec')!.status).toBe('warn');
    expect(deriveDoctorExitCode(results)).toBe(0);
  });
});

describe('deriveDoctorExitCode', () => {
  it('空结果 → 0', () => {
    expect(deriveDoctorExitCode([])).toBe(0);
  });
});

describe('doctor.ts CLI 真实路径解析（D1 回归：TOOLS_DIR 必须解析到技能包 tools/）', () => {
  /**
   * 解析 --json 模式的 DOCTOR_JSON 行（stdout 单行摘要）。
   * @param stdout doctor.ts --json 的完整 stdout
   */
  function parseDoctorJson(stdout: string): { checks: Array<{ name: string; status: string; detail: string }> } {
    const line = stdout.split(/\r?\n/).find((l) => l.startsWith('DOCTOR_JSON '));
    if (line === undefined) throw new Error(`未找到 DOCTOR_JSON 行；实际 stdout:\n${stdout}`);
    return JSON.parse(line.slice('DOCTOR_JSON '.length)) as {
      checks: Array<{ name: string; status: string; detail: string }>;
    };
  }

  it('tools/tla2tools.jar 在盘 → 默认与 --with-tla 的 tla2tools 项均 ok（不得误报缺失）', () => {
    // 显式区分「jar 缺失」与「路径解析错误」：jar 由 git 跟踪，缺失即仓库不完整。
    // 此处直接失败并注明前置缺失（不跳过、不改弱断言）——跳过会让 D1 重新隐形。
    if (!existsSync(TLA_JAR)) {
      throw new Error(
        `前置缺失：${TLA_JAR} 不在盘（tla2tools.jar 由 git 跟踪，git ls-files w-model-dev/tools/ 含它）→ 无法判定 TOOLS_DIR 路径解析正确性`,
      );
    }
    expect(existsSync(TLA_JAR), `${TLA_JAR} 应存在于完整 checkout`).toBe(true);

    for (const extraArgs of [[], ['--with-tla']] as const) {
      const label = extraArgs.length === 0 ? '默认模式' : '--with-tla';
      const r = runSync(process.execPath, [tsxCli, DOCTOR_SCRIPT, '--json', ...extraArgs], { cwd: SKILL_ROOT });
      expect(r.status, `${label}：doctor.ts 子进程异常退出（stderr: ${r.stderr ?? ''}）`).not.toBeNull();
      const parsed = parseDoctorJson(r.stdout ?? '');
      const item = parsed.checks.find((c) => c.name === 'tla2tools');
      expect(item, `${label}：检查项 tla2tools 缺失`).toBeDefined();
      // 修复前：TOOLS_DIR 缺 dirname() → 探测 scripts/tools/ → 恒报缺失（warn/fail）
      expect(
        item!.status,
        `${label}：tla2tools.jar 在盘时该项必须 ok（TOOLS_DIR 须经 dirname(fileURLToPath(...)) 解析）`,
      ).toBe('ok');
      expect(item!.detail).toBe('tools/tla2tools.jar 存在');
    }
  });
});
