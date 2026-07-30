/**
 * 基础仓储
 * 提供内存 Map 存储 + 通用 CRUD
 */
export class BaseRepository<T extends { id: string }> {
  protected store: Map<string, T> = new Map();

  async create(entity: T): Promise<T> {
    if (this.store.has(entity.id)) {
      throw new Error(`Entity with id ${entity.id} already exists`);
    }
    this.store.set(entity.id, entity);
    return this.clone(entity);
  }

  async findById(id: string): Promise<T | null> {
    const entity = this.store.get(id);
    return entity ? this.clone(entity) : null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.store.values()).map((e) => this.clone(e));
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) {
      return null as unknown as T;
    }
    const updated = { ...existing, ...updates, id: existing.id } as T;
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async findBy(predicate: (item: T) => boolean): Promise<T[]> {
    return Array.from(this.store.values())
      .filter(predicate)
      .map((e) => this.clone(e));
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    for (const item of this.store.values()) {
      if (predicate(item)) {
        return this.clone(item);
      }
    }
    return null;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * 浅克隆实体，避免外部修改影响 store
   */
  protected clone(entity: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(entity);
    }
    return JSON.parse(JSON.stringify(entity)) as T;
  }
}
