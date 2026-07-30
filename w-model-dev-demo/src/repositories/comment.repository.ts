/**
 * 评论仓储 - 含评论树构建
 */
import { BaseRepository } from './base.repository.js';
import { CommentStatus, type Comment, type CommentNode } from '../types/index.js';

export class CommentRepository extends BaseRepository<Comment> {
  async findByPost(postId: string): Promise<Comment[]> {
    return this.findBy((c) => c.postId === postId);
  }

  async findByAuthor(authorId: string): Promise<Comment[]> {
    return this.findBy((c) => c.authorId === authorId);
  }

  async findReplies(parentId: string): Promise<Comment[]> {
    return this.findBy((c) => c.parentId === parentId);
  }

  async findVisibleByPost(postId: string): Promise<Comment[]> {
    return this.findBy(
      (c) => c.postId === postId && c.status === CommentStatus.VISIBLE,
    );
  }

  /**
   * 构建评论树（按 createdAt 升序）
   */
  async buildTree(postId: string): Promise<CommentNode[]> {
    const all = await this.findVisibleByPost(postId);
    all.sort((a, b) => a.createdAt - b.createdAt);
    const map = new Map<string, CommentNode>();
    for (const c of all) {
      map.set(c.id, { ...c, children: [] });
    }
    const roots: CommentNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        const parent = map.get(node.parentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async softDelete(id: string): Promise<Comment | null> {
    return this.update(id, {
      status: CommentStatus.DELETED,
      updatedAt: Date.now(),
    } as unknown as Partial<Comment>);
  }

  async countByPost(postId: string): Promise<number> {
    return this.findBy((c) => c.postId === postId).then((arr) => arr.length);
  }
}
