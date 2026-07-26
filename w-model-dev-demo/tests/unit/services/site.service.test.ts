import { describe, it, expect, beforeEach } from 'vitest';
import { SiteService } from '../../../src/services/site.service.js';
import { SiteStore } from '../../../src/stores/site.store.js';

describe('SiteService (DD-001-001)', () => {
  let store: SiteStore;
  let svc: SiteService;
  beforeEach(() => { store = new SiteStore(); svc = new SiteService(store); });

  it('TC-UNIT-001N: health 返回 status=ok + uptime', () => {
    const h = svc.health();
    expect(h.status).toBe('ok');
    expect(h.uptime).toBeGreaterThanOrEqual(0);
    expect(h.timestamp).toBeTruthy();
  });

  it('TC-UNIT-001E: getStats 返回初始 0 统计', () => {
    const s = svc.getStats();
    expect(s.totalUsers).toBe(0);
  });

  it('TC-UNIT-001B: refreshStats 更新统计', () => {
    const s = svc.refreshStats(10, 20, 30, 40);
    expect(s.totalUsers).toBe(10);
    expect(s.totalArticles).toBe(20);
    expect(s.totalComments).toBe(30);
    expect(s.totalLikes).toBe(40);
  });
});
