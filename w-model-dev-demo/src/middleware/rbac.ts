/**
 * DD-002 RbacMiddleware —— RBAC 中间件
 *
 * 4 角色（user/blogger/admin/super_admin）权限矩阵校验、资源所有权校验。
 * super_admin 全权绕过（superAdminBypass=true）。
 *
 * TLA+ 一致性：
 * - AssignRole / RevokeRole / CheckPermission 对应 L3_rbac_enforcement.tla Next 分支
 * - AssignRole 也对应 L2_infrastructure.tla Next 分支
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Role } from '../types.js';
import { AppError } from '../utils/errors.js';

/** 权限动作类型 */
export type Action =
  | 'article.create'
  | 'article.update'
  | 'article.delete'
  | 'article.publish'
  | 'article.transition'
  | 'tag.create'
  | 'tag.merge'
  | 'category.manage'
  | 'comment.moderate'
  | 'user.ban'
  | 'user.unban'
  | 'site.config'
  | 'site.switch'
  | 'ad.manage'
  | 'ad.approve'
  | 'announcement.manage'
  | 'slot.manage'
  | 'sensitive.manage';

/** 角色×动作权限矩阵（RISK-003） */
const ROLE_MATRIX: Record<Role, Set<Action>> = {
  user: new Set<Action>([]),
  blogger: new Set<Action>(['article.create', 'article.update', 'article.delete', 'tag.create']),
  admin: new Set<Action>([
    'article.create', 'article.update', 'article.delete', 'article.publish', 'article.transition',
    'tag.create', 'tag.merge', 'category.manage', 'comment.moderate',
    'user.ban', 'user.unban', 'site.config', 'site.switch',
    'ad.manage', 'ad.approve', 'announcement.manage', 'slot.manage', 'sensitive.manage',
  ]),
  super_admin: new Set<Action>([
    'article.create', 'article.update', 'article.delete', 'article.publish', 'article.transition',
    'tag.create', 'tag.merge', 'category.manage', 'comment.moderate',
    'user.ban', 'user.unban', 'site.config', 'site.switch',
    'ad.manage', 'ad.approve', 'announcement.manage', 'slot.manage', 'sensitive.manage',
  ]),
};

/** super_admin 全权绕过 */
const SUPER_ADMIN_BYPASS = true;

/** 角色→用户ID映射（供 AssignRole / RevokeRole 操作） */
const userRoles: Map<string, Role> = new Map();

/**
 * 查权限矩阵（对应 DD-002 checkMatrix 私有方法 + TLA+ CheckPermission）。
 */
export function checkMatrix(role: Role, action: Action): boolean {
  if (SUPER_ADMIN_BYPASS && role === 'super_admin') return true;
  return ROLE_MATRIX[role]?.has(action) ?? false;
}

/**
 * CheckPermission 别名（对应 TLA+ L3_rbac_enforcement CheckPermission 动作）。
 */
export function checkPermission(userId: string, action: Action): boolean {
  const role = userRoles.get(userId);
  if (!role) return false;
  return checkMatrix(role, action);
}

/**
 * 分配角色（对应 TLA+ L2_infrastructure AssignRole + L3_rbac_enforcement AssignRole）。
 */
export function assignRole(userId: string, role: Role): void {
  userRoles.set(userId, role);
}

/**
 * 撤销角色（对应 TLA+ L3_rbac_enforcement RevokeRole）。
 */
export function revokeRole(userId: string): void {
  userRoles.delete(userId);
}

/**
 * 角色校验中间件工厂（对应 DD-002 requireRole）。
 * 通过则 next()，未登录抛 40101，权限不足抛 40301。
 */
export function requireRole(roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.userId) {
      throw new AppError(40101, '未登录');
    }
    const userRole = (req.user.role as Role) ?? 'user';
    const hasRole = roles.includes(userRole) || (SUPER_ADMIN_BYPASS && userRole === 'super_admin');
    if (!hasRole) {
      throw new AppError(40301, '权限不足', { required: roles, actual: userRole });
    }
    next();
  };
}

/**
 * 所有权校验中间件工厂（对应 DD-002 requireOwnership）。
 * @param resourceIdFn 从 req 提取资源 ID 的函数
 * @param ownerFn 异步获取资源所有者 ID 的函数
 */
export function requireOwnership(
  resourceIdFn: (req: Request) => string,
  ownerFn: (req: Request) => Promise<string>,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.userId) {
      throw new AppError(40101, '未登录');
    }
    // super_admin 绕过所有权校验
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      next();
      return;
    }
    const resourceId = resourceIdFn(req);
    const ownerId = await ownerFn(req);
    if (req.user.userId !== ownerId) {
      throw new AppError(40302, '所有权校验失败', { resourceId, userId: req.user.userId, ownerId });
    }
    next();
  };
}

/** RbacMiddleware 门面对象（对应 DD-002 类图） */
export const RbacMiddleware = {
  requireRole,
  requireOwnership,
  checkMatrix,
  checkPermission,
  assignRole,
  revokeRole,
};
