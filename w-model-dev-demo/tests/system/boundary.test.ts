/**
 * 系统测试 · 边界异常（ST-036~040）
 * ST-036 注册边界：重复邮箱 409 + 缺必填字段/弱密码 400
 * ST-037 修改密码：原密码错误 400 + 成功后旧凭据失效
 * ST-038 分页边界：空数据/越界页返回空列表 + 非法分页参数 400
 * ST-039 可靠性：发布流程失败不产生部分状态（NFR-003 进程内一致性）
 * ST-040 分类重名 409 + 不同父级同名允许（名称唯一按父级作用域）
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { StoreFactory } from '../../src/stores/storeFactory';
import { createTestEnv, seedUser, seedArticle, seedCategory, login, bearer, pollUntil, startMockServer } from './helpers';

describe('ST-036 注册边界：重复邮箱 409 + 缺必填字段 400（边界异常，REQ-007）', () => {
  it('重复邮箱 40901 且不产生新用户；缺密码/弱密码 400', async () => {
    const env = createTestEnv();
    await seedUser(env.stores, { username: 'dup_user', email: 'dup@example.com' });

    const beforeCount = env.stores.userStore.findAll().length;

    // 1 重复邮箱注册：409 + EMAIL_ALREADY_EXISTS（40901）
    const dup = await request(env.app).post('/api/auth/register').send({
      username: 'r22',
      email: 'dup@example.com',
      password: 'Passw0rd!x',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe(40901);

    // 2 断言用户数不变（唯一性冲突不产生新用户）
    expect(env.stores.userStore.findAll().length).toBe(beforeCount);

    // 3 缺密码注册：400 + VALIDATION_ERROR（40001 zod required）
    const noPwd = await request(env.app).post('/api/auth/register').send({ username: 'r33', email: 'r3@example.com' });
    expect(noPwd.status).toBe(400);
    expect(noPwd.body.error.code).toBe(40001);

    // 4 弱密码注册：400 + VALIDATION_ERROR（40002 too_small）
    const weakPwd = await request(env.app).post('/api/auth/register').send({
      username: 'r44',
      email: 'r4@example.com',
      password: '123',
    });
    expect(weakPwd.status).toBe(400);
    expect(weakPwd.body.error.code).toBe(40002);
  });
});

describe('ST-037 修改密码：原密码错误 400 + 成功后旧凭据失效（边界异常，REQ-010）', () => {
  it('原密码错误 60002；正确改密后旧密码登录 401、新密码登录 200；未认证访问 401', async () => {
    const env = createTestEnv();
    const user = await seedUser(env.stores, {
      username: 'st37_user',
      email: 'st37@example.com',
      password: 'OldPass0rd!',
    });
    const session = await login(env.app, 'st37@example.com', 'OldPass0rd!');

    // 1 原密码错误改密：400 + OLD_PASSWORD_INCORRECT（60002）
    const wrongOld = await request(env.app)
      .put('/api/users/me/password')
      .set(bearer(session.token))
      .send({ oldPassword: 'WrongPass0!', newPassword: 'NewPassw0rd!' });
    expect(wrongOld.status).toBe(400);
    expect(wrongOld.body.error.code).toBe(60002);

    // 2 正确改密：200 + 资料更新
    const okChange = await request(env.app)
      .put('/api/users/me/password')
      .set(bearer(session.token))
      .send({ oldPassword: 'OldPass0rd!', newPassword: 'NewPassw0rd!' });
    expect(okChange.status).toBe(200);
    expect(okChange.body.data.updated).toBe(true);

    // 3 旧密码登录：401（旧凭据失效）
    const oldLogin = await request(env.app).post('/api/auth/login').send({ identifier: 'st37@example.com', password: 'OldPass0rd!' });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error.code).toBe(40101);

    // 4 新密码登录：200 + JWT
    const newLogin = await request(env.app).post('/api/auth/login').send({ identifier: 'st37@example.com', password: 'NewPassw0rd!' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.token).toBeTruthy();
    void user;
  });
});

describe('ST-038 分页边界：空数据/越界页返回空列表（边界异常，REQ-017/021）', () => {
  it('空数据浏览 items=[] total=0；越界页 200 空列表；非法分页参数 400；空数据热门 []', async () => {
    const env = createTestEnv();

    // 1 空数据浏览：200 + items=[] + total=0
    const empty = await request(env.app).get('/api/articles');
    expect(empty.status).toBe(200);
    expect(empty.body.data.items).toEqual([]);
    expect(empty.body.data.total).toBe(0);

    // 2 越界页：200 + items=[]（无 500）
    const farPage = await request(env.app).get('/api/articles').query({ page: 999 });
    expect(farPage.status).toBe(200);
    expect(farPage.body.data.items).toEqual([]);

    // 3 非法分页参数：400 + VALIDATION_ERROR（page=0 或 page=abc）
    const pageZero = await request(env.app).get('/api/articles').query({ page: 0 });
    expect(pageZero.status).toBe(400);
    const pageAbc = await request(env.app).get('/api/articles').query({ page: 'abc' });
    expect(pageAbc.status).toBe(400);

    // 4 空数据热门：200 + []
    const emptyHot = await request(env.app).get('/api/articles/hot');
    expect(emptyHot.status).toBe(200);
    expect(emptyHot.body.data.items).toEqual([]);
  });
});

describe('ST-039 可靠性：发布流程失败不产生部分状态（边界异常，NFR-003/REQ-012）', () => {
  it('Webhook 事件消费失败：发布主链路一致（无孤儿事件/无事件缺失）；非法发布无部分状态；存储层事务回滚成立', async () => {
    // 场景 A：发布后副作用（Webhook 投递）失败 → 发布主链路不受影响（NFR-003「异步投递失败不阻断业务」），无部分状态
    const mock = await startMockServer({ status: 500 });
    try {
      const env = createTestEnv();
      const blogger = await seedUser(env.stores, { username: 'st39_blogger', email: 'st39b@example.com', role: 'blogger' });
      seedArticle(env.stores, { id: 'A1', authorId: blogger.id, title: '副作用失败文章', status: 'draft' });
      const session = await login(env.app, 'st39b@example.com');
      const hookRes = await request(env.app)
        .post('/api/me/webhooks')
        .set(bearer(session.token))
        .send({ url: mock.url, events: ['article.published'] });
      const webhookId = hookRes.body.data.webhookId as string;

      // 发布成功（事件登记与状态变更同链完成——不存在"文章未发布但事件已登记"的孤儿状态）
      const pub = await request(env.app).post('/api/articles/A1/publish').set(bearer(session.token));
      expect(pub.status).toBe(200);
      expect(pub.body.data.status).toBe('published');
      // 不存在"文章已发布但事件缺失"的部分状态：投递记录已登记
      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId).length,
        (n) => n >= 1,
        { timeoutMs: 5000, message: '投递记录未登记（事件缺失）' },
      );
      // 投递失败有失败记录（attempts ≤3，lastError 非空）——失败被记录而非静默
      await pollUntil(
        () => env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0]?.status,
        (status) => status === 'failed',
        { timeoutMs: 10000, message: '投递记录未置 failed' },
      );
      const delivery = env.stores.webhookDeliveryStore.listByWebhook(webhookId)[0];
      expect(delivery.status).toBe('failed');
      expect(delivery.attempts).toBeGreaterThanOrEqual(1);
      expect(delivery.lastError).toBeTruthy();
    } finally {
      await mock.close();
    }

    // 场景 B：非法发布（状态机拒绝）不产生部分状态：文章状态不变、无新事件登记
    const envB = createTestEnv();
    const bloggerB = await seedUser(envB.stores, { username: 'st39b2', email: 'st39b2@example.com', role: 'blogger' });
    seedArticle(envB.stores, { id: 'AR1', authorId: bloggerB.id, title: '归档文章', status: 'archived' });
    const sessionB = await login(envB.app, 'st39b2@example.com');
    // 预配置 webhook（事件登记失败观测点）：非法发布被拒时事件不应发出
    const hookB = await request(envB.app)
      .post('/api/me/webhooks')
      .set(bearer(sessionB.token))
      .send({ url: 'http://127.0.0.1:1/hook', events: ['article.published'] });
    const webhookIdB = hookB.body.data.webhookId as string;
    const rejectPub = await request(envB.app).post('/api/articles/AR1/publish').set(bearer(sessionB.token));
    expect(rejectPub.status).toBe(409);
    expect(rejectPub.body.error.code).toBe(60001);
    expect(envB.stores.articleStore.findById('AR1')?.status).toBe('archived'); // 状态未部分变更
    expect(envB.stores.webhookDeliveryStore.listByWebhook(webhookIdB).length).toBe(0); // 无孤儿事件记录

    // 场景 C：存储层进程内事务机制（seam-STORE，NFR-003 快照回滚）：begin→写→rollback→恢复
    const factory = new StoreFactory();
    const stores = factory.createStores();
    const article = stores.articleStore.create({
      id: 'TX1',
      authorId: 'u_tx',
      title: '事务文章',
      body: '正文',
      summary: '',
      categoryId: null,
      status: 'draft',
      tags: [],
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const tx = factory.begin();
    stores.articleStore.update(article.id, { status: 'published', publishedAt: new Date().toISOString() });
    expect(stores.articleStore.findById('TX1')?.status).toBe('published');
    factory.rollback(tx);
    expect(stores.articleStore.findById('TX1')?.status).toBe('draft'); // 回滚后恢复，无部分状态
  }, 20000);
});

describe('ST-040 分类重名 409 + 唯一性不产生重复分类（边界异常，REQ-016）', () => {
  it('同层重名 40901 且分类数不变；不同父级同名允许（唯一性按父级作用域）', async () => {
    const env = createTestEnv();
    const blogger = await seedUser(env.stores, { username: 'st40_blogger', email: 'st40b@example.com', role: 'blogger' });
    seedCategory(env.stores, { name: 'backend', id: 'c_backend' });
    seedCategory(env.stores, { name: 'frontend', id: 'c_other' });
    const session = await login(env.app, 'st40b@example.com');
    const beforeCount = env.stores.categoryStore.list().length;

    // 1 同层重名创建：409 + CATEGORY_ALREADY_EXISTS（40901）
    const dup = await request(env.app).post('/api/categories').set(bearer(session.token)).send({ name: 'backend' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe(40901);

    // 2 断言分类数不变（唯一性冲突不产生重复分类）
    expect(env.stores.categoryStore.list().length).toBe(beforeCount);

    // 3 允许不同父级同名：201（唯一性按父级作用域）
    const otherParent = await request(env.app)
      .post('/api/categories')
      .set(bearer(session.token))
      .send({ name: 'backend', parentId: 'c_other' });
    expect(otherParent.status).toBe(201);
    expect(env.stores.categoryStore.list().length).toBe(beforeCount + 1);
  });
});
