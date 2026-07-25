// Zod validation schemas.

import { z } from 'zod';

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8);
export const displayNameSchema = z.string().min(1).max(50);

export const slugSchema = z.string().regex(/^[a-z0-9-]{3,30}$/);

export const tagNameSchema = z
  .string()
  .min(1)
  .max(30)
  .refine((s) => !/[<>"'/\\]/.test(s), { message: 'tag name has illegal chars' });

export const tagSlugSchema = z.string().regex(/^[a-z0-9-]{2,30}$/);

export const categoryNameSchema = z.string().min(1).max(50);

export const articleInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  summary: z.string().max(500).optional().default(''),
  coverImageUrl: z.string().url().optional(),
  seriesId: z.string().optional(),
  seriesOrder: z.number().int().nonnegative().optional(),
  scheduledAt: z.date().optional(),
  status: z
    .enum(['draft', 'pending_review', 'published', 'offline', 'archived'])
    .optional(),
});

export const commentContentSchema = z.string().min(1).max(1000);

export const adInputSchema = z.object({
  slotId: z.string().min(1),
  title: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  targetUrl: z.string().url(),
  startAt: z.date(),
  endAt: z.date(),
}).refine((d) => d.startAt < d.endAt, { message: 'startAt must be < endAt' });

export const pageSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(10),
});

export const searchQuerySchema = z.string().min(1).max(100);
export const suggestPrefixSchema = z.string().min(1).max(50);
export const siteTrendDaysSchema = z.number().int().min(1).max(90);

export const announcementSchema = z.object({
  text: z.string().min(1).max(1000),
  at: z.date(),
}).refine((d) => d.at.getTime() > Date.now(), { message: 'at must be in the future' });

export const banReasonSchema = z.string().min(1).max(200);

export const reportReasonSchema = z.string().min(1).max(200);

export const recommendSlotSchema = z.object({
  slotName: z.string().min(1).max(50),
  articleId: z.string().min(1),
  priority: z.number().int().nonnegative(),
});

export const notificationSettingsSchema = z.object({
  comment: z.boolean().optional(),
  like: z.boolean().optional(),
  follow: z.boolean().optional(),
  system: z.boolean().optional(),
  subscription: z.boolean().optional(),
});

export const backupTypeSchema = z.enum(['full', 'incremental']);

export const topNSchema = z.number().int().min(1).max(100);
