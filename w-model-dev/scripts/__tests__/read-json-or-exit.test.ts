/* eslint-disable security/detect-non-literal-fs-filename -- mkdtemp 临时目录 fixture 读写（path.join(tmpDir,...)），仓库零写入 */
/**
 * lib/read-json-or-exit.ts 单元测试
 *
 * 覆盖：
 *   - readJsonOrExit：正常路径 / ENOENT / 非法 JSON / 泛型返回
 *   - readJsonlOrExit：正常 / 空行跳过 / 坏行 warn 跳过 / ENOENT
 *   - readJsonlOptional：正常 / ENOENT→[] / 坏行 warn 跳过 / 空行 + CRLF
 *   - loadAndValidate：正常 / ENOENT / 非法 JSON / STRUCTURE_INVALID（错误路径抛哨兵错误，与真实异常可区分）
 *
 * process.exit 测试策略：spyOn + mockImplementation 抛错拦截，避免真实退出。
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  readJsonOrExit,
  readJsonlOrExit,
  readJsonlOrExitDetailed,
  readJsonlOptional,
  readJsonClassified,
} from '../lib/read-json-or-exit.js';
import { loadAndValidate, LOAD_AND_VALIDATE_SENTINEL_PREFIX } from '../lib/load-and-validate.js';
import { HandledCliError } from '../lib/cli-error.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rjoe-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readJsonOrExit', () => {
  it('正常读取并解析 JSON', async () => {
    const file = path.join(tmpDir, 'valid.json');
    await fs.writeFile(file, JSON.stringify({ a: 1, b: [2, 3] }));
    const result = await readJsonOrExit<{ a: number; b: number[] }>(file);
    expect(result.a).toBe(1);
    expect(result.b).toEqual([2, 3]);
  });

  it('泛型默认 unknown 也可工作', async () => {
    const file = path.join(tmpDir, 'arr.json');
    await fs.writeFile(file, JSON.stringify([1, 2, 3]));
    const result = await readJsonOrExit(file);
    expect(result).toEqual([1, 2, 3]);
  });

  it('文件不存在时抛 HandledCliError 并输出 ERROR_JSON（不再 process.exit）', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const missing = path.join(tmpDir, 'nope.json');
    await expect(readJsonOrExit(missing)).rejects.toBeInstanceOf(HandledCliError);
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_NOT_FOUND]'));
    const out = logSpy.mock.calls[0]![0] as string;
    expect(out.startsWith('ERROR_JSON ')).toBe(true);
    expect(JSON.parse(out.slice('ERROR_JSON '.length))).toMatchObject({ category: 'FILE_NOT_FOUND', exitCode: 2 });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('非法 JSON 时抛 HandledCliError 并输出 ERROR_JSON（不再 process.exit）', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const file = path.join(tmpDir, 'bad.json');
    await fs.writeFile(file, '{not json');
    await expect(readJsonOrExit(file)).rejects.toBeInstanceOf(HandledCliError);
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    const out = logSpy.mock.calls[0]![0] as string;
    expect(out.startsWith('ERROR_JSON ')).toBe(true);
    expect(JSON.parse(out.slice('ERROR_JSON '.length))).toMatchObject({ category: 'FILE_PARSE', exitCode: 2 });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('相对路径也能正常解析', async () => {
    const file = path.join(tmpDir, 'rel.json');
    await fs.writeFile(file, JSON.stringify({ ok: true }));
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = await readJsonOrExit<{ ok: boolean }>('rel.json');
      expect(result.ok).toBe(true);
    } finally {
      process.chdir(origCwd);
    }
  });

  it('readJsonOrExit 文件不存在：抛 HandledCliError 且 exitCode=2，不再 process.exit（P10）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(readJsonOrExit(path.join(os.tmpdir(), `nonexistent-${Date.now()}.json`))).rejects.toBeInstanceOf(
      HandledCliError,
    );
    expect(process.exitCode).toBe(2);
    expect(logSpy).toHaveBeenCalledTimes(1); // 仅一条 ERROR_JSON，无双打印
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = undefined;
  });
});

describe('readJsonlOrExit', () => {
  it('正常读取多行 JSONL', async () => {
    const file = path.join(tmpDir, 'log.jsonl');
    await fs.writeFile(file, '{"i":1}\n{"i":2}\n{"i":3}\n');
    const entries = await readJsonlOrExit(file);
    expect(entries).toEqual([{ i: 1 }, { i: 2 }, { i: 3 }]);
  });

  it('JSONL 解析行（2 态：空行跳过 / CRLF 换行）', async () => {
    for (const [caseName, content, expected] of [
      ['空行跳过', '{"a":1}\n\n  \n{"b":2}\n', [{ a: 1 }, { b: 2 }]],
      ['支持 CRLF 换行', '{"a":1}\r\n{"b":2}\r\n', [{ a: 1 }, { b: 2 }]],
    ] as const) {
      const file = path.join(tmpDir, `parse-${caseName}.jsonl`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file 拼装自 mkdtemp 临时目录，content 为用例内字面量 fixture，非用户输入
      await fs.writeFile(file, content);
      const entries = await readJsonlOrExit(file);
      expect(entries, `${caseName}: 解析结果`).toEqual(expected);
    }
  });

  it('JSONL 坏行跳过行（2 态：显式 label / label 缺省为「行」）', async () => {
    for (const [caseName, label] of [
      ['单行非法 JSON 跳过并 warn 不 exit（label=run-log）', 'run-log' as const],
      ['label 缺省为「行」', undefined],
    ] as const) {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const file = path.join(tmpDir, `skip-${caseName}.jsonl`);
      await fs.writeFile(file, '{"ok":1}\n{bad}\n{"ok":2}\n');
      const entries = label === undefined ? await readJsonlOrExit(file) : await readJsonlOrExit(file, label);
      expect(entries, `${caseName}: 好行保留`).toEqual([{ ok: 1 }, { ok: 2 }]);
      expect(errSpy, `${caseName}: 应 warn [FILE_PARSE]`).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
      errSpy.mockRestore();
    }
  });

  it('detailed 读取结果暴露坏行行号，避免 warn+skip 被误当完整输入', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = path.join(tmpDir, 'detailed.jsonl');
    await fs.writeFile(file, '{"ok":1}\n{bad}\n{"ok":2}\n');
    const result = await readJsonlOrExitDetailed(file, 'run-log');
    expect(result.entries).toEqual([{ ok: 1 }, { ok: 2 }]);
    expect(result.parseErrors).toEqual([{ line: 2, message: expect.stringContaining('非合法 JSON') }]);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('第 2 行'));
    errSpy.mockRestore();
  });

  it('文件不存在时抛 HandledCliError 并输出 ERROR_JSON（不再 process.exit）', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const missing = path.join(tmpDir, 'nope.jsonl');
    await expect(readJsonlOrExit(missing)).rejects.toBeInstanceOf(HandledCliError);
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_NOT_FOUND]'));
    const out = logSpy.mock.calls[0]![0] as string;
    expect(out.startsWith('ERROR_JSON ')).toBe(true);
    expect(JSON.parse(out.slice('ERROR_JSON '.length))).toMatchObject({ category: 'FILE_NOT_FOUND', exitCode: 2 });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = undefined;
  });
});

describe('readJsonlOptional', () => {
  it('文件存在 → 正常解析为数组（不 exit）', async () => {
    const file = path.join(tmpDir, 'opt.jsonl');
    await fs.writeFile(file, '{"i":1}\n{"i":2}\n{"i":3}\n');
    const entries = await readJsonlOptional(file);
    expect(entries).toEqual([{ i: 1 }, { i: 2 }, { i: 3 }]);
  });

  it('文件不存在（ENOENT）→ 返回 []，不 exit', async () => {
    const missing = path.join(tmpDir, 'nope-opt.jsonl');
    const entries = await readJsonlOptional(missing);
    expect(entries).toEqual([]);
  });

  it('坏行 warn+skip 不 exit（label 生效）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = path.join(tmpDir, 'mixed-opt.jsonl');
    await fs.writeFile(file, '{"ok":1}\n{bad}\n{"ok":2}\n');
    const entries = await readJsonlOptional(file, 'run-log');
    expect(entries).toEqual([{ ok: 1 }, { ok: 2 }]);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    errSpy.mockRestore();
  });

  it('空行跳过 + 支持 CRLF', async () => {
    const file = path.join(tmpDir, 'blank-crlf-opt.jsonl');
    await fs.writeFile(file, '{"a":1}\r\n\r\n  \n{"b":2}\r\n');
    const entries = await readJsonlOptional(file);
    expect(entries).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('readJsonClassified', () => {
  it('文件存在 → 正常解析（不 exit）', async () => {
    const file = path.join(tmpDir, 'cls.json');
    await fs.writeFile(file, JSON.stringify({ a: 1, b: [2, 3] }));
    const result = await readJsonClassified<{ a: number; b: number[] }>(file);
    expect(result.a).toBe(1);
    expect(result.b).toEqual([2, 3]);
  });

  it('错误三分类（3 态：FILE_NOT_FOUND / FILE_PARSE / FILE_READ）→ exitWithError + stdout ERROR_JSON', async () => {
    for (const { caseName, prepare, category } of [
      {
        caseName: '文件不存在（ENOENT）',
        prepare: async (): Promise<string> => path.join(tmpDir, 'nope-cls.json'),
        category: 'FILE_NOT_FOUND',
      },
      {
        caseName: '非法 JSON',
        prepare: async (): Promise<string> => {
          const file = path.join(tmpDir, 'bad-cls.json');
          await fs.writeFile(file, '{not json');
          return file;
        },
        category: 'FILE_PARSE',
      },
      {
        caseName: '读取错误（目录路径）',
        prepare: async (): Promise<string> => {
          const dir = path.join(tmpDir, 'a-dir');
          await fs.mkdir(dir);
          return dir;
        },
        category: 'FILE_READ',
      },
    ]) {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const input = await prepare();
      await expect(readJsonClassified(input), `${caseName}: 应抛错`).rejects.toThrow();
      expect(process.exitCode, `${caseName}: exitCode 应为 2`).toBe(2);
      expect(errSpy, `${caseName}: stderr 应含 [${category}]`).toHaveBeenCalledWith(
        expect.stringContaining(`[${category}]`),
      );
      const out = logSpy.mock.calls[0]![0] as string;
      expect(out.startsWith('ERROR_JSON '), `${caseName}: 应有 ERROR_JSON 前缀`).toBe(true);
      const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number };
      expect(parsed, `${caseName}: ERROR_JSON 字段`).toMatchObject({ category, exitCode: 2 });
      errSpy.mockRestore();
      logSpy.mockRestore();
      process.exitCode = 0;
    }
  });
});

describe('loadAndValidate', () => {
  /** 最小合法 bdd-manifest fixture（bdd-manifest.schema.json required：schemaVersion/projectId/basePath/currentPhase/features/stateMachines；basePath minLength 1；currentPhase=1 不触发 designCoverage 分支） */
  const validManifest = {
    schemaVersion: '1.0',
    projectId: 'test-project',
    basePath: 'features/',
    currentPhase: 1,
    features: [],
    stateMachines: [],
  };

  it('正常路径：合法 bdd-manifest 通过 schema 校验并返回解析对象', async () => {
    const file = path.join(tmpDir, 'valid-bdd.json');
    await fs.writeFile(file, JSON.stringify(validManifest));
    const result = await loadAndValidate<{ schemaVersion: string; projectId: string; currentPhase: number }>(
      file,
      'bdd-manifest',
    );
    expect(result).toMatchObject({ schemaVersion: '1.0', projectId: 'test-project', currentPhase: 1 });
  });

  it('文件不存在（ENOENT）→ exitWithError(FILE_NOT_FOUND) + 抛哨兵 + stdout ERROR_JSON', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const missing = path.join(tmpDir, 'nope-bdd.json');
    await expect(loadAndValidate(missing, 'bdd-manifest')).rejects.toThrow(LOAD_AND_VALIDATE_SENTINEL_PREFIX);
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_NOT_FOUND]'));
    const out = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number };
    expect(parsed).toMatchObject({ category: 'FILE_NOT_FOUND', exitCode: 2 });
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = 0;
  });

  it('非法 JSON → exitWithError(FILE_PARSE) + 抛哨兵 + stdout ERROR_JSON', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const file = path.join(tmpDir, 'bad-bdd.json');
    await fs.writeFile(file, '{not json');
    await expect(loadAndValidate(file, 'bdd-manifest')).rejects.toThrow(LOAD_AND_VALIDATE_SENTINEL_PREFIX);
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    const out = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number };
    expect(parsed).toMatchObject({ category: 'FILE_PARSE', exitCode: 2 });
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = 0;
  });

  it('schema 校验失败（缺必填字段）→ exitWithError(STRUCTURE_INVALID) + 抛哨兵 + stdout ERROR_JSON', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const file = path.join(tmpDir, 'struct-bdd.json');
    await fs.writeFile(file, JSON.stringify({ schemaVersion: '1.0' }));
    await expect(loadAndValidate(file, 'bdd-manifest')).rejects.toThrow(LOAD_AND_VALIDATE_SENTINEL_PREFIX);
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[STRUCTURE_INVALID]'));
    const out = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number; rule?: string };
    expect(parsed).toMatchObject({ category: 'STRUCTURE_INVALID', exitCode: 2, rule: 'P0-3' });
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = 0;
  });
});
