// Vitest 配置：仅扫描技能包门禁脚本单元测试。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
//
// testTimeout 说明：部分测试用 execSync 启动 `npx tsx <script>` 子进程（CLI 集成测试）。
// 在 WSL（Windows Subsystem for Linux）下访问 /mnt/d 挂载的 node_modules 冷启动较慢，
// 单次子进程可能超过默认 5000ms 超时（Windows 原生无此问题）。调大上限不影响 Windows 表现。
//
// fileParallelism: false 说明：仓库中 25/80 个测试文件用 execSync/spawnSync 启动真实 CLI 子进程，
// 并行执行时子进程互相竞争资源，导致偶发失败（`expected null to be N`：子进程未真正运行；
// 或 `Test timed out in 30000ms`），且每次落在不同文件——同一命令同一代码两次运行失败数可差 10 倍
// （实测 20 vs 2），量级跳动排除"断言写错"。已排除的修法：--maxWorkers=4 与 --testTimeout=120000 均仍失败；
// 基线 72081e2（未含相关改动）同样复现，故非某次改动引入。串行（本配置）实测确定性通过。
// 代价：带 coverage 的全量约 1090s（并行约 457s 但 exit 1）；pre-push 第 12 项因此项改动从
// "偶发红需重跑"变为"确定性绿"。排障与实测记录见 docs/troubleshooting.md §1.7a 与
// docs/changes/vitest-parallel-flakiness-finding.md。**不得为提速回退此开关**——回退即恢复抖动。
export default {
  test: {
    include: ['w-model-dev/scripts/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  // 覆盖率门禁：仅统计门禁核心实现（logic/ + lib/），不包括 CLI 入口与 __tests__。
  // include 与 test.include 一样相对仓库根解析（cwd=仓库根）。
  // thresholds 基线 = 2026-08-12 实测（logic+lib 合并）：stmts 75.32 / branch 66.57 / funcs 85.5 / lines 76.62，
  // 取实际值向下取整到 5 的倍数，随测试补充逐步上调。
  coverage: {
    provider: 'v8',
    include: ['w-model-dev/scripts/logic/**', 'w-model-dev/scripts/lib/**'],
    thresholds: { statements: 75, branches: 65, functions: 85, lines: 75 },
  },
};
