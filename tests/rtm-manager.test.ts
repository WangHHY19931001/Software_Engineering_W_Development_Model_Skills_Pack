/**
 * RTMManager 单元测试
 *
 * 覆盖：
 *   - rebuild 全量重建
 *   - 覆盖率计算（getCoveragePercent / getMissingColumns）
 *   - 质量门检查（isQualityGatePassed）
 *   - Markdown 导出格式
 *   - logChange 变更记录
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';
import { ProjectStateManager } from '../src/state/project-state.js';
import { RTMManager } from '../src/state/rtm-manager.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-rtm-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function setupProject() {
  const state = new ProjectStateManager(tmpDir);
  await state.init('RTM 测试项目', 'd', { frontend: [], backend: [], database: [], others: [] });
  const rtm = new RTMManager(tmpDir, state);
  return { state, rtm };
}

describe('RTMManager - rebuild', () => {
  it('空项目 RTM 行数为 0', async () => {
    const { state, rtm } = await setupProject();
    await rtm.rebuild();
    const m = rtm.getMatrix();
    expect(m.rows).toHaveLength(0);
    expect(m.projectName).toBe('RTM 测试项目');
  });

  it('有需求但无设计 / 代码 / 测试 → 覆盖率 0%', async () => {
    const { state, rtm } = await setupProject();
    await state.addRequirement({
      title: '登录功能', description: 'd', type: '功能需求', priority: '高',
      acceptanceCriteria: [], testCases: [],
    });
    await rtm.rebuild();
    expect(rtm.getCoveragePercent()).toBe(0);
    const missing = rtm.getMissingColumns();
    expect(missing).toHaveLength(1);
    expect(missing[0].missing).toContain('设计文档');
    expect(missing[0].missing).toContain('代码模块');
    expect(missing[0].missing).toContain('单元测试');
  });

  it('完整链路 → 覆盖率 100%', async () => {
    const { state, rtm } = await setupProject();
    const req = await state.addRequirement({
      title: '登录', description: 'd', type: '功能需求', priority: '高',
      acceptanceCriteria: [], testCases: [],
    });
    const design = await state.addDesign({
      type: '系统设计', content: 'c', diagrams: [], testCases: [],
    });
    // 关联设计与需求（通过测试用例）
    const uat = await state.addTestCase({
      type: '验收测试', title: 't', description: 'd', steps: [], expectedResult: 'r',
      priority: '高', requirementId: req.id, designId: design.id,
    });
    const ut = await state.addTestCase({
      type: '单元测试', title: 't', description: 'userService.ts', steps: [], expectedResult: 'r',
      priority: '高', requirementId: req.id,
    });
    const itc = await state.addTestCase({
      type: '集成测试', title: 't', description: 'd', steps: [], expectedResult: 'r',
      priority: '高', requirementId: req.id,
    });
    const st = await state.addTestCase({
      type: '系统测试', title: 't', description: 'd', steps: [], expectedResult: 'r',
      priority: '高', requirementId: req.id,
    });
    await state.updateRequirement(req.id, {
      testCases: [uat.id, ut.id, itc.id, st.id],
    });
    await state.updateDesign(design.id, {
      testCases: [uat.id],
    });
    await state.updateTestCaseStatus(ut.id, '通过');
    await state.updateTestCaseStatus(itc.id, '通过');
    await state.updateTestCaseStatus(st.id, '通过');
    await state.updateTestCaseStatus(uat.id, '通过');

    await rtm.rebuild();
    expect(rtm.getCoveragePercent()).toBe(100);
  });
});

describe('RTMManager - 质量门', () => {
  it('空项目 → 未通过（无用例）', async () => {
    const { state, rtm } = await setupProject();
    await rtm.rebuild();
    const gate = rtm.isQualityGatePassed();
    expect(gate.passed).toBe(false);
    expect(gate.reasons.some(r => r.includes('无用例'))).toBe(true);
  });

  it('有用例但有失败 → 未通过', async () => {
    const { state, rtm } = await setupProject();
    await state.addRequirement({
      title: 'r', description: 'd', type: '功能需求', priority: '中', acceptanceCriteria: [], testCases: [],
    });
    const ut = await state.addTestCase({
      type: '单元测试', title: 't', description: 'd', steps: [], expectedResult: 'r', priority: '中',
    });
    await state.updateTestCaseStatus(ut.id, '失败');
    await rtm.rebuild();
    const gate = rtm.isQualityGatePassed();
    expect(gate.passed).toBe(false);
    expect(gate.reasons.some(r => r.includes('失败'))).toBe(true);
  });
});

describe('RTMManager - Markdown 导出', () => {
  it('toMarkdown 包含核心节', async () => {
    const { state, rtm } = await setupProject();
    await state.addRequirement({
      title: '需求A', description: 'd', type: '功能需求', priority: '高', acceptanceCriteria: [], testCases: [],
    });
    await rtm.rebuild();
    const md = rtm.toMarkdown();
    expect(md).toContain('# 需求跟踪矩阵');
    expect(md).toContain('## 项目信息');
    expect(md).toContain('## 跟踪矩阵');
    expect(md).toContain('需求A');
    expect(md).toContain('## 测试执行状态汇总');
  });

  it('exportMarkdown 写入文件', async () => {
    const { state, rtm } = await setupProject();
    await state.addRequirement({
      title: '需求A', description: 'd', type: '功能需求', priority: '高', acceptanceCriteria: [], testCases: [],
    });
    await rtm.rebuild();
    const file = path.join(tmpDir, 'rtm.md');
    await rtm.exportMarkdown(file);
    const content = await fs.readFile(file, 'utf-8');
    expect(content).toContain('# 需求跟踪矩阵');
  });
});

describe('RTMManager - logChange', () => {
  it('变更日志被记录', async () => {
    const { state, rtm } = await setupProject();
    await rtm.rebuild();
    await rtm.logChange('新增需求', ['REQ-001'], 'tester');
    const m = rtm.getMatrix();
    expect(m.changeLog).toHaveLength(1);
    expect(m.changeLog[0].change).toBe('新增需求');
    expect(m.changeLog[0].operator).toBe('tester');
  });
});
