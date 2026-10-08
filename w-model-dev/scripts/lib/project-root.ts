/**
 * 项目根解析（Project Root Resolution）——D5 三判据统一（43.3.0）。
 *
 * 三处 CLI 曾各自实现上溯 walk（check-requirement-graph.ts / check-iceberg-sweep.ts /
 * check-signature-chain.ts），判据互分叉；本模块收敛共享 walk + 判据选项参数化，
 * 三调用点以各自原判据**等价映射**（行为保持），差异只体现在选项与 JSDoc 语义说明。
 *
 * ## 判据差异（D5 收敛前现状，三处语义逐条）
 *
 * | 调用点                         | 层数 | `.git` | `.w-model/` 判据                                  | 未命中回退              |
 * | ------------------------------ | ---- | ------ | ------------------------------------------------ | ----------------------- |
 * | check-requirement-graph.ts     | 8    | 命中   | **最严**：须含 ≥1 常规文件（`isProjectStateWModelDir`） | startDir（最底层作基准） |
 * | check-iceberg-sweep.ts         | 8    | 命中   | **宽松**：裸 `existsSync(.w-model)` 即命中        | startDir                 |
 * | check-signature-chain.ts       | 5    | 不参与 | **唯一**：须 `.w-model/project.json` 存在         | `null`（跳过 R8）        |
 *
 * ## 选项映射
 *
 * - **默认（不传 opts）= graph 最严判据 + 8 层**：`.git` 存在，或 `.w-model/` 含至少
 *   一个常规文件（残留目录障眼法防误判：技能运行期只在 `.w-model/` 写 `gate-logs/`、
 *   `code-health/` 等**目录**，真实项目状态是 graph.json / run-log.jsonl / project.json
 *   等**文件**——D2 修复以「含 ≥1 常规文件」区分二者）。
 * - `looseWModel: true` = iceberg 判据：裸 `existsSync(.w-model)` 或 `.git` 即命中，
 *   8 层，未命中回退由调用方做（`?? startDir`）。
 * - `requireProjectFile: true` = signature-chain 判据：仅当 `.w-model/project.json`
 *   存在即命中；**不检查 `.git`**；配合 `maxDepth: 5`（原 5 层）；未命中返回 `null`
 *   （调用方借此跳过 R8，与 signature-chain-logic 契约一致）。
 * - `maxDepth`：上溯层数上限，默认 8（含 startDir 本身这一层）。
 *
 * `requireProjectFile` 与 `looseWModel` 语义互斥（一者替换 `.git`+`.w-model` 组合判据、
 * 一者替换 `.w-model` 内容判据），同置抛 `TypeError` 防静默歧义。
 *
 * ## D2 修复背景（graph 最严判据缘由，SSoT §10）与已知边界
 *
 * 原判据「含 `.w-model/` 即算根」对任何 `.w-model/` 成立，技能运行期写到 CWD 相邻
 * gitignored `.w-model/gate-logs/` 的残留会抢先命中、把基准截断到错误目录。以「含至少
 * 一个常规文件」区分后残留不再算根。**已知边界（只登记、不改行为）**：无 `.git/` 且
 * `.w-model/` 只含子目录的真实项目（只跑过 code-health、或只落过 gate-logs 的项目）
 * 会被判为残留 → 基准退到 startDir（或更外层 `.git`）；不选「含常规文件或含非
 * gate-logs 条目」放宽方案——`code-health/` 同属技能运行期写出的目录，放宽会使 D2 复发。
 * 缓解事实：真实 W-Model 项目必有状态文件（`/wm analyze` 初始化即写 project.json，
 * 与 signature-chain 判据一致）；仓库自身 `./.w-model`（只含 code-health/、gate-logs/）
 * 靠同层 `.git` 命中。
 *
 * @module
 */

import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

/** 项目根解析选项（三调用点原判据的等价参数化）。 */
export interface ResolveProjectRootOptions {
  /**
   * 上溯层数上限（含 startDir 本身），默认 8。
   * signature-chain 原判据为 5 层 → 传 `maxDepth: 5`。
   */
  maxDepth?: number;
  /**
   * signature-chain 判据：仅当 `<dir>/.w-model/project.json` 存在即命中该层，
   * **不参与 `.git` 判据**（原实现同样不查 `.git`）。与 `looseWModel` 互斥。
   */
  requireProjectFile?: boolean;
  /**
   * iceberg 判据：裸 `existsSync(<dir>/.w-model)` 即命中（不检查 `.w-model/` 内容，
   * 残留目录也算命中）。与 `requireProjectFile` 互斥（同置抛 TypeError）。
   */
  looseWModel?: boolean;
}

/**
 * 从 startDir 向上定位项目根（统一 8 层以内上溯 walk + 判据选项参数化）。
 *
 * 判据三态（见模块 JSDoc 差异表）：
 * - 默认：`.git` 存在，或 `<dir>/.w-model/` 含 ≥1 常规文件（最严，graph 判据）；
 * - `looseWModel: true`：`.git` 存在，或 `<dir>/.w-model/` 裸存在（iceberg 判据）；
 * - `requireProjectFile: true`：`<dir>/.w-model/project.json` 存在（signature-chain 判据）。
 *
 * 返回命中的根目录；**未命中返回 `null`**——graph/iceberg 调用方以
 * `resolveProjectRoot(start) ?? start` 回退 startDir（与原实现 return start 等价），
 * signature-chain 调用方以 null 触发 R8 跳过。
 *
 * @param startDir 起始目录（调用方先取 `path.dirname(目标文件)`；签名链取链文件所在目录）
 * @param options  判据选项（默认=最严判据 + 8 层）
 */
export function resolveProjectRoot(startDir: string, options: ResolveProjectRootOptions = {}): string | null {
  const maxDepth = options.maxDepth ?? 8;
  const { requireProjectFile = false, looseWModel = false } = options;
  if (requireProjectFile && looseWModel) {
    throw new TypeError('resolveProjectRoot: requireProjectFile 与 looseWModel 互斥，不可同置');
  }
  let dir = startDir;
  for (let i = 0; i < maxDepth; i++) {
    if (isProjectRootAt(dir, { requireProjectFile, looseWModel })) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * `<dir>` 是否依当前判据命中项目根。判据顺序与三处原实现逐条等价：
 * requireProjectFile 只查 project.json（不查 `.git`）；否则先 `.git` 后 `.w-model`
 * （graph/iceberg 原实现均为 OR，短路顺序不影响布尔结果）。
 */
function isProjectRootAt(dir: string, opts: { requireProjectFile: boolean; looseWModel: boolean }): boolean {
  if (opts.requireProjectFile) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 上溯祖先目录由调用方目标文件路径逐级推导，只读存在性探测
    return existsSync(path.join(dir, '.w-model', 'project.json'));
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，只读存在性探测
  if (existsSync(path.join(dir, '.git'))) return true;
  if (opts.looseWModel) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，只读存在性探测
    return existsSync(path.join(dir, '.w-model'));
  }
  return isProjectStateWModelDir(dir);
}

/**
 * `<dir>/.w-model/` 是否像**真实项目状态目录**（而非技能运行期只写 gate-logs 的残留）。
 *
 * 判据：`.w-model/` 下含至少一个常规文件（graph 最严判据）。W-Model 项目状态是文件
 * （graph.json / run-log.jsonl / project.json / budget.json / maturity.json /
 * signature-chain.jsonl …），而运行期残留由 `gate-logs/`、`code-health/` 这类**目录**构成。
 * `readdirSync` 抛 ENOENT/ENOTDIR = 没有 `.w-model/` → false；其它错误（权限/竞态）→
 * 保守返回 true，保持 D2 修复前语义（不因一次读盘失败把基准改到更远层）。
 */
function isProjectStateWModelDir(dir: string): boolean {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 祖先目录下的受控状态目录，仅列条目类型、零写入
    return readdirSync(path.join(dir, '.w-model'), { withFileTypes: true }).some((entry) => entry.isFile());
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== 'ENOENT' && code !== 'ENOTDIR';
  }
}
