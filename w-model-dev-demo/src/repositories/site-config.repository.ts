/**
 * 站点配置仓储 - 单例存储
 */
import { BaseRepository } from './base.repository.js';
import type { SiteConfig } from '../types/index.js';

export const SITE_CONFIG_ID = 'site_config_singleton';

export class SiteConfigRepository extends BaseRepository<SiteConfig> {
  async getSingleton(): Promise<SiteConfig | null> {
    return this.findById(SITE_CONFIG_ID);
  }

  async upsert(config: SiteConfig): Promise<SiteConfig> {
    const exists = await this.exists(SITE_CONFIG_ID);
    if (exists) {
      return this.update(SITE_CONFIG_ID, config);
    }
    return this.create({ ...config, id: SITE_CONFIG_ID });
  }
}
