/**
 * logic/doctor-logic.ts 单元测试（审计修复 B1b：环境自检）
 *
 * 覆盖：node 版本门 / tsx / ajv / java 版本解析（--with-tla 必需 vs 默认提示级）/
 *       tla2tools.jar 存在性 / codegraph+openspec 可选提示 / 汇总退出码派生。
 * 环境探测经 EnvProbe 注入，无真实 execFile 调用。
 */

import { describe, expect, it } from 'vitest';

import { checkEnvironment, deriveDoctorExitCode, parseJavaMajor, type EnvProbe } from '../logic/doctor-logic.js';

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
