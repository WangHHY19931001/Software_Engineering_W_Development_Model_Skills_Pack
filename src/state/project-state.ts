/**
 * 项目状态管理器
 *
 * 解决 issue Critical #2：状态持久化与多轮交互中 RTM 数据维护缺失。
 *
 * 设计：
 * - 持久化介质：JSON 文件（默认 `.w-model/project.json`）
 * - 内存缓存 + 写入时同步落盘
 * - 阶段切换时自动更新 `status` 与 `updatedAt`
 * - 支持多实体管理：需求 / 设计 / 测试用例
 *
 * 对应 SSoT：第 7 章 数据模型；SKILL.md 第 4 节 数据与状态管理
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  Design,
  Project,
  ProjectPhase,
  Requirement,
  TestCase,
} from '../types';

export interface ProjectStore {
  project: Project;
  requirements: Requirement[];
  designs: Design[];
  testCases: TestCase[];
}

const DEFAULT_STATE_DIR = '.w-model';

export class ProjectStateManager {
  private store: ProjectStore | null = null;
  private readonly stateFile: string;

  constructor(cwd: string, stateDir: string = DEFAULT_STATE_DIR) {
    this.stateFile = path.join(cwd, stateDir, 'project.json');
  }

  // ==================== 生命周期 ====================

  /** 初始化新项目 */
  async init(
    name: string,
    description: string,
    techStack: Project['techStack'] = { frontend: [], backend: [], database: [], others: [] }
  ): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: `PROJ-${Date.now()}`,
      name,
      description,
      status: '需求分析',
      techStack,
      createdAt: now,
      updatedAt: now,
    };
    this.store = {
      project,
      requirements: [],
      designs: [],
      testCases: [],
    };
    await this.persist();
    return project;
  }

  /** 从磁盘加载 */
  async load(): Promise<ProjectStore | null> {
    if (this.store) return this.store;
    try {
      const raw = await fs.readFile(this.stateFile, 'utf-8');
      this.store = JSON.parse(raw) as ProjectStore;
      return this.store;
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** 持久化到磁盘 */
  async persist(): Promise<void> {
    if (!this.store) throw new Error('未初始化项目，无法持久化');
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  /** 重置项目状态（保留项目元信息，清空实体） */
  async reset(): Promise<void> {
    if (!this.store) return;
    this.store.requirements = [];
    this.store.designs = [];
    this.store.testCases = [];
    this.store.project.status = '需求分析';
    this.store.project.updatedAt = new Date().toISOString();
    await this.persist();
  }

  /** 销毁项目（删除状态文件） */
  async destroy(): Promise<void> {
    this.store = null;
    try {
      await fs.unlink(this.stateFile);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') throw err;
    }
  }

  // ==================== 项目状态 ====================

  getProject(): Project {
    this.ensureLoaded();
    return this.store!.project;
  }

  /** 转移到下一阶段（含 W 模型合法性校验） */
  async advanceTo(phase: ProjectPhase): Promise<Project> {
    this.ensureLoaded();
    const order: ProjectPhase[] = [
      '需求分析', '系统设计', '概要设计', '详细设计',
      '编码', '集成测试', '系统测试', '验收测试',
    ];
    const currentIdx = order.indexOf(this.store!.project.status);
    const targetIdx = order.indexOf(phase);
    if (targetIdx < 0) {
      throw new Error(`未知的阶段: ${phase}`);
    }
    // 允许回退（评审不通过返工），但禁止跨越多个阶段前进
    if (targetIdx > currentIdx + 1) {
      throw new Error(
        `不允许跨越阶段推进: ${this.store!.project.status} → ${phase}`
      );
    }
    this.store!.project.status = phase;
    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return this.store!.project;
  }

  /** 获取进度百分比 */
  getProgress(): { phase: ProjectPhase; index: number; total: number; percent: number } {
    this.ensureLoaded();
    const order: ProjectPhase[] = [
      '需求分析', '系统设计', '概要设计', '详细设计',
      '编码', '集成测试', '系统测试', '验收测试',
    ];
    const index = order.indexOf(this.store!.project.status);
    return {
      phase: this.store!.project.status,
      index,
      total: order.length,
      percent: Math.round(((index + 1) / order.length) * 100),
    };
  }

  // ==================== 需求管理 ====================

  async addRequirement(req: Omit<Requirement, 'id' | 'projectId' | 'status'> & { id?: string }): Promise<Requirement> {
    this.ensureLoaded();
    const requirement: Requirement = {
      id: req.id ?? `REQ-${String(this.store!.requirements.length + 1).padStart(3, '0')}`,
      projectId: this.store!.project.id,
      title: req.title,
      description: req.description,
      type: req.type,
      priority: req.priority,
      acceptanceCriteria: req.acceptanceCriteria,
      testCases: req.testCases ?? [],
      status: '待开发',
    };
    this.store!.requirements.push(requirement);
    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return requirement;
  }

  getRequirements(): Requirement[] {
    this.ensureLoaded();
    return [...this.store!.requirements];
  }

  getRequirement(id: string): Requirement | undefined {
    this.ensureLoaded();
    return this.store!.requirements.find(r => r.id === id);
  }

  async updateRequirement(id: string, patch: Partial<Requirement>): Promise<Requirement> {
    this.ensureLoaded();
    const idx = this.store!.requirements.findIndex(r => r.id === id);
    if (idx < 0) throw new Error(`需求不存在: ${id}`);
    this.store!.requirements[idx] = { ...this.store!.requirements[idx], ...patch };
    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return this.store!.requirements[idx];
  }

  // ==================== 设计管理 ====================

  async addDesign(design: Omit<Design, 'id' | 'projectId' | 'createdAt'> & { id?: string }): Promise<Design> {
    this.ensureLoaded();
    const d: Design = {
      id: design.id ?? `DESIGN-${String(this.store!.designs.length + 1).padStart(3, '0')}`,
      projectId: this.store!.project.id,
      type: design.type,
      content: design.content,
      diagrams: design.diagrams,
      testCases: design.testCases ?? [],
      createdAt: new Date().toISOString(),
    };
    this.store!.designs.push(d);
    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return d;
  }

  getDesigns(type?: Design['type']): Design[] {
    this.ensureLoaded();
    return type
      ? this.store!.designs.filter(d => d.type === type)
      : [...this.store!.designs];
  }

  getDesign(id: string): Design | undefined {
    this.ensureLoaded();
    return this.store!.designs.find(d => d.id === id);
  }

  async updateDesign(id: string, patch: Partial<Design>): Promise<Design> {
    this.ensureLoaded();
    const idx = this.store!.designs.findIndex(d => d.id === id);
    if (idx < 0) throw new Error(`设计不存在: ${id}`);
    this.store!.designs[idx] = { ...this.store!.designs[idx], ...patch };
    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return this.store!.designs[idx];
  }

  // ==================== 测试用例管理 ====================

  async addTestCase(tc: Omit<TestCase, 'id' | 'projectId' | 'status'> & { id?: string }): Promise<TestCase> {
    this.ensureLoaded();
    const testCase: TestCase = {
      id: tc.id ?? this.generateTestCaseId(tc.type),
      projectId: this.store!.project.id,
      type: tc.type,
      title: tc.title,
      description: tc.description,
      steps: tc.steps,
      expectedResult: tc.expectedResult,
      status: '待执行',
      priority: tc.priority,
      requirementId: tc.requirementId,
      designId: tc.designId,
    };
    this.store!.testCases.push(testCase);

    // 反向登记到需求 / 设计
    if (tc.requirementId) {
      const req = this.store!.requirements.find(r => r.id === tc.requirementId);
      if (req && !req.testCases.includes(testCase.id)) {
        req.testCases.push(testCase.id);
      }
    }
    if (tc.designId) {
      const design = this.store!.designs.find(d => d.id === tc.designId);
      if (design && !design.testCases.includes(testCase.id)) {
        design.testCases.push(testCase.id);
      }
    }

    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return testCase;
  }

  getTestCases(type?: TestCase['type']): TestCase[] {
    this.ensureLoaded();
    return type
      ? this.store!.testCases.filter(t => t.type === type)
      : [...this.store!.testCases];
  }

  async updateTestCaseStatus(id: string, status: TestCase['status']): Promise<TestCase> {
    this.ensureLoaded();
    const idx = this.store!.testCases.findIndex(t => t.id === id);
    if (idx < 0) throw new Error(`测试用例不存在: ${id}`);
    this.store!.testCases[idx].status = status;
    this.store!.project.updatedAt = new Date().toISOString();
    await this.persist();
    return this.store!.testCases[idx];
  }

  // ==================== 导出 / 导入 ====================

  /** 导出完整 store 为 JSON 字符串 */
  exportJSON(): string {
    this.ensureLoaded();
    return JSON.stringify(this.store, null, 2);
  }

  /** 从 JSON 字符串导入 */
  async importJSON(json: string): Promise<ProjectStore> {
    const parsed = JSON.parse(json) as ProjectStore;
    if (!parsed.project || !parsed.project.id) {
      throw new Error('无效的项目 JSON：缺少 project 字段');
    }
    this.store = parsed;
    await this.persist();
    return this.store;
  }

  // ==================== 私有工具 ====================

  private ensureLoaded(): void {
    if (!this.store) {
      throw new Error('项目未加载，请先调用 init() 或 load()');
    }
  }

  private generateTestCaseId(type: TestCase['type']): string {
    const prefix = type === '验收测试' ? 'UAT'
      : type === '系统测试' ? 'ST'
      : type === '集成测试' ? 'IT'
      : 'UT';
    const existing = this.store!.testCases.filter(t => t.id.startsWith(prefix)).length;
    return `${prefix}-${String(existing + 1).padStart(3, '0')}`;
  }

  /** 仅供测试：直接注入内存 store（不落盘） */
  static createInMemory(store: ProjectStore): ProjectStateManager {
    const mgr = Object.create(ProjectStateManager.prototype) as ProjectStateManager;
    (mgr as unknown as { store: ProjectStore }).store = store;
    return mgr;
  }
}
