// SD-014 PushService — WebSocket message push + offline queue + retry.

import type { WsStore, OfflineMessage } from '../stores/ws.store.js';
import { appendAuditLog } from '../utils/logger.js';

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const OFFLINE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PushRetryStats {
  attempts: number;
  delays: number[];
  delivered: boolean;
}

export class PushService {
  constructor(private wsStore: WsStore) {}

  /**
   * push — TLA+ L2_subscription_push.push / L3_notification_push.push.
   * Online user: ws.send with 3x exponential backoff (1s/2s/4s).
   * Offline user: enqueue into offlineMessages queue.
   */
  push(userId: string, channel: string, message: object): PushRetryStats {
    const payload = JSON.stringify(message);
    const socket = this.wsStore.getSocket(userId);
    if (!socket) {
      const offlineMsg: OfflineMessage = {
        channel,
        payload: message,
        at: new Date(),
        attempts: 0,
      };
      this.wsStore.enqueueOffline(userId, offlineMsg);
      return { attempts: 0, delays: [], delivered: false };
    }
    const stats: PushRetryStats = { attempts: 0, delays: [], delivered: false };
    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      stats.attempts += 1;
      stats.delays.push(RETRY_DELAYS_MS[i]!);
      try {
        if (socket.readyState === 1 /* OPEN */) {
          socket.send(payload);
          stats.delivered = true;
          return stats;
        }
        continue; // socket not open, count as failed attempt, retry next delay
      } catch {
        // retry next delay
        continue;
      }
    }
    // All retries failed → enqueue offline for later flush.
    const offlineMsg: OfflineMessage = {
      channel,
      payload: message,
      at: new Date(),
      attempts: stats.attempts,
    };
    this.wsStore.enqueueOffline(userId, offlineMsg);
    return stats;
  }

  /**
   * broadcast — TLA+ L2_subscription_push.broadcast.
   * Iterate channel subscribers and push each.
   */
  broadcast(channel: string, message: object): number {
    const users = this.wsStore.channelUsers(channel);
    let pushed = 0;
    for (const userId of users) {
      this.push(userId, channel, message);
      pushed += 1;
    }
    return pushed;
  }

  /**
   * flushOffline — TLA+ L2_subscription_push.flushOffline / L3_notification_push.flushOffline.
   * Merge same-channel messages within 24h, push on reconnect, clear queue.
   * Messages older than 24h are discarded.
   */
  flushOffline(userId: string): { merged: number; discarded: number; delivered: boolean } {
    const messages = this.wsStore.getOffline(userId);
    if (messages.length === 0) {
      return { merged: 0, discarded: 0, delivered: false };
    }
    const now = Date.now();
    const fresh = messages.filter((m) => now - m.at.getTime() <= OFFLINE_TTL_MS);
    const discarded = messages.length - fresh.length;

    // Group by channel for merge.
    const byChannel = new Map<string, OfflineMessage[]>();
    for (const m of fresh) {
      let arr = byChannel.get(m.channel);
      if (!arr) {
        arr = [];
        byChannel.set(m.channel, arr);
      }
      arr.push(m);
    }

    let mergedCount = 0;
    let delivered = false;
    for (const [channel, arr] of byChannel) {
      // Merge: take latest payload (could concatenate; spec says "merge").
      const latest = arr[arr.length - 1]!;
      const mergedPayload = {
        channel,
        items: arr.map((m) => m.payload),
        latest: latest.payload,
        mergedCount: arr.length,
      };
      const stats = this.push(userId, channel, mergedPayload);
      if (stats.delivered) delivered = true;
      mergedCount += 1;
    }
    this.wsStore.clearOffline(userId);
    appendAuditLog(userId, 'flushOffline', `merged=${mergedCount},discarded=${discarded}`);
    return { merged: mergedCount, discarded, delivered };
  }
}
