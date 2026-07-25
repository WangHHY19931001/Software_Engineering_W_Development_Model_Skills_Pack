// SD-003 AuthService + UserService.

import { UserRole, UserStatus, type User } from '../types.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { UserStore } from '../stores/user.store.js';
import {
  clearRevokedJtis,
  comparePassword,
  hashPassword,
  revokeAllJtisForUser,
  revokedJtis,
  signToken,
  verifyToken,
} from '../utils/auth.js';
import { appendAuditLog, invariant } from '../utils/logger.js';
import { banReasonSchema, displayNameSchema, emailSchema, passwordSchema } from '../utils/schemas.js';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}

export class AuthService {
  constructor(private userStore: UserStore) {}

  /** userRegister — register a new user. TLA+ L2_identity_access.userRegister / L3_auth_session.userRegister */
  async userRegister(input: RegisterInput): Promise<User> {
    // Validate raw inputs before hashing (store validates hash, not original password).
    if (!emailSchema.safeParse(input.email).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (!passwordSchema.safeParse(input.password).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    if (!displayNameSchema.safeParse(input.displayName).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const hash = await hashPassword(input.password);
    const user = this.userStore.create({
      email: input.email,
      password: hash,
      displayName: input.displayName,
      role: input.role,
    });
    appendAuditLog(user.id, 'userRegister', user.id);
    return user;
  }

  /** Alias matching SD-003 design. */
  async register(input: RegisterInput): Promise<User> {
    return this.userRegister(input);
  }

  /** userLogin — login with email + password. TLA+ L2_identity_access.userLogin / L3_auth_session.userLogin */
  async userLogin(email: string, password: string): Promise<{ token: string; user: User }> {
    invariant(!!email && !!password, 'email/password required');
    const user = this.userStore.getByEmail(email);
    if (!user) {
      throw new AppError(ErrorCode.NoUser, '1011');
    }
    if (this.userStore.isBanned(user.id)) {
      throw new AppError(ErrorCode.Banned, '1022');
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new AppError(ErrorCode.WrongPassword, '1012');
    }
    const token = signToken(user.id, user.role);
    // Decode jti from token (we know payload shape).
    const { payload } = verifyToken(token);
    this.userStore.addJti(user.id, payload.jti);
    return { token, user };
  }

  /** Alias matching SD-003 design. */
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.userLogin(email, password);
  }

  /** userLogout — invalidate the current token's jti. */
  userLogout(token: string): void {
    const { payload } = verifyToken(token);
    revokeAllJtisForUser([payload.jti]);
    appendAuditLog(payload.userId, 'userLogout', payload.userId);
  }

  /** verifyToken wrapper. */
  verifyToken(token: string): { userId: string; role: UserRole } {
    const { payload } = verifyToken(token);
    const user = this.userStore.getById(payload.userId);
    if (!user) {
      throw new AppError(ErrorCode.NoUser, '1011');
    }
    if (user.status === UserStatus.Banned) {
      throw new AppError(ErrorCode.Banned, '1022');
    }
    return { userId: payload.userId, role: payload.role };
  }

  /** revokeToken — revoke all tokens for a user. TLA+ L2_identity_access.revokeToken / L3_auth_session.revokeToken */
  revokeToken(userId: string): void {
    const user = this.userStore.getById(userId);
    if (!user) throw new AppError(ErrorCode.NotFound, '1031');
    const jtis = this.userStore.getJtis(userId);
    revokeAllJtisForUser(jtis);
    appendAuditLog(userId, 'revokeToken', userId);
  }

  /** expireToken — mark a token expired (TLA+ L3_auth_session.expireToken). */
  expireToken(jti: string): void {
    revokeAllJtisForUser([jti]);
  }

  /** Test helper: exposes revoked JTIs set. */
  revokedCount(): number {
    return revokedJtis.size;
  }

  /** Test helper: clear all revoked JTIs. */
  clearRevoked(): void {
    clearRevokedJtis();
  }
}

export class UserService {
  constructor(private userStore: UserStore, private authService: AuthService) {}

  /** banUser — ban a user. TLA+ L2_identity_access.banUser / L3_auth_session.banUser */
  banUser(operatorId: string, operatorRole: string, userId: string, reason: string): void {
    invariant(!!operatorId && !!userId, 'ids required');
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    if (!banReasonSchema.safeParse(reason).success) {
      throw new AppError(ErrorCode.ZodValidation, '1001');
    }
    const target = this.userStore.getById(userId);
    if (!target) throw new AppError(ErrorCode.NotFound, '1031');
    if (target.role === UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    this.userStore.ban(userId, reason);
    this.authService.revokeToken(userId);
    appendAuditLog(operatorId, 'banUser', userId);
  }

  /** Alias. */
  ban(operatorId: string, operatorRole: string, userId: string, reason: string): void {
    this.banUser(operatorId, operatorRole, userId, reason);
  }

  /** unbanUser — unban a user. TLA+ L2_identity_access.unbanUser / L3_auth_session.unbanUser */
  unbanUser(operatorId: string, operatorRole: string, userId: string): void {
    if (operatorRole !== UserRole.Admin) {
      throw new AppError(ErrorCode.Rbac, '1021');
    }
    const target = this.userStore.getById(userId);
    if (!target) throw new AppError(ErrorCode.NotFound, '1031');
    this.userStore.unban(userId);
    appendAuditLog(operatorId, 'unbanUser', userId);
  }

  getById(id: string): User | null {
    return this.userStore.getById(id);
  }
}
