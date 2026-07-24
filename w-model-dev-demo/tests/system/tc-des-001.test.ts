/**
 * TC-DES-001: 架构设计验证
 *
 * 验证系统架构设计落地——分层结构（controller→service→store）+ 6 子系统跨切面
 * + SD-006 治理关系 + 数据流闭环 + 无循环依赖 + TS strict 0 错误。
 *
 * 关联需求/设计：NFR-005 / SD-001~006 全部 / system-design.md §1 §3
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = resolve(__dirname, '../..');
const SRC_DIR = join(PROJECT_ROOT, 'src');

describe('TC-DES-001: 架构设计验证', () => {

  describe('步骤1: 目录结构存在性', () => {
    it('5 个核心目录均存在（controllers/services/stores/middlewares/utils）', () => {
      // services/stores/middlewares/utils 在 src 下；controller 由 app.ts 充当
      const expectedDirs = [
        'services',
        'stores',
        'middleware',
        'utils',
        'infrastructure',
      ];
      for (const dir of expectedDirs) {
        const fullPath = join(SRC_DIR, dir);
        expect(existsSync(fullPath)).toBe(true);
      }
    });

    it('app.ts 作为 controller 层入口存在', () => {
      expect(existsSync(join(SRC_DIR, 'app.ts'))).toBe(true);
    });

    it('container.ts 依赖注入容器存在', () => {
      expect(existsSync(join(SRC_DIR, 'container.ts'))).toBe(true);
    });
  });

  describe('步骤2: 分层调用方向（controller 不直接调用 store）', () => {
    it('app.ts 仅通过 container 引用 service，不直接 import store', () => {
      const appContent = readFileSync(join(SRC_DIR, 'app.ts'), 'utf-8');
      // app.ts 不应直接从 stores 目录 import（应通过 container 获取 service）
      const directStoreImport = /from\s+['"]\.\/stores\//.test(appContent);
      expect(directStoreImport).toBe(false);
    });

    it('controller 层通过 c.xxxService 调用 service', () => {
      const appContent = readFileSync(join(SRC_DIR, 'app.ts'), 'utf-8');
      expect(appContent).toContain('getContainer()');
      expect(appContent).toContain('c.userService');
      expect(appContent).toContain('c.articleService');
      expect(appContent).toContain('c.commentService');
    });
  });

  describe('步骤3: 6 子系统目录存在', () => {
    it('identity / content / interaction / operation / discovery / infrastructure 6 子目录均存在', () => {
      const expectedSubsystems = [
        'services/identity',
        'services/content',
        'services/interaction',
        'services/operation',
        'services/discovery',
        'infrastructure',
      ];
      for (const sub of expectedSubsystems) {
        expect(existsSync(join(SRC_DIR, sub))).toBe(true);
      }
    });
  });

  describe('步骤4: SD-006 governance（基础设施子系统被其他子系统依赖）', () => {
    it('infrastructure 提供 WAL + Audit 能力供其他子系统使用', () => {
      const infraFiles = readdirSync(join(SRC_DIR, 'infrastructure'));
      expect(infraFiles.some(f => f.includes('wal'))).toBe(true);
      expect(infraFiles.some(f => f.includes('audit'))).toBe(true);

      // 验证 service 文件引用了 infrastructure
      const serviceFiles = readdirSync(join(SRC_DIR, 'services'), { recursive: true })
        .filter(f => String(f).endsWith('.ts'));
      const importInfraCount = serviceFiles.filter(f => {
        const content = readFileSync(join(SRC_DIR, 'services', String(f)), 'utf-8');
        return /from\s+['"].*infrastructure\//.test(content);
      }).length;
      expect(importInfraCount).toBeGreaterThan(0);
    });
  });

  describe('步骤5: 无循环依赖（基础检测）', () => {
    it('container.ts 依赖图无自引用循环', () => {
      const containerContent = readFileSync(join(SRC_DIR, 'container.ts'), 'utf-8');
      // container 不应 import 自身
      expect(containerContent).not.toMatch(/from\s+['"]\.\/container\.js['"]/);
    });

    it('service 层不直接 import container（避免循环依赖）', () => {
      const serviceFiles = readdirSync(join(SRC_DIR, 'services'), { recursive: true })
        .filter(f => String(f).endsWith('.ts'));
      for (const f of serviceFiles) {
        const content = readFileSync(join(SRC_DIR, 'services', String(f)), 'utf-8');
        // service 不应从 container import getContainer（应通过依赖注入）
        expect(content).not.toMatch(/from\s+['"].*container\.js['"]/);
      }
    });
  });

  describe('步骤6: 数据流闭环（EXT-IN→controller→service→store→EXT-OUT）', () => {
    it('请求入口（app.ts 路由）→ service → store 链路完整', () => {
      const appContent = readFileSync(join(SRC_DIR, 'app.ts'), 'utf-8');
      // EXT-IN: app.post/get 定义路由
      expect(appContent).toMatch(/app\.(post|get|patch|delete)\s*\(\s*['"]\/api\//);
      // service 调用 store: service 文件直接 import store
      const articleServiceContent = readFileSync(join(SRC_DIR, 'services/content/article-service.ts'), 'utf-8');
      expect(articleServiceContent).toMatch(/from\s+['"].*article-store/);
      const userServiceContent = readFileSync(join(SRC_DIR, 'services/identity/user-service.ts'), 'utf-8');
      expect(userServiceContent).toMatch(/from\s+['"].*user-store/);
      // EXT-OUT: res.json/res.status 返回响应
      expect(appContent).toMatch(/res\.(json|status|send)/);
    });
  });

  describe('步骤7: TS strict 编译', () => {
    it('tsc --noEmit 退出码 0，0 错误', () => {
      // 使用 execSync 运行 tsc --noEmit
      let exitCode = 0;
      let stderr = '';
      try {
        execSync('npx tsc --noEmit', {
          cwd: PROJECT_ROOT,
          stdio: 'pipe',
          timeout: 60_000,
        });
      } catch (e) {
        exitCode = (e as { status?: number }).status ?? 1;
        stderr = String((e as { stderr?: Buffer }).stderr ?? '');
      }
      expect(exitCode).toBe(0);
      expect(stderr).not.toContain('error TS');
    }, 90_000);
  });
});
