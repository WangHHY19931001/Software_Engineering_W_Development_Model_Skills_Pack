import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  articleCreateSchema,
  passwordResetSchema,
  webhookCreateSchema,
  searchQuerySchema,
} from '../../../src/utils/schemas.js';

describe('schemas (DD-COMMON-003 / NFR-005)', () => {
  it('registerSchema: 正常解析', () => {
    const r = registerSchema.parse({ email: 'a@b.com', password: 'password123', role: 'admin' });
    expect(r.email).toBe('a@b.com');
    expect(r.role).toBe('admin');
  });

  it('registerSchema: 异常 - 邮箱格式错误抛错', () => {
    expect(() => registerSchema.parse({ email: 'bad', password: 'password123' })).toThrow();
  });

  it('registerSchema: 边界 - role 缺省为 reader', () => {
    const r = registerSchema.parse({ email: 'a@b.com', password: 'password123' });
    expect(r.role).toBe('reader');
  });

  it('loginSchema: 缺密码抛错', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com' })).toThrow();
  });

  it('articleCreateSchema: 默认 status=draft, tagIds=[]', () => {
    const r = articleCreateSchema.parse({ title: 't', content: 'c' });
    expect(r.status).toBe('draft');
    expect(r.tagIds).toEqual([]);
  });

  it('passwordResetSchema: 新密码 < 8 抛错', () => {
    expect(() => passwordResetSchema.parse({ token: 't', newPassword: 'short' })).toThrow();
  });

  it('webhookCreateSchema: events 空数组抛错', () => {
    expect(() =>
      webhookCreateSchema.parse({ url: 'https://x.com', events: [], secret: 'secret123' }),
    ).toThrow();
  });

  it('searchQuerySchema: page/limit 强制数字 + 默认', () => {
    const r = searchQuerySchema.parse({ keyword: 'k' });
    expect(r.page).toBe(1);
    expect(r.limit).toBe(10);
  });
});
