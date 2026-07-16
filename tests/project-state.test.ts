/**
 * ProjectStateManager 单元测试
 *
 * 覆盖：
 *   - init / load / persist / destroy 生命周期
 *   - advanceTo 阶段推进（含合法性校验）
 *   - 需求 / 设计 / 测试用例 CRUD
 *   - 测试用例 ID 自动生成（前缀规则）
 *   - 反向关联（requirement.testCases）
 *   - exportJSON / importJSON
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';
import { ProjectStateManager } from '../src/state/project-state.js';
import type { ProjectStore } from '../src/state/project-state.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('ProjectStateManager - 生命周期', () => {
  it('init 创建项目并可加载', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('测试项目', '描述', {
      frontend: ['React'],
      backend: ['Node.js'],
      database: ['SQLite'],
      others: [],
    });

    const reloaded = await new ProjectStateManager(tmpDir).load();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.project.name).toBe('测试项目');
    expect(reloaded!.project.status).toBe('需求分析');
    expect(reloaded!.project.techStack.frontend).toEqual(['React']);
  });

  it('load 未初始化返回 null', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    const result = await mgr.load();
    expect(result).toBeNull();
  });

  it('destroy 删除状态文件', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await mgr.destroy();

    const reloaded = await new ProjectStateManager(tmpDir).load();
    expect(reloaded).toBeNull();
  });
});

describe('ProjectStateManager - 阶段推进', () => {
  it('应允许相邻阶段推进', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await mgr.advanceTo('系统设计');
    expect(mgr.getProject().status).toBe('系统设计');
    await mgr.advanceTo('概要设计');
    expect(mgr.getProject().status).toBe('概要设计');
  });

  it('应禁止跨越阶段推进', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await expect(mgr.advanceTo('编码')).rejects.toThrow(/不允许跨越阶段/);
  });

  it('应允许回退阶段（返工）', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await mgr.advanceTo('系统设计');
    await mgr.advanceTo('需求分析'); // 回退
    expect(mgr.getProject().status).toBe('需求分析');
  });

  it('未知阶段应抛错', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await expect(mgr.advanceTo('未知阶段' as never)).rejects.toThrow(/未知/);
  });

  it('getProgress 返回正确百分比', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    expect(mgr.getProgress().percent).toBe(13); // 1/8 ≈ 13%
    await mgr.advanceTo('系统设计');
    expect(mgr.getProgress().percent).toBe(25); // 2/8
    // 严格按 W 模型阶段顺序推进，不允许跨越
    await mgr.advanceTo('概要设计');
    await mgr.advanceTo('详细设计');
    await mgr.advanceTo('编码');
    await mgr.advanceTo('集成测试');
    await mgr.advanceTo('系统测试');
    await mgr.advanceTo('验收测试');
    expect(mgr.getProgress().percent).toBe(100);
  });
});

describe('ProjectStateManager - 需求 CRUD', () => {
  it('addRequirement 自动生成 ID', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    const r1 = await mgr.addRequirement({
      title: '需求1',
      description: '描述',
      type: '功能需求',
      priority: '高',
      acceptanceCriteria: [],
      testCases: [],
    });
    const r2 = await mgr.addRequirement({
      title: '需求2',
      description: '描述',
      type: '功能需求',
      priority: '中',
      acceptanceCriteria: [],
      testCases: [],
    });
    expect(r1.id).toBe('REQ-001');
    expect(r2.id).toBe('REQ-002');
    expect(mgr.getRequirements()).toHaveLength(2);
  });

  it('updateRequirement 修改需求', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    const r = await mgr.addRequirement({
      title: '原始',
      description: 'd',
      type: '功能需求',
      priority: '中',
      acceptanceCriteria: [],
      testCases: [],
    });
    const updated = await mgr.updateRequirement(r.id, { title: '已修改', status: '已完成' });
    expect(updated.title).toBe('已修改');
    expect(updated.status).toBe('已完成');
  });

  it('updateRequirement 不存在时抛错', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await expect(mgr.updateRequirement('REQ-999', {})).rejects.toThrow(/不存在/);
  });
});

describe('ProjectStateManager - 测试用例 ID 生成', () => {
  it('按类型生成前缀', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    const ut = await mgr.addTestCase({
      type: '单元测试',
      title: 't',
      description: 'd',
      steps: [],
      expectedResult: 'r',
      priority: '中',
    });
    const it_ = await mgr.addTestCase({
      type: '集成测试',
      title: 't',
      description: 'd',
      steps: [],
      expectedResult: 'r',
      priority: '中',
    });
    const st = await mgr.addTestCase({
      type: '系统测试',
      title: 't',
      description: 'd',
      steps: [],
      expectedResult: 'r',
      priority: '中',
    });
    const uat = await mgr.addTestCase({
      type: '验收测试',
      title: 't',
      description: 'd',
      steps: [],
      expectedResult: 'r',
      priority: '中',
    });
    expect(ut.id).toBe('UT-001');
    expect(it_.id).toBe('IT-001');
    expect(st.id).toBe('ST-001');
    expect(uat.id).toBe('UAT-001');
  });

  it('反向关联到需求与设计', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    const req = await mgr.addRequirement({
      title: 'r', description: 'd', type: '功能需求', priority: '中', acceptanceCriteria: [], testCases: [],
    });
    const design = await mgr.addDesign({
      type: '系统设计', content: 'c', diagrams: [], testCases: [],
    });
    const tc = await mgr.addTestCase({
      type: '验收测试',
      title: 't', description: 'd', steps: [], expectedResult: 'r', priority: '中',
      requirementId: req.id,
      designId: design.id,
    });
    expect(mgr.getRequirement(req.id)!.testCases).toContain(tc.id);
    expect(mgr.getDesign(design.id)!.testCases).toContain(tc.id);
  });
});

describe('ProjectStateManager - 导入导出', () => {
  it('exportJSON / importJSON 往返一致', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await mgr.addRequirement({
      title: 'r', description: 'd', type: '功能需求', priority: '中', acceptanceCriteria: [], testCases: [],
    });

    const json = mgr.exportJSON();
    expect(json).toContain('REQ-001');

    // 在新目录导入
    const newDir = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-import-'));
    try {
      const mgr2 = new ProjectStateManager(newDir);
      const store = await mgr2.importJSON(json);
      expect(store.project.name).toBe('p');
      expect(store.requirements).toHaveLength(1);
      expect(store.requirements[0].id).toBe('REQ-001');
    } finally {
      await fs.rm(newDir, { recursive: true, force: true });
    }
  });

  it('importJSON 无效 JSON 抛错', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await expect(mgr.importJSON('{invalid}')).rejects.toThrow();
  });
});

describe('ProjectStateManager - reset', () => {
  it('reset 清空实体并回到需求分析', async () => {
    const mgr = new ProjectStateManager(tmpDir);
    await mgr.init('p', 'd');
    await mgr.addRequirement({
      title: 'r', description: 'd', type: '功能需求', priority: '中', acceptanceCriteria: [], testCases: [],
    });
    await mgr.advanceTo('系统设计');

    await mgr.reset();
    expect(mgr.getProject().status).toBe('需求分析');
    expect(mgr.getRequirements()).toHaveLength(0);
  });
});

describe('ProjectStateManager - createInMemory', () => {
  it('内存模式不落盘', async () => {
    const store: ProjectStore = {
      project: {
        id: 'PROJ-mem',
        name: 'mem',
        description: 'd',
        status: '需求分析',
        techStack: { frontend: [], backend: [], database: [], others: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      requirements: [],
      designs: [],
      testCases: [],
    };
    const mgr = ProjectStateManager.createInMemory(store);
    expect(mgr.getProject().id).toBe('PROJ-mem');
  });
});
