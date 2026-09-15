# 01 — 登录凭证校验

**What to build:** 接口签名 `AuthService.authenticate(credentials): Session`；`invalidCredentials` 分支返回 `Unauthorized`；状态转移 `anonymous → authenticated`
**Blocked by:** None — can start immediately
**Status:** ready-for-agent

- [ ] `AuthService.authenticate` 对 `invalidCredentials` 返回 `Unauthorized`
- [ ] 单元测试 `describe('AuthService.authenticate')` 覆盖 `invalidCredentials`

# 02 — 会话续期

**What to build:** 接口签名 `SessionStore.renew(sessionId): Session`；过期 `sessionId` 返回 `SessionExpired`；状态转移 `authenticated → refreshed`
**Blocked by:** 01
**Status:** blocked

- [ ] `SessionStore.renew` 对 `SessionExpired` 分支返回非零退出码
