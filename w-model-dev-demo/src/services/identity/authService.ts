/**
 * authService（DD-002 / SD-001）：注册/登录/博主申请核心业务。
 * bcrypt 加盐哈希（NFR-002）、JWT 签发（CON-003）、凭据错误统一 40101 防枚举（UT-051）；
 * 令牌状态机（RH-02 §0.2）：issueToken 前置不变式 userId 已注册 → active ⇒ registered。
 * 跨模块只读方法（getUserById/getBloggerById/isBlogger）供 SD-002/003/006 经服务方法消费（NFR-005，user store）。
 */
import { BizError } from '../../utils/errors';
import { invariant } from '../../utils/invariant';
import { bcryptHasher, type PasswordHasher } from '../../utils/hash';
import type { JwtUtil } from '../../utils/jwtUtil';
import type { UserStore } from '../../stores/userStore';
import type { PublicUser, Role, Session, User } from '../../types';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    nickname: user.nickname,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  constructor(
    private readonly userStore: UserStore,
    private readonly jwtUtil: JwtUtil,
    private readonly hasher: PasswordHasher = bcryptHasher,
  ) {}

  /** 注册：唯一性校验 → bcrypt 哈希 → 落库（role=reader）；响应/存储均不含明文密码（NFR-002） */
  async register(input: RegisterInput): Promise<PublicUser> {
    if (await this.userStore.findByEmail(input.email)) {
      throw new BizError(40901, '邮箱已被占用');
    }
    if (await this.userStore.findByUsername(input.username)) {
      throw new BizError(40901, '用户名已被占用');
    }
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.userStore.create({
      username: input.username,
      email: input.email,
      passwordHash,
      role: 'reader',
      createdAt: new Date().toISOString(),
    });
    return toPublicUser(user);
  }

  /** 登录：按用户名或邮箱查用户 → bcrypt 比对 → 签发 JWT；两类凭据错误统一 40101 防枚举 */
  async login(identifier: string, password: string): Promise<Session> {
    const user = (await this.userStore.findByEmail(identifier)) ?? (await this.userStore.findByUsername(identifier));
    if (!user) {
      throw new BizError(40101, '用户名或密码错误');
    }
    const ok = await this.hasher.compare(password, user.passwordHash);
    if (!ok) {
      throw new BizError(40101, '用户名或密码错误');
    }
    const token = await this.issueToken(user.id);
    return { token, expiresIn: 86400, user: { userId: user.id, username: user.username, role: user.role } };
  }

  /** 申请博主：reader→blogger（幂等：已是 blogger 直接返回） */
  async applyBlogger(userId: string): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    if (user.role !== 'blogger') {
      const updated = await this.userStore.updateRole(userId, 'blogger');
      return toPublicUser(updated);
    }
    return toPublicUser(user);
  }

  /**
   * 签发 JWT（24h）。
   * 前置不变式：userId 必须已注册（user store 存在）→ `active ⇒ registered`（RH-02 §0.2）。
   * reworkHint 统一方案：签 {sub, role}，与 DD-046 verify 返回 {sub, role, iat, exp} 一致（角色声明一致）。
   */
  async issueToken(userId: string): Promise<string> {
    const user = await this.requireUser(userId);
    // TLA+ BusinessInvariant 锚点（L2_BlogSystemAuth / L3_BlogSystemAuthFlow / RH-02 §0.2）：
    // 令牌状态机不变量——active ⇒ registered（签发仅对已注册用户，且 24h 有效期）
    invariant(user !== null && user.id === userId, '令牌状态机不变量违反：active ⇒ registered');
    return this.jwtUtil.sign({ sub: user.id, role: user.role });
  }

  /** TLA+ L2_BlogSystemContent / L3_BlogSystemArticleState "BecomeBlogger" 动作对应：读者→博主（applyBlogger 薄封装） */
  async becomeBlogger(userId: string): Promise<PublicUser> {
    return this.applyBlogger(userId);
  }

  /* ============ 跨模块只读（user store，经 SD-001 服务方法） ============ */

  /** 用户存在性（SD-003/006 身份校验，P7-002：follower/followee/authorId 均为 user 实体主键） */
  async getUserById(userId: string): Promise<User | null> {
    return this.userStore.findById(userId);
  }

  /** 博主存在性（RSS INTF-021；关注 followee 校验）：user 存在且 role=blogger */
  async getBloggerById(userId: string): Promise<User | null> {
    const user = await this.userStore.findById(userId);
    return user && user.role === 'blogger' ? user : null;
  }

  /** 博主判定（articleService 创建/管理文章校验） */
  async isBlogger(userId: string): Promise<boolean> {
    const user = await this.userStore.findById(userId);
    return user?.role === 'blogger';
  }

  /** 更新角色（仅供装配/测试扩展） */
  async setRole(userId: string, role: Role): Promise<User> {
    return this.userStore.updateRole(userId, role);
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userStore.findById(userId);
    if (!user) throw new BizError(40401, '用户不存在');
    return user;
  }
}
