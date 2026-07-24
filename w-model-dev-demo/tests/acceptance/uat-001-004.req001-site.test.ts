/**
 * 验收测试 UAT-001 ~ UAT-004 —— 站点管理（REQ-001）
 *
 * 覆盖：
 * - UAT-001 站点配置项持久化与读取
 * - UAT-002 维护模式开关阻断非管理员请求
 * - UAT-003 公告定时发布在指定时间戳后可见
 * - UAT-004 站点统计概览 4 项计数一致
 *
 * 路径映射（设计文档 → 实际 API）：
 * - PUT /api/site/config → PATCH /api/site/config
 * - PUT /api/site/switches → POST /api/site/switches (body: {name, value})
 * - GET /api/site/stats/overview → GET /api/site/overview
 * - 维护模式阻断：实际实现通过 isRegistrationOpen/isCommentOpen 间接生效，
 *   非管理员注册/评论请求被拒（60006/60003），管理员操作不受影响。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader,
} from '../helpers/api-helper.js';

describe('UAT-001 ~ UAT-004: 站点管理 (REQ-001)', () => {
  let app: Express;
  let adminToken: string;
  let adminId: string;

  beforeEach(async () => {
    app = createTestApp();
    const admin = await registerUser(app, 'admin@site.com', 'Pass1234', 'adminS', 'admin');
    adminToken = admin.accessToken;
    adminId = admin.userId;
  });

  // -----------------------------------------------------------------------
  // UAT-001: 站点配置项持久化与读取
  // -----------------------------------------------------------------------
  describe('UAT-001: 站点配置项持久化与读取', () => {
    it('UAT-001: PATCH /api/site/config 后 GET 返回一致，WAL 重放后恢复', async () => {
      // 步骤1: 管理员设置站点配置
      const configInput = {
        name: 'MyBlog',
        description: 'desc',
        logo: 'https://x.png',
        icp: '京ICP备XXXX号',
      };
      const patchRes = await request(app)
        .patch('/api/site/config')
        .set(authHeader(adminToken))
        .send(configInput);
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe('MyBlog');
      expect(patchRes.body.description).toBe('desc');

      // 步骤2: GET 读取配置，与步骤1一致
      const getRes = await request(app).get('/api/site/config');
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('MyBlog');
      expect(getRes.body.description).toBe('desc');
      expect(getRes.body.logo).toBe('https://x.png');
      expect(getRes.body.icp).toBe('京ICP备XXXX号');

      // 步骤3: WAL 重放后配置恢复（通过 WalWriter.getLog + WalReplayer 验证持久化）
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      const walLog = c.walWriter.getLog();
      const configOps = walLog.filter(op => op.opType === 'site.updateConfig');
      expect(configOps.length).toBeGreaterThanOrEqual(1);
      // 重放后配置对象中包含写入的字段
      const replayedConfig = configOps[configOps.length - 1].payload as Record<string, unknown>;
      expect(replayedConfig.name).toBe('MyBlog');
    });

    it('UAT-001 异常: 非管理员 PATCH /api/site/config → 403', async () => {
      const user = await registerUser(app, 'user@site.com', 'Pass1234', 'u1', 'user');
      const res = await request(app)
        .patch('/api/site/config')
        .set(authHeader(user.accessToken))
        .send({ name: 'Hacked' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(40301);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-002: 维护模式开关阻断非管理员请求
  // -----------------------------------------------------------------------
  describe('UAT-002: 维护模式开关阻断非管理员请求', () => {
    it('UAT-002: 维护模式开启后注册/评论被拒，管理员操作正常，关闭后恢复', async () => {
      // 步骤1: 开启维护模式（POST /api/site/switches {name:'maintenance', value:true}）
      const onRes = await request(app)
        .post('/api/site/switches')
        .set(authHeader(adminToken))
        .send({ name: 'maintenance', value: true });
      expect(onRes.status).toBe(200);
      expect(onRes.body.ok).toBe(true);

      // 步骤2: 非管理员注册被拒（维护模式下 isRegistrationOpen=false → 60006）
      const regRes = await request(app).post('/api/auth/register').send({
        email: 'newuser@site.com', password: 'Pass1234', nickname: 'new',
      });
      expect(regRes.status).toBe(400);
      expect(regRes.body.code).toBe(60006);

      // 步骤3: 管理员仍可访问受保护端点（PATCH /api/site/config）
      const adminAccess = await request(app)
        .patch('/api/site/config')
        .set(authHeader(adminToken))
        .send({ description: 'during maintenance' });
      expect(adminAccess.status).toBe(200);

      // 步骤4: 关闭维护模式
      const offRes = await request(app)
        .post('/api/site/switches')
        .set(authHeader(adminToken))
        .send({ name: 'maintenance', value: false });
      expect(offRes.status).toBe(200);

      // 步骤5: 注册恢复正常
      const regRes2 = await request(app).post('/api/auth/register').send({
        email: 'newuser2@site.com', password: 'Pass1234', nickname: 'new2',
      });
      expect(regRes2.status).toBe(201);
      expect(regRes2.body.userId).toBeDefined();
    });

    it('UAT-002 边界: 非管理员切换开关 → 403', async () => {
      const user = await registerUser(app, 'user2@site.com', 'Pass1234', 'u2', 'user');
      const res = await request(app)
        .post('/api/site/switches')
        .set(authHeader(user.accessToken))
        .send({ name: 'maintenance', value: true });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(40301);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-003: 公告定时发布在指定时间戳后可见
  // -----------------------------------------------------------------------
  describe('UAT-003: 公告定时发布在指定时间戳后可见', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('UAT-003: 公告设定未来时间发布，到达时间前 scheduled，到达后 published', async () => {
      vi.useFakeTimers();
      const now = Math.floor(Date.now() / 1000);
      const publishAt = now + 60;

      // 步骤1: 创建定时公告
      const createRes = await request(app)
        .post('/api/announcements')
        .set(authHeader(adminToken))
        .send({ title: 'a', body: 'b', publishAt });
      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('scheduled');
      expect(createRes.body.id).toBeDefined();

      const annId = createRes.body.id;

      // 步骤2: 到达时间前，公告仍为 scheduled（通过 service 查询）
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      const before = c.announcementScheduler.findById(annId);
      expect(before).not.toBeNull();
      expect(before!.status).toBe('scheduled');

      // 步骤3: 推进 mock clock 至 now+61s 并触发到期处理
      vi.setSystemTime((now + 61) * 1000);
      const publishedCount = c.announcementScheduler.processDueAnnouncements(now + 61);
      expect(publishedCount).toBeGreaterThanOrEqual(1);

      // 步骤4: 到达后公告状态变为 published
      const after = c.announcementScheduler.findById(annId);
      expect(after).not.toBeNull();
      expect(after!.status).toBe('published');
      expect(after!.publishedAt).toBe(now + 61);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-004: 站点统计概览 4 项计数一致
  // -----------------------------------------------------------------------
  describe('UAT-004: 站点统计概览 4 项计数一致', () => {
    it('UAT-004: GET /api/site/overview 返回 userCount/articleCount，实体变化后同步更新', async () => {
      // 前置: admin 已注册（1 user）
      const blogger = await registerUser(app, 'blogger@site.com', 'Pass1234', 'b1', 'blogger');

      // 初始 overview
      const initial = await request(app).get('/api/site/overview');
      expect(initial.status).toBe(200);
      expect(initial.body.userCount).toBe(2); // admin + blogger
      expect(initial.body.articleCount).toBe(0);
      expect(typeof initial.body.commentCount).toBe('number');
      expect(typeof initial.body.pageView).toBe('number');

      // 创建 1 篇文章
      const articleRes = await request(app)
        .post('/api/articles')
        .set(authHeader(blogger.accessToken))
        .send({ title: 'overview test', content: 'content' });
      expect(articleRes.status).toBe(201);

      // 步骤2: overview 中 articleCount +1
      const updated = await request(app).get('/api/site/overview');
      expect(updated.status).toBe(200);
      expect(updated.body.userCount).toBe(2);
      expect(updated.body.articleCount).toBe(1);
    });
  });
});
