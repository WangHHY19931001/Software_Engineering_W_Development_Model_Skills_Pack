/**
 * DD-010 TagService —— 标签服务
 *
 * 标签创建/绑定/解绑、标签云（频次排序）、标签合并。
 * 依赖：DD-007 ArticleService、DD-024 WalWriter。
 */
import { z } from 'zod';
import type { Tag } from '../../types.js';
import { GenericStore } from '../../stores/generic-store.js';
import { articleStore } from '../../stores/article-store.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';

export interface MergeResult {
  sourceId: string;
  targetId: string;
  redirectedCount: number;
}

const CreateTagSchema = z.object({
  name: z.string().min(1, '标签名不能为空').max(30, '标签名长度至多 30 字'),
  actorId: z.string().min(1),
});

const tagStore = new GenericStore<Tag>();
const nameIndex = new Map<string, string>(); // name -> tagId
const articleTags = new Map<string, Set<string>>(); // articleId -> tagId 集合

function genId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TagServiceDeps {
  walWriter: WalWriter;
}

export class TagService {
  constructor(private deps: TagServiceDeps) {}

  /** 创建标签（对应 DD-010 createTag） */
  async createTag(name: string, actorId: string): Promise<Tag> {
    const parsed = CreateTagSchema.safeParse({ name, actorId });
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    if (nameIndex.has(name)) {
      throw new AppError(40901, '标签名已存在', { name });
    }
    const now = Math.floor(Date.now() / 1000);
    const tag: Tag = {
      id: genId(),
      name,
      usageCount: 0,
    };
    tagStore.insert(tag);
    nameIndex.set(name, tag.id);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'tag.create',
      payload: tag,
      timestamp: now,
    });
    return tag;
  }

  /** 绑定标签（对应 DD-010 bindTag） */
  async bindTag(articleId: string, tagId: string, actorId: string): Promise<void> {
    const article = articleStore.findById(articleId);
    if (!article) {
      throw new AppError(40401, `文章不存在: ${articleId}`, { articleId });
    }
    if (article.authorId !== actorId) {
      throw new AppError(40302, '所有权校验失败', { articleId, actorId, ownerId: article.authorId });
    }
    const tag = tagStore.findById(tagId);
    if (!tag) {
      throw new AppError(40401, `标签不存在: ${tagId}`, { tagId });
    }
    let set = articleTags.get(articleId);
    if (!set) {
      set = new Set();
      articleTags.set(articleId, set);
    }
    if (set.has(tagId)) return; // 幂等
    if (set.size >= 10) {
      throw new AppError(60006, '每篇文章标签数至多 10 个', { current: set.size });
    }
    set.add(tagId);
    // 同步 article.tagIds 与 tag.usageCount
    articleStore.update(articleId, { tagIds: [...article.tagIds, tagId] });
    tagStore.update(tagId, { usageCount: tag.usageCount + 1 });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'tag.bind',
      payload: { articleId, tagId, actorId },
      timestamp: now,
    });
  }

  /** 解绑标签（对应 DD-010 unbindTag） */
  async unbindTag(articleId: string, tagId: string, actorId: string): Promise<void> {
    const article = articleStore.findById(articleId);
    if (!article) {
      throw new AppError(40401, `文章不存在: ${articleId}`, { articleId });
    }
    if (article.authorId !== actorId) {
      throw new AppError(40302, '所有权校验失败', { articleId, actorId, ownerId: article.authorId });
    }
    const set = articleTags.get(articleId);
    if (!set || !set.has(tagId)) return;
    set.delete(tagId);
    if (set.size === 0) articleTags.delete(articleId);
    const tag = tagStore.findById(tagId);
    if (tag) {
      tagStore.update(tagId, { usageCount: Math.max(0, tag.usageCount - 1) });
    }
    articleStore.update(articleId, { tagIds: article.tagIds.filter(t => t !== tagId) });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'tag.unbind',
      payload: { articleId, tagId, actorId },
      timestamp: now,
    });
  }

  /** 标签云（对应 DD-010 getTagCloud） */
  getTagCloud(limit: number): Tag[] {
    if (limit < 1 || limit > 100) {
      throw new AppError(40003, 'limit 必须 ∈ [1,100]', { limit });
    }
    const all = tagStore.list();
    return all
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /** 合并标签（对应 DD-010 mergeTags） */
  async mergeTags(sourceId: string, targetId: string, adminId: string): Promise<MergeResult> {
    if (sourceId === targetId) {
      throw new AppError(40003, 'source 与 target 不能相同', { sourceId, targetId });
    }
    const source = tagStore.findById(sourceId);
    if (!source) throw new AppError(40401, `标签不存在: ${sourceId}`, { sourceId });
    const target = tagStore.findById(targetId);
    if (!target) throw new AppError(40401, `标签不存在: ${targetId}`, { targetId });
    // 重定向：所有文章的 sourceId 替换为 targetId
    let redirectedCount = 0;
    for (const article of articleStore.listAll()) {
      if (article.tagIds.includes(sourceId)) {
        const newTagIds = article.tagIds.map(t => (t === sourceId ? targetId : t));
        // 去重
        const deduped = Array.from(new Set(newTagIds));
        articleStore.update(article.id, { tagIds: deduped });
        redirectedCount++;
        // 同步 articleTags
        const set = articleTags.get(article.id);
        if (set) {
          set.delete(sourceId);
          set.add(targetId);
        }
      }
    }
    // 标记 source 已合并
    tagStore.update(sourceId, { mergedToId: targetId });
    // target.usageCount += source.usageCount
    tagStore.update(targetId, { usageCount: target.usageCount + source.usageCount });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'tag.merge',
      payload: { sourceId, targetId, adminId, redirectedCount },
      timestamp: now,
    });
    return { sourceId, targetId, redirectedCount };
  }

  /** 按 ID 查询 */
  findById(id: string): Tag | null {
    return tagStore.findById(id);
  }

  /** 按名称查询 */
  findByName(name: string): Tag | null {
    const id = nameIndex.get(name);
    if (!id) return null;
    return tagStore.findById(id);
  }

  /** 测试重置 */
  static _reset(): void {
    tagStore.clear();
    nameIndex.clear();
    articleTags.clear();
  }
}
