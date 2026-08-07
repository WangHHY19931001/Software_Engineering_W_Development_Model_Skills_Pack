/**
 * readingStatService（DD-031 / SD-005）：阅读统计（REQ-024）。
 * 订阅 reading.viewed 事件（AppFactory 装配），同 clientIp+articleId 5 分钟窗口去重写入（窗口参数化，ID-8）；
 * 聚合查询供热门/推荐/面板。now 可注入假时钟（单元测试 seam）。
 */
import type { ReadingRecordStore } from '../../stores/readingRecordStore';
import { invariant } from '../../utils/invariant';
import type { TagScore, TrendPoint } from '../../types';

export interface ReadingStatOptions {
  windowMs?: number;
  now?: () => number;
}

const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // D-05：5 分钟

export class ReadingStatService {
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(
    private readonly readingRecordStore: ReadingRecordStore,
    private readonly eventBus?: unknown,
    options: ReadingStatOptions = {},
  ) {
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.now = options.now ?? Date.now;
  }

  /** 去重写入（同 IP+文章 5 分钟窗口内已记录则不写入；窗口外新增记录） */
  recordView(articleId: string, clientIp: string, userId: string | null = null): void {
    // TLA+ BusinessInvariant 锚点（L2_BlogSystemAnalytics / L3_BlogSystemReadingDedup）：
    // 去重窗口不变量——windowMs > 0（ID-8 窗口参数化）
    invariant(this.windowMs > 0, '阅读去重窗口不变量违反：windowMs > 0');
    const now = this.now();
    if (this.readingRecordStore.isDuplicated(clientIp, articleId, this.windowMs, now)) {
      return;
    }
    this.readingRecordStore.add({
      articleId,
      clientIp,
      userId,
      viewedAt: new Date(now).toISOString(),
    });
  }

  /** 累计阅读量（去重后） */
  getViewCount(articleId: string): number {
    return this.readingRecordStore.countByArticle(articleId);
  }

  /** 近 7 天阅读量聚合（供热门） */
  getViews7d(articleIds: string[]): Map<string, number> {
    const since = this.now() - 7 * 86400000;
    return this.readingRecordStore.countByArticleSince(articleIds, since);
  }

  /** 近 7 天每日阅读趋势（7 项数组，无记录日期补 0） */
  getTrend7d(articleIds: string[]): TrendPoint[] {
    return this.readingRecordStore.countTrend(articleIds, 7, this.now());
  }

  /** 用户已读文章 id 列表（推荐） */
  getReadArticleIds(userId: string): string[] {
    return this.readingRecordStore.listByUser(userId).map((r) => r.articleId);
  }

  /** 标签偏好（推荐；tagsByArticle 由消费方经 SD-002 组装后传入） */
  getTagPreference(userId: string, tagsByArticle: Map<string, string[]>): TagScore[] {
    return this.readingRecordStore.tagPreference(userId, tagsByArticle);
  }

  /* ============ TLA+ Next 分支对应（L2_BlogSystemAnalytics / L3_BlogSystemReadingDedup，命名契约） ============ */

  /** TLA+ L2_BlogSystemAnalytics "RecordVisit" 动作对应：记录一次阅读访问（recordView 薄封装） */
  recordVisit(articleId: string, clientIp: string, userId: string | null = null): void {
    this.recordView(articleId, clientIp, userId);
  }

  /** TLA+ L2_BlogSystemAnalytics "VisitDeduped" 动作对应：访问是否在去重窗口内被合并 */
  visitDeduped(articleId: string, clientIp: string): boolean {
    return this.readingRecordStore.isDuplicated(clientIp, articleId, this.windowMs, this.now());
  }

  /** TLA+ L2_BlogSystemAnalytics "WindowExpire" 动作对应：统计窗口过期（窗口过期由时间戳比较隐式处理） */
  windowExpire(): void {
    // 窗口过期由 isDuplicated/countByArticleSince 的 now 时间戳比较隐式处理，无显式清理
  }

  /** TLA+ L3_BlogSystemReadingDedup "ViewArticleFirstTime" 动作对应：窗口外首次阅读写入 */
  viewArticleFirstTime(articleId: string, clientIp: string, userId: string | null = null): void {
    this.recordView(articleId, clientIp, userId);
  }

  /** TLA+ L3_BlogSystemReadingDedup "ViewArticleAtCapacity" 动作对应：窗口容量判定（窗口内再次访问 → 去重命中） */
  viewArticleAtCapacity(articleId: string, clientIp: string): boolean {
    return this.visitDeduped(articleId, clientIp);
  }

  /** TLA+ L3_BlogSystemReadingDedup "RepeatView" 动作对应：重复阅读判定（窗口内重复 → true） */
  repeatView(articleId: string, clientIp: string): boolean {
    return this.visitDeduped(articleId, clientIp);
  }

  /** TLA+ L3_BlogSystemReadingDedup "TickWindow" 动作对应：窗口时间推进（时间由注入时钟 now() 驱动） */
  tickWindow(): number {
    return this.now();
  }

  /** TLA+ L3_BlogSystemReadingDedup "ExpireWindow" 动作对应：去重窗口过期（时间戳比较隐式处理） */
  expireWindow(): void {
    // 同 windowExpire：窗口过期由时间戳比较隐式处理，无显式清理
  }

  /** TLA+ L2_BlogSystemDiscovery "LearnPreference" 动作对应：从阅读历史学习标签偏好（getTagPreference 薄封装） */
  learnPreference(userId: string, tagsByArticle: Map<string, string[]>): TagScore[] {
    return this.getTagPreference(userId, tagsByArticle);
  }
}
