/**
 * superpowers 方法论检测 + codegraph MCP 注册探测（lib/superpowers-detect.ts）
 *
 * superpowers 替换批次 1（2026-09-21）：ensure-codegraph.ts 与 doctor.ts 共用的轻量判据单源：
 *   - L1 宿主技能目录：~/.agents/skills 与 ~/.claude/skills 并集含 ≥3 个关键技能子目录（含 SKILL.md）
 *   - L2 技能包 vendored 副本：<skillRoot>/references/superpowers-adoption.md
 *   - L3 项目目录：<projectRoot>/docs/superpowers/
 * 三层只检测不安装；缺失由调用方决定提示级（doctor warn / ensure checkpoint）。
 * 另提供 codegraph MCP 注册探测（best-effort 子串扫描知名宿主配置），仅作「可选加速」说明文案，
 * 不参与就绪判定——codegraph 依赖已收敛为对其 CLI 的依赖，MCP 不再自动注册。
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

/** 关键技能集：宿主技能目录至少含其中 3 个（子目录内含 SKILL.md 即算） */
export const SUPERPOWERS_KEY_SKILLS: readonly string[] = [
  'brainstorming',
  'writing-plans',
  'subagent-driven-development',
  'executing-plans',
  'test-driven-development',
];

/** 宿主技能目录最低关键技能数 */
export const MIN_HOST_SUPERPOWERS_SKILLS = 3;

/** 宿主技能目录候选（相对 home）：.agents/skills 与 .claude/skills 并集去重 */
const HOST_SKILL_DIRS = ['.agents', '.claude'] as const;

/**
 * 扫描宿主技能目录中发现的关键技能（跨 .agents/skills 与 .claude/skills 并集去重）。
 * 子目录内含 SKILL.md 即算；目录不存在 / 不可读按未发现处理（best-effort 检测）。
 */
export function scanHostSuperpowersSkills(homeDir: string): string[] {
  const found = new Set<string>();
  for (const hostDir of HOST_SKILL_DIRS) {
    for (const skill of SUPERPOWERS_KEY_SKILLS) {
      if (found.has(skill)) continue;
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- 路径由 homedir() + 常量宿主目录名 + 关键技能名拼接，无外部输入
        if (existsSync(path.join(homeDir, hostDir, 'skills', skill, 'SKILL.md'))) found.add(skill);
      } catch {
        // 单目录探测失败不中断：按该目录未发现处理
      }
    }
  }
  return [...found];
}

/**
 * 解析技能包内 vendored 方法论文件路径（脚本相对：调用方传入脚本所在 cli/ 目录，
 * 技能包根为上两级 → references/superpowers-adoption.md）。
 */
export function resolveVendoredAdoptionPath(cliDir: string): string {
  return path.resolve(cliDir, '..', '..', 'references', 'superpowers-adoption.md');
}

/** MCP 配置候选（相对 home 的知名宿主配置；另含项目级 .mcp.json，由调用方拼入） */
const MCP_CONFIG_CANDIDATES = [
  '.claude.json',
  path.join('.cursor', 'mcp.json'),
  path.join('.config', 'opencode', 'opencode.json'),
];

/**
 * best-effort 探测宿主是否注册了 codegraph MCP：扫描知名宿主配置 + 项目 .mcp.json，
 * 内容含「codegraph」（大小写不敏感）即视为已注册。仅影响说明文案（可选加速），不参与就绪判定。
 */
export function detectCodegraphMcpRegistration(homeDir: string, projectRoot: string): boolean {
  const candidates = [
    ...MCP_CONFIG_CANDIDATES.map((rel) => path.join(homeDir, rel)),
    path.join(projectRoot, '.mcp.json'),
  ];
  for (const file of candidates) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 候选路径为 homedir() 下常量配置名与 projectRoot/.mcp.json，只读 best-effort 探测
      if (readFileSync(file, 'utf-8').toLowerCase().includes('codegraph')) return true;
    } catch {
      // 缺文件 / 不可读 → 该候选未注册，继续扫下一个
    }
  }
  return false;
}
