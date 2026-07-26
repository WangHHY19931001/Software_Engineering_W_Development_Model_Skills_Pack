/**
 * WsStore — WebSocket 连接存储（推送用）。
 */
export interface WsConnection {
  id: string;
  userId: string;
  send: (data: string) => void;
  createdAt: string;
}

export class WsStore {
  private connections: Map<string, WsConnection> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();

  add(conn: WsConnection): void {
    this.connections.set(conn.id, conn);
    let set = this.userIndex.get(conn.userId);
    if (!set) {
      set = new Set();
      this.userIndex.set(conn.userId, set);
    }
    set.add(conn.id);
  }

  remove(id: string): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;
    this.connections.delete(id);
    const set = this.userIndex.get(conn.userId);
    if (set) {
      set.delete(id);
      if (set.size === 0) this.userIndex.delete(conn.userId);
    }
    return true;
  }

  sendToUser(userId: string, data: string): number {
    const set = this.userIndex.get(userId);
    if (!set) return 0;
    let sent = 0;
    for (const id of set) {
      const conn = this.connections.get(id);
      if (conn) {
        conn.send(data);
        sent += 1;
      }
    }
    return sent;
  }

  broadcast(data: string): number {
    let sent = 0;
    for (const conn of this.connections.values()) {
      conn.send(data);
      sent += 1;
    }
    return sent;
  }

  size(): number {
    return this.connections.size;
  }

  clear(): void {
    this.connections.clear();
    this.userIndex.clear();
  }
}
