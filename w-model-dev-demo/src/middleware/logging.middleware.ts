/**
 * 日志中间件
 */
import type { Request, Response, NextFunction } from 'express';

export interface LogEntry {
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  ip: string;
  userAgent: string;
  ts: number;
}

const logs: LogEntry[] = [];

export function loggingMiddleware() {
  return function (req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const entry: LogEntry = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ip: req.ip ?? 'unknown',
        userAgent: (req.headers['user-agent'] as string) ?? '',
        ts: start,
      };
      logs.push(entry);
      if (logs.length > 10000) {
        logs.shift();
      }
    });
    next();
  };
}

export function getRecentLogs(limit: number = 100): LogEntry[] {
  return logs.slice(-limit);
}

export function clearLogs(): void {
  logs.length = 0;
}
