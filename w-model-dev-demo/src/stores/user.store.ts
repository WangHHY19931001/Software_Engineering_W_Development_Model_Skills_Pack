// SD-003 UserStore.

import { UserRole, UserStatus, type User } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { displayNameSchema, emailSchema, passwordSchema } from '../utils/schemas.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `u-${counter}`;
}

export interface UserCreateInput {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}

export class UserStore {
  private users = new Map<string, User>();
  private emailToId = new Map<string, string>();
  private roleToIds = new Map<UserRole, Set<string>>();
  private bannedUserIds = new Set<string>();
  // Tracks JTIs issued per user (for revocation).
  private userJtis = new Map<string, Set<string>>();

  size(): number {
    return this.users.size;
  }

  bannedSize(): number {
    return this.bannedUserIds.size;
  }

  roleSize(role: UserRole): number {
    const set = this.roleToIds.get(role);
    return set ? set.size : 0;
  }

  hasEmail(email: string): boolean {
    return this.emailToId.has(email);
  }

  getById(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  getByEmail(email: string): User | null {
    const id = this.emailToId.get(email);
    if (!id) return null;
    return this.users.get(id) ?? null;
  }

  create(input: UserCreateInput): User {
    if (!emailSchema.safeParse(input.email).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (!passwordSchema.safeParse(input.password).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (!displayNameSchema.safeParse(input.displayName).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (this.emailToId.has(input.email)) {
      throw new AppError(ErrorCode.BusinessConflict, '1005');
    }
    const role = input.role ?? UserRole.Reader;
    const now = new Date();
    const user: User = {
      id: nextId(),
      email: input.email,
      passwordHash: input.password, // caller hashes before passing in
      role,
      status: UserStatus.Active,
      displayName: input.displayName,
      bannedAt: null,
      banReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.emailToId.set(input.email, user.id);
    let roleSet = this.roleToIds.get(role);
    if (!roleSet) {
      roleSet = new Set();
      this.roleToIds.set(role, roleSet);
    }
    roleSet.add(user.id);
    return { ...user };
  }

  update(user: User): User {
    const existing = this.users.get(user.id);
    if (!existing) {
      throw new AppError(ErrorCode.NotFound, '1031');
    }
    const updated: User = { ...user, updatedAt: new Date() };
    this.users.set(user.id, updated);
    return { ...updated };
  }

  ban(userId: string, reason: string): User {
    const user = this.users.get(userId);
    if (!user) throw new AppError(ErrorCode.NotFound, '1031');
    user.status = UserStatus.Banned;
    user.bannedAt = new Date();
    user.banReason = reason;
    user.updatedAt = new Date();
    this.bannedUserIds.add(userId);
    return { ...user };
  }

  unban(userId: string): User {
    const user = this.users.get(userId);
    if (!user) throw new AppError(ErrorCode.NotFound, '1031');
    user.status = UserStatus.Active;
    user.bannedAt = null;
    user.banReason = null;
    user.updatedAt = new Date();
    this.bannedUserIds.delete(userId);
    return { ...user };
  }

  isBanned(userId: string): boolean {
    return this.bannedUserIds.has(userId);
  }

  listByRole(role: UserRole): User[] {
    const set = this.roleToIds.get(role);
    if (!set) return [];
    const out: User[] = [];
    for (const id of set) {
      const u = this.users.get(id);
      if (u) out.push({ ...u });
    }
    return out;
  }

  addJti(userId: string, jti: string): void {
    let set = this.userJtis.get(userId);
    if (!set) {
      set = new Set();
      this.userJtis.set(userId, set);
    }
    set.add(jti);
  }

  getJtis(userId: string): string[] {
    const set = this.userJtis.get(userId);
    return set ? Array.from(set) : [];
  }

  clear(): void {
    this.users.clear();
    this.emailToId.clear();
    this.roleToIds.clear();
    this.bannedUserIds.clear();
    this.userJtis.clear();
  }
}
