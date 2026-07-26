/**
 * 结构化 JSON 日志工具（DD-COMMON-002 / CON-004）。
 * 格式：{ level, timestamp, message, meta }
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  meta?: Record<string, unknown>;
}

export class Logger {
  private entries: LogEntry[] = [];
  private readonly minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'debug') {
    this.minLevel = minLevel;
  }

  private readonly order: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.order[level] >= this.order[this.minLevel];
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
    };
    if (meta !== undefined) {
      entry.meta = meta;
    }
    this.entries.push(entry);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  toJSON(): LogEntry[] {
    return this.getEntries();
  }
}
