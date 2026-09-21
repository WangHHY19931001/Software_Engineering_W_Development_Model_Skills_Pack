# E-2 规格修正案：R0 首阶段自举形态（方案 B）v1.0

> 状态：**已批准**（用户确认方案 B，2026-09-22）
> 依据：根因定位报告 `docs/debug/2026-09-22-e2-r8-r0-rootcause/README.md`（R 定位者产出；死锁三态在本机实测复现）。

## §1 根因结论（引自 R 报告）

checkpoint 放行记录被赋予两个时序不可兼得的角色（R0/R11 的「放行事件凭证：先写供门验」 vs R8 的「阶段终点标记：最后写」），且 R0 把「放行发生过」锚定在 run-log 派生记录而非初级证据（checkpoint-log 用户确认原文）。三批独立合入的规则（R8 → R0 → R11/D-6）在阶段 1 零记录态联合成死锁；阶段 ≥2 被历史放行记录掩盖。

**决定性实证**：自然时序（用户确认落盘 → 闭环五门 → 最后写放行记录）在现行 R8/R11 下**已经 exit 0**——R0 是唯一阻塞点。

## §2 修正内容

### 2.1 R0 首阶段自举形态（`logic/checkpoint-logic.ts`）

现行为：`checkpoints.length === 0` → 一律违规「run-log 无 checkpoint success 记录（无法证明阶段 CHECKPOINT 已放行…）」。

改为：`checkpoints.length === 0` 且 **`--checkpoint-log` 已提供且目录加载含 `phase-1` 条目**（即下一次放行必为首放行；`get('1')` 非空白）时，R0 不违规，改为输出**非阻断 diagnostic**（建议前缀 `BOOTSTRAP_VALIDATION:`，注明「首阶段自举校验：以 checkpoint-log 用户确认为初级证据；放行记录将于闭环门后写入」），并正常通过（R1-R4 对空记录集空转，语义不变）。

> **勘误（2026-09-22，修复轮 1）**：本节初版文案「目录加载含至少一条用户确认（Map 非空）」存在相位缝隙——零记录 + 目录仅含 `phase-2.txt` 时首放行初级证据为零却可 exit 0（审查实跑复现）。按根因报告 §6-B 收紧为「Map 含 `phase-1`（即下一次放行必为首放行）条目」：零放行记录 ⇒ 下一次放行必为首放行，仅首放行确认可支撑自举；加载器既有宽松（任意 `*-<数字>.txt` 计入 Map）由此由 `get('1')` 兜住。

- 未提供 `--checkpoint-log` 或目录为空/不可读 → **维持现行违规**（fail-closed 方向不变：零证据仍不等于合规）。
- 该形态只覆盖「零记录」态；一旦放行记录写入，后续校验走既有全量路径（R1-R5 不变）。
- 反伪造边界：checkpoint-log 本身即 R3 的指定用户确认证据；伪确认的下场与伪记录相同（下游 R11/role-dispatch/跨阶段消费者仍拦截），且门禁输出留痕可审计。

### 2.2 D-6 后置窗口降级为历史兼容（`logic/run-log-logic.ts`，零行为变化）

自然时序合法化后，R11 的全域严格判据（五门记录严格早于放行）成为常态可满足；D-6 的 phase-1 后置窗口**保留但重定性**为「历史日志兼容」（分支内 `phase===1 && script==='check-checkpoint.ts'` 的判据、测试、文案不改；仅文档与注释重定性）。不删除——删它会红掉以旧时序写入的历史 run-log。

### 2.3 文档与登记销项

- `references/operational-recovery.md`「阶段 1 自举豁免（R11 后置窗口，D-6）」节的「已知张力（R8 同源）」段**销项**：改写为「R0 首阶段自举形态（本修正案）落地后，自然时序『确认落盘 → 闭环五门 → 写放行记录』即合法；后置窗口保留为历史日志兼容」。
- `CHANGELOG.md` 未解清单①（E-2）销项；同节补记本修正案。
- `hard-constraints.md` 若约束 #11 相关联的闭环时序描述受影响，同步一句（以实搜为准）。
- `docs/debug/2026-09-22-e2-r8-r0-rootcause/README.md` 状态注：已批准、已实施（提交号回填）。

## §3 验收

1. 新单测（`checkpoint-logic.test.ts` 扩展）：① 零记录 + checkpointLog 非空 → `passed===true` 且含 `BOOTSTRAP_VALIDATION` 诊断、无 R0 违规；② 零记录 + 无 checkpointLog → R0 违规仍在（fail-closed 回归）；③ 零记录 + checkpointLog 空目录语义（`checkpointLogMissingReason`）→ R0 违规仍在；④ 有记录路径零变化（既有用例不回归）。
2. 端到端：构造最小 phase-1 自举时序（确认落盘 → 四门+check-checkpoint → 写放行记录）跑 `check-run-log.ts` → **exit 0 且无 R8/R11 违规**（这是 E-2 的原始判据）。
3. `npm run self-test`（新增用例计数同步全出现处）+ `npm run prepush` exit 0。
4. 文档销项后 `grep "已知张力"` 活体面归零或改为已消解表述。

## §4 不做

- 不改 R8 任何判据；不删 D-6 窗口；不动 schema；不新增依赖。
- `eval/e2e/demo` 不要求演练自举形态（装配器基准不覆盖；单测与端到端最小构造为验收载体）。
