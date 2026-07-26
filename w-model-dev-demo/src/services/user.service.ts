/**
 * UserService（DD-002-002 createUser）— 用户注册 + 资料管理。
 */
import type { User, Role, UserProfile } from '../types.js';
import type { UserStore } from '../stores/user.store.js';
import type { UserProfileStore } from '../stores/user-profile.store.js';
import { PasswordHasher } from '../utils/auth.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
}

export class UserService {
  constructor(
    private userStore: UserStore,
    private profileStore: UserProfileStore,
  ) {}

  async createUser(input: CreateUserInput): Promise<Omit<User, 'passwordHash'>> {
    if (this.userStore.findByEmail(input.email)) {
      throw new ConflictError('邮箱已注册');
    }
    if (input.password.length < 8) {
      throw new ValidationError('密码至少 8 位');
    }
    const passwordHash = await PasswordHasher.hash(input.password);
    const user = this.userStore.insert({
      email: input.email,
      passwordHash,
      role: input.role,
    });
    this.profileStore.upsert(user.id, { nickname: '', avatar: '', bio: '' });
    const { passwordHash: _ph, ...safeUser } = user;
    void _ph;
    return safeUser;
  }

  findById(id: string): User | undefined {
    return this.userStore.findById(id);
  }

  findByIdOrFail(id: string): User {
    const user = this.userStore.findById(id);
    if (!user) throw new NotFoundError('用户');
    return user;
  }

  findByEmail(email: string): User | undefined {
    return this.userStore.findByEmail(email);
  }

  list(): Omit<User, 'passwordHash'>[] {
    return this.userStore.list().map((u) => {
      const { passwordHash: _ph, ...safe } = u;
      void _ph;
      return safe;
    });
  }

  updatePassword(userId: string, newPassword: string): void {
    if (newPassword.length < 8) {
      throw new ValidationError('密码至少 8 位');
    }
    this.userStore.update(userId, { passwordHash: newPassword });
  }

  async updatePasswordHashed(userId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new ValidationError('密码至少 8 位');
    }
    const hash = await PasswordHasher.hash(newPassword);
    this.userStore.update(userId, { passwordHash: hash });
  }

  getProfile(userId: string): UserProfile {
    return this.profileStore.findByUserIdOrFail(userId);
  }

  updateProfile(userId: string, patch: Partial<Omit<UserProfile, 'userId'>>): UserProfile {
    return this.profileStore.upsert(userId, patch);
  }

  toSafeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _ph, ...safe } = user;
    void _ph;
    return safe;
  }
}
