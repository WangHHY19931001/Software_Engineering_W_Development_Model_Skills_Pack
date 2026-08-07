/**
 * eventBus（ID-4：on/emit 同步分发；handler 异常不阻断主流程）
 * respond.ts（sendError 兜底 50001，控制器直调无 next 场景）
 */
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/utils/eventBus';
import { sendError } from '../../../src/utils/respond';
import { BizError } from '../../../src/utils/errors';
import { makeRes } from '../helpers';

describe('EventBus', () => {
  it('on/emit 同步分发：订阅方收到事件；listenerCount 正确', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('article.published', handler);
    expect(bus.listenerCount('article.published')).toBe(1);

    bus.emit('article.published', { type: 'article.published', articleId: 'a_1', authorId: 'u_1', authorName: 'x', title: 't', publishedAt: '2026-08-07T10:00:00.000Z' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].articleId).toBe('a_1');

    bus.emit('no-subscriber', { type: 'reading.viewed', articleId: 'a_1', clientIp: '1.1.1.1' });
    expect(handler).toHaveBeenCalledTimes(1); // 无订阅不抛错
  });

  it('订阅 handler 抛错不阻断后续订阅与主流程', () => {
    const bus = new EventBus();
    const bad = vi.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.on('comment.created', bad);
    bus.on('comment.created', good);

    bus.emit('comment.created', { type: 'comment.created', articleId: 'a_1', commentId: 'c_1', authorId: 'u_1', authorName: 'x', articleAuthorId: 'u_2', parentId: null, content: 'c' });

    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});

describe('sendError（respond.ts）', () => {
  it('BizError → 按错误码响应；无 next 的未知错误 → 50001 通用文案', () => {
    const res1 = makeRes();
    sendError(res1, undefined, new BizError(40002));
    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res1.json).toHaveBeenCalledWith({ error: { code: 40002, message: '参数取值越界' } });

    const res2 = makeRes();
    sendError(res2, undefined, new Error('unexpected'));
    expect(res2.status).toHaveBeenCalledWith(500);
    expect(res2.json).toHaveBeenCalledWith({ error: { code: 50001, message: '服务端内部错误' } });
  });

  it('有 next 时未知错误转交 next(err)', () => {
    const res = makeRes();
    const next = vi.fn();
    const err = new Error('x');
    sendError(res, next, err);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
