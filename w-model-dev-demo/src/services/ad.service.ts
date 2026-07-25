// SD-005 AdService.

import { AdStatus, UserRole, type Ad, type AdInput, type Page } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { AdStore } from '../stores/ad.store.js';
import { appendAuditLog } from '../utils/logger.js';

export class AdService {
  constructor(private adStore: AdStore) {}

  /** adCreate — TLA+ L2_discovery.adCreate */
  adCreate(operatorId: string, operatorRole: string, input: AdInput): Ad {
    return this.adStore.create(operatorId, input, operatorRole);
  }

  create(operatorId: string, operatorRole: string, input: AdInput): Ad {
    return this.adCreate(operatorId, operatorRole, input);
  }

  /** adApprove — TLA+ L2_discovery.adApprove. pending_review → approved | rejected */
  adApprove(operatorId: string, operatorRole: string, adId: string, decision: 'approve' | 'reject'): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const ad = this.adStore.getById(adId);
    if (!ad) throw new AppError(ErrorCode.NotFound, '1031');
    if (ad.status !== AdStatus.PendingReview) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    ad.status = decision === 'approve' ? AdStatus.Approved : AdStatus.Rejected;
    this.adStore.update(ad);
    appendAuditLog(operatorId, 'adApprove', adId);
  }

  /** audit — alias matching SD-005 design. */
  audit(operatorId: string, operatorRole: string, adId: string, decision: 'approve' | 'reject'): void {
    this.adApprove(operatorId, operatorRole, adId, decision);
  }

  /** adImpress — TLA+ L2_discovery.adImpress. Increment impressCount when in window. */
  adImpress(adId: string): void {
    const ad = this.adStore.getById(adId);
    if (!ad) throw new AppError(ErrorCode.NotFound, '1031');
    if (ad.status !== AdStatus.Approved) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    const now = Date.now();
    if (now < ad.startAt.getTime() || now > ad.endAt.getTime()) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    ad.impressCount += 1;
    this.adStore.update(ad);
  }

  /** adClick — TLA+ L2_discovery.adClick. Increment clickCount when in window. */
  adClick(adId: string): void {
    const ad = this.adStore.getById(adId);
    if (!ad) throw new AppError(ErrorCode.NotFound, '1031');
    if (ad.status !== AdStatus.Approved) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    const now = Date.now();
    if (now < ad.startAt.getTime() || now > ad.endAt.getTime()) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    ad.clickCount += 1;
    this.adStore.update(ad);
  }

  /** recordClick — alias matching SD-005 design. */
  recordClick(adId: string): void {
    this.adClick(adId);
  }

  listBySlot(slotId: string, page: number, pageSize: number): Page<Ad> {
    if (page < 1 || pageSize < 1) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const result = this.adStore.listBySlotPaged(slotId, page, pageSize);
    return { items: result.items, total: result.total, page, pageSize };
  }
}
