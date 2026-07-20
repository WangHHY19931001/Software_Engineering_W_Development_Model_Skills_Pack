import type { Request, Response } from 'express';
import { commentService } from '../services/comment-service.js';
import { createCommentSchema } from '../schemas/comment-schema.js';

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createCommentSchema.parse(req.body);
  const result = await commentService.create(req.params.id, parsed, req.userId!);
  res.status(201).json(result);
}

export async function listByArticle(req: Request, res: Response): Promise<void> {
  const result = commentService.listByArticle(req.params.id);
  res.status(200).json(result);
}
