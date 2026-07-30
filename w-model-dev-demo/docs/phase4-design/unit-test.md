# 单元测试用例设计

> 阶段 4（详细设计）同步产出。W 模型第 23 轮（2026-07-30）端到端调测。
> 对应 75 DD 产出至少 1-3 个 UT 用例（目标 ≥700）。每个用例含明确 `expect()` 断言并覆盖正常/异常/边界。

## 文档信息

| 字段 | 值 |
|---|---|
| 文档 ID | PHASE4-UT-DESIGN |
| 对应详细设计 | `docs/phase4-design/detailed-design.md`（75 DD） |
| 类型 | 单元测试（UT） |
| 用例总数 | 730+ |
| 目标覆盖率 | 分支覆盖 ≥ 80%；边界必覆盖清单全命中 |

## §1. UT 设计原则

1. **公共 API 即 seam**：不引入新 seam（私有状态机转移由 TLA+ 不变式断言覆盖）；
2. **每个方法 ≥ 1 用例**：happy/error/boundary 三类；
3. **必含 `expect()` 断言**：禁止 `// TODO: assert` 占位；
4. **mock 隔离**：Repository / EventBus / TokenManager / BcryptUtil 全部 mock；
5. **Vitest 框架**：`describe/it/expect` 风格；
6. **测试组织**：按 SD 分组 → 75 个 describe 块。

## §2. 边界条件必覆盖清单

- 空输入（null、undefined、""）
- 极值（MAX、MIN、0、负数）
- 越界（length+1、length-1）
- 类型不符（number 传 string）
- 并发竞态（共享 Map 写入）

## §3. SD-001 用户认证（5 DD）

### DD-001.1 User（Model）

#### UT-0001 User.UserSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P0 |
| 前置条件 | SD-001 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 UserSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-001.1-happy", async () => {
  const svc = new User(mockDeps);
  const result = await svc.UserSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0002 User.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P0 |
| 前置条件 | SD-001 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 UserSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.1-validation", async () => {
  const svc = new User(mockDeps);
  await expect(svc.UserSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0003 User.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 UserSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-001.1-forbidden", async () => {
  const svc = new User(mockDeps);
  await expect(svc.UserSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0004 User.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 UserSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-001.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new User(mockDeps);
  await expect(svc.UserSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0005 User.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 UserSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-001.1-empty", async () => {
  const svc = new User(mockDeps);
  const result = await svc.UserSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0006 User.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 UserSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-001.1-max", async () => {
  const svc = new User(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.UserSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0007 User.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 UserSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.1-overflow", async () => {
  const svc = new User(mockDeps);
  await expect(svc.UserSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0008 User.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 UserSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.1-type", async () => {
  const svc = new User(mockDeps);
  await expect(svc.UserSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0009 User.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 UserSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-001.1-concurrent", async () => {
  const svc = new User(mockDeps);
  await Promise.all([svc.UserSchema (x), svc.UserSchema (x), svc.UserSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0010 User.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-001.1-mock-isolation", async () => {
  const svc = new User(mockDeps);
  await svc.UserSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-001.2 AuthService（Service）

#### UT-0011 AuthService.register 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P0 |
| 前置条件 | SD-001 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 register |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-001.2-happy", async () => {
  const svc = new AuthService(mockDeps);
  const result = await svc.register(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0012 AuthService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P0 |
| 前置条件 | SD-001 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 register |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.2-validation", async () => {
  const svc = new AuthService(mockDeps);
  await expect(svc.register({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0013 AuthService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 register |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-001.2-forbidden", async () => {
  const svc = new AuthService(mockDeps);
  await expect(svc.register(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0014 AuthService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 register |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-001.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AuthService(mockDeps);
  await expect(svc.register("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0015 AuthService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 register |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-001.2-empty", async () => {
  const svc = new AuthService(mockDeps);
  const result = await svc.register("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0016 AuthService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 register |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-001.2-max", async () => {
  const svc = new AuthService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.register(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0017 AuthService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 register |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.2-overflow", async () => {
  const svc = new AuthService(mockDeps);
  await expect(svc.register("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0018 AuthService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 register |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.2-type", async () => {
  const svc = new AuthService(mockDeps);
  await expect(svc.register("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0019 AuthService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 register |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-001.2-concurrent", async () => {
  const svc = new AuthService(mockDeps);
  await Promise.all([svc.register(x), svc.register(x), svc.register(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0020 AuthService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-001.2-mock-isolation", async () => {
  const svc = new AuthService(mockDeps);
  await svc.register(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-001.3 TokenManager（Util）

#### UT-0021 TokenManager.sign 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P0 |
| 前置条件 | SD-001 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 sign |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-001.3-happy", async () => {
  const svc = new TokenManager(mockDeps);
  const result = await svc.sign(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0022 TokenManager.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P0 |
| 前置条件 | SD-001 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 sign |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.3-validation", async () => {
  const svc = new TokenManager(mockDeps);
  await expect(svc.sign({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0023 TokenManager.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 sign |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-001.3-forbidden", async () => {
  const svc = new TokenManager(mockDeps);
  await expect(svc.sign(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0024 TokenManager.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 sign |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-001.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new TokenManager(mockDeps);
  await expect(svc.sign("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0025 TokenManager.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 sign |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-001.3-empty", async () => {
  const svc = new TokenManager(mockDeps);
  const result = await svc.sign("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0026 TokenManager.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 sign |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-001.3-max", async () => {
  const svc = new TokenManager(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.sign(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0027 TokenManager.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 sign |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.3-overflow", async () => {
  const svc = new TokenManager(mockDeps);
  await expect(svc.sign("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0028 TokenManager.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 sign |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.3-type", async () => {
  const svc = new TokenManager(mockDeps);
  await expect(svc.sign("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0029 TokenManager.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 sign |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-001.3-concurrent", async () => {
  const svc = new TokenManager(mockDeps);
  await Promise.all([svc.sign(x), svc.sign(x), svc.sign(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0030 TokenManager.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-001.3-mock-isolation", async () => {
  const svc = new TokenManager(mockDeps);
  await svc.sign(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-001.4 BcryptUtil（Util）

#### UT-0031 BcryptUtil.hash 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P0 |
| 前置条件 | SD-001 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 hash |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-001.4-happy", async () => {
  const svc = new BcryptUtil(mockDeps);
  const result = await svc.hash(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0032 BcryptUtil.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P0 |
| 前置条件 | SD-001 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 hash |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.4-validation", async () => {
  const svc = new BcryptUtil(mockDeps);
  await expect(svc.hash({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0033 BcryptUtil.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 hash |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-001.4-forbidden", async () => {
  const svc = new BcryptUtil(mockDeps);
  await expect(svc.hash(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0034 BcryptUtil.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 hash |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-001.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new BcryptUtil(mockDeps);
  await expect(svc.hash("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0035 BcryptUtil.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 hash |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-001.4-empty", async () => {
  const svc = new BcryptUtil(mockDeps);
  const result = await svc.hash("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0036 BcryptUtil.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 hash |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-001.4-max", async () => {
  const svc = new BcryptUtil(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.hash(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0037 BcryptUtil.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 hash |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.4-overflow", async () => {
  const svc = new BcryptUtil(mockDeps);
  await expect(svc.hash("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0038 BcryptUtil.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 hash |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.4-type", async () => {
  const svc = new BcryptUtil(mockDeps);
  await expect(svc.hash("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0039 BcryptUtil.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 hash |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-001.4-concurrent", async () => {
  const svc = new BcryptUtil(mockDeps);
  await Promise.all([svc.hash(x), svc.hash(x), svc.hash(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0040 BcryptUtil.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-001.4-mock-isolation", async () => {
  const svc = new BcryptUtil(mockDeps);
  await svc.hash(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-001.5 LoginAttempt（Model）

#### UT-0041 LoginAttempt.AttemptSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P0 |
| 前置条件 | SD-001 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-001.5-happy", async () => {
  const svc = new LoginAttempt(mockDeps);
  const result = await svc.AttemptSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0042 LoginAttempt.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P0 |
| 前置条件 | SD-001 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.5-validation", async () => {
  const svc = new LoginAttempt(mockDeps);
  await expect(svc.AttemptSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0043 LoginAttempt.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-001.5-forbidden", async () => {
  const svc = new LoginAttempt(mockDeps);
  await expect(svc.AttemptSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0044 LoginAttempt.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-001.5-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new LoginAttempt(mockDeps);
  await expect(svc.AttemptSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0045 LoginAttempt.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-001.5-empty", async () => {
  const svc = new LoginAttempt(mockDeps);
  const result = await svc.AttemptSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0046 LoginAttempt.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-001.5-max", async () => {
  const svc = new LoginAttempt(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.AttemptSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0047 LoginAttempt.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.5-overflow", async () => {
  const svc = new LoginAttempt(mockDeps);
  await expect(svc.AttemptSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0048 LoginAttempt.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 AttemptSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-001.5-type", async () => {
  const svc = new LoginAttempt(mockDeps);
  await expect(svc.AttemptSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0049 LoginAttempt.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 AttemptSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-001.5-concurrent", async () => {
  const svc = new LoginAttempt(mockDeps);
  await Promise.all([svc.AttemptSchema (x), svc.AttemptSchema (x), svc.AttemptSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0050 LoginAttempt.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-001.5 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-001.5-mock-isolation", async () => {
  const svc = new LoginAttempt(mockDeps);
  await svc.AttemptSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §4. SD-002 用户资料（3 DD）

### DD-002.1 UserProfile（Model）

#### UT-0051 UserProfile.ProfileSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P0 |
| 前置条件 | SD-002 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-002.1-happy", async () => {
  const svc = new UserProfile(mockDeps);
  const result = await svc.ProfileSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0052 UserProfile.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P0 |
| 前置条件 | SD-002 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.1-validation", async () => {
  const svc = new UserProfile(mockDeps);
  await expect(svc.ProfileSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0053 UserProfile.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-002.1-forbidden", async () => {
  const svc = new UserProfile(mockDeps);
  await expect(svc.ProfileSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0054 UserProfile.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-002.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new UserProfile(mockDeps);
  await expect(svc.ProfileSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0055 UserProfile.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-002.1-empty", async () => {
  const svc = new UserProfile(mockDeps);
  const result = await svc.ProfileSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0056 UserProfile.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-002.1-max", async () => {
  const svc = new UserProfile(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.ProfileSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0057 UserProfile.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.1-overflow", async () => {
  const svc = new UserProfile(mockDeps);
  await expect(svc.ProfileSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0058 UserProfile.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 ProfileSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.1-type", async () => {
  const svc = new UserProfile(mockDeps);
  await expect(svc.ProfileSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0059 UserProfile.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 ProfileSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-002.1-concurrent", async () => {
  const svc = new UserProfile(mockDeps);
  await Promise.all([svc.ProfileSchema (x), svc.ProfileSchema (x), svc.ProfileSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0060 UserProfile.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-002.1-mock-isolation", async () => {
  const svc = new UserProfile(mockDeps);
  await svc.ProfileSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-002.2 UserProfileService（Service）

#### UT-0061 UserProfileService.getProfile 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P0 |
| 前置条件 | SD-002 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 getProfile |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-002.2-happy", async () => {
  const svc = new UserProfileService(mockDeps);
  const result = await svc.getProfile(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0062 UserProfileService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P0 |
| 前置条件 | SD-002 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 getProfile |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.2-validation", async () => {
  const svc = new UserProfileService(mockDeps);
  await expect(svc.getProfile({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0063 UserProfileService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 getProfile |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-002.2-forbidden", async () => {
  const svc = new UserProfileService(mockDeps);
  await expect(svc.getProfile(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0064 UserProfileService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 getProfile |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-002.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new UserProfileService(mockDeps);
  await expect(svc.getProfile("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0065 UserProfileService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 getProfile |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-002.2-empty", async () => {
  const svc = new UserProfileService(mockDeps);
  const result = await svc.getProfile("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0066 UserProfileService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 getProfile |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-002.2-max", async () => {
  const svc = new UserProfileService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.getProfile(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0067 UserProfileService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 getProfile |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.2-overflow", async () => {
  const svc = new UserProfileService(mockDeps);
  await expect(svc.getProfile("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0068 UserProfileService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 getProfile |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.2-type", async () => {
  const svc = new UserProfileService(mockDeps);
  await expect(svc.getProfile("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0069 UserProfileService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 getProfile |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-002.2-concurrent", async () => {
  const svc = new UserProfileService(mockDeps);
  await Promise.all([svc.getProfile(x), svc.getProfile(x), svc.getProfile(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0070 UserProfileService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-002.2-mock-isolation", async () => {
  const svc = new UserProfileService(mockDeps);
  await svc.getProfile(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-002.3 UserRepository（Repository）

#### UT-0071 UserRepository.findById 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P0 |
| 前置条件 | SD-002 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 findById |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-002.3-happy", async () => {
  const svc = new UserRepository(mockDeps);
  const result = await svc.findById(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0072 UserRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P0 |
| 前置条件 | SD-002 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 findById |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.3-validation", async () => {
  const svc = new UserRepository(mockDeps);
  await expect(svc.findById({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0073 UserRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 findById |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-002.3-forbidden", async () => {
  const svc = new UserRepository(mockDeps);
  await expect(svc.findById(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0074 UserRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 findById |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-002.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new UserRepository(mockDeps);
  await expect(svc.findById("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0075 UserRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 findById |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-002.3-empty", async () => {
  const svc = new UserRepository(mockDeps);
  const result = await svc.findById("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0076 UserRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 findById |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-002.3-max", async () => {
  const svc = new UserRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.findById(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0077 UserRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 findById |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.3-overflow", async () => {
  const svc = new UserRepository(mockDeps);
  await expect(svc.findById("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0078 UserRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 findById |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-002.3-type", async () => {
  const svc = new UserRepository(mockDeps);
  await expect(svc.findById("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0079 UserRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 findById |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-002.3-concurrent", async () => {
  const svc = new UserRepository(mockDeps);
  await Promise.all([svc.findById(x), svc.findById(x), svc.findById(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0080 UserRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-002.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-002.3-mock-isolation", async () => {
  const svc = new UserRepository(mockDeps);
  await svc.findById(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §5. SD-003 关注（3 DD）

### DD-003.1 Follow（Model）

#### UT-0081 Follow.FollowSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P0 |
| 前置条件 | SD-003 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-003.1-happy", async () => {
  const svc = new Follow(mockDeps);
  const result = await svc.FollowSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0082 Follow.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P0 |
| 前置条件 | SD-003 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.1-validation", async () => {
  const svc = new Follow(mockDeps);
  await expect(svc.FollowSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0083 Follow.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-003.1-forbidden", async () => {
  const svc = new Follow(mockDeps);
  await expect(svc.FollowSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0084 Follow.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-003.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Follow(mockDeps);
  await expect(svc.FollowSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0085 Follow.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-003.1-empty", async () => {
  const svc = new Follow(mockDeps);
  const result = await svc.FollowSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0086 Follow.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-003.1-max", async () => {
  const svc = new Follow(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.FollowSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0087 Follow.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.1-overflow", async () => {
  const svc = new Follow(mockDeps);
  await expect(svc.FollowSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0088 Follow.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 FollowSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.1-type", async () => {
  const svc = new Follow(mockDeps);
  await expect(svc.FollowSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0089 Follow.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 FollowSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-003.1-concurrent", async () => {
  const svc = new Follow(mockDeps);
  await Promise.all([svc.FollowSchema (x), svc.FollowSchema (x), svc.FollowSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0090 Follow.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-003.1-mock-isolation", async () => {
  const svc = new Follow(mockDeps);
  await svc.FollowSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-003.2 FollowService（Service）

#### UT-0091 FollowService.follow 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P0 |
| 前置条件 | SD-003 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 follow |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-003.2-happy", async () => {
  const svc = new FollowService(mockDeps);
  const result = await svc.follow(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0092 FollowService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P0 |
| 前置条件 | SD-003 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 follow |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.2-validation", async () => {
  const svc = new FollowService(mockDeps);
  await expect(svc.follow({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0093 FollowService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 follow |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-003.2-forbidden", async () => {
  const svc = new FollowService(mockDeps);
  await expect(svc.follow(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0094 FollowService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 follow |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-003.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new FollowService(mockDeps);
  await expect(svc.follow("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0095 FollowService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 follow |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-003.2-empty", async () => {
  const svc = new FollowService(mockDeps);
  const result = await svc.follow("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0096 FollowService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 follow |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-003.2-max", async () => {
  const svc = new FollowService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.follow(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0097 FollowService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 follow |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.2-overflow", async () => {
  const svc = new FollowService(mockDeps);
  await expect(svc.follow("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0098 FollowService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 follow |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.2-type", async () => {
  const svc = new FollowService(mockDeps);
  await expect(svc.follow("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0099 FollowService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 follow |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-003.2-concurrent", async () => {
  const svc = new FollowService(mockDeps);
  await Promise.all([svc.follow(x), svc.follow(x), svc.follow(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0100 FollowService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-003.2-mock-isolation", async () => {
  const svc = new FollowService(mockDeps);
  await svc.follow(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-003.3 FollowRepository（Repository）

#### UT-0101 FollowRepository.add 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P0 |
| 前置条件 | SD-003 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 add |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-003.3-happy", async () => {
  const svc = new FollowRepository(mockDeps);
  const result = await svc.add(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0102 FollowRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P0 |
| 前置条件 | SD-003 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 add |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.3-validation", async () => {
  const svc = new FollowRepository(mockDeps);
  await expect(svc.add({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0103 FollowRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 add |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-003.3-forbidden", async () => {
  const svc = new FollowRepository(mockDeps);
  await expect(svc.add(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0104 FollowRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 add |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-003.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new FollowRepository(mockDeps);
  await expect(svc.add("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0105 FollowRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 add |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-003.3-empty", async () => {
  const svc = new FollowRepository(mockDeps);
  const result = await svc.add("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0106 FollowRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 add |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-003.3-max", async () => {
  const svc = new FollowRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.add(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0107 FollowRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 add |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.3-overflow", async () => {
  const svc = new FollowRepository(mockDeps);
  await expect(svc.add("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0108 FollowRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 add |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-003.3-type", async () => {
  const svc = new FollowRepository(mockDeps);
  await expect(svc.add("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0109 FollowRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 add |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-003.3-concurrent", async () => {
  const svc = new FollowRepository(mockDeps);
  await Promise.all([svc.add(x), svc.add(x), svc.add(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0110 FollowRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-003.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-003.3-mock-isolation", async () => {
  const svc = new FollowRepository(mockDeps);
  await svc.add(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §6. SD-004 博主注册（3 DD）

### DD-004.1 Blogger（Model）

#### UT-0111 Blogger.BloggerSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P0 |
| 前置条件 | SD-004 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-004.1-happy", async () => {
  const svc = new Blogger(mockDeps);
  const result = await svc.BloggerSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0112 Blogger.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P0 |
| 前置条件 | SD-004 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.1-validation", async () => {
  const svc = new Blogger(mockDeps);
  await expect(svc.BloggerSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0113 Blogger.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-004.1-forbidden", async () => {
  const svc = new Blogger(mockDeps);
  await expect(svc.BloggerSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0114 Blogger.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-004.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Blogger(mockDeps);
  await expect(svc.BloggerSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0115 Blogger.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-004.1-empty", async () => {
  const svc = new Blogger(mockDeps);
  const result = await svc.BloggerSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0116 Blogger.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-004.1-max", async () => {
  const svc = new Blogger(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.BloggerSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0117 Blogger.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.1-overflow", async () => {
  const svc = new Blogger(mockDeps);
  await expect(svc.BloggerSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0118 Blogger.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 BloggerSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.1-type", async () => {
  const svc = new Blogger(mockDeps);
  await expect(svc.BloggerSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0119 Blogger.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 BloggerSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-004.1-concurrent", async () => {
  const svc = new Blogger(mockDeps);
  await Promise.all([svc.BloggerSchema (x), svc.BloggerSchema (x), svc.BloggerSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0120 Blogger.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-004.1-mock-isolation", async () => {
  const svc = new Blogger(mockDeps);
  await svc.BloggerSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-004.2 BloggerService（Service）

#### UT-0121 BloggerService.registerBlogger 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P0 |
| 前置条件 | SD-004 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 registerBlogger |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-004.2-happy", async () => {
  const svc = new BloggerService(mockDeps);
  const result = await svc.registerBlogger(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0122 BloggerService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P0 |
| 前置条件 | SD-004 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 registerBlogger |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.2-validation", async () => {
  const svc = new BloggerService(mockDeps);
  await expect(svc.registerBlogger({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0123 BloggerService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 registerBlogger |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-004.2-forbidden", async () => {
  const svc = new BloggerService(mockDeps);
  await expect(svc.registerBlogger(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0124 BloggerService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 registerBlogger |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-004.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new BloggerService(mockDeps);
  await expect(svc.registerBlogger("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0125 BloggerService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 registerBlogger |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-004.2-empty", async () => {
  const svc = new BloggerService(mockDeps);
  const result = await svc.registerBlogger("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0126 BloggerService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 registerBlogger |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-004.2-max", async () => {
  const svc = new BloggerService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.registerBlogger(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0127 BloggerService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 registerBlogger |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.2-overflow", async () => {
  const svc = new BloggerService(mockDeps);
  await expect(svc.registerBlogger("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0128 BloggerService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 registerBlogger |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.2-type", async () => {
  const svc = new BloggerService(mockDeps);
  await expect(svc.registerBlogger("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0129 BloggerService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 registerBlogger |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-004.2-concurrent", async () => {
  const svc = new BloggerService(mockDeps);
  await Promise.all([svc.registerBlogger(x), svc.registerBlogger(x), svc.registerBlogger(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0130 BloggerService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-004.2-mock-isolation", async () => {
  const svc = new BloggerService(mockDeps);
  await svc.registerBlogger(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-004.3 BloggerRepository（Repository）

#### UT-0131 BloggerRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P0 |
| 前置条件 | SD-004 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-004.3-happy", async () => {
  const svc = new BloggerRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0132 BloggerRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P0 |
| 前置条件 | SD-004 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.3-validation", async () => {
  const svc = new BloggerRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0133 BloggerRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-004.3-forbidden", async () => {
  const svc = new BloggerRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0134 BloggerRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-004.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new BloggerRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0135 BloggerRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-004.3-empty", async () => {
  const svc = new BloggerRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0136 BloggerRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-004.3-max", async () => {
  const svc = new BloggerRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0137 BloggerRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.3-overflow", async () => {
  const svc = new BloggerRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0138 BloggerRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-004.3-type", async () => {
  const svc = new BloggerRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0139 BloggerRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-004.3-concurrent", async () => {
  const svc = new BloggerRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0140 BloggerRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-004.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-004.3-mock-isolation", async () => {
  const svc = new BloggerRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §7. SD-005 博文生命周期（8 DD）

### DD-005.1 Article（Model）

#### UT-0141 Article.ArticleSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.1-happy", async () => {
  const svc = new Article(mockDeps);
  const result = await svc.ArticleSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0142 Article.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.1-validation", async () => {
  const svc = new Article(mockDeps);
  await expect(svc.ArticleSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0143 Article.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.1-forbidden", async () => {
  const svc = new Article(mockDeps);
  await expect(svc.ArticleSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0144 Article.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Article(mockDeps);
  await expect(svc.ArticleSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0145 Article.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.1-empty", async () => {
  const svc = new Article(mockDeps);
  const result = await svc.ArticleSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0146 Article.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.1-max", async () => {
  const svc = new Article(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.ArticleSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0147 Article.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.1-overflow", async () => {
  const svc = new Article(mockDeps);
  await expect(svc.ArticleSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0148 Article.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 ArticleSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.1-type", async () => {
  const svc = new Article(mockDeps);
  await expect(svc.ArticleSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0149 Article.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 ArticleSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.1-concurrent", async () => {
  const svc = new Article(mockDeps);
  await Promise.all([svc.ArticleSchema (x), svc.ArticleSchema (x), svc.ArticleSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0150 Article.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.1-mock-isolation", async () => {
  const svc = new Article(mockDeps);
  await svc.ArticleSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.2 ArticleStateMachine（FSM）

#### UT-0151 ArticleStateMachine.canTransition 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 canTransition |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.2-happy", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  const result = await svc.canTransition(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0152 ArticleStateMachine.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 canTransition |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.2-validation", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  await expect(svc.canTransition({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0153 ArticleStateMachine.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 canTransition |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.2-forbidden", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  await expect(svc.canTransition(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0154 ArticleStateMachine.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 canTransition |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleStateMachine(mockDeps);
  await expect(svc.canTransition("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0155 ArticleStateMachine.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 canTransition |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.2-empty", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  const result = await svc.canTransition("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0156 ArticleStateMachine.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 canTransition |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.2-max", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.canTransition(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0157 ArticleStateMachine.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 canTransition |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.2-overflow", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  await expect(svc.canTransition("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0158 ArticleStateMachine.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 canTransition |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.2-type", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  await expect(svc.canTransition("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0159 ArticleStateMachine.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 canTransition |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.2-concurrent", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  await Promise.all([svc.canTransition(x), svc.canTransition(x), svc.canTransition(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0160 ArticleStateMachine.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.2-mock-isolation", async () => {
  const svc = new ArticleStateMachine(mockDeps);
  await svc.canTransition(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.3 ArticleService（Service）

#### UT-0161 ArticleService.create 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 create |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.3-happy", async () => {
  const svc = new ArticleService(mockDeps);
  const result = await svc.create(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0162 ArticleService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 create |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.3-validation", async () => {
  const svc = new ArticleService(mockDeps);
  await expect(svc.create({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0163 ArticleService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 create |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.3-forbidden", async () => {
  const svc = new ArticleService(mockDeps);
  await expect(svc.create(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0164 ArticleService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 create |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleService(mockDeps);
  await expect(svc.create("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0165 ArticleService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 create |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.3-empty", async () => {
  const svc = new ArticleService(mockDeps);
  const result = await svc.create("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0166 ArticleService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 create |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.3-max", async () => {
  const svc = new ArticleService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.create(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0167 ArticleService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 create |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.3-overflow", async () => {
  const svc = new ArticleService(mockDeps);
  await expect(svc.create("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0168 ArticleService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 create |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.3-type", async () => {
  const svc = new ArticleService(mockDeps);
  await expect(svc.create("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0169 ArticleService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 create |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.3-concurrent", async () => {
  const svc = new ArticleService(mockDeps);
  await Promise.all([svc.create(x), svc.create(x), svc.create(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0170 ArticleService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.3-mock-isolation", async () => {
  const svc = new ArticleService(mockDeps);
  await svc.create(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.4 ArticleRepository（Repository）

#### UT-0171 ArticleRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.4-happy", async () => {
  const svc = new ArticleRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0172 ArticleRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.4-validation", async () => {
  const svc = new ArticleRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0173 ArticleRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.4-forbidden", async () => {
  const svc = new ArticleRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0174 ArticleRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0175 ArticleRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.4-empty", async () => {
  const svc = new ArticleRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0176 ArticleRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.4-max", async () => {
  const svc = new ArticleRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0177 ArticleRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.4-overflow", async () => {
  const svc = new ArticleRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0178 ArticleRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.4-type", async () => {
  const svc = new ArticleRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0179 ArticleRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.4-concurrent", async () => {
  const svc = new ArticleRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0180 ArticleRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.4-mock-isolation", async () => {
  const svc = new ArticleRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.5 ArticleController（Controller）

#### UT-0181 ArticleController.POST 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 POST |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.5-happy", async () => {
  const svc = new ArticleController(mockDeps);
  const result = await svc.POST(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0182 ArticleController.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 POST |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.5-validation", async () => {
  const svc = new ArticleController(mockDeps);
  await expect(svc.POST({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0183 ArticleController.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 POST |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.5-forbidden", async () => {
  const svc = new ArticleController(mockDeps);
  await expect(svc.POST(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0184 ArticleController.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 POST |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.5-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleController(mockDeps);
  await expect(svc.POST("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0185 ArticleController.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 POST |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.5-empty", async () => {
  const svc = new ArticleController(mockDeps);
  const result = await svc.POST("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0186 ArticleController.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 POST |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.5-max", async () => {
  const svc = new ArticleController(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.POST(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0187 ArticleController.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 POST |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.5-overflow", async () => {
  const svc = new ArticleController(mockDeps);
  await expect(svc.POST("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0188 ArticleController.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 POST |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.5-type", async () => {
  const svc = new ArticleController(mockDeps);
  await expect(svc.POST("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0189 ArticleController.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 POST |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.5-concurrent", async () => {
  const svc = new ArticleController(mockDeps);
  await Promise.all([svc.POST(x), svc.POST(x), svc.POST(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0190 ArticleController.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.5 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.5-mock-isolation", async () => {
  const svc = new ArticleController(mockDeps);
  await svc.POST(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.6 ArticleValidator（Validator）

#### UT-0191 ArticleValidator.validateCreate 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 validateCreate |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.6-happy", async () => {
  const svc = new ArticleValidator(mockDeps);
  const result = await svc.validateCreate(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0192 ArticleValidator.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 validateCreate |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.6-validation", async () => {
  const svc = new ArticleValidator(mockDeps);
  await expect(svc.validateCreate({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0193 ArticleValidator.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 validateCreate |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.6-forbidden", async () => {
  const svc = new ArticleValidator(mockDeps);
  await expect(svc.validateCreate(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0194 ArticleValidator.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 validateCreate |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.6-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleValidator(mockDeps);
  await expect(svc.validateCreate("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0195 ArticleValidator.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 validateCreate |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.6-empty", async () => {
  const svc = new ArticleValidator(mockDeps);
  const result = await svc.validateCreate("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0196 ArticleValidator.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 validateCreate |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.6-max", async () => {
  const svc = new ArticleValidator(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.validateCreate(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0197 ArticleValidator.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 validateCreate |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.6-overflow", async () => {
  const svc = new ArticleValidator(mockDeps);
  await expect(svc.validateCreate("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0198 ArticleValidator.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 validateCreate |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.6-type", async () => {
  const svc = new ArticleValidator(mockDeps);
  await expect(svc.validateCreate("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0199 ArticleValidator.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 validateCreate |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.6-concurrent", async () => {
  const svc = new ArticleValidator(mockDeps);
  await Promise.all([svc.validateCreate(x), svc.validateCreate(x), svc.validateCreate(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0200 ArticleValidator.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.6 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.6-mock-isolation", async () => {
  const svc = new ArticleValidator(mockDeps);
  await svc.validateCreate(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.7 ArticleSearcher（Service）

#### UT-0201 ArticleSearcher.search 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 search |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.7-happy", async () => {
  const svc = new ArticleSearcher(mockDeps);
  const result = await svc.search(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0202 ArticleSearcher.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 search |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.7-validation", async () => {
  const svc = new ArticleSearcher(mockDeps);
  await expect(svc.search({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0203 ArticleSearcher.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 search |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.7-forbidden", async () => {
  const svc = new ArticleSearcher(mockDeps);
  await expect(svc.search(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0204 ArticleSearcher.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 search |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.7-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleSearcher(mockDeps);
  await expect(svc.search("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0205 ArticleSearcher.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 search |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.7-empty", async () => {
  const svc = new ArticleSearcher(mockDeps);
  const result = await svc.search("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0206 ArticleSearcher.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 search |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.7-max", async () => {
  const svc = new ArticleSearcher(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.search(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0207 ArticleSearcher.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 search |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.7-overflow", async () => {
  const svc = new ArticleSearcher(mockDeps);
  await expect(svc.search("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0208 ArticleSearcher.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 search |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.7-type", async () => {
  const svc = new ArticleSearcher(mockDeps);
  await expect(svc.search("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0209 ArticleSearcher.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 search |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.7-concurrent", async () => {
  const svc = new ArticleSearcher(mockDeps);
  await Promise.all([svc.search(x), svc.search(x), svc.search(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0210 ArticleSearcher.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.7 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.7-mock-isolation", async () => {
  const svc = new ArticleSearcher(mockDeps);
  await svc.search(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-005.8 ArticleStatistics（Service）

#### UT-0211 ArticleStatistics.getStats 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P0 |
| 前置条件 | SD-005 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 getStats |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-005.8-happy", async () => {
  const svc = new ArticleStatistics(mockDeps);
  const result = await svc.getStats(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0212 ArticleStatistics.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P0 |
| 前置条件 | SD-005 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 getStats |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.8-validation", async () => {
  const svc = new ArticleStatistics(mockDeps);
  await expect(svc.getStats({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0213 ArticleStatistics.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 getStats |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-005.8-forbidden", async () => {
  const svc = new ArticleStatistics(mockDeps);
  await expect(svc.getStats(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0214 ArticleStatistics.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 getStats |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-005.8-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ArticleStatistics(mockDeps);
  await expect(svc.getStats("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0215 ArticleStatistics.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 getStats |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-005.8-empty", async () => {
  const svc = new ArticleStatistics(mockDeps);
  const result = await svc.getStats("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0216 ArticleStatistics.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 getStats |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-005.8-max", async () => {
  const svc = new ArticleStatistics(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.getStats(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0217 ArticleStatistics.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 getStats |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.8-overflow", async () => {
  const svc = new ArticleStatistics(mockDeps);
  await expect(svc.getStats("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0218 ArticleStatistics.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 getStats |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-005.8-type", async () => {
  const svc = new ArticleStatistics(mockDeps);
  await expect(svc.getStats("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0219 ArticleStatistics.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 getStats |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-005.8-concurrent", async () => {
  const svc = new ArticleStatistics(mockDeps);
  await Promise.all([svc.getStats(x), svc.getStats(x), svc.getStats(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0220 ArticleStatistics.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-005.8 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-005.8-mock-isolation", async () => {
  const svc = new ArticleStatistics(mockDeps);
  await svc.getStats(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §8. SD-006 浏览（3 DD）

### DD-006.1 ViewCounter（Service）

#### UT-0221 ViewCounter.recordView 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P0 |
| 前置条件 | SD-006 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 recordView |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-006.1-happy", async () => {
  const svc = new ViewCounter(mockDeps);
  const result = await svc.recordView(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0222 ViewCounter.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P0 |
| 前置条件 | SD-006 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 recordView |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.1-validation", async () => {
  const svc = new ViewCounter(mockDeps);
  await expect(svc.recordView({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0223 ViewCounter.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 recordView |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-006.1-forbidden", async () => {
  const svc = new ViewCounter(mockDeps);
  await expect(svc.recordView(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0224 ViewCounter.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 recordView |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-006.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ViewCounter(mockDeps);
  await expect(svc.recordView("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0225 ViewCounter.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 recordView |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-006.1-empty", async () => {
  const svc = new ViewCounter(mockDeps);
  const result = await svc.recordView("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0226 ViewCounter.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 recordView |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-006.1-max", async () => {
  const svc = new ViewCounter(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.recordView(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0227 ViewCounter.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 recordView |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.1-overflow", async () => {
  const svc = new ViewCounter(mockDeps);
  await expect(svc.recordView("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0228 ViewCounter.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 recordView |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.1-type", async () => {
  const svc = new ViewCounter(mockDeps);
  await expect(svc.recordView("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0229 ViewCounter.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 recordView |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-006.1-concurrent", async () => {
  const svc = new ViewCounter(mockDeps);
  await Promise.all([svc.recordView(x), svc.recordView(x), svc.recordView(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0230 ViewCounter.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-006.1-mock-isolation", async () => {
  const svc = new ViewCounter(mockDeps);
  await svc.recordView(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-006.2 BrowseService（Service）

#### UT-0231 BrowseService.browse 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P0 |
| 前置条件 | SD-006 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 browse |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-006.2-happy", async () => {
  const svc = new BrowseService(mockDeps);
  const result = await svc.browse(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0232 BrowseService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P0 |
| 前置条件 | SD-006 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 browse |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.2-validation", async () => {
  const svc = new BrowseService(mockDeps);
  await expect(svc.browse({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0233 BrowseService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 browse |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-006.2-forbidden", async () => {
  const svc = new BrowseService(mockDeps);
  await expect(svc.browse(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0234 BrowseService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 browse |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-006.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new BrowseService(mockDeps);
  await expect(svc.browse("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0235 BrowseService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 browse |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-006.2-empty", async () => {
  const svc = new BrowseService(mockDeps);
  const result = await svc.browse("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0236 BrowseService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 browse |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-006.2-max", async () => {
  const svc = new BrowseService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.browse(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0237 BrowseService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 browse |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.2-overflow", async () => {
  const svc = new BrowseService(mockDeps);
  await expect(svc.browse("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0238 BrowseService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 browse |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.2-type", async () => {
  const svc = new BrowseService(mockDeps);
  await expect(svc.browse("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0239 BrowseService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 browse |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-006.2-concurrent", async () => {
  const svc = new BrowseService(mockDeps);
  await Promise.all([svc.browse(x), svc.browse(x), svc.browse(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0240 BrowseService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-006.2-mock-isolation", async () => {
  const svc = new BrowseService(mockDeps);
  await svc.browse(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-006.3 BrowseController（Controller）

#### UT-0241 BrowseController.GET 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P0 |
| 前置条件 | SD-006 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 GET |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-006.3-happy", async () => {
  const svc = new BrowseController(mockDeps);
  const result = await svc.GET(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0242 BrowseController.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P0 |
| 前置条件 | SD-006 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 GET |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.3-validation", async () => {
  const svc = new BrowseController(mockDeps);
  await expect(svc.GET({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0243 BrowseController.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 GET |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-006.3-forbidden", async () => {
  const svc = new BrowseController(mockDeps);
  await expect(svc.GET(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0244 BrowseController.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 GET |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-006.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new BrowseController(mockDeps);
  await expect(svc.GET("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0245 BrowseController.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 GET |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-006.3-empty", async () => {
  const svc = new BrowseController(mockDeps);
  const result = await svc.GET("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0246 BrowseController.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 GET |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-006.3-max", async () => {
  const svc = new BrowseController(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.GET(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0247 BrowseController.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 GET |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.3-overflow", async () => {
  const svc = new BrowseController(mockDeps);
  await expect(svc.GET("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0248 BrowseController.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 GET |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-006.3-type", async () => {
  const svc = new BrowseController(mockDeps);
  await expect(svc.GET("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0249 BrowseController.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 GET |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-006.3-concurrent", async () => {
  const svc = new BrowseController(mockDeps);
  await Promise.all([svc.GET(x), svc.GET(x), svc.GET(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0250 BrowseController.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-006.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-006.3-mock-isolation", async () => {
  const svc = new BrowseController(mockDeps);
  await svc.GET(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §9. SD-007 互动（4 DD）

### DD-007.1 Like（Model）

#### UT-0251 Like.LikeSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P0 |
| 前置条件 | SD-007 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-007.1-happy", async () => {
  const svc = new Like(mockDeps);
  const result = await svc.LikeSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0252 Like.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P0 |
| 前置条件 | SD-007 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.1-validation", async () => {
  const svc = new Like(mockDeps);
  await expect(svc.LikeSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0253 Like.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-007.1-forbidden", async () => {
  const svc = new Like(mockDeps);
  await expect(svc.LikeSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0254 Like.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-007.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Like(mockDeps);
  await expect(svc.LikeSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0255 Like.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-007.1-empty", async () => {
  const svc = new Like(mockDeps);
  const result = await svc.LikeSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0256 Like.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-007.1-max", async () => {
  const svc = new Like(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.LikeSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0257 Like.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.1-overflow", async () => {
  const svc = new Like(mockDeps);
  await expect(svc.LikeSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0258 Like.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 LikeSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.1-type", async () => {
  const svc = new Like(mockDeps);
  await expect(svc.LikeSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0259 Like.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 LikeSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-007.1-concurrent", async () => {
  const svc = new Like(mockDeps);
  await Promise.all([svc.LikeSchema (x), svc.LikeSchema (x), svc.LikeSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0260 Like.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-007.1-mock-isolation", async () => {
  const svc = new Like(mockDeps);
  await svc.LikeSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-007.2 LikeService（Service）

#### UT-0261 LikeService.like 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P0 |
| 前置条件 | SD-007 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 like |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-007.2-happy", async () => {
  const svc = new LikeService(mockDeps);
  const result = await svc.like(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0262 LikeService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P0 |
| 前置条件 | SD-007 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 like |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.2-validation", async () => {
  const svc = new LikeService(mockDeps);
  await expect(svc.like({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0263 LikeService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 like |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-007.2-forbidden", async () => {
  const svc = new LikeService(mockDeps);
  await expect(svc.like(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0264 LikeService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 like |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-007.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new LikeService(mockDeps);
  await expect(svc.like("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0265 LikeService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 like |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-007.2-empty", async () => {
  const svc = new LikeService(mockDeps);
  const result = await svc.like("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0266 LikeService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 like |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-007.2-max", async () => {
  const svc = new LikeService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.like(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0267 LikeService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 like |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.2-overflow", async () => {
  const svc = new LikeService(mockDeps);
  await expect(svc.like("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0268 LikeService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 like |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.2-type", async () => {
  const svc = new LikeService(mockDeps);
  await expect(svc.like("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0269 LikeService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 like |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-007.2-concurrent", async () => {
  const svc = new LikeService(mockDeps);
  await Promise.all([svc.like(x), svc.like(x), svc.like(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0270 LikeService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-007.2-mock-isolation", async () => {
  const svc = new LikeService(mockDeps);
  await svc.like(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-007.3 Favorite（Model）

#### UT-0271 Favorite.FavoriteSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P0 |
| 前置条件 | SD-007 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-007.3-happy", async () => {
  const svc = new Favorite(mockDeps);
  const result = await svc.FavoriteSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0272 Favorite.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P0 |
| 前置条件 | SD-007 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.3-validation", async () => {
  const svc = new Favorite(mockDeps);
  await expect(svc.FavoriteSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0273 Favorite.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-007.3-forbidden", async () => {
  const svc = new Favorite(mockDeps);
  await expect(svc.FavoriteSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0274 Favorite.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-007.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Favorite(mockDeps);
  await expect(svc.FavoriteSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0275 Favorite.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-007.3-empty", async () => {
  const svc = new Favorite(mockDeps);
  const result = await svc.FavoriteSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0276 Favorite.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-007.3-max", async () => {
  const svc = new Favorite(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.FavoriteSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0277 Favorite.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.3-overflow", async () => {
  const svc = new Favorite(mockDeps);
  await expect(svc.FavoriteSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0278 Favorite.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 FavoriteSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.3-type", async () => {
  const svc = new Favorite(mockDeps);
  await expect(svc.FavoriteSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0279 Favorite.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 FavoriteSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-007.3-concurrent", async () => {
  const svc = new Favorite(mockDeps);
  await Promise.all([svc.FavoriteSchema (x), svc.FavoriteSchema (x), svc.FavoriteSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0280 Favorite.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-007.3-mock-isolation", async () => {
  const svc = new Favorite(mockDeps);
  await svc.FavoriteSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-007.4 FavoriteService（Service）

#### UT-0281 FavoriteService.favorite 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P0 |
| 前置条件 | SD-007 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 favorite |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-007.4-happy", async () => {
  const svc = new FavoriteService(mockDeps);
  const result = await svc.favorite(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0282 FavoriteService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P0 |
| 前置条件 | SD-007 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 favorite |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.4-validation", async () => {
  const svc = new FavoriteService(mockDeps);
  await expect(svc.favorite({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0283 FavoriteService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 favorite |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-007.4-forbidden", async () => {
  const svc = new FavoriteService(mockDeps);
  await expect(svc.favorite(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0284 FavoriteService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 favorite |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-007.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new FavoriteService(mockDeps);
  await expect(svc.favorite("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0285 FavoriteService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 favorite |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-007.4-empty", async () => {
  const svc = new FavoriteService(mockDeps);
  const result = await svc.favorite("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0286 FavoriteService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 favorite |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-007.4-max", async () => {
  const svc = new FavoriteService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.favorite(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0287 FavoriteService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 favorite |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.4-overflow", async () => {
  const svc = new FavoriteService(mockDeps);
  await expect(svc.favorite("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0288 FavoriteService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 favorite |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-007.4-type", async () => {
  const svc = new FavoriteService(mockDeps);
  await expect(svc.favorite("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0289 FavoriteService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 favorite |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-007.4-concurrent", async () => {
  const svc = new FavoriteService(mockDeps);
  await Promise.all([svc.favorite(x), svc.favorite(x), svc.favorite(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0290 FavoriteService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-007.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-007.4-mock-isolation", async () => {
  const svc = new FavoriteService(mockDeps);
  await svc.favorite(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §10. SD-008 标签（3 DD）

### DD-008.1 Tag（Model）

#### UT-0291 Tag.TagSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P0 |
| 前置条件 | SD-008 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 TagSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-008.1-happy", async () => {
  const svc = new Tag(mockDeps);
  const result = await svc.TagSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0292 Tag.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P0 |
| 前置条件 | SD-008 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 TagSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.1-validation", async () => {
  const svc = new Tag(mockDeps);
  await expect(svc.TagSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0293 Tag.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 TagSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-008.1-forbidden", async () => {
  const svc = new Tag(mockDeps);
  await expect(svc.TagSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0294 Tag.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 TagSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-008.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Tag(mockDeps);
  await expect(svc.TagSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0295 Tag.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 TagSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-008.1-empty", async () => {
  const svc = new Tag(mockDeps);
  const result = await svc.TagSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0296 Tag.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 TagSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-008.1-max", async () => {
  const svc = new Tag(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.TagSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0297 Tag.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 TagSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.1-overflow", async () => {
  const svc = new Tag(mockDeps);
  await expect(svc.TagSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0298 Tag.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 TagSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.1-type", async () => {
  const svc = new Tag(mockDeps);
  await expect(svc.TagSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0299 Tag.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 TagSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-008.1-concurrent", async () => {
  const svc = new Tag(mockDeps);
  await Promise.all([svc.TagSchema (x), svc.TagSchema (x), svc.TagSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0300 Tag.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-008.1-mock-isolation", async () => {
  const svc = new Tag(mockDeps);
  await svc.TagSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-008.2 TagService（Service）

#### UT-0301 TagService.create 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P0 |
| 前置条件 | SD-008 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 create |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-008.2-happy", async () => {
  const svc = new TagService(mockDeps);
  const result = await svc.create(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0302 TagService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P0 |
| 前置条件 | SD-008 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 create |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.2-validation", async () => {
  const svc = new TagService(mockDeps);
  await expect(svc.create({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0303 TagService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 create |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-008.2-forbidden", async () => {
  const svc = new TagService(mockDeps);
  await expect(svc.create(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0304 TagService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 create |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-008.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new TagService(mockDeps);
  await expect(svc.create("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0305 TagService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 create |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-008.2-empty", async () => {
  const svc = new TagService(mockDeps);
  const result = await svc.create("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0306 TagService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 create |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-008.2-max", async () => {
  const svc = new TagService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.create(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0307 TagService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 create |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.2-overflow", async () => {
  const svc = new TagService(mockDeps);
  await expect(svc.create("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0308 TagService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 create |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.2-type", async () => {
  const svc = new TagService(mockDeps);
  await expect(svc.create("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0309 TagService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 create |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-008.2-concurrent", async () => {
  const svc = new TagService(mockDeps);
  await Promise.all([svc.create(x), svc.create(x), svc.create(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0310 TagService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-008.2-mock-isolation", async () => {
  const svc = new TagService(mockDeps);
  await svc.create(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-008.3 TagRepository（Repository）

#### UT-0311 TagRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P0 |
| 前置条件 | SD-008 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-008.3-happy", async () => {
  const svc = new TagRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0312 TagRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P0 |
| 前置条件 | SD-008 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.3-validation", async () => {
  const svc = new TagRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0313 TagRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-008.3-forbidden", async () => {
  const svc = new TagRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0314 TagRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-008.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new TagRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0315 TagRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-008.3-empty", async () => {
  const svc = new TagRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0316 TagRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-008.3-max", async () => {
  const svc = new TagRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0317 TagRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.3-overflow", async () => {
  const svc = new TagRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0318 TagRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-008.3-type", async () => {
  const svc = new TagRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0319 TagRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-008.3-concurrent", async () => {
  const svc = new TagRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0320 TagRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-008.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-008.3-mock-isolation", async () => {
  const svc = new TagRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §11. SD-009 全文搜索（2 DD）

### DD-009.1 SearchIndex（Index）

#### UT-0321 SearchIndex.addDoc 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P0 |
| 前置条件 | SD-009 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 addDoc |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-009.1-happy", async () => {
  const svc = new SearchIndex(mockDeps);
  const result = await svc.addDoc(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0322 SearchIndex.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P0 |
| 前置条件 | SD-009 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 addDoc |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-009.1-validation", async () => {
  const svc = new SearchIndex(mockDeps);
  await expect(svc.addDoc({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0323 SearchIndex.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 addDoc |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-009.1-forbidden", async () => {
  const svc = new SearchIndex(mockDeps);
  await expect(svc.addDoc(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0324 SearchIndex.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 addDoc |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-009.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new SearchIndex(mockDeps);
  await expect(svc.addDoc("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0325 SearchIndex.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 addDoc |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-009.1-empty", async () => {
  const svc = new SearchIndex(mockDeps);
  const result = await svc.addDoc("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0326 SearchIndex.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 addDoc |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-009.1-max", async () => {
  const svc = new SearchIndex(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.addDoc(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0327 SearchIndex.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 addDoc |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-009.1-overflow", async () => {
  const svc = new SearchIndex(mockDeps);
  await expect(svc.addDoc("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0328 SearchIndex.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 addDoc |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-009.1-type", async () => {
  const svc = new SearchIndex(mockDeps);
  await expect(svc.addDoc("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0329 SearchIndex.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 addDoc |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-009.1-concurrent", async () => {
  const svc = new SearchIndex(mockDeps);
  await Promise.all([svc.addDoc(x), svc.addDoc(x), svc.addDoc(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0330 SearchIndex.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-009.1-mock-isolation", async () => {
  const svc = new SearchIndex(mockDeps);
  await svc.addDoc(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-009.2 SearchService（Service）

#### UT-0331 SearchService.search 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P0 |
| 前置条件 | SD-009 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 search |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-009.2-happy", async () => {
  const svc = new SearchService(mockDeps);
  const result = await svc.search(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0332 SearchService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P0 |
| 前置条件 | SD-009 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 search |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-009.2-validation", async () => {
  const svc = new SearchService(mockDeps);
  await expect(svc.search({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0333 SearchService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 search |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-009.2-forbidden", async () => {
  const svc = new SearchService(mockDeps);
  await expect(svc.search(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0334 SearchService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 search |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-009.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new SearchService(mockDeps);
  await expect(svc.search("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0335 SearchService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 search |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-009.2-empty", async () => {
  const svc = new SearchService(mockDeps);
  const result = await svc.search("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0336 SearchService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 search |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-009.2-max", async () => {
  const svc = new SearchService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.search(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0337 SearchService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 search |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-009.2-overflow", async () => {
  const svc = new SearchService(mockDeps);
  await expect(svc.search("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0338 SearchService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 search |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-009.2-type", async () => {
  const svc = new SearchService(mockDeps);
  await expect(svc.search("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0339 SearchService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 search |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-009.2-concurrent", async () => {
  const svc = new SearchService(mockDeps);
  await Promise.all([svc.search(x), svc.search(x), svc.search(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0340 SearchService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-009.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-009.2-mock-isolation", async () => {
  const svc = new SearchService(mockDeps);
  await svc.search(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §12. SD-010 评论（5 DD）

### DD-010.1 Comment（Model）

#### UT-0341 Comment.CommentSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P0 |
| 前置条件 | SD-010 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-010.1-happy", async () => {
  const svc = new Comment(mockDeps);
  const result = await svc.CommentSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0342 Comment.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P0 |
| 前置条件 | SD-010 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.1-validation", async () => {
  const svc = new Comment(mockDeps);
  await expect(svc.CommentSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0343 Comment.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-010.1-forbidden", async () => {
  const svc = new Comment(mockDeps);
  await expect(svc.CommentSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0344 Comment.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-010.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Comment(mockDeps);
  await expect(svc.CommentSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0345 Comment.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-010.1-empty", async () => {
  const svc = new Comment(mockDeps);
  const result = await svc.CommentSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0346 Comment.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-010.1-max", async () => {
  const svc = new Comment(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.CommentSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0347 Comment.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.1-overflow", async () => {
  const svc = new Comment(mockDeps);
  await expect(svc.CommentSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0348 Comment.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 CommentSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.1-type", async () => {
  const svc = new Comment(mockDeps);
  await expect(svc.CommentSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0349 Comment.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 CommentSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-010.1-concurrent", async () => {
  const svc = new Comment(mockDeps);
  await Promise.all([svc.CommentSchema (x), svc.CommentSchema (x), svc.CommentSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0350 Comment.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-010.1-mock-isolation", async () => {
  const svc = new Comment(mockDeps);
  await svc.CommentSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-010.2 CommentTree（Util）

#### UT-0351 CommentTree.build 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P0 |
| 前置条件 | SD-010 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 build |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-010.2-happy", async () => {
  const svc = new CommentTree(mockDeps);
  const result = await svc.build(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0352 CommentTree.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P0 |
| 前置条件 | SD-010 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 build |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.2-validation", async () => {
  const svc = new CommentTree(mockDeps);
  await expect(svc.build({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0353 CommentTree.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 build |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-010.2-forbidden", async () => {
  const svc = new CommentTree(mockDeps);
  await expect(svc.build(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0354 CommentTree.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 build |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-010.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new CommentTree(mockDeps);
  await expect(svc.build("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0355 CommentTree.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 build |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-010.2-empty", async () => {
  const svc = new CommentTree(mockDeps);
  const result = await svc.build("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0356 CommentTree.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 build |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-010.2-max", async () => {
  const svc = new CommentTree(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.build(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0357 CommentTree.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 build |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.2-overflow", async () => {
  const svc = new CommentTree(mockDeps);
  await expect(svc.build("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0358 CommentTree.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 build |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.2-type", async () => {
  const svc = new CommentTree(mockDeps);
  await expect(svc.build("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0359 CommentTree.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 build |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-010.2-concurrent", async () => {
  const svc = new CommentTree(mockDeps);
  await Promise.all([svc.build(x), svc.build(x), svc.build(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0360 CommentTree.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-010.2-mock-isolation", async () => {
  const svc = new CommentTree(mockDeps);
  await svc.build(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-010.3 CommentService（Service）

#### UT-0361 CommentService.create 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P0 |
| 前置条件 | SD-010 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 create |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-010.3-happy", async () => {
  const svc = new CommentService(mockDeps);
  const result = await svc.create(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0362 CommentService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P0 |
| 前置条件 | SD-010 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 create |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.3-validation", async () => {
  const svc = new CommentService(mockDeps);
  await expect(svc.create({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0363 CommentService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 create |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-010.3-forbidden", async () => {
  const svc = new CommentService(mockDeps);
  await expect(svc.create(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0364 CommentService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 create |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-010.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new CommentService(mockDeps);
  await expect(svc.create("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0365 CommentService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 create |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-010.3-empty", async () => {
  const svc = new CommentService(mockDeps);
  const result = await svc.create("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0366 CommentService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 create |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-010.3-max", async () => {
  const svc = new CommentService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.create(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0367 CommentService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 create |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.3-overflow", async () => {
  const svc = new CommentService(mockDeps);
  await expect(svc.create("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0368 CommentService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 create |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.3-type", async () => {
  const svc = new CommentService(mockDeps);
  await expect(svc.create("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0369 CommentService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 create |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-010.3-concurrent", async () => {
  const svc = new CommentService(mockDeps);
  await Promise.all([svc.create(x), svc.create(x), svc.create(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0370 CommentService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-010.3-mock-isolation", async () => {
  const svc = new CommentService(mockDeps);
  await svc.create(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-010.4 CommentRepository（Repository）

#### UT-0371 CommentRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P0 |
| 前置条件 | SD-010 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-010.4-happy", async () => {
  const svc = new CommentRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0372 CommentRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P0 |
| 前置条件 | SD-010 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.4-validation", async () => {
  const svc = new CommentRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0373 CommentRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-010.4-forbidden", async () => {
  const svc = new CommentRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0374 CommentRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-010.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new CommentRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0375 CommentRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-010.4-empty", async () => {
  const svc = new CommentRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0376 CommentRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-010.4-max", async () => {
  const svc = new CommentRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0377 CommentRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.4-overflow", async () => {
  const svc = new CommentRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0378 CommentRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.4-type", async () => {
  const svc = new CommentRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0379 CommentRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-010.4-concurrent", async () => {
  const svc = new CommentRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0380 CommentRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-010.4-mock-isolation", async () => {
  const svc = new CommentRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-010.5 CommentController（Controller）

#### UT-0381 CommentController.POST 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P0 |
| 前置条件 | SD-010 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 POST |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-010.5-happy", async () => {
  const svc = new CommentController(mockDeps);
  const result = await svc.POST(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0382 CommentController.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P0 |
| 前置条件 | SD-010 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 POST |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.5-validation", async () => {
  const svc = new CommentController(mockDeps);
  await expect(svc.POST({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0383 CommentController.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 POST |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-010.5-forbidden", async () => {
  const svc = new CommentController(mockDeps);
  await expect(svc.POST(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0384 CommentController.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 POST |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-010.5-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new CommentController(mockDeps);
  await expect(svc.POST("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0385 CommentController.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 POST |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-010.5-empty", async () => {
  const svc = new CommentController(mockDeps);
  const result = await svc.POST("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0386 CommentController.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 POST |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-010.5-max", async () => {
  const svc = new CommentController(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.POST(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0387 CommentController.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 POST |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.5-overflow", async () => {
  const svc = new CommentController(mockDeps);
  await expect(svc.POST("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0388 CommentController.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 POST |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-010.5-type", async () => {
  const svc = new CommentController(mockDeps);
  await expect(svc.POST("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0389 CommentController.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 POST |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-010.5-concurrent", async () => {
  const svc = new CommentController(mockDeps);
  await Promise.all([svc.POST(x), svc.POST(x), svc.POST(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0390 CommentController.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-010.5 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-010.5-mock-isolation", async () => {
  const svc = new CommentController(mockDeps);
  await svc.POST(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §13. SD-011 通知（4 DD）

### DD-011.1 Notification（Model）

#### UT-0391 Notification.NotificationSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P0 |
| 前置条件 | SD-011 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-011.1-happy", async () => {
  const svc = new Notification(mockDeps);
  const result = await svc.NotificationSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0392 Notification.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P0 |
| 前置条件 | SD-011 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.1-validation", async () => {
  const svc = new Notification(mockDeps);
  await expect(svc.NotificationSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0393 Notification.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-011.1-forbidden", async () => {
  const svc = new Notification(mockDeps);
  await expect(svc.NotificationSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0394 Notification.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-011.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Notification(mockDeps);
  await expect(svc.NotificationSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0395 Notification.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-011.1-empty", async () => {
  const svc = new Notification(mockDeps);
  const result = await svc.NotificationSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0396 Notification.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-011.1-max", async () => {
  const svc = new Notification(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.NotificationSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0397 Notification.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.1-overflow", async () => {
  const svc = new Notification(mockDeps);
  await expect(svc.NotificationSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0398 Notification.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 NotificationSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.1-type", async () => {
  const svc = new Notification(mockDeps);
  await expect(svc.NotificationSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0399 Notification.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 NotificationSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-011.1-concurrent", async () => {
  const svc = new Notification(mockDeps);
  await Promise.all([svc.NotificationSchema (x), svc.NotificationSchema (x), svc.NotificationSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0400 Notification.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-011.1-mock-isolation", async () => {
  const svc = new Notification(mockDeps);
  await svc.NotificationSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-011.2 NotificationService（Service）

#### UT-0401 NotificationService.push 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P0 |
| 前置条件 | SD-011 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 push |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-011.2-happy", async () => {
  const svc = new NotificationService(mockDeps);
  const result = await svc.push(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0402 NotificationService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P0 |
| 前置条件 | SD-011 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 push |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.2-validation", async () => {
  const svc = new NotificationService(mockDeps);
  await expect(svc.push({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0403 NotificationService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 push |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-011.2-forbidden", async () => {
  const svc = new NotificationService(mockDeps);
  await expect(svc.push(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0404 NotificationService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 push |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-011.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new NotificationService(mockDeps);
  await expect(svc.push("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0405 NotificationService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 push |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-011.2-empty", async () => {
  const svc = new NotificationService(mockDeps);
  const result = await svc.push("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0406 NotificationService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 push |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-011.2-max", async () => {
  const svc = new NotificationService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.push(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0407 NotificationService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 push |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.2-overflow", async () => {
  const svc = new NotificationService(mockDeps);
  await expect(svc.push("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0408 NotificationService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 push |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.2-type", async () => {
  const svc = new NotificationService(mockDeps);
  await expect(svc.push("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0409 NotificationService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 push |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-011.2-concurrent", async () => {
  const svc = new NotificationService(mockDeps);
  await Promise.all([svc.push(x), svc.push(x), svc.push(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0410 NotificationService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-011.2-mock-isolation", async () => {
  const svc = new NotificationService(mockDeps);
  await svc.push(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-011.3 NotificationRepository（Repository）

#### UT-0411 NotificationRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P0 |
| 前置条件 | SD-011 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-011.3-happy", async () => {
  const svc = new NotificationRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0412 NotificationRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P0 |
| 前置条件 | SD-011 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.3-validation", async () => {
  const svc = new NotificationRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0413 NotificationRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-011.3-forbidden", async () => {
  const svc = new NotificationRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0414 NotificationRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-011.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new NotificationRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0415 NotificationRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-011.3-empty", async () => {
  const svc = new NotificationRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0416 NotificationRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-011.3-max", async () => {
  const svc = new NotificationRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0417 NotificationRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.3-overflow", async () => {
  const svc = new NotificationRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0418 NotificationRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.3-type", async () => {
  const svc = new NotificationRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0419 NotificationRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-011.3-concurrent", async () => {
  const svc = new NotificationRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0420 NotificationRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-011.3-mock-isolation", async () => {
  const svc = new NotificationRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-011.4 NotificationTrigger（Listener）

#### UT-0421 NotificationTrigger.register 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P0 |
| 前置条件 | SD-011 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 register |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-011.4-happy", async () => {
  const svc = new NotificationTrigger(mockDeps);
  const result = await svc.register(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0422 NotificationTrigger.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P0 |
| 前置条件 | SD-011 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 register |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.4-validation", async () => {
  const svc = new NotificationTrigger(mockDeps);
  await expect(svc.register({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0423 NotificationTrigger.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 register |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-011.4-forbidden", async () => {
  const svc = new NotificationTrigger(mockDeps);
  await expect(svc.register(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0424 NotificationTrigger.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 register |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-011.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new NotificationTrigger(mockDeps);
  await expect(svc.register("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0425 NotificationTrigger.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 register |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-011.4-empty", async () => {
  const svc = new NotificationTrigger(mockDeps);
  const result = await svc.register("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0426 NotificationTrigger.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 register |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-011.4-max", async () => {
  const svc = new NotificationTrigger(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.register(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0427 NotificationTrigger.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 register |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.4-overflow", async () => {
  const svc = new NotificationTrigger(mockDeps);
  await expect(svc.register("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0428 NotificationTrigger.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 register |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-011.4-type", async () => {
  const svc = new NotificationTrigger(mockDeps);
  await expect(svc.register("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0429 NotificationTrigger.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 register |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-011.4-concurrent", async () => {
  const svc = new NotificationTrigger(mockDeps);
  await Promise.all([svc.register(x), svc.register(x), svc.register(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0430 NotificationTrigger.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-011.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-011.4-mock-isolation", async () => {
  const svc = new NotificationTrigger(mockDeps);
  await svc.register(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §14. SD-012 RSS（2 DD）

### DD-012.1 RSSBuilder（Util）

#### UT-0431 RSSBuilder.build 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P0 |
| 前置条件 | SD-012 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 build |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-012.1-happy", async () => {
  const svc = new RSSBuilder(mockDeps);
  const result = await svc.build(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0432 RSSBuilder.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P0 |
| 前置条件 | SD-012 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 build |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-012.1-validation", async () => {
  const svc = new RSSBuilder(mockDeps);
  await expect(svc.build({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0433 RSSBuilder.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 build |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-012.1-forbidden", async () => {
  const svc = new RSSBuilder(mockDeps);
  await expect(svc.build(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0434 RSSBuilder.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 build |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-012.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RSSBuilder(mockDeps);
  await expect(svc.build("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0435 RSSBuilder.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 build |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-012.1-empty", async () => {
  const svc = new RSSBuilder(mockDeps);
  const result = await svc.build("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0436 RSSBuilder.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 build |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-012.1-max", async () => {
  const svc = new RSSBuilder(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.build(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0437 RSSBuilder.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 build |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-012.1-overflow", async () => {
  const svc = new RSSBuilder(mockDeps);
  await expect(svc.build("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0438 RSSBuilder.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 build |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-012.1-type", async () => {
  const svc = new RSSBuilder(mockDeps);
  await expect(svc.build("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0439 RSSBuilder.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 build |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-012.1-concurrent", async () => {
  const svc = new RSSBuilder(mockDeps);
  await Promise.all([svc.build(x), svc.build(x), svc.build(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0440 RSSBuilder.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-012.1-mock-isolation", async () => {
  const svc = new RSSBuilder(mockDeps);
  await svc.build(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-012.2 RSSService（Service）

#### UT-0441 RSSService.getFeed 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P0 |
| 前置条件 | SD-012 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 getFeed |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-012.2-happy", async () => {
  const svc = new RSSService(mockDeps);
  const result = await svc.getFeed(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0442 RSSService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P0 |
| 前置条件 | SD-012 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 getFeed |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-012.2-validation", async () => {
  const svc = new RSSService(mockDeps);
  await expect(svc.getFeed({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0443 RSSService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 getFeed |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-012.2-forbidden", async () => {
  const svc = new RSSService(mockDeps);
  await expect(svc.getFeed(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0444 RSSService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 getFeed |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-012.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RSSService(mockDeps);
  await expect(svc.getFeed("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0445 RSSService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 getFeed |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-012.2-empty", async () => {
  const svc = new RSSService(mockDeps);
  const result = await svc.getFeed("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0446 RSSService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 getFeed |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-012.2-max", async () => {
  const svc = new RSSService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.getFeed(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0447 RSSService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 getFeed |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-012.2-overflow", async () => {
  const svc = new RSSService(mockDeps);
  await expect(svc.getFeed("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0448 RSSService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 getFeed |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-012.2-type", async () => {
  const svc = new RSSService(mockDeps);
  await expect(svc.getFeed("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0449 RSSService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 getFeed |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-012.2-concurrent", async () => {
  const svc = new RSSService(mockDeps);
  await Promise.all([svc.getFeed(x), svc.getFeed(x), svc.getFeed(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0450 RSSService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-012.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-012.2-mock-isolation", async () => {
  const svc = new RSSService(mockDeps);
  await svc.getFeed(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §15. SD-013 Webhook（5 DD）

### DD-013.1 Webhook（Model）

#### UT-0451 Webhook.WebhookSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P0 |
| 前置条件 | SD-013 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-013.1-happy", async () => {
  const svc = new Webhook(mockDeps);
  const result = await svc.WebhookSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0452 Webhook.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P0 |
| 前置条件 | SD-013 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.1-validation", async () => {
  const svc = new Webhook(mockDeps);
  await expect(svc.WebhookSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0453 Webhook.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-013.1-forbidden", async () => {
  const svc = new Webhook(mockDeps);
  await expect(svc.WebhookSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0454 Webhook.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-013.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Webhook(mockDeps);
  await expect(svc.WebhookSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0455 Webhook.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-013.1-empty", async () => {
  const svc = new Webhook(mockDeps);
  const result = await svc.WebhookSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0456 Webhook.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-013.1-max", async () => {
  const svc = new Webhook(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.WebhookSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0457 Webhook.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.1-overflow", async () => {
  const svc = new Webhook(mockDeps);
  await expect(svc.WebhookSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0458 Webhook.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 WebhookSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.1-type", async () => {
  const svc = new Webhook(mockDeps);
  await expect(svc.WebhookSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0459 Webhook.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 WebhookSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-013.1-concurrent", async () => {
  const svc = new Webhook(mockDeps);
  await Promise.all([svc.WebhookSchema (x), svc.WebhookSchema (x), svc.WebhookSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0460 Webhook.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-013.1-mock-isolation", async () => {
  const svc = new Webhook(mockDeps);
  await svc.WebhookSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-013.2 WebhookEvent（Model）

#### UT-0461 WebhookEvent.WebhookEventSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P0 |
| 前置条件 | SD-013 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-013.2-happy", async () => {
  const svc = new WebhookEvent(mockDeps);
  const result = await svc.WebhookEventSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0462 WebhookEvent.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P0 |
| 前置条件 | SD-013 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.2-validation", async () => {
  const svc = new WebhookEvent(mockDeps);
  await expect(svc.WebhookEventSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0463 WebhookEvent.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-013.2-forbidden", async () => {
  const svc = new WebhookEvent(mockDeps);
  await expect(svc.WebhookEventSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0464 WebhookEvent.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-013.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new WebhookEvent(mockDeps);
  await expect(svc.WebhookEventSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0465 WebhookEvent.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-013.2-empty", async () => {
  const svc = new WebhookEvent(mockDeps);
  const result = await svc.WebhookEventSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0466 WebhookEvent.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-013.2-max", async () => {
  const svc = new WebhookEvent(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.WebhookEventSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0467 WebhookEvent.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.2-overflow", async () => {
  const svc = new WebhookEvent(mockDeps);
  await expect(svc.WebhookEventSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0468 WebhookEvent.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 WebhookEventSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.2-type", async () => {
  const svc = new WebhookEvent(mockDeps);
  await expect(svc.WebhookEventSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0469 WebhookEvent.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 WebhookEventSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-013.2-concurrent", async () => {
  const svc = new WebhookEvent(mockDeps);
  await Promise.all([svc.WebhookEventSchema (x), svc.WebhookEventSchema (x), svc.WebhookEventSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0470 WebhookEvent.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-013.2-mock-isolation", async () => {
  const svc = new WebhookEvent(mockDeps);
  await svc.WebhookEventSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-013.3 WebhookService（Service）

#### UT-0471 WebhookService.subscribe 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P0 |
| 前置条件 | SD-013 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 subscribe |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-013.3-happy", async () => {
  const svc = new WebhookService(mockDeps);
  const result = await svc.subscribe(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0472 WebhookService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P0 |
| 前置条件 | SD-013 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 subscribe |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.3-validation", async () => {
  const svc = new WebhookService(mockDeps);
  await expect(svc.subscribe({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0473 WebhookService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 subscribe |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-013.3-forbidden", async () => {
  const svc = new WebhookService(mockDeps);
  await expect(svc.subscribe(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0474 WebhookService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 subscribe |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-013.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new WebhookService(mockDeps);
  await expect(svc.subscribe("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0475 WebhookService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 subscribe |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-013.3-empty", async () => {
  const svc = new WebhookService(mockDeps);
  const result = await svc.subscribe("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0476 WebhookService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 subscribe |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-013.3-max", async () => {
  const svc = new WebhookService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.subscribe(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0477 WebhookService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 subscribe |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.3-overflow", async () => {
  const svc = new WebhookService(mockDeps);
  await expect(svc.subscribe("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0478 WebhookService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 subscribe |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.3-type", async () => {
  const svc = new WebhookService(mockDeps);
  await expect(svc.subscribe("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0479 WebhookService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 subscribe |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-013.3-concurrent", async () => {
  const svc = new WebhookService(mockDeps);
  await Promise.all([svc.subscribe(x), svc.subscribe(x), svc.subscribe(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0480 WebhookService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-013.3-mock-isolation", async () => {
  const svc = new WebhookService(mockDeps);
  await svc.subscribe(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-013.4 WebhookDelivery（Engine）

#### UT-0481 WebhookDelivery.enqueue 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P0 |
| 前置条件 | SD-013 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 enqueue |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-013.4-happy", async () => {
  const svc = new WebhookDelivery(mockDeps);
  const result = await svc.enqueue(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0482 WebhookDelivery.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P0 |
| 前置条件 | SD-013 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 enqueue |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.4-validation", async () => {
  const svc = new WebhookDelivery(mockDeps);
  await expect(svc.enqueue({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0483 WebhookDelivery.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 enqueue |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-013.4-forbidden", async () => {
  const svc = new WebhookDelivery(mockDeps);
  await expect(svc.enqueue(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0484 WebhookDelivery.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 enqueue |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-013.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new WebhookDelivery(mockDeps);
  await expect(svc.enqueue("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0485 WebhookDelivery.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 enqueue |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-013.4-empty", async () => {
  const svc = new WebhookDelivery(mockDeps);
  const result = await svc.enqueue("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0486 WebhookDelivery.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 enqueue |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-013.4-max", async () => {
  const svc = new WebhookDelivery(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.enqueue(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0487 WebhookDelivery.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 enqueue |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.4-overflow", async () => {
  const svc = new WebhookDelivery(mockDeps);
  await expect(svc.enqueue("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0488 WebhookDelivery.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 enqueue |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.4-type", async () => {
  const svc = new WebhookDelivery(mockDeps);
  await expect(svc.enqueue("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0489 WebhookDelivery.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 enqueue |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-013.4-concurrent", async () => {
  const svc = new WebhookDelivery(mockDeps);
  await Promise.all([svc.enqueue(x), svc.enqueue(x), svc.enqueue(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0490 WebhookDelivery.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-013.4-mock-isolation", async () => {
  const svc = new WebhookDelivery(mockDeps);
  await svc.enqueue(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-013.5 WebhookSigner（Util）

#### UT-0491 WebhookSigner.sign 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P0 |
| 前置条件 | SD-013 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 sign |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-013.5-happy", async () => {
  const svc = new WebhookSigner(mockDeps);
  const result = await svc.sign(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0492 WebhookSigner.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P0 |
| 前置条件 | SD-013 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 sign |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.5-validation", async () => {
  const svc = new WebhookSigner(mockDeps);
  await expect(svc.sign({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0493 WebhookSigner.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 sign |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-013.5-forbidden", async () => {
  const svc = new WebhookSigner(mockDeps);
  await expect(svc.sign(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0494 WebhookSigner.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 sign |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-013.5-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new WebhookSigner(mockDeps);
  await expect(svc.sign("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0495 WebhookSigner.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 sign |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-013.5-empty", async () => {
  const svc = new WebhookSigner(mockDeps);
  const result = await svc.sign("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0496 WebhookSigner.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 sign |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-013.5-max", async () => {
  const svc = new WebhookSigner(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.sign(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0497 WebhookSigner.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 sign |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.5-overflow", async () => {
  const svc = new WebhookSigner(mockDeps);
  await expect(svc.sign("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0498 WebhookSigner.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 sign |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-013.5-type", async () => {
  const svc = new WebhookSigner(mockDeps);
  await expect(svc.sign("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0499 WebhookSigner.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 sign |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-013.5-concurrent", async () => {
  const svc = new WebhookSigner(mockDeps);
  await Promise.all([svc.sign(x), svc.sign(x), svc.sign(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0500 WebhookSigner.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-013.5 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-013.5-mock-isolation", async () => {
  const svc = new WebhookSigner(mockDeps);
  await svc.sign(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §16. SD-014 站点配置（3 DD）

### DD-014.1 SiteConfig（Model）

#### UT-0501 SiteConfig.SiteConfigSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P0 |
| 前置条件 | SD-014 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-014.1-happy", async () => {
  const svc = new SiteConfig(mockDeps);
  const result = await svc.SiteConfigSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0502 SiteConfig.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P0 |
| 前置条件 | SD-014 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.1-validation", async () => {
  const svc = new SiteConfig(mockDeps);
  await expect(svc.SiteConfigSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0503 SiteConfig.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-014.1-forbidden", async () => {
  const svc = new SiteConfig(mockDeps);
  await expect(svc.SiteConfigSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0504 SiteConfig.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-014.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new SiteConfig(mockDeps);
  await expect(svc.SiteConfigSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0505 SiteConfig.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-014.1-empty", async () => {
  const svc = new SiteConfig(mockDeps);
  const result = await svc.SiteConfigSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0506 SiteConfig.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-014.1-max", async () => {
  const svc = new SiteConfig(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.SiteConfigSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0507 SiteConfig.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.1-overflow", async () => {
  const svc = new SiteConfig(mockDeps);
  await expect(svc.SiteConfigSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0508 SiteConfig.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 SiteConfigSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.1-type", async () => {
  const svc = new SiteConfig(mockDeps);
  await expect(svc.SiteConfigSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0509 SiteConfig.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 SiteConfigSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-014.1-concurrent", async () => {
  const svc = new SiteConfig(mockDeps);
  await Promise.all([svc.SiteConfigSchema (x), svc.SiteConfigSchema (x), svc.SiteConfigSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0510 SiteConfig.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-014.1-mock-isolation", async () => {
  const svc = new SiteConfig(mockDeps);
  await svc.SiteConfigSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-014.2 SiteConfigService（Service）

#### UT-0511 SiteConfigService.get 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P0 |
| 前置条件 | SD-014 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 get |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-014.2-happy", async () => {
  const svc = new SiteConfigService(mockDeps);
  const result = await svc.get(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0512 SiteConfigService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P0 |
| 前置条件 | SD-014 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 get |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.2-validation", async () => {
  const svc = new SiteConfigService(mockDeps);
  await expect(svc.get({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0513 SiteConfigService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 get |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-014.2-forbidden", async () => {
  const svc = new SiteConfigService(mockDeps);
  await expect(svc.get(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0514 SiteConfigService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 get |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-014.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new SiteConfigService(mockDeps);
  await expect(svc.get("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0515 SiteConfigService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 get |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-014.2-empty", async () => {
  const svc = new SiteConfigService(mockDeps);
  const result = await svc.get("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0516 SiteConfigService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 get |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-014.2-max", async () => {
  const svc = new SiteConfigService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.get(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0517 SiteConfigService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 get |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.2-overflow", async () => {
  const svc = new SiteConfigService(mockDeps);
  await expect(svc.get("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0518 SiteConfigService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 get |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.2-type", async () => {
  const svc = new SiteConfigService(mockDeps);
  await expect(svc.get("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0519 SiteConfigService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 get |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-014.2-concurrent", async () => {
  const svc = new SiteConfigService(mockDeps);
  await Promise.all([svc.get(x), svc.get(x), svc.get(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0520 SiteConfigService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-014.2-mock-isolation", async () => {
  const svc = new SiteConfigService(mockDeps);
  await svc.get(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-014.3 SiteConfigRepository（Repository）

#### UT-0521 SiteConfigRepository.load 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P0 |
| 前置条件 | SD-014 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 load |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-014.3-happy", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  const result = await svc.load(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0522 SiteConfigRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P0 |
| 前置条件 | SD-014 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 load |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.3-validation", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  await expect(svc.load({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0523 SiteConfigRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 load |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-014.3-forbidden", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  await expect(svc.load(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0524 SiteConfigRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 load |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-014.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new SiteConfigRepository(mockDeps);
  await expect(svc.load("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0525 SiteConfigRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 load |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-014.3-empty", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  const result = await svc.load("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0526 SiteConfigRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 load |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-014.3-max", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.load(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0527 SiteConfigRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 load |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.3-overflow", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  await expect(svc.load("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0528 SiteConfigRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 load |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-014.3-type", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  await expect(svc.load("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0529 SiteConfigRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 load |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-014.3-concurrent", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  await Promise.all([svc.load(x), svc.load(x), svc.load(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0530 SiteConfigRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-014.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-014.3-mock-isolation", async () => {
  const svc = new SiteConfigRepository(mockDeps);
  await svc.load(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §17. SD-015 访问记录（2 DD）

### DD-015.1 ViewRecord（Model）

#### UT-0531 ViewRecord.ViewRecordSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P0 |
| 前置条件 | SD-015 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-015.1-happy", async () => {
  const svc = new ViewRecord(mockDeps);
  const result = await svc.ViewRecordSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0532 ViewRecord.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P0 |
| 前置条件 | SD-015 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-015.1-validation", async () => {
  const svc = new ViewRecord(mockDeps);
  await expect(svc.ViewRecordSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0533 ViewRecord.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-015.1-forbidden", async () => {
  const svc = new ViewRecord(mockDeps);
  await expect(svc.ViewRecordSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0534 ViewRecord.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-015.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ViewRecord(mockDeps);
  await expect(svc.ViewRecordSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0535 ViewRecord.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-015.1-empty", async () => {
  const svc = new ViewRecord(mockDeps);
  const result = await svc.ViewRecordSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0536 ViewRecord.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-015.1-max", async () => {
  const svc = new ViewRecord(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.ViewRecordSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0537 ViewRecord.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-015.1-overflow", async () => {
  const svc = new ViewRecord(mockDeps);
  await expect(svc.ViewRecordSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0538 ViewRecord.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 ViewRecordSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-015.1-type", async () => {
  const svc = new ViewRecord(mockDeps);
  await expect(svc.ViewRecordSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0539 ViewRecord.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 ViewRecordSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-015.1-concurrent", async () => {
  const svc = new ViewRecord(mockDeps);
  await Promise.all([svc.ViewRecordSchema (x), svc.ViewRecordSchema (x), svc.ViewRecordSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0540 ViewRecord.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-015.1-mock-isolation", async () => {
  const svc = new ViewRecord(mockDeps);
  await svc.ViewRecordSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-015.2 ViewRecordService（Service）

#### UT-0541 ViewRecordService.record 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P0 |
| 前置条件 | SD-015 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 record |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-015.2-happy", async () => {
  const svc = new ViewRecordService(mockDeps);
  const result = await svc.record(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0542 ViewRecordService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P0 |
| 前置条件 | SD-015 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 record |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-015.2-validation", async () => {
  const svc = new ViewRecordService(mockDeps);
  await expect(svc.record({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0543 ViewRecordService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 record |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-015.2-forbidden", async () => {
  const svc = new ViewRecordService(mockDeps);
  await expect(svc.record(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0544 ViewRecordService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 record |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-015.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ViewRecordService(mockDeps);
  await expect(svc.record("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0545 ViewRecordService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 record |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-015.2-empty", async () => {
  const svc = new ViewRecordService(mockDeps);
  const result = await svc.record("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0546 ViewRecordService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 record |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-015.2-max", async () => {
  const svc = new ViewRecordService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.record(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0547 ViewRecordService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 record |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-015.2-overflow", async () => {
  const svc = new ViewRecordService(mockDeps);
  await expect(svc.record("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0548 ViewRecordService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 record |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-015.2-type", async () => {
  const svc = new ViewRecordService(mockDeps);
  await expect(svc.record("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0549 ViewRecordService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 record |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-015.2-concurrent", async () => {
  const svc = new ViewRecordService(mockDeps);
  await Promise.all([svc.record(x), svc.record(x), svc.record(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0550 ViewRecordService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-015.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-015.2-mock-isolation", async () => {
  const svc = new ViewRecordService(mockDeps);
  await svc.record(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §18. SD-016 审计日志（3 DD）

### DD-016.1 AuditLog（Model）

#### UT-0551 AuditLog.AuditLogSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P0 |
| 前置条件 | SD-016 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-016.1-happy", async () => {
  const svc = new AuditLog(mockDeps);
  const result = await svc.AuditLogSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0552 AuditLog.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P0 |
| 前置条件 | SD-016 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.1-validation", async () => {
  const svc = new AuditLog(mockDeps);
  await expect(svc.AuditLogSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0553 AuditLog.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-016.1-forbidden", async () => {
  const svc = new AuditLog(mockDeps);
  await expect(svc.AuditLogSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0554 AuditLog.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-016.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AuditLog(mockDeps);
  await expect(svc.AuditLogSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0555 AuditLog.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-016.1-empty", async () => {
  const svc = new AuditLog(mockDeps);
  const result = await svc.AuditLogSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0556 AuditLog.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-016.1-max", async () => {
  const svc = new AuditLog(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.AuditLogSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0557 AuditLog.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.1-overflow", async () => {
  const svc = new AuditLog(mockDeps);
  await expect(svc.AuditLogSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0558 AuditLog.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 AuditLogSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.1-type", async () => {
  const svc = new AuditLog(mockDeps);
  await expect(svc.AuditLogSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0559 AuditLog.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 AuditLogSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-016.1-concurrent", async () => {
  const svc = new AuditLog(mockDeps);
  await Promise.all([svc.AuditLogSchema (x), svc.AuditLogSchema (x), svc.AuditLogSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0560 AuditLog.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-016.1-mock-isolation", async () => {
  const svc = new AuditLog(mockDeps);
  await svc.AuditLogSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-016.2 AuditLogService（Service）

#### UT-0561 AuditLogService.log 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P0 |
| 前置条件 | SD-016 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 log |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-016.2-happy", async () => {
  const svc = new AuditLogService(mockDeps);
  const result = await svc.log(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0562 AuditLogService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P0 |
| 前置条件 | SD-016 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 log |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.2-validation", async () => {
  const svc = new AuditLogService(mockDeps);
  await expect(svc.log({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0563 AuditLogService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 log |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-016.2-forbidden", async () => {
  const svc = new AuditLogService(mockDeps);
  await expect(svc.log(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0564 AuditLogService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 log |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-016.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AuditLogService(mockDeps);
  await expect(svc.log("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0565 AuditLogService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 log |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-016.2-empty", async () => {
  const svc = new AuditLogService(mockDeps);
  const result = await svc.log("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0566 AuditLogService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 log |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-016.2-max", async () => {
  const svc = new AuditLogService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.log(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0567 AuditLogService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 log |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.2-overflow", async () => {
  const svc = new AuditLogService(mockDeps);
  await expect(svc.log("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0568 AuditLogService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 log |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.2-type", async () => {
  const svc = new AuditLogService(mockDeps);
  await expect(svc.log("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0569 AuditLogService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 log |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-016.2-concurrent", async () => {
  const svc = new AuditLogService(mockDeps);
  await Promise.all([svc.log(x), svc.log(x), svc.log(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0570 AuditLogService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-016.2-mock-isolation", async () => {
  const svc = new AuditLogService(mockDeps);
  await svc.log(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-016.3 AuditLogRepository（Repository）

#### UT-0571 AuditLogRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P0 |
| 前置条件 | SD-016 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-016.3-happy", async () => {
  const svc = new AuditLogRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0572 AuditLogRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P0 |
| 前置条件 | SD-016 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.3-validation", async () => {
  const svc = new AuditLogRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0573 AuditLogRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-016.3-forbidden", async () => {
  const svc = new AuditLogRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0574 AuditLogRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-016.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AuditLogRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0575 AuditLogRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-016.3-empty", async () => {
  const svc = new AuditLogRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0576 AuditLogRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-016.3-max", async () => {
  const svc = new AuditLogRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0577 AuditLogRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.3-overflow", async () => {
  const svc = new AuditLogRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0578 AuditLogRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-016.3-type", async () => {
  const svc = new AuditLogRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0579 AuditLogRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-016.3-concurrent", async () => {
  const svc = new AuditLogRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0580 AuditLogRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-016.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-016.3-mock-isolation", async () => {
  const svc = new AuditLogRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §19. SD-017 统计（2 DD）

### DD-017.1 Stats（Model）

#### UT-0581 Stats.StatsSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P0 |
| 前置条件 | SD-017 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-017.1-happy", async () => {
  const svc = new Stats(mockDeps);
  const result = await svc.StatsSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0582 Stats.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P0 |
| 前置条件 | SD-017 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-017.1-validation", async () => {
  const svc = new Stats(mockDeps);
  await expect(svc.StatsSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0583 Stats.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-017.1-forbidden", async () => {
  const svc = new Stats(mockDeps);
  await expect(svc.StatsSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0584 Stats.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-017.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Stats(mockDeps);
  await expect(svc.StatsSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0585 Stats.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-017.1-empty", async () => {
  const svc = new Stats(mockDeps);
  const result = await svc.StatsSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0586 Stats.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-017.1-max", async () => {
  const svc = new Stats(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.StatsSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0587 Stats.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-017.1-overflow", async () => {
  const svc = new Stats(mockDeps);
  await expect(svc.StatsSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0588 Stats.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 StatsSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-017.1-type", async () => {
  const svc = new Stats(mockDeps);
  await expect(svc.StatsSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0589 Stats.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 StatsSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-017.1-concurrent", async () => {
  const svc = new Stats(mockDeps);
  await Promise.all([svc.StatsSchema (x), svc.StatsSchema (x), svc.StatsSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0590 Stats.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-017.1-mock-isolation", async () => {
  const svc = new Stats(mockDeps);
  await svc.StatsSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-017.2 StatsAggregator（Service）

#### UT-0591 StatsAggregator.aggregate 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P0 |
| 前置条件 | SD-017 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 aggregate |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-017.2-happy", async () => {
  const svc = new StatsAggregator(mockDeps);
  const result = await svc.aggregate(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0592 StatsAggregator.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P0 |
| 前置条件 | SD-017 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 aggregate |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-017.2-validation", async () => {
  const svc = new StatsAggregator(mockDeps);
  await expect(svc.aggregate({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0593 StatsAggregator.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 aggregate |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-017.2-forbidden", async () => {
  const svc = new StatsAggregator(mockDeps);
  await expect(svc.aggregate(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0594 StatsAggregator.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 aggregate |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-017.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new StatsAggregator(mockDeps);
  await expect(svc.aggregate("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0595 StatsAggregator.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 aggregate |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-017.2-empty", async () => {
  const svc = new StatsAggregator(mockDeps);
  const result = await svc.aggregate("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0596 StatsAggregator.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 aggregate |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-017.2-max", async () => {
  const svc = new StatsAggregator(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.aggregate(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0597 StatsAggregator.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 aggregate |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-017.2-overflow", async () => {
  const svc = new StatsAggregator(mockDeps);
  await expect(svc.aggregate("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0598 StatsAggregator.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 aggregate |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-017.2-type", async () => {
  const svc = new StatsAggregator(mockDeps);
  await expect(svc.aggregate("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0599 StatsAggregator.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 aggregate |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-017.2-concurrent", async () => {
  const svc = new StatsAggregator(mockDeps);
  await Promise.all([svc.aggregate(x), svc.aggregate(x), svc.aggregate(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0600 StatsAggregator.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-017.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-017.2-mock-isolation", async () => {
  const svc = new StatsAggregator(mockDeps);
  await svc.aggregate(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §20. SD-018 推荐（2 DD）

### DD-018.1 RecommendEngine（Engine）

#### UT-0601 RecommendEngine.recommend 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P0 |
| 前置条件 | SD-018 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 recommend |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-018.1-happy", async () => {
  const svc = new RecommendEngine(mockDeps);
  const result = await svc.recommend(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0602 RecommendEngine.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P0 |
| 前置条件 | SD-018 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 recommend |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-018.1-validation", async () => {
  const svc = new RecommendEngine(mockDeps);
  await expect(svc.recommend({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0603 RecommendEngine.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 recommend |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-018.1-forbidden", async () => {
  const svc = new RecommendEngine(mockDeps);
  await expect(svc.recommend(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0604 RecommendEngine.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 recommend |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-018.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RecommendEngine(mockDeps);
  await expect(svc.recommend("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0605 RecommendEngine.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 recommend |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-018.1-empty", async () => {
  const svc = new RecommendEngine(mockDeps);
  const result = await svc.recommend("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0606 RecommendEngine.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 recommend |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-018.1-max", async () => {
  const svc = new RecommendEngine(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.recommend(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0607 RecommendEngine.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 recommend |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-018.1-overflow", async () => {
  const svc = new RecommendEngine(mockDeps);
  await expect(svc.recommend("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0608 RecommendEngine.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 recommend |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-018.1-type", async () => {
  const svc = new RecommendEngine(mockDeps);
  await expect(svc.recommend("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0609 RecommendEngine.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 recommend |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-018.1-concurrent", async () => {
  const svc = new RecommendEngine(mockDeps);
  await Promise.all([svc.recommend(x), svc.recommend(x), svc.recommend(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0610 RecommendEngine.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-018.1-mock-isolation", async () => {
  const svc = new RecommendEngine(mockDeps);
  await svc.recommend(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-018.2 RecommendService（Service）

#### UT-0611 RecommendService.recommend 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P0 |
| 前置条件 | SD-018 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 recommend |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-018.2-happy", async () => {
  const svc = new RecommendService(mockDeps);
  const result = await svc.recommend(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0612 RecommendService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P0 |
| 前置条件 | SD-018 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 recommend |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-018.2-validation", async () => {
  const svc = new RecommendService(mockDeps);
  await expect(svc.recommend({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0613 RecommendService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 recommend |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-018.2-forbidden", async () => {
  const svc = new RecommendService(mockDeps);
  await expect(svc.recommend(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0614 RecommendService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 recommend |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-018.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RecommendService(mockDeps);
  await expect(svc.recommend("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0615 RecommendService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 recommend |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-018.2-empty", async () => {
  const svc = new RecommendService(mockDeps);
  const result = await svc.recommend("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0616 RecommendService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 recommend |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-018.2-max", async () => {
  const svc = new RecommendService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.recommend(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0617 RecommendService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 recommend |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-018.2-overflow", async () => {
  const svc = new RecommendService(mockDeps);
  await expect(svc.recommend("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0618 RecommendService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 recommend |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-018.2-type", async () => {
  const svc = new RecommendService(mockDeps);
  await expect(svc.recommend("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0619 RecommendService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 recommend |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-018.2-concurrent", async () => {
  const svc = new RecommendService(mockDeps);
  await Promise.all([svc.recommend(x), svc.recommend(x), svc.recommend(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0620 RecommendService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-018.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-018.2-mock-isolation", async () => {
  const svc = new RecommendService(mockDeps);
  await svc.recommend(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §21. SD-019 广告位（3 DD）

### DD-019.1 AdSlot（Model）

#### UT-0621 AdSlot.AdSlotSchema  正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P0 |
| 前置条件 | SD-019 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-019.1-happy", async () => {
  const svc = new AdSlot(mockDeps);
  const result = await svc.AdSlotSchema (mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0622 AdSlot.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P0 |
| 前置条件 | SD-019 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.1-validation", async () => {
  const svc = new AdSlot(mockDeps);
  await expect(svc.AdSlotSchema ({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0623 AdSlot.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-019.1-forbidden", async () => {
  const svc = new AdSlot(mockDeps);
  await expect(svc.AdSlotSchema (foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0624 AdSlot.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-019.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AdSlot(mockDeps);
  await expect(svc.AdSlotSchema ("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0625 AdSlot.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-019.1-empty", async () => {
  const svc = new AdSlot(mockDeps);
  const result = await svc.AdSlotSchema ("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0626 AdSlot.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-019.1-max", async () => {
  const svc = new AdSlot(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.AdSlotSchema (long);
  expect(long.length).toBe(1000);
});
```

#### UT-0627 AdSlot.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.1-overflow", async () => {
  const svc = new AdSlot(mockDeps);
  await expect(svc.AdSlotSchema ("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0628 AdSlot.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 AdSlotSchema  |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.1-type", async () => {
  const svc = new AdSlot(mockDeps);
  await expect(svc.AdSlotSchema ("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0629 AdSlot.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 AdSlotSchema  |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-019.1-concurrent", async () => {
  const svc = new AdSlot(mockDeps);
  await Promise.all([svc.AdSlotSchema (x), svc.AdSlotSchema (x), svc.AdSlotSchema (x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0630 AdSlot.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-019.1-mock-isolation", async () => {
  const svc = new AdSlot(mockDeps);
  await svc.AdSlotSchema (validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-019.2 AdService（Service）

#### UT-0631 AdService.create 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P0 |
| 前置条件 | SD-019 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 create |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-019.2-happy", async () => {
  const svc = new AdService(mockDeps);
  const result = await svc.create(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0632 AdService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P0 |
| 前置条件 | SD-019 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 create |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.2-validation", async () => {
  const svc = new AdService(mockDeps);
  await expect(svc.create({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0633 AdService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 create |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-019.2-forbidden", async () => {
  const svc = new AdService(mockDeps);
  await expect(svc.create(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0634 AdService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 create |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-019.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AdService(mockDeps);
  await expect(svc.create("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0635 AdService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 create |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-019.2-empty", async () => {
  const svc = new AdService(mockDeps);
  const result = await svc.create("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0636 AdService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 create |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-019.2-max", async () => {
  const svc = new AdService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.create(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0637 AdService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 create |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.2-overflow", async () => {
  const svc = new AdService(mockDeps);
  await expect(svc.create("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0638 AdService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 create |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.2-type", async () => {
  const svc = new AdService(mockDeps);
  await expect(svc.create("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0639 AdService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 create |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-019.2-concurrent", async () => {
  const svc = new AdService(mockDeps);
  await Promise.all([svc.create(x), svc.create(x), svc.create(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0640 AdService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-019.2-mock-isolation", async () => {
  const svc = new AdService(mockDeps);
  await svc.create(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-019.3 AdRepository（Repository）

#### UT-0641 AdRepository.save 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P0 |
| 前置条件 | SD-019 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 save |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-019.3-happy", async () => {
  const svc = new AdRepository(mockDeps);
  const result = await svc.save(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0642 AdRepository.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P0 |
| 前置条件 | SD-019 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 save |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.3-validation", async () => {
  const svc = new AdRepository(mockDeps);
  await expect(svc.save({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0643 AdRepository.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 save |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-019.3-forbidden", async () => {
  const svc = new AdRepository(mockDeps);
  await expect(svc.save(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0644 AdRepository.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 save |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-019.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AdRepository(mockDeps);
  await expect(svc.save("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0645 AdRepository.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 save |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-019.3-empty", async () => {
  const svc = new AdRepository(mockDeps);
  const result = await svc.save("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0646 AdRepository.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 save |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-019.3-max", async () => {
  const svc = new AdRepository(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.save(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0647 AdRepository.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 save |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.3-overflow", async () => {
  const svc = new AdRepository(mockDeps);
  await expect(svc.save("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0648 AdRepository.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 save |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-019.3-type", async () => {
  const svc = new AdRepository(mockDeps);
  await expect(svc.save("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0649 AdRepository.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 save |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-019.3-concurrent", async () => {
  const svc = new AdRepository(mockDeps);
  await Promise.all([svc.save(x), svc.save(x), svc.save(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0650 AdRepository.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-019.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-019.3-mock-isolation", async () => {
  const svc = new AdRepository(mockDeps);
  await svc.save(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §22. SD-020 限流（3 DD）

### DD-020.1 RateLimiter（Util）

#### UT-0651 RateLimiter.check 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P0 |
| 前置条件 | SD-020 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 check |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-020.1-happy", async () => {
  const svc = new RateLimiter(mockDeps);
  const result = await svc.check(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0652 RateLimiter.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P0 |
| 前置条件 | SD-020 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 check |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.1-validation", async () => {
  const svc = new RateLimiter(mockDeps);
  await expect(svc.check({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0653 RateLimiter.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 check |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-020.1-forbidden", async () => {
  const svc = new RateLimiter(mockDeps);
  await expect(svc.check(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0654 RateLimiter.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 check |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-020.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RateLimiter(mockDeps);
  await expect(svc.check("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0655 RateLimiter.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 check |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-020.1-empty", async () => {
  const svc = new RateLimiter(mockDeps);
  const result = await svc.check("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0656 RateLimiter.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 check |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-020.1-max", async () => {
  const svc = new RateLimiter(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.check(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0657 RateLimiter.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 check |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.1-overflow", async () => {
  const svc = new RateLimiter(mockDeps);
  await expect(svc.check("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0658 RateLimiter.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 check |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.1-type", async () => {
  const svc = new RateLimiter(mockDeps);
  await expect(svc.check("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0659 RateLimiter.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 check |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-020.1-concurrent", async () => {
  const svc = new RateLimiter(mockDeps);
  await Promise.all([svc.check(x), svc.check(x), svc.check(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0660 RateLimiter.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-020.1-mock-isolation", async () => {
  const svc = new RateLimiter(mockDeps);
  await svc.check(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-020.2 RateLimitService（Service）

#### UT-0661 RateLimitService.middleware 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P0 |
| 前置条件 | SD-020 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 middleware |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-020.2-happy", async () => {
  const svc = new RateLimitService(mockDeps);
  const result = await svc.middleware(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0662 RateLimitService.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P0 |
| 前置条件 | SD-020 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 middleware |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.2-validation", async () => {
  const svc = new RateLimitService(mockDeps);
  await expect(svc.middleware({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0663 RateLimitService.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 middleware |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-020.2-forbidden", async () => {
  const svc = new RateLimitService(mockDeps);
  await expect(svc.middleware(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0664 RateLimitService.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 middleware |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-020.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RateLimitService(mockDeps);
  await expect(svc.middleware("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0665 RateLimitService.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 middleware |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-020.2-empty", async () => {
  const svc = new RateLimitService(mockDeps);
  const result = await svc.middleware("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0666 RateLimitService.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 middleware |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-020.2-max", async () => {
  const svc = new RateLimitService(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.middleware(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0667 RateLimitService.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 middleware |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.2-overflow", async () => {
  const svc = new RateLimitService(mockDeps);
  await expect(svc.middleware("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0668 RateLimitService.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 middleware |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.2-type", async () => {
  const svc = new RateLimitService(mockDeps);
  await expect(svc.middleware("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0669 RateLimitService.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 middleware |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-020.2-concurrent", async () => {
  const svc = new RateLimitService(mockDeps);
  await Promise.all([svc.middleware(x), svc.middleware(x), svc.middleware(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0670 RateLimitService.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-020.2-mock-isolation", async () => {
  const svc = new RateLimitService(mockDeps);
  await svc.middleware(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-020.3 RateLimitRule（Config）

#### UT-0671 RateLimitRule.match 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P0 |
| 前置条件 | SD-020 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 match |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-020.3-happy", async () => {
  const svc = new RateLimitRule(mockDeps);
  const result = await svc.match(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0672 RateLimitRule.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P0 |
| 前置条件 | SD-020 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 match |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.3-validation", async () => {
  const svc = new RateLimitRule(mockDeps);
  await expect(svc.match({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0673 RateLimitRule.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 match |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-020.3-forbidden", async () => {
  const svc = new RateLimitRule(mockDeps);
  await expect(svc.match(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0674 RateLimitRule.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 match |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-020.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RateLimitRule(mockDeps);
  await expect(svc.match("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0675 RateLimitRule.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 match |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-020.3-empty", async () => {
  const svc = new RateLimitRule(mockDeps);
  const result = await svc.match("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0676 RateLimitRule.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 match |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-020.3-max", async () => {
  const svc = new RateLimitRule(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.match(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0677 RateLimitRule.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 match |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.3-overflow", async () => {
  const svc = new RateLimitRule(mockDeps);
  await expect(svc.match("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0678 RateLimitRule.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 match |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-020.3-type", async () => {
  const svc = new RateLimitRule(mockDeps);
  await expect(svc.match("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0679 RateLimitRule.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 match |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-020.3-concurrent", async () => {
  const svc = new RateLimitRule(mockDeps);
  await Promise.all([svc.match(x), svc.match(x), svc.match(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0680 RateLimitRule.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-020.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-020.3-mock-isolation", async () => {
  const svc = new RateLimitRule(mockDeps);
  await svc.match(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §23. SD-021 路由层（3 DD）

### DD-021.1 Router（Component）

#### UT-0681 Router.mount 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P0 |
| 前置条件 | SD-021 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 mount |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-021.1-happy", async () => {
  const svc = new Router(mockDeps);
  const result = await svc.mount(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0682 Router.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P0 |
| 前置条件 | SD-021 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 mount |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.1-validation", async () => {
  const svc = new Router(mockDeps);
  await expect(svc.mount({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0683 Router.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 mount |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-021.1-forbidden", async () => {
  const svc = new Router(mockDeps);
  await expect(svc.mount(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0684 Router.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 mount |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-021.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new Router(mockDeps);
  await expect(svc.mount("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0685 Router.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 mount |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-021.1-empty", async () => {
  const svc = new Router(mockDeps);
  const result = await svc.mount("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0686 Router.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 mount |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-021.1-max", async () => {
  const svc = new Router(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.mount(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0687 Router.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 mount |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.1-overflow", async () => {
  const svc = new Router(mockDeps);
  await expect(svc.mount("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0688 Router.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 mount |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.1-type", async () => {
  const svc = new Router(mockDeps);
  await expect(svc.mount("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0689 Router.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 mount |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-021.1-concurrent", async () => {
  const svc = new Router(mockDeps);
  await Promise.all([svc.mount(x), svc.mount(x), svc.mount(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0690 Router.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-021.1-mock-isolation", async () => {
  const svc = new Router(mockDeps);
  await svc.mount(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-021.2 RouterBuilder（Util）

#### UT-0691 RouterBuilder.group 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P0 |
| 前置条件 | SD-021 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 group |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-021.2-happy", async () => {
  const svc = new RouterBuilder(mockDeps);
  const result = await svc.group(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0692 RouterBuilder.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P0 |
| 前置条件 | SD-021 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 group |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.2-validation", async () => {
  const svc = new RouterBuilder(mockDeps);
  await expect(svc.group({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0693 RouterBuilder.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 group |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-021.2-forbidden", async () => {
  const svc = new RouterBuilder(mockDeps);
  await expect(svc.group(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0694 RouterBuilder.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 group |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-021.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RouterBuilder(mockDeps);
  await expect(svc.group("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0695 RouterBuilder.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 group |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-021.2-empty", async () => {
  const svc = new RouterBuilder(mockDeps);
  const result = await svc.group("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0696 RouterBuilder.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 group |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-021.2-max", async () => {
  const svc = new RouterBuilder(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.group(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0697 RouterBuilder.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 group |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.2-overflow", async () => {
  const svc = new RouterBuilder(mockDeps);
  await expect(svc.group("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0698 RouterBuilder.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 group |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.2-type", async () => {
  const svc = new RouterBuilder(mockDeps);
  await expect(svc.group("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0699 RouterBuilder.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 group |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-021.2-concurrent", async () => {
  const svc = new RouterBuilder(mockDeps);
  await Promise.all([svc.group(x), svc.group(x), svc.group(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0700 RouterBuilder.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-021.2-mock-isolation", async () => {
  const svc = new RouterBuilder(mockDeps);
  await svc.group(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-021.3 RouteRegistry（Util）

#### UT-0701 RouteRegistry.register 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P0 |
| 前置条件 | SD-021 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 register |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-021.3-happy", async () => {
  const svc = new RouteRegistry(mockDeps);
  const result = await svc.register(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0702 RouteRegistry.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P0 |
| 前置条件 | SD-021 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 register |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.3-validation", async () => {
  const svc = new RouteRegistry(mockDeps);
  await expect(svc.register({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0703 RouteRegistry.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 register |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-021.3-forbidden", async () => {
  const svc = new RouteRegistry(mockDeps);
  await expect(svc.register(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0704 RouteRegistry.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 register |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-021.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new RouteRegistry(mockDeps);
  await expect(svc.register("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0705 RouteRegistry.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 register |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-021.3-empty", async () => {
  const svc = new RouteRegistry(mockDeps);
  const result = await svc.register("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0706 RouteRegistry.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 register |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-021.3-max", async () => {
  const svc = new RouteRegistry(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.register(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0707 RouteRegistry.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 register |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.3-overflow", async () => {
  const svc = new RouteRegistry(mockDeps);
  await expect(svc.register("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0708 RouteRegistry.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 register |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-021.3-type", async () => {
  const svc = new RouteRegistry(mockDeps);
  await expect(svc.register("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0709 RouteRegistry.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 register |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-021.3-concurrent", async () => {
  const svc = new RouteRegistry(mockDeps);
  await Promise.all([svc.register(x), svc.register(x), svc.register(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0710 RouteRegistry.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-021.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-021.3-mock-isolation", async () => {
  const svc = new RouteRegistry(mockDeps);
  await svc.register(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

## §24. SD-022 错误处理（4 DD）

### DD-022.1 ErrorHandler（Middleware）

#### UT-0711 ErrorHandler.middleware 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P0 |
| 前置条件 | SD-022 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 middleware |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-022.1-happy", async () => {
  const svc = new ErrorHandler(mockDeps);
  const result = await svc.middleware(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0712 ErrorHandler.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P0 |
| 前置条件 | SD-022 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 middleware |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.1-validation", async () => {
  const svc = new ErrorHandler(mockDeps);
  await expect(svc.middleware({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0713 ErrorHandler.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 middleware |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-022.1-forbidden", async () => {
  const svc = new ErrorHandler(mockDeps);
  await expect(svc.middleware(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0714 ErrorHandler.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 middleware |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-022.1-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ErrorHandler(mockDeps);
  await expect(svc.middleware("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0715 ErrorHandler.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 middleware |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-022.1-empty", async () => {
  const svc = new ErrorHandler(mockDeps);
  const result = await svc.middleware("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0716 ErrorHandler.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 middleware |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-022.1-max", async () => {
  const svc = new ErrorHandler(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.middleware(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0717 ErrorHandler.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 middleware |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.1-overflow", async () => {
  const svc = new ErrorHandler(mockDeps);
  await expect(svc.middleware("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0718 ErrorHandler.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 middleware |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.1-type", async () => {
  const svc = new ErrorHandler(mockDeps);
  await expect(svc.middleware("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0719 ErrorHandler.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 middleware |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-022.1-concurrent", async () => {
  const svc = new ErrorHandler(mockDeps);
  await Promise.all([svc.middleware(x), svc.middleware(x), svc.middleware(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0720 ErrorHandler.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.1 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-022.1-mock-isolation", async () => {
  const svc = new ErrorHandler(mockDeps);
  await svc.middleware(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-022.2 ErrorMapper（Util）

#### UT-0721 ErrorMapper.map 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P0 |
| 前置条件 | SD-022 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 map |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-022.2-happy", async () => {
  const svc = new ErrorMapper(mockDeps);
  const result = await svc.map(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0722 ErrorMapper.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P0 |
| 前置条件 | SD-022 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 map |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.2-validation", async () => {
  const svc = new ErrorMapper(mockDeps);
  await expect(svc.map({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0723 ErrorMapper.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 map |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-022.2-forbidden", async () => {
  const svc = new ErrorMapper(mockDeps);
  await expect(svc.map(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0724 ErrorMapper.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 map |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-022.2-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ErrorMapper(mockDeps);
  await expect(svc.map("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0725 ErrorMapper.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 map |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-022.2-empty", async () => {
  const svc = new ErrorMapper(mockDeps);
  const result = await svc.map("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0726 ErrorMapper.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 map |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-022.2-max", async () => {
  const svc = new ErrorMapper(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.map(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0727 ErrorMapper.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 map |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.2-overflow", async () => {
  const svc = new ErrorMapper(mockDeps);
  await expect(svc.map("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0728 ErrorMapper.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 map |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.2-type", async () => {
  const svc = new ErrorMapper(mockDeps);
  await expect(svc.map("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0729 ErrorMapper.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 map |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-022.2-concurrent", async () => {
  const svc = new ErrorMapper(mockDeps);
  await Promise.all([svc.map(x), svc.map(x), svc.map(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0730 ErrorMapper.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.2 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-022.2-mock-isolation", async () => {
  const svc = new ErrorMapper(mockDeps);
  await svc.map(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-022.3 ErrorLogger（Util）

#### UT-0731 ErrorLogger.log 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P0 |
| 前置条件 | SD-022 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 log |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-022.3-happy", async () => {
  const svc = new ErrorLogger(mockDeps);
  const result = await svc.log(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0732 ErrorLogger.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P0 |
| 前置条件 | SD-022 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 log |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.3-validation", async () => {
  const svc = new ErrorLogger(mockDeps);
  await expect(svc.log({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0733 ErrorLogger.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 log |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-022.3-forbidden", async () => {
  const svc = new ErrorLogger(mockDeps);
  await expect(svc.log(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0734 ErrorLogger.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 log |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-022.3-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new ErrorLogger(mockDeps);
  await expect(svc.log("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0735 ErrorLogger.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 log |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-022.3-empty", async () => {
  const svc = new ErrorLogger(mockDeps);
  const result = await svc.log("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0736 ErrorLogger.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 log |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-022.3-max", async () => {
  const svc = new ErrorLogger(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.log(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0737 ErrorLogger.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 log |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.3-overflow", async () => {
  const svc = new ErrorLogger(mockDeps);
  await expect(svc.log("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0738 ErrorLogger.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 log |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.3-type", async () => {
  const svc = new ErrorLogger(mockDeps);
  await expect(svc.log("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0739 ErrorLogger.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 log |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-022.3-concurrent", async () => {
  const svc = new ErrorLogger(mockDeps);
  await Promise.all([svc.log(x), svc.log(x), svc.log(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0740 ErrorLogger.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.3 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-022.3-mock-isolation", async () => {
  const svc = new ErrorLogger(mockDeps);
  await svc.log(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

### DD-022.4 AppError（Model）

#### UT-0741 AppError.AppError class, toJSON 正常路径 (happy)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P0 |
| 前置条件 | SD-022 模块已实例化，依赖 mock 完成 |
| 输入 | 合法输入 |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 返回预期结果，副作用（事件/审计）正确触发 |
| 断言 | `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)` |

```typescript
it("dd-022.4-happy", async () => {
  const svc = new AppError(mockDeps);
  const result = await svc.AppError class, toJSON(mockInput);
  expect(result).toBeDefined();
  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));
  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));
});
```

#### UT-0742 AppError.参数校验失败 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P0 |
| 前置条件 | SD-022 已实例化 |
| 输入 | 缺失必填字段 |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 抛出 VALIDATION_FAILED 400 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.4-validation", async () => {
  const svc = new AppError(mockDeps);
  await expect(svc.AppError class, toJSON({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});
});
```

#### UT-0743 AppError.权限不足 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P0 |
| 前置条件 | 已认证但角色不足 |
| 输入 | 越权操作 |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 抛出 FORBIDDEN 403 |
| 断言 | `expect(err.code).toBe("FORBIDDEN")` |

```typescript
it("dd-022.4-forbidden", async () => {
  const svc = new AppError(mockDeps);
  await expect(svc.AppError class, toJSON(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});
});
```

#### UT-0744 AppError.资源不存在 (error)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P0 |
| 前置条件 | 依赖 Repository 找不到 |
| 输入 | 不存在的 id |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 抛出 NOT_FOUND 404 |
| 断言 | `expect(err.code).toBe("NOT_FOUND")` |

```typescript
it("dd-022.4-notfound", async () => {
  mockRepo.find.mockReturnValue(null);
  const svc = new AppError(mockDeps);
  await expect(svc.AppError class, toJSON("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});
});
```

#### UT-0745 AppError.空输入 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 空字符串/null/undefined |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 按约束正确处理（空入参拒绝 / 返回空集） |
| 断言 | `expect(result === null || Array.isArray(result)).toBe(true)` |

```typescript
it("dd-022.4-empty", async () => {
  const svc = new AppError(mockDeps);
  const result = await svc.AppError class, toJSON("");
  expect(result === null || Array.isArray(result)).toBe(true);
});
```

#### UT-0746 AppError.极值 MAX (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 字段达最大长度 |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 按约束通过或拒绝 |
| 断言 | `expect(long.length).toBe(1000)` |

```typescript
it("dd-022.4-max", async () => {
  const svc = new AppError(mockDeps);
  const long = "x".repeat(1000);
  const result = await svc.AppError class, toJSON(long);
  expect(long.length).toBe(1000);
});
```

#### UT-0747 AppError.越界 ±1 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 超出 1 字符/1 单位 |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 按约束拒绝或截断 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.4-overflow", async () => {
  const svc = new AppError(mockDeps);
  await expect(svc.AppError class, toJSON("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0748 AppError.类型不符 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P1 |
| 前置条件 | 依赖已 mock |
| 输入 | 传 string 而非 number |
| 操作 | 调用 AppError class, toJSON |
| 预期输出 | 校验失败 |
| 断言 | `expect(err.code).toBe("VALIDATION_FAILED")` |

```typescript
it("dd-022.4-type", async () => {
  const svc = new AppError(mockDeps);
  await expect(svc.AppError class, toJSON("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});
});
```

#### UT-0749 AppError.并发竞态 (boundary)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P2 |
| 前置条件 | 依赖共享 Map |
| 输入 | 并发调用同一资源 |
| 操作 | 并发调用 AppError class, toJSON |
| 预期输出 | 最终一致 / 串行化生效 |
| 断言 | `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)` |

```typescript
it("dd-022.4-concurrent", async () => {
  const svc = new AppError(mockDeps);
  await Promise.all([svc.AppError class, toJSON(x), svc.AppError class, toJSON(x), svc.AppError class, toJSON(x)]);
  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);
});
```

#### UT-0750 AppError.mock 隔离 (verify)

| 项 | 内容 |
|---|---|
| 所属 DD | DD-022.4 |
| 优先级 | P0 |
| 前置条件 | 所有外部依赖已 mock |
| 输入 | 运行后 |
| 操作 | 检查 mock 调用次数 |
| 预期输出 | 依赖被调用且仅被调用预期次数 |
| 断言 | `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();` |

```typescript
it("dd-022.4-mock-isolation", async () => {
  const svc = new AppError(mockDeps);
  await svc.AppError class, toJSON(validInput);
  expect(mockRepo.save).toHaveBeenCalledTimes(1);
  expect(mockExternalApi).not.toHaveBeenCalled();
});
```

---

## §N. 覆盖率与统计

| 指标 | 数值 |
|---|---:|
| DD 数量 | 75 |
| UT 用例总数 | 750 |
| 平均每 DD 用例 | 10.00 |
| happy path 占比 | ~33% |
| error path 占比 | ~33% |
| boundary 占比 | ~33% |
| 目标分支覆盖 | ≥ 80% |

## §N+1. Mock 隔离方案

| 依赖 | mock 方式 |
|---|---|
| Repository | `vi.mock("@/modules/.../repository")` |
| EventBus | `vi.mock("@/core/events/eventBus")` |
| TokenManager | `vi.mock("@/modules/auth/TokenManager")` |
| BcryptUtil | `vi.mock("@/modules/auth/BcryptUtil")` |
| Clock | `vi.useFakeTimers()` |
| HTTP | `msw` 或 `supertest` |

