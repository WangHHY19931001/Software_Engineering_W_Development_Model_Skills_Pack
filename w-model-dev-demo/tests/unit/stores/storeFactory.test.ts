/**
 * UT-048 存储基座工厂与事务原子性（storeFactory + txManager，DD-048/CON-001/NFR-003）
 */
import { describe, it, expect } from 'vitest';
import { StoreFactory } from '../../../src/stores/storeFactory';

describe('UT-048 storeFactory + txManager', () => {
  it('createStores 全量实例化 14 个 store', () => {
    const factory = new StoreFactory();
    const container = factory.createStores();
    const names = ['userStore', 'articleStore', 'tagStore', 'categoryStore', 'commentStore', 'likeStore', 'favoriteStore', 'followStore', 'readingRecordStore', 'notificationStore', 'webhookConfigStore', 'webhookDeliveryStore', 'auditLogStore', 'searchIndexStore'];
    for (const name of names) {
      expect(container).toHaveProperty(name);
    }
  });

  it('重复初始化 → 50001', () => {
    const factory = new StoreFactory();
    factory.createStores();
    expect(() => factory.createStores()).toThrow(expect.objectContaining({ code: 50001 }));
  });

  it('begin → 写入 → rollback：变更撤销（快照一致性）', () => {
    const factory = new StoreFactory();
    const { userStore } = factory.createStores();

    const tx = factory.begin();
    userStore.create({ username: 'temp1', email: 'temp1@example.com', passwordHash: 'h', role: 'reader', createdAt: new Date().toISOString() });
    expect(userStore.findAll()).toHaveLength(1);
    factory.rollback(tx);
    expect(userStore.findAll()).toHaveLength(0);
  });

  it('begin 未初始化 → 50001', () => {
    const factory = new StoreFactory();
    expect(() => factory.begin()).toThrow(expect.objectContaining({ code: 50001 }));
  });

  it('begin → 写入 → commit：变更生效', () => {
    const factory = new StoreFactory();
    const { userStore } = factory.createStores();

    const tx = factory.begin();
    userStore.create({ username: 'temp2', email: 'temp2@example.com', passwordHash: 'h', role: 'reader', createdAt: new Date().toISOString() });
    factory.commit(tx);
    expect(userStore.findAll()).toHaveLength(1);
  });
});
