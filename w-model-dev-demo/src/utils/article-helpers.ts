/**
 * 文章可见性检查器（DD-007-003 ArticleVisibilityChecker）。
 */
import type { Article, Role } from '../types.js';
import { ValidationError, AuthorizationError } from './errors.js';

export class ArticleVisibilityChecker {
  isVisible(article: Article, viewerRole: Role, viewerId?: string): boolean {
    if (article.status === 'published') return true;
    if (viewerRole === 'admin') return true;
    if (article.authorId === viewerId) return true;
    return false;
  }

  assertVisible(article: Article, viewerRole: Role, viewerId?: string): void {
    if (!this.isVisible(article, viewerRole, viewerId)) {
      throw new Error('文章不可见（草稿仅作者/管理员可见）');
    }
  }
}

/**
 * 文章归属检查器（DD-008-003 OwnershipChecker）。
 */
export class OwnershipChecker {
  assertOwner(resourceAuthorId: string, userId: string, userRole: string): void {
    if (userRole === 'admin') return;
    if (resourceAuthorId !== userId) {
      throw new AuthorizationError('无权操作他人资源');
    }
  }

  isOwner(resourceAuthorId: string, userId: string, userRole: string): boolean {
    if (userRole === 'admin') return true;
    return resourceAuthorId === userId;
  }
}

/**
 * 分类循环检查器（DD-014-003 CategoryCycleChecker）。
 * 与 L3_category_cycle_check.tla 一致：NoCycle 不变式。
 */
export class CategoryCycleChecker {
  check(
    categoryId: string,
    newParentId: string | null,
    allCategories: Map<string, { id: string; parentCategoryId: string | null }>,
  ): boolean {
    if (newParentId === null) return true;
    if (categoryId === newParentId) return false;
    let current: string | null = newParentId;
    const visited = new Set<string>([categoryId]);
    while (current !== null) {
      if (visited.has(current)) return false;
      visited.add(current);
      const cat = allCategories.get(current);
      if (!cat) break;
      current = cat.parentCategoryId;
    }
    return true;
  }

  assertNoCycle(
    categoryId: string,
    newParentId: string | null,
    allCategories: Map<string, { id: string; parentCategoryId: string | null }>,
  ): void {
    if (!this.check(categoryId, newParentId, allCategories)) {
      throw new Error('分类循环依赖（NoCycle 不变式违反）');
    }
  }
}

/**
 * 评论级联删除器（DD-009-003 CommentCascadeDeleter）。
 */
export class CommentCascadeDeleter {
  static collectCommentsToDelete(
    articleId: string,
    comments: Map<string, { id: string; articleId: string }>,
  ): string[] {
    const toDelete: string[] = [];
    for (const [id, comment] of comments) {
      if (comment.articleId === articleId) {
        toDelete.push(id);
      }
    }
    return toDelete;
  }
}

/**
 * 密码重置令牌工具（DD-016-004 PasswordResetTokenUtil）。
 * 与 L4_password_reset_token_lifecycle.tla 一致：OneTimeUse / TokenExpiry15min。
 */
export class PasswordResetTokenUtil {
  static readonly EXPIRY_MINUTES = 15;

  static generateExpiry(now: Date = new Date()): string {
    return new Date(now.getTime() + this.EXPIRY_MINUTES * 60 * 1000).toISOString();
  }

  static isExpired(expiresAt: string, now: Date = new Date()): boolean {
    return new Date(expiresAt).getTime() <= now.getTime();
  }

  static assertUsable(token: { used: boolean; expiresAt: string }, now: Date = new Date()): void {
    if (token.used) {
      throw new ValidationError('密码重置令牌已使用（OneTimeUse 不变式）');
    }
    if (this.isExpired(token.expiresAt, now)) {
      throw new ValidationError('密码重置令牌已过期（TokenExpiry15min 不变式）');
    }
  }
}
