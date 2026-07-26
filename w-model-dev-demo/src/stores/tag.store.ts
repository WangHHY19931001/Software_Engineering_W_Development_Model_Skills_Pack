/**
 * TagStore（DD-013-003）— 标签存储 + name 唯一索引。
 */
import type { Tag } from '../types.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';

export class TagStore {
  private tags: Map<string, Tag> = new Map();
  private nameIndex: Map<string, string> = new Map();

  insert(tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Tag {
    const name = tag.name.toLowerCase();
    if (this.nameIndex.has(name)) {
      throw new ConflictError('标签名已存在');
    }
    const now = new Date().toISOString();
    const record: Tag = {
      id: tag.id ?? generateId('tag'),
      name: tag.name,
      createdAt: now,
      updatedAt: now,
    };
    this.tags.set(record.id, record);
    this.nameIndex.set(name, record.id);
    return record;
  }

  findById(id: string): Tag | undefined {
    return this.tags.get(id);
  }

  findByName(name: string): Tag | undefined {
    const id = this.nameIndex.get(name.toLowerCase());
    if (!id) return undefined;
    return this.tags.get(id);
  }

  update(id: string, patch: Partial<Pick<Tag, 'name'>>): Tag {
    const tag = this.tags.get(id);
    if (!tag) throw new NotFoundError('标签');
    if (patch.name !== undefined) {
      const newName = patch.name.toLowerCase();
      if (newName !== tag.name.toLowerCase() && this.nameIndex.has(newName)) {
        throw new ConflictError('标签名已存在');
      }
      this.nameIndex.delete(tag.name.toLowerCase());
      this.nameIndex.set(newName, id);
    }
    const updated: Tag = {
      ...tag,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.tags.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    const tag = this.tags.get(id);
    if (!tag) return false;
    this.nameIndex.delete(tag.name.toLowerCase());
    return this.tags.delete(id);
  }

  list(): Tag[] {
    return [...this.tags.values()];
  }

  size(): number {
    return this.tags.size;
  }

  clear(): void {
    this.tags.clear();
    this.nameIndex.clear();
  }
}
