/**
 * gate-logs 存档写入（lib/gate-log-writer.ts）
 *
 * 审计修复 P9：check-iceberg-sweep / check-preventive-review / check-bdd-model 三处复制样板统一。
 * 写入失败不阻塞门禁结果（与原行为一致）。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/** 向 <projectDir>/.w-model/gate-logs/ 写 <ISO 时间戳>-<scriptName>.json；失败静默（不阻塞门禁） */
export async function writeGateLog(
  scriptName: string,
  payload: unknown,
  projectDir: string = '.',
): Promise<void> {
  try {
    const dir = path.resolve(projectDir, '.w-model', 'gate-logs');
    await fs.mkdir(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.resolve(dir, `${timestamp}-${scriptName}.json`), JSON.stringify(payload, null, 2));
  } catch {
    // gate-logs 写入失败不阻塞
  }
}