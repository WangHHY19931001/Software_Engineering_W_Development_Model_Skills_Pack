/**
 * DD-017 SiteService —— 站点服务
 *
 * 站点配置、站点开关（维护/注册/评论）、站点统计概览。
 * 依赖：DD-024 WalWriter、DD-026 AuditLogger。
 */
import type { SiteConfig } from '../../types.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';
import type { AuditLogger } from '../../infrastructure/audit.js';
import { userStore } from '../../stores/user-store.js';
import { articleStore } from '../../stores/article-store.js';

export interface SiteOverview {
  userCount: number;
  articleCount: number;
  commentCount: number;
  pageView: number;
}

export type SwitchName = 'maintenance' | 'registration' | 'comment';

const VALID_SWITCHES: ReadonlySet<SwitchName> = new Set(['maintenance', 'registration', 'comment']);

export interface SiteServiceDeps {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
}

export class SiteService {
  private config: SiteConfig = {
    switches: {
      maintenance: false,
      registration: true,
      comment: true,
    },
  };
  private deps: SiteServiceDeps;
  private pageView = 0;

  constructor(deps: SiteServiceDeps) {
    this.deps = deps;
  }

  /** 获取配置（对应 DD-017 getConfig） */
  getConfig(): SiteConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /** 更新配置（对应 DD-017 updateConfig） */
  async updateConfig(patch: Partial<SiteConfig>, adminId: string): Promise<SiteConfig> {
    this.config = { ...this.config, ...patch, switches: { ...this.config.switches, ...(patch.switches ?? {}) } };
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'site.updateConfig',
      payload: this.config,
      timestamp: now,
    });
    await this.deps.auditLogger.log('site.updateConfig', adminId, 'site', { patch });
    return this.getConfig();
  }

  /** 设置开关（对应 DD-017 setSwitch） */
  async setSwitch(name: SwitchName, value: boolean, adminId: string): Promise<void> {
    if (!VALID_SWITCHES.has(name)) {
      throw new AppError(40003, `非法开关名: ${name}`, { name, valid: Array.from(VALID_SWITCHES) });
    }
    this.config.switches[name] = value;
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'site.setSwitch',
      payload: { name, value, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('site.setSwitch', adminId, name, { value });
  }

  /** 站点统计概览（对应 DD-017 getOverview） */
  getOverview(): SiteOverview {
    return {
      userCount: userStore.count(),
      articleCount: articleStore.count(),
      commentCount: 0, // 由 CommentService 注入或重新查询
      pageView: this.pageView,
    };
  }

  /** 是否开启注册（供 UserService 调用，避免循环依赖） */
  isRegistrationOpen(): boolean {
    return !this.config.switches.maintenance && this.config.switches.registration;
  }

  /** 是否开启评论（供 CommentService 调用） */
  isCommentOpen(): boolean {
    return !this.config.switches.maintenance && this.config.switches.comment;
  }

  /** 增加页面浏览量 */
  incrementPageView(): void {
    this.pageView++;
  }

  /** 测试重置 */
  _reset(): void {
    this.config = {
      switches: { maintenance: false, registration: true, comment: true },
    };
    this.pageView = 0;
  }
}
