/**
 * UT-DD-024 ~ UT-DD-026 —— 基础设施层单元测试
 * WalWriter (2) + WalReplayer (2) + AuditLogger (1) = 5 用例
 *
 * TLA+ 一致性：
 * - DD-024 WalWriter 对应 L3_wal_replay.tla WriteWal
 * - DD-025 WalReplayer 对应 L3_wal_replay.tla ReplayOneOp + FinishRecovery
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WalWriter, WalReplayer, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from '../../../src/infrastructure/audit.js';
import { AppError } from '../../../src/utils/errors.js';
import { userStore } from '../../../src/stores/user-store.js';
import { articleStore } from '../../../src/stores/article-store.js';
import type { Operation } from '../../../src/types.js';

describe('DD-024 WalWriter', () => {
  let writer: WalWriter;

  beforeEach(() => {
    writer = new WalWriter('./test-wal.log', new MemoryFileWriter());
  });

  it('UT-DD-024-081: append + flush + getLog', async () => {
    const now = Math.floor(Date.now() / 1000);
    const op: Operation = {
      opId: 'op1', opType: 'user.register',
      payload: { id: 'u1' }, timestamp: now,
    };
    writer.append(op);
    await writer.flush();
    const log = writer.getLog();
    expect(log.length).toBe(1);
    expect(log[0].opId).toBe('op1');
  });

  it('UT-DD-024-082: flush 写入失败抛 50002', async () => {
    const now = Math.floor(Date.now() / 1000);
    const op: Operation = {
      opId: 'op1', opType: 'user.register',
      payload: {}, timestamp: now,
    };
    writer.append(op);
    // 使用会抛错的 writer
    const failingWriter = new WalWriter('./fail.log', {
      write: async () => { throw new Error('disk full'); },
      read: async () => '',
    });
    failingWriter.append(op);
    await expect(failingWriter.flush()).rejects.toThrow(AppError);
    try {
      await failingWriter.flush();
    } catch (e) {
      expect((e as AppError).code).toBe(50002);
    }
  });
});

describe('DD-025 WalReplayer', () => {
  let walWriter: WalWriter;

  beforeEach(() => {
    userStore.clear();
    articleStore.clear();
    walWriter = new WalWriter('./test-wal.log', new MemoryFileWriter());
  });

  it('UT-DD-025-083: replay 幂等重放并清空 WAL', async () => {
    const now = Math.floor(Date.now() / 1000);
    const userPayload = {
      id: 'u1', email: 'u1@b.com', passwordHash: 'h', nickname: 'u1',
      role: 'user', status: 'active',
      createdAt: now, updatedAt: now, lastLoginAt: 0,
    };
    const articlePayload = {
      id: 'a1', authorId: 'u1', title: 'T', content: 'C', status: 'draft',
      tagIds: [], citeArticleIds: [],
      stats: { views: 0, likes: 0, comments: 0, shares: 0, heat: 0 },
      createdAt: now, updatedAt: now,
    };
    walWriter.append({
      opId: 'op1', opType: 'user.register', payload: userPayload, timestamp: now,
    });
    walWriter.append({
      opId: 'op2', opType: 'article.create', payload: articlePayload, timestamp: now,
    });
    const replayer = new WalReplayer(walWriter, { userStore, articleStore });
    const result = await replayer.replay();
    expect(result.replayedCount).toBe(2);
    expect(result.completed).toBe(true);
    expect(replayer.isComplete()).toBe(true);
    // 验证数据已重放到 store
    expect(userStore.findById('u1')).toBeDefined();
    expect(articleStore.findById('a1')).toBeDefined();
  });

  it('UT-DD-025-084: replayOne 未知 opType 抛 50001', () => {
    const now = Math.floor(Date.now() / 1000);
    const replayer = new WalReplayer(walWriter, { userStore, articleStore });
    expect(() => replayer.replayOne({
      opId: 'op', opType: 'unknown.op', payload: {}, timestamp: now,
    })).toThrow(AppError);
    try {
      replayer.replayOne({
        opId: 'op', opType: 'unknown.op', payload: {}, timestamp: now,
      });
    } catch (e) {
      expect((e as AppError).code).toBe(50001);
    }
  });
});

describe('DD-026 AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger('./test-audit.log', new MemoryAuditWriter());
  });

  it('UT-DD-026-085: log + query + prune', async () => {
    await logger.log('user.ban', 'admin', 'u1', { reason: '违规' });
    await logger.log('user.ban', 'admin', 'u2', { reason: 'spam' });
    await logger.log('article.transition', 'admin', 'a1', {});
    const entries = logger.query({ action: 'user.ban' });
    expect(entries.length).toBe(2);
    expect(entries[0].actor).toBe('admin');
    // prune 不会移除近期日志
    logger.prune();
    expect(logger.getCount()).toBe(3);
  });
});
