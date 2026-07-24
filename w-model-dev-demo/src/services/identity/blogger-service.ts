/**
 * DD-005 BloggerService —— 博主服务
 *
 * 博主注册认证、博主资料、博主主页、博主分级（普通/认证/特邀）。
 * 依赖：DD-003 UserService、DD-004 UserStore、DD-006 FollowService、DD-024 WalWriter。
 *
 * TLA+ 一致性：registerBlogger 对应 L2_identity_access.tla RegisterBlogger。
 */
import { z } from 'zod';
import type { BloggerProfile, Article, Page, BloggerLevel } from '../../types.js';
import { userStore } from '../../stores/user-store.js';
import { articleStore } from '../../stores/article-store.js';
import { GenericStore } from '../../stores/generic-store.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';
import type { AuditLogger } from '../../infrastructure/audit.js';

export interface BloggerRegisterInput {
  email: string;
  password: string;
  nickname: string;
  intro: string;
  socialLinks?: Record<string, string>;
}

export interface BloggerResult {
  userId: string;
  bloggerLevel: BloggerLevel;
}

export interface BloggerHome {
  bloggerId: string;
  profile: BloggerProfile;
  articles: Page<Article>;
}

export interface UpgradeResult {
  bloggerId: string;
  bloggerLevel: BloggerLevel;
}

const BloggerRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  nickname: z.string().min(1).max(50),
  intro: z.string().min(1).max(500),
  socialLinks: z.record(z.string()).optional(),
});

const profileStore = new GenericStore<BloggerProfile & { id: string }>();

function genId(): string {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface BloggerServiceDeps {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
}

export class BloggerService {
  constructor(private deps: BloggerServiceDeps) {}

  /** 注册博主（对应 DD-005 registerBlogger + TLA+ RegisterBlogger） */
  async registerBlogger(input: BloggerRegisterInput): Promise<BloggerResult> {
    const parsed = BloggerRegisterSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    if (userStore.findByEmail(parsed.data.email)) {
      throw new AppError(40901, '邮箱已被注册', { email: parsed.data.email });
    }
    const now = Math.floor(Date.now() / 1000);
    const userId = genId();
    const user = {
      id: userId,
      email: parsed.data.email,
      passwordHash: '', // 由调用者通过 UserService 注入；此处简化为占位（单测以 mock 为主）
      nickname: parsed.data.nickname,
      role: 'blogger' as const,
      bloggerLevel: 'normal' as BloggerLevel,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: 0,
    };
    // 使用 bcrypt 哈希密码（避免占位存储）
    const { hashPassword } = await import('../../utils/bcrypt.js');
    user.passwordHash = hashPassword(parsed.data.password);
    userStore.insert(user);
    const profile: BloggerProfile & { id: string } = {
      id: userId,
      userId,
      intro: parsed.data.intro,
      socialLinks: parsed.data.socialLinks,
    };
    profileStore.insert(profile);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'blogger.register',
      payload: { user, profile },
      timestamp: now,
    });
    return { userId, bloggerLevel: 'normal' };
  }

  /** 获取博主资料（对应 DD-005 getBloggerProfile） */
  getBloggerProfile(bloggerId: string): BloggerProfile {
    const user = userStore.findById(bloggerId);
    if (!user || user.role !== 'blogger') {
      throw new AppError(40401, `博主不存在: ${bloggerId}`, { bloggerId });
    }
    const profile = profileStore.findById(bloggerId);
    return {
      userId: bloggerId,
      intro: profile?.intro ?? '',
      socialLinks: profile?.socialLinks,
    };
  }

  /** 博主主页（对应 DD-005 getBloggerHome） */
  getBloggerHome(bloggerId: string, page: number, size: number): BloggerHome {
    if (page < 1) throw new AppError(40003, 'page 必须 ≥ 1');
    if (size < 1 || size > 100) throw new AppError(40003, 'size 必须 ∈ [1,100]');
    const profile = this.getBloggerProfile(bloggerId);
    const articles = articleStore.list({ authorId: bloggerId }, page, size);
    return { bloggerId, profile, articles };
  }

  /** 升级博主分级（对应 DD-005 upgradeBloggerLevel） */
  async upgradeBloggerLevel(
    bloggerId: string,
    level: BloggerLevel,
    adminId: string,
  ): Promise<UpgradeResult> {
    if (!['normal', 'verified', 'featured'].includes(level)) {
      throw new AppError(40003, `非法分级: ${level}`, { level });
    }
    const user = userStore.findById(bloggerId);
    if (!user || user.role !== 'blogger') {
      throw new AppError(40401, `博主不存在: ${bloggerId}`, { bloggerId });
    }
    userStore.update(bloggerId, { bloggerLevel: level });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'blogger.upgrade',
      payload: { bloggerId, level, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('blogger.upgrade', adminId, bloggerId, { level });
    return { bloggerId, bloggerLevel: level };
  }

  /** 获取博主资料存储（供测试重置） */
  static _profileStore(): GenericStore<BloggerProfile & { id: string }> {
    return profileStore;
  }
}
