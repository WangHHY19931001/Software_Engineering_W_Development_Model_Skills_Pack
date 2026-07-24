(*
  @system        blog-system::auth-subsystem::auth-flow
  @requirement   REQ-002
  @design        docs/detailed-design.md#DD-AUTH-SVC, docs/detailed-design.md#DD-AUTH-CTRL, docs/detailed-design.md#DD-PASSWORD-UTIL, docs/detailed-design.md#DD-JWT-UTIL
  @parent        ../tla/L2_auth_subsystem.tla
  @sibling       ../tla/L3_article_flow.tla, ../tla/L3_comment_flow.tla
  @child         null
  @level         L3
  @phase         4
*)
---- MODULE L3_auth_flow ----
EXTENDS Naturals, TLC

(* ==================== 变量 ==================== *)
VARIABLES
    authStep,        (* 认证流程步骤："init" / "registered" / "authenticated" / "logged_out" *)
    passwordHashed, (* 密码是否已 bcrypt 哈希：0 / 1（注册原子步，一经哈希不可逆） *)
    tokenIssued      (* JWT 是否已签发：0 / 1（登录原子步，签发后置 1） *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ authStep \in {"init", "registered", "authenticated", "logged_out"}
    /\ passwordHashed \in {0, 1}
    /\ tokenIssued \in {0, 1}

(* ==================== 业务不变式 ==================== *)

(* BI-1：JWT 仅在已认证状态下签发 —— 对应 REQ-002/NFR-002 JWT 鉴权约束
   对应 DD-AUTH-SVC.login 契约 + DD-JWT-UTIL.sign：登录成功才签发 token *)
TokenIssuedRequiresAuthenticated ==
    tokenIssued = 1 => authStep = "authenticated"

(* BI-2：登出状态下 JWT 已注销 —— 对应 DD-AUTH-SVC 登出语义 + DD-JWT-UTIL.verify *)
LoggedOutImpliesNoToken ==
    authStep = "logged_out" => tokenIssued = 0

(* BI-3：注册是认证前置 —— init 状态下 token 必未签发且密码未哈希 *)
InitStateImpliesNoTokenAndNoHash ==
    authStep = "init" => /\ tokenIssued = 0
                        /\ passwordHashed = 0

(* BI-4：已注册用户密码必已 bcrypt 哈希 —— 对应 DD-PASSWORD-UTIL.hash 原子步
   register 调用 PasswordUtil.hash 后 passwordHashed 置 1，UserStore 存入 $2 开头哈希 *)
RegisteredImpliesPasswordHashed ==
    authStep = "registered" => passwordHashed = 1

(* 综合 BusinessInvariant（展开为子不变式合取，含 TypeInvariant）
   .cfg INVARIANTS 列表须与此处展开集合完全一致（check-tla-model.ts §11 cfg-tla 一致性） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ TokenIssuedRequiresAuthenticated
    /\ LoggedOutImpliesNoToken
    /\ InitStateImpliesNoTokenAndNoHash
    /\ RegisteredImpliesPasswordHashed

(* ==================== 初始状态 ==================== *)
Init ==
    /\ authStep = "init"
    /\ passwordHashed = 0
    /\ tokenIssued = 0

(* ==================== 状态转移（Next） ==================== *)

(* 注册原子步：init → registered —— 对应 DD-AUTH-CTRL.register → DD-AUTH-SVC.register
   原子步序列：校验用户名唯一 → DD-PASSWORD-UTIL.hash(password) 哈希 → DD-USER-SVC.saveUser 存入
   passwordHashed 置 1 表示 bcrypt 哈希已完成（$2 开头），token 未签发（注册不签发 JWT） *)
Register ==
    /\ authStep = "init"
    /\ authStep' = "registered"
    /\ passwordHashed' = 1
    /\ UNCHANGED tokenIssued

(* 登录原子步：registered → authenticated，签发 JWT —— 对应 DD-AUTH-CTRL.login → DD-AUTH-SVC.login
   原子步序列：DD-USER-SVC.findByUsername 查找用户 → DD-PASSWORD-UTIL.compare 比对哈希 → DD-JWT-UTIL.sign 签发 token
   tokenIssued 置 1 表示 JWT 已签发（payload 含 userId/role，过期 1h） *)
Login ==
    /\ authStep = "registered"
    /\ authStep' = "authenticated"
    /\ tokenIssued' = 1
    /\ UNCHANGED passwordHashed

(* 登出原子步：authenticated → logged_out，注销 JWT —— 对应 DD-AUTH-SVC 登出语义
   DD-JWT-UTIL.verify 校验 token 有效性后注销，tokenIssued 置 0 *)
Logout ==
    /\ authStep = "authenticated"
    /\ authStep' = "logged_out"
    /\ tokenIssued' = 0
    /\ UNCHANGED passwordHashed

(* 重置周期：logged_out → init —— 允许新的注册-登录周期，保证状态机无死锁
   密码哈希标志重置（新用户注册重新哈希） *)
ResetCycle ==
    /\ authStep = "logged_out"
    /\ authStep' = "init"
    /\ passwordHashed' = 0
    /\ UNCHANGED tokenIssued

(* Next：所有可能转移的析取 *)
Next ==
    \/ Register
    \/ Login
    \/ Logout
    \/ ResetCycle

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<authStep, passwordHashed, tokenIssued>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = |{init,registered,authenticated,logged_out}| × |{0,1}| × |{0,1}| = 4 × 2 × 2 = 16
   ≤ 1000，kept-below-threshold，无需拆解。
   注：本规格聚焦认证原子流（init→registered→authenticated→logged_out→init 循环），
   含密码 bcrypt 哈希（DD-PASSWORD-UTIL.hash）+ JWT 签发/验证（DD-JWT-UTIL.sign/verify）原子步，
   对应 DD-AUTH-SVC/DD-AUTH-CTRL 接口契约的状态语义。 *)
================
