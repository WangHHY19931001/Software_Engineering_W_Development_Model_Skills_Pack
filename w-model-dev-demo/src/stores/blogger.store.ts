// SD-002 BloggerStore.

import type { Blogger } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { slugSchema } from '../utils/schemas.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `b-${counter}`;
}

export class BloggerStore {
  private bloggers = new Map<string, Blogger>();
  private userIdToBloggerId = new Map<string, string>();
  private slugToId = new Map<string, string>();

  size(): number {
    return this.bloggers.size;
  }

  get(slug: string): Blogger | undefined {
    return this.bloggers.get(slug);
  }

  getBySlug(slug: string): Blogger | null {
    const id = this.slugToId.get(slug);
    if (!id) return null;
    const b = this.bloggers.get(id);
    return b ?? null;
  }

  getByUserId(userId: string): Blogger | null {
    const id = this.userIdToBloggerId.get(userId);
    if (!id) return null;
    const b = this.bloggers.get(id);
    return b ?? null;
  }

  getById(id: string): Blogger | null {
    return this.bloggers.get(id) ?? null;
  }

  hasSlug(slug: string): boolean {
    return this.slugToId.has(slug);
  }

  create(userId: string, slug: string, bio: string, userRole?: string): Blogger {
    const slugResult = slugSchema.safeParse(slug);
    if (!slugResult.success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (userRole && userRole !== 'blogger' && userRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (this.slugToId.has(slug)) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    if (this.userIdToBloggerId.has(userId)) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const now = new Date();
    const blogger: Blogger = {
      id: nextId(),
      userId,
      slug,
      bio: bio ?? '',
      followerCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.bloggers.set(blogger.id, blogger);
    this.slugToId.set(slug, blogger.id);
    this.userIdToBloggerId.set(userId, blogger.id);
    return { ...blogger };
  }

  update(blogger: Blogger): Blogger {
    const existing = this.bloggers.get(blogger.id);
    if (!existing) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    const updated = { ...blogger, updatedAt: new Date() };
    this.bloggers.set(blogger.id, updated);
    return { ...updated };
  }

  list(page: number, pageSize: number): { items: Blogger[]; total: number } {
    const all = Array.from(this.bloggers.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items: items.map((b) => ({ ...b })), total: all.length };
  }

  listByFollower(_followerId: string, page: number, pageSize: number): { items: Blogger[]; total: number } {
    // Follower relationship is held by SubscriptionStore; BloggerStore delegates.
    // This method exists for SD-002 listing API. Caller should pass filtered ids via list().
    return this.list(page, pageSize);
  }

  incrementFollowers(bloggerId: string): void {
    const b = this.bloggers.get(bloggerId);
    if (!b) throw new AppError(ErrorCode.NotFound, '1031');
    b.followerCount += 1;
  }

  decrementFollowers(bloggerId: string): void {
    const b = this.bloggers.get(bloggerId);
    if (!b) throw new AppError(ErrorCode.NotFound, '1031');
    if (b.followerCount > 0) b.followerCount -= 1;
  }

  clear(): void {
    this.bloggers.clear();
    this.userIdToBloggerId.clear();
    this.slugToId.clear();
  }
}
