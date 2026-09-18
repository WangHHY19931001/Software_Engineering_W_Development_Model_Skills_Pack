/**
 * 污染源判据纯逻辑（Pollution Locator Logic，S24）
 *
 * 对应 `cli/check-pollution.ts`（污染源二分定位，**按需工具**）。
 * 本文件为纯函数层：只做「相对 POSIX 路径 → 污染分类」的确定性判定，
 * 不做任何 IO、不依赖 Node 标准库以外的模块；目录遍历与读取由 CLI 层承担。
 *
 * 语义声明（规格 :206「保留『吞掉测试失败只看产物』的语义并显式注释」）：
 * 本模块定位的每一类残留，本质都是「一次真实测试运行的痕迹」——
 *   - `.w-model/*.lock` 是 wm-write.ts 的持久锁目录/文件残留（运行被中断或未正常释放）；
 *   - `coverage/` 是覆盖率工具的运行痕迹（gitignored 本地生成物）；
 *   - vitest `--outputFile` JSON 是测试运行器写出的结果产物。
 * 这些测试痕迹存在、而工作区产物却被判通过，即「吞掉测试失败只看产物」的污染形态：
 * 失败信号被丢弃、只留下了产物。本判据逐文件列出这些痕迹，供污染源二分定位
 * （bisect 哪一步引入污染）使用；它不修改任何文件。
 *
 * ⚠️ 启发式边界声明：`coverage` 判据是**深度 1 的名称启发式**（只比目录名、**不嗅探内容**），
 * 故「把 `coverage/` 用作用户自身目录名」的项目会被**误报**（本仓实测例：
 * `--project=w-model-dev/scripts/samples` 命中合法的 `samples/coverage/*.json` fixture 集）；
 * exit 1 仅供人工二分定位参考，须人工排除同名合法目录，不作放行/拒绝依据。
 *
 * 按需工具声明：S24 只作按需工具（规格 :187/:305），**不得当门禁**——
 * 不进 pre-push 19 项（`prePushCount: 19` 不变）、不进任何阶段门；
 * 判据命中（exit 1）仅表示「发现污染源」，供人工二分定位参考，不是放行/拒绝依据。
 */

/** 污染分类（对应规格 :206 检查对象 + vitest 语义形态） */
export type PollutionKind = 'stale-lock-dir' | 'lock-file' | 'coverage-residue' | 'vitest-output-residue';

/** 一条污染发现（路径为相对项目根的 POSIX 路径） */
export interface PollutionFinding {
  kind: PollutionKind;
  /** 相对项目根的 POSIX 路径；coverage 目录统一记为 `coverage/` */
  path: string;
  /** 人类可读理由（逐项列出的「所判回归」） */
  reason: string;
}

/**
 * 扫描剪除的目录名（精确匹配，非前缀）：依赖树与 Git 内部对象不是 W-model
 * 工作区污染面，剪除以保证扫描有界、结果确定（`.github` / `my-node_modules` 不受影响）。
 */
export const PRUNED_DIR_NAMES: readonly string[] = ['.git', 'node_modules'];

/** 目录名是否剪除 */
export function shouldPruneDir(name: string): boolean {
  return PRUNED_DIR_NAMES.includes(name);
}

/**
 * vitest 语义 `--outputFile` JSON 残留的文件名白名单（深度 1，判据按名称、确定性，不嗅探内容）：
 *   - `vitest.json` / `vitest-<anything>.json` / `vitest.<anything>.json`
 *   - `test-result.json` / `test-results.json` / `test-results-<anything>.json`
 * 边界：`my-vitest-results.json`（非 vitest 前缀）与 `package.json` 等常规 JSON 不判；
 * junit.xml 等 XML 形态不在本判据内（规格只点名 JSON 残留「等」，按最小集落地，按需再扩）。
 */
export function isVitestOutputResidueName(name: string): boolean {
  if (name === 'vitest.json') return true;
  // 三条正则均为星高 1（无嵌套量词，security/detect-unsafe-regex 安全）
  return (
    /^vitest[-.][^/\\]*\.json$/.test(name) ||
    /^test-results?\.json$/.test(name) ||
    /^test-results?[-.][^/\\]*\.json$/.test(name)
  );
}

/** POSIX 路径的最后一段（兼容 Windows 反斜杠输入） */
function basenameOf(relPosix: string): string {
  const parts = relPosix.split(/[\\/]/);
  return parts[parts.length - 1] ?? '';
}

/** 路径深度（段数）：`a.json` 为 1（项目根直下），`a/b.json` 为 2 */
function depthOf(relPosix: string): number {
  return relPosix.split(/[\\/]/).length;
}

/**
 * 单条相对路径的污染分类；不构成污染返回 null。
 *
 * 判据顺序（先特判后一般，避免 `.w-model/*.lock` 被 lock-file 双计）：
 *   1. `coverage` / `coverage/**` → coverage-residue（仅项目根 depth-1 的 coverage 目录；
 *      嵌套 `src/coverage` 是合法命名不判。coverage/ 在 W-model 工作区约定为测试覆盖率
 *      产物目录——gitignored 本地生成物（AGENTS.md「本地生成物与审计证据」节）；
 *      若项目把它用作源码目录属命名冲突，二分时人工排除）；
 *   2. `.w-model/` 子树内基名 `*.lock` → stale-lock-dir（wm-write.ts `<target>.lock`
 *      持久锁目录/文件残留；`.w-model/` 本身与其中状态文件是正常形态，不判）；
 *   3. 其余位置基名 `*.lock` → lock-file（规格 :206 字面 `*.lock` 判据；
 *      `package-lock.json` 等依赖清单以 `.json` 结尾不匹配；`yarn.lock` 类依赖锁文件
 *      会被判中——按规格字面保留，二分时人工排除）；
 *   4. 项目根 depth-1 的 vitest 输出 JSON 名单 → vitest-output-residue；
 *   5. 其余 → null（不是污染）。
 */
export function classifyRelativeEntry(relPosix: string): PollutionFinding | null {
  const normalized = relPosix.split(/[\\/]/).join('/');
  if (normalized === 'coverage' || normalized.startsWith('coverage/')) {
    return {
      kind: 'coverage-residue',
      path: 'coverage/',
      reason: 'coverage/ 覆盖率产物目录残留（含 coverage/.tmp 等全部内容）',
    };
  }
  const base = basenameOf(normalized);
  if (normalized.startsWith('.w-model/') && base.endsWith('.lock')) {
    return {
      kind: 'stale-lock-dir',
      path: normalized,
      reason: '.w-model/ 内 wm-write 持久锁残留（陈旧锁目录/文件，测试运行痕迹）',
    };
  }
  if (base.endsWith('.lock')) {
    return { kind: 'lock-file', path: normalized, reason: '*.lock 锁文件残留（测试运行痕迹）' };
  }
  if (depthOf(normalized) === 1 && isVitestOutputResidueName(base)) {
    return {
      kind: 'vitest-output-residue',
      path: normalized,
      reason: 'vitest --outputFile JSON 结果产物残留（吞掉测试失败只看产物的痕迹）',
    };
  }
  return null;
}
