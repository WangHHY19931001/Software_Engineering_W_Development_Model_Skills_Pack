/**
 * TLC 轨迹文件清理工具
 *
 * IO 层辅助函数：删除 .tla 同目录的 states/ 目录与 *.dump / *.out 残留，
 * 判定目录是否为 TLC 产物目录。供 check-tla-model.ts（SANY/TLC 执行前清理）
 * 与 __tests__/tla-clean-trace.test.ts 使用——IO 辅助放 lib/，logic/ 保持纯函数。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// TLC 产物特征：states/<时间戳子目录>，形如 2026-08-05-10-30-00（YY-MM-DD-HH-MM-SS）
// TLC 2.19 实际产出 2 位年份（26-08-05-10-30-00），故时间戳目录须兼容 2/4 位年份
const TLC_TIMESTAMP_DIR = /^\d{2,4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

/**
 * 清理 TLC 轨迹文件（设计文档 §3.1 步骤 5 / §3.4）：
 * 删除 .tla 同目录下的 states/ 目录（含时间戳子目录里的 .st/.fp 文件）
 * 以及 *.dump / *.out 残留文件，避免历史轨迹干扰本轮校验。
 *
 * 实测 TLC 2.19 产物（2026-07-23）：states/<YY-MM-DD-HH-MM-SS>/ 下含
 *   <Module>.st / <Module>-0.st（状态文件）+ <Module>_0.fp / <Module>_1.fp（指纹文件）。
 * 默认不产生 .dump/.out（特定 flag 才产生），但保留清理作为预防。
 *
 * 安全加固（§3.2）：dir 来自 manifest spec.tlaPath（Agent 可写），
 * 守卫 1：仅当目录内含 .tla 规格文件才执行清理，防止误删仓库根 / 业务目录；
 * 守卫 2：states/ 目录需满足 isTlcStatesDir（TLC 产物特征），否则跳过，防误删同名业务 states/。
 */
export async function cleanTraceFiles(dir: string): Promise<string[]> {
  const deleted: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return deleted;
  }
  // 守卫 1：TLC 产物只产生于含 .tla 规格文件的目录；无 .tla 则跳过整个清理
  if (!entries.some((name) => name.endsWith('.tla'))) {
    return deleted;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    if (name.endsWith('.dump') || name.endsWith('.out')) {
      try {
        await fs.rm(full, { force: true });
        deleted.push(full);
      } catch {
        /* 忽略单个文件清理失败 */
      }
    }
    if (name === 'states') {
      // 守卫 2：states/ 必须是 TLC 产物（时间戳子目录或含 .st/.fp 指纹），否则跳过
      if (await isTlcStatesDir(full)) {
        try {
          await fs.rm(full, { recursive: true, force: true });
          deleted.push(full);
        } catch {
          /* 忽略 states 目录清理失败 */
        }
      }
    }
  }
  return deleted;
}

/**
 * 判定目录是否为 TLC 产物目录：含时间戳子目录，或直接含 .st/.fp/.dump/.out 文件。
 * 安全加固：防误删与 .tla 同级的同名业务 states/ 目录。
 */
export async function isTlcStatesDir(dir: string): Promise<boolean> {
  let children: string[];
  try {
    children = await fs.readdir(dir);
  } catch {
    return false;
  }
  for (const c of children) {
    if (TLC_TIMESTAMP_DIR.test(c)) return true;
    if (c.endsWith('.st') || c.endsWith('.fp') || c.endsWith('.dump') || c.endsWith('.out')) return true;
  }
  return false;
}
