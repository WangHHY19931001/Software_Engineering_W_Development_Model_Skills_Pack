/**
 * DD-021 CtrCalculator —— 广告 CTR 统计
 *
 * 记录展示/点击数，计算 CTR（clicks/impressions，除零保护）。
 */

export interface CtrStats {
  adId: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export class CtrCalculator {
  private impressions: Map<string, number> = new Map();
  private clicks: Map<string, number> = new Map();

  /** 记录展示（对应 DD-021 recordImpression） */
  recordImpression(adId: string): void {
    const current = this.impressions.get(adId) ?? 0;
    this.impressions.set(adId, current + 1);
  }

  /** 记录点击（对应 DD-021 recordClick） */
  recordClick(adId: string): void {
    const current = this.clicks.get(adId) ?? 0;
    this.clicks.set(adId, current + 1);
  }

  /** 计算 CTR（对应 DD-021 calculateCtr，除零保护） */
  calculateCtr(adId: string): number {
    const impressions = this.impressions.get(adId) ?? 0;
    const clicks = this.clicks.get(adId) ?? 0;
    if (impressions === 0) return 0;
    return clicks / impressions;
  }

  /** 统计详情（对应 DD-021 getStats） */
  getStats(adId: string): CtrStats {
    const impressions = this.impressions.get(adId) ?? 0;
    const clicks = this.clicks.get(adId) ?? 0;
    return {
      adId,
      impressions,
      clicks,
      ctr: impressions === 0 ? 0 : clicks / impressions,
    };
  }

  /** 重置某广告的统计 */
  reset(adId: string): void {
    this.impressions.delete(adId);
    this.clicks.delete(adId);
  }
}
