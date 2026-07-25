// SD-013 CrossReferenceStore.

import type { CrossReference } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `xr-${counter}`;
}

export class CrossReferenceStore {
  private crossRefs = new Map<string, CrossReference>();
  private fromArticleToRefs = new Map<string, Set<string>>();
  private toArticleToBackrefs = new Map<string, Set<string>>();

  size(): number {
    return this.crossRefs.size;
  }

  exists(fromArticleId: string, toArticleId: string): boolean {
    for (const ref of this.crossRefs.values()) {
      if (ref.fromArticleId === fromArticleId && ref.toArticleId === toArticleId) {
        return true;
      }
    }
    return false;
  }

  create(fromArticleId: string, toArticleId: string, articleStatus: (id: string) => string): CrossReference {
    if (fromArticleId === toArticleId) {
      throw new AppError(ErrorCode.SelfReference, '1003');
    }
    if (articleStatus(fromArticleId) !== 'published' || articleStatus(toArticleId) !== 'published') {
      throw new AppError(ErrorCode.StateMachineIllegal, '1002');
    }
    if (this.exists(fromArticleId, toArticleId)) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const now = new Date();
    const ref: CrossReference = {
      id: nextId(),
      fromArticleId,
      toArticleId,
      createdAt: now,
      updatedAt: now,
    };
    this.crossRefs.set(ref.id, ref);
    this.indexAdd(this.fromArticleToRefs, fromArticleId, ref.id);
    this.indexAdd(this.toArticleToBackrefs, toArticleId, ref.id);
    return { ...ref };
  }

  backlinks(articleId: string): Array<{ fromArticleId: string; refId: string }> {
    const set = this.toArticleToBackrefs.get(articleId);
    if (!set) return [];
    const out: Array<{ fromArticleId: string; refId: string }> = [];
    for (const id of set) {
      const r = this.crossRefs.get(id);
      if (r) out.push({ fromArticleId: r.fromArticleId, refId: r.id });
    }
    return out;
  }

  outlinks(articleId: string): Array<{ toArticleId: string; refId: string }> {
    const set = this.fromArticleToRefs.get(articleId);
    if (!set) return [];
    const out: Array<{ toArticleId: string; refId: string }> = [];
    for (const id of set) {
      const r = this.crossRefs.get(id);
      if (r) out.push({ toArticleId: r.toArticleId, refId: r.id });
    }
    return out;
  }

  private indexAdd<K>(map: Map<K, Set<string>>, key: K, value: string): void {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }

  clear(): void {
    this.crossRefs.clear();
    this.fromArticleToRefs.clear();
    this.toArticleToBackrefs.clear();
  }
}
