import { describe, it, expect, beforeEach } from 'vitest';
import { WsStore } from '../../../src/stores/ws.store.js';

describe('WsStore', () => {
  let store: WsStore;
  beforeEach(() => { store = new WsStore(); });

  it('add + remove 正常往返', () => {
    const send = () => {};
    store.add({ id: 'c1', userId: 'u1', send, createdAt: '' });
    expect(store.size()).toBe(1);
    expect(store.remove('c1')).toBe(true);
    expect(store.size()).toBe(0);
  });

  it('sendToUser 仅推送给指定用户的连接', () => {
    let received = 0;
    store.add({ id: 'c1', userId: 'u1', send: () => { received += 1; }, createdAt: '' });
    store.add({ id: 'c2', userId: 'u2', send: () => {}, createdAt: '' });
    expect(store.sendToUser('u1', 'hello')).toBe(1);
    expect(received).toBe(1);
  });

  it('broadcast 推送给所有连接', () => {
    let count = 0;
    store.add({ id: 'c1', userId: 'u1', send: () => { count += 1; }, createdAt: '' });
    store.add({ id: 'c2', userId: 'u2', send: () => { count += 1; }, createdAt: '' });
    expect(store.broadcast('hi')).toBe(2);
    expect(count).toBe(2);
  });

  it('remove 同步清理 userIndex', () => {
    store.add({ id: 'c1', userId: 'u1', send: () => {}, createdAt: '' });
    store.remove('c1');
    expect(store.sendToUser('u1', 'x')).toBe(0);
  });
});
