/**
 * 标签服务
 */
import { z } from 'zod';
import { TagRepository } from '../repositories/tag.repository.js';
import { generateId } from '../utils/id.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import type { Tag } from '../types/index.js';

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export const UpdateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
});

export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class TagService {
  constructor(private readonly tagRepo: TagRepository) {}

  async create(input: CreateTagInput): Promise<Tag> {
    const parsed = CreateTagSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid tag data', { issues: parsed.error.issues });
    }
    const existing = await this.tagRepo.findByName(parsed.data.name);
    if (existing) {
      throw new ConflictError('Tag name already exists');
    }
    const existingSlug = await this.tagRepo.findBySlug(parsed.data.slug);
    if (existingSlug) {
      throw new ConflictError('Tag slug already exists');
    }
    const tag: Tag = {
      id: generateId('tag'),
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      createdAt: Date.now(),
    };
    await this.tagRepo.create(tag);
    return tag;
  }

  async createOrGet(name: string): Promise<Tag> {
    const existing = await this.tagRepo.findByName(name);
    if (existing) return existing;
    const slug = slugify(name);
    return this.create({ name, slug });
  }

  async update(id: string, input: UpdateTagInput): Promise<Tag> {
    const parsed = UpdateTagSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid tag update', { issues: parsed.error.issues });
    }
    const tag = await this.tagRepo.findById(id);
    if (!tag) {
      throw new NotFoundError('Tag');
    }
    const updated = await this.tagRepo.update(id, parsed.data);
    if (!updated) {
      throw new NotFoundError('Tag');
    }
    return updated;
  }

  async getById(id: string): Promise<Tag> {
    const tag = await this.tagRepo.findById(id);
    if (!tag) {
      throw new NotFoundError('Tag');
    }
    return tag;
  }

  async getByName(name: string): Promise<Tag> {
    const tag = await this.tagRepo.findByName(name);
    if (!tag) {
      throw new NotFoundError('Tag');
    }
    return tag;
  }

  async getBySlug(slug: string): Promise<Tag> {
    const tag = await this.tagRepo.findBySlug(slug);
    if (!tag) {
      throw new NotFoundError('Tag');
    }
    return tag;
  }

  async list(): Promise<Tag[]> {
    return this.tagRepo.findAll();
  }

  async delete(id: string): Promise<boolean> {
    const exists = await this.tagRepo.exists(id);
    if (!exists) {
      throw new NotFoundError('Tag');
    }
    return this.tagRepo.delete(id);
  }
}
