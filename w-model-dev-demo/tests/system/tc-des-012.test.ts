/**
 * TC-DES-012: 崩溃恢复——WAL 重放后状态一致
 *
 * 系统在持续写操作期间崩溃，重启后通过 WAL 重放恢复所有状态，验证与崩溃前一致；
 * 审计日志独立存储不参与重放；WAL 90 天滚动覆盖生效；多次崩溃-恢复循环均一致。
 *
 * 关联需求/设计：NFR-002 / SD-006 / CONFLICT-002 / UAT-042
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WalWriter, WalReplayer } from '../../src/infrastructure/wal.js';
import { articleStore } from '../../src/stores/article-store.js';
import { userStore } from '../../src/stores/user-store.js';
import type { Operation } from '../../src/types.js';

describe('TC-DES-012: 崩溃恢复——WAL 重放后状态一致', () => {

  beforeEach(() => {
    userStore.clear();
    articleStore.clear();
  });

  describe('WAL 重放状态一致性', () => {
    it('50 次写操作后崩溃→重放→状态完全一致', async () => {
      const walWriter = new WalWriter('./crash-test.log');
      const now = Math.floor(Date.now() / 1000);

      // 步骤2: 执行 50 次写操作（注册 5 用户 + 发文 10 篇 + 评论 20 + 点赞 15）
      const operations: Operation[] = [];

      // 5 用户注册
      for (let i = 0; i < 5; i++) {
        const op: Operation = {
          opId: `op-user-${i}`,
          opType: 'user.register',
          payload: {
            id: `u-crash-${i}`,
            email: `u${i}@crash.com`,
            passwordHash: '$2b$10$hash',
            nickname: `user${i}`,
            role: 'user',
            status: 'active',
            createdAt: now,
            updatedAt: now,
            lastLoginAt: 0,
          },
          timestamp: now,
        };
        walWriter.append(op);
        operations.push(op);
      }

      // 10 篇文章
      for (let i = 0; i < 10; i++) {
        const op: Operation = {
          opId: `op-article-${i}`,
          opType: 'article.create',
          payload: {
            id: `a-crash-${i}`,
            authorId: `u-crash-${i % 5}`,
            title: `崩溃恢复文章${i}`,
            content: `内容${i}`,
            status: 'published',
            tagIds: [],
            citeArticleIds: [],
            stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
            createdAt: now,
            updatedAt: now,
            publishedAt: now,
          },
          timestamp: now,
        };
        walWriter.append(op);
        operations.push(op);
      }

      // 20 评论
      for (let i = 0; i < 20; i++) {
        const op: Operation = {
          opId: `op-comment-${i}`,
          opType: 'comment.create',
          payload: {
            id: `cm-crash-${i}`,
            articleId: `a-crash-${i % 10}`,
            authorId: `u-crash-${i % 5}`,
            content: `评论${i}`,
            depth: 0,
            status: 'published',
            likes: 0,
            likedBy: [],
            createdAt: now,
          },
          timestamp: now,
        };
        walWriter.append(op);
        operations.push(op);
      }

      // 15 点赞（article.update 模拟）
      for (let i = 0; i < 15; i++) {
        const op: Operation = {
          opId: `op-like-${i}`,
          opType: 'article.update',
          payload: {
            id: `a-crash-${i % 10}`,
            authorId: `u-crash-${i % 5}`,
            title: `崩溃恢复文章${i % 10}`,
            content: `内容${i % 10}`,
            status: 'published',
            tagIds: [],
            citeArticleIds: [],
            stats: { views: i + 1, likes: 1, comments: 0, shares: 0, heat: 0 },
            createdAt: now,
            updatedAt: now,
            publishedAt: now,
          },
          timestamp: now,
        };
        walWriter.append(op);
        operations.push(op);
      }

      // 步骤3: 记录崩溃前状态快照 S1
      // 先应用操作到 store（模拟正常运行）
      for (const op of operations) {
        const [domain] = op.opType.split('.');
        const storeKey = `${domain}Store`;
        const storeObj = storeKey === 'userStore' ? userStore : storeKey === 'articleStore' ? articleStore : null;
        if (storeObj && typeof (storeObj as { insertOrUpdate?: unknown }).insertOrUpdate === 'function') {
          (storeObj as { insertOrUpdate: (p: unknown) => void }).insertOrUpdate(op.payload);
        }
      }

      const s1UserCount = userStore.list().length;
      const s1ArticleCount = articleStore.listAll().length;
      expect(s1UserCount).toBe(5);
      expect(s1ArticleCount).toBe(10);

      // 步骤4: 模拟崩溃（清空 store）
      userStore.clear();
      articleStore.clear();
      expect(userStore.list().length).toBe(0);
      expect(articleStore.listAll().length).toBe(0);

      // 步骤5-6: 重启服务→重放 WAL→验证状态
      const replayer = new WalReplayer(walWriter, { userStore, articleStore });
      const result = await replayer.replay();

      expect(result.completed).toBe(true);
      expect(result.replayedCount).toBe(50);

      // 步骤7: 验证重放后状态 S2 与 S1 完全一致
      const s2UserCount = userStore.list().length;
      const s2ArticleCount = articleStore.listAll().length;
      expect(s2UserCount).toBe(s1UserCount);
      expect(s2ArticleCount).toBe(s1ArticleCount);

      // 步骤8: 验证用户可"登录"（数据完整）
      const recoveredUser = userStore.findById('u-crash-0');
      expect(recoveredUser).toBeDefined();
      expect(recoveredUser!.email).toBe('u0@crash.com');

      // 步骤9: 验证文章状态机恢复
      const recoveredArticle = articleStore.findById('a-crash-0');
      expect(recoveredArticle).toBeDefined();
      expect(recoveredArticle!.status).toBe('published');
      expect(recoveredArticle!.title).toBe('崩溃恢复文章0');
    });

    it('多次崩溃-恢复循环均一致（3 轮）', async () => {
      const walWriter = new WalWriter('./multi-crash.log');
      const now = Math.floor(Date.now() / 1000);

      for (let round = 0; round < 3; round++) {
        // 每轮执行 10 次写操作（finishRecovery 后 WAL 被清空，每轮从空 WAL 开始）
        for (let i = 0; i < 10; i++) {
          walWriter.append({
            opId: `op-r${round}-${i}`,
            opType: i % 2 === 0 ? 'user.register' : 'article.create',
            payload: i % 2 === 0
              ? {
                  id: `u-r${round}-${i}`,
                  email: `u${i}@r${round}.com`,
                  passwordHash: 'h',
                  nickname: `u${i}`,
                  role: 'user',
                  status: 'active',
                  createdAt: now, updatedAt: now, lastLoginAt: 0,
                }
              : {
                  id: `a-r${round}-${i}`,
                  authorId: `u-r${round}-${i - 1}`,
                  title: `文章r${round}-${i}`,
                  content: 'C',
                  status: 'published',
                  tagIds: [], citeArticleIds: [],
                  stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
                  createdAt: now, updatedAt: now, publishedAt: now,
                },
            timestamp: now,
          });
        }

        // 模拟崩溃
        userStore.clear();
        articleStore.clear();

        // 重放（finishRecovery 会清空 WAL）
        const replayer = new WalReplayer(walWriter, { userStore, articleStore });
        const result = await replayer.replay();
        expect(result.completed).toBe(true);
        expect(result.replayedCount).toBe(10);

        // 验证状态一致：每轮 5 user + 5 article（WAL 被清空，仅本轮操作被重放）
        expect(userStore.list().length).toBe(5);
        expect(articleStore.listAll().length).toBe(5);

        // 验证 WAL 已被 finishRecovery 清空
        expect(walWriter.getLog().length).toBe(0);
      }
    });

    it('审计日志独立存储不参与重放（CONFLICT-002）', async () => {
      const walWriter = new WalWriter('./audit-test.log');
      const { AuditLogger, MemoryAuditWriter } = await import('../../src/infrastructure/audit.js');
      const auditLogger = new AuditLogger('./audit.log', new MemoryAuditWriter());

      const now = Math.floor(Date.now() / 1000);

      // WAL 操作
      walWriter.append({
        opId: 'op1', opType: 'user.register',
        payload: { id: 'u-audit', email: 'a@b.com', passwordHash: 'h', nickname: 'a', role: 'user', status: 'active', createdAt: now, updatedAt: now, lastLoginAt: 0 },
        timestamp: now,
      });

      // 审计日志（独立于 WAL）
      await auditLogger.log('user.ban', 'admin', 'u-audit', { reason: 'test' });

      // 重放 WAL
      userStore.clear();
      const replayer = new WalReplayer(walWriter, { userStore });
      await replayer.replay();

      // 验证审计日志不被重放读取（审计日志独立存储）
      const auditEntries = auditLogger.query({});
      expect(auditEntries.length).toBe(1);
      expect((auditEntries[0] as { action: string }).action).toBe('user.ban');

      // 验证 WAL 中不包含审计操作
      const walLog = walWriter.getLog();
      expect(walLog.find(op => op.opType.includes('audit'))).toBeUndefined();
    });
  });

  describe('WAL 90 天滚动覆盖（GAP-009）', () => {
    it('90 天前的记录被滚动清理', () => {
      const walWriter = new WalWriter('./rotate.log');
      const now = Math.floor(Date.now() / 1000);
      const oldTimestamp = now - 91 * 86400; // 91 天前
      const recentTimestamp = now - 10 * 86400; // 10 天前

      // 添加旧记录
      walWriter.append({
        opId: 'op-old', opType: 'user.register',
        payload: { id: 'old' }, timestamp: oldTimestamp,
      });

      // 添加近期记录
      walWriter.append({
        opId: 'op-recent', opType: 'user.register',
        payload: { id: 'recent' }, timestamp: recentTimestamp,
      });

      expect(walWriter.getLog().length).toBe(2);

      // 滚动清理
      walWriter.rotateIfNeeded();

      // 旧记录被清理，近期记录保留
      const log = walWriter.getLog();
      expect(log.length).toBe(1);
      expect(log[0].opId).toBe('op-recent');
    });

    it('90 天内的记录保留', () => {
      const walWriter = new WalWriter('./rotate2.log');
      const now = Math.floor(Date.now() / 1000);
      const recentTimestamp = now - 89 * 86400; // 89 天前（90 天内）

      walWriter.append({
        opId: 'op-89', opType: 'user.register',
        payload: { id: 'recent89' }, timestamp: recentTimestamp,
      });

      walWriter.rotateIfNeeded();
      expect(walWriter.getLog().length).toBe(1);
    });
  });

  describe('WAL 状态机（TLA+ 一致性）', () => {
    it('4 状态转换：Running→Crashed→Recovering→Running', async () => {
      const walWriter = new WalWriter('./state-test.log');
      const now = Math.floor(Date.now() / 1000);
      walWriter.append({
        opId: 'op1', opType: 'user.register',
        payload: { id: 'u1', email: 'a@b.com', passwordHash: 'h', nickname: 'a', role: 'user', status: 'active', createdAt: now, updatedAt: now, lastLoginAt: 0 },
        timestamp: now,
      });

      const replayer = new WalReplayer(walWriter, { userStore });

      // 初始状态 Running
      expect(replayer.getSystemState()).toBe('Running');

      // Crash → Crashed
      replayer.crash();
      expect(replayer.getSystemState()).toBe('Crashed');

      // StartRecovery → Recovering
      replayer.startRecovery();
      expect(replayer.getSystemState()).toBe('Recovering');

      // 完整重放
      await replayer.replay();

      // FinishRecovery → Running
      expect(replayer.getSystemState()).toBe('Running');
    });

    it('未知操作类型 → 抛 50001', () => {
      const walWriter = new WalWriter('./unknown-test.log');
      const now = Math.floor(Date.now() / 1000);
      walWriter.append({
        opId: 'op-unknown', opType: 'unknown.op',
        payload: {}, timestamp: now,
      });

      const replayer = new WalReplayer(walWriter, {});
      replayer.crash();
      replayer.startRecovery();

      expect(() => {
        const log = walWriter.getLog();
        replayer.replayOne(log[0]);
      }).toThrow();
    });
  });
});
