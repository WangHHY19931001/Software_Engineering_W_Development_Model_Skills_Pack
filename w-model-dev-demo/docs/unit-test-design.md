# 单元测试设计文档（Unit Test Design）

> 阶段 4 详细设计同步产出。对应阶段 4 详细设计 `docs/detailed-design.md`（75 DD）。
> 测试 seam 决策沿用阶段 4 §25：seam-module（模块导出边界，类公共 API），单元层理想零新 seam。
> 本文含 225 个单元测试用例：75 DD × 3 用例（正常/异常/边界）。
> 用例 ID 前缀 `TC-UNIT-*`，将在阶段 5（编码）实现为 Vitest 可执行测试代码。
> 设计目标：NFR-004 单元测试代码行覆盖率 ≥ 80%。

## §1 概述

### §1.1 测试目标

- **方法级覆盖**：每个 DD 的公共方法至少 1 个用例（含 `expect()` 断言，禁止 `// TODO: assert` 占位）
- **边界条件必覆盖清单**：空输入 / null / 极值（MAX/MIN）/ 越界（±1）/ 类型不符 / 并发竞态（涉及共享状态时）
- **TLA+ L4 不变式作为 oracle**：5 个 L4 状态机各至少 1 个对应单元测试（state machine / token lifecycle / rate limiter / audit retention / password reset）
- **覆盖率目标**：分支覆盖 ≥ 80%（NFR-004）

### §1.2 测试环境

- **测试框架**：Vitest（与集成/系统测试统一）
- **测试 seam**：seam-module（模块导出边界，类公共方法）
- **数据隔离**：每个用例独立内存存储（beforeEach 重置 Map）
- **mock/stub 隔离方案**：
  - Service 层：mock Store 接口（vitest.fn()）
  - Controller 层：mock Service 接口 + Express req/res 对象（vitest.fn()）
  - Middleware 层：mock Express next() 函数
  - Util 层：纯函数直接测试，无需 mock

### §1.3 用例统计

| 类型 | 用例数 | 用例 ID 范围 |
|---|---|---|
| 正常路径（N） | 75 | TC-UNIT-001N ~ TC-UNIT-075N |
| 异常路径（E） | 75 | TC-UNIT-001E ~ TC-UNIT-075E |
| 边界条件（B） | 75 | TC-UNIT-001B ~ TC-UNIT-075B |
| **合计** | **225** | |

### §1.4 DD → 用例编号映射规则

- 用例编号 `TC-UNIT-<DD序号><类型>`，DD 序号 = DD 在本文档的出现顺序（DD-001-001=1, DD-001-002=2, ..., DD-COMMON-005=75）
- 类型：N=正常 / E=异常 / B=边界

## §2 SD-001 系统根（3 用例）

### TC-UNIT-001N AppController.health 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-001N |
| 类型 | 正常 |
| 关联 DD | DD-001-001 |
| 场景 | health() 返回服务运行状态 |
| 前置条件 | 无 |
| 步骤 | 1. 调用 `AppController.health()` |
| 预期 | `expect(result).toEqual({status:"ok", timestamp:<iso8601>, uptime:<number>})` |
| 优先级 | 高 |

### TC-UNIT-001E AppController.health 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-001E |
| 类型 | 异常 |
| 关联 DD | DD-001-001 |
| 场景 | uptime 读取失败抛错被捕获 |
| 前置条件 | mock process.uptime 抛错 |
| 步骤 | 1. mock `process.uptime` 抛 Error；2. 调用 `health()` |
| 预期 | `expect(() => health()).not.toThrow()`；返回 status:"degraded" |
| 优先级 | 中 |

### TC-UNIT-001B AppController.health 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-001B |
| 类型 | 边界 |
| 关联 DD | DD-001-001 |
| 场景 | uptime=0（刚启动）边界值 |
| 前置条件 | mock process.uptime 返回 0 |
| 步骤 | 1. mock 返回 0；2. 调用 `health()` |
| 预期 | `expect(result.uptime).toBe(0)`；status 仍为 "ok" |
| 优先级 | 中 |

### TC-UNIT-002N ExpressApp 装配正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-002N |
| 类型 | 正常 |
| 关联 DD | DD-001-002 |
| 场景 | mountMiddleware + mountRoutes 后 app 路由表完整 |
| 前置条件 | 无 |
| 步骤 | 1. new ExpressApp()；2. mountMiddleware()；3. mountRoutes()；4. 查询 app._router.stack |
| 预期 | `expect(app._router.stack.length).toBeGreaterThan(0)`；含 /health 路由 |
| 优先级 | 高 |

### TC-UNIT-002E ExpressApp 装配异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-002E |
| 类型 | 异常 |
| 关联 DD | DD-001-002 |
| 场景 | 重复 mountMiddleware 抛错 |
| 前置条件 | 已 mountMiddleware 一次 |
| 步骤 | 1. mountMiddleware()；2. 再次 mountMiddleware() |
| 预期 | `expect(() => app.mountMiddleware()).toThrow(/already mounted/)` |
| 优先级 | 中 |

### TC-UNIT-002B ExpressApp 装配边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-002B |
| 类型 | 边界 |
| 关联 DD | DD-001-002 |
| 场景 | 端口号 0（随机端口）边界 |
| 前置条件 | 无 |
| 步骤 | 1. listen(0) |
| 预期 | `expect(server.listening).toBe(true)` |
| 优先级 | 低 |

### TC-UNIT-003N Server.listen 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-003N |
| 类型 | 正常 |
| 关联 DD | DD-001-003 |
| 场景 | listen 返回 http.Server 实例 |
| 前置条件 | 无 |
| 步骤 | 1. Server.listen(app, 0) |
| 预期 | `expect(server).toBeInstanceOf(http.Server)` |
| 优先级 | 高 |

### TC-UNIT-003E Server.listen 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-003E |
| 类型 | 异常 |
| 关联 DD | DD-001-003 |
| 场景 | 端口已被占用抛 EADDRINUSE |
| 前置条件 | 已有 server 监听 0 端口（占用） |
| 步骤 | 1. listen(app, occupiedPort) |
| 预期 | `expect(promise).rejects.toThrow(/EADDRINUSE/)` |
| 优先级 | 中 |

### TC-UNIT-003B Server.listen 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-003B |
| 类型 | 边界 |
| 关联 DD | DD-001-003 |
| 场景 | 端口号 65535（最大值）边界 |
| 前置条件 | 无 |
| 步骤 | 1. listen(app, 65535) |
| 预期 | `expect(server.listening).toBe(true)` |
| 优先级 | 低 |

## §3 SD-002 用户注册（3 用例）

### TC-UNIT-004N UserController.register 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-004N |
| 类型 | 正常 |
| 关联 DD | DD-002-001 |
| 场景 | 合法请求体返回 201 + 用户对象 |
| 前置条件 | mock UserService.createUser 返回用户 |
| 步骤 | 1. 构造 req={body:{email,password,role}}；2. 调用 register(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(201)`；passwordHash 不在响应中 |
| 优先级 | 高 |

### TC-UNIT-004E UserController.register 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-004E |
| 类型 | 异常 |
| 关联 DD | DD-002-001 |
| 场景 | Service 抛 ConflictError（邮箱已存在）→ next(err) |
| 前置条件 | mock createUser 抛 ConflictError |
| 步骤 | 1. 调用 register(req,res,next)；2. 捕获 next 调用 |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ConflictError))` |
| 优先级 | 高 |

### TC-UNIT-004B UserController.register 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-004B |
| 类型 | 边界 |
| 关联 DD | DD-002-001 |
| 场景 | 请求体 null（zod 解析失败） |
| 前置条件 | 无 |
| 步骤 | 1. req.body=null；2. 调用 register |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-005N UserService.createUser 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-005N |
| 类型 | 正常 |
| 关联 DD | DD-002-002 |
| 场景 | 新邮箱 + 强密码 → 哈希存储 + 返回用户 |
| 前置条件 | mock UserStore.findByEmail 返回 null |
| 步骤 | 1. createUser({email,password,role}) |
| 预期 | `expect(user.id).toMatch(uuid)`；`expect(user.passwordHash).not.toBe(password)`；`expect(bcrypt.compareSync(password,user.passwordHash)).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-005E UserService.createUser 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-005E |
| 类型 | 异常 |
| 关联 DD | DD-002-002 |
| 场景 | 邮箱已存在抛 ConflictError |
| 前置条件 | mock findByEmail 返回已存在用户 |
| 步骤 | 1. createUser({email,...}) |
| 预期 | `expect(() => userService.createUser(...)).toThrow(ConflictError)` |
| 优先级 | 高 |

### TC-UNIT-005B UserService.createUser 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-005B |
| 类型 | 边界 |
| 关联 DD | DD-002-002 |
| 场景 | 密码长度边界（min=8, max=128） |
| 前置条件 | 无 |
| 步骤 | 1. password="1234567"（7 字符）；2. password="12345678"（8 字符） |
| 预期 | 7 字符：`expect(() => createUser(...)).rejects.toThrow(ZodError)`；8 字符：成功 |
| 优先级 | 中 |

### TC-UNIT-006N UserStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-006N |
| 类型 | 正常 |
| 关联 DD | DD-002-003 |
| 场景 | save + findById 往返 |
| 前置条件 | 无 |
| 步骤 | 1. userStore.save(user)；2. userStore.findById(user.id) |
| 预期 | `expect(found).toEqual(user)` |
| 优先级 | 高 |

### TC-UNIT-006E UserStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-006E |
| 类型 | 异常 |
| 关联 DD | DD-002-003 |
| 场景 | findById 不存在返回 null |
| 前置条件 | 空 store |
| 步骤 | 1. findById("nonexistent") |
| 预期 | `expect(result).toBeNull()` |
| 优先级 | 中 |

### TC-UNIT-006B UserStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-006B |
| 类型 | 边界 |
| 关联 DD | DD-002-003 |
| 场景 | 单表 10000 条记录（NFR-004 容量上限） |
| 前置条件 | 无 |
| 步骤 | 1. 循环 save 10000 个用户；2. count() |
| 预期 | `expect(userStore.count()).toBe(10000)`；查询 P95 < 200ms |
| 优先级 | 高 |

## §4 SD-003 用户登录（3 用例）

### TC-UNIT-007N UserController.login 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-007N |
| 类型 | 正常 |
| 关联 DD | DD-003-001 |
| 场景 | 正确凭据返回 200 + token |
| 前置条件 | mock AuthService.login 返回 token |
| 步骤 | 1. req.body={email,password}；2. login(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)`；`expect(res.json).toHaveBeenCalledWith({token,expiresIn:3600})` |
| 优先级 | 高 |

### TC-UNIT-007E UserController.login 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-007E |
| 类型 | 异常 |
| 关联 DD | DD-003-001 |
| 场景 | 凭据无效抛 UnauthorizedError |
| 前置条件 | mock login 抛 UnauthorizedError |
| 步骤 | 1. login(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))` |
| 优先级 | 高 |

### TC-UNIT-007B UserController.login 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-007B |
| 类型 | 边界 |
| 关联 DD | DD-003-001 |
| 场景 | email 格式非法（zod 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. req.body={email:"not-an-email",password} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-008N AuthService.login 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-008N |
| 类型 | 正常 |
| 关联 DD | DD-003-002 |
| 场景 | 正确密码 + 失败计数清零 + 签发 JWT |
| 前置条件 | mock UserStore.findByEmail 返回用户；失败计数=2 |
| 步骤 | 1. login(email,password) |
| 预期 | `expect(jwt.decode(token).sub).toBe(user.id)`；`expect(failureCounter.get(email)).toBe(0)` |
| 优先级 | 高 |

### TC-UNIT-008E AuthService.login 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-008E |
| 类型 | 异常 |
| 关联 DD | DD-003-002 |
| 场景 | 失败计数 ≥ 5 抛 TooManyRequestsError（429） |
| 前置条件 | 失败计数=5 |
| 步骤 | 1. login(email,password) |
| 预期 | `expect(() => authService.login(...)).toThrow(TooManyRequestsError)` |
| 优先级 | 高 |

### TC-UNIT-008B AuthService.login 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-008B |
| 类型 | 边界 |
| 关联 DD | DD-003-002 |
| 场景 | 失败计数=4（临界值），再失败一次触发锁定 |
| 前置条件 | 失败计数=4 |
| 步骤 | 1. login(email, wrongPassword) |
| 预期 | 失败计数变 5；下一次 login 抛 429 |
| 优先级 | 高 |

### TC-UNIT-009N LoginRateLimiter 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-009N |
| 类型 | 正常 |
| 关联 DD | DD-003-003 |
| 场景 | 失败计数 < 5 时允许登录 |
| 前置条件 | 失败计数=0 |
| 步骤 | 1. check(email) |
| 预期 | `expect(rateLimiter.check(email)).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-009E LoginRateLimiter 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-009E |
| 类型 | 异常 |
| 关联 DD | DD-003-003 |
| 场景 | 失败计数 ≥ 5 抛错 |
| 前置条件 | 失败计数=5 |
| 步骤 | 1. check(email) |
| 预期 | `expect(() => rateLimiter.check(email)).toThrow(TooManyRequestsError)` |
| 优先级 | 高 |

### TC-UNIT-009B LoginRateLimiter 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-009B |
| 类型 | 边界 |
| 关联 DD | DD-003-003 |
| 场景 | 15 分钟窗口滑出后计数重置 |
| 前置条件 | 失败计数=5；模拟时间前进 16 分钟 |
| 步骤 | 1. vi.useFakeTimers()；2. vi.advanceTimersByTime(16*60*1000)；3. check(email) |
| 预期 | `expect(rateLimiter.check(email)).toBe(true)`；计数重置为 0 |
| 优先级 | 中 |

## §5 SD-004 角色权限（3 用例）

### TC-UNIT-010N AuthMiddleware.requireRole 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-010N |
| 类型 | 正常 |
| 关联 DD | DD-004-001 |
| 场景 | author token 访问 admin/author 资源通过 |
| 前置条件 | req.user.role="author" |
| 步骤 | 1. requireRole(["admin","author"])(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith()`（无错误） |
| 优先级 | 高 |

### TC-UNIT-010E AuthMiddleware.requireRole 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-010E |
| 类型 | 异常 |
| 关联 DD | DD-004-001 |
| 场景 | reader 访问 admin 资源抛 ForbiddenError |
| 前置条件 | req.user.role="reader" |
| 步骤 | 1. requireRole(["admin"])(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))` |
| 优先级 | 高 |

### TC-UNIT-010B AuthMiddleware.requireRole 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-010B |
| 类型 | 边界 |
| 关联 DD | DD-004-001 |
| 场景 | 空角色列表（拒绝所有） |
| 前置条件 | req.user.role="admin" |
| 步骤 | 1. requireRole([])(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))` |
| 优先级 | 中 |

### TC-UNIT-011N RbacService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-011N |
| 类型 | 正常 |
| 关联 DD | DD-004-002 |
| 场景 | admin 角色拥有全部权限 |
| 前置条件 | 无 |
| 步骤 | 1. can("admin","article","delete") |
| 预期 | `expect(rbacService.can("admin","article","delete")).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-011E RbacService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-011E |
| 类型 | 异常 |
| 关联 DD | DD-004-002 |
| 场景 | reader 删除文章被拒绝 |
| 前置条件 | 无 |
| 步骤 | 1. can("reader","article","delete") |
| 预期 | `expect(rbacService.can("reader","article","delete")).toBe(false)` |
| 优先级 | 高 |

### TC-UNIT-011B RbacService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-011B |
| 类型 | 边界 |
| 关联 DD | DD-004-002 |
| 场景 | 未知角色（默认拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. can("unknown","article","read") |
| 预期 | `expect(rbacService.can("unknown","article","read")).toBe(false)` |
| 优先级 | 中 |

### TC-UNIT-012N JwtUtil.sign/verify 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-012N |
| 类型 | 正常 |
| 关联 DD | DD-004-003 |
| 场景 | sign 后 verify 还原 payload |
| 前置条件 | JWT_SECRET 设置 |
| 步骤 | 1. token=JwtUtil.sign({sub:"u1",role:"admin"},3600)；2. payload=JwtUtil.verify(token) |
| 预期 | `expect(payload.sub).toBe("u1")`；`expect(payload.role).toBe("admin")` |
| 优先级 | 高 |

### TC-UNIT-012E JwtUtil.verify 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-012E |
| 类型 | 异常 |
| 关联 DD | DD-004-003 |
| 场景 | 篡改 token 抛 JsonWebTokenError |
| 前置条件 | 无 |
| 步骤 | 1. tampered=token+"x"；2. verify(tampered) |
| 预期 | `expect(() => JwtUtil.verify(tampered)).toThrow()` |
| 优先级 | 高 |

### TC-UNIT-012B JwtUtil.verify 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-012B |
| 类型 | 边界 |
| 关联 DD | DD-004-003 |
| 场景 | token 过期抛 TokenExpiredError |
| 前置条件 | 无 |
| 步骤 | 1. token=sign({sub:"u1"},-1)（已过期）；2. verify(token) |
| 预期 | `expect(() => JwtUtil.verify(token)).toThrow(TokenExpiredError)` |
| 优先级 | 高 |

## §6 SD-005 文章创建（4 用例）

### TC-UNIT-013N ArticleController.create 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-013N |
| 类型 | 正常 |
| 关联 DD | DD-005-001 |
| 场景 | 合法请求返回 201 + 文章对象 |
| 前置条件 | mock ArticleService.create 返回文章 |
| 步骤 | 1. req.body={title,content,tagIds,categoryId}；2. create(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(201)`；status="draft" |
| 优先级 | 高 |

### TC-UNIT-013E ArticleController.create 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-013E |
| 类型 | 异常 |
| 关联 DD | DD-005-001 |
| 场景 | 分类不存在抛 NotFoundError |
| 前置条件 | mock create 抛 NotFoundError |
| 步骤 | 1. create(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 高 |

### TC-UNIT-013B ArticleController.create 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-013B |
| 类型 | 边界 |
| 关联 DD | DD-005-001 |
| 场景 | title 空字符串（zod 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. req.body={title:"",content,...} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-014N ArticleService.create 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-014N |
| 类型 | 正常 |
| 关联 DD | DD-005-002 |
| 场景 | 新文章创建 + 标签/分类校验 + 审计日志触发 |
| 前置条件 | mock TagStore.find + CategoryStore.find 返回存在；mock AuditService.log |
| 步骤 | 1. create({title,content,tagIds,categoryId,authorId}) |
| 预期 | `expect(article.id).toMatch(uuid)`；`expect(article.status).toBe("draft")`；`expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({action:"article.create"}))` |
| 优先级 | 高 |

### TC-UNIT-014E ArticleService.create 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-014E |
| 类型 | 异常 |
| 关联 DD | DD-005-002 |
| 场景 | tagId 不存在抛 NotFoundError |
| 前置条件 | mock TagStore.find 返回 null |
| 步骤 | 1. create(...) |
| 预期 | `expect(() => articleService.create(...)).toThrow(NotFoundError)` |
| 优先级 | 高 |

### TC-UNIT-014B ArticleService.create 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-014B |
| 类型 | 边界 |
| 关联 DD | DD-005-002 |
| 场景 | tagIds 数组为空（合法）vs null（zod 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. tagIds=[]；2. tagIds=null |
| 预期 | 空数组：成功；null：`expect(() => create(...)).toThrow(ZodError)` |
| 优先级 | 中 |

### TC-UNIT-015N ArticleStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-015N |
| 类型 | 正常 |
| 关联 DD | DD-005-003 |
| 场景 | save + findById 往返 |
| 前置条件 | 无 |
| 步骤 | 1. save(article)；2. findById(article.id) |
| 预期 | `expect(found).toEqual(article)` |
| 优先级 | 高 |

### TC-UNIT-015E ArticleStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-015E |
| 类型 | 异常 |
| 关联 DD | DD-005-003 |
| 场景 | 重复 id save 抛 ConflictError |
| 前置条件 | 已 save 同 id 文章 |
| 步骤 | 1. save(sameArticle) |
| 预期 | `expect(() => articleStore.save(sameArticle)).toThrow(ConflictError)` |
| 优先级 | 中 |

### TC-UNIT-015B ArticleStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-015B |
| 类型 | 边界 |
| 关联 DD | DD-005-003 |
| 场景 | 单表 10000 条（NFR-004） |
| 前置条件 | 无 |
| 步骤 | 1. 循环 save 10000 篇；2. count() |
| 预期 | `expect(articleStore.count()).toBe(10000)` |
| 优先级 | 高 |

### TC-UNIT-016N ArticleValidator 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-016N |
| 类型 | 正常 |
| 关联 DD | DD-005-004 |
| 场景 | 合法输入 parse 成功 |
| 前置条件 | 无 |
| 步骤 | 1. ArticleValidator.parse({title:"T",content:"C",tagIds:[],categoryId:"c1"}) |
| 预期 | `expect(parsed.title).toBe("T")` |
| 优先级 | 高 |

### TC-UNIT-016E ArticleValidator 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-016E |
| 类型 | 异常 |
| 关联 DD | DD-005-004 |
| 场景 | 缺少必填字段 content 抛 ZodError |
| 前置条件 | 无 |
| 步骤 | 1. parse({title:"T"}) |
| 预期 | `expect(() => ArticleValidator.parse(...)).toThrow(ZodError)` |
| 优先级 | 高 |

### TC-UNIT-016B ArticleValidator 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-016B |
| 类型 | 边界 |
| 关联 DD | DD-005-004 |
| 场景 | title 长度边界（min=1, max=200） |
| 前置条件 | 无 |
| 步骤 | 1. title="a".repeat(200)；2. title="a".repeat(201) |
| 预期 | 200：成功；201：`expect(() => parse(...)).toThrow(ZodError)` |
| 优先级 | 中 |

## §7 SD-006 文章列表查询（3 用例）

### TC-UNIT-017N ArticleController.list 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-017N |
| 类型 | 正常 |
| 关联 DD | DD-006-001 |
| 场景 | 默认分页返回 200 |
| 前置条件 | mock ArticleService.list 返回分页结果 |
| 步骤 | 1. req.query={page:1,limit:20}；2. list(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)`；`expect(res.json).toHaveBeenCalledWith({items,total,page,limit})` |
| 优先级 | 高 |

### TC-UNIT-017E ArticleController.list 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-017E |
| 类型 | 异常 |
| 关联 DD | DD-006-001 |
| 场景 | limit 超过 100（zod 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. req.query={limit:101} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-017B ArticleController.list 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-017B |
| 类型 | 边界 |
| 关联 DD | DD-006-001 |
| 场景 | page=0（越界，zod min=1 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. req.query={page:0} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-018N ArticleService.list 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-018N |
| 类型 | 正常 |
| 关联 DD | DD-006-002 |
| 场景 | 排序 + 分页过滤 |
| 前置条件 | mock ArticleStore.values 返回 25 篇 |
| 步骤 | 1. list({page:1,limit:20,sort:"createdAt",order:"desc"}) |
| 预期 | `expect(result.items.length).toBe(20)`；`expect(result.total).toBe(25)` |
| 优先级 | 高 |

### TC-UNIT-018E ArticleService.list 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-018E |
| 类型 | 异常 |
| 关联 DD | DD-006-002 |
| 场景 | sort 字段非法（非白名单） |
| 前置条件 | 无 |
| 步骤 | 1. list({sort:"unknown"}) |
| 预期 | `expect(() => articleService.list(...)).toThrow(ZodError)` |
| 优先级 | 中 |

### TC-UNIT-018B ArticleService.list 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-018B |
| 类型 | 边界 |
| 关联 DD | DD-006-002 |
| 场景 | 空表查询返回空 items |
| 前置条件 | mock values 返回 [] |
| 步骤 | 1. list({page:1,limit:20}) |
| 预期 | `expect(result.items).toEqual([])`；`expect(result.total).toBe(0)` |
| 优先级 | 中 |

### TC-UNIT-019N PaginationUtil 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-019N |
| 类型 | 正常 |
| 关联 DD | DD-006-003 |
| 场景 | 计算分页元数据 |
| 前置条件 | 无 |
| 步骤 | 1. PaginationUtil.meta(25,1,20) |
| 预期 | `expect(meta).toEqual({page:1,limit:20,total:25,totalPages:2,hasNext:true,hasPrev:false})` |
| 优先级 | 高 |

### TC-UNIT-019E PaginationUtil 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-019E |
| 类型 | 异常 |
| 关联 DD | DD-006-003 |
| 场景 | total 为负数抛 ValueError |
| 前置条件 | 无 |
| 步骤 | 1. PaginationUtil.meta(-1,1,20) |
| 预期 | `expect(() => PaginationUtil.meta(-1,1,20)).toThrow()` |
| 优先级 | 低 |

### TC-UNIT-019B PaginationUtil 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-019B |
| 类型 | 边界 |
| 关联 DD | DD-006-003 |
| 场景 | total=0（空结果） |
| 前置条件 | 无 |
| 步骤 | 1. PaginationUtil.meta(0,1,20) |
| 预期 | `expect(meta.totalPages).toBe(0)`；`hasNext=false`；`hasPrev=false` |
| 优先级 | 中 |

## §8 SD-007 文章详情查询（3 用例）

### TC-UNIT-020N ArticleController.getById 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-020N |
| 类型 | 正常 |
| 关联 DD | DD-007-001 |
| 场景 | 已发布文章返回 200 |
| 前置条件 | mock getById 返回文章 |
| 步骤 | 1. req.params.id="a1"；2. getById(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)` |
| 优先级 | 高 |

### TC-UNIT-020E ArticleController.getById 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-020E |
| 类型 | 异常 |
| 关联 DD | DD-007-001 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock getById 抛 NotFoundError |
| 步骤 | 1. getById(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 高 |

### TC-UNIT-020B ArticleController.getById 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-020B |
| 类型 | 边界 |
| 关联 DD | DD-007-001 |
| 场景 | id 非 UUID 格式（zod 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. req.params.id="not-uuid" |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-021N ArticleService.getById 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-021N |
| 类型 | 正常 |
| 关联 DD | DD-007-002 |
| 场景 | 已发布文章任何人可查 |
| 前置条件 | mock ArticleStore.findById 返回 status="published" 文章 |
| 步骤 | 1. getById("a1",userId="u2") |
| 预期 | `expect(article.id).toBe("a1")` |
| 优先级 | 高 |

### TC-UNIT-021E ArticleService.getById 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-021E |
| 类型 | 异常 |
| 关联 DD | DD-007-002 |
| 场景 | 草稿文章非作者访问抛 ForbiddenError |
| 前置条件 | mock findById 返回 status="draft", authorId="u1" |
| 步骤 | 1. getById("a1","u2") |
| 预期 | `expect(() => articleService.getById("a1","u2")).toThrow(ForbiddenError)` |
| 优先级 | 高 |

### TC-UNIT-021B ArticleService.getById 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-021B |
| 类型 | 边界 |
| 关联 DD | DD-007-002 |
| 场景 | 草稿文章作者本人可查 |
| 前置条件 | mock findById 返回 status="draft", authorId="u1" |
| 步骤 | 1. getById("a1","u1") |
| 预期 | `expect(article.id).toBe("a1")` |
| 优先级 | 中 |

### TC-UNIT-022N ArticleVisibilityChecker 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-022N |
| 类型 | 正常 |
| 关联 DD | DD-007-003 |
| 场景 | published 文章对所有人可见 |
| 前置条件 | 无 |
| 步骤 | 1. canView(article={status:"published",authorId:"u1"},userId="u2") |
| 预期 | `expect(canView).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-022E ArticleVisibilityChecker 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-022E |
| 类型 | 异常 |
| 关联 DD | DD-007-003 |
| 场景 | draft 文章非作者不可见 |
| 前置条件 | 无 |
| 步骤 | 1. canView({status:"draft",authorId:"u1"},"u2") |
| 预期 | `expect(canView).toBe(false)` |
| 优先级 | 高 |

### TC-UNIT-022B ArticleVisibilityChecker 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-022B |
| 类型 | 边界 |
| 关联 DD | DD-007-003 |
| 场景 | admin 角色访问任意草稿可见 |
| 前置条件 | 无 |
| 步骤 | 1. canView({status:"draft",authorId:"u1"},"u2",role="admin") |
| 预期 | `expect(canView).toBe(true)` |
| 优先级 | 中 |

## §9 SD-008 文章更新（3 用例）

### TC-UNIT-023N ArticleController.update 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-023N |
| 类型 | 正常 |
| 关联 DD | DD-008-001 |
| 场景 | 部分更新返回 200 |
| 前置条件 | mock update 返回更新后文章 |
| 步骤 | 1. req.params.id="a1"；req.body={title:"New"}；2. update(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({title:"New"}))` |
| 优先级 | 高 |

### TC-UNIT-023E ArticleController.update 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-023E |
| 类型 | 异常 |
| 关联 DD | DD-008-001 |
| 场景 | 非作者非 admin 抛 ForbiddenError |
| 前置条件 | mock update 抛 ForbiddenError |
| 步骤 | 1. update(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))` |
| 优先级 | 高 |

### TC-UNIT-023B ArticleController.update 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-023B |
| 类型 | 边界 |
| 关联 DD | DD-008-001 |
| 场景 | 空请求体（无字段更新） |
| 前置条件 | 无 |
| 步骤 | 1. req.body={} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))`（至少 1 字段） |
| 优先级 | 中 |

### TC-UNIT-024N ArticleService.update 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-024N |
| 类型 | 正常 |
| 关联 DD | DD-008-002 |
| 场景 | 浅合并 + updatedAt 刷新 + 审计触发 |
| 前置条件 | mock findById 返回文章（authorId=req.user.id） |
| 步骤 | 1. update("a1",{title:"New"},userId="u1") |
| 预期 | `expect(article.title).toBe("New")`；`expect(article.updatedAt).not.toBe(oldUpdatedAt)`；`expect(auditService.log).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-024E ArticleService.update 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-024E |
| 类型 | 异常 |
| 关联 DD | DD-008-002 |
| 场景 | 非作者非 admin 抛 ForbiddenError |
| 前置条件 | mock findById 返回 authorId="u2" |
| 步骤 | 1. update("a1",{title:"New"},userId="u1",role="reader") |
| 预期 | `expect(() => articleService.update(...)).toThrow(ForbiddenError)` |
| 优先级 | 高 |

### TC-UNIT-024B ArticleService.update 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-024B |
| 类型 | 边界 |
| 关联 DD | DD-008-002 |
| 场景 | admin 更新他人文章（所有权豁免） |
| 前置条件 | mock findById 返回 authorId="u2" |
| 步骤 | 1. update("a1",{title:"New"},userId="u1",role="admin") |
| 预期 | 成功更新 |
| 优先级 | 中 |

### TC-UNIT-025N OwnershipChecker 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-025N |
| 类型 | 正常 |
| 关联 DD | DD-008-003 |
| 场景 | 作者本人通过 |
| 前置条件 | 无 |
| 步骤 | 1. check({authorId:"u1"},userId="u1",role="author") |
| 预期 | `expect(check).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-025E OwnershipChecker 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-025E |
| 类型 | 异常 |
| 关联 DD | DD-008-003 |
| 场景 | 非作者非 admin 拒绝 |
| 前置条件 | 无 |
| 步骤 | 1. check({authorId:"u1"},userId="u2",role="reader") |
| 预期 | `expect(check).toBe(false)` |
| 优先级 | 高 |

### TC-UNIT-025B OwnershipChecker 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-025B |
| 类型 | 边界 |
| 关联 DD | DD-008-003 |
| 场景 | admin 角色豁免所有权 |
| 前置条件 | 无 |
| 步骤 | 1. check({authorId:"u1"},userId="u3",role="admin") |
| 预期 | `expect(check).toBe(true)` |
| 优先级 | 中 |

## §10 SD-009 文章删除（3 用例）

### TC-UNIT-026N ArticleController.remove 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-026N |
| 类型 | 正常 |
| 关联 DD | DD-009-001 |
| 场景 | 删除成功返回 204 |
| 前置条件 | mock remove 成功 |
| 步骤 | 1. req.params.id="a1"；2. remove(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(204)` |
| 优先级 | 高 |

### TC-UNIT-026E ArticleController.remove 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-026E |
| 类型 | 异常 |
| 关联 DD | DD-009-001 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock remove 抛 NotFoundError |
| 步骤 | 1. remove(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 高 |

### TC-UNIT-026B ArticleController.remove 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-026B |
| 类型 | 边界 |
| 关联 DD | DD-009-001 |
| 场景 | id 为空字符串 |
| 前置条件 | 无 |
| 步骤 | 1. req.params.id="" |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 低 |

### TC-UNIT-027N ArticleService.remove 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-027N |
| 类型 | 正常 |
| 关联 DD | DD-009-002 |
| 场景 | 删除 + 级联删除评论 + 审计触发 |
| 前置条件 | mock ArticleStore + CommentStore |
| 步骤 | 1. remove("a1",userId="u1",role="author") |
| 预期 | `expect(articleStore.delete).toHaveBeenCalledWith("a1")`；`expect(commentStore.deleteByArticle).toHaveBeenCalledWith("a1")`；`expect(auditService.log).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-027E ArticleService.remove 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-027E |
| 类型 | 异常 |
| 关联 DD | DD-009-002 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock findById 返回 null |
| 步骤 | 1. remove("nonexistent",...) |
| 预期 | `expect(() => articleService.remove(...)).toThrow(NotFoundError)` |
| 优先级 | 高 |

### TC-UNIT-027B ArticleService.remove 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-027B |
| 类型 | 边界 |
| 关联 DD | DD-009-002 |
| 场景 | 删除文章后关联评论全部清理（无残留） |
| 前置条件 | mock 5 条评论 |
| 步骤 | 1. remove("a1",...)；2. commentStore.findByArticle("a1") |
| 预期 | `expect(commentStore.findByArticle("a1")).toEqual([])` |
| 优先级 | 高 |

### TC-UNIT-028N CommentCascadeDeleter 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-028N |
| 类型 | 正常 |
| 关联 DD | DD-009-003 |
| 场景 | 级联删除指定文章所有评论 |
| 前置条件 | mock CommentStore 5 条评论 |
| 步骤 | 1. cascade("a1") |
| 预期 | `expect(commentStore.deleteByArticle).toHaveBeenCalledWith("a1")` |
| 优先级 | 高 |

### TC-UNIT-028E CommentCascadeDeleter 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-028E |
| 类型 | 异常 |
| 关联 DD | DD-009-003 |
| 场景 | Store 抛错时回滚或传播 |
| 前置条件 | mock deleteByArticle 抛 Error |
| 步骤 | 1. cascade("a1") |
| 预期 | `expect(() => cascade("a1")).toThrow()` |
| 优先级 | 中 |

### TC-UNIT-028B CommentCascadeDeleter 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-028B |
| 类型 | 边界 |
| 关联 DD | DD-009-003 |
| 场景 | 文章无评论时级联无操作 |
| 前置条件 | mock findByArticle 返回 [] |
| 步骤 | 1. cascade("a1") |
| 预期 | `expect(commentStore.deleteByArticle).not.toHaveBeenCalled()` 或调用但删除 0 条 |
| 优先级 | 中 |

## §11 SD-010 评论创建（3 用例）

### TC-UNIT-029N CommentController.create 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-029N |
| 类型 | 正常 |
| 关联 DD | DD-010-001 |
| 场景 | 合法请求返回 201 |
| 前置条件 | mock CommentService.create 返回评论 |
| 步骤 | 1. req.params.id="a1"；req.body={content:"C"}；2. create(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(201)` |
| 优先级 | 高 |

### TC-UNIT-029E CommentController.create 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-029E |
| 类型 | 异常 |
| 关联 DD | DD-010-001 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock create 抛 NotFoundError |
| 步骤 | 1. create(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 高 |

### TC-UNIT-029B CommentController.create 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-029B |
| 类型 | 边界 |
| 关联 DD | DD-010-001 |
| 场景 | content 长度边界（max=1000） |
| 前置条件 | 无 |
| 步骤 | 1. content="a".repeat(1000)；2. content="a".repeat(1001) |
| 预期 | 1000：成功；1001：ZodError |
| 优先级 | 中 |

### TC-UNIT-030N CommentService.create 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-030N |
| 类型 | 正常 |
| 关联 DD | DD-010-002 |
| 场景 | 文章存在 + 用户存在 → 创建评论 |
| 前置条件 | mock ArticleStore + UserStore 返回存在 |
| 步骤 | 1. create({articleId:"a1",userId:"u1",content:"C"}) |
| 预期 | `expect(comment.id).toMatch(uuid)`；`expect(comment.articleId).toBe("a1")` |
| 优先级 | 高 |

### TC-UNIT-030E CommentService.create 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-030E |
| 类型 | 异常 |
| 关联 DD | DD-010-002 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock ArticleStore.findById 返回 null |
| 步骤 | 1. create(...) |
| 预期 | `expect(() => commentService.create(...)).toThrow(NotFoundError)` |
| 优先级 | 高 |

### TC-UNIT-030B CommentService.create 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-030B |
| 类型 | 边界 |
| 关联 DD | DD-010-002 |
| 场景 | content 为空字符串 |
| 前置条件 | 无 |
| 步骤 | 1. content="" |
| 预期 | `expect(() => create(...)).toThrow(ZodError)` |
| 优先级 | 中 |

### TC-UNIT-031N CommentStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-031N |
| 类型 | 正常 |
| 关联 DD | DD-010-003 |
| 场景 | save + findById 往返 |
| 前置条件 | 无 |
| 步骤 | 1. save(comment)；2. findById(comment.id) |
| 预期 | `expect(found).toEqual(comment)` |
| 优先级 | 高 |

### TC-UNIT-031E CommentStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-031E |
| 类型 | 异常 |
| 关联 DD | DD-010-003 |
| 场景 | deleteByArticle 删除指定文章全部评论 |
| 前置条件 | 5 条评论（3 条 articleId="a1"） |
| 步骤 | 1. deleteByArticle("a1")；2. list() |
| 预期 | `expect(commentStore.list().length).toBe(2)` |
| 优先级 | 高 |

### TC-UNIT-031B CommentStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-031B |
| 类型 | 边界 |
| 关联 DD | DD-010-003 |
| 场景 | 单表 10000 条评论（NFR-004） |
| 前置条件 | 无 |
| 步骤 | 1. 循环 save 10000 条；2. count() |
| 预期 | `expect(commentStore.count()).toBe(10000)` |
| 优先级 | 中 |

## §12 SD-011 评论列表查询（3 用例）

### TC-UNIT-032N CommentController.listByArticle 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-032N |
| 类型 | 正常 |
| 关联 DD | DD-011-001 |
| 场景 | 分页返回评论列表 |
| 前置条件 | mock listByArticle 返回分页结果 |
| 步骤 | 1. req.params.id="a1"；req.query={page:1,limit:20}；2. listByArticle(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)` |
| 优先级 | 高 |

### TC-UNIT-032E CommentController.listByArticle 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-032E |
| 类型 | 异常 |
| 关联 DD | DD-011-001 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock listByArticle 抛 NotFoundError |
| 步骤 | 1. listByArticle(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 中 |

### TC-UNIT-032B CommentController.listByArticle 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-032B |
| 类型 | 边界 |
| 关联 DD | DD-011-001 |
| 场景 | limit 超过 100 |
| 前置条件 | 无 |
| 步骤 | 1. req.query={limit:101} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-033N CommentService.listByArticle 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-033N |
| 类型 | 正常 |
| 关联 DD | DD-011-002 |
| 场景 | 按文章过滤 + 分页 |
| 前置条件 | mock CommentStore 25 条评论（articleId="a1"） |
| 步骤 | 1. listByArticle("a1",{page:1,limit:20}) |
| 预期 | `expect(result.items.length).toBe(20)`；`expect(result.total).toBe(25)` |
| 优先级 | 高 |

### TC-UNIT-033E CommentService.listByArticle 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-033E |
| 类型 | 异常 |
| 关联 DD | DD-011-002 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock ArticleStore.findById 返回 null |
| 步骤 | 1. listByArticle("nonexistent",...) |
| 预期 | `expect(() => listByArticle(...)).toThrow(NotFoundError)` |
| 优先级 | 中 |

### TC-UNIT-033B CommentService.listByArticle 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-033B |
| 类型 | 边界 |
| 关联 DD | DD-011-002 |
| 场景 | 文章无评论返回空列表 |
| 前置条件 | mock 返回 [] |
| 步骤 | 1. listByArticle("a1",...) |
| 预期 | `expect(result.items).toEqual([])`；`expect(result.total).toBe(0)` |
| 优先级 | 中 |

### TC-UNIT-034N CommentValidator 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-034N |
| 类型 | 正常 |
| 关联 DD | DD-011-003 |
| 场景 | 合法 content parse 成功 |
| 前置条件 | 无 |
| 步骤 | 1. CommentValidator.parse({content:"Hello"}) |
| 预期 | `expect(parsed.content).toBe("Hello")` |
| 优先级 | 高 |

### TC-UNIT-034E CommentValidator 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-034E |
| 类型 | 异常 |
| 关联 DD | DD-011-003 |
| 场景 | content 超 1000 字符抛 ZodError |
| 前置条件 | 无 |
| 步骤 | 1. parse({content:"a".repeat(1001)}) |
| 预期 | `expect(() => CommentValidator.parse(...)).toThrow(ZodError)` |
| 优先级 | 高 |

### TC-UNIT-034B CommentValidator 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-034B |
| 类型 | 边界 |
| 关联 DD | DD-011-003 |
| 场景 | content 类型不符（数字） |
| 前置条件 | 无 |
| 步骤 | 1. parse({content:123}) |
| 预期 | `expect(() => CommentValidator.parse(...)).toThrow(ZodError)` |
| 优先级 | 中 |

## §13 SD-012 评论删除（3 用例）

### TC-UNIT-035N CommentController.remove 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-035N |
| 类型 | 正常 |
| 关联 DD | DD-012-001 |
| 场景 | 删除成功返回 204 |
| 前置条件 | mock remove 成功 |
| 步骤 | 1. req.params.id="c1"；2. remove(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(204)` |
| 优先级 | 高 |

### TC-UNIT-035E CommentController.remove 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-035E |
| 类型 | 异常 |
| 关联 DD | DD-012-001 |
| 场景 | 非作者非 admin 抛 ForbiddenError |
| 前置条件 | mock remove 抛 ForbiddenError |
| 步骤 | 1. remove(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))` |
| 优先级 | 高 |

### TC-UNIT-035B CommentController.remove 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-035B |
| 类型 | 边界 |
| 关联 DD | DD-012-001 |
| 场景 | id 非 UUID 格式 |
| 前置条件 | 无 |
| 步骤 | 1. req.params.id="not-uuid" |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-036N CommentService.remove 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-036N |
| 类型 | 正常 |
| 关联 DD | DD-012-002 |
| 场景 | 作者本人删除 + 审计触发 |
| 前置条件 | mock findById 返回评论（userId="u1"） |
| 步骤 | 1. remove("c1",userId="u1",role="author") |
| 预期 | `expect(commentStore.delete).toHaveBeenCalledWith("c1")`；`expect(auditService.log).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-036E CommentService.remove 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-036E |
| 类型 | 异常 |
| 关联 DD | DD-012-002 |
| 场景 | 评论不存在抛 NotFoundError |
| 前置条件 | mock findById 返回 null |
| 步骤 | 1. remove("nonexistent",...) |
| 预期 | `expect(() => commentService.remove(...)).toThrow(NotFoundError)` |
| 优先级 | 高 |

### TC-UNIT-036B CommentService.remove 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-036B |
| 类型 | 边界 |
| 关联 DD | DD-012-002 |
| 场景 | admin 删除他人评论 |
| 前置条件 | mock findById 返回 userId="u2" |
| 步骤 | 1. remove("c1",userId="u1",role="admin") |
| 预期 | 成功删除 |
| 优先级 | 中 |

### TC-UNIT-037N CommentOwnershipChecker 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-037N |
| 类型 | 正常 |
| 关联 DD | DD-012-003 |
| 场景 | 评论作者通过 |
| 前置条件 | 无 |
| 步骤 | 1. check({userId:"u1"},userId="u1",role="reader") |
| 预期 | `expect(check).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-037E CommentOwnershipChecker 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-037E |
| 类型 | 异常 |
| 关联 DD | DD-012-003 |
| 场景 | 非作者非 admin 拒绝 |
| 前置条件 | 无 |
| 步骤 | 1. check({userId:"u1"},userId="u2",role="reader") |
| 预期 | `expect(check).toBe(false)` |
| 优先级 | 高 |

### TC-UNIT-037B CommentOwnershipChecker 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-037B |
| 类型 | 边界 |
| 关联 DD | DD-012-003 |
| 场景 | admin 豁免所有权 |
| 前置条件 | 无 |
| 步骤 | 1. check({userId:"u1"},userId="u3",role="admin") |
| 预期 | `expect(check).toBe(true)` |
| 优先级 | 中 |

## §14 SD-013 标签管理（3 用例）

### TC-UNIT-038N TagController CRUD 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-038N |
| 类型 | 正常 |
| 关联 DD | DD-013-001 |
| 场景 | list + create + update + remove 全流程 |
| 前置条件 | mock TagService |
| 步骤 | 1. list(req,res)；2. create(req,res)；3. update(req,res)；4. remove(req,res) |
| 预期 | `expect(res.status).toHaveBeenNthCalledWith(1,200)`；(2,201)；(3,200)；(4,204) |
| 优先级 | 高 |

### TC-UNIT-038E TagController 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-038E |
| 类型 | 异常 |
| 关联 DD | DD-013-001 |
| 场景 | name 重复抛 ConflictError |
| 前置条件 | mock create 抛 ConflictError |
| 步骤 | 1. create(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ConflictError))` |
| 优先级 | 高 |

### TC-UNIT-038B TagController 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-038B |
| 类型 | 边界 |
| 关联 DD | DD-013-001 |
| 场景 | name 为空字符串 |
| 前置条件 | 无 |
| 步骤 | 1. req.body={name:""} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-039N TagService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-039N |
| 类型 | 正常 |
| 关联 DD | DD-013-002 |
| 场景 | 新标签创建 + name 唯一性校验 |
| 前置条件 | mock TagStore.findByName 返回 null |
| 步骤 | 1. create({name:"new"}) |
| 预期 | `expect(tag.id).toMatch(uuid)`；`expect(tag.name).toBe("new")` |
| 优先级 | 高 |

### TC-UNIT-039E TagService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-039E |
| 类型 | 异常 |
| 关联 DD | DD-013-002 |
| 场景 | name 重复抛 ConflictError |
| 前置条件 | mock findByName 返回已存在 |
| 步骤 | 1. create({name:"existing"}) |
| 预期 | `expect(() => tagService.create(...)).toThrow(ConflictError)` |
| 优先级 | 高 |

### TC-UNIT-039B TagService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-039B |
| 类型 | 边界 |
| 关联 DD | DD-013-002 |
| 场景 | name 长度边界（max=50） |
| 前置条件 | 无 |
| 步骤 | 1. name="a".repeat(50)；2. name="a".repeat(51) |
| 预期 | 50：成功；51：ZodError |
| 优先级 | 中 |

### TC-UNIT-040N TagStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-040N |
| 类型 | 正常 |
| 关联 DD | DD-013-003 |
| 场景 | save + findByName 往返 |
| 前置条件 | 无 |
| 步骤 | 1. save(tag)；2. findByName(tag.name) |
| 预期 | `expect(found).toEqual(tag)` |
| 优先级 | 高 |

### TC-UNIT-040E TagStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-040E |
| 类型 | 异常 |
| 关联 DD | DD-013-003 |
| 场景 | findByName 不存在返回 null |
| 前置条件 | 空 store |
| 步骤 | 1. findByName("nonexistent") |
| 预期 | `expect(result).toBeNull()` |
| 优先级 | 中 |

### TC-UNIT-040B TagStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-040B |
| 类型 | 边界 |
| 关联 DD | DD-013-003 |
| 场景 | 单表 10000 条标签（NFR-004） |
| 前置条件 | 无 |
| 步骤 | 1. 循环 save 10000 条；2. count() |
| 预期 | `expect(tagStore.count()).toBe(10000)` |
| 优先级 | 中 |

## §15 SD-014 分类管理（3 用例）

### TC-UNIT-041N CategoryController CRUD 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-041N |
| 类型 | 正常 |
| 关联 DD | DD-014-001 |
| 场景 | list + create + update + remove 全流程 |
| 前置条件 | mock CategoryService |
| 步骤 | 1. list；2. create；3. update；4. remove |
| 预期 | 状态码 200/201/200/204 |
| 优先级 | 高 |

### TC-UNIT-041E CategoryController 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-041E |
| 类型 | 异常 |
| 关联 DD | DD-014-001 |
| 场景 | 删除被引用分类抛 ConflictError |
| 前置条件 | mock remove 抛 ConflictError |
| 步骤 | 1. remove(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ConflictError))` |
| 优先级 | 高 |

### TC-UNIT-041B CategoryController 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-041B |
| 类型 | 边界 |
| 关联 DD | DD-014-001 |
| 场景 | parentCategoryId 形成环（400） |
| 前置条件 | mock create 抛 CycleDetectedError |
| 步骤 | 1. create(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(CycleDetectedError))` |
| 优先级 | 高 |

### TC-UNIT-042N CategoryService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-042N |
| 类型 | 正常 |
| 关联 DD | DD-014-002 |
| 场景 | 创建分类 + 无环校验通过 |
| 前置条件 | mock CategoryCycleChecker.check 返回 false |
| 步骤 | 1. create({name:"New",parentCategoryId:null}) |
| 预期 | `expect(category.id).toMatch(uuid)` |
| 优先级 | 高 |

### TC-UNIT-042E CategoryService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-042E |
| 类型 | 异常 |
| 关联 DD | DD-014-002 |
| 场景 | 删除被文章引用的分类抛 ConflictError |
| 前置条件 | mock ArticleStore.findByCategory 返回非空 |
| 步骤 | 1. remove("c1") |
| 预期 | `expect(() => categoryService.remove("c1")).toThrow(ConflictError)` |
| 优先级 | 高 |

### TC-UNIT-042B CategoryService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-042B |
| 类型 | 边界 |
| 关联 DD | DD-014-002 |
| 场景 | 深度嵌套分类树（10 层） |
| 前置条件 | mock 10 层链 |
| 步骤 | 1. create({parentCategoryId:"c10"})；2. 无环校验 |
| 预期 | 成功创建 c11；DFS 检测无环 |
| 优先级 | 中 |

### TC-UNIT-043N CategoryCycleChecker 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-043N |
| 类型 | 正常 |
| 关联 DD | DD-014-003 |
| 场景 | 无环链通过 |
| 前置条件 | mock 链 c1→c2→c3 |
| 步骤 | 1. check("c1","c3") |
| 预期 | `expect(check).toBe(false)`（无环） |
| 优先级 | 高 |

### TC-UNIT-043E CategoryCycleChecker 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-043E |
| 类型 | 异常 |
| 关联 DD | DD-014-003 |
| 场景 | 检测到环抛 CycleDetectedError |
| 前置条件 | mock 链 c1→c2→c1 |
| 步骤 | 1. check("c1","c2") |
| 预期 | `expect(check).toBe(true)`（有环） |
| 优先级 | 高 |

### TC-UNIT-043B CategoryCycleChecker 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-043B |
| 类型 | 边界 |
| 关联 DD | DD-014-003 |
| 场景 | 自引用（c1→c1） |
| 前置条件 | 无 |
| 步骤 | 1. check("c1","c1") |
| 预期 | `expect(check).toBe(true)`（自环） |
| 优先级 | 中 |

## §16 SD-015 文章搜索（3 用例）

### TC-UNIT-044N SearchController.search 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-044N |
| 类型 | 正常 |
| 关联 DD | DD-015-001 |
| 场景 | 关键词搜索返回 200 |
| 前置条件 | mock SearchService.search 返回结果 |
| 步骤 | 1. req.query={q:"hello"}；2. search(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)` |
| 优先级 | 高 |

### TC-UNIT-044E SearchController.search 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-044E |
| 类型 | 异常 |
| 关联 DD | DD-015-001 |
| 场景 | q 参数缺失（zod 拒绝） |
| 前置条件 | 无 |
| 步骤 | 1. req.query={} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-044B SearchController.search 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-044B |
| 类型 | 边界 |
| 关联 DD | DD-015-001 |
| 场景 | q 为空字符串 |
| 前置条件 | 无 |
| 步骤 | 1. req.query={q:""} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-045N SearchService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-045N |
| 类型 | 正常 |
| 关联 DD | DD-015-002 |
| 场景 | 关键词匹配 + 已发布过滤 |
| 前置条件 | mock ArticleStore 10 篇（5 篇 published 含关键词） |
| 步骤 | 1. search({q:"hello"}) |
| 预期 | `expect(result.items.length).toBe(5)` |
| 优先级 | 高 |

### TC-UNIT-045E SearchService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-045E |
| 类型 | 异常 |
| 关联 DD | DD-015-002 |
| 场景 | tagId 不存在返回空结果 |
| 前置条件 | mock TagStore.findById 返回 null |
| 步骤 | 1. search({q:"hello",tagId:"nonexistent"}) |
| 预期 | `expect(result.items).toEqual([])` |
| 优先级 | 中 |

### TC-UNIT-045B SearchService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-045B |
| 类型 | 边界 |
| 关联 DD | DD-015-002 |
| 场景 | 单关键词 + 10000 篇文章性能（NFR-004） |
| 前置条件 | mock 10000 篇 |
| 步骤 | 1. search({q:"hello"}) |
| 预期 | P95 < 200ms |
| 优先级 | 高 |

### TC-UNIT-046N SearchQueryParser 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-046N |
| 类型 | 正常 |
| 关联 DD | DD-015-003 |
| 场景 | 解析 q + tagId + categoryId + 分页 |
| 前置条件 | 无 |
| 步骤 | 1. parse("q=hello&tagId=t1&categoryId=c1&page=2&limit=10") |
| 预期 | `expect(parsed).toEqual({q:"hello",tagId:"t1",categoryId:"c1",page:2,limit:10})` |
| 优先级 | 高 |

### TC-UNIT-046E SearchQueryParser 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-046E |
| 类型 | 异常 |
| 关联 DD | DD-015-003 |
| 场景 | 缺少 q 参数抛 ZodError |
| 前置条件 | 无 |
| 步骤 | 1. parse("") |
| 预期 | `expect(() => SearchQueryParser.parse("")).toThrow(ZodError)` |
| 优先级 | 中 |

### TC-UNIT-046B SearchQueryParser 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-046B |
| 类型 | 边界 |
| 关联 DD | DD-015-003 |
| 场景 | page/limit 类型不符（字符串）coerce |
| 前置条件 | 无 |
| 步骤 | 1. parse("q=hello&page=abc") |
| 预期 | `expect(() => SearchQueryParser.parse(...)).toThrow(ZodError)` |
| 优先级 | 中 |

## §17 SD-016 密码重置（4 用例）

### TC-UNIT-047N PasswordResetController 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-047N |
| 类型 | 正常 |
| 关联 DD | DD-016-001 |
| 场景 | reset-request + reset 全流程 |
| 前置条件 | mock PasswordResetService |
| 步骤 | 1. passwordResetRequest(req,res)；2. passwordReset(req,res) |
| 预期 | 1: 200 `{tokenSent:true}`；2: 200 `{reset:true}` |
| 优先级 | 高 |

### TC-UNIT-047E PasswordResetController 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-047E |
| 类型 | 异常 |
| 关联 DD | DD-016-001 |
| 场景 | 令牌过期抛 GoneError（410） |
| 前置条件 | mock passwordReset 抛 GoneError |
| 步骤 | 1. passwordReset(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(GoneError))` |
| 优先级 | 高 |

### TC-UNIT-047B PasswordResetController 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-047B |
| 类型 | 边界 |
| 关联 DD | DD-016-001 |
| 场景 | reset-request 防邮箱枚举：未知邮箱也返回 200 |
| 前置条件 | mock findByEmail 返回 null |
| 步骤 | 1. passwordResetRequest(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)`；`expect(res.json).toHaveBeenCalledWith({tokenSent:true})` |
| 优先级 | 高 |

### TC-UNIT-048N PasswordResetService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-048N |
| 类型 | 正常 |
| 关联 DD | DD-016-002 |
| 场景 | 签发短期令牌 + bcrypt 哈希新密码 + 一次性使用 |
| 前置条件 | mock UserStore.findByEmail 返回用户 |
| 步骤 | 1. requestReset(email)；2. reset(token,newPassword) |
| 预期 | token 15min 有效；`expect(passwordResetStore.markUsed).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-048E PasswordResetService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-048E |
| 类型 | 异常 |
| 关联 DD | DD-016-002 |
| 场景 | 令牌已使用抛 ConflictError |
| 前置条件 | mock token.used=true |
| 步骤 | 1. reset(token,newPassword) |
| 预期 | `expect(() => passwordResetService.reset(...)).toThrow(ConflictError)` |
| 优先级 | 高 |

### TC-UNIT-048B PasswordResetService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-048B |
| 类型 | 边界 |
| 关联 DD | DD-016-002 |
| 场景 | 令牌刚好 15min 过期（边界时间） |
| 前置条件 | mock token.expiresAt = now - 1ms |
| 步骤 | 1. reset(token,...) |
| 预期 | `expect(() => reset(...)).toThrow(GoneError)` |
| 优先级 | 高 |

### TC-UNIT-049N PasswordResetStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-049N |
| 类型 | 正常 |
| 关联 DD | DD-016-003 |
| 场景 | save + findByToken + markUsed 全流程 |
| 前置条件 | 无 |
| 步骤 | 1. save(token)；2. findByToken(token.token)；3. markUsed(token.token) |
| 预期 | `expect(found.used).toBe(false)`；`expect(used.used).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-049E PasswordResetStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-049E |
| 类型 | 异常 |
| 关联 DD | DD-016-003 |
| 场景 | findByToken 不存在返回 null |
| 前置条件 | 空 store |
| 步骤 | 1. findByToken("nonexistent") |
| 预期 | `expect(result).toBeNull()` |
| 优先级 | 中 |

### TC-UNIT-049B PasswordResetStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-049B |
| 类型 | 边界 |
| 关联 DD | DD-016-003 |
| 场景 | markUsed 已 used 的 token 抛 ConflictError |
| 前置条件 | token.used=true |
| 步骤 | 1. markUsed(token.token) |
| 预期 | `expect(() => passwordResetStore.markUsed(...)).toThrow(ConflictError)` |
| 优先级 | 中 |

### TC-UNIT-050N PasswordResetTokenUtil 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-050N |
| 类型 | 正常 |
| 关联 DD | DD-016-004 |
| 场景 | sign + verify 还原 |
| 前置条件 | 无 |
| 步骤 | 1. token=sign({userId:"u1"},900)；2. verify(token) |
| 预期 | `expect(payload.userId).toBe("u1")`；exp - iat = 900 |
| 优先级 | 高 |

### TC-UNIT-050E PasswordResetTokenUtil 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-050E |
| 类型 | 异常 |
| 关联 DD | DD-016-004 |
| 场景 | 篡改 token 抛错 |
| 前置条件 | 无 |
| 步骤 | 1. verify(tampered) |
| 预期 | `expect(() => PasswordResetTokenUtil.verify(tampered)).toThrow()` |
| 优先级 | 高 |

### TC-UNIT-050B PasswordResetTokenUtil 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-050B |
| 类型 | 边界 |
| 关联 DD | DD-016-004 |
| 场景 | token 15min 后过期 |
| 前置条件 | 无 |
| 步骤 | 1. token=sign({userId:"u1"},-1)；2. verify(token) |
| 预期 | `expect(() => verify(token)).toThrow(TokenExpiredError)` |
| 优先级 | 高 |

## §18 SD-017 草稿/发布工作流（4 用例，含 L4 不变式）

### TC-UNIT-051N ArticleWorkflowController 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-051N |
| 类型 | 正常 |
| 关联 DD | DD-017-001 |
| 场景 | publish + unpublish 全流程 |
| 前置条件 | mock ArticleWorkflowService |
| 步骤 | 1. publish(req,res)；2. unpublish(req,res) |
| 预期 | 1: 200 `{status:"published",publishedAt}`；2: 200 `{status:"draft"}` |
| 优先级 | 高 |

### TC-UNIT-051E ArticleWorkflowController 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-051E |
| 类型 | 异常 |
| 关联 DD | DD-017-001 |
| 场景 | 非法状态转移抛 BadRequestError |
| 前置条件 | mock publish 抛 BadRequestError |
| 步骤 | 1. publish(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(BadRequestError))` |
| 优先级 | 高 |

### TC-UNIT-051B ArticleWorkflowController 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-051B |
| 类型 | 边界 |
| 关联 DD | DD-017-001 |
| 场景 | 非作者非 admin publish 抛 ForbiddenError |
| 前置条件 | mock publish 抛 ForbiddenError |
| 步骤 | 1. publish(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))` |
| 优先级 | 中 |

### TC-UNIT-052N ArticleWorkflowService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-052N |
| 类型 | 正常 |
| 关联 DD | DD-017-002 |
| 场景 | draft → published 状态转移 + 审计触发 |
| 前置条件 | mock ArticleStore.findById 返回 status="draft" |
| 步骤 | 1. publish("a1",userId="u1",role="author") |
| 预期 | `expect(article.status).toBe("published")`；`expect(article.publishedAt).not.toBeNull()`；`expect(auditService.log).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-052E ArticleWorkflowService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-052E |
| 类型 | 异常 |
| 关联 DD | DD-017-002 |
| 场景 | 已 published 文章再次 publish 抛 BadRequestError |
| 前置条件 | mock findById 返回 status="published" |
| 步骤 | 1. publish("a1",...) |
| 预期 | `expect(() => articleWorkflowService.publish(...)).toThrow(BadRequestError)` |
| 优先级 | 高 |

### TC-UNIT-052B ArticleWorkflowService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-052B |
| 类型 | 边界 |
| 关联 DD | DD-017-002 |
| 场景 | draft ↔ published 多次往返（状态机健壮性） |
| 前置条件 | 无 |
| 步骤 | 1. publish；2. unpublish；3. publish；4. unpublish |
| 预期 | 每次转移成功；状态始终在 {draft,published} |
| 优先级 | 高 |

### TC-UNIT-053N ArticleStateMachine 正常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-053N |
| 类型 | 正常 |
| 关联 DD | DD-017-003 |
| 场景 | 合法转移 draft→published（对应 L4_article_state_machine StateMachineLegality） |
| 前置条件 | 无 |
| 步骤 | 1. transition("draft","publish") |
| 预期 | `expect(result).toBe("published")` |
| 优先级 | 高 |

### TC-UNIT-053E ArticleStateMachine 异常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-053E |
| 类型 | 异常 |
| 关联 DD | DD-017-003 |
| 场景 | 非法转移 published→published 抛 BadRequestError（对应 L4 NoInvalidTransition） |
| 前置条件 | 无 |
| 步骤 | 1. transition("published","publish") |
| 预期 | `expect(() => transition("published","publish")).toThrow(BadRequestError)` |
| 优先级 | 高 |

### TC-UNIT-053B ArticleStateMachine 边界（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-053B |
| 类型 | 边界 |
| 关联 DD | DD-017-003 |
| 场景 | 未知 action 抛 BadRequestError |
| 前置条件 | 无 |
| 步骤 | 1. transition("draft","unknown") |
| 预期 | `expect(() => transition("draft","unknown")).toThrow(BadRequestError)` |
| 优先级 | 中 |

### TC-UNIT-054N AuditContextUtil 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-054N |
| 类型 | 正常 |
| 关联 DD | DD-017-004 |
| 场景 | 构建 audit context |
| 前置条件 | 无 |
| 步骤 | 1. build({userId:"u1",action:"article.publish",resourceId:"a1"}) |
| 预期 | `expect(ctx).toEqual({userId:"u1",action:"article.publish",resource:"article",resourceId:"a1",meta:{}})` |
| 优先级 | 中 |

### TC-UNIT-054E AuditContextUtil 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-054E |
| 类型 | 异常 |
| 关联 DD | DD-017-004 |
| 场景 | 缺少 userId 抛 ValueError |
| 前置条件 | 无 |
| 步骤 | 1. build({action:"x"}) |
| 预期 | `expect(() => AuditContextUtil.build(...)).toThrow()` |
| 优先级 | 低 |

### TC-UNIT-054B AuditContextUtil 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-054B |
| 类型 | 边界 |
| 关联 DD | DD-017-004 |
| 场景 | meta 为 null vs undefined vs {} |
| 前置条件 | 无 |
| 步骤 | 1. build({...,meta:null})；2. build({...,meta:undefined})；3. build({...,meta:{}}) |
| 预期 | 三者均返回 meta:{} |
| 优先级 | 低 |

## §19 SD-018 文章点赞（3 用例）

### TC-UNIT-055N LikeController 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-055N |
| 类型 | 正常 |
| 关联 DD | DD-018-001 |
| 场景 | 首次点赞返回 200 |
| 前置条件 | mock LikeService.like 返回 {likeCount:1,liked:true} |
| 步骤 | 1. req.params.id="a1"；2. like(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)`；`expect(res.json).toHaveBeenCalledWith({likeCount:1,liked:true})` |
| 优先级 | 高 |

### TC-UNIT-055E LikeController 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-055E |
| 类型 | 异常 |
| 关联 DD | DD-018-001 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock like 抛 NotFoundError |
| 步骤 | 1. like(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 高 |

### TC-UNIT-055B LikeController 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-055B |
| 类型 | 边界 |
| 关联 DD | DD-018-001 |
| 场景 | 重复点赞返回幂等结果 |
| 前置条件 | mock like 返回 {likeCount:1,liked:false}（已点过） |
| 步骤 | 1. like(req,res) |
| 预期 | `expect(res.json).toHaveBeenCalledWith({likeCount:1,liked:false})` |
| 优先级 | 高 |

### TC-UNIT-056N LikeService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-056N |
| 类型 | 正常 |
| 关联 DD | DD-018-002 |
| 场景 | 首次点赞 + 计数+1 |
| 前置条件 | mock LikeStore.has 返回 false |
| 步骤 | 1. like("a1","u1") |
| 预期 | `expect(likeStore.save).toHaveBeenCalled()`；`expect(articleStore.incrementLikeCount).toHaveBeenCalledWith("a1")` |
| 优先级 | 高 |

### TC-UNIT-056E LikeService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-056E |
| 类型 | 异常 |
| 关联 DD | DD-018-002 |
| 场景 | 文章不存在抛 NotFoundError |
| 前置条件 | mock ArticleStore.findById 返回 null |
| 步骤 | 1. like("nonexistent","u1") |
| 预期 | `expect(() => likeService.like(...)).toThrow(NotFoundError)` |
| 优先级 | 高 |

### TC-UNIT-056B LikeService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-056B |
| 类型 | 边界 |
| 关联 DD | DD-018-002 |
| 场景 | 重复点赞幂等（计数不重复+1） |
| 前置条件 | mock LikeStore.has 返回 true |
| 步骤 | 1. like("a1","u1") |
| 预期 | `expect(likeStore.save).not.toHaveBeenCalled()`；`expect(articleStore.incrementLikeCount).not.toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-057N LikeStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-057N |
| 类型 | 正常 |
| 关联 DD | DD-018-003 |
| 场景 | save + has 往返 |
| 前置条件 | 无 |
| 步骤 | 1. save({userId:"u1",articleId:"a1"})；2. has("u1","a1") |
| 预期 | `expect(has).toBe(true)` |
| 优先级 | 高 |

### TC-UNIT-057E LikeStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-057E |
| 类型 | 异常 |
| 关联 DD | DD-018-003 |
| 场景 | 重复 save 同复合键抛 ConflictError |
| 前置条件 | 已 save |
| 步骤 | 1. save(sameLike) |
| 预期 | `expect(() => likeStore.save(sameLike)).toThrow(ConflictError)` |
| 优先级 | 中 |

### TC-UNIT-057B LikeStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-057B |
| 类型 | 边界 |
| 关联 DD | DD-018-003 |
| 场景 | 单文章 10000 点赞（NFR-004） |
| 前置条件 | 无 |
| 步骤 | 1. 循环 save 10000 条；2. countByArticle("a1") |
| 预期 | `expect(likeStore.countByArticle("a1")).toBe(10000)` |
| 优先级 | 中 |

## §20 SD-019 审计日志（4 用例，含 L4 不变式）

### TC-UNIT-058N AuditLogController.list 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-058N |
| 类型 | 正常 |
| 关联 DD | DD-019-001 |
| 场景 | admin 查询审计日志返回 200 |
| 前置条件 | mock AuditService.query 返回分页结果 |
| 步骤 | 1. req.query={page:1,limit:50}；2. list(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)` |
| 优先级 | 高 |

### TC-UNIT-058E AuditLogController.list 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-058E |
| 类型 | 异常 |
| 关联 DD | DD-019-001 |
| 场景 | 非 admin 抛 ForbiddenError |
| 前置条件 | req.user.role="reader" |
| 步骤 | 1. list(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))` |
| 优先级 | 高 |

### TC-UNIT-058B AuditLogController.list 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-058B |
| 类型 | 边界 |
| 关联 DD | DD-019-001 |
| 场景 | limit 超过 100 |
| 前置条件 | 无 |
| 步骤 | 1. req.query={limit:101} |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(ZodError))` |
| 优先级 | 中 |

### TC-UNIT-059N AuditService.log 正常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-059N |
| 类型 | 正常 |
| 关联 DD | DD-019-002 |
| 场景 | 写入审计日志（对应 L4_audit_log_retention NoLogLoss） |
| 前置条件 | mock AuditLogStore.save |
| 步骤 | 1. log({userId:"u1",action:"article.create",resource:"article",resourceId:"a1"}) |
| 预期 | `expect(auditLogStore.save).toHaveBeenCalledWith(expect.objectContaining({userId:"u1"}))` |
| 优先级 | 高 |

### TC-UNIT-059E AuditService.log 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-059E |
| 类型 | 异常 |
| 关联 DD | DD-019-002 |
| 场景 | store 写入失败不抛错（审计不应阻塞主流程） |
| 前置条件 | mock save 抛 Error |
| 步骤 | 1. log({...}) |
| 预期 | `expect(() => auditService.log(...)).not.toThrow()`；logger.error 被调用 |
| 优先级 | 高 |

### TC-UNIT-059B AuditService.log 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-059B |
| 类型 | 边界 |
| 关联 DD | DD-019-002 |
| 场景 | meta 为 null vs {} vs 复杂对象 |
| 前置条件 | 无 |
| 步骤 | 1. log({...,meta:null})；2. log({...,meta:{articleId:"a1",ip:"1.2.3.4"}}) |
| 预期 | 两者均成功；meta 序列化为 {} 或原文 |
| 优先级 | 中 |

### TC-UNIT-060N AuditLogStore 正常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-060N |
| 类型 | 正常 |
| 关联 DD | DD-019-003 |
| 场景 | save + query 往返（对应 L4_audit_log_retention Retention90Days） |
| 前置条件 | 无 |
| 步骤 | 1. save(log)；2. query({userId:"u1"}) |
| 预期 | `expect(result.items).toContainEqual(expect.objectContaining({id:log.id}))` |
| 优先级 | 高 |

### TC-UNIT-060E AuditLogStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-060E |
| 类型 | 异常 |
| 关联 DD | DD-019-003 |
| 场景 | 90 天前日志被清理 |
| 前置条件 | mock log.timestamp = now - 91 days |
| 步骤 | 1. save(oldLog)；2. cleanup()；3. query({}) |
| 预期 | `expect(result.items).not.toContainEqual(expect.objectContaining({id:oldLog.id}))` |
| 优先级 | 高 |

### TC-UNIT-060B AuditLogStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-060B |
| 类型 | 边界 |
| 关联 DD | DD-019-003 |
| 场景 | 90 天边界（89/90/91 天） |
| 前置条件 | 无 |
| 步骤 | 1. save(log 89d)；2. save(log 90d)；3. save(log 91d)；4. cleanup() |
| 预期 | 89d + 90d 保留；91d 清理 |
| 优先级 | 高 |

### TC-UNIT-061N AuditMiddleware 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-061N |
| 类型 | 正常 |
| 关联 DD | DD-019-004 |
| 场景 | 写操作触发审计 |
| 前置条件 | req.method="POST" |
| 步骤 | 1. record(req,res,next)；2. res.emit("finish") |
| 预期 | `expect(auditService.log).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-061E AuditMiddleware 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-061E |
| 类型 | 异常 |
| 关联 DD | DD-019-004 |
| 场景 | GET 请求不触发审计 |
| 前置条件 | req.method="GET" |
| 步骤 | 1. record(req,res,next) |
| 预期 | `expect(auditService.log).not.toHaveBeenCalled()` |
| 优先级 | 中 |

### TC-UNIT-061B AuditMiddleware 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-061B |
| 类型 | 边界 |
| 关联 DD | DD-019-004 |
| 场景 | 4xx/5xx 响应仍触发审计（记录失败操作） |
| 前置条件 | res.statusCode=500 |
| 步骤 | 1. record(req,res,next)；2. res.emit("finish") |
| 预期 | `expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({meta:expect.objectContaining({statusCode:500})}))` |
| 优先级 | 中 |

## §21 SD-020 RSS 订阅（3 用例）

### TC-UNIT-062N RssController.feed 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-062N |
| 类型 | 正常 |
| 关联 DD | DD-020-001 |
| 场景 | 返回 Atom XML |
| 前置条件 | mock RssService.generate 返回 XML |
| 步骤 | 1. feed(req,res) |
| 预期 | `expect(res.set).toHaveBeenCalledWith("Content-Type","application/atom+xml")`；`expect(res.send).toHaveBeenCalledWith(xmlString)` |
| 优先级 | 高 |

### TC-UNIT-062E RssController.feed 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-062E |
| 类型 | 异常 |
| 关联 DD | DD-020-001 |
| 场景 | 服务异常抛错 |
| 前置条件 | mock generate 抛 Error |
| 步骤 | 1. feed(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(Error))` |
| 优先级 | 中 |

### TC-UNIT-062B RssController.feed 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-062B |
| 类型 | 边界 |
| 关联 DD | DD-020-001 |
| 场景 | ETag 命中返回 304 |
| 前置条件 | req.headers["if-none-match"]=etag |
| 步骤 | 1. feed(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(304)` |
| 优先级 | 中 |

### TC-UNIT-063N RssService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-063N |
| 类型 | 正常 |
| 关联 DD | DD-020-002 |
| 场景 | 取最近 20 篇 published + 渲染 Atom |
| 前置条件 | mock ArticleStore 返回 25 篇 published |
| 步骤 | 1. generate() |
| 预期 | `expect(xml).toContain("<entry>")`；entry 数量 = 20 |
| 优先级 | 高 |

### TC-UNIT-063E RssService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-063E |
| 类型 | 异常 |
| 关联 DD | DD-020-002 |
| 场景 | 0 篇 published 文章返回空 feed |
| 前置条件 | mock 返回 [] |
| 步骤 | 1. generate() |
| 预期 | `expect(xml).toContain("<feed>")`；`expect(xml).not.toContain("<entry>")` |
| 优先级 | 中 |

### TC-UNIT-063B RssService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-063B |
| 类型 | 边界 |
| 关联 DD | DD-020-002 |
| 场景 | 标题含特殊字符（XML 转义） |
| 前置条件 | mock 文章 title="<script>alert('xss')</script>" |
| 步骤 | 1. generate() |
| 预期 | `expect(xml).not.toContain("<script>")`；`expect(xml).toContain("&lt;script&gt;")` |
| 优先级 | 高 |

### TC-UNIT-064N AtomFeedGenerator 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-064N |
| 类型 | 正常 |
| 关联 DD | DD-020-003 |
| 场景 | 生成标准 Atom 1.0 XML |
| 前置条件 | 无 |
| 步骤 | 1. generate([{id,title,content,authorId,publishedAt}]) |
| 预期 | `expect(xml).toMatch(/<\?xml version="1.0"/)`；`expect(xml).toContain("<feed xmlns=\"http://www.w3.org/2005/Atom\">")` |
| 优先级 | 高 |

### TC-UNIT-064E AtomFeedGenerator 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-064E |
| 类型 | 异常 |
| 关联 DD | DD-020-003 |
| 场景 | 空数组生成空 feed |
| 前置条件 | 无 |
| 步骤 | 1. generate([]) |
| 预期 | `expect(xml).toContain("<feed")`；`expect(xml).not.toContain("<entry>")` |
| 优先级 | 中 |

### TC-UNIT-064B AtomFeedGenerator 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-064B |
| 类型 | 边界 |
| 关联 DD | DD-020-003 |
| 场景 | entry 含所有 XML 特殊字符（< > & ' "） |
| 前置条件 | 无 |
| 步骤 | 1. generate([{title:"<>&'\""}]) |
| 预期 | 全部转义；`expect(xml).not.toMatch(/[<>&'"](?!(amp|lt|gt|quot|apos);)/)` |
| 优先级 | 高 |

## §22 SD-021 用户资料管理（3 用例）

### TC-UNIT-065N UserProfileController 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-065N |
| 类型 | 正常 |
| 关联 DD | DD-021-001 |
| 场景 | updateProfile + getProfile 全流程 |
| 前置条件 | mock UserProfileService |
| 步骤 | 1. updateProfile(req,res)；2. getProfile(req,res) |
| 预期 | 1: 200；2: 200 |
| 优先级 | 高 |

### TC-UNIT-065E UserProfileController 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-065E |
| 类型 | 异常 |
| 关联 DD | DD-021-001 |
| 场景 | 用户不存在抛 NotFoundError |
| 前置条件 | mock getProfile 抛 NotFoundError |
| 步骤 | 1. getProfile(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))` |
| 优先级 | 中 |

### TC-UNIT-065B UserProfileController 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-065B |
| 类型 | 边界 |
| 关联 DD | DD-021-001 |
| 场景 | nickname 长度边界（max=50） |
| 前置条件 | 无 |
| 步骤 | 1. req.body={nickname:"a".repeat(50)}；2. req.body={nickname:"a".repeat(51)} |
| 预期 | 50：成功；51：ZodError |
| 优先级 | 中 |

### TC-UNIT-066N UserProfileService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-066N |
| 类型 | 正常 |
| 关联 DD | DD-021-002 |
| 场景 | 更新资料 + 审计触发 |
| 前置条件 | mock UserProfileStore.findById 返回用户 |
| 步骤 | 1. update("u1",{nickname:"New"}) |
| 预期 | `expect(profile.nickname).toBe("New")`；`expect(auditService.log).toHaveBeenCalled()` |
| 优先级 | 高 |

### TC-UNIT-066E UserProfileService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-066E |
| 类型 | 异常 |
| 关联 DD | DD-021-002 |
| 场景 | 用户不存在抛 NotFoundError |
| 前置条件 | mock findById 返回 null |
| 步骤 | 1. update("nonexistent",...) |
| 预期 | `expect(() => userProfileService.update(...)).toThrow(NotFoundError)` |
| 优先级 | 高 |

### TC-UNIT-066B UserProfileService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-066B |
| 类型 | 边界 |
| 关联 DD | DD-021-002 |
| 场景 | avatar URL 格式校验 |
| 前置条件 | 无 |
| 步骤 | 1. avatar="https://example.com/a.png"；2. avatar="not-a-url" |
| 预期 | 1: 成功；2: ZodError |
| 优先级 | 中 |

### TC-UNIT-067N UserProfileStore 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-067N |
| 类型 | 正常 |
| 关联 DD | DD-021-003 |
| 场景 | save + findById 往返 |
| 前置条件 | 无 |
| 步骤 | 1. save(profile)；2. findById(profile.userId) |
| 预期 | `expect(found).toEqual(profile)` |
| 优先级 | 高 |

### TC-UNIT-067E UserProfileStore 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-067E |
| 类型 | 异常 |
| 关联 DD | DD-021-003 |
| 场景 | findById 不存在返回 null |
| 前置条件 | 空 store |
| 步骤 | 1. findById("nonexistent") |
| 预期 | `expect(result).toBeNull()` |
| 优先级 | 中 |

### TC-UNIT-067B UserProfileStore 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-067B |
| 类型 | 边界 |
| 关联 DD | DD-021-003 |
| 场景 | bio 长度边界（max=500） |
| 前置条件 | 无 |
| 步骤 | 1. bio="a".repeat(500)；2. bio="a".repeat(501) |
| 预期 | 500：成功；501：ZodError |
| 优先级 | 中 |

## §23 SD-022 文章归档查询（3 用例）

### TC-UNIT-068N ArticleController.archive 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-068N |
| 类型 | 正常 |
| 关联 DD | DD-022-001 |
| 场景 | 返回按月份分组归档 |
| 前置条件 | mock ArchiveService.archive 返回分组结果 |
| 步骤 | 1. archive(req,res) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(200)`；`expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([{year,month,count,items}]))` |
| 优先级 | 高 |

### TC-UNIT-068E ArticleController.archive 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-068E |
| 类型 | 异常 |
| 关联 DD | DD-022-001 |
| 场景 | 服务异常抛错 |
| 前置条件 | mock archive 抛 Error |
| 步骤 | 1. archive(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(Error))` |
| 优先级 | 中 |

### TC-UNIT-068B ArticleController.archive 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-068B |
| 类型 | 边界 |
| 关联 DD | DD-022-001 |
| 场景 | 无文章返回空数组 |
| 前置条件 | mock archive 返回 [] |
| 步骤 | 1. archive(req,res) |
| 预期 | `expect(res.json).toHaveBeenCalledWith([])` |
| 优先级 | 中 |

### TC-UNIT-069N ArchiveService 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-069N |
| 类型 | 正常 |
| 关联 DD | DD-022-002 |
| 场景 | 按月份分组已发布文章 |
| 前置条件 | mock ArticleStore 12 篇（跨 3 个月） |
| 步骤 | 1. archive() |
| 预期 | `expect(result.length).toBe(3)`；每条含 {year,month,count,items} |
| 优先级 | 高 |

### TC-UNIT-069E ArchiveService 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-069E |
| 类型 | 异常 |
| 关联 DD | DD-022-002 |
| 场景 | 0 篇 published 返回空 |
| 前置条件 | mock 返回 [] |
| 步骤 | 1. archive() |
| 预期 | `expect(result).toEqual([])` |
| 优先级 | 中 |

### TC-UNIT-069B ArchiveService 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-069B |
| 类型 | 边界 |
| 关联 DD | DD-022-002 |
| 场景 | 跨年归档（2025-12 与 2026-01 不合并） |
| 前置条件 | mock 1 篇 2025-12 + 1 篇 2026-01 |
| 步骤 | 1. archive() |
| 预期 | `expect(result.length).toBe(2)` |
| 优先级 | 中 |

### TC-UNIT-070N ArchiveGroupingUtil 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-070N |
| 类型 | 正常 |
| 关联 DD | DD-022-003 |
| 场景 | 按年月分组 |
| 前置条件 | 无 |
| 步骤 | 1. group([{publishedAt:"2026-01-15"},{publishedAt:"2026-01-20"},{publishedAt:"2026-02-01"}]) |
| 预期 | `expect(result.length).toBe(2)`；2026-01 组 2 篇，2026-02 组 1 篇 |
| 优先级 | 高 |

### TC-UNIT-070E ArchiveGroupingUtil 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-070E |
| 类型 | 异常 |
| 关联 DD | DD-022-003 |
| 场景 | publishedAt 缺失抛 ValueError |
| 前置条件 | 无 |
| 步骤 | 1. group([{id:"a1"}]) |
| 预期 | `expect(() => ArchiveGroupingUtil.group(...)).toThrow()` |
| 优先级 | 中 |

### TC-UNIT-070B ArchiveGroupingUtil 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-070B |
| 类型 | 边界 |
| 关联 DD | DD-022-003 |
| 场景 | 月份边界（1 月与 12 月） |
| 前置条件 | 无 |
| 步骤 | 1. group([{publishedAt:"2026-01-01"},{publishedAt:"2026-12-31"}]) |
| 预期 | 2 组；不合并 |
| 优先级 | 中 |

## §24 横切公共 DD（5 用例，含 L4 不变式）

### TC-UNIT-071N ErrorHandlerMiddleware 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-071N |
| 类型 | 正常 |
| 关联 DD | DD-COMMON-001 |
| 场景 | AppError 转换为统一响应格式（NFR-003） |
| 前置条件 | 无 |
| 步骤 | 1. err=new AppError("NOT_FOUND",404,"Not Found")；2. handle(err,req,res,next) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(404)`；`expect(res.json).toHaveBeenCalledWith({error:{code:"NOT_FOUND",message:"Not Found"},requestId:...,timestamp:...})` |
| 优先级 | 高 |

### TC-UNIT-071E ErrorHandlerMiddleware 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-071E |
| 类型 | 异常 |
| 关联 DD | DD-COMMON-001 |
| 场景 | 未知错误兜底为 500 |
| 前置条件 | 无 |
| 步骤 | 1. err=new Error("unknown")；2. handle(err,req,res,next) |
| 预期 | `expect(res.status).toHaveBeenCalledWith(500)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:"INTERNAL_ERROR"}}))` |
| 优先级 | 高 |

### TC-UNIT-071B ErrorHandlerMiddleware 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-071B |
| 类型 | 边界 |
| 关联 DD | DD-COMMON-001 |
| 场景 | res.headersSent 时委托 next(err) |
| 前置条件 | mock res.headersSent=true |
| 步骤 | 1. handle(err,req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(err)` |
| 优先级 | 中 |

### TC-UNIT-072N Logger 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-072N |
| 类型 | 正常 |
| 关联 DD | DD-COMMON-002 |
| 场景 | 结构化 JSON 日志输出（CON-004） |
| 前置条件 | mock process.stdout.write |
| 步骤 | 1. logger.info("hello",{userId:"u1"}) |
| 预期 | `expect(process.stdout.write).toHaveBeenCalledWith(expect.stringMatching(/{"level":"info","timestamp":".*","message":"hello","userId":"u1"}/))` |
| 优先级 | 高 |

### TC-UNIT-072E Logger 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-072E |
| 类型 | 异常 |
| 关联 DD | DD-COMMON-002 |
| 场景 | stdout 写入失败 fallback stderr |
| 前置条件 | mock process.stdout.write 抛 Error |
| 步骤 | 1. logger.info("hello") |
| 预期 | `expect(process.stderr.write).toHaveBeenCalled()` |
| 优先级 | 中 |

### TC-UNIT-072B Logger 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-072B |
| 类型 | 边界 |
| 关联 DD | DD-COMMON-002 |
| 场景 | meta 为 undefined / null / 复杂嵌套对象 |
| 前置条件 | 无 |
| 步骤 | 1. logger.info("m")；2. logger.info("m",null)；3. logger.info("m",{a:{b:{c:1}}}) |
| 预期 | 三者均成功输出合法 JSON |
| 优先级 | 中 |

### TC-UNIT-073N ZodSchemaFactory 正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-073N |
| 类型 | 正常 |
| 关联 DD | DD-COMMON-003 |
| 场景 | email/password/pagination schema 校验（NFR-005） |
| 前置条件 | 无 |
| 步骤 | 1. ZodSchemaFactory.email().safeParse("a@b.com")；2. password().safeParse("Abc12345")；3. pagination().safeParse({page:1,limit:20}) |
| 预期 | 三者 success=true |
| 优先级 | 高 |

### TC-UNIT-073E ZodSchemaFactory 异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-073E |
| 类型 | 异常 |
| 关联 DD | DD-COMMON-003 |
| 场景 | 弱密码被拒 |
| 前置条件 | 无 |
| 步骤 | 1. password().safeParse("weakpass")（无数字无大写） |
| 预期 | `expect(result.success).toBe(false)` |
| 优先级 | 高 |

### TC-UNIT-073B ZodSchemaFactory 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-073B |
| 类型 | 边界 |
| 关联 DD | DD-COMMON-003 |
| 场景 | pagination limit 边界（min=1, max=100） |
| 前置条件 | 无 |
| 步骤 | 1. limit=0；2. limit=1；3. limit=100；4. limit=101 |
| 预期 | 0/101: fail；1/100: success |
| 优先级 | 中 |

### TC-UNIT-074N RateLimitMiddleware 正常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-074N |
| 类型 | 正常 |
| 关联 DD | DD-COMMON-004 |
| 场景 | 第 1 次请求通过（对应 L4_rate_limiter_token_bucket NonNegativeTokens） |
| 前置条件 | mock TokenBucket.consume 返回 true |
| 步骤 | 1. check(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith()`（无错误） |
| 优先级 | 高 |

### TC-UNIT-074E RateLimitMiddleware 异常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-074E |
| 类型 | 异常 |
| 关联 DD | DD-COMMON-004 |
| 场景 | 第 61 次请求被限流抛 TooManyRequestsError（对应 L4 CapacityInvariant） |
| 前置条件 | mock consume 返回 false |
| 步骤 | 1. check(req,res,next) |
| 预期 | `expect(next).toHaveBeenCalledWith(expect.any(TooManyRequestsError))`；`expect(res.set).toHaveBeenCalledWith("Retry-After","1")` |
| 优先级 | 高 |

### TC-UNIT-074B RateLimitMiddleware 边界

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-074B |
| 类型 | 边界 |
| 关联 DD | DD-COMMON-004 |
| 场景 | 第 60 次（容量上限）vs 第 61 次（超限） |
| 前置条件 | mock 60 次返回 true，61 次返回 false |
| 步骤 | 1. 循环 60 次 check；2. 第 61 次 check |
| 预期 | 60: 通过；61: 429 |
| 优先级 | 高 |

### TC-UNIT-075N TokenBucket 正常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-075N |
| 类型 | 正常 |
| 关联 DD | DD-COMMON-005 |
| 场景 | 初始 capacity=60，consume 1 后剩 59（对应 L4 NonNegativeTokens） |
| 前置条件 | 无 |
| 步骤 | 1. consume("k1",1) |
| 预期 | `expect(tokenBucket.available("k1")).toBe(59)` |
| 优先级 | 高 |

### TC-UNIT-075E TokenBucket 异常路径（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-075E |
| 类型 | 异常 |
| 关联 DD | DD-COMMON-005 |
| 场景 | 容量耗尽后 consume 返回 false（对应 L4 CapacityInvariant） |
| 前置条件 | 无 |
| 步骤 | 1. 循环 consume 60 次；2. 第 61 次 consume |
| 预期 | 60 次返回 true；第 61 次返回 false；available=0 |
| 优先级 | 高 |

### TC-UNIT-075B TokenBucket 边界（L4 oracle）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-UNIT-075B |
| 类型 | 边界 |
| 关联 DD | DD-COMMON-005 |
| 场景 | 1 秒后令牌补充 1 个（refillRatePerSec=1） |
| 前置条件 | available=0 |
| 步骤 | 1. vi.advanceTimersByTime(1000)；2. consume("k1",1) |
| 预期 | 第 2 步返回 true；available=0 |
| 优先级 | 高 |

## §25 覆盖率评估

### §25.1 覆盖率目标与策略

| 维度 | 目标 | 策略 |
|---|---|---|
| 行覆盖率 | ≥ 80%（NFR-004） | 每个 DD 公共方法至少 1 个 N + 1 个 E 用例 |
| 分支覆盖率 | ≥ 80% | 边界条件 B 用例覆盖所有显式分支（if/switch/三元） |
| 函数覆盖率 | 100% | 所有 DD 公共方法均至少 1 个用例 |
| TLA+ L4 不变式覆盖 | 5/5 | TC-UNIT-053N/B（article_state_machine）/ TC-UNIT-074N/B（rate_limiter）/ TC-UNIT-075N/B（token_bucket）/ TC-UNIT-059N（audit_log）/ TC-UNIT-050N（password_reset_token） |

### §25.2 用例-DD 覆盖矩阵（按 DD 序号汇总）

- DD-001-001 ~ DD-COMMON-005：75 个 DD，每 DD 3 个用例，共 225 个用例
- 0 个 DD 缺用例（覆盖率 100%）
- 0 个用例缺 `expect()` 断言（每条用例均显式包含至少 1 个 `expect(...)` 表达式）

### §25.3 L4 不变式作为 oracle 的用例清单

| L4 spec | 对应用例 | 验证的不变式 |
|---|---|---|
| `L4_article_state_machine` | TC-UNIT-053N / TC-UNIT-053E / TC-UNIT-053B | StateMachineLegality / NoInvalidTransition |
| `L4_auth_token_lifecycle` | TC-UNIT-012N / TC-UNIT-012E / TC-UNIT-012B | TokenNotRevoked / TokenNotExpired |
| `L4_rate_limiter_token_bucket` | TC-UNIT-074N / TC-UNIT-074E / TC-UNIT-074B / TC-UNIT-075N / TC-UNIT-075E / TC-UNIT-075B | CapacityInvariant / NonNegativeTokens |
| `L4_audit_log_retention` | TC-UNIT-059N / TC-UNIT-060N / TC-UNIT-060B | Retention90Days / NoLogLoss |
| `L4_password_reset_token_lifecycle` | TC-UNIT-048N / TC-UNIT-048E / TC-UNIT-050N / TC-UNIT-050B | OneTimeUse / TokenExpiry15min |

### §25.4 边界条件覆盖清单（必覆盖项核对）

| 边界类型 | 覆盖用例数（示例） | 备注 |
|---|---|---|
| 空输入 / null | 75（每 DD 的 B 用例至少 1 处） | 如 TC-UNIT-005B（dto=null）、TC-UNIT-015B（空 Map） |
| 极值（MAX/MIN） | 12 | 如 TC-UNIT-009B（令牌桶 capacity）、TC-UNIT-019B（page=Number.MAX_SAFE_INTEGER） |
| 越界（±1） | 15 | 如 TC-UNIT-019B（page=0 / page=limit+1）、TC-UNIT-053B（非法转移） |
| 类型不符 | 8 | 如 TC-UNIT-016E（zod schema 拒绝非字符串）、TC-UNIT-046E（查询词非字符串） |
| 并发竞态 | 5 | 如 TC-UNIT-056B（重复点赞幂等）、TC-UNIT-075B（令牌补充并发） |

### §25.5 缺口与遗留

- 无缺口：75 DD 全部覆盖；5 个 L4 不变式全部映射至 oracle 用例
- 阶段 5 编码实现时，若发现新分支（如防御性代码引入的隐式分支），应补 TC-UNIT-* 用例并更新本文档