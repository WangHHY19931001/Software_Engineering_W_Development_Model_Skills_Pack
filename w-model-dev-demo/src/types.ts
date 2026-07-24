// 类型定义（对应 detailed-design.md §2.3 数据类型定义）

export type Role = 'admin' | 'user';

export type ArticleStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string; // UUID，格式 "u-<timestamp>-<random>"
  username: string; // 用户名，len [3, 32]，字母数字下划线
  passwordHash: string; // bcrypt 哈希，以 "$2" 开头
  role: Role;
  createdAt: string; // ISO8601 时间戳
}

export interface Article {
  id: string; // UUID，格式 "a-<timestamp>-<random>"
  title: string; // 标题，len [1, 200]
  content: string; // 正文，len [1, 10000]
  status: ArticleStatus;
  authorId: string; // 作者 ID → User.id
  createdAt: string; // ISO8601 时间戳
}

export interface Comment {
  id: string; // UUID，格式 "c-<timestamp>-<random>"
  articleId: string; // 文章 ID → Article.id
  authorId: string; // 作者 ID → User.id
  content: string; // 评论内容，len [1, 1000]
  createdAt: string; // ISO8601 时间戳
}

export interface JwtPayload {
  userId: string;
  role: Role;
}

export interface ApiResponse<T> {
  code: number; // 0=成功，非 0=错误码
  message: string;
  data?: T;
}

// 服务层 Result 类型（detailed-design.md §2.3）
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: number; message: string };
