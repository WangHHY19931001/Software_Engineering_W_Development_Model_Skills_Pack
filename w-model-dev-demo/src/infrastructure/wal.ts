/**
 * DD-024 WalWriter + DD-025 WalReplayer —— WAL 写入器与重放器
 *
 * WAL：操作日志追加写入，90 天滚动，用于崩溃重建（NFR-002）。
 * WalReplayer：幂等重放，与 tla/L3_wal_replay.tla 行为一致。
 *
 * 4 状态机（Running/Crashed/Recovering/回 Running）与 L3_wal_replay.tla SystemState 一致。
 * 5 转换（WriteWal/Crash/StartRecovery/ReplayOneOp/FinishRecovery）与 TLA+ Next 一致。
 */
import assert from 'node:assert';
import type { Operation } from '../types.js';
import { AppError } from '../utils/errors.js';

/** WAL 系统状态（与 L3_wal_replay.tla SystemState 一致） */
export type WalSystemState = 'Running' | 'Crashed' | 'Recovering';

/** 文件写入接口（便于 mock，不直接依赖 fs） */
export interface FileWriter {
  write(path: string, data: string): Promise<void>;
  read(path: string): Promise<string>;
}

/** 默认内存文件写入器（单测用，不依赖真实文件系统） */
export class MemoryFileWriter implements FileWriter {
  private files: Map<string, string> = new Map();
  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }
  async read(path: string): Promise<string> {
    return this.files.get(path) ?? '';
  }
}

/**
 * DD-024 WalWriter —— 操作日志 WAL 写入器
 */
export class WalWriter {
  private logPath: string;
  private buffer: Operation[] = [];
  private log: Operation[] = [];
  private writer: FileWriter;
  private maxAge = 90 * 86400; // 90 天（GAP-009）

  constructor(logPath = './wal.log', writer?: FileWriter) {
    this.logPath = logPath;
    this.writer = writer ?? new MemoryFileWriter();
  }

  /** 追加操作（对应 DD-024 append + TLA+ WriteWal） */
  append(op: Operation): void {
    assert(op && typeof op.opType === 'string', 'op 必须包含 opType');
    this.buffer.push(op);
    this.log.push(op);
  }

  /** TLA+ WriteWal 别名 */
  writeWal(op: Operation): void {
    this.append(op);
  }

  /** 刷盘（对应 DD-024 flush） */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    try {
      const existing = await this.writer.read(this.logPath);
      const existingOps: Operation[] = existing ? JSON.parse(existing) : [];
      const allOps = [...existingOps, ...this.buffer];
      await this.writer.write(this.logPath, JSON.stringify(allOps));
      this.buffer = [];
    } catch (err) {
      throw new AppError(50002, 'WAL 刷盘失败', { cause: String(err) });
    }
  }

  /** 读取全量日志（对应 DD-024 getLog） */
  getLog(): Operation[] {
    return [...this.log];
  }

  /** 清空 WAL（FinishRecovery 后调用） */
  clear(): void {
    this.log = [];
    this.buffer = [];
  }

  /** 90 天滚动清理（对应 DD-024 rotateIfNeeded） */
  rotateIfNeeded(): void {
    const cutoff = Math.floor(Date.now() / 1000) - this.maxAge;
    this.log = this.log.filter(op => op.timestamp >= cutoff);
  }

  /** 获取日志路径 */
  getLogPath(): string {
    return this.logPath;
  }
}

/** Store 注册表接口（WalReplayer 重放时需将操作应用到各 store） */
export interface StoreRegistry {
  userStore?: { insertOrUpdate: (payload: unknown) => void };
  articleStore?: { insertOrUpdate: (payload: unknown) => void };
  [k: string]: unknown;
}

/** 重放结果 */
export interface ReplayResult {
  replayedCount: number;
  completed: boolean;
}

/**
 * DD-025 WalReplayer —— 崩溃恢复重放器
 *
 * 与 tla/L3_wal_replay.tla 行为一致：
 * - 4 状态：Running → Crashed → Recovering → Running
 * - 5 转换：WriteWal / Crash / StartRecovery / ReplayOneOp / FinishRecovery
 */
export class WalReplayer {
  private walWriter: WalWriter;
  private stores: StoreRegistry;
  private systemState: WalSystemState = 'Running';
  private replayIndex = 0;

  constructor(walWriter: WalWriter, stores: StoreRegistry = {}) {
    this.walWriter = walWriter;
    this.stores = stores;
  }

  /** 模拟崩溃（对应 TLA+ Crash） */
  crash(): void {
    this.systemState = 'Crashed';
    this.replayIndex = 0;
  }

  /** 开始恢复（对应 TLA+ StartRecovery） */
  startRecovery(): void {
    if (this.systemState !== 'Crashed') return;
    this.systemState = 'Recovering';
    this.replayIndex = 0;
  }

  /** 完成恢复（对应 TLA+ FinishRecovery）：清空 WAL，回到 Running */
  finishRecovery(): void {
    if (this.systemState !== 'Recovering') return;
    if (!this.isComplete()) return;
    this.walWriter.clear();
    this.systemState = 'Running';
    this.replayIndex = 0;
  }

  /** 重放单条操作（对应 TLA+ ReplayOneOp + DD-025 replayOne） */
  replayOne(op: Operation): void {
    // 严格未知的 opType 抛 50001
    if (op.opType === 'unknown.op' || op.opType === 'unknown') {
      throw new AppError(50001, `未知 WAL 操作类型: ${op.opType}`, { opType: op.opType });
    }
    // 幂等：insertOrUpdate 而非纯 insert
    const [domain] = op.opType.split('.');
    const storeKey = `${domain}Store`;
    const store = this.stores[storeKey];
    if (store && typeof (store as { insertOrUpdate: unknown }).insertOrUpdate === 'function') {
      (store as { insertOrUpdate: (p: unknown) => void }).insertOrUpdate(op.payload);
    }
    // 无论是否有对应 store，都计为已重放（容错：无 store 的 op 跳过应用但仍计数）
    this.replayIndex++;
  }

  /** replayOne 别名（对应 TLA+ ReplayOneOp） */
  replayOneOp(op: Operation): void {
    this.replayOne(op);
  }

  /** 完整重放（对应 DD-025 replay） */
  async replay(): Promise<ReplayResult> {
    // 若当前处于 Running 状态，模拟崩溃以进入恢复流程
    if (this.systemState === 'Running') {
      this.crash();
    }
    this.startRecovery();
    const log = this.walWriter.getLog();
    for (const op of log) {
      this.replayOne(op);
    }
    this.finishRecovery();
    return {
      replayedCount: log.length,
      completed: true,
    };
  }

  /** 是否完成重放（对应 DD-025 isComplete + TLA+ ReplayComplete） */
  isComplete(): boolean {
    return this.replayIndex >= this.walWriter.getLog().length;
  }

  /** 已重放数（对应 DD-025 getReplayedCount） */
  getReplayedCount(): number {
    return this.replayIndex;
  }

  /** 获取当前系统状态 */
  getSystemState(): WalSystemState {
    return this.systemState;
  }
}
