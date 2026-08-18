/**
 * 环境自检逻辑（logic/doctor-logic.ts）
 *
 * 审计修复 B1b：新用户首次启用时依赖缺失（未 npm install / java 未装 / tla2tools.jar 缺失）
 * 只能靠原始报错堆栈排查。doctor 把「环境是否就绪」变成一条命令的可读输出，
 * 每项 ✅/❌/⚠️ + 修复指引；--with-tla 把 TLA+ 相关项从提示级（warn）升级为阻断级（fail）。
 *
 * 环境探测经 EnvProbe 注入（cli 层组装真实探测；测试注入桩），logic 层纯函数可测。
 * 设计：docs/superpowers/specs/2026-08-15-skill-opt-audit-21fixes-design.md §B1
 */

import { parseJavaMajor } from '../lib/java-version.js'; // 审计修复 P15：Java 版本解析单源化（单点维护）

export interface DoctorCheckResult {
  /** 检查项名：node / tsx / ajv / java / tla2tools / codegraph / openspec */
  name: string;
  /** ok=就绪；fail=阻断级缺失；warn=提示级缺失（--with-tla 可升级为 fail）；skip=跳过 */
  status: 'ok' | 'fail' | 'warn';
  /** 版本号 / 路径等事实描述 */
  detail: string;
  /** 缺失时的修复指引（status=ok 时省略） */
  hint?: string;
}

export interface EnvProbe {
  /** process.version 形如 'v20.11.0' */
  nodeVersion: string;
  /** node_modules 内模块可解析（devDependencies 是否已安装） */
  resolveModule: (name: string) => boolean;
  /** 文件存在性（tools/tla2tools.jar） */
  fileExists: (absPath: string) => boolean;
  /** 执行外部命令取版本输出（execFile 包装；java -version 输出在 stderr，调用方拼接） */
  runCommand: (cmd: string, args: string[]) => Promise<{ ok: boolean; output: string }>;
}

export interface DoctorOptions {
  /** TLA+ 门禁所需项（java>=11 / tla2tools.jar）按阻断级校验；默认提示级 */
  withTla: boolean;
}

export const NODE_MIN_MAJOR = 18;
export const JAVA_MIN_MAJOR = 11;

/** 汇总退出码：任一 fail → 1；否则 0（warn 不阻断） */
export function deriveDoctorExitCode(results: DoctorCheckResult[]): 0 | 1 {
  return results.some((r) => r.status === 'fail') ? 1 : 0;
}

async function checkCommandVersion(
  probe: EnvProbe,
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; output: string }> {
  try {
    return await probe.runCommand(cmd, args);
  } catch {
    return { ok: false, output: '' };
  }
}

/**
 * 逐项环境检查。顺序即输出顺序：运行时（node）→ 依赖（tsx/ajv）→ TLA+（java/tla2tools）
 * → 可选集成（codegraph/openspec）。
 */
export async function checkEnvironment(probe: EnvProbe, opts: DoctorOptions): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  // 1. node >= 18
  const nodeMajor = Number(probe.nodeVersion.replace(/^v/, '').split('.')[0]);
  if (Number.isFinite(nodeMajor) && nodeMajor >= NODE_MIN_MAJOR) {
    results.push({ name: 'node', status: 'ok', detail: probe.nodeVersion });
  } else {
    results.push({
      name: 'node',
      status: 'fail',
      detail: probe.nodeVersion,
      hint: `需要 Node >= ${NODE_MIN_MAJOR}（当前 ${probe.nodeVersion}）：升级 Node 后重试（推荐 LTS 版）`,
    });
  }

  // 2. tsx runtime
  results.push(
    probe.resolveModule('tsx')
      ? {
          name: 'tsx',
          status: 'ok',
          detail: '已安装（npx tsx 可执行门禁脚本）',
        }
      : {
          name: 'tsx',
          status: 'fail',
          detail: '未安装',
          hint: '在仓库根目录执行 `npm install`（devDependencies 含 tsx）',
        },
  );

  // 3. ajv + ajv-formats（schema 校验依赖）
  const ajvOk = probe.resolveModule('ajv') && probe.resolveModule('ajv-formats');
  results.push(
    ajvOk
      ? { name: 'ajv', status: 'ok', detail: 'ajv + ajv-formats 已安装' }
      : {
          name: 'ajv',
          status: 'fail',
          detail: 'ajv / ajv-formats 未安装',
          hint: '在仓库根目录执行 `npm install`（详见 docs/INSTALL.md）',
        },
  );

  // 4. java >= 11（--with-tla 必需；默认提示级）
  const javaOut = await checkCommandVersion(probe, 'java', ['-version']);
  const javaMajor = javaOut.ok ? parseJavaMajor(javaOut.output) : null;
  const tlaLevel: 'fail' | 'warn' = opts.withTla ? 'fail' : 'warn';
  if (javaOut.ok && javaMajor !== null && javaMajor >= JAVA_MIN_MAJOR) {
    results.push({
      name: 'java',
      status: 'ok',
      detail: `Java ${javaMajor}（>= ${JAVA_MIN_MAJOR}）`,
    });
  } else {
    results.push({
      name: 'java',
      status: tlaLevel,
      detail: javaOut.ok ? `主版本 ${javaMajor ?? '未知'}` : '未安装或不在 PATH',
      hint: `TLA+ 门禁（check-tla-model / check-code-tla-consistency）需要 Java >= ${JAVA_MIN_MAJOR}：安装 JDK/JRE 后重试${
        opts.withTla ? '（--with-tla 模式下此项为阻断级）' : '（仅使用 TLA+ 门禁时需要；其他门禁不受影响）'
      }`,
    });
  }

  // 5. tools/tla2tools.jar
  const JAR_HINT = 'tla2tools.jar 随技能包 tools/ 目录分发；缺失时从 TLA+ 官网下载放入 w-model-dev/tools/';
  results.push(
    probe.fileExists('tla2tools.jar')
      ? { name: 'tla2tools', status: 'ok', detail: 'tools/tla2tools.jar 存在' }
      : {
          name: 'tla2tools',
          status: tlaLevel,
          detail: 'tools/tla2tools.jar 缺失',
          hint: JAR_HINT,
        },
  );

  // 6. codegraph（可选集成，阶段 5-8）
  const cgOut = await checkCommandVersion(probe, 'codegraph', ['--version']);
  results.push(
    cgOut.ok
      ? {
          name: 'codegraph',
          status: 'ok',
          detail: cgOut.output.trim().split('\n')[0] ?? '',
        }
      : {
          name: 'codegraph',
          status: 'warn',
          detail: '未安装或不在 PATH',
          hint: '可选：阶段 5-8 符号级影响分析用；ensure-codegraph-opsx.ts 可自动安装（详见 references/phase-5-coding.md）',
        },
  );

  // 7. openspec（可选集成）
  const osOut = await checkCommandVersion(probe, 'openspec', ['--version']);
  results.push(
    osOut.ok
      ? {
          name: 'openspec',
          status: 'ok',
          detail: osOut.output.trim().split('\n')[0] ?? '',
        }
      : {
          name: 'openspec',
          status: 'warn',
          detail: '未安装或不在 PATH',
          hint: '可选：规格驱动变更工作流（opsx）用；ensure-codegraph-opsx.ts 可自动安装',
        },
  );

  return results;
}
