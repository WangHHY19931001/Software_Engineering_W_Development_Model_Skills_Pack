/**
 * 标签服务 + 视图记录服务 测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TagService } from '../../src/services/tag.service.js';
import { TagRepository } from '../../src/repositories/tag.repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/utils/errors.js';

describe('TagService', () => {
  let repo: TagRepository;
  let svc: TagService;

  beforeEach(() => {
    repo = new TagRepository();
    svc = new TagService(repo);
  });

  describe('create()', () => {
    it('should create', async () => {
      const t = await svc.create({ name: 'Tech', slug: 'tech' });
      expect(t.name).toBe('Tech');
    });

    it('should throw on duplicate name', async () => {
      await svc.create({ name: 'Tech', slug: 'tech' });
      await expect(svc.create({ name: 'Tech', slug: 'tech2' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('should throw on duplicate slug', async () => {
      await svc.create({ name: 'Tech', slug: 'tech' });
      await expect(svc.create({ name: 'Tech2', slug: 'tech' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('should throw on invalid data', async () => {
      await expect(svc.create({ name: '', slug: 'tech' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw on bad slug', async () => {
      await expect(svc.create({ name: 'a', slug: 'A B' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('createOrGet()', () => {
    it('should create new', async () => {
      const t = await svc.createOrGet('Tech');
      expect(t.name).toBe('Tech');
    });

    it('should get existing', async () => {
      const t1 = await svc.createOrGet('Tech');
      const t2 = await svc.createOrGet('Tech');
      expect(t1.id).toBe(t2.id);
    });

    it('should slugify', async () => {
      const t = await svc.createOrGet('Hello World');
      expect(t.slug).toBe('hello-world');
    });
  });

  describe('update()', () => {
    it('should update', async () => {
      const t = await svc.create({ name: 'Tech', slug: 'tech' });
      const r = await svc.update(t.id, { name: 'Tech2' });
      expect(r.name).toBe('Tech2');
    });

    it('throws NotFoundError', async () => {
      await expect(svc.update('m', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getById/getByName/getBySlug', () => {
    it('getById', async () => {
      const t = await svc.create({ name: 'Tech', slug: 'tech' });
      const r = await svc.getById(t.id);
      expect(r.id).toBe(t.id);
    });

    it('getById throws NotFoundError', async () => {
      await expect(svc.getById('m')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('getByName', async () => {
      await svc.create({ name: 'Tech', slug: 'tech' });
      const r = await svc.getByName('Tech');
      expect(r.name).toBe('Tech');
    });

    it('getByName throws NotFoundError', async () => {
      await expect(svc.getByName('m')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('getBySlug', async () => {
      await svc.create({ name: 'Tech', slug: 'tech' });
      const r = await svc.getBySlug('tech');
      expect(r.slug).toBe('tech');
    });

    it('getBySlug throws NotFoundError', async () => {
      await expect(svc.getBySlug('m')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list/delete()', () => {
    it('list returns all', async () => {
      await svc.create({ name: 'A', slug: 'a' });
      await svc.create({ name: 'B', slug: 'b' });
      const r = await svc.list();
      expect(r.length).toBe(2);
    });

    it('delete removes', async () => {
      const t = await svc.create({ name: 'A', slug: 'a' });
      const r = await svc.delete(t.id);
      expect(r).toBe(true);
    });

    it('delete throws NotFoundError', async () => {
      await expect(svc.delete('m')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
