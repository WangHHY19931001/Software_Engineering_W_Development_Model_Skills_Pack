/**
 * storeFactory（DD-048 / CON-001 / NFR-003）：内存存储基座。
 * 工厂创建全部 14 个 store 实例（依赖注入容器）+ txManager 进程内事务（begin/commit/rollback 快照回滚）。
 */
import { BizError } from '../utils/errors';
import type { SnapshotStore } from './base';
import { UserStore } from './userStore';
import { ArticleStore } from './articleStore';
import { TagStore } from './tagStore';
import { CategoryStore } from './categoryStore';
import { CommentStore } from './commentStore';
import { LikeStore } from './likeStore';
import { FavoriteStore } from './favoriteStore';
import { FollowStore } from './followStore';
import { ReadingRecordStore } from './readingRecordStore';
import { NotificationStore } from './notificationStore';
import { WebhookConfigStore } from './webhookConfigStore';
import { WebhookDeliveryStore } from './webhookDeliveryStore';
import { AuditLogStore } from './auditLogStore';
import { SearchIndexStore } from './searchIndexStore';

export interface StoreContainer {
  userStore: UserStore;
  articleStore: ArticleStore;
  tagStore: TagStore;
  categoryStore: CategoryStore;
  commentStore: CommentStore;
  likeStore: LikeStore;
  favoriteStore: FavoriteStore;
  followStore: FollowStore;
  readingRecordStore: ReadingRecordStore;
  notificationStore: NotificationStore;
  webhookConfigStore: WebhookConfigStore;
  webhookDeliveryStore: WebhookDeliveryStore;
  auditLogStore: AuditLogStore;
  searchIndexStore: SearchIndexStore;
}

interface SnapshotEntry {
  store: SnapshotStore<unknown>;
  snapshot: unknown;
}

/** 事务上下文：记录受影响 store 变更前快照（begin 时捕获全量快照） */
export class Tx {
  constructor(private entries: SnapshotEntry[]) {}

  dispose(): void {
    this.entries = [];
  }
}

export class StoreFactory {
  private container: StoreContainer | null = null;

  /** 实例化 14 个 store 并注册容器（重复初始化 → 50001） */
  createStores(): StoreContainer {
    if (this.container) {
      throw new BizError(50001, '存储容器重复初始化');
    }
    this.container = {
      userStore: new UserStore(),
      articleStore: new ArticleStore(),
      tagStore: new TagStore(),
      categoryStore: new CategoryStore(),
      commentStore: new CommentStore(),
      likeStore: new LikeStore(),
      favoriteStore: new FavoriteStore(),
      followStore: new FollowStore(),
      readingRecordStore: new ReadingRecordStore(),
      notificationStore: new NotificationStore(),
      webhookConfigStore: new WebhookConfigStore(),
      webhookDeliveryStore: new WebhookDeliveryStore(),
      auditLogStore: new AuditLogStore(),
      searchIndexStore: new SearchIndexStore(),
    };
    return this.container;
  }

  /** 开启事务（记录全部 store 变更前快照） */
  begin(): Tx {
    if (!this.container) {
      throw new BizError(50001, '存储容器未初始化');
    }
    const entries: SnapshotEntry[] = (Object.values(this.container) as SnapshotStore<unknown>[]).map((store) => ({
      store,
      snapshot: store.snapshot(),
    }));
    return new Tx(entries);
  }

  /** 提交（丢弃快照，变更生效） */
  commit(tx: Tx): void {
    tx.dispose();
  }

  /** 回滚（恢复快照，变更撤销——NFR-003 进程内一致性） */
  rollback(tx: Tx): void {
    const entries = (tx as unknown as { entries: SnapshotEntry[] }).entries;
    for (const entry of entries) {
      entry.store.restore(entry.snapshot);
    }
    tx.dispose();
  }

  /* ============ TLA+ Next 分支对应（L2_BlogSystemInfrastructure，命名契约） ============ */

  /** TLA+ L2_BlogSystemInfrastructure "ApplyTxWrite" 动作对应：事务写入生效（commit 薄封装） */
  applyTxWrite(tx: Tx): void {
    this.commit(tx);
  }

  /** TLA+ L2_BlogSystemInfrastructure "AbortTx" 动作对应：中止事务并回滚（rollback 薄封装，NFR-003） */
  abortTx(tx: Tx): void {
    this.rollback(tx);
  }

  /** TLA+ L2_BlogSystemInfrastructure "ResetTx" 动作对应：重置事务上下文（释放快照） */
  resetTx(tx: Tx): void {
    tx.dispose();
  }
}
