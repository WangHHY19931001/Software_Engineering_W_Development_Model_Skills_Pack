/**
 * gate-logs 审计写入（lib/gate-log-writer.ts）。
 *
 * 每条日志先通过独立 gate-log schema 校验，再使用唯一临时文件和 rename 原子发布。
 * 日志失败不会覆盖主门禁结论，但会以结构化结果返回给调用方输出摘要。
 */

import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { validateBySchema } from '../logic/schema-loader.js';

export type GateLogWriteResult = { ok: true; path: string } | { ok: false; error: string };

type FileSystem = Pick<typeof fs, 'mkdir' | 'writeFile' | 'rename' | 'rm'>;

export interface GateLogWriterDependencies {
  fs?: FileSystem;
  now?: () => Date;
  randomUUID?: () => string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 校验并向 <projectDir>/.w-model/gate-logs 原子追加一条审计日志。
 * 失败不会抛出，以便调用方保持主门禁 exitCode/passed 不变并报告 gateLogWriteError。
 */
export async function writeGateLog(
  payload: unknown,
  projectDir: string = '.',
  dependencies: GateLogWriterDependencies = {},
): Promise<GateLogWriteResult> {
  const schemaResult = validateBySchema('gate-log', payload);
  if (!schemaResult.valid) {
    return { ok: false, error: `gate-log schema validation failed: ${schemaResult.errorMessages.join('; ')}` };
  }

  const fileSystem = dependencies.fs ?? fs;
  const dir = path.resolve(projectDir, '.w-model', 'gate-logs');
  const timestamp = (dependencies.now ?? (() => new Date()))().toISOString().replace(/[:.]/g, '-');
  const id = (dependencies.randomUUID ?? randomUUID)();
  const script = (payload as { script: string }).script;
  const destination = path.join(dir, `${timestamp}-${id}-${script}.json`);
  const temporary = path.join(dir, `.tmp-${timestamp}-${id}-${script}.json`);

  try {
    await fileSystem.mkdir(dir, { recursive: true });
    await fileSystem.writeFile(temporary, JSON.stringify(payload, null, 2), { encoding: 'utf-8', flag: 'wx' });
    await fileSystem.rename(temporary, destination);
    return { ok: true, path: destination };
  } catch (error) {
    try {
      await fileSystem.rm(temporary, { force: true });
    } catch {
      // 保留原始写入错误；清理失败不应掩盖其 machine-readable 原因。
    }
    return { ok: false, error: errorMessage(error) };
  }
}
