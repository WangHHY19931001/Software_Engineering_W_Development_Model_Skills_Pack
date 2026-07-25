// 集成测试 - 接口契约与参数校验 (TC-INT-001 ~ TC-INT-010).
// 覆盖 TC-DES-004（接口定义）/ TC-DES-006（集成测试用例生成）/ TC-DES-010（接口参数校验）.
// 真实实例化 Store/Service/Controller，禁止 mock 内部模块；仅可 mock 外部 IO。

process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { UserStore } from '../../src/stores/user.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { SearchStore } from '../../src/stores/search.store.js';
import { TagStore } from '../../src/stores/tag.store.js';
import { CategoryStore } from '../../src/stores/category.store.js';
import { SubscriptionStore } from '../../src/stores/subscription.store.js';
import { BloggerStore } from '../../src/stores/blogger.store.js';
import { FileStore } from '../../src/stores/file.store.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { SearchService } from '../../src/services/search.service.js';
import { TagService } from '../../src/services/tag.service.js';
import { CategoryService } from '../../src/services/category.service.js';
import { SubscriptionService } from '../../src/services/subscription.service.js';
import { BloggerService } from '../../src/services/blogger.service.js';
import { FileService } from '../../src/services/file.service.js';
import { PushService } from '../../src/services/push.service.js';
import { WsStore } from '../../src/stores/ws.store.js';
import { NotificationStore } from '../../src/stores/notification.store.js';
import { AppError } from '../../src/utils/errors.js';
import { ArticleStatus, UserRole, SubscriptionTarget } from '../../src/types.js';
import { clearRevokedJtis } from '../../src/utils/auth.js';

const INTERFACE_DESIGN_PATH = path.resolve(
  'd:\\w_skill_opt\\Software_Engineering_W_Development_Model_Skills_Pack\\w-model-dev-demo\\docs\\interface-design.md',
);
const INTEGRATION_DESIGN_PATH = path.resolve(
  'd:\\w_skill_opt\\Software_Engineering_W_Development_Model_Skills_Pack\\w-model-dev-demo\\docs\\integration-test-design.md',
);

// 10 schema fields per phase-3-outline-design.md 接口契约 Schema 模板.
const SCHEMA_FIELDS = [
  '接口名',
  '路径',
  '参数名',
  '参数类型',
  '必填',
  '默认值',
  '约束',
  '示例',
  '返回值结构',
  '错误码',
];

const INTF_IDS = Array.from({ length: 17 }, (_, i) =>
  `INTF-${String(i + 1).padStart(3, '0')}`,
);

describe('TC-INT-001~010 接口契约与参数校验', () => {
  let userStore: UserStore;
  let articleStore: ArticleStore;
  let searchStore: SearchStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let subscriptionStore: SubscriptionStore;
  let bloggerStore: BloggerStore;
  let fileStore: FileStore;
  let notificationStore: NotificationStore;
  let wsStore: WsStore;
  let authService: AuthService;
  let articleService: ArticleService;
  let searchService: SearchService;
  let tagService: TagService;
  let categoryService: CategoryService;
  let subscriptionService: SubscriptionService;
  let bloggerService: BloggerService;
  let fileService: FileService;
  let pushService: PushService;

  beforeEach(() => {
    userStore = new UserStore();
    articleStore = new ArticleStore();
    searchStore = new SearchStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    subscriptionStore = new SubscriptionStore();
    bloggerStore = new BloggerStore();
    fileStore = new FileStore();
    notificationStore = new NotificationStore();
    wsStore = new WsStore();
    authService = new AuthService(userStore);
    articleService = new ArticleService(articleStore, searchStore, userStore);
    searchService = new SearchService(searchStore);
    tagService = new TagService(tagStore);
    categoryService = new CategoryService(categoryStore);
    pushService = new PushService(wsStore);
    subscriptionService = new SubscriptionService(
      subscriptionStore,
      userStore,
      bloggerStore,
      tagStore,
      categoryStore,
      pushService,
    );
    bloggerService = new BloggerService(bloggerStore, userStore, subscriptionStore);
    fileService = new FileService(fileStore, userStore);
    clearRevokedJtis();
  });

  it('TC-INT-001: 验证 docs/interface-design.md 17 INTF × 10 字段完整（静态契约校验）', async () => {
    const content = await fs.readFile(INTERFACE_DESIGN_PATH, 'utf-8');
    // 17 INTF 标识全部出现.
    for (const intfId of INTF_IDS) {
      expect(content).toContain(intfId);
    }
    // 10 schema 字段全部出现（关键词在文档中至少出现一次）.
    for (const field of SCHEMA_FIELDS) {
      expect(content.includes(field)).toBe(true);
    }
    // 错误码三段位关键字出现.
    expect(content).toContain('4xx');
    expect(content).toContain('5xx');
    expect(content).toContain('业务');
    // 关键错误码出现.
    for (const code of ['1001', '1002', '1011', '1021', '1031']) {
      expect(content).toContain(code);
    }
  });

  it('TC-INT-002: 验证 TC-INT 用例数 ≥40 且 17 INTF 覆盖（静态用例完整性）', async () => {
    const content = await fs.readFile(INTEGRATION_DESIGN_PATH, 'utf-8');
    // 用例 ID 形如 TC-INT-001..TC-INT-040，至少 40 条.
    let count = 0;
    for (let i = 1; i <= 40; i++) {
      const id = `TC-INT-${String(i).padStart(3, '0')}`;
      if (content.includes(id)) count += 1;
    }
    expect(count).toBeGreaterThanOrEqual(40);
    // 17 INTF 全部在用例设计文档中出现.
    for (const intfId of INTF_IDS) {
      expect(content).toContain(intfId);
    }
    // 异常路径用例区间存在.
    expect(content).toContain('TC-INT-031');
    expect(content).toContain('TC-INT-040');
    expect(content).toContain('TC-DES-012');
  });

  it('TC-INT-003: 用户注册接口参数校验（合法+非法+边界）', async () => {
    // 合法注册.
    const user = await authService.userRegister({
      email: 'u1@x.com',
      password: 'passwordpassword',
      displayName: '用户1',
    });
    expect(user.id).toBeTruthy();
    expect(userStore.hasEmail('u1@x.com')).toBe(true);

    // 非法 email → 1001.
    expect(
      authService.userRegister({
        email: 'not-email',
        password: 'passwordpassword',
        displayName: 'x',
      }),
    ).rejects.toThrow(AppError);
    await expect(
      authService.userRegister({
        email: 'not-email',
        password: 'passwordpassword',
        displayName: 'x',
      }),
    ).rejects.toMatchObject({ code: 1001 });

    // password 边界（7 位）→ 1001.
    await expect(
      authService.userRegister({
        email: 'u2@x.com',
        password: '1234567',
        displayName: 'x',
      }),
    ).rejects.toMatchObject({ code: 1001 });

    // 缺 displayName → 1001.
    await expect(
      authService.userRegister({
        email: 'u3@x.com',
        password: 'passwordpassword',
        displayName: '',
      }),
    ).rejects.toMatchObject({ code: 1001 });

    // 重复 email → 1005.
    await expect(
      authService.userRegister({
        email: 'u1@x.com',
        password: 'passwordpassword',
        displayName: 'y',
      }),
    ).rejects.toMatchObject({ code: 1005 });
  });

  it('TC-INT-004: 文章创建接口参数校验 + RBAC（合法+非法+越权）', async () => {
    // 准备 admin + blogger + reader.
    const admin = await authService.userRegister({
      email: 'admin@x.com',
      password: 'passwordpassword',
      displayName: 'admin',
      role: UserRole.Admin,
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'blogger',
      role: UserRole.Blogger,
    });
    const reader = await authService.userRegister({
      email: 'r@x.com',
      password: 'passwordpassword',
      displayName: 'reader',
      role: UserRole.Reader,
    });

    // 合法创建（blogger）→ draft.
    const article = articleService.createArticle(blogger.id, {
      title: '标题',
      content: '内容',
    });
    expect(article.status).toBe(ArticleStatus.Draft);
    expect(article.authorId).toBe(blogger.id);

    // 合法创建（admin）.
    const article2 = articleService.createArticle(admin.id, {
      title: 'admin 标题',
      content: '内容',
    });
    expect(article2.authorId).toBe(admin.id);

    // reader 创建 → 1021.
    expect(() =>
      articleService.createArticle(reader.id, { title: 't', content: 'c' }),
    ).toThrow(AppError);
    try {
      articleService.createArticle(reader.id, { title: 't', content: 'c' });
    } catch (err) {
      expect((err as AppError).code).toBe(1021);
    }

    // title 超长 → 1001.
    expect(() =>
      articleService.createArticle(blogger.id, {
        title: 'x'.repeat(201),
        content: 'c',
      }),
    ).toThrow(AppError);
    try {
      articleService.createArticle(blogger.id, {
        title: 'x'.repeat(201),
        content: 'c',
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // authorId 不存在 → 1031.
    expect(() =>
      articleService.createArticle('nonexistent-id', {
        title: 't',
        content: 'c',
      }),
    ).toThrow(AppError);
    try {
      articleService.createArticle('nonexistent-id', {
        title: 't',
        content: 'c',
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }
  });

  it('TC-INT-005: 文件上传接口参数校验（合法+大小+魔数+配额）', async () => {
    const user = await authService.userRegister({
      email: 'fu@x.com',
      password: 'passwordpassword',
      displayName: 'fu',
    });
    // 合法 JPEG 上传.
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const file = fileService.upload(user.id, {
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    expect(file.sha256).toBeTruthy();
    expect(file.size).toBe(jpegBytes.length);

    // 超过 10MB → 1041.
    const hugeBytes = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    hugeBytes[0] = 0xff;
    hugeBytes[1] = 0xd8;
    hugeBytes[2] = 0xff;
    expect(() =>
      fileService.upload(user.id, {
        filename: 'big.jpg',
        mimeType: 'image/jpeg',
        content: hugeBytes,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload(user.id, {
        filename: 'big.jpg',
        mimeType: 'image/jpeg',
        content: hugeBytes,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1041);
    }

    // 魔数不匹配（声明 jpeg 但内容 png）→ 1001.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() =>
      fileService.upload(user.id, {
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        content: pngBytes,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload(user.id, {
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        content: pngBytes,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // 用户不存在 → 1031.
    expect(() =>
      fileService.upload('nonexistent-id', {
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        content: jpegBytes,
      }),
    ).toThrow(AppError);
    try {
      fileService.upload('nonexistent-id', {
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        content: jpegBytes,
      });
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }

    // 同 sha256 去重 → 复用已有文件.
    const dup = fileService.upload(user.id, {
      filename: 'dup.jpg',
      mimeType: 'image/jpeg',
      content: jpegBytes,
    });
    expect(dup.sha256).toBe(file.sha256);
  });

  it('TC-INT-006: 推荐接口参数校验 + 个性化需登录', async () => {
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'b',
      role: UserRole.Blogger,
    });
    // 创建并发布一篇文章.
    const article = articleService.createArticle(blogger.id, {
      title: '推荐测试',
      content: '推荐内容',
    });
    articleService.submitForReview(blogger.id, article.id);
    articleService.approveArticle(blogger.id, UserRole.Admin, article.id);

    const { RecommendService } = await import('../../src/services/recommend.service.js');
    const { RecommendStore } = await import('../../src/stores/recommend.store.js');
    const recommendService = new RecommendService(
      new RecommendStore(),
      articleStore,
      subscriptionStore,
    );

    // hot 模式 - 任何角色可访问.
    const hot = recommendService.hot(1, 10);
    expect(hot.total).toBeGreaterThanOrEqual(1);
    expect(hot.items[0]?.id).toBe(article.id);

    // latest 模式.
    const latest = recommendService.latest(1, 10);
    expect(latest.total).toBeGreaterThanOrEqual(1);

    // personalized 无 userId → 1011.
    expect(() => recommendService.personalized('', 1, 10)).toThrow(AppError);
    try {
      recommendService.personalized('', 1, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1011);
    }

    // personalized 有 userId → 200（即使无订阅也返回空列表）.
    const reader = await authService.userRegister({
      email: 'r@x.com',
      password: 'passwordpassword',
      displayName: 'r',
    });
    const pers = recommendService.personalized(reader.id, 1, 10);
    expect(pers.page).toBe(1);

    // page < 1 → 1001.
    expect(() => recommendService.hot(0, 10)).toThrow(AppError);
    try {
      recommendService.hot(0, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-INT-007: 搜索接口参数校验（keyword 空/超长 + pageSize 上限）', async () => {
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'b',
      role: UserRole.Blogger,
    });
    const article = articleService.createArticle(blogger.id, {
      title: 'React 入门',
      content: 'React 基础教程',
    });
    articleService.submitForReview(blogger.id, article.id);
    articleService.approveArticle(blogger.id, UserRole.Admin, article.id);

    // 合法搜索.
    const result = searchService.search(null, 'React', 'relevance', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0]?.articleId).toBe(article.id);

    // keyword 空 → 1001.
    expect(() => searchService.search(null, '', 'relevance', 1, 10)).toThrow(AppError);
    try {
      searchService.search(null, '', 'relevance', 1, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // keyword 超长（>100）→ 1001.
    expect(() =>
      searchService.search(null, 'x'.repeat(101), 'relevance', 1, 10),
    ).toThrow(AppError);
    try {
      searchService.search(null, 'x'.repeat(101), 'relevance', 1, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // pageSize 超限（>50）→ 1001.
    expect(() => searchService.search(null, 'React', 'relevance', 1, 100)).toThrow(
      AppError,
    );
    try {
      searchService.search(null, 'React', 'relevance', 1, 100);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // page < 1 → 1001.
    expect(() => searchService.search(null, 'React', 'relevance', 0, 10)).toThrow(
      AppError,
    );
    try {
      searchService.search(null, 'React', 'relevance', 0, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-INT-008: 标签创建与绑定参数校验（重复/超长/超限/pending）', async () => {
    // 创建标签.
    const tag = tagService.createTag('React', 'react');
    expect(tag.status).toBe('pending_review');

    // 重复 slug → 1005.
    expect(() => tagService.createTag('React2', 'react')).toThrow(AppError);
    try {
      tagService.createTag('React2', 'react');
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }

    // 标签名超长 → 1001.
    expect(() => tagService.createTag('x'.repeat(31), 'longslug')).toThrow(AppError);
    try {
      tagService.createTag('x'.repeat(31), 'longslug2');
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // slug 非法 → 1001.
    expect(() => tagService.createTag('Bad', 'BAD SLUG!')).toThrow(AppError);

    // approve tag.
    const approved = tagService.approveTag('admin-1', 'admin', tag.id);
    expect(approved.status).toBe('approved');

    // bind 标签数超限（>10）→ 1001.
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'b',
      role: UserRole.Blogger,
    });
    const article = articleService.createArticle(blogger.id, {
      title: 't',
      content: 'c',
    });
    // 创建并 approve 10 个标签.
    const tagIds: string[] = [approved.id];
    for (let i = 0; i < 10; i++) {
      const t = tagService.createTag(`T${i}`, `t${i}`);
      tagService.approveTag('admin-1', 'admin', t.id);
      tagIds.push(t.id);
    }
    expect(() => tagService.bind(article.id, tagIds)).toThrow(AppError);
    try {
      tagService.bind(article.id, tagIds);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // bind pending 标签 → 1002（标签状态机不合法）.
    const pendingTag = tagService.createTag('Pending', 'pending-tag');
    expect(() => tagService.bind(article.id, [pendingTag.id])).toThrow(AppError);
    try {
      tagService.bind(article.id, [pendingTag.id]);
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-INT-009: 分类树深度参数校验（合法/超深/不存在）', () => {
    // 合法根分类.
    const root = categoryService.createCategory('前端', null);
    expect(root.parentId).toBeNull();
    expect(root.depth).toBe(0);

    // 合法子分类链 depth 1→5.
    let current = root;
    for (let i = 1; i <= 5; i++) {
      const child = categoryService.createCategory(`L${i}`, current.id);
      expect(child.depth).toBe(i);
      current = child;
    }
    // 此时 current.depth = 5（MAX_DEPTH）.

    // 第 7 层超限 → 1004（depth 6 > MAX_DEPTH 5）.
    expect(() => categoryService.createCategory('L6', current.id)).toThrow(AppError);
    try {
      categoryService.createCategory('L6', current.id);
    } catch (err) {
      expect((err as AppError).code).toBe(1004);
    }

    // 父分类不存在 → 1031.
    expect(() => categoryService.createCategory('Orphan', 'nonexistent-id')).toThrow(
      AppError,
    );
    try {
      categoryService.createCategory('Orphan', 'nonexistent-id');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }

    // 名称超长 → 1001.
    expect(() => categoryService.createCategory('x'.repeat(51), null)).toThrow(AppError);
    try {
      categoryService.createCategory('x'.repeat(51), null);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }
  });

  it('TC-INT-010: 订阅接口参数校验（targetType/不存在目标/重复订阅）', async () => {
    const user = await authService.userRegister({
      email: 'u@x.com',
      password: 'passwordpassword',
      displayName: 'u',
    });
    const blogger = await authService.userRegister({
      email: 'b@x.com',
      password: 'passwordpassword',
      displayName: 'b',
      role: UserRole.Blogger,
    });
    const bloggerEntity = bloggerService.bloggerRegister(blogger.id, 'b-slug', 'bio');

    // 合法订阅 blogger.
    const sub = subscriptionService.subscribe(
      user.id,
      SubscriptionTarget.Blogger,
      bloggerEntity.id,
    );
    expect(sub.targetId).toBe(bloggerEntity.id);

    // 重复订阅（幂等返回已有）.
    const dup = subscriptionService.subscribe(
      user.id,
      SubscriptionTarget.Blogger,
      bloggerEntity.id,
    );
    expect(dup.id).toBe(sub.id);

    // 订阅不存在的 blogger → 1031.
    expect(() =>
      subscriptionService.subscribe(user.id, SubscriptionTarget.Blogger, 'no-such-id'),
    ).toThrow(AppError);
    try {
      subscriptionService.subscribe(user.id, SubscriptionTarget.Blogger, 'no-such-id');
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }

    // 用户不存在 → 1031.
    expect(() =>
      subscriptionService.subscribe(
        'nonexistent-user',
        SubscriptionTarget.Blogger,
        bloggerEntity.id,
      ),
    ).toThrow(AppError);
    try {
      subscriptionService.subscribe(
        'nonexistent-user',
        SubscriptionTarget.Blogger,
        bloggerEntity.id,
      );
    } catch (err) {
      expect((err as AppError).code).toBe(1031);
    }

    // listByUser 分页参数非法 → 1001.
    expect(() =>
      subscriptionService.listByUser(user.id, undefined, 0, 10),
    ).toThrow(AppError);
    try {
      subscriptionService.listByUser(user.id, undefined, 0, 10);
    } catch (err) {
      expect((err as AppError).code).toBe(1001);
    }

    // 权限分级 — admin 用户返回 Admin 级别.
    const admin = await authService.userRegister({
      email: 'a@x.com',
      password: 'passwordpassword',
      displayName: 'a',
      role: UserRole.Admin,
    });
    const level = subscriptionService.permission(admin.id, SubscriptionTarget.Blogger);
    expect(level).toBe('admin');
  });
});
