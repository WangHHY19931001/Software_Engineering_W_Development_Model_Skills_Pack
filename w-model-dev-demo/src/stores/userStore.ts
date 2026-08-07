/**
 * UserStore（DD-004）：User 实体内存存储；email/username 唯一索引；blogger 为 role 过滤视图（非独立实体）。
 */
import { BizError } from '../utils/errors';
import { SnapshotStore, nextId } from './base';
import type { Role, User } from '../types';

interface UserState {
  map: Map<string, User>;
  emailIndex: Map<string, string>;
  usernameIndex: Map<string, string>;
  seq: { n: number };
}

export type UserCreateInput = Omit<User, 'id' | 'nickname' | 'bio' | 'avatarUrl'> & {
  id?: string;
  nickname?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
};

export class UserStore extends SnapshotStore<UserState> {
  protected state: UserState = { map: new Map(), emailIndex: new Map(), usernameIndex: new Map(), seq: { n: 0 } };

  create(user: UserCreateInput): User {
    if (this.state.emailIndex.has(user.email)) {
      throw new BizError(40901, '邮箱已被占用');
    }
    if (this.state.usernameIndex.has(user.username)) {
      throw new BizError(40901, '用户名已被占用');
    }
    const id = user.id ?? nextId('u', this.state.seq);
    const record: User = {
      id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      nickname: user.nickname ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      createdAt: user.createdAt,
    };
    this.state.map.set(id, record);
    this.state.emailIndex.set(record.email, id);
    this.state.usernameIndex.set(record.username, id);
    return record;
  }

  findByEmail(email: string): User | null {
    const id = this.state.emailIndex.get(email);
    return id ? this.state.map.get(id) ?? null : null;
  }

  findByUsername(username: string): User | null {
    const id = this.state.usernameIndex.get(username);
    return id ? this.state.map.get(id) ?? null : null;
  }

  findById(id: string): User | null {
    return this.state.map.get(id) ?? null;
  }

  findAll(): User[] {
    return [...this.state.map.values()];
  }

  /** Blogger 派生视图（ID-1）：role='blogger' 过滤子集，不独立存储 */
  findBloggers(): User[] {
    return [...this.state.map.values()].filter((u) => u.role === 'blogger');
  }

  /** 资料字段更新（nickname/bio/avatarUrl）；passwordHash 经专用路径（changePassword 使用） */
  update(id: string, patch: Partial<Pick<User, 'nickname' | 'bio' | 'avatarUrl' | 'passwordHash'>>): User {
    const user = this.require(id);
    const next: User = { ...user, ...patch, id: user.id };
    this.state.map.set(id, next);
    return next;
  }

  updateRole(id: string, role: Role): User {
    const user = this.require(id);
    const next: User = { ...user, role };
    this.state.map.set(id, next);
    return next;
  }

  private require(id: string): User {
    const user = this.state.map.get(id);
    if (!user) throw new BizError(40401, '用户不存在');
    return user;
  }
}
