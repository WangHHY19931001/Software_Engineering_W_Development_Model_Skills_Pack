/**
 * CLI 入口守卫统一实现（lib/is-main.ts）——WS-E 仓库级加固。
 *
 * 判定「本模块是否被直接执行」（`node`/`tsx <file>` 启动而非被 import）：
 * - `process.argv[1]` 缺失（被 import / REPL / eval）→ false；
 * - 否则双侧 `realpathSync` 归一化后比较：
 *   左侧 `realpathSync(fileURLToPath(importMetaUrl))`（模块真实路径），
 *   右侧 `realpathSync(path.resolve(entryArg))`（入口参数归一化为绝对路径）。
 *
 * 加固语义：双侧 realpath 防 symlink / Windows 盘符大小写 / 8.3 短文件名导致旧实现
 * （`fileURLToPath` + `path.resolve` 字符串归一化）在同盘异形路径下误判——或误放行
 * （fail-open）、或误拦截（直接执行不触发 main）。任一侧 realpath 解析失败
 * （symlink 断链、路径不存在等）→ false 保守不执行 main。
 *
 * 全部调用 `runMain(main)` 的 cli/*.ts 尾部守卫统一为
 * `if (isDirectInvocation(import.meta.url)) runMain(main)`（由
 * `__tests__/cli-entry-guard.test.ts` 强制）；无环境变量旁路。
 */

import { realpathSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isDirectInvocation(importMetaUrl: string): boolean {
  const entryArg = process.argv[1];
  if (entryArg === undefined) return false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realpath 是本守卫的加固判据，两侧候选路径即被审查对象（import.meta.url 与 argv[1]），且只读比较不打开文件内容
    return realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(path.resolve(entryArg));
  } catch {
    return false;
  }
}
