import type { Request, Response } from 'express';
import { articleService } from '../services/article-service.js';
import { createArticleSchema, updateArticleSchema } from '../schemas/article-schema.js';

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createArticleSchema.parse(req.body);
  const result = await articleService.create(parsed, req.userId!);
  res.status(201).json(result);
}

export async function list(_req: Request, res: Response): Promise<void> {
  const result = articleService.list();
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const article = articleService.findById(req.params.id);
  if (!article) {
    res.status(404).json({ error: `Article "${req.params.id}" not found` });
    return;
  }
  res.status(200).json(article);
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updateArticleSchema.parse(req.body);
  const result = await articleService.update(req.params.id, parsed, req.userId!);
  res.status(200).json(result);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await articleService.remove(req.params.id, req.userId!);
  res.status(204).send();
}
