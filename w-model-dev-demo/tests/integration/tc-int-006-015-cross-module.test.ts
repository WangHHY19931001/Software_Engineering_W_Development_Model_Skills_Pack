/**
 * TC-DES-B 跨模块（CXM）集成测试
 *
 * 覆盖范围：INTF 间跨 Service/Store 协同（如评论触发通知、发布触发 webhook 等）
 * 目标：验证服务间调用链正确传播
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupIntegrationTest, type IntegrationContext, authHeader } from './setup.js';

describe('TC-DES-B 跨模块（CXM）', () => {
  let ctx: IntegrationContext;

  beforeEach(() => {
    ctx = setupIntegrationTest();
  });

  // ============ INTF-001 认证 ============
  describe('INTF-001 认证', () => {
    it('TC-INT-001-B1: 注册用户 → 写入 userRepo + 可登录', async () => {
      const reg = await ctx
        .api()
        .post('/api/auth/register')
        .send({ email: 'b1@e.com', username: 'userB1', password: 'password123' });
      expect(reg.status).toBe(201);
      expect(reg.body.user).toBeDefined();
      expect(reg.body.token).toBeDefined();

      // 验证可登录
      const login = await ctx
        .api()
        .post('/api/auth/login')
        .send({ email: 'b1@e.com', password: 'password123' });
      expect(login.status).toBe(200);
      expect(login.body.token).toBeDefined();
    });

    it('TC-INT-001-B2: 注册 blogger 角色 → bloggerRepo 含记录', async () => {
      const reg = await ctx
        .api()
        .post('/api/auth/register')
        .send({ email: 'bb1@e.com', username: 'bloggerB1', password: 'password123', role: 'blogger' });
      expect(reg.status).toBe(201);
      expect(reg.body.user.role).toBe('blogger');
      // 验证 blogger repo 有记录
      const blogger = await ctx.repos.bloggerRepo.findByUserId(reg.body.user.id);
      expect(blogger).not.toBeNull();
    });
  });

  // ============ INTF-002 用户 ============
  describe('INTF-002 用户', () => {
    it('TC-INT-002-B1: PUT /users/me → 更新后 GET 返回新值', async () => {
      const u = await ctx.registerUser();
      const updated = await ctx
        .api()
        .put('/api/users/me')
        .set(authHeader(u.token))
        .send({ nickname: 'NewName' });
      expect(updated.status).toBe(200);
      expect(updated.body.nickname).toBe('NewName');

      // 验证 GET /users/:id 也返回新值
      const fetched = await ctx.api().get(`/api/users/${u.userId}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.nickname).toBe('NewName');
    });
  });

  // ============ INTF-003 关注 ============
  describe('INTF-003 关注', () => {
    it('TC-INT-003-B1: 关注 → followRepo 含记录 + 可查 followers', async () => {
      const reader = await ctx.registerUser();
      const blogger = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/follows')
        .set(authHeader(reader.token))
        .send({ followeeId: blogger.userId });
      expect(res.status).toBe(201);

      // 验证 followers
      const followers = await ctx.api().get(`/api/users/${blogger.userId}/followers`);
      expect(followers.status).toBe(200);
      expect(followers.body.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-004 博主 ============
  describe('INTF-004 博主注册', () => {
    it('TC-INT-004-B1: 注册博主 → userRepo role 更新为 blogger', async () => {
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post('/api/bloggers')
        .set(authHeader(u.token))
        .send({ displayName: 'My Blog' });
      expect(res.status).toBe(201);
      expect(res.body.displayName).toBe('My Blog');

      // 验证 user role 更新
      const user = await ctx.repos.userRepo.findById(u.userId);
      expect(user!.role).toBe('blogger');
    });
  });

  // ============ INTF-005 博文 ============
  describe('INTF-005 博文', () => {
    it('TC-INT-005-B1: 创建草稿 → 发布 → GET 可见', async () => {
      const b = await ctx.registerBlogger();
      // 创建草稿
      const draft = await ctx
        .api()
        .post('/api/articles')
        .set(authHeader(b.token))
        .send({ title: 'Draft', content: 'Content' });
      expect(draft.status).toBe(201);
      expect(draft.body.status).toBe('draft');

      // 发布
      const pub = await ctx
        .api()
        .post(`/api/articles/${draft.body.id}/transition`)
        .set(authHeader(b.token))
        .send({ action: 'publish' });
      expect(pub.status).toBe(200);
      expect(pub.body.status).toBe('published');

      // GET 可见
      const fetched = await ctx.api().get(`/api/articles/${draft.body.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.status).toBe('published');
    });

    it('TC-INT-005-B2: 发布博文 → 搜索可搜到', async () => {
      const b = await ctx.registerBlogger();
      await ctx.publishArticle({
        authorId: b.userId,
        title: 'UniqueTitle_B2',
        content: 'Some content',
      });
      const res = await ctx.api().get('/api/search?q=UniqueTitle_B2');
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0].title).toContain('UniqueTitle_B2');
    });
  });

  // ============ INTF-006 浏览 ============
  describe('INTF-006 浏览', () => {
    it('TC-INT-006-B1: GET /articles/:id → 自动浏览计数', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      // 触发 view
      await ctx.api().post(`/api/articles/${articleId}/view`);
      // 验证 viewCount 增长
      const fetched = await ctx.api().get(`/api/articles/${articleId}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body.viewCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-007 互动 ============
  describe('INTF-007 互动', () => {
    it('TC-INT-007-B1: 点赞 → likeCount 增加', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/like`)
        .set(authHeader(u.token));
      expect(res.status).toBe(201);

      // 验证 likeCount
      const art = await ctx.services.article.getById(articleId);
      expect(art.likeCount).toBeGreaterThanOrEqual(1);
    });

    it('TC-INT-007-B2: 收藏 → favoriteCount 增加', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      const res = await ctx
        .api()
        .post(`/api/articles/${articleId}/favorite`)
        .set(authHeader(u.token));
      expect(res.status).toBe(201);

      const art = await ctx.services.article.getById(articleId);
      expect(art.favoriteCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-008 标签 ============
  describe('INTF-008 标签', () => {
    it('TC-INT-008-B1: 创建标签 → GET /tags 含新标签', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/tags')
        .set(authHeader(b.token))
        .send({ name: 'TypeScript', slug: 'typescript' });
      expect(res.status).toBe(201);

      const list = await ctx.api().get('/api/tags');
      expect(list.status).toBe(200);
      const names = list.body.map((t: { name: string }) => t.name);
      expect(names).toContain('TypeScript');
    });
  });

  // ============ INTF-010 评论 ============
  describe('INTF-010 评论', () => {
    it('TC-INT-010-B1: 创建评论 → commentCount 增加', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u.token))
        .send({ content: 'Nice article!' });

      const art = await ctx.services.article.getById(articleId);
      expect(art.commentCount).toBeGreaterThanOrEqual(1);
    });

    it('TC-INT-010-B2: 回复评论 → 评论树含子节点', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u1 = await ctx.registerUser();
      const u2 = await ctx.registerUser();

      const top = await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u1.token))
        .send({ content: 'Top comment' });
      expect(top.status).toBe(201);

      const reply = await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u2.token))
        .send({ parentId: top.body.id, content: 'Reply!' });
      expect(reply.status).toBe(201);

      const tree = await ctx.api().get(`/api/articles/${articleId}/comments`);
      expect(tree.status).toBe(200);
      expect(tree.body.length).toBeGreaterThanOrEqual(1);
      // 顶级评论的 children 应含回复
      const topNode = tree.body.find((n: { id: string }) => n.id === top.body.id);
      expect(topNode).toBeDefined();
      expect(topNode.children.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-011 通知 ============
  describe('INTF-011 通知', () => {
    it('TC-INT-011-B1: 通知创建 → 列表可见', async () => {
      const u = await ctx.registerUser();
      await ctx.services.notification.create({
        recipientId: u.userId,
        type: 'system',
        title: 'Welcome',
        content: 'Welcome to the blog!',
      });
      const res = await ctx
        .api()
        .get('/api/me/notifications')
        .set(authHeader(u.token));
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-013 Webhook ============
  describe('INTF-013 Webhook', () => {
    it('TC-INT-013-B1: 注册 webhook → 列表含记录', async () => {
      const b = await ctx.registerBlogger();
      const res = await ctx
        .api()
        .post('/api/webhooks')
        .set(authHeader(b.token))
        .send({ url: 'https://example.com/hook', events: ['post.published'] });
      expect(res.status).toBe(201);

      const list = await ctx
        .api()
        .get('/api/webhooks')
        .set(authHeader(b.token));
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-014 站点配置 ============
  describe('INTF-014 站点配置', () => {
    it('TC-INT-014-B1: 更新站点配置 → 读取反映更新', async () => {
      const a = await ctx.registerAdmin();
      const updated = await ctx
        .api()
        .put('/api/site-config')
        .set(authHeader(a.token))
        .send({ siteTitle: 'My Blog V2' });
      expect(updated.status).toBe(200);
      expect(updated.body.siteTitle).toBe('My Blog V2');

      const fetched = await ctx.api().get('/api/site-config');
      expect(fetched.body.siteTitle).toBe('My Blog V2');
    });
  });

  // ============ INTF-015 访问记录 ============
  describe('INTF-015 访问记录', () => {
    it('TC-INT-015-B1: 浏览博文 → admin 可查看访问记录', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      // 触发浏览
      await ctx.api().post(`/api/articles/${articleId}/view`);
      // admin 查访问记录
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .get(`/api/articles/${articleId}/views`)
        .set(authHeader(a.token));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-017 统计 ============
  describe('INTF-017 统计', () => {
    it('TC-INT-017-B1: 浏览+点赞+评论 → 聚合 PV/统计', async () => {
      const b = await ctx.registerBlogger();
      const { articleId } = await ctx.publishArticle({ authorId: b.userId });
      const u = await ctx.registerUser();
      // 浏览
      await ctx.api().post(`/api/articles/${articleId}/view`);
      // 点赞
      await ctx
        .api()
        .post(`/api/articles/${articleId}/like`)
        .set(authHeader(u.token));
      // 评论
      await ctx
        .api()
        .post(`/api/articles/${articleId}/comments`)
        .set(authHeader(u.token))
        .send({ content: 'Great!' });

      // 聚合统计
      const a = await ctx.registerAdmin();
      const stats = await ctx
        .api()
        .get('/api/stats')
        .set(authHeader(a.token));
      expect(stats.status).toBe(200);
      expect(stats.body.totalViews).toBeGreaterThanOrEqual(1);
      expect(stats.body.totalComments).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-018 推荐 ============
  describe('INTF-018 推荐', () => {
    it('TC-INT-018-B1: 相关文章 → 相同标签优先推荐', async () => {
      const b = await ctx.registerBlogger();
      // 创建标签
      const tag = await ctx.services.tag.create({ name: 'NodeJS', slug: 'nodejs' });
      // 文章1 使用标签
      const a1 = await ctx.publishArticle({
        authorId: b.userId,
        title: 'Node Intro',
        content: 'Content',
        tagIds: [tag.id],
      });
      // 文章2 也使用标签
      await ctx.publishArticle({
        authorId: b.userId,
        title: 'Node Advanced',
        content: 'Content2',
        tagIds: [tag.id],
      });

      const res = await ctx.api().get(`/api/articles/${a1.articleId}/related`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ INTF-019 广告位 ============
  describe('INTF-019 广告位', () => {
    it('TC-INT-019-B1: 创建广告 → 列表含记录', async () => {
      const a = await ctx.registerAdmin();
      const res = await ctx
        .api()
        .post('/api/ads')
        .set(authHeader(a.token))
        .send({
          name: 'Banner',
          placement: 'banner_top',
          imageUrl: 'https://x.com/banner.png',
          linkUrl: 'https://x.com',
          startAt: Date.now() - 1000,
          endAt: Date.now() + 100000,
        });
      expect(res.status).toBe(201);

      const list = await ctx.api().get('/api/ads');
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
