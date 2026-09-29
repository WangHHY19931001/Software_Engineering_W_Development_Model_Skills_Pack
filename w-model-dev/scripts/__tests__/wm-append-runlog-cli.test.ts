/* eslint-disable security/detect-non-literal-fs-filename -- 测试路径均由本测试进程在 mkdtemp 目录内生成。 */
/**
 * wm-append-runlog CLI 端到端测试（真实 tsx 子进程 + 真实临时 run-log，D-5①/N-5）
 *
 * 锁定三态取证：
 *   1. 正确追加 → exit 0 + stdout 单行 `RUNLOG_APPEND_JSON {lines, appended, digest}`，文件行数 +N，
 *      历史行逐字节不变（sha256 前缀对照），digest = 写入后文件字节的 SHA-256；
 *   2. 时间戳倒退 → exit 1（写入拒绝）+ stderr 点名「时间戳不递增 + 末条时间 + 建议」，
 *      文件 sha256 前后一致（未被修改）；
 *   3. 非法输入（未知/重复值 flag、runId 不存在、记录不符 schema、--lock-timeout 非法值）→ exit 2 + ERROR_JSON，文件未被修改；
 *   4. --correct 只追加新记录（note 含 correction-of:<runId>），历史行逐字节不变；
 *   5. 历史文件边界形态（G2-5）：CRLF 行尾 / BOM 头 / 无换行结尾 各 1 例——解析吸收、exit 0、
 *      目标文件历史字节前缀不变（CRLF 经 split(/\r?\n/) 吸收，BOM 经 parseJsonSafe 剥离，末尾只补分隔 LF）。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { childProcessEnv } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/wm-append-runlog.ts');

let tmpDir: string;
let runLogPath: string;

const BASE_RECORD = {
  runId: 'a',
  timestamp: '2026-01-02T10:00:00.000Z',
  phase: 1,
  phaseName: '需求分析',
  action: 'produce',
  role: 'S',
  duration_s: 1,
  tokens: 10,
  estimated: false,
  subagentSpawns: 0,
  gateExitCode: null,
  outcome: 'success',
};

function record(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...BASE_RECORD, ...patch };
}

function line(entry: Record<string, unknown>): string {
  return JSON.stringify(entry);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-append-runlog-'));
  runLogPath = path.join(tmpDir, '.w-model', 'run-log.jsonl');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function seed(content: string): Promise<void> {
  await fs.mkdir(path.dirname(runLogPath), { recursive: true });
  await fs.writeFile(runLogPath, content, 'utf-8');
}

async function sha256(file: string): Promise<string> {
  return createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
}

function run(args: string[], input?: string): { code: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], {
    cwd: tmpDir,
    encoding: 'utf-8',
    input,
    timeout: 20_000,
    env: childProcessEnv(),
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function appendPayload(stdout: string): {
  lines: number;
  appended: number;
  digest: string;
  ok?: boolean;
  legacyInvalidLines?: number[];
} {
  const prefix = 'RUNLOG_APPEND_JSON ';
  const lineOut = stdout.split('\n').find((l) => l.startsWith(prefix));
  expect(lineOut, `stdout 缺少 RUNLOG_APPEND_JSON 行: ${stdout}`).toBeDefined();
  return JSON.parse(lineOut!.slice(prefix.length)) as { lines: number; appended: number; digest: string };
}

async function readLines(): Promise<string[]> {
  const raw = await fs.readFile(runLogPath, 'utf-8');
  return raw.split('\n').filter((l) => l.trim() !== '');
}

describe('wm-append-runlog：正确追加（exit 0）', () => {
  it('追加单条记录：行数 +1、历史行逐字节不变、digest 等于写入后文件 SHA-256', async () => {
    const existingText = `${line(record())}\n`;
    await seed(existingText);
    const r = run([runLogPath, '--stdin'], line(record({ runId: 'b', timestamp: undefined })));
    expect(r.stderr).not.toContain('✗');
    expect(r.code).toBe(0);
    const summary = appendPayload(r.stdout);
    expect(summary.appended).toBe(1);
    expect(summary.lines).toBe(2);
    expect(summary.digest).toBe(`sha256:${await sha256(runLogPath)}`);
    const raw = await fs.readFile(runLogPath, 'utf-8');
    expect(raw.startsWith(existingText)).toBe(true);
    const appendedEntries = (await readLines()).slice(1);
    expect(appendedEntries).toHaveLength(1);
    expect(JSON.parse(appendedEntries[0]!).runId).toBe('b');
  });

  it('--from 读入 JSON 数组逐条追加，时间戳严格递增', async () => {
    await seed('');
    const payload = path.join(tmpDir, 'payload.json');
    await fs.writeFile(
      payload,
      JSON.stringify([
        record({ runId: 'a', timestamp: undefined }),
        record({ runId: 'b', timestamp: undefined }),
        record({ runId: 'c', timestamp: undefined }),
      ]),
      'utf-8',
    );
    const r = run([runLogPath, '--from', payload, '--timestamp=2026-01-03T12:00:00.000Z']);
    expect(r.stderr).not.toContain('✗');
    expect(r.code).toBe(0);
    const summary = appendPayload(r.stdout);
    expect(summary.appended).toBe(3);
    expect(summary.lines).toBe(3);
    const entries = (await readLines()).map((l) => JSON.parse(l) as { timestamp: string });
    const stamps = entries.map((e) => Date.parse(e.timestamp));
    expect(stamps[1]!).toBeGreaterThan(stamps[0]!);
    expect(stamps[2]!).toBeGreaterThan(stamps[1]!);
    expect(entries[0]!.timestamp).toBe('2026-01-03T12:00:00.000Z');
    expect(stamps[1]! - stamps[0]!).toBe(1);
    expect(stamps[2]! - stamps[1]!).toBe(1);
    expect(await fs.readFile(runLogPath, 'utf-8')).toMatch(/clock-injected:2026-01-03T12:00:00\.000Z/);
    expect(r.stderr).toMatch(/时钟调整 \+1ms/);
  });

  it('目标不存在时创建新 run-log（首条记录自举）', async () => {
    expect(await fs.stat(runLogPath).catch(() => null)).toBeNull();
    const r = run([runLogPath, '--stdin'], line(record({ runId: 'first', timestamp: undefined })));
    expect(r.stderr).not.toContain('✗');
    expect(r.code).toBe(0);
    const summary = appendPayload(r.stdout);
    expect(summary.lines).toBe(1);
    expect(summary.appended).toBe(1);
  });

  it('--allow-clock-adjust 显式声明小步进：note 留 clock-adjust 理由', async () => {
    await seed(`${line(record())}\n`);
    const r = run(
      [runLogPath, '--stdin', '--allow-clock-adjust=live-run-replay'],
      line(record({ runId: 'b', timestamp: '2026-01-01T09:00:00.000Z' })),
    );
    expect(r.stderr).not.toContain('✗');
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/时钟调整/);
    expect(await fs.readFile(runLogPath, 'utf-8')).toMatch(/clock-adjust:live-run-replay/);
  });

  it('--json 输出扩展摘要（含 diagnostics 与逐字节路径），默认输出仅 3 键', async () => {
    await seed(`${line(record())}\n`);
    const plain = run([runLogPath, '--stdin'], line(record({ runId: 'b', timestamp: undefined })));
    expect(Object.keys(appendPayload(plain.stdout)).sort()).toEqual(['appended', 'digest', 'lines']);
    const verbose = run([runLogPath, '--stdin', '--json'], line(record({ runId: 'c', timestamp: undefined })));
    expect(verbose.code).toBe(0);
    const parsed = appendPayload(verbose.stdout);
    expect(parsed.appended).toBe(1);
    expect(Object.keys(parsed)).toContain('diagnostics');
  });
});

// ==================== 历史文件边界形态（G2-5） ====================

/**
 * G2-5 边界三态：历史文件三种非标准形态下的追加行为。断言口径 = 「解析吸收或明确拒绝，与实现一致」，
 * 且**目标文件历史行逐字节不变**（追加器从不重写历史行）：
 *   - CRLF 行尾：`readRunLogFile` 以 `split(/\r?\n/)` 吸收行尾 → 解析成功、exit 0；
 *   - BOM 头：`parseJsonSafe` 剥离首部 BOM（`lib/safe-json.ts`）→ 首行可解析、exit 0；
 *   - 无换行结尾：`composeAppendedText` 只补一个分隔 LF（不改动任何既有字节）→ exit 0。
 */
describe('wm-append-runlog：历史文件边界形态（G2-5）', () => {
  it('文件格式吸收（3 态：CRLF 行尾 / BOM 头 / 无换行结尾；历史字节前缀不变断言逐行保留）', async () => {
    for (const { format, existingText, verify } of [
      {
        format: 'CRLF',
        existingText: `${line(record())}\r\n`,
        verify: async (r: { stdout: string }, raw: string): Promise<void> => {
          expect(appendPayload(r.stdout).appended).toBe(1);
          // 历史（含 CRLF 行尾）逐字节保留
          const entries = raw
            .split(/\r?\n/)
            .filter((l) => l.trim() !== '')
            .map((l) => JSON.parse(l) as { runId: string });
          expect(entries.map((e) => e.runId)).toEqual(['a', 'b']);
        },
      },
      {
        format: 'BOM',
        existingText: `\uFEFF${line(record())}\n`,
        verify: async (_r: { stdout: string }, _raw: string): Promise<void> => {
          // 字节层：BOM 仍在文件首（历史行逐字节保留，未被就地剥离/重写）
          const buf = await fs.readFile(runLogPath);
          expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        },
      },
      {
        format: '无换行',
        existingText: line(record()), // 末尾无 \n
        verify: async (_r: { stdout: string }, raw: string, text: string): Promise<void> => {
          // 新增的唯一字节 = 分隔 LF + 新记录行；既有文本零改写
          expect(raw.charAt(text.length)).toBe('\n');
          const appended = JSON.parse(raw.slice(text.length + 1).trim()) as { runId: string };
          expect(appended.runId).toBe('b');
        },
      },
    ]) {
      await seed(existingText);
      const r = run([runLogPath, '--stdin'], line(record({ runId: 'b', timestamp: undefined })));
      expect(r.stderr, `format=${format}: 不应报错`).not.toContain('✗');
      expect(r.code, `format=${format}: 应 exit 0`).toBe(0);
      const raw = await fs.readFile(runLogPath, 'utf-8');
      expect(raw.startsWith(existingText), `format=${format}: 历史字节前缀应逐字节不变`).toBe(true);
      await verify(r, raw, existingText);
    }
  }, 120_000);
});

describe('wm-append-runlog：时间戳倒退（exit 1，写入拒绝）', () => {
  it('时间戳不递增 → exit 1，文案点名末条时间与建议，文件未被修改', async () => {
    await seed(`${line(record())}\n`);
    const before = await sha256(runLogPath);
    const r = run([runLogPath, '--stdin'], line(record({ runId: 'b', timestamp: '2026-01-01T09:00:00.000Z' })));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/时间戳不递增/);
    expect(r.stderr).toMatch(/2026-01-02T10:00:00\.000Z/);
    expect(r.stderr).toMatch(/--allow-clock-adjust|--timestamp/);
    expect(await sha256(runLogPath)).toBe(before);
  });

  it('同毫秒（非严格大于）默认拒绝，未显式声明即不写入', async () => {
    await seed(`${line(record())}\n`);
    const before = await sha256(runLogPath);
    const r = run([runLogPath, '--stdin'], line(record({ runId: 'b', timestamp: BASE_RECORD.timestamp })));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/时间戳不递增/);
    expect(await sha256(runLogPath)).toBe(before);
  });
});

describe('wm-append-runlog：非法输入（exit 2）', () => {
  it('ARG_INVALID 目标文件保护组（5 态：未知 flag / 重复 flag / 单破折号 / 未知 runId / schema 违规；文件未被修改断言逐行保留）', async () => {
    for (const [形态名, args, stdin, seedText, fileUnchanged, expectStderr, expectStdout] of [
      [
        '未知 flag',
        () => [runLogPath, '--d4-invalid-argument'],
        undefined,
        null,
        'absent',
        /✗ \[ARG_INVALID\]/,
        /ERROR_JSON .*"category":"ARG_INVALID".*"exitCode":2/,
      ],
      [
        '重复值 flag（--timestamp 两次）',
        () => [runLogPath, '--stdin', '--timestamp=2026-09-25T11:00:00.000Z', '--timestamp=2026-09-25T11:00:01.000Z'],
        line(record({ runId: 'b', timestamp: undefined })),
        null,
        'absent',
        /重复的命令行参数 --timestamp/,
        /ERROR_JSON .*"category":"ARG_INVALID"/,
      ],
      [
        '单破折号未知选项（不得被当作目标路径）',
        () => ['-x', '--stdin'],
        line(record({ runId: 'b', timestamp: undefined })),
        null,
        'absent',
        /✗ \[ARG_INVALID\]/,
        null,
      ],
      [
        '--correct 引用不存在的 runId',
        () => [runLogPath, '--stdin', '--correct=nope'],
        line({ note: '更正' }),
        `${line(record())}\n`,
        'sha',
        /✗ \[ARG_INVALID\]/,
        null,
      ],
      [
        '待追加记录不符 run-log schema（缺 action）',
        () => [runLogPath, '--stdin'],
        line(
          (() => {
            const bad: Record<string, unknown> = { ...record({ runId: 'b' }) };
            delete bad.action;
            return bad;
          })(),
        ),
        `${line(record())}\n`,
        'sha',
        /✗ \[STRUCTURE_INVALID\]/,
        null,
      ],
    ] as const) {
      if (seedText !== null) {
        await seed(seedText);
      }
      const before = fileUnchanged === 'sha' ? await sha256(runLogPath) : null;
      const r = run(args(), stdin);
      expect(r.code, `${形态名}: 应 exit 2（${r.stderr}）`).toBe(2);
      if (expectStderr) {
        expect(r.stderr, `${形态名}: stderr 应含 ${expectStderr}`).toMatch(expectStderr);
      }
      if (expectStdout) {
        expect(r.stdout, `${形态名}: stdout 应含 ${expectStdout}`).toMatch(expectStdout);
      }
      if (fileUnchanged === 'absent') {
        expect(await fs.stat(runLogPath).catch(() => null), `${形态名}: 目标文件不应被创建`).toBeNull();
      } else if (fileUnchanged === 'sha') {
        expect(await sha256(runLogPath), `${形态名}: 目标文件 sha256 应不变`).toBe(before);
      }
    }
  }, 150_000);

  it('ARG_INVALID 参数组合组（3 态：--stdin 与 --from 互斥 / 双缺输入 / --correct 多条载荷）', async () => {
    for (const [形态名, prepare, args, stdin, expectStderr, expectStdout] of [
      [
        '--stdin 与 --from 互斥',
        async () => {
          const payload = path.join(tmpDir, 'payload.jsonl');
          await fs.writeFile(payload, `${line(record())}\n`, 'utf-8');
          return payload;
        },
        (payload: string) => [runLogPath, '--stdin', '--from', payload],
        line(record({ runId: 'b' })),
        null,
        /ERROR_JSON .*"category":"ARG_INVALID"/,
      ],
      [
        '既无 --stdin 也无 --from 且非 --correct',
        async () => null,
        () => [runLogPath],
        undefined,
        /--stdin|--from/,
        null,
      ],
      [
        '--correct 搭配多条载荷（非单条 patch）',
        async () => null,
        () => [runLogPath, '--stdin', '--correct=a'],
        `${line(record({ runId: 'b' }))}\n${line(record({ runId: 'c' }))}`,
        null,
        /ERROR_JSON .*"category":"ARG_INVALID"/,
      ],
    ] as const) {
      const seeded = 形态名.includes('多条载荷');
      if (seeded) {
        await seed(`${line(record())}\n`);
      }
      const payload = await prepare();
      const r = run(args(payload as string), stdin);
      expect(r.code, `${形态名}: 应 exit 2`).toBe(2);
      if (expectStderr) {
        expect(r.stderr, `${形态名}: stderr 应含 ${expectStderr}`).toMatch(expectStderr);
      }
      if (expectStdout) {
        expect(r.stdout, `${形态名}: stdout 应含 ${expectStdout}`).toMatch(expectStdout);
      }
    }
  }, 120_000);

  it('legacy 历史行（不符当前 schema）不阻断追加：exit 0 + 非阻断诊断 + 历史前缀逐字节不变', async () => {
    // 历史行带 schema 未登记字段（additionalProperties:false 违规）但语法合法：append 口径只强制校验
    // **新增**行；历史行与盘上逐字节相同（本工具从不重写），不符 schema 属 legacy 形态（读侧
    // check-run-log 亦为吸收语义）→ 只输出非阻断诊断，不改退出码
    const legacy = { ...record(), unexpectedLegacyField: true };
    const existingText = `${line(legacy)}\n`;
    await seed(existingText);
    const r = run([runLogPath, '--stdin', '--json'], line(record({ runId: 'b', timestamp: undefined })));
    expect(r.code).toBe(0);
    expect(r.stderr).not.toContain('✗');
    expect(r.stderr).toMatch(/历史行不符当前 run-log schema（非阻断，未改写）：第 1 行/);
    const summary = appendPayload(r.stdout);
    expect(summary.appended).toBe(1);
    expect(summary.legacyInvalidLines).toEqual([1]);
    const raw = await fs.readFile(runLogPath, 'utf-8');
    expect(raw.startsWith(existingText)).toBe(true);
    expect(raw).toMatch(/unexpectedLegacyField/);
  });

  it('legacy 行 + 空行混合：边界行号按物理行计算，历史行全部只作诊断', async () => {
    const legacy1 = { ...record({ runId: 'l1' }), unexpectedLegacyField: true };
    const legacy2 = { ...record({ runId: 'l2', timestamp: '2026-01-02T10:01:00.000Z' }), anotherLegacyField: true };
    const existingText = `${line(legacy1)}\n\n${line(legacy2)}\n`;
    await seed(existingText);
    const r = run([runLogPath, '--stdin', '--json'], line(record({ runId: 'b', timestamp: undefined })));
    expect(r.code).toBe(0);
    const summary = appendPayload(r.stdout);
    expect(summary.legacyInvalidLines).toEqual([1, 3]);
    const raw = await fs.readFile(runLogPath, 'utf-8');
    expect(raw.startsWith(existingText)).toBe(true);
  });

  it('now 早于末条时间（时钟倒退）→ exit 1 且目标 sha256 不变', async () => {
    // 末条时间戳取未来时刻，保证 now < 末条（不依赖墙钟）
    await seed(`${line(record({ timestamp: '2099-01-01T00:00:00.000Z' }))}\n`);
    const before = await sha256(runLogPath);
    const r = run([runLogPath, '--stdin'], line(record({ runId: 'b', timestamp: undefined })));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/早于末条时间 2099-01-01T00:00:00\.000Z/);
    expect(r.stderr).toMatch(/--allow-clock-adjust/);
    expect(await sha256(runLogPath)).toBe(before);
  });

  it('now 早于末条时间 + --allow-clock-adjust：追加成功且留理由痕迹', async () => {
    await seed(`${line(record({ timestamp: '2099-01-01T00:00:00.000Z' }))}\n`);
    const r = run(
      [runLogPath, '--stdin', '--allow-clock-adjust=ntp-rollback'],
      line(record({ runId: 'b', timestamp: undefined })),
    );
    expect(r.code).toBe(0);
    expect(await fs.readFile(runLogPath, 'utf-8')).toMatch(/clock-adjust:auto\+\d+ms:ntp-rollback/);
  });

  it('--lock-timeout 非法值（3 态：abc / -1 / 1e3）→ exit 2 ARG_INVALID（点名非法值），文件未被修改', async () => {
    for (const raw of ['abc', '-1', '1e3']) {
      await seed(`${line(record())}\n`);
      const before = await sha256(runLogPath);
      const r = run(
        [runLogPath, '--stdin', `--lock-timeout=${raw}`],
        line(record({ runId: 'b', timestamp: undefined })),
      );
      expect(r.code, `value=${raw}: 应 exit 2`).toBe(2);
      expect(r.stderr, `value=${raw}: 应含 ✗ [ARG_INVALID]`).toContain('✗ [ARG_INVALID]');
      expect(r.stderr, `value=${raw}: 应含口径文案`).toContain('--lock-timeout 需为非负安全整数（毫秒）');
      expect(r.stderr, `value=${raw}: 应点名非法值`).toContain(`收到: ${raw}`);
      expect(r.stdout, `value=${raw}: 应含 ERROR_JSON`).toMatch(/ERROR_JSON .*"category":"ARG_INVALID".*"exitCode":2/);
      expect(await sha256(runLogPath), `value=${raw}: 目标文件 sha256 应不变`).toBe(before);
    }
  }, 120_000);
});

describe('wm-append-runlog：更正记录（--correct，裁定 B）', () => {
  it('--correct 只追加新记录，历史行逐字节不变，note 含 correction-of:<runId>', async () => {
    const existingText = `${line(record({ note: '错值 4' }))}\n`;
    await seed(existingText);
    const before = await readLines();
    const r = run([runLogPath, '--stdin', '--correct=a'], line({ note: '更正为 5', runId: 'a-corr-1' }));
    expect(r.stderr).not.toContain('✗');
    expect(r.stderr).toMatch(/更正记录：runId=a/);
    expect(r.code).toBe(0);
    const summary = appendPayload(r.stdout);
    expect(summary.appended).toBe(1);
    expect(summary.lines).toBe(2);
    const raw = await fs.readFile(runLogPath, 'utf-8');
    expect(raw.startsWith(existingText)).toBe(true);
    const after = await readLines();
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after[1]).toMatch(/correction-of:a/);
    expect(after[1]).toMatch(/更正为 5/);
    expect(JSON.parse(after[1]!).tokens).toBe(10);
  });
});
