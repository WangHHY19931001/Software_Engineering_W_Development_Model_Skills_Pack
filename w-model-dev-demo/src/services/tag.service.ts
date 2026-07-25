// SD-008 TagService.

import { UserRole, type Tag } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { TagStore } from '../stores/tag.store.js';
import { topNSchema } from '../utils/schemas.js';
import { appendAuditLog } from '../utils/logger.js';

export class TagService {
  constructor(private tagStore: TagStore) {}

  /** createTag — TLA+ L2_content_management.createTag */
  createTag(name: string, slug: string): Tag {
    return this.tagStore.create(name, slug);
  }

  /** approveTag — TLA+ L2_content_management.approveTag */
  approveTag(operatorId: string, operatorRole: string, tagId: string): Tag {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const tag = this.tagStore.approve(tagId);
    appendAuditLog(operatorId, 'approveTag', tagId);
    return tag;
  }

  rejectTag(_operatorId: string, operatorRole: string, tagId: string): Tag {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    return this.tagStore.reject(tagId);
  }

  /** bindTag — TLA+ L2_content_management.bindTag */
  bindTag(articleId: string, tagIds: string[]): void {
    this.tagStore.bind(articleId, tagIds);
  }

  /** bind — alias matching SD-008 design. */
  bind(articleId: string, tagIds: string[]): void {
    this.bindTag(articleId, tagIds);
  }

  unbind(articleId: string, tagIds: string[]): void {
    this.tagStore.unbind(articleId, tagIds);
  }

  cloud(topN: number): Array<{ tagId: string; name: string; articleCount: number }> {
    if (!topNSchema.safeParse(topN).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    return this.tagStore.cloud(topN);
  }

  /** merge — TLA+ L2 merge. */
  merge(operatorId: string, operatorRole: string, sourceId: string, targetId: string): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.tagStore.merge(sourceId, targetId);
    appendAuditLog(operatorId, 'mergeTag', `${sourceId}->${targetId}`);
  }
}
