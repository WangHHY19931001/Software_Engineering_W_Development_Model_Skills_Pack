/**
 * UT-DD-013 ~ UT-DD-016 —— 交互层单元测试
 * CommentService (5) + SensitiveFilter (2) + NotificationService (2) + EmailSender (2) = 11 用例
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService } from '../../../src/services/interaction/comment-service.js';
import { SensitiveFilter } from '../../../src/utils/sensitive-filter.js';
import { NotificationService } from '../../../src/services/interaction/notification-service.js';
import { EmailSender, type SmtpTransporter } from '../../../src/utils/email.js';
import { WalWriter, MemoryFileWriter } from '../../../src/infrastructure/wal.js';
import { AuditLogger, MemoryAuditWriter } from '../../../src/infrastructure/audit.js';
import { AppError } from '../../../src/utils/errors.js';
import { articleStore } from '../../../src/stores/article-store.js';
import { userStore } from '../../../src/stores/user-store.js';
import { CommentService as CommentServiceClass } from '../../../src/services/interaction/comment-service.js';
import { NotificationService as NotificationServiceClass } from '../../../src/services/interaction/notification-service.js';

function makeDeps() {
  const walWriter = new WalWriter('./test.log', new MemoryFileWriter());
  const auditLogger = new AuditLogger('./audit.log', new MemoryAuditWriter());
  const emailSender = new EmailSender(null);
  const notificationService = new NotificationService({ emailSender, walWriter });
  return { walWriter, auditLogger, emailSender, notificationService };
}

function resetAll() {
  userStore.clear();
  articleStore.clear();
  CommentServiceClass._reset();
  NotificationServiceClass._reset();
}

describe('DD-013 CommentService', () => {
  let svc: CommentService;
  let deps: ReturnType<typeof makeDeps>;
  let sensitiveFilter: SensitiveFilter;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    sensitiveFilter = new SensitiveFilter();
    svc = new CommentService({
      walWriter: deps.walWriter,
      auditLogger: deps.auditLogger,
      sensitiveFilter,
      isCommentOpen: () => true,
      notifyComment: async () => { },
    });
  });

  it('UT-DD-013-055: createComment 正常创建评论', async () => {
    const comment = await svc.createComment({
      articleId: 'a1', content: '好文！', authorId: 'u1',
    });
    expect(comment.status).toBe('published');
    expect(comment.depth).toBe(0);
  });

  it('UT-DD-013-056: createComment 命中敏感词 status=pending_review', async () => {
    sensitiveFilter.addWord('敏感', 'admin');
    const comment = await svc.createComment({
      articleId: 'a1', content: '包含敏感词', authorId: 'u1',
    });
    expect(comment.status).toBe('pending_review');
    expect(comment.sensitiveHit).toContain('敏感');
  });

  it('UT-DD-013-057: replyComment 嵌套深度超限抛 60004', async () => {
    const c1 = await svc.createComment({ articleId: 'a1', content: 'c1', authorId: 'u1' });
    const c2 = await svc.replyComment(c1.id, { articleId: 'a1', content: 'c2', authorId: 'u1' });
    const c3 = await svc.replyComment(c2.id, { articleId: 'a1', content: 'c3', authorId: 'u1' });
    const c4 = await svc.replyComment(c3.id, { articleId: 'a1', content: 'c4', authorId: 'u1' });
    // c4.depth = 3，再回复触发 parent.depth >= 3 限制
    await expect(svc.replyComment(c4.id, {
      articleId: 'a1', content: 'c5', authorId: 'u1',
    })).rejects.toThrow(AppError);
    try {
      await svc.replyComment(c4.id, { articleId: 'a1', content: 'c5', authorId: 'u1' });
    } catch (e) {
      expect((e as AppError).code).toBe(60004);
    }
  });

  it('UT-DD-013-058: moderate 审核评论', async () => {
    // 使用敏感词使评论进入 pending_review 状态以便审核
    sensitiveFilter.addWord('待审', 'admin');
    const comment = await svc.createComment({ articleId: 'a1', content: '包含待审内容', authorId: 'u1' });
    expect(comment.status).toBe('pending_review');
    const result = await svc.moderate(comment.id, 'approve', 'admin');
    expect(result.status).toBe('approved');
  });

  it('UT-DD-013-059: like 点赞且重复点赞抛 40901', async () => {
    const comment = await svc.createComment({ articleId: 'a1', content: 'c', authorId: 'u1' });
    svc.like(comment.id, 'u2');
    const updated = svc.findById(comment.id);
    expect(updated!.likes).toBe(1);
    expect(() => svc.like(comment.id, 'u2')).toThrow(AppError);
    try {
      svc.like(comment.id, 'u2');
    } catch (e) {
      expect((e as AppError).code).toBe(40901);
    }
  });
});

describe('DD-014 SensitiveFilter', () => {
  let filter: SensitiveFilter;

  beforeEach(() => {
    filter = new SensitiveFilter();
  });

  it('UT-DD-014-060: filter 过滤文本并返回命中词', () => {
    filter.loadWords(['敏感', '违禁']);
    const result = filter.filter('包含敏感词和违禁词');
    expect(result.filtered).toBe('包含***词和***词');
    expect(result.hits).toEqual(expect.arrayContaining(['敏感', '违禁']));
  });

  it('UT-DD-014-061: filter 空文本返回空', () => {
    const result = filter.filter('');
    expect(result.filtered).toBe('');
    expect(result.hits).toEqual([]);
  });
});

describe('DD-015 NotificationService', () => {
  let svc: NotificationService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    resetAll();
    deps = makeDeps();
    svc = new NotificationService({ emailSender: deps.emailSender, walWriter: deps.walWriter });
  });

  it('UT-DD-015-062: notify 触发通知并按设置决定邮件', async () => {
    const notif = await svc.notify({
      userId: 'u1', type: 'commentReply', title: 'T', body: 'B',
    });
    expect(notif.id).toBeDefined();
    expect(notif.read).toBe(false);
  });

  it('UT-DD-015-063: getUnreadCount 返回未读数', async () => {
    await svc.notify({ userId: 'u1', type: 'system', title: 'T1', body: 'B' });
    await svc.notify({ userId: 'u1', type: 'system', title: 'T2', body: 'B' });
    expect(svc.getUnreadCount('u1')).toBe(2);
  });

  it('markRead 标记单条已读', async () => {
    const n = await svc.notify({ userId: 'u1', type: 'system', title: 'T', body: 'B' });
    svc.markRead(n.id, 'u1');
    expect(svc.getUnreadCount('u1')).toBe(0);
  });

  it('markRead 通知不存在抛 40401', () => {
    expect(() => svc.markRead('nonexistent', 'u1')).toThrow(AppError);
    try {
      svc.markRead('nonexistent', 'u1');
    } catch (e) {
      expect((e as AppError).code).toBe(40401);
    }
  });

  it('markRead 所有权校验失败抛 40302', async () => {
    const n = await svc.notify({ userId: 'u1', type: 'system', title: 'T', body: 'B' });
    expect(() => svc.markRead(n.id, 'wrongUser')).toThrow(AppError);
    try {
      svc.markRead(n.id, 'wrongUser');
    } catch (e) {
      expect((e as AppError).code).toBe(40302);
    }
  });

  it('markAllRead 标记全部已读', async () => {
    await svc.notify({ userId: 'u1', type: 'system', title: 'T1', body: 'B' });
    await svc.notify({ userId: 'u1', type: 'system', title: 'T2', body: 'B' });
    svc.markAllRead('u1');
    expect(svc.getUnreadCount('u1')).toBe(0);
  });

  it('updateSettings 关闭类型后不创建通知', async () => {
    svc.updateSettings('u1', { enabledTypes: [], emailEnabled: false });
    const n = await svc.notify({ userId: 'u1', type: 'system', title: 'T', body: 'B' });
    expect(n.read).toBe(true);
    expect(svc.getUnreadCount('u1')).toBe(0);
  });

  it('notify 带 sendEmail 触发邮件发送', async () => {
    const mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
    };
    const sender = new EmailSender(mockTransporter);
    const svc2 = new NotificationService({ emailSender: sender, walWriter: deps.walWriter });
    await svc2.notify({ userId: 'u1', type: 'system', title: 'T', body: 'B', sendEmail: true });
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('listByUser 返回分页通知列表', async () => {
    await svc.notify({ userId: 'u1', type: 'system', title: 'T1', body: 'B' });
    await svc.notify({ userId: 'u1', type: 'system', title: 'T2', body: 'B' });
    const page = svc.listByUser('u1', 1, 10);
    expect(page.total).toBe(2);
    expect(page.list.length).toBe(2);
  });

  it('listByUser 非法 page/size 抛 40003', () => {
    expect(() => svc.listByUser('u1', 0, 10)).toThrow(AppError);
    expect(() => svc.listByUser('u1', 1, 0)).toThrow(AppError);
  });

  it('notify 输入校验失败抛 40003', async () => {
    await expect(svc.notify({ userId: '', type: 'system', title: 'T', body: 'B' })).rejects.toThrow(AppError);
  });
});

describe('DD-016 EmailSender', () => {
  it('UT-DD-016-064: sendMail 正常发送', async () => {
    const mockTransporter: SmtpTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
    };
    const sender = new EmailSender(mockTransporter);
    const result = await sender.sendMail('a@b.com', 'T', 'B');
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(false);
    expect(result.messageId).toBe('msg-1');
  });

  it('UT-DD-016-065: sendMail SMTP 失败时降级记录', async () => {
    const mockTransporter: SmtpTransporter = {
      sendMail: vi.fn().mockRejectedValue(new Error('SMTP down')),
    };
    const sender = new EmailSender(mockTransporter);
    const result = await sender.sendMail('a@b.com', 'T', 'B');
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    expect(sender.getFallbackCount()).toBe(1);
  });
});
