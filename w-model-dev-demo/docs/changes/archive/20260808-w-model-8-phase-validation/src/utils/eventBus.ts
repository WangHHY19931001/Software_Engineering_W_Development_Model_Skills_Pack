/**
 * 进程内事件总线（ID-4：内聚于 AppFactory；on/emit 同步分发）。
 * 订阅方 handler 抛错不阻断主流程（记 error 日志），与「Webhook 失败记录、通知不阻断业务」语义一致。
 */
import type { BlogEvent, EventHandler } from '../types';

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  emit(event: string, payload: BlogEvent): void {
    const list = this.handlers.get(event) ?? [];
    for (const handler of list) {
      try {
        handler(payload);
      } catch (err) {
        // 审计失败不阻断业务（DD-043）；订阅副作用异常同样不阻断主链路
        console.error(`[eventbus] handler error for "${event}"`, err);
      }
    }
  }

  listenerCount(event: string): number {
    return (this.handlers.get(event) ?? []).length;
  }
}
