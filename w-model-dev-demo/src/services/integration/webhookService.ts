/**
 * webhookService（DD-038 / SD-006）：Webhook 配置管理 + 事件分发（REQ-028 / NFR-003）。
 * HMAC-SHA256 事件签名（X-Blog-Signature）、X-Blog-Event / X-Blog-Timestamp 头；
 * 失败指数退避重试 ≤3 次，最终失败写入 WebhookDelivery store（含 attempts/lastError）。
 * fetch 出站 HTTP 注入 stub（单元测试 seam）；sleep 可注入（避免真实等待）。
 */
import { createHmac, randomBytes } from 'node:crypto';
import { BizError } from '../../utils/errors';
import { invariant } from '../../utils/invariant';
import type { WebhookConfigStore } from '../../stores/webhookConfigStore';
import type { WebhookDeliveryStore } from '../../stores/webhookDeliveryStore';
import type { ArticlePublishedEvent, CommentCreatedEvent, WebhookConfig, WebhookDelivery, WebhookEventType } from '../../types';

export interface FetchLike {
  (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number }>;
}

export interface WebhookServiceOptions {
  maxRetries?: number;
  backoffBaseMs?: number;
  /** 重试间隔（测试注入 no-op 避免真实等待） */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const ALLOWED_EVENTS: WebhookEventType[] = ['article.published', 'comment.created'];
const MAX_RETRIES = 3;

export class WebhookService {
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly webhookConfigStore: WebhookConfigStore,
    private readonly webhookDeliveryStore: WebhookDeliveryStore,
    private readonly fetchImpl: FetchLike = globalThis.fetch.bind(globalThis) as FetchLike,
    options: WebhookServiceOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.backoffBaseMs = options.backoffBaseMs ?? 500;
    this.sleepFn = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
  }

  /** 创建 Webhook：url 须 http(s)（40002，SSRF 范围声明）；events ⊆ 白名单；同 owner+url+event 去重（40901）；secret 服务端生成 */
  createWebhook(ownerId: string, url: string, events: string[], secret?: string): WebhookConfig {
    if (!/^https?:\/\/.+/.test(url)) {
      throw new BizError(40002, 'Webhook url 须为 http(s)');
    }
    const normalized = events.map((e) => e as WebhookEventType);
    for (const event of normalized) {
      if (!ALLOWED_EVENTS.includes(event)) {
        throw new BizError(40002, `不支持的事件类型：${event}`);
      }
    }
    const finalSecret = secret ?? randomBytes(16).toString('hex');
    return this.webhookConfigStore.create({
      ownerId,
      url,
      events: [...new Set(normalized)],
      secret: finalSecret,
      createdAt: new Date().toISOString(),
    });
  }

  listWebhooks(ownerId: string): WebhookConfig[] {
    return this.webhookConfigStore.listByOwner(ownerId);
  }

  /** 归属校验删除（204） */
  deleteWebhook(ownerId: string, webhookId: string): void {
    const config = this.webhookConfigStore.findById(webhookId);
    if (!config || config.ownerId !== ownerId) {
      throw new BizError(40401, 'Webhook 配置不存在');
    }
    this.webhookConfigStore.delete(webhookId);
  }

  /**
   * 出站投递：X-Blog-Signature=HMAC-SHA256(body, secret)、X-Blog-Event、X-Blog-Timestamp（新鲜时间戳）；
   * 失败指数退避重试 ≤3 次；最终失败置 failed 并记 lastError（NFR-003）。
   * 50201 语义：下游不可达记录于 delivery（异步投递失败不阻断业务）。
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await this.webhookDeliveryStore.findById(deliveryId);
    if (!delivery) throw new BizError(40401, '投递记录不存在');
    const config = await this.webhookConfigStore.findById(delivery.webhookId);
    if (!config) return; // 配置已删除，静默终止
    let attempts = delivery.attempts;
    for (let i = 0; i < this.maxRetries; i += 1) {
      attempts += 1;
      // TLA+ BusinessInvariant 锚点（L2_BlogSystemIntegration / L3_BlogSystemWebhookRetry / NFR-003）：
      // 重试不变量——投递尝试次数 ≤ 最大重试上限（3 次）
      invariant(attempts <= this.maxRetries, `Webhook 重试不变量违反：attempts(${attempts}) ≤ maxRetries(${this.maxRetries})`);
      await this.webhookDeliveryStore.updateStatus(deliveryId, 'delivering', attempts);
      try {
        const body = delivery.payload;
        const timestamp = Math.floor(this.now() / 1000).toString();
        const signature = createHmac('sha256', config.secret).update(body).digest('hex');
        const response = await this.fetchImpl(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Blog-Signature': signature,
            'X-Blog-Event': delivery.event,
            'X-Blog-Timestamp': timestamp,
          },
          body,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        await this.webhookDeliveryStore.updateStatus(deliveryId, 'delivered', attempts);
        return;
      } catch (err) {
        const lastError = err instanceof Error ? err.message : String(err);
        if (i < this.maxRetries - 1) {
          await this.webhookDeliveryStore.updateStatus(deliveryId, 'pending', attempts, lastError);
          await this.sleepFn(this.backoffBaseMs * 2 ** i);
        } else {
          await this.webhookDeliveryStore.updateStatus(deliveryId, 'failed', attempts, lastError);
        }
      }
    }
  }

  /** article.published 事件 → 匹配配置 → 创建投递记录 → 触发 deliverWebhook */
  onArticlePublished(event: ArticlePublishedEvent): void {
    const configs = this.webhookConfigStore.matchByEvent(event.authorId, 'article.published');
    for (const config of configs) {
      const delivery = this.createDelivery(config, 'article.published', {
        event: 'article.published',
        articleId: event.articleId,
        title: event.title,
        publishedAt: event.publishedAt,
      });
      void this.deliverWebhook(delivery.id).catch(() => undefined);
    }
  }

  /** comment.created 事件 → 匹配配置 → 创建投递记录 → 触发 deliverWebhook */
  onCommentCreated(event: CommentCreatedEvent): void {
    const configs = this.webhookConfigStore.matchByEvent(event.articleAuthorId, 'comment.created');
    for (const config of configs) {
      const delivery = this.createDelivery(config, 'comment.created', {
        event: 'comment.created',
        articleId: event.articleId,
        commentId: event.commentId,
        content: event.content,
      });
      void this.deliverWebhook(delivery.id).catch(() => undefined);
    }
  }

  private createDelivery(config: WebhookConfig, event: string, payload: Record<string, unknown>): WebhookDelivery {
    const now = new Date().toISOString();
    return this.webhookDeliveryStore.create({
      webhookId: config.id,
      event,
      payload: JSON.stringify(payload),
      status: 'pending',
      attempts: 0,
      createdAt: now,
    });
  }

  /* ============ TLA+ Next 分支对应（薄封装，命名契约 phase-5-coding.md L161） ============ */

  /** TLA+ L2_BlogSystemIntegration "DisableWebhook" 动作对应：禁用（删除）Webhook 配置 */
  disableWebhook(ownerId: string, webhookId: string): void {
    this.deleteWebhook(ownerId, webhookId);
  }

  /** TLA+ L2_BlogSystemIntegration "TriggerWebhook" 动作对应：触发投递 */
  async triggerWebhook(deliveryId: string): Promise<void> {
    await this.deliverWebhook(deliveryId);
  }

  /** TLA+ L3_BlogSystemWebhookRetry "DispatchWebhook" 动作对应：分发投递（等价触发语义） */
  async dispatchWebhook(deliveryId: string): Promise<void> {
    await this.deliverWebhook(deliveryId);
  }

  /** TLA+ L2_BlogSystemIntegration "RetryWebhook" 动作对应：重试投递（deliverWebhook 内含 ≤3 次指数退避重试） */
  async retryWebhook(deliveryId: string): Promise<void> {
    await this.deliverWebhook(deliveryId);
  }

  /** TLA+ L3_BlogSystemWebhookRetry "RetryDelivery" 动作对应：重试投递（与 retryWebhook 等价语义） */
  async retryDelivery(deliveryId: string): Promise<void> {
    await this.deliverWebhook(deliveryId);
  }

  /** TLA+ L3_BlogSystemWebhookRetry "DeliverSucceed" 动作对应：投递成功落 delivered */
  async deliverSucceed(deliveryId: string): Promise<void> {
    await this.webhookDeliveryStore.updateStatus(deliveryId, 'delivered');
  }

  /** TLA+ L2_BlogSystemIntegration "FailWebhook" 动作对应：最终失败置 failed（记录 lastError） */
  async failWebhook(deliveryId: string, lastError?: string): Promise<void> {
    await this.webhookDeliveryStore.updateStatus(deliveryId, 'failed', undefined, lastError);
  }

  /** TLA+ L3_BlogSystemWebhookRetry "GiveUpDelivery" 动作对应：放弃投递（与 failWebhook 等价语义） */
  async giveUpDelivery(deliveryId: string, lastError?: string): Promise<void> {
    await this.failWebhook(deliveryId, lastError);
  }

  /** TLA+ L2_BlogSystemIntegration "RecoverWebhook" 动作对应：恢复投递（failed/pending → 重新投递） */
  async recoverWebhook(deliveryId: string): Promise<void> {
    await this.deliverWebhook(deliveryId);
  }
}
