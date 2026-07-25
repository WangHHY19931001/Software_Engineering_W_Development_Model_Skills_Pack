// SD-014 PushService + WsStore unit tests (TC-UNIT-059 ~ TC-UNIT-064).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WsStore } from '../../src/stores/ws.store.js';
import { PushService } from '../../src/services/push.service.js';
import type { IWsLike } from '../../src/types.js';

describe('SD-014 PushService + WsStore (TC-UNIT-059 ~ 064)', () => {
  let wsStore: WsStore;
  let pushService: PushService;

  beforeEach(() => {
    wsStore = new WsStore();
    pushService = new PushService(wsStore);
  });

  /** Helper: create a mock WebSocket that is OPEN and sends successfully. */
  function makeOpenSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
  }

  /** Helper: create a mock WebSocket that throws on send. */
  function makeFailingSocket(): IWsLike & { send: ReturnType<typeof vi.fn> } {
    return {
      readyState: 1,
      send: vi.fn(() => {
        throw new Error('send failed');
      }),
      close: vi.fn(),
    };
  }

  it('TC-UNIT-059: online user receives push via ws.send', () => {
    const socket = makeOpenSocket();
    wsStore.register('u-1', socket);

    const stats = pushService.push('u-1', 'ch-1', { msg: 'hi' });
    expect(stats.delivered).toBe(true);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ msg: 'hi' }));
  });

  it('TC-UNIT-060: offline user message is enqueued', () => {
    // No socket registered for u-1 → offline.
    const stats = pushService.push('u-1', 'ch-1', { msg: 'hi' });
    expect(stats.delivered).toBe(false);
    expect(wsStore.getOffline('u-1')).toHaveLength(1);
  });

  it('TC-UNIT-061: push retries 3 times with exponential backoff on failure', () => {
    const socket = makeFailingSocket();
    wsStore.register('u-1', socket);

    const stats = pushService.push('u-1', 'ch-1', { msg: 'hi' });
    expect(stats.attempts).toBe(3);
    expect(stats.delays).toEqual([1000, 2000, 4000]);
    expect(stats.delivered).toBe(false);
    // After all retries fail, message is enqueued offline.
    expect(wsStore.getOffline('u-1')).toHaveLength(1);
  });

  it('TC-UNIT-062: flushOffline merges same-channel messages within 24h', () => {
    // Seed 3 offline messages in the same channel within 24h.
    const now = new Date();
    const msgs = [
      { channel: 'ch-1', payload: { i: 1 }, at: now, attempts: 0 },
      { channel: 'ch-1', payload: { i: 2 }, at: now, attempts: 0 },
      { channel: 'ch-1', payload: { i: 3 }, at: now, attempts: 0 },
    ];
    wsStore.setOffline('u-1', msgs);

    // Register a socket so flush can deliver.
    const socket = makeOpenSocket();
    wsStore.register('u-1', socket);

    const result = pushService.flushOffline('u-1');
    expect(result.merged).toBe(1);
    expect(wsStore.getOffline('u-1')).toHaveLength(0);
  });

  it('TC-UNIT-063: flushOffline discards messages older than 24h', () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
    wsStore.setOffline('u-1', [
      { channel: 'ch-1', payload: { i: 1 }, at: oldDate, attempts: 0 },
    ]);

    const socket = makeOpenSocket();
    wsStore.register('u-1', socket);

    const result = pushService.flushOffline('u-1');
    expect(result.discarded).toBe(1);
    expect(wsStore.getOffline('u-1')).toHaveLength(0);
  });

  it('TC-UNIT-064: broadcast iterates all channel users', () => {
    // Register 3 users in channel ch-1.
    for (let i = 0; i < 3; i++) {
      const socket = makeOpenSocket();
      wsStore.register(`u-${i}`, socket);
      wsStore.joinChannel('ch-1', `u-${i}`);
    }

    const pushed = pushService.broadcast('ch-1', { msg: 'x' });
    expect(pushed).toBe(3);
  });
});
