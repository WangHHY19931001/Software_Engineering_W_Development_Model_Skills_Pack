/**
 * 评论服务 - 评论树 + 权限校验
 */
import { z } from 'zod';
import { CommentRepository } from '../repositories/comment.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { generateId } from '../utils/id.js';
import {
  AppError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import {
  ArticleStatus,
  CommentStatus,
  UserRole,
  type Comment,
  type CommentNode,
} from '../types/index.js';

export const CreateCommentSchema = z.object({
  postId: z.string().min(1),
  authorId: z.string().min(1),
  parentId: z.string().optional(),
  content: z.string().min(1).max(2000),
});

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;

export class CommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly articleRepo: ArticleRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async create(input: CreateCommentInput): Promise<Comment> {
    const parsed = CreateCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid comment data', { issues: parsed.error.issues });
    }
    const article = await this.articleRepo.findById(parsed.data.postId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    if (article.status !== ArticleStatus.PUBLISHED) {
      throw new ValidationError('Cannot comment on unpublished article');
    }
    const author = await this.userRepo.findById(parsed.data.authorId);
    if (!author) {
      throw new NotFoundError('User');
    }
    if (author.role !== UserRole.READER && author.role !== UserRole.BLOGGER && author.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Invalid role for commenting');
    }
    if (parsed.data.parentId) {
      const parent = await this.commentRepo.findById(parsed.data.parentId);
      if (!parent) {
        throw new NotFoundError('Parent comment');
      }
      if (parent.postId !== parsed.data.postId) {
        throw new ValidationError('Parent comment does not belong to this post');
      }
    }
    const now = Date.now();
    const comment: Comment = {
      id: generateId('comment'),
      postId: parsed.data.postId,
      authorId: parsed.data.authorId,
      parentId: parsed.data.parentId ?? null,
      content: parsed.data.content,
      status: CommentStatus.VISIBLE,
      createdAt: now,
      updatedAt: now,
    };
    await this.commentRepo.create(comment);
    await this.articleRepo.incrementComment(parsed.data.postId, 1);
    return comment;
  }

  async update(id: string, actorId: string, input: UpdateCommentInput): Promise<Comment> {
    const parsed = UpdateCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid comment update', { issues: parsed.error.issues });
    }
    const comment = await this.commentRepo.findById(id);
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    if (comment.authorId !== actorId) {
      throw new ForbiddenError('Cannot edit other user comments');
    }
    const updated = await this.commentRepo.update(id, {
      content: parsed.data.content,
      updatedAt: Date.now(),
    } as Partial<Comment>);
    if (!updated) {
      throw new NotFoundError('Comment');
    }
    return updated;
  }

  async delete(id: string, actorId: string, isAdmin: boolean = false): Promise<void> {
    const comment = await this.commentRepo.findById(id);
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    if (comment.authorId !== actorId && !isAdmin) {
      throw new ForbiddenError('Cannot delete other user comments');
    }
    await this.commentRepo.softDelete(id);
    await this.articleRepo.incrementComment(comment.postId, -1);
  }

  async getById(id: string): Promise<Comment> {
    const comment = await this.commentRepo.findById(id);
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    return comment;
  }

  async getTreeByPost(postId: string): Promise<CommentNode[]> {
    const article = await this.articleRepo.findById(postId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    return this.commentRepo.buildTree(postId);
  }

  async listByPost(postId: string): Promise<Comment[]> {
    return this.commentRepo.findVisibleByPost(postId);
  }

  async listByAuthor(authorId: string): Promise<Comment[]> {
    return this.commentRepo.findByAuthor(authorId);
  }

  async countByPost(postId: string): Promise<number> {
    return this.commentRepo.countByPost(postId);
  }
}
