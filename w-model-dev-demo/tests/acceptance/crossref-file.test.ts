// 验收测试 - 交叉引用/推送/文件上传 (UAT-037 ~ UAT-045).
// 覆盖 REQ-013 交叉引用 / REQ-014 推送 / REQ-015 文件上传.
// 真实实例化 Store/Service 三层；禁止 mock 内部模块；仅可 mock 外部 IO（WebSocket）.

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { SiteStore } from '../../src/stores/site.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { CrossReferenceStore } from '../../src/stores/crossref.store.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { CrossReferenceService } from '../../src/services/crossref.service.js';
import { PushService } from '../../src/services/push.service.js';
import { FileService } from '../../src/services/file.service.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import {
  ArticleStatus,
  UserRole,
  type IWsLike,
} from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

describe('UAT-037~045 交叉引用/推送/文件上传验收', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let tagStore: TagStore;
  let bloggerStore: BloggerStore;
  let siteStore: SiteStore;
  let fileStore: FileStore;
  let crossRefStore: CrossReferenceStore;
  let wsStore: WsStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let crossRefService: CrossReferenceService;
  let pushService: PushService;
  let fileService: FileService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    tagStore = new TagStore();
    bloggerStore = new BloggerStore();
    siteStore = new SiteStore();
    fileStore = new FileStore();
    crossRefStore = new CrossReferenceStore();
    wsStore = new WsStore();
    const commentStore = new CommentStore();
    siteStore.setStores({ userStore, bloggerStore, articleStore, commentStore, fileStore });
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    crossRefService = new CrossReferenceService(crossRefStore, articleStore, tagStore);
    pushService = new PushService(wsStore);
    fileService = new FileService(fileStore, userStore);
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

  it('UAT-037: 交叉引用正常建立', async () => {
    const { admin, blogger } = await seed();
    const a = await publishArticle(blogger.id, '文章A', '内容A', admin.id);
    const b = await publishArticle(blogger.id, '文章B', '内容B', admin.id);
    // A 引用 B.
    crossRefService.addCitation(a.id, b.id);
    // 反向链接（B 的被引用列表包含 A）.
    const back = crossRefService.backlinks(b.id);
    expect(back.length).toBe(1);
    expect(back[0]?.fromArticleId).toBe(a.id);
    expect(back[0]?.title).toBe('文章A');
    // 引用图谱.
    const graph = crossRefService.graph(a.id, 1);
    expect(graph.length).toBe(2);
    expect(graph[0]?.articleId).toBe(a.id);
    expect(graph[1]?.articleId).toBe(b.id);
  });

  it('UAT-038: 自引用异常', async () => {
    const { admin, blogger } = await seed();
    const a = await publishArticle(blogger.id, '文章A', '内容A', admin.id);
    // 自引用 → 1003 SelfReference.
    expect(() => crossRefService.addCitation(a.id, a.id)).toThrow(AppError);
    try {
      crossRefService.addCitation(a.id, a.id);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.SelfReference);
      expect((e as AppError).httpStatus).toBe(400);
    }
    // 引用未发布文章 → 1002.
    const draft = articleService.createArticle(blogger.id, { title: '草稿', content: '内容' });
    expect(() => crossRefService.addCitation(a.id, draft.id)).toThrow(AppError);
    // 引用不存在的文章 → 1031.
    expect(() => crossRefService.addCitation(a.id, 'non-existent')).toThrow(AppError);
  });

  it('UAT-039: 相关文章推荐计算', async () => {
    const { admin, blogger } = await seed();
    const a = await publishArticle(blogger.id, '文章A', '内容A', admin.id);
    const b = await publishArticle(blogger.id, '文章B', '内容B', admin.id);
    const c = await publishArticle(blogger.id, '文章C', '内容C', admin.id);
    // A 和 B 有共同标签.
    const tagA = tagStore.create('React', 'react');
    tagStore.approve(tagA.id);
    tagStore.bind(a.id, [tagA.id]);
    tagStore.bind(b.id, [tagA.id]);
    // A 引用 C.
    crossRefService.addCitation(a.id, c.id);
    // 相关文章推荐（基于共同标签）.
    const related = crossRefService.related(a.id, 10);
    expect(related.length).toBeGreaterThanOrEqual(1);
    // 含 B（共同标签）.
    expect(related.find((r) => r.articleId === b.id)).toBeTruthy();
    // topN 边界.
    expect(() => crossRefService.related(a.id, 0)).toThrow(AppError);
    expect(() => crossRefService.related(a.id, 101)).toThrow(AppError);
  });

  it('UAT-040: WebSocket 连接与推送', async () => {
    const { blogger } = await seed();
    // blogger 建立 WebSocket 连接.
    const socket = makeOpenSocket();
    wsStore.register(blogger.id, socket);
    expect(wsStore.isOnline(blogger.id)).toBe(true);
    // 订阅 comment 通道.
    wsStore.joinChannel('comment', blogger.id);
    expect(wsStore.channelUsers('comment')).toContain(blogger.id);
    // 推送 comment 通道消息 → blogger 收到.
    const stats = pushService.push(blogger.id, 'comment', { msg: 'hello' });
    expect(stats.delivered).toBe(true);
    expect(socket.send).toHaveBeenCalled();
    // 广播.
    const pushed = pushService.broadcast('comment', { msg: 'broadcast' });
    expect(pushed).toBeGreaterThanOrEqual(1);
  });

  it('UAT-041: 推送失败重试与离线合并', async () => {
    const { blogger, reader } = await seed();
    // blogger 离线时产生通知 → 入离线队列.
    const stats1 = pushService.push(blogger.id, 'comment', { msg: 'msg1' });
    expect(stats1.delivered).toBe(false);
    expect(wsStore.getOffline(blogger.id).length).toBe(1);
    // 再推一条同 channel.
    pushService.push(blogger.id, 'comment', { msg: 'msg2' });
    expect(wsStore.getOffline(blogger.id).length).toBe(2);
    // blogger 上线后 flush → 合并为 1 条（同 channel 合并）.
    const socket = makeOpenSocket();
    wsStore.register(blogger.id, socket);
    const flush = pushService.flushOffline(blogger.id);
    expect(flush.delivered).toBe(true);
    expect(flush.merged).toBe(1); // 同 channel 'comment' 合并为 1 组
    expect(socket.send).toHaveBeenCalled();
    // 离线队列清空.
    expect(wsStore.getOffline(blogger.id).length).toBe(0);
    // 推送失败重试：socket readyState=0（connecting）→ 3 次重试后入离线.
    void reader;
    const closedSocket: IWsLike & { send: ReturnType<typeof vi.fn> } = {
      readyState: 0, send: vi.fn(), close: vi.fn(),
    };
    wsStore.register(reader.id, closedSocket);
    const retryStats = pushService.push(reader.id, 'comment', { msg: 'retry' });
    expect(retryStats.attempts).toBe(3);
    expect(retryStats.delivered).toBe(false);
    // 重试失败后入离线队列.
    expect(wsStore.getOffline(reader.id).length).toBe(1);
  });

  it('UAT-042: 在线状态广播', async () => {
    const { blogger, reader } = await seed();
    // blogger 在线，订阅 comment 通道.
    const bloggerSocket = makeOpenSocket();
    wsStore.register(blogger.id, bloggerSocket);
    wsStore.joinChannel('comment', blogger.id);
    // reader 上线（订阅 comment 通道）→ 广播给同通道用户.
    const readerSocket = makeOpenSocket();
    wsStore.register(reader.id, readerSocket);
    wsStore.joinChannel('comment', reader.id);
    expect(wsStore.channelUsers('comment').length).toBe(2);
    // 广播 online 事件给 comment 通道（blogger 应收到 reader 上线）.
    const pushed = pushService.broadcast('comment', { type: 'online', userId: reader.id });
    expect(pushed).toBe(2);
    expect(bloggerSocket.send).toHaveBeenCalled();
    // reader 离线（退订通道）.
    wsStore.leaveChannel('comment', reader.id);
    expect(wsStore.channelUsers('comment')).not.toContain(reader.id);
    // blogger 下线.
    wsStore.register(blogger.id, { readyState: 3, send: vi.fn(), close: vi.fn() });
    expect(wsStore.isOnline(blogger.id)).toBe(true); // 仍注册（仅 readyState=3）
  });

  it('UAT-043: 图片上传正常', async () => {
    const { blogger } = await seed();
    // 上传 JPG.
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file = fileService.upload(blogger.id, {
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    expect(file.id).toBeTruthy();
    expect(file.sha256).toBeTruthy();
    expect(file.filename).toBe('cover.jpg');
    expect(file.mimeType).toBe('image/jpeg');
    expect(file.magicType).toBe('image/jpeg');
    // 后续读取文件元数据.
    const fetched = fileService.getById(file.id);
    expect(fetched?.id).toBe(file.id);
    expect(fetched?.sha256).toBe(file.sha256);
    // 配额查看.
    const quota = fileService.getQuota(blogger.id);
    expect(quota.dailyUsed).toBeGreaterThan(0);
  });

  it('UAT-044: 文件超 10MB 异常', async () => {
    const { blogger } = await seed();
    // 11MB JPG → 1041 FileTooLarge.
    const big = Buffer.alloc(11 * 1024 * 1024, 0);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff; big[3] = 0xe0;
    expect(() => fileService.upload(blogger.id, {
      filename: 'big.jpg',
      mimeType: 'image/jpeg',
      content: big,
    })).toThrow(AppError);
    try {
      fileService.upload(blogger.id, {
        filename: 'big.jpg',
        mimeType: 'image/jpeg',
        content: big,
      });
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.FileTooLarge);
      expect((e as AppError).httpStatus).toBe(413);
    }
    // 10MB 边界可上传.
    const exact = Buffer.alloc(10 * 1024 * 1024, 0);
    exact[0] = 0xff; exact[1] = 0xd8; exact[2] = 0xff; exact[3] = 0xe0;
    expect(() => fileService.upload(blogger.id, {
      filename: 'exact.jpg',
      mimeType: 'image/jpeg',
      content: exact,
    })).not.toThrow();
  });

  it('UAT-045: 魔数校验不匹配异常', async () => {
    const { blogger } = await seed();
    // 伪造扩展名（PNG 内容声明 jpeg）→ 1001.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => fileService.upload(blogger.id, {
      filename: 'fake.jpg',
      mimeType: 'image/jpeg',
      content: pngBytes,
    })).toThrow(AppError);
    try {
      fileService.upload(blogger.id, {
        filename: 'fake.jpg',
        mimeType: 'image/jpeg',
        content: pngBytes,
      });
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.ZodValidation);
      expect((e as AppError).httpStatus).toBe(400);
    }
    // EXE 魔数 MZ 声明 jpg → 1001.
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(() => fileService.upload(blogger.id, {
      filename: 'malicious.jpg',
      mimeType: 'image/jpeg',
      content: exeBytes,
    })).toThrow(AppError);
    // SHA-256 去重（重复上传相同文件返回相同 id）.
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const f1 = fileService.upload(blogger.id, {
      filename: 'cover1.jpg', mimeType: 'image/jpeg', content: jpegBytes,
    });
    const f2 = fileService.upload(blogger.id, {
      filename: 'cover2.jpg', mimeType: 'image/jpeg', content: jpegBytes,
    });
    expect(f2.id).toBe(f1.id);
    // 不存在用户上传 → 1031.
    expect(() => fileService.upload('non-existent', {
      filename: 'x.jpg', mimeType: 'image/jpeg', content: jpegBytes,
    })).toThrow(AppError);
  });
});
