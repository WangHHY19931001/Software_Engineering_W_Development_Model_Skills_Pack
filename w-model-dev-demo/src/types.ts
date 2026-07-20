export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  articleId: string;
  content: string;
  authorId: string;
  createdAt: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}
