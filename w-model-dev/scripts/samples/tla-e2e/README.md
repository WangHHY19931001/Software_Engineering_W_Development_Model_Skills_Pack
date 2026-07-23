# TLA+ 端到端测试 Fixture（samples/tla-e2e/）

本目录提供 TLA+ 模型校验的**端到端**（end-to-end）测试 fixture，覆盖 SANY 语法检查与 TLC 模型检查的完整链路。与 `samples/tla/` 下的纯逻辑 JSON 样本不同，本目录的 fixture **需要 Java 运行时与 tla2tools.jar**，由 `check-tla-model.ts` 实际调用 SANY/TLC 工具执行校验。

## 与 samples/tla/ 的区别

| 维度 | `samples/tla/` | `samples/tla-e2e/`（本目录） |
|------|----------------|-------------------------------|
| 用途 | 纯逻辑回归基线（self-test.ts 驱动） | 端到端工具链验证（手动 / CI 驱动） |
| 依赖 | 无（仅 JSON + checkTlaModel 纯逻辑） | Java 11+ + tla2tools.jar |
| 校验内容 | manifest 结构 + 层次 + 拆解 + 声明标志 | 上述 + 实际 SANY 语法 + TLC 死锁/不变式/状态爆炸 |
| 触发方式 | `npm run self-test`（自动） | `npx tsx check-tla-model.ts <manifest>`（手动） |

## 前置条件

1. **Java ≥ 11**：`java -version` 可执行，主版本号 ≥ 11
2. **tla2tools.jar**：位于 `w-model-dev/tools/tla2tools.jar`（TLC2 2.19 实测验证）
3. **运行目录**：所有命令须在本目录（`samples/tla-e2e/`）下执行，manifest 中的 `jarPath: "../../../tools/tla2tools.jar"` 按相对路径解析

## Fixture 清单

本目录覆盖 4 个场景，每个场景含 `.tla`（规格）+ `.cfg`（TLC 配置）+ `tla-manifest-*.json`（校验清单）：

| 场景 | .tla | .cfg | manifest | 期望结果 |
|------|------|------|----------|----------|
| 正常通过 | Counter.tla | Counter.cfg | tla-manifest-counter-pass.json | ✓ SANY 通过 + TLC 零违反 |
| 死锁 | DeadlockDemo.tla | DeadlockDemo.cfg | tla-manifest-deadlock-fail.json | ✗ TLC 检出死锁 |
| 不变式违反 | InvViolation.tla | InvViolation.cfg | tla-manifest-invviolation-fail.json | ✗ TLC 检出 Inv 不变式违反 |
| 语法错误 | SyntaxError.tla | SyntaxError.cfg | tla-manifest-syntax-error-fail.json | ✗ SANY 语法检查失败（TLC 不执行） |

### 场景说明

1. **Counter（通过）**：模 11 计数器，`n' = (n+1) % 11`，状态空间 11（0–10），不变式 `n >= 0 /\ n <= 10` 恒成立。SANY 通过，TLC 零违反。

2. **DeadlockDemo（死锁）**：`Next == n < 3 /\ n' = n+1`，当 `n=3` 时无后继状态，TLC 检出死锁。`.cfg` 使用 `INIT Init` / `NEXT Next` 模式。

3. **InvViolation（不变式违反）**：无界递增 `n' = n+1`，不变式 `Inv == n <= 3`，TLC 在 `n=4` 时检出违反。`.cfg` 使用 `SPECIFICATION Spec` + `INVARIANT Inv` 模式。

4. **SyntaxError（语法错误）**：`Spec == Init [][Next]_n` 缺少 `/\` 连接符，SANY 解析失败。因 SANY 未通过，TLC 不会执行（反模式 #14 守护）。

## 运行方式

在本目录下执行（cwd = `samples/tla-e2e/`）：

```bash
# 场景 1：正常通过（期望退出码 0）
npx tsx ../../../check-tla-model.ts tla-manifest-counter-pass.json

# 场景 2：死锁（期望退出码 1，violations 含 "Deadlock"）
npx tsx ../../../check-tla-model.ts tla-manifest-deadlock-fail.json

# 场景 3：不变式违反（期望退出码 1，violations 含 "Invariant" "violated"）
npx tsx ../../../check-tla-model.ts tla-manifest-invviolation-fail.json

# 场景 4：语法错误（期望退出码 1，violations 含 "SANY 语法检查失败"）
npx tsx ../../../check-tla-model.ts tla-manifest-syntax-error-fail.json
```

## 退出码约定

| 退出码 | 含义 |
|--------|------|
| 0 | 校验通过（环境就绪 + 头部一致 + 层次一致 + 拆解合规 + SANY 通过 + TLC 零违反） |
| 1 | 校验失败（violations 列出具体原因） |
| 2 | 输入错误（文件不存在 / 非法 JSON / 参数非法） |

## .tla 文件头注解

每个 `.tla` 文件均含 `@system` / `@requirement` / `@design` / `@parent` / `@sibling` / `@child` / `@level` / `@phase` 头部注解，用于 `validateHeader` 校验 manifest 与 .tla 头部的一致性。详见 `docs/tla-plus-guide.md` §文件头注解。
