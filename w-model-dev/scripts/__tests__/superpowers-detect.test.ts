/* eslint-disable security/detect-non-literal-fs-filename -- 全部路径由 mkdtemp 测试夹具生成 */
/**
 * lib/superpowers-detect.ts 单元测试（superpowers 替换批次 1 任务 5）
 *
 * 该模块是 ensure-codegraph.ts（L1/L2/L3 三层就绪判定）与 cli/doctor.ts（提示级检查）
 * 共用的判据单一事实源，故在此直接锁定判据本身，而非只经两个消费者间接覆盖：
 *   - 关键技能集与「宿主至少 3 个」下限常量；
 *   - scanHostSuperpowersSkills：~/.agents/skills 与 ~/.claude/skills 并集去重、子目录须含
 *     SKILL.md 才算、目录不存在按未发现处理（只检测不安装）；
 *   - resolveVendoredAdoptionPath：脚本相对解析到技能包 references/superpowers-adoption.md；
 *   - detectCodegraphMcpRegistration：项目 .mcp.json 与宿主配置 best-effort 探测（大小写不敏感），
 *     仅影响「MCP 可选加速」说明文案，不参与 codegraph 就绪判定。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  MIN_HOST_SUPERPOWERS_SKILLS,
  SUPERPOWERS_KEY_SKILLS,
  detectCodegraphMcpRegistration,
  resolveVendoredAdoptionPath,
  scanHostSuperpowersSkills,
} from '../lib/superpowers-detect.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const dirs: string[] = [];

function makeDir(prefix = 'wmodel-superpowers-detect-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

/** 在 <home>/<host>/skills/<skill>/ 下放置（或不放置）SKILL.md */
function plantSkill(home: string, host: string, skill: string, withSkillFile = true): void {
  const skillDir = join(home, host, 'skills', skill);
  mkdirSync(skillDir, { recursive: true });
  if (withSkillFile) writeFileSync(join(skillDir, 'SKILL.md'), `# ${skill}\n`, 'utf8');
}

function writeConfig(file: string, content: string): void {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('superpowers 判据常量', () => {
  it('关键技能集为 5 项且含 subagent-driven-development；宿主下限为 3', () => {
    expect(SUPERPOWERS_KEY_SKILLS).toHaveLength(5);
    expect(SUPERPOWERS_KEY_SKILLS).toContain('subagent-driven-development');
    expect(SUPERPOWERS_KEY_SKILLS).toContain('brainstorming');
    expect(MIN_HOST_SUPERPOWERS_SKILLS).toBe(3);
  });
});

describe('scanHostSuperpowersSkills（宿主技能目录并集去重）', () => {
  it('发现行（2 态：仅 .agents 3 技能全发现 / 双宿主并集去重）', () => {
    for (const { caseName, setup, expected } of [
      {
        caseName: '仅 ~/.agents/skills 下 3 个含 SKILL.md 的关键技能',
        setup: (): string => {
          const home = makeDir();
          plantSkill(home, '.agents', 'brainstorming');
          plantSkill(home, '.agents', 'writing-plans');
          plantSkill(home, '.agents', 'subagent-driven-development');
          return home;
        },
        expected: ['brainstorming', 'subagent-driven-development', 'writing-plans'],
      },
      {
        caseName: '两个宿主目录并集去重（同名技能只计一次，合计可达下限）',
        setup: (): string => {
          const home = makeDir();
          plantSkill(home, '.agents', 'brainstorming');
          plantSkill(home, '.agents', 'writing-plans');
          plantSkill(home, '.claude', 'writing-plans'); // 与 .agents 重复 → 去重
          plantSkill(home, '.claude', 'executing-plans');
          return home;
        },
        expected: ['brainstorming', 'executing-plans', 'writing-plans'],
      },
    ] as const) {
      const home = setup();
      expect(scanHostSuperpowersSkills(home).sort(), `${caseName}: 应发现去重后的关键技能集`).toEqual(expected);
    }
  });

  it('不计入行（2 态：空 home / 子目录缺 SKILL.md）→ 未发现任何关键技能', () => {
    for (const { caseName, setup } of [
      {
        caseName: '空 home（无 .agents/.claude）',
        setup: (): string => makeDir(),
      },
      {
        caseName: '子目录存在但缺 SKILL.md（子目录内含 SKILL.md 即算的判据）',
        setup: (): string => {
          const home = makeDir();
          plantSkill(home, '.agents', 'brainstorming', false);
          return home;
        },
      },
    ] as const) {
      const home = setup();
      expect(scanHostSuperpowersSkills(home), `${caseName}: 应不计入`).toEqual([]);
    }
  });
});

describe('resolveVendoredAdoptionPath（技能包内 vendored 副本定位）', () => {
  it('由 cli/ 目录上两级解析到 <技能包根>/references/superpowers-adoption.md', () => {
    const cliDir = join(TEST_DIR, '..', 'cli');
    expect(resolveVendoredAdoptionPath(cliDir)).toBe(
      resolve(TEST_DIR, '..', '..', 'references', 'superpowers-adoption.md'),
    );
  });
});

describe('detectCodegraphMcpRegistration（best-effort，仅说明文案）', () => {
  it('true 行（2 态：项目 .mcp.json 含 codegraph 大小写不敏感 / 宿主 .claude.json）', () => {
    for (const { caseName, setup } of [
      {
        caseName: '项目 .mcp.json 含 codegraph（CodeGraph 大小写不敏感）',
        setup: (): { home: string; projectRoot: string } => {
          const home = makeDir();
          const projectRoot = makeDir();
          writeConfig(
            join(projectRoot, '.mcp.json'),
            JSON.stringify({ mcpServers: { CodeGraph: { command: 'codegraph' } } }),
          );
          return { home, projectRoot };
        },
      },
      {
        caseName: '宿主 ~/.claude.json 含 codegraph',
        setup: (): { home: string; projectRoot: string } => {
          const home = makeDir();
          writeConfig(join(home, '.claude.json'), JSON.stringify({ mcpServers: { codegraph: {} } }));
          return { home, projectRoot: makeDir() };
        },
      },
    ] as const) {
      const { home, projectRoot } = setup();
      expect(detectCodegraphMcpRegistration(home, projectRoot), `${caseName}: 应判已注册`).toBe(true);
    }
  });

  it('false 行（2 态：无任何候选配置 / 配置存在但不含 codegraph）', () => {
    for (const { caseName, setup } of [
      {
        caseName: '无任何候选配置',
        setup: (): { home: string; projectRoot: string } => ({ home: makeDir(), projectRoot: makeDir() }),
      },
      {
        caseName: '配置存在但不含 codegraph（不因文件存在即判已注册）',
        setup: (): { home: string; projectRoot: string } => {
          const home = makeDir();
          const projectRoot = makeDir();
          writeConfig(join(home, '.claude.json'), JSON.stringify({ mcpServers: { other: {} } }));
          writeConfig(join(projectRoot, '.mcp.json'), JSON.stringify({ mcpServers: {} }));
          return { home, projectRoot };
        },
      },
    ] as const) {
      const { home, projectRoot } = setup();
      expect(detectCodegraphMcpRegistration(home, projectRoot), `${caseName}: 应判未注册`).toBe(false);
    }
  });
});
