// 测试全局 setup：JWT_SECRET 兜底注入（CON-003，npm script 已用 cross-env 注入，此处双保险）
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-blog-demo';
