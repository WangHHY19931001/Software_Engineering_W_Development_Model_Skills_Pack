/**
 * DD-003 UserService —— 用户服务
 *
 * 用户注册/登录/资料 CRUD/封禁解禁。密码 bcrypt 哈希、JWT 签发。
 * 依赖：DD-001 JwtUtil、DD-004 UserStore、DD-024 WalWriter、DD-026 AuditLogger、DD-017 SiteService（注册开关）。
 *
 * TLA+ 一致性：
 * - register/login/banUser/unbanUser 对应 L2_identity_access.tla RegisterUser/LoginUser/BanUser/UnbanUser
 */
import { z } from 'zod';
import type { User } from '../../types.js';
import { userStore } from '../../stores/user-store.js';
import { jwtUtil, ACCESS_EXPIRES, REFRESH_EXPIRES } from '../../utils/jwt.js';
import { AppError } from '../../utils/errors.js';
import type { WalWriter } from '../../infrastructure/wal.js';
import type { AuditLogger } from '../../infrastructure/audit.js';

export interface RegisterInput {
  email: string;
  password: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  role?: User['role'];
}

export interface RegisterResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UpdateProfileInput {
  nickname?: string;
  avatar?: string;
  bio?: string;
}

export interface BanResult {
  userId: string;
  status: 'banned';
  banReason: string;
}

export interface UnbanResult {
  userId: string;
  status: 'active';
}

const RegisterSchema = z.object({
  email: z.string().email('邮箱格式错误'),
  password: z.string().min(8, '密码长度至少 8 位').max(128, '密码长度至多 128 位'),
  nickname: z.string().min(1, '昵称不能为空').max(50, '昵称长度至多 50 字'),
  avatar: z.string().url('头像 URL 格式错误').optional(),
  bio: z.string().max(500, '简介长度至多 500 字').optional(),
  role: z.enum(['user', 'blogger', 'admin', 'super_admin']).optional(),
});

const UpdateProfileSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

export interface UserServiceDeps {
  walWriter: WalWriter;
  auditLogger: AuditLogger;
  /** 注册开关查询函数（避免循环依赖 SiteService） */
  isRegistrationOpen: () => boolean;
}

function genId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class UserService {
  constructor(private deps: UserServiceDeps) {}

  /** 注册（对应 DD-003 register + TLA+ RegisterUser） */
  async register(input: RegisterInput): Promise<RegisterResult> {
    if (!this.deps.isRegistrationOpen()) {
      throw new AppError(60006, '注册已关闭');
    }
    const parsed = RegisterSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    if (this.userStore().findByEmail(parsed.data.email)) {
      throw new AppError(40901, '邮箱已被注册', { email: parsed.data.email });
    }
    const now = Math.floor(Date.now() / 1000);
    const user: User = {
      id: genId(),
      email: parsed.data.email,
      passwordHash: jwtUtil.hashPassword(parsed.data.password),
      nickname: parsed.data.nickname,
      avatar: parsed.data.avatar,
      bio: parsed.data.bio,
      role: parsed.data.role ?? 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: 0,
    };
    this.userStore().insert(user);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'user.register',
      payload: user,
      timestamp: now,
    });
    await this.deps.auditLogger.log('user.register', user.id, user.id, { email: user.email });
    const accessToken = jwtUtil.sign({ userId: user.id, role: user.role, type: 'access' }, ACCESS_EXPIRES);
    const refreshToken = jwtUtil.sign({ userId: user.id, role: user.role, type: 'refresh' }, REFRESH_EXPIRES);
    return { userId: user.id, accessToken, refreshToken, expiresIn: ACCESS_EXPIRES };
  }

  /** 登录（对应 DD-003 login + TLA+ LoginUser） */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = this.userStore().findByEmail(email);
    if (!user) {
      throw new AppError(40101, '邮箱或密码错误');
    }
    if (user.status === 'banned') {
      throw new AppError(60002, '用户已被封禁', { userId: user.id, banReason: user.banReason });
    }
    if (!jwtUtil.comparePassword(password, user.passwordHash)) {
      throw new AppError(40101, '邮箱或密码错误');
    }
    const now = Math.floor(Date.now() / 1000);
    this.userStore().update(user.id, { lastLoginAt: now });
    const accessToken = jwtUtil.sign({ userId: user.id, role: user.role, type: 'access' }, ACCESS_EXPIRES);
    const refreshToken = jwtUtil.sign({ userId: user.id, role: user.role, type: 'refresh' }, REFRESH_EXPIRES);
    return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES };
  }

  /** 获取资料（对应 DD-003 getProfile） */
  getProfile(userId: string): Omit<User, 'passwordHash'> {
    const user = this.userStore().findById(userId);
    if (!user) {
      throw new AppError(40401, `用户不存在: ${userId}`, { userId });
    }
    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }

  /** 更新资料（对应 DD-003 updateProfile） */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Omit<User, 'passwordHash'>> {
    const parsed = UpdateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(40003, '输入校验失败', { issues: parsed.error.issues });
    }
    const existing = this.userStore().findById(userId);
    if (!existing) {
      throw new AppError(40401, `用户不存在: ${userId}`, { userId });
    }
    this.userStore().update(userId, parsed.data);
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'user.update',
      payload: this.userStore().findById(userId),
      timestamp: now,
    });
    const updated = this.userStore().findById(userId);
    if (!updated) throw new AppError(50001, '更新后用户丢失');
    const { passwordHash: _omit, ...safe } = updated;
    return safe;
  }

  /** 封禁用户（对应 DD-003 banUser + TLA+ BanUser） */
  async banUser(userId: string, reason: string, adminId: string): Promise<BanResult> {
    const user = this.userStore().findById(userId);
    if (!user) {
      throw new AppError(40401, `用户不存在: ${userId}`, { userId });
    }
    if (user.status === 'banned') {
      throw new AppError(60002, '用户已被封禁', { userId });
    }
    if (!reason || reason.length === 0) {
      throw new AppError(40003, '封禁原因不能为空');
    }
    this.userStore().update(userId, { status: 'banned', banReason: reason });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'user.ban',
      payload: { userId, reason, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('user.ban', adminId, userId, { reason });
    return { userId, status: 'banned', banReason: reason };
  }

  /** 解禁用户（对应 DD-003 unbanUser + TLA+ UnbanUser） */
  async unbanUser(userId: string, adminId: string): Promise<UnbanResult> {
    const user = this.userStore().findById(userId);
    if (!user) {
      throw new AppError(40401, `用户不存在: ${userId}`, { userId });
    }
    if (user.status !== 'banned') {
      throw new AppError(60002, '用户未被封禁', { userId });
    }
    this.userStore().update(userId, { status: 'active', banReason: undefined });
    const now = Math.floor(Date.now() / 1000);
    this.deps.walWriter.append({
      opId: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      opType: 'user.unban',
      payload: { userId, adminId },
      timestamp: now,
    });
    await this.deps.auditLogger.log('user.unban', adminId, userId, {});
    return { userId, status: 'active' };
  }

  /** 可注入的 userStore（默认单例，单测可覆盖） */
  private userStoreOverride: typeof userStore | null = null;
  setUserStore(store: typeof userStore): void {
    this.userStoreOverride = store;
  }
  private userStore(): typeof userStore {
    return this.userStoreOverride ?? userStore;
  }
}
