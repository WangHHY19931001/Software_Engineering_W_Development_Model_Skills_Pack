/**
 * gate-logs 审计写入（lib/gate-log-writer.ts）。
 *
 * 每条日志先通过独立 gate-log schema 校验，再使用排他临时文件和硬链接发布。
 * 硬链接创建目标的 EEXIST 语义提供 no-clobber 保证；日志失败不会覆盖主门禁结论。
 */

import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { validateBySchema } from '../logic/schema-loader.js';

export type GateLogWriteErrorCode = 'GATE_LOG_SCHEMA_INVALID' | 'GATE_LOG_WRITE_FAILED' | 'GATE_LOG_CLEANUP_FAILED';

export interface GateLogWriteError {
  code: GateLogWriteErrorCode;
  message: string;
  cleanupFailed?: true;
}

export type GateLogWriteResult = { ok: true; path: string } | { ok: false; error: GateLogWriteError };

type FileSystem = Pick<typeof fs, 'mkdir' | 'writeFile' | 'link' | 'rm'>;

export interface GateLogWriterDependencies {
  fs?: FileSystem;
  now?: () => Date;
  randomUUID?: () => string;
}

const MAX_PUBLISH_ATTEMPTS = 8;

function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

async function removeTemporaryFile(fileSystem: FileSystem, temporary: string): Promise<boolean> {
  try {
    await fileSystem.rm(temporary, { force: true });
    return true;
  } catch {
    return false;
  }
}

function failedWrite(cleanupFailed: boolean): GateLogWriteResult {
  return {
    ok: false,
    error: cleanupFailed
      ? { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log', cleanupFailed: true }
      : { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
  };
}

/**
 * 校验并向 <projectDir>/.w-model/gate-logs 原子追加一条审计日志。
 * 对外仅返回安全、稳定的错误类别；原始 filesystem cause 不进入 stdout/stderr。
 */
export async function writeGateLog(
  payload: unknown,
  projectDir: string = '.',
  dependencies: GateLogWriterDependencies = {},
): Promise<GateLogWriteResult> {
  const schemaResult = validateBySchema('gate-log', payload);
  if (!schemaResult.valid) {
    return { ok: false, error: { code: 'GATE_LOG_SCHEMA_INVALID', message: 'Invalid gate log payload' } };
  }

  const fileSystem = dependencies.fs ?? fs;
  const dir = path.resolve(projectDir, '.w-model', 'gate-logs');
  const timestamp = (dependencies.now ?? (() => new Date()))().toISOString().replace(/[:.]/g, '-');
  const createId = dependencies.randomUUID ?? randomUUID;
  const script = (payload as { script: string }).script;

  try {
    await fileSystem.mkdir(dir, { recursive: true });
  } catch {
    return failedWrite(false);
  }

  for (let attempt = 0; attempt < MAX_PUBLISH_ATTEMPTS; attempt++) {
    const id = createId();
    const destination = path.join(dir, `${timestamp}-${id}-${script}.json`);
    const temporary = path.join(dir, `.tmp-${timestamp}-${id}-${script}.json`);
    let temporaryCreated = false;
    try {
      await fileSystem.writeFile(temporary, JSON.stringify(payload, null, 2), { encoding: 'utf-8', flag: 'wx' });
      temporaryCreated = true;
      await fileSystem.link(temporary, destination);
    } catch (error) {
      // 临时名冲突说明其他 writer 正在使用该 UUID；不得删除它的临时文件。
      if (isAlreadyExists(error) && !temporaryCreated) continue;
      const removed = await removeTemporaryFile(fileSystem, temporary);
      if (isAlreadyExists(error) && removed) continue;
      return failedWrite(!removed);
    }

    if (await removeTemporaryFile(fileSystem, temporary)) {
      return { ok: true, path: destination };
    }
    return { ok: false, error: { code: 'GATE_LOG_CLEANUP_FAILED', message: 'Gate log persisted but temporary cleanup failed', cleanupFailed: true } };
  }

  return { ok: false, error: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' } };
}
