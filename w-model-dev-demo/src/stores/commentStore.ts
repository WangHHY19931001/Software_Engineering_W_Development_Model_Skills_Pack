/**
 * CommentStore（DD-021）：Comment 实体存储（树形 parentId），按文章分页查询（createdAt 降序）。
 */
import { SnapshotStore, nextId, assertPage } from './base';
import type { Comment, Page } from '../types';

interface CommentState {
  map: Map<string, Comment>;
  byArticle: Map<string, Set<string>>;
  byParent: Map<string, Set<string>>;
  seq: { n: number };
}

export type CommentCreateInput = Omit<Comment, 'id'> & { id?: string };

export class CommentStore extends SnapshotStore<CommentState> {
  protected state: CommentState = { map: new Map(), byArticle: new Map(), byParent: new Map(), seq: { n: 0 } };

  create(comment: CommentCreateInput): Comment {
    const id = comment.id ?? nextId('cm', this.state.seq);
    const record: Comment = {
      id,
      articleId: comment.articleId,
      authorId: comment.authorId,
      parentId: comment.parentId ?? null,
      content: comment.content,
      createdAt: comment.createdAt,
    };
    this.state.map.set(id, record);
    this.addSet(this.state.byArticle, record.articleId, id);
    if (record.parentId) this.addSet(this.state.byParent, record.parentId, id);
    return record;
  }

  findById(id: string): Comment | null {
    return this.state.map.get(id) ?? null;
  }

  findAll(): Comment[] {
    return [...this.state.map.values()];
  }

  /** 文章评论分页（createdAt 降序） */
  listByArticle(articleId: string, page: number, pageSize: number): Page<Comment> {
    assertPage(page, pageSize);
    const ids = this.state.byArticle.get(articleId) ?? new Set<string>();
    const items = [...ids]
      .map((id) => this.state.map.get(id))
      .filter((c): c is Comment => c !== undefined)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  }

  /** 回复列表（级联删除用） */
  listReplies(commentId: string): Comment[] {
    const ids = this.state.byParent.get(commentId) ?? new Set<string>();
    return [...ids].map((id) => this.state.map.get(id)).filter((c): c is Comment => c !== undefined);
  }

  /** 按文章 id 组聚合评论数（统计面板，DD-021 countByArticleIds） */
  countByArticleIds(articleIds: string[]): Map<string, number> {
    const result = new Map<string, number>();
    for (const id of articleIds) result.set(id, 0);
    for (const c of this.state.map.values()) {
      if (result.has(c.articleId)) result.set(c.articleId, (result.get(c.articleId) ?? 0) + 1);
    }
    return result;
  }

  /** 删除评论（级联：回复一并删除） */
  delete(id: string): void {
    const comment = this.state.map.get(id);
    if (!comment) return;
    const replies = this.listReplies(id);
    for (const reply of replies) this.delete(reply.id);
    this.removeSet(this.state.byArticle, comment.articleId, id);
    if (comment.parentId) this.removeSet(this.state.byParent, comment.parentId, id);
    this.state.map.delete(id);
  }

  private addSet(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  }

  private removeSet(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (!set) return;
    set.delete(value);
    if (set.size === 0) map.delete(key);
  }
}
