/**
 * TagStore（DD-012）：Tag 实体存储，name 唯一索引（重名 40901）。
 */
import { BizError } from '../utils/errors';
import { SnapshotStore, nextId } from './base';
import type { Tag } from '../types';

interface TagState {
  map: Map<string, Tag>;
  nameIndex: Map<string, string>;
  seq: { n: number };
}

export type TagCreateInput = Omit<Tag, 'id'> & { id?: string };

export class TagStore extends SnapshotStore<TagState> {
  protected state: TagState = { map: new Map(), nameIndex: new Map(), seq: { n: 0 } };

  create(tag: TagCreateInput): Tag {
    if (this.state.nameIndex.has(tag.name)) {
      throw new BizError(40901, '标签已存在');
    }
    const id = tag.id ?? nextId('t', this.state.seq);
    const record: Tag = { id, name: tag.name, createdAt: tag.createdAt };
    this.state.map.set(id, record);
    this.state.nameIndex.set(record.name, id);
    return record;
  }

  findByName(name: string): Tag | null {
    const id = this.state.nameIndex.get(name);
    return id ? this.state.map.get(id) ?? null : null;
  }

  findById(id: string): Tag | null {
    return this.state.map.get(id) ?? null;
  }

  list(): Tag[] {
    return [...this.state.map.values()];
  }
}
