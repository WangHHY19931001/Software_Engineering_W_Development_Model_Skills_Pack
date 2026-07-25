// SD-014 WsStore: WebSocket connection registry + offline message queue.

import type { IWsLike } from '../types.js';

export interface OfflineMessage {
  channel: string;
  payload: unknown;
  at: Date;
  attempts: number;
}

export class WsStore {
  private wsConnections = new Map<string, IWsLike>();
  private channelToUsers = new Map<string, Set<string>>();
  private offlineMessages = new Map<string, OfflineMessage[]>();

  register(userId: string, ws: IWsLike): void {
    const existing = this.wsConnections.get(userId);
    if (existing && existing !== ws) {
      try {
        existing.close(1000, 'replaced');
      } catch {
        // ignore
      }
    }
    this.wsConnections.set(userId, ws);
  }

  unregister(userId: string): void {
    this.wsConnections.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.wsConnections.has(userId);
  }

  getSocket(userId: string): IWsLike | null {
    return this.wsConnections.get(userId) ?? null;
  }

  joinChannel(channel: string, userId: string): void {
    let set = this.channelToUsers.get(channel);
    if (!set) {
      set = new Set();
      this.channelToUsers.set(channel, set);
    }
    set.add(userId);
  }

  leaveChannel(channel: string, userId: string): void {
    const set = this.channelToUsers.get(channel);
    if (!set) return;
    set.delete(userId);
    if (set.size === 0) this.channelToUsers.delete(channel);
  }

  channelUsers(channel: string): string[] {
    const set = this.channelToUsers.get(channel);
    return set ? Array.from(set) : [];
  }

  enqueueOffline(userId: string, msg: OfflineMessage): void {
    let arr = this.offlineMessages.get(userId);
    if (!arr) {
      arr = [];
      this.offlineMessages.set(userId, arr);
    }
    arr.push(msg);
  }

  getOffline(userId: string): OfflineMessage[] {
    const arr = this.offlineMessages.get(userId);
    return arr ? [...arr] : [];
  }

  clearOffline(userId: string): void {
    this.offlineMessages.delete(userId);
  }

  setOffline(userId: string, msgs: OfflineMessage[]): void {
    this.offlineMessages.set(userId, [...msgs]);
  }

  clear(): void {
    this.wsConnections.clear();
    this.channelToUsers.clear();
    this.offlineMessages.clear();
  }
}
