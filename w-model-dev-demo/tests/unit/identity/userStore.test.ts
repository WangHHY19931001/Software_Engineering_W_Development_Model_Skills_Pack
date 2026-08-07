/**
 * UT-004 邮箱唯一冲突（UserStore.create，DD-004/INTF-001）
 */
import { describe, it, expect } from 'vitest';
import { UserStore } from '../../../src/stores/userStore';

describe('UT-004 UserStore.create', () => {
  it('重复 email 触发唯一索引冲突 40901，索引回滚、store 内用户数不变', () => {
    const store = new UserStore();
    store.create({ id: 'u_0001', username: 'dup1', email: 'dup@example.com', passwordHash: 'h1', role: 'reader', createdAt: new Date().toISOString() });

    expect(() =>
      store.create({ id: 'u_0002', username: 'dup2', email: 'dup@example.com', passwordHash: 'h2', role: 'reader', createdAt: new Date().toISOString() }),
    ).toThrow(expect.objectContaining({ code: 40901, httpStatus: 409 }));

    expect(store.findAll()).toHaveLength(1);
    expect(store.findByEmail('dup2@example.com')).toBeNull();
  });

  it('重复 username 同样 40901', () => {
    const store = new UserStore();
    store.create({ id: 'u_0001', username: 'same', email: 'a@example.com', passwordHash: 'h1', role: 'reader', createdAt: new Date().toISOString() });
    expect(() =>
      store.create({ id: 'u_0002', username: 'same', email: 'b@example.com', passwordHash: 'h2', role: 'reader', createdAt: new Date().toISOString() }),
    ).toThrow(expect.objectContaining({ code: 40901 }));
  });
});
