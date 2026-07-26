/**
 * AuthService（DD-003-002）— 登录认证 + JWT 签发。
 * 与 L3_login_flow.tla / L4_auth_token_lifecycle.tla 一致。
 */
import type { User, Role } from '../types.js';
import type { UserStore } from '../stores/user.store.js';
import type { JwtUtil } from '../utils/auth.js';
import { PasswordHasher } from '../utils/auth.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../utils/errors.js';

export interface LoginResult {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export class LoginRateLimiter {
  private failures: Map<string, { count: number; lockedUntil: number }> = new Map();
  private readonly maxFailures: number;
  private readonly lockMs: number;

  constructor(maxFailures: number = 5, lockMs: number = 5 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.lockMs = lockMs;
  }

  isLocked(key: string, now: number = Date.now()): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (entry.lockedUntil > now) return true;
    if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
      this.failures.delete(key);
    }
    return false;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const entry = this.failures.get(key) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= this.maxFailures) {
      entry.lockedUntil = now + this.lockMs;
    }
    this.failures.set(key, entry);
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  remainingAttempts(key: string): number {
    const entry = this.failures.get(key);
    if (!entry) return this.maxFailures;
    return Math.max(0, this.maxFailures - entry.count);
  }

  clear(): void {
    this.failures.clear();
  }
}

export class AuthService {
  constructor(
    private userStore: UserStore,
    private jwtUtil: JwtUtil,
    private rateLimiter: LoginRateLimiter = new LoginRateLimiter(),
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    if (!email || !password) {
      throw new ValidationError('邮箱和密码必填');
    }
    const key = email.toLowerCase();
    if (this.rateLimiter.isLocked(key)) {
      throw new AuthenticationError('登录失败次数过多，请稍后重试');
    }
    const user = this.userStore.findByEmail(email);
    if (!user) {
      this.rateLimiter.recordFailure(key);
      throw new AuthenticationError('邮箱或密码错误');
    }
    const ok = await PasswordHasher.compare(password, user.passwordHash);
    if (!ok) {
      this.rateLimiter.recordFailure(key);
      throw new AuthenticationError('邮箱或密码错误');
    }
    this.rateLimiter.recordSuccess(key);
    const token = this.jwtUtil.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const { passwordHash: _ph, ...safeUser } = user;
    void _ph;
    return { token, user: safeUser };
  }

  verifyToken(token: string): { id: string; email: string; role: Role } {
    const payload = this.jwtUtil.verify(token);
    return { id: payload.sub, email: payload.email, role: payload.role as Role };
  }

  getRateLimiter(): LoginRateLimiter {
    return this.rateLimiter;
  }
}

export function assertUserExists(user: User | undefined, message: string = '用户'): asserts user is User {
  if (!user) throw new NotFoundError(message);
}
