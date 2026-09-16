/* eslint-disable security/detect-non-literal-fs-filename -- 临时项目树由本测试 mkdtemp 拥有，路径自生成非用户输入 */
/**
 * S18 票据内容门禁（ticket content gate）单元测试。
 *
 * 规格落点：设计 spec §3.5 S18「票据校验（`check-artifact-gate.ts --phase=5`）」；
 * 判据集见计划 `docs/superpowers/plans/2026-09-15-p4-test-quality-and-design-rules.md` §0.1.3/§0.1.4/§0.1.5。
 *
 * 三层覆盖：
 *   1. 纯函数 `checkTicketContent()`：六条黑名单（台账 S18 :695-700）各 1 例 + Buildability 3 例；
 *   2. `checkArtifactGate()` 接线：给定 `ticketsText` 时 reasons 并入 + `result.tickets` 计数；
 *   3. CLI 参数契约四态：缺省不触发 / 文件不存在 exit 2 `FILE_NOT_FOUND` /
 *      `--phase<5` 给定 `--tickets` exit 2 `ARG_INVALID` / 校验失败 exit 1 + `GATE_JSON.tickets`。
 *
 * 符号类改写的边界（§0.1.3）：第 5 条源文附「code blocks required」，第 1/2/3 条的「怎么写」部分
 * 在本仓库一律落为**符号级要求**（点名接口签名 / 类型约束 / 状态转移，或具体动作与产出物），
 * **不要求写文件路径或内联代码块**——依据 `phase-5-coding.md`「票据内容 durability」与
 * 「禁止具体文件路径与代码片段」。该改写是**本仓库对源文的适配，非源文原义**；台账原文块
 * （`sources/2026-09-14-superpowers-adopted-excerpts.md:679-703`）标题写「七条」而原文块实测 6 条 bullet，
 * 且含 `（略）` 截断——路径类原文未见（未核实），故本实现不主张任何路径类原文语义。
 */
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkArtifactGate, checkTicketContent } from '../logic/gate-logic.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CHECK_ARTIFACT_GATE_SCRIPT = path.resolve(TEST_DIR, '../cli/check-artifact-gate.ts');
const VALID_RTM = path.resolve(TEST_DIR, '../samples/gate/valid-rtm.json');

/** 合规票据：符号级契约 + 验收标准 + 零占位符（六条黑名单与 Buildability 均不触发） */
const VALID_TICKETS = [
  '# 01 — 登录凭证校验',
  '',
  '**What to build:** 接口签名 `AuthService.authenticate(credentials): Session`；`invalidCredentials` 分支返回 `Unauthorized`；状态转移 `anonymous → authenticated`',
  '**Blocked by:** None — can start immediately',
  '**Status:** ready-for-agent',
  '',
  '- [ ] `AuthService.authenticate` 对 `invalidCredentials` 返回 `Unauthorized`',
  "- [ ] 单元测试 `describe('AuthService.authenticate')` 覆盖 `invalidCredentials`",
  '',
  '# 02 — 会话续期',
  '',
  '**What to build:** 接口签名 `SessionStore.renew(sessionId): Session`；过期 `sessionId` 返回 `SessionExpired`；状态转移 `authenticated → refreshed`',
  '**Blocked by:** 01',
  '**Status:** blocked',
  '',
  '- [ ] `SessionStore.renew` 对 `SessionExpired` 分支返回非零退出码',
  '',
].join('\n');

/** 单票据包装：便于逐条注入黑名单样本（票据须有符号级契约，否则第 5 条会一并触发） */
function ticket(body: string[]): string {
  return [
    '# 01 — 样例票据',
    '',
    '**What to build:** 接口签名 `SampleRunner.run(job): Result`；状态转移 `idle → running`',
    '**Blocked by:** None',
    '**Status:** ready-for-agent',
    '',
    ...body,
    '',
  ].join('\n');
}

describe('checkTicketContent（S18 六条黑名单 + Buildability，纯函数）', () => {
  it('合规票据：零违反，checked=2、两个计数均为 0', () => {
    const r = checkTicketContent(VALID_TICKETS);
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.summary).toEqual({ checked: 2, criticalMissing: 0, buildabilityMissing: 0 });
  });

  it('黑名单第 1 条（台账 :696）：禁止占位短语 TODO/implement later → placeholder', () => {
    const r = checkTicketContent(ticket(['- [ ] TODO: 补齐错误分支']));
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/票据 01「样例票据」.*placeholder.*TODO.*S18 黑名单第 1 条/);
  });

  it('黑名单第 2 条（台账 :697）：无具体动作的祈使 → vague-imperative', () => {
    const r = checkTicketContent(ticket(['- [ ] 加适当的错误处理']));
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/票据 01「样例票据」.*vague-imperative.*S18 黑名单第 2 条/);
  });

  it('黑名单第 3 条（台账 :698）：要求写测试但无测试符号/用例名 → test-without-signature', () => {
    const r = checkTicketContent(ticket(['- [ ] 为上述写测试']));
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/票据 01「样例票据」.*test-without-signature.*S18 黑名单第 3 条/);
  });

  it('黑名单第 4 条（台账 :699）：类似任务 N 而无符号级重复说明 → similar-to-task', () => {
    const r = checkTicketContent(ticket(['- [ ] 与任务 01 类似']));
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/票据 01「样例票据」.*similar-to-task.*S18 黑名单第 4 条/);
  });

  it('黑名单第 5 条（台账 :700，符号类改写）：既无符号也无路径 → no-symbol-contract', () => {
    const r = checkTicketContent(
      ['# 01 — 空壳票据', '', '**What to build:** 实现登录相关功能', '**Blocked by:** None', ''].join('\n'),
    );
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/票据 01「空壳票据」.*no-symbol-contract.*S18 黑名单第 5 条/);
    // 本仓库适配：判据不得要求写文件路径或内联代码块（符号级要求，非源文原义）
    expect(r.violations.join('\n')).not.toMatch(
      /(?:须|必须|要求)(?:写|给出|附上|提供).{0,6}(?:文件路径|内联代码块|代码块)/,
    );
    expect(r.violations.join('\n')).not.toMatch(/code blocks? required/i);
  });

  it('黑名单第 6 条（台账 :701）：引用任何任务都未定义的符号 → undefined-symbol', () => {
    const r = checkTicketContent(ticket(['**补充说明:** 调用 `AuditLogWriter.write` 记录审计']));
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(
      /票据 01「样例票据」.*undefined-symbol.*`AuditLogWriter\.write`.*S18 黑名单第 6 条/,
    );
  });

  it('黑名单第 6 条：跨票据仅参数名重叠不构成符号契约 → undefined-symbol', () => {
    const r = checkTicketContent([
      '# 01 — define',
      'What to build: `Foo.run(job): Result`',
      '# 02 — use',
      '调用 `Other.call(job)`',
    ].join('\n'));
    expect(r.passed).toBe(false);
    expect(r.violations.join('\n')).toMatch(/undefined-symbol[\s\S]*`Other\.call\(job\)`[\s\S]*S18 黑名单第 6 条/);
  });

  it('黑名单第 6 条正向边界：同一 Foo.run 仅参数名变化仍视为同一已定义符号', () => {
    const r = checkTicketContent([
      '# 01 — define',
      'What to build: `Foo.run(job): Result`',
      '# 02 — use',
      '调用 `Foo.run(task)`',
    ].join('\n'));
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('修复轮 2 (B) 正向边界：专指契约标记行 / `What to build` 行上的无返回标注调用式 → 视为已定义', () => {
    const cases: Array<{ line: string; criteria: string }> = [
      // 复审 I-1 实测反例 1：标记行上的无返回标注调用式（base passed，修复轮 1 误报）
      {
        line: '**What to build:** 接口签名 `AuthService.authenticate(credentials)`',
        criteria: '- [ ] `AuthService.authenticate` 可用',
      },
      // 复审 I-1 实测反例 2a：其它契约标记词（`契约`）行 + 调用式
      { line: '**What to build:** 本票契约：`A.b(x)`', criteria: '- [ ] `A.b` 可用' },
      // 复审 I-1 实测反例 2b：`What to build` 行上的**带参**调用式（形如签名的 `Login(username, password)`）
      { line: '**What to build:** 实现 `Login(username, password)`', criteria: '- [ ] `Login` 可用' },
    ];
    for (const c of cases) {
      const r = checkTicketContent(['# 01 — 边界', '', c.line, '**Blocked by:** None', '', c.criteria, ''].join('\n'));
      expect(r.violations, `${c.line} → ${JSON.stringify(r.violations)}`).toEqual([]);
      expect(r.summary).toEqual({ checked: 1, criticalMissing: 0, buildabilityMissing: 0 });
    }
  });

  it('修复轮 2 (B) 反向边界：`What to build` 行单独出现**空括号**调用 → 仍判未定义（保留 finding #2 拦截）', () => {
    const r = checkTicketContent(
      [
        '# 01 — 空括号调用',
        '',
        '**What to build:** 调用 `Cache.clear()`',
        '**Blocked by:** None',
        '',
        '- [ ] 无异常',
        '',
      ].join('\n'),
    );
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/undefined-symbol.*`Cache\.clear\(\)`/);
  });

  it('修复轮 3：标记词在非声明位置（否定 / 旁述语义）不得使该行调用式成为定义 → 仍被 ⑥ 拦下', () => {
    const cases = [
      '**What to build:** 沿用现有契约，调用 `Ghost.do()`',
      '**What to build:** 调用 `ReportRenderer.render()`，不定义新类型',
      '**What to build:** 无接口签名要求，调用 `Ghost.do()`',
    ];
    for (const line of cases) {
      const r = checkTicketContent(
        ['# 01 — 否定语义', '', line, '**Blocked by:** None', '', '- [ ] 无异常', ''].join('\n'),
      );
      expect(r.summary.criticalMissing, `${line} → ${JSON.stringify(r.violations)}`).toBe(1);
      expect(r.violations.join('\n'), line).toMatch(/undefined-symbol/);
    }
  });

  it('修复轮 3 正向：声明式邻接（标记词紧邻 span 之前）仍算定义 → passed', () => {
    const cases = [
      '**What to build:** 接口签名 `AuthService.authenticate(credentials)`',
      '**What to build:** 实现 `Login(username, password)`',
      '**What to build:** 本票契约：`A.b(x)`',
      '**What to build:** 类型约束 `Session`；状态转移 `anonymous → authenticated`',
    ];
    for (const line of cases) {
      const r = checkTicketContent(
        ['# 01 — 声明式', '', line, '**Blocked by:** None', '', '- [ ] 无异常', ''].join('\n'),
      );
      expect(r.violations, `${line} → ${JSON.stringify(r.violations)}`).toEqual([]);
      expect(r.summary).toEqual({ checked: 1, criticalMissing: 0, buildabilityMissing: 0 });
    }
  });

  it('修复轮 2 (B) 组合边界（复审反例 3）：标记行调用式 + 验收标准引用同一符号 → ⑥/B② 均不触发', () => {
    const r = checkTicketContent(
      [
        '# 01 — 契约票',
        '',
        '**What to build:** 接口签名 `A.b(x)`',
        '**Blocked by:** None',
        '',
        '- [ ] `A.b` 返回会话',
        '',
      ].join('\n'),
    );
    expect(r.violations).toEqual([]);
    expect(r.summary).toEqual({ checked: 1, criticalMissing: 0, buildabilityMissing: 0 });
  });

  it('修复轮 1 ①（⑥ 假阳）：What to build 直接点名带返回契约的符号、无「接口签名」等魔法词 → passed', () => {
    const r = checkTicketContent(
      [
        '# 01 — 限流',
        '',
        '**What to build:** 实现 `RateLimiter.allow(key): boolean`；超额时给出 `TicketRejected`',
        '**Blocked by:** None',
        '',
        '- [ ] `RateLimiter.allow` 超额时给出 `TicketRejected`',
        '',
      ].join('\n'),
    );
    expect(r.violations).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.summary).toEqual({ checked: 1, criticalMissing: 0, buildabilityMissing: 0 });
  });

  it('修复轮 1 ②（⑥ 旁路）：通用散文词（返回/参数）不得使「只调用未声明」的符号通过', () => {
    const r = checkTicketContent(
      [
        '# 01 — 幽灵调用',
        '',
        '**What to build:** 调用 `Ghost.do()`，返回值忽略，参数透传',
        '**Blocked by:** None',
        '',
        '- [ ] 无异常',
        '',
      ].join('\n'),
    );
    expect(r.passed).toBe(false);
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/undefined-symbol.*`Ghost\.do\(\)`/);
  });

  it('修复轮 1 ③（同根因去重）：⑤ 与 Buildability 缺签名只计一处（⑤ 优先，B① 不重复计数）', () => {
    const r = checkTicketContent(
      ['# 01 — 空壳票据', '', '**What to build:** 实现登录功能', '**Blocked by:** None', ''].join('\n'),
    );
    expect(r.summary.criticalMissing).toBe(1);
    expect(r.summary.buildabilityMissing).toBe(0);
    expect(r.violations.filter((v) => v.includes('no-symbol-contract'))).toHaveLength(1);
    expect(r.violations.join('\n')).not.toMatch(/缺接口签名且缺验收标准/);
    // 互指：⑤ 文案须说明同根因的 Buildability 缺签名已被吸收，避免读者以为漏报
    expect(r.violations.join('\n')).toMatch(/no-symbol-contract[\s\S]*Buildability 缺签名/);
  });

  it('修复轮 1 ④（标题边界）：分节标题 `### 1. 步骤一` 不虚增 checked，也不产出虚假违规', () => {
    const r = checkTicketContent(
      [
        '# 01 — 限流',
        '',
        '**What to build:** 实现 `RateLimiter.allow(key): boolean`',
        '',
        '### 1. 步骤一',
        '',
        '- [ ] `RateLimiter.allow` 可用',
        '',
      ].join('\n'),
    );
    expect(r.summary.checked).toBe(1);
    expect(r.violations).toEqual([]);
  });

  it('修复轮 1 ④（标题边界）：票据关键词标题（票据 N / Ticket N / 任务 N）仍被识别为票据边界', () => {
    const r = checkTicketContent(
      [
        '# 票据 01 — 限流',
        '',
        '**What to build:** 实现 `RateLimiter.allow(key): boolean`',
        '',
        '## Ticket 02 — 续期',
        '',
        '**What to build:** 实现 `SessionStore.renew(sessionId): Session`',
        '',
        '### 任务 3 — 审计',
        '',
        '**What to build:** 实现 `AuditLogWriter.write(entry): void`',
        '',
      ].join('\n'),
    );
    expect(r.summary.checked).toBe(3);
    expect(r.violations).toEqual([]);
  });

  it('黑名单第 5 条替代形态（§0.1.3「或具体动作与产出物」）：非代码票据给显式产出物行 → 不触发', () => {
    const r = checkTicketContent(
      [
        '# 01 — 迁移手册',
        '',
        '**What to build:** 编写迁移手册',
        '**产出物:** 三种迁移路径的对照表与停机窗口建议',
        '**Blocked by:** None',
        '',
        '- [ ] 三种迁移路径均有对照结论',
        '',
      ].join('\n'),
    );
    expect(r.violations).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.summary).toEqual({ checked: 1, criticalMissing: 0, buildabilityMissing: 0 });
  });

  it('Buildability ①：缺接口签名且缺验收标准 → buildability-missing-signature-and-criteria', () => {
    const r = checkTicketContent(
      [
        '# 01 — 无线索票据',
        '',
        '**What to build:** 用 `Runner` 驱动 `Job` 流转，说明足够详细但未给签名',
        '**Blocked by:** None',
        '',
      ].join('\n'),
    );
    expect(r.passed).toBe(false);
    expect(r.summary.buildabilityMissing).toBe(1);
    expect(r.violations.join('\n')).toMatch(/票据 01「无线索票据」.*Buildability.*缺接口签名且缺验收标准/);
  });

  it('Buildability ②：验收标准引用未定义符号 → buildability-undefined-symbol-in-criteria', () => {
    const r = checkTicketContent(
      [
        '# 01 — 标准越界',
        '',
        '**What to build:** 接口签名 `Runner.run(job): Result`',
        '**Blocked by:** None',
        '',
        '- [ ] `Runner.run` 触发 `TelemetrySink.emit`',
        '',
      ].join('\n'),
    );
    expect(r.passed).toBe(false);
    expect(r.summary.buildabilityMissing).toBe(1);
    expect(r.summary.criticalMissing).toBe(0);
    expect(r.violations.join('\n')).toMatch(/票据 01「标准越界」.*Buildability.*`TelemetrySink\.emit`/);
  });

  it('Buildability ③：只给路径不给符号 → buildability-path-without-symbol', () => {
    const r = checkTicketContent(
      [
        '# 01 — 路径票据',
        '',
        '**What to build:** 修改 `src/services/article-service.ts`',
        '**Blocked by:** None',
        '',
        '- [ ] 静态检查通过',
        '',
      ].join('\n'),
    );
    expect(r.passed).toBe(false);
    expect(r.summary.buildabilityMissing).toBe(1);
    expect(r.summary.criticalMissing).toBe(0);
    expect(r.violations.join('\n')).toMatch(/票据 01「路径票据」.*Buildability.*只给路径/);
  });

  it('未发现任何票据块 → fail-closed（不给空文件放行）', () => {
    const r = checkTicketContent('# 票据\n\n没有票据块。\n');
    expect(r.passed).toBe(false);
    expect(r.summary.checked).toBe(0);
    expect(r.violations.join('\n')).toMatch(/未发现任何票据/);
  });

  it('--tickets 缺省（不调用纯函数）时既有行为不变：无 tickets 键、无票据 reasons', () => {
    const matrix = JSON.parse(require('node:fs').readFileSync(VALID_RTM, 'utf-8')) as never;
    const r = checkArtifactGate(matrix, { projectRoot: path.dirname(VALID_RTM) });
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.tickets).toBeUndefined();
  });
});

describe('checkArtifactGate 接线：ticketsText → reasons + result.tickets 计数', () => {
  const matrix = JSON.parse(require('node:fs').readFileSync(VALID_RTM, 'utf-8')) as never;

  it('合规票据：reasons 不含票据违反，tickets 计数全 0', () => {
    const r = checkArtifactGate(matrix, { projectRoot: path.dirname(VALID_RTM), ticketsText: VALID_TICKETS });
    expect(r.passed).toBe(true);
    expect(r.reasons.filter((x) => x.includes('票据内容校验失败'))).toEqual([]);
    expect(r.tickets).toEqual({ checked: 2, criticalMissing: 0, buildabilityMissing: 0 });
  });

  it('不合规票据：违反并入 reasons（阻断放行）且计数进 result.tickets', () => {
    const r = checkArtifactGate(matrix, {
      projectRoot: path.dirname(VALID_RTM),
      ticketsText: ticket(['- [ ] TODO: 待补']),
    });
    expect(r.passed).toBe(false);
    expect(r.reasons.join('\n')).toMatch(/票据内容校验失败：票据 01「样例票据」/);
    expect(r.tickets).toEqual({ checked: 1, criticalMissing: 1, buildabilityMissing: 0 });
  });
});

describe('check-artifact-gate.ts --tickets 参数契约（子进程，S18 §0.1.4）', () => {
  const rtmSource = require('node:fs').readFileSync(VALID_RTM, 'utf-8') as string;

  async function makeProject(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tickets-'));
    await fs.mkdir(path.join(dir, '.w-model'), { recursive: true });
    await fs.writeFile(path.join(dir, '.w-model/rtm.json'), rtmSource, 'utf-8');
    return dir;
  }

  function runGate(args: string[]): { status: number | null; stdout: string } {
    const r = runSync(process.execPath, [tsxCli, CHECK_ARTIFACT_GATE_SCRIPT, ...args, '--json'], {});
    return { status: r.status, stdout: r.stdout ?? '' };
  }

  it('缺省不触发：无 --tickets 时 GATE_JSON.tickets 为 null 且无票据 reasons（既有调用方零影响）', async () => {
    const dir = await makeProject();
    try {
      const { stdout } = runGate([dir, '--phase=8']);
      const report = JSON.parse(stdout) as { tickets?: unknown; reasons: string[] };
      expect(report.tickets).toBeNull();
      expect(report.reasons.filter((x) => x.includes('票据内容校验失败'))).toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('文件不存在 → exit 2 FILE_NOT_FOUND（不静默忽略）', async () => {
    const dir = await makeProject();
    try {
      const { status, stdout } = runGate([dir, '--phase=8', `--tickets=${path.join(dir, 'nope-tickets.md')}`]);
      expect(status).toBe(2);
      expect(stdout).toContain('ERROR_JSON');
      expect(stdout).toMatch(/"category":"FILE_NOT_FOUND"/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('--phase<5 给定 --tickets → exit 2 ARG_INVALID（不静默忽略）', async () => {
    const dir = await makeProject();
    try {
      const file = path.join(dir, 'tickets.md');
      await fs.writeFile(file, VALID_TICKETS, 'utf-8');
      const { status, stdout } = runGate([dir, '--phase=4', `--tickets=${file}`]);
      expect(status).toBe(2);
      expect(stdout).toMatch(/"category":"ARG_INVALID"/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('空格形态 / 空值 --tickets → exit 2 ARG_INVALID（只接受等号形态）', async () => {
    const dir = await makeProject();
    try {
      const spaceForm = runGate([dir, '--phase=8', '--tickets', path.join(dir, 'tickets.md')]);
      expect(spaceForm.status).toBe(2);
      expect(spaceForm.stdout).toMatch(/"category":"ARG_INVALID"/);
      const emptyForm = runGate([dir, '--phase=8', '--tickets=']);
      expect(emptyForm.status).toBe(2);
      expect(emptyForm.stdout).toMatch(/"category":"ARG_INVALID"/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('校验失败 → exit 1（不新增 exit 码）且 GATE_JSON.tickets 计数可消费', async () => {
    const dir = await makeProject();
    try {
      const file = path.join(dir, 'tickets.md');
      await fs.writeFile(file, ticket(['- [ ] 加校验']), 'utf-8');
      const { status, stdout } = runGate([dir, '--phase=8', `--tickets=${file}`]);
      expect(status).toBe(1);
      const report = JSON.parse(stdout) as {
        tickets: { checked: number; criticalMissing: number; buildabilityMissing: number };
        reasons: string[];
      };
      expect(report.tickets).toEqual({ checked: 1, criticalMissing: 1, buildabilityMissing: 0 });
      expect(report.reasons.join('\n')).toMatch(/票据内容校验失败：票据 01「样例票据」/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('合规票据：exit 仍由其它门禁决定（票据不引入额外阻断）且 tickets 计数全 0', async () => {
    const dir = await makeProject();
    try {
      const file = path.join(dir, 'tickets.md');
      await fs.writeFile(file, VALID_TICKETS, 'utf-8');
      const { status, stdout } = runGate([dir, '--phase=8', `--tickets=${file}`]);
      expect(status).toBe(1); // phase 8 缺 --scope → 外部校验 fail-closed（与票据无关）
      const report = JSON.parse(stdout) as {
        tickets: { checked: number; criticalMissing: number; buildabilityMissing: number };
        reasons: string[];
      };
      expect(report.tickets).toEqual({ checked: 2, criticalMissing: 0, buildabilityMissing: 0 });
      expect(report.reasons.filter((x) => x.includes('票据内容校验失败'))).toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
