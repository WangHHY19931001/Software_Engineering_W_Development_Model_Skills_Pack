// SD-001 SiteService.

import type { SiteConfig, SiteStatsOverview } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { announcementSchema } from '../utils/schemas.js';
import { appendAuditLog, invariant } from '../utils/logger.js';
import type { SiteStore } from '../stores/site.store.js';

export class SiteService {
  constructor(private siteStore: SiteStore) {}

  /** Enter maintenance mode (admin only). TLA+ L2_operations_support.enterMaintenance */
  enterMaintenance(operatorId: string, operatorRole: string): void {
    invariant(!!operatorId, 'operatorId required');
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.siteStore.setMaintenanceMode(true);
    appendAuditLog(operatorId, 'enterMaintenance', 'site');
  }

  /** Exit maintenance mode (admin only). TLA+ L2_operations_support.exitMaintenance */
  exitMaintenance(operatorId: string, operatorRole: string): void {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.siteStore.setMaintenanceMode(false);
    appendAuditLog(operatorId, 'exitMaintenance', 'site');
  }

  setMaintenanceMode(operatorId: string, operatorRole: string, enabled: boolean): void {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.siteStore.setMaintenanceMode(enabled);
    appendAuditLog(operatorId, 'setMaintenanceMode', 'site');
  }

  /** Refuse non-admin requests when site is in maintenance mode. */
  requireNotMaintenance(userRole: string): void {
    const cfg = this.siteStore.getConfig();
    if (cfg.maintenanceMode && userRole !== 'admin') {
      const err = new AppError(ErrorCode.Maintenance, '1023');
      throw err;
    }
  }

  /** Create announcement (admin only). TLA+ L2_operations_support.createAnnouncement */
  createAnnouncement(operatorId: string, operatorRole: string, text: string, at: Date): void {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const parsed = announcementSchema.safeParse({ text, at });
    if (!parsed.success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    this.siteStore.setAnnouncement(text, at);
    appendAuditLog(operatorId, 'createAnnouncement', 'site');
  }

  /** scheduleAnnouncement alias (matches detailed-design method name). */
  scheduleAnnouncement(operatorId: string, operatorRole: string, text: string, at: Date): void {
    this.createAnnouncement(operatorId, operatorRole, text, at);
  }

  /** publishAnnouncement — fires when at <= now. */
  publishAnnouncement(operatorId: string, operatorRole: string): void {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const cfg = this.siteStore.getConfig();
    if (!cfg.announcementAt) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (cfg.announcementAt.getTime() > Date.now()) {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    appendAuditLog(operatorId, 'publishAnnouncement', 'site');
  }

  /** archiveAnnouncement — clears announcement field. */
  archiveAnnouncement(operatorId: string, operatorRole: string): void {
    if (operatorRole !== 'admin') {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.siteStore.setAnnouncement('', new Date(0));
    appendAuditLog(operatorId, 'archiveAnnouncement', 'site');
  }

  updateConfig(operatorId: string, operatorRole: string, patch: Partial<SiteConfig>): SiteConfig {
    return this.siteStore.updateConfig(operatorId, patch, operatorRole);
  }

  getConfig(): SiteConfig {
    return this.siteStore.getConfig();
  }

  getStatsOverview(): SiteStatsOverview {
    return this.siteStore.getStatsOverview();
  }
}
