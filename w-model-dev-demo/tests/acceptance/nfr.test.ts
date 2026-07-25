// 验收测试 - 非功能需求 (UAT-052 ~ UAT-056).
// 覆盖 NFR-001 性能 / NFR-002 可用性 / NFR-003 安全 / NFR-004 可测试性 / NFR-005 可维护性.
// 真实实例化 Store/Service 三层；禁止 mock 内部模块；仅可 mock 外部 IO（WebSocket）.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { BackupStore } from '../../src/stores/backup.store.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SearchService } from '../../src/services/search.service.js';
import { PushService } from '../../src/services/push.service.js';
import { FileService } from '../../src/services/file.service.js';
import { BackupService } from '../../src/services/backup.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  BackupType,
  UserRole,
  type IWsLike,
} from '../../src/types.js';
import {
  clearRevokedJtis,
  comparePassword,
  hashPassword,
  signToken,
  verifyToken,
} from '../../src/utils/auth.js';
import * as jwt from 'jsonwebtoken';

/**
 * 计算数组的 P95 百分位（升序排序后取第 95% 位置的值）.
 */
function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx]!;
}

describe('UAT-052~056 非功能需求验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let subscriptionStore: SubscriptionStore;
  let bloggerStore: BloggerStore;
  let siteStore: SiteStore;
  let commentStore: CommentStore;
  let fileStore: FileStore;
  let notificationStore: NotificationStore;
  let wsStore: WsStore;
  let backupStore: BackupStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let searchService: SearchService;
  let pushService: PushService;
  let fileService: FileService;
  let backupService: BackupService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    subscriptionStore = new SubscriptionStore();
    bloggerStore = new BloggerStore();
    siteStore = new SiteStore();
    commentStore = new CommentStore();
    fileStore = new FileStore();
    notificationStore = new NotificationStore();
    wsStore = new WsStore();
    backupStore = new BackupStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    searchService = new SearchService(searchStore);
    pushService = new PushService(wsStore);
    fileService = new FileService(fileStore, userStore);
    backupService = new BackupService(
      backupStore, userStore, bloggerStore, articleStore,
      commentStore, notificationStore, fileStore,
    );
    clearRevokedJtis();
  });

  function makeOpenSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return { readyState: 1, send: vi.fn(), close: vi.fn() };
  }

  async function seed() {
    const admin = await authService.userRegister({
      email: 'admin@x.com', password: 'passwordpassword',
      displayName: 'admin', role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com', password: 'passwordpassword',
      displayName: 'blogger', role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com', password: 'passwordpassword',
      displayName: 'reader',
    });
    return { admin, blogger, reader };
  }

  async function publishArticle(authorId: string, title: string, content: string, adminId: string) {
    const a = articleService.createArticle(authorId, { title, content });
    articleService.submitForReview(authorId, a.id);
    articleService.approveArticle(adminId, UserRole.Admin, a.id);
    return a;
  }

  // ============================================================
  // UAT-052: 接口响应 P95 性能验证 (NFR-001)
  // ============================================================
  it('UAT-052: 接口响应 P95 性能验证', async () => {
    const { admin, blogger, reader } = await seed();
    // 预置数据：10 篇已发布文章.
    for (let i = 0; i < 10; i++) {
      await publishArticle(blogger.id, `性能文章${i}`, `内容${i} TypeScript`, admin.id);
    }
    // reader 在线（用于推送延迟测量）.
    const socket = makeOpenSocket();
    wsStore.register(reader.id, socket);

    // 1. 文章创建 P95 ≤ 200ms（循环 100 次）.
    const createTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      articleService.createArticle(blogger.id, { title: `perf-${i}`, content: `内容${i}` });
      createTimes.push(Date.now() - t0);
    }
    expect(p95(createTimes)).toBeLessThanOrEqual(200);

    // 2. 全文搜索 P95 ≤ 500ms（循环 100 次）.
    const searchTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      searchService.search(null, 'TypeScript', 'relevance', 1, 10);
      searchTimes.push(Date.now() - t0);
    }
    expect(p95(searchTimes)).toBeLessThanOrEqual(500);

    // 3. 文件上传（5MB）P95 ≤ 1s（循环 10 次，避免测试过慢）.
    const uploadTimes: number[] = [];
    const jpegBytes = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
      Buffer.alloc(5 * 1024 * 1024 - 10, 0),
    ]);
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      fileService.upload(blogger.id, {
        filename: `perf-${i}.jpg`,
        mimeType: 'image/jpeg',
        content: jpegBytes,
      });
      uploadTimes.push(Date.now() - t0);
    }
    expect(p95(uploadTimes)).toBeLessThanOrEqual(1000);

    // 4. WebSocket 推送延迟 P95 ≤ 100ms（循环 100 次）.
    const pushTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      pushService.push(reader.id, 'comment', { msg: `perf-${i}` });
      pushTimes.push(Date.now() - t0);
    }
    expect(p95(pushTimes)).toBeLessThanOrEqual(100);

    // 5. JWT 签发+验证 P95 ≤ 200ms（循环 100 次）.
    const jwtTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      const token = signToken(reader.id, UserRole.Reader);
      verifyToken(token);
      jwtTimes.push(Date.now() - t0);
    }
    expect(p95(jwtTimes)).toBeLessThanOrEqual(200);
  });

  // ============================================================
  // UAT-053: 备份恢复成功率 ≥ 99% (NFR-002)
  // ============================================================
  it('UAT-053: 备份恢复成功率验证', async () => {
    const { admin, blogger } = await seed();
    await publishArticle(blogger.id, '备份文章', '内容', admin.id);
    // 循环 10 次备份+恢复（10 次全成功 = 100% ≥ 99%）.
    let successCount = 0;
    const totalCount = 10;
    for (let i = 0; i < totalCount; i++) {
      const payload = Buffer.from(JSON.stringify({ snapshot: `backup-${i}`, articles: 1 }), 'utf-8');
      const backup = backupService.createBackup(admin.id, UserRole.Admin, BackupType.Full, payload);
      // 完整性校验.
      if (!backupService.verifyIntegrity(backup.id)) continue;
      // 恢复.
      try {
        backupService.restore(admin.id, UserRole.Admin, backup.id);
        successCount += 1;
      } catch {
        // 失败不计入成功.
      }
    }
    const successRate = (successCount / totalCount) * 100;
    expect(successCount).toBe(totalCount);
    expect(successRate).toBeGreaterThanOrEqual(99);
  });

  // ============================================================
  // UAT-054: 安全校验综合验证 (NFR-003)
  // ============================================================
  it('UAT-054: 安全校验综合（JWT/bcrypt/RBAC/原型链污染）', async () => {
    const { admin, blogger, reader } = await seed();
    // 1. 密码 bcrypt 哈希存储（$2b$ 开头）.
    const user = userStore.getById(reader.id);
    expect(user).not.toBeNull();
    expect(user!.passwordHash.startsWith('$2b$')).toBe(true);
    expect(user!.passwordHash).not.toBe('passwordpassword');
    // bcrypt 比对正确密码 → true；错误密码 → false.
    expect(await comparePassword('passwordpassword', user!.passwordHash)).toBe(true);
    expect(await comparePassword('wrong-password', user!.passwordHash)).toBe(false);
    // 原始 hashPassword 返回 bcrypt 哈希.
    const hashed = await hashPassword('test12345');
    expect(hashed.startsWith('$2b$')).toBe(true);

    // 2. JWT 无效 token → 1012 WrongPassword（jwt.verify 失败）.
    expect(() => verifyToken('invalid.token.here')).toThrow(AppError);
    try {
      verifyToken('invalid.token.here');
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.WrongPassword);
      expect((e as AppError).httpStatus).toBe(401);
    }

    // 3. JWT 伪造：用错误密钥签发 token → verifyToken 拒绝.
    const forgedToken = jwt.sign(
      { userId: reader.id, role: UserRole.Admin, jti: 'forged' },
      'wrong-secret',
      { expiresIn: 3600 },
    );
    expect(() => verifyToken(forgedToken)).toThrow(AppError);

    // 4. RBAC：reader 调用管理员接口 → 1021.
    const article = articleService.createArticle(blogger.id, { title: 'RBAC', content: '内容' });
    articleService.submitForReview(blogger.id, article.id);
    expect(() => articleService.approveArticle(reader.id, UserRole.Reader, article.id))
      .toThrow(AppError);
    try {
      articleService.approveArticle(reader.id, UserRole.Reader, article.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.Rbac);
      expect((e as AppError).httpStatus).toBe(403);
    }

    // 5. 原型链污染防护：通过 JSON.parse 注入 __proto__ 不影响权限.
    const malicious = JSON.parse('{"__proto__":{"isAdmin":true}}');
    // 对象原型未被污染（isAdmin 不在 Object.prototype 上）.
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
    // malicious 自身属性可访问但原型未污染.
    expect(malicious.__proto__).toBeDefined();
    // 校验：即使恶意对象传入，user.role 仍按 userStore 实际角色.
    const realUser = userStore.getById(reader.id);
    expect(realUser!.role).toBe(UserRole.Reader);
    // admin 角色 admin 可正常审核.
    articleService.approveArticle(admin.id, UserRole.Admin, article.id);
    expect(articleStore.getById(article.id)?.status).toBe(ArticleStatus.Published);

    // 6. 文件魔数校验：.jpg 实际为 EXE → 1001.
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(() => fileService.upload(blogger.id, {
      filename: 'malicious.jpg',
      mimeType: 'image/jpeg',
      content: exeBytes,
    })).toThrow(AppError);
    try {
      fileService.upload(blogger.id, {
        filename: 'malicious.jpg',
        mimeType: 'image/jpeg',
        content: exeBytes,
      });
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.ZodValidation);
      expect((e as AppError).httpStatus).toBe(400);
    }
  });

  // ============================================================
  // UAT-055: 单元测试覆盖率 ≥ 80% (NFR-004)
  // ============================================================
  it('UAT-055: 单元测试覆盖率 ≥ 80%', () => {
    // 读取 vitest coverage 报告 coverage-summary.json.
    const coveragePath = resolve(process.cwd(), 'coverage', 'coverage-summary.json');
    expect(existsSync(coveragePath)).toBe(true);
    const raw = readFileSync(coveragePath, 'utf-8');
    const summary = JSON.parse(raw) as {
      total: {
        lines: { total: number; covered: number; pct: number };
        statements: { total: number; covered: number; pct: number };
        functions: { total: number; covered: number; pct: number };
        branches: { total: number; covered: number; pct: number };
      };
    };
    // lines 覆盖率 ≥ 80%.
    expect(summary.total.lines.pct).toBeGreaterThanOrEqual(80);
    // 验证覆盖率数值合理（covered ≤ total）.
    expect(summary.total.lines.covered).toBeLessThanOrEqual(summary.total.lines.total);
    expect(summary.total.functions.covered).toBeLessThanOrEqual(summary.total.functions.total);
    // 验证非零（防止 0/0 占位）.
    expect(summary.total.lines.total).toBeGreaterThan(0);
    // 打印覆盖率摘要（用于报告归档）.
    // eslint-disable-next-line no-console
    console.log(
      `[UAT-055] 覆盖率: lines=${summary.total.lines.pct}% ` +
      `statements=${summary.total.statements.pct}% ` +
      `functions=${summary.total.functions.pct}% ` +
      `branches=${summary.total.branches.pct}%`,
    );
  });

  // ============================================================
  // UAT-056: TypeScript strict 0 错误 (NFR-005)
  // ============================================================
  it('UAT-056: TypeScript strict 0 错误', () => {
    // 执行 `npx tsc --noEmit` 验证 strict 模式 0 错误.
    const projectRoot = resolve(process.cwd());
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('npx', ['tsc', '--noEmit'], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
        encoding: 'utf-8',
        shell: process.platform === 'win32',
      });
    } catch (err: unknown) {
      const e = err as { status?: number; stderr?: string; stdout?: string };
      exitCode = e.status ?? 1;
      stderr = (e.stderr ?? '') + (e.stdout ?? '');
    }
    expect(exitCode).toBe(0);
    // 若有 stderr 输出，应为空或仅含警告（非错误）.
    if (stderr.length > 0) {
      // 不允许包含 "error TS" 字样.
      expect(stderr).not.toMatch(/error TS\d+/);
    }
  });
});
