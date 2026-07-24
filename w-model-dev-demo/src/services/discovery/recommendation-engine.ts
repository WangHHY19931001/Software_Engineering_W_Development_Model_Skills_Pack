/**
 * DD-022 RecommendationEngine —— 推荐引擎
 *
 * 推荐算法（等权 1/3 + 7 天衰减）、3 类推荐流（个性化/热门/最新）、
 * 推荐位管理（≤20）、博主推荐。
 * 依赖：DD-009 ArticleStore、DD-004 UserStore。
 */
import { z } from 'zod';
import type { Article, Page, User } from '../../types.js';
import { articleStore } from '../../stores/article-store.js';
import { userStore } from '../../stores/user-store.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';

export interface Slot {
  id: string;
  name: string;
  articleIds: string[];
}

export interface UserPreference {
  tagIds: string[];
  categoryIds: string[];
  bloggerIds: string[];
}

const SlotSchema = z.object({
  name: z.string().min(1).max(50),
  articleIds: z.array(z.string()).default([]),
});

const MAX_SLOTS = 20;

function genId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface RecommendationEngineDeps {
  walWriter: WalWriter;
  getFollowerCount: (bloggerId: string) => number;
}

export class RecommendationEngine {
  private slots: Map<string, Slot> = new Map();
  private userPreferences: Map<string, UserPreference> = new Map();
  private deps: RecommendationEngineDeps;

  constructor(deps: RecommendationEngineDeps) {
    this.deps = deps;
  }

  /** 计算推荐打分（对应 DD-022 computeScore，等权 1/3 + 7 天衰减） */
  computeScore(article: Article, userId?: string): number {
    const now = Math.floor(Date.now() / 1000);
    const publishedAt = article.publishedAt ?? article.createdAt;
    const ageDays = (now - publishedAt) / 86400;
    const decay = Math.exp(-ageDays / 7);
    const maxHeat = 1000; // 归一化基准
    const heatScore = Math.min(1, (article.stats.likes * 2 + article.stats.comments * 3 + article.stats.views * 1) / maxHeat);
    const freshScore = 1 / (1 + ageDays);
    let prefScore = 0.5; // 默认偏好分
    if (userId) {
      const pref = this.userPreferences.get(userId);
      if (pref) {
        let matches = 0;
        let total = 0;
        for (const t of article.tagIds) {
          total++;
          if (pref.tagIds.includes(t)) matches++;
        }
        if (article.categoryId) {
          total++;
          if (pref.categoryIds.includes(article.categoryId)) matches++;
        }
        if (article.authorId) {
          total++;
          if (pref.bloggerIds.includes(article.authorId)) matches++;
        }
        prefScore = total > 0 ? matches / total : 0.5;
      }
    }
    return ((heatScore + freshScore + prefScore) / 3) * decay;
  }

  /** 个性化推荐（对应 DD-022 getPersonalizedFeed） */
  getPersonalizedFeed(userId: string, page: number, size: number): Page<Article> {
    const user = userStore.findById(userId);
    if (!user) {
      throw new AppError(40401, `用户不存在: ${userId}`, { userId });
    }
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const all = articleStore.findByStatus('published');
    const scored = all
      .map(a => ({ article: a, score: this.computeScore(a, userId) }))
      .sort((a, b) => b.score - a.score);
    const total = scored.length;
    const start = (page - 1) * size;
    const list = scored.slice(start, start + size).map(s => s.article);
    return { list, total, page, pageSize: size };
  }

  /** 热门推荐（对应 DD-022 getHotFeed） */
  getHotFeed(page: number, size: number): Page<Article> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const all = articleStore.findByStatus('published');
    const scored = all
      .map(a => ({ article: a, score: this.computeScore(a) }))
      .sort((a, b) => b.score - a.score);
    const total = scored.length;
    const start = (page - 1) * size;
    const list = scored.slice(start, start + size).map(s => s.article);
    return { list, total, page, pageSize: size };
  }

  /** 最新推荐（对应 DD-022 getLatestFeed） */
  getLatestFeed(page: number, size: number): Page<Article> {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const all = articleStore.findByStatus('published').sort((a, b) => b.createdAt - a.createdAt);
    const total = all.length;
    const start = (page - 1) * size;
    const list = all.slice(start, start + size);
    return { list, total, page, pageSize: size };
  }

  /** 推荐位管理（对应 DD-022 manageSlot，≤20） */
  async manageSlot(input: { name: string; articleIds?: string[] }, adminId: string): Promise<Slot> {
    const parsed = SlotSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    if (this.slots.size >= MAX_SLOTS) {
      throw new AppError(60006, `推荐位数量已达上限 ${MAX_SLOTS}`, { current: this.slots.size, max: MAX_SLOTS });
    }
    const slot: Slot = {
      id: genId(),
      name: parsed.data.name,
      articleIds: parsed.data.articleIds,
    };
    this.slots.set(slot.id, slot);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'slot.manage',
      payload: slot,
      timestamp: now,
    });
    return slot;
  }

  /** 博主推荐（对应 DD-022 getBloggerRecommend） */
  getBloggerRecommend(userId: string): User[] {
    const bloggers = userStore.list().filter(u => u.role === 'blogger');
    // 基于粉丝数排序
    return bloggers
      .map(b => ({ user: b, followerCount: this.deps.getFollowerCount(b.id) }))
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, 10)
      .map(s => s.user);
  }

  /** 更新用户偏好画像（供外部调用） */
  updateUserPreference(userId: string, pref: UserPreference): void {
    this.userPreferences.set(userId, pref);
  }

  /** 测试重置 */
  _reset(): void {
    this.slots.clear();
    this.userPreferences.clear();
  }
}
