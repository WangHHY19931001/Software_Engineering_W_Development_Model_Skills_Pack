/**
 * lib/read-json-or-exit.ts 单元测试
 *
 * 覆盖：
 *   - readJsonOrExit：正常路径 / ENOENT / 非法 JSON / 泛型返回
 *   - readJsonlOrExit：正常 / 空行跳过 / 坏行 warn 跳过 / ENOENT
 *   - readJsonOptional：正常 / ENOENT→null / 非法 JSON→exit 2
 *   - readJsonlOptional：正常 / ENOENT→[] / 坏行 warn 跳过 / 空行 + CRLF
 *
 * process.exit 测试策略：spyOn + mockImplementation 抛错拦截，避免真实退出。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readJsonOrExit, readJsonlOrExit, readJsonOptional, readJsonlOptional, readJsonClassified } from '../lib/read-json-or-exit.js';

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

  it('文件不存在时调用 process.exit(2)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const missing = path.join(tmpDir, 'nope.json');
    await expect(readJsonOrExit(missing)).rejects.toThrow('exit:2');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_NOT_FOUND]'));
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('非法 JSON 时调用 process.exit(2)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = path.join(tmpDir, 'bad.json');
    await fs.writeFile(file, '{not json');
    await expect(readJsonOrExit(file)).rejects.toThrow('exit:2');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    exitSpy.mockRestore();
    errSpy.mockRestore();
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
});

describe('readJsonlOrExit', () => {
  it('正常读取多行 JSONL', async () => {
    const file = path.join(tmpDir, 'log.jsonl');
    await fs.writeFile(file, '{"i":1}\n{"i":2}\n{"i":3}\n');
    const entries = await readJsonlOrExit(file);
    expect(entries).toEqual([{ i: 1 }, { i: 2 }, { i: 3 }]);
  });

  it('空行跳过', async () => {
    const file = path.join(tmpDir, 'blank.jsonl');
    await fs.writeFile(file, '{"a":1}\n\n  \n{"b":2}\n');
    const entries = await readJsonlOrExit(file);
    expect(entries).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('单行非法 JSON 跳过并 warn 不 exit', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = path.join(tmpDir, 'mixed.jsonl');
    await fs.writeFile(file, '{"ok":1}\n{bad}\n{"ok":2}\n');
    const entries = await readJsonlOrExit(file, 'run-log');
    expect(entries).toEqual([{ ok: 1 }, { ok: 2 }]);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    errSpy.mockRestore();
  });

  it('支持 CRLF 换行', async () => {
    const file = path.join(tmpDir, 'crlf.jsonl');
    await fs.writeFile(file, '{"a":1}\r\n{"b":2}\r\n');
    const entries = await readJsonlOrExit(file);
    expect(entries).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('文件不存在时调用 process.exit(2)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const missing = path.join(tmpDir, 'nope.jsonl');
    await expect(readJsonlOrExit(missing)).rejects.toThrow('exit:2');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_NOT_FOUND]'));
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('label 默认为「行」', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = path.join(tmpDir, 'default-label.jsonl');
    await fs.writeFile(file, '{"ok":1}\n{bad}\n');
    await readJsonlOrExit(file);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    errSpy.mockRestore();
  });
});

describe('readJsonOptional', () => {
  it('文件存在 → 正常解析（不 exit）', async () => {
    const file = path.join(tmpDir, 'opt.json');
    await fs.writeFile(file, JSON.stringify({ a: 1, b: [2, 3] }));
    const result = await readJsonOptional<{ a: number; b: number[] }>(file);
    expect(result?.a).toBe(1);
    expect(result?.b).toEqual([2, 3]);
  });

  it('文件不存在（ENOENT）→ 返回 null，不 exit', async () => {
    const missing = path.join(tmpDir, 'nope-opt.json');
    const result = await readJsonOptional(missing);
    expect(result).toBeNull();
  });

  it('非法 JSON → process.exit(2)（与 readJsonOrExit 一致）', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const file = path.join(tmpDir, 'bad-opt.json');
    await fs.writeFile(file, '{not json');
    await expect(readJsonOptional(file)).rejects.toThrow('exit:2');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    exitSpy.mockRestore();
    errSpy.mockRestore();
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

  it('文件不存在（ENOENT）→ exitWithError(FILE_NOT_FOUND) + stdout ERROR_JSON', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const missing = path.join(tmpDir, 'nope-cls.json');
    await expect(readJsonClassified(missing)).rejects.toThrow();
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_NOT_FOUND]'));
    const out = logSpy.mock.calls[0]![0] as string;
    expect(out.startsWith('ERROR_JSON ')).toBe(true);
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number };
    expect(parsed).toMatchObject({ category: 'FILE_NOT_FOUND', exitCode: 2 });
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = 0;
  });

  it('非法 JSON → exitWithError(FILE_PARSE) + stdout ERROR_JSON', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const file = path.join(tmpDir, 'bad-cls.json');
    await fs.writeFile(file, '{not json');
    await expect(readJsonClassified(file)).rejects.toThrow();
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_PARSE]'));
    const out = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number };
    expect(parsed).toMatchObject({ category: 'FILE_PARSE', exitCode: 2 });
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = 0;
  });

  it('读取错误（目录路径）→ exitWithError(FILE_READ)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const dir = path.join(tmpDir, 'a-dir');
    await fs.mkdir(dir);
    await expect(readJsonClassified(dir)).rejects.toThrow();
    expect(process.exitCode).toBe(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[FILE_READ]'));
    const out = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(out.slice('ERROR_JSON '.length)) as { category: string; exitCode: number };
    expect(parsed).toMatchObject({ category: 'FILE_READ', exitCode: 2 });
    errSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = 0;
  });
});
