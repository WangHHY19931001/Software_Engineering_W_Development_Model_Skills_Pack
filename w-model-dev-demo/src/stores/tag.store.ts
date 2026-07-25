// SD-008 TagStore.

import { TagStatus, type Tag } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { tagNameSchema, tagSlugSchema } from '../utils/schemas.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t-${counter}`;
}

export class TagStore {
  private tags = new Map<string, Tag>();
  private slugToId = new Map<string, string>();
  private articleIdToTags = new Map<string, Set<string>>();
  private tagIdToArticles = new Map<string, Set<string>>();

  size(): number {
    return this.tags.size;
  }

  getById(id: string): Tag | null {
    const t = this.tags.get(id);
    if (!t || t.deleted) return null;
    return { ...t };
  }

  getBySlug(slug: string): Tag | null {
    const id = this.slugToId.get(slug);
    if (!id) return null;
    return this.getById(id);
  }

  hasSlug(slug: string): boolean {
    return this.slugToId.has(slug);
  }

  create(name: string, slug: string): Tag {
    if (!tagNameSchema.safeParse(name).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (!tagSlugSchema.safeParse(slug).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (this.slugToId.has(slug)) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const now = new Date();
    const tag: Tag = {
      id: nextId(),
      name,
      slug,
      articleCount: 0,
      status: TagStatus.PendingReview,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };
    this.tags.set(tag.id, tag);
    this.slugToId.set(slug, tag.id);
    return { ...tag };
  }

  approve(tagId: string): Tag {
    const t = this.tags.get(tagId);
    if (!t) throw new AppError(ErrorCode.NotFound, '1031');
    if (t.status !== TagStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    t.status = TagStatus.Approved;
    t.updatedAt = new Date();
    return { ...t };
  }

  reject(tagId: string): Tag {
    const t = this.tags.get(tagId);
    if (!t) throw new AppError(ErrorCode.NotFound, '1031');
    if (t.status !== TagStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    t.status = TagStatus.Rejected;
    t.updatedAt = new Date();
    return { ...t };
  }

  bind(articleId: string, tagIds: string[]): void {
    if (tagIds.length > 10) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    for (const tagId of tagIds) {
      const t = this.tags.get(tagId);
      if (!t || t.deleted) {
        throw new AppError(ErrorCode.NotFound, '1031');
      }
      if (t.status !== TagStatus.Approved) {
        throw new AppError(ErrorCode.StateMachineIllegal, '1002');
      }
    }
    for (const tagId of tagIds) {
      this.indexAdd(this.articleIdToTags, articleId, tagId);
      this.indexAdd(this.tagIdToArticles, tagId, articleId);
      const t = this.tags.get(tagId);
      if (t) t.articleCount += 1;
    }
  }

  unbind(articleId: string, tagIds: string[]): void {
    for (const tagId of tagIds) {
      this.indexRemove(this.articleIdToTags, articleId, tagId);
      this.indexRemove(this.tagIdToArticles, tagId, articleId);
      const t = this.tags.get(tagId);
      if (t && t.articleCount > 0) t.articleCount -= 1;
    }
  }

  getTagsForArticle(articleId: string): Tag[] {
    const set = this.articleIdToTags.get(articleId);
    if (!set) return [];
    const out: Tag[] = [];
    for (const id of set) {
      const t = this.tags.get(id);
      if (t && !t.deleted) out.push({ ...t });
    }
    return out;
  }

  getArticlesForTag(tagId: string): string[] {
    const set = this.tagIdToArticles.get(tagId);
    return set ? Array.from(set) : [];
  }

  cloud(topN: number): Array<{ tagId: string; name: string; articleCount: number }> {
    const all = Array.from(this.tags.values()).filter((t) => !t.deleted);
    return all
      .sort((a, b) => b.articleCount - a.articleCount)
      .slice(0, topN)
      .map((t) => ({ tagId: t.id, name: t.name, articleCount: t.articleCount }));
  }

  merge(sourceId: string, targetId: string): void {
    if (sourceId === targetId) {
      throw new AppError(ErrorCode.SelfReference, '1003');
    }
    const source = this.tags.get(sourceId);
    const target = this.tags.get(targetId);
    if (!source || !target) throw new AppError(ErrorCode.NotFound, '1031');
    if (source.deleted || target.deleted) throw new AppError(ErrorCode.NotFound, '1031');
    if (source.status !== TagStatus.Approved || target.status !== TagStatus.Approved) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    // Migrate articles.
    const articleIds = this.getArticlesForTag(sourceId);
    for (const articleId of articleIds) {
      this.indexRemove(this.articleIdToTags, articleId, sourceId);
      this.indexRemove(this.tagIdToArticles, sourceId, articleId);
      // Bind to target if not already.
      const targetArticles = this.tagIdToArticles.get(targetId);
      if (!targetArticles || !targetArticles.has(articleId)) {
        this.indexAdd(this.articleIdToTags, articleId, targetId);
        this.indexAdd(this.tagIdToArticles, targetId, articleId);
        target.articleCount += 1;
      }
    }
    source.articleCount = 0;
    source.deleted = true;
    source.updatedAt = new Date();
    if (source.slug) this.slugToId.delete(source.slug);
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  private indexRemove<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }

  clear(): void {
    this.tags.clear();
    this.slugToId.clear();
    this.articleIdToTags.clear();
    this.tagIdToArticles.clear();
  }
}
