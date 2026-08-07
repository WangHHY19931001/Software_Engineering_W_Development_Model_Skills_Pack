/**
 * 系统测试通用工具（阶段 7，seam-HTTP + seam-STORE，接口设计 §6）。
 * - 复用阶段 6 集成测试 seam（createTestEnv / seed* / register / login / bearer / pollUntil / startMockServer）。
 * - 新增系统级工具：P95 分位计算、并发负载取样（ST-029~031 性能基线，TC-DES-008 型）。
 * - 限制说明：supertest 直连 app 工厂（不启端口），req.ip 恒为 127.0.0.1（无法模拟多客户端 IP），
 *   性能度量环境 = 进程内请求（无网络开销），符合 blog-system-system-test.md「性能度量环境声明」。
 */
export * from '../integration/helpers';

/**
 * P95 响应时间（ms）：升序排列后取 95% 分位（不足 20 样本时取最大值）。
 * 性能基线断言：P95 ≤ 2000ms（NFR-001 testThreshold，10 倍放宽）。
 */
export function calcP95(times: number[]): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  if (sorted.length < 20) return sorted[sorted.length - 1];
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

export interface LoadResult {
  /** 单请求耗时（ms，全部样本） */
  times: number[];
  /** 请求状态码（全部样本） */
  statuses: number[];
  /** 错误率（非 2xx 比例） */
  errorRate: number;
  p95: number;
}

/**
 * 并发负载取样（等价取样 ≥1000 样本：concurrency × rounds）。
 * 每个样本：发起一个 HTTP 请求并记录耗时/状态码；rounds 轮并发批次（预热语义由调用方控制）。
 */
export async function runLoad(
  fire: () => Promise<{ status: number }>,
  concurrency: number,
  rounds: number,
): Promise<LoadResult> {
  const times: number[] = [];
  const statuses: number[] = [];
  for (let r = 0; r < rounds; r += 1) {
    const batch = Array.from({ length: concurrency }, async () => {
      const started = Date.now();
      const res = await fire();
      times.push(Date.now() - started);
      statuses.push(res.status);
    });
    await Promise.all(batch);
  }
  const errors = statuses.filter((s) => s < 200 || s >= 300).length;
  return {
    times,
    statuses,
    errorRate: errors / statuses.length,
    p95: calcP95(times),
  };
}
