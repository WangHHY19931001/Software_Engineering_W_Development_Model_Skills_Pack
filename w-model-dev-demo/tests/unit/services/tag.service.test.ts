import { describe, it, expect, beforeEach } from 'vitest';
import { TagService } from '../../../src/services/tag.service.js';
import { TagStore } from '../../../src/stores/tag.store.js';
import { NotFoundError } from '../../../src/utils/errors.js';

describe('TagService (DD-013-002)', () => {
  let store: TagStore;
  let svc: TagService;
  beforeEach(() => { store = new TagStore(); svc = new TagService(store); });

  it('TC-UNIT-041N: create + list 正常往返', () => {
    const t = svc.create('TS');
    expect(t.id).toBeTruthy();
    expect(svc.list()).toHaveLength(1);
  });

  it('TC-UNIT-041E: update 不存在抛 NotFoundError', () => {
    expect(() => svc.update('missing', 'x')).toThrow(NotFoundError);
  });

  it('TC-UNIT-041B: remove 不存在抛 NotFoundError', () => {
    expect(() => svc.remove('missing')).toThrow(NotFoundError);
  });

  it('findById 委托 store', () => {
    const t = svc.create('TS');
    expect(svc.findById(t.id)?.name).toBe('TS');
  });
});
