/**
 * TagService（DD-013-002）。
 */
import type { Tag } from '../types.js';
import type { TagStore } from '../stores/tag.store.js';
import { NotFoundError } from '../utils/errors.js';

export class TagService {
  constructor(private tagStore: TagStore) {}

  create(name: string): Tag {
    return this.tagStore.insert({ name });
  }

  list(): Tag[] {
    return this.tagStore.list();
  }

  findById(id: string): Tag | undefined {
    return this.tagStore.findById(id);
  }

  update(id: string, name: string): Tag {
    const tag = this.tagStore.findById(id);
    if (!tag) throw new NotFoundError('标签');
    return this.tagStore.update(id, { name });
  }

  remove(id: string): void {
    if (!this.tagStore.findById(id)) throw new NotFoundError('标签');
    this.tagStore.delete(id);
  }
}
