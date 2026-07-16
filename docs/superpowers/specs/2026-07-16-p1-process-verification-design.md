# P1 过程级验证层设计（SkillCoach 思路）

## 1. 背景与定位

P0 已实现产物级验证（adaptive rubric + Krippendorff's α + DimensionAwareFilter），但只验"产物好不好"，不验"技能执行过程对不对"。P1 引入过程级验证，对齐 SkillCoach（arXiv:2607.01874）的过程评估思路。

**技能包边界**（P1 核心定位约束）：
- 技能包（SKILL.md / references / TS 校验代码 / rubric）是**静态文档与校验脚本合集**，不承载运行时执行。
- 所有 LLM/agent 运行时行为（读 reference、执行阶段）由**调用方 agent 系统**承接和观测。
- 因此 P1 的 ProcessRecorder 只校验**TS 代码路径内可观测**的过程信号；agent 层行为（如"是否读了 reference"）不在 P1 范围。

## 2. 范围

### 2.1 实现的维度（两维）

| 维度 | 含义 | 信号源（TS 可观测） | 判定 |
|---|---|---|---|
| **following** | 设计/编码阶段是否同步产出对应测试设计（W 模型并行原则，SKILL.md 核心约束 1） | router.ts 的 addTestCase 同步产出点 | 同命令周期内出现 `testDesignProduced` 事件 → pass；缺失 → warn |
| **composition** | 阶段产出后 RTM 是否同步更新 | rtm-manager.ts 的 rebuild/logChange | 同命令周期内 `artifactProduced` 与 `rtmUpdated` 共存 → pass；缺失 → warn |

### 2.2 明确不做（避免 P0 式 spec 失真）

| 项 | 原因 | 后续 |
|---|---|---|
| **selection 维度**（阶段是否加载正确 reference） | reference 加载发生在 agent 层，TS 代码路径内零加载逻辑，不可观测 | 待 agent 系统过程上报机制成熟后做（P3+） |
| **reflection 维度**（自检是否对照验收标准） | 需解析自检文本语义，判断难且不准 | P2 |
| **阶段 5/6/7 覆盖** | code/test 单元/集成/系统命令无 verify* 调用 | 后续补 verify 触发点后扩展 |
| **composition 时序校验** | 现状 rebuild() 在 verify*() 之前（router.ts），时序假设需重构 router | 判定改为顺序无关，不重构 |

### 2.3 覆盖阶段

仅 1/2/3/4/8（有 verify* 或 RTM 质量门的阶段）。5/6/7 明确标记"未覆盖"。

## 3. 决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 过程信号源 | TS 代码路径内可观测事件（router.ts + rtm-manager.ts） | agent 层不可观测，技能包不承载运行时观测 |
| 维度范围 | following + composition 两维 | selection 不可观测、reflection 判断不准 |
| 执行模式 | 软标记独立输出 `ProcessVerificationResult` | 不进阶段门质量分、不阻塞流程，低风险易回滚 |
| composition 时序 | 顺序无关，只验同周期共存 | 适配现状（rebuild 先于 verify），不重构 router |
| 默认开关 | 关闭（`process.enabled=false`） | 向后兼容，现有 147 测试零改动 |
| 埋点侵入 | 轻量 append-only，关闭时 no-op | 最小侵入 |

## 4. 架构

```
命令执行（router.ts）:
  addRequirement/addDesign/addTestCase → ProcessRecorder.recordArtifactProduced(phase, type, id)
  同步产出测试设计（3 处）           → ProcessRecorder.recordTestDesignProduced(phase, linkedId, tcId)
  ctx.rtm.rebuild()/logChange()       → ProcessRecorder.recordRtmUpdated(phase)
  ctx.verifier.verify*()              → ProcessRecorder.recordVerifyCalled(phase, type)

阶段门评审时:
  WModelVerifierEnhancer.verifyProcess(phase)
    → ProcessVerifier.verify(events, phase)
        ├ following: 查 testDesignProduced 事件（设计/编码阶段）
        └ composition: 查 artifactProduced 与 rtmUpdated 同周期共存
    → ProcessVerificationResult（独立返回，不进 VerificationResult）
```

## 5. 组件

### 5.1 新增组件

**`ProcessRecorder`**（新文件 `src/core/process-recorder.ts`）
- 职责：被动接收过程事件，append-only 存储。
- 事件类型（4 种，联合类型 `ProcessEvent`）：
  - `artifactProduced`：`{ phase, artifactType: 'requirement'|'design'|'testcase', artifactId, timestamp }`
  - `testDesignProduced`：`{ phase, linkedArtifactId, testCaseId, timestamp }`
  - `rtmUpdated`：`{ phase, timestamp }`
  - `verifyCalled`：`{ phase, verifyType: 'requirement'|'design'|'testcase', timestamp }`
- 接口：`recordArtifactProduced(...)`、`recordTestDesignProduced(...)`、`recordRtmUpdated(...)`、`recordVerifyCalled(...)`、`getEvents(phase?): ProcessEvent[]`、`clear(phase?)`
- 关闭模式（`enabled=false`）：所有 `record*` 方法 no-op，`getEvents` 返回空数组。
- 单实例内存态，不持久化（YAGNI，当前命令串行执行）。

**`ProcessVerifier`**（新文件 `src/core/process-verifier.ts`）
- 职责：消费 `ProcessRecorder` 事件流，按阶段算两维。
- 接口：`verify(events: ProcessEvent[], phase: ProjectPhase): ProcessVerificationResult`
- **following 判定**：
  - 设计阶段（系统设计/概要设计/详细设计）+ 编码阶段：检查是否有 `testDesignProduced` 事件
  - 需求阶段：检查是否有 `testDesignProduced`（analyze 同步产出验收测试）
  - 有 → pass；无 → warn（"未观测到测试设计同步产出事件"）
- **composition 判定**：
  - 检查同 phase 内 `artifactProduced` 与 `rtmUpdated` 是否共存
  - 共存 → pass；只有 artifact 无 rtm → fail（产出但 RTM 未更新，明确问题）；只有 rtm 无 artifact → warn（可能是 rebuild 触发但无产出，如 reset/import）
  - 顺序无关（适配现状 rebuild 先于 verify）

### 5.2 修改的组件

**`WModelVerifierEnhancer`**（`src/core/w-model-enhancer.ts`）
- 加字段 `private processRecorder: ProcessRecorder | null`
- 加字段 `private processConfig: NonNullable<VerifierConfig['process']>`
- 构造函数：`processConfig = config.process ?? { enabled: false }`；`if (processConfig.enabled) processRecorder = new ProcessRecorder()`
- 加方法 `verifyProcess(phase: ProjectPhase): ProcessVerificationResult | null`（关闭返回 null）
- 三个 verify* 首行加 `this.processRecorder?.recordVerifyCalled(phase, type)`——但 verify* 当前签名无 phase 参数，需加可选 `phase?: ProjectPhase` 参数（不破坏现有调用）

**`RTMManager`**（`src/state/rtm-manager.ts`）
- 构造函数加可选 `processRecorder?: ProcessRecorder` 参数
- `rebuild()` 与 `logChange()` 内部调 `this.processRecorder?.recordRtmUpdated(this.currentPhase())`
- `currentPhase()` 从 `stateManager.load()` 的 `store.project.status` 取

**`createCommandContext`**（`src/index.ts`）
- 创建共享 `ProcessRecorder` 实例（按 config.process.enabled）
- 注入 RTMManager 与 WModelVerifierEnhancer

**`router.ts`**（`src/commands/router.ts`）
- 5 处产出点后加 `ctx.processRecorder?.recordArtifactProduced(phase, type, id)`
- 3 处同步测试设计后加 `ctx.processRecorder?.recordTestDesignProduced(phase, linkedId, tcId)`
- analyze/design/test 验收阶段门处并行调 `ctx.verifier?.verifyProcess(phase)`，结果附入输出消息（软标记）

### 5.3 类型扩展（`src/types/index.ts`）

```typescript
/** 过程事件联合类型 */
export type ProcessEvent =
  | { type: 'artifactProduced'; phase: ProjectPhase; artifactType: 'requirement' | 'design' | 'testcase'; artifactId: string; timestamp: string }
  | { type: 'testDesignProduced'; phase: ProjectPhase; linkedArtifactId: string; testCaseId: string; timestamp: string }
  | { type: 'rtmUpdated'; phase: ProjectPhase; timestamp: string }
  | { type: 'verifyCalled'; phase: ProjectPhase; verifyType: 'requirement' | 'design' | 'testcase'; timestamp: string };

/** 过程维度状态 */
export interface ProcessDimensionResult {
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  evidence: string[];  // 相关事件摘要
}

/** 过程验证结果（独立于 VerificationResult） */
export interface ProcessVerificationResult {
  phase: ProjectPhase;
  enabled: boolean;
  dimensions: {
    following: ProcessDimensionResult;
    composition: ProcessDimensionResult;
  };
  summary: string;
}
```

`VerifierConfig` 增：
```typescript
process?: {
  enabled: boolean;
};
```

## 6. 埋点位置（深探已定位）

| 事件 | 文件 | 行号 | 上下文 |
|---|---|---|---|
| artifactProduced (requirement) | router.ts | 139 后 | addRequirement 完成 |
| artifactProduced (design) | router.ts | 226 后 | addDesign 完成 |
| artifactProduced (testcase, 多处) | router.ts | 148/237/302 后 | addTestCase 完成 |
| testDesignProduced (analyze) | router.ts | 148 后 | 同步验收测试 |
| testDesignProduced (design) | router.ts | 237 后 | 同步对应测试 |
| testDesignProduced (code) | router.ts | 302 后 | 同步单元测试 |
| rtmUpdated | rtm-manager.ts | rebuild(61)/logChange(90) 内 | RTM 重建 |
| verifyCalled | w-model-enhancer.ts | verify*(78/95/112) 首行 | verify 调用 |
| verifyProcess 调用 | router.ts | 171/255/403 旁 | 阶段门并行 |

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| process 关闭 | Recorder 所有 record* no-op；verifyProcess 返回 `{ enabled: false, summary: 'process verification disabled' }` |
| following 事件缺失 | status='warn'，detail="未观测到测试设计同步产出事件（埋点可能漏，≠ 未发生）" |
| composition 有产出无 RTM 更新 | status='fail'，detail="阶段产出后 RTM 未同步更新" |
| composition 有 RTM 无产出 | status='warn'，detail="RTM 更新但无产出登记（可能是 reset/import 触发）" |
| 跨阶段事件 | ProcessVerifier 按 phase 过滤，不串阶段 |
| verify* 未传 phase | recordVerifyCalled 跳过（phase 可选，无则不记） |

## 8. 测试策略

**新增测试**：
- `tests/process-recorder.test.ts`：
  - append-only：连续 record 后 getEvents 返回全部
  - no-op 模式：enabled=false 时 record 不生效、getEvents 返回空
  - 事件类型与证据保留（artifactId/testCaseId 等字段）
  - clear(phase) 按阶段清理
- `tests/process-verifier.test.ts`：
  - following pass：设计阶段有 testDesignProduced
  - following warn：设计阶段无 testDesignProduced
  - composition pass：artifactProduced + rtmUpdated 同周期
  - composition fail：artifactProduced 无 rtmUpdated
  - composition warn：rtmUpdated 无 artifactProduced
  - 跨阶段隔离：phase A 事件不影响 phase B 判定
  - disabled：返回 enabled=false

**扩展测试**：
- `tests/w-model-enhancer.test.ts`：verifyProcess 在 enabled/disabled 下行为；verify* 加 phase 参数后现有测试不破坏
- `tests/command-router.test.ts`：埋点不破坏现有命令；verifyProcess 结果附入消息

**回归保护**：现有 147 测试在 process 默认关闭下全部不受影响（Recorder no-op，verify* 的 phase 参数可选）。

## 9. 集成点与文件清单

| 文件 | 改动类型 |
|---|---|
| `src/core/process-recorder.ts` | 新增 |
| `src/core/process-verifier.ts` | 新增 |
| `src/types/index.ts` | 修改：加 ProcessEvent/ProcessDimensionResult/ProcessVerificationResult + VerifierConfig.process |
| `src/core/w-model-enhancer.ts` | 修改：加 processRecorder/processConfig 字段、verifyProcess 方法、verify* 加 phase? 参数 |
| `src/state/rtm-manager.ts` | 修改：构造函数加 processRecorder? 参数、rebuild/logChange 内埋点 |
| `src/commands/router.ts` | 修改：5 处产出点 + 3 处测试设计点埋点、阶段门并行 verifyProcess |
| `src/index.ts` | 修改：createCommandContext 创建共享 Recorder 并注入；导出新 API |
| `tests/process-recorder.test.ts` | 新增 |
| `tests/process-verifier.test.ts` | 新增 |
| `tests/w-model-enhancer.test.ts` | 修改：扩展 |
| `tests/command-router.test.ts` | 修改：扩展 |

## 10. 成功标准

1. process 关闭时，现有 147 测试全部通过，行为零变化。
2. process 开启时，`verifyProcess(phase)` 返回 `ProcessVerificationResult`，含 following + composition 两维。
3. following 维度：设计/编码阶段同步产出测试设计 → pass；缺失 → warn。
4. composition 维度：产出 + RTM 更新共存 → pass；有产出无 RTM → fail；有 RTM 无产出 → warn。
5. 跨阶段事件隔离：phase A 的事件不影响 phase B 的判定。
6. 埋点不破坏现有命令执行（router 测试全绿）。
7. ProcessRecorder 关闭时 no-op，零副作用。

## 11. 已知局限（诚实记录）

- selection 维度未实现：reference 加载在 agent 层不可观测，需 agent 系统过程上报机制（P3+）。
- reflection 维度未实现：需语义解析，留 P2。
- 阶段 5/6/7 未覆盖：code/test 单元/集成/系统命令无 verify* 调用。
- composition 不校验时序：现状 rebuild() 先于 verify*()，判定改为顺序无关。
- ProcessRecorder 单实例内存态：不持久化、多并发命令不隔离（当前命令串行，YAGNI）。
- verify* 的 phase 参数为可选：调用方不传则 verifyCalled 事件不记录，following/composition 仍可基于 artifactProduced/testDesignProduced/rtmUpdated 判定。

## 12. 与 P0 的关系

- P0 的 `deploymentGate`/`dimensionFlags`/`reliability` 是**产物级**信号；P1 的 `ProcessVerificationResult` 是**过程级**信号，两者独立。
- P1 为 P2（SkillOpt 进化环）提供过程信号：进化环 Gate 可同时消费产物信号（P0）与过程信号（P1），区分"偶然通过的产物"与"正确执行的过程"。
- P1 的 ProcessRecorder 事件流可作为 P2 Reflect 阶段的输入（分析失败轨迹时看过程是否出错）。
