/**
 * RTM (Requirements Traceability Matrix) 自动更新管理器
 *
 * 解决 issue Critical #2 + Medium #1：
 *   - RTM 在多轮交互中如何维护？
 *   - RTM 自动化支持
 *
 * 设计：
 * - 监听 ProjectStateManager 的实体变化，自动维护 RTM 矩阵
 * - 双向追溯：需求 ↔ 设计 ↔ 代码 ↔ 四级测试用例
 * - 自动覆盖率统计与告警
 * - 持久化为 `.w-model/rtm.json`，可导出为 Markdown（套用 templates/rtm.md）
 *
 * 对应 SSoT：第 9 章 RTM；references/rtm-guide.md
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  RTMMatrix,
  RTMRow,
  TestCase,
  TestCaseType,
} from '../types';
import type { ProjectStateManager, ProjectStore } from './project-state';
// 门禁判定逻辑委托至技能包内脚本（单点事实源，与 CLI check-artifact-gate.ts 共用）
import { checkArtifactGate } from '../../w-model-dev/scripts/gate-logic.js';

const DEFAULT_RTM_DIR = '.w-model';

export class RTMManager {
  private matrix: RTMMatrix | null = null;
  private readonly rtmFile: string;
  private readonly stateManager: ProjectStateManager;

  constructor(cwd: string, stateManager: ProjectStateManager, rtmDir: string = DEFAULT_RTM_DIR) {
    this.rtmFile = path.join(cwd, rtmDir, 'rtm.json');
    this.stateManager = stateManager;
  }

  // ==================== 生命周期 ====================

  async load(): Promise<RTMMatrix | null> {
    if (this.matrix) return this.matrix;
    try {
      const raw = await fs.readFile(this.rtmFile, 'utf-8');
      this.matrix = JSON.parse(raw) as RTMMatrix;
      return this.matrix;
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') return null;
      throw err;
    }
  }

  async persist(): Promise<void> {
    if (!this.matrix) throw new Error('RTM 未初始化');
    await fs.mkdir(path.dirname(this.rtmFile), { recursive: true });
    await fs.writeFile(this.rtmFile, JSON.stringify(this.matrix, null, 2), 'utf-8');
  }

  /** 基于 ProjectStore 重建 / 同步 RTM（全量重算，幂等） */
  async rebuild(): Promise<RTMMatrix> {
    const store = await this.stateManager.load();
    if (!store) throw new Error('项目未初始化，无法重建 RTM');

    const rows = this.buildRows(store);
    const executionSummary = this.buildExecutionSummary(store.testCases);

    if (!this.matrix) {
      this.matrix = {
        projectName: store.project.name,
        lastUpdated: new Date().toISOString(),
        currentPhase: store.project.status,
        rows,
        executionSummary,
        changeLog: [],
      };
    } else {
      this.matrix.projectName = store.project.name;
      this.matrix.currentPhase = store.project.status;
      this.matrix.lastUpdated = new Date().toISOString();
      this.matrix.rows = rows;
      this.matrix.executionSummary = executionSummary;
    }

    await this.persist();
    return this.matrix;
  }

  /** 记录变更日志（需求 / 设计变更时调用） */
  async logChange(change: string, affectedRequirements: string[], operator = 'system'): Promise<void> {
    if (!this.matrix) {
      await this.rebuild();
    }
    this.matrix!.changeLog.push({
      date: new Date().toISOString(),
      change,
      affectedRequirements,
      operator,
    });
    await this.persist();
  }

  getMatrix(): RTMMatrix {
    if (!this.matrix) throw new Error('RTM 未加载');
    return this.matrix;
  }

  // ==================== 覆盖率分析 ====================

  /** 整体覆盖率（需求维度） */
  getCoveragePercent(): number {
    if (!this.matrix || this.matrix.rows.length === 0) return 0;
    const total = this.matrix.rows.length;
    const covered = this.matrix.rows.filter(r => r.coverageStatus === '100%').length;
    return Math.round((covered / total) * 100);
  }

  /** 缺失列统计（用于质量门检查） */
  getMissingColumns(): Array<{ requirementId: string; missing: string[] }> {
    if (!this.matrix) return [];
    const result: Array<{ requirementId: string; missing: string[] }> = [];
    for (const row of this.matrix.rows) {
      const missing: string[] = [];
      if (!row.designDoc) missing.push('设计文档');
      if (!row.codeModule) missing.push('代码模块');
      if (!row.unitTest) missing.push('单元测试');
      if (!row.integrationTest) missing.push('集成测试');
      if (!row.systemTest) missing.push('系统测试');
      if (!row.acceptanceTest) missing.push('验收测试');
      if (missing.length > 0) {
        result.push({ requirementId: row.requirementId, missing });
      }
    }
    return result;
  }

  /**
   * 是否通过质量门：覆盖率 100% 且所有测试通过。
   *
   * 判定逻辑委托至技能包内脚本 `w-model-dev/scripts/gate-logic.ts` 的
   * `checkArtifactGate()`，与 CLI `check-artifact-gate.ts` 共用同一份事实源，
   * 避免逻辑漂移。返回值仅保留 { passed, reasons }，覆盖率字段由
   * `getCoveragePercent()` 单独暴露。
   */
  isQualityGatePassed(): { passed: boolean; reasons: string[] } {
    const result = checkArtifactGate(this.matrix);
    return { passed: result.passed, reasons: result.reasons };
  }

  // ==================== Markdown 导出 ====================

  /** 导出为 Markdown（套用 templates/rtm.md 格式） */
  toMarkdown(): string {
    if (!this.matrix) throw new Error('RTM 未加载');

    const m = this.matrix;
    const lines: string[] = [];

    lines.push('# 需求跟踪矩阵（RTM）');
    lines.push('');
    lines.push('## 项目信息');
    lines.push('');
    lines.push(`- 项目名称：${m.projectName}`);
    lines.push(`- 最后更新：${m.lastUpdated.slice(0, 10)}`);
    lines.push(`- 当前阶段：${m.currentPhase}`);
    lines.push(`- 整体覆盖率：${this.getCoveragePercent()}%`);
    lines.push('');

    lines.push('## 跟踪矩阵');
    lines.push('');
    lines.push('| 需求 ID | 需求描述 | 设计文档 | 代码模块 | 单元测试 | 集成测试 | 系统测试 | 验收测试 | 覆盖状态 |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const row of m.rows) {
      lines.push([
        row.requirementId,
        row.requirementDescription,
        row.designDoc ?? '—',
        row.codeModule ?? '—',
        row.unitTest ?? '—',
        row.integrationTest ?? '—',
        row.systemTest ?? '—',
        row.acceptanceTest ?? '—',
        row.coverageStatus,
      ].join(' | '));
    }
    lines.push('');

    lines.push('## 测试执行状态汇总');
    lines.push('');
    lines.push('| 测试类型 | 用例数 | 通过 | 失败 | 待执行 | 覆盖率 |');
    lines.push('|---|---|---|---|---|---|');
    const s = m.executionSummary;
    lines.push(`| 单元测试 | ${s.unitTest.total} | ${s.unitTest.passed} | ${s.unitTest.failed} | ${s.unitTest.pending} | ${s.unitTest.coverage}% |`);
    lines.push(`| 集成测试 | ${s.integrationTest.total} | ${s.integrationTest.passed} | ${s.integrationTest.failed} | ${s.integrationTest.pending} | ${s.integrationTest.coverage}% |`);
    lines.push(`| 系统测试 | ${s.systemTest.total} | ${s.systemTest.passed} | ${s.systemTest.failed} | ${s.systemTest.pending} | ${s.systemTest.coverage}% |`);
    lines.push(`| 验收测试 | ${s.acceptanceTest.total} | ${s.acceptanceTest.passed} | ${s.acceptanceTest.failed} | ${s.acceptanceTest.pending} | ${s.acceptanceTest.coverage}% |`);
    lines.push('');

    lines.push('## 覆盖率检查');
    lines.push('');
    const missing = this.getMissingColumns();
    if (missing.length === 0) {
      lines.push('- [x] 所有需求均已完成全链路覆盖');
    } else {
      for (const m of missing) {
        lines.push(`- [ ] ${m.requirementId}: 缺失 ${m.missing.join('、')}`);
      }
    }
    lines.push('');

    if (m.changeLog.length > 0) {
      lines.push('## 变更记录');
      lines.push('');
      lines.push('| 日期 | 变更内容 | 影响需求 | 操作者 |');
      lines.push('|---|---|---|---|');
      for (const c of m.changeLog.slice(-10)) {
        lines.push(`| ${c.date.slice(0, 10)} | ${c.change} | ${c.affectedRequirements.join(', ')} | ${c.operator} |`);
      }
    }

    return lines.join('\n');
  }

  /** 将 Markdown 写入指定文件 */
  async exportMarkdown(filePath: string): Promise<void> {
    const md = this.toMarkdown();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, md, 'utf-8');
  }

  // ==================== 私有工具 ====================

  private buildRows(store: ProjectStore): RTMRow[] {
    return store.requirements.map(req => {
      // 找到与该需求关联的设计（通过 testCases 反查）
      const relatedDesigns = store.designs.filter(d =>
        d.testCases.some(tcId => req.testCases.includes(tcId))
      );

      // 找到与该需求关联的测试用例
      const relatedTestCases = store.testCases.filter(tc =>
        req.testCases.includes(tc.id) || tc.requirementId === req.id
      );

      const findByType = (type: TestCaseType) =>
        relatedTestCases.find(tc => tc.type === type)?.id;

      const designDoc = relatedDesigns[0]?.id;
      // 代码模块从单元测试描述中提取（简化实现，可扩展为显式登记）
      const codeModule = this.extractCodeModule(relatedTestCases);

      const row: RTMRow = {
        requirementId: req.id,
        requirementDescription: req.title,
        designDoc,
        codeModule,
        unitTest: findByType('单元测试'),
        integrationTest: findByType('集成测试'),
        systemTest: findByType('系统测试'),
        acceptanceTest: findByType('验收测试'),
        coverageStatus: '待覆盖',
      };

      row.coverageStatus = this.computeRowCoverage(row);
      return row;
    });
  }

  /** 简化的代码模块推断：从单元测试描述中提取文件路径（真实场景应显式登记） */
  private extractCodeModule(testCases: TestCase[]): string | undefined {
    for (const tc of testCases) {
      if (tc.type === '单元测试') {
        const match = tc.description.match(/[\w-]+\.(ts|js|py|go|java)/);
        if (match) return match[0];
      }
    }
    return undefined;
  }

  private computeRowCoverage(row: RTMRow): RTMRow['coverageStatus'] {
    const fields = [
      row.designDoc, row.codeModule, row.unitTest,
      row.integrationTest, row.systemTest, row.acceptanceTest,
    ];
    const filled = fields.filter(Boolean).length;
    if (filled === 6) return '100%';
    if (filled > 0) return '部分';
    return '待覆盖';
  }

  private buildExecutionSummary(testCases: TestCase[]): RTMMatrix['executionSummary'] {
    const build = (type: TestCaseType) => {
      const items = testCases.filter(t => t.type === type);
      const total = items.length;
      const passed = items.filter(t => t.status === '通过').length;
      const failed = items.filter(t => t.status === '失败').length;
      const pending = items.filter(t => t.status === '待执行').length;
      const coverage = total > 0 ? Math.round((passed / total) * 100) : 0;
      return { total, passed, failed, pending, coverage };
    };

    return {
      unitTest: build('单元测试'),
      integrationTest: build('集成测试'),
      systemTest: build('系统测试'),
      acceptanceTest: build('验收测试'),
    };
  }
}
