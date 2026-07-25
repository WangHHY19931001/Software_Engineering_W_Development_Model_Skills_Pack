// SD-005 AdStore + AdService unit tests (TC-UNIT-020 ~ TC-UNIT-023).

import { describe, it, expect, beforeEach } from 'vitest';
import { AdStore } from '../../src/stores/ad.store.js';
import { AdService } from '../../src/services/ad.service.js';
import { AdStatus } from '../../src/types.js';
import { AppError } from '../../src/utils/errors.js';

describe('SD-005 AdStore + AdService (TC-UNIT-020 ~ 023)', () => {
  let adStore: AdStore;
  let adService: AdService;

  beforeEach(() => {
    adStore = new AdStore();
    adService = new AdService(adStore);
  });

  function makeAdInput(slotId: string, startAt: Date, endAt: Date) {
    return {
      slotId,
      title: 'ad-title',
      imageUrl: 'https://example.com/img.png',
      targetUrl: 'https://example.com/target',
      startAt,
      endAt,
    };
  }

  it('TC-UNIT-020: ad time overlap throws 1005', () => {
    const start1 = new Date(2024, 0, 1);
    const end1 = new Date(2024, 0, 10);
    adStore.create('admin-1', makeAdInput('slot-1', start1, end1), 'admin');

    const overlappingStart = new Date(2024, 0, 5);
    const overlappingEnd = new Date(2024, 0, 15);
    expect(() =>
      adStore.create('admin-1', makeAdInput('slot-1', overlappingStart, overlappingEnd), 'admin'),
    ).toThrow(AppError);
    try {
      adStore.create('admin-1', makeAdInput('slot-1', overlappingStart, overlappingEnd), 'admin');
    } catch (err) {
      expect((err as AppError).code).toBe(1005);
    }
  });

  it('TC-UNIT-021: ad audit illegal state transition throws 1002', () => {
    const ad = adStore.create(
      'admin-1',
      makeAdInput('slot-1', new Date(2024, 0, 1), new Date(2024, 0, 10)),
      'admin',
    );
    // Move ad to Rejected status.
    ad.status = AdStatus.Rejected;
    adStore.update(ad);

    expect(() => adService.audit('admin-1', 'admin', ad.id, 'approve')).toThrow(AppError);
    try {
      adService.audit('admin-1', 'admin', ad.id, 'approve');
    } catch (err) {
      expect((err as AppError).code).toBe(1002);
    }
  });

  it('TC-UNIT-022: ad click count increments when approved and in window', () => {
    const start = new Date(Date.now() - 60_000);
    const end = new Date(Date.now() + 60_000);
    const ad = adStore.create('admin-1', makeAdInput('slot-1', start, end), 'admin');
    // Approve the ad.
    ad.status = AdStatus.Approved;
    adStore.update(ad);

    adService.recordClick(ad.id);
    const updated = adStore.getById(ad.id);
    expect(updated?.clickCount).toBe(1);
  });

  it('TC-UNIT-023: ad list pagination returns correct page and total', () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 10);
    // Create 25 ads in different slots to avoid overlap.
    for (let i = 0; i < 25; i++) {
      adStore.create('admin-1', makeAdInput(`slot-${i}`, start, end), 'admin');
    }

    const result = adService.listBySlot('slot-0', 1, 10);
    // slot-0 has only 1 ad; verify pagination math for that slot (page 1).
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);

    // Cross-check pagination math with multiple ads in same slot (non-overlapping time windows).
    const slot = 'multi-slot';
    for (let i = 0; i < 25; i++) {
      const s = new Date(2024, i + 1, 1);
      const e = new Date(2024, i + 1, 10);
      adStore.create('admin-1', makeAdInput(slot, s, e), 'admin');
    }
    const page2 = adService.listBySlot(slot, 2, 10);
    expect(page2.items).toHaveLength(10);
    expect(page2.total).toBe(25);
  });
});
